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
  Loader2,
  FlaskConical,
  Contact,
  FileText,
  Utensils,
  ShieldCheck,
  Check,
  Search,
  Microscope,
  Tag,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { usePostos } from '../hooks/usePostos';
import { useColetas } from '../hooks/useColetas';
import { useDocumentosAgendamento } from '../hooks/useDocumentosAgendamento';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { DocumentoThumb } from './DocumentoThumb';
import { DocumentoLightbox } from './DocumentoLightbox';
import {
  CHECKLIST_RECEPCAO,
  TIPOS_NO_CHECKLIST,
  isImagem,
  type AcAgendamento,
  type AcCheckin,
  type ChecklistItemKey,
  type DocumentoCheckin,
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

// Normaliza p/ busca acento-insensível (os nomes dos exames vêm em caixa alta com acento).
const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Rótulo de uma chave do checklist (p/ exibir nos bloqueados).
const CHECKLIST_LABEL: Record<string, string> = Object.fromEntries(
  CHECKLIST_RECEPCAO.map((i) => [i.key, i.label]),
);

// Opção do catálogo de exames (ac_exames) usada no multi-select do check-in.
interface ExameOpt {
  id: string;
  nome: string;
  mnemonico: string | null;
  material: string | null;
  is_cultura: boolean;
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

  // Liberou na conferência → fecha o check-in e abre direto o "Registrar coleta"
  // do mesmo agendamento (o problema/bloqueio segue por posConcluir, sem encadear).
  const posLiberar = async (ag: AcAgendamento) => {
    setConferindo(null);
    setColetando(ag);
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
              Conferência de recepção, seleção de exames, validade e etiqueta
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
            descricao="Selecione os exames, confira validade e etiquete"
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
          onLiberado={() => posLiberar(conferindo)}
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
  onLiberado: () => void | Promise<void>;
  registrarCheckin: ReturnType<typeof useColetas>['registrarCheckin'];
}> = ({ ag, conferidoPor, onClose, onDone, onLiberado, registrarCheckin }) => {
  const [checked, setChecked] = useState<Set<ChecklistItemKey>>(new Set());
  const [problemaMode, setProblemaMode] = useState(false);
  const [problemaEm, setProblemaEm] = useState<ChecklistItemKey | ''>('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Arquivos que o paciente enviou pelo app do LAB-HUB, p/ conferir cada item com o
  // documento à vista em vez de no palpite.
  const {
    documentos,
    loading: docsLoading,
    error: docsErro,
    expirado: docsExpirados,
    refetch: recarregarDocs,
  } = useDocumentosAgendamento(ag.id);

  const porTipo = useMemo(() => {
    const mapa: Record<string, DocumentoCheckin[]> = {};
    for (const d of documentos) (mapa[d.tipo] ??= []).push(d);
    return mapa;
  }, [documentos]);

  // Tipo fora do checklist (`outro`, ou um tipo novo criado no LAB-HUB): vai p/ a
  // seção do rodapé em vez de sumir da tela.
  const outros = useMemo(
    () => documentos.filter((d) => !TIPOS_NO_CHECKLIST.has(d.tipo)),
    [documentos],
  );

  // O lightbox navega por TODAS as imagens do agendamento, não só as do item clicado
  // — o operador folheia identidade → carteirinha → pedido sem fechar e reabrir.
  const imagens = useMemo(() => documentos.filter((d) => isImagem(d.mimeType)), [documentos]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const abrirLightbox = (doc: DocumentoCheckin) => {
    const i = imagens.findIndex((d) => d.id === doc.id);
    if (i >= 0) setLightboxIdx(i);
  };

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
    else await onLiberado(); // encadeia direto p/ o modal de registrar coleta
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
              <>
                {/* Faixa não-bloqueante: LAB-HUB fora do ar não pode travar o
                    check-in — o operador ainda confere no papel e libera. */}
                {docsErro && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">Não foi possível carregar os documentos — confira no balcão.</span>
                    <button
                      onClick={() => void recarregarDocs()}
                      className="font-semibold underline underline-offset-2 hover:no-underline shrink-0"
                    >
                      Tentar de novo
                    </button>
                  </div>
                )}
                {docsExpirados && !docsErro && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <CalendarClock className="w-4 h-4 shrink-0" />
                    <span className="flex-1">Os links dos documentos expiraram.</span>
                    <button
                      onClick={() => void recarregarDocs()}
                      className="font-semibold underline underline-offset-2 hover:no-underline shrink-0"
                    >
                      Atualizar
                    </button>
                  </div>
                )}

                {CHECKLIST_RECEPCAO.map((item) => {
                  const on = checked.has(item.key);
                  const Icon = ITEM_ICON[item.key];
                  const docs = item.tipoDocumento ? porTipo[item.tipoDocumento] ?? [] : [];
                  return (
                    // O contêiner é <div>, não <button>: as miniaturas são botões e
                    // links, e aninhá-las num botão é HTML inválido — o clique
                    // borbulharia e abrir o documento marcaria o item como conferido.
                    <div
                      key={item.key}
                      className={`rounded-xl border transition-all ${
                        on
                          ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/15 dark:border-emerald-800'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <button
                        onClick={() => toggle(item.key)}
                        className="w-full flex items-center gap-3.5 p-3.5 text-left rounded-xl"
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

                      {/* Irmão do botão de toggle, nunca dentro dele. */}
                      {item.tipoDocumento && (docsLoading || docs.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3.5 pl-[4.25rem]">
                          {docsLoading ? (
                            <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                          ) : (
                            docs.map((doc) => (
                              <DocumentoThumb key={doc.id} doc={doc} onAbrir={() => abrirLightbox(doc)} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Fora do CHECKLIST_RECEPCAO de propósito: entrar na lista mexeria em
                    todosOk e no ProgressRing. */}
                {outros.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                      Outros documentos
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {outros.map((doc) => (
                        <DocumentoThumb key={doc.id} doc={doc} onAbrir={() => abrirLightbox(doc)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
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

      {lightboxIdx !== null && (
        <DocumentoLightbox
          documentos={imagens}
          indice={lightboxIdx}
          onNavegar={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
};

// ─── Toggle de conferência (validade / etiqueta) ────────────────────────────────
const ToggleCard: React.FC<{
  icon: LucideIcon;
  label: string;
  desc: string;
  on: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, desc, on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
      on
        ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/15 dark:border-emerald-800'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30'
    }`}
  >
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        on ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'
      }`}
    >
      <Icon className="w-[18px] h-[18px]" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{label}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{desc}</div>
    </div>
    <span
      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
        on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'
      }`}
    >
      <Check className="w-3 h-3" />
    </span>
  </button>
);

// ─── Modal: recebimento — exames do pedido + validade + etiqueta ─────────────────
const ColetaModal: React.FC<{
  ag: AcAgendamento;
  coletorNome: string;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  registrarColeta: ReturnType<typeof useColetas>['registrarColeta'];
}> = ({ ag, coletorNome, onClose, onDone, registrarColeta }) => {
  const [coletadoPor, setColetadoPor] = useState(coletorNome);
  const [observacoes, setObservacoes] = useState('');
  const [catalogo, setCatalogo] = useState<ExameOpt[]>([]);
  const [loadingExames, setLoadingExames] = useState(true);
  const [examesErro, setExamesErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<ExameOpt[]>([]);
  const [validadeOk, setValidadeOk] = useState(false);
  const [etiquetado, setEtiquetado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega o catálogo de exames ativos (~500 linhas; o filtro é client-side).
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoadingExames(true);
      setExamesErro(null);
      const { data, error } = await supabase
        .from('ac_exames')
        .select('id, nome, mnemonico, material, is_cultura')
        .eq('ativo', true)
        .order('nome');
      if (!ativo) return;
      if (error) setExamesErro(error.message);
      else setCatalogo((data ?? []) as ExameOpt[]);
      setLoadingExames(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const selIds = useMemo(() => new Set(selecionados.map((e) => e.id)), [selecionados]);
  const resultados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return [];
    return catalogo
      .filter((e) => !selIds.has(e.id))
      .filter((e) => normalize(e.nome).includes(q) || (e.mnemonico ? normalize(e.mnemonico).includes(q) : false))
      .slice(0, 20);
  }, [busca, catalogo, selIds]);
  const culturasSel = useMemo(() => selecionados.filter((e) => e.is_cultura).length, [selecionados]);

  const addExame = (e: ExameOpt) => {
    setSelecionados((prev) => (prev.some((x) => x.id === e.id) ? prev : [...prev, e]));
    setBusca(''); // limpa o input após selecionar p/ facilitar a próxima busca
  };
  const removeExame = (id: string) => setSelecionados((prev) => prev.filter((e) => e.id !== id));

  const salvar = async () => {
    if (!coletadoPor.trim()) {
      setErro('Informe quem registrou o recebimento.');
      return;
    }
    if (selecionados.length === 0) {
      setErro('Selecione ao menos um exame do pedido.');
      return;
    }
    setSaving(true);
    setErro(null);
    const err = await registrarColeta(
      ag.id,
      coletadoPor.trim(),
      observacoes,
      selecionados.map((e) => e.id),
      validadeOk,
      etiquetado,
    );
    setSaving(false);
    if (err) setErro(err);
    else await onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col">
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
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* Registrado por */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Registrado por</label>
            <input
              type="text"
              value={coletadoPor}
              onChange={(e) => setColetadoPor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Exames do pedido */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Exames do pedido</label>

            {loadingExames ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando catálogo de exames…
              </div>
            ) : examesErro ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
                {examesErro}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Selecionados */}
                {selecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selecionados.map((e) => (
                      <span
                        key={e.id}
                        className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg text-xs font-medium border ${
                          e.is_cultura
                            ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/60'
                            : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700/50 dark:text-gray-200 dark:border-gray-600'
                        }`}
                      >
                        {e.is_cultura && <Microscope className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate max-w-[200px]">{e.nome}</span>
                        <button
                          onClick={() => removeExame(e.id)}
                          className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          aria-label={`Remover ${e.nome}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar exame por nome ou mnemônico…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Resultados da busca */}
                {busca.trim() &&
                  (resultados.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1">Nenhum exame encontrado.</p>
                  ) : (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
                      {resultados.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => addExame(e)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                            <FlaskConical className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{e.nome}</div>
                            <div className="text-xs text-gray-400 truncate">
                              {[e.mnemonico, e.material].filter(Boolean).join(' · ') || 'sem mnemônico'}
                            </div>
                          </div>
                          {e.is_cultura && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 shrink-0">
                              cultura
                            </span>
                          )}
                          <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  ))}

                {selecionados.length === 0 && !busca.trim() && (
                  <p className="text-xs text-gray-400 px-1">Busque e selecione os exames do pedido médico.</p>
                )}
                {culturasSel > 0 && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 px-1">
                    <Microscope className="w-3.5 h-3.5" />
                    {culturasSel} exame{culturasSel > 1 ? 's' : ''} de cultura{' '}
                    {culturasSel > 1 ? 'serão acompanhados' : 'será acompanhado'} na página Culturas.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Conferência da amostra: validade + etiqueta */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Conferência da amostra <span className="text-gray-400">(opcional)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <ToggleCard
                icon={CalendarClock}
                label="Validade da amostra"
                desc="Dentro do prazo"
                on={validadeOk}
                onClick={() => setValidadeOk((v) => !v)}
              />
              <ToggleCard
                icon={Tag}
                label="Etiqueta colocada"
                desc="Amostra identificada"
                on={etiquetado}
                onClick={() => setEtiquetado((v) => !v)}
              />
            </div>
          </div>

          {/* Observações */}
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
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 rounded-b-2xl flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400 tabular-nums">
            {selecionados.length} exame{selecionados.length === 1 ? '' : 's'} selecionado{selecionados.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => void salvar()}
              disabled={saving || loadingExames || selecionados.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-amber-500 to-orange-500 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar coleta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PainelColetasPage;
