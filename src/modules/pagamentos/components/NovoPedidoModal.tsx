import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, FileText, FileUp, Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import type { PaymentMethod, PaymentRequestFormValues, PaymentRequestType } from '../../../types';
import {
  formatCpfCnpj,
  getDayOfWeekName,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  validateCpfCnpj,
} from '../../../utils/paymentUtils';
import { FORMAS, paraISO, rotuloDiaCurto, TIPOS } from '../domain/filtrosPagamentos';
import { usePaymentAuthorizers } from '../hooks/usePaymentAuthorizers';
import type { usePaymentRequest } from '../hooks/usePaymentRequest';
import { CAMPO, ROTULO } from './estilos';

// Formulário do pedido num modal, em vez de abrir no meio da página empurrando a lista.
// O aviso dos dias de pagamento mora aqui, o único lugar em que ele importa.

type Hook = ReturnType<typeof usePaymentRequest>;

export interface Avisos {
  showSuccess: (titulo: string, mensagem?: string) => void;
  showError: (titulo: string, mensagem?: string) => void;
  showWarning: (titulo: string, mensagem?: string) => void;
  showInfo: (titulo: string, mensagem?: string) => void;
}

interface Props {
  onFechar: () => void;
  createPedido: Hook['createPedido'];
  getNextPaymentDate: Hook['getNextPaymentDate'];
  avisos: Avisos;
}

const TIPOS_ARQUIVO = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

const NovoPedidoModal: React.FC<Props> = ({ onFechar, createPedido, getNextPaymentDate, avisos }) => {
  const { user, userProfile } = useAuth();
  const { authorizers, loading: carregandoAutorizadores, error: erroAutorizadores } = usePaymentAuthorizers();
  const [enviando, setEnviando] = useState(false);
  const [dataSugerida, setDataSugerida] = useState(() => paraISO(getNextPaymentDate()));
  const [previas, setPrevias] = useState<(string | null)[]>([]);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<PaymentRequestFormValues>({
    tipoSolicitacao: 'PAGAMENTO',
    documentoNumero: '',
    fornecedor: '',
    cpfCnpj: '',
    valorTotal: 0,
    formaPagamento: 'PIX',
    dadosPagamento: '',
    descricaoDetalhada: '',
    solicitadoPor: userProfile?.name || '',
    autorizadoPor: '',
    autorizadoPorId: '',
    dataPagamento: '',
    emailUsuario: user?.email || '',
    attachments: [],
  });

  const alterar = (patch: Partial<PaymentRequestFormValues>) => setForm((atual) => ({ ...atual, ...patch }));
  const dataPagamento = typeof form.dataPagamento === 'string' ? form.dataPagamento : paraISO(form.dataPagamento);

  const escolherData = (data: string) => {
    alterar({ dataPagamento: data });
    if (!data) return;
    const escolhida = new Date(`${data}T00:00:00`);
    if (escolhida.getDay() !== 2 && escolhida.getDay() !== 4) {
      avisos.showWarning(
        'Data inválida',
        `A data selecionada (${getDayOfWeekName(escolhida)}) não é válida. Pagamentos são realizados apenas às terças e quintas-feiras.`,
      );
    }
  };

  const escolherAutorizador = (id: string) => {
    const autorizador = authorizers.find((a) => a.id === id);
    alterar({ autorizadoPorId: autorizador?.id ?? '', autorizadoPor: autorizador?.name ?? '' });
  };

  const adicionarArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validos: File[] = [];
    for (const arquivo of Array.from(e.target.files || [])) {
      if (!TIPOS_ARQUIVO.includes(arquivo.type)) {
        avisos.showError('Tipo de arquivo inválido', `"${arquivo.name}": apenas PDF, PNG e JPEG são permitidos.`);
      } else if (arquivo.size > TAMANHO_MAXIMO) {
        avisos.showError('Arquivo muito grande', `"${arquivo.name}" excede 10MB.`);
      } else {
        validos.push(arquivo);
      }
    }
    if (campoArquivo.current) campoArquivo.current.value = '';
    if (!validos.length) return;

    setForm((atual) => ({ ...atual, attachments: [...(atual.attachments || []), ...validos] }));
    validos.forEach((arquivo) => {
      if (!arquivo.type.startsWith('image/')) {
        setPrevias((atuais) => [...atuais, null]);
        return;
      }
      const leitor = new FileReader();
      leitor.onloadend = () => setPrevias((atuais) => [...atuais, leitor.result as string]);
      leitor.readAsDataURL(arquivo);
    });
  };

  const removerArquivo = (indice: number) => {
    setForm((atual) => ({ ...atual, attachments: (atual.attachments || []).filter((_, i) => i !== indice) }));
    setPrevias((atuais) => atuais.filter((_, i) => i !== indice));
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fornecedor || !form.valorTotal || !dataPagamento || !form.autorizadoPorId) {
      avisos.showError('Campos obrigatórios', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (form.cpfCnpj && !validateCpfCnpj(form.cpfCnpj)) {
      avisos.showError('CPF/CNPJ inválido', 'Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    setEnviando(true);
    try {
      const resultado = await createPedido(form, userProfile?.department || '');
      if (resultado.success) {
        avisos.showSuccess('Pedido criado!', resultado.message);
        onFechar();
      } else if (resultado.suggestedDate) {
        setDataSugerida(paraISO(resultado.suggestedDate));
        avisos.showWarning(
          'Data de pagamento inválida',
          `${resultado.message} Sugestão: ${rotuloDiaCurto(paraISO(resultado.suggestedDate))}.`,
        );
      } else {
        avisos.showError('Erro ao criar pedido', resultado.error || resultado.message);
      }
    } catch (erro) {
      console.error('Erro ao criar pedido:', erro);
      avisos.showError('Erro', 'Ocorreu um erro ao criar o pedido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const arquivos = form.attachments || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-novo-pedido"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-100 dark:border-gray-700 animate-scale-in my-8"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 id="titulo-novo-pedido" className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Nova solicitação de pagamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={enviar}>
          <div className="px-6 py-5 space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Os pagamentos são feitos às <strong>terças</strong> e <strong>quintas-feiras</strong>, com pelo menos{' '}
                <strong>48 horas</strong> de antecedência. Próxima data disponível:{' '}
                <strong>{rotuloDiaCurto(dataSugerida)}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={ROTULO}>Tipo de solicitação *</label>
                <Select
                  value={form.tipoSolicitacao}
                  onChange={(v) => alterar({ tipoSolicitacao: v as PaymentRequestType })}
                  options={TIPOS.map((t) => ({ value: t, label: PAYMENT_TYPE_LABELS[t] }))}
                  controlClass={CAMPO}
                  ariaLabel="Tipo de solicitação"
                />
              </div>
              <div>
                <label htmlFor="pedido-documento" className={ROTULO}>Número do documento</label>
                <input
                  id="pedido-documento"
                  type="text"
                  value={form.documentoNumero}
                  onChange={(e) => alterar({ documentoNumero: e.target.value })}
                  placeholder="NF, boleto etc."
                  className={CAMPO}
                />
              </div>
              <div>
                <label htmlFor="pedido-fornecedor" className={ROTULO}>Fornecedor/beneficiário *</label>
                <input
                  id="pedido-fornecedor"
                  type="text"
                  value={form.fornecedor}
                  onChange={(e) => alterar({ fornecedor: e.target.value })}
                  required
                  placeholder="Nome do fornecedor ou beneficiário"
                  className={CAMPO}
                />
              </div>
              <div>
                <label htmlFor="pedido-cpf" className={ROTULO}>CPF/CNPJ</label>
                <input
                  id="pedido-cpf"
                  type="text"
                  inputMode="numeric"
                  value={form.cpfCnpj}
                  onChange={(e) => alterar({ cpfCnpj: formatCpfCnpj(e.target.value) })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className={CAMPO}
                />
              </div>
              <div>
                <label htmlFor="pedido-valor" className={ROTULO}>Valor total *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">R$</span>
                  <input
                    id="pedido-valor"
                    type="number"
                    value={form.valorTotal || ''}
                    onChange={(e) => alterar({ valorTotal: parseFloat(e.target.value) || 0 })}
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    className={`${CAMPO} pl-12`}
                  />
                </div>
              </div>
              <div>
                <label className={ROTULO}>Forma de pagamento *</label>
                <Select
                  value={form.formaPagamento}
                  onChange={(v) => alterar({ formaPagamento: v as PaymentMethod })}
                  options={FORMAS.map((f) => ({ value: f, label: PAYMENT_METHOD_LABELS[f] }))}
                  controlClass={CAMPO}
                  ariaLabel="Forma de pagamento"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pedido-dados" className={ROTULO}>Dados para pagamento *</label>
              <textarea
                id="pedido-dados"
                value={form.dadosPagamento}
                onChange={(e) => alterar({ dadosPagamento: e.target.value })}
                required
                rows={3}
                placeholder="Chave PIX, dados bancários, código de barras do boleto etc."
                className={`${CAMPO} resize-none`}
              />
            </div>

            <div>
              <label htmlFor="pedido-descricao" className={ROTULO}>Descrição detalhada *</label>
              <textarea
                id="pedido-descricao"
                value={form.descricaoDetalhada}
                onChange={(e) => alterar({ descricaoDetalhada: e.target.value })}
                required
                rows={3}
                placeholder="Motivo do pagamento, serviços prestados, materiais adquiridos etc."
                className={`${CAMPO} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={ROTULO}>Data de pagamento desejada *</label>
                <DatePicker
                  value={dataPagamento}
                  onChange={escolherData}
                  placeholder="Escolha terça ou quinta"
                  controlClass={CAMPO}
                  ariaLabel="Data de pagamento desejada"
                />
                <button
                  type="button"
                  onClick={() => escolherData(dataSugerida)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Usar a próxima data ({rotuloDiaCurto(dataSugerida)})
                </button>
              </div>
              <div>
                <label className={ROTULO}>Autorizado por *</label>
                {/* Só aparece quem tem a permissão Ser Autorizador de Pagamentos; o trigger
                    payment_request_guard recusa qualquer outra pessoa. */}
                <Select
                  value={form.autorizadoPorId}
                  onChange={escolherAutorizador}
                  options={authorizers.map((a) => ({ value: a.id, label: a.name, description: a.department ?? undefined }))}
                  placeholder={carregandoAutorizadores ? 'Carregando…' : 'Selecione quem autorizou'}
                  disabled={carregandoAutorizadores || authorizers.length === 0}
                  searchable
                  searchPlaceholder="Buscar nome ou setor"
                  emptyText="Ninguém com esse nome pode autorizar."
                  controlClass={`${CAMPO} disabled:opacity-60 disabled:cursor-not-allowed`}
                  ariaLabel="Autorizado por"
                />
                {erroAutorizadores ? (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">{erroAutorizadores}</p>
                ) : !carregandoAutorizadores && authorizers.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                    Ninguém pode autorizar pagamentos ainda. Peça a quem gerencia cargos para marcar "Ser Autorizador de
                    Pagamentos" no cargo de quem autoriza.
                  </p>
                ) : form.autorizadoPorId && form.autorizadoPorId === user?.id ? (
                  <p className="text-xs text-violet-700 dark:text-violet-300 mt-2">
                    Você é o autorizador: o pedido já nasce autorizado e vai direto para a aprovação do Financeiro.
                  </p>
                ) : form.autorizadoPorId ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {form.autorizadoPor} recebe um e-mail para autorizar no Flow LAB; só depois o pedido vai para o Financeiro.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Solicitado por {form.solicitadoPor || 'você'}.</p>
                )}
              </div>
            </div>

            <div>
              <label className={ROTULO}>Anexos (contrato, boleto, documentos)</label>
              <input ref={campoArquivo} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={adicionarArquivos} multiple className="hidden" />
              <div className="space-y-2">
                {arquivos.map((arquivo, indice) => (
                  <div
                    key={`${arquivo.name}-${indice}`}
                    className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl"
                  >
                    {previas[indice] ? (
                      <img src={previas[indice]!} alt="" className="w-12 h-12 object-cover rounded-lg border border-green-300 dark:border-green-600 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">{arquivo.name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{(arquivo.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerArquivo(indice)}
                      aria-label={`Remover ${arquivo.name}`}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => campoArquivo.current?.click()}
                  className="w-full flex items-center justify-center gap-3 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 rounded-lg flex items-center justify-center transition-colors">
                    <FileUp className="w-5 h-5 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                      {arquivos.length === 0 ? 'Clique para anexar arquivo(s)' : 'Adicionar mais arquivos'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF, PNG ou JPEG (máx. 10MB cada)</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 rounded-b-2xl">
            <button
              type="button"
              onClick={onFechar}
              disabled={enviando}
              className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium shadow-md shadow-blue-500/25"
            >
              {enviando ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Criando…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar solicitação
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default NovoPedidoModal;
