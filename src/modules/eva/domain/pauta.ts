// Pauta e acompanhamento da reunião da equipe (D48, issue 35). Puro: a api/ (NodeNext) importa, com ".js".
//
// O gestor marca em Configurações o dia e a hora da reunião (ex.: segunda, 10:00). Uma hora antes,
// o relógio (D44) manda a pauta no WhatsApp dos gestores que recebem o relatório de gestão; ela
// também sai na hora, pedida pelo WhatsApp ou pelo chat ("pauta da reunião").
// A pauta é montada pelo sistema, sem IA: o que a última reunião combinou e ainda não andou, os
// atrasados, os bloqueios do check-in (D46), a carga acima da capacidade (D47), as sugestões
// paradas e os projetos em risco, e os pontos para decidir, por regras fixas.
import { diaDaSemana, diaSP, diferencaDias, ehDiaUtil, formatarDiaMes, hojeSP, pluralDias, type Dia } from './datas.js';
import { diasDeAtraso, diaVencimento, estaAberto, estaConcluido, estaVisivel, ordenarAtrasados, type CardTI } from './demandas.js';
import { horaSP } from './checkin.js';
import type { EntradaGestao, PainelGestao, ProjetoGestao } from './gestao.js';
import { acimaDaCapacidade, resumoDosMovimentos, rotuloDaJanela, type Planejamento } from './planejamento.js';

/** A pauta sai a partir de 1 h antes da reunião, e para de sair na hora dela. */
export const ANTECEDENCIA_MIN = 60;
/** Itens por seção; o resto vira "… e mais N". */
export const MAX_POR_SECAO = 5;
/** Atrasado há mais que isto vira "repactuar o prazo" nos pontos para decidir. */
export const ATRASO_PARA_REPACTUAR = 7;
/** Bloqueio do check-in que ainda entra na pauta. */
export const DIAS_BLOQUEIO = 3;
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const COLUNA: Record<string, string> = { backlog: 'Backlog', todo: 'A Fazer', in_progress: 'Em Progresso', review: 'Revisão', done: 'Concluído' };
const SITUACAO: Record<string, string> = { late: 'atrasado', at_risk: 'em risco' };
const MAX_TITULO = 45;
const titulo = (t: string) => (t.length > MAX_TITULO ? `${t.slice(0, MAX_TITULO - 1).trimEnd()}…` : t);
const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;
const emMinutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

// ── Quando ───────────────────────────────────────────────────────────────────

/** A reunião da equipe, de Configurações: dia da semana (1 = segunda … 5 = sexta) e "HH:MM". */
export interface AgendaReuniao { dia: number | null; hora: string | null }

/** O relógio manda a pauta agora? No dia da reunião (útil), de 1 h antes até a hora dela. */
export function momentoDaPauta(agora: Date, agenda: AgendaReuniao): { hoje: Dia; enviar: boolean } {
  const hoje = hojeSP(agora);
  if (agenda.dia === null || !agenda.hora || !HORA.test(agenda.hora)) return { hoje, enviar: false };
  const atual = emMinutos(horaSP(agora));
  const reuniao = emMinutos(agenda.hora);
  return { hoje, enviar: ehDiaUtil(hoje) && diaDaSemana(hoje) === agenda.dia && atual >= reuniao - ANTECEDENCIA_MIN && atual < reuniao };
}

// ── O que a última reunião combinou ──────────────────────────────────────────

export interface ItemReuniao {
  /** Card novo: o título proposto; mudança num card: o código e o título. */
  descricao: string;
  /** Os responsáveis propostos (o card, quando existe, manda). */
  responsaveis: string[];
  /** O prazo combinado, quando houve ("AAAA-MM-DD"). */
  prazo: Dia | null;
  sugestao: 'pendente' | 'aprovada' | 'rejeitada';
  /** O card que nasceu da sugestão, ou o card que ela mudou. */
  card: CardTI | null;
}

export interface ReuniaoParaPauta { titulo: string; realizadaEm: string | null; itens: ItemReuniao[] }

/** feito, na fila de sugestões, em aberto, atrasado; recusado e fora do Kanban não entram na pauta. */
export type SituacaoItem = 'feito' | 'na_fila' | 'aberto' | 'atrasado' | 'fora';

export function situacaoDoItem(i: ItemReuniao, hoje: Dia): SituacaoItem {
  if (i.sugestao === 'rejeitada') return 'fora';
  if (i.sugestao === 'pendente') return 'na_fila';
  if (!i.card || !estaVisivel(i.card)) return 'fora';
  if (estaConcluido(i.card)) return 'feito';
  const prazo = diaVencimento(i.card) ?? i.prazo;
  return prazo !== null && prazo < hoje ? 'atrasado' : 'aberto';
}

export interface ResumoDaReuniao {
  feitos: number;
  /** Tudo o que conta: feitos, na fila, em aberto e atrasados. */
  total: number;
  /** Os que não andaram, atrasados primeiro, depois na fila, depois em aberto. */
  pendentes: { item: ItemReuniao; situacao: Exclude<SituacaoItem, 'feito' | 'fora'> }[];
}

const ORDEM_SITUACAO = { atrasado: 0, na_fila: 1, aberto: 2 } as const;

export function resumirReuniao(r: ReuniaoParaPauta, hoje: Dia): ResumoDaReuniao {
  const comSituacao = r.itens.map((item) => ({ item, situacao: situacaoDoItem(item, hoje) })).filter((x) => x.situacao !== 'fora');
  const pendentes = comSituacao
    .filter((x): x is ResumoDaReuniao['pendentes'][number] => x.situacao !== 'feito')
    .sort((a, b) => ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]);
  return { feitos: comSituacao.length - pendentes.length, total: comSituacao.length, pendentes };
}

// ── Bloqueios do check-in ────────────────────────────────────────────────────

/** Um bloqueio contado no check-in (D46): quem é o user id do membro que respondeu. */
export interface BloqueioRecente { codigo: string; motivo: string; quem: string; dia: Dia }

/** Os bloqueios dos últimos dias de cards que continuam abertos, o mais recente de cada card. */
export function bloqueiosEmAberto(bloqueios: BloqueioRecente[], cards: CardTI[]): (BloqueioRecente & { card: CardTI })[] {
  const abertos = new Map(cards.filter(estaAberto).map((c) => [c.codigo.toUpperCase(), c]));
  const porCard = new Map<string, BloqueioRecente & { card: CardTI }>();
  for (const b of [...bloqueios].sort((a, x) => x.dia.localeCompare(a.dia))) {
    const card = abertos.get(b.codigo.toUpperCase());
    if (card && !porCard.has(card.codigo)) porCard.set(card.codigo, { ...b, card });
  }
  return Array.from(porCard.values());
}

// ── O texto ──────────────────────────────────────────────────────────────────

export interface EntradaPauta {
  entrada: EntradaGestao;
  painel: PainelGestao;
  plano: Planejamento;
  reuniao: ReuniaoParaPauta | null;
  bloqueios: BloqueioRecente[];
  /** A reunião marcada (o envio de 1 h antes); null = pedida na hora. */
  marcada: { dia: Dia; hora: string } | null;
  linkInicio: string;
  formato: 'whatsapp' | 'chat';
}

const sobreProjeto = (r: ProjetoGestao) =>
  `${r.nome}${r.sprint ? ` · ${r.sprint.name}` : ''}: ${r.feitos} de ${r.total} feitos${r.decorrido !== null ? `, ${Math.round(r.decorrido * 100)}% do tempo` : ''}`;

export function montarPautaReuniao(e: EntradaPauta): string {
  const { painel: p, plano } = e;
  const { hoje } = p;
  const chat = e.formato === 'chat';
  const item = chat ? '- ' : '• ';
  const nome = (id: string) => p.nomes[id] ?? plano.nomes[id] ?? e.entrada.pessoas[id] ?? '';
  const quem = (ids: string[]) => ids.map(nome).filter(Boolean).join(', ') || 'sem responsável';
  const secao = (tituloWhats: string, tituloChat: string, linhas: string[]) => (linhas.length
    ? ['', chat ? `**${tituloChat}**` : tituloWhats, ...linhas.slice(0, MAX_POR_SECAO).map((l) => `${item}${l}`),
      ...(linhas.length > MAX_POR_SECAO ? [`… e mais ${linhas.length - MAX_POR_SECAO}`] : [])]
    : []);

  // Da última reunião: o que não andou.
  const resumo = e.reuniao ? resumirReuniao(e.reuniao, hoje) : null;
  const linhaDoItem = ({ item: i, situacao }: ResumoDaReuniao['pendentes'][number]) => {
    const resp = quem(i.card ? i.card.assigned_to : i.responsaveis);
    const prazo = (i.card ? diaVencimento(i.card) : null) ?? i.prazo;
    const ate = prazo ? ` · até ${formatarDiaMes(prazo)}` : '';
    if (situacao === 'na_fila') return `${i.descricao} · ${resp}: a sugestão ainda espera aprovação`;
    if (situacao === 'atrasado') return `${i.descricao} · ${resp}${ate} · atrasado há ${pluralDias(Math.max(1, diferencaDias(prazo!, hoje)))}`;
    return `${i.descricao} · ${resp}${ate} · ${COLUNA[i.card!.kanban_status] ?? i.card!.kanban_status}`;
  };
  const quandoFoi = e.reuniao?.realizadaEm ? `, ${formatarDiaMes(diaSP(e.reuniao.realizadaEm))}` : '';
  const daReuniao = e.reuniao && resumo && resumo.total > 0
    ? secao(
      `📝 Da última reunião ("${titulo(e.reuniao.titulo)}"${quandoFoi}): ${resumo.feitos} de ${resumo.total} feitos`,
      `Da última reunião (${titulo(e.reuniao.titulo)}${quandoFoi}): ${resumo.feitos} de ${resumo.total} feitos`,
      resumo.pendentes.length ? resumo.pendentes.map(linhaDoItem) : ['Tudo o que foi combinado já está feito 👏'],
    )
    : [];

  const atrasados = ordenarAtrasados(e.entrada.cards.filter(estaVisivel), hoje);
  const bloqueios = bloqueiosEmAberto(e.bloqueios, e.entrada.cards);
  const acima = acimaDaCapacidade(plano);
  const projetos = p.projetos.filter((r) => r.situacao === 'late' || r.situacao === 'at_risk');
  const sugestoesDaReuniao = resumo?.pendentes.filter((x) => x.situacao === 'na_fila').length ?? 0;

  const decidir = [
    ...atrasados.filter((c) => diasDeAtraso(c, hoje) > ATRASO_PARA_REPACTUAR).slice(0, 2)
      .map((c) => `Repactuar o prazo do ${c.codigo} (atrasado há ${pluralDias(diasDeAtraso(c, hoje))})`),
    ...bloqueios.slice(0, 2).map((b) => `Destravar o ${b.card.codigo}: ${b.motivo}`),
    ...(sugestoesDaReuniao ? [`Decidir ${sugestoesDaReuniao === 1 ? 'a sugestão' : `as ${sugestoesDaReuniao} sugestões`} da última reunião que ainda ${sugestoesDaReuniao === 1 ? 'espera' : 'esperam'} aprovação`] : []),
    ...(plano.movimentos.length
      ? [`Equilibrar a carga: ${resumoDosMovimentos(plano)} (para aplicar, me peça o planejamento)`]
      : acima.length ? [`Rever prazos ou escopo de ${acima.slice(0, 2).map((x) => nome(x.id)).join(' e ')}: acima da capacidade`] : []),
    ...projetos.slice(0, 2).map((r) => `Rever o escopo de ${r.nome} (${SITUACAO[r.situacao]})`),
  ];

  const cabeca = e.marcada
    ? `Pauta da reunião · ${NOME_DIA[diaDaSemana(e.marcada.dia)]}, ${formatarDiaMes(e.marcada.dia)} às ${e.marcada.hora}`
    : `Pauta da reunião · ${formatarDiaMes(hoje)}`;
  return [
    chat ? `**${cabeca}**` : `🗓️ ${cabeca}`,
    ...daReuniao,
    ...secao(`⚠️ Atrasados (${atrasados.length})`, `Atrasados (${atrasados.length})`,
      atrasados.map((c) => `${c.codigo} ${titulo(c.title)} · ${quem(c.assigned_to)} · há ${pluralDias(diasDeAtraso(c, hoje))}`)),
    ...secao('⛔ Bloqueios do check-in', 'Bloqueios do check-in',
      bloqueios.map((b) => `${b.card.codigo} ${titulo(b.card.title)}: ${b.motivo} (${nome(b.quem) || 'alguém'}, ${formatarDiaMes(b.dia)})`)),
    ...secao(`⚖️ Acima da capacidade ${rotuloDaJanela(plano.janela)}`, `Acima da capacidade ${rotuloDaJanela(plano.janela)}`,
      acima.map((x) => `${nome(x.id)}: tem ${x.comprometidos.length}, cabem ~${x.capacidade}`)),
    ...secao('📥 Pendências', 'Pendências', [
      ...(p.pendencias.sugestoes > 0
        ? [`${n(p.pendencias.sugestoes, 'sugestão aguarda', 'sugestões aguardam')} aprovação${p.pendencias.sugestaoHaDias ? `, a mais antiga há ${pluralDias(p.pendencias.sugestaoHaDias)}` : ''}`]
        : []),
      ...(p.pendencias.cobrancasSemResposta > 0 ? [`${n(p.pendencias.cobrancasSemResposta, 'cobrança', 'cobranças')} sem resposta há mais de 4 h`] : []),
      ...projetos.map((r) => `${sobreProjeto(r)} · ${SITUACAO[r.situacao]}`),
    ]),
    '',
    chat ? '**Para decidir**' : '💬 Para decidir',
    ...(decidir.length ? decidir : ['Sem pendência grave: bom momento para planejar a próxima sprint ("o que cabe na próxima sprint?").']).map((l) => `${item}${l}`),
    ...(chat ? [] : ['', `Detalhes no Início: ${e.linkInicio}`]),
  ].join('\n');
}
