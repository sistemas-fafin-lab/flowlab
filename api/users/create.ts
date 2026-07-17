/**
 * API Route: POST /api/users/create
 *
 * Vercel Serverless Function — Cadastro de novo usuário operado por um admin
 * com permissão `canManageUsers`. Cria a conta de acesso (Supabase Auth),
 * registra na whitelist, completa o perfil, cria um alias no Google Workspace
 * e envia um e-mail de boas-vindas com a senha temporária e o convite do Slack.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da sessão do admin.
 *
 * Variáveis de ambiente: ver api/_lib/createUser.ts, email.ts e googleWorkspace.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUserFlow } from '../_lib/createUser.js';
import { describeError } from '../_lib/errors.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    const { status, payload } = await createUserFlow(token, req.body ?? {});
    res.status(status).json(payload);
  } catch (err) {
    console.error('[users/create] Falha inesperada:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao cadastrar usuário.' });
  }
}
