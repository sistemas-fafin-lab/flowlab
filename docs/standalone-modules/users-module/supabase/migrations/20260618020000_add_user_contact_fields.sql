-- Migration: campos de contato no perfil + template de boas-vindas
-- Created: 2026-06-18
--
-- Contexto: novo fluxo de cadastro de usuários operado por admin
-- (componente "Novo Usuário" no Gerenciamento de Usuários). Precisa armazenar
-- telefone e data de nascimento no perfil e enviar um e-mail de boas-vindas
-- com senha temporária, alias corporativo e link de convite do Slack.

-- 1. Novas colunas em user_profiles (preenchidas pelo backend via service-role)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS data_nascimento date;

-- 2. Template do e-mail de boas-vindas (renderizado via {{variavel}})
INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'welcome_new_user',
  'Boas-vindas / Novo Usuário',
  'Bem-vindo(a) ao FlowLab, {{name}}',
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
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Bem-vindo(a) ao FlowLab</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Sua conta foi criada com sucesso</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;">Olá <strong>{{name}}</strong>,</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                Seu acesso ao sistema FlowLab foi provisionado. Abaixo estão seus dados de primeiro acesso.
                Recomendamos alterar a senha temporária após o login.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Login (FlowLab)</p>
                  <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1e293b;">{{login_email}}</p>

                  <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">Senha temporária</p>
                  <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1e293b;font-family:Consolas,monospace;">{{temp_password}}</p>

                  <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#94a3b8;">E-mail corporativo</p>
                  <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">{{workspace_email}}</p>
                </td></tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                <tr><td align="center" style="border-radius:10px;background:#4a154b;">
                  <a href="{{slack_invite_url}}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                    Entrar no Slack
                  </a>
                </td></tr>
              </table>
              <p style="margin:8px 0 0;font-size:12px;text-align:center;color:#94a3b8;">
                Se o botão não funcionar, copie e cole este link: <br />{{slack_invite_url}}
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
