-- ═══════════════════════════════════════════════════════════════════════════════
-- Cargo "Comercial" com "Ser Autorizador de Pagamentos"; a gestora vai para ele
-- Migration: 20261030130000_cargo_comercial_autoriza_pagamentos.sql
--
-- Pedido do usuário (30/Out): todas as funcionárias do Comercial no cargo "Comercial",
-- inclusive a gestora Cristiane Lacerda Dos Santos Madeiro (hoje "Solicitante"). Ela é a
-- única gestora apta do departamento Comercial, e a trava de 20261027150000 barra a troca
-- para um cargo sem canAuthorizePayments. Como na carga dos gestores (20261027150100),
-- a permissão vai para o cargo: só autoriza quem também é responsável do departamento
-- marcado "autoriza pagamentos", então as demais do cargo não passam a autorizar nada.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.custom_roles
   SET permissions = permissions || '["canAuthorizePayments"]'::jsonb,
       updated_at = now()
 WHERE name = 'Comercial'
   AND NOT permissions ? 'canAuthorizePayments';

UPDATE public.user_profiles
   SET custom_role_id = (SELECT id FROM public.custom_roles WHERE name = 'Comercial'),
       updated_at = now()
 WHERE id = '1c502999-fe20-4aa5-93bd-09c56bd036bd' -- Cristiane Lacerda Dos Santos Madeiro
   AND custom_role_id IS DISTINCT FROM (SELECT id FROM public.custom_roles WHERE name = 'Comercial');
