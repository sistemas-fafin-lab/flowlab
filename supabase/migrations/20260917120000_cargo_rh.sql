-- ═══════════════════════════════════════════════════════════════════════════════
-- Cargo "RH"
-- Migration: 20260917120000_cargo_rh.sql
--
-- Novo cargo para quem trabalha no módulo de RH: mesmas permissions do cargo
-- "Solicitante" (canViewRequests, canAddRequests — seed em
-- 20260409120000_dynamic_roles_system.sql) somadas às permissions de RH
-- (canViewColaboradores, canManageHolerites — introduzidas em
-- 20260914150000_rh_colaboradores.sql e 20260916120000_rh_holerites.sql).
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO custom_roles (name, description, permissions, is_system) VALUES
(
  'RH',
  'Acesso ao módulo de RH (colaboradores e holerites), além de criar e visualizar solicitações do seu departamento.',
  '["canViewRequests", "canAddRequests", "canViewColaboradores", "canManageHolerites"]'::jsonb,
  false
)
ON CONFLICT (name) DO NOTHING;
