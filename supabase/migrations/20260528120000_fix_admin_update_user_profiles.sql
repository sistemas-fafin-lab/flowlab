-- Migration: Fix admin update policy on user_profiles
-- Problem: The billowing_garden migration removed the admin update policy to fix
-- infinite recursion, leaving only "users can update their own profile".
-- This silently blocks admins from updating other users' profiles (0 rows affected, no error).
--
-- Solution: Use a SECURITY DEFINER helper function to check admin permissions.
-- SECURITY DEFINER runs as postgres (bypasses RLS), breaking the recursion cycle.

-- 1. Create a SECURITY DEFINER helper to check if the current user has a permission
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles p
    LEFT JOIN custom_roles cr ON cr.id = p.custom_role_id
    WHERE p.id = auth.uid()
      AND cr.permissions @> to_jsonb(ARRAY[p_permission])
  );
END;
$$;

-- Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;

-- 2. Add admin UPDATE policy that allows users with canManageUsers to update any profile
DROP POLICY IF EXISTS "Allow admins to update any profile" ON user_profiles;
CREATE POLICY "Allow admins to update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('canManageUsers'))
  WITH CHECK (public.current_user_has_permission('canManageUsers'));
