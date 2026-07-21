-- ═══════════════════════════════════════════════════════════════════════════════
-- Soft Delete de Usuários (remoção de cadastro sem perder histórico)
-- Migration: 20260721120000_user_soft_delete.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Por que soft delete e não DELETE:
--   it_requests.requested_by, it_projects.created_by e quotation_approvals.approver_id
--   referenciam user_profiles com ON DELETE RESTRICT. Um DELETE físico falha para
--   qualquer pessoa que já tenha aberto um chamado, criado projeto ou aprovado cotação.
--
-- O que a remoção faz:
--   • bloqueia o login (banned_until = infinity + senha zerada + sessões revogadas)
--   • anonimiza o perfil e o e-mail em auth.users (libera o e-mail para reuso)
--   • desativa o CPF na user_whitelist (impede recadastro pela tela de signup)
--   • guarda um snapshot em user_profiles.deleted_snapshot para permitir restauração
--   • PRESERVA chamados, projetos, aprovações e comentários (histórico intacto)
--
-- USO (SQL Editor do Supabase):
--   SELECT * FROM check_user_dependencies('UUID');   -- diagnóstico (opcional)
--   SELECT soft_delete_user_by_cpf('03707582183');   -- remover pelo CPF
--   SELECT soft_delete_user('UUID');                 -- remover pelo UUID
--   SELECT * FROM list_deleted_users();              -- listar removidos
--   SELECT restore_user('UUID');                     -- restaurar
--
-- NOTA: user_profiles.telefone e data_nascimento (migration 20260618020000) não
-- existem em nenhum ambiente e nada na interface os coleta, então não são tocados
-- aqui. O snapshot usa to_jsonb da linha inteira e os captura sozinho se um dia
-- aparecerem — mas a anonimização precisaria zerá-los explicitamente: se aquela
-- migration for aplicada, adicione as duas colunas ao UPDATE do soft_delete_user.
--
-- NOTA: esta migration NÃO altera create_user_profile() nem os triggers de
-- auth.users. O cadastro hoje é feito pelo client (AuthContext.signUp), que grava
-- o CPF; recriar o trigger faria a inserção do client falhar por PK duplicada e
-- deixaria o perfil sem CPF (o login exige CPF). Fora do escopo aqui.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. COLUNAS ────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.active_user_profiles;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_snapshot JSONB;

-- is_active é derivado de deleted_at: uma única fonte de verdade, impossível divergir.
ALTER TABLE user_profiles DROP COLUMN IF EXISTS is_active;
ALTER TABLE user_profiles
  ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (deleted_at IS NULL) STORED;

COMMENT ON COLUMN user_profiles.deleted_at       IS 'Timestamp da remoção (NULL = ativo)';
COMMENT ON COLUMN user_profiles.deleted_snapshot IS 'Dados originais do perfil, usados por restore_user()';
COMMENT ON COLUMN user_profiles.is_active        IS 'Derivado: deleted_at IS NULL';

DROP INDEX IF EXISTS idx_user_profiles_is_active;
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at
  ON user_profiles(deleted_at) WHERE deleted_at IS NOT NULL;


-- ─── 2. VIEW: APENAS USUÁRIOS ATIVOS ───────────────────────────────────────────
-- security_invoker = true: a view respeita o RLS de user_profiles. Sem isso ela
-- rodaria com os privilégios do owner e exporia e-mail e CPF para anon.

CREATE VIEW public.active_user_profiles
WITH (security_invoker = true) AS
SELECT * FROM public.user_profiles WHERE deleted_at IS NULL;

REVOKE ALL ON public.active_user_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.active_user_profiles TO authenticated;

COMMENT ON VIEW public.active_user_profiles IS 'Perfis ativos (exclui removidos). Use na aplicação em listagens.';


-- ─── 3. GUARD DE PERMISSÃO ─────────────────────────────────────────────────────
-- Libera conexão direta (SQL Editor / psql) e service_role; via PostgREST exige
-- canManageUsers. Sem isso, um authenticated qualquer chamaria rpc('soft_delete_user')
-- passando o UUID do admin.

CREATE OR REPLACE FUNCTION public.assert_can_manage_users()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claims text := current_setting('request.jwt.claims', true);
BEGIN
  -- Sem JWT na requisição = conexão direta ao banco (SQL Editor, psql, migrations)
  IF _claims IS NULL OR _claims = '' THEN
    RETURN;
  END IF;

  IF COALESCE(_claims::jsonb ->> 'role', '') = 'service_role' THEN
    RETURN;
  END IF;

  IF NOT public.current_user_has_permission('canManageUsers') THEN
    RAISE EXCEPTION 'Permissão negada: requer canManageUsers.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_manage_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_can_manage_users() TO authenticated;


-- ─── 4. current_user_has_permission — IGNORAR REMOVIDOS ────────────────────────
-- (mesma assinatura de 20260618010000; só adiciona o filtro de deleted_at)

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
      AND (
        p.role = 'admin'
        OR cr.permissions @> to_jsonb(ARRAY[p_permission])
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;


-- ─── 5. user_has_permission — IGNORAR REMOVIDOS ────────────────────────────────
-- ATENÇÃO: os nomes dos parâmetros (user_id, permission_key) são os de
-- 20260409120000. CREATE OR REPLACE não permite renomeá-los, e um DROP falharia
-- porque políticas RLS de quotation_items dependem desta função.

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

  -- Fallback para o sistema antigo (coluna role)
  IF has_perm IS NULL OR has_perm = false THEN
    SELECT CASE
      WHEN up.role = 'admin' THEN true
      WHEN up.role = 'operator' AND permission_key NOT IN ('canViewDashboard', 'canManageUsers', 'canManageRoles') THEN true
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


-- ─── 6. soft_delete_user ───────────────────────────────────────────────────────

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
  PERFORM public.assert_can_manage_users();

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

  -- Snapshot para restauração (o restore depende disso: o login exige CPF).
  -- to_jsonb copia a linha inteira: não depende de uma lista fixa de colunas, então
  -- colunas futuras de user_profiles entram no snapshot sozinhas.
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

  -- ── auth.users: bloqueia login e libera o e-mail original para reuso ──
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

  -- Revoga acessos já emitidos (o JWT atual continuaria válido até expirar)
  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  -- ── user_profiles: anonimiza e marca como removido ──
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

  -- ── whitelist: impede recadastro pelo signup (só se o CPF não for de mais ninguém) ──
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

  -- Dados pessoais transitórios (não são histórico operacional)
  DELETE FROM user_notifications   WHERE user_id = p_user_id;
  DELETE FROM user_approval_limits WHERE user_id = p_user_id;

  RETURN format(
    'Usuário removido: %s <%s>. UUID %s preservado; chamados, projetos, aprovações e comentários mantidos. Restaure com: SELECT restore_user(''%s'');',
    v_snapshot ->> 'name', v_snapshot ->> 'auth_email', p_user_id, p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID) TO authenticated;


-- ─── 7. soft_delete_user_by_cpf ────────────────────────────────────────────────

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
  PERFORM public.assert_can_manage_users();

  SELECT id INTO v_user_id
    FROM user_profiles
   WHERE cpf = v_cpf AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário ativo encontrado com o CPF %.', v_cpf;
  END IF;

  RETURN public.soft_delete_user(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_user_by_cpf(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_user_by_cpf(TEXT) TO authenticated;


-- ─── 8. restore_user ───────────────────────────────────────────────────────────

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
  PERFORM public.assert_can_manage_users();

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

  -- auth.users: destrava o login. A senha continua zerada — o usuário define uma
  -- nova por "Esqueci minha senha"; por isso o e-mail volta como confirmado.
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

REVOKE ALL ON FUNCTION public.restore_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user(UUID) TO authenticated;


-- ─── 9. list_deleted_users ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.list_deleted_users();

CREATE FUNCTION public.list_deleted_users()
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
  PERFORM public.assert_can_manage_users();

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

REVOKE ALL ON FUNCTION public.list_deleted_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_deleted_users() TO authenticated;


-- ─── 10. RECONCILIAR REMOÇÕES ANTERIORES ───────────────────────────────────────
-- Se alguém já foi anonimizado por uma versão anterior deste script, marca o
-- deleted_at a partir do metadata de auth.users (sem snapshot: restauração manual).

UPDATE user_profiles up
   SET deleted_at = COALESCE(
         (SELECT (au.raw_user_meta_data ->> 'deleted_at')::timestamptz
            FROM auth.users au WHERE au.id = up.id),
         NOW()
       )
 WHERE up.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM auth.users au
      WHERE au.id = up.id
        AND (au.email LIKE 'deleted\_%@deleted.flowlab.local'
             OR au.raw_user_meta_data ->> 'deleted' = 'true')
   );


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
