-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — desliga quem teve o login desativado/excluído antes do sync de status
-- Migration: 20261112170000_rh_desligar_logins_inativos_anteriores.sql
--
-- 20261112120000 passou a marcar o colaborador como desligado quando o login é
-- desativado ou excluído, mas só daqui para frente. Levantamento em produção
-- (12/11/2026) achou três pessoas desativadas/excluídas antes disso e ainda
-- "ativas" no RH; confirmado com o usuário que saíram:
--   • Geovana De Jesus Cerqueira (login desativado em 26/10/2026)
--   • Marina Casseb Ferraz Saavedra Dias (perfil excluído em 15/10/2026)
--   • Milena Araujo (login desativado em 03/11/2026)
-- Lucas Moreira fica de fora de propósito (decisão pendente do RH).
-- data_desligamento fica para o RH preencher. Só age se o login ainda estiver
-- inativo e o colaborador ainda ativo; em outro banco não faz nada.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.colaboradores c
   SET status = 'desligado'
  FROM public.user_profiles p
 WHERE c.user_profile_id = p.id
   AND c.status = 'ativo'
   AND (p.disabled_at IS NOT NULL OR p.deleted_at IS NOT NULL)
   AND c.id IN ('a7e6ec80-5d20-46de-91fb-b2505a08bc84',   -- Geovana De Jesus Cerqueira
                '9f084ae7-8aea-4bcd-a607-ea60c0564b2b',   -- Marina Casseb Ferraz Saavedra Dias
                '1cae5f09-8714-4b98-aabb-3fdd769e4e15');  -- Milena Araujo
