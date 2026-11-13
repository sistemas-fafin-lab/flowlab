// api/_lib/labBrainSugestao.ts
// Sugestão de promoção de um chamado do LAB-BRAIN na fila da EVA (promover_card).
// Spec: .scratch/lab-brain-aprovacao-eva/spec.md (Rota de criação).
//
// A rota de criação agenda esta função em segundo plano (waitUntil) depois de gravar um
// chamado novo; a resposta 201 já saiu. A sugestão nasce pendente, ligada ao chamado por
// card_id, e quem aprova sugestões da EVA é avisado no sino. Aprovar tira o chamado de
// "fora do Kanban" (ti_agente_aprovar_sugestao_como, 20261113150000_eva_promover_card_lab_brain.sql).
//
// Hoje a proposta vem só da regra fixa: coluna "A Fazer", a prioridade enviada, sem
// responsável e sem prazo, com a marca de "sem análise da EVA". A análise com IA entra
// depois, com esta regra como reserva (issue 04).

import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from './errors.js';
import { avisarQuemTem } from './ti-agente/dados.js';
import { CHAVE_APROVAR } from '../../src/modules/eva/domain/papeis.js';

/** Valor de ti_agente_sugestoes.origem para as sugestões dos chamados do LAB-BRAIN. */
export const ORIGEM_SUGESTAO_LAB_BRAIN = 'lab-brain';
export const TIPO_PROMOVER_CARD = 'promover_card';

const LOG = '[integracoes/lab-brain-chamado-criar/sugestao]';
const JUSTIFICATIVA_SEM_ANALISE =
  'Sem análise da EVA: proposta pela regra fixa (coluna A Fazer e a prioridade enviada pelo LAB-BRAIN).';

export interface ChamadoParaSugestao {
  id: string;
  codigo: string;
  titulo: string;
  prioridade: string;
}

/** O que a EVA propõe para o chamado. Mesmo formato lido pela tela de Sugestões. */
export interface PropostaPromocao {
  kanban_status: string;
  prioridade: string;
  responsaveis: string[];
  /** YYYY-MM-DD, como nas outras propostas; null = sem prazo. */
  prazo: string | null;
  justificativa: string;
  /** true quando a proposta veio da regra fixa, sem análise da EVA. */
  sem_analise?: true;
}

export function propostaDaRegraFixa(prioridade: string): PropostaPromocao {
  return {
    kanban_status: 'todo',
    prioridade,
    responsaveis: [],
    prazo: null,
    justificativa: JUSTIFICATIVA_SEM_ANALISE,
    sem_analise: true,
  };
}

/**
 * Grava a sugestão e avisa quem aprova. Nunca lança: roda depois da resposta, e uma
 * falha só vai para o log. O chamado continua visível em Solicitações de TI.
 */
export async function criarSugestaoDePromocao(db: SupabaseClient, chamado: ChamadoParaSugestao): Promise<void> {
  const proposta = propostaDaRegraFixa(chamado.prioridade);
  try {
    const { error } = await db.from('ti_agente_sugestoes').insert({
      origem: ORIGEM_SUGESTAO_LAB_BRAIN,
      tipo: TIPO_PROMOVER_CARD,
      card_id: chamado.id,
      proposta,
      trecho: proposta.justificativa,
      // Sem análise não há confiança: fica fora do "aprovar as de confiança alta".
      confianca: 'baixa',
    });
    if (error) throw new Error(describeError(error));
  } catch (e) {
    console.error(`${LOG} falha ao gravar a sugestão do chamado ${chamado.codigo}:`, describeError(e));
    return;
  }

  try {
    await avisarQuemTem(db, CHAVE_APROVAR, {
      titulo: 'Chamado do LAB-BRAIN para aprovar',
      conteudo: `${chamado.codigo} · ${chamado.titulo} aguarda a decisão de entrar no Kanban.`,
      link: '/it/eva',
    });
  } catch (e) {
    console.error(`${LOG} sugestão do chamado ${chamado.codigo} gravada, mas o aviso do sino falhou:`, describeError(e));
  }
}
