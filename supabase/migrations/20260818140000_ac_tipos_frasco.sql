-- ═══════════════════════════════════════════════════════════════════════════════
-- Temperatura — catálogo de tipos de frasco + contagem por leitura
--
--   • ac_tipos_frasco — catálogo gerenciável (Urina, Fezes, ...); desativação via
--                       `ativo = false`, nunca DELETE físico.
--   • ac_temperatura_frascos — quantidade de cada tipo de frasco transportada numa
--                       leitura de ac_temperaturas (0..N por leitura, opcional).
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com o resto do módulo. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. ac_tipos_frasco ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_tipos_frasco (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ac_tipos_frasco_updated_at ON ac_tipos_frasco;
CREATE TRIGGER trg_ac_tipos_frasco_updated_at
  BEFORE UPDATE ON ac_tipos_frasco
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- Seed inicial — só na criação da tabela (evita reinserir em reruns da migration).
INSERT INTO ac_tipos_frasco (nome)
SELECT * FROM (VALUES ('Urina'), ('Fezes')) AS seed(nome)
WHERE NOT EXISTS (SELECT 1 FROM ac_tipos_frasco);

-- ─── 2. ac_temperatura_frascos (contagem por leitura) ────────────────────────
-- ON DELETE RESTRICT em tipo_frasco_id: impede apagar fisicamente um tipo já
-- usado numa leitura — desativar é sempre via ac_tipos_frasco.ativo = false.
CREATE TABLE IF NOT EXISTS ac_temperatura_frascos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temperatura_id  uuid NOT NULL REFERENCES ac_temperaturas(id) ON DELETE CASCADE,
  tipo_frasco_id  uuid NOT NULL REFERENCES ac_tipos_frasco(id) ON DELETE RESTRICT,
  quantidade      integer NOT NULL CHECK (quantidade > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (temperatura_id, tipo_frasco_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_temperatura_frascos_temp ON ac_temperatura_frascos(temperatura_id);

-- ─── 3. RLS — permissiva por authenticated (gate real = frontend) ────────────
ALTER TABLE ac_tipos_frasco ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_temperatura_frascos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_tipos_frasco_select_all"  ON ac_tipos_frasco;
DROP POLICY IF EXISTS "ac_tipos_frasco_insert_auth" ON ac_tipos_frasco;
DROP POLICY IF EXISTS "ac_tipos_frasco_update_auth" ON ac_tipos_frasco;
CREATE POLICY "ac_tipos_frasco_select_all"  ON ac_tipos_frasco FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_tipos_frasco_insert_auth" ON ac_tipos_frasco FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_tipos_frasco_update_auth" ON ac_tipos_frasco FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Mesmo grau de permissividade de ac_temperaturas: log associado à leitura, sem
-- UPDATE (a leitura não se corrige, se refaz); DELETE liberado para permitir
-- corrigir um registro errado logo após o cadastro.
DROP POLICY IF EXISTS "ac_temperatura_frascos_select_all"  ON ac_temperatura_frascos;
DROP POLICY IF EXISTS "ac_temperatura_frascos_insert_auth" ON ac_temperatura_frascos;
DROP POLICY IF EXISTS "ac_temperatura_frascos_delete_auth" ON ac_temperatura_frascos;
CREATE POLICY "ac_temperatura_frascos_select_all"  ON ac_temperatura_frascos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_temperatura_frascos_insert_auth" ON ac_temperatura_frascos FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_temperatura_frascos_delete_auth" ON ac_temperatura_frascos FOR DELETE TO authenticated USING (TRUE);

-- ─── 4. ac_registrar_temperatura — leitura + frascos numa transação só ───────
-- Insere a leitura e, se houver frascos, as linhas filhas correspondentes numa
-- única invocação: se alguma quantidade for inválida a função inteira reverte
-- (nenhum INSERT desta chamada fica de pé), evitando leitura órfã sem frascos.
DROP FUNCTION IF EXISTS ac_registrar_temperatura(uuid, numeric, text, text, timestamptz, jsonb);
CREATE OR REPLACE FUNCTION ac_registrar_temperatura(
  p_equipamento_id uuid,
  p_temperatura    numeric,
  p_registrado_por text,
  p_observacao     text,
  p_registrado_em  timestamptz,
  p_frascos        jsonb DEFAULT '[]'  -- [{ tipo_frasco_id, quantidade }, ...]
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_temperatura_id uuid;
  item jsonb;
  v_tipo_id uuid;
  v_qtd int;
BEGIN
  INSERT INTO ac_temperaturas (equipamento_id, temperatura, registrado_por, observacao, registrado_em)
  VALUES (p_equipamento_id, p_temperatura, p_registrado_por, NULLIF(p_observacao, ''), p_registrado_em)
  RETURNING id INTO v_temperatura_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_frascos, '[]'::jsonb))
  LOOP
    v_tipo_id := (item->>'tipo_frasco_id')::uuid;
    v_qtd := (item->>'quantidade')::int;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    INSERT INTO ac_temperatura_frascos (temperatura_id, tipo_frasco_id, quantidade)
    VALUES (v_temperatura_id, v_tipo_id, v_qtd);
  END LOOP;

  RETURN v_temperatura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION ac_registrar_temperatura(uuid, numeric, text, text, timestamptz, jsonb) TO authenticated;
