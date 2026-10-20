-- ═══════════════════════════════════════════════════════════════════════════════
-- Quem autoriza pagamentos hoje — SÓ LEITURA
--
-- Rode no SQL Editor do projeto do app ANTES de aplicar
-- 20261020120000_pagamentos_ver_todos_e_autorizador.sql. Depois dela, "Autorizado por" só
-- aceita quem tem um cargo com "Ser Autorizador de Pagamentos" (canAuthorizePayments), e a
-- migration dá essa permissão só ao cargo Administrador.
--
-- Cada linha é um nome digitado em "Autorizado por" nos últimos 180 dias, com a pessoa ativa
-- de mesmo nome (quando há) e o cargo dela. Marque a permissão nos cargos de quem deve
-- continuar autorizando. Nome sem pessoa: digitado diferente do cadastro, ou não é usuário.
-- ═══════════════════════════════════════════════════════════════════════════════

WITH nomes AS (
  SELECT min(btrim(autorizado_por)) AS nome, count(*) AS pedidos, max(created_at)::date AS ultimo_pedido
    FROM public.payment_requests
   WHERE created_at >= now() - interval '180 days'
   GROUP BY lower(btrim(autorizado_por))
)
SELECT n.nome AS autorizado_por_digitado,
       n.pedidos,
       n.ultimo_pedido,
       p.name AS pessoa,
       p.email,
       cr.name AS cargo,
       COALESCE(cr.permissions ? 'canAuthorizePayments', false) AS cargo_ja_autoriza
  FROM nomes n
  LEFT JOIN public.user_profiles p
         ON lower(p.name) = lower(n.nome)
        AND p.deleted_at IS NULL
        AND p.disabled_at IS NULL
  LEFT JOIN public.custom_roles cr ON cr.id = p.custom_role_id
 ORDER BY n.pedidos DESC, n.nome;
