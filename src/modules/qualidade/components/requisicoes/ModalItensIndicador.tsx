// Modal genérico de drill-down para os KPIs clicáveis da aba Indicadores —
// abre ao clicar num `Kpi`, lista item a item as requisições que compõem o
// número. "Laudos retificados" fica de fora de propósito (já tem tabela
// própria + drawer, ver requisicoes.ts).

import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import type { ChaveIndicador } from '../../requisicoes';
import { buscarItensIndicador } from '../../requisicoes.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';

interface ModalItensIndicadorProps {
  titulo: string;
  chave: ChaveIndicador;
  periodo: { inicio: string; fim: string };
  onFechar: () => void;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Split manual (sem `new Date`) — não sofre deslocamento de fuso horário; funciona tanto para `date` quanto `timestamptz`. */
function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export function ModalItensIndicador({ titulo, chave, periodo, onFechar }: ModalItensIndicadorProps) {
  const [busca, setBusca] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['indicador-itens', chave, periodo],
    queryFn: () => buscarItensIndicador(chave, periodo),
  });

  const buscaNormalizada = normalizar(busca.trim());
  const itensFiltrados = useMemo(() => {
    const itens = data ?? [];
    if (!buscaNormalizada) return itens;
    return itens.filter(
      (item) =>
        normalizar(item.codRequisicao).includes(buscaNormalizada) ||
        (item.nomPaciente && normalizar(item.nomPaciente).includes(buscaNormalizada)),
    );
  }, [data, buscaNormalizada]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-20" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onFechar} />
      <div className="glass-surface relative flex max-h-[75vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200/50 bg-white/95 shadow-2xl dark:border-white/10 dark:bg-gray-800/95">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {formatarDataCurta(periodo.inicio)} – {formatarDataCurta(periodo.fim)}
              {data ? ` · ${data.length} requisição(ões)` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {!isLoading && !isError && (
          <div className="border-b border-gray-100 px-4 py-2.5 dark:border-white/10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por requisição ou paciente…"
                className="glass-field w-full rounded-xl py-2 pl-8 pr-3 text-sm text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-12 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <div className="p-4">
              <ErrorState titulo="Não foi possível carregar os itens deste indicador" aoTentarNovamente={() => refetch()} />
            </div>
          )}

          {!isLoading && !isError && itensFiltrados.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
              {busca ? 'Nenhum item encontrado para essa busca.' : 'Nenhuma requisição neste período.'}
            </p>
          )}

          {!isLoading && !isError && itensFiltrados.length > 0 && (
            <ul className="space-y-1 p-1">
              {itensFiltrados.map((item) => (
                <li key={item.id} className="rounded-xl px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{item.codRequisicao}</p>
                    {item.diasAtraso !== null && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {item.diasAtraso} dia(s) de atraso
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{item.nomPaciente ?? '—'}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {item.exameTipoNomeLis ? `${item.exameTipoNomeLis} · ` : ''}
                    {item.rotuloData}: {item.data ? formatarDataCurta(item.data) : '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
