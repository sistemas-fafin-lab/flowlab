/*
  # Add unit_price column to products table

  1. Changes
    - Add `unit_price` column to products table
    - Add `unit_price` column to stock_movements table for historical tracking
    - Update existing products with default prices based on category

  2. Security
    - No changes to RLS policies needed
*/

-- Add unit_price column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE products ADD COLUMN unit_price decimal(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add unit_price column to stock_movements table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE stock_movements ADD COLUMN unit_price decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Update existing products with sample prices based on category
UPDATE products 
SET unit_price = CASE 
  WHEN category = 'technical' THEN 150.00
  WHEN category = 'general' THEN 25.00
  ELSE 10.00
END
WHERE unit_price = 0;