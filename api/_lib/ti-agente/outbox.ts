// Fila de saída do WhatsApp (issue 12, plano §11.2). Roda na VPS, a cada minuto
// (tools/agente-ti-whatsapp/send-outbox.ts): lê as pendentes e envia pelo WAHA local.
// O banco fica atrás de RepositorioFila para a rotina ser testável sem Supabase.
import type { SupabaseClient } from '@supabase/supabase-js';
import { depoisDaFalha, intervaloEntreEnvios, venceuNaFila, type DepoisDaFalha } from '../../../src/modules/eva/domain/whatsapp.js';
import { ehTipoDeCobranca, proximaJanelaDeCobranca } from '../../../src/modules/eva/domain/cobranca.js';
import type { ClienteWaha } from './waha.js';

/** Quantas mensagens por execução (§11.2, passo 2). */
export const LIMITE_POR_EXECUCAO = 20;
/** Situação gravada quando o WAHA nem responde: o chip do Início mostra "fora do ar". */
export const WAHA_INACESSIVEL = 'INACESSIVEL';
export const ERRO_VENCIDA = 'Venceu na fila sem ser enviada (WhatsApp desligado ou WAHA fora do ar por muito tempo).';

export interface ItemFila {
  id: string;
  tipo: string;
  created_at: string;
  /** Agendada (horário de cobrança) ou próxima tentativa depois de uma falha. */
  proxima_tentativa_em: string | null;
  tentativas: number;
  texto: string;
  membro: { id: string; whatsapp: string | null; whatsapp_chat_id: string | null } | null;
}

export interface RepositorioFila {
  whatsappAtivo(): Promise<boolean>;
  gravarSituacaoSessao(status: string, em: string): Promise<void>;
  pendentes(agoraIso: string, limite: number): Promise<ItemFila[]>;
  guardarChatId(membroId: string, chatId: string): Promise<void>;
  marcarEnviada(id: string, wahaId: string | null, em: string): Promise<void>;
  marcarFalha(id: string, depois: DepoisDaFalha | { status: 'falhou'; tentativas: number }, erro: string): Promise<void>;
  /** Fora do horário de cobrança: a mensagem continua pendente, para o instante dado. */
  adiar(id: string, para: string): Promise<void>;
}

export interface ResultadoFila {
  sessao: string;
  desligado: boolean;
  enviadas: number;
  falhas: number;
  /** Falharam de vez (número fora do WhatsApp, membro sem número, 4ª tentativa). */
  definitivas: number;
  /** Venceram na fila e não saem mais (ver venceuNaFila). */
  vencidas: number;
  /** Cobranças fora do horário (dia útil, 7h às 20h), reagendadas para a próxima janela. */
  adiadas: number;
}

export async function esvaziarFila(
  repo: RepositorioFila,
  waha: ClienteWaha,
  opcoes: { agora?: () => number; esperar?: (ms: number) => Promise<void>; limite?: number; aleatorio?: () => number } = {},
): Promise<ResultadoFila> {
  const agora = opcoes.agora ?? Date.now;
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const resultado: ResultadoFila = { sessao: '', desligado: false, enviadas: 0, falhas: 0, definitivas: 0, vencidas: 0, adiadas: 0 };

  // Passo 6: a situação da sessão é gravada a cada execução, mesmo com o envio desligado (D25).
  const s = await waha.sessao();
  resultado.sessao = s.ok ? s.status : WAHA_INACESSIVEL;
  await repo.gravarSituacaoSessao(resultado.sessao, new Date(agora()).toISOString());

  // Mensagem velha não sai depois de uma queda longa (a cobrança da manhã diz "pendências de
  // hoje"). Vence mesmo com o envio desligado ou a sessão caída, para a fila mostrar a verdade.
  const pendentes = await repo.pendentes(new Date(agora()).toISOString(), opcoes.limite ?? LIMITE_POR_EXECUCAO);
  const fila: ItemFila[] = [];
  const janela = proximaJanelaDeCobranca(agora());
  for (const item of pendentes) {
    if (venceuNaFila(item.tipo, item.created_at, agora(), item.proxima_tentativa_em)) {
      await repo.marcarFalha(item.id, { status: 'falhou', tentativas: item.tentativas }, ERRO_VENCIDA);
      resultado.vencidas += 1;
      continue;
    }
    // Cobrança só em dia útil, das 7h às 20h. Fora disso, espera a próxima janela, e o
    // reagendamento a tira da busca até lá (não ocupa o lugar de um teste ou confirmação).
    if (janela !== null && ehTipoDeCobranca(item.tipo)) {
      await repo.adiar(item.id, new Date(janela).toISOString());
      resultado.adiadas += 1;
      continue;
    }
    fila.push(item);
  }

  // Passo 1: liga/desliga geral (RF20).
  if (!(await repo.whatsappAtivo())) return { ...resultado, desligado: true };
  // Sem sessão conectada, enviar só gastaria as tentativas: as mensagens esperam a sessão voltar.
  if (resultado.sessao !== 'WORKING') return resultado;

  let primeiro = true;
  for (const item of fila) {
    const falhaDefinitiva = async (erro: string) => {
      await repo.marcarFalha(item.id, { status: 'falhou', tentativas: item.tentativas + 1 }, erro);
      resultado.falhas += 1;
      resultado.definitivas += 1;
    };
    const falhaTemporaria = async (erro: string) => {
      const depois = depoisDaFalha(item.tentativas, agora());
      await repo.marcarFalha(item.id, depois, erro);
      resultado.falhas += 1;
      if (depois.status === 'falhou') resultado.definitivas += 1;
    };

    if (!item.membro?.whatsapp) {
      await falhaDefinitiva('Membro sem WhatsApp cadastrado.');
      continue;
    }

    // Passo 3: resolve o chatId uma vez e guarda (o 9º dígito dos números brasileiros, §3).
    let chatId = item.membro.whatsapp_chat_id;
    if (!chatId) {
      const v = await waha.verificarNumero(item.membro.whatsapp);
      if ('erro' in v) { await falhaTemporaria(v.erro); continue; }
      if (!v.existe || !v.chatId) { await falhaDefinitiva(`O número ${item.membro.whatsapp} não está no WhatsApp.`); continue; }
      chatId = v.chatId;
      await repo.guardarChatId(item.membro.id, chatId);
    }

    // Passo 4: 1 a 3 s entre envios.
    if (!primeiro) await esperar(intervaloEntreEnvios(opcoes.aleatorio?.()));
    primeiro = false;

    const e = await waha.enviarTexto(chatId, item.texto);
    if ('erro' in e) { await falhaTemporaria(e.erro); continue; }
    await repo.marcarEnviada(item.id, e.id, new Date(agora()).toISOString());
    resultado.enviadas += 1;
  }
  return resultado;
}

/** O repositório de verdade, com a service role. */
export function repositorioSupabase(db: SupabaseClient): RepositorioFila {
  const falhou = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
  return {
    async whatsappAtivo() {
      const { data, error } = await db.from('ti_agente_config').select('whatsapp_ativo').eq('id', true).maybeSingle();
      falhou(error);
      return data?.whatsapp_ativo === true;
    },
    async gravarSituacaoSessao(status, em) {
      const { error } = await db.from('ti_agente_config').update({ waha_status: status, waha_verificado_em: em }).eq('id', true);
      falhou(error);
    },
    async pendentes(agoraIso, limite) {
      const { data, error } = await db
        .from('ti_agente_mensagens')
        .select('id, tipo, created_at, proxima_tentativa_em, tentativas, texto, membro:ti_agente_membros(id, whatsapp, whatsapp_chat_id)')
        .eq('direcao', 'saida')
        .eq('status', 'pendente')
        .or(`proxima_tentativa_em.is.null,proxima_tentativa_em.lte.${agoraIso}`)
        .order('created_at')
        .limit(limite);
      falhou(error);
      return (data ?? []) as unknown as ItemFila[];
    },
    async guardarChatId(membroId, chatId) {
      const { error } = await db.from('ti_agente_membros').update({ whatsapp_chat_id: chatId }).eq('id', membroId);
      falhou(error);
    },
    async marcarEnviada(id, wahaId, em) {
      const { error } = await db
        .from('ti_agente_mensagens')
        .update({ status: 'enviada', waha_message_id: wahaId, enviada_em: em, erro: null, proxima_tentativa_em: null })
        .eq('id', id);
      falhou(error);
    },
    async adiar(id, para) {
      const { error } = await db.from('ti_agente_mensagens').update({ proxima_tentativa_em: para }).eq('id', id).eq('status', 'pendente');
      falhou(error);
    },
    async marcarFalha(id, depois, erro) {
      const { error } = await db
        .from('ti_agente_mensagens')
        .update({
          status: depois.status,
          tentativas: depois.tentativas,
          proxima_tentativa_em: depois.status === 'pendente' ? (depois as { proxima_tentativa_em: string }).proxima_tentativa_em : null,
          erro: erro.slice(0, 500),
        })
        .eq('id', id);
      falhou(error);
    },
  };
}
