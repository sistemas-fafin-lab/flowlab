-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Tipo de chamado "Novo colaborador"
-- Migration: 20261001120000_it_requests_novo_colaborador.sql
--
-- Pedido de acesso de um novo colaborador (conta no FlowLab, e-mail/alias do
-- setor, apLIS). Os dados vão como texto padronizado em description — sem coluna
-- nova — e incluem CPF e e-mail pessoal. Por isso o SELECT deixa de ser aberto
-- a todo autenticado para esse tipo: só o solicitante e a TI leem — admin ou
-- canManageIT (via current_user_has_permission), departamento TI ou cargo
-- 'Desenvolvedor' (mesmo critério do isITManager no front). Os demais tipos
-- seguem como antes.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE it_requests
DROP CONSTRAINT IF EXISTS it_requests_request_type_check;

ALTER TABLE it_requests
ADD CONSTRAINT it_requests_request_type_check
CHECK (request_type IN ('suporte', 'desenvolvimento', 'consultoria', 'novo_colaborador'));

DROP POLICY IF EXISTS "it_requests_select_all" ON it_requests;
DROP POLICY IF EXISTS "it_requests_select" ON it_requests;

CREATE POLICY "it_requests_select"
  ON it_requests FOR SELECT
  TO authenticated
  USING (
    request_type <> 'novo_colaborador'
    OR requested_by = auth.uid()
    OR public.current_user_has_permission('canManageIT')
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN custom_roles cr ON cr.id = up.custom_role_id
      WHERE up.id = auth.uid()
        AND (up.department = 'TI' OR cr.name = 'Desenvolvedor')
    )
  );
