import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Plus,
  Pencil,
  CalendarClock,
  CalendarOff,
  CalendarDays,
  Clock,
  Trash2,
  X,
  RefreshCw,
  Power,
  Building2,
} from 'lucide-react';
import { usePostos, type AgendaInput } from '../hooks/usePostos';
import { useDialog } from '../../../hooks/useDialog';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { AcDiaExcecao, AcPosto } from '../types';

const fmtData = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

// Dias da semana (0=dom … 6=sáb) — fonte dos toggles e do resumo da grade.
const DIAS_SEMANA: { n: number; label: string }[] = [
  { n: 0, label: 'Dom' },
  { n: 1, label: 'Seg' },
  { n: 2, label: 'Ter' },
  { n: 3, label: 'Qua' },
  { n: 4, label: 'Qui' },
  { n: 5, label: 'Sex' },
  { n: 6, label: 'Sáb' },
];

const horaParaMin = (h: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Quantos horários a janela início→fim gera no passo `intervalo` (0 se inválida).
const contarHorarios = (inicio: string, fim: string, intervalo: number): number => {
  const ini = horaParaMin(inicio);
  const f = horaParaMin(fim);
  if (ini === null || f === null || !Number.isFinite(intervalo) || intervalo <= 0 || f < ini) return 0;
  return Math.floor((f - ini) / intervalo) + 1;
};

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

// ─── Inputs compartilhados ─────────────────────────────────────────────────────
const inputCls =
  'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

// ─── Modal de agenda do posto (grade de horários + datas bloqueadas) ───────────
const AgendaModal: React.FC<{
  posto: AcPosto;
  onClose: () => void;
  saveAgenda: (postoId: string, input: AgendaInput) => Promise<string | null>;
  fetchExcecoes: (postoId: string) => Promise<AcDiaExcecao[]>;
  addExcecao: (input: { postoId: string; data: string }) => Promise<string | null>;
  removeExcecao: (id: string) => Promise<string | null>;
}> = ({ posto, onClose, saveAgenda, fetchExcecoes, addExcecao, removeExcecao }) => {
  // Grade — semeada a partir do posto.
  const [inicio, setInicio] = useState(posto.agenda_hora_inicio ?? '');
  const [fim, setFim] = useState(posto.agenda_hora_fim ?? '');
  const [intervalo, setIntervalo] = useState<number>(posto.agenda_intervalo_min ?? 15);
  const [dias, setDias] = useState<number[]>(posto.agenda_dias_semana ?? []);
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [agendaSalva, setAgendaSalva] = useState(false);

  // Datas bloqueadas.
  const [excecoes, setExcecoes] = useState<AcDiaExcecao[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaData, setNovaData] = useState('');
  const [salvandoData, setSalvandoData] = useState(false);

  const [erro, setErro] = useState<string | null>(null);

  const recarregar = async () => {
    setLoading(true);
    setExcecoes(await fetchExcecoes(posto.id));
    setLoading(false);
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posto.id]);

  const qtdHorarios = useMemo(() => contarHorarios(inicio, fim, intervalo), [inicio, fim, intervalo]);
  const diasResumo = useMemo(
    () => DIAS_SEMANA.filter((d) => dias.includes(d.n)).map((d) => d.label).join(', '),
    [dias],
  );

  const toggleDia = (n: number) => {
    setAgendaSalva(false);
    setDias((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort((a, b) => a - b)));
  };

  const handleSalvarAgenda = async () => {
    setErro(null);
    setAgendaSalva(false);
    if (!inicio || !fim) {
      setErro('Informe o horário de início e de fim.');
      return;
    }
    if (horaParaMin(fim)! < horaParaMin(inicio)!) {
      setErro('O horário de fim deve ser maior ou igual ao de início.');
      return;
    }
    if (!Number.isFinite(intervalo) || intervalo < 1) {
      setErro('O intervalo deve ser de pelo menos 1 minuto.');
      return;
    }
    if (dias.length === 0) {
      setErro('Selecione ao menos um dia de funcionamento.');
      return;
    }
    setSalvandoAgenda(true);
    const msg = await saveAgenda(posto.id, {
      horaInicio: inicio,
      horaFim: fim,
      intervaloMin: intervalo,
      diasSemana: dias,
    });
    setSalvandoAgenda(false);
    if (msg) setErro(msg);
    else setAgendaSalva(true);
  };

  const handleBloquearData = async () => {
    setErro(null);
    if (!novaData) {
      setErro('Escolha a data a bloquear.');
      return;
    }
    setSalvandoData(true);
    const msg = await addExcecao({ postoId: posto.id, data: novaData });
    setSalvandoData(false);
    if (msg) {
      setErro(msg);
      return;
    }
    setNovaData('');
    await recarregar();
  };

  const handleRemoverData = async (id: string) => {
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
          {/* ── Seção 1: Horário de atendimento (grade) ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Horário de atendimento</h4>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Início</label>
                <input
                  type="time"
                  value={inicio}
                  onChange={(e) => { setInicio(e.target.value); setAgendaSalva(false); }}
                  className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Fim</label>
                <input
                  type="time"
                  value={fim}
                  onChange={(e) => { setFim(e.target.value); setAgendaSalva(false); }}
                  className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                />
              </div>
              <div className="flex flex-col gap-1 w-32">
                <label
                  className="text-xs font-medium text-gray-500 dark:text-gray-400"
                  title="Minutos entre um atendimento e o próximo (ex.: 15)."
                >
                  Intervalo (min)
                </label>
                <input
                  type="number"
                  min={1}
                  value={intervalo}
                  onChange={(e) => { setIntervalo(Math.max(1, Number(e.target.value))); setAgendaSalva(false); }}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Dias de funcionamento */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dias de funcionamento</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d) => {
                  const on = dias.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() => toggleDia(d.n)}
                      aria-pressed={on}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        on
                          ? 'bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-500/25'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumo + salvar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {qtdHorarios > 0 && dias.length > 0 ? (
                  <>
                    Gera <span className="font-semibold text-gray-700 dark:text-gray-200">{qtdHorarios}</span>{' '}
                    {qtdHorarios === 1 ? 'horário' : 'horários'}/dia
                    <span className="text-gray-400"> · </span>
                    {diasResumo}
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Preencha início, fim, intervalo e ao menos um dia.
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {agendaSalva && <span className="text-xs font-medium text-green-600 dark:text-green-400">Agenda salva ✓</span>}
                <button
                  onClick={() => void handleSalvarAgenda()}
                  disabled={salvandoAgenda}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
                >
                  {salvandoAgenda ? 'Salvando…' : 'Salvar agenda'}
                </button>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* ── Seção 2: Datas bloqueadas ── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <CalendarOff className="w-4 h-4 text-amber-500" />
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Datas bloqueadas</h4>
              <span className="text-xs text-gray-400">feriados</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <>
                {excecoes.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Nenhuma data bloqueada.</p>
                ) : (
                  <ul className="space-y-2 mb-3">
                    {excecoes.map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50"
                      >
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                          {fmtData(ex.data)}
                        </span>
                        <button
                          onClick={() => void handleRemoverData(ex.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                          title="Desbloquear data"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Data</label>
                    <input
                      type="date"
                      value={novaData}
                      onChange={(e) => setNovaData(e.target.value)}
                      className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`}
                    />
                  </div>
                  <button
                    onClick={() => void handleBloquearData()}
                    disabled={salvandoData}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    {salvandoData ? 'Bloqueando…' : 'Bloquear data'}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                  Uma data bloqueada não gera agenda; os demais dias seguem o horário de atendimento.
                </p>
              </>
            )}
          </section>
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
    saveAgenda,
    fetchExcecoes,
    addExcecao,
    removeExcecao,
  } = usePostos();

  const { confirmDialog, showConfirmDialog, hideConfirmDialog, handleConfirmDialogConfirm } = useDialog();

  const [postoModal, setPostoModal] = useState<{ open: boolean; posto: AcPosto | null }>({
    open: false,
    posto: null,
  });
  const [agendaPostoId, setAgendaPostoId] = useState<string | null>(null);
  // Deriva o posto da lista para o modal sempre refletir a última agenda salva.
  const agendaPosto = agendaPostoId ? postos.find((p) => p.id === agendaPostoId) ?? null : null;

  const handleDeletePosto = (p: AcPosto) => {
    showConfirmDialog(
      'Excluir posto',
      <span>
        Excluir o posto <strong className="text-gray-900 dark:text-gray-100">"{p.nome}"</strong>? A agenda dele também será removida.
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
                  onClick={() => setAgendaPostoId(p.id)}
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
          onClose={() => setAgendaPostoId(null)}
          saveAgenda={saveAgenda}
          fetchExcecoes={fetchExcecoes}
          addExcecao={addExcecao}
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
