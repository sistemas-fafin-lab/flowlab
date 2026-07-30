/**
 * API Route: POST /api/notifications/email
 *
 * Vercel Serverless Function — Envio de email via SMTP (nodemailer)
 * com suporte a templates dinâmicos armazenados no Supabase.
 *
 * Variáveis de ambiente necessárias:
 *   SMTP_HOST                → ex: smtp.gmail.com
 *   SMTP_PORT                → ex: 587
 *   SMTP_USER                → ex: no-reply@empresa.com
 *   SMTP_PASS                → senha / app password
 *   SMTP_FROM                → ex: "Sistema FlowLab <no-reply@empresa.com>"
 *   SUPABASE_URL             → URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY → chave de service role (nunca expor no cliente)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../_lib/email.js';

interface EmailRequestBody {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Só aceita POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const { to, templateSlug, variables } = (req.body ?? {}) as Partial<EmailRequestBody>;

  // Validação de entrada
  if (!to || !templateSlug || !variables) {
    res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes: to, templateSlug, variables',
    });
    return;
  }

  if (typeof variables !== 'object' || Array.isArray(variables)) {
    res.status(400).json({ success: false, error: 'O campo variables deve ser um objeto chave-valor' });
    return;
  }

  const result = await sendTemplatedEmail({ to, templateSlug, variables });

  if (result.success) {
    res.status(200).json({ success: true, messageId: result.messageId });
    return;
  }

  const status =
    result.errorCode === 'invalid_email' ? 400 :
    result.errorCode === 'template_not_found' ? 404 : 500;

  res.status(status).json({ success: false, error: result.error });
}
