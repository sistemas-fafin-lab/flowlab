import React, { useEffect, useMemo, useState } from 'react';
import {
  Droplets,
  MapPin,
  Phone,
  RefreshCw,
  X,
  ClipboardCheck,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Plus,
  Trash2,
  Loader2,
  FlaskConical,
  Contact,
  FileText,
  Utensils,
  ShieldCheck,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { usePostos } from '../hooks/usePostos';
import { useColetas } from '../hooks/useColetas';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import {
  CHECKLIST_RECEPCAO,
  type AcAgendamento,
  type AcCheckin,
  type ChecklistItemKey,
  type InsumoInput,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Data de hoje em YYYY-MM-DD no fuso local (en-CA usa o formato ISO).
const hojeISO = () => new Date().toLocaleDateString('en-CA');

const fmtTelefone = (tel: string): string => {
  let d = tel.replace(/\D/g, '');
  if (d.length === 13 || d.length === 12) d = d.replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
};

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Rótulo de uma chave do checklist (p/ exibir nos bloqueados).
const CHECKLIST_LABEL: Record<string, string> = Object.fromEntries(
  CHECKLIST_RECEPCAO.map((i) => [i.key, i.label]),
);

interface StockItem {
  productId: string;
  productName: string;
  unit: string;
  code: string;
  quantity: number;
}

// Linha crua da query de saldo (product_stock + join em products).
interface StockQueryRow {
  product_id: string;
  quantity: number;
  products: { name: string | null; unit: string | null; code: string | null } | null;
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────────
const Avatar: React.FC<{ nome: string; gradient: string }> = ({ nome, gradient }) => (
  <div
    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm`}
  >
    {iniciais(nome)}
  </div>
);

// Cabeçalho compacto de um agendamento (nome · posto · telefone · horário).
const AgHeader: React.FC<{ ag: AcAgendamento; gradient: string }> = ({ ag, gradient }) => (
  <div className="flex items-center gap-4 min-w-0 flex-1">
    <Avatar nome={ag.paciente_nome} gradient={gradient} />
    <div className="min-w-0 flex-1">
      <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
        {ag.paciente_nome}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-gray-400" />
          {ag.local_posto || '—'}
        </span>
        {ag.paciente_telefone && (
          <span className="inline-flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {fmtTelefone(ag.paciente_telefone)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 tabular-nums">
          {fmtHora(ag.data_hora)} · {fmtData(ag.data_hora)}
        </span>
      </div>
    </div>
  </div>
);

// Container de uma fila (título + ícone + contador + linhas).
const Fila: React.FC<{
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  cor: string; // gradiente do ícone
  count: number;
  vazio: string;
  children: React.ReactNode;
}> = ({ titulo, descricao, icon, cor, count, vazio, children }) => (
  <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-fade-in-up">
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white bg-gradient-to-br ${cor}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{titulo}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{descricao}</p>
      </div>
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 tabular-nums">
        {count}
      </span>
    </div>
    {count === 0 ? (
      <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">{vazio}</div>
    ) : (
      <div>{children}</div>
    )}
  </div>
);

// ─── Página ───────────────────────────────────────────────────────────────────
const PainelColetasPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const coletorNome = userProfile?.name || user?.email || 'Sistema';

  const [postoSel, setPostoSel] = useState<string>(''); // ac_postos.id — '' = todos
  const [data, setData] = useState(hojeISO());

  const filtros = useMemo(
    () => ({ postoId: postoSel || undefined, data: data || undefined }),
    [postoSel, data],
  );
  const { agendamentos, loading, error, refetch } = useAgendamentos(filtros);
  const { postos } = usePostos();
  const { registrarCheckin, registrarColeta, fetchCheckins } = useColetas();

  const postosAtivos = useMemo(() => postos.filter((p) => p.ativo), [postos]);

  const aguardando = useMemo(() => agendamentos.filter((a) => a.status === 'recebido'), [agendamentos]);
  const liberados = useMemo(() => agendamentos.filter((a) => a.status === 'em_coleta'), [agendamentos]);
  const bloqueados = useMemo(() => agendamentos.filter((a) => a.status === 'bloqueado'), [agendamentos]);
  const coletadosN = useMemo(() => agendamentos.filter((a) => a.status === 'coletado').length, [agendamentos]);

  // Conferências dos bloqueados (p/ exibir o motivo). Refaz quando a lista muda.
  const [checkins, setCheckins] = useState<Record<string, AcCheckin>>({});
  const bloqIds = useMemo(() => bloqueados.map((a) => a.id).join(','), [bloqueados]);
  useEffect(() => {
    const ids = bloqIds ? bloqIds.split(',') : [];
    if (ids.length === 0) {
      setCheckins({});
      return;
    }
    let ativo = true;
    void fetchCheckins(ids).then((rows) => {
      if (!ativo) return;
      setCheckins(Object.fromEntries(rows.map((c) => [c.agendamento_id, c])));
    });
    return () => {
      ativo = false;
    };
  }, [bloqIds, fetchCheckins]);

  // Modais
  const [conferindo, setConferindo] = useState<AcAgendamento | null>(null);
  const [coletando, setColetando] = useState<AcAgendamento | null>(null);

  const posConcluir = async () => {
    setConferindo(null);
    setColetando(null);
    await refetch();
  };

  return (
    <div className="max-w-7xl mx-auto pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Coletas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Conferência de recepção e registro de coleta · baixa de insumos no posto
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* Filtros: posto + data */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={postoSel}
          onChange={(e) => setPostoSel(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os postos</option>
          {postosAtivos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
        />
        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 tabular-nums">
          <CheckCircle2 className="w-4 h-4" />
          {coletadosN} coletados
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          Falha ao carregar agendamentos: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Fila: aguardando conferência */}
          <Fila
            titulo="Aguardando conferência"
            descricao="Confira a recepção para liberar a coleta"
            icon={<ClipboardList className="w-[18px] h-[18px]" />}
            cor="from-blue-500 to-indigo-600"
            count={aguardando.length}
            vazio="Nenhum agendamento aguardando conferência."
          >
            {aguardando.map((ag, i) => (
              <div
                key={ag.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i === aguardando.length - 1 ? '' : 'border-b border-gray-100 dark:border-gray-700'
                }`}
              >
                <AgHeader ag={ag} gradient="from-blue-500 to-indigo-600" />
                <button
                  onClick={() => setConferindo(ag)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-blue-500 to-indigo-600 hover:opacity-90 transition-opacity shrink-0"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Conferência
                </button>
              </div>
            ))}
          </Fila>

          {/* Fila: liberados p/ coleta */}
          <Fila
            titulo="Liberados p/ coleta"
            descricao="Registre a coleta e a baixa de insumos"
            icon={<FlaskConical className="w-[18px] h-[18px]" />}
            cor="from-amber-400 to-orange-500"
            count={liberados.length}
            vazio="Nenhum agendamento liberado para coleta."
          >
            {liberados.map((ag, i) => (
              <div
                key={ag.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i === liberados.length - 1 ? '' : 'border-b border-gray-100 dark:border-gray-700'
                }`}
              >
                <AgHeader ag={ag} gradient="from-amber-400 to-orange-500" />
                <button
                  onClick={() => setColetando(ag)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-br from-amber-500 to-orange-500 hover:opacity-90 transition-opacity shrink-0"
                >
                  <Droplets className="w-4 h-4" />
                  Registrar coleta
                </button>
              </div>
            ))}
          </Fila>

          {/* Bloqueados (fora da fila de ação) */}
          {bloqueados.length > 0 && (
            <div className="lg:col-span-2">
              <Fila
                titulo="Bloqueados"
                descricao="Conferência com problema — fora da fila de coleta"
                icon={<Ban className="w-[18px] h-[18px]" />}
                cor="from-rose-500 to-red-600"
                count={bloqueados.length}
                vazio=""
              >
                {bloqueados.map((ag, i) => {
                  const ck = checkins[ag.id];
                  return (
                    <div
                      key={ag.id}
                      className={`flex items-center gap-4 px-5 py-4 ${
                        i === bloqueados.length - 1 ? '' : 'border-b border-gray-100 dark:border-gray-700'
                      }`}
                    >
                      <AgHeader ag={ag} gradient="from-rose-500 to-red-600" />
                      <div className="text-right shrink-0 max-w-[45%]">
                        {ck ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/60">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {CHECKLIST_LABEL[ck.problema_em ?? ''] ?? ck.problema_em}
                            </span>
                            {ck.problema_motivo && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                {ck.problema_motivo}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Bloqueado</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Fila>
            </div>
          )}
        </div>
      )}

      {conferindo && (
        <ConferenciaModal
          ag={conferindo}
          conferidoPor={coletorNome}
          onClose={() => setConferindo(null)}
          onDone={posConcluir}
          registrarCheckin={registrarCheckin}
        />
      )}
      {coletando && (
        <ColetaModal
          ag={coletando}
          coletorNome={coletorNome}
          onClose={() => setColetando(null)}
          onDone={posConcluir}
          registrarColeta={registrarColeta}
        />
      )}
    </div>
  );
};

// Ícone por item do checklist (só visual; a fonte dos itens é CHECKLIST_RECEPCAO).
const ITEM_ICON: Record<ChecklistItemKey, LucideIcon> = {
  identidade: Contact,
  guia: FileText,
  pedido_medico: ClipboardList,
  jejum: Utensils,
  termo: ShieldCheck,
};

// Anel de progresso "X/Y conferidos" do cabeçalho da conferência.
// "X/Y" fica sozinho e centralizado no anel; o rótulo "conferidos" vai abaixo,
// fora do círculo, para não amontoar/sobrepor o texto.
const ProgressRing: React.FC<{ done: number; total: number }> = ({ done, total }) => {
  const r = 27;
  const circ = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-white/15" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            className="text-emerald-400 transition-all duration-500"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-white tabular-nums leading-none">
            {done}/{total}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/60 leading-none">conferidos</span>
    </div>
  );
};

// ─── Modal: conferência de recepção ─────────────────────────────────────────────
const ConferenciaModal: React.FC<{
  ag: AcAgendamento;
  conferidoPor: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  registrarCheckin: ReturnType<typeof useColetas>['registrarCheckin'];
}> = ({ ag, conferidoPor, onClose, onDone, registrarCheckin }) => {
  const [checked, setChecked] = useState<Set<ChecklistItemKey>>(new Set());
  const [problemaMode, setProblemaMode] = useState(false);
  const [problemaEm, setProblemaEm] = useState<ChecklistItemKey | ''>('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosOk = checked.size === CHECKLIST_RECEPCAO.length;

  const toggle = (key: ChecklistItemKey) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const liberar = async () => {
    setSaving(true);
    setErro(null);
    const err = await registrarCheckin(ag.id, conferidoPor, 'liberado', null, null);
    setSaving(false);
    if (err) setErro(err);
    else await onDone();
  };

  const registrarProblema = async () => {
    if (!problemaEm || !motivo.trim()) return;
    setSaving(true);
    setErro(null);
    const err = await registrarCheckin(ag.id, conferidoPor, 'problema', problemaEm, motivo.trim());
    setSaving(false);
    if (err) setErro(err);
    else await onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] p-4 sm:p-5 flex flex-col gap-4">
        {/* Hero — dados do paciente que o FlowLab tem (§2.3: sem exames/idade/convênio) */}
        {/* ring sutil separa o hero (slate-900) da caixa do modal no dark (gray-900),
            onde o shadow-lg praticamente não aparece. */}
        <div className="relative rounded-2xl bg-slate-900 p-5 shadow-lg ring-1 ring-white/10 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md">
              {iniciais(ag.paciente_nome)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50 truncate">
                {ag.local_posto || '—'} · {fmtHora(ag.data_hora)}
              </div>
              <div className="text-lg font-bold text-white truncate">{ag.paciente_nome}</div>
              <div className="text-xs text-white/60 truncate">
                {ag.paciente_telefone ? fmtTelefone(ag.paciente_telefone) : fmtData(ag.data_hora)}
              </div>
            </div>
            <ProgressRing done={checked.size} total={CHECKLIST_RECEPCAO.length} />
          </div>
        </div>

        {/* Cartão: título + itens + rodapé */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 shrink-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Conferência de recepção</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {problemaMode ? 'Indique o item que impede a coleta' : 'Confira cada item antes de liberar a coleta'}
            </p>
          </div>

          <div className="px-5 space-y-2.5 overflow-y-auto flex-1">
            {!problemaMode ? (
              CHECKLIST_RECEPCAO.map((item) => {
                const on = checked.has(item.key);
                const Icon = ITEM_ICON[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all ${
                      on
                        ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/15 dark:border-emerald-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.descricao}</div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        on
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="space-y-3 pb-1">
                <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  O agendamento será bloqueado.
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Qual item falhou?
                  </label>
                  <select
                    value={problemaEm}
                    onChange={(e) => setProblemaEm(e.target.value as ChecklistItemKey)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o item…</option>
                    {CHECKLIST_RECEPCAO.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Motivo</label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Descreva o que impede a coleta…"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {erro && (
            <div className="mx-5 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm shrink-0">
              {erro}
            </div>
          )}

          {/* Rodapé */}
          <div className="px-5 py-4 shrink-0 flex items-center gap-3">
            {!problemaMode ? (
              <>
                <button
                  onClick={() => void liberar()}
                  disabled={!todosOk || saving}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    todosOk
                      ? 'text-white bg-gradient-to-br from-emerald-500 to-green-600 hover:opacity-90'
                      : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : todosOk ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : null}
                  {todosOk
                    ? 'Liberar coleta'
                    : `Confira todos os itens (${checked.size}/${CHECKLIST_RECEPCAO.length})`}
                </button>
                <button
                  onClick={() => setProblemaMode(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0 disabled:opacity-50"
                >
                  Registrar problema
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setProblemaMode(false)}
                  disabled={saving}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={() => void registrarProblema()}
                  disabled={!problemaEm || !motivo.trim() || saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-red-600 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Bloquear agendamento
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Modal: registrar coleta + baixa de insumos ─────────────────────────────────
const ColetaModal: React.FC<{
  ag: AcAgendamento;
  coletorNome: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  registrarColeta: ReturnType<typeof useColetas>['registrarColeta'];
}> = ({ ag, coletorNome, onClose, onDone, registrarColeta }) => {
  const [coletadoPor, setColetadoPor] = useState(coletorNome);
  const [observacoes, setObservacoes] = useState('');
  const [insumos, setInsumos] = useState<InsumoInput[]>([]);
  const [estoque, setEstoque] = useState<StockItem[]>([]);
  const [loadingEstoque, setLoadingEstoque] = useState(true);
  const [estoqueErro, setEstoqueErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Resolve o local do posto e carrega os produtos com saldo (espelha o §5.2).
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoadingEstoque(true);
      setEstoqueErro(null);
      if (!ag.posto_id) {
        if (ativo) {
          setEstoqueErro('Agendamento sem posto: não há estoque de onde baixar.');
          setLoadingEstoque(false);
        }
        return;
      }
      const { data: loc, error: locErr } = await supabase
        .from('stock_locations')
        .select('id')
        .eq('posto_id', ag.posto_id)
        .eq('rastreavel', true)
        .eq('ativo', true)
        .order('is_principal', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ativo) return;
      if (locErr || !loc) {
        setEstoqueErro('Posto sem estoque rastreável configurado.');
        setLoadingEstoque(false);
        return;
      }
      const { data: rows, error: stErr } = await supabase
        .from('product_stock')
        .select('product_id, quantity, products(name, unit, code)')
        .eq('location_id', loc.id)
        .gt('quantity', 0);
      if (!ativo) return;
      if (stErr) {
        setEstoqueErro(stErr.message);
      } else {
        const typed = (rows ?? []) as unknown as StockQueryRow[];
        setEstoque(
          typed.map((r) => ({
            productId: r.product_id,
            productName: r.products?.name ?? '',
            unit: r.products?.unit ?? '',
            code: r.products?.code ?? '',
            quantity: r.quantity,
          })),
        );
      }
      setLoadingEstoque(false);
    })();
    return () => {
      ativo = false;
    };
  }, [ag.posto_id]);

  const saldoDe = (productId: string) => estoque.find((e) => e.productId === productId)?.quantity ?? 0;

  const addInsumo = () => setInsumos((prev) => [...prev, { productId: '', quantity: 1 }]);
  const updateInsumo = (idx: number, patch: Partial<InsumoInput>) =>
    setInsumos((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeInsumo = (idx: number) => setInsumos((prev) => prev.filter((_, i) => i !== idx));

  const salvar = async () => {
    const limpos = insumos.filter((i) => i.productId && i.quantity > 0);
    // Guarda de UI: nenhuma linha pode exceder o saldo (o RPC também barra via CHECK>=0).
    for (const it of limpos) {
      if (it.quantity > saldoDe(it.productId)) {
        setErro('Um insumo excede o saldo disponível no posto.');
        return;
      }
    }
    if (!coletadoPor.trim()) {
      setErro('Informe quem realizou a coleta.');
      return;
    }
    setSaving(true);
    setErro(null);
    const err = await registrarColeta(ag.id, coletadoPor.trim(), observacoes, limpos);
    setSaving(false);
    if (err) setErro(err);
    else await onDone();
  };

  // Produtos ainda não escolhidos em outras linhas (evita duplicidade confusa).
  const disponiveis = (atual: string) =>
    estoque.filter((e) => e.productId === atual || !insumos.some((i) => i.productId === e.productId));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Registrar coleta</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {ag.paciente_nome} · {ag.local_posto || '—'} · {fmtHora(ag.data_hora)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Coletado por</label>
            <input
              type="text"
              value={coletadoPor}
              onChange={(e) => setColetadoPor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Insumos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Insumos consumidos <span className="text-gray-400">(opcional)</span>
              </label>
              <button
                onClick={addInsumo}
                disabled={loadingEstoque || !!estoqueErro || estoque.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>

            {loadingEstoque ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estoque do posto…
              </div>
            ) : estoqueErro ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
                {estoqueErro}
              </div>
            ) : insumos.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">Nenhum insumo — a coleta será registrada sem baixa.</p>
            ) : (
              <div className="space-y-2">
                {insumos.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={it.productId}
                      onChange={(e) => updateInsumo(idx, { productId: e.target.value })}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o produto…</option>
                      {disponiveis(it.productId).map((e) => (
                        <option key={e.productId} value={e.productId}>
                          {e.productName} ({e.quantity} {e.unit || 'un'})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={saldoDe(it.productId) || undefined}
                      value={it.quantity}
                      onChange={(e) => updateInsumo(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-20 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeInsumo(idx)}
                      className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              Observações <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3.5 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void salvar()}
            disabled={saving || loadingEstoque}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-amber-500 to-orange-500 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar coleta
          </button>
        </div>
      </div>
    </div>
  );
};

export default PainelColetasPage;
