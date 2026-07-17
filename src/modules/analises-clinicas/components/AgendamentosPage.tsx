import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  MapPin,
  Phone,
  RefreshCw,
  X,
  Inbox,
  Building2,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAgendamentos } from '../hooks/useAgendamentos';
import { usePostos } from '../hooks/usePostos';
import type { AcAgendamento, AcAgendamentoStatus } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

// Formata telefone BR para (xx) x xxxx-xxxx (celular) ou (xx) xxxx-xxxx (fixo).
// Tolera entrada com +55, espaços ou pontuação; se não bater, devolve o original.
const fmtTelefone = (tel: string): string => {
  let d = tel.replace(/\D/g, '');
  if (d.length === 13 || d.length === 12) d = d.replace(/^55/, ''); // remove DDI +55
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
};

// Normaliza p/ busca: remove acentos e caixa (ex.: "João" → "joao").
const norm = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Fuzzy por subsequência: todos os caracteres de `q` aparecem em `alvo` na
// mesma ordem, sem precisar ser contíguos (ex.: "jsil" casa "joao silva").
// `q` e `alvo` já devem vir normalizados.
const subseq = (q: string, alvo: string): boolean => {
  if (!q) return true;
  let i = 0;
  for (let j = 0; j < alvo.length && i < q.length; j++) {
    if (alvo[j] === q[i]) i += 1;
  }
  return i === q.length;
};

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// ─── Configuração de status ─────────────────────────────────────────────────────
interface StatusCfg {
  label: string;
  icon: LucideIcon;
  chip: string; // classes do chip (badge)
  dot: string; // cor do ponto pulsante
  avatar: string; // gradiente do avatar
}

const STATUS: Record<string, StatusCfg> = {
  recebido: {
    label: 'Recebido',
    icon: Inbox,
    chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    avatar: 'from-blue-500 to-indigo-600',
  },
  em_coleta: {
    label: 'Em coleta',
    icon: ClipboardCheck,
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    avatar: 'from-amber-400 to-orange-500',
  },
  coletado: {
    label: 'Coletado',
    icon: CheckCircle2,
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    avatar: 'from-emerald-400 to-green-600',
  },
  cancelado: {
    label: 'Cancelado',
    icon: XCircle,
    chip: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
    avatar: 'from-gray-400 to-gray-500',
  },
};

// Opções do seletor de status (derivadas do mapa acima).
const STATUS_OPCOES = Object.entries(STATUS).map(([value, cfg]) => ({ value, label: cfg.label }));

const statusCfg = (status: AcAgendamentoStatus): StatusCfg =>
  STATUS[status] ?? {
    label: status,
    icon: Inbox,
    chip: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    dot: 'bg-gray-400',
    avatar: 'from-gray-400 to-gray-500',
  };

// ─── Subcomponentes ─────────────────────────────────────────────────────────────
const StatusChip: React.FC<{ status: AcAgendamentoStatus }> = ({ status }) => {
  const cfg = statusCfg(status);
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.chip}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
};

const Avatar: React.FC<{ nome: string; gradient: string }> = ({ nome, gradient }) => (
  <div
    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm`}
  >
    {iniciais(nome)}
  </div>
);

// Cartão de resumo por posto (agendados / coletados + progresso).
const PostoCard: React.FC<{
  nome: string;
  endereco: string;
  agend: number;
  coletados: number;
  ativo: boolean;
  onClick: () => void;
}> = ({ nome, endereco, agend, coletados, ativo, onClick }) => {
  const pct = agend > 0 ? Math.round((coletados / agend) * 100) : 0;
  const barTone = pct >= 80 ? 'from-emerald-400 to-green-600' : 'from-blue-400 to-indigo-600';
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-2xl border bg-white dark:bg-gray-800 hover-lift transition-all ${
        ativo
          ? 'border-blue-400 ring-2 ring-blue-500/60 dark:border-blue-500'
          : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white bg-gradient-to-br ${
            ativo ? 'from-blue-500 to-indigo-600' : 'from-slate-400 to-slate-500'
          }`}
        >
          <Building2 className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{nome}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{endereco || '—'}</div>
        </div>
      </div>
      <div className="flex items-baseline justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
        <span>
          <b className="text-lg font-bold text-gray-800 dark:text-gray-100">{agend}</b> agendados
        </span>
        <span>
          <b className="text-emerald-600 dark:text-emerald-400 font-semibold">{coletados}</b> coletados
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-all duration-700`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </button>
  );
};

// Linha de um agendamento no formato "premium" da referência.
const AgendamentoRow: React.FC<{ ag: AcAgendamento; last: boolean }> = ({ ag, last }) => {
  const cfg = statusCfg(ag.status);
  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
        last ? '' : 'border-b border-gray-100 dark:border-gray-700'
      }`}
    >
      <Avatar nome={ag.paciente_nome} gradient={cfg.avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {ag.paciente_nome}
          </span>
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
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 text-right">
        <span className="text-base font-bold text-gray-800 dark:text-gray-100 tabular-nums leading-none">
          {fmtHora(ag.data_hora)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums mt-1">
          {fmtData(ag.data_hora)}
        </span>
      </div>
      <StatusChip status={ag.status} />
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────
const AgendamentosPage: React.FC = () => {
  const [postoSel, setPostoSel] = useState<string>(''); // ac_postos.id — '' = todos
  const [data, setData] = useState('');
  const [busca, setBusca] = useState(''); // nome ou telefone
  const [statusSel, setStatusSel] = useState(''); // '' = todos os status
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // O posto é filtrado no cliente para que os cartões-resumo sempre reflitam o
  // total do dia; a data continua filtrando no servidor (janela do dia).
  const filtros = useMemo(() => ({ data: data || undefined }), [data]);
  const { agendamentos, loading, error, refetch } = useAgendamentos(filtros);
  const { postos } = usePostos();

  const postosAtivos = useMemo(() => postos.filter((p) => p.ativo), [postos]);

  // Agendados / coletados por posto (a partir do conjunto já filtrado por data).
  const statsByPosto = useMemo(() => {
    const m = new Map<string, { agend: number; coletados: number }>();
    for (const ag of agendamentos) {
      if (!ag.posto_id) continue;
      const s = m.get(ag.posto_id) ?? { agend: 0, coletados: 0 };
      s.agend += 1;
      if (ag.status === 'coletado') s.coletados += 1;
      m.set(ag.posto_id, s);
    }
    return m;
  }, [agendamentos]);

  const lista = useMemo(() => {
    const q = norm(busca).replace(/\s+/g, ''); // normalizado e sem espaços p/ subsequência
    const qDigitos = busca.replace(/\D/g, ''); // busca por telefone ignora máscara
    return agendamentos.filter((a) => {
      if (postoSel && a.posto_id !== postoSel) return false;
      if (statusSel && a.status !== statusSel) return false;
      if (busca.trim()) {
        const nomeOk = subseq(q, norm(a.paciente_nome)); // fuzzy: acento-insensível + subsequência
        const telOk =
          qDigitos.length > 0 && (a.paciente_telefone ?? '').replace(/\D/g, '').includes(qDigitos);
        if (!nomeOk && !telOk) return false;
      }
      return true;
    });
  }, [agendamentos, postoSel, statusSel, busca]);

  const temFiltro = Boolean(postoSel || data || busca.trim() || statusSel);
  const nomePostoSel = postos.find((p) => p.id === postoSel)?.nome;
  // Painel de filtros: abre pelo botão "Filtrar" ou fica aberto enquanto há filtro
  // ativo (para o usuário sempre conseguir ver/limpar mesmo em resultado vazio).
  const filtroVisivel = mostrarFiltros || temFiltro;

  return (
    <div className="max-w-7xl mx-auto pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Agendamentos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mapeados por posto de coleta · recebidos via API Lab Hub
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

      {/* Cartões-resumo por posto */}
      {postosAtivos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5 animate-fade-in-up">
          {postosAtivos.map((p) => {
            const s = statsByPosto.get(p.id) ?? { agend: 0, coletados: 0 };
            return (
              <PostoCard
                key={p.id}
                nome={p.nome}
                endereco={p.endereco}
                agend={s.agend}
                coletados={s.coletados}
                ativo={postoSel === p.id}
                onClick={() => setPostoSel((cur) => (cur === p.id ? '' : p.id))}
              />
            );
          })}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          Falha ao carregar agendamentos: {error}
        </div>
      )}

      {/* Painel da lista */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-fade-in-up">
        {/* Cabeçalho do painel: contador à esquerda · botão Filtrar à direita */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              {nomePostoSel ? `Posto ${nomePostoSel}` : 'Todos os postos'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">recebidos via API Lab Hub</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 tabular-nums">
              <Users className="w-4 h-4" />
              {lista.length}
            </span>
            <button
              onClick={() => setMostrarFiltros((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                filtroVisivel
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtrar
            </button>
          </div>
        </div>

        {/* Linha de filtros (colapsável pelo botão Filtrar) */}
        {filtroVisivel && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30">
            {/* Busca por nome ou telefone */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Status */}
            <select
              value={statusSel}
              onChange={(e) => setStatusSel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os status</option>
              {STATUS_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {/* Data */}
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
            />
            {temFiltro && (
              <button
                onClick={() => {
                  setPostoSel('');
                  setData('');
                  setBusca('');
                  setStatusSel('');
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Corpo: loading · vazio · lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Nenhum agendamento</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {temFiltro ? 'Tente ajustar os filtros.' : 'Os agendamentos recebidos aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div>
            {lista.map((ag, i) => (
              <AgendamentoRow key={ag.id} ag={ag} last={i === lista.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendamentosPage;
