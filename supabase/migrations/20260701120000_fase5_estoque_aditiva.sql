/*
  # Fase 5 — Estoque Departamental — Parte 1: ADITIVA (segura)

  Plano: docs/PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md (Parte A)

  Esta migration é PURAMENTE ADITIVA — NÃO muda o comportamento do sistema:
    • cria stock_locations e product_stock (+ seed a partir do estoque atual);
    • adiciona colunas from/to_location_id em stock_movements e relaxa CHECKs
      (só PERMITE novos valores; nada os insere ainda);
    • habilita RLS permissiva nas tabelas novas.

  O trigger antigo (update_stock_on_movement) é MANTIDO intacto: products.quantity
  continua sendo a fonte da verdade, geradas pelas mesmas movimentações de hoje.
  product_stock nasce como um SNAPSHOT do estoque atual e NÃO é mantido por esta
  migration — ele só passa a valer no cutover (20260701130000_..._cutover.sql),
  que troca o trigger e liga o cache. Aplicar esta aqui sozinha = zero mudança.

  Migration DEFENSIVA (§2.5) e idempotente.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. stock_locations — lista plana de locais (§3.1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_locations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL,
  department       text,                                 -- rótulo de setor p/ escopo/visibilidade
  posto_id         uuid REFERENCES ac_postos(id),        -- preenchido só quando o local é uma clínica de AC
  is_principal     boolean NOT NULL DEFAULT false,       -- exatamente 1 = destino/origem default
  rastreavel       boolean NOT NULL DEFAULT true,        -- false = nunca mantém saldo em product_stock (§4.1)
  controla_consumo boolean NOT NULL DEFAULT false,       -- true = consumo em 2 etapas (§4.2). Exige rastreavel=true.
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_stock_locations_consumo_rastreavel CHECK (NOT controla_consumo OR rastreavel),
  CONSTRAINT uq_stock_locations_nome UNIQUE (nome)
);

-- garante no máximo um local principal
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_locations_principal
  ON stock_locations (is_principal) WHERE is_principal;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. product_stock — saldo por local rastreável (§3.2)
--    Nesta fase é apenas um SNAPSHOT; a fonte da verdade continua products.quantity.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_stock (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES stock_locations(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_product_stock_location ON product_stock(location_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. stock_movements — origem/destino + relaxar CHECKs (§3.3)
--    Só ADICIONA colunas nulas e AMPLIA os CHECKs. Nenhum fluxo atual muda.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS from_location_id uuid REFERENCES stock_locations(id),
  ADD COLUMN IF NOT EXISTS to_location_id   uuid REFERENCES stock_locations(id);

-- relaxar o CHECK de type (versionado: só 'out') para incluir entrada e transferência
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check CHECK (type IN ('out','in','transfer'));

-- relaxar o CHECK de reason: superset de TODOS os valores que o app já usa
-- (incl. 'manutencao', que não está no arquivo versionado mas existe em produção)
-- + 'purchase' (recebimento/entrada de NF).
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('sale','internal-transfer','return','internal-consumption','manutencao','other','purchase'));

CREATE INDEX IF NOT EXISTS idx_stock_movements_from_location ON stock_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_location   ON stock_movements(to_location_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed / promoção de products.location (§5)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 — 5 locais canônicos
INSERT INTO stock_locations (nome, department, is_principal, rastreavel) VALUES
  ('Estoque',                'Estoque',            true,  true),
  ('Depósito',               'Estoque',            false, true),
  ('Copa',                   'Copa/Limpeza',       false, false),
  ('Biologia Molecular',     'Biologia Molecular', false, true),
  ('Faturamento/Financeiro', 'Faturamento',        false, true)
ON CONFLICT (nome) DO NOTHING;

-- 4.2 — snapshot: uma linha por produto com a quantidade ATUAL, no local mapeado.
--       Copa é não-rastreável ⇒ produtos hoje em "Copa" vão para o PRINCIPAL
--       (Estoque) para não zerar o total. Fallback = principal.
--       Sem trigger de cache nesta fase ⇒ products.quantity NÃO é tocado.
INSERT INTO product_stock (product_id, location_id, quantity)
SELECT
  p.id,
  CASE
    WHEN lower(btrim(p.location)) IN ('depósito', 'deposito')
      THEN (SELECT id FROM stock_locations WHERE nome = 'Depósito')
    WHEN p.location ILIKE '%biologia%molecular%'
      THEN (SELECT id FROM stock_locations WHERE nome = 'Biologia Molecular')
    WHEN p.location ILIKE '%faturamento%' OR p.location ILIKE '%financeiro%'
      THEN (SELECT id FROM stock_locations WHERE nome = 'Faturamento/Financeiro')
    ELSE (SELECT id FROM stock_locations WHERE is_principal LIMIT 1)
  END,
  p.quantity
FROM products p
ON CONFLICT (product_id, location_id) DO NOTHING;

-- NB: controla_consumo nasce false para todos (§2.7). Ligar por departamento é
-- feito sob demanda, fora desta migration:
--   UPDATE stock_locations SET controla_consumo = true WHERE department = '…';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS permissiva (§8) — consistente com products/stock_movements (USING true)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read stock_locations"   ON stock_locations;
DROP POLICY IF EXISTS "authenticated insert stock_locations" ON stock_locations;
DROP POLICY IF EXISTS "authenticated update stock_locations" ON stock_locations;
DROP POLICY IF EXISTS "authenticated delete stock_locations" ON stock_locations;
CREATE POLICY "authenticated read stock_locations"
  ON stock_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert stock_locations"
  ON stock_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update stock_locations"
  ON stock_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete stock_locations"
  ON stock_locations FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read product_stock"   ON product_stock;
DROP POLICY IF EXISTS "authenticated insert product_stock" ON product_stock;
DROP POLICY IF EXISTS "authenticated update product_stock" ON product_stock;
DROP POLICY IF EXISTS "authenticated delete product_stock" ON product_stock;
CREATE POLICY "authenticated read product_stock"
  ON product_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert product_stock"
  ON product_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update product_stock"
  ON product_stock FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete product_stock"
  ON product_stock FOR DELETE TO authenticated USING (true);
