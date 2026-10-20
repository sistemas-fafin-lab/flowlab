import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  DollarSign,
  Eye,
  FileText,
  Paperclip,
  Printer,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { PaymentRequest } from '../../../types';
import {
  formatCurrency,
  formatDateDisplay,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '../../../utils/paymentUtils';
import { estaAtrasado, formatarDataISO, rotuloDiaCurto } from '../domain/filtrosPagamentos';
import { CARTAO } from './estilos';

// Um pedido numa linha: o que se precisa para decidir (código, status, fornecedor, data,
// setor, quem pediu, valor) e as ações rápidas. Descrição, dados de pagamento e anexos
// abrem ao clicar.

export interface AcoesPedido {
  onAprovar: (p: PaymentRequest) => void;
  onRejeitar: (p: PaymentRequest) => void;
  onPagar: (p: PaymentRequest) => void;
  onExcluir: (p: PaymentRequest) => void;
  onImprimir: (p: PaymentRequest) => void;
  onAbrirImagem: (url: string, nome: string) => void;
}

interface Props extends AcoesPedido {
  pedido: PaymentRequest;
  hoje: string;
  /** canApprovePayments: aprovar, rejeitar, pagar e excluir. */
  podeAgir: boolean;
  expandido: boolean;
  onAlternar: () => void;
}

const BotaoCopiar: React.FC<{ texto: string }> = ({ texto }) => {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const espera = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(espera);
  }, [copiado]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => setCopiado(true));
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
        copiado
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-300'
      }`}
    >
      {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
};

const Detalhe: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{rotulo}</dt>
    <dd className="text-sm text-gray-800 dark:text-gray-100 break-words">{children}</dd>
  </div>
);

const BOTAO = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200';

const PedidoCard: React.FC<Props> = ({
  pedido: p,
  hoje,
  podeAgir,
  expandido,
  onAlternar,
  onAprovar,
  onRejeitar,
  onPagar,
  onExcluir,
  onImprimir,
  onAbrirImagem,
}) => {
  const atrasado = estaAtrasado(p, hoje);
  const anexos = p.attachments ?? [];
  const idDetalhes = `pedido-${p.id}-detalhes`;

  return (
    <article
      className={`${CARTAO} overflow-hidden transition-shadow duration-200 hover:shadow-md ${
        atrasado ? 'border-l-4 border-l-red-400 dark:border-l-red-500' : ''
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 sm:px-5">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={expandido}
          aria-controls={idDetalhes}
          className="flex-1 min-w-0 flex items-start gap-3 text-left group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-green-500/25 flex-shrink-0">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={p.codigo}>
                {p.codigoCompacto ? `Pedido ${p.codigoCompacto}` : p.codigo}
              </h3>
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${PAYMENT_STATUS_COLORS[p.status]}`}>
                {PAYMENT_STATUS_LABELS[p.status]}
              </span>
              {atrasado && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="w-3 h-3" /> Atrasado
                </span>
              )}
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {PAYMENT_TYPE_LABELS[p.tipoSolicitacao]} · {PAYMENT_METHOD_LABELS[p.formaPagamento]}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{p.fornecedor}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span className={`inline-flex items-center gap-1 ${atrasado ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                <Calendar className="w-3.5 h-3.5" />
                Pagamento {p.dataPagamento ? rotuloDiaCurto(p.dataPagamento) : '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {p.department || 'Sem setor'}
              </span>
              <span className="inline-flex items-center gap-1 min-w-0">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{p.solicitadoPor}</span>
              </span>
              {anexos.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  {anexos.length}
                </span>
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center justify-between lg:justify-end gap-3 pl-[52px] lg:pl-0">
          <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums whitespace-nowrap">
            {formatCurrency(p.valorTotal)}
          </p>
          <div className="flex items-center gap-2">
            {podeAgir && p.status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => onAprovar(p)}
                  className={`${BOTAO} bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-md shadow-green-500/25`}
                >
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">Aprovar</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRejeitar(p)}
                  aria-label="Rejeitar"
                  title="Rejeitar"
                  className={`${BOTAO} bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50`}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
            {podeAgir && p.status === 'approved' && (
              <button
                type="button"
                onClick={() => onPagar(p)}
                className={`${BOTAO} bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md shadow-blue-500/25`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Marcar como pago</span>
              </button>
            )}
            <button
              type="button"
              onClick={onAlternar}
              aria-expanded={expandido}
              aria-controls={idDetalhes}
              aria-label={expandido ? 'Esconder detalhes' : 'Ver detalhes'}
              title={expandido ? 'Esconder detalhes' : 'Ver detalhes'}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {expandido && (
        <div id={idDetalhes} className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-4 sm:px-5 py-4 space-y-4 animate-fade-in">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <Detalhe rotulo="Código">{p.codigo}</Detalhe>
            <Detalhe rotulo="Criado em">{formatDateDisplay(p.createdAt)}</Detalhe>
            <Detalhe rotulo="Data de pagamento">{formatarDataISO(p.dataPagamento)}</Detalhe>
            <Detalhe rotulo="Autorizado por">{p.autorizadoPor || '—'}</Detalhe>
            <Detalhe rotulo="Nº do documento">{p.documentoNumero || '—'}</Detalhe>
            <Detalhe rotulo="CPF/CNPJ">{p.cpfCnpj || '—'}</Detalhe>
            {p.approvedBy && (
              <Detalhe rotulo={p.status === 'paid' ? 'Pago por' : 'Aprovado por'}>
                {p.approvedBy}
                {p.approvalDate ? ` em ${formatDateDisplay(p.approvalDate)}` : ''}
              </Detalhe>
            )}
          </dl>

          {p.rejectionReason && (p.status === 'rejected' || p.status === 'cancelled') && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-500 dark:text-red-400">Motivo da rejeição</p>
              <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-line">{p.rejectionReason}</p>
            </div>
          )}

          {p.descricaoDetalhada && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Descrição</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line break-words">{p.descricaoDetalhada}</p>
            </div>
          )}

          {p.dadosPagamento && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-blue-500 dark:text-blue-300">Dados para pagamento</p>
                <BotaoCopiar texto={p.dadosPagamento} />
              </div>
              <p className="text-sm font-mono text-gray-800 dark:text-gray-100 whitespace-pre-line break-all">{p.dadosPagamento}</p>
            </div>
          )}

          {anexos.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Anexos ({anexos.length})</p>
              <div className="flex flex-wrap gap-2">
                {anexos.map((anexo, i) => {
                  const imagem = /\.(png|jpe?g)$/i.test(anexo.name);
                  const conteudo = (
                    <>
                      {imagem ? (
                        <img src={anexo.url} alt="" className="w-9 h-9 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{anexo.name}</span>
                      {imagem ? <Eye className="w-3.5 h-3.5 flex-shrink-0 opacity-60" /> : null}
                    </>
                  );
                  const classe =
                    'inline-flex items-center gap-2 max-w-[260px] px-2.5 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-purple-300 dark:hover:border-purple-500 transition-colors';
                  return imagem ? (
                    <button key={i} type="button" onClick={() => onAbrirImagem(anexo.url, anexo.name)} className={classe}>
                      {conteudo}
                    </button>
                  ) : (
                    <a key={i} href={anexo.url} target="_blank" rel="noopener noreferrer" className={classe}>
                      {conteudo}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {podeAgir && (p.status === 'pending' || p.status === 'rejected') && (
              <button
                type="button"
                onClick={() => onExcluir(p)}
                className={`${BOTAO} bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30`}
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            )}
            {p.pdfUrl && (
              <a
                href={p.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BOTAO} bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600`}
              >
                <FileText className="w-4 h-4" /> Ver PDF
              </a>
            )}
            <button
              type="button"
              onClick={() => onImprimir(p)}
              className={`${BOTAO} ml-auto bg-gradient-to-r from-blue-900 to-indigo-800 text-white hover:from-blue-800 hover:to-indigo-700 shadow-md shadow-blue-900/25`}
            >
              <Printer className="w-4 h-4" /> Imprimir comprovante
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default PedidoCard;
