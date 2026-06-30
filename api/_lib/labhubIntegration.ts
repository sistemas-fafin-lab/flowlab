// api/_lib/labhubIntegration.ts
// Helpers compartilhados pelas funções de integração com o LAB-HUB
// (api/analises-clinicas/*). Comunicação server-to-server apenas.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

/**
 * Valida o header `Authorization: Bearer <token>` contra FLOWLAB_API_KEY.
 * Comparação em tempo constante para não vazar o segredo por timing.
 * Retorna true se a chave confere.
 */
export function isFlowlabApiKeyValid(req: VercelRequest): boolean {
  const expected = process.env.FLOWLAB_API_KEY;
  if (!expected) {
    throw new Error('Variável de ambiente obrigatória ausente: FLOWLAB_API_KEY');
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;

  const received = Buffer.from(token);
  const computed = Buffer.from(expected);
  // timingSafeEqual exige buffers do mesmo tamanho.
  if (received.length !== computed.length) return false;
  return timingSafeEqual(received, computed);
}

/**
 * Assina o corpo (string crua) com HMAC-SHA256 em hex.
 * Espelha exatamente apps/api/src/lib/hmac.ts do LAB-HUB: o LAB-HUB recalcula
 * createHmac('sha256', secret).update(rawBody).digest('hex') e compara com o
 * header X-Webhook-Signature. Por isso, assine e ENVIE a mesma string serializada.
 */
export function signHmacHex(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Lê uma variável de ambiente obrigatória com erro claro. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}
