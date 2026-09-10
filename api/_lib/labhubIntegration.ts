// api/_lib/labhubIntegration.ts
// Helpers compartilhados pelas funções de integração com o LAB-HUB
// (api/analises-clinicas/*). Comunicação server-to-server apenas.

import { createHmac } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import { isBearerApiKeyValid } from './bearerAuth.js';

/**
 * Valida o header `Authorization: Bearer <token>` contra FLOWLAB_API_KEY.
 * Retorna true se a chave confere.
 */
export function isFlowlabApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'FLOWLAB_API_KEY');
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
