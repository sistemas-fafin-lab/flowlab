// Respostas visuais do chat (D34): a formatação leve do texto, os cards citados como cartões e
// os dados de cada bloco. Tudo sai do board que o Início já carregou; a IA só escolheu o bloco.
// Puras: recebem `hoje` e os dados, não leem relógio nem rede.
import { KANBAN_STATUS_COLORS, KANBAN_STATUS_LABELS, PRIORITY_CONFIG, PROJECT_STATUS_CONFIG } from '../constants';
import { diferencaDias, formatarDiaMes, pluralDias, somarDias, type Dia } from './datas';
import {
  COLUNAS, compararDestaque, diaVencimento, diasDeAtraso, ehDoUsuario, estaAberto, estaAtrasado, estaConcluido, resumoKanban,
  type CardTI, type ColunaKanban, type Prioridade,
} from './demandas';
import { resumirProjeto, tempoDecorrido, type ProjetoTI, type SprintTI } from './projetos';
import { gradientePara, iniciais } from './pessoas';
import type { BadgeTone, EvaView, StatCardData, TeamMember } from '../types';
import type { BlocoChat } from './blocos';

// ─── Texto ──────────────────────────────────────────────────────────────────────

/** Um pedaço de linha: texto ou código de card (vira link quando o card existe). */
export interface Parte { tipo: 'texto' | 'card'; valor: string; negrito?: true }
export type BlocoTexto =
  | { tipo: 'paragrafo'; linhas: Parte[][] }
  | { tipo: 'lista'; ordenada: boolean; itens: Parte[][] };

const RE_CODIGO = /\b([A-Z]{2,6}-\d{1,6})\b/g;
// Como no Markdown: o negrito não começa nem termina com espaço ("5 ** 2" não é negrito).
const RE_NEGRITO = /\*\*(?=\S)(.+?)(?<=\S)\*\*/g;
const RE_ITEM = /^(?:[-•*]|(\d+)[.)])\s+(.*)$/;
const RE_TITULO = /^#{1,6}\s+(.*)$/;

function partesDaLinha(linha: string, negritoTudo = false): Parte[] {
  const partes: Parte[] = [];
  const empurrar = (trecho: string, negrito: boolean) => {
    let ultimo = 0;
    const add = (p: Parte) => partes.push(negrito ? { ...p, negrito: true } : p);
    for (const m of trecho.matchAll(RE_CODIGO)) {
      if (m.index! > ultimo) add({ tipo: 'texto', valor: trecho.slice(ultimo, m.index) });
      add({ tipo: 'card', valor: m[1] });
      ultimo = m.index! + m[0].length;
    }
    if (ultimo < trecho.length) add({ tipo: 'texto', valor: trecho.slice(ultimo) });
  };
  // "**" sem par fica como texto: só pares viram negrito.
  let ultimo = 0;
  for (const m of linha.matchAll(RE_NEGRITO)) {
    if (m.index! > ultimo) empurrar(linha.slice(ultimo, m.index), negritoTudo);
    empurrar(m[1], true);
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < linha.length) empurrar(linha.slice(ultimo), negritoTudo);
  return partes;
}

/**
 * A formatação que a EVA pode usar (INSTRUCOES_CHAT, regra 1): parágrafos, listas com "- "
 * (ou "•", "*", "1."), **negrito** e códigos de card. Título com "#" vira linha em negrito.
 * Nada vira HTML: o resultado é desenhado como texto pelo React.
 */
export function blocosDoTexto(texto: string): BlocoTexto[] {
  const blocos: BlocoTexto[] = [];
  let atual: BlocoTexto | null = null;
  for (const bruta of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim();
    if (!linha) { atual = null; continue; }
    const item = RE_ITEM.exec(linha);
    if (item) {
      const ordenada = !!item[1];
      if (atual?.tipo !== 'lista' || atual.ordenada !== ordenada) {
        atual = { tipo: 'lista', ordenada, itens: [] };
        blocos.push(atual);
      }
      atual.itens.push(partesDaLinha(item[2]));
      continue;
    }
    const titulo = RE_TITULO.exec(linha);
    const partes = titulo ? partesDaLinha(titulo[1], true) : partesDaLinha(linha);
    if (atual?.tipo !== 'paragrafo') {
      atual = { tipo: 'paragrafo', linhas: [] };
      blocos.push(atual);
    }
    atual.linhas.push(partes);
  }
  return blocos;
}

const linhasDe = (b: BlocoTexto) => (b.tipo === 'lista' ? b.itens : b.linhas);
const tamanhoDe = (partes: Parte[]) => partes.reduce((n, p) => n + p.valor.length, 0);

/** Quantos caracteres de texto visível a resposta tem (a revelação conta por eles). */
export function tamanhoDoTexto(blocos: BlocoTexto[]): number {
  return blocos.reduce((n, b) => n + linhasDe(b).reduce((m, l) => m + tamanhoDe(l), 0), 0);
}

/** Os primeiros `limite` caracteres visíveis, com a formatação no lugar (a fala aparecendo). */
export function cortarTexto(blocos: BlocoTexto[], limite: number): BlocoTexto[] {
  let resta = limite;
  const saida: BlocoTexto[] = [];
  for (const b of blocos) {
    if (resta <= 0) break;
    const linhas: Parte[][] = [];
    for (const l of linhasDe(b)) {
      if (resta <= 0) break;
      const partes: Parte[] = [];
      for (const p of l) {
        if (resta <= 0) break;
        if (p.valor.length <= resta) { partes.push(p); resta -= p.valor.length; }
        // Código de card não aparece pela metade.
        else { if (p.tipo === 'texto') partes.push({ ...p, valor: p.valor.slice(0, resta) }); resta = 0; }
      }
      linhas.push(partes);
    }
    saida.push(b.tipo === 'lista' ? { ...b, itens: linhas } : { ...b, linhas });
  }
  return saida;
}

// ─── Contexto ───────────────────────────────────────────────────────────────────

/** O que o Início já leu e os blocos usam. */
export interface ContextoVisual {
  hoje: Dia | null;
  visao: EvaView;
  usuarioId: string;
  cards: CardTI[];
  projetos: ProjetoTI[];
  sprints: SprintTI[];
  /** Pessoas da TI (avatar com gradiente); `nomes` cobre quem só aparece em card. */
  membros: Record<string, TeamMember>;
  nomes: Record<string, string>;
  /** Os números do topo do Início (mesma conta da tela). */
  stats: StatCardData[];
  reuniao: { id: string; titulo: string; realizada_em: string | null; observacoes: string | null } | null;
  pendentesDaReuniao: number | null;
}

export type Tom = 'perigo' | 'atencao' | 'ok' | 'neutro';

export interface PessoaVisual { id: string; nome: string; iniciais: string; gradiente: string }

export function pessoaVisual(id: string, ctx: Pick<ContextoVisual, 'membros' | 'nomes'>): PessoaVisual {
  const m = ctx.membros[id];
  if (m) return { id, nome: m.name, iniciais: m.initials, gradiente: m.gradient };
  const nome = ctx.nomes[id] ?? 'Alguém';
  return { id, nome, iniciais: iniciais(nome), gradiente: gradientePara(id) };
}

const cardsDaVisao = (ctx: ContextoVisual) => (ctx.visao === 'me' ? ctx.cards.filter((c) => ehDoUsuario(c, ctx.usuarioId)) : ctx.cards);

export function cardPorCodigo(ctx: Pick<ContextoVisual, 'cards'>, codigo: string): CardTI | undefined {
  const alvo = codigo.trim().toUpperCase();
  return ctx.cards.find((c) => c.codigo.toUpperCase() === alvo);
}

// ─── Card citado ────────────────────────────────────────────────────────────────

export interface CardVisual {
  id: string;
  codigo: string;
  titulo: string;
  coluna: ColunaKanban;
  colunaRotulo: string;
  colunaCor: string;
  prioridade: Prioridade;
  prioridadeRotulo: string;
  prioridadeCor: string;
  prazo: { texto: string; tom: Tom };
  responsaveis: PessoaVisual[];
}

export function prazoVisual(card: CardTI, hoje: Dia): { texto: string; tom: Tom } {
  if (estaConcluido(card)) return { texto: 'concluído', tom: 'ok' };
  const venc = diaVencimento(card);
  if (!venc) return { texto: 'sem prazo', tom: 'neutro' };
  const dias = diferencaDias(hoje, venc);
  if (dias < 0) return { texto: `atrasado há ${pluralDias(-dias)}`, tom: 'perigo' };
  if (dias === 0) return { texto: 'vence hoje', tom: 'atencao' };
  if (dias === 1) return { texto: 'vence amanhã', tom: 'atencao' };
  return { texto: `vence ${formatarDiaMes(venc)}`, tom: 'neutro' };
}

export function cardVisual(card: CardTI, hoje: Dia, ctx: Pick<ContextoVisual, 'membros' | 'nomes'>): CardVisual {
  return {
    id: card.id,
    codigo: card.codigo,
    titulo: card.title,
    coluna: card.kanban_status,
    colunaRotulo: KANBAN_STATUS_LABELS[card.kanban_status],
    colunaCor: KANBAN_STATUS_COLORS[card.kanban_status],
    prioridade: card.priority,
    prioridadeRotulo: PRIORITY_CONFIG[card.priority].label,
    prioridadeCor: PRIORITY_CONFIG[card.priority].color,
    prazo: prazoVisual(card, hoje),
    responsaveis: (card.assigned_to ?? []).map((id) => pessoaVisual(id, ctx)),
  };
}

/** Os cards citados que existem no board, na ordem da resposta. */
export function cardsCitados(codigos: readonly string[], ctx: ContextoVisual): CardVisual[] {
  if (!ctx.hoje) return [];
  const hoje = ctx.hoje;
  return codigos.map((c) => cardPorCodigo(ctx, c)).filter((c): c is CardTI => !!c).map((c) => cardVisual(c, hoje, ctx));
}

// ─── Bloco: números ─────────────────────────────────────────────────────────────

export interface NumeroVisual { chave: string; rotulo: string; valor: string; dica: string; tom: Tom }

const ORDEM_NUMEROS = ['open', 'overdue', 'today', 'done'] as const;

/** Os mesmos números do topo do Início (respeitam a visão Equipe/Minha). */
export function dadosNumeros(ctx: Pick<ContextoVisual, 'stats'>): NumeroVisual[] {
  return ORDEM_NUMEROS.map((chave) => ctx.stats.find((s) => s.key === chave))
    .filter((s): s is StatCardData => !!s)
    .map((s) => {
      const n = Number(s.value);
      const tom: Tom = s.key === 'overdue' && n > 0 ? 'perigo' : s.key === 'today' && n > 0 ? 'atencao' : s.key === 'done' ? 'ok' : 'neutro';
      return { chave: s.key, rotulo: s.label, valor: String(s.value), dica: s.hint, tom };
    });
}

// ─── Bloco: distribuição ────────────────────────────────────────────────────────

export interface CargaPessoa { pessoa: PessoaVisual | null; total: number; atrasados: number }
export interface DadosDistribuicaoPessoas { itens: CargaPessoa[]; maximo: number; outras: { pessoas: number; cards: number } }

export const MAX_PESSOAS_DISTRIBUICAO = 6;

/** Cards abertos por pessoa, da equipe toda (quem está mais carregado), com os atrasados. */
export function dadosDistribuicaoPessoas(ctx: ContextoVisual): DadosDistribuicaoPessoas {
  const hoje = ctx.hoje ?? '0000-00-00';
  const carga = new Map<string, { total: number; atrasados: number }>();
  for (const c of ctx.cards.filter(estaAberto)) {
    const donos = c.assigned_to?.length ? c.assigned_to : [''];
    for (const id of donos) {
      const atual = carga.get(id) ?? { total: 0, atrasados: 0 };
      atual.total += 1;
      if (estaAtrasado(c, hoje)) atual.atrasados += 1;
      carga.set(id, atual);
    }
  }
  const todos = [...carga.entries()]
    .map(([id, v]) => ({ pessoa: id ? pessoaVisual(id, ctx) : null, ...v }))
    .sort((a, b) => b.total - a.total || b.atrasados - a.atrasados || (a.pessoa?.nome ?? '~').localeCompare(b.pessoa?.nome ?? '~', 'pt-BR'));
  const itens = todos.slice(0, MAX_PESSOAS_DISTRIBUICAO);
  const resto = todos.slice(MAX_PESSOAS_DISTRIBUICAO);
  return {
    itens,
    maximo: Math.max(1, ...itens.map((i) => i.total)),
    outras: { pessoas: resto.length, cards: resto.reduce((n, i) => n + i.total, 0) },
  };
}

export interface FatiaColuna { coluna: ColunaKanban; rotulo: string; cor: string; total: number }

/** O Kanban por coluna (em Concluído, só a semana), como no resumo do Início. */
export function dadosDistribuicaoColunas(ctx: ContextoVisual): { fatias: FatiaColuna[]; total: number } {
  if (!ctx.hoje) return { fatias: [], total: 0 };
  const resumo = resumoKanban(cardsDaVisao(ctx), ctx.hoje, 0);
  const fatias = COLUNAS.map((coluna) => ({
    coluna, rotulo: KANBAN_STATUS_LABELS[coluna], cor: KANBAN_STATUS_COLORS[coluna], total: resumo.find((r) => r.coluna === coluna)?.total ?? 0,
  }));
  return { fatias, total: fatias.reduce((n, f) => n + f.total, 0) };
}

// ─── Bloco: projeto ─────────────────────────────────────────────────────────────

export interface DadosProjeto {
  nome: string;
  cor: string | null;
  sprint: string | null;
  feitos: number;
  total: number;
  pctFeito: number;
  /** Quanto da sprint já passou; null sem sprint ativa com datas. */
  pctTempo: number | null;
  situacao: { rotulo: string; tom: BadgeTone; barra: string };
  prazo: string | null;
  destaques: CardVisual[];
  abertos: number;
}

export function dadosProjeto(ctx: ContextoVisual, projetoId: string): DadosProjeto | null {
  const projeto = ctx.projetos.find((p) => p.id === projetoId);
  if (!projeto || !ctx.hoje) return null;
  const hoje = ctx.hoje;
  const r = resumirProjeto(projeto, ctx.cards, ctx.sprints, hoje);
  const decorrido = r.sprint ? tempoDecorrido(r.sprint, hoje) : null;
  const st = PROJECT_STATUS_CONFIG[r.situacao];
  const abertos = ctx.cards.filter((c) => c.project_id === projeto.id && estaAberto(c));
  const destaques = [...abertos]
    .sort((a, b) => diasDeAtraso(b, hoje) - diasDeAtraso(a, hoje) || compararDestaque(a, b))
    .slice(0, 3)
    .map((c) => cardVisual(c, hoje, ctx));
  return {
    nome: r.nome,
    cor: r.cor,
    sprint: r.sprint?.name ?? null,
    feitos: r.feitos,
    total: r.total,
    pctFeito: r.total ? Math.round((r.feitos / r.total) * 100) : 0,
    pctTempo: decorrido === null ? null : Math.round(decorrido * 100),
    situacao: { rotulo: st.label, tom: st.tone, barra: st.bar },
    prazo: r.prazo ? formatarDiaMes(r.prazo) : null,
    destaques,
    abertos: abertos.length,
  };
}

// ─── Bloco: agenda ──────────────────────────────────────────────────────────────

export interface DiaAgenda { dia: Dia; rotulo: string; cards: CardVisual[] }
export interface DadosAgenda {
  atrasados: { total: number; cards: CardVisual[] };
  dias: DiaAgenda[];
  /** Cards no período (sem os atrasados). */
  total: number;
  /** Cards do período que não couberam. */
  escondidos: number;
}

export const MAX_ATRASADOS_AGENDA = 3;
export const MAX_ITENS_AGENDA = 8;

const diaDaSemanaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

export function rotuloDoDia(dia: Dia, hoje: Dia): string {
  const d = diferencaDias(hoje, dia);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  const semana = diaDaSemanaCurto.format(new Date(`${dia}T12:00:00Z`)).replace('.', '');
  return `${semana} ${formatarDiaMes(dia)}`;
}

/** O que vence de hoje até hoje + `dias`, com as atrasadas antes (respeita a visão). */
export function dadosAgenda(ctx: ContextoVisual, dias: number): DadosAgenda {
  if (!ctx.hoje) return { atrasados: { total: 0, cards: [] }, dias: [], total: 0, escondidos: 0 };
  const hoje = ctx.hoje;
  const abertos = cardsDaVisao(ctx).filter(estaAberto);
  const atrasados = abertos.filter((c) => estaAtrasado(c, hoje))
    .sort((a, b) => diasDeAtraso(b, hoje) - diasDeAtraso(a, hoje) || compararDestaque(a, b));
  const fim = somarDias(hoje, dias);
  const noPeriodo = abertos
    .filter((c) => { const v = diaVencimento(c); return v !== null && v >= hoje && v <= fim; })
    .sort((a, b) => (diaVencimento(a)! < diaVencimento(b)! ? -1 : diaVencimento(a)! > diaVencimento(b)! ? 1 : compararDestaque(a, b)));
  const cabem = noPeriodo.slice(0, MAX_ITENS_AGENDA);
  const porDia = new Map<Dia, CardVisual[]>();
  for (const c of cabem) {
    const v = diaVencimento(c)!;
    porDia.set(v, [...(porDia.get(v) ?? []), cardVisual(c, hoje, ctx)]);
  }
  return {
    atrasados: { total: atrasados.length, cards: atrasados.slice(0, MAX_ATRASADOS_AGENDA).map((c) => cardVisual(c, hoje, ctx)) },
    dias: [...porDia.entries()].map(([dia, cards]) => ({ dia, rotulo: rotuloDoDia(dia, hoje), cards })),
    total: noPeriodo.length,
    escondidos: noPeriodo.length - cabem.length,
  };
}

/**
 * Códigos que os blocos de agenda e de projeto já mostram: esses saem dos cards citados, para o
 * mesmo card não aparecer duas vezes na resposta.
 */
export function codigosNosBlocos(blocos: readonly BlocoChat[], ctx: ContextoVisual): Set<string> {
  const codigos = new Set<string>();
  for (const b of blocos) {
    if (b.tipo === 'agenda') {
      const a = dadosAgenda(ctx, b.dias);
      [...a.atrasados.cards, ...a.dias.flatMap((d) => d.cards)].forEach((c) => codigos.add(c.codigo.toUpperCase()));
    }
    if (b.tipo === 'projeto') dadosProjeto(ctx, b.projetoId)?.destaques.forEach((c) => codigos.add(c.codigo.toUpperCase()));
  }
  return codigos;
}

// ─── Bloco: reunião ─────────────────────────────────────────────────────────────

export const MAX_DECISOES = 5;

/** As "principais decisões" da análise viram itens: por linha ou, num parágrafo só, por frase. */
export function decisoesDaReuniao(observacoes: string | null): string[] {
  if (!observacoes?.trim()) return [];
  const linhas = observacoes.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()).filter(Boolean);
  const itens = linhas.length > 1 ? linhas : observacoes.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map((f) => f.trim()).filter(Boolean);
  return itens.slice(0, MAX_DECISOES);
}

/** "13/10" do instante da reunião (dia em Brasília). */
export function dataDaReuniao(realizadaEm: string | null): string | null {
  if (!realizadaEm) return null;
  return formatarDiaMes(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(realizadaEm)));
}
