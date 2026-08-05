-- ═══════════════════════════════════════════════════════════════════════════════
-- Template de e-mail "seu e-mail de acesso mudou"
-- Migration: 20260805120100_user_email_changed_template.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- MOTIVO: change_user_email (20260805120000) troca o login imediatamente e sem
-- confirmação — o admin altera e o acesso pelo endereço antigo morre na hora.
-- Sem este aviso, a pessoa só descobre no próximo login, que falha sem explicação.
--
-- Enviado pela tela de Gestão de Usuários (UserManagement.tsx) via
-- POST /api/notifications/email, para o endereço NOVO. É best-effort: se o SMTP
-- estiver fora, a troca continua valendo — mesma postura do cadastro
-- (api/_lib/createUser.ts:233).
--
-- Idempotente (ON CONFLICT no slug).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'user_email_changed',
  'E-mail de acesso alterado',
  'Seu e-mail de acesso ao FlowLab foi alterado',
  '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">E-mail de acesso alterado</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Use o novo endereço no próximo login</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;">Olá <strong>{{name}}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                O e-mail que você usa para entrar no FlowLab foi alterado por um administrador.
                A mudança já está valendo: o endereço antigo não serve mais para acessar o sistema.
                <strong>Sua senha continua a mesma.</strong>
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">E-mail anterior</p>
                  <p style="margin:0 0 16px;font-size:15px;color:#64748b;text-decoration:line-through;">{{old_email}}</p>

                  <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Novo login</p>
                  <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">{{new_email}}</p>
                </td></tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                Se você não esperava esta mudança, procure o administrador do sistema imediatamente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">FlowLab — Sistema de integração operacional do Laboratório Lab.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'
)
ON CONFLICT (slug) DO UPDATE SET
  name             = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html        = EXCLUDED.body_html;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
