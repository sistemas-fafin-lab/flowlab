import React, { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  FileWarning,
  PieChart as PieChartIcon,
  Scissors,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { useDashboardGlosas } from '../hooks/useGlosasRecursos';
import type { CardDashboardGlosas, ItemRankingGlosa, RecorteGlosas, StatusGlosaDashboard } from '../types';
import { formatCompetencia, formatCurrency, formatPercentual, plural } from '../utils/formato';
import { STATUS_GLOSA_DASHBOARD } from '../utils/recursoGlosaVisual';

// Glosas e Recursos → aba Dashboard: cards por status (com a variação sobre o
// mês de faturamento anterior), evolução de 6 meses, distribuição por status,
// procedimentos, convênios e motivos. Os números vêm prontos do servidor
// (api/_lib/faturamento/recursoGlosa.ts → resumirDashboard).
//
// Gráficos no padrão do Dashboard de Contas a Receber (recharts, eixos e
// tooltip pelo tema); a rosca com o total no centro é a do Dashboard principal.

const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';

/** Cor de cada status, na mesma família dos selos da lista (STATUS_GLOSA_DASHBOARD). */
const COR_STATUS: Record<StatusGlosaDashboard, string> = {
  aberta: '#f97316', // orange-500
  'em-recurso': '#3b82f6', // blue-500
  revertida: '#059669', // emerald-600
  definitiva: '#f43f5e', // rose-500
};
const COR_RANKING = '#6366f1'; // indigo-500
// Motivos: categórica; "Outros" em cinza neutro, fora da paleta.
const CORES_MOTIVOS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899'];
const COR_OUTROS = '#94a3b8'; // slate-400

const TITULO_CARD: Record<StatusGlosaDashboard, string> = {
  aberta: 'Glosas Abertas',
  'em-recurso': 'Em Recurso',
  revertida: 'Revertidas',
  definitiva: 'Definitivas',
};

/** Rótulo do eixo dos rankings; o nome inteiro fica no tooltip. */
const MAX_ROTULO = 20;

function rotuloGlosas(quantidade: number): string {
  return plural(quantidade, 'glosa', 'glosas');
}

// Eixo em milhares: valores de faturamento estouram a largura do eixo em reais.
const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor);

const encurtar = (nome: string): string => (nome.length > MAX_ROTULO ? `${nome.slice(0, MAX_ROTULO - 1)}…` : nome);

interface CardStatusProps {
  status: StatusGlosaDashboard;
  card: CardDashboardGlosas;
  icone: React.ReactNode;
  corIcone: string;
  /** Revertidas: subir é bom. Nas outras, subir é glosa a mais. */
  subirEhBom?: boolean;
}

const Variacao: React.FC<{ variacao: number | null; subirEhBom: boolean }> = ({ variacao, subirEhBom }) => {
  if (variacao === null) return <>Sem valor no mês anterior</>;
  if (variacao === 0) return <>Igual ao mês anterior</>;
  const sobe = variacao > 0;
  const bom = sobe === subirEhBom;
  const Seta = sobe ? TrendingUp : TrendingDown;
  return (
    <>
      <Seta className={`inline h-4 w-4 mr-1 align-[-3px] ${bom ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
      <span className={`font-medium ${bom ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
        {sobe ? '+' : ''}{formatPercentual(variacao)}
      </span>{' '}
      em relação ao mês anterior
    </>
  );
};

const CardStatus: React.FC<CardStatusProps> = ({ status, card, icone, corIcone, subirEhBom = false }) => (
  <div className={CARD}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{TITULO_CARD[status]}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(card.valor)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{rotuloGlosas(card.quantidade)}</p>
      </div>
      <div className={`p-3 rounded-lg ${corIcone}`}>{icone}</div>
    </div>
    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
      <Variacao variacao={card.variacao} subirEhBom={subirEhBom} />
    </div>
  </div>
);

const Painel: React.FC<{ titulo: string; sub?: string; acao?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  titulo,
  sub,
  acao,
  className = '',
  children,
}) => (
  <div className={`${CARD} flex flex-col ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{titulo}</h3>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {acao}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const Vazio: React.FC<{ icon: React.ReactNode; texto: string }> = ({ icon, texto }) => (
  <div className="h-full min-h-[12rem] flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-2">{icon}</div>
    <p className="text-sm">{texto}</p>
  </div>
);

type OrdemProcedimentos = 'valor' | 'ocorrencias';

interface Props {
  recorte: RecorteGlosas;
  /** Muda a cada sincronização ou edição concluída: recarrega o dashboard. */
  versao: number;
}

const GlosasDashboard: React.FC<Props> = ({ recorte, versao }) => {
  const { isDark } = useTheme();
  const { dashboard, loading, error, refetch } = useDashboardGlosas(recorte);
  const [ordem, setOrdem] = useState<OrdemProcedimentos>('valor');

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  // Faixa do hover nas barras: a padrão do recharts (#ccc) acende no tema escuro.
  const cursorBarra = { fill: isDark ? 'rgba(51,65,85,0.35)' : 'rgba(226,232,240,0.6)' };
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 12,
    fontSize: 12,
  };
  const tooltipItem: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155' };
  const tooltipLabel: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 };
  const corRotuloBarra = isDark ? '#cbd5e1' : '#475569';
  // <text> próprio: o rótulo padrão quebra a linha na largura da barra.
  const rotuloBarra = ({ x, y, width, height, value }: LabelProps) => (
    <text
      x={Number(x) + Number(width) + 6}
      y={Number(y) + Number(height) / 2}
      dy="0.35em"
      fontSize={11}
      fill={corRotuloBarra}
    >
      {value}
    </text>
  );

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-36 animate-pulse`} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${CARD} h-80 animate-pulse lg:col-span-2`} />
          <div className={`${CARD} h-80 animate-pulse`} />
        </div>
      </div>
    );
  }

  const { cards, evolucao, distribuicao, convenios, motivos } = dashboard;
  const serie = evolucao.map((m) => ({ ...m, rotulo: formatCompetencia(m.competencia) }));
  const temEvolucao = evolucao.some((m) => m.aberta > 0 || m.emRecurso > 0 || m.revertida > 0);
  const fatias = distribuicao.status.filter((s) => s.quantidade > 0);
  // Rótulo ao lado da barra: o que a barra mede e o percentual.
  const procedimentos = (ordem === 'valor' ? dashboard.procedimentos.porValor : dashboard.procedimentos.porOcorrencias)
    .map((p) => ({
      ...p,
      rotulo: `${ordem === 'valor' ? formatCurrency(p.valor) : p.quantidade.toLocaleString('pt-BR')} · ${formatPercentual(p.percentual)}`,
    }));
  const rankingConvenios = convenios.map((c) => ({ ...c, rotulo: `${formatCurrency(c.valor)} · ${formatPercentual(c.percentual)}` }));
  const corMotivo = (m: ItemRankingGlosa, i: number) => (m.nome === 'Outros' ? COR_OUTROS : CORES_MOTIVOS[i % CORES_MOTIVOS.length]);

  const tooltipRanking = (_valor: number, _nome: string, item: { payload?: ItemRankingGlosa }) => {
    const p = item.payload as ItemRankingGlosa;
    return [`${formatCurrency(p.valor)} · ${rotuloGlosas(p.quantidade)} · ${formatPercentual(p.percentual)}`, p.nome];
  };
  const alturaRanking = (linhas: number) => Math.max(linhas * 34 + 16, 192);

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardStatus
          status="aberta"
          card={cards.aberta}
          icone={<FileWarning className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
          corIcone="bg-orange-100 dark:bg-orange-900/30"
        />
        <CardStatus
          status="em-recurso"
          card={cards['em-recurso']}
          icone={<Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          corIcone="bg-blue-100 dark:bg-blue-900/30"
        />
        <CardStatus
          status="revertida"
          card={cards.revertida}
          icone={<CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />}
          corIcone="bg-green-100 dark:bg-green-900/30"
          subirEhBom
        />
        <CardStatus
          status="definitiva"
          card={cards.definitiva}
          icone={<XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />}
          corIcone="bg-red-100 dark:bg-red-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Painel
          titulo="Evolução das glosas"
          sub="Últimos 6 meses de faturamento; Revertidas pelo valor deferido"
          className="lg:col-span-2"
        >
          {temEvolucao ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="rotulo" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <Tooltip
                    cursor={cursorBarra}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    labelStyle={tooltipLabel}
                    formatter={(valor: number) => formatCurrency(valor)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="aberta" name="Abertas" fill={COR_STATUS.aberta} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="emRecurso" name="Em recurso" fill={COR_STATUS['em-recurso']} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="revertida" name="Revertidas" fill={COR_STATUS.revertida} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Vazio icon={<TrendingUp className="w-6 h-6" />} texto="Nenhuma glosa nos últimos 6 meses." />
          )}
        </Painel>

        <Painel titulo="Distribuição por status" sub="Quantidade de glosas do período">
          {distribuicao.total > 0 ? (
            <div className="space-y-3">
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fatias}
                      dataKey="quantidade"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={fatias.length > 1 ? 3 : 0}
                      stroke="none"
                    >
                      {fatias.map((s) => <Cell key={s.status} fill={COR_STATUS[s.status]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={tooltipItem}
                      formatter={(quantidade: number, status: string) => [
                        rotuloGlosas(quantidade),
                        STATUS_GLOSA_DASHBOARD[status as StatusGlosaDashboard].label,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white tabular-nums">
                    {distribuicao.total.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">glosas</span>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {distribuicao.status.map((s) => (
                  <li key={s.status} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COR_STATUS[s.status] }} />
                    <span className="text-gray-700 dark:text-gray-300 flex-1">{STATUS_GLOSA_DASHBOARD[s.status].label}</span>
                    <span className="font-medium text-gray-900 dark:text-white tabular-nums">{formatPercentual(s.percentual)}</span>
                    <span className="w-20 text-right text-gray-500 dark:text-gray-400 tabular-nums">{rotuloGlosas(s.quantidade)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Vazio icon={<PieChartIcon className="w-6 h-6" />} texto="Nenhuma glosa no período." />
          )}
        </Painel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Painel
          titulo="Principais procedimentos glosados"
          sub={ordem === 'valor'
            ? '10 maiores por valor estimado (a glosa da requisição dividida entre os procedimentos dela); percentual do total glosado'
            : '10 mais frequentes; percentual das ocorrências'}
          acao={
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-xs font-medium shrink-0">
              {([['valor', 'Maior valor'], ['ocorrencias', 'Mais ocorrências']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setOrdem(id)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    ordem === id
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {procedimentos.length > 0 ? (
            <div style={{ height: alturaRanking(procedimentos.length) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={procedimentos} layout="vertical" margin={{ top: 4, right: 140, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis
                    type="number"
                    dataKey={ordem === 'valor' ? 'valor' : 'quantidade'}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={ordem === 'valor' ? eixoMoeda : undefined}
                    allowDecimals={false}
                  />
                  <YAxis type="category" dataKey="nome" tick={axisTick} axisLine={false} tickLine={false} width={120} tickFormatter={encurtar} />
                  <Tooltip cursor={cursorBarra} contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} formatter={tooltipRanking} labelFormatter={() => ''} />
                  <Bar dataKey={ordem === 'valor' ? 'valor' : 'quantidade'} fill={COR_RANKING} radius={[0, 6, 6, 0]} maxBarSize={24}>
                    <LabelList dataKey="rotulo" content={rotuloBarra} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Vazio icon={<Scissors className="w-6 h-6" />} texto="Nenhum procedimento glosado no período." />
          )}
        </Painel>

        <Painel titulo="Ranking de convênios" sub="10 que mais glosam; percentual do total glosado">
          {rankingConvenios.length > 0 ? (
            <div style={{ height: alturaRanking(rankingConvenios.length) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingConvenios} layout="vertical" margin={{ top: 4, right: 140, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <YAxis type="category" dataKey="nome" tick={axisTick} axisLine={false} tickLine={false} width={120} tickFormatter={encurtar} />
                  <Tooltip cursor={cursorBarra} contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} formatter={tooltipRanking} labelFormatter={() => ''} />
                  <Bar dataKey="valor" fill={COR_STATUS.definitiva} radius={[0, 6, 6, 0]} maxBarSize={24}>
                    <LabelList dataKey="rotulo" content={rotuloBarra} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Vazio icon={<BarChart3 className="w-6 h-6" />} texto="Nenhum convênio com glosa no período." />
          )}
        </Painel>
      </div>

      <Painel titulo="Resumo por motivo de glosa" sub="Catálogo de motivos do apLIS; percentual das ocorrências">
        {motivos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={motivos}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={motivos.length > 1 ? 3 : 0}
                    stroke="none"
                  >
                    {motivos.map((m, i) => <Cell key={m.nome} fill={corMotivo(m, i)} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    formatter={(quantidade: number, nome: string, item: { payload?: ItemRankingGlosa }) => [
                      `${rotuloGlosas(quantidade)} · ${formatPercentual(item.payload?.percentual ?? 0)}`,
                      nome,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="md:col-span-2 overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left font-medium py-2">Motivo</th>
                    <th className="text-right font-medium py-2 w-20">%</th>
                    <th className="text-right font-medium py-2 w-24">Ocorrências</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {motivos.map((m, i) => (
                    <tr key={m.nome}>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: corMotivo(m, i) }} />
                          {m.nome}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium text-gray-900 dark:text-white tabular-nums">{formatPercentual(m.percentual)}</td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-400 tabular-nums">{m.quantidade.toLocaleString('pt-BR')}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <Vazio icon={<Scissors className="w-6 h-6" />} texto="Nenhum motivo de glosa no período." />
        )}
      </Painel>
    </div>
  );
};

export default GlosasDashboard;
