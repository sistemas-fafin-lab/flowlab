import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Plus,
  Check,
  Loader2,
  UserCheck,
  ChevronRight,
  Droplets,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useAgendamentos,
  type AgendamentoManualInput,
  type AgendamentoCriado,
  type PacienteBuscaItem,
  type PostoDisponivel,
} from '../hooks/useAgendamentos';
import { usePostos } from '../hooks/usePostos';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/permissions';
import type { AcAgendamento, AcAgendamentoStatus, AcPosto, TipoDocumento } from '../types';

// Classe compartilhada de input (foco azul, cor do módulo de agendamentos).
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500';

// Input com borda vermelha (inválido) ou verde (válido) em tempo real.
const fieldCls = (erro = false, valid = false) =>
  `w-full px-3 py-2 rounded-lg border ${erro ? 'border-red-500 dark:border-red-500 focus:ring-red-500' : valid ? 'border-emerald-500 dark:border-emerald-500 focus:ring-emerald-500' : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'} bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2`;

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

// Só os dígitos de uma string (para CPF/telefone).
const soDigitos = (s: string): string => s.replace(/\D/g, '');

// Aplica a máscara de CPF (000.000.000-00) conforme o usuário digita.
const formatCpf = (s: string): string => {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

// Valida o CPF pelos dígitos verificadores (não só o comprimento). Rejeita
// sequências repetidas (000… 999…), que passam na conta mas não são CPFs reais.
const validarCpf = (valor: string): boolean => {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 || resto === 11 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
};

// Máscara progressiva de telefone: (00) 0000-0000 (fixo) ou (00) 00000-0000 (cel).
const maskTelefone = (s: string): string => {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

// Telefone BR válido: 10 (fixo) ou 11 (celular) dígitos, tolerando DDI +55.
const telefoneValido = (tel: string): boolean => {
  let d = soDigitos(tel);
  if (d.length === 12 || d.length === 13) d = d.replace(/^55/, '');
  return d.length === 10 || d.length === 11;
};

// Data de nascimento real (não inexistente/futura/anterior a 1900). 'YYYY-MM-DD'.
const nascimentoValido = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return ano >= 1900 && dt <= hoje;
};

// Hoje em YYYY-MM-DD local — teto do seletor de nascimento.
const hojeISO = (): string => new Date().toLocaleDateString('en-CA');

// Data de nascimento (YYYY-MM-DD) → dd/mm/aaaa. Sem new Date() de propósito:
// data pura não tem fuso e new Date('YYYY-MM-DD') recuaria um dia em fusos oeste.
const fmtNasc = (d: string): string => {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

// Rótulo da opção de data no seletor de slots (chave YYYY-MM-DD local).
// Ex.: "seg., 21/07". Meia-noite local evita o recuo de fuso.
const fmtDataOpcao = (dateKey: string): string =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

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

// Descrição do status exibida no drawer de detalhe.
const STATUS_DESC: Record<string, string> = {
  recebido: 'Aguardando conferência de recepção.',
  em_coleta: 'Liberado — aguardando registro da coleta.',
  coletado: 'Coleta registrada.',
  bloqueado: 'Conferência com problema — fora da fila de coleta.',
  cancelado: 'Agendamento cancelado.',
};

// Ação contextual por status. Só `recebido`/`em_coleta` levam a um modal no Painel
// de Coletas; os demais são terminais (o drawer mostra apenas o detalhe).
const ACAO_STATUS: Record<string, { label: string; icon: LucideIcon; classes: string }> = {
  recebido: {
    label: 'Fazer conferência',
    icon: ClipboardCheck,
    classes: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
  },
  em_coleta: {
    label: 'Registrar coleta',
    icon: Droplets,
    classes: 'from-amber-500 to-orange-500 shadow-amber-500/25',
  },
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

// Linha de um agendamento no formato "premium" da referência. Clicar abre o drawer
// de detalhe (com a ação contextual ao status).
const AgendamentoRow: React.FC<{ ag: AcAgendamento; last: boolean; onClick: () => void }> = ({
  ag,
  last,
  onClick,
}) => {
  const cfg = statusCfg(ag.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
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
      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
    </button>
  );
};

// ─── Drawer de detalhe do agendamento ───────────────────────────────────────────
// Gradiente sutil do hero, tingido pela cor do status (comunica o estado de relance).
const STATUS_HERO: Record<string, string> = {
  recebido: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
  em_coleta: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
  coletado: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
  bloqueado: 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20',
  cancelado: 'from-gray-100 to-gray-50 dark:from-gray-800/40 dark:to-gray-900/30',
};

// Linha de dado do detalhe (ícone em tile · rótulo · valor à direita).
const DetalheLinha: React.FC<{ icon: LucideIcon; label: string; valor: string }> = ({
  icon: Icon,
  label,
  valor,
}) => (
  <div className="flex items-center gap-3 px-4 py-2.5">
    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-400 shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
      {label}
    </span>
    <span className="ml-auto text-sm font-semibold text-gray-800 dark:text-gray-100 text-right tabular-nums truncate">
      {valor}
    </span>
  </div>
);

// Abre ao clicar numa linha da lista. Mostra os dados do agendamento e, quando o
// status permite (recebido → conferência, em_coleta → coleta) e o operador tem
// permissão, oferece o botão que leva ao modal correspondente no Painel de Coletas.
const DetalheAgendamentoModal: React.FC<{
  ag: AcAgendamento;
  canManage: boolean;
  onClose: () => void;
  onIrParaAcao: () => void;
}> = ({ ag, canManage, onClose, onIrParaAcao }) => {
  const cfg = statusCfg(ag.status);
  const acao = ACAO_STATUS[ag.status];
  const AcaoIcon = acao?.icon;
  const heroTint = STATUS_HERO[ag.status] ?? STATUS_HERO.cancelado;
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero tingido pelo status: avatar + nome + chip */}
        <div
          className={`relative bg-gradient-to-br ${heroTint} px-6 pt-6 pb-5 border-b border-gray-100 dark:border-gray-700`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4 pr-8">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cfg.avatar} text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md`}
            >
              {iniciais(ag.paciente_nome)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {ag.paciente_nome}
              </h3>
              <div className="mt-1.5">
                <StatusChip status={ag.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Corpo: callout do status + painel de dados */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60">
            <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse-soft shrink-0`} />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {STATUS_DESC[ag.status] ?? cfg.label}
            </span>
          </div>

          <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 divide-y divide-gray-100 dark:divide-gray-700/60 overflow-hidden bg-gray-50/50 dark:bg-gray-900/20">
            <DetalheLinha icon={MapPin} label="Posto" valor={ag.local_posto || '—'} />
            <DetalheLinha
              icon={CalendarClock}
              label="Agendado"
              valor={`${fmtHora(ag.data_hora)} · ${fmtData(ag.data_hora)}`}
            />
            {ag.paciente_telefone && (
              <DetalheLinha icon={Phone} label="Telefone" valor={fmtTelefone(ag.paciente_telefone)} />
            )}
            <DetalheLinha
              icon={Inbox}
              label="Recebido em"
              valor={`${fmtHora(ag.recebido_em)} · ${fmtData(ag.recebido_em)}`}
            />
          </div>
        </div>

        {/* Rodapé: fechar + ação contextual (só operador, só status com ação) */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700 rounded-b-2xl flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition-all duration-200"
          >
            Fechar
          </button>
          {acao && canManage && AcaoIcon && (
            <button
              onClick={onIrParaAcao}
              className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r ${acao.classes} shadow-md hover:shadow-lg hover-lift transition-all duration-200`}
            >
              <AcaoIcon className="w-4 h-4" />
              {acao.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Documentos anexados na criação (upload opcional) ───────────────────────────
type DocStatus = 'pendente' | 'enviando' | 'ok' | 'erro';
interface DocItem {
  id: string;
  file: File;
  tipo: TipoDocumento;
  status: DocStatus;
  erro?: string;
}
// Rótulos amigáveis dos tipos (o value espelha o CHECK de documentos.tipo no LAB-HUB).
const TIPO_DOC_OPCOES: { value: TipoDocumento; label: string }[] = [
  { value: 'identidade', label: 'Identidade' },
  { value: 'carteirinha', label: 'Carteirinha / Guia' },
  { value: 'pedido_medico', label: 'Pedido médico' },
  { value: 'outro', label: 'Outro' },
];
// Mesmos formatos que o LAB-HUB aceita (lib/fileType.ts) e teto do bucket.
const DOC_MIMES_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DOC_MAX_BYTES = 10 * 1024 * 1024;

// ─── Modal de criação manual (walk-in / encaixe) ────────────────────────────────
// Vincula o agendamento a um paciente do LAB-HUB. O operador busca por nome
// (typeahead); se a pessoa já existe, escolhe na lista e o agendamento sai para
// aquele paciente. Se não existe, informa nome + CPF + nascimento e o LAB-HUB cria
// um paciente "fantasma" (sem conta) que a pessoa reivindica ao se cadastrar com o
// mesmo CPF. O agendamento nasce no LAB-HUB e é sincronizado de volta.
const NovoAgendamentoModal: React.FC<{
  postos: AcPosto[]; // apenas ativos
  onClose: () => void;
  onCreate: (input: AgendamentoManualInput) => Promise<{ erro: string } | { criado: AgendamentoCriado }>;
  onUpload: (agendamentoFlowlabId: string, file: File, tipo: TipoDocumento) => Promise<string | null>;
  onBuscar: (q: string) => Promise<PacienteBuscaItem[]>;
  onDisponibilidade: () => Promise<PostoDisponivel[]>;
}> = ({ postos, onClose, onCreate, onUpload, onBuscar, onDisponibilidade }) => {
  const [nome, setNome] = useState('');
  const [pacienteSel, setPacienteSel] = useState<PacienteBuscaItem | null>(null);
  const [resultados, setResultados] = useState<PacienteBuscaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [postoSel, setPostoSel] = useState(postos.length === 1 ? postos[0].id : '');
  const [disponibilidade, setDisponibilidade] = useState<PostoDisponivel[]>([]);
  const [carregandoDisp, setCarregandoDisp] = useState(true);
  const [dataSel, setDataSel] = useState(''); // YYYY-MM-DD (local) escolhido
  const [slotSel, setSlotSel] = useState(''); // ISO do horário escolhido
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Documentos anexados (opcional). Enviados APÓS a criação — precisam do agendamento.
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docErro, setDocErro] = useState<string | null>(null);
  // Trava recriação em retries: uma vez criado, novos cliques só reenviam documentos.
  const [agCriado, setAgCriado] = useState(false);
  const [agCriadoId, setAgCriadoId] = useState<string | null>(null); // flowlabId p/ o upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega a disponibilidade real (mesma grade do paciente) ao abrir o modal.
  useEffect(() => {
    let vivo = true;
    setCarregandoDisp(true);
    void onDisponibilidade().then((d) => {
      if (!vivo) return;
      setDisponibilidade(d);
      setCarregandoDisp(false);
    });
    return () => { vivo = false; };
  }, [onDisponibilidade]);

  // Slots do posto escolhido, agrupados por data local (chave ordenável YYYY-MM-DD).
  const slotsDoPosto = useMemo(
    () => disponibilidade.find((d) => d.id === postoSel)?.slots ?? [],
    [disponibilidade, postoSel],
  );
  const porData = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const iso of slotsDoPosto) {
      const k = new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD local
      const arr = m.get(k);
      if (arr) arr.push(iso);
      else m.set(k, [iso]);
    }
    return m;
  }, [slotsDoPosto]);
  const datas = useMemo(() => [...porData.keys()].sort(), [porData]);
  const horariosDaData = dataSel ? porData.get(dataSel) ?? [] : [];

  // Trocar de posto invalida a data/horário escolhidos (a grade é outra).
  useEffect(() => {
    setDataSel('');
    setSlotSel('');
  }, [postoSel]);
  // Trocar de data invalida o horário.
  useEffect(() => {
    setSlotSel('');
  }, [dataSel]);

  // Debounce da busca por nome. Só busca no modo "novo" (sem paciente escolhido);
  // o contador descarta respostas fora de ordem.
  const buscaSeq = useRef(0);
  useEffect(() => {
    if (pacienteSel) return;
    const termo = nome.trim();
    if (termo.length < 2) {
      setResultados([]);
      setDropdownAberto(false);
      return;
    }
    const seq = ++buscaSeq.current;
    setBuscando(true);
    const t = setTimeout(async () => {
      const achados = await onBuscar(termo);
      if (seq !== buscaSeq.current) return;
      setResultados(achados);
      setDropdownAberto(true);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [nome, pacienteSel, onBuscar]);

  const escolherPaciente = (p: PacienteBuscaItem) => {
    setPacienteSel(p);
    setNome(p.nome);
    setResultados([]);
    setDropdownAberto(false);
    setErro(null);
  };

  // Editar o nome desfaz a escolha e volta ao modo busca/novo paciente.
  const handleNomeChange = (v: string) => {
    setNome(v);
    if (pacienteSel) setPacienteSel(null);
  };

  const modoNovo = !pacienteSel;

  // Estados de erro / valid visual em tempo real (borda vermelha / verde).
  const cpfErro = modoNovo && cpf.length > 0 && !validarCpf(cpf);
  const nascErro = modoNovo && dataNascimento.length > 0 && !nascimentoValido(dataNascimento);
  const telErro = telefone.length > 0 && !telefoneValido(telefone);
  const cpfValid = modoNovo && validarCpf(cpf);
  const nascValid = modoNovo && nascimentoValido(dataNascimento);
  const telValid = telefone.length > 0 && telefoneValido(telefone);

  // ── Documentos ────────────────────────────────────────────────────────────────
  const adicionarArquivos = (files: FileList | null) => {
    if (!files) return;
    setDocErro(null);
    const novos: DocItem[] = [];
    const rejeitados: string[] = [];
    for (const file of Array.from(files)) {
      if (!DOC_MIMES_ACEITOS.includes(file.type)) rejeitados.push(`${file.name} (formato)`);
      else if (file.size > DOC_MAX_BYTES) rejeitados.push(`${file.name} (>10 MB)`);
      else novos.push({ id: crypto.randomUUID(), file, tipo: 'outro', status: 'pendente' });
    }
    if (novos.length) setDocs((prev) => [...prev, ...novos]);
    if (rejeitados.length) setDocErro(`Ignorado(s): ${rejeitados.join(', ')}.`);
  };
  const removerDoc = (id: string) => setDocs((prev) => prev.filter((d) => d.id !== id));
  const mudarTipoDoc = (id: string, tipo: TipoDocumento) =>
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, tipo } : d)));

  const docsPendentes = docs.some((d) => d.status !== 'ok');

  const handleSave = async () => {
    setErro(null);

    // Enquanto o agendamento não existe, valida o form; depois, é só reenvio de docs.
    if (!agCriado) {
      if (modoNovo) {
        if (!nome.trim()) return setErro('Informe o nome do paciente.');
        if (!validarCpf(cpf)) return setErro('CPF inválido. Confira os números.');
        if (!nascimentoValido(dataNascimento)) return setErro('Data de nascimento inválida.');
      }
      // Telefone é opcional, mas se informado precisa ser um número BR válido.
      if (telefone.trim() && !telefoneValido(telefone)) {
        return setErro('Telefone inválido — inclua o DDD.');
      }
      if (!postoSel) return setErro('Selecione o posto.');
      if (!slotSel) return setErro('Selecione a data e o horário.');
    }

    setSaving(true);

    // 1) Cria o agendamento — uma única vez. `agCriado` impede recriar num retry.
    let flowlabId = agCriadoId;
    if (!agCriado) {
      const telefoneDigitos = soDigitos(telefone) || null; // armazena limpo
      const resultado = await onCreate(
        pacienteSel
          ? { pacienteId: pacienteSel.id, telefone: telefoneDigitos, postoId: postoSel, dataHora: slotSel }
          : {
              nome: nome.trim(),
              cpf: soDigitos(cpf),
              dataNascimento,
              telefone: telefoneDigitos,
              postoId: postoSel,
              dataHora: slotSel,
            },
      );
      if ('erro' in resultado) {
        setSaving(false);
        return setErro(resultado.erro);
      }
      setAgCriado(true);
      flowlabId = resultado.criado.flowlabId;
      setAgCriadoId(flowlabId);
    }

    // Sem documentos: encerra assim que criou.
    if (docs.length === 0) {
      setSaving(false);
      return onClose();
    }

    // 2) Sobe os documentos. Precisamos do id do FlowLab p/ resolver o labhub_id no
    //    servidor; se o sync não confirmou (flowlabId null), o agendamento existe mas
    //    não dá p/ anexar agora — avisa e mantém o modal aberto.
    if (!flowlabId) {
      setSaving(false);
      return setErro(
        'Agendamento criado, mas a sincronização com o FlowLab não confirmou a tempo — os documentos não puderam ser anexados. Tente novamente em instantes.',
      );
    }

    let algumaFalha = false;
    for (const d of docs) {
      if (d.status === 'ok') continue; // já enviado num retry anterior
      setDocs((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, status: 'enviando', erro: undefined } : x)),
      );
      const err = await onUpload(flowlabId, d.file, d.tipo);
      setDocs((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, status: err ? 'erro' : 'ok', erro: err ?? undefined } : x,
        ),
      );
      if (err) algumaFalha = true;
    }

    setSaving(false);
    if (algumaFalha) {
      return setErro('Alguns documentos não foram enviados. Ajuste e toque em "Reenviar documentos".');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Criar agendamento</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Walk-in / encaixe · vinculado ao paciente no Lab Hub
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm whitespace-pre-line">
              {erro}
            </div>
          )}

          {agCriado && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Agendamento criado.{docsPendentes ? ' Envie os documentos abaixo.' : ''}
            </div>
          )}

          {/* Campos do agendamento — travados após a criação (fieldset disabled). */}
          <fieldset disabled={agCriado} className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-60">
          {/* Nome + typeahead de pacientes do LAB-HUB */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do paciente
            </label>
            <div className="relative flex items-center">
              <input
                value={nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                onFocus={() => resultados.length > 0 && setDropdownAberto(true)}
                // Fecha depois de um tick p/ o clique num resultado registrar antes.
                onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                placeholder="Digite para buscar ou cadastrar"
                autoFocus
                autoComplete="off"
                className={`${inputCls} pr-10`}
              />
              {buscando && (
                <Loader2 className="absolute right-3 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Dropdown de resultados */}
            {dropdownAberto && !pacienteSel && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
                {resultados.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                    Nenhum paciente encontrado — preencha CPF e nascimento para cadastrar.
                  </div>
                ) : (
                  resultados.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => escolherPaciente(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
                    >
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {p.nome}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        CPF {p.cpfMascarado} · Nasc. {fmtNasc(p.dataNascimento)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Paciente escolhido: confirmação + trocar. Sem CPF/nascimento (já é dele). */}
          {pacienteSel ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Paciente do Lab Hub
                </div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 tabular-nums truncate">
                  CPF {pacienteSel.cpfMascarado} · Nasc. {fmtNasc(pacienteSel.dataNascimento)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPacienteSel(null)}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
              >
                Trocar
              </button>
            </div>
          ) : (
            <>
              {/* CPF + Nascimento (obrigatórios p/ paciente novo) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPF</label>
                  <div className="relative flex items-center">
                    <input
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      className={`${fieldCls(cpfErro, cpfValid)} tabular-nums pr-10`}
                    />
                    {cpfValid && <Check className="absolute right-3 w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nascimento
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      min="1900-01-01"
                      max={hojeISO()}
                      className={`${fieldCls(nascErro, nascValid)} [color-scheme:light] dark:[color-scheme:dark] pr-10`}
                    />
                    {nascValid && <Check className="absolute right-3 w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
              </div>
              <p className="-mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <Check className="w-3.5 h-3.5" />
                Se o CPF já tiver conta, o agendamento é vinculado a ela automaticamente.
              </p>
            </>
          )}

          {/* Telefone (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telefone <span className="text-gray-400">(opcional)</span>
            </label>
            <div className="relative flex items-center">
              <input
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                inputMode="tel"
                className={`${fieldCls(telErro, telValid)} pr-10`}
              />
              {telValid && <Check className="absolute right-3 w-4 h-4 text-emerald-500" />}
            </div>
          </div>

          {/* Posto (obrigatório) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posto</label>
            <select value={postoSel} onChange={(e) => setPostoSel(e.target.value)} className={inputCls}>
              <option value="">Selecione…</option>
              {postos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data e horário — apenas slots reais da grade do posto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data</label>
              <select
                value={dataSel}
                onChange={(e) => setDataSel(e.target.value)}
                disabled={!postoSel || carregandoDisp}
                className={`${inputCls} disabled:opacity-60`}
              >
                <option value="">
                  {!postoSel ? 'Escolha o posto' : carregandoDisp ? 'Carregando…' : 'Selecione…'}
                </option>
                {datas.map((k) => (
                  <option key={k} value={k}>
                    {fmtDataOpcao(k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Horário</label>
              <select
                value={slotSel}
                onChange={(e) => setSlotSel(e.target.value)}
                disabled={!dataSel}
                className={`${inputCls} tabular-nums disabled:opacity-60`}
              >
                <option value="">Selecione…</option>
                {horariosDaData.map((iso) => (
                  <option key={iso} value={iso}>
                    {fmtHora(iso)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {postoSel && !carregandoDisp && datas.length === 0 && (
            <p className="-mt-2 text-xs text-amber-600 dark:text-amber-400">
              Sem horários disponíveis para este posto. Ajuste a agenda do posto ou escolha outro.
            </p>
          )}
          </fieldset>

          {/* Documentos (opcional) — enviados ao LAB-HUB após criar o agendamento */}
          <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-gray-700/60">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Paperclip className="w-4 h-4 text-gray-400" />
                Documentos <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  adicionarArquivos(e.target.files);
                  e.target.value = ''; // permite reescolher o mesmo arquivo
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              Identidade, carteirinha, pedido médico… JPG, PNG, WEBP ou PDF, até 10 MB.
            </p>

            {docErro && <p className="text-xs text-amber-600 dark:text-amber-400">{docErro}</p>}

            {docs.length > 0 && (
              <div className="space-y-2">
                {docs.map((d) => {
                  const DocIcon = d.file.type === 'application/pdf' ? FileText : ImageIcon;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-900/30"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          d.status === 'ok'
                            ? 'bg-emerald-500 text-white'
                            : d.status === 'erro'
                              ? 'bg-rose-500 text-white'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400'
                        }`}
                      >
                        {d.status === 'enviando' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : d.status === 'ok' ? (
                          <Check className="w-4 h-4" />
                        ) : d.status === 'erro' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <DocIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {d.file.name}
                        </div>
                        <div className="text-xs text-gray-400 tabular-nums truncate">
                          {(d.file.size / 1024).toFixed(0)} KB
                          {d.status === 'erro' && d.erro ? ` · ${d.erro}` : ''}
                        </div>
                      </div>
                      <select
                        value={d.tipo}
                        onChange={(e) => mudarTipoDoc(d.id, e.target.value as TipoDocumento)}
                        disabled={d.status === 'ok' || d.status === 'enviando'}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 shrink-0"
                      >
                        {TIPO_DOC_OPCOES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {d.status !== 'ok' && d.status !== 'enviando' && (
                        <button
                          type="button"
                          onClick={() => removerDoc(d.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors shrink-0"
                          aria-label={`Remover ${d.file.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {agCriado ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || (agCriado && !docsPendentes)}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            {saving
              ? agCriado
                ? 'Enviando…'
                : 'Salvando…'
              : agCriado
                ? 'Reenviar documentos'
                : 'Criar agendamento'}
          </button>
        </div>
      </div>
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
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<AcAgendamento | null>(null);
  const navigate = useNavigate();

  // O posto é filtrado no cliente para que os cartões-resumo sempre reflitam o
  // total do dia; a data continua filtrando no servidor (janela do dia).
  const filtros = useMemo(() => ({ data: data || undefined }), [data]);
  const {
    agendamentos,
    loading,
    error,
    refetch,
    buscarPacientes,
    buscarDisponibilidade,
    criarAgendamentoManual,
    uploadDocumento,
  } = useAgendamentos(filtros);
  const { postos } = usePostos();
  const { userProfile } = useAuth();
  const canManage = hasPermission(userProfile?.permissions || [], 'canManageColetas');

  // Deep-link para o Painel de Coletas: leva o item ao modal do seu status já no
  // dia certo (?data). A rota /coletas exige canManageColetas — por isso o botão de
  // ação no drawer só aparece quando canManage é true.
  const abrirNoColetas = (ag: AcAgendamento) => {
    const dataKey = new Date(ag.data_hora).toLocaleDateString('en-CA'); // YYYY-MM-DD local
    navigate(`/analises-clinicas/coletas?open=${ag.id}&data=${dataKey}`);
  };

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
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setMostrarNovo(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4" />
              Criar agendamento
            </button>
          )}
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {mostrarNovo && (
        <NovoAgendamentoModal
          postos={postosAtivos}
          onClose={() => setMostrarNovo(false)}
          onCreate={criarAgendamentoManual}
          onUpload={uploadDocumento}
          onBuscar={buscarPacientes}
          onDisponibilidade={buscarDisponibilidade}
        />
      )}

      {detalhe && (
        <DetalheAgendamentoModal
          ag={detalhe}
          canManage={canManage}
          onClose={() => setDetalhe(null)}
          onIrParaAcao={() => abrirNoColetas(detalhe)}
        />
      )}

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
              <AgendamentoRow
                key={ag.id}
                ag={ag}
                last={i === lista.length - 1}
                onClick={() => setDetalhe(ag)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendamentosPage;
