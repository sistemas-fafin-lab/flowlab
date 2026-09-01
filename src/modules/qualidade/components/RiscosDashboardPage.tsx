// Painel da aba Riscos — cards, filtros, gráficos e alertas calculados na
// leitura (.scratch/qualidade-riscos-indicadores/issues/04-riscos-dashboard-mapa-alertas.md).

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardList, Link2, ListChecks, Map as MapIcon, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NivelClassificacaoRisco, RiscoFiltro, TratamentoRisco } from '../types';
import { anoAtual } from '../anoAtual.js';
import { buscarIndicadoresRiscos, buscarResponsaveisPlanoAcao, buscarSetoresRisco } from '../riscos.js';
import { usePeriodoCompartilhado } from '../providers/PeriodoProvider.js';
import { useTheme } from '../../../hooks/useTheme';
import { BarChartHorizontal } from './ui/charts/BarChartHorizontal.js';
import { DonutChart } from './ui/charts/DonutChart.js';
import { ComboboxBusca } from './ui/ComboboxBusca.js';
import { ErrorState } from './ui/ErrorState.js';
import { SeletorPeriodoPorMes } from './ui/SeletorPeriodoPorMes.js';
import { Skeleton } from './ui/Skeleton.js';
import { ROTULO_NIVEL, ROTULO_TRATAMENTO, campoInput } from './riscos/rotulos.js';

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
  icone: typeof AlertTriangle;
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

function LinkModulo({ to, titulo, descricao, icone: Icone }: { to: string; titulo: string; descricao: string; icone: typeof AlertTriangle }) {
  return (
    <Link
      to={to}
      className="glass-surface flex items-center justify-between gap-3 rounded-2xl p-4 transition-colors hover:bg-white/90 dark:hover:bg-white/10"
    >
      <div className="flex items-center gap-3">
        <Icone className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{descricao}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" aria-hidden />
    </Link>
  );
}

const NIVEIS = Object.keys(ROTULO_NIVEL) as NivelClassificacaoRisco[];
const TRATAMENTOS = Object.keys(ROTULO_TRATAMENTO) as TratamentoRisco[];

export function RiscosDashboard() {
  const { theme: tema } = useTheme();
  const { periodo, definirPeriodo } = usePeriodoCompartilhado();

  const [setorId, setSetorId] = useState('');
  const [processo, setProcesso] = useState('');
  const [processoDebounced, setProcessoDebounced] = useState('');
  const [nivel, setNivel] = useState<NivelClassificacaoRisco | ''>('');
  const [tratamento, setTratamento] = useState<TratamentoRisco | ''>('');
  const [responsavelId, setResponsavelId] = useState('');

  // Debounce: cada tecla dispararia um novo cálculo de indicadores/alertas.
  useEffect(() => {
    const timer = setTimeout(() => setProcessoDebounced(processo.trim()), 350);
    return () => clearTimeout(timer);
  }, [processo]);

  const { data: setores } = useQuery({ queryKey: ['riscos-setores'], queryFn: buscarSetoresRisco });
  const { data: responsaveis } = useQuery({ queryKey: ['riscos-responsaveis'], queryFn: buscarResponsaveisPlanoAcao });

  const filtro = useMemo<RiscoFiltro>(
    () => ({
      setorId: setorId || undefined,
      processo: processoDebounced || undefined,
      nivel: nivel || undefined,
      tratamento: tratamento || undefined,
      responsavelId: responsavelId || undefined,
      inicio: periodo.inicio || undefined,
      fim: periodo.fim || undefined,
    }),
    [setorId, processoDebounced, nivel, tratamento, responsavelId, periodo],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['painel-riscos', filtro],
    queryFn: () => buscarIndicadoresRiscos(filtro),
  });

  const porNivelMapa = new Map((data?.porNivel ?? []).map((n) => [n.nivel, n.total]));

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Riscos</h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Gestão de riscos: matriz, plano de ação, reavaliação e planos de contingência.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LinkModulo to="/qualidade/riscos/matriz" titulo="Matriz de Riscos" descricao="Cadastrar e gerenciar riscos por setor/processo." icone={ShieldAlert} />
        <LinkModulo to="/qualidade/riscos/mapa" titulo="Mapa por Setor" descricao="Visão tabular por setor, voltada para auditoria." icone={MapIcon} />
        <LinkModulo to="/qualidade/riscos/contingencias" titulo="Planos de Contingência" descricao="O que fazer quando um risco vira realidade." icone={ShieldCheck} />
        <LinkModulo to="/qualidade/riscos/correlacao" titulo="Correlação" descricao="Riscos vinculados a ocorrências, com busca." icone={Link2} />
      </div>

      <SeletorPeriodoPorMes inicio={periodo.inicio} fim={periodo.fim} anoPadrao={anoAtual()} onMudar={definirPeriodo} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Setor
          <ComboboxBusca itens={setores} valor={setorId} onMudar={setSetorId} placeholder="Todos os setores" className="w-52" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Processo
          <input
            className={`${campoInput} w-44`}
            value={processo}
            onChange={(e) => setProcesso(e.target.value)}
            placeholder="Todos"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Classificação
          <select className={`${campoInput} w-40`} value={nivel} onChange={(e) => setNivel(e.target.value as NivelClassificacaoRisco | '')}>
            <option value="">Todas</option>
            {NIVEIS.map((n) => (
              <option key={n} value={n}>
                {ROTULO_NIVEL[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Status
          <select className={`${campoInput} w-44`} value={tratamento} onChange={(e) => setTratamento(e.target.value as TratamentoRisco | '')}>
            <option value="">Todos</option>
            {TRATAMENTOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TRATAMENTO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
          Responsável
          <ComboboxBusca itens={responsaveis} valor={responsavelId} onMudar={setResponsavelId} placeholder="Todos" className="w-52" />
        </label>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {isError && <ErrorState titulo="Não foi possível carregar o painel de riscos" aoTentarNovamente={() => refetch()} />}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            <Kpi rotulo="Total de riscos" valor={data.totalRiscos} icone={ListChecks} cor="azul" />
            <Kpi rotulo="Baixo" valor={porNivelMapa.get('baixo') ?? 0} icone={ShieldCheck} cor="verde" />
            <Kpi rotulo="Médio" valor={porNivelMapa.get('medio') ?? 0} icone={ShieldCheck} cor="laranja" />
            <Kpi rotulo="Alto" valor={porNivelMapa.get('alto') ?? 0} icone={AlertTriangle} cor="laranja" />
            <Kpi rotulo="Crítico" valor={porNivelMapa.get('critico') ?? 0} icone={AlertTriangle} cor="vermelho" />
            <Kpi rotulo="Plano pendente" valor={data.planosAcaoPendentes} icone={ClipboardList} cor="roxo" />
            <Kpi rotulo="Ação vencida" valor={data.planosAcaoVencidos} icone={CalendarClock} cor="vermelho" />
            <Kpi rotulo="Aguardando reavaliação" valor={data.aguardandoReavaliacao} icone={ClipboardList} cor="laranja" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="glass-surface rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Riscos por setor</h3>
              {data.porSetor.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum risco no filtro atual.</p>
              ) : (
                <BarChartHorizontal tema={tema} dados={data.porSetor.map((s) => ({ rotulo: s.setorNome, valor: s.total }))} />
              )}
            </section>
            <section className="glass-surface rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Distribuição por classificação</h3>
              {data.porNivel.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum risco classificado no filtro atual.</p>
              ) : (
                <DonutChart tema={tema} dados={data.porNivel.map((n) => ({ rotulo: ROTULO_NIVEL[n.nivel], valor: n.total }))} />
              )}
            </section>
          </div>

          <section className="glass-surface rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Alertas</h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {data.contingenciasAtivas} plano(s) de contingência ativo(s)
              </span>
            </div>
            {data.alertas.length === 0 && <p className="text-sm text-gray-500 dark:text-slate-400">Nenhum alerta no momento.</p>}
            <ul className="space-y-2">
              {data.alertas.map((a, indice) => (
                <li
                  key={`${a.tipo}-${a.riscoId ?? ''}-${a.planoAcaoId ?? ''}-${a.planoContingenciaId ?? ''}-${indice}`}
                  className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {a.mensagem}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
