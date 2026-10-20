import React from 'react';
import { createPortal } from 'react-dom';
import { Check, DollarSign, X } from 'lucide-react';
import type { PaymentRequest } from '../../../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { totalDe } from '../domain/filtrosPagamentos';

// Barra flutuante das ações em lote, para quem aprova pagamentos: no dia do pagamento,
// marcar o bloco inteiro e pagar de uma vez. Cada botão age só nos pedidos em que a ação
// cabe (aprovar os pendentes, pagar os aprovados) e diz quantos são.

interface Props {
  selecionados: PaymentRequest[];
  onAprovar: (pedidos: PaymentRequest[]) => void;
  onPagar: (pedidos: PaymentRequest[]) => void;
  onLimpar: () => void;
}

const BarraAcoesEmLote: React.FC<Props> = ({ selecionados, onAprovar, onPagar, onLimpar }) => {
  if (selecionados.length === 0) return null;
  const pendentes = selecionados.filter((p) => p.status === 'pending');
  const aprovados = selecionados.filter((p) => p.status === 'approved');

  return createPortal(
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 animate-fade-in-up">
      <div
        role="region"
        aria-label="Ações em lote"
        className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 rounded-2xl bg-gray-900 dark:bg-gray-700 text-white shadow-2xl shadow-black/30 border border-white/10"
      >
        <span className="text-sm mr-1">
          <strong className="tabular-nums">{selecionados.length}</strong>{' '}
          {selecionados.length === 1 ? 'selecionado' : 'selecionados'} ·{' '}
          <strong className="tabular-nums">{formatCurrency(totalDe(selecionados))}</strong>
        </span>
        {pendentes.length > 0 && (
          <button
            type="button"
            onClick={() => onAprovar(pendentes)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-600 transition-colors"
          >
            <Check className="w-4 h-4" /> Aprovar {pendentes.length}
          </button>
        )}
        {aprovados.length > 0 && (
          <button
            type="button"
            onClick={() => onPagar(aprovados)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            <DollarSign className="w-4 h-4" /> Marcar {aprovados.length} como {aprovados.length === 1 ? 'pago' : 'pagos'}
          </button>
        )}
        <button
          type="button"
          onClick={onLimpar}
          aria-label="Limpar seleção"
          title="Limpar seleção"
          className="ml-auto sm:ml-0 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default BarraAcoesEmLote;
