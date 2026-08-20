import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusCuradoriaOcorrencia } from '../../types';
import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  buscarColaboradoresOcorrencia,
  buscarMotivosOcorrencia,
  buscarOcorrencia,
  buscarSetoresOcorrencia,
  salvarCuradoriaOcorrencia,
} from '../../ocorrencias.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { ErrorState } from '../ui/ErrorState.js';

interface CuradoriaDrawerProps {
  id: string;
  canManage: boolean;
  onFechar: () => void;
}

const BADGE_STATUS: Record<StatusCuradoriaOcorrencia, string> = {
  pendente: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const campoInput =
  'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

export function CuradoriaDrawer({ id, canManage, onFechar }: CuradoriaDrawerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ocorrencia', id],
    queryFn: () => buscarOcorrencia(id),
  });

  const { data: colaboradores } = useQuery({
    queryKey: ['ocorrencias-colaboradores'],
    queryFn: buscarColaboradoresOcorrencia,
  });
  const { data: setores } = useQuery({ queryKey: ['ocorrencias-setores'], queryFn: buscarSetoresOcorrencia });
  const { data: motivos } = useQuery({ queryKey: ['ocorrencias-motivos'], queryFn: buscarMotivosOcorrencia });

  const [colaboradorId, setColaboradorId] = useState('');
  const [setorErroId, setSetorErroId] = useState('');
  const [motivoId, setMotivoId] = useState('');
  const [resumoCurado, setResumoCurado] = useState('');
  const [acaoCurada, setAcaoCurada] = useState('');

  useEffect(() => {
    if (!data) return;
    setColaboradorId(data.colaboradorId ?? '');
    setSetorErroId(data.setorErroId ?? '');
    setMotivoId(data.motivoId ?? '');
    setResumoCurado(data.resumoCurado ?? '');
    setAcaoCurada(data.acaoCurada ?? '');
  }, [data]);

  const mutacao = useMutation({
    mutationFn: () =>
      salvarCuradoriaOcorrencia(id, {
        colaboradorId: colaboradorId || null,
        setorErroId: setorErroId || null,
        motivoId: motivoId || null,
        resumoCurado: resumoCurado || null,
        acaoCurada: acaoCurada || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ocorrencias'] });
      await queryClient.invalidateQueries({ queryKey: ['ocorrencia', id] });
      onFechar();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-3xl animate-slide-in-right flex-col border-l border-slate-200/50 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-gray-800/85">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Curadoria da ocorrência</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-gray-400 transition-all duration-200 hover:rotate-90 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-label="Carregando" />
          </div>
        )}

        {isError && (
          <div className="p-6">
            <ErrorState
              titulo="Não foi possível carregar a ocorrência"
              descricao="Verifique sua conexão ou tente novamente."
              aoTentarNovamente={() => refetch()}
            />
          </div>
        )}

        {data && (
          <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
            <section aria-label="Origem (LIS)">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Origem
              </h3>
              <dl className="mt-3 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Resumo da ocorrência</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                    {data.descricaoLis || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Análise / causa</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                    {data.cauDescricaoLis || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Ação realizada</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                    {data.acaoImediataLis || '—'}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-label="Sua decisão">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Sua decisão
              </h3>

              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Colaborador</label>
                  <div className="mt-1">
                    <ComboboxBusca
                      itens={colaboradores}
                      valor={colaboradorId}
                      onMudar={setColaboradorId}
                      placeholder="— colaborador —"
                      ariaLabel="Colaborador"
                      desabilitado={!canManage}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Setor do erro</label>
                  <div className="mt-1">
                    <ComboboxBusca
                      itens={setores}
                      valor={setorErroId}
                      onMudar={setSetorErroId}
                      placeholder="— setor —"
                      ariaLabel="Setor do erro"
                      desabilitado={!canManage}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
                  <div className="mt-1">
                    <ComboboxBusca
                      itens={motivos}
                      valor={motivoId}
                      onMudar={setMotivoId}
                      placeholder="— motivo —"
                      ariaLabel="Motivo"
                      desabilitado={!canManage}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Resumo curado</label>
                  <textarea
                    className={campoInput}
                    rows={3}
                    value={resumoCurado}
                    onChange={(e) => setResumoCurado(e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Ação curada</label>
                  <textarea
                    className={campoInput}
                    rows={3}
                    value={acaoCurada}
                    onChange={(e) => setAcaoCurada(e.target.value)}
                    disabled={!canManage}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status (LIS)</label>
                  <div className="mt-1">
                    {data && (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${BADGE_STATUS[data.statusCuradoria]}`}
                      >
                        {data.statusCuradoria}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4 dark:border-white/10 dark:bg-white/5">
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
          <p role="alert" className="px-6 pb-4 text-sm text-red-600 dark:text-red-400">
            Não foi possível salvar a curadoria. Tente novamente.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
