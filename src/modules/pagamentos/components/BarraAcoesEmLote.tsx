import React from 'react';
import { createPortal } from 'react-dom';
import { Check, DollarSign, X } from 'lucide-react';
import type { PaymentRequest } from '../../../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { totalDe } from '../domain/filtrosPagamentos';

// Barra flutuante das ações em lote, para quem aprova pagamentos: no dia do pagamento,
// marcar o bloco inteiro e pagar de uma vez. Cada botão age só nos pedidos em que a ação
// cabe (aprovar os pendentes, pagar os aprovados) e diz quantos são.
// No celular ocupa a largura toda, com o resumo em cima e os botões largos embaixo, acima
// da barra do iPhone; do sm em diante é uma pílula centralizada numa linha só.

interface Props {
  selecionados: PaymentRequest[];
  onAprovar: (pedidos: PaymentRequest[]) => void;
  onPagar: (pedidos: PaymentRequest[]) => void;
  onLimpar: () => void;
}

const BOTAO =
  'inline-flex flex-1 sm:flex-none flex-shrink-0 items-center justify-center gap-1.5 px-3 h-11 sm:h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]';

const BarraAcoesEmLote: React.FC<Props> = ({ selecionados, onAprovar, onPagar, onLimpar }) => {
  if (selecionados.length === 0) return null;
  const pendentes = selecionados.filter((p) => p.status === 'pending');
  const aprovados = selecionados.filter((p) => p.status === 'approved');

  return createPortal(
    // Centralizada com flex, não com translate: a animação termina em transform: none e
    // anulava o -translate-x-1/2 (a barra ficava com a borda esquerda no meio da tela).
    <div className="fixed inset-x-3 sm:inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 z-40 flex justify-center pointer-events-none">
      <div
        role="region"
        aria-label="Ações em lote"
        className="pointer-events-auto w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:px-4 rounded-2xl bg-gray-900/95 dark:bg-gray-700/95 backdrop-blur text-white shadow-2xl shadow-black/30 border border-white/10 animate-fade-in-up"
      >
        <div className="flex items-center justify-between gap-3 sm:contents">
          <span className="text-sm sm:mr-1 pl-1 sm:pl-0" aria-live="polite">
            <strong className="tabular-nums">{selecionados.length}</strong>{' '}
            {selecionados.length === 1 ? 'selecionado' : 'selecionados'} ·{' '}
            <strong className="tabular-nums">{formatCurrency(totalDe(selecionados))}</strong>
          </span>
          <button
            type="button"
            onClick={onLimpar}
            aria-label="Limpar seleção"
            title="Limpar seleção"
            className="sm:order-last flex flex-shrink-0 items-center justify-center w-9 h-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {(pendentes.length > 0 || aprovados.length > 0) && (
          <div className="flex gap-2">
            {pendentes.length > 0 && (
              <button type="button" onClick={() => onAprovar(pendentes)} className={`${BOTAO} bg-green-500 hover:bg-green-600`}>
                <Check className="w-4 h-4" /> Aprovar {pendentes.length}
              </button>
            )}
            {aprovados.length > 0 && (
              <button type="button" onClick={() => onPagar(aprovados)} className={`${BOTAO} bg-blue-500 hover:bg-blue-600`}>
                <DollarSign className="w-4 h-4" />
                <span className="sm:hidden">Pagar {aprovados.length}</span>
                <span className="hidden sm:inline">
                  Marcar {aprovados.length} como {aprovados.length === 1 ? 'pago' : 'pagos'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default BarraAcoesEmLote;
