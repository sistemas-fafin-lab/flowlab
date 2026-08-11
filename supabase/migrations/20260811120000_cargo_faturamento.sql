-- ═══════════════════════════════════════════════════════════════════════════════
-- Cargo "Faturamento"
-- Migration: 20260811120000_cargo_faturamento.sql
--
-- Novo cargo para quem trabalha no módulo de Faturamento: mesmas permissions do
-- cargo "Solicitante" (canViewRequests, canAddRequests — seed em
-- 20260409120000_dynamic_roles_system.sql) somadas às permissions de faturamento
-- (canViewBilling, canManageBilling — introduzida em 20260807120000_contas_receber.sql).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO custom_roles (name, description, permissions, is_system) VALUES
(
  'Faturamento',
  'Acesso ao módulo de Faturamento, além de criar e visualizar solicitações do seu departamento.',
  '["canViewBilling", "canManageBilling", "canViewRequests", "canAddRequests"]'::jsonb,
  false
)
ON CONFLICT (name) DO NOTHING;
