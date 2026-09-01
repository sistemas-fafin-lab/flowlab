#!/usr/bin/env -S npx tsx
// tools/quotation-approval-digest/send-digest.ts
//
// Resumo diário de cotações "aguardando aprovação" — roda 1x/dia (17h),
// agendado por cron do SO (ver install.sh), no mesmo mecanismo já usado pelo
// alerta de hardware em tools/hardware-monitor/. A lógica de elegibilidade e
// montagem de notificação roda no mesmo runtime do domínio de cotações
// (TypeScript/Node) — não é reescrita em outra linguagem.
//
// Para cada gestor com alçada (`user_approval_limits_with_details`,
// can_approve = true), lista só as cotações em status "awaiting_approval"
// cujo valor está dentro do limite dele, e envia uma notificação consolidada
// através do endpoint de notificação por e-mail já existente no projeto
// (POST /api/notifications/email). Gestor sem nenhuma pendência não recebe
// e-mail.
//
// Variáveis de ambiente necessárias:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → leitura de cotações e alçadas
//   FLOWLAB_API_URL                         → base da API (ex: https://flow-lab.vercel.app)
//   VITE_APP_URL (opcional)                 → base do link no e-mail (padrão: FLOWLAB_API_URL)
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FLOWLAB_API_URL=... \
//     npx tsx tools/quotation-approval-digest/send-digest.ts
//   (--dry-run mostra os payloads sem enviar nada)

import { getSupabaseAdminClient } from '../../api/_lib/supabase.js';
import {
  buildPendingApprovalDigestNotifications,
  PendingApprovalDigestApprover,
  PendingApprovalQuotationRow,
} from '../../src/modules/quotations/pendingApprovalDigest';
import { buildQuotationsUrl } from '../../src/modules/quotations/routes';

const SCRIPT_NAME = 'quotation-approval-digest';

interface ApproverRow {
  user_email: string | null;
  effective_max_amount: number;
}

async function fetchPendingQuotations(): Promise<PendingApprovalQuotationRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('quotations')
    .select('code, title, quotation_type, created_by_name, selected_price, final_total_amount, estimated_total')
    .eq('status', 'awaiting_approval')
    .returns<PendingApprovalQuotationRow[]>();

  if (error) throw new Error(`Falha ao buscar cotações pendentes: ${error.message}`);

  return data ?? [];
}

async function fetchEligibleApprovers(): Promise<PendingApprovalDigestApprover[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_approval_limits_with_details')
    .select('user_email, effective_max_amount')
    .eq('can_approve', true)
    .returns<ApproverRow[]>();

  if (error) throw new Error(`Falha ao buscar gestores com alçada: ${error.message}`);

  return data ?? [];
}

async function sendEmail(apiUrl: string, notification: { to: string; templateSlug: string; variables: Record<string, string> }): Promise<boolean> {
  const url = `${apiUrl}/api/notifications/email`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[${SCRIPT_NAME}] POST ${url} -> ${response.status} para ${notification.to}: ${body}`);
    return false;
  }

  console.error(`[${SCRIPT_NAME}] POST ${url} -> ${response.status} para ${notification.to}`);
  return true;
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');

  const apiUrl = (process.env.FLOWLAB_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!apiUrl) {
    console.error(`[${SCRIPT_NAME}] FLOWLAB_API_URL é obrigatório.`);
    return 2;
  }
  const appUrl = (process.env.VITE_APP_URL ?? apiUrl).trim().replace(/\/+$/, '');

  const [pendingQuotations, approvers] = await Promise.all([
    fetchPendingQuotations(),
    fetchEligibleApprovers(),
  ]);

  if (pendingQuotations.length === 0) {
    console.error(`[${SCRIPT_NAME}] Nenhuma cotação aguardando aprovação. Nada a enviar.`);
    return 0;
  }

  const actionUrl = buildQuotationsUrl(appUrl, 'awaiting_approval');
  const notifications = buildPendingApprovalDigestNotifications(pendingQuotations, approvers, actionUrl);

  if (notifications.length === 0) {
    console.error(`[${SCRIPT_NAME}] ${pendingQuotations.length} cotação(ões) pendente(s), mas nenhum gestor elegível com email cadastrado.`);
    return 0;
  }

  if (dryRun) {
    console.log(JSON.stringify(notifications, null, 2));
    return 0;
  }

  const results = await Promise.all(notifications.map((notification) => sendEmail(apiUrl, notification)));
  const failures = results.filter((ok) => !ok).length;

  console.error(`[${SCRIPT_NAME}] ${notifications.length - failures}/${notifications.length} e-mail(s) enviado(s) com sucesso.`);
  return failures > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[${SCRIPT_NAME}] Erro inesperado:`, err);
    process.exit(1);
  });
