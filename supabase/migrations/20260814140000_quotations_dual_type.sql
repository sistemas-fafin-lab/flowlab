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
