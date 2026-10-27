import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Inbox, Layers, Loader2, Timer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../hooks/useTheme';
import {
  distribuicaoPorTipo,
  formatarDuracao,
  resumirChamados,
  serieAbertosResolvidos,
  type ChamadoMetrica,
  type PeriodoDias,
} from '../../utils/itDashboard';

// Painel no topo das Solicitações de TI, no visual do Hub de Aplicações
// (ITHubDashboard): cartões de vidro com brilho, número grande e gráfico.
// Os números vêm da lista já carregada pela tela (ver utils/itDashboard).
// Barras e não área: com poucos chamados por dia (0, 1, 2), a curva suavizada
// desenha ondas que sugerem uma tendência que não existe.

const PERIODOS: { value: PeriodoDias; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

// Validadas com o dataviz (claro e escuro): violeta = abertos, esmeralda = resolvidos,
// as mesmas cores dos badges da lista.
const COR_ABERTOS = '#8b5cf6';
const COR_RESOLVIDOS = '#059669';

const CARD = 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 rounded-3xl';

export interface TipoVisual {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

interface ITRequestsDashboardProps {
  chamados: ChamadoMetrica[];
  isITManager: boolean;
  canViewSla: boolean;
  tipos: Record<string, TipoVisual>;
  filtroStatus: string;
  onFiltrarStatus: (status: string) => void;
}

interface Cartao {
  chave: string;
  label: string;
  valor: string;
  legenda: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  gradiente: string;
  sombra: string;
  anel: string;
  brilho: string;
  /** status que o clique aplica no filtro da lista */
  filtro?: string;
}

const ITRequestsDashboard: React.FC<ITRequestsDashboardProps> = ({
  chamados,
  isITManager,
  canViewSla,
  tipos,
  filtroStatus,
  onFiltrarStatus,
}) => {
  const { isDark } = useTheme();
  const [periodo, setPeriodo] = useState<PeriodoDias>(30);

  const resumo = useMemo(() => resumirChamados(chamados, periodo), [chamados, periodo]);
  const serie = useMemo(() => serieAbertosResolvidos(chamados, periodo), [chamados, periodo]);
  const porTipo = useMemo(() => distribuicaoPorTipo(chamados, periodo), [chamados, periodo]);
  const totalAbertos = serie.reduce((s, p) => s + p.abertos, 0);
  const totalResolvidos = serie.reduce((s, p) => s + p.resolvidos, 0);
  const maiorTipo = porTipo[0]?.total ?? 0;

  const cartoes: Cartao[] = [
    {
      chave: 'fila',
      label: 'Na fila',
      valor: resumo.naFila.toLocaleString('pt-BR'),
      legenda:
        canViewSla && resumo.inicioAtrasado > 0 ? (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {resumo.inicioAtrasado} com início atrasado
          </span>
        ) : (
          'aguardando atendimento'
        ),
      icon: Inbox,
      gradiente: 'bg-gradient-to-br from-orange-500 to-amber-600',
      sombra: 'shadow-orange-500/30',
      anel: 'ring-orange-500/20',
      brilho: 'bg-orange-500',
      filtro: 'pending',
    },
    {
      chave: 'andamento',
      label: 'Em andamento',
      valor: resumo.emAndamento.toLocaleString('pt-BR'),
      legenda: 'sendo atendidos agora',
      icon: Loader2,
      gradiente: 'bg-gradient-to-br from-blue-500 to-blue-600',
      sombra: 'shadow-blue-500/30',
      anel: 'ring-blue-500/20',
      brilho: 'bg-blue-500',
      filtro: 'in_progress',
    },
    {
      chave: 'resolvidos',
      label: 'Resolvidos',
      valor: resumo.resolvidosNoPeriodo.toLocaleString('pt-BR'),
      legenda: `nos últimos ${periodo} dias`,
      icon: CheckCircle2,
      gradiente: 'bg-gradient-to-br from-emerald-500 to-green-600',
      sombra: 'shadow-emerald-500/30',
      anel: 'ring-emerald-500/20',
      brilho: 'bg-emerald-500',
      filtro: 'resolved',
    },
    {
      chave: 'tempo',
      label: 'Tempo médio',
      valor: resumo.tempoMedioResolucaoMs == null ? '—' : formatarDuracao(resumo.tempoMedioResolucaoMs),
      legenda: 'da abertura à resolução',
      icon: Timer,
      gradiente: 'bg-gradient-to-br from-purple-500 to-violet-600',
      sombra: 'shadow-purple-500/30',
      anel: 'ring-purple-500/20',
      brilho: 'bg-purple-500',
    },
  ];

  // Tokens do gráfico (os mesmos do Hub de Aplicações)
  const fonte = 'Inter, system-ui, -apple-system, sans-serif';
  const eixo = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b', fontFamily: fonte };
  const grade = isDark ? 'rgba(51,65,85,0.5)' : 'rgba(226,232,240,0.9)';

  return (
    <section aria-labelledby="painel-chamados-titulo" className="space-y-5 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
      {/* ── Cabeçalho do painel + período ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur-lg opacity-40" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/25">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h3 id="painel-chamados-titulo" className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Visão geral
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isITManager ? 'Todos os chamados de TI' : 'Os chamados que você abriu'}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Período do painel"
          className="self-start sm:self-auto flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-1 shadow-inner border border-white/20 dark:border-slate-700/30"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              aria-pressed={periodo === p.value}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                periodo === p.value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cartões ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cartoes.map((c, i) => {
          const Icone = c.icon;
          const ativo = !!c.filtro && filtroStatus === c.filtro;
          const conteudo = (
            <>
              <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${c.brilho}`} />
              <div className={`relative w-10 h-10 ${c.gradiente} rounded-xl flex items-center justify-center shadow-lg ${c.sombra} ring-4 ${c.anel} mb-4`}>
                <Icone className="w-5 h-5 text-white" />
              </div>
              <div className="relative text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none mb-2">
                {c.valor}
              </div>
              <p className="relative text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{c.label}</p>
              <p className="relative text-xs text-slate-400 dark:text-slate-500 mt-1">{c.legenda}</p>
            </>
          );
          const classe = `relative overflow-hidden text-left ${CARD} p-5 transition-all duration-300 animate-fade-in-up ${
            ativo ? 'ring-2 ring-violet-500/60 shadow-xl shadow-violet-500/10' : ''
          }`;
          return c.filtro ? (
            <button
              key={c.chave}
              type="button"
              onClick={() => onFiltrarStatus(ativo ? 'all' : c.filtro!)}
              aria-pressed={ativo}
              title={ativo ? 'Mostrar todos na lista' : `Filtrar a lista: ${c.label.toLowerCase()}`}
              className={`${classe} hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              {conteudo}
            </button>
          ) : (
            <div key={c.chave} className={classe} style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
              {conteudo}
            </div>
          );
        })}
      </div>

      {/* ── Gráficos ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${CARD} p-6 shadow-sm hover:shadow-2xl transition-shadow duration-300`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl shadow-lg shadow-blue-500/25">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Abertos × resolvidos</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {periodo === 90 ? 'Por semana' : 'Por dia'}, nos últimos {periodo} dias
                </p>
              </div>
            </div>
            {/* Legenda com os totais: a identidade não depende só da cor */}
            <div className="flex items-center gap-4 text-xs">
              {[
                { nome: 'Abertos', cor: COR_ABERTOS, total: totalAbertos },
                { nome: 'Resolvidos', cor: COR_RESOLVIDOS, total: totalResolvidos },
              ].map((s) => (
                <span key={s.nome} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.cor }} />
                  {s.nome}
                  <strong className="font-semibold text-slate-900 dark:text-white">{s.total}</strong>
                </span>
              ))}
            </div>
          </div>

          {totalAbertos + totalResolvidos === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px] sm:h-[330px] text-slate-400 dark:text-slate-500 gap-3">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700/50 rounded-3xl flex items-center justify-center">
                <Activity className="w-7 h-7" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Nenhum chamado no período</span>
            </div>
          ) : (
            <>
              {/* 30 barras duplas não cabem no celular: o gráfico rola dentro do card */}
              <div className="overflow-x-auto [scrollbar-width:thin]">
              <div className={`h-[260px] sm:h-[330px] ${periodo === 30 ? 'min-w-[560px]' : ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke={grade} vertical={false} />
                  <XAxis
                    dataKey="rotulo"
                    tick={eixo}
                    axisLine={{ stroke: grade }}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis tick={eixo} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.14)' }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          style={{
                            background: isDark ? '#0f172a' : '#ffffff',
                            border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                            borderRadius: 12,
                            padding: '10px 14px',
                            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.1)',
                            fontFamily: fonte,
                            fontSize: 12,
                            color: isDark ? '#f1f5f9' : '#1e293b',
                          }}
                        >
                          <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600, marginBottom: 6 }}>
                            {periodo === 90 ? `Semana de ${label}` : label}
                          </p>
                          {payload.map((entry) => (
                            <p key={String(entry.dataKey)} style={{ margin: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 999, background: entry.color }} />
                              {entry.name}: <strong>{entry.value}</strong>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="abertos" name="Abertos" fill={COR_ABERTOS} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="resolvidos" name="Resolvidos" fill={COR_RESOLVIDOS} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
              </div>
              </div>
              {/* Mesmos números em tabela, para leitor de tela */}
              <table className="sr-only">
                <caption>Chamados abertos e resolvidos nos últimos {periodo} dias</caption>
                <thead>
                  <tr>
                    <th scope="col">{periodo === 90 ? 'Semana de' : 'Dia'}</th>
                    <th scope="col">Abertos</th>
                    <th scope="col">Resolvidos</th>
                  </tr>
                </thead>
                <tbody>
                  {serie.map((p) => (
                    <tr key={p.rotulo}>
                      <th scope="row">{p.rotulo}</th>
                      <td>{p.abertos}</td>
                      <td>{p.resolvidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className={`${CARD} p-6 shadow-sm hover:shadow-2xl transition-shadow duration-300`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Por tipo</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">Abertos nos últimos {periodo} dias</p>
            </div>
          </div>

          {porTipo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 gap-2">
              <Layers className="w-8 h-8 opacity-40" />
              <span className="text-sm font-medium">Nenhum chamado no período</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {porTipo.map((f) => {
                const visual = tipos[f.tipo];
                const Icone = visual?.icon ?? Layers;
                return (
                  <li key={f.tipo} className="px-3.5 py-3 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl ${visual?.bg ?? 'bg-slate-100 dark:bg-slate-800'} flex items-center justify-center flex-shrink-0`}>
                        <Icone className={`w-4 h-4 ${visual?.color ?? 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {visual?.label ?? f.tipo}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{f.total}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${maiorTipo ? (f.total / maiorTipo) * 100 : 0}%`, backgroundColor: COR_ABERTOS }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          {f.emAberto === 0 ? 'todos encerrados' : `${f.emAberto} em aberto`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default ITRequestsDashboard;
