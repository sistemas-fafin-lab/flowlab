-- ═══════════════════════════════════════════════════════════════════════════════
-- UPGRADE DE PROD — Backlog pós-glosas_por_motivo (cotações, análises clínicas,
-- faturamento)
-- Arquivo: supabase/scripts/prod-upgrade-backlog-20260819.sql
-- Gerado em 2026-08-19
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- COMO RODAR: cole o arquivo INTEIRO no SQL Editor do Supabase (produção,
-- jqxeqmeikqclmmongclj) e execute de uma vez.
-- Roda em transação única — se qualquer trecho falhar, NADA é aplicado.
-- É idempotente: pode ser reexecutado sem efeito colateral (toda migration aqui
-- usa IF NOT EXISTS / DROP ... IF EXISTS / ON CONFLICT / CREATE OR REPLACE).
--
-- Verificado ao vivo contra o prod em 2026-08-19 (supabase_migrations.schema_migrations
-- + checagem direta de tabelas/colunas/funções) antes de montar este script:
--   • Última migration registrada em prod: 20260811130000 (glosas_por_motivo).
--   • 4 das 19 migrations abaixo já foram aplicadas manualmente em prod, SEM
--     registro na tabela de controle — incluídas aqui mesmo assim porque são
--     idempotentes e a Parte 6 registra a versão de todas as 19 ao final:
--       - 20260814120000 (template "sem estoque") — já existe; sua REMOÇÃO
--         (20260817130000, abaixo) ainda não tinha sido aplicada.
--       - 20260818131500 (restringir swab em culturas) — já aplicada.
--       - 20260818140000 (ac_tipos_frasco / ac_temperatura_frascos) — tabelas e
--         seed já existem.
--       - 20260819150000 (motivo de recoleta "falha de antissepsia") — já
--         aplicada.
--   • As demais 15 (incluindo as 2 de faturamento, codigo_requisicao) estão
--     genuinamente pendentes — conferido direto: colunas/função/constraint
--     ausentes em prod.
--   • Checagem de risco: a UNIQUE (quotation_id, level) nova em
--     quotation_approvals (§9) não tem violação hoje em prod (0 duplicatas).
--     Nenhuma instrução incompatível com transação única (sem CONCURRENTLY,
--     ADD VALUE de enum, VACUUM etc.) em nenhuma das 19.
--
-- Deixada de fora DE PROPÓSITO (pedido explícito, tratar depois):
--   - 20260701140000_fase5_controla_consumo_biomol
--
-- Migrations incluídas, na ordem (idênticas a supabase/migrations/):
--   [ 1] 20260814120000_purchase_request_out_of_stock_template
--   [ 2] 20260814130000_quotation_proposal_additional_costs
--   [ 3] 20260814140000_quotations_dual_type
--   [ 4] 20260817120000_quotation_awaiting_approval_template
--   [ 5] 20260817130000_remove_purchase_out_of_stock_template
--   [ 6] 20260817140000_quotation_awaiting_approval_template_detalhes
--   [ 7] 20260817150000_quotation_approval_signature
--   [ 8] 20260817160000_quotation_decision_atomic
--   [ 9] 20260817170000_quotation_decision_authorization
--   [10] 20260817180000_quotation_decision_verify_amount
--   [11] 20260817190000_quotation_decision_check_order
--   [12] 20260817200000_quotation_revert_atomic
--   [13] 20260818100000_quotation_real_amount_and_revert_checks
--   [14] 20260818131500_ac_culturas_restringir_swab
--   [15] 20260818140000_ac_tipos_frasco
--   [16] 20260819120000_ac_editar_temperatura
--   [17] 20260819130000_requisicoes_codigo_requisicao
--   [18] 20260819140000_fat_criar_titulo_codigo_requisicao
--   [19] 20260819150000_ac_recoletas_motivo_antissepsia
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260814120000_purchase_request_out_of_stock_template
-- ═══════════════════════════════════════════════════════════════════════════════

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


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260814130000_quotation_proposal_additional_costs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Persist proposal additional costs (freight, taxes, etc.), which were previously
-- only folded into total_amount and never stored separately.
ALTER TABLE quotation_proposals
  ADD COLUMN IF NOT EXISTS additional_costs JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260814140000_quotations_dual_type
-- ═══════════════════════════════════════════════════════════════════════════════

-- Migration: Quotations dual type (Compras / Contratação)
-- Description: Adds quotation_type and maintenance_request_id to quotations,
-- so a quotation can either follow the existing Compras flow (linked via
-- request_id to `requests`) or a new Contratação flow (linked via
-- maintenance_request_id to `maintenance_requests`).
-- Date: 2026-08-14

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS quotation_type VARCHAR(20) NOT NULL DEFAULT 'compras'
    CHECK (quotation_type IN ('compras', 'contratacao')),
  ADD COLUMN IF NOT EXISTS maintenance_request_id UUID
    REFERENCES maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations(quotation_type);
CREATE INDEX IF NOT EXISTS idx_quotations_maintenance_request
  ON quotations(maintenance_request_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817120000_quotation_awaiting_approval_template
-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- Template de email — Cotação aguardando aprovação
-- (quotation_awaiting_approval)
-- Enviado por src/modules/quotations/hooks/useQuotation.ts (submitForApproval)
-- quando uma cotação (Compras ou Contratação) entra em status
-- awaiting_approval, para todo gestor com alçada suficiente para o valor.
-- Variáveis: {{quotation_code}}, {{quotation_title}}, {{quotation_type_label}},
-- {{requester_name}}, {{total_amount}}, {{action_url}}
-- ============================================================

INSERT INTO public.notification_templates (slug, name, subject_template, body_html)
VALUES (
  'quotation_awaiting_approval',
  'Cotação aguardando aprovação',
  '[FlowLAB] Cotação {{quotation_code}} aguardando sua aprovação',
  '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Cotação aguardando aprovação</title>
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
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Compras &amp; Contratação</span>
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
                  <td style="background-color:#fff7ed;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#c2410c;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">{{quotation_type_label}} &bull; {{quotation_code}}</span>
                  </td>
                </tr>
              </table>

              <!-- Título -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Cotação aguardando sua aprovação
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                A cotação <strong>{{quotation_title}}</strong>, solicitada por <strong>{{requester_name}}</strong>, está aguardando aprovação e está dentro da sua alçada.
              </p>

              <!-- Caixa de destaque com o valor -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">
                <tr>
                  <td style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#c2410c;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">
                      Valor total
                    </p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;">
                      {{total_amount}}
                    </p>
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
                        Ver Cotação
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#f97316;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;mso-hide:all;">
                      Ver Cotação &#8594;
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
                      Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                      Para acompanhar a cotação, acesse o módulo Cotações no portal Flow LAB.
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


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817130000_remove_purchase_out_of_stock_template
-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- Remove o template purchase_request_out_of_stock
-- (criado em 20260814120000_purchase_request_out_of_stock_template.sql).
-- O alerta de "SC sem estoque" foi substituído pela notificação de alçada
-- (quotation_awaiting_approval, 20260817120000) — ver
-- .scratch/cotacoes/issues/09-remover-alerta-estoque.md.
-- notification_templates não tem coluna is_active; a remoção do registro é
-- suficiente já que nenhum código chama mais esse slug.
-- ============================================================

DELETE FROM public.notification_templates
WHERE slug = 'purchase_request_out_of_stock';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817140000_quotation_awaiting_approval_template_detalhes
-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================
-- Atualiza o template quotation_awaiting_approval para incluir o
-- fornecedor vencedor e a lista de itens da cotação, além do valor total.
-- Novas variáveis: {{supplier_name}}, {{items_list_html}}
-- (items_list_html já vem pronto como uma sequência de <li>...</li>,
-- montado em src/modules/quotations/notifications.ts)
-- ============================================================

UPDATE public.notification_templates
SET
  body_html = '<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Cotação aguardando aprovação</title>
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
                    <span style="font-size:12px;color:rgba(255,255,255,0.85);font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">Compras &amp; Contratação</span>
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
                  <td style="background-color:#fff7ed;border-radius:6px;padding:6px 14px;">
                    <span style="font-size:12px;font-weight:600;color:#c2410c;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.5px;">{{quotation_type_label}} &bull; {{quotation_code}}</span>
                  </td>
                </tr>
              </table>

              <!-- Título -->
              <p style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.3;">
                Cotação aguardando sua aprovação
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.6;">
                A cotação <strong>{{quotation_title}}</strong>, solicitada por <strong>{{requester_name}}</strong>, está aguardando aprovação e está dentro da sua alçada.
              </p>

              <!-- Fornecedor vencedor -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:16px;">
                <tr>
                  <td style="padding:0 0 4px 0;">
                    <span style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">Fornecedor selecionado</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span style="font-size:15px;font-weight:600;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;">{{supplier_name}}</span>
                  </td>
                </tr>
              </table>

              <!-- Itens da cotação -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="padding:0 0 6px 0;">
                    <span style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">Itens</span>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;">
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#374151;font-family:''Segoe UI'',Arial,sans-serif;line-height:1.7;">
                      {{items_list_html}}
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Caixa de destaque com o valor -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:32px;">
                <tr>
                  <td style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;color:#c2410c;letter-spacing:1px;text-transform:uppercase;font-family:''Segoe UI'',Arial,sans-serif;">
                      Valor total
                    </p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a2e;font-family:''Segoe UI'',Arial,sans-serif;">
                      {{total_amount}}
                    </p>
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
                        Ver Cotação
                      </center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{{action_url}}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#f97316;font-family:''Segoe UI'',Arial,sans-serif;letter-spacing:0.3px;mso-hide:all;">
                      Ver Cotação &#8594;
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
                      Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.<br />
                      Para acompanhar a cotação, acesse o módulo Cotações no portal Flow LAB.
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
WHERE slug = 'quotation_awaiting_approval';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817150000_quotation_approval_signature
-- ═══════════════════════════════════════════════════════════════════════════════

-- Adiciona assinatura eletrônica (hash) do aprovador em quotation_approvals.
-- A tabela já existia (20260219120000_expand_quotations_module.sql) mas nunca
-- era escrita pelo código; esta migration só acrescenta as colunas necessárias
-- para guardar o hash de verificação da aprovação e o cargo do aprovador no
-- momento da aprovação/rejeição.

ALTER TABLE quotation_approvals
  ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64);


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817160000_quotation_decision_atomic
-- ═══════════════════════════════════════════════════════════════════════════════

-- Torna atômicas a aprovação/rejeição de cotação.
--
-- Antes, o client fazia dois statements separados: UPDATE quotations SET
-- status primeiro, depois INSERT em quotation_approvals com o hash de
-- assinatura. Se o segundo passo falhasse (geração do hash, rede, RLS), a
-- cotação ficava travada como aprovada/rejeitada sem nenhum registro de
-- aprovação e sem hash — sem forma de desfazer pela UI. O lock FOR UPDATE
-- também fecha a corrida de duas aprovações simultâneas na mesma cotação.
CREATE OR REPLACE FUNCTION public.quotation_record_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status   TEXT;
  v_approval quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  SELECT status INTO v_status FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
  )
  RETURNING * INTO v_approval;

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação e grava o registro de aprovação num único statement atômico.';

REVOKE ALL ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817170000_quotation_decision_authorization
-- ═══════════════════════════════════════════════════════════════════════════════

-- Fecha duas lacunas em quotation_record_decision (20260817160000):
--
-- 1) Autorização: a função só exigia auth.uid() IS NOT NULL. Qualquer usuário
--    autenticado podia chamar a RPC direto (ex. devtools) com p_approver_id
--    de outra pessoa, aprovar acima da própria alçada, ou aprovar sem nunca
--    ter permissão de aprovador — toda a checagem vivia só em getPermissions()
--    no client. Passa a reusar get_user_approval_limit() (já existente, usada
--    pelo próprio getPermissions como fonte de verdade) para validar
--    server-side: aprovador é quem diz ser, tem can_approve=true, e — para
--    aprovação — o valor está dentro da alçada efetiva dele.
--
-- 2) Duplicidade: sem unique key em (quotation_id, level), um revert seguido
--    de nova decisão insere uma segunda linha para o mesmo nível em vez de
--    substituir a primeira. A timeline (ApprovalTimeline) e o PDF liam essas
--    linhas de formas diferentes (primeira vs. última), então passavam a
--    divergir sobre quem aprovou. Convertido em UPSERT: uma linha por
--    (quotation_id, level), sempre a decisão mais recente.
DELETE FROM quotation_approvals qa
WHERE qa.id NOT IN (
  SELECT DISTINCT ON (quotation_id, level) id
  FROM quotation_approvals
  ORDER BY quotation_id, level, created_at DESC, id DESC
);

ALTER TABLE quotation_approvals
  ADD CONSTRAINT quotation_approvals_quotation_level_unique UNIQUE (quotation_id, level);

CREATE OR REPLACE FUNCTION public.quotation_record_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      TEXT;
  v_can_approve BOOLEAN;
  v_max_amount  DECIMAL(15, 2);
  v_approval    quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'approved' AND p_max_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', p_max_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação e grava (upsert por quotation_id+level) o registro de aprovação num único statement atômico, validando alçada via get_user_approval_limit().';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817180000_quotation_decision_verify_amount
-- ═══════════════════════════════════════════════════════════════════════════════

-- quotation_record_decision (20260817170000) validava a alçada do aprovador
-- contra p_max_amount — um parâmetro que o próprio client envia. Um chamador
-- direto da RPC (fora da UI) podia mandar p_max_amount baixo o suficiente
-- para passar pela checagem de alçada e ainda assim aprovar/rejeitar uma
-- cotação de valor real muito maior; o valor "oficial" gravado em
-- quotation_approvals.max_amount vinha do mesmo parâmetro não verificado.
--
-- Agora a função busca o valor real da cotação (final_total_amount, com
-- fallback pra estimated_total — mesma regra de useQuotation.ts) e exige que
-- p_max_amount bata exatamente com ele. Divergir não vira "usa o valor real
-- calado": vira erro, porque o hash de assinatura já foi gerado no client
-- em cima do valor que ele mandou — se não bate com o valor atual da
-- cotação, o cache do client está desatualizado (alguém mudou o valor final
-- entre a tela carregar e o clique) e a aprovação não deve prosseguir com
-- um hash que não corresponde ao que está sendo persistido.
CREATE OR REPLACE FUNCTION public.quotation_record_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status         TEXT;
  v_final_total    DECIMAL(15, 2);
  v_estimated_total DECIMAL(15, 2);
  v_real_amount    DECIMAL(15, 2);
  v_can_approve    BOOLEAN;
  v_max_amount     DECIMAL(15, 2);
  v_approval       quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  SELECT status, final_total_amount, estimated_total
    INTO v_status, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  v_real_amount := COALESCE(v_final_total, v_estimated_total, 0);
  IF p_max_amount <> v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'approved' AND v_real_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', v_real_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), validando p_max_amount contra o valor real da cotação e a alçada via get_user_approval_limit().';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817190000_quotation_decision_check_order
-- ═══════════════════════════════════════════════════════════════════════════════

-- Reordena os checks de quotation_record_decision (20260817180000) e fecha
-- dois furos da validação de valor:
--
-- 1) Ordem de autorização: a versão anterior lia o status e o valor da
--    cotação ANTES de checar can_approve. Um chamador direto da RPC sem
--    alçada conseguia sondar o valor real da cotação lendo a mensagem de
--    erro "Valor informado (X) não corresponde ao valor atual (Y)" — o
--    próprio vazamento que a autorização existe para impedir. Agora a
--    checagem de alçada vem antes de qualquer leitura da cotação: quem não
--    pode aprovar/rejeitar só vê o erro de permissão, nunca o valor.
--
-- 2) Bypass de NULL: p_max_amount <> v_real_amount é NULL quando qualquer
--    um dos lados é NULL, e uma comparação NULL não levanta erro — um
--    chamador mandando p_max_amount NULL pulava a validação e gravava
--    max_amount NULL. Troca por IS DISTINCT FROM, que trata NULL como um
--    valor concreto (e um valor real NULL na cotação — estimated_total e
--    final_total_amount ambos vazios — passa a ser recusado em vez de
--    aceitar um p_max_amount qualquer).
--
-- A igualdade continua EXATA (sem tolerância de centavos): o hash de
-- assinatura é gerado no client sobre o valor que ele manda, então o valor
-- precisa bater bit a bit com o que será persistido. Drift de float do JS
-- não é um problema na prática porque o número atravessa o JSON como texto
-- decimal (ex. 99.99) e o Postgres o interpreta de volta como DECIMAL exato.
CREATE OR REPLACE FUNCTION public.quotation_record_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status          TEXT;
  v_final_total     DECIMAL(15, 2);
  v_estimated_total DECIMAL(15, 2);
  v_real_amount     DECIMAL(15, 2);
  v_can_approve     BOOLEAN;
  v_max_amount      DECIMAL(15, 2);
  v_approval        quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  -- Autorização ANTES de qualquer leitura da cotação: sem isso, a mensagem
  -- de erro da checagem de valor serviria de oráculo do valor real para
  -- quem não tem alçada.
  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  SELECT status, final_total_amount, estimated_total
    INTO v_status, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  v_real_amount := COALESCE(v_final_total, v_estimated_total, 0);
  IF p_max_amount IS DISTINCT FROM v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' AND v_real_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', v_real_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), autorizando por alçada antes de qualquer leitura da cotação e validando p_max_amount com IS DISTINCT FROM contra o valor real.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260817200000_quotation_revert_atomic
-- ═══════════════════════════════════════════════════════════════════════════════

-- Reverter uma cotação aprovada para awaiting_approval era feito no client em
-- dois statements separados: DELETE do registro de aprovação e UPDATE do
-- status. Se o UPDATE falhasse depois do DELETE (rede, RLS, constraint), a
-- cotação ficava aprovada sem registro de aprovação — a timeline e o PDF
-- passavam a divergir, exatamente a inconsistência que o DELETE existe para
-- evitar. Esta RPC junta os dois passos numa transação única: ou os dois
-- acontecem, ou nada acontece.
--
-- O DELETE é por (quotation_id, level): o nível vem do client, que sempre o
-- computa via getRequiredApprovalLevel — o mesmo valor usado como chave do
-- upsert em quotation_record_decision. Apagar só o nível revertido preserva
-- o histórico de decisões de outros níveis, espelhando o filtro que o client
-- aplica no estado local (approvals.filter(a => a.level !== requiredLevel)).
--
-- Autorização: exige apenas usuário autenticado, em paridade com o estado
-- atual do RLS de quotations/quotation_approvals (acesso amplo a usuários
-- autenticados). A checagem de quem pode reverter continua no client
-- (permissions.canRevert); endurecer o revert server-side é trabalho
-- separado, não parte deste fix.
CREATE OR REPLACE FUNCTION public.quotation_revert_from_approved(
  p_quotation_id UUID,
  p_level        VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT status
    INTO v_status
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Cotação não está aprovada (status atual: %).', v_status;
  END IF;

  DELETE FROM quotation_approvals
   WHERE quotation_id = p_quotation_id
     AND level = p_level;

  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_quotation_id;
END;
$$;

COMMENT ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR)
  IS 'Reverte uma cotação aprovada para awaiting_approval, apagando o registro de aprovação do nível e voltando o status na mesma transação.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260818100000_quotation_real_amount_and_revert_checks
-- ═══════════════════════════════════════════════════════════════════════════════

-- Fecha os achados do code-review sobre o valor validado na decisão de
-- aprovação e sobre o revert:
--
-- 1) "Mesma regra de useQuotation.ts" (header da 20260817180000) era falsa:
--    o client preferia selected_price (useQuotation.ts:223) e o SQL ignorava
--    o campo. Linhas legacy do fluxo antigo (selectQuotationWinner em
--    useInventory.ts) gravam só selected_price, com final_total_amount NULL
--    — o client mandava o preço negociado como p_max_amount, a RPC validava
--    contra COALESCE(NULL, estimated_total, 0) e a decisão falhava com 22023
--    sem culpa do usuário. A regra do valor real passa a
--    COALESCE(selected_price, final_total_amount, estimated_total, 0) nos
--    dois lados (o client agora espelha a mesma expressão em
--    getQuotationAmountFromRow).
--
-- 2) quotation_revert_from_approved (20260817200000) apagava por
--    (quotation_id, p_level) sem verificar o registro que apagava: se o
--    nível divergiu (o valor da cotação mudou depois da aprovação e o
--    client calculou outro requiredApprovalLevel), o DELETE não encontrava
--    nada e o revert seguia em frente, deixando a aprovação stale para
--    trás — exatamente a divergência que o fix existe para impedir. A RPC
--    passa a exigir que exista uma aprovação (status approved) no nível
--    informado; do contrário, levanta erro em vez de silenciar.
--
-- De quebra, as duas funções ganham REVOKE FROM PUBLIC + GRANT TO
-- authenticated (padrão estabelecido na 20260817160000, linhas 67-68):
-- não há motivo para EXECUTE público numa função SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.quotation_record_decision(
  p_quotation_id   UUID,
  p_decision       VARCHAR(20),
  p_level          VARCHAR(20),
  p_approver_id    UUID,
  p_approver_name  VARCHAR(255),
  p_approver_role  VARCHAR(50),
  p_max_amount     DECIMAL(15, 2),
  p_comment        TEXT,
  p_decided_at     TIMESTAMPTZ,
  p_signature_hash VARCHAR(64)
)
RETURNS quotation_approvals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status           TEXT;
  v_selected_price   DECIMAL(15, 2);
  v_final_total      DECIMAL(15, 2);
  v_estimated_total  DECIMAL(15, 2);
  v_real_amount      DECIMAL(15, 2);
  v_can_approve      BOOLEAN;
  v_max_amount       DECIMAL(15, 2);
  v_approval         quotation_approvals;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_approver_id <> auth.uid() THEN
    RAISE EXCEPTION 'p_approver_id não corresponde ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida: %.', p_decision;
  END IF;

  -- Autorização ANTES de qualquer leitura da cotação: sem isso, a mensagem
  -- de erro da checagem de valor serviria de oráculo do valor real para
  -- quem não tem alçada.
  SELECT can_approve, max_amount INTO v_can_approve, v_max_amount
    FROM get_user_approval_limit(auth.uid())
   LIMIT 1;

  IF NOT COALESCE(v_can_approve, FALSE) THEN
    RAISE EXCEPTION 'Usuário sem permissão para aprovar/rejeitar cotações.' USING ERRCODE = '42501';
  END IF;

  SELECT status, selected_price, final_total_amount, estimated_total
    INTO v_status, v_selected_price, v_final_total, v_estimated_total
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Cotação não está aguardando aprovação (status atual: %).', v_status;
  END IF;

  v_real_amount := COALESCE(v_selected_price, v_final_total, v_estimated_total, 0);
  IF p_max_amount IS DISTINCT FROM v_real_amount THEN
    RAISE EXCEPTION 'Valor informado (%) não corresponde ao valor atual da cotação (%). Atualize a página e tente novamente.',
      p_max_amount, v_real_amount USING ERRCODE = '22023';
  END IF;

  IF p_decision = 'approved' AND v_real_amount > COALESCE(v_max_amount, 0) THEN
    RAISE EXCEPTION 'Valor % excede a alçada de aprovação do usuário (%).', v_real_amount, v_max_amount
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO quotation_approvals (
    quotation_id, level, approver_id, approver_name, approver_role,
    status, max_amount, comment, approved_at, rejected_at, signature_hash
  ) VALUES (
    p_quotation_id, p_level, p_approver_id, p_approver_name, p_approver_role,
    p_decision, p_max_amount, p_comment,
    CASE WHEN p_decision = 'approved' THEN p_decided_at END,
    CASE WHEN p_decision = 'rejected' THEN p_decided_at END,
    p_signature_hash
  )
  ON CONFLICT (quotation_id, level) DO UPDATE SET
    approver_id    = EXCLUDED.approver_id,
    approver_name  = EXCLUDED.approver_name,
    approver_role  = EXCLUDED.approver_role,
    status         = EXCLUDED.status,
    max_amount     = EXCLUDED.max_amount,
    comment        = EXCLUDED.comment,
    approved_at    = EXCLUDED.approved_at,
    rejected_at    = EXCLUDED.rejected_at,
    signature_hash = EXCLUDED.signature_hash
  RETURNING * INTO v_approval;

  UPDATE quotations SET status = p_decision WHERE id = p_quotation_id;

  RETURN v_approval;
END;
$$;

COMMENT ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR)
  IS 'Aprova ou rejeita uma cotação (upsert por quotation_id+level), autorizando por alçada antes de qualquer leitura e validando p_max_amount com IS DISTINCT FROM contra o valor real COALESCE(selected_price, final_total_amount, estimated_total, 0).';

CREATE OR REPLACE FUNCTION public.quotation_revert_from_approved(
  p_quotation_id UUID,
  p_level        VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status          TEXT;
  v_approval_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT status
    INTO v_status
    FROM quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Cotação não está aprovada (status atual: %).', v_status;
  END IF;

  -- A linha que será apagada precisa existir e ser a decisão que aprovou a
  -- cotação: se o nível divergiu (valor mudou depois da aprovação e o
  -- client calculou outro requiredApprovalLevel), não há registro
  -- "approved" no nível informado e o DELETE não encontraria nada — o
  -- revert prosseguiria deixando a aprovação stale para trás, a divergência
  -- que este fix existe para impedir. Registros de outro nível (ex.:
  -- histórico de uma rejeição anterior) são história legítima e permanecem,
  -- espelhando o filtro que o client aplica no estado local.
  SELECT EXISTS (
    SELECT 1
      FROM quotation_approvals
     WHERE quotation_id = p_quotation_id
       AND level = p_level
       AND status = 'approved'
  ) INTO v_approval_exists;

  IF NOT v_approval_exists THEN
    RAISE EXCEPTION 'Nenhuma aprovação registrada no nível % para esta cotação. Atualize a página e tente novamente.', p_level;
  END IF;

  DELETE FROM quotation_approvals
   WHERE quotation_id = p_quotation_id
     AND level = p_level;

  UPDATE quotations SET status = 'awaiting_approval' WHERE id = p_quotation_id;
END;
$$;

COMMENT ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR)
  IS 'Reverte uma cotação aprovada para awaiting_approval, apagando o registro de aprovação do nível (verificado antes do DELETE) e voltando o status na mesma transação.';

REVOKE ALL ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_record_decision(UUID, VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, DECIMAL, TEXT, TIMESTAMPTZ, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_revert_from_approved(UUID, VARCHAR) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260818131500_ac_culturas_restringir_swab
-- ═══════════════════════════════════════════════════════════════════════════════

-- Restringe o fluxo de Culturas (ac_culturas) a exatamente 3 tipos SWAB:
-- Streptococcus Grupo B, Fungos + Antifungigrama e Cultura + Antibiograma
-- (genérica). Os demais exames hoje marcados is_cultura = true (urina/fezes/
-- variantes) saem do fluxo de Culturas, mas continuam ativos e solicitáveis
-- no catálogo geral — não são desativados. Histórico de ac_culturas (snapshot
-- via exame_nome) permanece intacto.
UPDATE ac_exames
SET is_cultura = false
WHERE nome IN (
  'COPROCULTURA',
  'COPROCULTURA-FEZES',
  'CULTURA BACTERIANA (EM DIVERSOS MATERIAIS BIOLÓGICOS)',
  'CULTURA, URINA COM CONTAGEM DE COLÔNIAS',
  'UROCULTURA COM ANTIBIOGRAMA'
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260818140000_ac_tipos_frasco
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- Temperatura — catálogo de tipos de frasco + contagem por leitura
--
--   • ac_tipos_frasco — catálogo gerenciável (Urina, Fezes, ...); desativação via
--                       `ativo = false`, nunca DELETE físico.
--   • ac_temperatura_frascos — quantidade de cada tipo de frasco transportada numa
--                       leitura de ac_temperaturas (0..N por leitura, opcional).
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com o resto do módulo. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. ac_tipos_frasco ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_tipos_frasco (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ac_tipos_frasco_updated_at ON ac_tipos_frasco;
CREATE TRIGGER trg_ac_tipos_frasco_updated_at
  BEFORE UPDATE ON ac_tipos_frasco
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- Seed inicial — só na criação da tabela (evita reinserir em reruns da migration).
INSERT INTO ac_tipos_frasco (nome)
SELECT * FROM (VALUES ('Urina'), ('Fezes')) AS seed(nome)
WHERE NOT EXISTS (SELECT 1 FROM ac_tipos_frasco);

-- ─── 2. ac_temperatura_frascos (contagem por leitura) ────────────────────────
-- ON DELETE RESTRICT em tipo_frasco_id: impede apagar fisicamente um tipo já
-- usado numa leitura — desativar é sempre via ac_tipos_frasco.ativo = false.
CREATE TABLE IF NOT EXISTS ac_temperatura_frascos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temperatura_id  uuid NOT NULL REFERENCES ac_temperaturas(id) ON DELETE CASCADE,
  tipo_frasco_id  uuid NOT NULL REFERENCES ac_tipos_frasco(id) ON DELETE RESTRICT,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temperatura_id, tipo_frasco_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_temperatura_frascos_temp ON ac_temperatura_frascos(temperatura_id);

-- ─── 3. RLS — permissiva por authenticated (gate real = frontend) ────────────
ALTER TABLE ac_tipos_frasco ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_temperatura_frascos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_tipos_frasco_select_all"  ON ac_tipos_frasco;
DROP POLICY IF EXISTS "ac_tipos_frasco_insert_auth" ON ac_tipos_frasco;
DROP POLICY IF EXISTS "ac_tipos_frasco_update_auth" ON ac_tipos_frasco;
CREATE POLICY "ac_tipos_frasco_select_all"  ON ac_tipos_frasco FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_tipos_frasco_insert_auth" ON ac_tipos_frasco FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_tipos_frasco_update_auth" ON ac_tipos_frasco FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Mesmo grau de permissividade de ac_temperaturas: log associado à leitura, sem
-- UPDATE (a leitura não se corrige, se refaz); DELETE liberado para permitir
-- corrigir um registro errado logo após o cadastro.
DROP POLICY IF EXISTS "ac_temperatura_frascos_select_all"  ON ac_temperatura_frascos;
DROP POLICY IF EXISTS "ac_temperatura_frascos_insert_auth" ON ac_temperatura_frascos;
DROP POLICY IF EXISTS "ac_temperatura_frascos_delete_auth" ON ac_temperatura_frascos;
CREATE POLICY "ac_temperatura_frascos_select_all"  ON ac_temperatura_frascos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_temperatura_frascos_insert_auth" ON ac_temperatura_frascos FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_temperatura_frascos_delete_auth" ON ac_temperatura_frascos FOR DELETE TO authenticated USING (TRUE);

-- ─── 4. ac_registrar_temperatura — leitura + frascos numa transação só ───────
-- Insere a leitura e, se houver frascos, as linhas filhas correspondentes numa
-- única invocação: se alguma quantidade for inválida a função inteira reverte
-- (nenhum INSERT desta chamada fica de pé), evitando leitura órfã sem frascos.
DROP FUNCTION IF EXISTS ac_registrar_temperatura(uuid, numeric, text, text, timestamptz, jsonb);
CREATE OR REPLACE FUNCTION ac_registrar_temperatura(
  p_equipamento_id uuid,
  p_temperatura    numeric,
  p_registrado_por text,
  p_observacao     text,
  p_registrado_em  timestamptz,
  p_frascos        jsonb DEFAULT '[]'  -- [{ tipo_frasco_id, quantidade }, ...]
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_temperatura_id uuid;
  item jsonb;
  v_tipo_id uuid;
  v_qtd int;
BEGIN
  INSERT INTO ac_temperaturas (equipamento_id, temperatura, registrado_por, observacao, registrado_em)
  VALUES (p_equipamento_id, p_temperatura, p_registrado_por, NULLIF(p_observacao, ''), p_registrado_em)
  RETURNING id INTO v_temperatura_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_frascos, '[]'::jsonb))
  LOOP
    v_tipo_id := (item->>'tipo_frasco_id')::uuid;
    v_qtd := (item->>'quantidade')::int;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    INSERT INTO ac_temperatura_frascos (temperatura_id, tipo_frasco_id, quantidade)
    VALUES (v_temperatura_id, v_tipo_id, v_qtd);
  END LOOP;

  RETURN v_temperatura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ac_registrar_temperatura(uuid, numeric, text, text, timestamptz, jsonb) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260819120000_ac_editar_temperatura
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- Temperatura — edição de leitura
--
--   • ac_temperaturas deixa de ser append-only: política de UPDATE para
--     authenticated. A trigger ac_temperatura_set_fora_faixa já dispara em
--     UPDATE OF temperatura/equipamento_id e recalcula o valor derivado.
--   • ac_editar_temperatura — atualiza a leitura e substitui os frascos
--     (DELETE + INSERT) numa transação só, no mesmo espírito de
--     ac_registrar_temperatura: frasco inválido ou leitura inexistente
--     reverte tudo, sem leitura meio-atualizada.
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com o resto do módulo. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. UPDATE liberado em ac_temperaturas ────────────────────────────────────
DROP POLICY IF EXISTS "ac_temperaturas_update_auth" ON ac_temperaturas;
CREATE POLICY "ac_temperaturas_update_auth"
  ON ac_temperaturas FOR UPDATE TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- ─── 2. ac_editar_temperatura — leitura + frascos numa transação só ──────────
-- Atualiza a leitura (a trigger recalcula fora_faixa) e reescreve os frascos:
-- os filhos antigos são removidos e os novos inseridos a partir do jsonb.
DROP FUNCTION IF EXISTS ac_editar_temperatura(uuid, numeric, text, text, timestamptz, jsonb);
CREATE OR REPLACE FUNCTION ac_editar_temperatura(
  p_temperatura_id uuid,
  p_temperatura    numeric,
  p_registrado_por text,
  p_observacao     text,
  p_registrado_em  timestamptz,
  p_frascos        jsonb DEFAULT '[]'  -- [{ tipo_frasco_id, quantidade }, ...]
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
  v_tipo_id uuid;
  v_qtd int;
BEGIN
  UPDATE ac_temperaturas
     SET temperatura    = p_temperatura,
         registrado_por = p_registrado_por,
         observacao     = NULLIF(p_observacao, ''),
         registrado_em  = p_registrado_em
   WHERE id = p_temperatura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leitura % não encontrada', p_temperatura_id;
  END IF;

  DELETE FROM ac_temperatura_frascos WHERE temperatura_id = p_temperatura_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_frascos, '[]'::jsonb))
  LOOP
    v_tipo_id := (item->>'tipo_frasco_id')::uuid;
    -- Exige inteiro positivo explícito: o cast ::int arredondaria '2.5' para 3
    -- silenciosamente, e a leitura inteira deve reverter em frasco inválido.
    IF item->>'quantidade' IS NULL OR item->>'quantidade' !~ '^\d+$' THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    v_qtd := (item->>'quantidade')::int;
    IF v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    INSERT INTO ac_temperatura_frascos (temperatura_id, tipo_frasco_id, quantidade)
    VALUES (p_temperatura_id, v_tipo_id, v_qtd);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION ac_editar_temperatura(uuid, numeric, text, text, timestamptz, jsonb) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260819130000_requisicoes_codigo_requisicao
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- requisicoes.codigo_requisicao — CodRequisicao do apLIS
-- Migration: 20260819130000_requisicoes_codigo_requisicao.sql
--
-- fat_criar_titulo já recebe req.codRequisicao do handler (só usado hoje como
-- fallback de numero_guia) mas nunca o persistia como campo próprio. Sem ele, o
-- operador não consegue ir do título até a requisição no apLIS sem abrir outro
-- sistema. NULLABLE: títulos criados antes desta migration não têm o dado — a
-- UI mostra "indisponível" em vez de quebrar.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE requisicoes ADD COLUMN IF NOT EXISTS codigo_requisicao TEXT;

COMMENT ON COLUMN requisicoes.codigo_requisicao IS 'CodRequisicao do apLIS — identifica a requisição no sistema de origem, independente de ter guia de convênio. NULL em títulos criados antes desta coluna existir.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260819140000_fat_criar_titulo_codigo_requisicao
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- fat_criar_titulo — passa a persistir requisicoes.codigo_requisicao
-- Migration: 20260819140000_fat_criar_titulo_codigo_requisicao.sql
--
-- Depende de 20260819130000_requisicoes_codigo_requisicao.sql (coluna) e de
-- 20260810140000_revisao_contas_receber_baixa_severidade.sql (versão vigente da
-- função, com a dedup de lotes por aplisId — reconstruída aqui, não descartada).
--
-- O handler (api/_lib/handlers/faturamento-titulo-criar.ts) já manda
-- `codigoRequisicao` como campo próprio da requisição desde essa mudança; a RPC
-- só precisa parar de descartá-lo. CREATE OR REPLACE inteiro porque não dá para
-- alterar só um INSERT dentro do corpo de uma function.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fat_criar_titulo(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operadora_id UUID;
  v_nota_id      UUID;
  v_lote_id      UUID;
  v_aplis_lote   TEXT;
  v_total        DECIMAL(15, 2) := 0;
  v_lotes_dedup  JSONB;
  v_lote         JSONB;
  v_req          JSONB;
  v_conflito     TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF p IS NULL OR jsonb_array_length(COALESCE(p->'lotes', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um lote para criar o título.';
  END IF;
  IF COALESCE(NULLIF(p->>'numeroNota', ''), '') = '' THEN
    RAISE EXCEPTION 'Número da nota é obrigatório.';
  END IF;

  -- Um aplisId repetido no array vira um lote só a partir daqui: soma, checagem
  -- de duplicidade e snapshot leem sempre a mesma lista deduplicada.
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_lotes_dedup
    FROM (
      SELECT DISTINCT ON (item->>'aplisId') item
        FROM jsonb_array_elements(p->'lotes') AS item
       ORDER BY item->>'aplisId'
    ) d;

  -- ─── Operadora ──────────────────────────────────────────────────────────────
  INSERT INTO operadoras (nome, cnpj, aplis_id)
  VALUES (COALESCE(NULLIF(p#>>'{operadora,nome}', ''), 'Operadora sem nome'),
          NULLIF(p#>>'{operadora,cnpj}', ''),
          NULLIF(p#>>'{operadora,aplisId}', ''))
  ON CONFLICT (aplis_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        cnpj = COALESCE(EXCLUDED.cnpj, operadoras.cnpj)
  RETURNING id_operadora INTO v_operadora_id;

  -- ─── Recusa lote já faturado ────────────────────────────────────────────────
  SELECT string_agg(DISTINCT l.aplis_id, ', ')
    INTO v_conflito
    FROM jsonb_array_elements(v_lotes_dedup) AS item
    JOIN lotes l ON l.aplis_id = item->>'aplisId'
    JOIN nota_lote nl ON nl.id_lote = l.id_lote
    JOIN notas n ON n.id_nota = nl.id_nota
   WHERE n.status <> 'cancelada';

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) % já pertencem a um título ativo.', v_conflito;
  END IF;

  -- ─── Título ─────────────────────────────────────────────────────────────────
  SELECT COALESCE(SUM((item->>'valorTotal')::DECIMAL(15, 2)), 0)
    INTO v_total
    FROM jsonb_array_elements(v_lotes_dedup) AS item;

  INSERT INTO notas (operadora_id, numero_nota, data_emissao, data_vencimento,
                     valor_total, competencia, observacoes, criado_por)
  VALUES (v_operadora_id,
          p->>'numeroNota',
          COALESCE(NULLIF(p->>'dataEmissao', '')::DATE, CURRENT_DATE),
          NULLIF(p->>'dataVencimento', '')::DATE,
          v_total,
          NULLIF(p->>'competencia', ''),
          NULLIF(p->>'observacoes', ''),
          auth.uid())
  RETURNING id_nota INTO v_nota_id;

  -- ─── Snapshot dos lotes e das guias ─────────────────────────────────────────
  FOR v_lote IN SELECT * FROM jsonb_array_elements(v_lotes_dedup)
  LOOP
    v_aplis_lote := v_lote->>'aplisId';

    INSERT INTO lotes (operadora_id, codigo_lote, data_criacao, data_envio,
                       status, status_aplis, protocolo, nfe_numero, numero_rps,
                       data_vencimento_rps, valor_total, qtd_requisicoes,
                       aplis_id, data_snapshot)
    VALUES (v_operadora_id,
            COALESCE(NULLIF(v_lote->>'codigoLote', ''), v_aplis_lote),
            COALESCE(NULLIF(v_lote->>'dataCriacao', '')::DATE, CURRENT_DATE),
            NULLIF(v_lote->>'dataEnvio', '')::DATE,
            COALESCE(NULLIF(v_lote->>'statusLabel', ''), 'Faturado'),
            NULLIF(v_lote->>'statusAplis', '')::SMALLINT,
            NULLIF(v_lote->>'protocolo', ''),
            NULLIF(v_lote->>'nfeNumero', ''),
            NULLIF(v_lote->>'numeroRps', '')::INTEGER,
            NULLIF(v_lote->>'dataVencimentoRps', '')::DATE,
            COALESCE((v_lote->>'valorTotal')::DECIMAL(15, 2), 0),
            COALESCE((v_lote->>'qtdRequisicoes')::INTEGER, 0),
            v_aplis_lote,
            NOW())
    ON CONFLICT (aplis_id) DO UPDATE
      SET operadora_id        = EXCLUDED.operadora_id,
          codigo_lote         = EXCLUDED.codigo_lote,
          data_criacao        = EXCLUDED.data_criacao,
          data_envio          = EXCLUDED.data_envio,
          status              = EXCLUDED.status,
          status_aplis        = EXCLUDED.status_aplis,
          protocolo           = EXCLUDED.protocolo,
          nfe_numero          = EXCLUDED.nfe_numero,
          numero_rps          = EXCLUDED.numero_rps,
          data_vencimento_rps = EXCLUDED.data_vencimento_rps,
          valor_total         = EXCLUDED.valor_total,
          qtd_requisicoes     = EXCLUDED.qtd_requisicoes,
          data_snapshot       = NOW()
    RETURNING id_lote INTO v_lote_id;

    FOR v_req IN SELECT * FROM jsonb_array_elements(COALESCE(v_lote->'requisicoes', '[]'::jsonb))
    LOOP
      -- codigo_requisicao usa COALESCE(novo, existente) no upsert, como cnpj em
      -- operadoras acima: um re-sync sem CodRequisicao (apLIS devolveu vazio)
      -- não pode apagar um valor já conhecido.
      INSERT INTO requisicoes (lote_id, numero_guia, codigo_requisicao, data_criacao,
                               data_execucao, valor, status, paciente_nome,
                               procedimento_codigo, procedimento_descricao, aplis_id)
      VALUES (v_lote_id,
              COALESCE(NULLIF(v_req->>'numeroGuia', ''), 'sem-guia'),
              NULLIF(v_req->>'codigoRequisicao', ''),
              COALESCE(NULLIF(v_req->>'dataCriacao', '')::DATE, CURRENT_DATE),
              NULLIF(v_req->>'dataExecucao', '')::DATE,
              COALESCE((v_req->>'valor')::DECIMAL(15, 2), 0),
              'faturada',
              NULLIF(v_req->>'pacienteNome', ''),
              NULLIF(v_req->>'procedimentoCodigo', ''),
              NULLIF(v_req->>'procedimentoDescricao', ''),
              NULLIF(v_req->>'aplisId', ''))
      ON CONFLICT (aplis_id) DO UPDATE
        SET lote_id                = EXCLUDED.lote_id,
            numero_guia            = EXCLUDED.numero_guia,
            codigo_requisicao      = COALESCE(EXCLUDED.codigo_requisicao, requisicoes.codigo_requisicao),
            data_criacao           = EXCLUDED.data_criacao,
            data_execucao          = EXCLUDED.data_execucao,
            valor                  = EXCLUDED.valor,
            status                 = EXCLUDED.status,
            paciente_nome          = EXCLUDED.paciente_nome,
            procedimento_codigo    = EXCLUDED.procedimento_codigo,
            procedimento_descricao = EXCLUDED.procedimento_descricao;
    END LOOP;

    INSERT INTO nota_lote (id_nota, id_lote) VALUES (v_nota_id, v_lote_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_nota_id;
END;
$$;

COMMENT ON FUNCTION public.fat_criar_titulo(JSONB) IS 'Cria um título a receber agrupando lotes do apLIS, com snapshot de lotes e guias (inclui codigo_requisicao). Atômica. Deduplica lotes por aplisId.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260819150000_ac_recoletas_motivo_antissepsia
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- Recoletas — novo motivo: "Provável falha de antissepsia"
--
-- Amplia o CHECK de ac_recoletas.motivo para aceitar 'falha_antissepsia'
-- (superset dos valores já em uso — nenhum fluxo atual muda). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove o CHECK atual do motivo, localizado pela definição ('hemolise' só
-- aparece nele — o outro CHECK da tabela é o de status), em vez de confiar no
-- nome automático (ac_recoletas_motivo_check, com possível sufixo numérico).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.ac_recoletas'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%hemolise%'
  LOOP
    EXECUTE format('ALTER TABLE public.ac_recoletas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE ac_recoletas
  ADD CONSTRAINT ac_recoletas_motivo_check
  CHECK (motivo IN (
    'hemolise','estabilidade','recipiente_inadequado',
    'amostra_insuficiente','confirmacao_resultados','amostra_extraviada',
    'falha_antissepsia'));


-- ╔══ Registro das versões aplicadas (bookkeeping, opcional e seguro) ══╗
-- Se o schema de tracking da CLI existir em prod, registra as 19 versões para
-- futuras comparações (inclusive as 4 que já estavam aplicadas manualmente,
-- que até agora não tinham registro nenhum).
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260814120000'), ('20260814130000'), ('20260814140000'),
           ('20260817120000'), ('20260817130000'), ('20260817140000'),
           ('20260817150000'), ('20260817160000'), ('20260817170000'),
           ('20260817180000'), ('20260817190000'), ('20260817200000'),
           ('20260818100000'), ('20260818131500'), ('20260818140000'),
           ('20260819120000'), ('20260819130000'), ('20260819140000'),
           ('20260819150000')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA FINAL (não altera nada; devolve um checklist)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT * FROM (
  SELECT '1. faturamento' AS bloco, 'requisicoes.codigo_requisicao existe' AS item,
         (EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='requisicoes' AND column_name='codigo_requisicao'))::text AS ok

  UNION ALL
  SELECT '1. faturamento', 'fat_criar_titulo grava codigo_requisicao',
         (((SELECT prosrc FROM pg_proc WHERE proname='fat_criar_titulo') ILIKE '%codigo_requisicao%'))::text

  UNION ALL
  SELECT '2. cotações', 'quotations.quotation_type existe',
         (EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='quotations' AND column_name='quotation_type'))::text

  UNION ALL
  SELECT '2. cotações', 'quotation_proposals.additional_costs existe',
         (EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='quotation_proposals' AND column_name='additional_costs'))::text

  UNION ALL
  SELECT '2. cotações', 'quotation_approvals.signature_hash existe',
         (EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='quotation_approvals' AND column_name='signature_hash'))::text

  UNION ALL
  SELECT '2. cotações', 'constraint quotation_level_unique existe',
         (EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname='quotation_approvals_quotation_level_unique'))::text

  UNION ALL
  SELECT '2. cotações', 'quotation_record_decision existe',
         (EXISTS (SELECT 1 FROM pg_proc WHERE proname='quotation_record_decision'))::text

  UNION ALL
  SELECT '2. cotações', 'quotation_revert_from_approved existe',
         (EXISTS (SELECT 1 FROM pg_proc WHERE proname='quotation_revert_from_approved'))::text

  UNION ALL
  SELECT '2. cotações', 'template purchase_request_out_of_stock foi removido',
         (NOT EXISTS (SELECT 1 FROM notification_templates
                        WHERE slug='purchase_request_out_of_stock'))::text

  UNION ALL
  SELECT '2. cotações', 'template quotation_awaiting_approval existe',
         (EXISTS (SELECT 1 FROM notification_templates
                   WHERE slug='quotation_awaiting_approval'))::text

  UNION ALL
  SELECT '3. análises clínicas', 'ac_editar_temperatura existe',
         (EXISTS (SELECT 1 FROM pg_proc WHERE proname='ac_editar_temperatura'))::text

  UNION ALL
  SELECT '3. análises clínicas', 'ac_tipos_frasco tem linhas',
         (EXISTS (SELECT 1 FROM ac_tipos_frasco))::text

  UNION ALL
  SELECT '3. análises clínicas', 'ac_recoletas aceita falha_antissepsia',
         ((SELECT pg_get_constraintdef(oid) FROM pg_constraint
            WHERE conrelid='public.ac_recoletas'::regclass AND contype='c'
              AND pg_get_constraintdef(oid) ILIKE '%hemolise%') ILIKE '%falha_antissepsia%')::text

  UNION ALL
  SELECT '4. bookkeeping', 'versões registradas nesta rodada',
         (SELECT count(*)::text FROM supabase_migrations.schema_migrations
           WHERE version IN ('20260814120000','20260814130000','20260814140000',
                              '20260817120000','20260817130000','20260817140000',
                              '20260817150000','20260817160000','20260817170000',
                              '20260817180000','20260817190000','20260817200000',
                              '20260818100000','20260818131500','20260818140000',
                              '20260819120000','20260819130000','20260819140000',
                              '20260819150000'))
) checklist
ORDER BY bloco, item;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Toda linha de "1/2/3" precisa estar 'true'; a de "4. bookkeeping" precisa ser 19.
-- ═══════════════════════════════════════════════════════════════════════════════
