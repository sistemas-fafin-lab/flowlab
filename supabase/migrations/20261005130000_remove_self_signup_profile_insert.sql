-- ═══════════════════════════════════════════════════════════════════════════════
-- Auth — fim do auto-cadastro: remove a policy de self-insert em user_profiles
-- Migration: 20261005130000_remove_self_signup_profile_insert.sql
--
-- O cadastro pela tela de login foi removido; contas agora só nascem pela tela
-- de Usuários (api/_lib/createUser.ts), que grava o perfil com a service role.
-- A policy "Allow users to insert their own profile" só existia para o client
-- criar o próprio perfil no auto-cadastro (20260721130000) — sem ela, nenhum
-- usuário consegue criar perfil (e se dar CPF/cargo) direto pela API.
--
-- Complementa a desativação de "Allow new users to sign up" no painel do
-- Supabase (Authentication → Sign In / Providers), que não é versionável aqui.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.user_profiles;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
