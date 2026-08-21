import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusCuradoriaCortesia } from '../../types';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  buscarClassificacoesCortesia,
  buscarColaboradoresCortesia,
  buscarCortesia,
  buscarMotivosCortesia,
  salvarCuradoriaCortesia,
} from '../../cortesias.js';
import { ComboboxBusca } from '../ui/ComboboxBusca.js';
import { DrawerLateral } from '../ui/DrawerLateral.js';
import { ErrorState } from '../ui/ErrorState.js';
import { Skeleton } from '../ui/Skeleton.js';

interface CuradoriaDrawerProps {
  id: string;
  canManage: boolean;
  onFechar: () => void;
}

const OPCOES_STATUS: { valor: StatusCuradoriaCortesia; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'concluida', rotulo: 'Concluída' },
  { valor: 'descartada', rotulo: 'Descartada' },
];

const campoInput =
  'mt-1 w-full glass-field rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200';

function formatarMoeda(valor: number | null): string {
  if (valor === null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CuradoriaDrawer({ id, canManage, onFechar }: CuradoriaDrawerProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cortesia', id],
    queryFn: () => buscarCortesia(id),
  });

  const { data: motivos } = useQuery({ queryKey: ['cortesias-motivos'], queryFn: buscarMotivosCortesia });
  const { data: classificacoes } = useQuery({
    queryKey: ['cortesias-classificacoes'],
    queryFn: buscarClassificacoesCortesia,
  });
  const { data: colaboradores } = useQuery({
    queryKey: ['cortesias-colaboradores'],
    queryFn: buscarColaboradoresCortesia,
  });

  const [motivoId, setMotivoId] = useState('');
  const [classificacaoId, setClassificacaoId] = useState('');
  const [autorizadoPorCorrigidoId, setAutorizadoPorCorrigidoId] = useState('');
  const [observacoesCuradas, setObservacoesCuradas] = useState('');
  const [valorParticularCorrigido, setValorParticularCorrigido] = useState('');
  const [valorConcedidoCorrigido, setValorConcedidoCorrigido] = useState('');
  const [status, setStatus] = useState<StatusCuradoriaCortesia>('em_analise');

  useEffect(() => {
    if (!data) return;
    setMotivoId(data.motivoId ?? '');
    setClassificacaoId(data.classificacaoId ?? '');
    setAutorizadoPorCorrigidoId(data.autorizadoPorCorrigidoId ?? '');
    setObservacoesCuradas(data.observacoesCuradas ?? '');
    setValorParticularCorrigido(data.valorParticularCorrigido !== null ? String(data.valorParticularCorrigido) : '');
    setValorConcedidoCorrigido(data.valorConcedidoCorrigido !== null ? String(data.valorConcedidoCorrigido) : '');
    setStatus(data.statusCuradoria === 'pendente' ? 'em_analise' : data.statusCuradoria);
  }, [data]);

  const mutacao = useMutation({
    mutationFn: () =>
      salvarCuradoriaCortesia(id, {
        motivoId: motivoId || null,
        classificacaoId: classificacaoId || null,
        autorizadoPorCorrigidoId: autorizadoPorCorrigidoId || null,
        observacoesCuradas: observacoesCuradas || null,
        valorParticularCorrigido: valorParticularCorrigido !== '' ? Number(valorParticularCorrigido) : null,
        valorConcedidoCorrigido: valorConcedidoCorrigido !== '' ? Number(valorConcedidoCorrigido) : null,
        status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cortesias'] });
      await queryClient.invalidateQueries({ queryKey: ['cortesia', id] });
      onFechar();
    },
  });

  return (
    <DrawerLateral
      titulo="Curadoria da cortesia"
      subtitulo={data?.nomePacienteLis}
      largura="larga"
      aoFechar={onFechar}
      footer={
        <>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onFechar}
              className="w-full rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5 sm:w-auto"
            >
              Cancelar
            </button>
            {canManage && (
              <button
                type="button"
                disabled={!data || mutacao.isPending}
                onClick={() => mutacao.mutate()}
                className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 sm:w-auto"
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:content-start lg:gap-5 lg:space-y-0">
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5 sm:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5 sm:p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6">
          <ErrorState
            titulo="Não foi possível carregar a cortesia"
            descricao="Verifique sua conexão ou tente novamente."
            aoTentarNovamente={() => refetch()}
          />
        </div>
      )}

      {data && (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:content-start lg:gap-5 lg:space-y-0">
          <section
            aria-label="Origem (LIS)"
            className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5 sm:p-5"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Origem
            </h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-700 dark:text-slate-300">Requisição</dt>
                <dd className="mt-1 text-gray-600 dark:text-slate-400">{data.codRequisicao}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700 dark:text-slate-300">Clínica / Exame</dt>
                <dd className="mt-1 text-gray-600 dark:text-slate-400">
                  {data.clinicaNome ?? '—'} / {data.exameNome ?? '—'}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-white p-3 dark:bg-white/5">
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Particular (LIS)</dt>
                  <dd
                    className={`mt-1 truncate ${data.valorParticular === null ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-slate-300'}`}
                  >
                    {data.valorParticular === null ? 'Não cadastrado' : formatarMoeda(data.valorParticular)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Cobrado</dt>
                  <dd className="mt-1 truncate text-gray-700 dark:text-slate-300">
                    {formatarMoeda(data.valorCobrado)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Concedido (LIS)</dt>
                  <dd
                    className={`mt-1 truncate ${data.valorConcedido === null ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-slate-300'}`}
                  >
                    {data.valorConcedido === null ? 'Não cadastrado' : formatarMoeda(data.valorConcedido)}
                  </dd>
                </div>
              </div>
              {data.divergenciaValores && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p className="text-xs">Divergência entre particular e cobrado + concedido (R3).</p>
                </div>
              )}
              <div>
                <dt className="font-medium text-slate-700 dark:text-slate-300">Autorizado por (LIS)</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                  {data.autorizadoPorLis || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700 dark:text-slate-300">Observações (LIS)</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-600 dark:text-slate-400">
                  {data.observacoesLis || '—'}
                </dd>
              </div>
              {data.parsingFalhou && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p className="text-xs">
                    O texto acima não seguiu o padrão esperado (R7) — o texto original foi preservado como está.
                  </p>
                </div>
              )}
            </dl>
          </section>

          <section
            aria-label="Sua decisão"
            className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5 sm:p-5 lg:self-start"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Sua decisão
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
                <div className="mt-1">
                  <ComboboxBusca itens={motivos} valor={motivoId} onMudar={setMotivoId} desabilitado={!canManage} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Classificação
                </label>
                <div className="mt-1">
                  <ComboboxBusca
                    itens={classificacoes}
                    valor={classificacaoId}
                    onMudar={setClassificacaoId}
                    desabilitado={!canManage}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Autorizado por (corrigido — colaborador)
                </label>
                <div className="mt-1">
                  <ComboboxBusca
                    itens={colaboradores}
                    valor={autorizadoPorCorrigidoId}
                    onMudar={setAutorizadoPorCorrigidoId}
                    placeholder="— colaborador —"
                    desabilitado={!canManage}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valor particular (ajuste manual)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className={`${campoInput} mt-1`}
                  value={valorParticularCorrigido}
                  onChange={(e) => setValorParticularCorrigido(e.target.value)}
                  placeholder={data.valorParticular === null ? 'não cadastrado no LIS — informe o valor' : String(data.valorParticular)}
                  disabled={!canManage}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Preencha quando o LIS não tiver o valor particular cadastrado. Enquanto o LIS tiver o dado, ele sempre prevalece.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valor concedido (ajuste manual)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className={`${campoInput} mt-1`}
                  value={valorConcedidoCorrigido}
                  onChange={(e) => setValorConcedidoCorrigido(e.target.value)}
                  placeholder={data.valorConcedido === null ? 'não cadastrado no LIS — informe o valor' : String(data.valorConcedido)}
                  disabled={!canManage}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Preencha quando o LIS não tiver o preço cadastrado (R4) ou quando o valor precisar de correção.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Observações curadas
                </label>
                <textarea
                  className={`${campoInput} resize-y`}
                  rows={4}
                  value={observacoesCuradas}
                  onChange={(e) => setObservacoesCuradas(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <select
                  className={campoInput}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusCuradoriaCortesia)}
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
    </DrawerLateral>
  );
}
