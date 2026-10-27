import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  FileText,
  FlaskConical,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import DatePicker from '../../../components/DatePicker';
import { useTheme } from '../../../hooks/useTheme';
import { useIndicadoresFaturamento } from '../hooks/useIndicadoresFaturamento';
import type {
  CardIndicadorFaturamento,
  ItemRankingIndicadores,
  PeriodoIndicadoresFaturamento,
  RankingIndicadores,
} from '../types';
import { formatCurrency, formatData, formatPercentual, hojeIso, periodoMesPassado } from '../utils/formato';

// ============================================================================
// COMPONENTE: IndicadoresFaturamento
// Faturamento → Indicadores (.scratch/faturamento-indicadores/spec.md): total
// faturado, requisições e exames faturados no mês ou num período livre (pela
// criação do lote, sem os cancelados), com a variação sobre o mês anterior ou o
// período anterior de mesmo tamanho, e os rankings Top 10.
// Os números vêm prontos do servidor (api/_lib/faturamento/indicadoresFaturamento.ts),
// cada ranking já nas duas ordens: o botão R$/Qtd só escolhe qual mostrar.
//
// Rankings no padrão do Dashboard de Glosas (GlosasDashboard.tsx): recharts,
// barras horizontais, eixos e tooltip pelo tema.
// ============================================================================

const CARD = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5';
const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

/** 'YYYY-MM' do mês anterior ao de hoje: o último mês fechado. */
function mesAnterior(): string {
  const [ano, mes] = hojeIso().split('-').map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD HH:MM' do banco → 'dd/mm hh:mm', sem converter fuso. */
function formatDiaMesHora(valor: string): string {
  const [data, hora = ''] = valor.split(' ');
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}${hora ? ` ${hora}` : ''}`;
}

const formatInteiro = (n: number): string => n.toLocaleString('pt-BR');

/** Métrica dos rankings, escolhida no botão R$/Qtd do cabeçalho. */
type MetricaRanking = 'valor' | 'quantidade';

type ModoPeriodo = PeriodoIndicadoresFaturamento['modo'];

/** Textos que mudam com o modo do cabeçalho. */
const TEXTOS_MODO: Record<ModoPeriodo, { no: string; deste: string; anterior: string; Anterior: string }> = {
  mes: { no: 'no mês', deste: 'deste mês', anterior: 'mês anterior', Anterior: 'Mês anterior' },
  periodo: { no: 'no período', deste: 'deste período', anterior: 'período anterior', Anterior: 'Período anterior' },
};

const COR_RANKING = '#6366f1'; // indigo-500

/** Rótulo do eixo dos rankings; o nome inteiro fica no tooltip. */
const MAX_ROTULO = 20;

// Eixo em milhares: valores de faturamento estouram a largura do eixo em reais.
const eixoMoeda = (valor: number): string =>
  Math.abs(valor) >= 1000 ? `${Math.round(valor / 1000)}k` : String(valor);

const encurtar = (nome: string): string => (nome.length > MAX_ROTULO ? `${nome.slice(0, MAX_ROTULO - 1)}…` : nome);

const alturaRanking = (linhas: number) => Math.max(linhas * 34 + 16, 192);

const Variacao: React.FC<{ variacao: number | null; anterior: string }> = ({ variacao, anterior }) => {
  if (variacao === null) return <><span className="font-medium">—</span> sem valor no {anterior}</>;
  if (variacao === 0) return <>Igual ao {anterior}</>;
  const sobe = variacao > 0;
  const Seta = sobe ? TrendingUp : TrendingDown;
  const cor = sobe ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300';
  return (
    <>
      <Seta className={`inline h-4 w-4 mr-1 align-[-3px] ${cor}`} />
      <span className={`font-medium ${cor}`}>{sobe ? '+' : ''}{formatPercentual(variacao)}</span>{' '}
      em relação ao {anterior}
    </>
  );
};

interface CardProps {
  titulo: string;
  card: CardIndicadorFaturamento;
  formatar: (n: number) => string;
  icone: React.ReactNode;
  corIcone: string;
  textos: (typeof TEXTOS_MODO)[ModoPeriodo];
}

const CardIndicador: React.FC<CardProps> = ({ titulo, card, formatar, icone, corIcone, textos }) => (
  <div className={CARD}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatar(card.atual)}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {textos.Anterior}: {formatar(card.anterior)}
        </p>
      </div>
      <div className={`p-3 rounded-lg ${corIcone}`}>{icone}</div>
    </div>
    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
      <Variacao variacao={card.variacao} anterior={textos.anterior} />
    </div>
  </div>
);

/** Botões lado a lado, um ativo: Mês/Período e R$/Qtd. */
function Alternancia<T extends string>({ rotulo, opcoes, valor, onChange }: {
  rotulo: string;
  opcoes: readonly (readonly [T, string])[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      {rotulo}
      <div className="mt-1 flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-sm font-medium">
        {opcoes.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={valor === id}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              valor === id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const OPCOES_MODO = [['mes', 'Mês'], ['periodo', 'Período']] as const;
const OPCOES_METRICA = [['valor', 'R$'], ['quantidade', 'Qtd']] as const;

interface RankingBarrasProps {
  titulo: string;
  sub: string;
  ranking: RankingIndicadores;
  metrica: MetricaRanking;
  /** O que a quantidade conta ('exame' / 'exames'). */
  unidade: { singular: string; plural: string };
  vazio: string;
  /** Aviso curto sob o gráfico. */
  nota?: string;
}

const RankingBarras: React.FC<RankingBarrasProps> = ({ titulo, sub, ranking, metrica, unidade, vazio, nota }) => {
  const { isDark } = useTheme();
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

  const contagem = (n: number, singular: string, plural: string) => `${formatInteiro(n)} ${n === 1 ? singular : plural}`;
  const quantidade = (n: number) => contagem(n, unidade.singular, unidade.plural);
  // Ao lado da barra, a métrica escolhida; no tooltip, o nome inteiro e a outra.
  const itens = (metrica === 'valor' ? ranking.porValor : ranking.porQuantidade).map((i) => ({
    ...i,
    rotulo: metrica === 'valor' ? formatCurrency(i.valor) : quantidade(i.quantidade),
  }));
  const tooltipRanking = (_valor: number, _nome: string, item: { payload?: ItemRankingIndicadores }) => {
    const p = item.payload as ItemRankingIndicadores;
    const outra = metrica === 'valor' ? quantidade(p.quantidade) : formatCurrency(p.valor);
    const lotes = p.lotes === undefined ? '' : ` · ${contagem(p.lotes, 'lote', 'lotes')}`;
    return [`${outra}${lotes}`, p.nome];
  };

  return (
    <div className={`${CARD} flex flex-col`}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{titulo}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
      </div>
      {itens.length > 0 ? (
        <div style={{ height: alturaRanking(itens.length) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={itens} layout="vertical" margin={{ top: 4, right: 120, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                dataKey={metrica}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={metrica === 'valor' ? eixoMoeda : undefined}
                allowDecimals={metrica === 'valor'}
              />
              <YAxis type="category" dataKey="nome" tick={axisTick} axisLine={false} tickLine={false} width={120} tickFormatter={encurtar} />
              <Tooltip cursor={cursorBarra} contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} formatter={tooltipRanking} labelFormatter={() => ''} />
              <Bar dataKey={metrica} fill={COR_RANKING} radius={[0, 6, 6, 0]} maxBarSize={24}>
                <LabelList dataKey="rotulo" content={rotuloBarra} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="min-h-[12rem] flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-2">
            <BarChart3 className="w-6 h-6" />
          </div>
          <p className="text-sm">{vazio}</p>
        </div>
      )}
      {nota && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{nota}</p>}
    </div>
  );
};

const IndicadoresFaturamento: React.FC = () => {
  const [modo, setModo] = useState<ModoPeriodo>('mes');
  const [mes, setMes] = useState(mesAnterior);
  // Período livre: começa no mês passado, como o modo Mês.
  const [inicio, setInicio] = useState(() => periodoMesPassado().desde);
  const [fim, setFim] = useState(() => periodoMesPassado().ate);
  // Só estado de tela: os dois rankings já vêm prontos, sem nova consulta.
  const [metrica, setMetrica] = useState<MetricaRanking>('valor');
  const periodo = useMemo<PeriodoIndicadoresFaturamento>(
    () => (modo === 'mes' ? { modo, mes } : { modo, inicio, fim }),
    [modo, mes, inicio, fim],
  );
  const { indicadores, meta, loading, error, refetch } = useIndicadoresFaturamento(periodo);
  const textos = TEXTOS_MODO[modo];
  const janelaAnterior = modo === 'periodo' ? meta?.janelas?.anterior : undefined;

  return (
    <div className="space-y-6">
      {/* Título e filtros fixos no topo ao rolar: as margens negativas cobrem o
          padding do <main> do Layout; no celular, para abaixo do cabeçalho de 72px. */}
      <div className="sticky top-[72px] lg:top-0 z-30 -mx-3 sm:-mx-4 lg:-mx-5 xl:-mx-8 px-3 sm:px-4 lg:px-5 xl:px-8 py-3 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/70 dark:border-gray-700/70 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-blue-600" />
          Indicadores de Faturamento
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <Alternancia<ModoPeriodo> rotulo="Período por" opcoes={OPCOES_MODO} valor={modo} onChange={setModo} />
          {modo === 'mes' ? (
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Mês (criação do lote)
              <DatePicker
                value={`${mes}-01`}
                onChange={(v) => v && setMes(v.slice(0, 7))}
                controlClass={CAMPO}
                granularity="month"
              />
            </label>
          ) : (
            <>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Lotes criados de
                <DatePicker value={inicio} onChange={setInicio} controlClass={CAMPO} />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                até (inclusive)
                <DatePicker value={fim} onChange={setFim} controlClass={CAMPO} />
              </label>
            </>
          )}
          <Alternancia<MetricaRanking> rotulo="Rankings por" opcoes={OPCOES_METRICA} valor={metrica} onChange={setMetrica} />
          <button
            onClick={() => void refetch(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Fora da barra fixa: rola com a página. */}
      <div className="!mt-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Lotes de faturamento criados {textos.no}, sem os cancelados
          {janelaAnterior && (
            <>; comparados com {formatData(janelaAnterior.inicio)} a {formatData(janelaAnterior.fim)}</>
          )}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {meta?.dadoAte
            ? <>Dados até {formatDiaMesHora(meta.dadoAte)} (o backup do apLIS atrasa cerca de 1 dia)</>
            : 'Dados do backup do apLIS'}
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-300">
              Os números {textos.deste} não foram carregados.
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      ) : !indicadores ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-36 animate-pulse`} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-96 animate-pulse`} />)}
          </div>
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardIndicador
              titulo="Total faturado"
              card={indicadores.cards.totalFaturado}
              formatar={formatCurrency}
              icone={<DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />}
              corIcone="bg-green-100 dark:bg-green-900/30"
              textos={textos}
            />
            <CardIndicador
              titulo="Requisições faturadas"
              card={indicadores.cards.requisicoes}
              formatar={formatInteiro}
              icone={<FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
              corIcone="bg-blue-100 dark:bg-blue-900/30"
              textos={textos}
            />
            <CardIndicador
              titulo="Exames faturados"
              card={indicadores.cards.exames}
              formatar={formatInteiro}
              icone={<FlaskConical className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />}
              corIcone="bg-indigo-100 dark:bg-indigo-900/30"
              textos={textos}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RankingBarras
              titulo="Exames mais faturados"
              sub={metrica === 'valor'
                ? '10 exames com maior valor faturado'
                : '10 exames mais cobrados'}
              ranking={indicadores.rankings.exames}
              metrica={metrica}
              unidade={{ singular: 'exame', plural: 'exames' }}
              vazio={`Nenhum exame faturado ${textos.no}.`}
              nota="Particular entra no mês em que o lote mensal é criado."
            />
            <RankingBarras
              titulo="Convênios que mais faturaram"
              sub={metrica === 'valor'
                ? '10 fontes pagadoras com maior valor faturado'
                : '10 fontes pagadoras com mais exames faturados'}
              ranking={indicadores.rankings.convenios}
              metrica={metrica}
              unidade={{ singular: 'exame', plural: 'exames' }}
              vazio={`Nenhum convênio faturado ${textos.no}.`}
            />
            <RankingBarras
              titulo="Clínicas com mais requisições faturadas"
              sub={metrica === 'valor'
                ? '10 clínicas com maior valor faturado, pela criação do lote'
                : '10 clínicas com mais requisições faturadas, pela criação do lote'}
              ranking={indicadores.rankings.clinicas}
              metrica={metrica}
              unidade={{ singular: 'requisição', plural: 'requisições' }}
              vazio={`Nenhuma clínica com requisição faturada ${textos.no}.`}
            />
            <RankingBarras
              titulo="Faturistas (por quem abriu o lote)"
              sub={metrica === 'valor'
                ? '10 faturistas com maior valor nos lotes que abriram'
                : '10 faturistas com mais requisições nos lotes que abriram'}
              ranking={indicadores.rankings.faturistas}
              metrica={metrica}
              unidade={{ singular: 'requisição', plural: 'requisições' }}
              vazio={`Nenhum lote aberto ${textos.no}.`}
              nota="Conta quem criou o lote no apLIS; conferência, guias e glosas podem ter sido feitas por outra pessoa."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicadoresFaturamento;
