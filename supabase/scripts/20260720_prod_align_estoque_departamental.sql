-- ─────────────────────────────────────────────────────────────────────────────
-- Alinhar o Estoque Departamental em PRODUÇÃO
-- Data: 2026-07-20
--
-- Contexto: em prod aparecem 3 setores (Estoque, Depósito, Biologia Molecular);
-- no ambiente de teste aparecem 7 porque lá o seed de DEV ligou consumo em mais
-- locais e criou o "Qualidade" + postos fake. Os setores são DADOS de
-- stock_locations (controla_consumo=true AND rastreavel=true AND ativo=true),
-- não código — por isso a divergência não migra sozinha.
--
-- Este script deixa prod com a configuração pretendida:
--   • CRIA o estoque central "Qualidade" (distribui p/ postos), com consumo ON.
--   • NÃO mexe em nenhum outro local: Estoque, Depósito, Biologia Molecular e
--     Faturamento continuam exatamente como estão.
--
-- IDEMPOTENTE: reaplicar não altera nada (guardas com IS DISTINCT FROM).
-- REVISAR antes de rodar. NÃO usar o supabase/seed.sql de DEV em produção.
-- Rodar no projeto de PRODUÇÃO (pooler IPv4).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1) Estoque central "Qualidade" (sem posto_id). controla_consumo exige
--    rastreavel=true (CHECK ck_stock_locations_consumo_rastreavel).
INSERT INTO stock_locations (nome, department, is_principal, rastreavel, controla_consumo)
VALUES ('Qualidade', 'Qualidade', false, true, true)
ON CONFLICT (nome) DO NOTHING;

-- Garante os flags mesmo que a linha já existisse com valores diferentes.
UPDATE stock_locations
   SET controla_consumo = true,
       rastreavel       = true,
       ativo            = true,
       updated_at       = now()
 WHERE nome = 'Qualidade'
   AND ( controla_consumo IS DISTINCT FROM true
      OR rastreavel       IS DISTINCT FROM true
      OR ativo            IS DISTINCT FROM true );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) (OPCIONAL — DEIXADO COMENTADO) Estoque departamental por POSTO.
--    Você optou por NÃO criar postos por este script. Quando quiser, os postos
--    devem sair do ac_postos REAL de prod (nunca os UUIDs fake do seed de DEV).
--    Descomente para criar 1 stock_location por posto real:
--
-- INSERT INTO stock_locations (nome, department, is_principal, rastreavel, controla_consumo, posto_id)
-- SELECT 'Posto — ' || p.nome, p.nome, false, true, true, p.id
--   FROM ac_postos p
--  ON CONFLICT (nome) DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────

COMMIT;

-- Verificação — como deve ficar prod após rodar (setores = as linhas com consumo ON):
--   os 3 atuais (Estoque, Depósito, Biologia Molecular) + Qualidade = 4 setores.
SELECT nome, department, ativo, rastreavel, controla_consumo, posto_id
  FROM stock_locations
 ORDER BY controla_consumo DESC, posto_id NULLS LAST, nome;
