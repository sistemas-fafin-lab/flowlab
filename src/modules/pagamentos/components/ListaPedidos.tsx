import React, { useState } from 'react';
import type { PaymentRequest } from '../../../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { agruparPorDataPagamento, rotuloDiaLongo } from '../domain/filtrosPagamentos';
import PedidoCard, { type AcoesPedido } from './PedidoCard';

// Lista de pedidos. Ordenada por data de pagamento, vira blocos por dia com o subtotal:
// quem paga vê de cara o que sai na terça e o que sai na quinta.

interface Props extends AcoesPedido {
  /** Já filtrados e ordenados. */
  pedidos: PaymentRequest[];
  agrupar: boolean;
  hoje: string;
  podeAgir: boolean;
}

const CabecalhoDia: React.FC<{ data: string; quantidade: number; total: number; hoje: string }> = ({ data, quantidade, total, hoje }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 pt-2">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
      {data ? rotuloDiaLongo(data) : 'Sem data de pagamento'}
      {data === hoje && (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Hoje</span>
      )}
      {data && data < hoje && (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Data passada</span>
      )}
    </h3>
    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
      {quantidade} {quantidade === 1 ? 'pedido' : 'pedidos'} · {formatCurrency(total)}
    </span>
  </div>
);

const ListaPedidos: React.FC<Props> = ({ pedidos, agrupar, hoje, podeAgir, ...acoes }) => {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setExpandidos((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });

  const card = (p: PaymentRequest) => (
    <PedidoCard
      key={p.id}
      pedido={p}
      hoje={hoje}
      podeAgir={podeAgir}
      expandido={expandidos.has(p.id)}
      onAlternar={() => alternar(p.id)}
      {...acoes}
    />
  );

  if (!agrupar) return <div className="space-y-3">{pedidos.map(card)}</div>;

  return (
    <div className="space-y-3">
      {agruparPorDataPagamento(pedidos).map((grupo) => (
        <section key={grupo.data || 'sem-data'} className="space-y-3" aria-label={grupo.data ? rotuloDiaLongo(grupo.data) : 'Sem data de pagamento'}>
          <CabecalhoDia data={grupo.data} quantidade={grupo.pedidos.length} total={grupo.total} hoje={hoje} />
          {grupo.pedidos.map(card)}
        </section>
      ))}
    </div>
  );
};

export default ListaPedidos;
