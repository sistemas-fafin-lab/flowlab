import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  CalendarClock,
  Droplets,
  TrendingUp,
  XCircle,
  Microscope,
  Thermometer,
  RefreshCw,
  ClipboardCheck,
  FlaskConical,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Building2,
  Boxes,
  ShieldAlert,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { useAcIndicadores } from '../hooks/useAcIndicadores';
import { useTheme } from '../../../hooks/useTheme';
import { CHECKLIST_RECEPCAO } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayLabel = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const diasDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const diasAte = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
// "há X" compacto a partir de um instante no passado (para o alerta de temperatura).
const haQuanto = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
};

// Alertas do processo (mockup): meta de coleta por posto e janela de validade.
const META_POSTO = 80; // % — meta de coletas concluídas por posto
const VALIDADE_DIAS = 30; // dias — janela para "validade próxima" de insumo

type AlertaTone = 'red' | 'amber' | 'blue';
interface Alerta {
  key: string;
  tone: AlertaTone;
  icon: React.ReactNode;
  titulo: string;
  detalhe: string;
  sev: number; // desempate dentro do mesmo tone
}
const ALERTA_TONE: Record<AlertaTone, { row: string; icon: string; ordem: number }> = {
  red: {
    row: 'bg-red-50/70 dark:bg-red-900/15 border-red-100 dark:border-red-900/30',
    icon: 'bg-gradient-to-br from-red-500 to-rose-600',
    ordem: 0,
  },
  amber: {
    row: 'bg-amber-50/70 dark:bg-amber-900/15 border-amber-100 dark:border-amber-900/30',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-500',
    ordem: 1,
  },
  blue: {
    row: 'bg-blue-50/70 dark:bg-blue-900/15 border-blue-100 dark:border-blue-900/30',
    icon: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    ordem: 2,
  },
};

// Cores das culturas — espelham os badges da CulturasPage (consistência visual).
// Paleta categórica validada (dataviz): CVD + contraste OK em fundo claro.
const COR_EM_ANDAMENTO = '#3b82f6'; // blue-500
const COR_POSITIVA = '#f43f5e'; // rose-500
const COR_LAUDO = '#8b5cf6'; // violet-500
const COR_AGENDAMENTOS = '#3b82f6'; // blue-500
const COR_COLETAS = '#059669'; // emerald-600 (contraste OK vs. fundo claro)
const COR_EXAMES = '#6366f1'; // indigo-500 (magnitude neutra)
const COR_ALERTA = '#f59e0b'; // amber-500 (excursões — contagem "ruim")
const COR_PROBLEMA = '#f43f5e'; // rose-500 (bloqueios de recepção)

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
];

// Preset de janela: dias fixos ou 'custom' (intervalo escolhido pelo usuário).
type PeriodoPreset = 7 | 30 | 90 | 'custom';

// ─── Tile de KPI (mesmo molde da CulturasPage) ──────────────────────────────────
const Kpi: React.FC<{ icon: React.ReactNode; label: string; valor: React.ReactNode; sub?: string; cor: string }> = ({
  icon,
  label,
  valor,
  sub,
  cor,
}) => (
  <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${cor}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{valor}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {label}
        {sub && <span className="text-gray-400"> · {sub}</span>}
      </div>
    </div>
  </div>
);

// ─── Casca de um gráfico ────────────────────────────────────────────────────────
const ChartCard: React.FC<{ titulo: string; sub?: string; children: React.ReactNode }> = ({ titulo, sub, children }) => (
  <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{titulo}</h3>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {children}
  </div>
);

// Estado vazio dentro de um gráfico.
const VazioGrafico: React.FC<{ icon: React.ReactNode; texto: string }> = ({ icon, texto }) => (
  <div className="h-[240px] flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500">
    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-2">{icon}</div>
    <p className="text-sm">{texto}</p>
  </div>
);

// Card de KPI ainda sem fonte de dado (recoleta/desperdício — §1 do plano da Fase 8).
const Placeholder: React.FC<{ icon: React.ReactNode; titulo: string; motivo: string }> = ({ icon, titulo, motivo }) => (
  <div className="p-5 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 flex items-start gap-3">
    <div className="w-10 h-10 rounded-xl bg-gray-200/70 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">{titulo}</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{motivo}</p>
    </div>
  </div>
);

// ─── Página ─────────────────────────────────────────────────────────────────────
const IndicadoresPage: React.FC = () => {
  const [preset, setPreset] = useState<PeriodoPreset>(30);
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');

  // Intervalo efetivo (preset OU datas personalizadas) → limites ISO p/ o hook.
  // Memoizado: `ate` fica fixo até o preset/datas mudarem, evitando refetch em loop.
  const range = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(hoje);
    fimHoje.setHours(23, 59, 59, 999);

    if (preset === 'custom' && customIni && customFim) {
      let ini = new Date(`${customIni}T00:00:00`);
      let fim = new Date(`${customFim}T00:00:00`);
      if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) {
        return { desdeISO: hoje.toISOString(), ateISO: fimHoje.toISOString(), inicio: new Date(hoje), dias: 1 };
      }
      if (ini > fim) [ini, fim] = [fim, ini];
      const dias = Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1;
      const fimDia = new Date(fim);
      fimDia.setHours(23, 59, 59, 999);
      return { desdeISO: ini.toISOString(), ateISO: fimDia.toISOString(), inicio: ini, dias };
    }

    const n = typeof preset === 'number' ? preset : 30;
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - (n - 1));
    return { desdeISO: inicio.toISOString(), ateISO: fimHoje.toISOString(), inicio, dias: n };
  }, [preset, customIni, customFim]);

  const { data, loading, error, refetch } = useAcIndicadores(range.desdeISO, range.ateISO);
  const { isDark } = useTheme();

  // Card flutuante de intervalo personalizado (popover) — abertura + fechar ao clicar fora.
  const [openCustom, setOpenCustom] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);

  // Ativa o modo personalizado semeando as datas com a janela atual (30 dias).
  const ativarCustom = () => {
    if (!customIni || !customFim) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const ini = new Date(hoje);
      ini.setDate(hoje.getDate() - 29);
      setCustomIni(dayKey(ini));
      setCustomFim(dayKey(hoje));
    }
    setPreset('custom');
  };

  // Abre/fecha o popover; ao abrir, entra no modo personalizado.
  const toggleCustom = () => {
    if (!openCustom) ativarCustom();
    setOpenCustom((o) => !o);
  };

  useEffect(() => {
    if (!openCustom) return;
    const onDown = (e: MouseEvent) => {
      if (customRef.current && !customRef.current.contains(e.target as Node)) setOpenCustom(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openCustom]);

  // Estilos de eixo/grid/tooltip theme-aware (espelham o Dashboard principal).
  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)';
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 12,
    fontSize: 12,
  };
  const tooltipItem: React.CSSProperties = { color: isDark ? '#e2e8f0' : '#334155' };
  const tooltipLabel: React.CSSProperties = { color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 };

  // ── Agregados ──────────────────────────────────────────────────────────────
  const prod = useMemo(() => {
    const total = data.agendamentos.length;
    const cancelados = data.agendamentos.filter((a) => a.status === 'cancelado').length;
    const ativos = total - cancelados;
    const coletas = data.coletas.length;
    const conversao = ativos ? Math.min(100, Math.round((coletas / ativos) * 100)) : 0;
    const cancelPct = total ? Math.round((cancelados / total) * 100) : 0;
    return { total, cancelados, ativos, coletas, conversao, cancelPct };
  }, [data]);

  const cult = useMemo(() => {
    const emAndamento = data.culturas.filter((c) => c.status === 'em_andamento').length;
    const positivas = data.culturas.filter((c) => c.status === 'positiva').length;
    const prontas = data.culturas.filter((c) => c.status === 'pronta_laudo').length;
    const atrasadas = data.culturas.filter(
      (c) => c.status === 'em_andamento' && diasDesde(c.iniciada_em) > c.prazo_dias,
    ).length;
    return { emAndamento, positivas, prontas, atrasadas, total: emAndamento + positivas + prontas };
  }, [data]);

  const temp = useMemo(() => {
    const total = data.temperaturas.length;
    const fora = data.temperaturas.filter((t) => t.fora_faixa).length;
    const nomes = new Map(data.equipamentos.map((e) => [e.id, e.nome]));
    const m = new Map<string, number>();
    for (const t of data.temperaturas) if (t.fora_faixa) m.set(t.equipamento_id, (m.get(t.equipamento_id) ?? 0) + 1);
    const barras = [...m.entries()]
      .map(([id, valor]) => ({ nome: nomes.get(id) ?? 'Equipamento', valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
    return { total, fora, foraPct: total ? Math.round((fora / total) * 100) : 0, barras };
  }, [data]);

  const topExames = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.exames) m.set(e.exame_nome, (m.get(e.exame_nome) ?? 0) + 1);
    return [...m.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [data]);

  const recepcao = useMemo(() => {
    const problemas = data.checkins.filter((c) => c.resultado === 'problema');
    const byItem = new Map<string, number>();
    for (const c of problemas) {
      const k = c.problema_em ?? 'outro';
      byItem.set(k, (byItem.get(k) ?? 0) + 1);
    }
    const barras = CHECKLIST_RECEPCAO.map((it) => ({ nome: it.label, valor: byItem.get(it.key) ?? 0 }))
      .filter((b) => b.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const pct = data.checkins.length ? Math.round((problemas.length / data.checkins.length) * 100) : 0;
    return { total: data.checkins.length, problemas: problemas.length, pct, barras };
  }, [data]);

  // Produtividade por posto: coletas concluídas ÷ agendamentos (não-cancelados) por
  // posto, dentro da janela. Mesmo critério do PostoCard de AgendamentosPage
  // (status 'coletado' contra o total agendado).
  const porPosto = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; coletados: number }>();
    for (const a of data.agendamentos) {
      if (a.status === 'cancelado') continue;
      const nome = a.local_posto?.trim() || 'Sem posto';
      const key = a.posto_id ?? nome;
      const cur = m.get(key) ?? { nome, total: 0, coletados: 0 };
      cur.total += 1;
      if (a.status === 'coletado') cur.coletados += 1;
      m.set(key, cur);
    }
    return [...m.values()]
      .map((p) => ({ ...p, pct: p.total ? Math.round((p.coletados / p.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  // Alertas do processo — "exigem ação agora". Só sinais com fonte real hoje:
  // temperatura fora de faixa, culturas atrasadas, insumo abaixo do mínimo,
  // recepção bloqueada e validade de insumo. (Recoleta fica de fora — sem tabela.)
  const alertas = useMemo(() => {
    const out: Alerta[] = [];

    // 1) Temperatura: última leitura de cada equipamento; se fora de faixa → ativo.
    const ultima = new Map<string, (typeof data.temperaturas)[number]>();
    for (const t of data.temperaturas) {
      const cur = ultima.get(t.equipamento_id);
      if (!cur || new Date(t.registrado_em) > new Date(cur.registrado_em)) ultima.set(t.equipamento_id, t);
    }
    const eqPorId = new Map(data.equipamentos.map((e) => [e.id, e]));
    for (const [id, t] of ultima) {
      if (!t.fora_faixa) continue;
      const eq = eqPorId.get(id);
      out.push({
        key: `temp-${id}`,
        tone: 'red',
        icon: <Thermometer className="w-4 h-4" />,
        titulo: `${eq?.nome ?? 'Equipamento'} fora da faixa`,
        detalhe: `${Number(t.temperatura).toFixed(1)} °C · faixa ${eq?.temp_min ?? '?'}–${eq?.temp_max ?? '?'} °C · ${haQuanto(t.registrado_em)}`,
        sev: 0,
      });
    }

    // 2) Culturas atrasadas: em andamento além do prazo.
    for (const c of data.culturas) {
      if (c.status !== 'em_andamento') continue;
      const atraso = Math.floor(diasDesde(c.iniciada_em) - c.prazo_dias);
      if (atraso <= 0) continue;
      out.push({
        key: `cult-${c.id}`,
        tone: 'red',
        icon: <Microscope className="w-4 h-4" />,
        titulo: `Cultura atrasada · ${c.exame_nome ?? 'Cultura'}`,
        detalhe: `${c.paciente_nome ?? 'Paciente'} · +${atraso}d além do prazo`,
        sev: 1,
      });
    }

    // 3) Insumo abaixo do mínimo (saldo do estoque de posto < mínimo do produto).
    for (const i of data.insumos) {
      if (i.min_stock > 0 && i.quantity < i.min_stock) {
        out.push({
          key: `min-${i.product_id}-${i.posto_nome}`,
          tone: 'amber',
          icon: <Boxes className="w-4 h-4" />,
          titulo: `${i.product_nome} abaixo do mínimo`,
          detalhe: `${i.posto_nome} · ${i.quantity}${i.unit ? ' ' + i.unit : ''} (mín. ${i.min_stock})`,
          sev: 2,
        });
      }
    }

    // 4) Recepção bloqueada: conferência de recepção falhou (sai da fila normal).
    for (const a of data.agendamentos) {
      if (a.status !== 'bloqueado') continue;
      out.push({
        key: `bloq-${a.id}`,
        tone: 'amber',
        icon: <ShieldAlert className="w-4 h-4" />,
        titulo: 'Recepção bloqueada',
        detalhe: `${a.local_posto ?? 'Posto'} · ${a.paciente_nome ?? 'Paciente'}`,
        sev: 3,
      });
    }

    // 5) Validade de insumo — vencido (vermelho) ou próximo (azul). Dedupe por produto.
    const vistos = new Set<string>();
    for (const i of data.insumos) {
      if (!i.expiration_date || vistos.has(i.product_id)) continue;
      const dias = diasAte(i.expiration_date);
      if (dias > VALIDADE_DIAS) continue;
      vistos.add(i.product_id);
      const vencido = dias < 0;
      out.push({
        key: `val-${i.product_id}`,
        tone: vencido ? 'red' : 'blue',
        icon: <CalendarClock className="w-4 h-4" />,
        titulo: vencido ? `${i.product_nome} vencido` : `Validade próxima · ${i.product_nome}`,
        detalhe: vencido ? `${i.posto_nome} · venceu há ${Math.abs(dias)}d` : `${i.posto_nome} · vence em ${dias}d`,
        sev: vencido ? 1 : 4,
      });
    }

    return out.sort((a, b) => ALERTA_TONE[a.tone].ordem - ALERTA_TONE[b.tone].ordem || a.sev - b.sev);
  }, [data]);

  // Série diária: agendamentos × coletas por dia, do início ao fim da janela.
  const serie = useMemo(() => {
    const start = new Date(range.inicio);
    start.setHours(0, 0, 0, 0);
    const buckets = new Map<string, { dia: string; agendamentos: number; coletas: number }>();
    for (let i = 0; i < range.dias; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.set(dayKey(d), { dia: dayLabel(d), agendamentos: 0, coletas: 0 });
    }
    for (const a of data.agendamentos) {
      const b = buckets.get(dayKey(new Date(a.data_hora)));
      if (b) b.agendamentos++;
    }
    for (const c of data.coletas) {
      const b = buckets.get(dayKey(new Date(c.coletado_em)));
      if (b) b.coletas++;
    }
    return [...buckets.values()];
  }, [data, range]);

  const serieInterval = Math.max(0, Math.floor(serie.length / 8));

  const donut = [
    { name: 'Em andamento', value: cult.emAndamento, fill: COR_EM_ANDAMENTO },
    { name: 'Positivada', value: cult.positivas, fill: COR_POSITIVA },
    { name: 'Concluída', value: cult.prontas, fill: COR_LAUDO },
  ];

  return (
    <div className="max-w-6xl mx-auto pt-4 sm:pt-6 pb-10 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Indicadores</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produtividade, culturas e temperatura do laboratório</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de período (segmentado) — presets + ícone de intervalo personalizado */}
          <div className="relative" ref={customRef}>
            <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              {PERIODOS.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => {
                    setPreset(p.dias as PeriodoPreset);
                    setOpenCustom(false);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    preset === p.dias
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={toggleCustom}
                aria-label="Intervalo personalizado"
                title="Intervalo personalizado"
                className={`px-3 py-1.5 flex items-center border-l border-gray-200 dark:border-gray-600 transition-colors ${
                  preset === 'custom'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <CalendarRange className="w-4 h-4" />
              </button>
            </div>

            {/* Card flutuante do intervalo personalizado */}
            {openCustom && (
              <div className="absolute top-full left-0 mt-2 z-30 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl shadow-black/10 w-64 max-w-[calc(100vw-2rem)]">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Intervalo personalizado</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{range.dias} dia(s)</span>
                </div>
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    De
                    <input
                      type="date"
                      value={customIni}
                      max={customFim || undefined}
                      onChange={(e) => setCustomIni(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                    Até
                    <input
                      type="date"
                      value={customFim}
                      min={customIni || undefined}
                      onChange={(e) => setCustomFim(e.target.value)}
                      className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <Kpi icon={<CalendarClock className="w-5 h-5" />} label="Agendamentos" valor={prod.total} cor="from-blue-500 to-indigo-600" />
            <Kpi icon={<Droplets className="w-5 h-5" />} label="Coletas" valor={prod.coletas} cor="from-cyan-500 to-blue-600" />
            <Kpi
              icon={<TrendingUp className="w-5 h-5" />}
              label="Conversão"
              valor={`${prod.conversao}%`}
              sub="recebido→coletado"
              cor="from-emerald-500 to-green-600"
            />
            <Kpi
              icon={<XCircle className="w-5 h-5" />}
              label="Cancelamentos"
              valor={`${prod.cancelPct}%`}
              sub={`${prod.cancelados} de ${prod.total}`}
              cor="from-slate-500 to-gray-600"
            />
            <Kpi
              icon={<Microscope className="w-5 h-5" />}
              label="Culturas ativas"
              valor={cult.emAndamento}
              sub={cult.atrasadas ? `${cult.atrasadas} atrasadas` : 'em dia'}
              cor="from-violet-500 to-purple-600"
            />
            <Kpi
              icon={<Thermometer className="w-5 h-5" />}
              label="Temp. fora de faixa"
              valor={`${temp.foraPct}%`}
              sub={`${temp.fora} de ${temp.total}`}
              cor="from-amber-500 to-orange-500"
            />
          </div>

          {/* Alertas do processo — exigem ação agora */}
          <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 mb-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Alertas do processo</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Exigem ação agora · temperatura, culturas, recepção e insumos
                </p>
              </div>
              {alertas.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" /> {alertas.length}
                </span>
              )}
            </div>
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum alerta — tudo em dia 👍</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertas.slice(0, 8).map((a) => {
                  const tone = ALERTA_TONE[a.tone];
                  return (
                    <div key={a.key} className={`flex items-center gap-3 p-3 rounded-xl border ${tone.row}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 ${tone.icon}`}>
                        {a.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{a.titulo}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.detalhe}</div>
                      </div>
                    </div>
                  );
                })}
                {alertas.length > 8 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 pt-1 text-center">
                    +{alertas.length - 8} outro(s) alerta(s)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Produtividade — série diária (largura total) */}
          <div className="mb-4">
            <ChartCard titulo="Produtividade" sub={`Agendamentos × coletas por dia · ${range.dias} dias`}>
              {prod.total === 0 && prod.coletas === 0 ? (
                <VazioGrafico icon={<CalendarClock className="w-6 h-6" />} texto="Sem agendamentos ou coletas no período." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={serie} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COR_AGENDAMENTOS} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COR_AGENDAMENTOS} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradCo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COR_COLETAS} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COR_COLETAS} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="dia" tick={axisTick} interval={serieInterval} tickLine={false} axisLine={{ stroke: gridColor }} />
                    <YAxis tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="agendamentos"
                      name="Agendamentos"
                      stroke={COR_AGENDAMENTOS}
                      strokeWidth={2}
                      fill="url(#gradAg)"
                    />
                    <Area
                      type="monotone"
                      dataKey="coletas"
                      name="Coletas"
                      stroke={COR_COLETAS}
                      strokeWidth={2}
                      fill="url(#gradCo)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Produtividade por posto — coletas concluídas ÷ agendadas */}
          <div className="mb-4">
            <ChartCard titulo="Produtividade por posto" sub={`Coletas concluídas por posto — meta ${META_POSTO}%`}>
              {porPosto.length === 0 ? (
                <VazioGrafico icon={<Building2 className="w-6 h-6" />} texto="Sem agendamentos por posto no período." />
              ) : (
                <div className="space-y-4">
                  {porPosto.map((p) => {
                    const barTone =
                      p.pct >= META_POSTO
                        ? 'from-emerald-400 to-green-600'
                        : p.pct >= 50
                          ? 'from-blue-400 to-indigo-600'
                          : 'from-amber-400 to-orange-500';
                    const pctTone =
                      p.pct >= META_POSTO
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : p.pct >= 50
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400';
                    return (
                      <div key={p.nome}>
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{p.nome}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                            {p.coletados}/{p.total} · <b className={pctTone}>{p.pct}%</b>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-all duration-700`}
                            style={{ width: `${Math.max(2, p.pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </div>

          {/* Culturas + Temperatura */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartCard titulo="Culturas por status" sub={`${cult.total} em acompanhamento · ${cult.atrasadas} atrasadas`}>
              {cult.total === 0 ? (
                <VazioGrafico icon={<Microscope className="w-6 h-6" />} texto="Nenhuma cultura em acompanhamento." />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-full sm:w-1/2 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donut}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {donut.map((d) => (
                            <Cell key={d.name} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{cult.total}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">culturas</span>
                    </div>
                  </div>
                  {/* Legenda com contagens (identidade não fica só na cor) */}
                  <div className="w-full sm:w-1/2 space-y-2">
                    {donut.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.fill }} />
                          {d.name}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            <ChartCard titulo="Temperatura — excursões por equipamento" sub={`${temp.fora} leitura(s) fora de faixa · ${temp.foraPct}% do total`}>
              {temp.barras.length === 0 ? (
                <VazioGrafico
                  icon={<Thermometer className="w-6 h-6" />}
                  texto={temp.total === 0 ? 'Sem leituras no período.' : 'Nenhuma excursão no período. 👍'}
                />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={temp.barras} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nome" tick={axisTick} width={110} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} cursor={{ fill: gridColor }} />
                    <Bar dataKey="valor" name="Excursões" fill={COR_ALERTA} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="valor" position="right" style={{ fill: axisTick.fill, fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Exames + Recepção */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartCard titulo="Exames mais solicitados" sub={`Top ${topExames.length} no período`}>
              {topExames.length === 0 ? (
                <VazioGrafico icon={<FlaskConical className="w-6 h-6" />} texto="Nenhum exame registrado no período." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topExames} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nome" tick={axisTick} width={130} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} cursor={{ fill: gridColor }} />
                    <Bar dataKey="valor" name="Solicitações" fill={COR_EXAMES} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="valor" position="right" style={{ fill: axisTick.fill, fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard titulo="Recepção — motivos de bloqueio" sub={`${recepcao.problemas} de ${recepcao.total} conferências com problema · ${recepcao.pct}%`}>
              {recepcao.total === 0 ? (
                <VazioGrafico icon={<ClipboardCheck className="w-6 h-6" />} texto="Sem conferências de recepção no período." />
              ) : recepcao.barras.length === 0 ? (
                <VazioGrafico icon={<ClipboardCheck className="w-6 h-6" />} texto="Nenhum bloqueio na recepção. 👍" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={recepcao.barras} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="nome" tick={axisTick} width={130} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItem} labelStyle={tooltipLabel} cursor={{ fill: gridColor }} />
                    <Bar dataKey="valor" name="Bloqueios" fill={COR_PROBLEMA} radius={[0, 4, 4, 0]} barSize={16}>
                      <LabelList dataKey="valor" position="right" style={{ fill: axisTick.fill, fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Placeholders — KPIs sem fonte de dado ainda (§1 do plano da Fase 8) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Placeholder
              icon={<RotateCcw className="w-5 h-5" />}
              titulo="Recoletas"
              motivo="Aguardando a Fase 6B (o gatilho da recoleta ainda será definido)."
            />
            <Placeholder
              icon={<Trash2 className="w-5 h-5" />}
              titulo="Desperdício"
              motivo="Insumo baixado mas não usado — depende de marcar a baixa como desperdício no modelo."
            />
          </div>
        </>
      )}
    </div>
  );
};

export default IndicadoresPage;
