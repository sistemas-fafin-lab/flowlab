// Eventos do WAHA (issue 15, plano §11.3). Puro: lê o corpo do webhook e diz o que fazer.
// Validação da origem: token secreto na URL (?token=, HTTPS), comparado em tempo constante.
// O HMAC do WAHA exigiria o corpo cru, e a Vercel entrega o corpo já convertido em JSON
// (decisão registrada na issue 15). A segunda barreira é o remetente estar entre os membros.
import { createHash, timingSafeEqual } from 'node:crypto';
import { digitosDoChatId, mesmoNumero } from '../../../src/modules/eva/domain/whatsapp.js';
import { AUDIO_AINDA_NAO, MIDIA_NAO_SUPORTADA, caminhoNoWaha, ehFigurinha, tipoDaMidia } from '../../../src/modules/eva/domain/midia.js';

/** A mídia que o WAHA baixou (D43): a URL aponta para o WAHA local da VPS. */
export interface MidiaWaha { url: string | null; mimetype: string | null }

export type EventoWaha =
  | { tipo: 'mensagem'; id: string; remetentes: string[]; texto: string; temMidia: boolean; midia: MidiaWaha | null }
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
    /** Preenchido quando o WAHA baixa a mídia (WHATSAPP_DOWNLOAD_MEDIA, ligado por padrão). */
    media?: { url?: unknown; mimetype?: unknown } | null;
    ack?: unknown;
    _data?: {
      /** NOWEB/WEBJS: o número quando o remetente vem como LID. */
      key?: { senderPn?: unknown; remoteJidAlt?: unknown };
      /** GOWS (whatsmeow): Sender/Chat podem ser LID; SenderAlt/ChatAlt trazem o número. */
      Info?: { Sender?: unknown; SenderAlt?: unknown; Chat?: unknown; ChatAlt?: unknown };
    };
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

  // O remetente pode vir como número (@c.us) ou como LID (@lid); nesse caso, o número vem
  // em outro campo, conforme o engine do WAHA: _data.key (NOWEB) ou _data.Info (GOWS).
  const info = p._data?.Info;
  const candidatos = [de, p.participant, p._data?.key?.senderPn, p._data?.key?.remoteJidAlt, info?.SenderAlt, info?.Sender, info?.ChatAlt, info?.Chat]
    .filter((x): x is string => typeof x === 'string')
    .map(digitosDoChatId)
    .filter((x): x is string => !!x);
  const temMidia = p.hasMedia === true;
  const m = p.media && typeof p.media === 'object' ? p.media : null;
  const midia = temMidia && m
    ? { url: typeof m.url === 'string' && m.url ? m.url : null, mimetype: typeof m.mimetype === 'string' && m.mimetype ? m.mimetype : null }
    : null;
  return {
    tipo: 'mensagem',
    id: p.id,
    remetentes: Array.from(new Set(candidatos)),
    texto: typeof p.body === 'string' ? p.body.trim() : '',
    temMidia,
    midia,
  };
}

export type PlanoMidia =
  /** Sem mídia, ou imagem sem a VPS nova: segue pelo texto (a legenda), como antes. */
  | { acao: 'texto' }
  /** Figurinha: fica registrada, sem resposta. */
  | { acao: 'ignorar'; motivo: string }
  /** Vídeo, documento, áudio sem a VPS nova: a resposta fixa, sem IA. */
  | { acao: 'responder'; resposta: string }
  /** Áudio ou imagem: espera a VPS baixar (D43). */
  | { acao: 'baixar'; tipo: 'audio' | 'imagem'; mimetype: string; url: string };

/** O que fazer com a mídia recebida. `vpsBaixa`: a VPS anunciou que baixa mídia e está viva. */
export function planoDaMidia(e: { texto: string; temMidia: boolean; midia: MidiaWaha | null }, vpsBaixa: boolean): PlanoMidia {
  if (!e.temMidia) return { acao: 'texto' };
  const mimetype = e.midia?.mimetype ?? null;
  const tipo = tipoDaMidia(mimetype);
  if (tipo === 'imagem' && ehFigurinha(mimetype, e.texto)) return { acao: 'ignorar', motivo: 'figurinha' };
  // Sem o tipo, o WAHA não baixou o arquivo: vale a legenda, ou a resposta de "só leio texto".
  if (tipo === 'outro') return mimetype ? { acao: 'responder', resposta: MIDIA_NAO_SUPORTADA } : { acao: 'texto' };
  if (!vpsBaixa || !caminhoNoWaha(e.midia?.url) || !mimetype) {
    return tipo === 'audio' ? { acao: 'responder', resposta: AUDIO_AINDA_NAO } : { acao: 'texto' };
  }
  return { acao: 'baixar', tipo, mimetype, url: e.midia!.url! };
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
