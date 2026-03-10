-- Migration: Expand Quotations Module
-- Description: Adds new fields and tables to support the advanced quotation management system
-- Date: 2026-02-19

-- ============================================
-- STEP 1: Add new columns to quotations table
-- ============================================

-- Add new status enum values (we'll use a text field for flexibility)
ALTER TABLE quotations 
  DROP CONSTRAINT IF EXISTS quotations_status_check;

-- Add new columns to quotations
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS code VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cost_center VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS required_approval_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS final_total_amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS selected_proposal_id UUID,
  ADD COLUMN IF NOT EXISTS selected_total_amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID,
  ADD COLUMN IF NOT EXISTS converted_to_purchase_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);

-- Update existing records with generated code and title
UPDATE quotations 
SET 
  code = COALESCE(code, 'COT-' || TO_CHAR(created_at, 'YYYYMM') || '-' || UPPER(SUBSTRING(id::text, 1, 4))),
  title = COALESCE(title, product_name, 'Cotação sem título')
WHERE code IS NULL OR title IS NULL;

-- Add constraint for priority
ALTER TABLE quotations 
  ADD CONSTRAINT quotations_priority_check 
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add constraint for required_approval_level
ALTER TABLE quotations 
  ADD CONSTRAINT quotations_approval_level_check 
  CHECK (required_approval_level IS NULL OR required_approval_level IN ('level_1', 'level_2', 'level_3', 'level_4'));

-- ============================================
-- STEP 2: Create quotation_invited_suppliers table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_invited_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_email VARCHAR(255),
  supplier_phone VARCHAR(50),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT quotation_invited_suppliers_status_check 
    CHECK (status IN ('pending', 'responded', 'declined', 'no_response')),
  CONSTRAINT quotation_invited_suppliers_unique 
    UNIQUE (quotation_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_invited_suppliers_quotation 
  ON quotation_invited_suppliers(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_invited_suppliers_supplier 
  ON quotation_invited_suppliers(supplier_id);

-- ============================================
-- STEP 3: Create quotation_proposals table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  average_delivery_days INTEGER,
  notes TEXT,
  valid_until DATE,
  status VARCHAR(20) DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_winner BOOLEAN DEFAULT FALSE,
  selected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT quotation_proposals_status_check 
    CHECK (status IN ('submitted', 'under_review', 'selected', 'rejected')),
  CONSTRAINT quotation_proposals_unique 
    UNIQUE (quotation_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_proposals_quotation 
  ON quotation_proposals(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_proposals_supplier 
  ON quotation_proposals(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotation_proposals_winner 
  ON quotation_proposals(quotation_id, is_winner) WHERE is_winner = TRUE;

-- ============================================
-- STEP 4: Create quotation_proposal_items table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES quotation_proposals(id) ON DELETE CASCADE,
  quotation_item_id UUID NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  total_price DECIMAL(15, 2) NOT NULL,
  delivery_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT quotation_proposal_items_unique 
    UNIQUE (proposal_id, quotation_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quotation_proposal_items_proposal 
  ON quotation_proposal_items(proposal_id);

-- ============================================
-- STEP 5: Expand quotation_items table
-- ============================================

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS estimated_unit_price DECIMAL(15, 2);

-- ============================================
-- STEP 6: Create quotation_approvals table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL,
  approver_id UUID NOT NULL REFERENCES user_profiles(id),
  approver_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  max_amount DECIMAL(15, 2),
  comment TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT quotation_approvals_level_check 
    CHECK (level IN ('level_1', 'level_2', 'level_3', 'level_4')),
  CONSTRAINT quotation_approvals_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_quotation_approvals_quotation 
  ON quotation_approvals(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_approvals_approver 
  ON quotation_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_quotation_approvals_status 
  ON quotation_approvals(quotation_id, status);

-- ============================================
-- STEP 7: Create quotation_audit_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS quotation_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by UUID NOT NULL,
  performed_by_name VARCHAR(255) NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_audit_logs_quotation 
  ON quotation_audit_logs(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_audit_logs_action 
  ON quotation_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_quotation_audit_logs_performed_at 
  ON quotation_audit_logs(performed_at DESC);

-- ============================================
-- STEP 8: Migrate existing quotation_items to invited_suppliers
-- ============================================

-- Create invited suppliers from existing quotation_items
INSERT INTO quotation_invited_suppliers (quotation_id, supplier_id, supplier_name, status, responded_at)
SELECT DISTINCT 
  qi.quotation_id,
  qi.supplier_id,
  qi.supplier_name,
  CASE 
    WHEN qi.status = 'submitted' OR qi.status = 'selected' THEN 'responded'
    ELSE 'pending'
  END,
  qi.submitted_at
FROM quotation_items qi
WHERE NOT EXISTS (
  SELECT 1 FROM quotation_invited_suppliers qis 
  WHERE qis.quotation_id = qi.quotation_id AND qis.supplier_id = qi.supplier_id
)
ON CONFLICT (quotation_id, supplier_id) DO NOTHING;

-- Create proposals from existing submitted quotation_items
INSERT INTO quotation_proposals (
  quotation_id, 
  supplier_id, 
  supplier_name, 
  total_amount, 
  status, 
  submitted_at,
  is_winner,
  selected_at
)
SELECT 
  qi.quotation_id,
  qi.supplier_id,
  qi.supplier_name,
  COALESCE(qi.total_price, qi.unit_price, 0),
  CASE 
    WHEN qi.status = 'selected' THEN 'selected'
    WHEN qi.status = 'submitted' THEN 'submitted'
    WHEN qi.status = 'rejected' THEN 'rejected'
    ELSE 'submitted'
  END,
  COALESCE(qi.submitted_at, qi.created_at),
  qi.status = 'selected',
  CASE WHEN qi.status = 'selected' THEN qi.submitted_at END
FROM quotation_items qi
WHERE qi.status IN ('submitted', 'selected', 'rejected')
AND NOT EXISTS (
  SELECT 1 FROM quotation_proposals qp 
  WHERE qp.quotation_id = qi.quotation_id AND qp.supplier_id = qi.supplier_id
)
ON CONFLICT (quotation_id, supplier_id) DO NOTHING;

-- ============================================
-- STEP 9: Update quotations status mapping
-- ============================================

-- Map old statuses to new workflow statuses
UPDATE quotations
SET status = CASE 
  WHEN status = 'pending' THEN 'draft'
  WHEN status = 'in_progress' THEN 'waiting_responses'
  WHEN status = 'completed' THEN 'approved'
  WHEN status = 'cancelled' THEN 'cancelled'
  WHEN status = 'sent' THEN 'sent_to_suppliers'
  ELSE status
END
WHERE status IN ('pending', 'in_progress', 'completed', 'cancelled', 'sent');

-- ============================================
-- STEP 10: Create helper functions
-- ============================================

-- Function to get quotation status label
CREATE OR REPLACE FUNCTION get_quotation_status_label(status TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE status
    WHEN 'draft' THEN 'Rascunho'
    WHEN 'sent_to_suppliers' THEN 'Enviada aos Fornecedores'
    WHEN 'waiting_responses' THEN 'Aguardando Respostas'
    WHEN 'under_review' THEN 'Em Análise'
    WHEN 'awaiting_approval' THEN 'Aguardando Aprovação'
    WHEN 'approved' THEN 'Aprovada'
    WHEN 'rejected' THEN 'Rejeitada'
    WHEN 'cancelled' THEN 'Cancelada'
    WHEN 'converted_to_purchase' THEN 'Convertida em Pedido'
    ELSE status
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate quotation savings
CREATE OR REPLACE FUNCTION calculate_quotation_savings(quotation_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  highest_price DECIMAL;
  selected_price DECIMAL;
BEGIN
  SELECT 
    MAX(total_amount),
    (SELECT total_amount FROM quotation_proposals WHERE quotation_proposals.quotation_id = $1 AND is_winner = TRUE)
  INTO highest_price, selected_price
  FROM quotation_proposals
  WHERE quotation_proposals.quotation_id = $1;
  
  IF highest_price IS NULL OR selected_price IS NULL OR highest_price = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ((highest_price - selected_price) / highest_price) * 100;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 11: Create RLS policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE quotation_invited_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for quotation_invited_suppliers
CREATE POLICY "quotation_invited_suppliers_select" ON quotation_invited_suppliers
  FOR SELECT USING (true);

CREATE POLICY "quotation_invited_suppliers_insert" ON quotation_invited_suppliers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "quotation_invited_suppliers_update" ON quotation_invited_suppliers
  FOR UPDATE USING (true);

CREATE POLICY "quotation_invited_suppliers_delete" ON quotation_invited_suppliers
  FOR DELETE USING (true);

-- Policies for quotation_proposals
CREATE POLICY "quotation_proposals_select" ON quotation_proposals
  FOR SELECT USING (true);

CREATE POLICY "quotation_proposals_insert" ON quotation_proposals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "quotation_proposals_update" ON quotation_proposals
  FOR UPDATE USING (true);

CREATE POLICY "quotation_proposals_delete" ON quotation_proposals
  FOR DELETE USING (true);

-- Policies for quotation_proposal_items
CREATE POLICY "quotation_proposal_items_select" ON quotation_proposal_items
  FOR SELECT USING (true);

CREATE POLICY "quotation_proposal_items_insert" ON quotation_proposal_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "quotation_proposal_items_update" ON quotation_proposal_items
  FOR UPDATE USING (true);

CREATE POLICY "quotation_proposal_items_delete" ON quotation_proposal_items
  FOR DELETE USING (true);

-- Policies for quotation_approvals
CREATE POLICY "quotation_approvals_select" ON quotation_approvals
  FOR SELECT USING (true);

CREATE POLICY "quotation_approvals_insert" ON quotation_approvals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "quotation_approvals_update" ON quotation_approvals
  FOR UPDATE USING (true);

CREATE POLICY "quotation_approvals_delete" ON quotation_approvals
  FOR DELETE USING (true);

-- Policies for quotation_audit_logs
CREATE POLICY "quotation_audit_logs_select" ON quotation_audit_logs
  FOR SELECT USING (true);

CREATE POLICY "quotation_audit_logs_insert" ON quotation_audit_logs
  FOR INSERT WITH CHECK (true);

-- Audit logs should not be updated or deleted
-- No update/delete policies intentionally

-- ============================================
-- STEP 12: Create triggers for updated_at
-- ============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_quotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for quotation_proposals
DROP TRIGGER IF EXISTS update_quotation_proposals_updated_at ON quotation_proposals;
CREATE TRIGGER update_quotation_proposals_updated_at
  BEFORE UPDATE ON quotation_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_quotation_updated_at();

-- ============================================
-- COMPLETED: Migration successful
-- ============================================

COMMENT ON TABLE quotation_invited_suppliers IS 'Stores suppliers invited to participate in a quotation';
COMMENT ON TABLE quotation_proposals IS 'Stores supplier proposals for quotations';
COMMENT ON TABLE quotation_proposal_items IS 'Stores individual item prices within a proposal';
COMMENT ON TABLE quotation_approvals IS 'Stores approval workflow for quotations';
COMMENT ON TABLE quotation_audit_logs IS 'Stores audit trail for all quotation actions';
