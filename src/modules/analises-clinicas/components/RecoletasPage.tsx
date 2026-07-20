import React, { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Loader2,
  Trash2,
  X,
  CheckCircle2,
  Ban,
  AlertTriangle,
  FlaskConical,
  CopyPlus,
} from 'lucide-react';
import { useRecoletas, type RecoletaPatch, type RecoletaCreateInput } from '../hooks/useRecoletas';
import { usePostos } from '../hooks/usePostos';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcRecoleta, RecoletaStatus, RecoletaMotivo } from '../types';
import { STATUS_RECOLETA, MOTIVOS_RECOLETA } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const diasDecorridos = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

// Atrasada = ainda pendente e já passou do prazo p/ a nova coleta.
const atrasada = (r: AcRecoleta) => r.status === 'pendente' && diasDecorridos(r.solicitada_em) > r.prazo_dias;

const statusLabel = (s: RecoletaStatus) => STATUS_RECOLETA.find((x) => x.key === s)?.label ?? s;
const motivoLabel = (m: RecoletaMotivo) => MOTIVOS_RECOLETA.find((x) => x.key === m)?.label ?? m;

// Cor do badge por status: pendente = atenção; concluída = fechado ok; cancelada = neutro.
const STATUS_STYLE: Record<string, string> = {
  pendente:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  concluida:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  cancelada:
    'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500';

// ─── KPI ────────────────────────────────────────────────────────────────────────
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

// ─── Modal de edição (status / motivo / detalhe / prazo / nota) ──────────────────
const RecoletaModal: React.FC<{
  recoleta: AcRecoleta;
  onClose: () => void;
  onSave: (patch: RecoletaPatch) => Promise<string | null>;
}> = ({ recoleta, onClose, onSave }) => {
  const [status, setStatus] = useState<RecoletaStatus>(recoleta.status);
  const [motivo, setMotivo] = useState<RecoletaMotivo>(recoleta.motivo);
  const [motivoDetalhe, setMotivoDetalhe] = useState(recoleta.motivo_detalhe ?? '');
  const [nota, setNota] = useState(recoleta.nota ?? '');
  const [prazoDias, setPrazoDias] = useState<string>(String(recoleta.prazo_dias));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    setErro(null);
    const prazo = Number(prazoDias);
    if (Number.isNaN(prazo) || prazo <= 0) {
      setErro('Informe um prazo válido (dias).');
      return;
    }
    setSaving(true);
    const msg = await onSave({
      status,
      motivo,
      motivoDetalhe: motivoDetalhe.trim(),
      nota: nota.trim(),
      prazoDias: prazo,
    });
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
              {recoleta.paciente_nome || recoleta.exame_nome || 'Recoleta'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {recoleta.exame_nome ? `${recoleta.exame_nome}` : 'Sem exame informado'}
              {recoleta.local_posto ? ` · ${recoleta.local_posto}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as RecoletaStatus)} className={inputCls}>
                {STATUS_RECOLETA.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prazo (dias)</label>
              <input type="number" min={1} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as RecoletaMotivo)} className={inputCls}>
              {MOTIVOS_RECOLETA.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Detalhe do motivo <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              value={motivoDetalhe}
              onChange={(e) => setMotivoDetalhe(e.target.value)}
              placeholder="Complemento do motivo…"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nota <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Observação do acompanhamento…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal de criação (registro manual) ─────────────────────────────────────────
// Busca sem acento/caixa (espelha o seletor de exames do check-in).
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface ExameOpt {
  id: string;
  nome: string;
  mnemonico: string | null;
  material: string | null;
}

const NovaRecoletaModal: React.FC<{
  solicitanteNome: string;
  origem?: AcRecoleta | null; // quando é a "recoleta da recoleta": herda dados e encadeia
  onClose: () => void;
  onCreate: (input: RecoletaCreateInput) => Promise<string | null>;
}> = ({ solicitanteNome, origem, onClose, onCreate }) => {
  const { postos } = usePostos();
  const [catalogo, setCatalogo] = useState<ExameOpt[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<{ id: string | null; nome: string } | null>(
    origem?.exame_nome ? { id: null, nome: origem.exame_nome } : null,
  );
  const [motivo, setMotivo] = useState<RecoletaMotivo | ''>(''); // motivo da nova falha (não herdado)
  const [motivoDetalhe, setMotivoDetalhe] = useState('');
  const [paciente, setPaciente] = useState(origem?.paciente_nome ?? '');
  const [postoSel, setPostoSel] = useState(origem?.posto_id ?? '');
  const [prazoDias, setPrazoDias] = useState(origem ? String(origem.prazo_dias) : '7');
  const [nota, setNota] = useState('');
  const [solicitadoPor, setSolicitadoPor] = useState(solicitanteNome);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Catálogo de exames ativos (sem filtro is_cultura — recoleta serve a qualquer exame).
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoadingCat(true);
      const { data, error } = await supabase
        .from('ac_exames')
        .select('id, nome, mnemonico, material')
        .eq('ativo', true)
        .order('nome');
      if (!ativo) return;
      if (!error) setCatalogo((data ?? []) as ExameOpt[]);
      setLoadingCat(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const postosAtivos = useMemo(() => postos.filter((p) => p.ativo), [postos]);
  const resultados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return [];
    return catalogo
      .filter((e) => normalize(e.nome).includes(q) || (e.mnemonico ? normalize(e.mnemonico).includes(q) : false))
      .slice(0, 20);
  }, [busca, catalogo]);

  const handleSave = async () => {
    setErro(null);
    if (!motivo) {
      setErro('Selecione o motivo da recoleta.');
      return;
    }
    if (!solicitadoPor.trim()) {
      setErro('Informe quem está solicitando a recoleta.');
      return;
    }
    const prazo = Number(prazoDias);
    if (Number.isNaN(prazo) || prazo <= 0) {
      setErro('Informe um prazo válido (dias).');
      return;
    }
    const posto = postosAtivos.find((p) => p.id === postoSel);
    setSaving(true);
    const msg = await onCreate({
      motivo,
      motivoDetalhe: motivoDetalhe.trim() || null,
      exameNome: selecionado?.nome.trim() || null,
      pacienteNome: paciente.trim() || null,
      postoId: posto?.id ?? (postoSel || null),
      localPosto: posto?.nome ?? origem?.local_posto ?? null,
      nota: nota.trim() || null,
      prazoDias: prazo,
      solicitadoPor: solicitadoPor.trim(),
      // Encadeamento: quando nasce "a partir de" outra recoleta.
      coletaId: origem?.coleta_id ?? null,
      origemRecoletaId: origem?.id ?? null,
    });
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">
              {origem ? 'Nova recoleta (a partir de outra)' : 'Nova recoleta'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {origem
                ? `Encadeada à recoleta de ${origem.paciente_nome || 'paciente —'}`
                : 'Registro manual · amostra a recoletar'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}

          {/* Motivo (obrigatório) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as RecoletaMotivo | '')} className={inputCls}>
              <option value="">Selecione…</option>
              {MOTIVOS_RECOLETA.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {motivo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Detalhe do motivo <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                value={motivoDetalhe}
                onChange={(e) => setMotivoDetalhe(e.target.value)}
                placeholder="Complemento do motivo…"
                className={inputCls}
              />
            </div>
          )}

          {/* Exame / material (opcional, com busca no catálogo + tipo livre) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exame / material <span className="text-gray-400">(opcional)</span>
            </label>

            {selecionado ? (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg text-sm font-medium border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60">
                <FlaskConical className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-[240px]">{selecionado.nome}</span>
                <button
                  onClick={() => setSelecionado(null)}
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  aria-label="Trocar exame"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar exame ou digitar um material…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {loadingCat && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando catálogo…
                  </p>
                )}

                {busca.trim() && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
                    {resultados.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          setSelecionado({ id: e.id, nome: e.nome });
                          setBusca('');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <FlaskConical className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{e.nome}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {[e.mnemonico, e.material].filter(Boolean).join(' · ') || 'sem mnemônico'}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSelecionado({ id: null, nome: busca.trim() });
                        setBusca('');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-500/10 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">Usar “{busca.trim()}”</div>
                        <div className="text-xs text-gray-400 truncate">material livre (fora do catálogo)</div>
                      </div>
                      <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Paciente <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              value={paciente}
              onChange={(e) => setPaciente(e.target.value)}
              placeholder="Nome do paciente"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Posto <span className="text-gray-400">(opcional)</span>
              </label>
              <select value={postoSel} onChange={(e) => setPostoSel(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {postosAtivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prazo (dias)</label>
              <input type="number" min={1} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solicitado por</label>
            <input
              value={solicitadoPor}
              onChange={(e) => setSolicitadoPor(e.target.value)}
              placeholder="Nome de quem registrou"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nota <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Observação inicial…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving ? 'Registrando…' : 'Registrar recoleta'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const RecoletasPage: React.FC = () => {
  const { recoletas, loading, error, refetch, createRecoleta, updateRecoleta, deleteRecoleta } = useRecoletas();
  const { user, userProfile } = useAuth();
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');
  const solicitanteNome = userProfile?.name || user?.email || 'Sistema';
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [postoSel, setPostoSel] = useState<string>('');
  const [editando, setEditando] = useState<AcRecoleta | null>(null);
  const [criando, setCriando] = useState(false);
  const [criandoDe, setCriandoDe] = useState<AcRecoleta | null>(null); // "recoleta da recoleta"

  // Postos presentes nas recoletas (snapshot local_posto), para o filtro.
  const postosDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recoletas) {
      const key = r.posto_id ?? r.local_posto ?? '';
      if (key && !m.has(key)) m.set(key, r.local_posto ?? '—');
    }
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [recoletas]);

  const filtradas = useMemo(() => {
    if (!postoSel) return recoletas;
    return recoletas.filter((r) => (r.posto_id ?? r.local_posto ?? '') === postoSel);
  }, [recoletas, postoSel]);

  const kpis = useMemo(() => {
    const pendentes = filtradas.filter((r) => r.status === 'pendente').length;
    const concluidas = filtradas.filter((r) => r.status === 'concluida').length;
    const canceladas = filtradas.filter((r) => r.status === 'cancelada').length;
    const atrasadas = filtradas.filter((r) => atrasada(r)).length;
    return { pendentes, concluidas, canceladas, atrasadas };
  }, [filtradas]);

  // Número da tentativa = profundidade na cadeia origem_recoleta_id (1 = primeira).
  // Percorre a lista carregada; o memo interno evita recomputar e guarda contra ciclos.
  const tentativaPorId = useMemo(() => {
    const byId = new Map(recoletas.map((r) => [r.id, r]));
    const memo = new Map<string, number>();
    const depth = (r: AcRecoleta): number => {
      const cached = memo.get(r.id);
      if (cached !== undefined) return cached;
      memo.set(r.id, 1); // guarda contra ciclo antes de recorrer
      const pai = r.origem_recoleta_id ? byId.get(r.origem_recoleta_id) : undefined;
      const n = pai ? depth(pai) + 1 : 1;
      memo.set(r.id, n);
      return n;
    };
    const m = new Map<string, number>();
    for (const r of recoletas) m.set(r.id, depth(r));
    return m;
  }, [recoletas]);

  const setStatus = async (r: AcRecoleta, status: RecoletaStatus) => {
    await updateRecoleta(r.id, { status });
  };

  const handleDelete = (r: AcRecoleta) => {
    showConfirmDialog(
      'Remover recoleta',
      <span>
        Remover o registro de recoleta
        {r.paciente_nome ? (
          <>
            {' '}de <strong className="text-gray-900 dark:text-gray-100">{r.paciente_nome}</strong>
          </>
        ) : (
          ''
        )}
        ? Essa ação não afeta a coleta ou o agendamento original.
      </span>,
      async () => {
        const msg = await deleteRecoleta(r.id);
        if (msg) window.alert(`Não foi possível remover: ${msg}`);
      },
      { type: 'danger', confirmText: 'Remover' },
    );
  };

  return (
    <div className="max-w-6xl mx-auto pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recoletas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Acompanhamento manual · amostras a recoletar
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={postoSel}
            onChange={(e) => setPostoSel(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Todos os postos</option>
            {postosDisponiveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          {canManage && (
            <button
              onClick={() => setCriando(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova recoleta
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon={<Clock className="w-5 h-5" />} label="Pendentes" valor={kpis.pendentes} cor="from-amber-500 to-orange-500" />
        <Kpi icon={<CheckCircle2 className="w-5 h-5" />} label="Concluídas" valor={kpis.concluidas} cor="from-emerald-500 to-green-600" />
        <Kpi icon={<Ban className="w-5 h-5" />} label="Canceladas" valor={kpis.canceladas} cor="from-gray-400 to-gray-500" />
        <Kpi
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Atrasadas"
          valor={kpis.atrasadas}
          sub="além do prazo"
          cor="from-rose-500 to-red-600"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-600 border-t-transparent" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <RotateCcw className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhuma recoleta em acompanhamento</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {canManage
              ? 'Use "Nova recoleta" para registrar quando o apoio/QC sinalizar uma amostra inviável.'
              : 'As recoletas registradas pelo laboratório aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((r) => {
            const atras = atrasada(r);
            const tentativa = tentativaPorId.get(r.id) ?? 1;
            return (
              <div
                key={r.id}
                className={`p-5 rounded-2xl border bg-white dark:bg-gray-800 flex flex-col ${
                  atras ? 'border-amber-300 dark:border-amber-800' : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                {/* Paciente + status */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={r.paciente_nome ?? undefined}>
                      {r.paciente_nome || 'Paciente —'}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                      STATUS_STYLE[r.status] ?? STATUS_STYLE.pendente
                    }`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>

                {/* Exame · posto */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 truncate">
                  <span className="truncate">{r.exame_nome || 'Exame —'}</span>
                  {r.local_posto && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3" /> {r.local_posto}
                    </span>
                  )}
                </p>

                {/* Tentativa (recoleta encadeada) */}
                {tentativa > 1 && (
                  <p className="text-[11px] mb-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <CopyPlus className="w-3 h-3" /> {tentativa}ª tentativa · recoleta encadeada
                  </p>
                )}

                {/* Motivo */}
                <div className="mb-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Motivo: </span>
                  {motivoLabel(r.motivo)}
                  {r.motivo_detalhe ? ` — ${r.motivo_detalhe}` : ''}
                </div>
                {r.nota && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">“{r.nota}”</p>}

                {/* Prazo */}
                <div className="text-xs text-gray-400 flex items-center gap-1 mb-3 mt-auto">
                  <Clock className="w-3.5 h-3.5" />
                  solicitada {fmtData(r.solicitada_em)} · {diasDecorridos(r.solicitada_em)}d / prazo {r.prazo_dias}d
                  {atras && <span className="text-amber-600 dark:text-amber-400 font-medium">· atrasada</span>}
                </div>

                {/* Ações */}
                {canManage && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {r.status === 'pendente' ? (
                      <>
                        <button
                          onClick={() => void setStatus(r, 'concluida')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Concluir
                        </button>
                        <button
                          onClick={() => void setStatus(r, 'cancelada')}
                          title="Cancelar recoleta"
                          aria-label="Cancelar recoleta"
                          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors shrink-0"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => void setStatus(r, 'pendente')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reabrir
                      </button>
                    )}
                    <button
                      onClick={() => setCriandoDe(r)}
                      title="Nova recoleta a partir desta (amostra recoletada também falhou)"
                      aria-label="Nova recoleta a partir desta"
                      className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors shrink-0"
                    >
                      <CopyPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditando(r)}
                      title="Editar status, motivo e prazo"
                      aria-label="Editar recoleta"
                      className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      title="Remover recoleta"
                      aria-label="Remover recoleta"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <RecoletaModal
          recoleta={editando}
          onClose={() => setEditando(null)}
          onSave={(patch) => updateRecoleta(editando.id, patch)}
        />
      )}

      {(criando || criandoDe) && (
        <NovaRecoletaModal
          solicitanteNome={solicitanteNome}
          origem={criandoDe}
          onClose={() => {
            setCriando(false);
            setCriandoDe(null);
          }}
          onCreate={createRecoleta}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={hideConfirmDialog}
      />
    </div>
  );
};

export default RecoletasPage;
