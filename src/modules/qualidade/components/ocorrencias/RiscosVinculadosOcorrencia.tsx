// Seção "Riscos vinculados" do detalhe de 1 ocorrência — riscos vinculados
// (N:N, livre) mesclados com o(s) risco(s) nascido(s) desta ocorrência como
// origem (1:N, imutável), sem duplicar.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
  buscarRiscosCorrelacionados,
  buscarRiscosParaVincular,
  desvincularRiscoOcorrencia,
  vincularRiscoOcorrencia,
} from '../../correlacaoRiscosOcorrencias.js';
import { buscarFaixasClassificacao } from '../../riscos.js';
import { classificarScore } from '../../domain/riscosClassificacao.js';
import { BADGE_NIVEL, ROTULO_NIVEL } from '../riscos/rotulos.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';

interface RiscosVinculadosOcorrenciaProps {
  ocorrenciaId: string;
  canManage: boolean;
}

function FormularioVincular({ ocorrenciaId, onVinculado }: { ocorrenciaId: string; onVinculado: () => void }) {
  const [busca, setBusca] = useState('');
  const { data: candidatos, isLoading } = useQuery({
    queryKey: ['riscos-para-vincular', busca],
    queryFn: () => buscarRiscosParaVincular(busca),
  });

  const mutacao = useMutation({
    mutationFn: (riscoId: string) => vincularRiscoOcorrencia(riscoId, ocorrenciaId),
    onSuccess: onVinculado,
  });

  return (
    <div className="mt-3 rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
      <input
        autoFocus
        className="glass-field w-full rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
        placeholder="Buscar por risco ou processo…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {isLoading && <Skeleton className="h-8 w-full" />}
        {!isLoading && (candidatos ?? []).length === 0 && <p className="px-1 py-1 text-xs text-gray-500 dark:text-slate-400">Nenhum risco encontrado.</p>}
        {(candidatos ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={mutacao.isPending}
            onClick={() => mutacao.mutate(c.id)}
            className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="min-w-0">
              <span className="block truncate text-slate-700 dark:text-slate-300">{c.riscoIdentificado}</span>
              <span className="text-gray-400 dark:text-slate-500">{c.processo}</span>
            </span>
            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          </button>
        ))}
      </div>
      {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível vincular. Tente novamente.</p>}
    </div>
  );
}

export function RiscosVinculadosOcorrencia({ ocorrenciaId, canManage }: RiscosVinculadosOcorrenciaProps) {
  const queryClient = useQueryClient();
  const [formularioAberto, setFormularioAberto] = useState(false);

  const chave = ['ocorrencia-riscos-correlacionados', ocorrenciaId];
  const { data: riscos, isLoading, isError, refetch } = useQuery({
    queryKey: chave,
    queryFn: () => buscarRiscosCorrelacionados(ocorrenciaId),
  });
  const { data: faixas } = useQuery({ queryKey: ['riscos-faixas'], queryFn: buscarFaixasClassificacao });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: chave });

  const mutacaoDesvincular = useMutation({
    mutationFn: (vinculoId: string) => desvincularRiscoOcorrencia(vinculoId),
    onSuccess: invalidar,
  });

  return (
    <section aria-label="Riscos vinculados">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Riscos vinculados</h3>
        {canManage && !formularioAberto && (
          <button
            type="button"
            onClick={() => setFormularioAberto(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Vincular risco
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="mt-3 h-12 w-full" />}
      {isError && <ErrorState titulo="Não foi possível carregar os riscos vinculados" aoTentarNovamente={() => refetch()} />}
      {!isLoading && !isError && (riscos ?? []).length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Nenhum risco vinculado ainda.</p>
      )}

      <ul className="mt-2 space-y-1.5">
        {(riscos ?? []).map((r) => {
          const nivel = r.score != null && faixas ? classificarScore(r.score, faixas) : null;
          return (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 p-2.5 text-sm dark:border-white/10"
            >
              <div className="min-w-0">
                <p className="truncate text-slate-700 dark:text-slate-300">{r.riscoIdentificado}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{r.processo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {nivel && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_NIVEL[nivel]}`}>{ROTULO_NIVEL[nivel]}</span>}
                {r.ehOrigem && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Origem
                  </span>
                )}
                {canManage && r.vinculoId && (
                  <button
                    type="button"
                    aria-label="Remover vínculo"
                    disabled={mutacaoDesvincular.isPending}
                    onClick={() => mutacaoDesvincular.mutate(r.vinculoId!)}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {mutacaoDesvincular.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível remover o vínculo. Tente novamente.</p>
      )}

      {formularioAberto && (
        <>
          <FormularioVincular
            ocorrenciaId={ocorrenciaId}
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
