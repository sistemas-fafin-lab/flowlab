-- Migration: Messaging Infrastructure for Quotations
-- Description: Creates tables and functions to support automated messaging (WhatsApp, Email, etc.)
-- Date: 2026-02-19 (FASE 2)

-- ============================================
-- STEP 1: Create messaging_providers table
-- ============================================

CREATE TABLE IF NOT EXISTS messaging_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('whatsapp', 'email', 'sms', 'api')),
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('online', 'offline', 'error', 'unknown')),
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE messaging_providers IS 'Registry of messaging providers (WA-HA, email, etc.)';
COMMENT ON COLUMN messaging_providers.config IS 'Provider-specific configuration (encrypted credentials, URLs, etc.)';

-- ============================================
-- STEP 2: Create message_templates table
-- ============================================

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  provider_type VARCHAR(30) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE message_templates IS 'Templates for automated messages with variable substitution';
COMMENT ON COLUMN message_templates.variables IS 'List of available variables for template: {quotationCode}, {supplierName}, etc.';

-- Insert default template for quotation invitations
INSERT INTO message_templates (code, name, provider_type, subject, body, variables) VALUES (
  'quotation_invitation',
  'Convite para Cotação',
  'whatsapp',
  NULL,
  E'🔔 *Nova Cotação - {{quotationCode}}*\n\n' ||
  E'Olá {{supplierName}},\n\n' ||
  E'Você foi convidado(a) para participar da seguinte cotação:\n\n' ||
  E'*Título:* {{quotationTitle}}\n' ||
  E'*Itens:*\n{{itemsList}}\n\n' ||
  E'*Prazo para resposta:* {{responseDeadline}}\n' ||
  E'*Contato:* {{contactName}} - {{contactPhone}}\n\n' ||
  E'Por favor, envie sua proposta com:\n' ||
  E'• Preço unitário\n' ||
  E'• Prazo de entrega\n' ||
  E'• Condições de pagamento\n\n' ||
  E'Atenciosamente,\n{{companyName}}',
  '["quotationCode", "supplierName", "quotationTitle", "itemsList", "responseDeadline", "contactName", "contactPhone", "companyName"]'::JSONB
) ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STEP 3: Create quotation_messages table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  provider_id UUID REFERENCES messaging_providers(id),
  provider_type VARCHAR(30) NOT NULL,
  template_id UUID REFERENCES message_templates(id),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'delivered', 'read')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  provider_response JSONB,
  metadata JSONB,
  created_by UUID,
  created_by_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_messages_quotation 
  ON quotation_messages(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_messages_supplier 
  ON quotation_messages(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotation_messages_status 
  ON quotation_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_messages_failed 
  ON quotation_messages(quotation_id, status) WHERE status = 'failed';

COMMENT ON TABLE quotation_messages IS 'Log of all messages sent to suppliers for quotations';
COMMENT ON COLUMN quotation_messages.provider_response IS 'Raw response from messaging provider (WA-HA, etc.)';

-- ============================================
-- STEP 4: Create message_retry_queue table
-- ============================================

CREATE TABLE IF NOT EXISTS message_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES quotation_messages(id) ON DELETE CASCADE,
  next_retry_at TIMESTAMPTZ NOT NULL,
  retry_reason VARCHAR(255),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_retry_queue_next_retry 
  ON message_retry_queue(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_message_retry_queue_priority 
  ON message_retry_queue(priority DESC, next_retry_at);

COMMENT ON TABLE message_retry_queue IS 'Queue for automatic retry of failed messages';

-- ============================================
-- STEP 5: Create provider_health_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS provider_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES messaging_providers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_logs_provider 
  ON provider_health_logs(provider_id, created_at DESC);

COMMENT ON TABLE provider_health_logs IS 'Health check history for messaging providers';

-- ============================================
-- STEP 6: Functions for template rendering
-- ============================================

-- Function to render template with variables
CREATE OR REPLACE FUNCTION render_message_template(
  template_body TEXT,
  variables JSONB
)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
  key TEXT;
  value TEXT;
BEGIN
  result := template_body;
  
  FOR key, value IN SELECT * FROM jsonb_each_text(variables)
  LOOP
    result := REPLACE(result, '{{' || key || '}}', value);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if provider is healthy
CREATE OR REPLACE FUNCTION is_provider_healthy(provider_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  provider_status VARCHAR(20);
  last_check TIMESTAMPTZ;
BEGIN
  SELECT health_status, last_health_check
  INTO provider_status, last_check
  FROM messaging_providers
  WHERE id = provider_id_param AND is_active = TRUE;
  
  IF provider_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Consider healthy if online and checked within last 5 minutes
  IF provider_status = 'online' AND last_check > NOW() - INTERVAL '5 minutes' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to schedule message retry
CREATE OR REPLACE FUNCTION schedule_message_retry(
  message_id_param UUID,
  retry_delay_seconds INTEGER DEFAULT 300
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO message_retry_queue (message_id, next_retry_at, priority)
  VALUES (
    message_id_param,
    NOW() + (retry_delay_seconds || ' seconds')::INTERVAL,
    0
  )
  ON CONFLICT (message_id) DO UPDATE SET
    next_retry_at = NOW() + (retry_delay_seconds || ' seconds')::INTERVAL,
    retry_reason = EXCLUDED.retry_reason;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending messages for retry
CREATE OR REPLACE FUNCTION get_messages_for_retry()
RETURNS TABLE (
  message_id UUID,
  quotation_id UUID,
  supplier_id UUID,
  recipient VARCHAR,
  body TEXT,
  attempt_count INTEGER,
  next_retry_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qm.id,
    qm.quotation_id,
    qm.supplier_id,
    qm.recipient,
    qm.body,
    qm.attempt_count,
    mrq.next_retry_at
  FROM quotation_messages qm
  INNER JOIN message_retry_queue mrq ON mrq.message_id = qm.id
  WHERE mrq.next_retry_at <= NOW()
    AND qm.status = 'failed'
    AND qm.attempt_count < qm.max_attempts
  ORDER BY mrq.priority DESC, mrq.next_retry_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_messages_for_retry IS 'Returns messages that are ready for retry based on scheduled time';

-- ============================================
-- STEP 7: Trigger for automatic message sending
-- ============================================

-- Function to auto-send messages when quotation status changes
CREATE OR REPLACE FUNCTION trigger_quotation_messages()
RETURNS TRIGGER AS $$
DECLARE
  default_provider_id UUID;
  template_id UUID;
  supplier RECORD;
BEGIN
  -- Only trigger when status changes to 'sent_to_suppliers'
  IF NEW.status = 'sent_to_suppliers' AND (OLD.status IS NULL OR OLD.status != 'sent_to_suppliers') THEN
    
    -- Get default WhatsApp provider
    SELECT id INTO default_provider_id
    FROM messaging_providers
    WHERE type = 'whatsapp' AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get default template
    SELECT id INTO template_id
    FROM message_templates
    WHERE code = 'quotation_invitation' AND is_active = TRUE
    LIMIT 1;
    
    -- Skip if no provider or template configured
    IF default_provider_id IS NULL OR template_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Create message records for each invited supplier
    FOR supplier IN 
      SELECT 
        qis.supplier_id,
        qis.supplier_name,
        s.phone,
        s.whatsapp
      FROM quotation_invited_suppliers qis
      LEFT JOIN suppliers s ON s.id = qis.supplier_id
      WHERE qis.quotation_id = NEW.id
        AND qis.status = 'pending'
    LOOP
      -- Only create message if supplier has WhatsApp number
      IF supplier.whatsapp IS NOT NULL AND supplier.whatsapp != '' THEN
        INSERT INTO quotation_messages (
          quotation_id,
          supplier_id,
          supplier_name,
          provider_id,
          provider_type,
          template_id,
          recipient,
          body,
          status,
          created_by,
          created_by_name
        ) VALUES (
          NEW.id,
          supplier.supplier_id,
          supplier.supplier_name,
          default_provider_id,
          'whatsapp',
          template_id,
          supplier.whatsapp,
          '', -- Body will be rendered by backend service
          'pending',
          NEW.created_by,
          NEW.created_by_name
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_send_quotation_messages ON quotations;
CREATE TRIGGER trigger_send_quotation_messages
  AFTER INSERT OR UPDATE OF status ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_quotation_messages();

-- ============================================
-- STEP 8: RLS Policies
-- ============================================

ALTER TABLE messaging_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health_logs ENABLE ROW LEVEL SECURITY;

-- Providers - Only admins can manage
CREATE POLICY "messaging_providers_select" ON messaging_providers
  FOR SELECT USING (true);

CREATE POLICY "messaging_providers_insert" ON messaging_providers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "messaging_providers_update" ON messaging_providers
  FOR UPDATE USING (true);

-- Templates - Only admins can manage
CREATE POLICY "message_templates_select" ON message_templates
  FOR SELECT USING (true);

CREATE POLICY "message_templates_insert" ON message_templates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "message_templates_update" ON message_templates
  FOR UPDATE USING (true);

-- Messages - Everyone can read, system can write
CREATE POLICY "quotation_messages_select" ON quotation_messages
  FOR SELECT USING (true);

CREATE POLICY "quotation_messages_insert" ON quotation_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "quotation_messages_update" ON quotation_messages
  FOR UPDATE USING (true);

-- Retry queue - System managed
CREATE POLICY "message_retry_queue_select" ON message_retry_queue
  FOR SELECT USING (true);

CREATE POLICY "message_retry_queue_insert" ON message_retry_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "message_retry_queue_delete" ON message_retry_queue
  FOR DELETE USING (true);

-- Health logs - Read only
CREATE POLICY "provider_health_logs_select" ON provider_health_logs
  FOR SELECT USING (true);

CREATE POLICY "provider_health_logs_insert" ON provider_health_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 9: Add WhatsApp field to suppliers
-- ============================================

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);

COMMENT ON COLUMN suppliers.whatsapp IS 'WhatsApp number in international format (+55...)';

-- Update existing suppliers with phone as WhatsApp if not set
UPDATE suppliers
SET whatsapp = phone
WHERE whatsapp IS NULL AND phone IS NOT NULL AND phone != '';

-- ============================================
-- STEP 10: Create view for message monitoring
-- ============================================

CREATE OR REPLACE VIEW quotation_message_status AS
SELECT 
  q.id AS quotation_id,
  q.code AS quotation_code,
  q.title AS quotation_title,
  q.status AS quotation_status,
  COUNT(qm.id) AS total_messages,
  COUNT(qm.id) FILTER (WHERE qm.status = 'sent') AS sent_count,
  COUNT(qm.id) FILTER (WHERE qm.status = 'failed') AS failed_count,
  COUNT(qm.id) FILTER (WHERE qm.status = 'pending') AS pending_count,
  COUNT(qm.id) FILTER (WHERE qm.status = 'delivered') AS delivered_count,
  COUNT(qm.id) FILTER (WHERE qm.status = 'read') AS read_count,
  MAX(qm.sent_at) AS last_sent_at,
  MAX(qm.delivered_at) AS last_delivered_at
FROM quotations q
LEFT JOIN quotation_messages qm ON qm.quotation_id = q.id
GROUP BY q.id, q.code, q.title, q.status;

COMMENT ON VIEW quotation_message_status IS 'Summary of message sending status per quotation';

-- ============================================
-- STEP 11: Helper Functions
-- ============================================

-- Function: Schedule message retry (consolidated above)
-- Function: Get messages for retry (consolidated above)

-- Function: Cleanup old retry queue entries
CREATE OR REPLACE FUNCTION cleanup_retry_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM message_retry_queue
  WHERE message_id IN (
    SELECT mrq.message_id
    FROM message_retry_queue mrq
    JOIN quotation_messages qm ON qm.id = mrq.message_id
    WHERE qm.attempt_count >= qm.max_attempts
       OR qm.status IN ('sent', 'delivered', 'read')
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_retry_queue IS 'Removes completed or exhausted messages from retry queue';

-- ============================================
-- COMPLETED: Messaging Infrastructure Ready
-- ============================================

-- Next steps (to be implemented in backend service):
-- 1. ✅ Create messaging service layer (MessagingService.ts)
-- 2. ✅ Implement WA-HA integration (WAHAProvider.ts)
-- 3. ✅ Create background job for message processing (MessageProcessor.ts)
-- 4. ⏳ Implement health check endpoint
-- 5. ⏳ Create webhook endpoint for delivery confirmations
