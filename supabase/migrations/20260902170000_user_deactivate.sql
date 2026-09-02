-- ═══════════════════════════════════════════════════════════════════════════════
-- Desativação temporária de usuário (distinta da remoção/anonimização)
-- Migration: 20260902170000_user_deactivate.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- soft_delete_user (20260721120000) resolve remoção definitiva: anonimiza nome,
-- e-mail e CPF, e exige canDeleteUsers (20260902160000). Não existe hoje uma opção
-- mais leve para bloquear o acesso de alguém temporariamente (afastamento, férias,
-- desligamento em análise) sem apagar os dados do cadastro.
--
-- Esta migration adiciona esse meio-termo:
--   • disabled_at: bloqueia o login (banned_until = infinity, sessões revogadas),
--     mas NÃO mexe em nome/e-mail/CPF/custom_role_id — reversível na hora.
--   • Fica sob canManageUsers (a mesma permissão de editar cadastro), porque é
--     reversível e não perde dado nenhum — diferente de soft_delete_user, que
--     exige canDeleteUsers.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. COLUNA ──────────────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.disabled_at IS 'Desativação temporária (login bloqueado, dados intactos). NULL = ativo. Distinto de deleted_at (remoção/anonimização).';


-- ─── 2. current_user_has_permission / user_has_permission — ignorar desativados ─
-- Mesmas funções de 20260721120000 (seções 4 e 5), só adicionando o filtro de
-- disabled_at: um usuário desativado perde a permissão imediatamente no RLS,
-- mesmo que o JWT atual ainda não tenha expirado.

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
      AND p.deleted_at IS NULL
      AND p.disabled_at IS NULL
      AND (
        p.role = 'admin'
        OR cr.permissions @> to_jsonb(ARRAY[p_permission])
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION user_has_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN custom_roles cr ON cr.id = up.custom_role_id
    WHERE up.id = user_has_permission.user_id
      AND up.deleted_at IS NULL
      AND up.disabled_at IS NULL
      AND cr.permissions ? permission_key
  ) INTO has_perm;

  IF has_perm IS NULL OR has_perm = false THEN
    SELECT CASE
      WHEN up.role = 'admin' THEN true
      WHEN up.role = 'operator' AND permission_key NOT IN ('canViewDashboard', 'canManageUsers', 'canDeleteUsers', 'canManageRoles') THEN true
      WHEN up.role = 'requester' AND permission_key IN ('canViewRequests', 'canAddRequests') THEN true
      ELSE false
    END INTO has_perm
    FROM user_profiles up
    WHERE up.id = user_has_permission.user_id
      AND up.deleted_at IS NULL
      AND up.disabled_at IS NULL;
  END IF;

  RETURN COALESCE(has_perm, false);
END;
$$;


-- ─── 3. deactivate_user ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deactivate_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
BEGIN
  PERFORM public.assert_can_manage_users();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio usuário.';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % foi removido — use restore_user() antes de desativá-lo.', p_user_id;
  END IF;

  IF v_profile.disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % já está desativado desde %.', p_user_id, v_profile.disabled_at;
  END IF;

  IF v_profile.role = 'admin'
     AND (SELECT COUNT(*) FROM user_profiles
           WHERE role = 'admin' AND deleted_at IS NULL AND disabled_at IS NULL) <= 1
  THEN
    RAISE EXCEPTION 'Este é o último administrador ativo. Promova outro antes de desativá-lo.';
  END IF;

  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz,
         updated_at   = NOW()
   WHERE id = p_user_id;

  -- Revoga acessos já emitidos (o JWT atual continuaria válido até expirar)
  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  UPDATE user_profiles
     SET disabled_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_user_id;

  RETURN format('Usuário desativado: %s <%s>. O login foi bloqueado; reative quando quiser.', v_profile.name, v_profile.email);
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_user(UUID) TO authenticated;


-- ─── 4. reactivate_user ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reactivate_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
BEGIN
  PERFORM public.assert_can_manage_users();

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % foi removido — use restore_user() para restaurá-lo.', p_user_id;
  END IF;

  IF v_profile.disabled_at IS NULL THEN
    RAISE EXCEPTION 'Usuário % já está ativo.', p_user_id;
  END IF;

  UPDATE auth.users
     SET banned_until = NULL,
         updated_at   = NOW()
   WHERE id = p_user_id;

  UPDATE user_profiles
     SET disabled_at = NULL,
         updated_at  = NOW()
   WHERE id = p_user_id;

  RETURN format('Usuário reativado: %s <%s>. O login já pode ser usado normalmente.', v_profile.name, v_profile.email);
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_user(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
