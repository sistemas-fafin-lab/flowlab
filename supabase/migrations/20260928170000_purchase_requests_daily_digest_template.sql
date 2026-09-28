-- ============================================================
-- Template de email — Resumo diário de solicitações (SC/SM) para a Louise
-- (purchase_requests_daily_digest)
-- Enviado por api/_lib/handlers/notifications-requests-digest-cron.ts
-- (Vercel Cron, 17h BRT) para REQUESTS_DIGEST_EMAIL, quando há solicitação
-- nova nas últimas 24h ou pendente de dias anteriores.
-- Visual no padrão de quotation_pending_approval_digest.
-- Variáveis (montadas em api/_lib/requestsDailyDigest.ts, já escapadas):
--   {{subject}}, {{digest_date}}, {{notice_html}}, {{new_count}},
--   {{sc_count}}, {{sm_count}}, {{urgent_count}}, {{older_pending_count}},
--   {{new_list_html}}, {{action_url}}
-- {{notice_html}} é o aviso opcional no topo (vazio por padrão; a etapa do
-- WhatsApp preenche quando o e-mail sai como fallback).
-- ============================================================

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'purchase_requests_daily_digest',
  'Resumo diário de solicitações (SC/SM)',
  '{{subject}}',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Resumo diário de solicitações</title>
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
            <td align="center" style="background-color:#f97316;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;display:inline-table;">
                      <tr>
                        <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                          <span style="font-size:22px;line-height:1;color:#ffffff;">&#128203;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Estoque &amp; Solicitações</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── CORPO PRINCIPAL ─── -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">

              {{notice_html}}

              <!-- Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff7ed;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#c2410c;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">Resumo diário &bull; {{new_count}} nova(s) &bull; {{older_pending_count}} pendente(s) antiga(s)</span>
                  </td>
                </tr>
              </table>

              <!-- Título -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Resumo de solicitações de {{digest_date}}
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                Solicitações de compra (SC) e de material (SM) criadas nas últimas 24h e as que seguem pendentes de dias anteriores.
              </p>

              <!-- Contagens -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;font-size:14px;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Novas nas últimas 24h</td><td style="padding:4px 0;color:#1a1a2e;font-weight:600;">{{new_count}}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Solicitações de Compra (SC)</td><td style="padding:4px 0;color:#1a1a2e;font-weight:600;">{{sc_count}}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Solicitações de Material (SM)</td><td style="padding:4px 0;color:#1a1a2e;font-weight:600;">{{sm_count}}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Urgentes</td><td style="padding:4px 0;color:#b91c1c;font-weight:600;">{{urgent_count}}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Pendentes de dias anteriores</td><td style="padding:4px 0;color:#1a1a2e;font-weight:600;">{{older_pending_count}}</td></tr>
              </table>

              <!-- Novas -->
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Novas nas últimas 24h</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">
                <tr>
                  <td style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <ul style="margin:0;padding-left:18px;font-size:14px;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                      {{new_list_html}}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#f97316;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="{{action_url}}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%"
                      fill="true" fillcolor="#f97316" strokecolor="#f97316">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;">
                        Ver pendentes
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#f97316;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;mso-hide:all;">
                      Ver pendentes &#8594;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Nota -->
              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#c2410c;text-decoration:none;word-break:break-all;">{{action_url}}</a>
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
                      Este é um e-mail automático, enviado diariamente com o resumo das solicitações. Por favor, não responda diretamente a esta mensagem.<br />
                      Para acompanhar as solicitações, acesse o módulo Solicitações no portal Flow LAB.
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
