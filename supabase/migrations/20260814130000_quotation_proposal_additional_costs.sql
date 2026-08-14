-- Persist proposal additional costs (freight, taxes, etc.), which were previously
-- only folded into total_amount and never stored separately.
ALTER TABLE quotation_proposals
  ADD COLUMN IF NOT EXISTS additional_costs JSONB NOT NULL DEFAULT '[]'::jsonb;
