// Cobrança da EVA pelo WhatsApp (issue 14, plano §10; D11, D13, D22; RN12, RN16).
// Pura: recebe `hoje` e `agora`. Usada pelo cron e pelo botão Cobrar (api/) e pelo
// Início, então os imports levam ".js" (a api/ compila com NodeNext).
import { diaDaSemana, diaDoPrazo, diaSP, diferencaDias, ehDiaUtil, formatarDiaMes, pluralDias, proximoDiaUtil, type Dia } from './datas.js';
import {
  compararDestaque, diaVencimento, diasDeAtraso, ehDoUsuario, estaAberto, estaAtrasado, estaParado, ordenarAtrasados,
  type CardTI,
} from './demandas.js';
import { primeiroNome } from './pessoas.js';

/** RN12: itens por mensagem; o resto vira "e outras N no Início". */
export const MAX_ITENS_MENSAGEM = 8;
/** RN16: no máximo uma cobrança manual por card neste intervalo. */
export const JANELA_COBRANCA_MS = 4 * 60 * 60 * 1000;
const MAX_TITULO = 60;

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const horaSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const titulo = (c: CardTI) => (c.title.length > MAX_TITULO ? `${c.title.slice(0, MAX_TITULO - 1).trimEnd()}…` : c.title);

// ── Pendências (as mesmas regras do Início: RN01 a RN04) ─────────────────────

export interface PendenciasMembro {
  atrasadas: CardTI[];
  /** Vencem hoje ou até o próximo dia útil (RN03, versão da cobrança). */
  vencendo: CardTI[];
  /** Em andamento ou revisão sem mudança há `diasParado` dias (RN04). */
  paradas: CardTI[];
}

/** Um card aparece numa seção só: atrasada > vencendo > parada. */
export function pendenciasDoMembro(
  cards: CardTI[],
  usuarioId: string,
  hoje: Dia,
  diasParado: number,
  ultimoComentario: Record<string, string> = {},
): PendenciasMembro {
  const meus = cards.filter((c) => estaAberto(c) && ehDoUsuario(c, usuarioId));
  const atrasadas = ordenarAtrasados(meus, hoje);
  const ja = new Set(atrasadas.map((c) => c.id));
  const limite = proximoDiaUtil(hoje);
  const vencendo = meus
    .filter((c) => {
      const v = diaVencimento(c);
      return !ja.has(c.id) && v !== null && v >= hoje && v <= limite;
    })
    .sort((a, b) => (diaVencimento(a)! < diaVencimento(b)! ? -1 : diaVencimento(a)! > diaVencimento(b)! ? 1 : compararDestaque(a, b)));
  for (const c of vencendo) ja.add(c.id);
  const paradas = meus
    .filter((c) => !ja.has(c.id) && estaParado(c, hoje, diasParado, ultimoComentario[c.id]))
    .sort((a, b) => ultimaMudanca(a, ultimoComentario).localeCompare(ultimaMudanca(b, ultimoComentario)));
  return { atrasadas, vencendo, paradas };
}

export const totalPendencias = (p: PendenciasMembro) => p.atrasadas.length + p.vencendo.length + p.paradas.length;

function ultimaMudanca(c: CardTI, ultimoComentario: Record<string, string>): Dia {
  return [c.updated_at, ultimoComentario[c.id]].filter(Boolean).map((t) => diaSP(t as string)).sort().pop()!;
}

// ── Mensagem da manhã (D11: modelo fixo, sem IA) ────────────────────────────

export interface EntradaMensagemDiaria {
  nome: string;
  hoje: Dia;
  pendencias: PendenciasMembro;
  diasParado: number;
  ultimoComentario?: Record<string, string>;
  /** URL do Início (`${APP_URL}/it/inicio`). */
  linkInicio: string;
}

/** O texto da cobrança diária, ou null quando não há pendência (RN12: sem pendência, sem mensagem). */
export function montarMensagemDiaria(e: EntradaMensagemDiaria): string | null {
  const { pendencias: p, hoje } = e;
  if (totalPendencias(p) === 0) return null;
  const limite = proximoDiaUtil(hoje);
  const quandoVence = (c: CardTI) => {
    const v = diaVencimento(c)!;
    if (v === hoje) return 'vence hoje';
    if (diferencaDias(hoje, v) === 1) return 'vence amanhã';
    return `vence ${NOME_DIA[diaDaSemana(v)]} (${formatarDiaMes(v)})`;
  };
  const tituloVencendo = diferencaDias(hoje, limite) === 1 ? 'Vencem hoje ou amanhã' : `Vencem até ${NOME_DIA[diaDaSemana(limite)]}`;

  const secoes: { titulo: string; itens: string[] }[] = [
    { titulo: '⚠️ Atrasadas', itens: p.atrasadas.map((c) => `• ${c.codigo} ${titulo(c)}: venceu ${formatarDiaMes(diaDoPrazo(c.due_date!))}`) },
    { titulo: `⏰ ${tituloVencendo}`, itens: p.vencendo.map((c) => `• ${c.codigo} ${titulo(c)}: ${quandoVence(c)}`) },
    {
      titulo: `💤 Paradas há ${pluralDias(e.diasParado)} ou mais`,
      itens: p.paradas.map((c) => `• ${c.codigo} ${titulo(c)}: sem atualização desde ${formatarDiaMes(ultimaMudanca(c, e.ultimoComentario ?? {}))}`),
    },
  ];

  let restantes = MAX_ITENS_MENSAGEM;
  const blocos: string[] = [];
  for (const s of secoes) {
    if (s.itens.length === 0 || restantes === 0) continue;
    const mostrar = s.itens.slice(0, restantes);
    restantes -= mostrar.length;
    blocos.push([s.titulo, ...mostrar].join('\n'));
  }
  const total = totalPendencias(p);
  const fora = total - (MAX_ITENS_MENSAGEM - restantes);

  const codigos = [...p.atrasadas, ...p.vencendo, ...p.paradas].map((c) => c.codigo);
  const exemplo = `"${codigos[0]} concluída", "${codigos[1] ?? codigos[0]} vai para sexta"`;
  const nome = primeiroNome(e.nome);
  return [
    `Bom dia${nome ? `, ${nome}` : ''}! Suas pendências de hoje (${formatarDiaMes(hoje)}):`,
    '',
    blocos.join('\n'),
    ...(fora > 0 ? ['', `… e outras ${fora} no Início.`] : []),
    '',
    `Responda aqui para atualizar (ex.: ${exemplo}).`,
    `Início: ${e.linkInicio}`,
  ].join('\n');
}

/** RN12: uma cobrança automática por pessoa por dia, mesmo se o cron rodar duas vezes. */
export const chaveDia = (membroId: string, hoje: Dia) => `cobranca:${membroId}:${hoje}`;

// ── Horário de cobrança (14/Out) ─────────────────────────────────────────────

/** Cobranças e lembretes só saem em dia útil, das 7h às 20h de Brasília. Teste e confirmação saem sempre. */
export const COBRANCA_DAS_HORAS = 7;
export const COBRANCA_ATE_AS_HORAS = 20;
/** Brasília é UTC−3 o ano todo (sem horário de verão desde 2019). */
const OFFSET_SP_HORAS = 3;

const horaSPNumero = (instante: number) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(instante)));

/**
 * null = pode cobrar agora. Fora do horário, devolve o instante (ms) em que a próxima janela
 * abre: hoje às 7h, se for madrugada de dia útil; senão, o próximo dia útil às 7h.
 * Feriados ficam de fora na v1, como em `ehDiaUtil`.
 */
export function proximaJanelaDeCobranca(agora: number): number | null {
  const dia = diaSP(new Date(agora));
  const hora = horaSPNumero(agora);
  if (ehDiaUtil(dia) && hora >= COBRANCA_DAS_HORAS && hora < COBRANCA_ATE_AS_HORAS) return null;
  const alvo = ehDiaUtil(dia) && hora < COBRANCA_DAS_HORAS ? dia : proximoDiaUtil(dia);
  return Date.parse(`${alvo}T${String(COBRANCA_DAS_HORAS + OFFSET_SP_HORAS).padStart(2, '0')}:00:00Z`);
}

export const ehTipoDeCobranca = (tipo: string) => tipo === 'cobranca' || tipo === 'cobranca_manual';

/**
 * Também respeitam o horário as mensagens do grupo da equipe (fechamento, resumo de reunião,
 * aviso; D29) e os lembretes pessoais (D30), que já nascem dentro dele.
 */
export const respeitaHorario = (tipo: string) => ehTipoDeCobranca(tipo) || tipo === 'grupo' || tipo === 'lembrete';

// ── Cobrança sob demanda (D22, RN16) ─────────────────────────────────────────

export type ModoCobranca = 'cobrar' | 'lembrar';

/** "Lembrar" quando o card é de quem clicou; "Cobrar" quando é de outra pessoa. */
export const modoDeCobranca = (card: CardTI, usuarioId: string): ModoCobranca => (ehDoUsuario(card, usuarioId) ? 'lembrar' : 'cobrar');

/** Texto do protótipo, mais o código do card (§10). */
export function montarCobrancaManual(e: { nome: string; card: CardTI; hoje: Dia; modo: ModoCobranca }): string {
  const nome = primeiroNome(e.nome);
  const atraso = pluralDias(Math.max(1, diasDeAtraso(e.card, e.hoje)));
  const sobre = `a task "${titulo(e.card)}" (${e.card.codigo}) está atrasada há ${atraso}`;
  const corpo = e.modo === 'lembrar'
    ? `Lembrete${nome ? `, ${nome}` : ''}: ${sobre}.`
    : `${nome ? `${nome}, ` : ''}${sobre}. Consegue atualizar o status?`;
  return `${corpo}\n\nResponda aqui para atualizar (ex.: "${e.card.codigo} concluída").`;
}

export interface MembroCobranca {
  id: string;
  user_id: string;
  nome: string;
  ativo: boolean;
  recebe_cobranca: boolean;
  whatsapp: string | null;
}

/** RN12/RN16: só membro ativo, com adesão e WhatsApp. */
export const podeReceber = (m: MembroCobranca) => m.ativo && m.recebe_cobranca && !!m.whatsapp;

/** Quem recebe: no Lembrar, só quem clicou; no Cobrar, cada responsável do card (§10). */
export function destinatarios(card: CardTI, modo: ModoCobranca, usuarioId: string, membros: MembroCobranca[]): MembroCobranca[] {
  const alvos = modo === 'lembrar' ? [usuarioId] : card.assigned_to;
  return membros.filter((m) => alvos.includes(m.user_id) && podeReceber(m));
}

export type ResultadoPodeCobrar =
  | { ok: true; modo: ModoCobranca }
  | { ok: false; status: 403 | 409 | 422; motivo: string };

export function podeCobrar(e: {
  card: CardTI;
  usuarioId: string;
  /** Gestor da EVA: canManageAgenteTI (ou admin), D31. */
  ehGestor: boolean;
  /** canManageIT (ou admin). */
  podeGerenciar: boolean;
  whatsappAtivo: boolean;
  /** Última cobrança manual deste card (created_at), se houver. */
  ultimaManualEm: string | null;
  agora: number;
  hoje: Dia;
}): ResultadoPodeCobrar {
  const modo = modoDeCobranca(e.card, e.usuarioId);
  if (modo === 'cobrar' && !e.ehGestor) return { ok: false, status: 403, motivo: 'Só gestores cobram cards de outras pessoas.' };
  if (modo === 'lembrar' && !e.podeGerenciar && !e.ehGestor) return { ok: false, status: 403, motivo: 'Sem permissão para usar a EVA.' };
  if (!e.whatsappAtivo) return { ok: false, status: 422, motivo: 'O WhatsApp da EVA está desligado (EVA → Configurações).' };
  if (!estaAtrasado(e.card, e.hoje)) return { ok: false, status: 422, motivo: `O ${e.card.codigo} não está atrasado.` };
  if (e.card.assigned_to.length === 0) return { ok: false, status: 422, motivo: `O ${e.card.codigo} não tem responsável.` };
  if (e.ultimaManualEm) {
    const desde = e.agora - new Date(e.ultimaManualEm).getTime();
    if (desde < JANELA_COBRANCA_MS) {
      const proxima = new Date(new Date(e.ultimaManualEm).getTime() + JANELA_COBRANCA_MS).toISOString();
      return {
        ok: false,
        status: 409,
        motivo: `O ${e.card.codigo} já foi cobrado às ${horaSP(e.ultimaManualEm)}. A próxima cobrança pode sair a partir das ${horaSP(proxima)}.`,
      };
    }
  }
  return { ok: true, modo };
}
