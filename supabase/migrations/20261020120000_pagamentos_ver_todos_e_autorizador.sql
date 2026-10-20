-- ═══════════════════════════════════════════════════════════════════════════════
-- Pagamentos: ver todos os setores e quem pode ser o autorizador
-- Migration: 20261020120000_pagamentos_ver_todos_e_autorizador.sql
--
-- Pedido do usuário (20/Out):
--   1. "uma permissão para que alguém consiga visualizar todas as solicitações, de todos
--      os departamentos". Até aqui, só canApprovePayments via todos os setores, e junto vinham
--      aprovar, rejeitar, marcar como pago e excluir.
--   2. "um usuário nunca poderá ser o autorizador, a não ser que tenha uma permissão
--      específica para isso". "Autorizado por" era texto livre: qualquer nome servia,
--      inclusive o de quem fazia o pedido.
--
-- O que muda:
--   1. Chaves novas (o cargo Administrador recebe; nos outros, marque em Cargos e Permissões):
--        canViewAllPayments     Ver pagamentos de todos os setores (só leitura)
--        canAuthorizePayments   Ser o autorizador de pedidos de pagamento
--   2. payment_requests ganha autorizado_por_id (quem autorizou) e solicitante_id (quem pediu).
--      Pedidos antigos ficam com NULL nas duas e continuam como estão.
--   3. Trigger: com usuário logado, o autorizador precisa ter canAuthorizePayments, e o nome
--      gravado em autorizado_por vem do perfil dele; solicitante_id é sempre quem está logado.
--      Sem usuário logado (SQL Editor, chave de serviço), não checa nada, como em
--      quotation_guard_info_edit.
--   4. Policies: até aqui, qualquer pessoa logada lia, alterava e excluía qualquer pedido pela
--      API (USING true); o recorte por setor existia só na tela. Agora:
--        ler               o próprio pedido, os do seu setor, ou todos com canApprovePayments
--                          ou canViewAllPayments (a mesma regra da tela);
--        criar             só como pendente;
--        alterar, excluir  canApprovePayments (aprovar, rejeitar, marcar como pago, excluir).
--   5. O código do pedido (DD/MM - NN) contava os pedidos do dia com um SELECT; com a leitura
--      recortada, a contagem passa por uma função que vê todos os pedidos.
--
-- Aplique junto com o front: o front antigo não manda autorizado_por_id e o trigger recusa.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CHAVES NOVAS NO CARGO ADMINISTRADOR
-- ═══════════════════════════════════════════════════════════════════════════════

-- O cargo Administrador tem todas as chaves do catálogo (src/utils/permissions.test.ts).
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewAllPayments"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewAllPayments';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canAuthorizePayments"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canAuthorizePayments';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. QUEM AUTORIZOU E QUEM PEDIU
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS autorizado_por_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS solicitante_id UUID DEFAULT auth.uid()
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.payment_requests.autorizado_por_id IS 'Quem autorizou: uma pessoa cujo cargo tem canAuthorizePayments na hora do pedido. NULL em pedidos anteriores a 2026-10-20.';
COMMENT ON COLUMN public.payment_requests.autorizado_por IS 'Nome de quem autorizou. Desde 2026-10-20, o trigger payment_request_guard copia do perfil de autorizado_por_id.';
COMMENT ON COLUMN public.payment_requests.solicitante_id IS 'Quem fez o pedido (auth.uid() na criação, gravado pelo trigger). NULL em pedidos anteriores a 2026-10-20.';

CREATE INDEX IF NOT EXISTS idx_payment_requests_solicitante_id ON public.payment_requests(solicitante_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGER: SÓ QUEM TEM A PERMISSÃO É O AUTORIZADOR
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.payment_request_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  -- Sem usuário logado (SQL Editor, chave de serviço): é a saída de emergência.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.solicitante_id := auth.uid();
  ELSE
    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id THEN
      RAISE EXCEPTION 'O solicitante de um pedido de pagamento não muda.' USING ERRCODE = '42501';
    END IF;
    IF NEW.autorizado_por_id IS NOT DISTINCT FROM OLD.autorizado_por_id
       AND NEW.autorizado_por IS NOT DISTINCT FROM OLD.autorizado_por THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.autorizado_por_id IS NULL THEN
    RAISE EXCEPTION 'Escolha quem autorizou o pagamento.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_has_permission(NEW.autorizado_por_id, 'canAuthorizePayments') THEN
    RAISE EXCEPTION 'Essa pessoa não pode autorizar pagamentos: o cargo dela não tem a permissão Ser autorizador de pagamentos.' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_nome FROM user_profiles WHERE id = NEW.autorizado_por_id;
  NEW.autorizado_por := v_nome;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payment_request_guard() IS 'Pedido de pagamento: com usuário logado, solicitante_id é quem está logado e não muda, e o autorizador (autorizado_por_id) precisa ter canAuthorizePayments; o nome em autorizado_por vem do perfil dele. Sem usuário (SQL), sem checagem.';

DROP TRIGGER IF EXISTS trigger_payment_request_guard ON public.payment_requests;
CREATE TRIGGER trigger_payment_request_guard
  BEFORE INSERT OR UPDATE OF autorizado_por, autorizado_por_id, solicitante_id
  ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_request_guard();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. FUNÇÕES DA TELA
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Quem pode ser escolhido em "Autorizado por" ──────────────────────────────
-- A mesma regra do trigger (user_has_permission): ativo, não removido, cargo com a chave.
CREATE OR REPLACE FUNCTION public.payment_request_autorizadores()
RETURNS TABLE (id UUID, name TEXT, department TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.department
    FROM user_profiles p
    JOIN custom_roles cr ON cr.id = p.custom_role_id
   WHERE auth.uid() IS NOT NULL
     AND p.deleted_at IS NULL
     AND p.disabled_at IS NULL
     AND cr.permissions ? 'canAuthorizePayments'
   ORDER BY p.name;
$$;

COMMENT ON FUNCTION public.payment_request_autorizadores() IS 'Pessoas ativas cujo cargo tem canAuthorizePayments: as opções de "Autorizado por" no pedido de pagamento.';

REVOKE ALL ON FUNCTION public.payment_request_autorizadores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_request_autorizadores() TO authenticated;

-- ─── Sequência do código do pedido ────────────────────────────────────────────
-- generatePedidoCode (src/utils/paymentUtils.ts) numera pelos pedidos já criados no dia,
-- de todos os setores. Com a leitura recortada, o SELECT direto contaria só os visíveis.
CREATE OR REPLACE FUNCTION public.payment_requests_criados_entre(p_inicio TIMESTAMPTZ, p_fim TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
    FROM payment_requests
   WHERE auth.uid() IS NOT NULL
     AND created_at >= p_inicio
     AND created_at < p_fim;
$$;

COMMENT ON FUNCTION public.payment_requests_criados_entre(timestamptz, timestamptz) IS 'Quantos pedidos de pagamento, de todos os setores, foram criados no intervalo [p_inicio, p_fim). Numera o código do pedido do dia.';

REVOKE ALL ON FUNCTION public.payment_requests_criados_entre(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_requests_criados_entre(timestamptz, timestamptz) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mesma regra de matchesUserAccess em PaymentRequestManagement.tsx. O próprio pedido entra
-- também porque o INSERT ... RETURNING do app precisa enxergar a linha que acabou de criar,
-- mesmo para quem não tem setor.
DROP POLICY IF EXISTS "Users can view payment requests" ON public.payment_requests;
CREATE POLICY "Users can view payment requests" ON public.payment_requests
  FOR SELECT TO authenticated
  USING (
    solicitante_id = (SELECT auth.uid())
    OR department = (SELECT p.department FROM public.user_profiles p WHERE p.id = (SELECT auth.uid()))
    OR (SELECT public.current_user_has_permission('canApprovePayments'))
    OR (SELECT public.current_user_has_permission('canViewAllPayments'))
  );

DROP POLICY IF EXISTS "Users can insert payment requests" ON public.payment_requests;
CREATE POLICY "Users can insert payment requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND approved_by IS NULL
    AND approval_date IS NULL
    AND rejection_reason IS NULL
  );

DROP POLICY IF EXISTS "Users can update payment requests" ON public.payment_requests;
CREATE POLICY "Users can update payment requests" ON public.payment_requests
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_has_permission('canApprovePayments')))
  WITH CHECK ((SELECT public.current_user_has_permission('canApprovePayments')));

DROP POLICY IF EXISTS "Users can delete payment requests" ON public.payment_requests;
CREATE POLICY "Users can delete payment requests" ON public.payment_requests
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_has_permission('canApprovePayments')));

COMMIT;
