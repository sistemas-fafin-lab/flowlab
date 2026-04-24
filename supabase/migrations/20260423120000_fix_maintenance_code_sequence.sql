-- ============================================
-- FIX: Substituir MAX+1 por sequence no código de manutenção
-- Motivo: race condition causava duplicate key em concurrent inserts
-- ============================================

-- 1. Criar a sequence iniciando do maior número já existente (ou 1)
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5) AS INTEGER)), 0)
  INTO max_num
  FROM maintenance_requests
  WHERE codigo ~ '^MNT-[0-9]+$';

  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS maintenance_requests_codigo_seq START WITH %s INCREMENT BY 1 NO CYCLE',
    max_num + 1
  );
END;
$$;

-- 2. Substituir a função para usar nextval (operação atômica, sem race condition)
CREATE OR REPLACE FUNCTION generate_maintenance_code()
RETURNS TRIGGER AS $$
DECLARE
  next_id INTEGER;
BEGIN
  next_id := nextval('maintenance_requests_codigo_seq');
  NEW.codigo = 'MNT-' || LPAD(next_id::TEXT, 4, '0');
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
