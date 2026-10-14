// Respostas pelo WhatsApp (issue 15, plano §11.3, D12, RF22): o membro conta o andamento dos
// cards DELE. Daí saem um comentário no card (autor: o membro, "via WhatsApp") e, se houver
// pedido de mudança, uma sugestão na fila. Nada muda no Kanban sem aprovação (D6, D28). Por
// fim, a EVA enfileira a confirmação do que entendeu. Quem decide que a mensagem é deste tipo
// é o roteador de comandos (comandos.ts, D29).
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { diaDoPrazo, formatarDiaMes, type Dia } from '../../../src/modules/eva/domain/datas.js';
import { estaConcluido, type CardTI } from '../../../src/modules/eva/domain/demandas.js';
import { primeiroNome } from '../../../src/modules/eva/domain/pessoas.js';
import { avisarGestores } from './dados.js';

export const ItemRespostaIA = z.object({
  card_codigo: z.string().nullable(),
  intencao: z.enum(['concluir', 'adiar', 'bloquear', 'atualizar']),
  nova_data: z.string().nullable(),
  prazo_texto: z.string().nullable(),
});

export const SchemaResposta = z.object({
  itens: z.array(ItemRespostaIA),
  confianca: z.enum(['alta', 'media', 'baixa']),
});
export type SaidaResposta = z.infer<typeof SchemaResposta>;

/** Mensagens por membro por dia: segura custo e laço com robô de resposta automática. */
export const LIMITE_DIARIO_RESPOSTAS = 20;
/** Gestor manda mais: cada pedido tem o SIM, e a lista de sugestões, os números. */
export const LIMITE_DIARIO_GESTOR = 40;
export const MAX_ITENS = 5;
export const MAX_TEXTO = 2000;

/** Uma linha por card para o contexto da IA. */
export const linhaDoCard = (c: CardTI) =>
  `- ${c.codigo} | ${c.title} | coluna: ${c.kanban_status} | prazo: ${c.due_date ? diaDoPrazo(c.due_date) : 'sem prazo'}`;

export interface ItemResposta {
  card: CardTI;
  intencao: SaidaResposta['itens'][number]['intencao'];
  novaData: Dia | null;
  prazoTexto: string | null;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (d: string) => DATA.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

/** Só cards da pessoa; data válida e de hoje em diante; um item por card. */
export function validarResposta(saida: SaidaResposta, cards: CardTI[], hoje: Dia): ItemResposta[] {
  const porCodigo = new Map(cards.map((c) => [c.codigo.toUpperCase(), c]));
  const vistos = new Set<string>();
  const itens: ItemResposta[] = [];
  for (const i of saida.itens.slice(0, MAX_ITENS)) {
    const card = i.card_codigo ? porCodigo.get(i.card_codigo.trim().toUpperCase()) : undefined;
    if (!card || vistos.has(card.id)) continue;
    vistos.add(card.id);
    const novaData = i.intencao === 'adiar' && i.nova_data && dataValida(i.nova_data) && i.nova_data >= hoje ? i.nova_data : null;
    itens.push({ card, intencao: i.intencao, novaData, prazoTexto: i.prazo_texto });
  }
  return itens;
}

/** O que vira sugestão na fila (D12): concluir e adiar com data. Bloquear vira aviso aos gestores. */
export function propostaDoItem(i: ItemResposta): { kanban_status: 'done' } | { prazo: Dia; prazo_texto: string | null } | null {
  if (i.intencao === 'concluir' && !estaConcluido(i.card)) return { kanban_status: 'done' };
  if (i.intencao === 'adiar' && i.novaData && i.novaData !== (i.card.due_date ? diaDoPrazo(i.card.due_date) : null)) {
    return { prazo: i.novaData, prazo_texto: i.prazoTexto };
  }
  return null;
}

export const NAO_ACHEI_CARD = 'Não achei o card. Qual o código? (ex.: "IT-045 concluída")';
export const SEM_INTERPRETACAO = 'Recebi sua mensagem, mas não consegui ler agora. A equipe vai ver no Início.';
export const SEM_CARDS = 'Recebi. Você não tem cards abertos no Kanban de TI agora.';
export const SO_TEXTO = 'Por aqui eu só leio texto. Escreva o código do card e o que mudou (ex.: "IT-045 concluída").';

/** "Anotei no IT-045: 'concluída'. A mudança de status vai para aprovação." (§11.3, passo 4) */
export function montarConfirmacao(nome: string, itens: ItemResposta[]): string {
  if (itens.length === 0) return NAO_ACHEI_CARD;
  const linhas = itens.map((i) => {
    const c = i.card.codigo;
    const proposta = propostaDoItem(i);
    if (i.intencao === 'concluir') return proposta ? `${c}: anotei que está concluída. A mudança de status vai para aprovação.` : `${c}: anotei no card.`;
    if (i.intencao === 'adiar') {
      if (proposta) return `${c}: anotei o novo prazo, ${formatarDiaMes(i.novaData!)}. A mudança vai para aprovação.`;
      return i.novaData ? `${c}: anotei no card (o prazo já é ${formatarDiaMes(i.novaData)}).` : `${c}: anotei. Para mudar o prazo, me diga a data (ex.: "${c} vai para 24/10").`;
    }
    if (i.intencao === 'bloquear') return `${c}: anotei o bloqueio e avisei os gestores.`;
    return `${c}: anotei no card.`;
  });
  const n = primeiroNome(nome);
  return [`Obrigada${n ? `, ${n}` : ''}!`, ...linhas].join('\n');
}

// ── Registro do que o membro informou ───────────────────────────────────────

export interface Remetente { id: string; user_id: string; nome: string }

/**
 * Comentário em cada card citado, sugestão para concluir/adiar, aviso aos gestores (sugestão
 * nova, bloqueio) e o texto da confirmação. Não enfileira a confirmação: quem chama responde.
 */
export async function registrarAtualizacoes(
  db: SupabaseClient,
  e: { mensagemId: string; membro: Remetente; texto: string; itens: ItemResposta[]; confianca: SaidaResposta['confianca'] },
): Promise<{ sugestoes: number; confirmacao: string; cardIds: string[] }> {
  const { mensagemId, membro, texto, itens } = e;
  const nome = membro.nome;
  const cardIds = itens.map((i) => i.card.id);
  if (itens.length > 0) {
    // Comentário no card, com as palavras da própria pessoa (D12).
    const { error: eCom } = await db.from('it_task_comments').insert(
      itens.map((i) => ({ task_id: i.card.id, user_id: membro.user_id, content: `via WhatsApp: ${texto.slice(0, MAX_TEXTO)}` })),
    );
    if (eCom) throw new Error(eCom.message);
  }

  const sugestoes = itens
    .map((i) => ({ i, proposta: propostaDoItem(i) }))
    .filter((x) => x.proposta)
    .map(({ i, proposta }) => ({
      origem: 'whatsapp', mensagem_id: mensagemId, proposta_por: membro.user_id, tipo: 'atualizar_card', card_id: i.card.id,
      proposta, trecho: texto.slice(0, 1000), confianca: e.confianca, avisos: [],
    }));
  if (sugestoes.length > 0) {
    const { error: eSug } = await db.from('ti_agente_sugestoes').insert(sugestoes);
    if (eSug) throw new Error(eSug.message);
  }
  await db.from('ti_agente_mensagens').update({ card_ids: cardIds, erro: null }).eq('id', mensagemId);

  // Avisos no sino: falha aqui não desfaz o que já foi gravado.
  try {
    if (sugestoes.length > 0) {
      await avisarGestores(db, {
        titulo: 'Sugestão nova da EVA (WhatsApp)',
        conteudo: `${primeiroNome(nome) || 'Um membro'} respondeu pelo WhatsApp: ${sugestoes.length} ${sugestoes.length === 1 ? 'mudança aguarda' : 'mudanças aguardam'} aprovação.`,
        link: '/it/eva',
      });
    }
    for (const i of itens.filter((x) => x.intencao === 'bloquear')) {
      await avisarGestores(db, {
        titulo: `${i.card.codigo} bloqueado`,
        conteudo: `${primeiroNome(nome) || 'Um membro'} avisou pelo WhatsApp: "${texto.slice(0, 200)}"`,
        link: '/it/kanban',
        tipo: 'warning',
      });
    }
  } catch (erro) {
    console.error('[EVA/respostas] Aviso aos gestores falhou:', erro);
  }

  return { sugestoes: sugestoes.length, confirmacao: montarConfirmacao(nome, itens), cardIds };
}
