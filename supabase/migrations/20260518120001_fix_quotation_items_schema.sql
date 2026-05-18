-- Migration: Fix quotation_items schema
-- Removes NOT NULL from supplier_id/supplier_name (legacy model columns)
-- and adds RLS policies restricted to admin users.
-- Date: 2026-05-18

-- Remove NOT NULL constraint from legacy supplier columns
ALTER TABLE quotation_items
  ALTER COLUMN supplier_id DROP NOT NULL,
  ALTER COLUMN supplier_name DROP NOT NULL;

-- RLS: SELECT open to all authenticated; write restricted to admins
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_items_select" ON quotation_items;
DROP POLICY IF EXISTS "quotation_items_insert" ON quotation_items;
DROP POLICY IF EXISTS "quotation_items_update" ON quotation_items;
DROP POLICY IF EXISTS "quotation_items_delete" ON quotation_items;

CREATE POLICY "quotation_items_select" ON quotation_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotation_items_insert" ON quotation_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR user_has_permission(auth.uid(), 'canManageRoles')
        )
    )
  );

CREATE POLICY "quotation_items_update" ON quotation_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR user_has_permission(auth.uid(), 'canManageRoles')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR user_has_permission(auth.uid(), 'canManageRoles')
        )
    )
  );

CREATE POLICY "quotation_items_delete" ON quotation_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR user_has_permission(auth.uid(), 'canManageRoles')
        )
    )
  );
