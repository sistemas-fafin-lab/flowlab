-- Mínimo de estoque POR LOCAL (par level) — coluna em product_stock.
--
-- Até aqui o piso de estoque era só products.min_stock (GLOBAL por produto). As telas de
-- estoque departamental e o dashboard de Análises Clínicas comparavam o saldo de UM local
-- contra esse mínimo global — o que dispara falso (um posto segura só uma fração) e não
-- deixa definir um piso próprio por posto/setor. Como o insumo já está no local (existe a
-- linha em product_stock), o mínimo por local mora nessa mesma linha.
--
-- Aditiva e idempotente. Independe de products.min_stock, que segue valendo no inventário
-- central. Os triggers de baixa (update_stock_on_movement) e de cache
-- (products.quantity = SUM(product_stock)) só mexem em quantity; o ON CONFLICT DO UPDATE do
-- recebimento preserva min_stock entre reposições. RLS de UPDATE em product_stock já libera
-- authenticated (20260701120000_fase5_estoque_aditiva.sql).

ALTER TABLE product_stock
  ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0);

COMMENT ON COLUMN product_stock.min_stock IS
  'Mínimo por local (par level) do produto neste estoque. 0 = sem mínimo. Independe de products.min_stock (piso global do inventário central).';
