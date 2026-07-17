import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  RefreshCw,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Loader2,
  Trash2,
  X,
  Check,
  FileCheck2,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { useLaudos, type LaudoPatch, type LaudoCreateInput } from '../hooks/useLaudos';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcLaudo, LaudoStatus } from '../types';
import { STATUS_LAUDO } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const statusLabel = (s: LaudoStatus) => STATUS_LAUDO.find((x) => x.key === s)?.label ?? s;

const STATUS_STYLE: Record<string, string> = {
  aguarda_liberacao:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  laudo_parcial_liberado:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  laudo_completo_liberado:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500';

// ─── KPI ────────────────────────────────────────────────────────────────────────
const Kpi: React.FC<{ icon: React.ReactNode; label: string; valor: React.ReactNode; cor: string }> = ({
  icon,
  label,
  valor,
  cor,
}) => (
  <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${cor}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">{valor}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
    </div>
  </div>
);

// ─── Barra de progresso de exames ───────────────────────────────────────────────
const ProgressoExames: React.FC<{ concluidos: number; total: number }> = ({ concluidos, total }) => {
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {concluidos} de {total} exames
        </span>
        <span className={`font-semibold ${pct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ─── Modal de edição (status / exames / nota) ───────────────────────────────────
const LaudoModal: React.FC<{
  laudo: AcLaudo;
  onClose: () => void;
  onSave: (patch: LaudoPatch) => Promise<string | null>;
}> = ({ laudo, onClose, onSave }) => {
  const [status, setStatus] = useState<LaudoStatus>(laudo.status);
  const [examesConcluidos, setExamesConcluidos] = useState<string>(String(laudo.exames_concluidos));
  const [examesTotal, setExamesTotal] = useState<string>(String(laudo.exames_total));
  const [nota, setNota] = useState(laudo.nota ?? '');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    setErro(null);
    const concl = Number(examesConcluidos);
    const total = Number(examesTotal);
    if (Number.isNaN(concl) || concl < 0) {
      setErro('Informe um número válido de exames concluídos.');
      return;
    }
    if (Number.isNaN(total) || total < 0) {
      setErro('Informe um número válido de exames total.');
      return;
    }
    if (concl > total) {
      setErro('Exames concluídos não pode ser maior que o total.');
      return;
    }
    setSaving(true);
    const msg = await onSave({
      status,
      examesConcluidos: concl,
      examesTotal: total,
      nota: nota.trim(),
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
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">Editar laudo</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Agendamento · {laudo.agendamento_id.slice(0, 8)}…
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as LaudoStatus)} className={inputCls}>
              {STATUS_LAUDO.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exames concluídos</label>
              <input
                type="number"
                min={0}
                value={examesConcluidos}
                onChange={(e) => setExamesConcluidos(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exames total</label>
              <input
                type="number"
                min={0}
                value={examesTotal}
                onChange={(e) => setExamesTotal(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nota <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Observação…"
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
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal de criação (vincula a agendamento sem laudo) ─────────────────────────
interface AgOpt {
  id: string;
  paciente_nome: string;
  local_posto: string;
  data_hora: string;
  status: string;
  exames_count: number;
}

// Status do agendamento que já passaram pelo check-in (liberados na recepção).
const AGENDAMENTO_STATUS_CHECKIN = ['em_coleta', 'coletado'];

const NovoLaudoModal: React.FC<{
  onClose: () => void;
  onCreate: (input: LaudoCreateInput, criadoPor: string) => Promise<string | null>;
}> = ({ onClose, onCreate }) => {
  const { userProfile } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgOpt[]>([]);
  const [loadingAg, setLoadingAg] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<AgOpt | null>(null);
  const [examesTotalManual, setExamesTotalManual] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca agendamentos que já passaram pelo check-in e ainda não têm laudo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoadingAg(true);
      // Só agendamentos liberados na recepção (em_coleta ou coletado) e não cancelados.
      const { data, error } = await supabase
        .from('ac_agendamentos')
        .select('id, paciente_nome, local_posto, data_hora, status')
        .in('status', AGENDAMENTO_STATUS_CHECKIN)
        .order('data_hora', { ascending: false });
      if (!ativo) return;
      if (error) {
        setLoadingAg(false);
        return;
      }
      const todos = (data ?? []) as Omit<AgOpt, 'exames_count'>[];
      if (todos.length === 0) {
        setAgendamentos([]);
        setLoadingAg(false);
        return;
      }
      // Filtra os que já têm laudo.
      const ids = todos.map((a) => a.id);
      const [{ data: laudosExistentes }, { data: examesRows }] = await Promise.all([
        supabase.from('ac_laudos').select('agendamento_id').in('agendamento_id', ids),
        supabase.from('ac_agendamento_exames').select('agendamento_id').in('agendamento_id', ids),
      ]);
      const comLaudo = new Set((laudosExistentes ?? []).map((l: { agendamento_id: string }) => l.agendamento_id));
      // Conta exames por agendamento.
      const examesCountMap = new Map<string, number>();
      for (const row of (examesRows ?? []) as { agendamento_id: string }[]) {
        examesCountMap.set(row.agendamento_id, (examesCountMap.get(row.agendamento_id) ?? 0) + 1);
      }
      const semLaudo: AgOpt[] = todos
        .filter((a) => !comLaudo.has(a.id))
        .map((a) => ({ ...a, exames_count: examesCountMap.get(a.id) ?? 0 }));
      setAgendamentos(semLaudo);
      setLoadingAg(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return agendamentos.slice(0, 20);
    return agendamentos
      .filter(
        (a) =>
          a.paciente_nome.toLowerCase().includes(q) ||
          a.local_posto.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [busca, agendamentos]);

  const handleSave = async () => {
    setErro(null);
    if (!selecionado) {
      setErro('Selecione um agendamento.');
      return;
    }
    const totalManual = examesTotalManual.trim() ? Number(examesTotalManual) : undefined;
    if (examesTotalManual.trim() && (Number.isNaN(totalManual as number) || (totalManual as number) < 0)) {
      setErro('Informe um número válido para exames total.');
      return;
    }
    setSaving(true);
    const msg = await onCreate(
      {
        agendamentoId: selecionado.id,
        examesTotal: totalManual,
        nota: nota.trim() || null,
      },
      userProfile?.name || 'Sistema',
    );
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Novo laudo</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Vincular a um agendamento já liberado no check-in</p>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agendamento</label>
            {selecionado ? (
              <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-lg text-sm font-medium border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/60">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-[240px]">
                  {selecionado.paciente_nome} · {fmtData(selecionado.data_hora)}
                </span>
                <button
                  onClick={() => setSelecionado(null)}
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  aria-label="Trocar agendamento"
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
                    placeholder="Buscar paciente, posto ou ID…"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                {loadingAg && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando agendamentos…
                  </p>
                )}
                {resultados.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
                    {resultados.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelecionado(a)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.paciente_nome}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {a.local_posto} · {fmtData(a.data_hora)}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                            {a.exames_count} exame{a.exames_count !== 1 ? 's' : ''}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                              a.status === 'coletado'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                            }`}
                          >
                            {a.status === 'coletado' ? 'Coletado' : 'Em coleta'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!loadingAg && resultados.length === 0 && (
                  <p className="text-xs text-gray-400 px-1">
                    {busca.trim()
                      ? 'Nenhum agendamento encontrado.'
                      : 'Nenhum agendamento liberado no check-in disponível para laudo.'}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exames total <span className="text-gray-400">(opcional — padrão: conta do check-in)</span>
            </label>
            <input
              type="number"
              min={0}
              value={examesTotalManual}
              onChange={(e) => setExamesTotalManual(e.target.value)}
              placeholder={selecionado ? `Contagem do check-in: ${selecionado.exames_count} exame(s)` : 'Deixe em branco para usar a contagem do agendamento'}
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
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving ? 'Criando…' : 'Criar laudo'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const LaudosPage: React.FC = () => {
  const { laudos, agendamentos, loading, error, refetch, createLaudo, updateLaudo, deleteLaudo } = useLaudos();
  const { userProfile } = useAuth();
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [postoSel, setPostoSel] = useState<string>('');
  const [busca, setBusca] = useState<string>('');
  const [editando, setEditando] = useState<AcLaudo | null>(null);
  const [criando, setCriando] = useState(false);

  // Agendamentos presentes nos laudos para filtro.
  const postosDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of laudos) {
      const ag = agendamentos.find((a) => a.id === l.agendamento_id);
      const key = ag?.posto_id ?? ag?.local_posto ?? '';
      if (key && !m.has(key)) m.set(key, ag?.local_posto ?? '—');
    }
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [laudos, agendamentos]);

  const filtradas = useMemo(() => {
    let resultado = laudos;
    // Filtro por posto
    if (postoSel) {
      resultado = resultado.filter((l) => {
        const ag = agendamentos.find((a) => a.id === l.agendamento_id);
        return (ag?.posto_id ?? ag?.local_posto ?? '') === postoSel;
      });
    }
    // Filtro por busca textual
    const q = busca.trim().toLowerCase();
    if (q) {
      resultado = resultado.filter((l) => {
        const ag = agendamentos.find((a) => a.id === l.agendamento_id);
        const nome = ag?.paciente_nome?.toLowerCase() ?? '';
        const posto = ag?.local_posto?.toLowerCase() ?? '';
        const idAg = l.agendamento_id.toLowerCase();
        const nota = l.nota?.toLowerCase() ?? '';
        return nome.includes(q) || posto.includes(q) || idAg.includes(q) || nota.includes(q);
      });
    }
    return resultado;
  }, [laudos, agendamentos, postoSel, busca]);

  const kpis = useMemo(() => {
    const aguarda = filtradas.filter((l) => l.status === 'aguarda_liberacao').length;
    const parcial = filtradas.filter((l) => l.status === 'laudo_parcial_liberado').length;
    const completo = filtradas.filter((l) => l.status === 'laudo_completo_liberado').length;
    return { aguarda, parcial, completo };
  }, [filtradas]);

  const handleDelete = (l: AcLaudo) => {
    showConfirmDialog(
      'Remover laudo',
      <span>
        Remover o laudo do agendamento{' '}
        <strong className="text-gray-900 dark:text-gray-100">
          {agendamentos.find((a) => a.id === l.agendamento_id)?.paciente_nome ?? l.agendamento_id.slice(0, 8)}
        </strong>
        ?
      </span>,
      async () => {
        const msg = await deleteLaudo(l.id);
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
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <FileCheck2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Laudos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Acompanhamento por agendamento · 1 laudo por agendamento
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar laudo…"
              className="pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 w-48 sm:w-56"
            />
          </div>
          <select
            value={postoSel}
            onChange={(e) => setPostoSel(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo laudo
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Kpi icon={<AlertCircle className="w-5 h-5" />} label="Aguarda liberação" valor={kpis.aguarda} cor="from-amber-500 to-orange-500" />
        <Kpi icon={<FileText className="w-5 h-5" />} label="Laudo parcial" valor={kpis.parcial} cor="from-blue-500 to-indigo-600" />
        <Kpi icon={<Check className="w-5 h-5" />} label="Laudo completo" valor={kpis.completo} cor="from-emerald-500 to-teal-600" />
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-600 border-t-transparent" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <FileCheck2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {busca.trim() ? 'Nenhum laudo encontrado para esta busca' : 'Nenhum laudo em acompanhamento'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {busca.trim()
              ? 'Tente ajustar os termos da pesquisa.'
              : canManage
                ? 'Use "Novo laudo" para vincular um agendamento.'
                : 'Aguardando criação de laudos.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((l) => {
            const ag = agendamentos.find((a) => a.id === l.agendamento_id);
            return (
              <div
                key={l.id}
                className="p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
              >
                {/* Paciente + status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={ag?.paciente_nome}>
                      {ag?.paciente_nome || 'Paciente —'}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                      STATUS_STYLE[l.status] ?? STATUS_STYLE.aguarda_liberacao
                    }`}
                  >
                    {statusLabel(l.status)}
                  </span>
                </div>

                {/* Posto · Data */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1 truncate">
                  {ag?.local_posto && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3" /> {ag.local_posto}
                    </span>
                  )}
                  {ag?.data_hora && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {fmtData(ag.data_hora)}
                    </span>
                  )}
                </p>

                {/* Progresso de exames */}
                <div className="mb-3">
                  <ProgressoExames concluidos={l.exames_concluidos} total={l.exames_total} />
                </div>

                {/* Nota */}
                {l.nota && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">“{l.nota}”</p>}

                {/* Meta */}
                <div className="text-xs text-gray-400 flex items-center gap-1 mb-3 mt-auto">
                  <Clock className="w-3.5 h-3.5" />
                  criado {fmtData(l.criado_em)}
                  {l.liberado_em && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">· liberado {fmtData(l.liberado_em)}</span>
                  )}
                </div>

                {/* Ações */}
                {canManage && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setEditando(l)}
                      title="Editar laudo"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      title="Remover laudo"
                      aria-label="Remover laudo"
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
        <LaudoModal laudo={editando} onClose={() => setEditando(null)} onSave={(patch) => updateLaudo(editando.id, patch)} />
      )}

      {criando && <NovoLaudoModal onClose={() => setCriando(false)} onCreate={createLaudo} />}

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

export default LaudosPage;
