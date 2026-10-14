// Fila de saída do WhatsApp (issue 12, plano §11.2). Roda na VPS, a cada minuto
// (tools/agente-ti-whatsapp/send-outbox.ts): lê as pendentes e envia pelo WAHA local.
// O banco fica atrás de RepositorioFila para a rotina ser testável sem Supabase.
import type { SupabaseClient } from '@supabase/supabase-js';
import { depoisDaFalha, intervaloEntreEnvios, type DepoisDaFalha } from '../../../src/modules/eva/domain/whatsapp.js';
import type { ClienteWaha } from './waha.js';

/** Quantas mensagens por execução (§11.2, passo 2). */
export const LIMITE_POR_EXECUCAO = 20;
/** Situação gravada quando o WAHA nem responde: o chip do Início mostra "fora do ar". */
export const WAHA_INACESSIVEL = 'INACESSIVEL';

export interface ItemFila {
  id: string;
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
}

export interface ResultadoFila {
  sessao: string;
  desligado: boolean;
  enviadas: number;
  falhas: number;
  /** Falharam de vez (número fora do WhatsApp, membro sem número, 4ª tentativa). */
  definitivas: number;
}

export async function esvaziarFila(
  repo: RepositorioFila,
  waha: ClienteWaha,
  opcoes: { agora?: () => number; esperar?: (ms: number) => Promise<void>; limite?: number; aleatorio?: () => number } = {},
): Promise<ResultadoFila> {
  const agora = opcoes.agora ?? Date.now;
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const resultado: ResultadoFila = { sessao: '', desligado: false, enviadas: 0, falhas: 0, definitivas: 0 };

  // Passo 6: a situação da sessão é gravada a cada execução, mesmo com o envio desligado (D25).
  const s = await waha.sessao();
  resultado.sessao = s.ok ? s.status : WAHA_INACESSIVEL;
  await repo.gravarSituacaoSessao(resultado.sessao, new Date(agora()).toISOString());

  // Passo 1: liga/desliga geral (RF20).
  if (!(await repo.whatsappAtivo())) return { ...resultado, desligado: true };
  // Sem sessão conectada, enviar só gastaria as tentativas: as mensagens esperam a sessão voltar.
  if (resultado.sessao !== 'WORKING') return resultado;

  const fila = await repo.pendentes(new Date(agora()).toISOString(), opcoes.limite ?? LIMITE_POR_EXECUCAO);
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
        .select('id, tentativas, texto, membro:ti_agente_membros(id, whatsapp, whatsapp_chat_id)')
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
