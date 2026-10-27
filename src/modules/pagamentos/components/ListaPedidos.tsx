import React, { useEffect, useState } from 'react';
import type { PaymentRequest } from '../../../types';
import { formatCurrency } from '../../../utils/paymentUtils';
import { agruparPorDataPagamento, rotuloDiaCurto, rotuloDiaLongo } from '../domain/filtrosPagamentos';
import CaixaSelecao from './CaixaSelecao';
import PedidoCard, { type AcoesPedido } from './PedidoCard';

// Lista de pedidos. Ordenada por data de pagamento, vira blocos por dia com o subtotal:
// quem paga vê de cara o que sai na terça e o que sai na quinta. Para quem aprova, cada
// bloco tem uma caixa que marca o dia inteiro (ações em lote).
//
// O título do dia fica preso no topo enquanto o bloco rola. No celular, abaixo do cabeçalho
// fixo do Layout (h-[72px], lg:hidden); no desktop não há cabeçalho, então fica no topo.
const TITULO_DO_DIA =
  'sticky top-[80px] lg:top-3 z-20 flex items-center justify-between gap-3 px-3 sm:pl-5 sm:pr-4 py-2 rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200/70 dark:border-gray-700/70 shadow-sm';

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
          <div className="flex items-center gap-3 px-4 pt-1 sm:px-5">
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
        const tituloCurto = grupo.data ? rotuloDiaCurto(grupo.data) : 'Sem data';
        const caixa = selecao ? selecionaveis(grupo.pedidos) : [];
        return (
          <section key={grupo.data || 'sem-data'} className="space-y-3 pt-1" aria-label={titulo}>
            <div className={TITULO_DO_DIA}>
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {caixa.length > 0 && selecao && (
                  <span className="mr-1 flex">
                    <CaixaDoGrupo
                      pedidos={caixa}
                      selecionados={selecao.selecionados}
                      onMarcar={selecao.onMarcar}
                      rotulo={`Selecionar os pedidos de ${titulo}`}
                    />
                  </span>
                )}
                <span className="truncate">
                  <span className="sm:hidden capitalize">{tituloCurto}</span>
                  <span className="hidden sm:inline">{titulo}</span>
                </span>
                {grupo.data === hoje && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    Hoje
                  </span>
                )}
                {grupo.data && grupo.data < hoje && (
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    Data passada
                  </span>
                )}
              </h3>
              <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                <span className="hidden sm:inline">
                  {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'} ·{' '}
                </span>
                <strong className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(grupo.total)}</strong>
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
