-- Add estimated_total column to quotations table
-- Previously missing; final_total_amount was used as a workaround

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS estimated_total DECIMAL(15, 2);

-- Back-fill from final_total_amount for existing rows
UPDATE quotations
SET estimated_total = final_total_amount
WHERE estimated_total IS NULL AND final_total_amount IS NOT NULL;

-- Add missing product columns to quotation_items
-- The original table had supplier_id/supplier_name; product info was added later
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
