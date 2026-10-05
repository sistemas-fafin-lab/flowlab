-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — trigger de sync de colaboradores roda como SECURITY DEFINER
-- Migration: 20261005120000_rh_sync_colaborador_security_definer.sql
--
-- O trigger AFTER INSERT em user_profiles (20260914150000) chamava
-- rh_sync_colaborador com os privilégios de quem inseriu. No auto-cadastro quem
-- insere é o próprio usuário recém-criado (authenticated, sem permissão nenhuma),
-- e colaboradores não tem policy de INSERT — o INSERT/UPDATE em colaboradores
-- era barrado pelo RLS e abortava o INSERT do perfil. Resultado: conta no Auth
-- sem user_profiles, barrada no login e com o e-mail "já cadastrado" para
-- sempre. O cadastro pelo admin não sofria porque usa a service role.
--
-- Só a função do trigger vira SECURITY DEFINER: rh_sync_colaborador segue
-- invoker, já que o trigger é o único caminho que precisa contornar o RLS.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_colaboradores_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rh_sync_colaborador(NEW);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_colaboradores_sync_trigger() FROM PUBLIC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
