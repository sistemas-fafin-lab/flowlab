// Planejamento e redistribuição no servidor (D47, issue 35). As regras e os textos ficam em
// src/modules/eva/domain/planejamento.ts; aqui só entram a leitura e as sugestões.
// A redistribuição vira sugestão de "atualizar card" (o responsável), com um comentário no card:
// o gestor confirma (SIM no WhatsApp, o cartão no chat) e ela entra pela aprovação de sempre (D37).
import type { SupabaseClient } from '@supabase/supabase-js';
import { hojeSP, somarDias, type Dia } from '../../../src/modules/eva/domain/datas.js';
import type { EntradaGestao, Periodo } from '../../../src/modules/eva/domain/gestao.js';
import { SEMANAS_RITMO, comentarioDoMovimento, montarPlanejamento, type Planejamento } from '../../../src/modules/eva/domain/planejamento.js';
import type { PropostaChat } from './chat.js';
import type { SugestaoValidada } from './extracao.js';
import { lerEntradaGestao } from './gestao.js';

export const TRECHO_REDISTRIBUICAO = 'Redistribuição proposta pela EVA no planejamento.';

/** As 4 semanas do ritmo, hoje incluso: o painel lê os concluídos desde o período anterior a elas. */
export const periodoDoRitmo = (hoje: Dia): Periodo => ({ de: somarDias(hoje, -(SEMANAS_RITMO * 7 - 1)), ate: hoje });

export const planejamentoDaEntrada = (e: EntradaGestao): Planejamento =>
  montarPlanejamento({ hoje: e.hoje, cards: e.cards, sprints: e.sprints, equipe: e.equipe, pessoas: e.pessoas, ausencias: e.ausencias });

export async function lerPlanejamento(db: SupabaseClient, agora = new Date()): Promise<Planejamento> {
  return planejamentoDaEntrada(await lerEntradaGestao(db, agora, periodoDoRitmo(hojeSP(agora))));
}

/** Cada card passado adiante: troca a pessoa sobrecarregada por quem tem folga, e comenta o porquê. */
export function sugestoesDaRedistribuicao(p: Planejamento): SugestaoValidada[] {
  return p.movimentos.map((m) => ({
    tipo: 'atualizar_card',
    card_id: m.card.id,
    trecho: TRECHO_REDISTRIBUICAO,
    confianca: 'media',
    avisos: [],
    proposta: { responsaveis: [...m.card.assigned_to.filter((id) => id !== m.de), m.para], comentario: comentarioDoMovimento(p, m) },
  }));
}

/** No chat, as mesmas sugestões viram cartões para o gestor confirmar, com o card de agora (antes → depois). */
export function propostasDaRedistribuicao(p: Planejamento): PropostaChat[] {
  return sugestoesDaRedistribuicao(p).map((s, i) => {
    const c = p.movimentos[i].card;
    return { ...s, card: { id: c.id, codigo: c.codigo, title: c.title, kanban_status: c.kanban_status, priority: c.priority, due_date: c.due_date, assigned_to: c.assigned_to } };
  });
}
