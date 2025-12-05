/*
  # Add department and supplier fields to requests table

  1. Changes
    - Add `department` column to requests table
    - Add `supplier_id` and `supplier_name` columns for suggested suppliers
    - Add indexes for new fields

  2. Security
    - No changes to RLS policies needed
*/

-- Add department column to requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'department'
  ) THEN
    ALTER TABLE requests ADD COLUMN department text;
  END IF;
END $$;

-- Add supplier fields to requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN supplier_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'supplier_name'
  ) THEN
    ALTER TABLE requests ADD COLUMN supplier_name text;
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_requests_department ON requests(department);
CREATE INDEX IF NOT EXISTS idx_requests_supplier_id ON requests(supplier_id);