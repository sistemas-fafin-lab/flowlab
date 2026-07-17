-- ─────────────────────────────────────────────────────────────────────────────
-- Seed DEV (projeto "FlowLab - test") — Fase 5. NÃO usar em produção.
-- Roda após as migrations no `supabase db reset`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Locais (equivalente ao seed da aditiva) + controla_consumo LIGADO na Bio Molecular
INSERT INTO stock_locations (nome, department, is_principal, rastreavel, controla_consumo) VALUES
  ('Estoque',                'Estoque',            true,  true,  false),
  ('Depósito',               'Estoque',            false, true,  false),
  ('Copa',                   'Copa/Limpeza',       false, false, false),
  ('Biologia Molecular',     'Biologia Molecular', false, true,  true),
  ('Faturamento/Financeiro', 'Faturamento',        false, true,  false),
  -- Qualidade: estoque central que distribui para os postos (controla consumo, sem posto_id)
  ('Qualidade',              'Qualidade',          false, true,  true)
ON CONFLICT (nome) DO NOTHING;

-- 1b) Um estoque departamental por posto (posto_id preenchido → a tela trata como
-- "posto": só consumo/vencimento, sem transferência). Gerado a partir de ac_postos;
-- se ac_postos estiver vazio no reset, nenhum posto é criado (rode o seed de postos antes).
INSERT INTO stock_locations (nome, department, is_principal, rastreavel, controla_consumo, posto_id)
SELECT 'Posto — ' || p.nome, p.nome, false, true, true, p.id
FROM ac_postos p
ON CONFLICT (nome) DO NOTHING;

-- 2) Produtos de teste
INSERT INTO products (name, code, category, unit, entry_date, expiration_date, location, min_stock)
VALUES
  ('Papel A4',          'PAP-001', 'general',   'resma',  '2026-01-01', '2027-01-01', 'Estoque',            5),
  ('Luva Nitrílica M',  'LUV-001', 'technical', 'caixa',  '2026-01-01', '2027-01-01', 'Estoque',            10),
  ('Reagente PCR',      'REA-001', 'technical', 'frasco', '2026-01-01', '2026-12-01', 'Biologia Molecular', 3),
  ('Álcool 70%',        'ALC-001', 'general',   'litro',  '2026-01-01', '2027-06-01', 'Depósito',           8);

-- 3) Saldo inicial por local → dispara o trigger de cache (products.quantity = SUM)
INSERT INTO product_stock (product_id, location_id, quantity)
SELECT p.id, l.id, v.qtd
FROM (VALUES
  ('PAP-001', 'Estoque',            50),
  ('LUV-001', 'Estoque',            40),
  ('ALC-001', 'Depósito',           30),
  ('REA-001', 'Biologia Molecular', 20)   -- já "em posse" do setor que controla consumo
) AS v(code, local, qtd)
JOIN products p ON p.code = v.code
JOIN stock_locations l ON l.nome = v.local;
