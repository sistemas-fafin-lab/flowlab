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
import nodemailer from 'nodemailer';
import { getSupabaseAdminClient } from '../_lib/supabase.js';

interface EmailRequestBody {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const renderTemplate = (
  templateString: string,
  variables: Record<string, string>
): string => {
  return templateString.replace(/{{(\w+)}}/g, (_match, key) => variables[key] ?? '');
};

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

  if (!isValidEmail(to)) {
    res.status(400).json({ success: false, error: 'Endereço de email inválido' });
    return;
  }

  if (typeof variables !== 'object' || Array.isArray(variables)) {
    res.status(400).json({ success: false, error: 'O campo variables deve ser um objeto chave-valor' });
    return;
  }

  // Buscar template no Supabase
  let finalSubject: string;
  let finalHtml: string;

  try {
    const supabase = getSupabaseAdminClient();

    const { data: template, error } = await supabase
      .from('notification_templates')
      .select('subject_template, body_html')
      .eq('slug', templateSlug)
      .single();

    if (error || !template) {
      console.error('[email] Template não encontrado:', templateSlug, error?.message);
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    finalSubject = renderTemplate(template.subject_template, variables);
    finalHtml    = renderTemplate(template.body_html, variables);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[email] Erro ao buscar template no Supabase:', message);
    res.status(500).json({ success: false, error: 'Erro interno ao carregar template' });
    return;
  }

  // Validação das variáveis de ambiente SMTP
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.error('[email] Variáveis de ambiente SMTP não configuradas');
    res.status(500).json({ success: false, error: 'Configuração SMTP ausente no servidor' });
    return;
  }

  // Enviar e-mail via Nodemailer
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // true para 465 (SSL), false para 587 (STARTTLS)
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: finalSubject,
      html: finalHtml,
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[email] Falha ao enviar email:', message);
    res.status(500).json({ success: false, error: message });
  }
}
