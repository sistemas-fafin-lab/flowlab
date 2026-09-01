// Aba "Indicadores" — Indicadores Gerais do Laboratório + 4 seções extras
// (.scratch/qualidade-riscos-indicadores/issues/06-indicadores-requisicoes.md).
// Layout em SEÇÕES empilhadas na mesma página (não abas) — alinhado ao
// design de referência do projeto de origem (Flowlab_Controle_Qualidade,
// commit d78e375): cada seção tem uma cor própria (borda + badge do ícone),
// aplicada uniformemente a todos os KPIs dela — identidade de NAVEGAÇÃO
// entre seções, não codificação semântica por métrica.
//
// Módulo independente de Riscos: schema (qa_requisicoes) e domínio próprios,
// só reaproveita o indicador de Ocorrências para "Não Conformidades por
// Setor" (ver requisicoes.ts). As 4 seções extras aqui usam o domínio
// genérico já existente (totalRequisicoes/laudosLiberados/tatMedioDias/
// laudosForaDoPrazo) — métricas mais ricas por seção (blocos, recorte,
// consenso, tabela de IHQ) dependem de novos eventos do LIS ainda não
// mapeados nesta base, fase 2.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Dna,
  FileCheck2,
  FlaskConical,
  Inbox,
  Layers,
  LayoutGrid,
  Microscope,
  PackageX,
  RefreshCw,
  Scissors,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type {
  IndicadorBiologiaMolecularResposta,
  IndicadorHistologiaCitologiaResposta,
  IndicadorPatologiaApResposta,
  IndicadorSecaoRequisicaoResposta,
  RequisicaoRetificadaDTO,
  SecaoRequisicao,
} from '../types';
import { anoAtual } from '../anoAtual.js';
import {
  buscarIndicadoresBiologiaMolecular,
  buscarIndicadoresGeraisLaboratorio,
  buscarIndicadoresHistologiaCitologia,
  buscarIndicadoresPatologiaAp,
  buscarIndicadoresSecaoRequisicao,
  buscarRequisicoesRetificadas,
  sincronizarRequisicoes,
} from '../requisicoes.js';
import { useCanManageQualidade } from '../hooks/useCanManageQualidade.js';
import { useTheme } from '../../../hooks/useTheme';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';
import { BarChartHorizontal } from './ui/charts/BarChartHorizontal.js';
import { TopLista } from './ui/charts/TopLista.js';
import { CuradoriaRetificacaoDrawer } from './requisicoes/CuradoriaRetificacaoDrawer.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';

// ─── Identidade de cor por seção ────────────────────────────────────────────

type CorSecao = 'azul' | 'verde' | 'roxo' | 'ambar' | 'rosa';

const CORES_SECAO: Record<CorSecao, { borda: string; badge: string; brilho: string; grafico: { light: string; dark: string } }> = {
  azul: {
    borda: 'border-l-4 border-l-blue-500',
    badge: 'bg-gradient-to-br from-blue-400 to-blue-600',
    brilho: 'shadow-blue-500/30',
    grafico: { light: '#2a78d6', dark: '#3987e5' },
  },
  verde: {
    borda: 'border-l-4 border-l-emerald-500',
    badge: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    brilho: 'shadow-emerald-500/30',
    grafico: { light: '#10b981', dark: '#34d399' },
  },
  roxo: {
    borda: 'border-l-4 border-l-purple-500',
    badge: 'bg-gradient-to-br from-purple-400 to-purple-600',
    brilho: 'shadow-purple-500/30',
    grafico: { light: '#9333ea', dark: '#a855f7' },
  },
  ambar: {
    borda: 'border-l-4 border-l-amber-500',
    badge: 'bg-gradient-to-br from-amber-400 to-amber-600',
    brilho: 'shadow-amber-500/30',
    grafico: { light: '#d97706', dark: '#f59e0b' },
  },
  rosa: {
    borda: 'border-l-4 border-l-rose-500',
    badge: 'bg-gradient-to-br from-rose-400 to-rose-600',
    brilho: 'shadow-rose-500/30',
    grafico: { light: '#e11d48', dark: '#fb7185' },
  },
};

type SecaoExtraGenerica = Exclude<SecaoRequisicao, 'biologia_molecular' | 'patologia_ap' | 'histologia_citologia'>;

const SECOES_EXTRA: { secao: SecaoExtraGenerica; titulo: string; subtitulo: string; icone: LucideIcon; cor: CorSecao }[] = [
  {
    secao: 'ihq_parceiro',
    titulo: 'IHQ / Parceiro',
    subtitulo: 'Imunoistoquímica e exames por parceiro — volume, produtividade e prazo no período selecionado.',
    icone: FlaskConical,
    cor: 'rosa',
  },
];

function SecaoIndicador({
  titulo,
  subtitulo,
  icone: Icone,
  cor,
  children,
}: {
  titulo: string;
  subtitulo: string;
  icone: LucideIcon;
  cor: CorSecao;
  children: ReactNode;
}) {
  const paleta = CORES_SECAO[cor];
  return (
    <section className={`glass-surface rounded-2xl ${paleta.borda} p-5`} aria-label={titulo}>
      <div className="mb-4 flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-lg ${paleta.badge} ${paleta.brilho}`}>
          <Icone className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{titulo}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{subtitulo}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Kpi({ rotulo, valor, icone: Icone, cor }: { rotulo: string; valor: string | number; icone: LucideIcon; cor: CorSecao }) {
  const paleta = CORES_SECAO[cor];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-white/[0.03]">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg ${paleta.badge} ${paleta.brilho}`}>
        <Icone className="h-5 w-5 text-white" aria-hidden />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{valor}</p>
    </div>
  );
}

function formatarTat(dias: number | null): string {
  return dias === null ? '—' : `${dias} dia(s)`;
}

function TabelaRetificacoes({
  itens,
  onClickLinha,
}: {
  itens: RequisicaoRetificadaDTO[];
  onClickLinha: (item: RequisicaoRetificadaDTO) => void;
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum laudo retificado no período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-slate-400">
            <th className="py-2 pr-4">Requisição</th>
            <th className="py-2 pr-4">Paciente</th>
            <th className="py-2 pr-4">Exame</th>
            <th className="py-2 pr-4">Patologista</th>
            <th className="py-2 pr-4">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr
              key={item.id}
              onClick={() => onClickLinha(item)}
              className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{item.codRequisicao}</td>
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{item.nomPaciente ?? '—'}</td>
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{item.exameTipoNomeLis ?? '—'}</td>
              <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{item.patologistaNomeLis ?? '—'}</td>
              <td className="py-2 pr-4">
                {item.statusCuradoria === 'concluida' ? (
                  <span className="text-slate-700 dark:text-slate-200">
                    {item.motivoRetificacaoNome ?? item.resumoRetificacaoCurado ?? '—'}
                  </span>
                ) : (
                  <span className="italic text-gray-400 dark:text-slate-500">Pendente de curadoria</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecaoExtra({
  secao,
  titulo,
  subtitulo,
  icone,
  cor,
  filtro,
  periodoCompleto,
}: {
  secao: SecaoExtraGenerica;
  titulo: string;
  subtitulo: string;
  icone: LucideIcon;
  cor: CorSecao;
  filtro: { inicio: string; fim: string };
  periodoCompleto: boolean;
}) {
  const query = useQuery<IndicadorSecaoRequisicaoResposta>({
    queryKey: ['indicadores-requisicoes', 'secao', secao, filtro],
    queryFn: () => buscarIndicadoresSecaoRequisicao(secao, filtro),
    enabled: periodoCompleto,
  });

  return (
    <SecaoIndicador titulo={titulo} subtitulo={subtitulo} icone={icone} cor={cor}>
      {query.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState titulo={`Não foi possível carregar os indicadores de ${titulo}`} aoTentarNovamente={() => query.refetch()} />
      )}

      {query.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi rotulo="Requisições" valor={query.data.totalRequisicoes} icone={icone} cor={cor} />
          <Kpi rotulo="Laudos liberados" valor={query.data.laudosLiberados} icone={FileCheck2} cor={cor} />
          <Kpi rotulo="TAT médio" valor={formatarTat(query.data.tatMedioDias)} icone={Clock} cor={cor} />
          <Kpi rotulo="Laudos fora do prazo" valor={query.data.laudosForaDoPrazo} icone={ShieldAlert} cor={cor} />
        </div>
      )}
    </SecaoIndicador>
  );
}

const COR_BIOLOGIA_MOLECULAR: CorSecao = 'verde';

/**
 * Bespoke em vez do `SecaoExtra` genérico (issue 07) — Biologia Molecular
 * quebra o TAT médio por tipo de exame (PCR/Captura Híbrida), métrica que
 * as outras 3 seções extras não têm. Mesmo padrão da seção "Indicadores
 * Gerais" acima: KPIs + gráfico dentro do mesmo `SecaoIndicador`.
 */
function SecaoBiologiaMolecular({
  filtro,
  periodoCompleto,
  tema,
}: {
  filtro: { inicio: string; fim: string };
  periodoCompleto: boolean;
  tema: 'light' | 'dark';
}) {
  const query = useQuery<IndicadorBiologiaMolecularResposta>({
    queryKey: ['indicadores-requisicoes', 'biologia-molecular', filtro],
    queryFn: () => buscarIndicadoresBiologiaMolecular(filtro),
    enabled: periodoCompleto,
  });

  return (
    <SecaoIndicador
      titulo="Biologia Molecular"
      subtitulo="PCR e Captura Híbrida — volume, produtividade e prazo no período selecionado."
      icone={Dna}
      cor={COR_BIOLOGIA_MOLECULAR}
    >
      {query.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState titulo="Não foi possível carregar os indicadores de Biologia Molecular" aoTentarNovamente={() => query.refetch()} />
      )}

      {query.data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi rotulo="Requisições" valor={query.data.totalRequisicoes} icone={Dna} cor={COR_BIOLOGIA_MOLECULAR} />
            <Kpi rotulo="Laudos liberados" valor={query.data.laudosLiberados} icone={FileCheck2} cor={COR_BIOLOGIA_MOLECULAR} />
            <Kpi rotulo="TAT médio" valor={formatarTat(query.data.tatMedioDias)} icone={Clock} cor={COR_BIOLOGIA_MOLECULAR} />
            <Kpi rotulo="Laudos fora do prazo" valor={query.data.laudosForaDoPrazo} icone={ShieldAlert} cor={COR_BIOLOGIA_MOLECULAR} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              TAT médio por tipo de exame
            </h3>
            <BarChartHorizontal
              tema={tema}
              cor={CORES_SECAO[COR_BIOLOGIA_MOLECULAR].grafico}
              dados={query.data.tatPorTipoExame.map((t) => ({ rotulo: t.exameTipoNomeLis, valor: t.tatMedioDias }))}
              formatarValor={(v) => `${v} dia(s)`}
            />
          </div>
        </div>
      )}
    </SecaoIndicador>
  );
}

const COR_PATOLOGIA_AP: CorSecao = 'roxo';

/**
 * Bespoke em vez do `SecaoExtra` genérico (issue 08) — Patologia/AP troca os
 * 4 KPIs genéricos por métricas próprias da seção (Casos Atrasados usa o
 * prazo OPERACIONAL do setor, não o prazo ao cliente). Mesmo padrão de
 * `SecaoBiologiaMolecular` acima.
 */
function SecaoPatologiaAp({ filtro, periodoCompleto }: { filtro: { inicio: string; fim: string }; periodoCompleto: boolean }) {
  const query = useQuery<IndicadorPatologiaApResposta>({
    queryKey: ['indicadores-requisicoes', 'patologia-ap', filtro],
    queryFn: () => buscarIndicadoresPatologiaAp(filtro),
    enabled: periodoCompleto,
  });

  return (
    <SecaoIndicador
      titulo="Patologia / Anatomia Patológica"
      subtitulo="Anátomo Patológico — casos atrasados, recorte/coloração, consenso e blocos refeitos no período selecionado."
      icone={Stethoscope}
      cor={COR_PATOLOGIA_AP}
    >
      {query.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState titulo="Não foi possível carregar os indicadores de Patologia/AP" aoTentarNovamente={() => query.refetch()} />
      )}

      {query.data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi rotulo="Casos atrasados" valor={query.data.casosAtrasados} icone={AlertTriangle} cor={COR_PATOLOGIA_AP} />
            <Kpi rotulo="Recorte / nova coloração" valor={query.data.recorteColoracao} icone={Scissors} cor={COR_PATOLOGIA_AP} />
            <Kpi rotulo="Consenso pendente" valor={query.data.consensoPendente} icone={Users} cor={COR_PATOLOGIA_AP} />
            <Kpi rotulo="Blocos refeitos" valor={query.data.blocosRefeitos} icone={PackageX} cor={COR_PATOLOGIA_AP} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Blocos refeitos é raro neste LIS — só houve 1 registro em ~4 anos de histórico, então 0 é o valor esperado na
            maior parte dos períodos.
          </p>
        </div>
      )}
    </SecaoIndicador>
  );
}

const COR_HISTOLOGIA_CITOLOGIA: CorSecao = 'ambar';

/**
 * Bespoke em vez do `SecaoExtra` genérico (issue 09) — Histologia/Citologia
 * troca os 4 KPIs genéricos por métricas próprias da seção. "Microscopia
 * Aguardando" foi realocada de Patologia/AP para cá (ver
 * histologiaCitologiaIndicadores.ts). "Lâminas Inadequadas"/"Amostras
 * Insatisfatórias" ficaram de fora desta fase — sinal quase inexistente no
 * LIS (ver migration 20260901140000). Mesmo padrão de `SecaoPatologiaAp`.
 */
function SecaoHistologiaCitologia({ filtro, periodoCompleto }: { filtro: { inicio: string; fim: string }; periodoCompleto: boolean }) {
  const query = useQuery<IndicadorHistologiaCitologiaResposta>({
    queryKey: ['indicadores-requisicoes', 'histologia-citologia', filtro],
    queryFn: () => buscarIndicadoresHistologiaCitologia(filtro),
    enabled: periodoCompleto,
  });

  return (
    <SecaoIndicador
      titulo="Histologia / Citologia"
      subtitulo="Citopatologia — blocos/lâminas produzidos, tempo de processamento e pendências de amostra no período selecionado."
      icone={Microscope}
      cor={COR_HISTOLOGIA_CITOLOGIA}
    >
      {query.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState titulo="Não foi possível carregar os indicadores de Histologia/Citologia" aoTentarNovamente={() => query.refetch()} />
      )}

      {query.data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Kpi rotulo="Blocos produzidos" valor={query.data.blocosProduzidos} icone={Layers} cor={COR_HISTOLOGIA_CITOLOGIA} />
          <Kpi rotulo="Lâminas produzidas" valor={query.data.laminasProduzidas} icone={LayoutGrid} cor={COR_HISTOLOGIA_CITOLOGIA} />
          <Kpi rotulo="Tempo de processamento" valor={formatarTat(query.data.tatProcessamentoDias)} icone={Clock} cor={COR_HISTOLOGIA_CITOLOGIA} />
          <Kpi rotulo="Microscopia aguardando" valor={query.data.microscopiaAguardando} icone={Microscope} cor={COR_HISTOLOGIA_CITOLOGIA} />
          <Kpi rotulo="Amostras não recebidas" valor={query.data.amostrasNaoRecebidas} icone={Ban} cor={COR_HISTOLOGIA_CITOLOGIA} />
          <Kpi
            rotulo="Material devolvido não conforme"
            valor={query.data.materialDevolvidoNaoConforme}
            icone={PackageX}
            cor={COR_HISTOLOGIA_CITOLOGIA}
          />
        </div>
      )}
    </SecaoIndicador>
  );
}

export function Indicadores() {
  const canManage = useCanManageQualidade();
  const { theme: tema } = useTheme();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const queryClient = useQueryClient();
  const [itemSelecionado, setItemSelecionado] = useState<RequisicaoRetificadaDTO | null>(null);

  const periodoCompleto = Boolean(periodo.inicio && periodo.fim);
  const filtro = { inicio: periodo.inicio, fim: periodo.fim };

  const sync = useMutation({
    mutationFn: () => sincronizarRequisicoes(filtro),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indicadores-requisicoes'] }),
  });

  const geral = useQuery({
    queryKey: ['indicadores-requisicoes', 'geral', filtro],
    queryFn: () => buscarIndicadoresGeraisLaboratorio(filtro),
    enabled: periodoCompleto,
  });

  const retificados = useQuery({
    queryKey: ['indicadores-requisicoes', 'retificados', filtro],
    queryFn: () => buscarRequisicoesRetificadas(filtro),
    enabled: periodoCompleto,
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Indicadores</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Indicadores gerais do laboratório e das seções de Biologia Molecular, Patologia/AP, Histologia/Citologia e
            IHQ/Parceiro, calculados a partir das requisições sincronizadas do LIS. Cada seção tem uma cor própria — use-a
            para identificar rapidamente qual tópico é qual.
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

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Selecione o período para carregar os indicadores.</p>
      )}

      {periodoCompleto && (
        <div className="space-y-6">
          {/* ─── Indicadores Gerais do Laboratório — AZUL ─────────────────── */}
          <SecaoIndicador
            titulo="Indicadores Gerais do Laboratório"
            subtitulo="Volume, produtividade, prazo e não conformidades no período selecionado."
            icone={Inbox}
            cor="azul"
          >
            {geral.isLoading && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            )}

            {geral.isError && (
              <ErrorState titulo="Não foi possível carregar os indicadores gerais" aoTentarNovamente={() => geral.refetch()} />
            )}

            {geral.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  <Kpi rotulo="Amostras recebidas" valor={geral.data.amostrasRecebidas} icone={Inbox} cor="azul" />
                  <Kpi rotulo="Amostras admitidas" valor={geral.data.amostrasAdmitidas} icone={UserCheck} cor="azul" />
                  <Kpi rotulo="Laudos liberados" valor={geral.data.laudosLiberados} icone={FileCheck2} cor="azul" />
                  <Kpi rotulo="TAT médio" valor={formatarTat(geral.data.tatMedioDias)} icone={Clock} cor="azul" />
                  <Kpi rotulo="Fora do prazo" valor={geral.data.laudosForaDoPrazo} icone={ShieldAlert} cor="azul" />
                  <Kpi rotulo="Laudos retificados" valor={geral.data.laudosRetificados} icone={RefreshCw} cor="azul" />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Laudos liberados por médico (patologista)
                    </h3>
                    <BarChartHorizontal
                      tema={tema}
                      cor={CORES_SECAO.azul.grafico}
                      dados={geral.data.laudosLiberadosPorMedico.map((p) => ({ rotulo: p.medicoNome, valor: p.total }))}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-blue-500" aria-hidden />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Não conformidades por setor
                      </h3>
                    </div>
                    <TopLista
                      tema={tema}
                      cor={CORES_SECAO.azul.grafico}
                      itens={geral.data.naoConformidadesPorSetor.map((s) => ({
                        id: s.setorId,
                        rotulo: s.setorNome,
                        valor: String(s.total),
                      }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" aria-hidden />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Laudos retificados</h3>
                  </div>
                  <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
                    O motivo da retificação não vem do LIS — clique numa linha para curar manualmente.
                  </p>
                  {retificados.isLoading && <Skeleton className="h-32 w-full" />}
                  {retificados.isError && (
                    <ErrorState titulo="Não foi possível carregar os laudos retificados" aoTentarNovamente={() => retificados.refetch()} />
                  )}
                  {retificados.data && (
                    <TabelaRetificacoes itens={retificados.data} onClickLinha={setItemSelecionado} />
                  )}
                </div>
              </div>
            )}
          </SecaoIndicador>

          <SecaoBiologiaMolecular filtro={filtro} periodoCompleto={periodoCompleto} tema={tema} />

          <SecaoPatologiaAp filtro={filtro} periodoCompleto={periodoCompleto} />

          <SecaoHistologiaCitologia filtro={filtro} periodoCompleto={periodoCompleto} />

          {SECOES_EXTRA.map((s) => (
            <SecaoExtra key={s.secao} {...s} filtro={filtro} periodoCompleto={periodoCompleto} />
          ))}
        </div>
      )}

      {itemSelecionado && (
        <CuradoriaRetificacaoDrawer
          id={itemSelecionado.id}
          nomPacienteConhecido={itemSelecionado.nomPaciente}
          canManage={canManage}
          onFechar={() => setItemSelecionado(null)}
        />
      )}
    </div>
  );
}
