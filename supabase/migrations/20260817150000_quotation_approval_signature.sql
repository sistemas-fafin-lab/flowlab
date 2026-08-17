-- Adiciona captura de assinatura do aprovador em quotation_approvals.
-- A tabela já existia (20260219120000_expand_quotations_module.sql) mas nunca
-- era escrita pelo código; esta migration só acrescenta as colunas necessárias
-- para guardar o traço da assinatura e o cargo do aprovador no momento da
-- aprovação/rejeição.

ALTER TABLE quotation_approvals
  ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS signature_image TEXT;
