-- ═══════════════════════════════════════════════════════════════════════════════
-- Corrige o cadastro pela tela: perfil ficava sem CPF (e a pessoa sem acesso)
-- Migration: 20260721130000_fix_signup_profile_trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SINTOMA: em prod havia 5 de 44 perfis ativos com cpf NULL, e sem CPF o login é
-- recusado em AuthContext.tsx:239 ("Acesso não autorizado. Contate o administrador").
--
-- CAUSA: o trigger on_auth_user_created chama create_user_profile(), que insere a
-- linha em user_profiles SEM cpf e SEM ON CONFLICT. Logo depois o client
-- (AuthContext.signUp) tenta inserir o perfil completo, com o CPF, e leva 23505
-- (PK duplicada). Esse erro só vai para console.error (AuthContext.tsx:207), então
-- o cadastro "dá certo" na tela e o perfil fica sem CPF para sempre.
--
-- CORREÇÃO: remover o trigger e deixar o client ser o único autor do perfil no
-- signup. Conferido que nada depende dele:
--   • AuthContext.signUp já insere o perfil completo (com cpf) e a política
--     "Allow users to insert their own profile" (20250616124417) permite;
--   • api/_lib/createUser.ts (fluxo admin) tenta UPDATE e, se não achar linha,
--     cai no INSERT de fallback (createUser.ts:161-178).
--
-- A função create_user_profile() é mantida — sem trigger ela fica inerte, e apagá-la
-- só criaria ruído em quem lê as migrations antigas.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. REMOVER OS TRIGGERS DE CRIAÇÃO AUTOMÁTICA ──────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created      ON auth.users;
DROP TRIGGER IF EXISTS trigger_create_user_profile ON auth.users;

COMMENT ON FUNCTION public.create_user_profile() IS
  'INERTE desde 20260721130000: não há trigger chamando. O perfil é criado pelo client no signup (com CPF) ou por api/_lib/createUser.ts. Ver a migration para o motivo.';


-- ─── 2. GARANTIR A POLÍTICA DE SELF-INSERT ─────────────────────────────────────
-- Sem ela o client não conseguiria criar o próprio perfil e o signup ficaria sem
-- perfil nenhum. Existe desde 20250616124417; recriada aqui por segurança.

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON user_profiles;
CREATE POLICY "Allow users to insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
