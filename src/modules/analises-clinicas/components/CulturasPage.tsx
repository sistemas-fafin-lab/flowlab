import React, { useMemo, useState } from 'react';
import {
  Microscope,
  RefreshCw,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Check,
  Activity,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import { useCulturas, type CulturaPatch } from '../hooks/useCulturas';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcCultura, AcCulturaEtapa, CulturaStatus } from '../types';
import { STATUS_CULTURA } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const diasDecorridos = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const atrasada = (c: AcCultura) => c.status === 'em_andamento' && diasDecorridos(c.iniciada_em) > c.prazo_dias;

const statusLabel = (s: CulturaStatus) => STATUS_CULTURA.find((x) => x.key === s)?.label ?? s;

// Cor do badge por status: em andamento = neutro; positiva = alerta (patógeno); laudo concluído = fechado.
const STATUS_STYLE: Record<string, string> = {
  em_andamento:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  positiva:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
  pronta_laudo:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500';

// ─── Stepper da trilha (desenha a partir de ac_cultura_etapas) ──────────────────
const Stepper: React.FC<{ etapas: AcCulturaEtapa[]; atual: number }> = ({ etapas, atual }) => (
  <div className="flex items-center gap-1">
    {etapas.map((et, i) => (
      <React.Fragment key={et.id}>
        {i > 0 && (
          <div
            className={`h-0.5 flex-1 rounded ${
              et.ordem <= atual ? 'bg-violet-400' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        )}
        <div
          title={et.nome}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            et.ordem === atual
              ? 'bg-violet-600 text-white ring-2 ring-violet-200 dark:ring-violet-900/60'
              : et.ordem < atual
                ? 'bg-violet-400 text-white'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {et.ordem < atual ? <Check className="w-3 h-3" /> : et.ordem}
        </div>
      </React.Fragment>
    ))}
  </div>
);

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

// ─── Modal de edição (status / etapa / nota / resultado / prazo) ─────────────────
const CulturaModal: React.FC<{
  cultura: AcCultura;
  etapas: AcCulturaEtapa[];
  onClose: () => void;
  onSave: (patch: CulturaPatch) => Promise<string | null>;
}> = ({ cultura, etapas, onClose, onSave }) => {
  const [etapaOrdem, setEtapaOrdem] = useState<number>(cultura.etapa_ordem);
  const [status, setStatus] = useState<CulturaStatus>(cultura.status);
  const [nota, setNota] = useState(cultura.nota ?? '');
  const [resultado, setResultado] = useState(cultura.resultado ?? '');
  const [prazoDias, setPrazoDias] = useState<string>(String(cultura.prazo_dias));
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
      etapaOrdem,
      status,
      nota: nota.trim(),
      resultado: resultado.trim(),
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
            <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{cultura.exame_nome}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {cultura.paciente_nome || 'Paciente —'}
              {cultura.local_posto ? ` · ${cultura.local_posto}` : ''}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Etapa</label>
              <select value={etapaOrdem} onChange={(e) => setEtapaOrdem(Number(e.target.value))} className={inputCls}>
                {etapas.map((et) => (
                  <option key={et.id} value={et.ordem}>
                    {et.ordem}. {et.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as CulturaStatus)} className={inputCls}>
                {STATUS_CULTURA.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prazo (dias)
            </label>
            <input type="number" min={1} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nota da etapa <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Observação do andamento…"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resultado / laudo <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              rows={2}
              placeholder="Desfecho textual, quando houver…"
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

// ─── Página ───────────────────────────────────────────────────────────────────
const CulturasPage: React.FC = () => {
  const { culturas, etapas, loading, error, refetch, updateCultura, deleteCultura } = useCulturas();
  const { userProfile } = useAuth();
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');
  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [postoSel, setPostoSel] = useState<string>('');
  const [editando, setEditando] = useState<AcCultura | null>(null);

  // Postos presentes nas culturas (snapshot local_posto), para o filtro.
  const postosDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of culturas) {
      const key = c.posto_id ?? c.local_posto ?? '';
      if (key && !m.has(key)) m.set(key, c.local_posto ?? '—');
    }
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [culturas]);

  const filtradas = useMemo(() => {
    if (!postoSel) return culturas;
    return culturas.filter((c) => (c.posto_id ?? c.local_posto ?? '') === postoSel);
  }, [culturas, postoSel]);

  const kpis = useMemo(() => {
    const emAndamento = filtradas.filter((c) => c.status === 'em_andamento').length;
    const positivas = filtradas.filter((c) => c.status === 'positiva').length;
    const prontas = filtradas.filter((c) => c.status === 'pronta_laudo').length;
    const resolvidas = positivas + prontas;
    const positividade = resolvidas ? Math.round((positivas / resolvidas) * 100) : 0;
    const atrasadas = filtradas.filter((c) => atrasada(c)).length;
    return { emAndamento, positivas, prontas, positividade, resolvidas, atrasadas };
  }, [filtradas]);

  const nomeEtapa = (ordem: number) => etapas.find((e) => e.ordem === ordem)?.nome ?? `Etapa ${ordem}`;
  const primeiraOrdem = etapas.length ? etapas[0].ordem : 1;
  const ultimaOrdem = etapas.length ? etapas[etapas.length - 1].ordem : 1;

  const avancar = async (c: AcCultura) => {
    const prox = etapas.find((e) => e.ordem > c.etapa_ordem);
    if (prox) await updateCultura(c.id, { etapaOrdem: prox.ordem });
  };
  const retroceder = async (c: AcCultura) => {
    const anteriores = etapas.filter((e) => e.ordem < c.etapa_ordem);
    const ant = anteriores.length ? anteriores[anteriores.length - 1] : null;
    if (ant) await updateCultura(c.id, { etapaOrdem: ant.ordem });
  };

  const handleDelete = (c: AcCultura) => {
    showConfirmDialog(
      'Remover cultura',
      <span>
        Remover o acompanhamento de{' '}
        <strong className="text-gray-900 dark:text-gray-100">"{c.exame_nome}"</strong>
        {c.paciente_nome ? ` de ${c.paciente_nome}` : ''}? A coleta e o agendamento não são afetados.
      </span>,
      async () => {
        const msg = await deleteCultura(c.id);
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
            <Microscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Culturas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Acompanhamento manual · as culturas nascem no check-in
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon={<Activity className="w-5 h-5" />} label="Em andamento" valor={kpis.emAndamento} cor="from-blue-500 to-indigo-600" />
        <Kpi
          icon={<Microscope className="w-5 h-5" />}
          label="Positivas"
          valor={kpis.positivas}
          sub={`${kpis.positividade}% positividade`}
          cor="from-rose-500 to-red-600"
        />
        <Kpi icon={<FileCheck2 className="w-5 h-5" />} label="Laudo concluído" valor={kpis.prontas} cor="from-violet-500 to-purple-600" />
        <Kpi
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Atrasadas"
          valor={kpis.atrasadas}
          sub="além do prazo"
          cor="from-amber-500 to-orange-500"
        />
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
            <Microscope className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhuma cultura em acompanhamento</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Selecione um exame de cultura no check-in para abrir o acompanhamento aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtradas.map((c) => {
            const atras = atrasada(c);
            return (
              <div
                key={c.id}
                className={`p-5 rounded-2xl border bg-white dark:bg-gray-800 flex flex-col ${
                  atras ? 'border-amber-300 dark:border-amber-800' : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                {/* Exame + status */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Microscope className="w-4 h-4 text-violet-500 shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={c.exame_nome}>
                      {c.exame_nome}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${
                      STATUS_STYLE[c.status] ?? STATUS_STYLE.em_andamento
                    }`}
                  >
                    {statusLabel(c.status)}
                  </span>
                </div>

                {/* Paciente · posto */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1 truncate">
                  <span className="truncate">{c.paciente_nome || 'Paciente —'}</span>
                  {c.local_posto && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <MapPin className="w-3 h-3" /> {c.local_posto}
                    </span>
                  )}
                </p>

                {/* Stepper */}
                <div className="mb-2">
                  <Stepper etapas={etapas} atual={c.etapa_ordem} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Etapa {c.etapa_ordem}
                  {etapas.length ? `/${ultimaOrdem}` : ''} ·{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{nomeEtapa(c.etapa_ordem)}</span>
                </p>

                {/* Resultado / nota */}
                {c.resultado && (
                  <div className="mb-2 p-2 rounded-lg bg-violet-50 dark:bg-violet-900/15 text-xs text-violet-800 dark:text-violet-200">
                    <span className="font-semibold">Resultado: </span>
                    {c.resultado}
                  </div>
                )}
                {c.nota && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">“{c.nota}”</p>}

                {/* Prazo */}
                <div className="text-xs text-gray-400 flex items-center gap-1 mb-3 mt-auto">
                  <Clock className="w-3.5 h-3.5" />
                  iniciada {fmtData(c.iniciada_em)} · {diasDecorridos(c.iniciada_em)}d / prazo {c.prazo_dias}d
                  {atras && <span className="text-amber-600 dark:text-amber-400 font-medium">· atrasada</span>}
                </div>

                {/* Ações */}
                {canManage && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {/* Etapa: par simétrico agrupado (retroceder | avançar) */}
                    <div className="inline-flex items-stretch rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
                      <button
                        onClick={() => void retroceder(c)}
                        disabled={c.etapa_ordem <= primeiraOrdem}
                        title="Retroceder etapa"
                        aria-label="Retroceder etapa"
                        className="px-2.5 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <div className="w-px bg-gray-200 dark:bg-gray-600" />
                      <button
                        onClick={() => void avancar(c)}
                        disabled={c.etapa_ordem >= ultimaOrdem}
                        title="Avançar etapa"
                        aria-label="Avançar etapa"
                        className="px-2.5 py-1.5 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => setEditando(c)}
                      title="Editar status, nota e resultado"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      title="Remover acompanhamento"
                      aria-label="Remover acompanhamento"
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
        <CulturaModal
          cultura={editando}
          etapas={etapas}
          onClose={() => setEditando(null)}
          onSave={(patch) => updateCultura(editando.id, patch)}
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

export default CulturasPage;
