-- Adiciona assinatura eletrônica (hash) do aprovador em quotation_approvals.
-- A tabela já existia (20260219120000_expand_quotations_module.sql) mas nunca
-- era escrita pelo código; esta migration só acrescenta as colunas necessárias
-- para guardar o hash de verificação da aprovação e o cargo do aprovador no
-- momento da aprovação/rejeição.

ALTER TABLE quotation_approvals
  ADD COLUMN IF NOT EXISTS approver_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64);
