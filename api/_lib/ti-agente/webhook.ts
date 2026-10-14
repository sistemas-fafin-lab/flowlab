// Eventos do WAHA (issue 15, plano §11.3). Puro: lê o corpo do webhook e diz o que fazer.
// Validação da origem: token secreto na URL (?token=, HTTPS), comparado em tempo constante.
// O HMAC do WAHA exigiria o corpo cru, e a Vercel entrega o corpo já convertido em JSON
// (decisão registrada na issue 15). A segunda barreira é o remetente estar entre os membros.
import { createHash, timingSafeEqual } from 'node:crypto';
import { digitosDoChatId, mesmoNumero } from '../../../src/modules/eva/domain/whatsapp.js';

export type EventoWaha =
  | { tipo: 'mensagem'; id: string; remetentes: string[]; texto: string; temMidia: boolean }
  | { tipo: 'ack'; id: string; ack: number }
  | { tipo: 'ignorar'; motivo: string };

const ignorar = (motivo: string): EventoWaha => ({ tipo: 'ignorar', motivo });

interface CorpoWaha {
  event?: string;
  session?: string;
  payload?: {
    id?: unknown;
    from?: unknown;
    fromMe?: unknown;
    participant?: unknown;
    body?: unknown;
    hasMedia?: unknown;
    ack?: unknown;
    _data?: { key?: { senderPn?: unknown; remoteJidAlt?: unknown } };
  };
}

/** RN13: só conversa direta de outra pessoa; grupos, listas, canais e o próprio número saem. */
export function lerEvento(corpo: unknown, sessaoEsperada: string): EventoWaha {
  const b = (corpo ?? {}) as CorpoWaha;
  if (typeof b !== 'object' || !b.event) return ignorar('corpo sem evento');
  if (b.session && b.session !== sessaoEsperada) return ignorar(`sessão ${b.session}`);
  const p = b.payload ?? {};

  if (b.event === 'message.ack') {
    const ack = Number(p.ack);
    return typeof p.id === 'string' && Number.isFinite(ack) ? { tipo: 'ack', id: p.id, ack } : ignorar('ack sem id');
  }
  if (b.event !== 'message') return ignorar(`evento ${b.event}`);
  if (p.fromMe === true) return ignorar('enviada pela própria EVA');

  const de = typeof p.from === 'string' ? p.from : '';
  if (/@(g\.us|broadcast|newsletter)$/.test(de)) return ignorar('grupo, lista ou canal');
  if (typeof p.id !== 'string' || !p.id) return ignorar('mensagem sem id');

  // O remetente pode vir como número (@c.us) ou como LID (@lid); nesse caso, o número
  // costuma vir em _data.key (senderPn / remoteJidAlt), conforme o engine do WAHA.
  const candidatos = [de, p.participant, p._data?.key?.senderPn, p._data?.key?.remoteJidAlt]
    .filter((x): x is string => typeof x === 'string')
    .map(digitosDoChatId)
    .filter((x): x is string => !!x);
  return {
    tipo: 'mensagem',
    id: p.id,
    remetentes: Array.from(new Set(candidatos)),
    texto: typeof p.body === 'string' ? p.body.trim() : '',
    temMidia: p.hasMedia === true,
  };
}

/** Compara o token em tempo constante (os dois lados viram SHA-256, então o tamanho não vaza). */
export function tokenValido(recebido: unknown, esperado: string | undefined): boolean {
  if (!esperado || typeof recebido !== 'string' || !recebido) return false;
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

export interface MembroWebhook { id: string; user_id: string; whatsapp: string | null; whatsapp_chat_id: string | null; ativo: boolean }

/** RN13: o remetente precisa ser um membro ativo (pelo número cadastrado ou pelo chatId resolvido). */
export function acharMembro(remetentes: string[], membros: MembroWebhook[]): MembroWebhook | null {
  return membros.find((m) => m.ativo && remetentes.some((r) => mesmoNumero(r, m.whatsapp) || mesmoNumero(r, digitosDoChatId(m.whatsapp_chat_id)))) ?? null;
}
