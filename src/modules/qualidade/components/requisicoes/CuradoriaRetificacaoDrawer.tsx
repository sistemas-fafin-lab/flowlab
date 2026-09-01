import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  buscarMotivosRetificacao,
  buscarRequisicaoRetificada,
  salvarCuradoriaRetificacao,
} from '../../requisicoes.js';
import { formatarDataCurta } from '../riscos/rotulos.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';

interface CuradoriaRetificacaoDrawerProps {
  id: string;
  /** Nome já conhecido pela linha clicada na tabela — evita repetir a busca de PII sob demanda no LIS. */
  nomPacienteConhecido?: string | null;
  canManage: boolean;
  onFechar: () => void;
}

const campoInput = 'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

function formatarData(data: string | null): string {
  return data ? formatarDataCurta(data) : '—';
}

/**
 * Curadoria do motivo de retificação — mesmo padrão de
 * ocorrencias/CuradoriaDrawer.tsx, mas mais enxuto: o único dado que não
 * existe estruturado no LIS aqui é "por que este laudo foi retificado".
 */
export function CuradoriaRetificacaoDrawer({ id, nomPacienteConhecido, canManage, onFechar }: CuradoriaRetificacaoDrawerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['requisicao-retificada', id],
    queryFn: () => buscarRequisicaoRetificada(id, nomPacienteConhecido),
  });
  const { data: motivos } = useQuery({ queryKey: ['motivos-retificacao'], queryFn: buscarMotivosRetificacao });

  const [motivoId, setMotivoId] = useState('');
  const [resumoCurado, setResumoCurado] = useState('');

  useEffect(() => {
    if (!data) return;
    setMotivoId(data.motivoRetificacaoId ?? '');
    setResumoCurado(data.resumoRetificacaoCurado ?? '');
  }, [data]);

  const mutacao = useMutation({
    mutationFn: () =>
      salvarCuradoriaRetificacao(id, {
        motivoRetificacaoId: motivoId || null,
        resumoRetificacaoCurado: resumoCurado || null,
      }),
    onSuccess: async () => {
      // Prefixo compartilhado com IndicadoresPage.tsx (['indicadores-requisicoes', ...]) —
      // invalidar por esse prefixo pega a lista de retificados independente do período ativo.
      await queryClient.invalidateQueries({ queryKey: ['indicadores-requisicoes'] });
      await queryClient.invalidateQueries({ queryKey: ['requisicao-retificada', id] });
      onFechar();
    },
  });

  return (
    <DrawerLateral
      titulo="Curadoria da retificação"
      subtitulo={data ? `Requisição ${data.codRequisicao}` : undefined}
      aoFechar={onFechar}
      footer={
        <>
          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:px-6">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
            {canManage && (
              <button
                type="button"
                disabled={!data || mutacao.isPending}
                onClick={() => mutacao.mutate()}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
              >
                {mutacao.isPending ? 'Salvando…' : 'Concluir curadoria'}
              </button>
            )}
          </div>
          {mutacao.isError && (
            <p role="alert" className="px-4 pb-4 text-sm text-red-600 dark:text-red-400 sm:px-6">
              Não foi possível salvar a curadoria. Tente novamente.
            </p>
          )}
        </>
      }
    >
      {isLoading && (
        <div className="space-y-3 p-6">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState
            titulo="Não foi possível carregar o laudo retificado"
            descricao="Verifique sua conexão ou tente novamente."
            aoTentarNovamente={() => refetch()}
          />
        </div>
      )}

      {data && (
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Paciente</dt>
              <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.nomPaciente ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Exame</dt>
              <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.exameTipoNomeLis ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Data da solicitação</dt>
              <dd className="mt-1 text-gray-600 dark:text-slate-400">{formatarData(data.dtaSolicitacao)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700 dark:text-slate-300">Data da retificação</dt>
              <dd className="mt-1 text-gray-600 dark:text-slate-400">{formatarData(data.dtaRetificacao)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Patologista</dt>
              <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.patologistaNomeLis ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo da retificação</label>
            <div className="mt-1">
              <ComboboxBusca
                itens={motivos}
                valor={motivoId}
                onMudar={setMotivoId}
                placeholder="— motivo —"
                ariaLabel="Motivo da retificação"
                desabilitado={!canManage}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Resumo</label>
            <textarea
              className={campoInput}
              rows={4}
              value={resumoCurado}
              onChange={(e) => setResumoCurado(e.target.value)}
              disabled={!canManage}
            />
          </div>
        </div>
      )}
    </DrawerLateral>
  );
}
