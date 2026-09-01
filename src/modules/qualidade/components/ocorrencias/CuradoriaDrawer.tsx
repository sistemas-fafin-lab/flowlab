import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NovoRiscoInput, StatusCuradoriaOcorrencia } from '../../types';
import { AlertOctagon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  buscarColaboradoresOcorrencia,
  buscarMotivosOcorrencia,
  buscarOcorrencia,
  buscarSetoresOcorrencia,
  salvarCuradoriaOcorrencia,
} from '../../ocorrencias.js';
import { NovoRiscoDrawer } from '../riscos/NovoRiscoDrawer.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';
import { RiscosVinculadosOcorrencia } from './RiscosVinculadosOcorrencia.js';

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
  const [prefillRisco, setPrefillRisco] = useState<Partial<NovoRiscoInput> | null>(null);
  const [erroSetorObrigatorio, setErroSetorObrigatorio] = useState(false);

  // Usa o setor já selecionado na tela (mesmo que a curadoria ainda não tenha
  // sido salva) em vez de reler `qa_ocorrencias` — evita um 422 confuso
  // quando o usuário escolheu o setor mas ainda não clicou "Concluir curadoria".
  function gerarRiscoDaOcorrencia() {
    if (!setorErroId) {
      setErroSetorObrigatorio(true);
      return;
    }
    setErroSetorObrigatorio(false);
    setPrefillRisco({
      setorId: setorErroId,
      riscoIdentificado: data?.descricaoLis ?? '',
      origemRisco: 'ocorrencia',
      ocorrenciaOrigemId: id,
    });
  }

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

  return (
    <DrawerLateral
      titulo="Curadoria da ocorrência"
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
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Sua decisão
              </h3>
              {canManage && (
                <button
                  type="button"
                  onClick={gerarRiscoDaOcorrencia}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <AlertOctagon className="h-3.5 w-3.5" aria-hidden />
                  Gerar risco a partir desta ocorrência
                </button>
              )}
            </div>
            {erroSetorObrigatorio && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Escolha o setor do erro antes de gerar um risco a partir desta ocorrência.
              </p>
            )}

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

          <div className="md:col-span-2">
            <RiscosVinculadosOcorrencia ocorrenciaId={id} canManage={canManage} />
          </div>
        </div>
      )}
      {prefillRisco && <NovoRiscoDrawer prefill={prefillRisco} onFechar={() => setPrefillRisco(null)} />}
    </DrawerLateral>
  );
}
