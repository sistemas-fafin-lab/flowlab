import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Boxes,
  Package,
  AlertTriangle,
  Clock,
  TrendingDown,
  PackageCheck,
  History as HistoryIcon,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';
import { DepartmentLabels, type Department } from '../types';

/**
 * Fase 5 (§4.2) — Estoque Departamental.
 * Visão do estoque em posse de um setor com controle de consumo
 * (controla_consumo=true): saldo por insumo (product_stock do local), validade,
 * estoque mínimo e status. O setor registra o consumo real (baixa `out` a partir
 * do seu local). "Consumos recentes" = histórico de out do local.
 *
 * Layout baseado na tela "Estoque departamental" do protótipo do time
 * (import_files/flowlab-telas), adaptado ao design system de produção.
 */

type Tone = 'blue' | 'green' | 'amber' | 'red';

type StockRow = {
  productId: string;
  productName: string;
  unit: string;
  code: string;
  quantity: number;
  minStock: number;
  expirationDate?: string;
  category?: string;
};

// Tipo da saída — opções fixas no front. "transferencia" gera um movimento de
// transferência (type:'transfer'); "vencimento" e "consumo" geram baixa (type:'out').
type SaidaTipo = 'vencimento' | 'transferencia' | 'consumo';

const TIPO_OPTS: { value: SaidaTipo; label: string }[] = [
  { value: 'vencimento', label: 'Vencimento' },
  { value: 'transferencia', label: 'Transferência interna' },
  { value: 'consumo', label: 'Consumo' },
];

type SaidaForm = { quantity: number; tipo: SaidaTipo; destinationId: string; notes: string };

const EMPTY_FORM: SaidaForm = { quantity: 0, tipo: 'consumo', destinationId: '', notes: '' };

// dias até a validade (negativo = vencido)
const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const CHIP_CLASSES: Record<Tone, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  green: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

const METER_CLASSES: Record<Tone, string> = {
  blue: 'from-blue-500 to-indigo-500',
  green: 'from-emerald-500 to-green-500',
  amber: 'from-amber-500 to-orange-500',
  red: 'from-red-500 to-rose-500',
};

const Meter: React.FC<{ value: number; tone: Tone }> = ({ value, tone }) => (
  <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
    <div
      className={`h-full rounded-full bg-gradient-to-r ${METER_CLASSES[tone]} transition-all`}
      style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
    />
  </div>
);

const Chip: React.FC<{ tone: Tone; icon?: React.ReactNode; children: React.ReactNode }> = ({ tone, icon, children }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${CHIP_CLASSES[tone]}`}>
    {icon}
    {children}
  </span>
);

// ── Skeletons de carregamento ─────────────────────────────────────────────
// Barra base de placeholder (animate-pulse). Usada para montar o esqueleto que
// espelha a estrutura real da tela enquanto o inventário/estoque carrega.
const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`} />
);

// Card de KPI em estado de carregamento (mesma moldura do StatCard).
const StatCardSkeleton: React.FC = () => (
  <div className="relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-sm p-4 sm:p-5 border border-white/50 dark:border-slate-700/50">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-14" />
        <Bar className="h-2.5 w-20" />
      </div>
      <Bar className="w-10 h-10 rounded-xl flex-shrink-0" />
    </div>
  </div>
);

// Linhas de placeholder para a tabela de insumos (espelha as colunas Insumo,
// Quantidade, Validade, Status, Ação). Reutilizado no load do setor.
const TableRowsSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="divide-y divide-gray-100 dark:divide-gray-700">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="px-5 py-3.5 flex items-center gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <Bar className="h-4 w-40 max-w-full" />
          <Bar className="h-3 w-20" />
        </div>
        <div className="w-24 space-y-1.5 hidden sm:block">
          <Bar className="h-4 w-16" />
          <Bar className="h-1.5 w-20" />
        </div>
        <Bar className="h-4 w-20 hidden md:block" />
        <Bar className="h-6 w-24 rounded-full flex-shrink-0" />
      </div>
    ))}
  </div>
);

// Esqueleto completo da tela — cabeçalho, KPIs e as duas colunas (insumos +
// movimentações). Exibido no load inicial do inventário.
const EstoqueSkeleton: React.FC = () => (
  <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    {/* Cabeçalho */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <Bar className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="space-y-2">
          <Bar className="h-6 w-52" />
          <Bar className="h-3.5 w-64 max-w-[70vw]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Bar className="h-2.5 w-12" />
        <Bar className="h-11 w-full sm:w-64 rounded-xl" />
      </div>
    </div>

    {/* KPIs */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>

    {/* Colunas: insumos + movimentações */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Bar className="w-5 h-5 rounded" />
          <div className="space-y-1.5">
            <Bar className="h-4 w-36" />
            <Bar className="h-3 w-56 max-w-[60vw]" />
          </div>
        </div>
        <TableRowsSkeleton rows={5} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
          <div className="flex items-center gap-2">
            <Bar className="w-5 h-5 rounded" />
            <Bar className="h-4 w-44" />
          </div>
          <Bar className="h-9 w-full rounded-lg" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <Bar className="h-4 w-32" />
                <Bar className="h-3 w-24" />
              </div>
              <Bar className="h-4 w-8 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const StatCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  hint?: string;
  gradient: string;
  textColor: string;
}> = ({ icon: Icon, value, label, hint, gradient, textColor }) => (
  <div className="relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-sm p-4 sm:p-5 border border-white/50 dark:border-slate-700/50">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{label}</p>
        <p className={`text-3xl font-extrabold tracking-tight ${textColor} mt-1`}>{value}</p>
        {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
      </div>
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const EstoqueDepartamental: React.FC = () => {
  const { products, locations, movements, addMovement, fetchLocationStock, updateLocationMinStock, fetchLocations, loading } = useInventory();
  const { showSuccess, showError } = useNotification();
  const { userProfile } = useAuth();

  // Permissão dedicada para registrar consumo (baixa). Ver acesso = canViewStockDepart (na rota).
  const canConsume = hasPermission(userProfile?.permissions || [], 'canConsumeStockDepart');

  // Cada pessoa enxerga apenas o estoque do seu próprio setor. O admin mantém a
  // visão de todos os setores (supervisão). O setor da pessoa é o local com
  // controla_consumo cujo `department` bate com o department do perfil — o perfil
  // guarda o enum (ex.: QUALIDADE) e o local guarda o rótulo (ex.: Qualidade).
  const isAdmin = userProfile?.role === 'admin';
  const userDept = userProfile?.department;
  // department pode vir como enum ('QUALIDADE') ou como rótulo ('Qualidade');
  // normaliza sempre para o rótulo (formato guardado em stock_locations.department).
  const userDeptLabel = userDept
    ? ((DepartmentLabels as Partial<Record<Department, string>>)[userDept] ?? userDept)
    : undefined;
  // Qualidade é o estoque central que distribui para os postos: além do próprio
  // estoque, enxerga o de todos os postos (supervisão + transferência).
  const isQualidade = userDeptLabel === 'Qualidade';

  const setores = useMemo(() => {
    const comConsumo = locations.filter(l => l.controlaConsumo && l.rastreavel && l.ativo);
    if (isAdmin) return comConsumo;
    if (isQualidade) {
      // Qualidade central + todos os postos (qualquer local ativo com posto_id).
      return locations.filter(l => l.ativo && (l.department === userDeptLabel || !!l.postoId));
    }
    // Demais setores: apenas o próprio departamento.
    return comConsumo.filter(l => l.department === userDeptLabel || l.department === userDept);
  }, [locations, isAdmin, isQualidade, userDept, userDeptLabel]);

  const [selectedSector, setSelectedSector] = useState('');
  const [baseRows, setBaseRows] = useState<{ productId: string; productName: string; unit: string; code: string; quantity: number; minStock: number }[]>([]);
  // Edição inline do mínimo por local: guarda o productId em edição e o texto do input.
  const [editandoMin, setEditandoMin] = useState<{ productId: string; valor: string } | null>(null);
  const [salvandoMin, setSalvandoMin] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  // Modal de registro/confirmação do consumo (espelha o "Registrar Saída")
  const [pendingConsumo, setPendingConsumo] = useState<StockRow | null>(null);
  const [form, setForm] = useState<SaidaForm>(EMPTY_FORM);
  const [confirming, setConfirming] = useState(false);
  // Filtro do histórico: tudo (padrão), saídas ou entradas.
  const [histFilter, setHistFilter] = useState<'saidas' | 'entradas' | 'tudo'>('tudo');

  const loadStock = useCallback(async (sectorId: string) => {
    if (!sectorId) { setBaseRows([]); return; }
    setLoadingStock(true);
    try {
      const rows = await fetchLocationStock(sectorId);
      setBaseRows(rows);
    } catch (e) {
      console.error(e);
      showError('Erro ao carregar o estoque do setor');
    } finally {
      setLoadingStock(false);
    }
  }, [fetchLocationStock, showError]);

  // Recarrega os locais ao abrir a tela: postos criados/alterados (via módulo de
  // coleta ou SQL direto) aparecem sem depender do cache de locais do useInventory.
  useEffect(() => {
    fetchLocations().catch(err => console.error('Falha ao recarregar locais:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSector && setores.length > 0) setSelectedSector(setores[0].id);
  }, [setores, selectedSector]);

  useEffect(() => {
    setPendingConsumo(null);
    loadStock(selectedSector);
  }, [selectedSector, loadStock]);

  const selectedSectorObj = setores.find(s => s.id === selectedSector);
  const sectorName = selectedSectorObj?.nome ?? '';
  // Postos (posto_id definido) só dão baixa (consumo/vencimento); não transferem.
  const isPostoSector = !!selectedSectorObj?.postoId;
  // Opções de tipo por setor: posto não tem "Transferência interna".
  const tipoOpts = isPostoSector ? TIPO_OPTS.filter(o => o.value !== 'transferencia') : TIPO_OPTS;

  // Enriquece o saldo do local com dados do produto (validade, categoria). O mínimo é o
  // POR LOCAL (product_stock.min_stock, já em baseRows), não o global do produto.
  const stockRows: StockRow[] = useMemo(() => {
    return baseRows.map(r => {
      const p = products.find(prod => prod.id === r.productId);
      return {
        ...r,
        minStock: r.minStock,
        expirationDate: p?.expirationDate,
        category: p?.category,
      };
    });
  }, [baseRows, products]);

  // Salva o mínimo por local do insumo em edição e recarrega o estoque do setor.
  const salvarMin = useCallback(async (productId: string) => {
    if (!editandoMin || editandoMin.productId !== productId) return;
    const valor = Math.max(0, Math.floor(Number(editandoMin.valor)));
    if (Number.isNaN(valor)) { setEditandoMin(null); return; }
    setSalvandoMin(true);
    try {
      await updateLocationMinStock(productId, selectedSector, valor);
      setEditandoMin(null);
      await loadStock(selectedSector);
      showSuccess('Mínimo do local atualizado');
    } catch (e) {
      console.error(e);
      showError('Erro ao salvar o mínimo do local');
    } finally {
      setSalvandoMin(false);
    }
  }, [editandoMin, updateLocationMinStock, selectedSector, loadStock, showSuccess, showError]);

  // Status por linha (validade tem prioridade sobre estoque baixo)
  const rowStatus = (row: StockRow): { tone: Tone; label: string } => {
    const dias = daysUntil(row.expirationDate);
    if (dias !== null && dias < 0) return { tone: 'red', label: 'Vencido' };
    if (dias !== null && dias <= 30) return { tone: 'red', label: `Vence em ${dias}d` };
    if (row.minStock > 0 && row.quantity < row.minStock) return { tone: 'amber', label: 'Estoque baixo' };
    return { tone: 'green', label: 'Ativo' };
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const abaixoMinimo = stockRows.filter(r => r.minStock > 0 && r.quantity < r.minStock).length;
  const vencimentoProximo = stockRows.filter(r => {
    const dias = daysUntil(r.expirationDate);
    return dias !== null && dias >= 0 && dias <= 30;
  }).length;

  // "Saídas recentes" = tudo que sai do local do setor: baixas (out = consumo/
  // vencimento) e transferências internas (transfer). Ordenado por data desc.
  const saidasHistorico = useMemo(
    () => movements
      .filter(m => m.fromLocationId === selectedSector && (m.type === 'out' || m.type === 'transfer'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [movements, selectedSector]
  );
  // KPI "Consumido no mês": apenas baixas (out) do setor no mês corrente.
  const consumidoNoMes = useMemo(() => {
    const now = new Date();
    return saidasHistorico
      .filter(m => m.type === 'out')
      .filter(m => {
        const d = new Date(m.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, m) => sum + m.quantity, 0);
  }, [saidasHistorico]);

  // "Entradas recentes" = o que o setor recebeu: recebimento (in) ou transferência
  // recebida (transfer com to_location = setor). Ordenado por data desc.
  const entradasHistorico = useMemo(
    () => movements
      .filter(m => m.toLocationId === selectedSector && (m.type === 'in' || m.type === 'transfer'))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [movements, selectedSector]
  );

  // Lista exibida conforme o filtro. Saídas e entradas são disjuntas para um mesmo
  // setor (não dá para transferir para si), então "tudo" só concatena e reordena.
  const historico = useMemo(() => {
    if (histFilter === 'saidas') return saidasHistorico;
    if (histFilter === 'entradas') return entradasHistorico;
    return [...saidasHistorico, ...entradasHistorico]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [histFilter, saidasHistorico, entradasHistorico]);

  // ── Consumo ───────────────────────────────────────────────────────────────
  const openConsumo = (row: StockRow) => {
    if (!canConsume) return;
    setPendingConsumo(row);
    setForm(EMPTY_FORM);
  };

  const closeConsumo = () => {
    if (confirming) return;
    setPendingConsumo(null);
    setForm(EMPTY_FORM);
  };

  const confirmConsumo = async () => {
    if (!pendingConsumo) return;
    if (!canConsume) { showError('Você não tem permissão para registrar consumo'); return; }
    const qty = form.quantity;
    if (qty <= 0) { showError('Informe uma quantidade válida'); return; }
    if (qty > pendingConsumo.quantity) { showError('Quantidade maior que o saldo do setor'); return; }
    const userName = userProfile?.name?.trim();
    if (!userName) { showError('Não foi possível identificar o usuário logado'); return; }
    const isTransfer = form.tipo === 'transferencia';
    if (isTransfer && isPostoSector) { showError('Postos não transferem — registre consumo ou vencimento'); return; }
    if (isTransfer && !form.destinationId) { showError('Escolha o local de destino da transferência'); return; }
    setConfirming(true);
    try {
      const product = products.find(p => p.id === pendingConsumo.productId);
      const unitPrice = product?.unitPrice ?? 0;
      const destName = destinos.find(l => l.id === form.destinationId)?.nome ?? '';
      const tipoLabel = TIPO_OPTS.find(o => o.value === form.tipo)?.label ?? '';
      await addMovement({
        productId: pendingConsumo.productId,
        productName: pendingConsumo.productName,
        type: isTransfer ? 'transfer' : 'out',
        reason: isTransfer ? 'internal-transfer' : (form.tipo === 'vencimento' ? 'other' : 'internal-consumption'),
        quantity: qty,
        date: new Date().toISOString().split('T')[0],
        fromLocationId: selectedSector,
        toLocationId: isTransfer ? form.destinationId : undefined,
        authorizedBy: userName,
        notes: [
          isTransfer ? `Transferência do setor ${sectorName} para ${destName}` : `Saída (${tipoLabel}) do setor ${sectorName}`,
          form.notes.trim(),
        ].filter(Boolean).join(' · '),
        unitPrice,
        totalValue: qty * unitPrice,
      });
      showSuccess(isTransfer
        ? `Transferência registrada: ${qty} ${pendingConsumo.unit} de ${pendingConsumo.productName} → ${destName}`
        : `Saída registrada (${tipoLabel}): ${qty} ${pendingConsumo.unit} de ${pendingConsumo.productName}`);
      setPendingConsumo(null);
      setForm(EMPTY_FORM);
      await loadStock(selectedSector);
    } catch (e) {
      console.error(e);
      showError('Erro ao registrar consumo', 'Tente novamente.');
    } finally {
      setConfirming(false);
    }
  };

  const saldoApos = pendingConsumo ? pendingConsumo.quantity - form.quantity : 0;

  // Destinos possíveis para transferência.
  // Qualidade distribui para os postos → destino = locais com posto_id.
  // Demais setores → qualquer local ativo diferente do próprio.
  const destinos = useMemo(() => {
    const sel = locations.find(l => l.id === selectedSector);
    if (sel?.department === 'Qualidade') {
      return locations.filter(l => l.ativo && !!l.postoId && l.id !== selectedSector);
    }
    return locations.filter(l => l.ativo && l.id !== selectedSector);
  }, [locations, selectedSector]);

  if (loading) {
    return <EstoqueSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/25">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Estoque Departamental</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Insumos em posse do setor — saldo, validade e consumo.</p>
          </div>
        </div>
        {/* Setor: admin escolhe entre todos; demais veem só o próprio (fixo). */}
        {setores.length > 1 ? (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Setor</label>
            <div className="relative w-full sm:w-64">
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 text-sm rounded-xl appearance-none cursor-pointer bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:[color-scheme:dark]"
              >
                {setores.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        ) : setores.length === 1 ? (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Setor</label>
            <div className="w-full sm:w-64 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="truncate font-medium">{setores[0].nome}</span>
            </div>
          </div>
        ) : null}
      </div>

      {setores.length === 0 ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-amber-800 dark:text-amber-300">
          {isAdmin ? (
            <>
              Nenhum setor com controle de consumo configurado. Um administrador precisa habilitar
              <code className="mx-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">controla_consumo</code>
              para o departamento desejado.
            </>
          ) : (
            <>
              Seu setor{userDeptLabel ? ` (${userDeptLabel})` : ''} não possui estoque departamental
              configurado. Fale com um administrador para habilitar o controle de consumo do seu departamento.
            </>
          )}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Package}
              value={stockRows.length}
              label="Itens no setor"
              hint={sectorName}
              gradient="from-blue-500 to-indigo-500"
              textColor="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={AlertTriangle}
              value={abaixoMinimo}
              label="Abaixo do mínimo"
              hint="repor com o principal"
              gradient="from-amber-500 to-orange-500"
              textColor="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={Clock}
              value={vencimentoProximo}
              label="Vencimento próximo"
              hint="≤ 30 dias"
              gradient="from-red-500 to-rose-500"
              textColor="text-red-600 dark:text-red-400"
            />
            <StatCard
              icon={TrendingDown}
              value={consumidoNoMes}
              label="Consumido no mês"
              hint="baixas do setor"
              gradient="from-emerald-500 to-green-500"
              textColor="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Insumos do subdepartamento */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">Insumos do setor</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Saldo em posse, validade e estoque mínimo</p>
                </div>
              </div>

              {loadingStock ? (
                <TableRowsSkeleton rows={5} />
              ) : stockRows.length === 0 ? (
                <div className="p-6 text-gray-500 dark:text-gray-400">Nada em posse do setor no momento.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                        <th className="px-5 py-2.5 font-semibold">Insumo</th>
                        <th className="px-3 py-2.5 font-semibold">Quantidade</th>
                        <th className="px-3 py-2.5 font-semibold">Validade</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        {canConsume && <th className="px-5 py-2.5 font-semibold text-right">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stockRows.map(row => {
                        const st = rowStatus(row);
                        const dias = daysUntil(row.expirationDate);
                        const low = row.minStock > 0 && row.quantity < row.minStock;
                        const meterMax = row.minStock > 0 ? row.minStock * 1.6 : row.quantity || 1;
                        return (
                          <tr key={row.productId} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-800 dark:text-gray-100">{row.productName}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{row.code}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`font-bold tabular-nums ${low ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'}`}>
                                {row.quantity} {row.unit}
                              </span>
                              <div className="mt-1.5 w-20">
                                <Meter value={(row.quantity / meterMax) * 100} tone={low ? 'amber' : 'green'} />
                              </div>
                              {editandoMin?.productId === row.productId ? (
                                <input
                                  type="number"
                                  min={0}
                                  autoFocus
                                  disabled={salvandoMin}
                                  value={editandoMin.valor}
                                  onChange={(e) => setEditandoMin({ productId: row.productId, valor: e.target.value })}
                                  onBlur={() => void salvarMin(row.productId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') void salvarMin(row.productId);
                                    if (e.key === 'Escape') setEditandoMin(null);
                                  }}
                                  className="mt-1 w-16 px-1.5 py-0.5 text-[11px] rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 tabular-nums"
                                  aria-label="Mínimo do local"
                                />
                              ) : canConsume ? (
                                <button
                                  type="button"
                                  onClick={() => setEditandoMin({ productId: row.productId, valor: row.minStock ? String(row.minStock) : '' })}
                                  className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted underline-offset-2"
                                  title="Definir o mínimo deste insumo neste local"
                                >
                                  {row.minStock > 0 ? `mín. ${row.minStock}` : 'definir mín.'}
                                </button>
                              ) : (
                                row.minStock > 0 && (
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">mín. {row.minStock}</p>
                                )
                              )}
                            </td>
                            <td className={`px-3 py-3 tabular-nums ${dias !== null && dias <= 30 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}>
                              {row.expirationDate
                                ? new Date(row.expirationDate).toLocaleDateString('pt-BR')
                                : '—'}
                            </td>
                            <td className="px-3 py-3">
                              <Chip
                                tone={st.tone}
                                icon={
                                  st.tone === 'green'
                                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                                    : st.tone === 'red'
                                      ? <Clock className="w-3.5 h-3.5" />
                                      : <AlertTriangle className="w-3.5 h-3.5" />
                                }
                              >
                                {st.label}
                              </Chip>
                            </td>
                            {canConsume && (
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => openConsumo(row)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium hover:from-blue-600 hover:to-indigo-600 transition-all"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  Registrar saída
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Movimentações recentes — saídas, entradas ou tudo */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5 text-gray-400" />
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">Movimentações recentes</h2>
                </div>
                {/* Filtro segmentado */}
                <div className="flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-xs font-medium">
                  {([
                    { value: 'tudo', label: 'Tudo' },
                    { value: 'saidas', label: 'Saídas' },
                    { value: 'entradas', label: 'Entradas' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setHistFilter(opt.value)}
                      className={`flex-1 px-2 py-1.5 rounded-md transition-colors ${
                        histFilter === opt.value
                          ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {historico.length === 0 ? (
                <div className="p-6 text-gray-500 dark:text-gray-400 text-sm">
                  {histFilter === 'entradas'
                    ? 'Nenhuma entrada registrada ainda.'
                    : histFilter === 'saidas'
                      ? 'Nenhuma saída registrada ainda.'
                      : 'Nenhuma movimentação registrada ainda.'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
                  {historico.slice(0, 30).map(m => {
                    const isEntrada = m.toLocationId === selectedSector;
                    const tipoLabel = m.type === 'transfer'
                      ? 'Transferência'
                      : isEntrada
                        ? 'Entrada'
                        : m.reason === 'other' ? 'Vencimento' : 'Consumo';
                    return (
                      <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{m.productName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(m.date).toLocaleDateString('pt-BR')} · {tipoLabel}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold whitespace-nowrap ${isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          {isEntrada ? '+' : '−'}{m.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de registro/confirmação do consumo */}
      {pendingConsumo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Registrar saída</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{sectorName}</p>
              </div>
            </div>
            {/* Body — espelha o "Registrar Saída" */}
            <div className="px-6 py-5 space-y-4">
              {/* Produto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Produto</label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200">
                  {pendingConsumo.productName} — {pendingConsumo.code}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Saldo disponível: {pendingConsumo.quantity} {pendingConsumo.unit}
                </p>
              </div>

              {/* Local de origem (fixo = setor) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Local de origem</label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  {sectorName}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">O consumo sai do estoque deste setor.</p>
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantidade *</label>
                <input
                  type="number"
                  autoFocus
                  min={1}
                  max={pendingConsumo.quantity}
                  value={form.quantity || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Saldo após:{' '}
                  <span className={saldoApos < 0 ? 'text-red-500 font-semibold' : 'font-medium text-gray-700 dark:text-gray-200'}>
                    {saldoApos} {pendingConsumo.unit}
                  </span>
                </p>
              </div>

              {/* Tipo da saída — define o movimento (baixa ou transferência) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tipo *</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value as SaidaTipo, destinationId: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {tipoOpts.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {form.tipo === 'transferencia'
                    ? 'O item sai do setor e entra no local de destino.'
                    : 'O item sai do estoque do setor (baixa).'}
                </p>
              </div>

              {/* Local de destino (só na transferência) */}
              {form.tipo === 'transferencia' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Local de destino *</label>
                  <select
                    value={form.destinationId}
                    onChange={(e) => setForm(prev => ({ ...prev, destinationId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione…</option>
                    {destinos.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.nome}{!l.rastreavel ? ' (sem rastreamento)' : ''}
                      </option>
                    ))}
                  </select>
                  {/* Aviso §4.1: destino não-rastreável (ex.: Copa) não guarda saldo */}
                  {form.destinationId && destinos.find(l => l.id === form.destinationId)?.rastreavel === false && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>{destinos.find(l => l.id === form.destinationId)?.nome}</strong> não possui
                        rastreamento de saldo. O item sairá do total controlado e não poderá ser conferido depois.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Autorizado por — fixo no usuário logado (não editável) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Autorizado por</label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200">
                  {userProfile?.name ?? '—'}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Registrado automaticamente com o usuário logado.</p>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Informações adicionais (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={closeConsumo}
                disabled={confirming}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmConsumo}
                disabled={confirming || form.quantity <= 0 || form.quantity > pendingConsumo.quantity || (form.tipo === 'transferencia' && !form.destinationId)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? 'Registrando…' : 'Registrar saída'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueDepartamental;
