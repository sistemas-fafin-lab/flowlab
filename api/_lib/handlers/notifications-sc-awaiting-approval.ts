/**
 * API Route: POST /api/notifications/sc-awaiting-approval
 *
 * Avisa por e-mail o aprovador de cada SC que ganhou aprovador e ainda não foi
 * avisado (`requests.approver_notified_at` NULL — a fila). Chamado pelo banco
 * (pg_net, trigger requests_avisar_aprovador em
 * supabase/migrations/20261020235000_sc_aviso_ao_aprovador.sql) depois da
 * criação da SC e do recálculo do aprovador pelo RH. Sem corpo: esvazia a fila
 * inteira, então uma chamada perdida é recuperada pela próxima.
 *
 * Cada SC é marcada antes do envio (UPDATE condicional), para duas chamadas
 * simultâneas não mandarem o mesmo e-mail; se o envio falhar, a marca é
 * desfeita. Aprovador sem e-mail válido fica marcado, sem envio.
 *
 * Autorização: `Authorization: Bearer <CRON_SECRET>` (o banco guarda o mesmo
 * valor no Vault como `flowlab_cron_secret`).
 *
 * Variáveis de ambiente:
 *   CRON_SECRET        → segredo compartilhado com o banco (obrigatória)
 *   APP_URL            → opcional, base do link (ver api/_lib/appUrl.ts)
 *   SMTP_*, SUPABASE_* → já usadas por api/_lib/email.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { APP_BASE_URL } from '../appUrl.js';
import { isBearerApiKeyValid } from '../bearerAuth.js';
import { buildScAwaitingApprovalEmail, type ScEmailPerson, type ScEmailRow } from '../scApprovalEmails.js';

const LOG = '[notifications/sc-awaiting-approval]';
const TEMPLATE_SLUG = 'purchase_request_awaiting_approval';
// Fila normal tem uma ou poucas SCs; o limite só segura um backlog inesperado.
const BATCH_LIMIT = 50;

type QueuedRow = ScEmailRow & { approver: ScEmailPerson | null };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  if (!process.env.CRON_SECRET || !isBearerApiKeyValid(req, 'CRON_SECRET')) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('requests')
      .select(`id, items, reason, priority, requested_by, request_date, department, rejection_comment,
        approver:user_profiles!requests_approver_id_fkey (name, email)`)
      .eq('type', 'SC')
      .eq('status', 'pending')
      .not('approver_id', 'is', null)
      .is('approver_notified_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of (data ?? []) as unknown as QueuedRow[]) {
      const { data: claimed, error: claimErr } = await supabase
        .from('requests')
        .update({ approver_notified_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('approver_notified_at', null)
        .select('id');
      if (claimErr) throw claimErr;
      if (!claimed?.length) continue; // outra chamada já pegou esta SC

      const email = buildScAwaitingApprovalEmail(row, row.approver, APP_BASE_URL);
      if (!email) {
        console.warn(`${LOG} aprovador da SC ${row.id} sem e-mail válido; aviso não enviado`);
        skipped += 1;
        continue;
      }

      const result = await sendTemplatedEmail({ to: email.to, templateSlug: TEMPLATE_SLUG, variables: email.variables });
      if (result.success) {
        sent += 1;
        continue;
      }

      failed += 1;
      console.error(`${LOG} falha no envio da SC ${row.id}:`, result.errorCode, result.error);
      const { error: releaseErr } = await supabase
        .from('requests')
        .update({ approver_notified_at: null })
        .eq('id', row.id);
      if (releaseErr) console.error(`${LOG} não desmarcou a SC ${row.id}:`, describeError(releaseErr));
    }

    res.status(failed > 0 ? 500 : 200).json({ success: failed === 0, sent, skipped, failed });
  } catch (err) {
    console.error(`${LOG} erro:`, describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno.' });
  }
}
