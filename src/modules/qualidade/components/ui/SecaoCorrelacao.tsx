// Esqueleto compartilhado das 2 seções de correlação N:N Riscos↔Ocorrências
// (OcorrenciasCorrelacionadasRisco.tsx e RiscosVinculadosOcorrencia.tsx) —
// mesma forma nos dois sentidos: lista de vínculos (com badge "Origem" e
// botão de desvincular) + busca de candidato + vincular. Cada direção só
// varia no que renderiza (`renderItem`/`renderCandidato`) e em qual função
// de dados chama — ver .scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ErrorState } from './ErrorState.js';
import { Skeleton } from './Skeleton.js';

interface ItemVinculado {
  id: string;
  vinculoId: string | null;
  ehOrigem: boolean;
}

interface SecaoCorrelacaoProps<TItem extends ItemVinculado, TCandidato extends { id: string }> {
  ariaLabel: string;
  tituloSecao: string;
  rotuloBotaoVincular: string;
  placeholderBusca: string;
  mensagemVazio: string;
  canManage: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<TItem[]>;
  renderItem: (item: TItem) => ReactNode;
  /** Badge opcional extra por item (ex.: nível do risco), antes do badge "Origem". */
  renderBadgeExtra?: (item: TItem) => ReactNode;
  candidatosQueryKeyPrefix: string;
  buscarCandidatos: (busca: string) => Promise<TCandidato[]>;
  renderCandidato: (candidato: TCandidato) => ReactNode;
  vincular: (candidatoId: string) => Promise<void>;
  desvincular: (vinculoId: string) => Promise<void>;
}

function FormularioVincular<TCandidato extends { id: string }>({
  placeholder,
  queryKeyPrefix,
  buscarCandidatos,
  renderCandidato,
  vincular,
  onVinculado,
}: {
  placeholder: string;
  queryKeyPrefix: string;
  buscarCandidatos: (busca: string) => Promise<TCandidato[]>;
  renderCandidato: (candidato: TCandidato) => ReactNode;
  vincular: (candidatoId: string) => Promise<void>;
  onVinculado: () => void;
}) {
  const [busca, setBusca] = useState('');
  const { data: candidatos, isLoading } = useQuery({ queryKey: [queryKeyPrefix, busca], queryFn: () => buscarCandidatos(busca) });

  const mutacao = useMutation({ mutationFn: vincular, onSuccess: onVinculado });

  return (
    <div className="mt-3 rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
      <input
        autoFocus
        className="glass-field w-full rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
        placeholder={placeholder}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {isLoading && <Skeleton className="h-8 w-full" />}
        {!isLoading && (candidatos ?? []).length === 0 && <p className="px-1 py-1 text-xs text-gray-500 dark:text-slate-400">Nenhum resultado encontrado.</p>}
        {(candidatos ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={mutacao.isPending}
            onClick={() => mutacao.mutate(c.id)}
            className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="min-w-0">{renderCandidato(c)}</span>
            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          </button>
        ))}
      </div>
      {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível vincular. Tente novamente.</p>}
    </div>
  );
}

export function SecaoCorrelacao<TItem extends ItemVinculado, TCandidato extends { id: string }>({
  ariaLabel,
  tituloSecao,
  rotuloBotaoVincular,
  placeholderBusca,
  mensagemVazio,
  canManage,
  queryKey,
  queryFn,
  renderItem,
  renderBadgeExtra,
  candidatosQueryKeyPrefix,
  buscarCandidatos,
  renderCandidato,
  vincular,
  desvincular,
}: SecaoCorrelacaoProps<TItem, TCandidato>) {
  const queryClient = useQueryClient();
  const [formularioAberto, setFormularioAberto] = useState(false);

  const { data: itens, isLoading, isError, refetch } = useQuery({ queryKey, queryFn });
  const invalidar = () => queryClient.invalidateQueries({ queryKey });

  const mutacaoDesvincular = useMutation({ mutationFn: desvincular, onSuccess: invalidar });

  return (
    <section aria-label={ariaLabel}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{tituloSecao}</h3>
        {canManage && !formularioAberto && (
          <button
            type="button"
            onClick={() => setFormularioAberto(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {rotuloBotaoVincular}
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="mt-3 h-12 w-full" />}
      {isError && <ErrorState titulo={`Não foi possível carregar: ${tituloSecao.toLowerCase()}`} aoTentarNovamente={() => refetch()} />}
      {!isLoading && !isError && (itens ?? []).length === 0 && <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{mensagemVazio}</p>}

      <ul className="mt-2 space-y-1.5">
        {(itens ?? []).map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 p-2.5 text-sm dark:border-white/10">
            <div className="min-w-0">{renderItem(item)}</div>
            <div className="flex shrink-0 items-center gap-2">
              {renderBadgeExtra?.(item)}
              {item.ehOrigem && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Origem
                </span>
              )}
              {canManage && item.vinculoId && (
                <button
                  type="button"
                  aria-label="Remover vínculo"
                  disabled={mutacaoDesvincular.isPending}
                  onClick={() => mutacaoDesvincular.mutate(item.vinculoId!)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {mutacaoDesvincular.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível remover o vínculo. Tente novamente.</p>
      )}

      {formularioAberto && (
        <>
          <FormularioVincular
            placeholder={placeholderBusca}
            queryKeyPrefix={candidatosQueryKeyPrefix}
            buscarCandidatos={buscarCandidatos}
            renderCandidato={renderCandidato}
            vincular={vincular}
            onVinculado={() => {
              invalidar();
              setFormularioAberto(false);
            }}
          />
          <button
            type="button"
            onClick={() => setFormularioAberto(false)}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancelar
          </button>
        </>
      )}
    </section>
  );
}
