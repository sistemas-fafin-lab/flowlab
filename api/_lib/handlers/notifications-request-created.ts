/**
 * API Route: POST /api/notifications/request-created
 *
 * Avisa o estoque por e-mail de uma SC/SM recém-criada. Disparado pelo SPA
 * (RequestManagement.tsx) logo depois do insert, em melhor esforço: o cliente só
 * manda `{ id }` — conteúdo e destinatário ficam no servidor, então a rota não
 * serve para mandar e-mail arbitrário.
 *
 * Autorização: `Authorization: Bearer <access_token>` da SESSÃO do usuário. Não
 * exige permissão específica — qualquer usuário logado pode criar solicitação.
 *
 * Variáveis de ambiente:
 *   REQUESTS_STOCK_ALERT_TO → e-mail(s) do estoque, separados por vírgula
 *   APP_URL                 → opcional, base do link (ver api/_lib/appUrl.ts)
 *   SMTP_*, SUPABASE_*      → já usadas por api/_lib/email.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { APP_BASE_URL } from '../appUrl.js';
import { buildRequestsUrl } from '../requestsRoutes.js';
import {
  buildRequestCreatedEmailVariables,
  parseRecipientList,
  type RequestCreatedRow,
} from '../requestCreatedEmail.js';

const TEMPLATE_SLUG = 'purchase_request_created';
const ACTION_URL = buildRequestsUrl(APP_BASE_URL, 'pending');

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

    const recipients = parseRecipientList(process.env.REQUESTS_STOCK_ALERT_TO);
    if (recipients.length === 0) {
      console.error('[notifications/request-created] REQUESTS_STOCK_ALERT_TO não configurada');
      res.status(500).json({ success: false, error: 'Destinatário do alerta não configurado.' });
      return;
    }

    const { data: request, error: requestErr } = await supabase
      .from('requests')
      .select('type, items, reason, priority, requested_by, request_date, department, supplier_name')
      .eq('id', id)
      .maybeSingle();
    if (requestErr) throw requestErr;
    if (!request) {
      res.status(404).json({ success: false, error: 'Solicitação não encontrada.' });
      return;
    }

    const row = request as RequestCreatedRow;
    const productIds = [...new Set((row.items ?? []).map((i) => i.productId).filter((p): p is string => !!p))];
    const stockByProductId: Record<string, number> = {};
    if (productIds.length > 0) {
      const { data: products, error: productsErr } = await supabase
        .from('products')
        .select('id, quantity')
        .in('id', productIds);
      if (productsErr) throw productsErr;
      for (const p of products ?? []) stockByProductId[p.id] = Number(p.quantity) || 0;
    }

    const variables = buildRequestCreatedEmailVariables(row, stockByProductId, ACTION_URL);

    const results = await Promise.all(
      recipients.map((to) => sendTemplatedEmail({ to, templateSlug: TEMPLATE_SLUG, variables })),
    );
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.error(
        '[notifications/request-created] falha no envio:',
        failures.map((f) => f.error).join('; '),
      );
      res.status(500).json({ success: false, error: 'Falha ao enviar o e-mail.' });
      return;
    }

    res.status(200).json({ success: true, sent: results.length });
  } catch (err) {
    console.error('[notifications/request-created] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno.' });
  }
}
