-- ============================================================
-- Migration: Sistema de Templates Dinâmicos de E-mail
-- Descrição: Cria a tabela notification_templates para armazenar
--            layouts de e-mail personalizados por módulo.
--            Insere o template inicial para chamados de TI.
-- Data: 2026-04-28
-- Fase: 1 - Estrutura base + Template IT
-- ============================================================


-- ============================================================
-- STEP 1: Criar tabela notification_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id               UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             VARCHAR(50)              NOT NULL UNIQUE,
  name             VARCHAR(100)             NOT NULL,
  subject_template TEXT                     NOT NULL,
  body_html        TEXT                     NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.notification_templates                  IS 'Templates de e-mail transacional por módulo. Suporta variáveis {{variavel}} no subject e body.';
COMMENT ON COLUMN public.notification_templates.slug             IS 'Identificador único de máquina, ex: it_ticket_update';
COMMENT ON COLUMN public.notification_templates.name             IS 'Nome amigável exibido na administração';
COMMENT ON COLUMN public.notification_templates.subject_template IS 'Assunto do e-mail com suporte a variáveis {{variavel}}';
COMMENT ON COLUMN public.notification_templates.body_html        IS 'Corpo HTML completo com CSS inline e variáveis {{variavel}}';


-- ============================================================
-- STEP 2: Índice de busca por slug
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_templates_slug
  ON public.notification_templates(slug);


-- ============================================================
-- STEP 3: Habilitar Row Level Security
-- ============================================================

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: Política de leitura — usuários autenticados
-- ============================================================

DROP POLICY IF EXISTS "notification_templates_authenticated_select" ON public.notification_templates;

CREATE POLICY "notification_templates_authenticated_select"
  ON public.notification_templates
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- STEP 5: Políticas de escrita — somente administradores
-- ============================================================

DROP POLICY IF EXISTS "notification_templates_admin_insert" ON public.notification_templates;
DROP POLICY IF EXISTS "notification_templates_admin_update" ON public.notification_templates;
DROP POLICY IF EXISTS "notification_templates_admin_delete" ON public.notification_templates;

CREATE POLICY "notification_templates_admin_insert"
  ON public.notification_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );

CREATE POLICY "notification_templates_admin_update"
  ON public.notification_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );

CREATE POLICY "notification_templates_admin_delete"
  ON public.notification_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );


-- ============================================================
-- STEP 6: Inserir template inicial — Atualização de Chamado TI
-- ============================================================

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'it_ticket_update',
  'Atualização de Chamado TI',
  'Atualização no Chamado {{ticket_code}}',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Atualização no Chamado {{ticket_code}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:''Segoe UI'',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Wrapper externo -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f7;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Container principal (máx. 600px) -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);border-collapse:collapse;">

          <!-- ─── CABEÇALHO ─── -->
          <tr>
            <td align="center" style="background-color:#8b5cf6;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <!-- Ícone decorativo -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;display:inline-table;">
                      <tr>
                        <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                          <span style="font-size:22px;line-height:1;">&#9881;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.75);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Suporte &amp; TI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── CORPO PRINCIPAL ─── -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">

              <!-- Badge do chamado -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f3f0ff;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#7c3aed;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">CHAMADO {{ticket_code}}</span>
                  </td>
                </tr>
              </table>

              <!-- Saudação -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Olá, {{user_name}}!
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                Seu chamado de suporte recebeu uma nova atualização. Veja os detalhes abaixo:
              </p>

              <!-- Caixa de destaque da mensagem -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">
                <tr>
                  <td style="background-color:#faf5ff;border-left:4px solid #8b5cf6;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#8b5cf6;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">
                      Mensagem da equipe
                    </p>
                    <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;font-family:''Segoe UI'',Arial,sans-serif;white-space:pre-line;">
                      {{ticket_message}}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#8b5cf6;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="{{action_url}}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%"
                      fill="true" fillcolor="#8b5cf6" strokecolor="#8b5cf6">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;">
                        Ver Chamado
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#8b5cf6;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;mso-hide:all;">
                      Ver Chamado &#8594;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Nota de segurança -->
              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#8b5cf6;text-decoration:none;word-break:break-all;">{{action_url}}</a>
              </p>

            </td>
          </tr>

          <!-- ─── DIVISOR ─── -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── RODAPÉ ─── -->
          <tr>
            <td style="padding:24px 40px 32px 40px;background-color:#fafafa;border-radius:0 0 12px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</p>
                    <p style="margin:0 0 12px 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                      Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                      Para abrir ou acompanhar chamados, acesse o portal Flow LAB.
                    </p>
                    <p style="margin:0;font-size:11px;color:#d1d5db;font-family:''Segoe UI'',Arial,sans-serif;">
                      &copy; 2026 Flow LAB &bull; Todos os direitos reservados
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Container principal -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper externo -->

</body>
</html>'
)
ON CONFLICT (slug) DO UPDATE
  SET
    name             = EXCLUDED.name,
    subject_template = EXCLUDED.subject_template,
    body_html        = EXCLUDED.body_html;
