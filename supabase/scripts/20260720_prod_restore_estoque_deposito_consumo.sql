-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERAÇÃO — religar controla_consumo em Estoque e Depósito (PRODUÇÃO)
-- Data: 2026-07-20
--
-- Uma versão anterior do script de alinhamento desligou controla_consumo em
-- Estoque e Depósito, tirando-os da tela de Estoque Departamental. Isso é apenas
-- um flag: NENHUM saldo, product_stock ou movimento foi apagado. Religar o flag
-- restaura 100% do estado anterior.
--
-- Após rodar, prod volta a ter: Estoque, Depósito, Biologia Molecular + Qualidade.
-- IDEMPOTENTE. REVISAR e rodar no projeto de PRODUÇÃO (pooler IPv4).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE stock_locations
   SET controla_consumo = true,
       updated_at       = now()
 WHERE nome IN ('Estoque', 'Depósito')
   AND controla_consumo IS DISTINCT FROM true;

COMMIT;

-- Verificação — setores = linhas com consumo ON. Esperado: Estoque, Depósito,
-- Biologia Molecular e Qualidade (4 setores centrais).
SELECT nome, department, ativo, rastreavel, controla_consumo, posto_id
  FROM stock_locations
 ORDER BY controla_consumo DESC, posto_id NULLS LAST, nome;
