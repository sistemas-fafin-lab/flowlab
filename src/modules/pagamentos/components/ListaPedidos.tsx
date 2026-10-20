import React, { useEffect, useState } from 'react';
import type { PaymentRequest } from '../../../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { agruparPorDataPagamento, rotuloDiaLongo } from '../domain/filtrosPagamentos';
import CaixaSelecao from './CaixaSelecao';
import PedidoCard, { type AcoesPedido } from './PedidoCard';

// Lista de pedidos. Ordenada por data de pagamento, vira blocos por dia com o subtotal:
// quem paga vê de cara o que sai na terça e o que sai na quinta. Para quem aprova, cada
// bloco tem uma caixa que marca o dia inteiro (ações em lote).

interface Props extends AcoesPedido {
  /** Já filtrados e ordenados. */
  pedidos: PaymentRequest[];
  agrupar: boolean;
  hoje: string;
  podeAgir: boolean;
  userId?: string;
  /** Pedido aberto por um link (?pedido=id, dos e-mails e do sininho): abre e rola até ele. */
  destaque?: string | null;
  /** Ações em lote; sem `onMarcar`, a lista não mostra caixas de seleção. */
  selecionados?: Set<string>;
  podeSelecionar?: (p: PaymentRequest) => boolean;
  onMarcar?: (ids: string[], marcado: boolean) => void;
}

/** Caixa que marca vários de uma vez: cheia, vazia ou "parte marcada". */
const CaixaDoGrupo: React.FC<{
  pedidos: PaymentRequest[];
  selecionados: Set<string>;
  onMarcar: (ids: string[], marcado: boolean) => void;
  rotulo: string;
}> = ({ pedidos, selecionados, onMarcar, rotulo }) => {
  if (pedidos.length === 0) return null;
  const marcados = pedidos.filter((p) => selecionados.has(p.id)).length;
  const estado = marcados === 0 ? false : marcados === pedidos.length ? true : 'misto';
  return (
    <CaixaSelecao
      marcado={estado}
      rotulo={rotulo}
      onAlternar={() => onMarcar(pedidos.map((p) => p.id), estado !== true)}
    />
  );
};

const ListaPedidos: React.FC<Props> = ({
  pedidos,
  agrupar,
  hoje,
  podeAgir,
  userId,
  destaque,
  selecionados,
  podeSelecionar,
  onMarcar,
  ...acoes
}) => {
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(destaque ? [destaque] : []));
  useEffect(() => {
    if (!destaque) return;
    setExpandidos((atuais) => new Set(atuais).add(destaque));
    document.getElementById(`pedido-${destaque}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [destaque]);
  const alternar = (id: string) =>
    setExpandidos((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });

  const selecao = onMarcar && selecionados && podeSelecionar ? { onMarcar, selecionados, podeSelecionar } : null;
  const selecionaveis = (lista: PaymentRequest[]) => (selecao ? lista.filter(selecao.podeSelecionar) : []);

  const card = (p: PaymentRequest) => {
    const selecionavel = !!selecao && selecao.podeSelecionar(p);
    return (
      <PedidoCard
        key={p.id}
        pedido={p}
        hoje={hoje}
        podeAgir={podeAgir}
        userId={userId}
        destacado={p.id === destaque}
        expandido={expandidos.has(p.id)}
        onAlternar={() => alternar(p.id)}
        selecionavel={selecionavel}
        selecionado={selecionavel && !!selecao?.selecionados.has(p.id)}
        onSelecionar={selecao ? () => selecao.onMarcar([p.id], !selecao.selecionados.has(p.id)) : undefined}
        {...acoes}
      />
    );
  };

  if (!agrupar) {
    const todos = selecionaveis(pedidos);
    return (
      <div className="space-y-3">
        {selecao && todos.length > 0 && (
          <div className="flex items-center gap-3 px-1 pt-1 sm:px-5">
            <CaixaDoGrupo pedidos={todos} selecionados={selecao.selecionados} onMarcar={selecao.onMarcar} rotulo="Selecionar todos" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Selecionar todos os {todos.length} que você pode aprovar ou pagar
            </span>
          </div>
        )}
        {pedidos.map(card)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agruparPorDataPagamento(pedidos).map((grupo) => {
        const titulo = grupo.data ? rotuloDiaLongo(grupo.data) : 'Sem data de pagamento';
        return (
          <section key={grupo.data || 'sem-data'} className="space-y-3" aria-label={titulo}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 pt-2 sm:pl-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {selecao && (
                  <CaixaDoGrupo
                    pedidos={selecionaveis(grupo.pedidos)}
                    selecionados={selecao.selecionados}
                    onMarcar={selecao.onMarcar}
                    rotulo={`Selecionar os pedidos de ${titulo}`}
                  />
                )}
                {titulo}
                {grupo.data === hoje && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    Hoje
                  </span>
                )}
                {grupo.data && grupo.data < hoje && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    Data passada
                  </span>
                )}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'} · {formatCurrency(grupo.total)}
              </span>
            </div>
            {grupo.pedidos.map(card)}
          </section>
        );
      })}
    </div>
  );
};

export default ListaPedidos;
