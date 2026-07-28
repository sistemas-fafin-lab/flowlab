-- ═══════════════════════════════════════════════════════════════════════════════
-- cpf_ja_cadastrado(): permite o auto-cadastro checar CPF duplicado ANTES do signUp
-- Migration: 20260728130000_cpf_ja_cadastrado.sql
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SINTOMA: alguém se cadastra pela tela "Cadastre-se" com um CPF que já tem perfil.
-- A conta é criada no Auth, o INSERT em user_profiles leva 23505 (índice único de
-- user_profiles.cpf) e o erro morre num console.error — a tela comemora e a pessoa
-- fica com uma conta que autentica mas é barrada no login por não ter CPF
-- (AuthContext.tsx, checagem pós-signIn). Foi assim que nasceram as contas órfãs
-- duplicadas em produção.
--
-- POR QUE PRECISA DE FUNÇÃO: no momento do cadastro o cliente ainda é anônimo, e a
-- policy de SELECT de user_profiles é "TO authenticated" — a consulta direta sempre
-- voltaria vazia (falso negativo). SECURITY DEFINER resolve sem afrouxar a policy.
--
-- EXPOSIÇÃO: devolve só um booleano, e apenas para um CPF que o chamador já digitou.
-- A user_whitelist já tem leitura anônima desde 20260603000000_whitelist_anon_read,
-- e ela expõe CPF + nome de todo mundo — ou seja, isto revela estritamente menos do
-- que já é público hoje.
--
-- Espelha o índice único: consulta todas as linhas, sem filtrar deleted_at. Perfis
-- removidos por soft_delete_user() têm cpf = NULL (20260721120000, linha 272), logo
-- nunca casam e não bloqueiam um recadastro legítimo.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cpf_ja_cadastrado(p_cpf text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_profiles
     WHERE cpf = regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g')
  );
$$;

COMMENT ON FUNCTION public.cpf_ja_cadastrado(text) IS
  'TRUE se o CPF (só dígitos) já está vinculado a algum perfil. Usada pelo auto-cadastro antes do signUp, quando o cliente ainda é anônimo.';

REVOKE ALL     ON FUNCTION public.cpf_ja_cadastrado(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cpf_ja_cadastrado(text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
