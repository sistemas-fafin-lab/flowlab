/*
  # Fase 4 (Análises Clínicas) — permissão `canManageColetas` + cargo "analistaSaude"

  Fundação de permissões para a operação interna do laboratório (coleta/recoleta
  na Fase 6, análise na Fase 7). A key `canManageColetas` é registrada no app em
  `src/utils/permissions.ts` (ALL_PERMISSION_KEYS, grupo "Análises Clínicas").

  1. Seed do cargo de sistema "analistaSaude" (custom role, is_system = true)
     - canViewAnalisesClinicas (ver agendamentos) + canManageColetas (operação)
     - NÃO recebe canManageAnalisesClinicas (gestão de postos/horários é do gerente)

  2. Backfill dos cargos de sistema "Administrador" e "Operador"
     - Os arrays de permissão seedados em 20260409120000 nunca receberam as
       permissões de Análises Clínicas (Fases 2–3). Corrige o gap latente para
       que usuários nesses cargos enxerguem o módulo, e adiciona canManageColetas.

  Idempotente: ON CONFLICT (name) DO NOTHING no seed; o backfill faz merge com
  dedup, então reaplicar não duplica permissões.
*/

-- 1. Cargo de sistema "analistaSaude"
INSERT INTO custom_roles (id, name, description, permissions, is_system) VALUES
(
  'a0000000-0000-0000-0000-000000000004',
  'analistaSaude',
  'Operação interna do laboratório: coletas, recoletas e análises. Acesso de leitura aos agendamentos.',
  '["canViewAnalisesClinicas", "canManageColetas"]'::jsonb,
  true
)
ON CONFLICT (name) DO NOTHING;

-- 2. Backfill das permissões de Análises Clínicas nos cargos de sistema
UPDATE custom_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM jsonb_array_elements_text(
    permissions || '["canViewAnalisesClinicas","canManageAnalisesClinicas","canManageColetas"]'::jsonb
  ) AS value
)
WHERE name IN ('Administrador', 'Operador');
