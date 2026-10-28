-- ═══════════════════════════════════════════════════════════════════════════════
-- Pagamentos: reaplica as políticas de leitura e de criação de pedidos
-- Migration: 20261028150000_pagamentos_politicas_reaplicar.sql
--
-- Em 27/10/2026 a 20261020120000_pagamentos_ver_todos_e_autorizador.sql foi rodada de novo
-- em produção, depois da 20261020150000_pagamentos_autorizacao.sql. Ela recria as políticas
-- de payment_requests na versão anterior à autorização:
--   • criar: só com status 'pending'. O pedido de quem não é gestor nasce
--     'awaiting_authorization' (payment_request_guard), e o banco recusava com 42501
--     ("new row violates row-level security policy"). Só o gestor que pede para o próprio
--     departamento (pedido já autorizado, 'pending') conseguia criar;
--   • ler: sem "o autorizador vê os pedidos em que foi escolhido".
-- Todos devem conseguir criar pedidos; quem aprova é o Financeiro (canApprovePayments).
-- Aqui ficam as duas como na 20261020150000. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Quem pede, o gestor que autoriza e o setor veem o pedido; o Financeiro vê todos.
DROP POLICY IF EXISTS "Users can view payment requests" ON public.payment_requests;
CREATE POLICY "Users can view payment requests" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    solicitante_id = (SELECT auth.uid())
    OR autorizado_por_id = (SELECT auth.uid())
    OR department = (SELECT p.department FROM public.user_profiles p WHERE p.id = (SELECT auth.uid()))
    OR (SELECT public.current_user_has_permission('canApprovePayments'))
    OR (SELECT public.current_user_has_permission('canViewAllPayments'))
  );

-- Todos criam: o pedido nasce aguardando o gestor (ou já autorizado, se quem pede é o gestor).
DROP POLICY IF EXISTS "Users can insert payment requests" ON public.payment_requests;
CREATE POLICY "Users can insert payment requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status IN ('awaiting_authorization', 'pending')
    AND approved_by IS NULL
    AND approval_date IS NULL
    AND rejection_reason IS NULL
  );

COMMIT;
