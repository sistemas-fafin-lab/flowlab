// api/_lib/email.ts
// Envio de e-mail transacional via SMTP (nodemailer) usando templates dinâmicos
// armazenados no Supabase (tabela notification_templates, render por {{variavel}}).
//
// Variáveis de ambiente necessárias:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (via getSupabaseAdminClient)

import nodemailer, { type Transporter } from 'nodemailer';
import { getSupabaseAdminClient } from './supabase.js';
import { describeError } from './errors.js';

// Transporter compartilhado entre chamadas (mesmo processo/instância serverless):
// sem isso, um lote (ex. confirmação de holerites notificando N colaboradores em
// paralelo) abre N conexões SMTP simultâneas do zero — o Gmail derruba/rejeita
// parte delas sob esse tipo de rajada, e o envio falha silenciosamente pra quem
// caiu na conexão recusada (achado: RH confirmou lote de 38 e pelo menos 1
// colaborador não recebeu a notificação). `pool: true` faz o nodemailer reutilizar
// até `maxConnections` conexões e filar o resto — mesmo ganho de um envio
// sequencial, sem o custo de abrir handshake TLS+auth novo a cada e-mail.
let transporterCache: { key: string; transporter: Transporter } | null = null;

function getTransporter(host: string, port: number, user: string, pass: string): Transporter {
  const key = `${host}:${port}:${user}`;
  if (transporterCache?.key === key) return transporterCache.transporter;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para 465 (SSL), false para 587 (STARTTLS)
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  transporterCache = { key, transporter };
  return transporter;
}

export interface SendTemplatedEmailParams {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
}

export interface SendTemplatedEmailResult {
  success: boolean;
  messageId?: string;
  /** Código de erro semântico para o chamador mapear status HTTP. */
  errorCode?: 'invalid_email' | 'template_not_found' | 'smtp_not_configured' | 'send_failed';
  error?: string;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const renderTemplate = (
  templateString: string,
  variables: Record<string, string>,
): string => templateString.replace(/{{(\w+)}}/g, (_match, key) => variables[key] ?? '');

/**
 * Busca o template no Supabase, renderiza as variáveis e envia por SMTP.
 * Reutilizado pela rota /api/notifications/email e pelo fluxo de criação de usuário.
 */
export async function sendTemplatedEmail(
  { to, templateSlug, variables }: SendTemplatedEmailParams,
): Promise<SendTemplatedEmailResult> {
  console.log('[email] Iniciando envio:', { to, templateSlug, variablesKeys: Object.keys(variables) });

  if (!isValidEmail(to)) {
    console.error('[email] Email inválido:', to);
    return { success: false, errorCode: 'invalid_email', error: 'Endereço de email inválido' };
  }

  // Busca template no Supabase
  let finalSubject: string;
  let finalHtml: string;

  try {
    const supabase = getSupabaseAdminClient();
    console.log('[email] Buscando template no Supabase:', templateSlug, 'URL:', process.env.SUPABASE_URL?.slice(0, 30));
    const { data: template, error } = await supabase
      .from('notification_templates')
      .select('subject_template, body_html')
      .eq('slug', templateSlug)
      .single();

    if (error || !template) {
      console.error('[email] Template não encontrado:', templateSlug, 'Erro Supabase:', error?.message, 'Código:', error?.code);
      return { success: false, errorCode: 'template_not_found', error: 'Template not found' };
    }

    finalSubject = renderTemplate(template.subject_template, variables);
    finalHtml = renderTemplate(template.body_html, variables);
    console.log('[email] Template renderizado com sucesso. Subject:', finalSubject.slice(0, 50));
  } catch (err) {
    console.error('[email] Erro ao buscar template no Supabase:', describeError(err));
    return { success: false, errorCode: 'send_failed', error: 'Erro interno ao carregar template' };
  }

  // Valida configuração SMTP
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  console.log('[email] Config SMTP:', { host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER, from: SMTP_FROM });
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.error('[email] Variáveis de ambiente SMTP não configuradas. Host:', !!SMTP_HOST, 'Port:', !!SMTP_PORT, 'User:', !!SMTP_USER, 'Pass:', !!SMTP_PASS, 'From:', !!SMTP_FROM);
    return { success: false, errorCode: 'smtp_not_configured', error: 'Configuração SMTP ausente no servidor' };
  }

  // Envia via nodemailer
  try {
    const transporter = getTransporter(SMTP_HOST, Number(SMTP_PORT), SMTP_USER, SMTP_PASS);

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject: finalSubject,
      html: finalHtml,
    });

    console.log('[email] Email enviado com sucesso. MessageId:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] Falha ao enviar email:', describeError(err));
    // `error` chega ao cliente via api/notifications/email.ts: mantém a mensagem
    // enxuta do nodemailer, sem os extras de diagnóstico do describeError.
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, errorCode: 'send_failed', error: message };
  }
}
