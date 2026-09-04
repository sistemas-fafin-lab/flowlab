-- Issue 44: auditoria (motivo, data, responsável) das exceções de operadora.
--
-- Mesmo shape de quotation_audit_logs (20260219120000_expand_quotations_module.sql),
-- trocando quotation_id por operadora_id: tabela append-only, sem UPDATE/DELETE
-- policy, compartilhada pelas 3 flags atuais (is_clinica_parceira,
-- nf_apos_pagamento, is_considerada_meta) e por flags futuras do mesmo tipo.

CREATE TABLE IF NOT EXISTS operadoras_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora_id UUID NOT NULL REFERENCES operadoras(id_operadora) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  valor_anterior BOOLEAN,
  valor_novo BOOLEAN,
  motivo TEXT,
  performed_by UUID NOT NULL,
  performed_by_name TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT operadoras_audit_logs_campo_check
    CHECK (campo IN ('is_clinica_parceira', 'nf_apos_pagamento', 'is_considerada_meta'))
);

CREATE INDEX IF NOT EXISTS idx_operadoras_audit_logs_operadora
  ON operadoras_audit_logs(operadora_id);
CREATE INDEX IF NOT EXISTS idx_operadoras_audit_logs_performed_at
  ON operadoras_audit_logs(performed_at DESC);

-- RLS: mesmo gate de `operadoras` (20260807120000_contas_receber.sql) —
-- canViewBilling/canManageBilling para ler, canManageBilling para inserir.
-- Sem policy de UPDATE/DELETE: log de auditoria não deve ser alterável.
ALTER TABLE operadoras_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operadoras_audit_logs_select_billing" ON operadoras_audit_logs;
DROP POLICY IF EXISTS "operadoras_audit_logs_insert_billing" ON operadoras_audit_logs;

CREATE POLICY "operadoras_audit_logs_select_billing" ON operadoras_audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "operadoras_audit_logs_insert_billing" ON operadoras_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
