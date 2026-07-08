/*
  # Fase 5 — Estoque Departamental — Parte 2: CUTOVER

  Plano: docs/PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md (§6)

  ⚠️ Esta migration VIRA A CHAVE do multi-local. Ela DEVE ser aplicada JUNTO com o
  deploy do frontend da Parte B (§6.1 corrigido: "Adicionar Estoque" e cadastro de
  produto passam a usar receiveStock). Aplicá-la com o frontend antigo quebraria:
    • o botão "Adicionar Estoque" (escreve products.quantity direto → o cache zera);
    • baixa em produto recém-criado pelo form antigo (sem linha em product_stock);
    • baixa acima do saldo passa a falhar (antes ia a negativo).

  O que faz:
    1. Reconcilia product_stock com o products.quantity ATUAL (cura o drift ocorrido
       entre a migration aditiva e este cutover — enquanto o trigger antigo ainda
       mexia só em products.quantity). Assume snapshot de local único (verdadeiro
       até o frontend permitir distribuir), e é GUARDADA para não achatar produtos
       que já tenham sido distribuídos em vários locais (reaplicável com segurança).
    2. Liga o trigger de cache: products.quantity = SUM(product_stock).
    3. Troca update_stock_on_movement para operar em product_stock.

  Após este cutover, products.quantity vira CACHE derivado; product_stock é a verdade.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reconciliar product_stock com o estoque atual (cura o drift da janela)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 — produtos criados na janela (via form antigo) ainda não têm linha: cria.
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
WHERE NOT EXISTS (SELECT 1 FROM product_stock ps WHERE ps.product_id = p.id)
ON CONFLICT (product_id, location_id) DO NOTHING;

-- 1.2 — ressincroniza o saldo do ÚNICO local de cada produto com o quantity atual.
--       Guarda: só toca produtos com exatamente 1 local (snapshot pré-distribuição).
--       Produtos já distribuídos (>1 local) NÃO são achatados → reaplicável.
UPDATE product_stock ps
   SET quantity = p.quantity, updated_at = now()
  FROM products p
 WHERE ps.product_id = p.id
   AND (SELECT count(*) FROM product_stock ps2 WHERE ps2.product_id = p.id) = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger de cache: products.quantity = SUM(product_stock) (§3.4)
--    A UPDATE em products dispara o trigger existente update_product_status
--    (BEFORE UPDATE), que recalcula status/updated_at a partir do novo quantity.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_product_quantity_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products
     SET quantity = COALESCE((
           SELECT SUM(quantity) FROM product_stock WHERE product_id = v_product_id
         ), 0)
   WHERE id = v_product_id;
  RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_product_quantity_cache ON product_stock;
CREATE TRIGGER trigger_sync_product_quantity_cache
  AFTER INSERT OR UPDATE OR DELETE ON product_stock
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_quantity_cache();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Substitui update_stock_on_movement: deltas em product_stock (§6)
--    products.quantity nunca é escrito aqui — só pelo trigger de cache acima
--    (regra anti-duplicidade).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_to_rastreavel boolean;
  v_legacy_loc    uuid;
BEGIN
  -- DÉBITO na origem ------------------------------------------------------------
  IF NEW.from_location_id IS NOT NULL THEN
    UPDATE product_stock
       SET quantity = quantity - NEW.quantity, updated_at = now()
     WHERE product_id = NEW.product_id AND location_id = NEW.from_location_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não possui saldo no local de origem %',
        NEW.product_id, NEW.from_location_id;
    END IF;

  ELSIF NEW.type = 'out' THEN
    -- LEGADO: out sem from_location_id (fluxo antigo). Debita do local que hoje
    -- detém o saldo; fallback = principal. (A Parte B passa a enviar o local.)
    SELECT location_id INTO v_legacy_loc
      FROM product_stock
     WHERE product_id = NEW.product_id AND quantity > 0
     ORDER BY quantity DESC
     LIMIT 1;
    IF v_legacy_loc IS NULL THEN
      SELECT id INTO v_legacy_loc FROM stock_locations WHERE is_principal LIMIT 1;
    END IF;
    UPDATE product_stock
       SET quantity = quantity - NEW.quantity, updated_at = now()
     WHERE product_id = NEW.product_id AND location_id = v_legacy_loc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % sem saldo em product_stock para baixa legada',
        NEW.product_id;
    END IF;
  END IF;

  -- CRÉDITO no destino (só se rastreável — §4.1) --------------------------------
  IF NEW.to_location_id IS NOT NULL THEN
    SELECT rastreavel INTO v_to_rastreavel
      FROM stock_locations WHERE id = NEW.to_location_id;
    IF v_to_rastreavel THEN
      INSERT INTO product_stock (product_id, location_id, quantity)
      VALUES (NEW.product_id, NEW.to_location_id, NEW.quantity)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = product_stock.quantity + EXCLUDED.quantity,
                    updated_at = now();
    END IF;
    -- destino não-rastreável: nada em product_stock; a movimentação em si já foi
    -- gravada pelo INSERT que disparou este trigger (log de auditoria).
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- o trigger já existe (AFTER INSERT em stock_movements) e passa a usar o novo
-- corpo; recriado por idempotência/clareza.
DROP TRIGGER IF EXISTS trigger_update_stock_on_movement ON stock_movements;
CREATE TRIGGER trigger_update_stock_on_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_movement();
