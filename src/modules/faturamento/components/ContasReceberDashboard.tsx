import React, { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  DollarSign,
  Gavel,
  GripVertical,
  Lock,
  Receipt,
  RotateCcw,
  Scale,
  Scissors,
  Timer,
  TrendingUp,
  Unlock,
} from 'lucide-react';
import {
  WidthProvider,
  Responsive,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useTheme } from '../../../hooks/useTheme';
import { useContasReceberDashboard } from '../hooks/useContasReceberDashboard';
import { formatCompetencia, formatCurrency } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import FiltrosReceber from './FiltrosReceber';
import type { DashboardReceberFiltros, OperadoraResumo } from '../types';

// Painel da aba Dashboard de Contas a Receber. Todos os números vêm agregados da
// RPC fat_dashboard_receber — nada é recalculado aqui.
//
// A linguagem visual (cards de vidro, ícone em quadrado colorido com sombra,
// widgets arrastáveis) é a do Dashboard principal (src/components/Dashboard.tsx),
// de propósito: são as duas telas de indicadores que o mesmo usuário compara
// lado a lado, e divergir nelas faria o sistema parecer dois sistemas.

const ResponsiveGridLayout = WidthProvider(Responsive);

const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480 };
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 2 };
const GRID_ROW_HEIGHT = 50;
// v3: novo widget "Principais motivos de glosa". Um layout salvo na v2 não tem
// a chave 'motivos-glosa', e o react-grid-layout autoposiciona chaves ausentes
// com um tamanho mínimo — a versão do storage sobe para que todo mundo receba
// o widget já no tamanho pensado no DEFAULT_LAYOUTS, e não um card espremido.
const LAYOUT_STORAGE_KEY = 'flowLab_contas_receber_layout_v3';
const LAYOUTS_ANTIGOS = ['flowLab_contas_receber_layout_v1', 'flowLab_contas_receber_layout_v2'];

// Aging: a cor intensifica com o atraso. Sequencial, não categórica — a ordem dos
// buckets É a informação.
const CORES_AGING = ['#64748b', '#fbbf24', '#fb923c', '#f43f5e', '#9f1239'];
const COR_FATURADO = '#6366f1'; // indigo-500
const COR_RECEBIDO = '#059669'; // emerald-600
const COR_GLOSADO = '#f43f5e'; // rose-500
const COR_SALDO = '#3b82f6'; // blue-500

const ROTULOS_AGING: Record<string, string> = {
  a_vencer: 'A vencer',
  d1_30: '1–30 dias',
  d31_60: '31–60 dias',
  d61_90: '61–90 dias',
  d90_mais: '+90 dias',
};

// Altura de um bloco de KPI = quantas LINHAS de card o Tailwind forma naquela
// largura (4 → 2 → 1 coluna) × ~110px, mais o respiro do widget. Uma linha cabe
// em h3 (182px); reservar mais do que isso é o que deixava metade do card vazia.
// Dentro do widget os cards esticam para preencher, então uma sobra pequena
// vira card mais alto, e não faixa cinza.
const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'kpis-valor', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
    { i: 'kpis-prazo', x: 0, y: 3, w: 12, h: 3, minW: 4, minH: 2 },
    { i: 'aging', x: 0, y: 6, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'saldo-operadoras', x: 6, y: 6, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'previsao', x: 0, y: 13, w: 12, h: 8, minW: 4, minH: 4 },
    { i: 'serie', x: 0, y: 21, w: 12, h: 8, minW: 4, minH: 4 },
    { i: 'motivos-glosa', x: 0, y: 29, w: 12, h: 8, minW: 3, minH: 4 },
  ],
  md: [
    { i: 'kpis-valor', x: 0, y: 0, w: 10, h: 3 },
    { i: 'kpis-prazo', x: 0, y: 3, w: 10, h: 3 },
    { i: 'aging', x: 0, y: 6, w: 5, h: 7 },
    { i: 'saldo-operadoras', x: 5, y: 6, w: 5, h: 7 },
    { i: 'previsao', x: 0, y: 13, w: 10, h: 8 },
    { i: 'serie', x: 0, y: 21, w: 10, h: 8 },
    { i: 'motivos-glosa', x: 0, y: 29, w: 10, h: 8 },
  ],
  sm: [
    // 2 colunas: os quatro cards de valor viram duas linhas.
    { i: 'kpis-valor', x: 0, y: 0, w: 6, h: 5 },
    { i: 'kpis-prazo', x: 0, y: 5, w: 6, h: 3 },
    { i: 'aging', x: 0, y: 8, w: 6, h: 7 },
    { i: 'saldo-operadoras', x: 0, y: 15, w: 6, h: 7 },
    { i: 'previsao', x: 0, y: 22, w: 6, h: 8 },
    { i: 'serie', x: 0, y: 30, w: 6, h: 8 },
    { i: 'motivos-glosa', x: 0, y: 38, w: 6, h: 8 },
  ],
  xs: [
    // Empilhado: quatro linhas de card e três, respectivamente.
    { i: 'kpis-valor', x: 0, y: 0, w: 2, h: 8 },
    { i: 'kpis-prazo', x: 0, y: 8, w: 2, h: 6 },
    { i: 'aging', x: 0, y: 14, w: 2, h: 7 },
    { i: 'saldo-operadoras', x: 0, y: 21, w: 2, h: 7 },
    { i: 'previsao', x: 0, y: 28, w: 2, h: 8 },
    { i: 'serie', x: 0, y: 36, w: 2, h: 8 },
    { i: 'motivos-glosa', x: 0, y: 44, w: 2, h: 8 },
  ],
};

/** Vidro do Dashboard principal: fundo translúcido, desfoque e borda clara. */
const VIDRO =
  'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-slate-700/50 shadow-sm';

/** Alça de arraste, visível só ao passar o mouse pelo widget. */
const Alca: React.FC = () => (
  <div className="drag-handle cursor-grab active:cursor-grabbing absolute top-2 right-2 z-10 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-slate-700/70 transition-colors opacity-0 group-hover:opacity-100">
    <GripVertical className="w-4 h-4" />
  </div>
);

const Kpi: React.FC<{
  icon: React.ReactNode;
  label: string;
  valor: React.ReactNode;
  sub?: string;
  cor: string;
  atraso?: number;
}> = ({ icon, label, valor, sub, cor, atraso = 0 }) => (
  // h-full: o card preenche a fatia que o widget lhe dá, então redimensionar o
  // widget redimensiona os cards em vez de criar faixa vazia em volta.
  <div
    className={`relative overflow-hidden h-full flex items-center ${VIDRO} rounded-2xl sm:rounded-3xl px-3 py-3 sm:px-4 hover:shadow-xl hover:border-blue-200/60 dark:hover:border-blue-700/60 transition-all duration-300 hover-lift card-interactive animate-fade-in-up`}
    style={{ animationDelay: `${atraso * 0.05}s` }}
  >
    <div className="w-full flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
          {valor}
        </p>
        {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
      <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg flex-shrink-0 bg-gradient-to-br ${cor}`}>
        <span className="text-white">{icon}</span>
      </div>
    </div>
  </div>
);

/** Widget: o vidro, a alça e o cabeçalho. O conteúdo ocupa a altura restante. */
const Widget: React.FC<{
  titulo?: string;
  sub?: string;
  children: React.ReactNode;
}> = ({ titulo, sub, children }) => (
  <div className={`h-full flex flex-col ${VIDRO} rounded-3xl overflow-hidden p-4 sm:p-5`}>
    <Alca />
    {titulo && (
      <div className="mb-3 pr-8 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
      </div>
    )}
    {/* min-h-0: sem isso o filho flex ignora a altura do widget e estoura o card
        quando o usuário o encolhe. */}
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const VazioGrafico: React.FC<{ icon: React.ReactNode; texto: string }> = ({ icon, texto }) => (
  <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
    <div className="w-12 h-12 rounded-2xl bg-gray-100/70 dark:bg-slate-700/50 flex items-center justify-center mb-2">
      {icon}
    </div>
    <p className="text-sm">{texto}</p>
  </div>
);

// Eixo em milhares: valores de faturamento estouram a largura do eixo em reais.
const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor);

/** Percentual inteiro de `parte` sobre `todo`; 0 quando não há base. */
const percentual = (parte: number, todo: number): number =>
  todo > 0 ? Math.round((parte / todo) * 100) : 0;

/** Prazo em dias. NULL vira "—": não há base, e "0 dias" leria como "à vista". */
const formatDias = (dias: number | null | undefined): string =>
  dias === null || dias === undefined ? '—' : `${dias.toLocaleString('pt-BR')} dias`;

/**
 * Quanto o prazo praticado passou do contratado, para o texto de apoio do card.
 * Só faz sentido com os dois lados preenchidos.
 */
const desvioContratual = (real: number | null, previsto: number | null): string | undefined => {
  if (real === null || previsto === null) return undefined;
  const dif = Math.round(real - previsto);
  if (dif === 0) return 'no prazo do contrato';
  return dif > 0 ? `${dif} dias além do contrato` : `${Math.abs(dif)} dias antes do contrato`;
};

interface Props {
  filtros: DashboardReceberFiltros;
  /** Recebe o recorte inteiro de uma vez, no "Aplicar" do modal de filtros. */
  onFiltrar: (filtros: DashboardReceberFiltros) => void;
  /** Volta os campos ao padrão (últimos 3 meses, sem recorte). */
  onLimpar: () => void;
  /** O mesmo padrão do "Limpar", para o modal zerar sem fechar. */
  padrao: DashboardReceberFiltros;
  operadoras: OperadoraResumo[];
}

const ContasReceberDashboard: React.FC<Props> = ({
  filtros,
  onFiltrar,
  onLimpar,
  padrao,
  operadoras,
}) => {
  const { data, loading, error } = useContasReceberDashboard(filtros);
  const { isDark } = useTheme();

  // ─── Layout dos widgets ─────────────────────────────────────────────────────
  // Travado por padrão: quem abre a tela quer ler os números, não rearranjá-los,
  // e um arraste acidental sobre um gráfico seria irritante.
  const [travado, setTravado] = useState(true);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    LAYOUTS_ANTIGOS.forEach((chave) => localStorage.removeItem(chave));
    try {
      const salvo = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (salvo) return JSON.parse(salvo) as ResponsiveLayouts;
    } catch {
      /* layout corrompido no storage: cai no padrão */
    }
    return DEFAULT_LAYOUTS;
  });

  const aoMudarLayout = useCallback(
    (_atual: Layout, todos: ResponsiveLayouts) => {
      // Só grava com o layout destravado: o react-grid-layout dispara este
      // callback também na montagem, e gravar aí congelaria o padrão de hoje
      // para sempre — nenhuma melhoria futura no DEFAULT_LAYOUTS chegaria a quem
      // já abriu a tela uma vez.
      if (travado) return;
      setLayouts(todos);
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(todos));
    },
    [travado],
  );

  const resetarLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  }, []);

  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 12,
    fontSize: 12,
  };
  const tooltipItem: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155' };
  const tooltipLabel: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 };

  const buckets = data.aging;
  const aging = useMemo(
    () =>
      Object.entries(ROTULOS_AGING).map(([chave, rotulo]) => ({
        faixa: rotulo,
        valor: buckets[chave as keyof typeof buckets] ?? 0,
      })),
    [buckets],
  );
  const temAging = aging.some((faixa) => faixa.valor > 0);

  // Top 10 por saldo: a lista completa de operadoras não cabe legível num gráfico
  // de barras, e a cauda longa não muda nenhuma decisão de cobrança.
  const topOperadoras = useMemo(
    () => data.porOperadora.filter((o) => o.saldo > 0).slice(0, 10),
    [data.porOperadora],
  );

  const serie = useMemo(
    () => data.serieMensal.map((mes) => ({ ...mes, rotulo: formatCompetencia(mes.competencia) })),
    [data.serieMensal],
  );

  // Quem demora mais primeiro: é a linha que muda a cobrança. Operadora ainda
  // sem recebimento no período cai para o fim, em vez de encabeçar com um null.
  const previsao = useMemo(
    () => [...data.previsaoOperadoras].sort((a, b) => (b.prazoMedio ?? -1) - (a.prazoMedio ?? -1)),
    [data.previsaoOperadoras],
  );

  const { kpis } = data;

  // Os filtros ficam fora do estado de carregamento: sumir com eles a cada
  // consulta impediria de corrigir um período errado sem esperar o resultado.
  const barraFiltros = (
    <FiltrosReceber
      filtros={filtros}
      onFiltrar={onFiltrar}
      onLimpar={onLimpar}
      padrao={padrao}
      operadoras={operadoras}
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {barraFiltros}
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {barraFiltros}
        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-900/20 backdrop-blur-sm text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">{barraFiltros}</div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setTravado((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              travado
                ? 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                : 'bg-blue-500 text-white shadow-md hover:bg-blue-600'
            }`}
            title={travado ? 'Destravar para arrastar e redimensionar' : 'Travar o layout'}
          >
            {travado ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {travado ? 'Editar layout' : 'Travado'}
          </button>
          {!travado && (
            <button
              type="button"
              onClick={resetarLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
              title="Restaurar o layout padrão"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetar
            </button>
          )}
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        onLayoutChange={aoMudarLayout}
        isDraggable={!travado}
        isResizable={!travado}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {/* ── Valor ────────────────────────────────────────────────────────────
            Os quatro saem do mesmo conjunto de títulos e por isso podem ser
            lidos como uma decomposição: do faturado, quanto entrou, quanto foi
            recusado e quanto dessa recusa já é perda assumida. */}
        <div key="kpis-valor" className="group">
          {/* overflow-y-auto e não hidden: se o usuário encolher o widget além
              do que os cards ocupam, rolar é melhor do que cortar um número. */}
          <div className={`h-full ${VIDRO} rounded-3xl overflow-y-auto p-3 sm:p-4`}>
            <Alca />
            {/* grid-auto-rows:1fr divide a altura igualmente entre as linhas de
                card, mas nunca abaixo do conteúdo — o widget rola em vez de
                cortar um número. */}
            <div className="min-h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 [grid-auto-rows:1fr]">
              <Kpi
                icon={<Receipt className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Valor faturado"
                sub={`${kpis.qtdTitulos} título${kpis.qtdTitulos === 1 ? '' : 's'}`}
                valor={formatCurrency(kpis.faturado)}
                cor="from-indigo-500 to-indigo-600"
                atraso={0}
              />
              <Kpi
                icon={<DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Valor recebido"
                sub={`${percentual(kpis.recebido, kpis.faturado)}% do faturado`}
                valor={formatCurrency(kpis.recebido)}
                cor="from-emerald-500 to-emerald-600"
                atraso={1}
              />
              <Kpi
                icon={<Scissors className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Valor glosado"
                sub={`${percentual(kpis.glosado, kpis.faturado)}% do faturado`}
                valor={formatCurrency(kpis.glosado)}
                cor="from-rose-500 to-rose-600"
                atraso={2}
              />
              <Kpi
                icon={<Gavel className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Valor acatado"
                // Glosa definitiva: perda assumida, já não é mais recorrível.
                sub={`${percentual(kpis.acatado, kpis.glosado)}% do glosado`}
                valor={formatCurrency(kpis.acatado)}
                cor="from-amber-500 to-amber-600"
                atraso={3}
              />
            </div>
          </div>
        </div>

        {/* ── Prazo ────────────────────────────────────────────────────────────
            Os três medem a MESMA distância — do envio do lote ao primeiro
            recebimento do título — pelo contrato, pela média e pela média
            ponderada. Títulos ainda sem baixa não entram: não são demora, são
            espera. */}
        <div key="kpis-prazo" className="group">
          <div className={`h-full ${VIDRO} rounded-3xl overflow-y-auto p-3 sm:p-4`}>
            <Alca />
            <div className="min-h-full grid grid-cols-1 sm:grid-cols-3 gap-3 [grid-auto-rows:1fr]">
              <Kpi
                icon={<CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Previsão contratual"
                sub="regra das operadoras"
                valor={formatDias(kpis.prazoPrevistoDias)}
                cor="from-sky-500 to-sky-600"
                atraso={0}
              />
              <Kpi
                icon={<Timer className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Prazo médio de recebimento"
                sub={`${kpis.prazoBaseTitulos} título${kpis.prazoBaseTitulos === 1 ? '' : 's'} medido${kpis.prazoBaseTitulos === 1 ? '' : 's'}`}
                valor={formatDias(kpis.prazoMedioDias)}
                cor="from-violet-500 to-violet-600"
                atraso={1}
              />
              <Kpi
                icon={<Scale className="w-4 h-4 sm:w-5 sm:h-5" />}
                label="Prazo médio ponderado"
                // Pelo valor: um título grande pago tarde pesa mais no caixa do
                // que vários pequenos pagos em dia.
                sub={desvioContratual(kpis.prazoPonderadoDias, kpis.prazoPrevistoDias) ?? 'pelo valor recebido'}
                valor={formatDias(kpis.prazoPonderadoDias)}
                cor="from-teal-500 to-teal-600"
                atraso={2}
              />
            </div>
          </div>
        </div>

        <div key="aging" className="group">
          <Widget
            titulo="Aging da carteira"
            sub="Saldo em aberto por tempo de atraso — inclui títulos de qualquer período"
          >
            {temAging ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="faixa" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    labelStyle={tooltipLabel}
                    formatter={(valor: number) => [formatCurrency(valor), 'Saldo']}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {aging.map((faixa, i) => (
                      <Cell key={faixa.faixa} fill={CORES_AGING[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <VazioGrafico icon={<BarChart3 className="w-6 h-6" />} texto="Nenhum saldo em aberto." />
            )}
          </Widget>
        </div>

        <div key="saldo-operadoras" className="group">
          <Widget titulo="Saldo por operadora" sub="10 maiores devedores">
            {topOperadoras.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topOperadoras}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    labelStyle={tooltipLabel}
                    formatter={(valor: number) => [formatCurrency(valor), 'Saldo']}
                  />
                  <Bar dataKey="saldo" fill={COR_SALDO} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <VazioGrafico icon={<BarChart3 className="w-6 h-6" />} texto="Nenhuma operadora com saldo." />
            )}
          </Widget>
        </div>

        <div key="previsao" className="group">
          <Widget
            titulo="Previsão de pagamento por operadora"
            sub="Do envio do lote ao primeiro recebimento — títulos emitidos no período filtrado"
          >
            {previsao.length > 0 ? (
              <div className="h-full overflow-auto -mx-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700">
                      <th className="text-left font-medium px-2 py-2">Operadora</th>
                      <th className="text-left font-medium px-2 py-2">Regra do contrato</th>
                      <th className="text-right font-medium px-2 py-2">Previsto</th>
                      <th className="text-right font-medium px-2 py-2">Média</th>
                      <th className="text-right font-medium px-2 py-2">Ponderada</th>
                      <th className="text-right font-medium px-2 py-2">Títulos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previsao.map((linha) => {
                      // Atraso sobre o contrato é o que a tela precisa denunciar;
                      // o limiar de 3 dias evita pintar de vermelho um fim de
                      // semana.
                      const atrasa =
                        linha.prazoMedio !== null &&
                        linha.prazoPrevisto !== null &&
                        linha.prazoMedio - linha.prazoPrevisto > 3;
                      return (
                        <tr
                          key={linha.operadoraId}
                          className="border-b border-slate-100/70 dark:border-slate-700/50 last:border-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-2 py-2 text-slate-800 dark:text-slate-100">{linha.nome}</td>
                          <td className="px-2 py-2 text-slate-500 dark:text-slate-400">
                            {linha.regra ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {formatDias(linha.prazoPrevisto)}
                          </td>
                          <td
                            className={`px-2 py-2 text-right tabular-nums font-medium ${
                              atrasa ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {formatDias(linha.prazoMedio)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                            {formatDias(linha.prazoPonderado)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {/* Medidos × emitidos: separa "paga rápido" de
                                "ainda não pagou". */}
                            {linha.base}/{linha.qtdTitulos}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <VazioGrafico
                icon={<CalendarClock className="w-6 h-6" />}
                texto="Nenhum título emitido no período."
              />
            )}
          </Widget>
        </div>

        <div key="serie" className="group">
          <Widget titulo="Faturado × recebido × glosado" sub="Por competência, no período filtrado">
            {serie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="rotulo" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    labelStyle={tooltipLabel}
                    formatter={(valor: number) => formatCurrency(valor)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="faturado" name="Faturado" fill={COR_FATURADO} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="recebido" name="Recebido" fill={COR_RECEBIDO} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="glosado" name="Glosado" fill={COR_GLOSADO} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <VazioGrafico icon={<TrendingUp className="w-6 h-6" />} texto="Nenhum título emitido no período." />
            )}
          </Widget>
        </div>

        <div key="motivos-glosa" className="group">
          <Widget titulo="Principais motivos de glosa" sub="8 maiores por valor, no período filtrado">
            {data.porMotivo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.porMotivo}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={eixoMoeda} />
                  <YAxis
                    type="category"
                    dataKey="motivo"
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    width={160}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItem}
                    labelStyle={tooltipLabel}
                    formatter={(valor: number, _nome, item) => [
                      `${formatCurrency(valor)} · ${item.payload.quantidade} glosa${item.payload.quantidade === 1 ? '' : 's'}`,
                      'Valor glosado',
                    ]}
                  />
                  <Bar dataKey="valor" fill={COR_GLOSADO} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <VazioGrafico icon={<Scissors className="w-6 h-6" />} texto="Nenhuma glosa no período." />
            )}
          </Widget>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};

export default ContasReceberDashboard;
