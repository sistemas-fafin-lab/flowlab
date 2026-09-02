-- ═══════════════════════════════════════════════════════════════════════════════
-- Permissão dedicada para excluir/restaurar usuários
-- Migration: 20260902160000_user_delete_permission.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Até aqui, soft_delete_user/soft_delete_user_by_cpf/restore_user/list_deleted_users
-- (20260721120000) exigiam canManageUsers — a mesma permissão de editar cadastro.
-- Isso obrigava a dar acesso de exclusão a qualquer cargo que precisasse editar
-- usuários. Esta migration separa as duas coisas: cria a permissão canDeleteUsers
-- e passa essas quatro funções a exigi-la em vez de canManageUsers.
--
-- Admin continua liberado (role = 'admin' sempre passa em current_user_has_permission).
-- Cargos custom passam a precisar de canDeleteUsers marcado explicitamente na tela
-- de Cargos e Permissões — canManageUsers sozinho não é mais suficiente.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. GUARD: assert_can_delete_users ─────────────────────────────────────────
-- Mesmo formato de assert_can_manage_users (20260721120000, seção 3): libera
-- conexão direta e service_role, exige canDeleteUsers via PostgREST.

CREATE OR REPLACE FUNCTION public.assert_can_delete_users()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claims text := current_setting('request.jwt.claims', true);
BEGIN
  IF _claims IS NULL OR _claims = '' THEN
    RETURN;
  END IF;

  IF COALESCE(_claims::jsonb ->> 'role', '') = 'service_role' THEN
    RETURN;
  END IF;

  IF NOT public.current_user_has_permission('canDeleteUsers') THEN
    RAISE EXCEPTION 'Permissão negada: requer canDeleteUsers.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_delete_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_can_delete_users() TO authenticated;


-- ─── 2. soft_delete_user — trocar o guard ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile     user_profiles%ROWTYPE;
  v_auth        auth.users%ROWTYPE;
  v_dummy_email TEXT;
  v_snapshot    JSONB;
BEGIN
  PERFORM public.assert_can_delete_users();

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover o próprio usuário.';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  IF v_profile.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % já foi removido em %.', p_user_id, v_profile.deleted_at;
  END IF;

  -- Não deixar o sistema sem administrador
  IF v_profile.role = 'admin'
     AND (SELECT COUNT(*) FROM user_profiles WHERE role = 'admin' AND deleted_at IS NULL) <= 1
  THEN
    RAISE EXCEPTION 'Este é o último administrador ativo. Promova outro antes de removê-lo.';
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não existe em auth.users: %', p_user_id;
  END IF;

  v_dummy_email := 'deleted_' || p_user_id || '@deleted.flowlab.local';

  v_snapshot := (to_jsonb(v_profile) - 'deleted_snapshot' - 'is_active' - 'deleted_at')
    || jsonb_build_object(
         'profile_email',      v_profile.email,
         'auth_email',         v_auth.email,
         'email_confirmed_at', v_auth.email_confirmed_at,
         'raw_user_meta_data', v_auth.raw_user_meta_data,
         'raw_app_meta_data',  v_auth.raw_app_meta_data,
         'deleted_by',         auth.uid(),
         'deleted_at',         NOW()
       );

  UPDATE auth.users
     SET email                      = v_dummy_email,
         encrypted_password         = '',
         email_confirmed_at         = NULL,
         banned_until               = 'infinity'::timestamptz,
         phone                      = NULL,
         phone_confirmed_at         = NULL,
         confirmation_token         = '',
         recovery_token             = '',
         reauthentication_token     = '',
         email_change               = '',
         email_change_token_new     = '',
         email_change_token_current = '',
         is_super_admin             = FALSE,
         raw_user_meta_data         = jsonb_build_object('deleted', true, 'deleted_at', NOW()),
         raw_app_meta_data          = COALESCE(raw_app_meta_data, '{}'::jsonb)
                                      || jsonb_build_object('deleted', true),
         updated_at                 = NOW()
   WHERE id = p_user_id;

  UPDATE auth.identities
     SET identity_data = identity_data || jsonb_build_object('email', v_dummy_email),
         updated_at    = NOW()
   WHERE user_id = p_user_id;

  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  UPDATE user_profiles
     SET email            = v_dummy_email,
         name             = 'Usuário Removido',
         role             = 'requester',
         department       = NULL,
         cpf              = NULL,
         custom_role_id   = NULL,
         deleted_at       = NOW(),
         deleted_snapshot = v_snapshot,
         updated_at       = NOW()
   WHERE id = p_user_id;

  IF v_profile.cpf IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM user_profiles
        WHERE cpf = v_profile.cpf AND id <> p_user_id AND deleted_at IS NULL
     )
  THEN
    UPDATE user_whitelist
       SET activity = FALSE, updated_at = NOW()
     WHERE cpf = v_profile.cpf;
  END IF;

  DELETE FROM user_notifications   WHERE user_id = p_user_id;
  DELETE FROM user_approval_limits WHERE user_id = p_user_id;

  RETURN format(
    'Usuário removido: %s <%s>. UUID %s preservado; chamados, projetos, aprovações e comentários mantidos. Restaure com: SELECT restore_user(''%s'');',
    v_snapshot ->> 'name', v_snapshot ->> 'auth_email', p_user_id, p_user_id
  );
END;
$$;


-- ─── 3. soft_delete_user_by_cpf — trocar o guard ───────────────────────────────

CREATE OR REPLACE FUNCTION public.soft_delete_user_by_cpf(p_cpf TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf     TEXT := REGEXP_REPLACE(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  v_user_id UUID;
BEGIN
  PERFORM public.assert_can_delete_users();

  SELECT id INTO v_user_id
    FROM user_profiles
   WHERE cpf = v_cpf AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário ativo encontrado com o CPF %.', v_cpf;
  END IF;

  RETURN public.soft_delete_user(v_user_id);
END;
$$;


-- ─── 4. restore_user — trocar o guard ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.restore_user(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap       JSONB;
  v_auth_email TEXT;
  v_cpf        TEXT;
BEGIN
  PERFORM public.assert_can_delete_users();

  SELECT deleted_snapshot INTO v_snap
    FROM user_profiles
   WHERE id = p_user_id AND deleted_at IS NOT NULL
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum usuário removido com o UUID %.', p_user_id;
  END IF;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'Usuário % foi removido sem snapshot (remoção anterior a esta migration); restaure manualmente.', p_user_id;
  END IF;

  v_auth_email := v_snap ->> 'auth_email';
  v_cpf        := v_snap ->> 'cpf';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_auth_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'O e-mail % já pertence a outro usuário; não é possível restaurar.', v_auth_email;
  END IF;

  IF v_cpf IS NOT NULL
     AND EXISTS (SELECT 1 FROM user_profiles WHERE cpf = v_cpf AND id <> p_user_id) THEN
    RAISE EXCEPTION 'O CPF % já está vinculado a outro perfil; não é possível restaurar.', v_cpf;
  END IF;

  UPDATE auth.users
     SET email              = v_auth_email,
         encrypted_password = '',
         banned_until       = NULL,
         email_confirmed_at = COALESCE((v_snap ->> 'email_confirmed_at')::timestamptz, NOW()),
         raw_user_meta_data = COALESCE(v_snap -> 'raw_user_meta_data', '{}'::jsonb),
         raw_app_meta_data  = COALESCE(v_snap -> 'raw_app_meta_data', '{}'::jsonb) - 'deleted',
         updated_at         = NOW()
   WHERE id = p_user_id;

  UPDATE auth.identities
     SET identity_data = identity_data || jsonb_build_object('email', v_auth_email),
         updated_at    = NOW()
   WHERE user_id = p_user_id;

  UPDATE user_profiles
     SET email            = COALESCE(v_snap ->> 'profile_email', v_auth_email),
         name             = v_snap ->> 'name',
         role             = COALESCE(v_snap ->> 'role', 'requester'),
         department       = v_snap ->> 'department',
         cpf              = v_cpf,
         custom_role_id   = (v_snap ->> 'custom_role_id')::uuid,
         deleted_at       = NULL,
         deleted_snapshot = NULL,
         updated_at       = NOW()
   WHERE id = p_user_id;

  IF v_cpf IS NOT NULL THEN
    UPDATE user_whitelist SET activity = TRUE, updated_at = NOW() WHERE cpf = v_cpf;
  END IF;

  RETURN format(
    'Usuário restaurado: %s <%s>. A senha está zerada — peça para acessar "Esqueci minha senha".',
    v_snap ->> 'name', v_auth_email
  );
END;
$$;


-- ─── 5. list_deleted_users — trocar o guard ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_deleted_users()
RETURNS TABLE (
  id              UUID,
  nome_original   TEXT,
  email_original  TEXT,
  cpf_original    TEXT,
  role_original   TEXT,
  removido_em     TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_delete_users();

  RETURN QUERY
  SELECT up.id,
         up.deleted_snapshot ->> 'name',
         up.deleted_snapshot ->> 'auth_email',
         up.deleted_snapshot ->> 'cpf',
         up.deleted_snapshot ->> 'role',
         up.deleted_at
  FROM user_profiles up
  WHERE up.deleted_at IS NOT NULL
  ORDER BY up.deleted_at DESC;
END;
$$;


-- ─── 6. Fallback legado (user_has_permission) — excluir canDeleteUsers do operator ──
-- Mesma função de 20260721120000 seção 5, só adicionando canDeleteUsers à lista de
-- permissões que um 'operator' legado (sem custom_role) NÃO herda automaticamente.

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
      AND up.deleted_at IS NULL;
  END IF;

  RETURN COALESCE(has_perm, false);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
