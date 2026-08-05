-- ═══════════════════════════════════════════════════════════════════════════════
-- Troca do e-mail de acesso de um usuário
-- Migration: 20260805120000_change_user_email.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Por que uma RPC e não auth.admin.updateUserById numa rota de API:
--   O e-mail vive em dois lugares — auth.users.email (o que autentica) e
--   user_profiles.email (o que a interface exibe e para onde as notificações são
--   enviadas). Não existe trigger de sincronia entre eles. Pela API seriam duas
--   escritas em sistemas diferentes, com rollback manual e janela de
--   inconsistência; aqui as duas (mais auth.identities) caem no mesmo commit.
--   É o mesmo caminho que soft_delete_user (20260721120000) já usa.
--
-- A troca é imediata e SEM e-mail de confirmação: email_confirmed_at é preservado,
-- então a pessoa passa a logar com o novo endereço na hora — e perde o acesso pelo
-- antigo. Decisão do admin, coerente com o cadastro, onde ele já define o e-mail.
--
-- O que NÃO é tocado, de propósito:
--   • auth.sessions / refresh_tokens — o UUID não muda e o JWT continua válido;
--     revogar deslogaria a pessoa sem necessidade. (O JWT em memória segue com o
--     e-mail antigo no claim até o próximo refresh; nada no app lê esse claim.)
--   • user_whitelist — é chaveada por CPF, não por e-mail.
--
-- USO (SQL Editor do Supabase):
--   SELECT change_user_email('UUID', 'novo@empresa.com');
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. Guard de permissão (autossuficiente) ──────────────────────────────────
-- Cópia idêntica à de 20260721120000_user_soft_delete.sql. Está aqui porque
-- aquela migration não foi aplicada em todos os ambientes (no banco de test não
-- existe), e sem isto a RPC abaixo criava normalmente e só falhava na chamada, com
-- 42883 → HTTP 404 no PostgREST. CREATE OR REPLACE: onde o soft delete já rodou,
-- é substituição pelo mesmo corpo.
--
-- Depende de current_user_has_permission(text), que existe desde 20260528120000 e
-- está presente em todos os ambientes.

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


-- ─── 2. change_user_email ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.change_user_email(p_user_id UUID, p_new_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT := LOWER(TRIM(COALESCE(p_new_email, '')));
  v_old     TEXT;
  v_profile user_profiles%ROWTYPE;
BEGIN
  -- Conexão direta e service_role passam; via PostgREST exige canManageUsers.
  PERFORM public.assert_can_manage_users();

  -- Mesma regra do isValidEmail de api/_lib/email.ts
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'E-mail inválido: %', p_new_email;
  END IF;

  -- Domínio sentinela do soft delete: usá-lo aqui colidiria com um usuário removido
  -- e impediria a restauração dele.
  IF v_email LIKE '%@deleted.flowlab.local' THEN
    RAISE EXCEPTION 'O domínio @deleted.flowlab.local é reservado para usuários removidos.';
  END IF;

  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado: %', p_user_id;
  END IF;

  -- deleted_at só existe onde 20260721120000 rodou. Lido via to_jsonb para a
  -- função compilar nos dois casos: sem a coluna, a chave não existe e o ->> dá
  -- NULL (não há usuário removido num banco que não tem soft delete).
  IF (to_jsonb(v_profile) ->> 'deleted_at') IS NOT NULL THEN
    RAISE EXCEPTION 'Usuário % foi removido; restaure-o antes de alterar o e-mail.', p_user_id;
  END IF;

  SELECT email INTO v_old FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não existe em auth.users: %', p_user_id;
  END IF;

  IF LOWER(v_old) = v_email THEN
    RETURN format('O e-mail já é %s; nada alterado.', v_email);
  END IF;

  -- auth.users tem índice único no e-mail: sem esta checagem o erro chegaria à
  -- interface como um 23505 cru.
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'O e-mail % já pertence a outro usuário.', v_email;
  END IF;

  -- ── auth.users: novo login, já confirmado ──
  -- Os tokens de email_change são zerados porque uma troca pendente iniciada pelo
  -- próprio usuário passaria a apontar para um endereço que não é mais o atual.
  UPDATE auth.users
     SET email                      = v_email,
         email_confirmed_at         = COALESCE(email_confirmed_at, NOW()),
         email_change               = '',
         email_change_token_new     = '',
         email_change_token_current = '',
         updated_at                 = NOW()
   WHERE id = p_user_id;

  -- identity_data carrega uma cópia do e-mail; sem isto ela fica defasada (em
  -- schemas mais novos a coluna auth.identities.email é gerada a partir dela).
  UPDATE auth.identities
     SET identity_data = identity_data || jsonb_build_object('email', v_email),
         updated_at    = NOW()
   WHERE user_id = p_user_id
     AND provider = 'email';

  -- ── user_profiles: o que a interface lê e para onde as notificações vão ──
  UPDATE user_profiles
     SET email      = v_email,
         updated_at = NOW()
   WHERE id = p_user_id;

  RETURN format('E-mail alterado de %s para %s.', v_old, v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.change_user_email(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_user_email(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.change_user_email(UUID, TEXT) IS
  'Troca o e-mail de acesso: auth.users, auth.identities e user_profiles na mesma transação. Exige canManageUsers. Vale imediatamente, sem e-mail de confirmação.';
