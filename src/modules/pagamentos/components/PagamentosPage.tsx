import React, { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useNotification } from '../../../hooks/useNotification';
import { useDialog } from '../../../hooks/useDialog';
import type { PaymentRequest } from '../../../types';
import Notification from '../../../components/Notification';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { PaymentRequestSkeleton } from '../../../components/PageLoadingSkeleton';
import {
  contarPorAba,
  estaNaAba,
  filtrarSemAba,
  opcoesDosRecortes,
  ordenarPedidos,
  paraISO,
  podeVer,
  temFiltroAtivo,
  type Acesso,
} from '../domain/filtrosPagamentos';
import { usePaymentRequest } from '../hooks/usePaymentRequest';
import { useFiltrosPagamentos } from '../hooks/useFiltrosPagamentos';
import { gerarPdfPedido } from '../pdfPedido';
import BarraFiltrosPagamentos from './BarraFiltrosPagamentos';
import EstadoVazioPedidos from './EstadoVazioPedidos';
import ListaPedidos from './ListaPedidos';
import NovoPedidoModal from './NovoPedidoModal';
import VisualizadorImagem, { type ImagemAberta } from './VisualizadorImagem';

// Solicitações de pagamento: orquestra os dados, os filtros (no endereço da página) e as
// ações. A barra, a lista, o card e o formulário são componentes próprios.

const PagamentosPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { paymentRequests, loading, createPedido, updatePaymentRequestStatus, deletePaymentRequest, getNextPaymentDate } =
    usePaymentRequest();
  const { notification, showSuccess, showError, showWarning, showInfo, hideNotification } = useNotification();
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();
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

  const aprovar = (p: PaymentRequest) =>
    showConfirmDialog('Aprovar solicitação', `Deseja aprovar o pedido "${p.codigo}"?`, async () => {
      try {
        await updatePaymentRequestStatus(p.id, 'approved', userProfile?.name);
        showSuccess('Pedido aprovado com sucesso!');
      } catch {
        showError('Erro ao aprovar pedido');
      }
    });

  const rejeitar = (p: PaymentRequest) =>
    showConfirmDialog(
      'Rejeitar solicitação',
      `Deseja rejeitar o pedido "${p.codigo}"? Esta ação não pode ser desfeita.`,
      async () => {
        try {
          await updatePaymentRequestStatus(p.id, 'rejected', undefined, 'Rejeitado pelo operador');
          showSuccess('Pedido rejeitado.');
        } catch {
          showError('Erro ao rejeitar pedido');
        }
      },
      { type: 'danger', confirmText: 'Rejeitar' },
    );

  const pagar = (p: PaymentRequest) =>
    showConfirmDialog('Marcar como pago', `Confirma que o pedido "${p.codigo}" foi pago?`, async () => {
      try {
        await updatePaymentRequestStatus(p.id, 'paid', userProfile?.name);
        showSuccess('Pedido marcado como pago!');
      } catch {
        showError('Erro ao atualizar pedido');
      }
    });

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

  const imprimir = (p: PaymentRequest) => {
    const arquivo = gerarPdfPedido(p);
    showSuccess('PDF gerado!', `Comprovante "${arquivo}" foi baixado com sucesso.`);
  };

  if (loading) {
    return <PaymentRequestSkeleton />;
  }

  return (
    <div className="space-y-6">
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
      <VisualizadorImagem imagem={imagemAberta} onFechar={fecharImagem} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Solicitações de Pagamento
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Pedidos de pagamento, reembolso e adiantamento</p>
        </div>
        <button
          type="button"
          onClick={() => setNovoAberto(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova solicitação
        </button>
      </div>

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
