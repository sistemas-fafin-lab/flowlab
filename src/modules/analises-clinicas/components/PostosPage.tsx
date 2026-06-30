import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Plus,
  Pencil,
  CalendarClock,
  CalendarOff,
  Clock,
  Trash2,
  X,
  RefreshCw,
  Power,
  Building2,
} from 'lucide-react';
import { usePostos } from '../hooks/usePostos';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcDiaExcecao, AcHorarioItem, AcHorarioPadrao, AcPosto } from '../types';

const fmtData = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const cap = (c: number) => (c > 1 ? ` · ${c}` : '');

// ─── Modal de posto (criar/editar) ─────────────────────────────────────────────
const PostoModal: React.FC<{
  posto: AcPosto | null;
  onClose: () => void;
  onSave: (input: { nome: string; endereco: string }) => Promise<string | null>;
}> = ({ posto, onClose, onSave }) => {
  const [nome, setNome] = useState(posto?.nome ?? '');
  const [endereco, setEndereco] = useState(posto?.endereco ?? '');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSave = async () => {
    if (!nome.trim()) {
      setErro('Informe o nome do posto.');
      return;
    }
    setSaving(true);
    setErro(null);
    const msg = await onSave({ nome: nome.trim(), endereco: endereco.trim() });
    setSaving(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            {posto ? 'Editar posto' : 'Novo posto'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Unidade Centro"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço</label>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua Central, 100 - Centro"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Editor de lista de horários (reutilizado em "fixos" e "exceção") ───────────
const inputCls =
  'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Modal de agenda do posto (horários fixos + exceções) ──────────────────────
const AgendaModal: React.FC<{
  posto: AcPosto;
  onClose: () => void;
  fetchHorariosPadrao: (postoId: string) => Promise<AcHorarioPadrao[]>;
  addHorarioPadrao: (input: { postoId: string; hora: string; capacidade: number }) => Promise<string | null>;
  removeHorarioPadrao: (id: string) => Promise<string | null>;
  fetchExcecoes: (postoId: string) => Promise<AcDiaExcecao[]>;
  saveExcecao: (input: { postoId: string; data: string; fechado: boolean; horarios: AcHorarioItem[] }) => Promise<string | null>;
  removeExcecao: (id: string) => Promise<string | null>;
}> = ({
  posto,
  onClose,
  fetchHorariosPadrao,
  addHorarioPadrao,
  removeHorarioPadrao,
  fetchExcecoes,
  saveExcecao,
  removeExcecao,
}) => {
  const [padroes, setPadroes] = useState<AcHorarioPadrao[]>([]);
  const [excecoes, setExcecoes] = useState<AcDiaExcecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Form: novo horário fixo
  const [horaP, setHoraP] = useState('');
  const [capP, setCapP] = useState(1);

  // Form: nova exceção
  const [excData, setExcData] = useState('');
  const [excFechado, setExcFechado] = useState(false);
  const [excHorarios, setExcHorarios] = useState<AcHorarioItem[]>([]);
  const [excHora, setExcHora] = useState('');
  const [excCap, setExcCap] = useState(1);
  const [salvandoExc, setSalvandoExc] = useState(false);

  const recarregar = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([fetchHorariosPadrao(posto.id), fetchExcecoes(posto.id)]);
    setPadroes(p);
    setExcecoes(e);
    setLoading(false);
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posto.id]);

  const handleAddPadrao = async () => {
    setErro(null);
    if (!horaP) {
      setErro('Escolha um horário.');
      return;
    }
    const msg = await addHorarioPadrao({ postoId: posto.id, hora: horaP, capacidade: capP });
    if (msg) {
      setErro(msg);
      return;
    }
    setHoraP('');
    setCapP(1);
    await recarregar();
  };

  const handleRemovePadrao = async (id: string) => {
    const msg = await removeHorarioPadrao(id);
    if (msg) setErro(msg);
    else await recarregar();
  };

  const addExcHorario = () => {
    if (!excHora) return;
    setExcHorarios((prev) =>
      prev.some((h) => h.hora === excHora) ? prev : [...prev, { hora: excHora, capacidade: excCap }].sort((a, b) => a.hora.localeCompare(b.hora)),
    );
    setExcHora('');
    setExcCap(1);
  };

  const removeExcHorario = (hora: string) =>
    setExcHorarios((prev) => prev.filter((h) => h.hora !== hora));

  const handleSalvarExcecao = async () => {
    setErro(null);
    if (!excData) {
      setErro('Escolha a data da exceção.');
      return;
    }
    if (!excFechado && excHorarios.length === 0) {
      setErro('Adicione horários para o dia ou marque como fechado.');
      return;
    }
    setSalvandoExc(true);
    const msg = await saveExcecao({
      postoId: posto.id,
      data: excData,
      fechado: excFechado,
      horarios: excHorarios,
    });
    setSalvandoExc(false);
    if (msg) {
      setErro(msg);
      return;
    }
    setExcData('');
    setExcFechado(false);
    setExcHorarios([]);
    await recarregar();
  };

  const handleRemoveExcecao = async (id: string) => {
    const msg = await removeExcecao(id);
    if (msg) setErro(msg);
    else await recarregar();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[88vh]">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Agenda do posto</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{posto.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {erro && (
          <div className="mx-6 mt-4 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {erro}
          </div>
        )}

        <div className="px-6 py-4 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ── Seção 1: Horários fixos ── */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Horários fixos</h4>
                  <span className="text-xs text-gray-400">seg a sáb</span>
                </div>

                {padroes.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Nenhum horário fixo ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {padroes.map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                        title={h.capacidade > 1 ? `Capacidade ${h.capacidade}` : undefined}
                      >
                        {h.hora}
                        {cap(h.capacidade)}
                        <button
                          onClick={() => void handleRemovePadrao(h.id)}
                          className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                          title="Remover"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Horário</label>
                    <input
                      type="time"
                      value={horaP}
                      onChange={(e) => setHoraP(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAddPadrao();
                        }
                      }}
                      className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-28">
                    <label
                      className="text-xs font-medium text-gray-500 dark:text-gray-400"
                      title="Quantos pacientes podem marcar este mesmo horário (padrão 1)."
                    >
                      Capacidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={capP}
                      onChange={(e) => setCapP(Math.max(1, Number(e.target.value)))}
                      className={inputCls}
                    />
                  </div>
                  <button
                    onClick={() => void handleAddPadrao()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar horário
                  </button>
                </div>
              </section>

              <div className="border-t border-gray-100 dark:border-gray-700" />

              {/* ── Seção 2: Exceções por dia ── */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarOff className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Exceções por dia</h4>
                  <span className="text-xs text-gray-400">feriado ou horário especial</span>
                </div>

                {excecoes.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Nenhuma exceção cadastrada.</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {excecoes.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                            {fmtData(ex.data)}
                          </span>
                          {ex.fechado ? (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Fechado
                            </span>
                          ) : (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              {ex.horarios.map((h) => h.hora + cap(h.capacidade)).join(', ') || '—'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => void handleRemoveExcecao(ex.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          title="Remover exceção"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Form nova exceção */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Data</label>
                      <input
                        type="date"
                        value={excData}
                        onChange={(e) => setExcData(e.target.value)}
                        className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
                      <input
                        type="checkbox"
                        checked={excFechado}
                        onChange={(e) => setExcFechado(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Fechar o dia (feriado)
                    </label>
                  </div>

                  {!excFechado && (
                    <div>
                      {excHorarios.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {excHorarios.map((h) => (
                            <span
                              key={h.hora}
                              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            >
                              {h.hora}
                              {cap(h.capacidade)}
                              <button
                                onClick={() => removeExcHorario(h.hora)}
                                className="p-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                title="Remover"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Horário</label>
                          <input
                            type="time"
                            value={excHora}
                            onChange={(e) => setExcHora(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addExcHorario();
                              }
                            }}
                            className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-24">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Capacidade</label>
                          <input
                            type="number"
                            min={1}
                            value={excCap}
                            onChange={(e) => setExcCap(Math.max(1, Number(e.target.value)))}
                            className={inputCls}
                          />
                        </div>
                        <button
                          onClick={addExcHorario}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar horário
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => void handleSalvarExcecao()}
                      disabled={salvandoExc}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
                    >
                      {salvandoExc ? 'Salvando…' : 'Salvar exceção'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    A exceção vale só para a data escolhida; os demais dias seguem os horários fixos.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const PostosPage: React.FC = () => {
  const {
    postos,
    loading,
    error,
    refetch,
    createPosto,
    updatePosto,
    deletePosto,
    fetchHorariosPadrao,
    addHorarioPadrao,
    removeHorarioPadrao,
    fetchExcecoes,
    saveExcecao,
    removeExcecao,
  } = usePostos();

  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [postoModal, setPostoModal] = useState<{ open: boolean; posto: AcPosto | null }>({
    open: false,
    posto: null,
  });
  const [agendaPosto, setAgendaPosto] = useState<AcPosto | null>(null);

  const handleDeletePosto = (p: AcPosto) => {
    showConfirmDialog(
      'Excluir posto',
      <span>
        Excluir o posto <strong className="text-gray-900 dark:text-gray-100">"{p.nome}"</strong>? Os horários dele também serão removidos.
      </span>,
      async () => {
        const msg = await deletePosto(p.id);
        if (msg) window.alert(`Não foi possível excluir: ${msg}`);
      },
      { type: 'danger', confirmText: 'Excluir' }
    );
  };

  return (
    <div className="max-w-6xl mx-auto pt-4 sm:pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Postos de Coleta</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unidades e horários oferecidos ao agendamento do paciente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setPostoModal({ open: true, posto: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo posto
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : postos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhum posto cadastrado</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Crie um posto para montar a agenda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {postos.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{p.nome}</h3>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.ativo
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-1">{p.endereco || '—'}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAgendaPosto(p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <CalendarClock className="w-4 h-4" />
                  Agenda
                </button>
                <button
                  onClick={() => setPostoModal({ open: true, posto: p })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => void updatePosto(p.id, { ativo: !p.ativo })}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={p.ativo ? 'Desativar' : 'Ativar'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void handleDeletePosto(p)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Excluir posto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {postoModal.open && (
        <PostoModal
          posto={postoModal.posto}
          onClose={() => setPostoModal({ open: false, posto: null })}
          onSave={(input) =>
            postoModal.posto ? updatePosto(postoModal.posto.id, input) : createPosto(input)
          }
        />
      )}

      {agendaPosto && (
        <AgendaModal
          posto={agendaPosto}
          onClose={() => setAgendaPosto(null)}
          fetchHorariosPadrao={fetchHorariosPadrao}
          addHorarioPadrao={addHorarioPadrao}
          removeHorarioPadrao={removeHorarioPadrao}
          fetchExcecoes={fetchExcecoes}
          saveExcecao={saveExcecao}
          removeExcecao={removeExcecao}
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

export default PostosPage;
