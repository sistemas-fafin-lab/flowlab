// Seção "Correlação" do detalhe de 1 risco — ocorrências vinculadas (N:N,
// livre) mescladas com a ocorrência de origem (1:N, imutável), sem duplicar.
// (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
  buscarOcorrenciasCorrelacionadas,
  buscarOcorrenciasParaVincular,
  desvincularRiscoOcorrencia,
  vincularRiscoOcorrencia,
} from '../../correlacaoRiscosOcorrencias.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';

interface OcorrenciasCorrelacionadasRiscoProps {
  riscoId: string;
  ocorrenciaOrigemId: string | null;
  canManage: boolean;
}

// Split manual (sem `new Date`) para não sofrer deslocamento de fuso horário ao formatar uma data `YYYY-MM-DD` vinda do banco.
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

function FormularioVincular({ riscoId, onVinculado }: { riscoId: string; onVinculado: () => void }) {
  const [busca, setBusca] = useState('');
  const { data: candidatos, isLoading } = useQuery({
    queryKey: ['ocorrencias-para-vincular', busca],
    queryFn: () => buscarOcorrenciasParaVincular(busca),
  });

  const mutacao = useMutation({
    mutationFn: (ocorrenciaId: string) => vincularRiscoOcorrencia(riscoId, ocorrenciaId),
    onSuccess: onVinculado,
  });

  return (
    <div className="mt-3 rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
      <input
        autoFocus
        className="glass-field w-full rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
        placeholder="Buscar por descrição ou requisição…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {isLoading && <Skeleton className="h-8 w-full" />}
        {!isLoading && (candidatos ?? []).length === 0 && <p className="px-1 py-1 text-xs text-gray-500 dark:text-slate-400">Nenhuma ocorrência encontrada.</p>}
        {(candidatos ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={mutacao.isPending}
            onClick={() => mutacao.mutate(c.id)}
            className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10"
          >
            <span className="min-w-0">
              <span className="block truncate text-slate-700 dark:text-slate-300">{c.resumo || '—'}</span>
              <span className="text-gray-400 dark:text-slate-500">
                {formatarData(c.dtaOcorrencia)}
                {c.codRequisicao ? ` · Req. ${c.codRequisicao}` : ''}
              </span>
            </span>
            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          </button>
        ))}
      </div>
      {mutacao.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">Não foi possível vincular. Tente novamente.</p>}
    </div>
  );
}

export function OcorrenciasCorrelacionadasRisco({ riscoId, ocorrenciaOrigemId, canManage }: OcorrenciasCorrelacionadasRiscoProps) {
  const queryClient = useQueryClient();
  const [formularioAberto, setFormularioAberto] = useState(false);

  const chave = ['risco-ocorrencias-correlacionadas', riscoId];
  const { data: ocorrencias, isLoading, isError, refetch } = useQuery({
    queryKey: chave,
    queryFn: () => buscarOcorrenciasCorrelacionadas({ id: riscoId, ocorrenciaOrigemId }),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: chave });

  const mutacaoDesvincular = useMutation({
    mutationFn: (vinculoId: string) => desvincularRiscoOcorrencia(vinculoId),
    onSuccess: invalidar,
  });

  return (
    <section aria-label="Correlação com ocorrências">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Ocorrências relacionadas</h3>
        {canManage && !formularioAberto && (
          <button
            type="button"
            onClick={() => setFormularioAberto(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            Vincular ocorrência
          </button>
        )}
      </div>

      {isLoading && <Skeleton className="mt-3 h-12 w-full" />}
      {isError && <ErrorState titulo="Não foi possível carregar as ocorrências relacionadas" aoTentarNovamente={() => refetch()} />}
      {!isLoading && !isError && (ocorrencias ?? []).length === 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Nenhuma ocorrência relacionada ainda.</p>
      )}

      <ul className="mt-2 space-y-1.5">
        {(ocorrencias ?? []).map((o) => (
          <li
            key={o.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 p-2.5 text-sm dark:border-white/10"
          >
            <div className="min-w-0">
              <p className="truncate text-slate-700 dark:text-slate-300">{o.resumo || '—'}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">{formatarData(o.dtaOcorrencia)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {o.ehOrigem && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Origem
                </span>
              )}
              {canManage && o.vinculoId && (
                <button
                  type="button"
                  aria-label="Remover vínculo"
                  disabled={mutacaoDesvincular.isPending}
                  onClick={() => mutacaoDesvincular.mutate(o.vinculoId!)}
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
            riscoId={riscoId}
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
