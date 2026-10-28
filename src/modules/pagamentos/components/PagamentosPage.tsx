import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useNotification } from '../../../hooks/useNotification';
import { useDialog } from '../../../hooks/useDialog';
import type { PaymentRequest } from '../../../types';
import Notification from '../../../components/Notification';
import ConfirmDialog from '../../../components/ConfirmDialog';
import InputDialog from '../../../components/InputDialog';
import { PaymentRequestSkeleton } from '../../../components/PageLoadingSkeleton';
import { formatCurrency } from '../../../utils/paymentUtils';
import {
  contarPorAba,
  estaNaAba,
  filtrarSemAba,
  opcoesDosRecortes,
  ordenarPedidos,
  paraISO,
  podeVer,
  temFiltroAtivo,
  totalDe,
  type Acesso,
} from '../domain/filtrosPagamentos';
import { usePaymentRequest } from '../hooks/usePaymentRequest';
import { useFiltrosPagamentos } from '../hooks/useFiltrosPagamentos';
import { gerarPdfPedido } from '../pdfPedido';
import BarraAcoesEmLote from './BarraAcoesEmLote';
import BarraFiltrosPagamentos from './BarraFiltrosPagamentos';
import EstadoVazioPedidos from './EstadoVazioPedidos';
import ListaPedidos from './ListaPedidos';
import NovoPedidoModal from './NovoPedidoModal';
import VisualizadorImagem, { type ImagemAberta } from './VisualizadorImagem';

// Solicitações de pagamento: orquestra os dados, os filtros (no endereço da página) e as
// ações. A barra, a lista, o card e o formulário são componentes próprios.

const PagamentosPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const {
    paymentRequests,
    loading,
    createPedido,
    updatePaymentRequestStatus,
    updatePaymentRequestsStatus,
    decidirAutorizacao,
    deletePaymentRequest,
    getNextPaymentDate,
  } = usePaymentRequest();
  // ?pedido=id: link dos e-mails e do sininho, que abre o pedido na lista.
  const [params] = useSearchParams();
  const destaque = params.get('pedido');
  const { notification, showSuccess, showError, showWarning, showInfo, hideNotification } = useNotification();
  const {
    confirmDialog,
    showConfirmDialog,
    hideConfirmDialog,
    handleConfirmDialogConfirm,
    inputDialog,
    showInputDialog,
    hideInputDialog,
    handleInputDialogConfirm,
  } = useDialog();
  const [novoAberto, setNovoAberto] = useState(false);
  const [imagemAberta, setImagemAberta] = useState<ImagemAberta | null>(null);
  const fecharImagem = useCallback(() => setImagemAberta(null), []);
  const avisos = useMemo(
    () => ({ showSuccess, showError, showWarning, showInfo }),
    [showSuccess, showError, showWarning, showInfo],
  );

  // Aprovar, rejeitar, marcar como pago e excluir.
  const permissoes = userProfile?.permissions ?? [];
  const canApprove = permissoes.includes('canApprovePayments');
  // Ver os pedidos de todos os setores (e escolher setor nos filtros). Quem aprova já vê
  // todos; canViewAllPayments é só a leitura, sem as ações.
  const vePagamentosDeTodos = canApprove || permissoes.includes('canViewAllPayments');

  // Filtros no endereço da página; a lista sai do domínio (domain/filtrosPagamentos).
  const { filtros, alterar, limpar } = useFiltrosPagamentos(canApprove);
  const hoje = paraISO(new Date());
  const acesso = useMemo<Acesso>(
    () => ({ veTodos: vePagamentosDeTodos, departamento: userProfile?.department, userId: user?.id, email: user?.email }),
    [vePagamentosDeTodos, userProfile?.department, user?.id, user?.email],
  );
  const visiveis = useMemo(() => paymentRequests.filter((p) => podeVer(p, acesso)), [paymentRequests, acesso]);
  const opcoes = useMemo(() => opcoesDosRecortes(visiveis), [visiveis]);
  // As abas contam sobre o recorte sem a aba: o número de cada uma bate com o que ela mostra.
  const semAba = useMemo(() => filtrarSemAba(visiveis, filtros, acesso, hoje), [visiveis, filtros, acesso, hoje]);
  const contagem = useMemo(() => contarPorAba(semAba), [semAba]);
  const pedidos = useMemo(
    () => ordenarPedidos(semAba.filter((p) => estaNaAba(p, filtros.aba)), filtros.ordem),
    [semAba, filtros.aba, filtros.ordem],
  );

  // Ações em lote (quem aprova): só pedidos em que cabe uma ação. Mudar um filtro limpa a
  // seleção, para nunca agir num pedido que saiu da tela.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  useEffect(() => setSelecionados(new Set()), [filtros]);
  const podeSelecionar = useCallback(
    (p: PaymentRequest) => canApprove && (p.status === 'pending' || p.status === 'approved'),
    [canApprove],
  );
  const marcar = useCallback(
    (ids: string[], marcado: boolean) =>
      setSelecionados((atuais) => {
        const novos = new Set(atuais);
        ids.forEach((id) => (marcado ? novos.add(id) : novos.delete(id)));
        return novos;
      }),
    [],
  );
  const pedidosSelecionados = useMemo(
    () => pedidos.filter((p) => selecionados.has(p.id) && podeSelecionar(p)),
    [pedidos, selecionados, podeSelecionar],
  );

  const aprovar = (p: PaymentRequest) =>
    showConfirmDialog('Aprovar solicitação', `Deseja aprovar o pedido "${p.codigo}"?`, async () => {
      try {
        await updatePaymentRequestStatus(p.id, 'approved', userProfile?.name);
        showSuccess('Pedido aprovado com sucesso!');
      } catch {
        showError('Erro ao aprovar pedido');
      }
    }, { type: 'info', confirmText: 'Aprovar' });

  // Quem rejeita é o autorizador (pedido que espera por ele, pela função do banco; quem pediu
  // recebe e-mail) ou o Financeiro. O motivo é obrigatório e aparece no pedido para quem
  // pediu (antes era sempre o texto fixo "Rejeitado pelo operador").
  const rejeitar = async (p: PaymentRequest) => {
    const comoAutorizador = p.status === 'awaiting_authorization' && p.autorizadoPorId === user?.id;
    const motivo = await showInputDialog(
      'Rejeitar solicitação',
      `Por que o pedido "${p.codigo}" está sendo rejeitado? O motivo aparece para quem pediu${comoAutorizador ? ' e vai no e-mail para ele' : ''}.`,
      { placeholder: 'Ex.: falta a nota fiscal', confirmText: 'Rejeitar', required: true },
    );
    if (!motivo) return;
    try {
      if (comoAutorizador) {
        await decidirAutorizacao(p.id, false, motivo);
        showSuccess('Pedido rejeitado', 'Quem pediu recebe um e-mail com o motivo.');
      } else {
        await updatePaymentRequestStatus(p.id, 'rejected', undefined, motivo, userProfile?.name);
        showSuccess('Pedido rejeitado.');
      }
    } catch (erro) {
      showError('Erro ao rejeitar pedido', erro instanceof Error ? erro.message : undefined);
    }
  };

  const autorizar = (p: PaymentRequest) =>
    showConfirmDialog(
      'Autorizar pagamento',
      `Autorizar o pedido "${p.codigo}" (${formatCurrency(p.valorTotal)} para ${p.fornecedor})? Ele segue para a aprovação do Financeiro.`,
      async () => {
        try {
          await decidirAutorizacao(p.id, true);
          showSuccess('Pedido autorizado', 'Quem pediu e o Financeiro foram avisados por e-mail.');
        } catch (erro) {
          showError('Não foi possível autorizar', erro instanceof Error ? erro.message : undefined);
        }
      },
      { type: 'info', confirmText: 'Autorizar' },
    );

  const pagar = (p: PaymentRequest) =>
    showConfirmDialog('Marcar como pago', `Confirma que o pedido "${p.codigo}" foi pago?`, async () => {
      try {
        await updatePaymentRequestStatus(p.id, 'paid', userProfile?.name);
        showSuccess('Pedido marcado como pago!');
      } catch {
        showError('Erro ao atualizar pedido');
      }
    }, { type: 'info', confirmText: 'Marcar como pago' });

  const excluir = (p: PaymentRequest) =>
    showConfirmDialog(
      'Excluir solicitação',
      `Deseja excluir o pedido "${p.codigo}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await deletePaymentRequest(p.id);
          showSuccess('Pedido excluído com sucesso!');
        } catch {
          showError('Erro ao excluir pedido');
        }
      },
      { type: 'danger', confirmText: 'Excluir' },
    );

  const emLote = (lista: PaymentRequest[], de: PaymentRequest['status'], para: PaymentRequest['status'], verbo: string, feito: [string, string]) =>
    showConfirmDialog(
      `${verbo} ${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}`,
      `${verbo} ${lista.length === 1 ? 'o pedido selecionado' : `os ${lista.length} pedidos selecionados`}, somando ${formatCurrency(totalDe(lista))}?`,
      async () => {
        try {
          const n = await updatePaymentRequestsStatus(lista.map((p) => p.id), de, para, userProfile?.name);
          setSelecionados(new Set());
          showSuccess(
            `${n} ${n === 1 ? feito[0] : feito[1]}`,
            n < lista.length ? `${lista.length - n} já tinham mudado de status e ficaram como estavam.` : undefined,
          );
        } catch {
          showError('Erro ao atualizar os pedidos');
        }
      },
      { type: 'info', confirmText: verbo },
    );
  const aprovarEmLote = (lista: PaymentRequest[]) =>
    emLote(lista, 'pending', 'approved', 'Aprovar', ['pedido aprovado.', 'pedidos aprovados.']);
  const pagarEmLote = (lista: PaymentRequest[]) =>
    emLote(lista, 'approved', 'paid', 'Marcar como pago', ['pedido marcado como pago.', 'pedidos marcados como pagos.']);

  const imprimir = (p: PaymentRequest) => {
    const arquivo = gerarPdfPedido(p);
    showSuccess('PDF gerado!', `Comprovante "${arquivo}" foi baixado com sucesso.`);
  };

  if (loading) {
    return <PaymentRequestSkeleton />;
  }

  const comSelecao = pedidosSelecionados.length > 0;

  return (
    // O botão "Nova" (celular) e a barra de lote flutuam no rodapé: o respiro evita que
    // cubram o último card.
    <div className={`space-y-5 sm:space-y-6 ${comSelecao ? 'pb-40 sm:pb-24' : 'pb-24 sm:pb-0'}`}>
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
        type={confirmDialog.type}
      />
      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        message={inputDialog.message}
        placeholder={inputDialog.placeholder}
        confirmText={inputDialog.confirmText}
        cancelText={inputDialog.cancelText}
        required={inputDialog.required}
        onConfirm={handleInputDialogConfirm}
        onCancel={() => {
          inputDialog.onCancel?.();
          hideInputDialog();
        }}
      />
      <VisualizadorImagem imagem={imagemAberta} onFechar={fecharImagem} />
      <BarraAcoesEmLote
        selecionados={pedidosSelecionados}
        onAprovar={aprovarEmLote}
        onPagar={pagarEmLote}
        onLimpar={() => setSelecionados(new Set())}
      />

      <div className="flex items-center justify-between gap-4 animate-fade-in-up">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Solicitações de Pagamento
          </h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">Pedidos de pagamento, reembolso e adiantamento</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoAberto(true)}
          className="hidden sm:flex flex-shrink-0 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 items-center justify-center shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova solicitação
        </button>
      </div>

      {/* Celular: "Nova solicitação" flutua no canto, ao alcance do polegar. Some com a
          barra de lote, que ocupa o mesmo lugar. Sem portal: fica dentro do app, e as caixas
          de confirmação (ConfirmDialog, InputDialog) e o visualizador de imagem passam por cima. */}
      {!comSelecao && !novoAberto && (
        <button
          type="button"
          onClick={() => setNovoAberto(true)}
          className="sm:hidden fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-2 h-14 pl-4 pr-5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold shadow-xl shadow-blue-600/30 ring-1 ring-white/20 active:scale-95 transition-transform animate-fade-in-up"
        >
          <Plus className="w-5 h-5" />
          Nova solicitação
        </button>
      )}

      {novoAberto && (
        <NovoPedidoModal
          onFechar={() => setNovoAberto(false)}
          createPedido={createPedido}
          getNextPaymentDate={getNextPaymentDate}
          avisos={avisos}
        />
      )}

      <BarraFiltrosPagamentos
        filtros={filtros}
        alterar={alterar}
        limpar={limpar}
        contagem={contagem}
        quantidade={pedidos.length}
        total={contagem[filtros.aba].valor}
        hoje={hoje}
        opcoes={opcoes}
        mostrarSetor={vePagamentosDeTodos}
      />

      {pedidos.length === 0 ? (
        <EstadoVazioPedidos
          aba={filtros.aba}
          filtrando={temFiltroAtivo(filtros)}
          semPedidos={visiveis.length === 0}
          onLimpar={limpar}
          onNovo={() => setNovoAberto(true)}
          onVerTodos={() => alterar({ aba: 'todos' })}
        />
      ) : (
        <ListaPedidos
          pedidos={pedidos}
          agrupar={filtros.ordem === 'pagamento'}
          hoje={hoje}
          podeAgir={canApprove}
          userId={user?.id}
          destaque={destaque}
          selecionados={canApprove ? selecionados : undefined}
          podeSelecionar={podeSelecionar}
          onMarcar={canApprove ? marcar : undefined}
          onAutorizar={autorizar}
          onAprovar={aprovar}
          onRejeitar={rejeitar}
          onPagar={pagar}
          onExcluir={excluir}
          onImprimir={imprimir}
          onAbrirImagem={(url, nome) => setImagemAberta({ url, nome })}
        />
      )}
    </div>
  );
};

export default PagamentosPage;
