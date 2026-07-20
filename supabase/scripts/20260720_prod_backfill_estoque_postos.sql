-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL — criar o estoque departamental dos POSTOS existentes (PRODUÇÃO)
-- Data: 2026-07-20
--
-- Um posto só aparece na tela de Estoque Departamental se houver uma linha em
-- stock_locations com o posto_id dele. O app cria essa linha automaticamente ao
-- cadastrar o posto pela tela (usePostos.createPosto), mas postos que já existiam
-- em ac_postos ANTES disso não têm estoque departamental e não aparecem.
--
-- Este script cria 1 stock_location por posto real de prod que ainda não tenha um,
-- espelhando exatamente o que o app faz (rastreavel + controla_consumo, posto_id).
-- Carrega o `ativo` do próprio posto.
--
-- IDEMPOTENTE: ON CONFLICT (nome) DO NOTHING — reaplicar não duplica.
-- REVISAR antes de rodar. Rodar no projeto de PRODUÇÃO (pooler IPv4).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO stock_locations (nome, department, is_principal, rastreavel, controla_consumo, posto_id, ativo)
SELECT 'Posto — ' || p.nome, p.nome, false, true, true, p.id, p.ativo
  FROM ac_postos p
  LEFT JOIN stock_locations sl ON sl.posto_id = p.id
 WHERE sl.id IS NULL
ON CONFLICT (nome) DO NOTHING;

COMMIT;

-- Verificação — deve listar um "Posto — <nome>" para cada posto de ac_postos.
SELECT sl.nome, sl.department, sl.ativo, sl.rastreavel, sl.controla_consumo, sl.posto_id
  FROM stock_locations sl
 WHERE sl.posto_id IS NOT NULL
 ORDER BY sl.nome;
