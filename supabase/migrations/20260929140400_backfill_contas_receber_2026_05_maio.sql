-- ============================================================================
-- Backfill histórico: Contas a Receber — Maio/2026 (5 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba MAIO de "Faturamento x Recebimentos - 2026 -
-- 2° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-05;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 220 títulos, R$ 1.321.836,91 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 146 recebidos, 52 parciais, 22 previstos.
-- Glosas: 48 abertas, 4 definitivas (refaturadas em outro lote),
-- 3 revertidas (recuperadas). Status do título: trigger fat_recalcular_nota.
-- Recebimento sem data válida na planilha usa a última baixa no apLIS ou a
-- data provável, marcado em recebimentos.observacoes.
--
-- Linhas excluídas, correções de lote e datas: ver
-- .scratch/faturamento-backfill-h1-2026/relatorio-importacao.md.
--
-- Guias (requisições) têm PII e não entram aqui: depois das 6 migrations,
--   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts \
--     --lotes=$(cat .scratch/faturamento-backfill-h1-2026/lotes.txt) --dry-run
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Pré-condições. Falha alto em vez de duplicar ou gravar operadora NULL.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_existentes TEXT;
  v_operadoras INTEGER;
BEGIN
  SELECT string_agg(aplis_id, ', ' ORDER BY aplis_id)
    INTO v_existentes
    FROM lotes
   WHERE aplis_id IN (
    '5154', '5200', '5363', '5366', '5373', '5378', '5381', '5385', '5396', '5399', '5402', '5413'
    '5448', '5468', '5508', '5552', '5596', '5606', '5608', '5610', '5613', '5620', '5632', '5637'
    '5640', '5641', '5642', '5643', '5644', '5646', '5647', '5648', '5649', '5654', '5655', '5656'
    '5657', '5658', '5659', '5660', '5661', '5662', '5663', '5664', '5666', '5671', '5672', '5674'
    '5678', '5679', '5681', '5682', '5683', '5684', '5685', '5686', '5687', '5688', '5693', '5696'
    '5697', '5698', '5699', '5701', '5702', '5703', '5704', '5705', '5706', '5707', '5708', '5709'
    '5712', '5713', '5716', '5718', '5720', '5721', '5722', '5724', '5728', '5729', '5730', '5731'
    '5732', '5733', '5734', '5735', '5736', '5740', '5741', '5742', '5743', '5747', '5748', '5750'
    '5751', '5753', '5754', '5755', '5756', '5757', '5758', '5759', '5760', '5761', '5762', '5763'
    '5764', '5765', '5766', '5767', '5768', '5769', '5771', '5772', '5773', '5776', '5777', '5778'
    '5779', '5780', '5782', '5783', '5785', '5786', '5788', '5789', '5790', '5791', '5792', '5793'
    '5794', '5795', '5796', '5797', '5798', '5799', '5800', '5801', '5802', '5803', '5804', '5805'
    '5806', '5807', '5808', '5809', '5811', '5812', '5813', '5814', '5816', '5821', '5822', '5827'
    '5828', '5829', '5830', '5831', '5833', '5834', '5837', '5839', '5840', '5841', '5842', '5844'
    '5845', '5846', '5847', '5848', '5849', '5850', '5854', '5855', '5856', '5857', '5860', '5863'
    '5864', '5865', '5866', '5867', '5868', '5869', '5870', '5871', '5872', '5873', '5876', '5881'
    '5882', '5883', '5884', '5885', '5886', '5887', '5888', '5889', '5890', '5891', '5893', '5896'
    '5897', '5900', '5901', '5903', '5904', '5906', '5908', '5909', '5913', '5914', '5915', '5916'
    '5919', '5923', '5927', '5929'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1052', '1078', '1101', '1122', '1129', '1197', '1204', '1210', '1227', '1228', '1231', '1232', '1235', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283', '1343');
  IF v_operadoras <> 28 THEN
    RAISE EXCEPTION 'Esperadas 28 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- MAIO linha 26 | apLIS lote 5620 | AMHP-DF ("AMHPDF - LIFE" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2c82c05c-4504-5e36-96e6-36b656b48b78', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5620', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '13052026', NULL, NULL, NULL, '5620', 794.58, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-13', DATE '2026-07-12', 794.58, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 26). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a', '2c82c05c-4504-5e36-96e6-36b656b48b78');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a', '2c82c05c-4504-5e36-96e6-36b656b48b78', DATE '2026-07-12', DATE '2026-07-12', 794.58, 794.58, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 27 | apLIS lote 5608 | AMHP-DF ("AMHPDF - CONAB" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-03)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ebdbc9c8-c3c5-5cf1-9440-c5bd3775f488', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5608', DATE '2026-04-28', DATE '2026-05-04', 'Faturado', 3, '04052026', NULL, NULL, NULL, '5608', 5984.17, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1d94fa52-7295-5606-b2fb-325b8a45a3fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-04', DATE '2026-07-03', 5984.17, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 27). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1d94fa52-7295-5606-b2fb-325b8a45a3fb', 'ebdbc9c8-c3c5-5cf1-9440-c5bd3775f488');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1d94fa52-7295-5606-b2fb-325b8a45a3fb', 'ebdbc9c8-c3c5-5cf1-9440-c5bd3775f488', DATE '2026-07-03', DATE '2026-07-03', 5984.17, 5984.17, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 28 | apLIS lote 5883 | AMHP-DF ("AMHPDF - CONAB" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5ada7602-837d-52c4-a59d-3bae2e4e7ca0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5883', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5883', 1115.34, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('abe49c02-b178-53a8-840d-d8ed2bc30eff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 1115.34, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 28). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('abe49c02-b178-53a8-840d-d8ed2bc30eff', '5ada7602-837d-52c4-a59d-3bae2e4e7ca0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('abe49c02-b178-53a8-840d-d8ed2bc30eff', '5ada7602-837d-52c4-a59d-3bae2e4e7ca0', DATE '2026-07-25', DATE '2026-07-15', 1115.34, 1115.34, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 29 | apLIS lote 5610 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f8a9de6a-91ec-5faa-a643-846abe87791c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5610', DATE '2026-04-28', DATE '2026-05-04', 'Faturado', 3, '04052026', NULL, NULL, NULL, '5610', 3153.70, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-04', DATE '2026-07-03', 3153.70, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 29). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346', 'f8a9de6a-91ec-5faa-a643-846abe87791c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346', 'f8a9de6a-91ec-5faa-a643-846abe87791c', DATE '2026-07-03', DATE '2026-07-15', 3153.70, 3153.70, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 30 | apLIS lote 5733 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5f65baab-403f-5369-bf83-c09c147630cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5733', DATE '2026-05-12', DATE '2026-05-12', 'Em Processamento', 1, '12052026', NULL, NULL, NULL, '5733', 4842.78, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d95ef509-dae0-5405-98c2-555729e6cb8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 4842.78, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 30). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d95ef509-dae0-5405-98c2-555729e6cb8c', '5f65baab-403f-5369-bf83-c09c147630cb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d95ef509-dae0-5405-98c2-555729e6cb8c', '5f65baab-403f-5369-bf83-c09c147630cb', DATE '2026-07-11', DATE '2026-07-15', 4842.78, 4842.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 31 | apLIS lote 5871 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('41173023-4a4b-5212-b0e5-89540deb7598', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5871', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5871', 1336.74, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 1336.74, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 31). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7', '41173023-4a4b-5212-b0e5-89540deb7598');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7', '41173023-4a4b-5212-b0e5-89540deb7598', DATE '2026-07-24', DATE '2026-07-15', 1336.74, 1336.74, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 32 | apLIS lote 5606 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('55604166-c526-5d00-aa14-38809a8982f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5606', DATE '2026-04-28', DATE '2026-05-04', 'Faturado', 3, '04052026', NULL, NULL, NULL, '5606', 6259.03, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-04', DATE '2026-07-03', 6259.03, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 32). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', '55604166-c526-5d00-aa14-38809a8982f6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', '55604166-c526-5d00-aa14-38809a8982f6', DATE '2026-07-03', DATE '2026-07-15', 6259.03, 6259.03, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 33 | apLIS lote 5705 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d1acbf4d-c123-593d-9b7d-d546b56edd7f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5705', DATE '2026-05-11', DATE '2026-05-11', 'Recebido', 4, '11052026', NULL, NULL, NULL, '5705', 7544.49, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0116bc36-f035-5783-b362-b07878f9f5de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-11', DATE '2026-07-10', 7544.49, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 33). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0116bc36-f035-5783-b362-b07878f9f5de', 'd1acbf4d-c123-593d-9b7d-d546b56edd7f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0116bc36-f035-5783-b362-b07878f9f5de', 'd1acbf4d-c123-593d-9b7d-d546b56edd7f', DATE '2026-07-10', DATE '2026-08-04', 7544.49, 7544.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 34 | apLIS lote 5867 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c442852c-7e30-5252-a9d0-26fefdcb2260', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5867', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5867', 11060.85, 31);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 11060.85, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 34). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6', 'c442852c-7e30-5252-a9d0-26fefdcb2260');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6', 'c442852c-7e30-5252-a9d0-26fefdcb2260', DATE '2026-07-24', DATE '2026-08-04', 11060.85, 11060.85, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 35 | apLIS lote 5632 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('77866c0d-3b1d-5665-a152-e338ac7c228b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5632', DATE '2026-04-30', DATE '2026-05-04', 'Recebido', 4, '04052026', NULL, NULL, NULL, '5632', 239.73, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-04', DATE '2026-07-03', 239.73, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 35). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5', '77866c0d-3b1d-5665-a152-e338ac7c228b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5', '77866c0d-3b1d-5665-a152-e338ac7c228b', DATE '2026-07-03', DATE '2026-07-15', 239.73, 239.73, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 36 | apLIS lote 5468 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d5e455ba-671c-501f-8251-a2df065a2a86', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5468', DATE '2026-04-14', DATE '2026-05-12', 'Recebido', 4, '12052026', NULL, NULL, NULL, '5468', 2309.54, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 2309.54, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 36). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f', 'd5e455ba-671c-501f-8251-a2df065a2a86');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f', 'd5e455ba-671c-501f-8251-a2df065a2a86', DATE '2026-07-11', DATE '2026-08-04', 2309.54, 2309.54, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 37 | apLIS lote 5743 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-09-09)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('00c0d9cd-3903-5fa8-bc3e-6bde9e2130fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5743', DATE '2026-05-13', DATE '2026-05-14', 'Recebido', 4, '14052026', NULL, NULL, NULL, '5743', 1077.97, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd25a6c0-a1bb-56ab-af79-30689b75d610', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-14', DATE '2026-07-13', 1077.97, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 37). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd25a6c0-a1bb-56ab-af79-30689b75d610', '00c0d9cd-3903-5fa8-bc3e-6bde9e2130fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bd25a6c0-a1bb-56ab-af79-30689b75d610', '00c0d9cd-3903-5fa8-bc3e-6bde9e2130fe', DATE '2026-07-13', DATE '2026-09-09', 1077.97, 1077.97, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 38 | apLIS lote 5868 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('86ce1edc-4b2f-5cfd-9fab-df8ea41ace0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5868', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5868', 6234.49, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8974b833-0f09-547b-ad22-dfcb60a8e3e7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 6234.49, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 38). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8974b833-0f09-547b-ad22-dfcb60a8e3e7', '86ce1edc-4b2f-5cfd-9fab-df8ea41ace0f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8974b833-0f09-547b-ad22-dfcb60a8e3e7', '86ce1edc-4b2f-5cfd-9fab-df8ea41ace0f', DATE '2026-07-24', DATE '2026-08-04', 6234.49, 6234.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 39 | apLIS lote 5736 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7371e4c8-c3dd-5122-aeeb-12a376945b91', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5736', DATE '2026-05-12', DATE '2026-05-12', 'Faturado', 3, '12052026', NULL, NULL, NULL, '5736', 2752.30, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('755076ba-c9be-594e-9dd8-fdd161bcad3f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 2752.30, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 39). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('755076ba-c9be-594e-9dd8-fdd161bcad3f', '7371e4c8-c3dd-5122-aeeb-12a376945b91');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('755076ba-c9be-594e-9dd8-fdd161bcad3f', '7371e4c8-c3dd-5122-aeeb-12a376945b91', DATE '2026-07-11', DATE '2026-07-15', 2752.30, 2752.30, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 40 | apLIS lote 5870 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('43346a63-0ad1-533f-b2b0-8fe15640c463', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5870', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5870', 411.64, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3da56901-8a41-5774-86f2-5f5af1d0be51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 411.64, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 40). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3da56901-8a41-5774-86f2-5f5af1d0be51', '43346a63-0ad1-533f-b2b0-8fe15640c463');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3da56901-8a41-5774-86f2-5f5af1d0be51', '43346a63-0ad1-533f-b2b0-8fe15640c463', DATE '2026-07-24', DATE '2026-07-31', 411.64, 411.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 41 | apLIS lote 5741 | AMHP-DF ("AMHPDF - AFFEGO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b3881877-3a84-54d8-b717-9d69c5d61d5e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5741', DATE '2026-05-13', DATE '2026-05-13', 'Recebido', 4, '13052026', NULL, NULL, NULL, '5741', 37.86, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-13', DATE '2026-07-12', 37.86, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 41). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f', 'b3881877-3a84-54d8-b717-9d69c5d61d5e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f', 'b3881877-3a84-54d8-b717-9d69c5d61d5e', DATE '2026-07-12', DATE '2026-08-04', 37.86, 37.86, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 42 | apLIS lote 5887 | AMHP-DF ("AMHPDF - AFFEGO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b2a57dfd-4474-5039-93d8-317d44e28f62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5887', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5887', 57.90, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('32b582b4-b094-58d8-b1a0-065d390164a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 57.90, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 42). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('32b582b4-b094-58d8-b1a0-065d390164a1', 'b2a57dfd-4474-5039-93d8-317d44e28f62');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('32b582b4-b094-58d8-b1a0-065d390164a1', 'b2a57dfd-4474-5039-93d8-317d44e28f62', DATE '2026-07-25', DATE '2026-08-04', 57.90, 57.90, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 43 | apLIS lote 5706 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f1292394-99b4-51ca-bba6-f199220eba12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5706', DATE '2026-05-11', DATE '2026-05-11', 'Recebido', 4, '11052026', NULL, NULL, NULL, '5706', 2758.30, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-11', DATE '2026-07-10', 2758.30, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 43). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b', 'f1292394-99b4-51ca-bba6-f199220eba12');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b', 'f1292394-99b4-51ca-bba6-f199220eba12', DATE '2026-07-10', DATE '2026-08-04', 2758.30, 2758.30, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 44 | apLIS lote 5869 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('85db04e7-9d0e-5062-a382-1170fd733efe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5869', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5869', 4503.91, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('42821cb8-bd63-5d15-b368-db3beb2ac72f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 4503.91, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 44). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('42821cb8-bd63-5d15-b368-db3beb2ac72f', '85db04e7-9d0e-5062-a382-1170fd733efe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('42821cb8-bd63-5d15-b368-db3beb2ac72f', '85db04e7-9d0e-5062-a382-1170fd733efe', DATE '2026-07-24', DATE '2026-08-04', 4503.91, 4503.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 45 | apLIS lote 5734 | AMHP-DF ("AMHPDF - SERPRO PENDÊNCIA RESOLVIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bff7b97d-62ff-5cca-ae60-e6b2803d85e7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5734', DATE '2026-05-12', DATE '2026-05-12', 'Recebido', 4, '12052026', NULL, NULL, NULL, '5734', 552.24, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cd97e919-5220-5423-8b12-0fdc69a53220', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 552.24, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 45). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cd97e919-5220-5423-8b12-0fdc69a53220', 'bff7b97d-62ff-5cca-ae60-e6b2803d85e7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cd97e919-5220-5423-8b12-0fdc69a53220', 'bff7b97d-62ff-5cca-ae60-e6b2803d85e7', DATE '2026-07-11', DATE '2026-08-04', 552.24, 552.24, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 46 | apLIS lote 5613 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-11)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3018909b-4e1c-54ca-8120-188f81d5dbf4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5613', DATE '2026-04-28', DATE '2026-05-12', 'Faturado', 3, '12052026', NULL, NULL, NULL, '5613', 3462.09, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 3462.09, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 46). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199', '3018909b-4e1c-54ca-8120-188f81d5dbf4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199', '3018909b-4e1c-54ca-8120-188f81d5dbf4', DATE '2026-07-11', DATE '2026-07-11', 3462.09, 3462.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 47 | apLIS lote 5882 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('05c55c9d-e46b-538b-92cf-30105288aef7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5882', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5882', 517.55, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0a588a4a-1798-5e23-812d-75a6be7575d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 517.55, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 47). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0a588a4a-1798-5e23-812d-75a6be7575d2', '05c55c9d-e46b-538b-92cf-30105288aef7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0a588a4a-1798-5e23-812d-75a6be7575d2', '05c55c9d-e46b-538b-92cf-30105288aef7', DATE '2026-07-25', DATE '2026-08-04', 517.55, 517.55, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 48 | apLIS lote 5897 | AMHP-DF ("AMHPDF - PETROBRAS VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d31bcb81-9af8-5520-a4e2-7f2159d16d6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5897', DATE '2026-05-27', DATE '2026-05-27', 'Recebido', 4, '27052026', NULL, NULL, NULL, '5897', 676.87, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d949751-236f-51d4-9b2b-4f4a2c619c98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-27', DATE '2026-07-26', 676.87, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 48). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d949751-236f-51d4-9b2b-4f4a2c619c98', 'd31bcb81-9af8-5520-a4e2-7f2159d16d6f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6d949751-236f-51d4-9b2b-4f4a2c619c98', 'd31bcb81-9af8-5520-a4e2-7f2159d16d6f', DATE '2026-07-26', DATE '2026-08-04', 676.87, 676.87, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 49 | apLIS lote 5762 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- lote digitado 5672 → lote real 5762 (pelo protocolo)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e5a4406f-cf5c-589e-8a95-a41e165da996', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5762', DATE '2026-05-14', DATE '2026-05-14', 'Recebido', 4, '44692957', NULL, NULL, NULL, '5762', 1696.00, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('67ee6916-9994-56aa-96f0-b7f4bb2f30e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-14', DATE '2026-07-13', 1696.00, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 49). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('67ee6916-9994-56aa-96f0-b7f4bb2f30e4', 'e5a4406f-cf5c-589e-8a95-a41e165da996');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('67ee6916-9994-56aa-96f0-b7f4bb2f30e4', 'e5a4406f-cf5c-589e-8a95-a41e165da996', DATE '2026-07-13', DATE '2026-08-04', 1696.00, 1696.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 50 | apLIS lote 5903 | AMHP-DF ("AMHPDF - PROASA VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('89873479-e664-50ca-ab22-92f7504697b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5903', DATE '2026-05-27', DATE '2026-05-27', 'Recebido', 4, '44697640', NULL, NULL, NULL, '5903', 324.36, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c39204fc-2937-5cf5-8727-61455fa63ae5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-27', DATE '2026-07-26', 324.36, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 50). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c39204fc-2937-5cf5-8727-61455fa63ae5', '89873479-e664-50ca-ab22-92f7504697b9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c39204fc-2937-5cf5-8727-61455fa63ae5', '89873479-e664-50ca-ab22-92f7504697b9', DATE '2026-07-26', DATE '2026-08-04', 324.36, 324.36, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 51 | apLIS lote 5927 | AMHP-DF ("AMHPDF - PROASA VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ea2a3cf-f7a8-5b2f-9fe0-ca0b13bae20a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5927', DATE '2026-05-29', DATE '2026-05-29', 'Recebido', 4, '44698658', NULL, NULL, NULL, '5927', 1403.30, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a05c941f-f8a9-52f0-933f-904677a943b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-29', DATE '2026-07-28', 1403.30, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 51). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a05c941f-f8a9-52f0-933f-904677a943b4', '0ea2a3cf-f7a8-5b2f-9fe0-ca0b13bae20a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a05c941f-f8a9-52f0-933f-904677a943b4', '0ea2a3cf-f7a8-5b2f-9fe0-ca0b13bae20a', DATE '2026-07-28', DATE '2026-08-04', 1403.30, 1403.30, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 52 | apLIS lote 5742 | AMHP-DF ("AMHPDF - NOTREDAME" na planilha)
-- Data Faturamento 2023-05-13 → 2026-05-13 (fechamento no apLIS 2026-05-13)
-- Data Provável Pagamento 2023-07-12 → 2026-07-12
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3c8a16a-5fad-57c5-b40f-88a22573e156', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5742', DATE '2026-05-13', DATE '2026-05-13', 'Faturado', 3, '13052026', NULL, NULL, NULL, '5742', 365.30, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c7fba8f9-dd8d-53a4-ae1d-f931962c596e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-13', DATE '2026-07-12', 365.30, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 52). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c7fba8f9-dd8d-53a4-ae1d-f931962c596e', 'c3c8a16a-5fad-57c5-b40f-88a22573e156');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c7fba8f9-dd8d-53a4-ae1d-f931962c596e', 'c3c8a16a-5fad-57c5-b40f-88a22573e156', DATE '2026-07-12', DATE '2026-07-12', 365.30, 365.30, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 53 | apLIS lote 5889 | AMHP-DF ("AMHPDF - NOTREDAME" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-25)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('46d1c735-28bc-51e2-957a-99064bee61e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5889', DATE '2026-05-26', DATE '2026-05-26', 'Faturado', 3, '44696778', NULL, NULL, NULL, '5889', 1146.16, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52159b59-08cf-5ffc-9329-0f29bf8afdb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 1146.16, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 53). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52159b59-08cf-5ffc-9329-0f29bf8afdb1', '46d1c735-28bc-51e2-957a-99064bee61e9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('52159b59-08cf-5ffc-9329-0f29bf8afdb1', '46d1c735-28bc-51e2-957a-99064bee61e9', DATE '2026-07-25', DATE '2026-07-25', 1146.16, 1146.16, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 54 | apLIS lote 5740 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('386ade40-f86c-56c3-bebc-738cfa82c476', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5740', DATE '2026-05-13', DATE '2026-05-13', 'Recebido', 4, '13052026', NULL, NULL, NULL, '5740', 1812.31, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-13', DATE '2026-07-12', 1812.31, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 54). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56', '386ade40-f86c-56c3-bebc-738cfa82c476');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56', '386ade40-f86c-56c3-bebc-738cfa82c476', DATE '2026-07-12', DATE '2026-08-04', 1812.31, 1812.31, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 55 | apLIS lote 5888 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1ccd961e-1e86-549c-8503-3e7435d3e4db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5888', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '44696756', NULL, NULL, NULL, '5888', 1511.54, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ddcc03c6-e577-50dd-a8bc-ccc43594227c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 1511.54, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 55). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ddcc03c6-e577-50dd-a8bc-ccc43594227c', '1ccd961e-1e86-549c-8503-3e7435d3e4db');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ddcc03c6-e577-50dd-a8bc-ccc43594227c', '1ccd961e-1e86-549c-8503-3e7435d3e4db', DATE '2026-07-25', DATE '2026-08-04', 1511.54, 1511.54, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 56 | apLIS lote 5904 | AMHP-DF ("AMHPDF - OMINT VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e084d477-9750-5f8b-8f96-f9b904a1fc48', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5904', DATE '2026-05-27', DATE '2026-05-29', 'Recebido', 4, '44698592', NULL, NULL, NULL, '5904', 1359.14, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a9d3e571-e079-5d30-9e5d-99287c91262d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-29', DATE '2026-07-28', 1359.14, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 56). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a9d3e571-e079-5d30-9e5d-99287c91262d', 'e084d477-9750-5f8b-8f96-f9b904a1fc48');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a9d3e571-e079-5d30-9e5d-99287c91262d', 'e084d477-9750-5f8b-8f96-f9b904a1fc48', DATE '2026-07-28', DATE '2026-07-31', 1359.14, 1359.14, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 57 | apLIS lote 5896 | AMHP-DF ("AMHPDF - OMINT VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61388d79-8b3c-5142-afa9-eb22daaecb5e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5896', DATE '2026-05-27', DATE '2026-05-27', 'Recebido', 4, '44697348', NULL, NULL, NULL, '5896', 3048.67, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2e352596-ddd2-594a-918c-bb0d8f89fc66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-27', DATE '2026-07-26', 3048.67, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2e352596-ddd2-594a-918c-bb0d8f89fc66', '61388d79-8b3c-5142-afa9-eb22daaecb5e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2e352596-ddd2-594a-918c-bb0d8f89fc66', '61388d79-8b3c-5142-afa9-eb22daaecb5e', DATE '2026-07-26', DATE '2026-08-04', 3048.67, 3048.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 58 | apLIS lote 5413 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-05)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a89c4c3c-b374-5c7c-8002-9daed0433748', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5413', DATE '2026-04-07', DATE '2026-05-06', 'Faturado', 3, '06052026', NULL, NULL, NULL, '5413', 67.86, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f4a56a07-9156-515f-964e-bf047314a3e2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-06', DATE '2026-07-05', 67.86, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 58). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f4a56a07-9156-515f-964e-bf047314a3e2', 'a89c4c3c-b374-5c7c-8002-9daed0433748');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f4a56a07-9156-515f-964e-bf047314a3e2', 'a89c4c3c-b374-5c7c-8002-9daed0433748', DATE '2026-07-05', DATE '2026-07-05', 67.86, 67.86, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 59 | apLIS lote 5701 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da9c5310-0835-5644-8dfa-5ba15dd0985a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5701', DATE '2026-05-11', DATE '2026-05-11', 'Faturado', 3, '11052026', NULL, NULL, NULL, '5701', 6482.99, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-11', DATE '2026-07-10', 6482.99, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 59). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', 'da9c5310-0835-5644-8dfa-5ba15dd0985a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', 'da9c5310-0835-5644-8dfa-5ba15dd0985a', DATE '2026-07-10', DATE '2026-07-31', 6482.99, 6482.99, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 60 | apLIS lote 5704 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64e0363c-0b31-5619-979f-fa5a23fe1778', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5704', DATE '2026-05-11', DATE '2026-05-11', 'Faturado', 3, '11052026', NULL, NULL, NULL, '5704', 599.20, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-11', DATE '2026-07-10', 599.20, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 60). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', '64e0363c-0b31-5619-979f-fa5a23fe1778');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', '64e0363c-0b31-5619-979f-fa5a23fe1778', DATE '2026-07-10', DATE '2026-07-15', 599.20, 599.20, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 61 | apLIS lote 5735 | AMHP-DF ("AMHPDF - BACEN PENDÊNCIA RESOLVIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-06-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da443d09-b695-5a81-b9e1-54e4af8214ff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5735', DATE '2026-05-12', DATE '2026-05-12', 'Recebido', 4, '12052026', NULL, NULL, NULL, '5735', 832.46, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2b634aea-cb93-5c16-a61f-b1b23c859ae1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 832.46, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 61). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2b634aea-cb93-5c16-a61f-b1b23c859ae1', 'da443d09-b695-5a81-b9e1-54e4af8214ff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2b634aea-cb93-5c16-a61f-b1b23c859ae1', 'da443d09-b695-5a81-b9e1-54e4af8214ff', DATE '2026-07-11', DATE '2026-06-15', 832.46, 832.46, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 62 | apLIS lote 5848 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f219f80e-ce59-530b-80b2-afab3a472ed5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5848', DATE '2026-05-22', DATE '2026-05-25', 'Recebido', 4, '25052026', NULL, NULL, NULL, '5848', 13838.48, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-25', DATE '2026-07-24', 13838.48, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 62). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef', 'f219f80e-ce59-530b-80b2-afab3a472ed5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef', 'f219f80e-ce59-530b-80b2-afab3a472ed5', DATE '2026-07-24', DATE '2026-08-04', 13838.48, 13838.48, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 63 | apLIS lote 5881 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5ee8b18a-9900-53f7-8a55-673f31126137', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5881', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5881', 1129.12, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('120a97c4-34c0-5cad-afe2-130fd0d53954', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 1129.12, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 63). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('120a97c4-34c0-5cad-afe2-130fd0d53954', '5ee8b18a-9900-53f7-8a55-673f31126137');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('120a97c4-34c0-5cad-afe2-130fd0d53954', '5ee8b18a-9900-53f7-8a55-673f31126137', DATE '2026-07-25', DATE '2026-07-31', 1129.12, 1129.12, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 64 | apLIS lote 5900 | AMHP-DF ("AMHPDF - BACEN VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b87ef61-445d-5415-8a5e-ab5d5b1a79c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5900', DATE '2026-05-27', DATE '2026-05-27', 'Recebido', 4, '27052026', NULL, NULL, NULL, '5900', 61.10, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65e623cb-c7d2-5a94-9dd9-c69156741b24', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-27', DATE '2026-07-26', 61.10, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 64). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65e623cb-c7d2-5a94-9dd9-c69156741b24', '5b87ef61-445d-5415-8a5e-ab5d5b1a79c9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('65e623cb-c7d2-5a94-9dd9-c69156741b24', '5b87ef61-445d-5415-8a5e-ab5d5b1a79c9', DATE '2026-07-26', DATE '2025-12-31', 61.10, 61.10, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 65 | apLIS lote 5884 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc0b0106-ef84-5262-9381-b408a2b6336b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5884', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5884', 63.93, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85b92b73-25e1-51c8-978f-28d00bc9beae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 63.93, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 65). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85b92b73-25e1-51c8-978f-28d00bc9beae', 'fc0b0106-ef84-5262-9381-b408a2b6336b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85b92b73-25e1-51c8-978f-28d00bc9beae', 'fc0b0106-ef84-5262-9381-b408a2b6336b', DATE '2026-07-25', DATE '2026-07-15', 63.93, 63.93, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 66 | apLIS lote 5886 | AMHP-DF ("AMHPDF - FAPES" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9a0230f5-1619-5dcf-bc4f-d5f9f1701d58', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5886', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '26052026', NULL, NULL, NULL, '5886', 775.61, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 775.61, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 66). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5', '9a0230f5-1619-5dcf-bc4f-d5f9f1701d58');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5', '9a0230f5-1619-5dcf-bc4f-d5f9f1701d58', DATE '2026-07-25', DATE '2026-07-31', 775.61, 775.61, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 67 | apLIS lote 5890 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-07-25)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7695a4a9-a04a-5653-b31f-2c6f9aabfd89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5890', DATE '2026-05-26', DATE '2026-05-26', 'Faturado', 3, '44696794', NULL, NULL, NULL, '5890', 944.28, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb338995-fe4b-55e3-a922-fa0bfdc0223a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-26', DATE '2026-07-25', 944.28, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 67). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb338995-fe4b-55e3-a922-fa0bfdc0223a', '7695a4a9-a04a-5653-b31f-2c6f9aabfd89');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eb338995-fe4b-55e3-a922-fa0bfdc0223a', '7695a4a9-a04a-5653-b31f-2c6f9aabfd89', DATE '2026-07-25', DATE '2026-07-25', 944.28, 944.28, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 68 | apLIS lote 5901 | AMHP-DF ("AMHPDF - CARE PLUS VENCIDA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64e6b731-7354-5155-95cd-238eb0ea9e68', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5901', DATE '2026-05-27', DATE '2026-05-27', 'Recebido', 4, '44697694', NULL, NULL, NULL, '5901', 154.54, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-27', DATE '2026-07-26', 154.54, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 68). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391', '64e6b731-7354-5155-95cd-238eb0ea9e68');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391', '64e6b731-7354-5155-95cd-238eb0ea9e68', DATE '2026-07-26', DATE '2025-12-31', 154.54, 154.54, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 69 | apLIS lote 5664 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0f398514-b6ae-5364-a6dc-7f7659c32eca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5664', DATE '2026-05-05', DATE '2026-05-06', 'Recebido', 4, '5727573698', '8410', 8390, DATE '2026-06-16', '5664', 8465.53, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('809fe40b-9c9b-5d93-ae5c-378773a8ee1e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-06', DATE '2026-06-05', 8465.53, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 69). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('809fe40b-9c9b-5d93-ae5c-378773a8ee1e', '0f398514-b6ae-5364-a6dc-7f7659c32eca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('809fe40b-9c9b-5d93-ae5c-378773a8ee1e', '0f398514-b6ae-5364-a6dc-7f7659c32eca', DATE '2026-06-05', DATE '2026-06-15', 8465.53, 8465.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 70 | apLIS lote 5678 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5764d498-c535-53e3-a5bc-3f852d06c2db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5678', DATE '2026-05-06', DATE '2026-05-06', 'Recebido - parcial', 7, '5727749949', '8410', 8390, DATE '2026-06-16', '5678', 4108.58, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-06', DATE '2026-06-05', 4108.58, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 70). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', '5764d498-c535-53e3-a5bc-3f852d06c2db');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', '5764d498-c535-53e3-a5bc-3f852d06c2db', DATE '2026-06-05', DATE '2026-06-15', 4108.58, 4065.58, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', '5764d498-c535-53e3-a5bc-3f852d06c2db', 43.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 71 | apLIS lote 5679 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f34f9ce6-0603-5cf4-9aab-046fb40c6a47', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5679', DATE '2026-05-06', DATE '2026-05-07', 'Recebido - parcial', 7, '5728067886', '8410', 8390, DATE '2026-06-16', '5679', 1083.12, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-07', DATE '2026-06-06', 1083.12, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 71). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', 'f34f9ce6-0603-5cf4-9aab-046fb40c6a47');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', 'f34f9ce6-0603-5cf4-9aab-046fb40c6a47', DATE '2026-06-06', DATE '2026-06-15', 1083.12, 937.16, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', 'f34f9ce6-0603-5cf4-9aab-046fb40c6a47', 145.96, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 72 | apLIS lote 5693 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5d1fc1de-28c8-57db-b55a-7d41e931c434', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5693', DATE '2026-05-08', DATE '2026-05-13', 'Recebido - parcial', 7, '5737582389', '8410', 8390, DATE '2026-06-16', '5693', 1313.87, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-13', DATE '2026-06-12', 1313.87, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 72). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', '5d1fc1de-28c8-57db-b55a-7d41e931c434');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', '5d1fc1de-28c8-57db-b55a-7d41e931c434', DATE '2026-06-12', DATE '2026-06-15', 1313.87, 850.42, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', '5d1fc1de-28c8-57db-b55a-7d41e931c434', 463.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 73 | apLIS lote 5747 | AMIL ("AMIL SEM FISICO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8853c3e7-02c3-574f-a96c-069563659725', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5747', DATE '2026-05-13', DATE '2026-05-13', 'Recebido - parcial', 7, '5737778176', '8410', 8390, DATE '2026-06-16', '5747', 1670.80, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-13', DATE '2026-06-12', 1670.80, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 73). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', '8853c3e7-02c3-574f-a96c-069563659725');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', '8853c3e7-02c3-574f-a96c-069563659725', DATE '2026-06-12', DATE '2026-06-15', 1670.80, 1615.35, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', '8853c3e7-02c3-574f-a96c-069563659725', 55.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 74 | apLIS lote 5681 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cb7ea3f3-38ee-541d-ae8a-25deaa688098', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5681', DATE '2026-05-06', DATE '2026-05-13', 'Recebido - parcial', 7, '5737895840', '8410', 8390, DATE '2026-06-16', '5681', 2877.25, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-13', DATE '2026-06-12', 2877.25, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 74). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', 'cb7ea3f3-38ee-541d-ae8a-25deaa688098');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', 'cb7ea3f3-38ee-541d-ae8a-25deaa688098', DATE '2026-06-12', DATE '2026-06-15', 2877.25, 2379.35, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', 'cb7ea3f3-38ee-541d-ae8a-25deaa688098', 497.90, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 75 | apLIS lote 5751 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5094c26b-c50a-5d38-886d-d2a3f30d453c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5751', DATE '2026-05-13', DATE '2026-05-13', 'Recebido', 4, '5738078784', '8410', 8390, DATE '2026-06-16', '5751', 27.00, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88794fc1-9abe-5cc5-b5ba-3a1eda12e4b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-13', DATE '2026-06-12', 27.00, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 75). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88794fc1-9abe-5cc5-b5ba-3a1eda12e4b9', '5094c26b-c50a-5d38-886d-d2a3f30d453c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('88794fc1-9abe-5cc5-b5ba-3a1eda12e4b9', '5094c26b-c50a-5d38-886d-d2a3f30d453c', DATE '2026-06-12', DATE '2026-06-15', 27.00, 27.00, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 76 | apLIS lote 5764 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d46487c8-87e5-5965-a7d8-d94abed2a44e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5764', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, '5739816439', '8410', 8390, DATE '2026-06-16', '5764', 5710.55, 34);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8410', DATE '2026-05-14', DATE '2026-06-13', 5710.55, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 76). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', 'd46487c8-87e5-5965-a7d8-d94abed2a44e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', 'd46487c8-87e5-5965-a7d8-d94abed2a44e', DATE '2026-06-13', DATE '2026-06-15', 5710.55, 5682.10, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', 'd46487c8-87e5-5965-a7d8-d94abed2a44e', 28.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 77 | apLIS lote 5641 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5c8d075b-a5ae-5b04-a14e-11d58287c10a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5641', DATE '2026-05-04', DATE '2026-05-04', 'Recebido', 4, 'CHAVE1387549', '8409', 8389, DATE '2026-08-31', '5641', 12366.66, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5c6be00-8910-5b8f-ba13-c5dc6a65b452', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 12366.66, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 77). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5c6be00-8910-5b8f-ba13-c5dc6a65b452', '5c8d075b-a5ae-5b04-a14e-11d58287c10a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b5c6be00-8910-5b8f-ba13-c5dc6a65b452', '5c8d075b-a5ae-5b04-a14e-11d58287c10a', DATE '2026-06-20', DATE '2026-07-09', 12366.66, 12366.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 78 | apLIS lote 5644 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('085f12af-5437-52ec-8cf9-71a142853cda', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5644', DATE '2026-05-04', DATE '2026-05-04', 'Recebido - parcial', 7, 'CHAVE1387768', '8409', 8389, DATE '2026-08-31', '5644', 1303.02, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 1303.02, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 78). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', '085f12af-5437-52ec-8cf9-71a142853cda');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', '085f12af-5437-52ec-8cf9-71a142853cda', DATE '2026-06-20', DATE '2026-07-09', 1303.02, 1231.69, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', '085f12af-5437-52ec-8cf9-71a142853cda', 71.33, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 79 | apLIS lote 5646 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6b2a6502-d16e-5737-91c8-36b60ef7588a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5646', DATE '2026-05-04', DATE '2026-05-04', 'Recebido', 4, 'CHAVE1388767', '8409', 8389, DATE '2026-08-31', '5646', 2663.37, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('703e34ce-7733-57c7-bc4f-dfe3d63da587', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 2663.37, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 79). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('703e34ce-7733-57c7-bc4f-dfe3d63da587', '6b2a6502-d16e-5737-91c8-36b60ef7588a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('703e34ce-7733-57c7-bc4f-dfe3d63da587', '6b2a6502-d16e-5737-91c8-36b60ef7588a', DATE '2026-06-20', DATE '2026-07-09', 2663.37, 2663.37, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 80 | apLIS lote 5643 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('81a507b0-60da-5953-ac17-04172e488a5f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5643', DATE '2026-05-04', DATE '2026-05-04', 'Recebido - parcial', 7, 'CHAVE1387347', '8409', 8389, DATE '2026-08-31', '5643', 5929.57, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 5929.57, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 80). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', '81a507b0-60da-5953-ac17-04172e488a5f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', '81a507b0-60da-5953-ac17-04172e488a5f', DATE '2026-06-20', DATE '2026-07-09', 5929.57, 5891.23, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', '81a507b0-60da-5953-ac17-04172e488a5f', 38.34, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 81 | apLIS lote 5640 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('efbb3efc-1bbb-5996-b526-518992529928', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5640', DATE '2026-05-04', DATE '2026-05-04', 'Recebido', 4, 'CHAVE1387239', '8409', 8389, DATE '2026-08-31', '5640', 13144.49, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4779a55c-197f-5197-9260-0ebb34c853ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 13144.49, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 81). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4779a55c-197f-5197-9260-0ebb34c853ba', 'efbb3efc-1bbb-5996-b526-518992529928');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4779a55c-197f-5197-9260-0ebb34c853ba', 'efbb3efc-1bbb-5996-b526-518992529928', DATE '2026-06-20', DATE '2026-07-09', 13144.49, 13144.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 82 | apLIS lote 5642 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7502ea9e-2dad-57fe-b7ee-9f3d474eca9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5642', DATE '2026-05-04', DATE '2026-05-04', 'Recebido', 4, 'CHAVE1387604', '8409', 8389, DATE '2026-08-31', '5642', 10633.77, 54);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e50ea450-610d-5a0c-9b8c-49d6181a3211', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 10633.77, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 82). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e50ea450-610d-5a0c-9b8c-49d6181a3211', '7502ea9e-2dad-57fe-b7ee-9f3d474eca9a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e50ea450-610d-5a0c-9b8c-49d6181a3211', '7502ea9e-2dad-57fe-b7ee-9f3d474eca9a', DATE '2026-06-20', DATE '2026-07-09', 10633.77, 10633.77, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 83 | apLIS lote 5396 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b4f882c1-923d-5029-a89b-9f50a37ea467', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5396', DATE '2026-04-06', DATE '2026-05-04', 'Recebido', 4, 'CHAVE1388233', '8409', 8389, DATE '2026-08-31', '5396', 3552.46, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6554a3e6-6076-527f-b03c-8287f1f49182', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-04', DATE '2026-06-20', 3552.46, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 83). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6554a3e6-6076-527f-b03c-8287f1f49182', 'b4f882c1-923d-5029-a89b-9f50a37ea467');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6554a3e6-6076-527f-b03c-8287f1f49182', 'b4f882c1-923d-5029-a89b-9f50a37ea467', DATE '2026-06-20', DATE '2026-07-09', 3552.46, 3552.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 84 | apLIS lote 5666 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9813581a-660a-5f8c-b7e0-f0bfc1aa33bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5666', DATE '2026-05-06', DATE '2026-05-06', 'Recebido - parcial', 7, '1395764', '8409', 8389, DATE '2026-08-31', '5666', 4196.77, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-06', DATE '2026-06-20', 4196.77, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 84). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', '9813581a-660a-5f8c-b7e0-f0bfc1aa33bf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', '9813581a-660a-5f8c-b7e0-f0bfc1aa33bf', DATE '2026-06-20', DATE '2026-07-09', 4196.77, 4196.50, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', '9813581a-660a-5f8c-b7e0-f0bfc1aa33bf', 0.27, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 85 | apLIS lote 5696 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6af2630b-8063-546e-9051-e72ad3b37716', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5696', DATE '2026-05-08', DATE '2026-05-08', 'Recebido', 4, 'CHAVE1401875', '8409', 8389, DATE '2026-08-31', '5696', 4114.55, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d60b9fca-ac19-5602-bc18-6bc414603cf6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-08', DATE '2026-06-20', 4114.55, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 85). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d60b9fca-ac19-5602-bc18-6bc414603cf6', '6af2630b-8063-546e-9051-e72ad3b37716');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d60b9fca-ac19-5602-bc18-6bc414603cf6', '6af2630b-8063-546e-9051-e72ad3b37716', DATE '2026-06-20', DATE '2026-07-09', 4114.55, 4114.55, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 86 | apLIS lote 5697 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e10b121-1942-5a7e-8bf1-6c299aa269c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5697', DATE '2026-05-08', DATE '2026-05-08', 'Faturado', 3, 'CHAVE1401991', '8409', 8389, DATE '2026-08-31', '5697', 882.59, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8409', DATE '2026-05-08', DATE '2026-06-20', 882.59, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 86). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', '7e10b121-1942-5a7e-8bf1-6c299aa269c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', '7e10b121-1942-5a7e-8bf1-6c299aa269c0', DATE '2026-06-20', DATE '2026-07-09', 882.59, 827.57, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', '7e10b121-1942-5a7e-8bf1-6c299aa269c0', 55.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 87 | apLIS lote 5728 | BRADESCO SAUDE  - 005711 ("BRADESCO PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f8f813d3-7f60-5348-8528-d20a76805b92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5728', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, '340227542053_0', NULL, NULL, NULL, '5728', 18847.69, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea7cb0ff-9db0-5dad-858f-f784530faaec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-12', DATE '2026-07-11', 18847.69, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 87). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea7cb0ff-9db0-5dad-858f-f784530faaec', 'f8f813d3-7f60-5348-8528-d20a76805b92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ea7cb0ff-9db0-5dad-858f-f784530faaec', 'f8f813d3-7f60-5348-8528-d20a76805b92', DATE '2026-07-11', DATE '2026-06-30', 18847.69, 18847.69, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 88 | apLIS lote 5729 | BRADESCO SAUDE  - 005711 ("BRADESCO PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cbc0a48c-af22-54dd-aa70-10960c3208e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5729', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, '340227541022_0', NULL, NULL, NULL, '5729', 2091.88, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb629bd9-c2de-52f8-b763-67e84528abec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-13', DATE '2026-07-12', 2091.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 88). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb629bd9-c2de-52f8-b763-67e84528abec', 'cbc0a48c-af22-54dd-aa70-10960c3208e0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eb629bd9-c2de-52f8-b763-67e84528abec', 'cbc0a48c-af22-54dd-aa70-10960c3208e0', DATE '2026-07-12', DATE '2026-06-30', 2091.88, 2091.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 89 | apLIS lote 5730 | BRADESCO SAUDE S/A 421715 ("BRADESCO PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a958cac9-b281-5299-b4ad-010a7e3a6363', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5730', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, '341227543718_0', NULL, NULL, NULL, '5730', 4627.54, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4305daa4-9072-5ee0-92dc-b5b0a6bc3271', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-13', DATE '2026-07-12', 4627.54, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 89). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4305daa4-9072-5ee0-92dc-b5b0a6bc3271', 'a958cac9-b281-5299-b4ad-010a7e3a6363');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4305daa4-9072-5ee0-92dc-b5b0a6bc3271', 'a958cac9-b281-5299-b4ad-010a7e3a6363', DATE '2026-07-12', DATE '2026-06-30', 4627.54, 4627.54, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 90 | apLIS lote 5731 | BRADESCO SAUDE S/A 421715 ("BRADESCO PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fddbc876-a2be-51c1-9750-34b111496bf8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5731', DATE '2026-05-11', DATE '2026-05-11', 'Recebido', 4, '341227534306_0', NULL, NULL, NULL, '5731', 1178.88, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dca943a2-f335-5d5d-b743-6a8109390910', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-13', DATE '2026-07-12', 1178.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 90). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dca943a2-f335-5d5d-b743-6a8109390910', 'fddbc876-a2be-51c1-9750-34b111496bf8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dca943a2-f335-5d5d-b743-6a8109390910', 'fddbc876-a2be-51c1-9750-34b111496bf8', DATE '2026-07-12', DATE '2026-06-30', 1178.88, 1178.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 91 | apLIS lote 5802 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('052983e5-1fe1-5960-999c-15192012cdfb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5802', DATE '2026-05-19', DATE '2026-05-19', 'Faturado', 3, '340227788053_0', NULL, NULL, NULL, '5802', 6871.61, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a564a01f-bb57-5d3c-98c9-3c6868256ee4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-19', DATE '2026-07-18', 6871.61, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 91). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a564a01f-bb57-5d3c-98c9-3c6868256ee4', '052983e5-1fe1-5960-999c-15192012cdfb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a564a01f-bb57-5d3c-98c9-3c6868256ee4', '052983e5-1fe1-5960-999c-15192012cdfb', DATE '2026-07-18', 6871.61, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 92 | apLIS lote 5806 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('30229a33-0ccd-548f-8eb7-baa52c36a824', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5806', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '340227795990_0', NULL, NULL, NULL, '5806', 22147.67, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94302645-2925-5020-ae21-f8b1f10d511f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 22147.67, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 92). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94302645-2925-5020-ae21-f8b1f10d511f', '30229a33-0ccd-548f-8eb7-baa52c36a824');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('94302645-2925-5020-ae21-f8b1f10d511f', '30229a33-0ccd-548f-8eb7-baa52c36a824', DATE '2026-07-19', DATE '2026-06-30', 22147.67, 22147.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 93 | apLIS lote 5807 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f27a5a7f-2a02-5957-95e6-41478f10f9dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5807', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '340227798431_0', NULL, NULL, NULL, '5807', 19173.02, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('36ca8878-05e2-5bde-9ffc-fee9e21bf97b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 19173.02, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 93). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('36ca8878-05e2-5bde-9ffc-fee9e21bf97b', 'f27a5a7f-2a02-5957-95e6-41478f10f9dd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('36ca8878-05e2-5bde-9ffc-fee9e21bf97b', 'f27a5a7f-2a02-5957-95e6-41478f10f9dd', DATE '2026-07-19', DATE '2026-06-30', 19173.02, 19173.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 94 | apLIS lote 5808 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('df272414-6e29-5c7e-85b2-f9a4f0a6d900', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5808', DATE '2026-05-20', DATE '2026-05-20', 'Recebido - parcial', 7, '340227802243_0', NULL, NULL, NULL, '5808', 21112.52, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 21112.52, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 94). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', 'df272414-6e29-5c7e-85b2-f9a4f0a6d900');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', 'df272414-6e29-5c7e-85b2-f9a4f0a6d900', DATE '2026-07-19', DATE '2026-06-30', 21112.52, 21109.14, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', 'df272414-6e29-5c7e-85b2-f9a4f0a6d900', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 95 | apLIS lote 5809 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a87f3209-4b93-5152-975a-f6c3ae5773cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5809', DATE '2026-05-20', DATE '2026-05-20', 'Recebido - parcial', 7, '340227807681_0', NULL, NULL, NULL, '5809', 24630.39, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('618f0ee6-2aca-5d2e-aa3f-de014612cc2a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 24630.39, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 95). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('618f0ee6-2aca-5d2e-aa3f-de014612cc2a', 'a87f3209-4b93-5152-975a-f6c3ae5773cf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('618f0ee6-2aca-5d2e-aa3f-de014612cc2a', 'a87f3209-4b93-5152-975a-f6c3ae5773cf', DATE '2026-07-19', DATE '2026-06-30', 24630.39, 24630.39, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 96 | apLIS lote 5811 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7bdeded2-b0f2-51a4-8170-060b226a05df', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5811', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '341227811058_0', NULL, NULL, NULL, '5811', 682.43, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6a900ef7-a123-5330-a685-b4e95a3462c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-20', DATE '2026-07-19', 682.43, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 96). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6a900ef7-a123-5330-a685-b4e95a3462c8', '7bdeded2-b0f2-51a4-8170-060b226a05df');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6a900ef7-a123-5330-a685-b4e95a3462c8', '7bdeded2-b0f2-51a4-8170-060b226a05df', DATE '2026-07-19', DATE '2026-06-30', 682.43, 682.43, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 97 | apLIS lote 5812 | BRADESCO SAUDE  - 005711 ("BRADESCO - GUIAS SEM LOTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2fab303b-9c8f-59a2-9805-85665ae5e098', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5812', DATE '2026-05-20', DATE '2026-05-20', 'Recebido - parcial', 7, '340227811662_0', NULL, NULL, NULL, '5812', 16863.43, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 16863.43, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 97). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', '2fab303b-9c8f-59a2-9805-85665ae5e098');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', '2fab303b-9c8f-59a2-9805-85665ae5e098', DATE '2026-07-19', DATE '2026-06-30', 16863.43, 16860.05, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', '2fab303b-9c8f-59a2-9805-85665ae5e098', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 98 | apLIS lote 5448 | BRADESCO SAUDE  - 005711 ("BRADESCO - GUIAS SEM LOTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc679a55-b07d-578d-8c80-f3a8dbf49544', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5448', DATE '2026-04-10', DATE '2026-05-20', 'Recebido', 4, '340227812037_0', NULL, NULL, NULL, '5448', 5992.40, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1f9da20e-8f84-56a6-a0f3-e52b5deb8c23', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 5992.40, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 98). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1f9da20e-8f84-56a6-a0f3-e52b5deb8c23', 'fc679a55-b07d-578d-8c80-f3a8dbf49544');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1f9da20e-8f84-56a6-a0f3-e52b5deb8c23', 'fc679a55-b07d-578d-8c80-f3a8dbf49544', DATE '2026-07-19', DATE '2026-06-30', 5992.40, 5992.40, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 99 | apLIS lote 5814 | BRADESCO SAUDE  - 005711 ("BRADESCO - GUIAS SEM LOTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f4b531b2-5a80-568a-b627-db0b26c3c06d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5814', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '340227815616_0', NULL, NULL, NULL, '5814', 8626.05, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cbe1dabf-102e-5894-a961-51dfa34036c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 8626.05, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 99). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cbe1dabf-102e-5894-a961-51dfa34036c8', 'f4b531b2-5a80-568a-b627-db0b26c3c06d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cbe1dabf-102e-5894-a961-51dfa34036c8', 'f4b531b2-5a80-568a-b627-db0b26c3c06d', DATE '2026-07-19', DATE '2026-06-30', 8626.05, 8626.05, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 100 | apLIS lote 5813 | BRADESCO SAUDE  - 005711 ("BRADESCO - GUIAS SEM LOTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('676f995c-7ef7-5edc-a3ec-55f5a394e9fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5813', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '340227815674_0', NULL, NULL, NULL, '5813', 7730.64, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8b058cfd-a704-505d-ac33-11cf4dda0ced', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-20', DATE '2026-07-19', 7730.64, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 100). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8b058cfd-a704-505d-ac33-11cf4dda0ced', '676f995c-7ef7-5edc-a3ec-55f5a394e9fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8b058cfd-a704-505d-ac33-11cf4dda0ced', '676f995c-7ef7-5edc-a3ec-55f5a394e9fe', DATE '2026-07-19', DATE '2026-06-30', 7730.64, 7730.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 101 | apLIS lote 5833 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('28e57f89-828f-5268-a391-a7e959cb4b4e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5833', DATE '2026-05-20', DATE '2026-05-20', 'Faturado', 3, '341227834680_0', NULL, NULL, NULL, '5833', 24976.04, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-20', DATE '2026-07-19', 24976.04, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 101). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf', '28e57f89-828f-5268-a391-a7e959cb4b4e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf', '28e57f89-828f-5268-a391-a7e959cb4b4e', DATE '2026-07-19', DATE '2026-06-30', 24976.04, 24976.04, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 102 | apLIS lote 5834 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da05c0b0-4597-5b8f-856d-59ab3a37e80e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5834', DATE '2026-05-20', DATE '2026-05-21', 'Recebido', 4, '341227846366_0', NULL, NULL, NULL, '5834', 13758.50, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a74732c7-3e12-5659-a3cf-4e069bc3285b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-21', DATE '2026-07-20', 13758.50, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 102). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a74732c7-3e12-5659-a3cf-4e069bc3285b', 'da05c0b0-4597-5b8f-856d-59ab3a37e80e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a74732c7-3e12-5659-a3cf-4e069bc3285b', 'da05c0b0-4597-5b8f-856d-59ab3a37e80e', DATE '2026-07-20', DATE '2026-06-30', 13758.50, 13758.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 103 | apLIS lote 5837 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5e1d84ff-201b-5da9-a8dc-f59d64ec10b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5837', DATE '2026-05-21', DATE '2026-05-21', 'Faturado', 3, '341227848108_0', NULL, NULL, NULL, '5837', 870.77, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-21', DATE '2026-07-20', 870.77, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 103). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', '5e1d84ff-201b-5da9-a8dc-f59d64ec10b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', '5e1d84ff-201b-5da9-a8dc-f59d64ec10b8', DATE '2026-07-20', DATE '2026-06-30', 870.77, 867.39, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', '5e1d84ff-201b-5da9-a8dc-f59d64ec10b8', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 104 | apLIS lote 5827 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3543ad2f-541d-5048-849b-09d3956b07af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5827', DATE '2026-05-20', DATE '2026-05-21', 'Recebido - parcial', 7, '340227853365_0', NULL, NULL, NULL, '5827', 10128.23, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9d0460cd-ac6d-5e52-8991-5adf29567016', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-21', DATE '2026-07-20', 10128.23, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 104). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9d0460cd-ac6d-5e52-8991-5adf29567016', '3543ad2f-541d-5048-849b-09d3956b07af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9d0460cd-ac6d-5e52-8991-5adf29567016', '3543ad2f-541d-5048-849b-09d3956b07af', DATE '2026-07-20', DATE '2026-06-30', 10128.23, 9746.81, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9d0460cd-ac6d-5e52-8991-5adf29567016', '3543ad2f-541d-5048-849b-09d3956b07af', 381.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 105 | apLIS lote 5841 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed4d038c-41ae-56f0-b72d-824f87943448', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5841', DATE '2026-05-21', DATE '2026-05-21', 'Recebido', 4, '340227856653_0', NULL, NULL, NULL, '5841', 26698.64, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d65b16d-cf00-5d74-a56c-08721e78617d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-21', DATE '2026-07-20', 26698.64, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 105). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d65b16d-cf00-5d74-a56c-08721e78617d', 'ed4d038c-41ae-56f0-b72d-824f87943448');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7d65b16d-cf00-5d74-a56c-08721e78617d', 'ed4d038c-41ae-56f0-b72d-824f87943448', DATE '2026-07-20', DATE '2026-06-30', 26698.64, 26698.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 106 | apLIS lote 5857 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f4e42276-f401-555c-930e-7f4cd5a85941', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5857', DATE '2026-05-25', DATE '2026-05-25', 'Recebido - parcial', 7, '340227923327_0', NULL, NULL, NULL, '5857', 6903.78, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-25', DATE '2026-07-24', 6903.78, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 106). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', 'f4e42276-f401-555c-930e-7f4cd5a85941');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', 'f4e42276-f401-555c-930e-7f4cd5a85941', DATE '2026-07-24', DATE '2026-06-30', 6903.78, 1633.19, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', 'f4e42276-f401-555c-930e-7f4cd5a85941', 4938.05, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 107 | apLIS lote 5860 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('01bc9b18-b45a-5084-be00-0445b96d04a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5860', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '341227924603_0', NULL, NULL, NULL, '5860', 8260.26, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-05-25', DATE '2026-07-24', 8260.26, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 107). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', '01bc9b18-b45a-5084-be00-0445b96d04a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', '01bc9b18-b45a-5084-be00-0445b96d04a0', DATE '2026-07-24', DATE '2026-06-30', 8260.26, 1995.27, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', '01bc9b18-b45a-5084-be00-0445b96d04a0', 6264.99, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 108 | apLIS lote 5872 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a2eeef7e-7a06-5fe7-a5fb-86ad8ea11a2f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5872', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '340227947777_0', NULL, NULL, NULL, '5872', 635.12, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2d33ca6d-7dd5-5f04-9273-eabb00d25cbf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-25', DATE '2026-07-24', 635.12, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 108). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2d33ca6d-7dd5-5f04-9273-eabb00d25cbf', 'a2eeef7e-7a06-5fe7-a5fb-86ad8ea11a2f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2d33ca6d-7dd5-5f04-9273-eabb00d25cbf', 'a2eeef7e-7a06-5fe7-a5fb-86ad8ea11a2f', DATE '2026-07-24', DATE '2026-06-30', 635.12, 635.12, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 109 | apLIS lote 5873 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f5674e2d-1e88-58b1-9cac-b33d87d9910c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5873', DATE '2026-05-26', DATE '2026-05-26', 'Recebido - parcial', 7, '340227950754_0', NULL, NULL, NULL, '5873', 3554.08, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-26', DATE '2026-07-24', 3554.08, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 109). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', 'f5674e2d-1e88-58b1-9cac-b33d87d9910c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', 'f5674e2d-1e88-58b1-9cac-b33d87d9910c', DATE '2026-07-24', DATE '2026-06-30', 3554.08, 141.93, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', 'f5674e2d-1e88-58b1-9cac-b33d87d9910c', 3412.15, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 110 | apLIS lote 5891 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5388c176-f44a-5b9f-8b7f-2a095f202ff2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5891', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '340227970218_0', NULL, NULL, NULL, '5891', 452.44, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b8c68c04-e222-59d9-9c55-eec4a2876513', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-05-26', DATE '2026-07-24', 452.44, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 110). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b8c68c04-e222-59d9-9c55-eec4a2876513', '5388c176-f44a-5b9f-8b7f-2a095f202ff2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b8c68c04-e222-59d9-9c55-eec4a2876513', '5388c176-f44a-5b9f-8b7f-2a095f202ff2', DATE '2026-07-24', DATE '2026-06-30', 452.44, 452.44, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 111 | apLIS lote 5366 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad28572a-a296-5ac8-a74c-12b110ffc923', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5366', DATE '2026-04-01', DATE '2026-05-05', 'Recebido', 4, '279771', '8224', 8204, DATE '2026-07-31', '5366', 1232.88, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1cfe648b-a295-5fbd-8229-cecff8aa9692', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '8224', DATE '2026-05-05', DATE '2026-07-04', 1232.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 111). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1cfe648b-a295-5fbd-8229-cecff8aa9692', 'ad28572a-a296-5ac8-a74c-12b110ffc923');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1cfe648b-a295-5fbd-8229-cecff8aa9692', 'ad28572a-a296-5ac8-a74c-12b110ffc923', DATE '2026-07-04', DATE '2026-05-29', 1232.88, 1232.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 112 | apLIS lote 5649 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c84afbe-2b34-53ef-ab60-3412956199f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5649', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, '279715', '8223', 8203, DATE '2026-07-31', '5649', 20178.41, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed824dfc-1dce-58f0-b2db-4b988083e85b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '8223', DATE '2026-05-05', DATE '2026-07-04', 20178.41, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 112). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed824dfc-1dce-58f0-b2db-4b988083e85b', '6c84afbe-2b34-53ef-ab60-3412956199f5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ed824dfc-1dce-58f0-b2db-4b988083e85b', '6c84afbe-2b34-53ef-ab60-3412956199f5', DATE '2026-07-04', DATE '2026-05-29', 20178.41, 20178.41, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 113 | apLIS lote 5552 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7bce7406-0149-51bf-aafd-3e8a6ff498c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5552', DATE '2026-04-22', DATE '2026-05-07', 'Recebido - parcial', 7, '227050919', '8240', 8220, DATE '2026-07-31', '5552', 12894.00, 39);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('24093a05-5b09-510c-9160-efd5b3937fd0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-07', DATE '2026-06-06', 12894.00, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 113). Responsável: Rivia. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('24093a05-5b09-510c-9160-efd5b3937fd0', '7bce7406-0149-51bf-aafd-3e8a6ff498c6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('24093a05-5b09-510c-9160-efd5b3937fd0', '7bce7406-0149-51bf-aafd-3e8a6ff498c6', DATE '2026-06-06', DATE '2026-06-10', 12894.00, 12438.26, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('24093a05-5b09-510c-9160-efd5b3937fd0', '7bce7406-0149-51bf-aafd-3e8a6ff498c6', 455.74, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Rivia');

-- MAIO linha 114 | apLIS lote 5684 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ffb238d7-b7bb-5433-b142-56402e426f50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5684', DATE '2026-05-07', DATE '2026-05-07', 'Recebido - parcial', 7, '227449989', '8240', 8220, DATE '2026-07-31', '5684', 29202.49, 95);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-07', DATE '2026-06-06', 29202.49, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 114). Responsável: Rivia. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', 'ffb238d7-b7bb-5433-b142-56402e426f50');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', 'ffb238d7-b7bb-5433-b142-56402e426f50', DATE '2026-06-06', DATE '2026-06-10', 29202.49, 28518.88, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', 'ffb238d7-b7bb-5433-b142-56402e426f50', 683.61, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Rivia');

-- MAIO linha 115 | apLIS lote 5685 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f29db4b7-34fa-53ac-aa0a-c36913bf9de7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5685', DATE '2026-05-07', DATE '2026-05-07', 'Recebido - parcial', 7, '227440607', '8240', 8220, DATE '2026-07-31', '5685', 28402.92, 96);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-07', DATE '2026-06-06', 28402.92, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 115). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', 'f29db4b7-34fa-53ac-aa0a-c36913bf9de7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', 'f29db4b7-34fa-53ac-aa0a-c36913bf9de7', DATE '2026-06-06', DATE '2026-06-10', 28402.92, 26807.83, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', 'f29db4b7-34fa-53ac-aa0a-c36913bf9de7', 1595.09, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 116 | apLIS lote 5363 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3d224600-6546-58f1-9866-cd89e732bb8e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5363', DATE '2026-04-01', DATE '2026-05-08', 'Recebido - parcial', 7, '227479177', '8240', 8220, DATE '2026-07-31', '5363', 2257.05, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-08', DATE '2026-06-07', 2257.05, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 116). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', '3d224600-6546-58f1-9866-cd89e732bb8e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', '3d224600-6546-58f1-9866-cd89e732bb8e', DATE '2026-06-07', DATE '2026-06-10', 2257.05, 2257.03, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', '3d224600-6546-58f1-9866-cd89e732bb8e', 0.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 117 | apLIS lote 5683 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('500d4402-ef05-557a-8ec4-ed4f6b41c249', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5683', DATE '2026-05-07', DATE '2026-05-08', 'Recebido - parcial', 7, '227472841', '8240', 8220, DATE '2026-07-31', '5683', 26524.85, 96);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-08', DATE '2026-06-07', 26524.85, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 117). Responsável: Rivia. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', '500d4402-ef05-557a-8ec4-ed4f6b41c249');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', '500d4402-ef05-557a-8ec4-ed4f6b41c249', DATE '2026-06-07', DATE '2026-06-10', 26524.85, 25613.37, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', '500d4402-ef05-557a-8ec4-ed4f6b41c249', 911.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 118 | apLIS lote 5686 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('687e9e20-0ed5-5a28-b19a-f0abeabb2a0e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5686', DATE '2026-05-07', DATE '2026-05-08', 'Recebido', 4, '227484929', '8240', 8220, DATE '2026-07-31', '5686', 9286.06, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d0c253ce-1235-5c7c-a03e-3fc0ca7d7f42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-08', DATE '2026-06-07', 9286.06, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 118). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d0c253ce-1235-5c7c-a03e-3fc0ca7d7f42', '687e9e20-0ed5-5a28-b19a-f0abeabb2a0e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d0c253ce-1235-5c7c-a03e-3fc0ca7d7f42', '687e9e20-0ed5-5a28-b19a-f0abeabb2a0e', DATE '2026-06-07', DATE '2026-06-10', 9286.06, 9286.06, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 119 | apLIS lote 5688 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad77a1cf-8679-5568-bd5c-dbf0e4332558', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5688', DATE '2026-05-07', DATE '2026-05-08', 'Recebido - parcial', 7, '227477785', '8240', 8220, DATE '2026-07-31', '5688', 6302.10, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-08', DATE '2026-06-07', 6302.10, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 119). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', 'ad77a1cf-8679-5568-bd5c-dbf0e4332558');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', 'ad77a1cf-8679-5568-bd5c-dbf0e4332558', DATE '2026-06-07', DATE '2026-06-10', 6302.10, 6302.08, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', 'ad77a1cf-8679-5568-bd5c-dbf0e4332558', 0.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 121 | apLIS lote 5702 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e37a58c-febf-5b44-9a72-80a57d44d599', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5702', DATE '2026-05-11', DATE '2026-05-11', 'Recebido - parcial', 7, '227504203', NULL, NULL, NULL, '5702', 8350.30, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-11', DATE '2026-06-10', 8350.30, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 121). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', '7e37a58c-febf-5b44-9a72-80a57d44d599');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', '7e37a58c-febf-5b44-9a72-80a57d44d599', DATE '2026-06-10', DATE '2026-06-10', 8350.30, 7894.56, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', '7e37a58c-febf-5b44-9a72-80a57d44d599', 455.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 122 | apLIS lote 5703 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2019df0f-327f-5466-9d8a-d6dfb6a25f47', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5703', DATE '2026-05-11', DATE '2026-05-11', 'Recebido', 4, '227505193', NULL, NULL, NULL, '5703', 127.22, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8b1b8807-19cb-5ca6-a3a7-55fa4618d25c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-11', DATE '2026-06-10', 127.22, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 122). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8b1b8807-19cb-5ca6-a3a7-55fa4618d25c', '2019df0f-327f-5466-9d8a-d6dfb6a25f47');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8b1b8807-19cb-5ca6-a3a7-55fa4618d25c', '2019df0f-327f-5466-9d8a-d6dfb6a25f47', DATE '2026-06-10', DATE '2026-06-10', 127.22, 127.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 123 | apLIS lote 5687 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ec70db27-6d07-546e-be9c-343914469344', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5687', DATE '2026-05-07', DATE '2026-05-13', 'Recebido - parcial', 7, '227597488', NULL, NULL, NULL, '5687', 3326.84, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-13', DATE '2026-06-12', 3326.84, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 123). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', 'ec70db27-6d07-546e-be9c-343914469344');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', 'ec70db27-6d07-546e-be9c-343914469344', DATE '2026-06-12', DATE '2026-06-10', 3326.84, 3326.82, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', 'ec70db27-6d07-546e-be9c-343914469344', 0.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 124 | apLIS lote 5698 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('563645a0-3fbd-507a-a4a8-aa923bf25050', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5698', DATE '2026-05-08', DATE '2026-05-13', 'Recebido - parcial', 7, '227601897', NULL, NULL, NULL, '5698', 639.04, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-13', DATE '2026-06-12', 639.04, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 124). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', '563645a0-3fbd-507a-a4a8-aa923bf25050');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', '563645a0-3fbd-507a-a4a8-aa923bf25050', DATE '2026-06-12', DATE '2026-06-10', 639.04, 639.03, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', '563645a0-3fbd-507a-a4a8-aa923bf25050', 0.01, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 125 | apLIS lote 5748 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('10c14272-34e3-56d7-8640-6a4df1f0701c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5748', DATE '2026-05-13', DATE '2026-05-13', 'Recebido - parcial', 7, '227612332', NULL, NULL, NULL, '5748', 12746.65, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21b892b4-385f-5fc5-8be9-840a561c93b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-13', DATE '2026-06-12', 12746.65, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 125). Responsável: Rivia. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21b892b4-385f-5fc5-8be9-840a561c93b1', '10c14272-34e3-56d7-8640-6a4df1f0701c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21b892b4-385f-5fc5-8be9-840a561c93b1', '10c14272-34e3-56d7-8640-6a4df1f0701c', DATE '2026-06-12', DATE '2026-06-10', 12746.65, 12518.78, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('21b892b4-385f-5fc5-8be9-840a561c93b1', '10c14272-34e3-56d7-8640-6a4df1f0701c', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Rivia');

-- MAIO linha 126 | apLIS lote 5761 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3cabe036-cb74-5158-b61f-208a55f391f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5761', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, '227643821', NULL, NULL, NULL, '5761', 11412.10, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-14', DATE '2026-06-13', 11412.10, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 126). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', '3cabe036-cb74-5158-b61f-208a55f391f7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', '3cabe036-cb74-5158-b61f-208a55f391f7', DATE '2026-06-13', DATE '2026-06-10', 11412.10, 10956.36, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', '3cabe036-cb74-5158-b61f-208a55f391f7', 455.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 127 | apLIS lote 5763 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9bbc01e1-cd6b-565c-821d-51af0c843ea7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5763', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, '227645501', NULL, NULL, NULL, '5763', 5975.08, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-05-14', DATE '2026-06-13', 5975.08, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 127). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', '9bbc01e1-cd6b-565c-821d-51af0c843ea7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', '9bbc01e1-cd6b-565c-821d-51af0c843ea7', DATE '2026-06-13', DATE '2026-06-10', 5975.08, 5747.21, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', '9bbc01e1-cd6b-565c-821d-51af0c843ea7', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 128 | apLIS lote 5765 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b621e4c3-1c77-50c1-8087-8ef486fee74f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5765', DATE '2026-05-14', DATE '2026-05-14', 'Recebido', 4, '227646096', '8240', 8220, DATE '2026-07-31', '5765', 35.66, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8bcb83b1-8c34-5fcf-96b1-fefef4970a2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8240', DATE '2026-05-14', DATE '2026-06-13', 35.66, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 128). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8bcb83b1-8c34-5fcf-96b1-fefef4970a2c', 'b621e4c3-1c77-50c1-8087-8ef486fee74f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8bcb83b1-8c34-5fcf-96b1-fefef4970a2c', 'b621e4c3-1c77-50c1-8087-8ef486fee74f', DATE '2026-06-13', DATE '2026-06-10', 35.66, 35.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 129 | apLIS lote 5792 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ab21acaa-c6f5-5b2b-b28b-6bf12fc5aedc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5792', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, '227756538', '8402', 8382, DATE '2026-08-31', '5792', 787.78, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33fc1c8c-d323-551f-8f3f-2ae0436edf34', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-19', DATE '2026-06-18', 787.78, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 129). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33fc1c8c-d323-551f-8f3f-2ae0436edf34', 'ab21acaa-c6f5-5b2b-b28b-6bf12fc5aedc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('33fc1c8c-d323-551f-8f3f-2ae0436edf34', 'ab21acaa-c6f5-5b2b-b28b-6bf12fc5aedc', DATE '2026-06-18', DATE '2026-06-24', 787.78, 787.78, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 130 | apLIS lote 5793 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d65aa362-7d86-5730-bfc5-6bfe9c14ff4d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5793', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, '227759569', '8402', 8382, DATE '2026-08-31', '5793', 1398.66, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('878a6b1a-af91-5cee-a11e-a462c62cb4ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-19', DATE '2026-06-18', 1398.66, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 130). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('878a6b1a-af91-5cee-a11e-a462c62cb4ba', 'd65aa362-7d86-5730-bfc5-6bfe9c14ff4d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('878a6b1a-af91-5cee-a11e-a462c62cb4ba', 'd65aa362-7d86-5730-bfc5-6bfe9c14ff4d', DATE '2026-06-18', DATE '2026-06-24', 1398.66, 1398.66, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 131 | apLIS lote 5795 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('013b7807-55df-51f9-b05f-cba404114004', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5795', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, '227760751', '8402', 8382, DATE '2026-08-31', '5795', 49.76, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5e70d2a5-74b7-5497-9cd4-08de8b555995', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-19', DATE '2026-06-18', 49.76, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 131). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5e70d2a5-74b7-5497-9cd4-08de8b555995', '013b7807-55df-51f9-b05f-cba404114004');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5e70d2a5-74b7-5497-9cd4-08de8b555995', '013b7807-55df-51f9-b05f-cba404114004', DATE '2026-06-18', DATE '2026-06-24', 49.76, 49.76, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 132 | apLIS lote 5822 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e5b4b67f-ea53-503f-8ea2-cb529e4fa28d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5822', DATE '2026-05-20', DATE '2026-05-20', 'Recebido - parcial', 7, '227818651', '8402', 8382, DATE '2026-08-31', '5822', 13138.82, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-20', DATE '2026-06-19', 13138.82, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 132). Responsável: Renata. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', 'e5b4b67f-ea53-503f-8ea2-cb529e4fa28d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', 'e5b4b67f-ea53-503f-8ea2-cb529e4fa28d', DATE '2026-06-19', DATE '2026-06-24', 13138.82, 12910.95, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', 'e5b4b67f-ea53-503f-8ea2-cb529e4fa28d', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Renata');

-- MAIO linha 133 | apLIS lote 5828 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d3b6c63c-013b-586b-a3ef-d3162b267c93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5828', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '227821481', '8402', 8382, DATE '2026-08-31', '5828', 14497.92, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d6f3a460-d339-5b0e-ad5d-e1d0f89a6fc9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-20', DATE '2026-06-19', 14497.92, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 133). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d6f3a460-d339-5b0e-ad5d-e1d0f89a6fc9', 'd3b6c63c-013b-586b-a3ef-d3162b267c93');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d6f3a460-d339-5b0e-ad5d-e1d0f89a6fc9', 'd3b6c63c-013b-586b-a3ef-d3162b267c93', DATE '2026-06-19', DATE '2026-06-24', 14497.92, 14497.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 134 | apLIS lote 5829 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96e03621-19f7-59cd-ad75-874bfe7ec55a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5829', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '227823222', '8402', 8382, DATE '2026-08-31', '5829', 1117.91, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d94e7926-8698-5092-a1be-b89f30c570ac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-20', DATE '2026-06-19', 1117.91, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 134). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d94e7926-8698-5092-a1be-b89f30c570ac', '96e03621-19f7-59cd-ad75-874bfe7ec55a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d94e7926-8698-5092-a1be-b89f30c570ac', '96e03621-19f7-59cd-ad75-874bfe7ec55a', DATE '2026-06-19', DATE '2026-06-24', 1117.91, 1117.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 135 | apLIS lote 5830 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('21df4bd3-a3c5-5d61-ab10-de667bf7dc6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5830', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '227826928', '8402', 8382, DATE '2026-08-31', '5830', 556.91, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('abf2fcdd-2d3d-50eb-8216-6eb0c42d0a49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-20', DATE '2026-06-19', 556.91, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 135). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('abf2fcdd-2d3d-50eb-8216-6eb0c42d0a49', '21df4bd3-a3c5-5d61-ab10-de667bf7dc6e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('abf2fcdd-2d3d-50eb-8216-6eb0c42d0a49', '21df4bd3-a3c5-5d61-ab10-de667bf7dc6e', DATE '2026-06-19', DATE '2026-06-24', 556.91, 556.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 136 | apLIS lote 5831 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd6cc141-7e2b-55fc-81b7-894b3486f0b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5831', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '227828240', '8402', 8382, DATE '2026-08-31', '5831', 227.87, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('93d0281f-08d8-5b2a-bdc5-ec2c8c3e9ff1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8402', DATE '2026-05-20', DATE '2026-06-19', 227.87, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 136). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('93d0281f-08d8-5b2a-bdc5-ec2c8c3e9ff1', 'cd6cc141-7e2b-55fc-81b7-894b3486f0b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('93d0281f-08d8-5b2a-bdc5-ec2c8c3e9ff1', 'cd6cc141-7e2b-55fc-81b7-894b3486f0b1', DATE '2026-06-19', DATE '2026-06-24', 227.87, 227.87, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 137 | apLIS lote 5885 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d209b82c-caf9-5634-b30f-f69c06b4231a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5885', DATE '2026-05-26', DATE '2026-05-26', 'Faturado', 3, '2605261157147912918', '8842', 8822, DATE '2026-09-30', '5885', 2334.28, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('525799f5-f7ba-56a1-9b91-64b9f220406a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8842', DATE '2026-05-26', DATE '2026-06-25', 2334.28, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 137). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('525799f5-f7ba-56a1-9b91-64b9f220406a', 'd209b82c-caf9-5634-b30f-f69c06b4231a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('525799f5-f7ba-56a1-9b91-64b9f220406a', 'd209b82c-caf9-5634-b30f-f69c06b4231a', DATE '2026-06-25', DATE '2026-08-10', 2334.28, 1453.70, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 138 | apLIS lote 5713 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c92a460-26a5-5cf0-aed4-d2db1ad108b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5713', DATE '2026-05-11', DATE '2026-05-26', 'Recebido', 4, '2605261534180102918', '8842', 8822, DATE '2026-09-30', '5713', 1091.62, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1fae0d6c-1752-57b4-9f54-4c9cf18c9b1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8842', DATE '2026-05-26', DATE '2026-06-25', 1091.62, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 138). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1fae0d6c-1752-57b4-9f54-4c9cf18c9b1d', '4c92a460-26a5-5cf0-aed4-d2db1ad108b4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1fae0d6c-1752-57b4-9f54-4c9cf18c9b1d', '4c92a460-26a5-5cf0-aed4-d2db1ad108b4', DATE '2026-06-25', DATE '2026-08-10', 1091.62, 1091.62, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 139 | apLIS lote 5893 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('84aea2f0-627c-5dc6-a507-15ee7f0e6726', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5893', DATE '2026-05-26', DATE '2026-05-28', 'Recebido', 4, '2605281643214442918', '8842', 8822, DATE '2026-09-30', '5893', 922.59, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d9fd822e-2142-5612-9219-bbaf8313950d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8842', DATE '2026-05-28', DATE '2026-06-27', 922.59, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 139). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d9fd822e-2142-5612-9219-bbaf8313950d', '84aea2f0-627c-5dc6-a507-15ee7f0e6726');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d9fd822e-2142-5612-9219-bbaf8313950d', '84aea2f0-627c-5dc6-a507-15ee7f0e6726', DATE '2026-06-27', DATE '2026-08-10', 922.59, 922.59, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 141 | apLIS lote 5718 | CÂMARA DOS DEPUTADOS ("CAMARA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('14c9eda5-0257-59ce-8f4c-8ee30e9b7e7e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5718', DATE '2026-05-11', DATE '2026-05-12', 'Faturado', 3, '814551', NULL, NULL, NULL, '5718', 641.24, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6cc45c92-3578-5410-acfd-cf4a06d84baa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-05-12', DATE '2026-07-11', 641.24, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 141). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6cc45c92-3578-5410-acfd-cf4a06d84baa', '14c9eda5-0257-59ce-8f4c-8ee30e9b7e7e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6cc45c92-3578-5410-acfd-cf4a06d84baa', '14c9eda5-0257-59ce-8f4c-8ee30e9b7e7e', DATE '2026-07-11', 641.24, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 142 | apLIS lote 5777 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('94c7f9ed-84fb-5aa7-95b7-75f9e3daeeea', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5777', DATE '2026-05-15', DATE '2026-05-19', 'Recebido', 4, '815249', '8579', 8559, DATE '2026-09-30', '5777', 15738.44, 47);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4718c353-ad88-5faf-912d-c6dfff08798f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8579', DATE '2026-05-19', DATE '2026-07-18', 15738.44, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 142). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4718c353-ad88-5faf-912d-c6dfff08798f', '94c7f9ed-84fb-5aa7-95b7-75f9e3daeeea');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4718c353-ad88-5faf-912d-c6dfff08798f', '94c7f9ed-84fb-5aa7-95b7-75f9e3daeeea', DATE '2026-07-18', DATE '2026-07-22', 15738.44, 15738.44, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 143 | apLIS lote 5778 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('52c071ed-5449-5c07-abef-4e368eefee95', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5778', DATE '2026-05-15', DATE '2026-05-19', 'Recebido', 4, '815266', '8579', 8559, DATE '2026-09-30', '5778', 2752.38, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52223b16-7b55-54b9-9321-ba8a61e5a290', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8579', DATE '2026-05-19', DATE '2026-07-18', 2752.38, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 143). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52223b16-7b55-54b9-9321-ba8a61e5a290', '52c071ed-5449-5c07-abef-4e368eefee95');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('52223b16-7b55-54b9-9321-ba8a61e5a290', '52c071ed-5449-5c07-abef-4e368eefee95', DATE '2026-07-18', DATE '2026-07-22', 2752.38, 2752.38, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 144 | apLIS lote 5919 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1d672d99-694c-59ab-8cf4-6a4bb93e17f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5919', DATE '2026-05-29', DATE '2026-09-10', 'Conciliação', 2, '816541', NULL, NULL, NULL, '5919', 3613.99, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b58d54c5-db27-55ea-98de-8344c4eb5a6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-05-29', DATE '2026-07-28', 3613.99, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 144). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b58d54c5-db27-55ea-98de-8344c4eb5a6e', '1d672d99-694c-59ab-8cf4-6a4bb93e17f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b58d54c5-db27-55ea-98de-8344c4eb5a6e', '1d672d99-694c-59ab-8cf4-6a4bb93e17f9', DATE '2026-07-28', 3613.99, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 145 | apLIS lote 5381 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('81dc0a68-0a6f-5eba-810c-e5ec84be0c66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5381', DATE '2026-04-02', DATE '2026-05-05', 'Recebido - parcial', 7, 'CHAVE685269', '8263', 8243, DATE '2026-07-31', '5381', 434.13, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '8263', DATE '2026-05-05', DATE '2026-06-09', 434.13, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 145). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', '81dc0a68-0a6f-5eba-810c-e5ec84be0c66');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', '81dc0a68-0a6f-5eba-810c-e5ec84be0c66', DATE '2026-06-09', DATE '2026-06-19', 434.13, 268.10, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', '81dc0a68-0a6f-5eba-810c-e5ec84be0c66', 166.03, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 146 | apLIS lote 5656 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('56f0998c-3662-57aa-b3b3-4490a1248c42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5656', DATE '2026-05-05', DATE '2026-05-05', 'Recebido - parcial', 7, 'CHAVE685234', '8265', 8245, DATE '2026-07-31', '5656', 2476.80, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '8265', DATE '2026-05-05', DATE '2026-06-09', 2476.80, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 146). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', '56f0998c-3662-57aa-b3b3-4490a1248c42');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', '56f0998c-3662-57aa-b3b3-4490a1248c42', DATE '2026-06-09', DATE '2026-06-19', 2476.80, 2473.15, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', '56f0998c-3662-57aa-b3b3-4490a1248c42', 3.65, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 147 | apLIS lote 5648 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('311992e0-5788-5916-8fc5-ab271beb990a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5648', DATE '2026-05-05', DATE '2026-05-05', 'Recebido - parcial', 7, 'CHAVE138630', NULL, NULL, NULL, '5648', 5463.81, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-05-05', DATE '2026-06-02', 5463.81, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 147). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', '311992e0-5788-5916-8fc5-ab271beb990a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', '311992e0-5788-5916-8fc5-ab271beb990a', DATE '2026-06-02', DATE '2026-07-06', 5463.81, 316.60, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', '311992e0-5788-5916-8fc5-ab271beb990a', 5147.21, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 148 | apLIS lote 5373 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('054abbfc-c6b5-52ed-9fbc-39097e701fa8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5373', DATE '2026-04-01', DATE '2026-05-05', 'Recebido - parcial', 7, 'CHAVE138657', NULL, NULL, NULL, '5373', 2265.48, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e73d5cdc-6907-5bb8-a72c-c57773baed4b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-05-05', DATE '2026-06-02', 2265.48, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 148). Responsável: Renata. Status original na planilha: GLOSA TOTAL.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e73d5cdc-6907-5bb8-a72c-c57773baed4b', '054abbfc-c6b5-52ed-9fbc-39097e701fa8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e73d5cdc-6907-5bb8-a72c-c57773baed4b', '054abbfc-c6b5-52ed-9fbc-39097e701fa8', DATE '2026-06-02', 2265.48, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 149 | apLIS lote 5657 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a46f77bd-5dca-59e9-86d5-7d6c3bfc8284', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5657', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, 'CHAVE138691', NULL, NULL, NULL, '5657', 319.68, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-05-05', DATE '2026-06-02', 319.68, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 149). Responsável: Renata. Status original na planilha: GLOSA TOTAL.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22', 'a46f77bd-5dca-59e9-86d5-7d6c3bfc8284');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22', 'a46f77bd-5dca-59e9-86d5-7d6c3bfc8284', DATE '2026-06-02', 319.68, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22', 'a46f77bd-5dca-59e9-86d5-7d6c3bfc8284', 319.68, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 150 | apLIS lote 5402 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d8a1a025-0cfa-594a-9190-b5b2cc29b619', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5402', DATE '2026-04-06', DATE '2026-05-06', 'Recebido', 4, '189600', NULL, NULL, NULL, '5402', 463.76, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7ad3ff13-1017-55f2-a4f1-cc8c32573eba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-05-06', DATE '2026-06-03', 463.76, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 150). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7ad3ff13-1017-55f2-a4f1-cc8c32573eba', 'd8a1a025-0cfa-594a-9190-b5b2cc29b619');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7ad3ff13-1017-55f2-a4f1-cc8c32573eba', 'd8a1a025-0cfa-594a-9190-b5b2cc29b619', DATE '2026-06-03', DATE '2026-07-06', 463.76, 463.76, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 151 | apLIS lote 5671 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b632c4e4-bb95-5c84-97d8-f257279540cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5671', DATE '2026-05-06', DATE '2026-05-06', 'Recebido', 4, '138865', NULL, NULL, NULL, '5671', 1728.46, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1064a3bf-1f9b-5871-9919-8a0949a8918b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-05-06', DATE '2026-06-03', 1728.46, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 151). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1064a3bf-1f9b-5871-9919-8a0949a8918b', 'b632c4e4-bb95-5c84-97d8-f257279540cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1064a3bf-1f9b-5871-9919-8a0949a8918b', 'b632c4e4-bb95-5c84-97d8-f257279540cc', DATE '2026-06-03', DATE '2026-07-06', 1728.46, 1728.46, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 152 | apLIS lote 5709 | FUSEX ("FUSEX PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('20150a6f-f294-5159-bb99-e68031d40ae6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5709', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, '20260512095531', '8684', 8664, DATE '2026-09-30', '5709', 244.84, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('491a17e7-12b6-56c4-988b-4744ea46408f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '8684', DATE '2026-05-12', DATE '2026-07-11', 244.84, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 152). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('491a17e7-12b6-56c4-988b-4744ea46408f', '20150a6f-f294-5159-bb99-e68031d40ae6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('491a17e7-12b6-56c4-988b-4744ea46408f', '20150a6f-f294-5159-bb99-e68031d40ae6', DATE '2026-07-11', DATE '2026-08-10', 244.84, 244.84, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 153 | apLIS lote 5773 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9f90f3ab-dcbf-52dd-8655-baaaa940faaa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5773', DATE '2026-05-15', DATE '2026-05-15', 'Recebido', 4, '20260515125910', '8684', 8664, DATE '2026-09-30', '5773', 407.82, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('91bd2381-5b8e-579e-9b81-767b5bf1bcc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '8684', DATE '2026-05-19', DATE '2026-07-18', 407.82, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 153). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('91bd2381-5b8e-579e-9b81-767b5bf1bcc5', '9f90f3ab-dcbf-52dd-8655-baaaa940faaa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('91bd2381-5b8e-579e-9b81-767b5bf1bcc5', '9f90f3ab-dcbf-52dd-8655-baaaa940faaa', DATE '2026-07-18', DATE '2026-08-10', 407.82, 407.82, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 154 | apLIS lote 5654 | GAMA SAÚDE ("GAMA SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7cdd84f2-03f6-5510-ac59-3d1d19655f48', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), '5654', DATE '2026-05-05', DATE '2026-05-05', 'Faturado', 3, '16341984', NULL, NULL, NULL, '5654', 183.97, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('14b15bfd-4ff0-57b2-9370-7400d0bb5ffd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), NULL, DATE '2026-05-05', DATE '2026-07-04', 183.97, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 154). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('14b15bfd-4ff0-57b2-9370-7400d0bb5ffd', '7cdd84f2-03f6-5510-ac59-3d1d19655f48');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('14b15bfd-4ff0-57b2-9370-7400d0bb5ffd', '7cdd84f2-03f6-5510-ac59-3d1d19655f48', DATE '2026-07-04', 183.97, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 155 | apLIS lote 5399 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('18eba094-3ab6-5be6-b4d1-ad94435b2383', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5399', DATE '2026-04-06', DATE '2026-04-14', 'Em Processamento', 1, '150125151', '8958', 8938, DATE '2026-10-31', '5399', 820.59, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('633ad1df-d382-5ad8-8558-f5f023f9262f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8958', DATE '2026-05-06', DATE '2026-08-04', 820.59, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 155). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('633ad1df-d382-5ad8-8558-f5f023f9262f', '18eba094-3ab6-5be6-b4d1-ad94435b2383');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('633ad1df-d382-5ad8-8558-f5f023f9262f', '18eba094-3ab6-5be6-b4d1-ad94435b2383', DATE '2026-08-04', 820.59, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 157 | apLIS lote 5672 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4fe065cc-4ac5-534c-85cd-dbf36b8526cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5672', DATE '2026-05-06', DATE '2026-05-07', 'Faturado', 3, '150629263', '8958', 8938, DATE '2026-10-31', '5672', 9154.70, 34);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2528ef77-d733-5eed-8cef-2f40ab34f62d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8958', DATE '2026-05-08', DATE '2026-08-06', 9154.70, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 157). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2528ef77-d733-5eed-8cef-2f40ab34f62d', '4fe065cc-4ac5-534c-85cd-dbf36b8526cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2528ef77-d733-5eed-8cef-2f40ab34f62d', '4fe065cc-4ac5-534c-85cd-dbf36b8526cc', DATE '2026-08-06', 9154.70, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 158 | apLIS lote 5674 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5416ead9-4840-5f36-b0ff-1b9b1ea58888', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5674', DATE '2026-05-06', DATE '2026-05-07', 'Faturado', 3, '150396085', '8958', 8938, DATE '2026-10-31', '5674', 2729.64, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d88b7a1-23b0-57fe-81c4-dacd5609a62a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8958', DATE '2026-05-08', DATE '2026-08-06', 2729.64, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 158). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d88b7a1-23b0-57fe-81c4-dacd5609a62a', '5416ead9-4840-5f36-b0ff-1b9b1ea58888');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8d88b7a1-23b0-57fe-81c4-dacd5609a62a', '5416ead9-4840-5f36-b0ff-1b9b1ea58888', DATE '2026-08-06', 2729.64, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 160 | apLIS lote 5699 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a476dd9-7291-51b5-b18c-a1030a99c652', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5699', DATE '2026-05-08', DATE '2026-05-08', 'Faturado', 3, '152620713', '8958', 8938, DATE '2026-10-31', '5699', 31.18, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d1858dbb-ac68-5419-8ccb-ba20aca1958d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8958', DATE '2026-05-08', DATE '2026-08-06', 31.18, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 160). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d1858dbb-ac68-5419-8ccb-ba20aca1958d', '1a476dd9-7291-51b5-b18c-a1030a99c652');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d1858dbb-ac68-5419-8ccb-ba20aca1958d', '1a476dd9-7291-51b5-b18c-a1030a99c652', DATE '2026-08-06', 31.18, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 161 | apLIS lote 5712 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('551a1968-0503-53ea-b25a-effd35bd6a57', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5712', DATE '2026-05-11', DATE '2026-05-11', 'Faturado', 3, 'PEG173752', '8669', 8649, DATE '2026-09-30', '5712', 2220.10, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ffcc3853-c98b-5e09-b90d-8bcbd10f420d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-11', DATE '2026-06-10', 2220.10, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 161). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ffcc3853-c98b-5e09-b90d-8bcbd10f420d', '551a1968-0503-53ea-b25a-effd35bd6a57');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ffcc3853-c98b-5e09-b90d-8bcbd10f420d', '551a1968-0503-53ea-b25a-effd35bd6a57', DATE '2026-06-10', 2220.10, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 162 | apLIS lote 5732 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('54af4f91-14c9-5221-8392-2a7455cd7472', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5732', DATE '2026-05-11', DATE '2026-05-11', 'Faturado', 3, 'PEG173777', '8669', 8649, DATE '2026-09-30', '5732', 599.57, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c2ee6567-b9cc-5920-a28a-6504a6a0b437', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-11', DATE '2026-06-10', 599.57, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 162). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c2ee6567-b9cc-5920-a28a-6504a6a0b437', '54af4f91-14c9-5221-8392-2a7455cd7472');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c2ee6567-b9cc-5920-a28a-6504a6a0b437', '54af4f91-14c9-5221-8392-2a7455cd7472', DATE '2026-06-10', 599.57, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 163 | apLIS lote 5772 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3794c485-cf22-5259-8891-a65b7f19915d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5772', DATE '2026-05-15', DATE '2026-05-15', 'Faturado', 3, 'PEG175347', '8669', 8649, DATE '2026-09-30', '5772', 333.21, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5fc2add6-d824-5b77-96f2-03036b32f0fa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-15', DATE '2026-06-14', 333.21, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 163). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5fc2add6-d824-5b77-96f2-03036b32f0fa', '3794c485-cf22-5259-8891-a65b7f19915d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5fc2add6-d824-5b77-96f2-03036b32f0fa', '3794c485-cf22-5259-8891-a65b7f19915d', DATE '2026-06-14', 333.21, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 164 | apLIS lote 5771 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1214d737-f3f7-5d60-85eb-7f4b59600d19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5771', DATE '2026-05-15', DATE '2026-05-15', 'Faturado', 3, 'PEG175354', '8669', 8649, DATE '2026-09-30', '5771', 1677.19, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('911cfc77-6e48-5e49-83d0-cb218f4c4a13', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-15', DATE '2026-06-14', 1677.19, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 164). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('911cfc77-6e48-5e49-83d0-cb218f4c4a13', '1214d737-f3f7-5d60-85eb-7f4b59600d19');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('911cfc77-6e48-5e49-83d0-cb218f4c4a13', '1214d737-f3f7-5d60-85eb-7f4b59600d19', DATE '2026-06-14', 1677.19, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 165 | apLIS lote 5768 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3e87c50d-6485-561b-89aa-346c68e49eb9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5768', DATE '2026-05-15', DATE '2026-05-15', 'Faturado', 3, 'PEG175364', '8669', 8649, DATE '2026-09-30', '5768', 12058.93, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('141ae7bf-ae68-5e3f-966a-04ed05727458', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-15', DATE '2026-06-14', 12058.93, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 165). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('141ae7bf-ae68-5e3f-966a-04ed05727458', '3e87c50d-6485-561b-89aa-346c68e49eb9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('141ae7bf-ae68-5e3f-966a-04ed05727458', '3e87c50d-6485-561b-89aa-346c68e49eb9', DATE '2026-06-14', 12058.93, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 166 | apLIS lote 5769 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e68d8c0c-24bf-5179-9301-1e7fa0fc3e39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5769', DATE '2026-05-15', DATE '2026-05-15', 'Faturado', 3, 'PEG175415', '8669', 8649, DATE '2026-09-30', '5769', 7772.45, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('38456a34-ef80-5a3a-9961-b1928dc88824', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-15', DATE '2026-06-14', 7772.45, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 166). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('38456a34-ef80-5a3a-9961-b1928dc88824', 'e68d8c0c-24bf-5179-9301-1e7fa0fc3e39');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('38456a34-ef80-5a3a-9961-b1928dc88824', 'e68d8c0c-24bf-5179-9301-1e7fa0fc3e39', DATE '2026-06-14', 7772.45, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 167 | apLIS lote 5842 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9e58b931-ec9b-5b28-95cd-bf99b6e3a576', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5842', DATE '2026-05-21', DATE '2026-05-21', 'Faturado', 3, 'PEG177388', '8669', 8649, DATE '2026-09-30', '5842', 9180.23, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a249d74-9575-50cd-9f3f-7fb33310dc41', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-21', DATE '2026-06-20', 9180.23, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 167). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a249d74-9575-50cd-9f3f-7fb33310dc41', '9e58b931-ec9b-5b28-95cd-bf99b6e3a576');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2a249d74-9575-50cd-9f3f-7fb33310dc41', '9e58b931-ec9b-5b28-95cd-bf99b6e3a576', DATE '2026-06-20', 9180.23, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 168 | apLIS lote 5846 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('01c51bce-29b4-59d3-855a-6dc57820e300', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5846', DATE '2026-05-21', DATE '2026-05-21', 'Faturado', 3, 'PEG177591', '8669', 8649, DATE '2026-09-30', '5846', 666.42, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb3e63b5-1054-5374-8fd1-1773dbece0d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-21', DATE '2026-06-20', 666.42, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 168). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb3e63b5-1054-5374-8fd1-1773dbece0d7', '01c51bce-29b4-59d3-855a-6dc57820e300');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('bb3e63b5-1054-5374-8fd1-1773dbece0d7', '01c51bce-29b4-59d3-855a-6dc57820e300', DATE '2026-06-20', 666.42, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 169 | apLIS lote 5847 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('375cb196-696e-503b-b299-114551aa3d44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5847', DATE '2026-05-21', DATE '2026-05-21', 'Faturado', 3, 'PEG177625', '8669', 8649, DATE '2026-09-30', '5847', 1670.25, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('38a884c8-9080-5c7a-a45e-d8730b1db356', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-21', DATE '2026-06-20', 1670.25, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 169). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('38a884c8-9080-5c7a-a45e-d8730b1db356', '375cb196-696e-503b-b299-114551aa3d44');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('38a884c8-9080-5c7a-a45e-d8730b1db356', '375cb196-696e-503b-b299-114551aa3d44', DATE '2026-06-20', 1670.25, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 170 | apLIS lote 5856 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80f484e3-9ece-5ee2-b861-f817062f242a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5856', DATE '2026-05-22', DATE '2026-05-22', 'Faturado', 3, 'PEG178132', '8669', 8649, DATE '2026-09-30', '5856', 3402.23, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('70103030-6b4e-5f7d-a79d-97145a64f1d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-22', DATE '2026-06-21', 3402.23, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 170). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('70103030-6b4e-5f7d-a79d-97145a64f1d6', '80f484e3-9ece-5ee2-b861-f817062f242a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('70103030-6b4e-5f7d-a79d-97145a64f1d6', '80f484e3-9ece-5ee2-b861-f817062f242a', DATE '2026-06-21', 3402.23, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 171 | apLIS lote 5863 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('82f75ffc-b2cf-5a93-bbdb-82bdbd24c106', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5863', DATE '2026-05-25', DATE '2026-05-25', 'Faturado', 3, 'PEG178335', '8669', 8649, DATE '2026-09-30', '5863', 2436.72, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('69f08529-9bfa-5c2f-be99-e86ea8c28f73', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8669', DATE '2026-05-25', DATE '2026-06-24', 2436.72, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 171). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('69f08529-9bfa-5c2f-be99-e86ea8c28f73', '82f75ffc-b2cf-5a93-bbdb-82bdbd24c106');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('69f08529-9bfa-5c2f-be99-e86ea8c28f73', '82f75ffc-b2cf-5a93-bbdb-82bdbd24c106', DATE '2026-06-24', 2436.72, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 172 | apLIS lote 5154 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2f223682-e728-5b36-a83f-6b34783bc2b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5154', DATE '2026-03-04', DATE '2026-05-04', 'Recebido - parcial', 7, '4302514', '8272', 8252, DATE '2026-08-31', '5154', 8805.40, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '8272', DATE '2026-05-04', DATE '2026-07-03', 8805.40, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 172). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', '2f223682-e728-5b36-a83f-6b34783bc2b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', '2f223682-e728-5b36-a83f-6b34783bc2b6', DATE '2026-07-03', DATE '2026-06-30', 8805.40, 8282.26, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', '2f223682-e728-5b36-a83f-6b34783bc2b6', 523.14, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 173 | apLIS lote 5637 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('144e579d-8c3d-5570-b5aa-8504d07a7f37', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5637', DATE '2026-05-04', DATE '2026-05-04', 'Recebido - parcial', 7, '4299757', '8272', 8252, DATE '2026-08-31', '5637', 29027.59, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '8272', DATE '2026-05-04', DATE '2026-07-03', 29027.59, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 173). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', '144e579d-8c3d-5570-b5aa-8504d07a7f37');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', '144e579d-8c3d-5570-b5aa-8504d07a7f37', DATE '2026-07-03', DATE '2026-06-30', 29027.59, 28504.46, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', '144e579d-8c3d-5570-b5aa-8504d07a7f37', 523.13, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 174 | apLIS lote 5647 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0515d94c-754f-5b22-aaea-b0e1e8d26353', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5647', DATE '2026-05-04', DATE '2026-05-04', 'Faturado', 3, '4303808', NULL, NULL, NULL, '5647', 5201.17, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0aa5a68f-98e9-58be-be5e-587111864cff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), NULL, DATE '2026-05-04', DATE '2026-07-03', 5201.17, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 174). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0aa5a68f-98e9-58be-be5e-587111864cff', '0515d94c-754f-5b22-aaea-b0e1e8d26353');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0aa5a68f-98e9-58be-be5e-587111864cff', '0515d94c-754f-5b22-aaea-b0e1e8d26353', DATE '2026-07-03', DATE '2026-06-30', 5201.17, 5201.17, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 175 | apLIS lote 5662 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da271a69-4049-547d-8015-1e5b8abd135e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5662', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, '4311383', '8272', 8252, DATE '2026-08-31', '5662', 1880.89, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1719e871-50ea-571e-aae2-1b512b63610f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '8272', DATE '2026-05-05', DATE '2026-07-04', 1880.89, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 175). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1719e871-50ea-571e-aae2-1b512b63610f', 'da271a69-4049-547d-8015-1e5b8abd135e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1719e871-50ea-571e-aae2-1b512b63610f', 'da271a69-4049-547d-8015-1e5b8abd135e', DATE '2026-07-04', DATE '2026-06-30', 1880.89, 1880.89, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 176 | apLIS lote 5385 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('862d51a6-0b32-5665-8ae7-3ae34307628b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5385', DATE '2026-04-02', DATE '2026-05-05', 'Recebido', 4, '37862', '8280', 8260, DATE '2026-08-31', '5385', 2821.88, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c9a6139e-ada5-51b1-a427-c28c5055fa84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '8280', DATE '2026-05-05', DATE '2026-06-30', 2821.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 176). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c9a6139e-ada5-51b1-a427-c28c5055fa84', '862d51a6-0b32-5665-8ae7-3ae34307628b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c9a6139e-ada5-51b1-a427-c28c5055fa84', '862d51a6-0b32-5665-8ae7-3ae34307628b', DATE '2026-06-30', DATE '2026-07-27', 2821.88, 2821.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 177 | apLIS lote 5655 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc9290f9-76c6-5bd5-9dfe-8c1186c1c979', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5655', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, '37829', '8280', 8260, DATE '2026-08-31', '5655', 11702.77, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('45856767-bff1-531a-bd4a-f1af1f7c67a4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '8280', DATE '2026-05-05', DATE '2026-06-30', 11702.77, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 177). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('45856767-bff1-531a-bd4a-f1af1f7c67a4', 'bc9290f9-76c6-5bd5-9dfe-8c1186c1c979');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('45856767-bff1-531a-bd4a-f1af1f7c67a4', 'bc9290f9-76c6-5bd5-9dfe-8c1186c1c979', DATE '2026-06-30', DATE '2026-07-27', 11702.77, 11702.77, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 178 | apLIS lote 5682 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2fe458c1-2f93-5ab5-8a4f-7e637a16d118', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5682', DATE '2026-05-06', DATE '2026-05-06', 'Recebido', 4, '38119', '8280', 8260, DATE '2026-08-31', '5682', 70.62, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff21bd2a-aa12-5b88-87e1-d96dd47a79a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '8280', DATE '2026-05-06', DATE '2026-06-30', 70.62, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 178). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff21bd2a-aa12-5b88-87e1-d96dd47a79a5', '2fe458c1-2f93-5ab5-8a4f-7e637a16d118');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ff21bd2a-aa12-5b88-87e1-d96dd47a79a5', '2fe458c1-2f93-5ab5-8a4f-7e637a16d118', DATE '2026-06-30', DATE '2026-07-27', 70.62, 70.62, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 179 | apLIS lote 5722 | PMDF ("PMDF PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('22626e16-5a4f-5527-a57b-3c40d67c104b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5722', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, 'PEG452204', NULL, NULL, NULL, '5722', 3947.91, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5fb63dfe-7ca4-5097-a7aa-434d386cd17e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-12', DATE '2026-06-11', 3947.91, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 179). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5fb63dfe-7ca4-5097-a7aa-434d386cd17e', '22626e16-5a4f-5527-a57b-3c40d67c104b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5fb63dfe-7ca4-5097-a7aa-434d386cd17e', '22626e16-5a4f-5527-a57b-3c40d67c104b', DATE '2026-06-11', DATE '2026-07-03', 3947.91, 3947.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 180 | apLIS lote 5779 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1dd132e1-927a-5fd0-92be-32c229ca287b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5779', DATE '2026-05-15', DATE '2026-05-15', 'Recebido', 4, 'PEG453194', NULL, NULL, NULL, '5779', 18178.92, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7285cfa1-6545-5ee8-a098-3940a3a6d904', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-15', DATE '2026-06-14', 18178.92, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 180). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7285cfa1-6545-5ee8-a098-3940a3a6d904', '1dd132e1-927a-5fd0-92be-32c229ca287b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7285cfa1-6545-5ee8-a098-3940a3a6d904', '1dd132e1-927a-5fd0-92be-32c229ca287b', DATE '2026-06-14', DATE '2026-07-03', 18178.92, 18178.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 181 | apLIS lote 5788 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('881f2a84-7512-525c-9b3d-81946a535d25', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5788', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, 'PEG453560', NULL, NULL, NULL, '5788', 17091.45, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-18', DATE '2026-06-17', 17091.45, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 181). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb', '881f2a84-7512-525c-9b3d-81946a535d25');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb', '881f2a84-7512-525c-9b3d-81946a535d25', DATE '2026-06-17', DATE '2026-07-03', 17091.45, 17091.45, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 182 | apLIS lote 5783 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('72ed118a-1f8c-563c-b117-c627438c19e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5783', DATE '2026-05-15', DATE '2026-05-18', 'Recebido - parcial', 7, 'PEG453613', NULL, NULL, NULL, '5783', 8598.47, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-18', DATE '2026-06-17', 8598.47, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 182). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a', '72ed118a-1f8c-563c-b117-c627438c19e4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a', '72ed118a-1f8c-563c-b117-c627438c19e4', DATE '2026-06-17', DATE '2026-07-03', 8598.47, 8561.25, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a', '72ed118a-1f8c-563c-b117-c627438c19e4', 37.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 183 | apLIS lote 5782 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('737a66ff-be45-56b5-a09c-321acd8cd680', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5782', DATE '2026-05-15', DATE '2026-05-18', 'Recebido', 4, 'PEG453624', NULL, NULL, NULL, '5782', 6571.80, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b909cdef-8a3d-5a81-be6b-f36b586caa05', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-18', DATE '2026-06-17', 6571.80, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 183). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b909cdef-8a3d-5a81-be6b-f36b586caa05', '737a66ff-be45-56b5-a09c-321acd8cd680');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b909cdef-8a3d-5a81-be6b-f36b586caa05', '737a66ff-be45-56b5-a09c-321acd8cd680', DATE '2026-06-17', DATE '2026-07-03', 6571.80, 6571.80, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 184 | apLIS lote 5780 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('68c091da-8062-50d2-88ee-fdb4dfdc5833', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5780', DATE '2026-05-15', DATE '2026-05-18', 'Recebido', 4, 'PEG453778', NULL, NULL, NULL, '5780', 17980.71, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95e0c6c2-ebc5-5b59-a053-1d74bbb0b36d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-18', DATE '2026-06-17', 17980.71, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 184). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95e0c6c2-ebc5-5b59-a053-1d74bbb0b36d', '68c091da-8062-50d2-88ee-fdb4dfdc5833');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95e0c6c2-ebc5-5b59-a053-1d74bbb0b36d', '68c091da-8062-50d2-88ee-fdb4dfdc5833', DATE '2026-06-17', DATE '2026-07-03', 17980.71, 17980.71, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 185 | apLIS lote 5794 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9a96e401-eaaa-5a12-a577-1bc4d7028ae7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5794', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG453857', NULL, NULL, NULL, '5794', 17837.53, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('13fc3801-87bf-55e4-936f-f31df023551b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 17837.53, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 185). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('13fc3801-87bf-55e4-936f-f31df023551b', '9a96e401-eaaa-5a12-a577-1bc4d7028ae7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('13fc3801-87bf-55e4-936f-f31df023551b', '9a96e401-eaaa-5a12-a577-1bc4d7028ae7', DATE '2026-06-18', DATE '2026-07-03', 17837.53, 17837.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 186 | apLIS lote 5797 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('becbbcb4-32cb-531d-9b27-c5f8d2adfb77', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5797', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG453870', NULL, NULL, NULL, '5797', 9186.93, 30);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f9c7144b-5ec1-5c70-a2ff-4efc30880277', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 9186.93, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 186). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f9c7144b-5ec1-5c70-a2ff-4efc30880277', 'becbbcb4-32cb-531d-9b27-c5f8d2adfb77');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f9c7144b-5ec1-5c70-a2ff-4efc30880277', 'becbbcb4-32cb-531d-9b27-c5f8d2adfb77', DATE '2026-06-18', DATE '2026-07-03', 9186.93, 9186.93, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 187 | apLIS lote 5798 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ef68a688-cf3c-5d89-b7d3-828646a860c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5798', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG453972', NULL, NULL, NULL, '5798', 15711.86, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('36311a2d-103d-5bde-8bb4-ca7d9830ac99', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 15711.86, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 187). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('36311a2d-103d-5bde-8bb4-ca7d9830ac99', 'ef68a688-cf3c-5d89-b7d3-828646a860c3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('36311a2d-103d-5bde-8bb4-ca7d9830ac99', 'ef68a688-cf3c-5d89-b7d3-828646a860c3', DATE '2026-06-18', DATE '2026-07-03', 15711.86, 15711.86, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 188 | apLIS lote 5799 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33a4cf29-c831-5ac5-86e2-f2d3c3f1e1dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5799', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG454020', NULL, NULL, NULL, '5799', 13199.43, 38);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('16e05aa1-e979-5888-a753-ca700d52fa04', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 13199.43, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 188). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('16e05aa1-e979-5888-a753-ca700d52fa04', '33a4cf29-c831-5ac5-86e2-f2d3c3f1e1dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('16e05aa1-e979-5888-a753-ca700d52fa04', '33a4cf29-c831-5ac5-86e2-f2d3c3f1e1dc', DATE '2026-06-18', DATE '2026-07-03', 13199.43, 13199.43, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 189 | apLIS lote 5800 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b97d8f5e-a7ae-50cb-b504-6d6618a431a3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5800', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG454024', NULL, NULL, NULL, '5800', 1108.88, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('880c3667-5ca5-582f-b6a7-b2c2f6db6bd8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 1108.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 189). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('880c3667-5ca5-582f-b6a7-b2c2f6db6bd8', 'b97d8f5e-a7ae-50cb-b504-6d6618a431a3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('880c3667-5ca5-582f-b6a7-b2c2f6db6bd8', 'b97d8f5e-a7ae-50cb-b504-6d6618a431a3', DATE '2026-06-18', DATE '2026-07-03', 1108.88, 1108.88, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 190 | apLIS lote 5801 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('465ec502-4d0e-5d2a-8a85-889f3c8428f3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5801', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, 'PEG454087', NULL, NULL, NULL, '5801', 7430.65, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9618cc4f-9b16-5c5d-962d-75929ffcece0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-19', DATE '2026-06-18', 7430.65, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 190). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9618cc4f-9b16-5c5d-962d-75929ffcece0', '465ec502-4d0e-5d2a-8a85-889f3c8428f3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9618cc4f-9b16-5c5d-962d-75929ffcece0', '465ec502-4d0e-5d2a-8a85-889f3c8428f3', DATE '2026-06-18', DATE '2026-07-03', 7430.65, 7430.65, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 191 | apLIS lote 5849 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd0703e3-e51f-56ca-867b-9ab6f0275307', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5849', DATE '2026-05-22', DATE '2026-05-22', 'Recebido', 4, 'PEG454861', NULL, NULL, NULL, '5849', 4877.82, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c453f83-59ce-5e24-92c0-9a7076a2b1b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-22', DATE '2026-06-21', 4877.82, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 191). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c453f83-59ce-5e24-92c0-9a7076a2b1b1', 'dd0703e3-e51f-56ca-867b-9ab6f0275307');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3c453f83-59ce-5e24-92c0-9a7076a2b1b1', 'dd0703e3-e51f-56ca-867b-9ab6f0275307', DATE '2026-06-21', DATE '2026-07-03', 4877.82, 4877.82, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 192 | apLIS lote 5850 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ee90181f-380d-5fa1-8044-ca3d60def6e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5850', DATE '2026-05-22', DATE '2026-05-22', 'Recebido', 4, 'PEG454859', NULL, NULL, NULL, '5850', 1823.19, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a9d34855-fe9f-5f1e-9dab-4caea2414c06', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-22', DATE '2026-06-21', 1823.19, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 192). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a9d34855-fe9f-5f1e-9dab-4caea2414c06', 'ee90181f-380d-5fa1-8044-ca3d60def6e9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a9d34855-fe9f-5f1e-9dab-4caea2414c06', 'ee90181f-380d-5fa1-8044-ca3d60def6e9', DATE '2026-06-21', DATE '2026-07-03', 1823.19, 1823.19, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 193 | apLIS lote 5854 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0f4dd444-425c-5cf5-8538-c4dd7e160ab7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5854', DATE '2026-05-22', DATE '2026-05-22', 'Recebido', 4, 'PEG454880', NULL, NULL, NULL, '5854', 6916.63, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('29c08f4d-1042-5ce0-a110-460cba13fb55', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-22', DATE '2026-06-21', 6916.63, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 193). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('29c08f4d-1042-5ce0-a110-460cba13fb55', '0f4dd444-425c-5cf5-8538-c4dd7e160ab7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('29c08f4d-1042-5ce0-a110-460cba13fb55', '0f4dd444-425c-5cf5-8538-c4dd7e160ab7', DATE '2026-06-21', DATE '2026-07-03', 6916.63, 6916.63, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 194 | apLIS lote 5855 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c768e8e-0ba4-5f0c-98ea-59db7c41e037', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5855', DATE '2026-05-22', DATE '2026-05-22', 'Recebido', 4, 'PEG454901', NULL, NULL, NULL, '5855', 12536.79, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95e0d54f-b7b3-5c9a-94ee-3efc5ab54b88', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-05-22', DATE '2026-06-21', 12536.79, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 194). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95e0d54f-b7b3-5c9a-94ee-3efc5ab54b88', '6c768e8e-0ba4-5f0c-98ea-59db7c41e037');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95e0d54f-b7b3-5c9a-94ee-3efc5ab54b88', '6c768e8e-0ba4-5f0c-98ea-59db7c41e037', DATE '2026-06-21', DATE '2026-07-03', 12536.79, 12536.79, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 195 | apLIS lote 5776 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0574f7bb-5537-5944-9275-c2a19f6b11cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5776', DATE '2026-05-15', DATE '2026-05-15', 'Faturado', 3, '61949', '8473', 8453, DATE '2026-06-29', '5776', 41838.37, 78);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8473', DATE '2026-05-15', DATE '2026-06-14', 41838.37, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 195). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', '0574f7bb-5537-5944-9275-c2a19f6b11cb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', '0574f7bb-5537-5944-9275-c2a19f6b11cb', DATE '2026-06-14', DATE '2026-07-06', 41838.37, 37070.95, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', '0574f7bb-5537-5944-9275-c2a19f6b11cb', 4767.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 196 | apLIS lote 5707 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc3a47b2-8769-5ac0-a6ff-12896b246eca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5707', DATE '2026-05-11', DATE '2026-05-15', 'Recebido', 4, '61943', '8473', 8453, DATE '2026-06-29', '5707', 6489.37, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('353123ba-99d8-5fcc-bae5-7c5a34b49cd8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8473', DATE '2026-05-15', DATE '2026-06-14', 6489.37, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 196). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('353123ba-99d8-5fcc-bae5-7c5a34b49cd8', 'bc3a47b2-8769-5ac0-a6ff-12896b246eca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('353123ba-99d8-5fcc-bae5-7c5a34b49cd8', 'bc3a47b2-8769-5ac0-a6ff-12896b246eca', DATE '2026-06-14', DATE '2026-07-06', 6489.37, 6489.37, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 197 | apLIS lote 5785 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96469e34-6fb8-5648-922e-cb3d550d8345', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5785', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, '61976', '8473', 8453, DATE '2026-06-29', '5785', 1073.42, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c62b4b8e-aa37-539f-a17a-95f505ba4f03', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8473', DATE '2026-05-18', DATE '2026-06-17', 1073.42, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 197). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c62b4b8e-aa37-539f-a17a-95f505ba4f03', '96469e34-6fb8-5648-922e-cb3d550d8345');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c62b4b8e-aa37-539f-a17a-95f505ba4f03', '96469e34-6fb8-5648-922e-cb3d550d8345', DATE '2026-06-17', DATE '2026-07-06', 1073.42, 1073.42, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 198 | apLIS lote 5786 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cdb93677-56fc-5fd0-9508-0e4180c1d2ea', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5786', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, '61989', '8473', 8453, DATE '2026-06-29', '5786', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4fc2be65-5df1-5a68-bf6e-645a28f885b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8473', DATE '2026-05-18', DATE '2026-06-17', 76.85, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 198). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4fc2be65-5df1-5a68-bf6e-645a28f885b0', 'cdb93677-56fc-5fd0-9508-0e4180c1d2ea');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4fc2be65-5df1-5a68-bf6e-645a28f885b0', 'cdb93677-56fc-5fd0-9508-0e4180c1d2ea', DATE '2026-06-17', DATE '2026-07-06', 76.85, 76.85, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 199 | apLIS lote 5596 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('260f9bfc-99eb-50e5-b520-5dc5bfbe86ff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5596', DATE '2026-04-28', DATE '2026-05-18', 'Recebido', 4, '62079', '8473', 8453, DATE '2026-06-29', '5596', 5487.88, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1dfae9a1-5ccb-513e-a365-3105ba7afd76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8473', DATE '2026-05-18', DATE '2026-06-17', 5487.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 199). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1dfae9a1-5ccb-513e-a365-3105ba7afd76', '260f9bfc-99eb-50e5-b520-5dc5bfbe86ff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1dfae9a1-5ccb-513e-a365-3105ba7afd76', '260f9bfc-99eb-50e5-b520-5dc5bfbe86ff', DATE '2026-06-17', DATE '2026-07-06', 5487.88, 5487.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 200 | apLIS lote 5789 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2439003-f120-5c8e-96d6-2d514b23b8fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5789', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, '62116', '8959', 8939, DATE '2026-10-31', '5789', 5554.49, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8959', DATE '2026-05-18', DATE '2026-06-17', 5554.49, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 200). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf', 'e2439003-f120-5c8e-96d6-2d514b23b8fd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf', 'e2439003-f120-5c8e-96d6-2d514b23b8fd', DATE '2026-06-17', DATE '2026-08-25', 5554.49, 5554.49, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 201 | apLIS lote 5720 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('af6d09c8-c02f-5112-88c0-3676d516e293', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5720', DATE '2026-05-11', DATE '2026-05-11', 'Recebido', 4, '216268', NULL, NULL, NULL, '5720', 1323.58, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('23f64c5a-3621-572f-a328-c00220290fbe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-05-11', DATE '2026-07-10', 1323.58, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 201). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('23f64c5a-3621-572f-a328-c00220290fbe', 'af6d09c8-c02f-5112-88c0-3676d516e293');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('23f64c5a-3621-572f-a328-c00220290fbe', 'af6d09c8-c02f-5112-88c0-3676d516e293', DATE '2026-07-10', DATE '2026-06-24', 1323.58, 1323.58, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 202 | apLIS lote 5803 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2399cc9-d7f9-54ab-bf04-84bdfac754ff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5803', DATE '2026-05-19', DATE '2026-05-21', 'Recebido', 4, '217595', NULL, NULL, NULL, '5803', 9588.28, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94ea477a-d150-5270-b6fe-a01a0a78dad0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-05-21', DATE '2026-07-20', 9588.28, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 202). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94ea477a-d150-5270-b6fe-a01a0a78dad0', 'c2399cc9-d7f9-54ab-bf04-84bdfac754ff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('94ea477a-d150-5270-b6fe-a01a0a78dad0', 'c2399cc9-d7f9-54ab-bf04-84bdfac754ff', DATE '2026-07-20', DATE '2026-07-23', 9588.28, 9588.28, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 203 | apLIS lote 5804 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac83bf51-ed31-5870-b298-62755ff246c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5804', DATE '2026-05-19', DATE '2026-05-21', 'Recebido', 4, '217593', NULL, NULL, NULL, '5804', 2282.60, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4088c686-da0b-53a8-a07b-67c146f718c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-05-21', DATE '2026-07-20', 2282.60, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 203). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4088c686-da0b-53a8-a07b-67c146f718c1', 'ac83bf51-ed31-5870-b298-62755ff246c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4088c686-da0b-53a8-a07b-67c146f718c1', 'ac83bf51-ed31-5870-b298-62755ff246c0', DATE '2026-07-20', DATE '2026-07-23', 2282.60, 2282.60, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 204 | apLIS lote 5790 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c1eb7448-88a0-5430-b491-4215ef6bfd73', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5790', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, '7384138', NULL, NULL, NULL, '5790', 45033.45, 94);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('62c445df-c9bc-56db-a04d-2dd42ff0f2fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-05-18', DATE '2026-06-17', 45033.45, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 204). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('62c445df-c9bc-56db-a04d-2dd42ff0f2fd', 'c1eb7448-88a0-5430-b491-4215ef6bfd73');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('62c445df-c9bc-56db-a04d-2dd42ff0f2fd', 'c1eb7448-88a0-5430-b491-4215ef6bfd73', DATE '2026-06-17', DATE '2026-06-22', 45033.45, 45033.45, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 205 | apLIS lote 5791 | SAUDE CAIXA
-- Data Recebimento '22/0/2026' inválida
-- Data Recebimento na planilha: '22/0/2026' → última baixa no apLIS (2026-06-22)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('773dfcad-dd24-5f1a-9284-c0188b3e2a25', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5791', DATE '2026-05-18', DATE '2026-05-18', 'Recebido', 4, 'PEG7384291', NULL, NULL, NULL, '5791', 7809.22, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('64bed94b-b608-57a1-86fe-3da139920e80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-05-18', DATE '2026-06-17', 7809.22, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 205). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('64bed94b-b608-57a1-86fe-3da139920e80', '773dfcad-dd24-5f1a-9284-c0188b3e2a25');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('64bed94b-b608-57a1-86fe-3da139920e80', '773dfcad-dd24-5f1a-9284-c0188b3e2a25', DATE '2026-06-17', DATE '2026-06-22', 7809.22, 7809.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MAIO linha 206 | apLIS lote 5796 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c799b489-1eda-512b-b1e4-18ae1acfddb8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5796', DATE '2026-05-19', DATE '2026-05-19', 'Recebido', 4, '7385899', NULL, NULL, NULL, '5796', 15768.45, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7c348516-daa6-51ef-a0eb-c2ee913c5860', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-05-19', DATE '2026-06-18', 15768.45, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 206). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7c348516-daa6-51ef-a0eb-c2ee913c5860', 'c799b489-1eda-512b-b1e4-18ae1acfddb8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7c348516-daa6-51ef-a0eb-c2ee913c5860', 'c799b489-1eda-512b-b1e4-18ae1acfddb8', DATE '2026-06-18', DATE '2026-06-22', 15768.45, 15768.45, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 207 | apLIS lote 5864 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8665c1fa-d74b-5dc5-9394-9a5bb5edd89e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5864', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '7398516', NULL, NULL, NULL, '5864', 6556.02, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d5af348f-5ce4-53cb-9b56-af8ab0332248', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-25', DATE '2026-07-25', 6556.02, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 207). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d5af348f-5ce4-53cb-9b56-af8ab0332248', '8665c1fa-d74b-5dc5-9394-9a5bb5edd89e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d5af348f-5ce4-53cb-9b56-af8ab0332248', '8665c1fa-d74b-5dc5-9394-9a5bb5edd89e', DATE '2026-07-25', DATE '2026-07-13', 6556.02, 6556.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 208 | apLIS lote 5865 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('00ed6c77-34e9-59fc-8a96-405e0bef4a6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5865', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '7398557', NULL, NULL, NULL, '5865', 1648.28, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1db83a93-9b44-54d3-baf9-5e463c3f16e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-25', DATE '2026-07-25', 1648.28, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 208). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1db83a93-9b44-54d3-baf9-5e463c3f16e0', '00ed6c77-34e9-59fc-8a96-405e0bef4a6b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1db83a93-9b44-54d3-baf9-5e463c3f16e0', '00ed6c77-34e9-59fc-8a96-405e0bef4a6b', DATE '2026-07-25', DATE '2026-07-13', 1648.28, 1648.28, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 209 | apLIS lote 5866 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('51c53c3f-b9ce-5b67-bc15-e2de26d5ee08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5866', DATE '2026-05-25', DATE '2026-05-25', 'Recebido', 4, '7398620', NULL, NULL, NULL, '5866', 1194.72, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('75a79f08-f100-560c-b56b-6d015fcfee8f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-25', DATE '2026-07-25', 1194.72, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 209). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('75a79f08-f100-560c-b56b-6d015fcfee8f', '51c53c3f-b9ce-5b67-bc15-e2de26d5ee08');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('75a79f08-f100-560c-b56b-6d015fcfee8f', '51c53c3f-b9ce-5b67-bc15-e2de26d5ee08', DATE '2026-07-25', DATE '2026-07-13', 1194.72, 1194.72, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 210 | apLIS lote 5876 | SAUDE CAIXA ("SAUDE CAIXA SEM FISICO" na planilha)
-- lote digitado 58761 → lote real 5876 (pelo protocolo)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('81bb0c3e-32ee-5942-af60-730ee3182cc1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5876', DATE '2026-05-26', DATE '2026-05-26', 'Recebido', 4, '7401124', NULL, NULL, NULL, '5876', 10649.28, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a680f2da-1813-5a96-a4eb-dc8e6088a91b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-26', DATE '2026-07-26', 10649.28, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 210). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a680f2da-1813-5a96-a4eb-dc8e6088a91b', '81bb0c3e-32ee-5942-af60-730ee3182cc1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a680f2da-1813-5a96-a4eb-dc8e6088a91b', '81bb0c3e-32ee-5942-af60-730ee3182cc1', DATE '2026-07-26', DATE '2026-07-13', 10649.28, 10649.28, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 211 | apLIS lote 5914 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c315b99d-29ca-5f0a-90b7-bb4db4e1c134', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5914', DATE '2026-05-28', DATE '2026-05-28', 'Recebido', 4, '260529004716', '8961', 8941, DATE '2026-07-31', '5914', 511.50, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c6ed779c-45ea-5019-b4e2-f376ec0187c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 511.50, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 211). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c6ed779c-45ea-5019-b4e2-f376ec0187c9', 'c315b99d-29ca-5f0a-90b7-bb4db4e1c134');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c6ed779c-45ea-5019-b4e2-f376ec0187c9', 'c315b99d-29ca-5f0a-90b7-bb4db4e1c134', DATE '2026-07-03', DATE '2026-07-17', 511.50, 511.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 212 | apLIS lote 5913 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eb25169c-b942-5e26-a857-1510d6ab5a64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5913', DATE '2026-05-28', DATE '2026-05-28', 'Recebido', 4, '260529004518', '8961', 8941, DATE '2026-07-31', '5913', 419.39, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ef485cd2-7836-512a-a6cf-d50aa61e0966', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 419.39, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 212). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ef485cd2-7836-512a-a6cf-d50aa61e0966', 'eb25169c-b942-5e26-a857-1510d6ab5a64');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ef485cd2-7836-512a-a6cf-d50aa61e0966', 'eb25169c-b942-5e26-a857-1510d6ab5a64', DATE '2026-07-03', DATE '2026-07-17', 419.39, 419.39, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 213 | apLIS lote 5724 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7f94e0fb-504d-5ad2-bff1-80a7e9bd3dd7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5724', DATE '2026-05-11', DATE '2026-05-29', 'Recebido - parcial', 7, '260529005907', '8961', 8941, DATE '2026-07-31', '5724', 1009.72, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b12654d-481a-5d16-b293-959846dd7009', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 1009.72, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 213). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', '7f94e0fb-504d-5ad2-bff1-80a7e9bd3dd7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0b12654d-481a-5d16-b293-959846dd7009', '7f94e0fb-504d-5ad2-bff1-80a7e9bd3dd7', DATE '2026-07-03', DATE '2026-07-17', 1009.72, 1009.72, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 214 | apLIS lote 5908 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc3a2d61-2a03-50e6-80ec-e359838f3c18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5908', DATE '2026-05-28', DATE '2026-05-29', 'Recebido - parcial', 7, '260529011986', '8961', 8941, DATE '2026-07-31', '5908', 9540.36, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 9540.36, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 214). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', 'fc3a2d61-2a03-50e6-80ec-e359838f3c18');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', 'fc3a2d61-2a03-50e6-80ec-e359838f3c18', DATE '2026-07-03', DATE '2026-07-17', 9540.36, 8396.86, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', 'fc3a2d61-2a03-50e6-80ec-e359838f3c18', 1143.50, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 215 | apLIS lote 5909 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('72b6cf14-5ec0-57c6-b446-8e025f58fdc8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5909', DATE '2026-05-28', DATE '2026-05-29', 'Recebido - parcial', 7, '260529009577', NULL, NULL, NULL, '5909', 9930.25, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-05-29', DATE '2026-07-03', 9930.25, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 215). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8', DATE '2026-07-03', DATE '2026-07-17', 9930.25, 8586.45, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8', 1343.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 216 | apLIS lote 5906 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('226d823e-8f65-5c0b-8ae9-4bc8f52ba357', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5906', DATE '2026-05-28', DATE '2026-05-29', 'Recebido - parcial', 7, '260529013786', '8961', 8941, DATE '2026-07-31', '5906', 10696.50, 55);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 10696.50, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 216). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', '226d823e-8f65-5c0b-8ae9-4bc8f52ba357');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', '226d823e-8f65-5c0b-8ae9-4bc8f52ba357', DATE '2026-07-03', DATE '2026-07-17', 10696.50, 9542.16, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', '226d823e-8f65-5c0b-8ae9-4bc8f52ba357', 1154.34, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 217 | apLIS lote 5916 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('44e2766e-f0ed-5993-9531-04a5ad015527', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5916', DATE '2026-05-28', DATE '2026-05-29', 'Recebido - parcial', 7, '260529015017', '8961', 8941, DATE '2026-07-31', '5916', 9147.09, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 9147.09, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 217). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527', DATE '2026-07-03', DATE '2026-07-17', 9147.09, 9147.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527', 656.33, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- MAIO linha 218 | apLIS lote 5915 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('175f2b1f-d5bf-5d56-bc3a-64a9a2b3d072', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5915', DATE '2026-05-28', DATE '2026-05-29', 'Recebido - parcial', 7, '260529015735', '8961', 8941, DATE '2026-07-31', '5915', 11031.19, 54);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 11031.19, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 218). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', '175f2b1f-d5bf-5d56-bc3a-64a9a2b3d072');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', '175f2b1f-d5bf-5d56-bc3a-64a9a2b3d072', DATE '2026-07-03', DATE '2026-07-17', 11031.19, 11031.19, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', '175f2b1f-d5bf-5d56-bc3a-64a9a2b3d072', 42.35, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- MAIO linha 219 | apLIS lote 5923 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3952c470-3d45-5633-b007-f94cc9d509af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5923', DATE '2026-05-29', DATE '2026-05-29', 'Recebido - parcial', 7, '260529017230', '8961', 8941, DATE '2026-07-31', '5923', 2660.58, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 2660.58, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 219). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', '3952c470-3d45-5633-b007-f94cc9d509af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', '3952c470-3d45-5633-b007-f94cc9d509af', DATE '2026-07-03', DATE '2026-07-17', 2660.58, 2660.58, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 220 | apLIS lote 5929 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dfbc42f0-23d9-58ea-8b70-e9f1a5aecc0e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5929', DATE '2026-05-29', DATE '2026-05-29', 'Recebido - parcial', 7, '260529026215', '8961', 8941, DATE '2026-07-31', '5929', 3732.16, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8961', DATE '2026-05-29', DATE '2026-07-03', 3732.16, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 220). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', 'dfbc42f0-23d9-58ea-8b70-e9f1a5aecc0e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', 'dfbc42f0-23d9-58ea-8b70-e9f1a5aecc0e', DATE '2026-07-03', DATE '2026-07-17', 3732.16, 3312.77, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', 'dfbc42f0-23d9-58ea-8b70-e9f1a5aecc0e', 419.39, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 221 | apLIS lote 5766 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('768208e4-ae99-51cb-b32a-09f10a7ad2b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5766', DATE '2026-05-14', DATE '2026-05-14', 'Recebido', 4, '481065', '8452', 8432, DATE '2026-07-27', '5766', 235.00, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c4984464-5b9e-5f64-aba7-af755028155e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-14', DATE '2026-06-13', 235.00, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 221). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c4984464-5b9e-5f64-aba7-af755028155e', '768208e4-ae99-51cb-b32a-09f10a7ad2b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c4984464-5b9e-5f64-aba7-af755028155e', '768208e4-ae99-51cb-b32a-09f10a7ad2b1', DATE '2026-06-13', DATE '2026-08-14', 235.00, 235.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 222 | apLIS lote 5721 | TJDFT ("TJDF PENDENCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d42ff2c9-f74f-510d-813d-6f23d9323f8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5721', DATE '2026-05-11', DATE '2026-05-12', 'Recebido - parcial', 7, 'PEG481206', '8452', 8432, DATE '2026-07-27', '5721', 3178.07, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95413d59-814c-5d7f-a46c-3635c2677eb4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 3178.07, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 222). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95413d59-814c-5d7f-a46c-3635c2677eb4', 'd42ff2c9-f74f-510d-813d-6f23d9323f8c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95413d59-814c-5d7f-a46c-3635c2677eb4', 'd42ff2c9-f74f-510d-813d-6f23d9323f8c', DATE '2026-06-14', DATE '2026-08-14', 3178.07, 3084.80, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('95413d59-814c-5d7f-a46c-3635c2677eb4', 'd42ff2c9-f74f-510d-813d-6f23d9323f8c', 93.27, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 223 | apLIS lote 5757 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('57877bfc-d654-566d-9398-d61e819867ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5757', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, 'PEG481202', '8564', 8544, DATE '2026-09-30', '5757', 147.09, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8564', DATE '2026-05-15', DATE '2026-06-14', 147.09, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 223). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', '57877bfc-d654-566d-9398-d61e819867ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', '57877bfc-d654-566d-9398-d61e819867ed', DATE '2026-06-14', DATE '2026-08-14', 147.09, 76.61, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', '57877bfc-d654-566d-9398-d61e819867ed', 70.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 224 | apLIS lote 5758 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9332e6b2-2a7e-53bb-815f-88428b0414c4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5758', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, 'PEG481200', '8452', 8432, DATE '2026-07-27', '5758', 1877.63, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 1877.63, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 224). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', '9332e6b2-2a7e-53bb-815f-88428b0414c4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', '9332e6b2-2a7e-53bb-815f-88428b0414c4', DATE '2026-06-14', DATE '2026-08-14', 1877.63, 1876.87, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', '9332e6b2-2a7e-53bb-815f-88428b0414c4', 0.76, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 225 | apLIS lote 5756 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('489c1dde-70ce-5d40-949c-d7cb6154076d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5756', DATE '2026-05-14', DATE '2026-05-15', 'Recebido', 4, 'PEG481196', '8452', 8432, DATE '2026-07-27', '5756', 4782.52, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d48c56a0-ef74-59f7-89b6-466dbadd02b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 4782.52, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 225). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d48c56a0-ef74-59f7-89b6-466dbadd02b3', '489c1dde-70ce-5d40-949c-d7cb6154076d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d48c56a0-ef74-59f7-89b6-466dbadd02b3', '489c1dde-70ce-5d40-949c-d7cb6154076d', DATE '2026-06-14', DATE '2026-08-14', 4782.52, 4782.52, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 226 | apLIS lote 5755 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0f835ea-8f37-5be3-8979-fd50b963c75e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5755', DATE '2026-05-14', DATE '2026-05-14', 'Recebido - parcial', 7, 'PEG481191', '8452', 8432, DATE '2026-07-27', '5755', 4804.81, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 4804.81, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 226). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', 'e0f835ea-8f37-5be3-8979-fd50b963c75e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', 'e0f835ea-8f37-5be3-8979-fd50b963c75e', DATE '2026-06-14', DATE '2026-08-14', 4804.81, 4731.50, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', 'e0f835ea-8f37-5be3-8979-fd50b963c75e', 73.31, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 227 | apLIS lote 5754 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f9d9769a-b378-5ed9-86a0-c4725726e40c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5754', DATE '2026-05-13', DATE '2026-05-14', 'Recebido', 4, 'PEG481150', '8452', 8432, DATE '2026-07-27', '5754', 9056.03, 47);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0be7a62e-06d0-5868-86f5-045fec5beb6d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 9056.03, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 227). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0be7a62e-06d0-5868-86f5-045fec5beb6d', 'f9d9769a-b378-5ed9-86a0-c4725726e40c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0be7a62e-06d0-5868-86f5-045fec5beb6d', 'f9d9769a-b378-5ed9-86a0-c4725726e40c', DATE '2026-06-14', DATE '2026-08-14', 9056.03, 9056.03, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 228 | apLIS lote 5753 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e300ba6f-412e-5787-acbd-2fa86a8ce306', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5753', DATE '2026-05-13', DATE '2026-05-13', 'Recebido - parcial', 7, 'PEG481147', '8452', 8432, DATE '2026-07-27', '5753', 15336.82, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 15336.82, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 228). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', 'e300ba6f-412e-5787-acbd-2fa86a8ce306');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', 'e300ba6f-412e-5787-acbd-2fa86a8ce306', DATE '2026-06-14', DATE '2026-08-14', 15336.82, 15249.27, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', 'e300ba6f-412e-5787-acbd-2fa86a8ce306', 87.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 229 | apLIS lote 5760 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0564b78a-60cf-57fd-b023-8bc4117e1246', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5760', DATE '2026-05-14', DATE '2026-05-14', 'Recebido', 4, 'PEG481138', '8452', 8432, DATE '2026-07-27', '5760', 1795.34, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b38ba265-582c-5fa0-a4de-248e5bf10c31', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 1795.34, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 229). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b38ba265-582c-5fa0-a4de-248e5bf10c31', '0564b78a-60cf-57fd-b023-8bc4117e1246');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b38ba265-582c-5fa0-a4de-248e5bf10c31', '0564b78a-60cf-57fd-b023-8bc4117e1246', DATE '2026-06-14', DATE '2026-08-14', 1795.34, 1795.34, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 230 | apLIS lote 5200 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c9c64cbc-966b-59c9-9564-7e82f90d72cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5200', DATE '2026-03-13', DATE '2026-05-15', 'Recebido - parcial', 7, '481230', '8452', 8432, DATE '2026-07-27', '5200', 13251.99, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 13251.99, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 230). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', 'c9c64cbc-966b-59c9-9564-7e82f90d72cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', 'c9c64cbc-966b-59c9-9564-7e82f90d72cc', DATE '2026-06-14', DATE '2026-08-14', 13251.99, 12909.62, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', 'c9c64cbc-966b-59c9-9564-7e82f90d72cc', 342.37, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 231 | apLIS lote 5767 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('56204c5f-87f5-5f96-818b-c14d21910db9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5767', DATE '2026-05-15', DATE '2026-05-15', 'Recebido - parcial', 7, '481264', '8452', 8432, DATE '2026-07-27', '5767', 3086.71, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8e38784d-f943-5c94-adac-87662e9de773', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8452', DATE '2026-05-15', DATE '2026-06-14', 3086.71, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 231). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8e38784d-f943-5c94-adac-87662e9de773', '56204c5f-87f5-5f96-818b-c14d21910db9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8e38784d-f943-5c94-adac-87662e9de773', '56204c5f-87f5-5f96-818b-c14d21910db9', DATE '2026-06-14', DATE '2026-08-14', 3086.71, 1804.18, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8e38784d-f943-5c94-adac-87662e9de773', '56204c5f-87f5-5f96-818b-c14d21910db9', 1282.53, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 232 | apLIS lote 5708 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d15fa517-1064-51ac-a002-da3e43e63fc9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5708', DATE '2026-05-11', DATE '2026-05-20', 'Recebido', 4, '10715610', '8317', 8297, DATE '2026-06-11', '5708', 1436.11, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e3aa07a-8b14-5ec6-818e-643216302a52', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-20', DATE '2026-06-15', 1436.11, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 232). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e3aa07a-8b14-5ec6-818e-643216302a52', 'd15fa517-1064-51ac-a002-da3e43e63fc9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3e3aa07a-8b14-5ec6-818e-643216302a52', 'd15fa517-1064-51ac-a002-da3e43e63fc9', DATE '2026-06-15', DATE '2026-06-26', 1436.11, 1436.11, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 233 | apLIS lote 5805 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b42160fd-b3d9-569c-8ea2-2b8cfa7168f2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5805', DATE '2026-05-20', DATE '2026-05-20', 'Recebido - parcial', 7, '10714027', '8317', 8297, DATE '2026-06-11', '5805', 31583.80, 76);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-20', DATE '2026-06-15', 31583.80, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 233). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', 'b42160fd-b3d9-569c-8ea2-2b8cfa7168f2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', 'b42160fd-b3d9-569c-8ea2-2b8cfa7168f2', DATE '2026-06-15', DATE '2026-06-26', 31583.80, 30412.84, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', 'b42160fd-b3d9-569c-8ea2-2b8cfa7168f2', 1170.96, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 234 | apLIS lote 5816 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a6bb56f6-1c31-5ad0-b6ee-147d670acbc8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5816', DATE '2026-05-20', DATE '2026-05-20', 'Recebido', 4, '10715940', '8317', 8297, DATE '2026-06-11', '5816', 559.44, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f4d108d7-c977-5bb4-abda-3eb4962327b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-20', DATE '2026-06-15', 559.44, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 234). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f4d108d7-c977-5bb4-abda-3eb4962327b3', 'a6bb56f6-1c31-5ad0-b6ee-147d670acbc8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f4d108d7-c977-5bb4-abda-3eb4962327b3', 'a6bb56f6-1c31-5ad0-b6ee-147d670acbc8', DATE '2026-06-15', DATE '2026-06-26', 559.44, 559.44, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 235 | apLIS lote 5821 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea5a5d97-c011-5956-ab3f-9e285df6b3b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5821', DATE '2026-05-20', DATE '2026-05-20', 'Faturado', 3, '10716404', '8317', 8297, DATE '2026-06-11', '5821', 3464.51, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dfdff833-c3a8-522c-9d34-753a602d0bf9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-20', DATE '2026-06-15', 3464.51, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 235). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dfdff833-c3a8-522c-9d34-753a602d0bf9', 'ea5a5d97-c011-5956-ab3f-9e285df6b3b2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dfdff833-c3a8-522c-9d34-753a602d0bf9', 'ea5a5d97-c011-5956-ab3f-9e285df6b3b2', DATE '2026-06-15', DATE '2026-06-26', 3464.51, 3464.51, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 236 | apLIS lote 5839 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7bdabc09-2cc1-5a5c-9dad-7906d5a2ac76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5839', DATE '2026-05-21', DATE '2026-05-21', 'Recebido - parcial', 7, '10719852', '8317', 8297, DATE '2026-06-11', '5839', 212.04, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-21', DATE '2026-06-15', 212.04, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 236). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', '7bdabc09-2cc1-5a5c-9dad-7906d5a2ac76');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', '7bdabc09-2cc1-5a5c-9dad-7906d5a2ac76', DATE '2026-06-15', DATE '2026-06-26', 212.04, 132.12, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', '7bdabc09-2cc1-5a5c-9dad-7906d5a2ac76', 79.92, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MAIO linha 237 | apLIS lote 5840 | STJ ("STJ - pendencia de 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('718b7233-9f01-53e6-b32c-3d6318a6c89c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5840', DATE '2026-05-21', DATE '2026-05-21', 'Recebido', 4, '10719845', '8317', 8297, DATE '2026-06-11', '5840', 677.88, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4e02bfcb-ca6a-56b7-89e0-10d0c6fc687c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8317', DATE '2026-05-21', DATE '2026-06-15', 677.88, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 237). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4e02bfcb-ca6a-56b7-89e0-10d0c6fc687c', '718b7233-9f01-53e6-b32c-3d6318a6c89c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4e02bfcb-ca6a-56b7-89e0-10d0c6fc687c', '718b7233-9f01-53e6-b32c-3d6318a6c89c', DATE '2026-06-15', DATE '2026-06-26', 677.88, 677.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 239 | apLIS lote 5663 | STF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('82fcbbed-3144-5a4d-ba5b-438b012884b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5663', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, 'PEG227249', '8986', 8967, DATE '2026-10-31', '5663', 339.58, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c055396b-25c8-5d14-ae14-80921e780bf5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '8986', DATE '2026-05-05', DATE '2026-06-17', 339.58, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 239). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c055396b-25c8-5d14-ae14-80921e780bf5', '82fcbbed-3144-5a4d-ba5b-438b012884b7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c055396b-25c8-5d14-ae14-80921e780bf5', '82fcbbed-3144-5a4d-ba5b-438b012884b7', DATE '2026-06-17', DATE '2026-08-27', 339.58, 339.58, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 240 | apLIS lote 5661 | STF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d47efde8-9b81-56d6-9d86-bb2b6479a309', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5661', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, 'PEG227246', '8986', 8967, DATE '2026-10-31', '5661', 8042.53, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0fc54776-1768-59f1-849c-7a1e194428bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '8986', DATE '2026-05-05', DATE '2026-06-17', 8042.53, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 240). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0fc54776-1768-59f1-849c-7a1e194428bc', 'd47efde8-9b81-56d6-9d86-bb2b6479a309');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0fc54776-1768-59f1-849c-7a1e194428bc', 'd47efde8-9b81-56d6-9d86-bb2b6479a309', DATE '2026-06-17', DATE '2026-08-27', 8042.53, 8042.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 241 | apLIS lote 5750 | STF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3bdffe55-b2c4-577d-ad09-daf028856600', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5750', DATE '2026-05-13', DATE '2026-05-13', 'Recebido', 4, 'PEG227727', '8986', 8967, DATE '2026-10-31', '5750', 140.96, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2fef5b7a-5542-5a1f-8f74-634cdb0c8b5b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '8986', DATE '2026-05-13', DATE '2026-06-17', 140.96, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 241). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2fef5b7a-5542-5a1f-8f74-634cdb0c8b5b', '3bdffe55-b2c4-577d-ad09-daf028856600');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2fef5b7a-5542-5a1f-8f74-634cdb0c8b5b', '3bdffe55-b2c4-577d-ad09-daf028856600', DATE '2026-06-17', DATE '2026-08-27', 140.96, 140.96, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 242 | apLIS lote 5658 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('78129db7-f398-5074-bfff-4721c5157f2d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5658', DATE '2026-05-05', DATE '2026-05-05', 'Faturado', 3, '4417', NULL, NULL, NULL, '5658', 79.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d6773c87-6bd1-5c76-99a0-d46ba039d696', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), NULL, DATE '2026-05-05', DATE '2026-06-04', 79.92, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 242). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d6773c87-6bd1-5c76-99a0-d46ba039d696', '78129db7-f398-5074-bfff-4721c5157f2d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d6773c87-6bd1-5c76-99a0-d46ba039d696', '78129db7-f398-5074-bfff-4721c5157f2d', DATE '2026-06-04', 79.92, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 243 | apLIS lote 5659 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bca3880f-a536-5c48-96a2-be8886737dd1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5659', DATE '2026-05-05', DATE '2026-05-05', 'Faturado', 3, '61811', '8467', 8447, DATE '2026-08-31', '5659', 5067.02, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8467', DATE '2026-05-05', DATE '2026-06-04', 5067.02, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 243). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', 'bca3880f-a536-5c48-96a2-be8886737dd1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', 'bca3880f-a536-5c48-96a2-be8886737dd1', DATE '2026-06-04', DATE '2026-07-08', 5067.02, 4747.28, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', 'bca3880f-a536-5c48-96a2-be8886737dd1', 319.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MAIO linha 244 | apLIS lote 5378 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4089cbb8-b316-524e-9cc2-35d0106707f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5378', DATE '2026-04-02', DATE '2026-05-05', 'Recebido', 4, '61817', '8476', 8456, DATE '2026-08-31', '5378', 176.25, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fe6a5137-aaf5-569c-a52f-9dc4ce05a0f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8476', DATE '2026-05-05', DATE '2026-06-04', 176.25, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 244). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fe6a5137-aaf5-569c-a52f-9dc4ce05a0f6', '4089cbb8-b316-524e-9cc2-35d0106707f7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fe6a5137-aaf5-569c-a52f-9dc4ce05a0f6', '4089cbb8-b316-524e-9cc2-35d0106707f7', DATE '2026-06-04', DATE '2026-07-08', 176.25, 176.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 245 | apLIS lote 5660 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8f2cf472-76f1-5164-ad7f-3e395ce5a609', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5660', DATE '2026-05-05', DATE '2026-05-05', 'Recebido', 4, '61816', NULL, NULL, NULL, '5660', 898.69, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('83f38c00-4355-56d3-91bd-ebe05ebb530f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-05-05', DATE '2026-06-04', 898.69, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 245). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('83f38c00-4355-56d3-91bd-ebe05ebb530f', '8f2cf472-76f1-5164-ad7f-3e395ce5a609');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('83f38c00-4355-56d3-91bd-ebe05ebb530f', '8f2cf472-76f1-5164-ad7f-3e395ce5a609', DATE '2026-06-04', DATE '2026-07-08', 898.69, 898.69, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 246 | apLIS lote 5759 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('645c7137-7864-5eb2-947f-2d89680270e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5759', DATE '2026-05-14', DATE '2026-05-14', 'Recebido', 4, '61907', '8467', 8447, DATE '2026-08-31', '5759', 2181.22, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('137b22ae-4dc2-522c-821a-bb1c3ba48b80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8467', DATE '2026-05-14', DATE '2026-06-13', 2181.22, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 246). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('137b22ae-4dc2-522c-821a-bb1c3ba48b80', '645c7137-7864-5eb2-947f-2d89680270e0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('137b22ae-4dc2-522c-821a-bb1c3ba48b80', '645c7137-7864-5eb2-947f-2d89680270e0', DATE '2026-06-13', DATE '2026-07-08', 2181.22, 2181.22, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 248 | apLIS lote 5716 | TST ("TST PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('37aadf79-bc8d-54db-94ab-d4f9bb4c3b8b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5716', DATE '2026-05-11', DATE '2026-05-12', 'Recebido', 4, 'P20261249247', NULL, 8266, DATE '2026-08-31', '5716', 1202.56, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('521cb4d6-127a-5a02-9c0b-8c0454bffde9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-05-12', DATE '2026-06-20', 1202.56, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 248). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('521cb4d6-127a-5a02-9c0b-8c0454bffde9', '37aadf79-bc8d-54db-94ab-d4f9bb4c3b8b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('521cb4d6-127a-5a02-9c0b-8c0454bffde9', '37aadf79-bc8d-54db-94ab-d4f9bb4c3b8b', DATE '2026-06-20', DATE '2026-07-10', 1202.56, 1202.56, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 249 | apLIS lote 5508 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b7c8b5b4-8368-5053-bd38-4b9da65ed205', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5508', DATE '2026-04-17', DATE '2026-05-21', 'Recebido', 4, 'P20261250066', NULL, 8266, DATE '2026-08-31', '5508', 7084.02, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b19f5c69-b542-50f2-b6d6-6317e8c1b9a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-05-21', DATE '2026-06-20', 7084.02, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 249). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b19f5c69-b542-50f2-b6d6-6317e8c1b9a5', 'b7c8b5b4-8368-5053-bd38-4b9da65ed205');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b19f5c69-b542-50f2-b6d6-6317e8c1b9a5', 'b7c8b5b4-8368-5053-bd38-4b9da65ed205', DATE '2026-06-20', DATE '2026-06-23', 7084.02, 7084.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MAIO linha 250 | apLIS lote 5844 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c4231d7-8648-51d9-b19b-a6a8a6c62434', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5844', DATE '2026-05-21', DATE '2026-05-21', 'Recebido', 4, 'P20261250100', NULL, 8266, DATE '2026-08-31', '5844', 4328.26, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-05-21', DATE '2026-06-20', 4328.26, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 250). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', '3c4231d7-8648-51d9-b19b-a6a8a6c62434');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', '3c4231d7-8648-51d9-b19b-a6a8a6c62434', DATE '2026-06-20', DATE '2026-06-23', 4328.26, 4328.26, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', '3c4231d7-8648-51d9-b19b-a6a8a6c62434', 0.07, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- MAIO linha 251 | apLIS lote 5845 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d3c43718-2c40-57ce-ac4d-64a7b1adbde7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5845', DATE '2026-05-21', DATE '2026-05-21', 'Recebido', 4, 'P20261250069', NULL, 8266, DATE '2026-08-31', '5845', 583.46, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f3ca7801-07f4-509d-ae9b-99d3a0a72e50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-05-21', DATE '2026-06-20', 583.46, '2026-05', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, linha 251). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f3ca7801-07f4-509d-ae9b-99d3a0a72e50', 'd3c43718-2c40-57ce-ac4d-64a7b1adbde7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f3ca7801-07f4-509d-ae9b-99d3a0a72e50', 'd3c43718-2c40-57ce-ac4d-64a7b1adbde7', DATE '2026-06-20', DATE '2026-06-23', 583.46, 583.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba MAIO, %'
     AND competencia = '2026-05'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 220 THEN
    RAISE EXCEPTION 'Esperados 220 títulos do backfill de maio; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
