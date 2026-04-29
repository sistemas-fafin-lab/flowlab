-- Add missing UPDATE and INSERT RLS policies for quotations table
-- The original quotations table was created without UPDATE policy

-- Ensure RLS is enabled
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts before recreating
DROP POLICY IF EXISTS "quotations_select" ON quotations;
DROP POLICY IF EXISTS "quotations_insert" ON quotations;
DROP POLICY IF EXISTS "quotations_update" ON quotations;
DROP POLICY IF EXISTS "quotations_delete" ON quotations;
DROP POLICY IF EXISTS "Allow authenticated users to read quotations" ON quotations;
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
