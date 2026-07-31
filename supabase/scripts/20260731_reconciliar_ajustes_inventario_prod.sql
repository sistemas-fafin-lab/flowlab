-- ─────────────────────────────────────────────────────────────────────────────
-- Reconciliar product_stock com as contagens manuais — PRODUÇÃO
-- Data: 2026-07-31
--
-- Contexto: até hoje o campo "Quantidade" do modal de edição de produto gravava
-- direto em products.quantity (cache), sem tocar em product_stock (a verdade,
-- desde o cutover da Fase 5). O almoxarifado/compras usa esse campo como
-- contagem de inventário — 342 alterações registradas em product_change_logs,
-- 3 usuários, a mais recente em 31/07/2026.
--
-- Resultado: 22 produtos com products.quantity != SUM(product_stock). Em TODOS
-- eles o valor de products.quantity é a contagem manual (conferido 22/22 contra
-- o product_change_logs) — ou seja, a contagem está CERTA e o razão está velho.
--
-- ATENÇÃO: NÃO rode aqui o resync ao contrário (products.quantity = SUM(...)),
-- que foi o usado no ambiente de test. Em prod ele apagaria as 22 contagens.
--
-- O que este script faz: gera uma movimentação de ajuste (stock_movements) para
-- cada diferença, no local escolhido. Os triggers existentes fazem o resto —
-- update_stock_on_movement credita/debita product_stock e
-- sync_product_quantity_cache reescreve products.quantity com a mesma soma.
-- Fica trilha de auditoria, ao contrário de um UPDATE direto.
--
-- Regra usada para escolher o local (a mesma do novo ajuste na tela):
--   • diferença positiva  → credita no local com maior saldo; se nenhum tem
--     saldo, no principal (Estoque).
--   • diferença negativa  → debita dos locais com saldo, do maior para o menor,
--     até cobrir a diferença.
--
-- ►► REVISAR ANTES DE RODAR — casos com mais de um local envolvido:
--     ETQ001  zera 3 un: -2 no Estoque e -1 na Biologia Molecular
--     CHX001  baixa 6 un: -5 na Área técnica e -1 no Estoque
--     SAP001  baixa 1 un: escolhi o Depósito (Depósito=1, Estoque=1)
--     COR001  credita +3 no Estoque (tem saldo em Estoque=2 e Bio Molecular=1)
--     SAC006  credita +49 na Área técnica (é onde estão as 170; Estoque=0)
--     AMC002  credita +187 no Estoque — é a maior correção do lote
--             (Agua Mineral, "CORRECAO" de 22/07: 4 → 192, com troca de
--              unidade Caixa(s) → Unidade(s); confira se 192 é mesmo o certo)
--
-- IDEMPOTENTE: cada INSERT tem guarda por (produto, local, marcador
-- [recon-20260731]) nas notas — reaplicar não duplica.
-- Rodar no projeto de PRODUÇÃO (pooler IPv4), dentro da transação abaixo.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- LMA001 — Luva Multiuso Amarela: 4 → 6 Unidade(s)  (+2 em Depósito)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 2, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 4 → 6 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Depósito'),
       p.unit_price
  FROM products p
 WHERE p.code = 'LMA001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Depósito')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- LIB001 — Liga de Borracha: 6 → 5 Unidade(s)  (-1 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 1, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 6 → 5 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'LIB001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- ETQ001 — Etiqueta Triagem/Recepção Bopp 50X30: 3 → 0 Unidade(s)  (-2 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 2, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 3 → 0 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'ETQ001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- ETQ001 — Etiqueta Triagem/Recepção Bopp 50X30: 3 → 0 Unidade(s)  (-1 em Biologia Molecular)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 1, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 3 → 0 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Biologia Molecular'),
       p.unit_price
  FROM products p
 WHERE p.code = 'ETQ001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Biologia Molecular')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- ESP005 — Bucha: 1 → 3 Pacote(s)  (+2 em Depósito)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 2, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 1 → 3 Pacote(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Depósito'),
       p.unit_price
  FROM products p
 WHERE p.code = 'ESP005'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Depósito')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- CHX001 — Resma Pct C/500fls: 10 → 4 Pacote(s)  (-5 em Área técnica)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 5, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 10 → 4 Pacote(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Área técnica'),
       p.unit_price
  FROM products p
 WHERE p.code = 'CHX001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Área técnica')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- CHX001 — Resma Pct C/500fls: 10 → 4 Pacote(s)  (-1 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 1, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 10 → 4 Pacote(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'CHX001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- TIN002 — Tinta Impressora Epson T504 Cor Preto : 1 → 0 Unidade(s)  (-1 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 1, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 1 → 0 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'TIN002'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- SAP001 — Sapolio Audaz Facilita 300ml: 2 → 1 Unidade(s)  (-1 em Depósito)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 1, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 2 → 1 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Depósito'),
       p.unit_price
  FROM products p
 WHERE p.code = 'SAP001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Depósito')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- CAD003 — Caderno Pequeno 96 Folhas 140mm x 200mm: 0 → 6 Unidade(s)  (+6 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 6, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 0 → 6 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'CAD003'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- MTX004 — Marca Texto Verde: 0 → 12 Unidade(s)  (+12 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 12, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 0 → 12 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'MTX004'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- CAN001 — Caneta Compactor Azul: 36 → 31 Unidade(s)  (-5 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 5, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 36 → 31 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'CAN001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- CLI001 — Clips 4/0 Pequeno Caixa C/50un: 0 → 7 Caixa(s)  (+7 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 7, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 0 → 7 Caixa(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'CLI001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- MLD001 — Molha Dedo: 1 → 5 Unidade(s)  (+4 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 4, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 1 → 5 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'MLD001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- SAC001 — Saco De Lixo 110lts (Preto) Pacote C/100un: 4 → 2 Pacote(s)  (-2 em Depósito)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 2, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 4 → 2 Pacote(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Depósito'),
       p.unit_price
  FROM products p
 WHERE p.code = 'SAC001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Depósito')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- MTX005 — Marca Texto Amarelo: 0 → 9 Unidade(s)  (+9 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 9, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 0 → 9 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'MTX005'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- COR001 — Corretivo Em Fita: 3 → 6 Unidades  (+3 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 3, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 3 → 6 Unidades · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'COR001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- SAC006 — Sacola Lab Pequena: 170 → 219 Unidade(s)  (+49 em Área técnica)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 49, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 170 → 219 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Área técnica'),
       p.unit_price
  FROM products p
 WHERE p.code = 'SAC006'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Área técnica')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- AMC002 — Agua Mineral Copo C/200ml: 5 → 192 Unidade(s)  (+187 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, to_location_id, unit_price)
SELECT p.id, p.name, 'in', 'other', 187, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 5 → 192 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'AMC002'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.to_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- DET001 — Detergente 500ml: 22 → 17 Unidade(s)  (-5 em Depósito)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 5, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 22 → 17 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Depósito'),
       p.unit_price
  FROM products p
 WHERE p.code = 'DET001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Depósito')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- PAS001 — Pasta Sanfonada 12 Divisórias : 7 → 4 Unidade(s)  (-3 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 3, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 7 → 4 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'PAS001'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

-- ETQ005 — Etiqueta Identificação: 2 → 0 Unidade(s)  (-2 em Estoque)
INSERT INTO stock_movements
  (product_id, product_name, type, reason, quantity, date, authorized_by, notes, from_location_id, unit_price)
SELECT p.id, p.name, 'out', 'other', 2, CURRENT_DATE,
       'Reconciliação de inventário (script)',
       'Ajuste de inventário [recon-20260731]: 2 → 0 Unidade(s) · alinha product_stock com a contagem manual que estava em products.quantity',
       (SELECT id FROM stock_locations WHERE nome = 'Estoque'),
       p.unit_price
  FROM products p
 WHERE p.code = 'ETQ005'
   AND NOT EXISTS (
     SELECT 1 FROM stock_movements sm
      WHERE sm.product_id = p.id
        AND sm.from_location_id = (SELECT id FROM stock_locations WHERE nome = 'Estoque')
        AND sm.notes LIKE '%[recon-20260731]%'
   );

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificação — deve voltar ZERO linhas (nenhum produto divergente):
-- ─────────────────────────────────────────────────────────────────────────────
SELECT p.code,
       p.name,
       p.quantity                                   AS cache,
       COALESCE(SUM(s.quantity), 0)                 AS razao,
       p.quantity - COALESCE(SUM(s.quantity), 0)    AS diferenca
  FROM products p
  LEFT JOIN product_stock s ON s.product_id = p.id
 GROUP BY p.id, p.code, p.name, p.quantity
HAVING p.quantity IS DISTINCT FROM COALESCE(SUM(s.quantity), 0)
 ORDER BY ABS(p.quantity - COALESCE(SUM(s.quantity), 0)) DESC;
