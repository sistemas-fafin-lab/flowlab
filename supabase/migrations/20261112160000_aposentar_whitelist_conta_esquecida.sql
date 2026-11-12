-- ═══════════════════════════════════════════════════════════════════════════════
-- Complemento de 20261112150000: mantém barrada a conta que a lista deixou de fora
-- Migration: 20261112160000_aposentar_whitelist_conta_esquecida.sql
--
-- A lista fechada de 20261112150000 (contas ativas que a regra antiga do login barrava)
-- foi levantada no banco de teste, não no de produção. Conferido em produção depois de
-- aplicar: uma conta barrada ficou de fora e passou a poder entrar — "Cristiane Lacerda
-- Dos Santos Madeiro" (comercial.laboratorio.lab@gmail.com, sem CPF, último login
-- 02/03/2026; a pessoa hoje usa comercial@laboratoriolab.com.br). Ela é desativada do
-- mesmo jeito (disabled_at + bloqueio no Auth + sessões revogadas), sem mexer no RH.
-- Só age se a conta ainda estiver ativa e sem CPF; em outro banco não faz nada.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE barrados_esquecidos ON COMMIT DROP AS
SELECT id
  FROM public.user_profiles
 WHERE id = '1c502999-fe20-4aa5-93bd-09c56bd036bd'
   AND cpf IS NULL
   AND disabled_at IS NULL
   AND deleted_at IS NULL;

ALTER TABLE public.user_profiles DISABLE TRIGGER trigger_user_profiles_sync_colaborador;

UPDATE public.user_profiles
   SET disabled_at = now(), updated_at = now()
 WHERE id IN (SELECT id FROM barrados_esquecidos);

ALTER TABLE public.user_profiles ENABLE TRIGGER trigger_user_profiles_sync_colaborador;

UPDATE auth.users
   SET banned_until = 'infinity'::timestamptz, updated_at = now()
 WHERE id IN (SELECT id FROM barrados_esquecidos);
DELETE FROM auth.sessions       WHERE user_id IN (SELECT id FROM barrados_esquecidos);
DELETE FROM auth.refresh_tokens WHERE user_id IN (SELECT id::text FROM barrados_esquecidos);

COMMIT;
