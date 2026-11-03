-- ═══════════════════════════════════════════════════════════════════════════════
-- Cargo "Faturista"
-- Migration: 20261030120000_cargo_faturista.sql
--
-- Para as funcionárias do faturamento que não veem o módulo inteiro
-- (.scratch/faturamento-calendario-envios/spec.md, seção Permissões; decisão em
-- docs/adr/0001-permissoes-faturamento-por-tela.md):
--   - canViewContasReceber: Contas a Receber só para ver; dar baixa e editar
--     título continuam exigindo canManageBilling;
--   - canViewCalendarioEnvios + canManageCalendarioEnvios: ver e gerir o
--     Calendário de envios;
--   - canViewRequests + canAddRequests: base do cargo "Solicitante" (criar e ver
--     solicitações do próprio departamento), como o antigo cargo "Faturamento"
--     (20260811120000).
-- Faturas, Glosas e Recursos e Indicadores ficam de fora.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO custom_roles (name, description, permissions, is_system) VALUES
(
  'Faturista',
  'Faturamento: Contas a Receber (só leitura) e Calendário de envios (gestão), além de criar e visualizar solicitações do seu departamento.',
  '["canViewContasReceber", "canViewCalendarioEnvios", "canManageCalendarioEnvios", "canViewRequests", "canAddRequests"]'::jsonb,
  false
)
ON CONFLICT (name) DO NOTHING;
