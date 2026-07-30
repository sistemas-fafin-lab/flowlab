-- Migration: garantir política de UPDATE de admin em user_profiles
--
-- Problema: trocar o cargo de um usuário continua revertendo (UPDATE afeta 0 linhas, sem erro).
-- A política "Allow admins to update any profile" e/ou a função current_user_has_permission
-- (introduzidas em 20260528120000) podem não estar presentes no banco, deixando apenas a política
-- "atualizar o próprio perfil" ativa — o que impede admins de editar outros perfis.
--
-- Esta migration recria função + política de forma idempotente e adiciona um fallback para
-- admin legado (role = 'admin'), garantindo a permissão mesmo se custom_role_id estiver nulo.

-- 1. Função SECURITY DEFINER (bypassa RLS, evita recursão) com fallback de admin legado
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
      AND (
        p.role = 'admin'                                   -- fallback: admin legado sem custom_role_id
        OR cr.permissions @> to_jsonb(ARRAY[p_permission]) -- sistema de roles dinâmicas
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;

-- 2. Política que permite quem tem canManageRoles (ou admin legado) atualizar qualquer perfil
DROP POLICY IF EXISTS "Allow admins to update any profile" ON user_profiles;
CREATE POLICY "Allow admins to update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('canManageRoles'))
  WITH CHECK (public.current_user_has_permission('canManageRoles'));
