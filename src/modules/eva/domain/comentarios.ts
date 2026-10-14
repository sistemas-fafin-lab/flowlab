// Comentários da EVA nos blocos do Início (issue 17, D21): regras fixas, sem IA,
// calculadas na leitura. Uma função por bloco; cada uma devolve um comentário ou nada.
// Ação que mexe em card é sempre PROPOSTA (D6, D28): o texto nunca diz que já fez.
import { KANBAN_STATUS_LABELS } from '../constants';
import type { AcaoInsight, EvaInsightData, EvaView, ProjectSummary } from '../types';
import { diaSP, diferencaDias, formatarDiaMes, pluralDias, type Dia } from './datas';
import {
  compararDestaque, diasDeAtraso, ehDoUsuario, estaAberto, estaParado, ordenarAtrasados, tasksDoDia,
  type CardTI, type ColunaKanban,
} from './demandas';
import { montarIntegracoes, type ConfigIntegracoes } from './integracoes';
import { primeiroNome } from './pessoas';
import { JANELA_COBRANCA_MS } from './cobranca';
import { quandoFoi, ultimoContato, type MensagemFila } from './whatsapp';

export interface UltimaReuniaoInicio {
  id: string;
  titulo: string;
  realizada_em: string | null;
  analisada_em: string | null;
  observacoes: string | null;
}

export interface EntradaComentarios {
  visao: EvaView;
  usuarioId: string;
  hoje: Dia;
  cards: CardTI[];
  /** Nome de cada pessoa que aparece nos cards. */
  nomes: Record<string, string>;
  projetos: ProjectSummary[];
  ehGestor: boolean;
  config: (ConfigIntegracoes & { whatsapp_ativo: boolean }) | null;
  ultimaReuniao: UltimaReuniaoInicio | null;
  /** Sugestões da última reunião ainda pendentes; null quando não deu para contar. */
  pendentesDaReuniao: number | null;
  /** Fila do WhatsApp dos últimos dias: só gestores leem (D24); null para os demais. */
  fila?: MensagemFila[] | null;
  agora?: number;
}

export interface ComentariosInicio {
  kanban?: EvaInsightData;
  overdue?: EvaInsightData;
  whatsapp?: EvaInsightData;
  projects?: EvaInsightData;
  myTasks?: EvaInsightData;
}

/** Colunas em que a concentração numa pessoa trava o fluxo (Backlog e Concluído não contam). */
const COLUNAS_CARGA: ColunaKanban[] = ['review', 'in_progress', 'todo'];
/** A partir de quantos cards de uma pessoa numa coluna a EVA comenta. */
export const LIMITE_CONCENTRACAO = 4;
/** O colega precisa ter pelo menos esta folga de cards em aberto para receber os cards. */
export const FOLGA_MINIMA = 3;
/** Quantos cards a proposta de redistribuir passa adiante. */
const CARDS_REDISTRIBUIDOS = 2;
/** Atraso que pede revisão de prazo ou escopo. */
export const DIAS_ATRASO_LONGO = 7;
/** Task do dia sem mudança há este tempo merece um empurrão. */
export const DIAS_TASK_PARADA = 3;
/** Até quando a última reunião ainda é notícia no bloco de Projetos. */
export const DIAS_REUNIAO_RECENTE = 14;

const AGORA = 'Board · agora';
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
const pluralCards = (n: number) => `${n} ${plural(n, 'card', 'cards')}`;
const listar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const resumoCard = (c: CardTI) => ({
  id: c.id, codigo: c.codigo, title: c.title, kanban_status: c.kanban_status, priority: c.priority, due_date: c.due_date, assigned_to: c.assigned_to,
});

function abrirCard(c: CardTI): AcaoInsight {
  return { tipo: 'abrir_card', cardId: c.id };
}

// ── Kanban: uma coluna concentrada numa pessoa, com colega folgado ─────────────

export function comentarioKanban(e: EntradaComentarios): EvaInsightData | undefined {
  if (e.visao !== 'team') return undefined;
  const abertos = e.cards.filter(estaAberto);
  const carga = new Map<string, number>();
  for (const c of abertos) for (const u of c.assigned_to) carga.set(u, (carga.get(u) ?? 0) + 1);

  for (const coluna of COLUNAS_CARGA) {
    const daColuna = abertos.filter((c) => c.kanban_status === coluna);
    const porPessoa = new Map<string, CardTI[]>();
    for (const c of daColuna) for (const u of c.assigned_to) porPessoa.set(u, [...(porPessoa.get(u) ?? []), c]);
    const [dono, seus] = [...porPessoa.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    if (!dono || seus.length < LIMITE_CONCENTRACAO) continue;

    const cargaDono = carga.get(dono) ?? 0;
    // Menos cards em aberto; no empate, quem tem menos nesta coluna.
    const naColuna = (u: string) => porPessoa.get(u)?.length ?? 0;
    const [colega, cargaColega] = [...carga.entries()]
      .filter(([u]) => u !== dono && e.nomes[u])
      .sort((a, b) => a[1] - b[1] || naColuna(a[0]) - naColuna(b[0]))[0] ?? [];
    if (!colega || cargaColega > cargaDono - FOLGA_MINIMA) continue;

    // Passa adiante os de menor destaque (menor prioridade, prazo mais longe), nunca os do colega.
    const mover = [...seus].filter((c) => !c.assigned_to.includes(colega)).sort(compararDestaque).reverse().slice(0, CARDS_REDISTRIBUIDOS);
    if (mover.length === 0) continue;

    const nomeDono = primeiroNome(e.nomes[dono] ?? 'alguém');
    const nomeColega = primeiroNome(e.nomes[colega]);
    const rotulo = KANBAN_STATUS_LABELS[coluna];
    const codigos = listar(mover.map((c) => c.codigo));
    const texto = `A coluna ${rotulo} tem ${daColuna.length} cards, ${seus.length} com ${nomeDono}. ${nomeColega} tem menos carga (${pluralCards(cargaColega)} em aberto).`;
    return {
      id: `kanban:${coluna}:${dono}:${colega}:${mover.map((c) => c.id).join(',')}`,
      source: AGORA,
      text: texto,
      ctaLabel: 'Redistribuir',
      doneText: '',
      askPrompt: `Como está a carga da equipe na coluna ${rotulo}?`,
      acao: {
        tipo: 'propor',
        titulo: `Passar ${codigos} de ${nomeDono} para ${nomeColega}?`,
        propostas: mover.map((c) => ({
          tipo: 'atualizar_card' as const,
          card_id: c.id,
          card: resumoCard(c),
          proposta: { responsaveis: Array.from(new Set(c.assigned_to.map((u) => (u === dono ? colega : u)))) },
          trecho: texto,
        })),
        feitoGestor: `Pronto: ${codigos} ${plural(mover.length, 'passou', 'passaram')} para ${nomeColega}.`,
        feitoFila: 'Proposta enviada para aprovação de um gestor.',
      },
    };
  }
  return undefined;
}

// ── Atrasadas: crítica sem dono, ou atraso longo ────────────────────────────

export function comentarioAtrasadas(e: EntradaComentarios): EvaInsightData | undefined {
  const daVisao = e.visao === 'me' ? e.cards.filter((c) => ehDoUsuario(c, e.usuarioId)) : e.cards;
  const atrasados = ordenarAtrasados(daVisao, e.hoje);

  const semDono = atrasados.find((c) => c.assigned_to.length === 0 && (c.priority === 'critical' || c.priority === 'high'));
  if (semDono) {
    return {
      id: `overdue:sem-dono:${semDono.id}`,
      source: AGORA,
      text: `${semDono.codigo} (${semDono.title}) está atrasado há ${pluralDias(diasDeAtraso(semDono, e.hoje))} e sem responsável.`,
      ctaLabel: 'Abrir card',
      doneText: 'Abri o card.',
      askPrompt: `Quem pode assumir o ${semDono.codigo}?`,
      acao: abrirCard(semDono),
    };
  }

  // Cobrança sem resposta (D24: só gestor, que lê a fila). Passadas as 4 h da janela, a
  // ação "Cobrar de novo" sempre pode sair (RN16).
  if (e.ehGestor && e.fila) {
    const agora = e.agora ?? Date.now();
    for (const c of atrasados) {
      const contato = ultimoContato(c.id, c.assigned_to, e.fila, agora, e.hoje, JANELA_COBRANCA_MS);
      if (!contato.semResposta || agora - new Date(contato.semResposta.desde).getTime() < JANELA_COBRANCA_MS) continue;
      const nome = primeiroNome(contato.semResposta.nome ?? '') || 'O responsável';
      return {
        id: `overdue:sem-resposta:${c.id}:${contato.semResposta.desde}`,
        source: `Wa-ha · cobrança ${quandoFoi(contato.semResposta.desde, e.hoje)}`,
        text: `${nome} não respondeu à cobrança ${quandoFoi(contato.semResposta.desde, e.hoje)} sobre o ${c.codigo} (${c.title}).`,
        ctaLabel: 'Cobrar de novo',
        doneText: 'Cobrança de novo na fila do WhatsApp.',
        askPrompt: `O que se sabe do ${c.codigo}?`,
        acao: { tipo: 'cobrar', cardId: c.id },
      };
    }
  }

  const longo = atrasados.find((c) => diasDeAtraso(c, e.hoje) >= DIAS_ATRASO_LONGO);
  if (longo) {
    const dono = longo.assigned_to[0] ? e.nomes[longo.assigned_to[0]] : null;
    return {
      id: `overdue:longo:${longo.id}`,
      source: AGORA,
      text: `${longo.codigo} (${longo.title}) está atrasado há ${pluralDias(diasDeAtraso(longo, e.hoje))}${dono ? `, com ${primeiroNome(dono)}` : ''}. Vale revisar o prazo ou o escopo.`,
      ctaLabel: 'Abrir card',
      doneText: 'Abri o card.',
      askPrompt: `O que está travando o ${longo.codigo}?`,
      acao: abrirCard(longo),
    };
  }
  return undefined;
}

// ── WhatsApp (só gestor, D24): sessão do Wa-ha sem sinal ──────────────────────

export function comentarioWhatsapp(e: EntradaComentarios): EvaInsightData | undefined {
  if (!e.ehGestor || !e.config?.whatsapp_ativo) return undefined;
  const chip = montarIntegracoes(e.config, null, false, e.agora).find((c) => c.id === 'waha');
  if (chip && chip.state === 'offline') {
    return {
      id: `whatsapp:${chip.detail}`,
      source: 'Wa-ha · agora',
      text: `O Wa-ha está ${chip.detail}. As mensagens esperam na fila até a sessão voltar.`,
      ctaLabel: 'Ver configurações',
      doneText: 'Abri as configurações.',
      askPrompt: 'O que fazer quando a sessão do Wa-ha cai?',
      acao: { tipo: 'navegar', para: '/it/eva/configuracoes' },
    };
  }

  // Mensagem que falhou hoje (a mais recente).
  const falha = (e.fila ?? []).find((m) => m.direcao === 'saida' && m.status === 'falhou' && diaSP(m.created_at) === e.hoje);
  if (falha) {
    // Mensagem do grupo da equipe (D29): o grupo se confere em Configurações, não em Membros.
    const grupo = !!falha.chat_id_destino;
    const nome = grupo ? 'o grupo da equipe' : primeiroNome(falha.membro_nome ?? '') || 'um membro';
    return {
      id: `whatsapp:falha:${falha.id}`,
      source: `Wa-ha · ${quandoFoi(falha.created_at, e.hoje)}`,
      text: `Uma mensagem para ${nome} falhou ${quandoFoi(falha.created_at, e.hoje)}${falha.erro ? `: ${falha.erro}` : '.'}`,
      ctaLabel: grupo ? 'Ver configurações' : 'Ver no histórico',
      doneText: grupo ? 'Abri as configurações.' : 'Abri a aba Membros.',
      askPrompt: 'Por que uma mensagem do WhatsApp falha?',
      acao: { tipo: 'navegar', para: grupo ? '/it/eva/configuracoes' : '/it/eva/membros' },
    };
  }
  return undefined;
}

// ── Projetos: a última reunião (sugestões pendentes ou decisões) ou um projeto em risco ──

export function comentarioProjetos(e: EntradaComentarios): EvaInsightData | undefined {
  const r = e.ultimaReuniao;
  const recente = r?.analisada_em && diferencaDias(diaSP(r.analisada_em), e.hoje) <= DIAS_REUNIAO_RECENTE;
  if (r && recente) {
    const dia = formatarDiaMes(diaSP(r.realizada_em ?? r.analisada_em!));
    const source = `Granola · ${r.titulo} ${dia}`;
    const n = e.pendentesDaReuniao ?? 0;
    if (n > 0) {
      return {
        id: `projects:reuniao:${r.id}:pendentes:${n}`,
        source,
        text: `A reunião de ${dia} gerou ${plural(n, 'uma sugestão que ainda aguarda', `${n} sugestões que ainda aguardam`)} aprovação.`,
        ctaLabel: 'Ver sugestões',
        doneText: 'Abri as sugestões.',
        askPrompt: 'O que a última reunião decidiu sobre os projetos?',
        acao: { tipo: 'navegar', para: '/it/eva' },
      };
    }
    if (r.observacoes) {
      return {
        id: `projects:reuniao:${r.id}`,
        source,
        text: r.observacoes,
        ctaLabel: 'Ver resumo da reunião',
        doneText: 'Abri a conversa.',
        askPrompt: 'Quais cards a última reunião deixou para esta semana?',
        acao: { tipo: 'chat', pergunta: 'Resuma a última reunião e o que ela muda nos projetos.' },
      };
    }
  }

  const risco = e.projetos.find((p) => p.status === 'late') ?? e.projetos.find((p) => p.status === 'at_risk');
  if (risco) {
    return {
      id: `projects:risco:${risco.id}:${risco.status}`,
      source: AGORA,
      text: `O projeto ${risco.name} está ${risco.status === 'late' ? 'atrasado' : 'em risco'}: ${risco.done} de ${risco.total} cards feitos${risco.due !== '—' ? `, prazo ${risco.due}` : ''}.`,
      ctaLabel: 'Abrir projeto',
      doneText: 'Abri o projeto.',
      askPrompt: `O que está atrasando o projeto ${risco.name}?`,
      acao: { tipo: 'navegar', para: `/it/projects/${risco.id}` },
    };
  }
  return undefined;
}

// ── Minhas tasks: card de hoje (ou atrasado) parado ───────────────────────────

export function comentarioMinhasTasks(e: EntradaComentarios): EvaInsightData | undefined {
  const parados = tasksDoDia(e.cards, e.usuarioId, e.hoje)
    .filter((c) => estaParado(c, e.hoje, DIAS_TASK_PARADA))
    .sort((a, b) => (a.kanban_status === 'review' ? -1 : 0) - (b.kanban_status === 'review' ? -1 : 0));
  const c = parados[0];
  if (!c) return undefined;
  const dias = diferencaDias(diaSP(c.updated_at), e.hoje);
  const quando = diasDeAtraso(c, e.hoje) > 0 ? 'está atrasado' : 'vence hoje';
  return {
    id: `myTasks:parado:${c.id}`,
    source: AGORA,
    text: `${c.codigo} (${c.title}) ${quando} e está em ${KANBAN_STATUS_LABELS[c.kanban_status]} sem mudança há ${pluralDias(dias)}.`,
    ctaLabel: 'Abrir card',
    doneText: 'Abri o card.',
    askPrompt: `O que falta para fechar o ${c.codigo}?`,
    acao: abrirCard(c),
  };
}

export function montarComentarios(e: EntradaComentarios): ComentariosInicio {
  return {
    kanban: comentarioKanban(e),
    overdue: comentarioAtrasadas(e),
    whatsapp: comentarioWhatsapp(e),
    projects: comentarioProjetos(e),
    myTasks: comentarioMinhasTasks(e),
  };
}
