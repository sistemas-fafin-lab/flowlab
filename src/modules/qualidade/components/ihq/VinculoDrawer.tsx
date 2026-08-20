import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusCuradoriaIhq } from '../../types';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { buscarIhqItem, confirmarVinculoIhq, salvarCuradoriaIhq } from '../../ihq.js';
import { ErrorState } from '../ui/ErrorState.js';

interface VinculoDrawerProps {
  id: string;
  canManage: boolean;
  onFechar: () => void;
}

const OPCOES_STATUS: { valor: StatusCuradoriaIhq; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'concluida', rotulo: 'Concluída' },
  { valor: 'descartada', rotulo: 'Descartada' },
];

const campoInput =
  'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

export function VinculoDrawer({ id, canManage, onFechar }: VinculoDrawerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ihq', id],
    queryFn: () => buscarIhqItem(id),
  });

  const [laminaEnviada, setLaminaEnviada] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dtaEnvioCorrigida, setDtaEnvioCorrigida] = useState('');
  const [status, setStatus] = useState<StatusCuradoriaIhq>('em_analise');

  useEffect(() => {
    if (!data) return;
    setLaminaEnviada(data.laminaEnviada === null ? '' : String(data.laminaEnviada));
    setObservacoes(data.observacoes ?? '');
    setDtaEnvioCorrigida(data.dtaEnvioProveniencia === 'curadoria' ? (data.dtaEnvioBloco ?? '') : '');
    setStatus(data.statusCuradoria === 'pendente' ? 'em_analise' : data.statusCuradoria);
  }, [data]);

  const confirmarVinculo = useMutation({
    mutationFn: (codRequisicaoOriginal: string) => confirmarVinculoIhq(id, { codRequisicaoOriginal }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ihq'] });
      await queryClient.invalidateQueries({ queryKey: ['ihq', id] });
    },
  });

  const salvarCuradoria = useMutation({
    mutationFn: () =>
      salvarCuradoriaIhq(id, {
        laminaEnviada: laminaEnviada === '' ? null : laminaEnviada === 'true',
        observacoes: observacoes || null,
        dtaEnvioBlocoCorrigida: dtaEnvioCorrigida || null,
        status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ihq'] });
      await queryClient.invalidateQueries({ queryKey: ['ihq', id] });
      onFechar();
    },
  });

  const precisaConfirmar =
    data && data.vinculoProveniencia === 'heuristica' && (data.vinculoConfianca === 'baixa' || data.vinculoConfianca === 'nenhuma');

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative flex h-full w-full max-w-3xl animate-slide-in-right flex-col border-l border-slate-200/50 bg-white/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-gray-800/85">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Solicitação de IHQ</h2>
            {data?.nomePacienteLis && (
              <p className="text-sm text-gray-500 dark:text-slate-400">{data.nomePacienteLis}</p>
            )}
          </div>
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
              titulo="Não foi possível carregar a solicitação"
              descricao="Verifique sua conexão ou tente novamente."
              aoTentarNovamente={() => refetch()}
            />
          </div>
        )}

        {data && (
          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <section aria-label="Vínculo com a biópsia original">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Vínculo com a biópsia original {data.vinculoProveniencia === 'manual' ? '(confirmado manualmente)' : '(heurística)'}
              </h3>

              {!precisaConfirmar && (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-700 dark:text-slate-300">Material</dt>
                    <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.materialLis ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700 dark:text-slate-300">Patologista</dt>
                    <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.patologistaLis ?? '—'}</dd>
                  </div>
                </dl>
              )}

              {precisaConfirmar && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p className="text-xs">
                      Vínculo ambíguo (confiança {data.vinculoConfianca}) — Material/Patologista não são publicados
                      automaticamente. Escolha a candidata correta (R1).
                    </p>
                  </div>
                  {(data.candidatas ?? []).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma candidata encontrada na janela.</p>
                  )}
                  <ul className="space-y-2">
                    {(data.candidatas ?? []).map((candidata) => (
                      <li
                        key={candidata.codRequisicaoOriginal}
                        className="glass-field flex items-center justify-between rounded-xl p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">{candidata.codRequisicaoOriginal}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {candidata.dtaSolicitacao} — {candidata.temPeca ? 'com peça cadastrada' : 'sem peça cadastrada'}
                          </p>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            disabled={confirmarVinculo.isPending}
                            onClick={() => confirmarVinculo.mutate(candidata.codRequisicaoOriginal)}
                            className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-300"
                          >
                            Confirmar esta
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section aria-label="Envio do bloco">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Envio do bloco {data.dtaEnvioProveniencia === 'curadoria' ? '(corrigido manualmente)' : '(aproximado)'}
              </h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">
                    Data {data.dtaEnvioProveniencia !== 'curadoria' && <span className="text-amber-600 dark:text-amber-400">(aproximada)</span>}
                  </dt>
                  <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.dtaEnvioBloco ?? 'não detectada'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Texto original do arquivo</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                    {data.dtaEnvioTextoOriginal || '—'}
                  </dd>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Corrigir data de envio</label>
                  <input
                    type="date"
                    className={campoInput}
                    value={dtaEnvioCorrigida}
                    onChange={(e) => setDtaEnvioCorrigida(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
              </dl>
            </section>

            <section aria-label="Retorno do bloco">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Retorno do bloco
              </h3>
              {data.blocoRetornou ? (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-gray-600 dark:bg-white/5 dark:text-slate-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p className="text-xs">
                    Retornado em {data.dtaRetornoBloco} — padrão de detecção não validado contra dado real (R4).
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Sem retorno registrado.</p>
              )}
            </section>

            <section aria-label="Curadoria">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Curadoria</h3>
              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Lâmina enviada</label>
                  <select
                    className={campoInput}
                    value={laminaEnviada}
                    onChange={(e) => setLaminaEnviada(e.target.value)}
                    disabled={!canManage}
                  >
                    <option value="">Não informado</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Observações</label>
                  <textarea
                    className={campoInput}
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    className={campoInput}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusCuradoriaIhq)}
                    disabled={!canManage}
                  >
                    {OPCOES_STATUS.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
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
              disabled={!data || salvarCuradoria.isPending}
              onClick={() => salvarCuradoria.mutate()}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {salvarCuradoria.isPending ? 'Salvando…' : 'Salvar curadoria'}
            </button>
          )}
        </div>
        {salvarCuradoria.isError && (
          <p role="alert" className="px-6 pb-4 text-sm text-red-600 dark:text-red-400">
            Não foi possível salvar a curadoria. Tente novamente.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
