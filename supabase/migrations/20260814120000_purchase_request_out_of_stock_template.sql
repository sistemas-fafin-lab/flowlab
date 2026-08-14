-- ============================================================
-- Template de email — Solicitação de compra com produto sem estoque
-- (purchase_request_out_of_stock)
-- Enviado por api/notifications/purchase-out-of-stock quando uma solicitação
-- de compra (SC) inclui produto não cadastrado no estoque.
-- Variáveis: {{requester_name}}, {{request_date}}, {{reason}}, {{items_list}},
-- {{action_url}}
--   {{reason}} e {{items_list}} recebem HTML já renderizado em código
--   (renderTemplate só faz substituição simples de {{var}}). {{action_url}} é
--   fixo (hub de solicitações), gerado no servidor — nunca vem do client.
-- ============================================================

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'purchase_request_out_of_stock',
  'SC com produto sem estoque',
  '[FlowLAB] Nova SC com produto sem estoque — {{requester_name}}',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Solicitação de compra com produto sem estoque</title>
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
            <td align="center" style="background-color:#f59e0b;padding:32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;display:inline-table;">
                      <tr>
                        <td style="background-color:rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;vertical-align:middle;">
                          <span style="font-size:22px;line-height:1;color:#ffffff;">&#9888;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;font-family:''Segoe UI'',Arial,sans-serif;">Flow LAB</span>
                    <br />
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Compras &amp; Material</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ─── CORPO PRINCIPAL ─── -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">

              <!-- Badge de resumo -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fffbeb;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#b45309;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">NOVA SC &bull; {{request_date}}</span>
                  </td>
                </tr>
              </table>

              <!-- Título -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Produto sem estoque solicitado
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                <strong>{{requester_name}}</strong> criou uma solicitação de compra (SC) incluindo produto(s) não cadastrado(s) no estoque. Veja abaixo o que foi pedido:
              </p>

              <!-- Caixa de destaque com a lista -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 12px 0;font-size:11px;font-weight:600;color:#f59e0b;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">
                      Produtos sem estoque
                    </p>
                    <ul style="margin:0;padding-left:18px;font-size:15px;color:#374151;line-height:1.6;font-family:''Segoe UI'',Arial,sans-serif;">
                      {{items_list}}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Justificativa -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">
                <tr>
                  <td style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">
                      Justificativa
                    </p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;font-family:''Segoe UI'',Arial,sans-serif;">
                      {{reason}}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:#f59e0b;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="{{action_url}}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%"
                      fill="true" fillcolor="#f59e0b" strokecolor="#f59e0b">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;">
                        Ver Solicitações
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#f59e0b;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;mso-hide:all;">
                      Ver Solicitações &#8594;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Nota -->
              <p style="margin:28px 0 0 0;font-size:12px;color:#9ca3af;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.5;">
                Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br />
                <a href="{{action_url}}" style="color:#b45309;text-decoration:none;word-break:break-all;">{{action_url}}</a>
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
                      Para acompanhar a solicitação, acesse o módulo Compras / Material no portal Flow LAB.
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
