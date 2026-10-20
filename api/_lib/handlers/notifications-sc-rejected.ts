/**
 * API Route: POST /api/notifications/sc-rejected
 *
 * Avisa por e-mail quem pediu a SC de que ela foi rejeitada, com o motivo.
 * Disparado pelo SPA (RequestManagement.tsx) logo depois da rejeição pela RPC
 * requests_decidir_sc, em melhor esforço: o cliente só manda `{ id }` —
 * conteúdo e destinatário ficam no servidor.
 *
 * Autorização: `Authorization: Bearer <access_token>` da SESSÃO de quem
 * rejeitou (`requests.rejected_by_user_id`); outro usuário recebe 403, então a
 * rota não serve para reenviar o aviso de SC alheia.
 *
 * Variáveis de ambiente:
 *   APP_URL            → opcional, base do link (ver api/_lib/appUrl.ts)
 *   SMTP_*, SUPABASE_* → já usadas por api/_lib/email.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { APP_BASE_URL } from '../appUrl.js';
import { buildScRejectedEmail, type ScEmailPerson, type ScEmailRow } from '../scApprovalEmails.js';

const LOG = '[notifications/sc-rejected]';
const TEMPLATE_SLUG = 'purchase_request_rejected';

type RejectedRow = ScEmailRow & {
  type: 'SC' | 'SM';
  status: string;
  requested_by_user_id: string | null;
  rejected_by_user_id: string | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ success: false, error: 'Token de autenticação ausente.' });
    return;
  }

  const { id } = (req.body ?? {}) as { id?: unknown };
  if (typeof id !== 'string' || !id) {
    res.status(400).json({ success: false, error: 'Campo obrigatório ausente: id' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
    if (callerErr || !caller?.user) {
      res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      return;
    }

    const { data: request, error: requestErr } = await supabase
      .from('requests')
      .select(`id, type, status, items, reason, priority, requested_by, request_date, department,
        rejection_comment, requested_by_user_id, rejected_by_user_id`)
      .eq('id', id)
      .maybeSingle();
    if (requestErr) throw requestErr;
    if (!request) {
      res.status(404).json({ success: false, error: 'Solicitação não encontrada.' });
      return;
    }

    const row = request as RejectedRow;
    if (row.type !== 'SC' || row.status !== 'rejected') {
      res.status(409).json({ success: false, error: 'A solicitação não é uma SC rejeitada.' });
      return;
    }
    if (row.rejected_by_user_id !== caller.user.id) {
      res.status(403).json({ success: false, error: 'Só quem rejeitou a SC dispara o aviso.' });
      return;
    }

    const ids = [row.requested_by_user_id, row.rejected_by_user_id].filter((v): v is string => !!v);
    const { data: people, error: peopleErr } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .in('id', ids);
    if (peopleErr) throw peopleErr;
    const byId = new Map((people ?? []).map((p) => [p.id as string, p as ScEmailPerson]));

    const email = buildScRejectedEmail(
      row,
      byId.get(row.requested_by_user_id ?? '') ?? null,
      byId.get(row.rejected_by_user_id ?? '') ?? null,
      APP_BASE_URL,
    );
    if (!email) {
      console.warn(`${LOG} quem pediu a SC ${row.id} não tem e-mail válido; aviso não enviado`);
      res.status(200).json({ success: true, sent: 0 });
      return;
    }

    const result = await sendTemplatedEmail({ to: email.to, templateSlug: TEMPLATE_SLUG, variables: email.variables });
    if (!result.success) {
      console.error(`${LOG} falha no envio da SC ${row.id}:`, result.errorCode, result.error);
      res.status(500).json({ success: false, error: 'Falha ao enviar o e-mail.' });
      return;
    }

    res.status(200).json({ success: true, sent: 1 });
  } catch (err) {
    console.error(`${LOG} erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno.' });
  }
}
