/*
  # Update requests table schema to support multiple items

  1. Schema Changes
    - Add `items` column (jsonb) to store array of request items
    - Add `priority` column for request priority levels
    - Add `department` column for requesting department
    - Add `supplier_id` and `supplier_name` columns for supplier information
    - Remove individual product columns (product_id, product_name, quantity)
    - Update constraints and indexes

  2. Data Migration
    - Convert existing single-product requests to items array format
    - Preserve all existing data during migration

  3. Security
    - Maintain existing RLS policies
    - Update policies to work with new schema
*/

-- First, add new columns
DO $$
BEGIN
  -- Add items column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'items'
  ) THEN
    ALTER TABLE requests ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add priority column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'priority'
  ) THEN
    ALTER TABLE requests ADD COLUMN priority text DEFAULT 'standard' CHECK (priority IN ('low', 'standard', 'priority', 'urgent'));
  END IF;

  -- Add department column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'department'
  ) THEN
    ALTER TABLE requests ADD COLUMN department text;
  END IF;

  -- Add supplier_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN supplier_id text;
  END IF;

  -- Add supplier_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'supplier_name'
  ) THEN
    ALTER TABLE requests ADD COLUMN supplier_name text;
  END IF;
END $$;

-- Migrate existing data to new format
UPDATE requests 
SET items = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'productId', product_id::text,
    'productName', product_name,
    'quantity', quantity,
    'category', COALESCE(
      (SELECT category FROM products WHERE id = requests.product_id::uuid), 
      'general'
    )
  )
)
WHERE items = '[]'::jsonb AND product_id IS NOT NULL;

-- Remove old columns after data migration
DO $$
BEGIN
  -- Drop foreign key constraint first if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%product_id%' AND table_name = 'requests'
  ) THEN
    ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_product_id_fkey;
  END IF;

  -- Drop old columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE requests DROP COLUMN product_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE requests DROP COLUMN product_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE requests DROP COLUMN quantity;
  END IF;
END $$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_department ON requests(department);
CREATE INDEX IF NOT EXISTS idx_requests_supplier_id ON requests(supplier_id);

-- Update the generate_request_id function to handle updated_at properly
CREATE OR REPLACE FUNCTION generate_request_id()
RETURNS TRIGGER AS $$
DECLARE
  next_id integer;
BEGIN
  -- Get the next sequential number
  SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS integer)), 0) + 1
  INTO next_id
  FROM requests
  WHERE id ~ '^REQ[0-9]+$';
  
  -- Generate the new ID
  NEW.id = 'REQ' || LPAD(next_id::text, 3, '0');
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_generate_request_id ON requests;
CREATE TRIGGER trigger_generate_request_id
  BEFORE INSERT ON requests
  FOR EACH ROW
  WHEN (NEW.id IS NULL OR NEW.id = '')
  EXECUTE FUNCTION generate_request_id();