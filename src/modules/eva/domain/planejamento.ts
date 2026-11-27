// Planejamento e redistribuição (D47, issue 35). Puro: a api/ (NodeNext) importa, com ".js".
//
// "O que cabe na próxima sprint?": o ritmo de cada pessoa (cards concluídos por semana nas últimas
// 4) vira a capacidade até o fim da próxima sprint, descontada a ausência marcada (D40). O que ela
// já tem em aberto é o comprometido. Quem passa da capacidade e tem card fácil de passar adiante
// ganha a proposta de redistribuir para quem tem folga; o gestor confirma (SIM no WhatsApp, o
// cartão no chat) e a mudança entra pela mesma aprovação de sempre (D28, D37).
// Nada aqui é escrito pela IA.
import { diferencaDias, ehDiaUtil, formatarDiaMes, somarDias, type Dia } from './datas.js';
import { diaDaConclusao, diaVencimento, ehDoUsuario, estaAberto, estaConcluido, estaVisivel, type CardTI, type Prioridade } from './demandas.js';
import type { SprintTI } from './projetos.js';
import { ausenciaProxima, descreverAusencia, estaAusente, type Ausencia } from './ausencia.js';
import { nomeParaCitar } from './pessoas.js';

/** Semanas que medem o ritmo. */
export const SEMANAS_RITMO = 4;
/** Sprint planejada que começa depois disto não é "a próxima": vale a janela padrão. */
export const DIAS_SPRINT_PROXIMA = 28;
/** A janela padrão, sem sprint planejada: os próximos 10 dias úteis (duas semanas). */
export const DIAS_UTEIS_PADRAO = 10;
/** Quanto acima da capacidade pede redistribuição, e quanta folga quem recebe precisa ter. */
export const EXCESSO_PARA_PROPOR = 2;
export const FOLGA_PARA_RECEBER = 2;
/** Cards por pessoa sobrecarregada, e no total, numa proposta. */
export const MAX_MOVIDOS_POR_PESSOA = 2;
export const MAX_MOVIDOS = 4;
/** Cards do backlog sugeridos para entrar. */
export const MAX_DO_BACKLOG = 5;

const PESO: Record<Prioridade, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const PRIORIDADE: Record<Prioridade, string> = { low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' };
const MAX_TITULO = 45;
const titulo = (t: string) => (t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1).trimEnd()}…` : t);
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

// ── A janela ─────────────────────────────────────────────────────────────────

export interface JanelaPlanejamento {
  /** Hoje: o que está aberto agora precisa caber até `ate`. */
  de: Dia;
  ate: Dia;
  /** A próxima sprint, quando há uma planejada perto; senão, as próximas 2 semanas. */
  sprint: SprintTI | null;
  diasUteis: number;
}

/** Dias úteis de `de` a `ate`, os dois inclusos; `fora` tira os dias de ausência. */
export function contarDiasUteis(de: Dia, ate: Dia, fora: (dia: Dia) => boolean = () => false): number {
  let n = 0;
  for (let d = de; d <= ate; d = somarDias(d, 1)) if (ehDiaUtil(d) && !fora(d)) n += 1;
  return n;
}

/** O dia útil de número `n` contando de `de` (que conta, se for útil). */
function enesimoDiaUtil(de: Dia, n: number): Dia {
  let d = de;
  let conta = ehDiaUtil(d) ? 1 : 0;
  while (conta < n) {
    d = somarDias(d, 1);
    if (ehDiaUtil(d)) conta += 1;
  }
  return d;
}

/**
 * Até o fim da próxima sprint planejada (a que começa primeiro, em até 4 semanas). Sem ela, os
 * próximos 10 dias úteis, hoje incluso.
 */
export function janelaDoPlanejamento(sprints: SprintTI[], hoje: Dia): JanelaPlanejamento {
  const proxima = sprints
    .filter((s) => s.status === 'planned' && s.start_date && s.end_date && s.start_date.slice(0, 10) >= hoje && s.end_date.slice(0, 10) >= s.start_date.slice(0, 10))
    .filter((s) => diferencaDias(hoje, s.start_date!.slice(0, 10)) <= DIAS_SPRINT_PROXIMA)
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!) || a.end_date!.localeCompare(b.end_date!))[0] ?? null;
  const ate = proxima ? proxima.end_date!.slice(0, 10) : enesimoDiaUtil(hoje, DIAS_UTEIS_PADRAO);
  return { de: hoje, ate, sprint: proxima, diasUteis: contarDiasUteis(hoje, ate) };
}

// ── O plano ──────────────────────────────────────────────────────────────────

export interface EntradaPlanejamento {
  hoje: Dia;
  /** Os abertos e os concluídos das últimas 4 semanas, pelo menos (lerEntradaGestao). */
  cards: CardTI[];
  sprints: SprintTI[];
  /** Ids dos membros ativos da aba Membros. */
  equipe: string[];
  pessoas: Record<string, string>;
  ausencias?: Record<string, Ausencia>;
}

export interface PlanoPessoa {
  id: string;
  /** Concluídos nos últimos 28 dias, hoje incluso. */
  entregas: number;
  /** Entregas por semana (a média das 4). */
  ritmo: number;
  /** Sem entrega nas 4 semanas: a capacidade usa a média da equipe, e a pessoa não recebe cards. */
  semHistorico: boolean;
  /** Dias úteis da janela em que a pessoa está (sem os da ausência). */
  diasPresentes: number;
  /** Cards que cabem até o fim da janela, arredondado. */
  capacidade: number;
  /** Os abertos dela fora do Backlog, mais os do Backlog que já estão na sprint ou vencem na janela. */
  comprometidos: CardTI[];
  /** capacidade − comprometidos: positivo é folga; negativo, acima. */
  saldo: number;
  /** "de férias até 05/12", quando a ausência cai na janela ou já começou. */
  ausencia: string | null;
}

export interface Movimento { card: CardTI; de: string; para: string }

export interface Planejamento {
  hoje: Dia;
  janela: JanelaPlanejamento;
  pessoas: PlanoPessoa[];
  /** A média do ritmo de quem tem entrega nas 4 semanas (0 sem ninguém). */
  ritmoMedio: number;
  capacidadeEquipe: number;
  comprometidosEquipe: number;
  /** Soma das folgas de quem pode receber: o espaço para puxar do Backlog. */
  folgaEquipe: number;
  /** Do Backlog, fora do que já está comprometido, por prioridade: o que entraria. */
  doBacklog: CardTI[];
  movimentos: Movimento[];
  /** Como cada pessoa aparece no texto (primeiro nome, ou inteiro com xará). */
  nomes: Record<string, string>;
}

/** Comprometido: aberto fora do Backlog, ou no Backlog já na sprint da janela ou vencendo nela. */
function estaComprometido(c: CardTI, janela: JanelaPlanejamento): boolean {
  if (c.kanban_status !== 'backlog') return true;
  if (janela.sprint && c.sprint_id === janela.sprint.id) return true;
  const v = diaVencimento(c);
  return v !== null && v <= janela.ate;
}

/** Menos prioritário e com prazo mais longe (ou sem prazo) primeiro: o mais fácil de passar adiante. */
function facilDePassar(a: CardTI, b: CardTI): number {
  const p = PESO[a.priority] - PESO[b.priority];
  if (p !== 0) return p;
  const va = diaVencimento(a);
  const vb = diaVencimento(b);
  if (va !== vb) {
    if (va === null) return -1;
    if (vb === null) return 1;
    return va > vb ? -1 : 1;
  }
  return b.created_at.localeCompare(a.created_at);
}

/** Por prioridade, prazo mais perto e mais antigo: a ordem de entrada do Backlog. */
function ordemDoBacklog(a: CardTI, b: CardTI): number {
  const p = PESO[b.priority] - PESO[a.priority];
  if (p !== 0) return p;
  const va = diaVencimento(a);
  const vb = diaVencimento(b);
  if (va !== vb) {
    if (va === null) return 1;
    if (vb === null) return -1;
    return va < vb ? -1 : 1;
  }
  return a.created_at.localeCompare(b.created_at);
}

export function montarPlanejamento(e: EntradaPlanejamento): Planejamento {
  const { hoje } = e;
  const janela = janelaDoPlanejamento(e.sprints, hoje);
  const visiveis = e.cards.filter(estaVisivel);
  const abertos = visiveis.filter(estaAberto);
  const desde = somarDias(hoje, -(SEMANAS_RITMO * 7 - 1));
  const ausenciaDe = (id: string): Ausencia => e.ausencias?.[id] ?? { ausente_de: null, ausente_ate: null };

  const base = e.equipe.map((id) => {
    const entregas = visiveis.filter((c) => ehDoUsuario(c, id) && estaConcluido(c) && diaDaConclusao(c) >= desde && diaDaConclusao(c) <= hoje).length;
    const comprometidos = abertos.filter((c) => ehDoUsuario(c, id) && estaComprometido(c, janela));
    return { id, entregas, ritmo: entregas / SEMANAS_RITMO, comprometidos };
  });
  const comRitmo = base.filter((b) => b.entregas > 0);
  const ritmoMedio = comRitmo.length ? comRitmo.reduce((s, b) => s + b.ritmo, 0) / comRitmo.length : 0;

  const todos: PlanoPessoa[] = base.map((b) => {
    const a = ausenciaDe(b.id);
    const diasPresentes = contarDiasUteis(janela.de, janela.ate, (d) => estaAusente(a, d));
    const semHistorico = b.entregas === 0;
    const capacidade = Math.round(((semHistorico ? ritmoMedio : b.ritmo) / 5) * diasPresentes);
    const naJanela = !!a.ausente_ate && a.ausente_ate >= hoje && (!a.ausente_de || a.ausente_de <= janela.ate);
    return {
      id: b.id, entregas: b.entregas, ritmo: b.ritmo, semHistorico, diasPresentes, capacidade,
      comprometidos: b.comprometidos, saldo: capacidade - b.comprometidos.length,
      ausencia: naJanela || ausenciaProxima(a, hoje) ? descreverAusencia(a, hoje) : null,
    };
  });
  // Só aparece quem trabalha no Kanban: tem entrega nas 4 semanas ou card comprometido.
  const pessoas = todos
    .filter((p) => p.entregas > 0 || p.comprometidos.length > 0)
    .sort((a, b) => a.saldo - b.saldo || (e.pessoas[a.id] ?? '').localeCompare(e.pessoas[b.id] ?? '', 'pt-BR'));

  // Recebe quem tem ritmo medido, está aqui hoje, fica pelo menos metade da janela e tem folga.
  const podeReceber = (p: PlanoPessoa) =>
    !p.semHistorico && !estaAusente(ausenciaDe(p.id), hoje) && p.diasPresentes * 2 >= janela.diasUteis && p.saldo >= FOLGA_PARA_RECEBER;
  const folgas = new Map(pessoas.filter(podeReceber).map((p) => [p.id, p.saldo]));
  const folgaEquipe = Array.from(folgas.values()).reduce((s, x) => s + x, 0);

  const movimentos: Movimento[] = [];
  if (ritmoMedio > 0) {
    for (const p of pessoas.filter((x) => x.saldo <= -EXCESSO_PARA_PROPOR)) {
      // Passa adiante só o que ainda não começou, não é crítico e é só dela.
      const passaveis = p.comprometidos
        .filter((c) => c.assigned_to.length === 1 && (c.kanban_status === 'todo' || c.kanban_status === 'backlog') && c.priority !== 'critical')
        .sort(facilDePassar);
      let excesso = -p.saldo;
      let movidos = 0;
      for (const card of passaveis) {
        if (movidos >= MAX_MOVIDOS_POR_PESSOA || excesso <= 0 || movimentos.length >= MAX_MOVIDOS) break;
        const para = Array.from(folgas.entries())
          .filter(([id, folga]) => id !== p.id && folga >= 1)
          .sort((a, b) => b[1] - a[1] || (e.pessoas[a[0]] ?? '').localeCompare(e.pessoas[b[0]] ?? '', 'pt-BR'))[0]?.[0];
        if (!para) break;
        movimentos.push({ card, de: p.id, para });
        folgas.set(para, folgas.get(para)! - 1);
        excesso -= 1;
        movidos += 1;
      }
    }
  }

  // Do Backlog: o que ninguém assumiu, mesmo que já vença na janela, e o que ainda não está nela.
  const doBacklog = abertos
    .filter((c) => c.kanban_status === 'backlog' && (c.assigned_to.length === 0 || !estaComprometido(c, janela)))
    .sort(ordemDoBacklog)
    .slice(0, Math.min(MAX_DO_BACKLOG, Math.max(0, folgaEquipe - movimentos.length)));

  const todosOsNomes = Object.values(e.pessoas);
  const nomes = Object.fromEntries(Object.entries(e.pessoas).map(([id, nome]) => [id, nomeParaCitar(nome, todosOsNomes)]));
  return {
    hoje,
    janela,
    pessoas,
    ritmoMedio,
    capacidadeEquipe: pessoas.reduce((s, p) => s + p.capacidade, 0),
    comprometidosEquipe: pessoas.reduce((s, p) => s + p.comprometidos.length, 0),
    folgaEquipe,
    doBacklog,
    movimentos,
    nomes,
  };
}

/**
 * Quem passa da capacidade (para a pauta da reunião), do mais acima para o menos. Sem ritmo medido
 * (ninguém entregou nas 4 semanas), toda capacidade é zero: ninguém é acusado.
 */
export const acimaDaCapacidade = (p: Planejamento) => (p.ritmoMedio > 0 ? p.pessoas.filter((x) => x.saldo <= -EXCESSO_PARA_PROPOR) : []);

// ── Textos ───────────────────────────────────────────────────────────────────

/** "até o fim da Sprint 7 (12/12)", "até 10/12 (próximos 10 dias úteis)". */
export function rotuloDaJanela(j: JanelaPlanejamento): string {
  return j.sprint ? `até o fim da ${j.sprint.name} (${formatarDiaMes(j.ate)})` : `até ${formatarDiaMes(j.ate)} (próximos ${DIAS_UTEIS_PADRAO} dias úteis)`;
}

const ritmoTexto = (r: number) => `${decimal.format(r)}/semana`;
const nome = (p: Planejamento, id: string) => p.nomes[id] ?? 'Alguém';

/** "IT-050 Migração do servidor: Ana → Bruno" */
export const linhaDoMovimento = (p: Planejamento, m: Movimento) => `${m.card.codigo} ${titulo(m.card.title)}: ${nome(p, m.de)} → ${nome(p, m.para)}`;

/** "IT-050 e IT-051 de Ana para Bruno; IT-060 de Carla para Bruno": os cards juntos por par. */
export function resumoDosMovimentos(p: Planejamento): string {
  const pares = new Map<string, Movimento[]>();
  for (const m of p.movimentos) pares.set(`${m.de}|${m.para}`, [...(pares.get(`${m.de}|${m.para}`) ?? []), m]);
  const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
  return Array.from(pares.values()).map((ms) => `${juntar(ms.map((m) => m.card.codigo))} de ${nome(p, ms[0].de)} para ${nome(p, ms[0].para)}`).join('; ');
}

/** O comentário que fica no card quando a redistribuição é aplicada. */
export function comentarioDoMovimento(p: Planejamento, m: Movimento): string {
  const quando = p.janela.sprint ? `da ${p.janela.sprint.name}` : `até ${formatarDiaMes(p.janela.ate)}`;
  return `Redistribuído no planejamento ${quando}: ${nome(p, m.de)} estava acima da capacidade, e ${nome(p, m.para)} tinha folga.`;
}

function linhaDaPessoa(p: Planejamento, x: PlanoPessoa): string {
  const ritmo = x.semHistorico ? 'sem entrega em 4 semanas (usei a média da equipe)' : `ritmo ${ritmoTexto(x.ritmo)}`;
  const saldo = x.saldo < 0 ? `${-x.saldo} acima` : x.saldo === 0 ? 'no limite' : `folga de ${x.saldo}`;
  return `${nome(p, x.id)}: ${ritmo} · cabem ~${x.capacidade} · tem ${x.comprometidos.length} → ${saldo}${x.ausencia ? ` (${x.ausencia})` : ''}`;
}

/**
 * "O que cabe na próxima sprint?": a conta de cada pessoa, a equipe, o que entraria do Backlog e
 * a redistribuição proposta. `formato`: WhatsApp (•, emojis) ou chat (negrito e listas "- ").
 */
export function montarTextoPlanejamento(p: Planejamento, formato: 'whatsapp' | 'chat'): string {
  const chat = formato === 'chat';
  const item = chat ? '- ' : '• ';
  const cabeca = chat ? `**Planejamento ${rotuloDaJanela(p.janela)}**` : `📐 Planejamento ${rotuloDaJanela(p.janela)}`;
  if (p.pessoas.length === 0) return [cabeca, '', 'Ninguém da aba Membros tem card aberto nem entrega nas últimas 4 semanas.'].join('\n');
  if (p.ritmoMedio === 0) {
    return [cabeca, '', 'Ainda não dá para medir o ritmo: ninguém concluiu card nas últimas 4 semanas.', `Hoje a equipe tem ${p.comprometidosEquipe} cards em aberto.`].join('\n');
  }
  return [
    cabeca,
    `${p.janela.sprint ? `${p.janela.diasUteis} dias úteis até lá. ` : ''}Ritmo = cards concluídos por semana, na média das últimas 4.`,
    '',
    ...p.pessoas.map((x) => `${item}${linhaDaPessoa(p, x)}`),
    '',
    `Equipe: cabem ~${p.capacidadeEquipe}, já tem ${p.comprometidosEquipe}.`,
    ...(p.doBacklog.length
      ? [`Do Backlog, entrariam: ${p.doBacklog.map((c) => `${c.codigo} ${titulo(c.title)} (${PRIORIDADE[c.priority]})`).join('; ')}.`]
      : p.folgaEquipe <= 0 ? ['Sem folga para puxar mais nada do Backlog.'] : []),
    ...(p.movimentos.length
      ? ['', chat ? '**Para equilibrar**' : '💡 Para equilibrar', ...p.movimentos.map((m) => `${item}${linhaDoMovimento(p, m)}`)]
      : acimaDaCapacidade(p).length
        ? ['', 'Tem gente acima da capacidade, mas nenhum card fácil de passar adiante (os que não começaram, não críticos e só dela) ou ninguém com folga: vale rever prazos ou escopo.']
        : []),
  ].join('\n');
}
