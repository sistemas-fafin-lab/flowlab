-- Messaging System - Initial Data Seed
-- Description: Seeds default provider and templates for messaging system
-- Date: 2026-02-19

-- ============================================
-- INSERT DEFAULT WA-HA PROVIDER
-- ============================================

-- Note: Update apiUrl and apiKey with your actual WA-HA configuration
INSERT INTO messaging_providers (code, name, type, config, is_active, health_status)
VALUES (
  'waha_primary',
  'WhatsApp Principal',
  'whatsapp',
  '{
    "apiUrl": "http://localhost:3000",
    "sessionName": "default",
    "token": "YOUR_WAHA_TOKEN_HERE"
  }'::jsonb,
  true,
  'unknown'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ============================================
-- INSERT DEFAULT MESSAGE TEMPLATES
-- ============================================

-- Template 1: Quotation Invitation (WhatsApp)
INSERT INTO message_templates (code, name, provider_type, body, variables)
VALUES (
  'quotation_invitation',
  'Convite para Cotação',
  'whatsapp',
  '🔔 *Nova Cotação Disponível*

Olá {{supplier_name}}!

Você foi convidado(a) a enviar proposta para:

📋 *Cotação:* {{quotation_code}}
📝 *Título:* {{quotation_title}}
⏰ *Prazo:* {{deadline}}

Por favor, envie sua proposta com:
• Preço unitário de cada item
• Prazo de entrega
• Condições de pagamento

_Aguardamos seu retorno!_',
  '["supplier_name", "quotation_code", "quotation_title", "deadline"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template 2: Quotation Reminder (WhatsApp)
INSERT INTO message_templates (code, name, provider_type, body, variables)
VALUES (
  'quotation_reminder',
  'Lembrete de Cotação',
  'whatsapp',
  '⏰ *Lembrete: Cotação Aberta*

Olá {{supplier_name}},

A cotação *{{quotation_code}}* ainda está aguardando sua proposta.

⏰ *Prazo final:* {{deadline}}

Caso já tenha enviado, desconsidere esta mensagem.',
  '["supplier_name", "quotation_code", "deadline"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template 3: Quotation Result (WhatsApp)
INSERT INTO message_templates (code, name, provider_type, body, variables)
VALUES (
  'quotation_result',
  'Resultado da Cotação',
  'whatsapp',
  '✅ *Cotação Finalizada*

Olá {{supplier_name}},

A cotação *{{quotation_code}}* foi concluída.

{{result_message}}

Obrigado pela participação!',
  '["supplier_name", "quotation_code", "result_message"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Template 4: Quotation Invitation (Email)
INSERT INTO message_templates (code, name, provider_type, subject, body, variables)
VALUES (
  'quotation_invitation_email',
  'Convite para Cotação (Email)',
  'email',
  'Nova Cotação {{quotation_code}} - {{quotation_title}}',
  '<h2>Nova Cotação Disponível</h2>

<p>Olá <strong>{{supplier_name}}</strong>,</p>

<p>Você foi convidado(a) a enviar proposta para a seguinte cotação:</p>

<table border="0" cellpadding="5">
  <tr><td><strong>Cotação:</strong></td><td>{{quotation_code}}</td></tr>
  <tr><td><strong>Título:</strong></td><td>{{quotation_title}}</td></tr>
  <tr><td><strong>Prazo:</strong></td><td>{{deadline}}</td></tr>
</table>

<h3>Informações Necessárias</h3>
<ul>
  <li>Preço unitário de cada item</li>
  <li>Prazo de entrega</li>
  <li>Condições de pagamento</li>
  <li>Validade da proposta</li>
</ul>

<p>Aguardamos seu retorno.</p>

<p><small>Esta é uma mensagem automática do sistema de cotações.</small></p>',
  '["supplier_name", "quotation_code", "quotation_title", "deadline"]'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- ============================================
-- VERIFY SEED
-- ============================================

-- Check providers
SELECT 
  code,
  name,
  type,
  is_active,
  health_status
FROM messaging_providers
ORDER BY created_at;

-- Check templates
SELECT 
  code,
  name,
  provider_type,
  LENGTH(body) as body_length,
  variables
FROM message_templates
ORDER BY created_at;

-- ============================================
-- END OF SEED
-- ============================================

-- Next step: Update config in messaging_providers with actual WA-HA credentials
-- Example:
-- UPDATE messaging_providers
-- SET config = '{"apiUrl": "http://your-waha-server:3000", "sessionName": "your-session", "token": "your-token"}'::jsonb
-- WHERE code = 'waha_primary';
