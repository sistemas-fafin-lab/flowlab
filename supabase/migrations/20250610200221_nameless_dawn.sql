/*
  # LAB Inventory Management System Database Schema

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `name` (text, product name)
      - `code` (text, unique product code)
      - `category` (text, general or technical)
      - `quantity` (integer, current stock quantity)
      - `unit` (text, unit of measurement)
      - `supplier` (text, supplier name)
      - `batch` (text, batch number)
      - `entry_date` (date, date product entered inventory)
      - `expiration_date` (date, product expiration date)
      - `location` (text, storage location)
      - `min_stock` (integer, minimum stock threshold)
      - `status` (text, active/low-stock/expired)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `stock_movements`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to products)
      - `product_name` (text, product name for historical record)
      - `type` (text, movement type - currently only 'out')
      - `reason` (text, reason for movement)
      - `quantity` (integer, quantity moved)
      - `date` (date, movement date)
      - `request_id` (uuid, optional link to request)
      - `authorized_by` (text, person who authorized)
      - `notes` (text, additional notes)
      - `created_at` (timestamp)

    - `requests`
      - `id` (text, primary key - custom format REQ###)
      - `product_id` (uuid, foreign key to products)
      - `product_name` (text, product name for historical record)
      - `quantity` (integer, requested quantity)
      - `reason` (text, justification for request)
      - `requested_by` (text, person making request)
      - `request_date` (date, date of request)
      - `status` (text, pending/approved/rejected/completed)
      - `approved_by` (text, person who approved)
      - `approval_date` (date, date of approval)
      - `notes` (text, additional notes)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage inventory
    - Add policies for read access to inventory data

  3. Indexes
    - Add indexes for frequently queried columns
    - Add unique constraints where needed

  4. Functions
    - Add function to automatically update product status based on quantity and expiration
    - Add function to generate sequential request IDs
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('general', 'technical')),
  quantity integer NOT NULL DEFAULT 0,
  unit text NOT NULL,
  supplier text NOT NULL,
  batch text NOT NULL,
  entry_date date NOT NULL,
  expiration_date date NOT NULL,
  location text NOT NULL,
  min_stock integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'low-stock', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  type text NOT NULL DEFAULT 'out' CHECK (type IN ('out')),
  reason text NOT NULL CHECK (reason IN ('sale', 'internal-transfer', 'return', 'internal-consumption', 'other')),
  quantity integer NOT NULL CHECK (quantity > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  request_id text,
  authorized_by text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id text PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  requested_by text NOT NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  approved_by text,
  approval_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_expiration_date ON products(expiration_date);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reason ON stock_movements(reason);

CREATE INDEX IF NOT EXISTS idx_requests_product_id ON requests(product_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_request_date ON requests(request_date);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Create policies for products table
CREATE POLICY "Allow authenticated users to read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete products"
  ON products
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for stock_movements table
CREATE POLICY "Allow authenticated users to read stock movements"
  ON stock_movements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert stock movements"
  ON stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for requests table
CREATE POLICY "Allow authenticated users to read requests"
  ON requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert requests"
  ON requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update requests"
  ON requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to automatically update product status
CREATE OR REPLACE FUNCTION update_product_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if product is expired
  IF NEW.expiration_date <= CURRENT_DATE THEN
    NEW.status = 'expired';
  -- Check if product has low stock
  ELSIF NEW.quantity <= NEW.min_stock THEN
    NEW.status = 'low-stock';
  ELSE
    NEW.status = 'active';
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update product status
DROP TRIGGER IF EXISTS trigger_update_product_status ON products;
CREATE TRIGGER trigger_update_product_status
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_status();

-- Function to generate sequential request IDs
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

-- Create trigger to automatically generate request IDs
DROP TRIGGER IF EXISTS trigger_generate_request_id ON requests;
CREATE TRIGGER trigger_generate_request_id
  BEFORE INSERT ON requests
  FOR EACH ROW
  WHEN (NEW.id IS NULL OR NEW.id = '')
  EXECUTE FUNCTION generate_request_id();

-- Function to update stock when movement is recorded
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product quantity
  UPDATE products 
  SET quantity = quantity - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stock on movement
DROP TRIGGER IF EXISTS trigger_update_stock_on_movement ON stock_movements;
CREATE TRIGGER trigger_update_stock_on_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_movement();

-- Insert sample data
INSERT INTO products (name, code, category, quantity, unit, supplier, batch, entry_date, expiration_date, location, min_stock) VALUES
('Luvas de Látex', 'LAT001', 'general', 150, 'caixas', 'MedSupply', 'LT240315', '2024-03-15', '2025-03-15', 'Prateleira A1', 20),
('Reagente pH Buffer', 'RBF002', 'technical', 5, 'litros', 'ChemLab', 'PH240220', '2024-02-20', '2024-12-20', 'Geladeira B2', 10),
('Papel de Filtro', 'PAP003', 'general', 80, 'pacotes', 'LabSupply', 'PF240410', '2024-04-10', '2026-04-10', 'Armário C3', 15),
('Solução Salina', 'SOL004', 'technical', 3, 'frascos', 'BioTech', 'SS241101', '2024-11-01', '2024-12-30', 'Prateleira D1', 8);

-- Insert sample stock movements
INSERT INTO stock_movements (product_id, product_name, type, reason, quantity, date, authorized_by, notes) VALUES
((SELECT id FROM products WHERE code = 'LAT001'), 'Luvas de Látex', 'out', 'internal-consumption', 5, '2024-12-20', 'Dr. Silva', 'Uso rotina laboratório'),
((SELECT id FROM products WHERE code = 'RBF002'), 'Reagente pH Buffer', 'out', 'sale', 2, '2024-12-19', 'Dr. Santos', 'Venda cliente externo');

-- Insert sample requests
INSERT INTO requests (id, product_id, product_name, quantity, reason, requested_by, request_date, status, approved_by, approval_date) VALUES
('REQ001', (SELECT id FROM products WHERE code = 'RBF002'), 'Reagente pH Buffer', 2, 'Venda para cliente externo', 'João Silva', '2024-12-18', 'completed', 'Dr. Santos', '2024-12-19'),
('REQ002', (SELECT id FROM products WHERE code = 'PAP003'), 'Papel de Filtro', 10, 'Transferência para filial', 'Maria Costa', '2024-12-20', 'pending', NULL, NULL);