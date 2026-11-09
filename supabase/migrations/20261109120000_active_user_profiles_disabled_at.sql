-- active_user_profiles passa a expor user_profiles.disabled_at.
--
-- A view nasceu em 20260721120000_user_soft_delete com `SELECT *`, que o Postgres
-- expande no momento do CREATE. user_profiles.disabled_at só foi criada em
-- 20260902170000_user_deactivate, então a view ficou sem a coluna.
-- Quem filtra `.is('disabled_at', null)` na view (useResponsaveisTI, em Gastos TI)
-- recebe 42703 "column disabled_at does not exist" e a lista vem vazia.
--
-- DROP + CREATE, e não CREATE OR REPLACE: disabled_at fica no meio das colunas
-- (antes de deleted_at) e o OR REPLACE só aceita colunas novas no fim.
-- Nenhum objeto depende da view. Mantém security_invoker (a view respeita o RLS
-- de user_profiles) e os mesmos privilégios de 20260721120000.

BEGIN;

DROP VIEW IF EXISTS public.active_user_profiles;

CREATE VIEW public.active_user_profiles
WITH (security_invoker = true) AS
SELECT * FROM public.user_profiles WHERE deleted_at IS NULL;

REVOKE ALL ON public.active_user_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.active_user_profiles TO authenticated;

COMMENT ON VIEW public.active_user_profiles IS 'Perfis ativos (exclui removidos). Use na aplicação em listagens.';

COMMIT;
