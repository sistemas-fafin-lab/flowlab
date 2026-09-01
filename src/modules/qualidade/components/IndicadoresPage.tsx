// Aba "Indicadores" — Indicadores Gerais do Laboratório + 4 seções extras
// (.scratch/qualidade-riscos-indicadores/issues/06-indicadores-requisicoes.md).
// Módulo independente de Riscos: schema (qa_requisicoes) e domínio próprios,
// só reaproveita o indicador de Ocorrências para "Não Conformidades por
// Setor" (ver requisicoes.ts).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Beaker,
  CheckCircle2,
  ClipboardList,
  Clock,
  FlaskConical,
  Layers,
  Microscope,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { RequisicaoRetificadaDTO, SecaoRequisicao } from '../types';
import { anoAtual } from '../anoAtual.js';
import {
  buscarContagensAbasIndicadores,
  buscarIndicadoresGeraisLaboratorio,
  buscarIndicadoresSecaoRequisicao,
  buscarRequisicoesRetificadas,
  sincronizarRequisicoes,
} from '../requisicoes.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';
import { CuradoriaRetificacaoDrawer } from './requisicoes/CuradoriaRetificacaoDrawer.js';
import { formatarDataCurta } from './riscos/rotulos.js';
import { AbasChips, type AbaChip } from './ui/AbasChips.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';

type Aba = 'geral' | SecaoRequisicao;

const ROTULO_ABA: Record<Aba, string> = {
  geral: 'Indicadores Gerais',
  biologia_molecular: 'Biologia Molecular',
  patologia_ap: 'Patologia / AP',
  histologia_citologia: 'Histologia / Citologia',
  ihq_parceiro: 'IHQ / Parceiro',
};

const ICONE_ABA: Record<Aba, typeof Beaker> = {
  geral: Layers,
  biologia_molecular: FlaskConical,
  patologia_ap: Microscope,
  histologia_citologia: Beaker,
  ihq_parceiro: Users,
};

const CORES_BADGE: Record<'azul' | 'laranja' | 'verde' | 'roxo' | 'vermelho', { badge: string; brilho: string; valor: string }> = {
  azul: { badge: 'bg-gradient-to-br from-blue-400 to-blue-600', brilho: 'shadow-blue-500/30', valor: 'text-blue-600 dark:text-blue-400' },
  laranja: {
    badge: 'bg-gradient-to-br from-orange-400 to-orange-600',
    brilho: 'shadow-orange-500/30',
    valor: 'text-orange-600 dark:text-orange-400',
  },
  verde: {
    badge: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    brilho: 'shadow-emerald-500/30',
    valor: 'text-emerald-600 dark:text-emerald-400',
  },
  roxo: { badge: 'bg-gradient-to-br from-purple-400 to-purple-600', brilho: 'shadow-purple-500/30', valor: 'text-purple-600 dark:text-purple-400' },
  vermelho: { badge: 'bg-gradient-to-br from-red-400 to-red-600', brilho: 'shadow-red-500/30', valor: 'text-red-600 dark:text-red-400' },
};

function Kpi({
  rotulo,
  valor,
  icone: Icone,
  cor = 'azul',
}: {
  rotulo: string;
  valor: string | number;
  icone: typeof Beaker;
  cor?: keyof typeof CORES_BADGE;
}) {
  const paleta = CORES_BADGE[cor];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-white/[0.03]">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg ${paleta.badge} ${paleta.brilho}`}>
        <Icone className="h-5 w-5 text-white" aria-hidden />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold ${paleta.valor}`}>{valor}</p>
    </div>
  );
}

function formatarTat(dias: number | null): string {
  return dias === null ? '—' : `${dias} dia(s)`;
}

function formatarData(data: string | null): string {
  return data ? formatarDataCurta(data) : '—';
}

function TabelaRetificacoes({
  itens,
  onClickLinha,
}: {
  itens: RequisicaoRetificadaDTO[];
  onClickLinha: (item: RequisicaoRetificadaDTO) => void;
}) {
  if (itens.length === 0) {
    return (
      <p className="glass-surface rounded-2xl p-6 text-center text-sm text-gray-500 dark:text-slate-400">
        Nenhum laudo retificado neste período.
      </p>
    );
  }

  return (
    <div className="glass-surface overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Requisição</th>
            <th className="px-4 py-3">Solicitação</th>
            <th className="px-4 py-3">Retificação</th>
            <th className="px-4 py-3">Patologista</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr
              key={item.id}
              onClick={() => onClickLinha(item)}
              className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td className="px-4 py-3">{item.codRequisicao}</td>
              <td className="px-4 py-3">{formatarData(item.dtaSolicitacao)}</td>
              <td className="px-4 py-3">{formatarData(item.dtaRetificacao)}</td>
              <td className="px-4 py-3">{item.patologistaNomeLis ?? '—'}</td>
              <td className="px-4 py-3">{item.motivoRetificacaoNome ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    item.statusCuradoria === 'concluida'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {item.statusCuradoria === 'concluida' ? 'Concluída' : 'Pendente'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Indicadores() {
  const canManage = useCanManageQualidade();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>('geral');
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);

  const periodoCompleto = Boolean(periodo.inicio && periodo.fim);
  const filtro = { inicio: periodo.inicio, fim: periodo.fim };

  const sync = useMutation({
    mutationFn: () => sincronizarRequisicoes(filtro),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indicadores-requisicoes'] }),
  });

  const geral = useQuery({
    queryKey: ['indicadores-requisicoes', 'geral', filtro],
    queryFn: () => buscarIndicadoresGeraisLaboratorio(filtro),
    enabled: periodoCompleto && aba === 'geral',
  });

  const retificados = useQuery({
    queryKey: ['indicadores-requisicoes', 'retificados', filtro],
    queryFn: () => buscarRequisicoesRetificadas(filtro),
    enabled: periodoCompleto && aba === 'geral',
  });

  const secaoAtual: SecaoRequisicao | null = aba === 'geral' ? null : aba;
  const secao = useQuery({
    queryKey: ['indicadores-requisicoes', 'secao', secaoAtual, filtro],
    queryFn: () => buscarIndicadoresSecaoRequisicao(secaoAtual as SecaoRequisicao, filtro),
    enabled: periodoCompleto && secaoAtual !== null,
  });

  const contagens = useQuery({
    queryKey: ['indicadores-requisicoes', 'contagens-abas', filtro],
    queryFn: () => buscarContagensAbasIndicadores(filtro),
    enabled: periodoCompleto,
  });

  const abas: AbaChip<Aba>[] = (Object.keys(ROTULO_ABA) as Aba[]).map((valor) => ({
    valor,
    rotulo: ROTULO_ABA[valor],
    contagem: contagens.data?.[valor] ?? 0,
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Indicadores</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Indicadores gerais do laboratório e das seções de Biologia Molecular, Patologia/AP, Histologia/Citologia e
            IHQ/Parceiro, calculados a partir das requisições sincronizadas do LIS.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={!periodoCompleto || sync.isPending}
            onClick={() => sync.mutate()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-500/25 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} aria-hidden />
            Sincronizar
          </button>
        )}
      </div>

      <SeletorPeriodoPorMes inicio={periodo.inicio} fim={periodo.fim} anoPadrao={anoAtual()} onMudar={definirPeriodo} />

      <AbasChips<Aba> abas={abas} atual={aba} onMudar={setAba} cor="blue" />

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Selecione o período para carregar os indicadores.</p>
      )}

      {periodoCompleto && aba === 'geral' && (
        <div className="space-y-6">
          {geral.isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-24 w-full" />
              ))}
            </div>
          )}

          {geral.isError && (
            <ErrorState titulo="Não foi possível carregar os indicadores gerais" aoTentarNovamente={() => geral.refetch()} />
          )}

          {geral.data && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Kpi rotulo="Amostras recebidas" valor={geral.data.amostrasRecebidas} icone={Beaker} cor="azul" />
                <Kpi rotulo="Amostras admitidas" valor={geral.data.amostrasAdmitidas} icone={ClipboardList} cor="azul" />
                <Kpi rotulo="Laudos liberados" valor={geral.data.laudosLiberados} icone={CheckCircle2} cor="verde" />
                <Kpi rotulo="Laudos retificados" valor={geral.data.laudosRetificados} icone={RefreshCw} cor="roxo" />
                <Kpi rotulo="TAT médio" valor={formatarTat(geral.data.tatMedioDias)} icone={Clock} cor="laranja" />
                <Kpi rotulo="Laudos fora do prazo" valor={geral.data.laudosForaDoPrazo} icone={Clock} cor="vermelho" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="glass-surface rounded-2xl p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Laudos liberados por médico (patologista)</h3>
                  {geral.data.laudosLiberadosPorMedico.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum laudo liberado no período.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {geral.data.laudosLiberadosPorMedico.map((item) => (
                        <li key={item.medicoNome} className="flex items-center justify-between gap-2">
                          <span className="text-gray-700 dark:text-slate-300">{item.medicoNome}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{item.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="glass-surface rounded-2xl p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Não conformidades por setor</h3>
                  {geral.data.naoConformidadesPorSetor.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma ocorrência classificada no período.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {geral.data.naoConformidadesPorSetor.map((item) => (
                        <li key={item.setorId} className="flex items-center justify-between gap-2">
                          <span className="text-gray-700 dark:text-slate-300">{item.setorNome}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{item.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Laudos retificados — curadoria do motivo</h3>
            {retificados.isLoading && <Skeleton className="h-32 w-full" />}
            {retificados.isError && (
              <ErrorState titulo="Não foi possível carregar os laudos retificados" aoTentarNovamente={() => retificados.refetch()} />
            )}
            {retificados.data && <TabelaRetificacoes itens={retificados.data} onClickLinha={(item) => setIdSelecionado(item.id)} />}
          </div>
        </div>
      )}

      {periodoCompleto && secaoAtual !== null && (
        <div className="space-y-6">
          {secao.isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-24 w-full" />
              ))}
            </div>
          )}

          {secao.isError && (
            <ErrorState titulo={`Não foi possível carregar os indicadores de ${ROTULO_ABA[aba]}`} aoTentarNovamente={() => secao.refetch()} />
          )}

          {secao.data && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Kpi rotulo="Requisições" valor={secao.data.totalRequisicoes} icone={ICONE_ABA[aba]} cor="azul" />
              <Kpi rotulo="Laudos liberados" valor={secao.data.laudosLiberados} icone={CheckCircle2} cor="verde" />
              <Kpi rotulo="TAT médio" valor={formatarTat(secao.data.tatMedioDias)} icone={Clock} cor="laranja" />
              <Kpi rotulo="Laudos fora do prazo" valor={secao.data.laudosForaDoPrazo} icone={Clock} cor="vermelho" />
            </div>
          )}
        </div>
      )}

      {idSelecionado && (
        <CuradoriaRetificacaoDrawer id={idSelecionado} canManage={canManage} onFechar={() => setIdSelecionado(null)} />
      )}
    </div>
  );
}
