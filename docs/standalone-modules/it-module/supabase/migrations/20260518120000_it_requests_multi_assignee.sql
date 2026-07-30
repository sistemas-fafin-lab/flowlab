-- Migra assigned_to de UUID (FK) para UUID[] (array de múltiplos responsáveis)

-- Remove FK constraint e índice simples antigos
ALTER TABLE it_requests DROP CONSTRAINT IF EXISTS it_requests_assigned_to_fkey;
DROP INDEX IF EXISTS idx_it_requests_assigned_to;

-- Converte coluna: NULL → array vazio, valor único → ARRAY[valor]
ALTER TABLE it_requests
  ALTER COLUMN assigned_to TYPE UUID[]
  USING CASE
    WHEN assigned_to IS NULL THEN ARRAY[]::UUID[]
    ELSE ARRAY[assigned_to]
  END;

ALTER TABLE it_requests ALTER COLUMN assigned_to SET DEFAULT ARRAY[]::UUID[];
ALTER TABLE it_requests ALTER COLUMN assigned_to SET NOT NULL;

-- Índice GIN para queries eficientes com @> (array contains)
CREATE INDEX idx_it_requests_assigned_to ON it_requests USING GIN(assigned_to);
