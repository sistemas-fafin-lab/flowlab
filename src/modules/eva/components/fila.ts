// A fila do WhatsApp no formato do bloco do Início (WhatsAppQueueCard, D24).
import { horarioNaFila, type MensagemFila } from '../domain/whatsapp';
import type { Dia } from '../domain/datas';
import type { WaMessage, WaStatus } from '../types';

const STATUS: Record<string, WaStatus> = {
  pendente: 'scheduled',
  enviada: 'sent',
  entregue: 'delivered',
  lida: 'read',
  falhou: 'failed',
};

/** Itens do bloco: só mensagens de saída, as mais recentes primeiro. Na Minha visão, só as do gestor. */
export const MAX_NA_FILA = 8;

export function mensagensDaFila(fila: MensagemFila[], hoje: Dia, soDe: string | null): WaMessage[] {
  return fila
    .filter((m) => m.direcao === 'saida' && STATUS[m.status] && (!soDe || m.membro_user_id === soDe))
    .slice(0, MAX_NA_FILA)
    .map((m) => ({
      id: m.id,
      time: horarioNaFila(m.enviada_em ?? m.created_at, hoje),
      to: m.chat_id_destino ? 'Grupo da equipe' : m.membro_nome ?? 'Membro removido',
      text: m.texto,
      status: STATUS[m.status],
      note: m.status === 'falhou' ? m.erro ?? 'Falhou' : undefined,
    }));
}
