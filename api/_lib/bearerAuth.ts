// api/_lib/bearerAuth.ts
// Validação genérica de `Authorization: Bearer <token>` contra uma API key
// guardada em variável de ambiente. Compartilhada pelas integrações
// server-to-server (LAB-HUB, Tabela Particular, ...) — cada uma com sua
// própria env var, pra manter o blast radius de uma revogação restrito a
// essa integração.

import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

/**
 * Comparação em tempo constante para não vazar o segredo por timing.
 * Lança se `envVarName` não estiver configurada.
 */
export function isBearerApiKeyValid(req: VercelRequest, envVarName: string): boolean {
  const expected = process.env[envVarName];
  if (!expected) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${envVarName}`);
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
