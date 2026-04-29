-- ============================================================
-- SCRIPT CONSOLIDADO: Todas as alterações pendentes no módulo
-- de cotações. Execute no SQL Editor do painel do Supabase.
-- Data: 2026-04-28
-- ============================================================


-- ============================================================
-- BLOCO 1: RLS — Recriar políticas da tabela quotations
-- ============================================================

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select"  ON quotations;
DROP POLICY IF EXISTS "quotations_insert"  ON quotations;
DROP POLICY IF EXISTS "quotations_update"  ON quotations;
DROP POLICY IF EXISTS "quotations_delete"  ON quotations;
-- nomes legados que possam existir
DROP POLICY IF EXISTS "Allow authenticated users to read quotations"   ON quotations;
DROP POLICY IF EXISTS "Allow authenticated users to insert quotations" ON quotations;
DROP POLICY IF EXISTS "Allow authenticated users to update quotations" ON quotations;
DROP POLICY IF EXISTS "Allow authenticated users to delete quotations" ON quotations;

CREATE POLICY "quotations_select" ON quotations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotations_insert" ON quotations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "quotations_update" ON quotations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "quotations_delete" ON quotations
  FOR DELETE TO authenticated USING (true);


-- ============================================================
-- BLOCO 2: Colunas novas na tabela quotations
-- ============================================================

-- Coluna de total estimado (workaround usava final_total_amount)
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(15, 2);

-- Retroalimentar a partir de final_total_amount para linhas existentes
UPDATE quotations
SET estimated_total = final_total_amount
WHERE estimated_total IS NULL
  AND final_total_amount IS NOT NULL;

-- Código do pedido de compra gerado após conversão
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS purchase_order_code VARCHAR(50);


-- ============================================================
-- BLOCO 3: Colunas novas na tabela quotation_items
-- ============================================================

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS product_id   UUID,
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);


-- ============================================================
-- BLOCO 4: Colunas novas na tabela quotation_proposals
--          (forma de pagamento adicionada nas propostas)
-- ============================================================

ALTER TABLE quotation_proposals
  ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS boleto_due_days INTEGER;

-- Garantir que apenas valores válidos sejam aceitos
ALTER TABLE quotation_proposals
  DROP CONSTRAINT IF EXISTS quotation_proposals_payment_method_check;

ALTER TABLE quotation_proposals
  ADD CONSTRAINT quotation_proposals_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit_card', 'boleto'));


-- ============================================================
-- BLOCO 5: RLS — quotation_audit_logs (permitir INSERT/SELECT)
-- ============================================================

ALTER TABLE quotation_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_audit_logs_select" ON quotation_audit_logs;
DROP POLICY IF EXISTS "quotation_audit_logs_insert" ON quotation_audit_logs;

CREATE POLICY "quotation_audit_logs_select" ON quotation_audit_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotation_audit_logs_insert" ON quotation_audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
