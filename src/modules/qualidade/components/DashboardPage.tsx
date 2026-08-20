import { useQuery } from '@tanstack/react-query';
import type { AutorizadorAcompanhado } from '../types';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  Gift,
  ListChecks,
  ScanLine,
  Tags,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChartHorizontal } from './ui/charts/BarChartHorizontal.js';
import { DonutChart } from './ui/charts/DonutChart.js';
import { LineChartMultiSerie, type SerieLinha } from './ui/charts/LineChartMultiSerie.js';
import { TopLista } from './ui/charts/TopLista.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import { anoAtual } from '../anoAtual.js';
import { buscarFunilCancer } from '../cancer.js';
import { buscarIndicadoresCortesias } from '../cortesias.js';
import { buscarIndicadoresIhq } from '../ihq.js';
import { buscarIndicadoresOcorrencias } from '../ocorrencias.js';
import { intervaloUltimosMeses } from '../periodoHistorico.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';
import { useTheme } from '../../../hooks/useTheme';

/**
 * Cor fixa por pessoa (identidade, nunca ranking) — validada com
 * `scripts/validate_palette.js` da skill dataviz para os 5 slots juntos
 * (4 acompanhados + "Outros"), em claro e escuro separadamente (não é um
 * flip automático). Luis Felipe passou a verde e "Outros" herdou o vermelho
 * que era dele — pedido explícito do usuário (2026-08-18).
 */
const CORES_AUTORIZADOR: Record<AutorizadorAcompanhado, { light: string; dark: string }> = {
  'Eduarda Fabri': { light: '#e87ba4', dark: '#e0589f' },
  'Mario Gorini': { light: '#2a78d6', dark: '#3987e5' },
  'Cristiane Madeiro': { light: '#4a3aa7', dark: '#8a3fd8' },
  'Luis Felipe': { light: '#008300', dark: '#008300' },
};
const COR_OUTROS_AUTORIZADORES = { light: '#e34948', dark: '#e66767' };
const ROTULO_OUTROS_AUTORIZADORES = 'Outros';

const ORDEM_AUTORIZADORES: AutorizadorAcompanhado[] = ['Eduarda Fabri', 'Mario Gorini', 'Cristiane Madeiro', 'Luis Felipe'];

const MESES_HISTORICO_AUTORIZADOR = 5;

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CORES_BADGE: Record<'azul' | 'laranja' | 'verde' | 'roxo' | 'vermelho', { badge: string; brilho: string; valor: string }> = {
  azul: { badge: 'bg-gradient-to-br from-blue-400 to-blue-600', brilho: 'shadow-blue-500/30', valor: 'text-blue-600 dark:text-blue-400' },
  laranja: { badge: 'bg-gradient-to-br from-orange-400 to-orange-600', brilho: 'shadow-orange-500/30', valor: 'text-orange-600 dark:text-orange-400' },
  verde: { badge: 'bg-gradient-to-br from-emerald-400 to-emerald-600', brilho: 'shadow-emerald-500/30', valor: 'text-emerald-600 dark:text-emerald-400' },
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
  icone: LucideIcon;
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

function SecaoPainel({
  titulo,
  descricao,
  link,
  carregando,
  erro,
  children,
}: {
  titulo: string;
  descricao: string;
  link: string;
  carregando: boolean;
  erro: boolean;
  children: ReactNode;
}) {
  return (
    <section className="glass-surface rounded-2xl p-5" aria-label={titulo}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{titulo}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{descricao}</p>
        </div>
        <Link
          to={link}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Abrir módulo
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {carregando && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {!carregando && erro && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Não foi possível carregar os indicadores deste módulo.</p>
      )}
      {!carregando && !erro && children}
    </section>
  );
}

export function QualidadeDashboardPage() {
  const { theme: tema } = useTheme();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();
  const { inicio, fim } = periodo;
  const periodoCompleto = Boolean(inicio && fim);

  const ocorrencias = useQuery({
    queryKey: ['painel-ocorrencias', periodo],
    queryFn: () => buscarIndicadoresOcorrencias({ inicio, fim }),
    enabled: periodoCompleto,
  });

  const cortesias = useQuery({
    queryKey: ['painel-cortesias', periodo],
    queryFn: () => buscarIndicadoresCortesias({ inicio, fim }),
    enabled: periodoCompleto,
  });

  // Linha histórica "por autorizador" é sempre janela fixa até hoje — independente
  // do mês selecionado no seletor compartilhado, para mostrar a tendência (P4: o
  // intervalo em si continua um parâmetro explícito, só o ponto de partida usa o
  // relógio, como já faz `anoAtual()`).
  const periodoHistoricoAutorizador = intervaloUltimosMeses(MESES_HISTORICO_AUTORIZADOR);
  const cortesiasHistorico = useQuery({
    queryKey: ['painel-cortesias-historico-autorizador', periodoHistoricoAutorizador],
    queryFn: () => buscarIndicadoresCortesias(periodoHistoricoAutorizador),
  });

  const ihq = useQuery({
    queryKey: ['painel-ihq', periodo],
    queryFn: () => buscarIndicadoresIhq({ inicio, fim, dataReferencia: fim }),
    enabled: periodoCompleto,
  });

  const cancer = useQuery({
    queryKey: ['painel-cancer', periodo],
    queryFn: () => buscarFunilCancer({ inicio, fim }),
    enabled: periodoCompleto,
  });

  const totalOcorrenciasConcluidas = (ocorrencias.data?.serieMensal ?? []).reduce((soma, m) => soma + m.total, 0);

  const seriesAutorizador: SerieLinha[] = [
    ...ORDEM_AUTORIZADORES.map((nome) => ({
      id: nome,
      nome,
      cor: CORES_AUTORIZADOR[nome],
      pontos: (cortesiasHistorico.data?.porAutorizadorMensal ?? [])
        .filter((p) => p.autorizador === nome)
        .map((p) => ({ x: p.mes, y: p.total })),
    })),
    {
      id: ROTULO_OUTROS_AUTORIZADORES,
      nome: ROTULO_OUTROS_AUTORIZADORES,
      cor: COR_OUTROS_AUTORIZADORES,
      pontos: (cortesiasHistorico.data?.outrosAutorizadoresMensal ?? []).map((p) => ({ x: p.mes, y: p.total })),
    },
  ].filter((s) => s.pontos.length > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Painel</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Visão geral dos módulos no período selecionado — cada seção abaixo é um módulo.
        </p>
      </div>

      <SeletorPeriodoPorMes inicio={inicio} fim={fim} anoPadrao={anoAtual()} onMudar={definirPeriodo} />

      {!periodoCompleto && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Selecione o período para carregar o painel.</p>
      )}

      {periodoCompleto && (
        <div className="space-y-6">
          <SecaoPainel
            titulo="Ocorrências"
            descricao="Não conformidades sincronizadas do LIS."
            link="/qualidade/ocorrencias"
            carregando={ocorrencias.isLoading}
            erro={ocorrencias.isError}
          >
            {ocorrencias.data && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Kpi rotulo="Concluídas no período" valor={totalOcorrenciasConcluidas} icone={CheckCircle2} cor="verde" />
                  <Kpi rotulo="A classificar" valor={ocorrencias.data.aClassificar} icone={ListChecks} cor="laranja" />
                  <Kpi rotulo="Motivos distintos" valor={ocorrencias.data.porMotivo.length} icone={Tags} cor="roxo" />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Por motivo
                  </h3>
                  <DonutChart
                    tema={tema}
                    dados={ocorrencias.data.porMotivo.map((m) => ({ rotulo: m.motivoNome, valor: m.total }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Colaboradores com mais ocorrências
                    </h3>
                    <BarChartHorizontal
                      tema={tema}
                      dados={ocorrencias.data.porColaborador
                        .slice(0, 8)
                        .map((c) => ({ rotulo: c.colaboradorNome, valor: c.total }))}
                    />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Top 10 colaboradores
                    </h3>
                    <TopLista
                      tema={tema}
                      itens={ocorrencias.data.porColaborador.slice(0, 10).map((c) => ({
                        id: c.colaboradorId,
                        rotulo: c.colaboradorNome,
                        valor: String(c.total),
                      }))}
                    />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Top 5 setores
                    </h3>
                    <TopLista
                      tema={tema}
                      itens={ocorrencias.data.porSetor.slice(0, 5).map((s) => ({
                        id: s.setorId,
                        rotulo: s.setorNome,
                        valor: String(s.total),
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </SecaoPainel>

          <SecaoPainel
            titulo="Cortesias"
            descricao="Exames concedidos sem cobrança."
            link="/qualidade/cortesias"
            carregando={cortesias.isLoading}
            erro={cortesias.isError}
          >
            {cortesias.data && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <Kpi rotulo="Total de cortesias" valor={cortesias.data.totalCortesias} icone={Gift} cor="azul" />
                  <Kpi rotulo="Valor total concedido" valor={formatarMoeda(cortesias.data.totalConcedido)} icone={Wallet} cor="laranja" />
                  <Kpi rotulo="Fora do prazo" valor={cortesias.data.aprovadasForaDoPrazo} icone={AlertTriangle} cor="vermelho" />
                  {cortesias.data.porClassificacao.slice(0, 2).map((c, indice) => (
                    <Kpi
                      key={c.classificacaoId ?? 'sem-classificacao'}
                      rotulo={c.classificacaoNome ?? 'Sem classificação'}
                      valor={`${c.total} (${((c.total / Math.max(1, cortesias.data.totalCortesias)) * 100).toFixed(1)}%)`}
                      icone={Tags}
                      cor={indice === 0 ? 'roxo' : 'verde'}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                  <div className="lg:col-span-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Cortesias por autorizador — últimos {MESES_HISTORICO_AUTORIZADOR} meses
                    </h3>
                    {cortesiasHistorico.isLoading && <Skeleton className="h-40 w-full" />}
                    {!cortesiasHistorico.isLoading && cortesiasHistorico.isError && (
                      <p className="text-sm text-gray-500 dark:text-slate-400">Não foi possível carregar o histórico por autorizador.</p>
                    )}
                    {!cortesiasHistorico.isLoading && !cortesiasHistorico.isError && seriesAutorizador.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Nenhuma cortesia autorizada por Eduarda Fabri, Mario Gorini, Cristiane Madeiro ou Luis Felipe
                        nos últimos {MESES_HISTORICO_AUTORIZADOR} meses.
                      </p>
                    )}
                    {!cortesiasHistorico.isLoading && !cortesiasHistorico.isError && seriesAutorizador.length > 0 && (
                      <LineChartMultiSerie tema={tema} series={seriesAutorizador} />
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Top 5 clínicas por cortesias
                    </h3>
                    <TopLista
                      tema={tema}
                      cor={{ light: '#2a78d6', dark: '#3987e5' }}
                      itens={cortesias.data.porClinica.slice(0, 5).map((c) => ({
                        id: String(c.clinicaIdLis),
                        rotulo: c.clinicaNome ?? `Clínica ${c.clinicaIdLis}`,
                        valor: String(c.total),
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </SecaoPainel>

          <SecaoPainel
            titulo="IHQ"
            descricao="Exames imunohistoquímicos e vínculo com a biópsia original."
            link="/qualidade/ihq"
            carregando={ihq.isLoading}
            erro={ihq.isError}
          >
            {ihq.data && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Kpi rotulo="Em aberto" valor={ihq.data.emAberto} icone={Clock} cor="azul" />
                <Kpi rotulo="Atrasados" valor={ihq.data.atrasados} icone={AlertTriangle} cor="vermelho" />
                <Kpi rotulo="Blocos retornados" valor={ihq.data.retornados} icone={FlaskConical} cor="verde" />
              </div>
            )}
          </SecaoPainel>

          <SecaoPainel
            titulo="Registro de Câncer"
            descricao="Funil de triagem dos casos positivos do laudo definitivo."
            link="/qualidade/cancer"
            carregando={cancer.isLoading}
            erro={cancer.isError}
          >
            {cancer.data && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Kpi rotulo="Universo" valor={cancer.data.universo} icone={ScanLine} cor="azul" />
                <Kpi rotulo="Triados" valor={cancer.data.triados} icone={ListChecks} cor="laranja" />
                <Kpi rotulo="Confirmados" valor={cancer.data.confirmados} icone={CheckCircle2} cor="vermelho" />
                <Kpi rotulo="Classificados" valor={cancer.data.classificados} icone={Tags} cor="roxo" />
                <Kpi rotulo="Exportados" valor={cancer.data.exportados} icone={FlaskConical} cor="verde" />
              </div>
            )}
          </SecaoPainel>
        </div>
      )}
    </div>
  );
}
