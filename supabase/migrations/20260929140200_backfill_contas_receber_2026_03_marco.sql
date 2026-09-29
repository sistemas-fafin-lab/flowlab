-- ============================================================================
-- Backfill histórico: Contas a Receber — Março/2026 (3 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba MARÇO de "Faturamento x Recebimentos - 2026 -
-- 1° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-03;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 177 títulos, R$ 1.398.540,91 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 96 recebidos, 62 parciais, 19 previstos.
-- Glosas: 59 abertas, 2 definitivas (refaturadas em outro lote),
-- 5 revertidas (recuperadas). Status do título: trigger fat_recalcular_nota.
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
    '4730', '4925', '4928', '4937', '4968', '4991', '5025', '5033', '5052', '5068', '5075', '5076'
    '5087', '5088', '5089', '5090', '5091', '5092', '5095', '5098', '5099', '5115', '5116', '5117'
    '5118', '5119', '5120', '5123', '5124', '5125', '5126', '5131', '5132', '5133', '5134', '5136'
    '5137', '5139', '5140', '5141', '5142', '5147', '5148', '5150', '5151', '5155', '5156', '5157'
    '5158', '5159', '5161', '5162', '5163', '5165', '5166', '5167', '5168', '5169', '5171', '5172'
    '5176', '5177', '5178', '5180', '5181', '5184', '5185', '5186', '5189', '5190', '5191', '5192'
    '5193', '5194', '5195', '5196', '5197', '5198', '5199', '5201', '5202', '5204', '5205', '5206'
    '5207', '5208', '5209', '5210', '5211', '5212', '5214', '5215', '5216', '5217', '5221', '5222'
    '5223', '5224', '5225', '5226', '5227', '5228', '5229', '5230', '5231', '5232', '5233', '5234'
    '5235', '5236', '5237', '5238', '5239', '5240', '5241', '5243', '5244', '5245', '5246', '5260'
    '5261', '5263', '5264', '5270', '5271', '5272', '5273', '5274', '5275', '5276', '5277', '5278'
    '5279', '5280', '5281', '5282', '5283', '5284', '5285', '5286', '5287', '5288', '5289', '5290'
    '5291', '5292', '5293', '5294', '5295', '5296', '5297', '5298', '5299', '5300', '5301', '5302'
    '5303', '5307', '5308', '5309', '5311', '5312', '5314', '5315', '5316', '5317', '5319', '5321'
    '5322', '5325', '5327', '5328', '5329', '5330', '5335', '5344', '5356'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1052', '1054', '1078', '1101', '1122', '1123', '1129', '1197', '1204', '1210', '1227', '1228', '1231', '1232', '1235', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283', '1343');
  IF v_operadoras <> 30 THEN
    RAISE EXCEPTION 'Esperadas 30 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- MARÇO linha 25 | apLIS lote 5206 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b0af5f99-d08a-5ac0-ad09-445712d4e7a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5206', DATE '2026-03-13', DATE '2026-03-13', 'Recebido', 4, '13032026', '8030', 8010, DATE '2026-06-30', '5206', 1276.01, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-13', DATE '2026-05-12', 1276.01, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 25). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', 'b0af5f99-d08a-5ac0-ad09-445712d4e7a7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', 'b0af5f99-d08a-5ac0-ad09-445712d4e7a7', DATE '2026-05-12', DATE '2026-05-15', 1276.01, 1276.01, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 26 | apLIS lote 5241 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e7f25f86-a63d-5a39-8a59-42de9a2ed7f3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5241', DATE '2026-03-20', DATE '2026-03-23', 'Recebido', 4, '23032026', '8030', 8010, DATE '2026-06-30', '5241', 25067.55, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a0925e93-12af-5973-aecf-1917630e95c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-23', DATE '2026-05-22', 25067.55, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 26). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a0925e93-12af-5973-aecf-1917630e95c0', 'e7f25f86-a63d-5a39-8a59-42de9a2ed7f3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a0925e93-12af-5973-aecf-1917630e95c0', 'e7f25f86-a63d-5a39-8a59-42de9a2ed7f3', DATE '2026-05-22', DATE '2026-08-04', 25067.55, 25067.55, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 27 | apLIS lote 5185 | AMHP-DF ("AMHPDF - CONAB" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9dc102ce-fe57-5bd6-92b0-004db886052b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5185', DATE '2026-03-11', DATE '2026-03-11', 'Recebido', 4, '11032026', '8030', 8010, DATE '2026-06-30', '5185', 4092.94, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fe2613c5-b2e7-549a-8018-41ce21ac6142', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-11', DATE '2026-05-10', 4092.94, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 27). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fe2613c5-b2e7-549a-8018-41ce21ac6142', '9dc102ce-fe57-5bd6-92b0-004db886052b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fe2613c5-b2e7-549a-8018-41ce21ac6142', '9dc102ce-fe57-5bd6-92b0-004db886052b', DATE '2026-05-10', DATE '2026-05-15', 4092.94, 4092.94, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 28 | apLIS lote 5196 | AMHP-DF ("AMHPDF - CONAB" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('91a58921-638f-5030-8c9b-4b89811e4a1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5196', DATE '2026-03-12', DATE '2026-03-12', 'Recebido', 4, '12032026', NULL, NULL, NULL, '5196', 537.59, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a985828d-beb3-588b-bfd5-837b26f1a734', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 537.59, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 28). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a985828d-beb3-588b-bfd5-837b26f1a734', '91a58921-638f-5030-8c9b-4b89811e4a1d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a985828d-beb3-588b-bfd5-837b26f1a734', '91a58921-638f-5030-8c9b-4b89811e4a1d', DATE '2026-05-11', DATE '2026-05-15', 537.59, 537.59, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 29 | apLIS lote 5239 | AMHP-DF ("AMHPDF - EMBRATEL TELOS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('821a492c-3e65-53d6-88ca-917066b4b62f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5239', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673607', '8030', 8010, DATE '2026-06-30', '5239', 42.56, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('48836bca-0d6c-5bcf-9e62-9a82f238fddd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-19', DATE '2026-05-18', 42.56, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 29). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('48836bca-0d6c-5bcf-9e62-9a82f238fddd', '821a492c-3e65-53d6-88ca-917066b4b62f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('48836bca-0d6c-5bcf-9e62-9a82f238fddd', '821a492c-3e65-53d6-88ca-917066b4b62f', DATE '2026-05-18', DATE '2026-05-18', 42.56, 42.56, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 30 | apLIS lote 5192 | AMHP-DF ("AMHPDF - FAPES" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-11)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ddaab687-1bb3-5c87-bf0e-73998beb4a64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5192', DATE '2026-03-12', DATE '2026-03-12', 'Faturado', 3, '12032026', NULL, NULL, NULL, '5192', 775.61, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2b47a72d-db55-5d27-b448-f60ea4f179d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 775.61, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 30). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2b47a72d-db55-5d27-b448-f60ea4f179d2', 'ddaab687-1bb3-5c87-bf0e-73998beb4a64');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2b47a72d-db55-5d27-b448-f60ea4f179d2', 'ddaab687-1bb3-5c87-bf0e-73998beb4a64', DATE '2026-05-11', DATE '2026-05-11', 775.61, 775.61, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 31 | apLIS lote 5166 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4032a2ec-8091-59e8-9638-942acee3ea9b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5166', DATE '2026-03-06', DATE '2026-03-10', 'Faturado', 3, '10032026', '8030', 8010, DATE '2026-06-30', '5166', 8833.79, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-10', DATE '2026-05-09', 8833.79, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 31). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', '4032a2ec-8091-59e8-9638-942acee3ea9b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', '4032a2ec-8091-59e8-9638-942acee3ea9b', DATE '2026-05-09', DATE '2026-05-15', 8833.79, 8833.79, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 32 | apLIS lote 5207 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8d414322-6b54-5ed3-b9ff-97c0111995ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5207', DATE '2026-03-13', DATE '2026-03-13', 'Faturado', 3, '13032026', NULL, NULL, NULL, '5207', 68.95, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95608998-cb94-5c40-9788-378fff72f690', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-13', DATE '2026-05-12', 68.95, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 32). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95608998-cb94-5c40-9788-378fff72f690', '8d414322-6b54-5ed3-b9ff-97c0111995ba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95608998-cb94-5c40-9788-378fff72f690', '8d414322-6b54-5ed3-b9ff-97c0111995ba', DATE '2026-05-12', DATE '2026-05-12', 68.95, 68.95, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 33 | apLIS lote 5230 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ec42bc2-90de-510f-91a3-4aa28cca7f1c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5230', DATE '2026-03-18', DATE '2026-03-18', 'Faturado', 3, '18032026', '8030', 8010, DATE '2026-06-30', '5230', 4102.82, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d0c178ec-5773-5951-b39a-6ba1f2c56d67', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-18', DATE '2026-05-17', 4102.82, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 33). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d0c178ec-5773-5951-b39a-6ba1f2c56d67', '0ec42bc2-90de-510f-91a3-4aa28cca7f1c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d0c178ec-5773-5951-b39a-6ba1f2c56d67', '0ec42bc2-90de-510f-91a3-4aa28cca7f1c', DATE '2026-05-17', DATE '2026-05-15', 4102.82, 4102.82, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 34 | apLIS lote 5205 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('01ebea91-a9da-5582-8528-fbc382bf0c1a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5205', DATE '2026-03-13', DATE '2026-03-13', 'Faturado', 3, '44671622', NULL, NULL, NULL, '5205', 1682.40, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b664d9e2-6dd6-56db-93cb-83ba81485985', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-13', DATE '2026-05-12', 1682.40, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 34). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b664d9e2-6dd6-56db-93cb-83ba81485985', '01ebea91-a9da-5582-8528-fbc382bf0c1a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b664d9e2-6dd6-56db-93cb-83ba81485985', '01ebea91-a9da-5582-8528-fbc382bf0c1a', DATE '2026-05-12', DATE '2026-05-12', 1682.40, 1682.40, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 35 | apLIS lote 5238 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('38c6fa29-fe00-5fbe-a650-d422d6eb8ef2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5238', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673592', NULL, NULL, NULL, '5238', 3405.28, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('196585d5-4824-5000-89ae-985c259d35b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-19', DATE '2026-05-18', 3405.28, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 35). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('196585d5-4824-5000-89ae-985c259d35b1', '38c6fa29-fe00-5fbe-a650-d422d6eb8ef2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('196585d5-4824-5000-89ae-985c259d35b1', '38c6fa29-fe00-5fbe-a650-d422d6eb8ef2', DATE '2026-05-18', DATE '2026-05-18', 3405.28, 3405.28, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 36 | apLIS lote 5208 | AMHP-DF ("AMHPDF - CASEC/CODEVASF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('058ad7cc-acff-5fad-81f0-f15ea7a49e18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5208', DATE '2026-03-13', DATE '2026-03-13', 'Faturado', 3, '13032026', '8030', 8010, DATE '2026-06-30', '5208', 573.14, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('112199eb-8888-5c71-993e-9834413141fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-13', DATE '2026-05-12', 573.14, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 36). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('112199eb-8888-5c71-993e-9834413141fd', '058ad7cc-acff-5fad-81f0-f15ea7a49e18');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('112199eb-8888-5c71-993e-9834413141fd', '058ad7cc-acff-5fad-81f0-f15ea7a49e18', DATE '2026-05-12', DATE '2026-05-15', 573.14, 573.14, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 37 | apLIS lote 5227 | AMHP-DF ("AMHPDF - CASEC/CODEVASF" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d1e0d923-fab7-500b-a8b9-12efe133391a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5227', DATE '2026-03-18', DATE '2026-03-18', 'Faturado', 3, '18032026', NULL, NULL, NULL, '5227', 216.00, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a6e4b79e-984a-51fc-b14c-77bb7911c4c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-18', DATE '2026-05-17', 216.00, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 37). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a6e4b79e-984a-51fc-b14c-77bb7911c4c6', 'd1e0d923-fab7-500b-a8b9-12efe133391a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a6e4b79e-984a-51fc-b14c-77bb7911c4c6', 'd1e0d923-fab7-500b-a8b9-12efe133391a', DATE '2026-05-17', DATE '2026-05-15', 216.00, 216.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 38 | apLIS lote 5233 | AMHP-DF ("AMHPDF - LIFE EMPRESARIAL" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c702b9e7-da40-56d5-8b9d-8020a5489763', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5233', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673460', '8030', 8010, DATE '2026-06-30', '5233', 2383.74, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-19', DATE '2026-05-18', 2383.74, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 38). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0', 'c702b9e7-da40-56d5-8b9d-8020a5489763');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0', 'c702b9e7-da40-56d5-8b9d-8020a5489763', DATE '2026-05-18', DATE '2026-05-18', 2383.74, 2383.74, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 39 | apLIS lote 5202 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9450402b-f92a-57ac-88b6-1557a87571e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5202', DATE '2026-03-13', DATE '2026-03-13', 'Recebido', 4, '44671604', '8030', 8010, DATE '2026-06-30', '5202', 1104.95, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('537cdbf5-f7ef-5911-9264-a5f5172b4d62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-13', DATE '2026-05-12', 1104.95, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 39). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('537cdbf5-f7ef-5911-9264-a5f5172b4d62', '9450402b-f92a-57ac-88b6-1557a87571e1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('537cdbf5-f7ef-5911-9264-a5f5172b4d62', '9450402b-f92a-57ac-88b6-1557a87571e1', DATE '2026-05-12', DATE '2026-05-15', 1104.95, 1104.95, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 40 | apLIS lote 5236 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-03-10)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac882605-b4d5-5693-a0a8-e949173f40d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5236', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673543', NULL, NULL, NULL, '5236', 76.20, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('28409cad-5ee7-5f8f-b0ef-4aee7c845c72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-19', DATE '2026-05-18', 76.20, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 40). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('28409cad-5ee7-5f8f-b0ef-4aee7c845c72', 'ac882605-b4d5-5693-a0a8-e949173f40d8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('28409cad-5ee7-5f8f-b0ef-4aee7c845c72', 'ac882605-b4d5-5693-a0a8-e949173f40d8', DATE '2026-05-18', DATE '2026-03-10', 76.20, 76.20, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 41 | apLIS lote 5163 | LAB PLANASSISTE ("AMHPDF - PLAN ASSISTE" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ca0d3d3-8f0c-57b5-82f4-efd66d66f36e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5163', DATE '2026-03-06', DATE '2026-03-09', 'Recebido', 4, '9032026', NULL, NULL, NULL, '5163', 6154.96, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d66e227-a0ba-56b9-9754-17a6de6f1930', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-09', DATE '2026-05-08', 6154.96, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 41). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d66e227-a0ba-56b9-9754-17a6de6f1930', '0ca0d3d3-8f0c-57b5-82f4-efd66d66f36e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8d66e227-a0ba-56b9-9754-17a6de6f1930', '0ca0d3d3-8f0c-57b5-82f4-efd66d66f36e', DATE '2026-05-08', DATE '2026-05-18', 6154.96, 6154.96, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 42 | apLIS lote 5165 | LAB PLANASSISTE ("AMHPDF - PLAN ASSISTE" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-03-19)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ec7a6e2-ec8f-52e3-994e-795d8a0a3562', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5165', DATE '2026-03-06', DATE '2026-03-09', 'Recebido', 4, '90320261', NULL, NULL, NULL, '5165', 43480.23, 91);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a56bfdf-de47-5809-a2f0-c2c284e6f17e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-09', DATE '2026-05-08', 43480.23, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 42). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a56bfdf-de47-5809-a2f0-c2c284e6f17e', '0ec7a6e2-ec8f-52e3-994e-795d8a0a3562');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2a56bfdf-de47-5809-a2f0-c2c284e6f17e', '0ec7a6e2-ec8f-52e3-994e-795d8a0a3562', DATE '2026-05-08', DATE '2026-03-19', 43480.23, 43480.23, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 43 | apLIS lote 5171 | LAB PLANASSISTE ("AMHPDF - PLAN ASSISTE" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-08)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('593cc32d-aeab-58d4-9750-413680d0f0f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5171', DATE '2026-03-06', DATE '2026-03-09', 'Faturado', 3, '10032026', NULL, NULL, NULL, '5171', 18994.10, 30);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aeee244c-1907-532e-8ec2-25d2849f9796', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-09', DATE '2026-05-08', 18994.10, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 43). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aeee244c-1907-532e-8ec2-25d2849f9796', '593cc32d-aeab-58d4-9750-413680d0f0f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aeee244c-1907-532e-8ec2-25d2849f9796', '593cc32d-aeab-58d4-9750-413680d0f0f0', DATE '2026-05-08', DATE '2026-05-08', 18994.10, 18994.10, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 44 | apLIS lote 5195 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-11)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8d366677-5a43-57e8-a5c5-9a06ac091bf6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5195', DATE '2026-03-12', DATE '2026-03-12', 'Faturado', 3, '12032026', NULL, NULL, NULL, '5195', 68.39, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8f3fadb-e4ca-5b26-9aea-871d1afe584a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 68.39, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 44). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8f3fadb-e4ca-5b26-9aea-871d1afe584a', '8d366677-5a43-57e8-a5c5-9a06ac091bf6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8f3fadb-e4ca-5b26-9aea-871d1afe584a', '8d366677-5a43-57e8-a5c5-9a06ac091bf6', DATE '2026-05-11', DATE '2026-05-11', 68.39, 68.39, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 45 | apLIS lote 5190 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80ad4bf7-a4d4-5f51-8372-c619af18eb2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5190', DATE '2026-03-12', DATE '2026-03-12', 'Faturado', 3, '12032026', NULL, NULL, NULL, '5190', 4399.88, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cc33da98-4dd8-51d1-96da-dae79f178756', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 4399.88, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 45). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cc33da98-4dd8-51d1-96da-dae79f178756', '80ad4bf7-a4d4-5f51-8372-c619af18eb2c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cc33da98-4dd8-51d1-96da-dae79f178756', '80ad4bf7-a4d4-5f51-8372-c619af18eb2c', DATE '2026-05-11', DATE '2025-12-31', 4399.88, 4399.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 46 | apLIS lote 5229 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-17)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0118f4fb-6a82-5ae0-a5e9-4b2a0cc1c6f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5229', DATE '2026-03-18', DATE '2026-03-18', 'Faturado', 3, '18032026', NULL, NULL, NULL, '5229', 978.52, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('06066c94-6e06-5446-a496-503fa30add9b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-18', DATE '2026-05-17', 978.52, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 46). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('06066c94-6e06-5446-a496-503fa30add9b', '0118f4fb-6a82-5ae0-a5e9-4b2a0cc1c6f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('06066c94-6e06-5446-a496-503fa30add9b', '0118f4fb-6a82-5ae0-a5e9-4b2a0cc1c6f8', DATE '2026-05-17', DATE '2026-05-17', 978.52, 978.52, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 47 | apLIS lote 5198 | AMHP-DF ("AMHPDF - TRF SEÇÃO JUDICIÁRIA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('88a2d5c1-229a-5183-bad9-834e35cdc0b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5198', DATE '2026-03-12', DATE '2026-03-12', 'Faturado', 3, '12032026', NULL, NULL, NULL, '5198', 227.43, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1a3ff490-df50-5eba-9c70-ae038b46e691', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 227.43, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 47). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1a3ff490-df50-5eba-9c70-ae038b46e691', '88a2d5c1-229a-5183-bad9-834e35cdc0b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1a3ff490-df50-5eba-9c70-ae038b46e691', '88a2d5c1-229a-5183-bad9-834e35cdc0b6', DATE '2026-05-11', DATE '2026-05-15', 227.43, 227.43, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 48 | apLIS lote 5193 | AMHP-DF ("AMHPDF - TRF 1ª REGIÃO" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-11)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea5c7bd8-001b-5f67-aefe-259c9d1311f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5193', DATE '2026-03-12', DATE '2026-03-12', 'Faturado', 3, '12032026', NULL, NULL, NULL, '5193', 2033.90, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df26b171-493b-5d1f-b93f-468e475275f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-12', DATE '2026-05-11', 2033.90, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 48). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df26b171-493b-5d1f-b93f-468e475275f6', 'ea5c7bd8-001b-5f67-aefe-259c9d1311f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df26b171-493b-5d1f-b93f-468e475275f6', 'ea5c7bd8-001b-5f67-aefe-259c9d1311f9', DATE '2026-05-11', DATE '2026-05-11', 2033.90, 2033.90, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 49 | apLIS lote 5184 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('15573330-8973-536c-b6cc-30caa9d11f6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5184', DATE '2026-03-10', DATE '2026-03-11', 'Faturado', 3, '11032026', '8030', 8010, DATE '2026-06-30', '5184', 10609.15, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e22b7a64-beaa-5880-8a17-7a40f98463b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-11', DATE '2026-05-10', 10609.15, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 49). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e22b7a64-beaa-5880-8a17-7a40f98463b9', '15573330-8973-536c-b6cc-30caa9d11f6f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e22b7a64-beaa-5880-8a17-7a40f98463b9', '15573330-8973-536c-b6cc-30caa9d11f6f', DATE '2026-05-10', DATE '2026-05-15', 10609.15, 10609.15, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 50 | apLIS lote 5209 | AMHP-DF ("AMHPDF - PETROBRÁS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8025c8fb-2d8e-5851-acd4-d318dcb3e68d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5209', DATE '2026-03-13', DATE '2026-03-13', 'Faturado', 3, '44671735', '8030', 8010, DATE '2026-06-30', '5209', 60.30, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('630085bf-10f7-5d47-a98c-c367294f249e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-13', DATE '2026-05-12', 60.30, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 50). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('630085bf-10f7-5d47-a98c-c367294f249e', '8025c8fb-2d8e-5851-acd4-d318dcb3e68d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('630085bf-10f7-5d47-a98c-c367294f249e', '8025c8fb-2d8e-5851-acd4-d318dcb3e68d', DATE '2026-05-12', DATE '2026-05-12', 60.30, 60.30, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 51 | apLIS lote 5231 | AMHP-DF ("AMHPDF - PETROBRÁS" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c19f18d-2ac8-56d5-aeb2-b8a69a567dc8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5231', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673438', NULL, NULL, NULL, '5231', 3693.02, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d84bad2a-9280-5355-a387-08d53bfff953', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-19', DATE '2026-05-18', 3693.02, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 51). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d84bad2a-9280-5355-a387-08d53bfff953', '3c19f18d-2ac8-56d5-aeb2-b8a69a567dc8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d84bad2a-9280-5355-a387-08d53bfff953', '3c19f18d-2ac8-56d5-aeb2-b8a69a567dc8', DATE '2026-05-18', DATE '2026-05-18', 3693.02, 3693.02, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 52 | apLIS lote 5211 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-12)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3b43a598-e458-5a58-b241-56509074e57b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5211', DATE '2026-03-13', DATE '2026-03-13', 'Faturado', 3, '44671815', NULL, NULL, NULL, '5211', 639.37, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7c6c2990-d14e-5aad-809c-16b67801e270', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-13', DATE '2026-05-12', 639.37, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 52). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7c6c2990-d14e-5aad-809c-16b67801e270', '3b43a598-e458-5a58-b241-56509074e57b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7c6c2990-d14e-5aad-809c-16b67801e270', '3b43a598-e458-5a58-b241-56509074e57b', DATE '2026-05-12', DATE '2026-05-12', 639.37, 639.37, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 53 | apLIS lote 5223 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96c949a2-19f2-5f67-bf98-74457a769bb8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5223', DATE '2026-03-17', DATE '2026-03-17', 'Recebido', 4, '44673168', NULL, NULL, NULL, '5223', 3237.82, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('71502a28-1520-5176-ae77-b488e558fe85', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-18', DATE '2026-05-17', 3237.82, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 53). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('71502a28-1520-5176-ae77-b488e558fe85', '96c949a2-19f2-5f67-bf98-74457a769bb8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('71502a28-1520-5176-ae77-b488e558fe85', '96c949a2-19f2-5f67-bf98-74457a769bb8', DATE '2026-05-17', DATE '2025-12-31', 3237.82, 3237.82, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 54 | apLIS lote 5240 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('17101e77-5c8d-5064-bd70-d1558b8f2052', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5240', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, '44673646', NULL, NULL, NULL, '5240', 2957.43, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c5864c1-1b26-53cc-a7b7-9db86f62c759', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-19', DATE '2026-05-18', 2957.43, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 54). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c5864c1-1b26-53cc-a7b7-9db86f62c759', '17101e77-5c8d-5064-bd70-d1558b8f2052');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0c5864c1-1b26-53cc-a7b7-9db86f62c759', '17101e77-5c8d-5064-bd70-d1558b8f2052', DATE '2026-05-18', DATE '2026-05-18', 2957.43, 2957.43, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 56 | apLIS lote 5235 | AMHP-DF ("AMHPDF - NOTREDAME" na planilha)
-- Data Recebimento na planilha: 'vazia' → data provável de pagamento (2026-05-18)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('295cdd5e-3b87-56d6-8824-a26f95a63ac0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5235', DATE '2026-03-19', DATE '2026-03-19', 'Em Processamento', 1, '44673517', NULL, NULL, NULL, '5235', 1051.60, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8cee2f56-118e-52d0-b056-d9efb118237c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-19', DATE '2026-05-18', 1051.60, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 56). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8cee2f56-118e-52d0-b056-d9efb118237c', '295cdd5e-3b87-56d6-8824-a26f95a63ac0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8cee2f56-118e-52d0-b056-d9efb118237c', '295cdd5e-3b87-56d6-8824-a26f95a63ac0', DATE '2026-05-18', DATE '2026-05-18', 1051.60, 1051.60, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 57 | apLIS lote 5199 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('221b4612-66e4-52d5-96dd-c39cb7c25046', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5199', DATE '2026-03-13', DATE '2026-03-13', 'Recebido', 4, '13032026', '8030', 8010, DATE '2026-06-30', '5199', 2808.23, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('19391c80-5c03-52c2-adeb-e83a6b990214', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-03-13', DATE '2026-05-12', 2808.23, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 57). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('19391c80-5c03-52c2-adeb-e83a6b990214', '221b4612-66e4-52d5-96dd-c39cb7c25046');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('19391c80-5c03-52c2-adeb-e83a6b990214', '221b4612-66e4-52d5-96dd-c39cb7c25046', DATE '2026-05-12', DATE '2026-05-15', 2808.23, 2808.23, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 58 | apLIS lote 5228 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'vazia' → última baixa no apLIS (2026-05-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6bcdee92-f8c9-5c69-9904-351da3317b42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5228', DATE '2026-03-18', DATE '2026-03-18', 'Recebido', 4, '18032026', NULL, NULL, NULL, '5228', 848.36, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-03-18', DATE '2026-05-17', 848.36, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 58). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42', '6bcdee92-f8c9-5c69-9904-351da3317b42');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42', '6bcdee92-f8c9-5c69-9904-351da3317b42', DATE '2026-05-17', DATE '2026-05-15', 848.36, 848.36, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- MARÇO linha 59 | apLIS lote 5159 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('294e3b3e-2249-50d4-8172-d88587c50958', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5159', DATE '2026-03-05', DATE '2026-03-05', 'Recebido - parcial', 7, 'PEG5640072907', NULL, NULL, NULL, '5159', 3320.15, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-03-05', DATE '2026-04-04', 3320.15, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 59). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', '294e3b3e-2249-50d4-8172-d88587c50958');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', '294e3b3e-2249-50d4-8172-d88587c50958', DATE '2026-04-04', DATE '2026-04-06', 3320.15, 3320.15, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 60 | apLIS lote 5158 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('76331db7-d4cb-5f62-ab97-56e44e674037', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5158', DATE '2026-03-05', DATE '2026-03-05', 'Recebido', 4, 'PEG5640528012', NULL, NULL, NULL, '5158', 9826.81, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-03-06', DATE '2026-04-05', 9826.81, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 60). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', '76331db7-d4cb-5f62-ab97-56e44e674037');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', '76331db7-d4cb-5f62-ab97-56e44e674037', DATE '2026-04-05', DATE '2026-04-06', 9826.81, 8519.36, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', '76331db7-d4cb-5f62-ab97-56e44e674037', 515.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 61 | apLIS lote 5157 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e246cba-6e6e-557b-8522-013ee92fa4d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5157', DATE '2026-03-05', DATE '2026-03-06', 'Recebido', 4, 'PEG5642108295', NULL, NULL, NULL, '5157', 9531.98, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-03-09', DATE '2026-04-08', 9531.98, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 61). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', '7e246cba-6e6e-557b-8522-013ee92fa4d5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', '7e246cba-6e6e-557b-8522-013ee92fa4d5', DATE '2026-04-08', DATE '2026-04-06', 9531.98, 9531.98, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', '7e246cba-6e6e-557b-8522-013ee92fa4d5', 80.00, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Raquel');

-- MARÇO linha 62 | apLIS lote 5131 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1811f2c1-a9ee-5d5d-9a18-8c8e48eab841', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5131', DATE '2026-03-03', DATE '2026-03-03', 'Recebido - parcial', 7, '1314158', NULL, NULL, NULL, '5131', 12655.84, 68);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-03', DATE '2026-04-20', 12655.84, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 62). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', '1811f2c1-a9ee-5d5d-9a18-8c8e48eab841');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', '1811f2c1-a9ee-5d5d-9a18-8c8e48eab841', DATE '2026-04-20', DATE '2026-05-08', 12655.84, 12579.16, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', '1811f2c1-a9ee-5d5d-9a18-8c8e48eab841', 76.68, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 63 | apLIS lote 5132 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fa2267c1-1cd5-53ad-95fe-f4d157433fd1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5132', DATE '2026-03-03', DATE '2026-03-03', 'Recebido - parcial', 7, '1315390', NULL, NULL, NULL, '5132', 10971.34, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-03', DATE '2026-04-20', 10971.34, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 63). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', 'fa2267c1-1cd5-53ad-95fe-f4d157433fd1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', 'fa2267c1-1cd5-53ad-95fe-f4d157433fd1', DATE '2026-04-20', DATE '2026-05-08', 10971.34, 10891.58, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', 'fa2267c1-1cd5-53ad-95fe-f4d157433fd1', 79.76, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 64 | apLIS lote 5140 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7749cb27-9a3d-50a6-9a94-72de74be7eb8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5140', DATE '2026-03-03', DATE '2026-03-03', 'Recebido - parcial', 7, '1315130', NULL, NULL, NULL, '5140', 10289.83, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-03', DATE '2026-04-20', 10289.83, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 64). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', '7749cb27-9a3d-50a6-9a94-72de74be7eb8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', '7749cb27-9a3d-50a6-9a94-72de74be7eb8', DATE '2026-04-20', DATE '2026-05-08', 10289.83, 9633.84, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', '7749cb27-9a3d-50a6-9a94-72de74be7eb8', 655.99, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 65 | apLIS lote 4991 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da78e13d-7f13-5d49-b474-3ecc476dc3b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4991', DATE '2026-02-06', DATE '2026-03-04', 'Faturado', 3, 'PEG1318145', NULL, NULL, NULL, '4991', 3137.28, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-04', DATE '2026-04-20', 3137.28, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 65). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', 'da78e13d-7f13-5d49-b474-3ecc476dc3b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', 'da78e13d-7f13-5d49-b474-3ecc476dc3b6', DATE '2026-04-20', DATE '2026-05-08', 3137.28, 2970.30, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', 'da78e13d-7f13-5d49-b474-3ecc476dc3b6', 166.98, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 66 | apLIS lote 5133 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('421ab2b4-0cab-598d-a4a4-31d059d16a10', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5133', DATE '2026-03-03', DATE '2026-03-04', 'Recebido', 4, '1318968', NULL, NULL, NULL, '5133', 8995.44, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eeb8d437-6d39-569e-84b3-06cd75b6c19d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-04', DATE '2026-04-20', 8995.44, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 66). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eeb8d437-6d39-569e-84b3-06cd75b6c19d', '421ab2b4-0cab-598d-a4a4-31d059d16a10');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eeb8d437-6d39-569e-84b3-06cd75b6c19d', '421ab2b4-0cab-598d-a4a4-31d059d16a10', DATE '2026-04-20', DATE '2026-05-08', 8995.44, 8995.44, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 67 | apLIS lote 5134 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4fca90a1-ca3b-5581-babf-2bbcba83b0fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5134', DATE '2026-03-03', DATE '2026-03-09', 'Recebido', 4, 'PEG1318685', NULL, NULL, NULL, '5134', 11012.09, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e9c7ed99-65f2-5ab5-a709-72fc72a3f9d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-04', DATE '2026-04-20', 11012.09, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 67). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e9c7ed99-65f2-5ab5-a709-72fc72a3f9d4', '4fca90a1-ca3b-5581-babf-2bbcba83b0fd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e9c7ed99-65f2-5ab5-a709-72fc72a3f9d4', '4fca90a1-ca3b-5581-babf-2bbcba83b0fd', DATE '2026-04-20', DATE '2026-05-08', 11012.09, 11012.09, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 68 | apLIS lote 5150 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e6423254-ec7d-50a5-8a60-6951f0c3ee25', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5150', DATE '2026-03-04', DATE '2026-03-05', 'Recebido - parcial', 7, '1320467', NULL, NULL, NULL, '5150', 6805.70, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-03-05', DATE '2026-04-20', 6805.70, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 68). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', 'e6423254-ec7d-50a5-8a60-6951f0c3ee25');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', 'e6423254-ec7d-50a5-8a60-6951f0c3ee25', DATE '2026-04-20', DATE '2026-05-08', 6805.70, 3850.90, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', 'e6423254-ec7d-50a5-8a60-6951f0c3ee25', 2954.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 69 | apLIS lote 5075 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('44df7984-0f5b-555a-b22a-eeb0e7020462', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5075', DATE '2026-02-25', DATE '2026-03-26', 'Recebido - parcial', 7, '340226308494_0', '8195', 8175, DATE '2026-05-27', '5075', 31745.41, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-03-26', DATE '2026-05-25', 31745.41, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 69). Responsável: Ana Lucia. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', '44df7984-0f5b-555a-b22a-eeb0e7020462');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', '44df7984-0f5b-555a-b22a-eeb0e7020462', DATE '2026-05-25', DATE '2026-05-18', 31745.41, 28909.50, 'parcial', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', '44df7984-0f5b-555a-b22a-eeb0e7020462', 1620.52, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana Lucia');

-- MARÇO linha 70 | apLIS lote 5296 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4739dc4a-ed0c-5172-9a49-f72db30bba60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5296', DATE '2026-03-25', DATE '2026-03-26', 'Faturado', 3, '341226307816_0', '8294', 8274, DATE '2026-06-05', '5296', 1144.17, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-03-26', DATE '2026-05-25', 1144.17, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 70). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', '4739dc4a-ed0c-5172-9a49-f72db30bba60');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', '4739dc4a-ed0c-5172-9a49-f72db30bba60', DATE '2026-05-25', DATE '2026-06-02', 1144.17, 1015.28, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', '4739dc4a-ed0c-5172-9a49-f72db30bba60', 128.89, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 71 | apLIS lote 5292 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ffe04fb5-910b-5e94-9de5-1dd86ecbf501', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5292', DATE '2026-03-25', DATE '2026-03-26', 'Faturado', 3, '340226309028_0', '8029', 8009, DATE '2026-05-15', '5292', 809.83, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-03-26', DATE '2026-05-25', 809.83, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 71). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b', 'ffe04fb5-910b-5e94-9de5-1dd86ecbf501');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b', 'ffe04fb5-910b-5e94-9de5-1dd86ecbf501', DATE '2026-05-25', 809.83, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b', 'ffe04fb5-910b-5e94-9de5-1dd86ecbf501', 809.83, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 72 | apLIS lote 5287 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('790ec238-4a23-5a8c-a736-c612eaca5eee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5287', DATE '2026-03-25', DATE '2026-03-25', 'Faturado', 3, '340226301657_0', '8000', 7980, DATE '2026-05-07', '5287', 3940.28, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8000', DATE '2026-03-26', DATE '2026-05-25', 3940.28, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 72). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', '790ec238-4a23-5a8c-a736-c612eaca5eee');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', '790ec238-4a23-5a8c-a736-c612eaca5eee', DATE '2026-05-25', DATE '2026-05-05', 3940.28, 3940.28, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', '790ec238-4a23-5a8c-a736-c612eaca5eee', 25.54, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- MARÇO linha 73 | apLIS lote 5288 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f9ae8a3c-9e18-5eda-bac2-d793049b8600', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5288', DATE '2026-03-25', DATE '2026-03-25', 'Recebido - parcial', 7, '340226292336_0', NULL, 7978, DATE '2026-05-07', '5288', 13920.35, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-03-26', DATE '2026-05-25', 13920.35, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 73). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', 'f9ae8a3c-9e18-5eda-bac2-d793049b8600');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', 'f9ae8a3c-9e18-5eda-bac2-d793049b8600', DATE '2026-05-25', DATE '2026-05-05', 13920.35, 13869.27, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', 'f9ae8a3c-9e18-5eda-bac2-d793049b8600', 51.08, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 74 | apLIS lote 5291 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('78b1116d-689c-50b4-b813-b30f4c128253', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5291', DATE '2026-03-25', DATE '2026-03-26', 'Faturado', 3, '341226301451_0', '8294', 8274, DATE '2026-06-05', '5291', 11012.70, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-03-26', DATE '2026-05-25', 11012.70, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 74). Responsável: Renata. Status original na planilha: Vencido. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', '78b1116d-689c-50b4-b813-b30f4c128253');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', '78b1116d-689c-50b4-b813-b30f4c128253', DATE '2026-05-25', DATE '2026-06-02', 11012.70, 10582.03, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', '78b1116d-689c-50b4-b813-b30f4c128253', 430.67, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 75 | apLIS lote 5068 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('990a2fbb-0575-59d2-be58-ef2f9826011b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5068', DATE '2026-02-25', DATE '2026-03-26', 'Faturado', 3, '341226302390_0', '8294', 8274, DATE '2026-06-05', '5068', 13118.95, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-03-26', DATE '2026-05-25', 13118.95, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 75). Responsável: Renata. Status original na planilha: Vencido. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', '990a2fbb-0575-59d2-be58-ef2f9826011b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', '990a2fbb-0575-59d2-be58-ef2f9826011b', DATE '2026-05-25', DATE '2026-06-02', 13118.95, 12283.15, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', '990a2fbb-0575-59d2-be58-ef2f9826011b', 835.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 76 | apLIS lote 5300 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('677bb6ec-a280-5a18-be86-2d9422e5d3ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5300', DATE '2026-03-25', DATE '2026-03-25', 'Recebido', 4, '341226290481_0', '7999', 7979, DATE '2026-05-07', '5300', 1087.56, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f9c360ca-2e4b-5c0e-9a2c-d5740b432617', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '7999', DATE '2026-03-25', DATE '2026-05-24', 1087.56, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 76). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f9c360ca-2e4b-5c0e-9a2c-d5740b432617', '677bb6ec-a280-5a18-be86-2d9422e5d3ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f9c360ca-2e4b-5c0e-9a2c-d5740b432617', '677bb6ec-a280-5a18-be86-2d9422e5d3ed', DATE '2026-05-24', DATE '2026-05-05', 1087.56, 1087.56, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 77 | apLIS lote 5299 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cf158c54-cd76-5913-b087-922d81002202', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5299', DATE '2026-03-25', DATE '2026-03-25', 'Recebido', 4, '341226290112_0', '7999', 7979, DATE '2026-05-07', '5299', 682.43, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea8b3cdc-1af5-5c9b-81a0-0aaa6f2ce407', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '7999', DATE '2026-03-25', DATE '2026-05-24', 682.43, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 77). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea8b3cdc-1af5-5c9b-81a0-0aaa6f2ce407', 'cf158c54-cd76-5913-b087-922d81002202');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ea8b3cdc-1af5-5c9b-81a0-0aaa6f2ce407', 'cf158c54-cd76-5913-b087-922d81002202', DATE '2026-05-24', DATE '2026-05-05', 682.43, 682.43, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 78 | apLIS lote 5302 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('929753f2-91e6-57d2-bb42-d3e4c601e48b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5302', DATE '2026-03-25', DATE '2026-03-25', 'Recebido', 4, 'PEG341226292263_0', '8294', 8274, DATE '2026-06-05', '5302', 11812.92, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('029e924c-56fc-5a35-81bb-94a0370752bb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-03-25', DATE '2026-05-24', 11812.92, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 78). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('029e924c-56fc-5a35-81bb-94a0370752bb', '929753f2-91e6-57d2-bb42-d3e4c601e48b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('029e924c-56fc-5a35-81bb-94a0370752bb', '929753f2-91e6-57d2-bb42-d3e4c601e48b', DATE '2026-05-24', DATE '2026-06-02', 11812.92, 11812.92, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 79 | apLIS lote 5297 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('26d4fb90-a8f4-5525-a148-f1f0553d4c69', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5297', DATE '2026-03-25', DATE '2026-03-25', 'Recebido', 4, '341226289675_0', '7999', 7979, DATE '2026-05-07', '5297', 635.12, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e1dc03a2-0bda-5bd5-b15b-86a33af18fa0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '7999', DATE '2026-03-25', DATE '2026-05-24', 635.12, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 79). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e1dc03a2-0bda-5bd5-b15b-86a33af18fa0', '26d4fb90-a8f4-5525-a148-f1f0553d4c69');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e1dc03a2-0bda-5bd5-b15b-86a33af18fa0', '26d4fb90-a8f4-5525-a148-f1f0553d4c69', DATE '2026-05-24', DATE '2026-05-05', 635.12, 635.12, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 80 | apLIS lote 5290 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('035bc94f-b9af-544a-8df9-9c684c07c6f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5290', DATE '2026-03-25', DATE '2026-03-26', 'Recebido', 4, '340226316633', '8000', 7980, DATE '2026-05-07', '5290', 11224.76, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ca77567-32fc-5d30-903f-4477debb0504', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8000', DATE '2026-03-26', DATE '2026-05-25', 11224.76, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 80). Responsável: Maria Eduarda. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ca77567-32fc-5d30-903f-4477debb0504', '035bc94f-b9af-544a-8df9-9c684c07c6f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6ca77567-32fc-5d30-903f-4477debb0504', '035bc94f-b9af-544a-8df9-9c684c07c6f8', DATE '2026-05-25', DATE '2026-05-05', 11224.76, 11224.76, 'recebido', 'Maria Eduarda', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 81 | apLIS lote 5293 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('50c6a6d9-8ce9-5428-a159-17f15a78f04d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5293', DATE '2026-03-25', DATE '2026-03-26', 'Recebido', 4, '340226308882', '8029', 8009, DATE '2026-05-15', '5293', 26279.11, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b1fcd843-589c-5a42-9207-e87340b62edc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-03-26', DATE '2026-05-25', 26279.11, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 81). Responsável: Maria Eduarda. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b1fcd843-589c-5a42-9207-e87340b62edc', '50c6a6d9-8ce9-5428-a159-17f15a78f04d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b1fcd843-589c-5a42-9207-e87340b62edc', '50c6a6d9-8ce9-5428-a159-17f15a78f04d', DATE '2026-05-25', DATE '2026-05-12', 26279.11, 26279.11, 'recebido', 'Maria Eduarda', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 82 | apLIS lote 5289 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fe1ca174-9769-510c-90f9-63fa9366c4ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5289', DATE '2026-03-25', DATE '2026-03-26', 'Recebido - parcial', 7, '340226318041_0', '8278', 8258, DATE '2026-06-01', '5289', 18489.74, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8278', DATE '2026-03-26', DATE '2026-05-25', 18489.74, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 82). Responsável: Ana Lucia. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', 'fe1ca174-9769-510c-90f9-63fa9366c4ab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', 'fe1ca174-9769-510c-90f9-63fa9366c4ab', DATE '2026-05-25', DATE '2026-05-27', 18489.74, 18059.07, 'parcial', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', 'fe1ca174-9769-510c-90f9-63fa9366c4ab', 430.67, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana Lucia');

-- MARÇO linha 83 | apLIS lote 5294 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0bf72482-2b66-5cb8-90f4-37c6c41eb615', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5294', DATE '2026-03-25', DATE '2026-03-26', 'Recebido', 4, '340226319172_0', '8000', 7980, DATE '2026-05-07', '5294', 18655.08, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85e35a2e-c860-54fb-8da7-d040464f1206', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8000', DATE '2026-03-26', DATE '2026-05-25', 18655.08, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 83). Responsável: Ana Lucia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85e35a2e-c860-54fb-8da7-d040464f1206', '0bf72482-2b66-5cb8-90f4-37c6c41eb615');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85e35a2e-c860-54fb-8da7-d040464f1206', '0bf72482-2b66-5cb8-90f4-37c6c41eb615', DATE '2026-05-25', DATE '2026-05-05', 18655.08, 18655.08, 'recebido', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 84 | apLIS lote 5295 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0bb66ac3-305a-58a9-82ac-c4e60a603cce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5295', DATE '2026-03-25', DATE '2026-03-26', 'Recebido', 4, '340226319533_0', '8029', 8009, DATE '2026-05-15', '5295', 10145.86, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('14831c98-ee2c-55ee-8de2-d02dbf338c98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-03-26', DATE '2026-05-25', 10145.86, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 84). Responsável: Ana Lucia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('14831c98-ee2c-55ee-8de2-d02dbf338c98', '0bb66ac3-305a-58a9-82ac-c4e60a603cce');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('14831c98-ee2c-55ee-8de2-d02dbf338c98', '0bb66ac3-305a-58a9-82ac-c4e60a603cce', DATE '2026-05-25', DATE '2026-05-05', 10145.86, 10145.86, 'recebido', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 85 | apLIS lote 5301 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53a1165d-0267-5454-a3cd-5280a2a460e5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5301', DATE '2026-03-25', DATE '2026-03-26', 'Recebido - parcial', 7, '340226320630_0', '8195', 8175, DATE '2026-05-27', '5301', 13111.24, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33c269ab-71bf-503a-b567-552c27934405', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-03-26', DATE '2026-05-25', 13111.24, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 85). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33c269ab-71bf-503a-b567-552c27934405', '53a1165d-0267-5454-a3cd-5280a2a460e5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('33c269ab-71bf-503a-b567-552c27934405', '53a1165d-0267-5454-a3cd-5280a2a460e5', DATE '2026-05-25', DATE '2026-05-18', 13111.24, 12638.69, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('33c269ab-71bf-503a-b567-552c27934405', '53a1165d-0267-5454-a3cd-5280a2a460e5', 472.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 86 | apLIS lote 5303 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5303', DATE '2026-03-25', DATE '2026-03-26', 'Recebido - parcial', 7, '340226321640_0', '8195', 8175, DATE '2026-05-27', '5303', 17736.09, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-03-26', DATE '2026-05-25', 17736.09, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 86). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', '18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', '18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1', DATE '2026-05-25', DATE '2026-06-30', 17736.09, 15980.36, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', '18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1', 1755.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 87 | apLIS lote 5298 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1828b68-fa78-513e-b3c8-ca0ddb056f15', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5298', DATE '2026-03-25', DATE '2026-03-27', 'Faturado', 3, '340226328753_0', '8000', 7980, DATE '2026-05-07', '5298', 13913.65, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8000', DATE '2026-03-27', DATE '2026-05-26', 13913.65, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 87). Responsável: Ana Lucia. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', 'b1828b68-fa78-513e-b3c8-ca0ddb056f15');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', 'b1828b68-fa78-513e-b3c8-ca0ddb056f15', DATE '2026-05-26', DATE '2026-05-05', 13913.65, 12643.41, 'parcial', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', 'b1828b68-fa78-513e-b3c8-ca0ddb056f15', 1270.24, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana Lucia');

-- MARÇO linha 88 | apLIS lote 5076 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bfd18f1b-7b8f-58cf-9f8c-8a1e0fc30454', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5076', DATE '2026-02-25', DATE '2026-03-27', 'Recebido', 4, '340226331146_0', '8195', 8175, DATE '2026-05-27', '5076', 8304.79, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ace32104-b1d9-52eb-a52b-d10ced2fffc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-03-27', DATE '2026-05-26', 8304.79, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 88). Responsável: Ana Lucia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ace32104-b1d9-52eb-a52b-d10ced2fffc5', 'bfd18f1b-7b8f-58cf-9f8c-8a1e0fc30454');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ace32104-b1d9-52eb-a52b-d10ced2fffc5', 'bfd18f1b-7b8f-58cf-9f8c-8a1e0fc30454', DATE '2026-05-26', DATE '2026-05-05', 8304.79, 8304.79, 'recebido', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 89 | apLIS lote 4730 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13975882-8ffa-59fd-9f8a-ee67185d55f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4730', DATE '2025-12-12', DATE '2026-03-31', 'Recebido', 4, '340226438849_0', '8029', 8009, DATE '2026-05-15', '4730', 9574.76, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('41b70864-5645-5925-a72e-543b198a39b5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-03-31', DATE '2026-03-31', 9574.76, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 89). Responsável: Ana Lucia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('41b70864-5645-5925-a72e-543b198a39b5', '13975882-8ffa-59fd-9f8a-ee67185d55f5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('41b70864-5645-5925-a72e-543b198a39b5', '13975882-8ffa-59fd-9f8a-ee67185d55f5', DATE '2026-03-31', DATE '2026-05-05', 9574.76, 8283.72, 'parcial', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 90 | apLIS lote 5126 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7a649098-8319-5100-a692-141d7c3456b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5126', DATE '2026-03-02', DATE '2026-03-02', 'Recebido', 4, 'PEG273757', NULL, NULL, NULL, '5126', 9512.98, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4f2de34c-ab6a-5743-b7d3-3bd9ffabe782', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-03-02', DATE '2026-05-01', 9512.98, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 90). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4f2de34c-ab6a-5743-b7d3-3bd9ffabe782', '7a649098-8319-5100-a692-141d7c3456b7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4f2de34c-ab6a-5743-b7d3-3bd9ffabe782', '7a649098-8319-5100-a692-141d7c3456b7', DATE '2026-05-01', DATE '2026-04-08', 9512.98, 9512.98, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 91 | apLIS lote 5125 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fb33ae95-aa3b-5c24-89a4-dfa0c807b43e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5125', DATE '2026-03-02', DATE '2026-03-02', 'Recebido', 4, 'PEG273876', NULL, NULL, NULL, '5125', 29.75, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b7f9778a-c87e-5a9e-a6aa-64ed24bee3a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-03-02', DATE '2026-05-01', 29.75, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 91). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b7f9778a-c87e-5a9e-a6aa-64ed24bee3a7', 'fb33ae95-aa3b-5c24-89a4-dfa0c807b43e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b7f9778a-c87e-5a9e-a6aa-64ed24bee3a7', 'fb33ae95-aa3b-5c24-89a4-dfa0c807b43e', DATE '2026-05-01', DATE '2026-04-08', 29.75, 29.75, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 92 | apLIS lote 5141 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d384127-e0f7-5d0f-9314-58e74dcf4459', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5141', DATE '2026-03-03', DATE '2026-03-03', 'Recebido', 4, 'PEG274372', NULL, NULL, NULL, '5141', 1041.46, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('635cfd8f-e8a3-5427-9e1b-8c365886d677', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-03-02', DATE '2026-05-01', 1041.46, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 92). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('635cfd8f-e8a3-5427-9e1b-8c365886d677', '0d384127-e0f7-5d0f-9314-58e74dcf4459');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('635cfd8f-e8a3-5427-9e1b-8c365886d677', '0d384127-e0f7-5d0f-9314-58e74dcf4459', DATE '2026-05-01', DATE '2026-04-08', 1041.46, 1041.46, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 93 | apLIS lote 5356 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8eec7b8e-2cde-57d5-82b0-26d80fdff7be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5356', DATE '2026-03-31', DATE '2026-03-31', 'Recebido - parcial', 7, '2603311823468022918', NULL, NULL, NULL, '5356', 2184.86, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), NULL, DATE '2026-03-31', DATE '2026-04-30', 2184.86, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 93). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', '8eec7b8e-2cde-57d5-82b0-26d80fdff7be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', '8eec7b8e-2cde-57d5-82b0-26d80fdff7be', DATE '2026-04-30', DATE '2026-04-08', 2184.86, 1834.82, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', '8eec7b8e-2cde-57d5-82b0-26d80fdff7be', 350.04, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 94 | apLIS lote 5189 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a106e79-b44b-5b17-8c8c-f2bd18681563', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5189', DATE '2026-03-11', DATE '2026-03-12', 'Recebido - parcial', 7, 'PEG225933478', NULL, NULL, NULL, '5189', 22460.83, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-03-12', DATE '2026-04-11', 22460.83, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 94). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', '0a106e79-b44b-5b17-8c8c-f2bd18681563');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', '0a106e79-b44b-5b17-8c8c-f2bd18681563', DATE '2026-04-11', DATE '2026-04-15', 22460.83, 21777.22, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', '0a106e79-b44b-5b17-8c8c-f2bd18681563', 683.61, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- MARÇO linha 95 | apLIS lote 5191 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('862a4d85-d973-5d9d-9ad2-c7538a7e35f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5191', DATE '2026-03-12', DATE '2026-03-12', 'Recebido - parcial', 7, 'PEG225938997', NULL, NULL, NULL, '5191', 17111.86, 64);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-03-12', DATE '2026-04-11', 17111.86, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 95). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', '862a4d85-d973-5d9d-9ad2-c7538a7e35f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', '862a4d85-d973-5d9d-9ad2-c7538a7e35f8', DATE '2026-04-11', DATE '2026-04-15', 17111.86, 16883.99, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', '862a4d85-d973-5d9d-9ad2-c7538a7e35f8', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- MARÇO linha 96 | apLIS lote 5194 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5fac1e5a-53bb-5cba-b26b-1c64dabbf51e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5194', DATE '2026-03-12', DATE '2026-03-12', 'Recebido', 4, 'PEG225950840', NULL, NULL, NULL, '5194', 15050.90, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b33fbb8-7321-5756-b035-3bc46315deb9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-03-12', DATE '2026-04-11', 15050.90, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 96). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b33fbb8-7321-5756-b035-3bc46315deb9', '5fac1e5a-53bb-5cba-b26b-1c64dabbf51e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b33fbb8-7321-5756-b035-3bc46315deb9', '5fac1e5a-53bb-5cba-b26b-1c64dabbf51e', DATE '2026-04-11', DATE '2026-04-15', 15050.90, 15050.90, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 97 | apLIS lote 5197 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('423f2427-73ec-52ba-9610-76b4d7f83cbc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5197', DATE '2026-03-12', DATE '2026-03-13', 'Recebido', 4, 'PEG225974191', NULL, NULL, NULL, '5197', 11232.77, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('778abdbe-a9ae-593d-96f5-3c14961854ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-03-13', DATE '2026-04-12', 11232.77, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 97). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('778abdbe-a9ae-593d-96f5-3c14961854ba', '423f2427-73ec-52ba-9610-76b4d7f83cbc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('778abdbe-a9ae-593d-96f5-3c14961854ba', '423f2427-73ec-52ba-9610-76b4d7f83cbc', DATE '2026-04-12', DATE '2026-04-15', 11232.77, 11232.77, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 98 | apLIS lote 5312 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96522c68-c75e-57c7-840c-551dfe5e98f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5312', DATE '2026-03-26', DATE '2026-03-27', 'Recebido', 4, '802250', '8579', 8559, DATE '2026-09-30', '5312', 16023.09, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8579', DATE '2026-03-27', DATE '2026-05-26', 16023.09, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 98). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', '96522c68-c75e-57c7-840c-551dfe5e98f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', '96522c68-c75e-57c7-840c-551dfe5e98f0', DATE '2026-05-26', DATE '2026-05-19', 16023.09, 15949.43, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', '96522c68-c75e-57c7-840c-551dfe5e98f0', 73.66, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', '96522c68-c75e-57c7-840c-551dfe5e98f0', 1173.86, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- MARÇO linha 99 | apLIS lote 5311 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c8d5552a-a5e9-5add-9a10-8acc5bc70fe4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5311', DATE '2026-03-26', DATE '2026-03-31', 'Recebido', 4, '802547', '7980', 7960, DATE '2026-05-05', '5311', 24891.43, 69);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('01b076c7-f3b6-5c54-b8b7-50c17bf83c1f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '7980', DATE '2026-03-31', DATE '2026-05-30', 24891.43, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 99). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('01b076c7-f3b6-5c54-b8b7-50c17bf83c1f', 'c8d5552a-a5e9-5add-9a10-8acc5bc70fe4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('01b076c7-f3b6-5c54-b8b7-50c17bf83c1f', 'c8d5552a-a5e9-5add-9a10-8acc5bc70fe4', DATE '2026-05-30', DATE '2026-05-19', 24891.43, 24891.43, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 100 | apLIS lote 5148 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33877b10-b121-57f2-a5d9-84c672b4b0f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5148', DATE '2026-03-04', DATE '2026-03-04', 'Recebido', 4, 'PEG655407', NULL, NULL, NULL, '5148', 2406.76, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('922fff41-df38-56a3-9391-f468486ac09b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), NULL, DATE '2026-03-04', DATE '2026-04-08', 2406.76, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 100). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('922fff41-df38-56a3-9391-f468486ac09b', '33877b10-b121-57f2-a5d9-84c672b4b0f4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('922fff41-df38-56a3-9391-f468486ac09b', '33877b10-b121-57f2-a5d9-84c672b4b0f4', DATE '2026-04-08', DATE '2026-04-10', 2406.76, 2406.76, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 101 | apLIS lote 5124 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5124', DATE '2026-03-02', DATE '2026-03-02', 'Faturado', 3, '184333', NULL, NULL, NULL, '5124', 6941.85, 31);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-03-02', DATE '2026-03-30', 6941.85, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 101). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', '50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', '50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5', DATE '2026-03-30', DATE '2026-05-05', 6941.85, 3249.96, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', '50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5', 3469.75, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 102 | apLIS lote 5142 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('76e1cdf7-3c5e-5f93-90ef-306f41e616ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5142', DATE '2026-03-03', DATE '2026-03-03', 'Recebido', 4, 'PEG20260303145818', NULL, 8016, DATE '2026-07-31', '5142', 279.06, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1ee81b23-9674-5f18-ae08-64651454b832', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-03-03', DATE '2026-05-02', 279.06, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 102). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1ee81b23-9674-5f18-ae08-64651454b832', '76e1cdf7-3c5e-5f93-90ef-306f41e616ee');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1ee81b23-9674-5f18-ae08-64651454b832', '76e1cdf7-3c5e-5f93-90ef-306f41e616ee', DATE '2026-05-02', DATE '2026-06-17', 279.06, 279.06, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 103 | apLIS lote 5147 | GAMA SAÚDE ("GAMA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67cec91a-f648-5e89-9499-ce9564fadcfe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), '5147', DATE '2026-03-04', DATE '2026-03-04', 'Faturado', 3, 'PEG14913353', NULL, NULL, NULL, '5147', 965.18, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('442f18d0-fb21-5845-b08c-12ca06ff9ad5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), NULL, DATE '2026-03-04', DATE '2026-05-03', 965.18, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 103). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('442f18d0-fb21-5845-b08c-12ca06ff9ad5', '67cec91a-f648-5e89-9499-ce9564fadcfe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('442f18d0-fb21-5845-b08c-12ca06ff9ad5', '67cec91a-f648-5e89-9499-ce9564fadcfe', DATE '2026-05-03', 965.18, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 104 | apLIS lote 5156 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d00f07bb-0b95-5b66-9ce3-caa19ebe3cff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5156', DATE '2026-03-05', DATE '2026-03-06', 'Recebido', 4, '135095602', '8639', 8619, DATE '2026-07-07', '5156', 12413.80, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8639', DATE '2026-03-06', DATE '2026-06-04', 12413.80, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 104). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', 'd00f07bb-0b95-5b66-9ce3-caa19ebe3cff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', 'd00f07bb-0b95-5b66-9ce3-caa19ebe3cff', DATE '2026-06-04', DATE '2026-08-20', 12413.80, 11884.60, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', 'd00f07bb-0b95-5b66-9ce3-caa19ebe3cff', 529.20, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 105 | apLIS lote 5098 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b5f7c953-4af8-53f5-96a1-03484fe6cc1a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5098', DATE '2026-02-26', DATE '2026-03-05', 'Faturado', 3, 'PEG155870', '8035', 8015, DATE '2026-07-31', '5098', 3570.51, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('831880ec-48e0-5f64-a38b-3ed46c979eea', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-05', DATE '2026-04-04', 3570.51, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 105). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('831880ec-48e0-5f64-a38b-3ed46c979eea', 'b5f7c953-4af8-53f5-96a1-03484fe6cc1a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('831880ec-48e0-5f64-a38b-3ed46c979eea', 'b5f7c953-4af8-53f5-96a1-03484fe6cc1a', DATE '2026-04-04', 3570.51, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 106 | apLIS lote 5155 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('43ae7adf-1cc0-592a-92d8-50fec5db7128', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5155', DATE '2026-03-05', DATE '2026-03-05', 'Faturado', 3, 'PEG155889', '8035', 8015, DATE '2026-07-31', '5155', 517.90, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('04102a2e-71b2-5459-b71c-bb4a83e7f825', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-05', DATE '2026-04-04', 517.90, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 106). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('04102a2e-71b2-5459-b71c-bb4a83e7f825', '43ae7adf-1cc0-592a-92d8-50fec5db7128');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('04102a2e-71b2-5459-b71c-bb4a83e7f825', '43ae7adf-1cc0-592a-92d8-50fec5db7128', DATE '2026-04-04', 517.90, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 107 | apLIS lote 5099 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0db1d2b3-cf4b-5069-a8ce-6d8f80a104d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5099', DATE '2026-02-26', DATE '2026-03-05', 'Faturado', 3, 'PEG155943', '8035', 8015, DATE '2026-07-31', '5099', 14589.20, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5f94cbf-3f18-5563-818b-81ef2b25290b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-05', DATE '2026-04-04', 14589.20, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 107). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5f94cbf-3f18-5563-818b-81ef2b25290b', '0db1d2b3-cf4b-5069-a8ce-6d8f80a104d7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b5f94cbf-3f18-5563-818b-81ef2b25290b', '0db1d2b3-cf4b-5069-a8ce-6d8f80a104d7', DATE '2026-04-04', 14589.20, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 108 | apLIS lote 5216 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('38fa840c-0abf-5059-9929-924a2811ad80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5216', DATE '2026-03-16', DATE '2026-03-17', 'Faturado', 3, '159012', '8035', 8015, DATE '2026-07-31', '5216', 9247.65, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c7a2a3b8-7097-58bd-96f4-a4ca5403b051', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-17', DATE '2026-04-16', 9247.65, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 108). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c7a2a3b8-7097-58bd-96f4-a4ca5403b051', '38fa840c-0abf-5059-9929-924a2811ad80');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c7a2a3b8-7097-58bd-96f4-a4ca5403b051', '38fa840c-0abf-5059-9929-924a2811ad80', DATE '2026-04-16', 9247.65, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 109 | apLIS lote 5215 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3ce5ee12-3602-5c01-8825-419272614b98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5215', DATE '2026-03-16', DATE '2026-03-17', 'Faturado', 3, '159021', '8035', 8015, DATE '2026-07-31', '5215', 10845.91, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4c886f92-9cb4-56cf-b6b0-28abf768bbd0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-17', DATE '2026-04-16', 10845.91, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 109). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4c886f92-9cb4-56cf-b6b0-28abf768bbd0', '3ce5ee12-3602-5c01-8825-419272614b98');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4c886f92-9cb4-56cf-b6b0-28abf768bbd0', '3ce5ee12-3602-5c01-8825-419272614b98', DATE '2026-04-16', 10845.91, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 110 | apLIS lote 5214 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3a830682-7ac8-53ca-b722-f8ed69c88531', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5214', DATE '2026-03-16', DATE '2026-03-17', 'Faturado', 3, '159026', '8035', 8015, DATE '2026-07-31', '5214', 10466.62, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('56f677a7-f7b7-5efe-8987-bc20a3d42c50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-17', DATE '2026-04-16', 10466.62, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 110). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('56f677a7-f7b7-5efe-8987-bc20a3d42c50', '3a830682-7ac8-53ca-b722-f8ed69c88531');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('56f677a7-f7b7-5efe-8987-bc20a3d42c50', '3a830682-7ac8-53ca-b722-f8ed69c88531', DATE '2026-04-16', 10466.62, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 111 | apLIS lote 5217 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0124bc27-d6fe-570f-b7a0-bdffa58a4788', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5217', DATE '2026-03-16', DATE '2026-03-17', 'Faturado', 3, '159029', '8035', 8015, DATE '2026-07-31', '5217', 7647.77, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c79b34ef-ded8-5907-bd1a-ee2163146e4e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-17', DATE '2026-04-16', 7647.77, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 111). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c79b34ef-ded8-5907-bd1a-ee2163146e4e', '0124bc27-d6fe-570f-b7a0-bdffa58a4788');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c79b34ef-ded8-5907-bd1a-ee2163146e4e', '0124bc27-d6fe-570f-b7a0-bdffa58a4788', DATE '2026-04-16', 7647.77, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 112 | apLIS lote 4925 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('256d9b1e-7ee8-5c15-9131-d0960063a94d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4925', DATE '2026-01-30', DATE '2026-03-18', 'Faturado', 3, '159335', '8035', 8015, DATE '2026-07-31', '4925', 5800.17, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('07773504-e8db-50f9-8659-2f514dff4231', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-18', DATE '2026-04-17', 5800.17, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 112). Responsável: Renata, Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('07773504-e8db-50f9-8659-2f514dff4231', '256d9b1e-7ee8-5c15-9131-d0960063a94d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('07773504-e8db-50f9-8659-2f514dff4231', '256d9b1e-7ee8-5c15-9131-d0960063a94d', DATE '2026-04-17', 5800.17, 'previsto', 'Renata, Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 113 | apLIS lote 5225 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ef1f8aec-b867-5366-86b6-d6a135cb99e5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5225', DATE '2026-03-18', DATE '2026-03-18', 'Faturado', 3, '159362', '8035', 8015, DATE '2026-07-31', '5225', 1606.40, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6b2a6341-4ac2-5bfe-95a4-cfaaaad83eb9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-18', DATE '2026-04-17', 1606.40, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 113). Responsável: Renata, Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6b2a6341-4ac2-5bfe-95a4-cfaaaad83eb9', 'ef1f8aec-b867-5366-86b6-d6a135cb99e5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6b2a6341-4ac2-5bfe-95a4-cfaaaad83eb9', 'ef1f8aec-b867-5366-86b6-d6a135cb99e5', DATE '2026-04-17', 1606.40, 'previsto', 'Renata, Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 114 | apLIS lote 5224 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('35553c3b-49aa-51ae-98de-6411053ea042', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5224', DATE '2026-03-18', DATE '2026-03-19', 'Faturado', 3, '159259', '8035', 8015, DATE '2026-07-31', '5224', 5490.34, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('89b31206-e2ee-53a0-a7dc-7ad4b2db14b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-18', DATE '2026-04-17', 5490.34, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 114). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('89b31206-e2ee-53a0-a7dc-7ad4b2db14b7', '35553c3b-49aa-51ae-98de-6411053ea042');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('89b31206-e2ee-53a0-a7dc-7ad4b2db14b7', '35553c3b-49aa-51ae-98de-6411053ea042', DATE '2026-04-17', 5490.34, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 115 | apLIS lote 5095 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3ea793f-13bc-5a0a-91da-08035c188520', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5095', DATE '2026-02-26', DATE '2026-03-18', 'Faturado', 3, '159417', '8035', 8015, DATE '2026-07-31', '5095', 3582.86, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('853133ba-a721-5f94-ac03-4d0af4499f86', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-18', DATE '2026-04-17', 3582.86, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 115). Responsável: Renata, Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('853133ba-a721-5f94-ac03-4d0af4499f86', 'c3ea793f-13bc-5a0a-91da-08035c188520');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('853133ba-a721-5f94-ac03-4d0af4499f86', 'c3ea793f-13bc-5a0a-91da-08035c188520', DATE '2026-04-17', 3582.86, 'previsto', 'Renata, Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 116 | apLIS lote 5322 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('967fdc56-e905-54b0-98f4-e2f3a4fc7755', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5322', DATE '2026-03-27', DATE '2026-03-27', 'Faturado', 3, '162993', '8035', 8015, DATE '2026-07-31', '5322', 12861.20, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('deb303d2-8e9c-5346-a68b-e2391682687e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-27', DATE '2026-04-27', 12861.20, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 116). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('deb303d2-8e9c-5346-a68b-e2391682687e', '967fdc56-e905-54b0-98f4-e2f3a4fc7755');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('deb303d2-8e9c-5346-a68b-e2391682687e', '967fdc56-e905-54b0-98f4-e2f3a4fc7755', DATE '2026-04-27', 12861.20, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 117 | apLIS lote 5226 | INAS GDF ("INAS-GDF" na planilha)
-- Data Faturamento '27/03/0226' → ano 2026
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0423c3cc-e839-58fa-9c4b-7a760e7e03a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5226', DATE '2026-03-18', DATE '2026-03-27', 'Faturado', 3, '162995', '8035', 8015, DATE '2026-07-31', '5226', 7567.54, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('194ff507-c7fd-517c-963d-7ed7cbe45159', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-27', DATE '2026-04-27', 7567.54, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 117). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('194ff507-c7fd-517c-963d-7ed7cbe45159', '0423c3cc-e839-58fa-9c4b-7a760e7e03a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('194ff507-c7fd-517c-963d-7ed7cbe45159', '0423c3cc-e839-58fa-9c4b-7a760e7e03a0', DATE '2026-04-27', 7567.54, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 118 | apLIS lote 5321 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4dd913ee-2891-55d6-9768-5c306d788856', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5321', DATE '2026-03-27', DATE '2026-03-27', 'Faturado', 3, '163023', '8035', 8015, DATE '2026-07-31', '5321', 11441.91, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3a96c4fa-e087-518e-8a5c-d1d20a26792e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-27', DATE '2026-04-27', 11441.91, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 118). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3a96c4fa-e087-518e-8a5c-d1d20a26792e', '4dd913ee-2891-55d6-9768-5c306d788856');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3a96c4fa-e087-518e-8a5c-d1d20a26792e', '4dd913ee-2891-55d6-9768-5c306d788856', DATE '2026-04-27', 11441.91, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 119 | apLIS lote 5325 | INAS GDF ("INAS-GDF" na planilha)
-- Data Provável Pagamento 2025-04-27 → 2026-04-27
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('877266b4-a149-5557-a1ba-70dd6e2e3fa0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5325', DATE '2026-03-27', DATE '2026-03-27', 'Faturado', 3, '163054', '8035', 8015, DATE '2026-07-31', '5325', 1258.72, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87502eb3-9611-55ab-b4f9-c84cb382e89c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8035', DATE '2026-03-27', DATE '2026-04-27', 1258.72, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 119). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87502eb3-9611-55ab-b4f9-c84cb382e89c', '877266b4-a149-5557-a1ba-70dd6e2e3fa0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('87502eb3-9611-55ab-b4f9-c84cb382e89c', '877266b4-a149-5557-a1ba-70dd6e2e3fa0', DATE '2026-04-27', 1258.72, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 120 | apLIS lote 5118 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0c4b7246-8b01-5442-a819-2f17b180490e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5118', DATE '2026-03-02', DATE '2026-03-03', 'Faturado', 3, '34832', NULL, NULL, NULL, '5118', 2561.89, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d6ba3cfb-3f8d-5370-bbc2-ed76a793907f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), NULL, DATE '2026-03-03', DATE '2026-04-30', 2561.89, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 120). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d6ba3cfb-3f8d-5370-bbc2-ed76a793907f', '0c4b7246-8b01-5442-a819-2f17b180490e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d6ba3cfb-3f8d-5370-bbc2-ed76a793907f', '0c4b7246-8b01-5442-a819-2f17b180490e', DATE '2026-04-30', 2561.89, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 121 | apLIS lote 5052 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4cf3bd3e-94c2-54ec-b4c7-be3da662897c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5052', DATE '2026-02-23', DATE '2026-03-10', 'Recebido', 4, 'PEG438129', NULL, NULL, NULL, '5052', 1972.66, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1831e8af-60a6-5198-b930-e34f4fdf2c63', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-10', DATE '2026-04-09', 1972.66, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 121). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1831e8af-60a6-5198-b930-e34f4fdf2c63', '4cf3bd3e-94c2-54ec-b4c7-be3da662897c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1831e8af-60a6-5198-b930-e34f4fdf2c63', '4cf3bd3e-94c2-54ec-b4c7-be3da662897c', DATE '2026-04-09', DATE '2026-07-03', 1972.66, 1972.66, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 122 | apLIS lote 5181 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('822a3d15-3b90-5a0a-b5a1-c564d8fc5a51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5181', DATE '2026-03-10', DATE '2026-03-11', 'Recebido - parcial', 7, 'PEG438366', NULL, NULL, NULL, '5181', 13220.47, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-11', DATE '2026-04-10', 13220.47, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 122). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', '822a3d15-3b90-5a0a-b5a1-c564d8fc5a51');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', '822a3d15-3b90-5a0a-b5a1-c564d8fc5a51', DATE '2026-04-10', DATE '2026-07-03', 13220.47, 12880.21, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', '822a3d15-3b90-5a0a-b5a1-c564d8fc5a51', 340.26, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 123 | apLIS lote 5177 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6007d3ef-122f-5c64-8d50-a2c51f5585ce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5177', DATE '2026-03-09', DATE '2026-03-11', 'Recebido', 4, 'PEG438372', NULL, NULL, NULL, '5177', 27624.83, 84);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7ca1439b-79e1-5882-a31d-ce871a65e603', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-11', DATE '2026-04-10', 27624.83, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 123). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7ca1439b-79e1-5882-a31d-ce871a65e603', '6007d3ef-122f-5c64-8d50-a2c51f5585ce');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7ca1439b-79e1-5882-a31d-ce871a65e603', '6007d3ef-122f-5c64-8d50-a2c51f5585ce', DATE '2026-04-10', DATE '2026-07-03', 27624.83, 27624.83, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 124 | apLIS lote 5176 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6f7812a4-cfa2-502b-a89e-bde3fa0e9d56', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5176', DATE '2026-03-09', DATE '2026-03-11', 'Recebido - parcial', 7, 'PEG438376', NULL, NULL, NULL, '5176', 28744.22, 91);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-11', DATE '2026-04-10', 28744.22, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 124). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', '6f7812a4-cfa2-502b-a89e-bde3fa0e9d56');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', '6f7812a4-cfa2-502b-a89e-bde3fa0e9d56', DATE '2026-04-10', DATE '2026-07-03', 28744.22, 28735.24, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', '6f7812a4-cfa2-502b-a89e-bde3fa0e9d56', 8.88, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 125 | apLIS lote 5186 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ab78c598-617f-5e64-8770-b9163a72bc3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5186', DATE '2026-03-11', DATE '2026-03-11', 'Recebido - parcial', 7, 'PEG438395', NULL, NULL, NULL, '5186', 8503.57, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-11', DATE '2026-04-10', 8503.57, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 125). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', 'ab78c598-617f-5e64-8770-b9163a72bc3c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', 'ab78c598-617f-5e64-8770-b9163a72bc3c', DATE '2026-04-10', DATE '2026-07-03', 8503.57, 8095.55, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', 'ab78c598-617f-5e64-8770-b9163a72bc3c', 408.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 126 | apLIS lote 5178 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e9c986c7-cfce-5cba-b3a8-28cb803eb5be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5178', DATE '2026-03-09', DATE '2026-03-11', 'Recebido - parcial', 7, '438447', NULL, NULL, NULL, '5178', 53841.13, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-11', DATE '2026-04-10', 53841.13, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 126). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', 'e9c986c7-cfce-5cba-b3a8-28cb803eb5be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', 'e9c986c7-cfce-5cba-b3a8-28cb803eb5be', DATE '2026-04-10', DATE '2026-07-03', 53841.13, 51167.53, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', 'e9c986c7-cfce-5cba-b3a8-28cb803eb5be', 2673.60, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 127 | apLIS lote 5264 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('23456e83-6bbe-5b5a-b92a-a2d3cb6cd148', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5264', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, 'PEG441407', NULL, NULL, NULL, '5264', 6282.66, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('40d39555-3537-5748-96cc-115623fbc46f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 6282.66, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 127). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('40d39555-3537-5748-96cc-115623fbc46f', '23456e83-6bbe-5b5a-b92a-a2d3cb6cd148');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('40d39555-3537-5748-96cc-115623fbc46f', '23456e83-6bbe-5b5a-b92a-a2d3cb6cd148', DATE '2026-04-22', DATE '2026-07-03', 6282.66, 6282.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 128 | apLIS lote 5260 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f6ef524f-725e-5dc2-b562-b0024f7a6147', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5260', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, 'PEG441400', NULL, NULL, NULL, '5260', 14897.46, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0ef8fe9b-c727-55d0-8d9e-def2aa56da60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 14897.46, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 128). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0ef8fe9b-c727-55d0-8d9e-def2aa56da60', 'f6ef524f-725e-5dc2-b562-b0024f7a6147');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0ef8fe9b-c727-55d0-8d9e-def2aa56da60', 'f6ef524f-725e-5dc2-b562-b0024f7a6147', DATE '2026-04-22', DATE '2026-07-03', 14897.46, 14897.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 129 | apLIS lote 5261 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('079172cb-0131-5b50-98e9-6e8afbcc6101', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5261', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, 'PEG441372', NULL, NULL, NULL, '5261', 18079.50, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('574bf5e7-1289-54d2-8188-3319d859cb9f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 18079.50, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 129). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('574bf5e7-1289-54d2-8188-3319d859cb9f', '079172cb-0131-5b50-98e9-6e8afbcc6101');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('574bf5e7-1289-54d2-8188-3319d859cb9f', '079172cb-0131-5b50-98e9-6e8afbcc6101', DATE '2026-04-22', DATE '2026-07-03', 18079.50, 18079.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 130 | apLIS lote 5263 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('313d5921-0a2d-58df-b352-e50d7c4b7408', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5263', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, 'PEG441368', NULL, NULL, NULL, '5263', 14237.75, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8c87d1b1-8e77-5af0-80e8-302ac972fe31', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 14237.75, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 130). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8c87d1b1-8e77-5af0-80e8-302ac972fe31', '313d5921-0a2d-58df-b352-e50d7c4b7408');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8c87d1b1-8e77-5af0-80e8-302ac972fe31', '313d5921-0a2d-58df-b352-e50d7c4b7408', DATE '2026-04-22', DATE '2026-07-03', 14237.75, 14237.75, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 131 | apLIS lote 5271 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd2e53ed-75eb-53db-966d-f7a6295d1c0a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5271', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, 'PEG441427', NULL, NULL, NULL, '5271', 1106.98, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4cee8078-2f18-5eae-b8fd-9751101a4558', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 1106.98, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 131). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4cee8078-2f18-5eae-b8fd-9751101a4558', 'dd2e53ed-75eb-53db-966d-f7a6295d1c0a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4cee8078-2f18-5eae-b8fd-9751101a4558', 'dd2e53ed-75eb-53db-966d-f7a6295d1c0a', DATE '2026-04-22', DATE '2026-07-03', 1106.98, 1106.98, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 132 | apLIS lote 5272 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a593006-c531-5692-90aa-2001dc02fe83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5272', DATE '2026-03-23', DATE '2026-03-23', 'Recebido', 4, '441429', NULL, NULL, NULL, '5272', 496.64, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cf17b93e-4064-5cbe-8f72-8af92533c9b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-23', DATE '2026-04-22', 496.64, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 132). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cf17b93e-4064-5cbe-8f72-8af92533c9b4', '2a593006-c531-5692-90aa-2001dc02fe83');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cf17b93e-4064-5cbe-8f72-8af92533c9b4', '2a593006-c531-5692-90aa-2001dc02fe83', DATE '2026-04-22', DATE '2026-07-03', 496.64, 496.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 133 | apLIS lote 5277 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e748c127-45de-5c48-988b-d81354b16276', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5277', DATE '2026-03-24', DATE '2026-03-24', 'Recebido - parcial', 7, '441807', NULL, NULL, NULL, '5277', 5592.86, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-24', DATE '2026-04-23', 5592.86, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 133). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', 'e748c127-45de-5c48-988b-d81354b16276');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', 'e748c127-45de-5c48-988b-d81354b16276', DATE '2026-04-23', DATE '2026-07-03', 5592.86, 5281.39, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', 'e748c127-45de-5c48-988b-d81354b16276', 311.47, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 134 | apLIS lote 5278 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9eae3e15-c656-508a-87e2-f346a3238df2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5278', DATE '2026-03-24', DATE '2026-03-24', 'Faturado', 3, 'PEG441821', NULL, NULL, NULL, '5278', 9570.16, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-24', DATE '2026-04-23', 9570.16, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 134). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', '9eae3e15-c656-508a-87e2-f346a3238df2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', '9eae3e15-c656-508a-87e2-f346a3238df2', DATE '2026-04-23', DATE '2026-07-03', 9570.16, 9042.36, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', '9eae3e15-c656-508a-87e2-f346a3238df2', 527.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 135 | apLIS lote 5279 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3380126a-ffba-5b8a-9ff7-3ac125a1df6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5279', DATE '2026-03-24', DATE '2026-03-25', 'Recebido - parcial', 7, 'PEG441987', NULL, NULL, NULL, '5279', 10593.44, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-24', DATE '2026-04-24', 10593.44, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 135). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', '3380126a-ffba-5b8a-9ff7-3ac125a1df6b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', '3380126a-ffba-5b8a-9ff7-3ac125a1df6b', DATE '2026-04-24', DATE '2026-07-03', 10593.44, 10224.87, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', '3380126a-ffba-5b8a-9ff7-3ac125a1df6b', 368.57, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 136 | apLIS lote 5274 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('44042b56-6f77-5dd7-b0b7-3e5e548495fa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5274', DATE '2026-03-23', DATE '2026-03-25', 'Faturado', 3, 'PEG442134', NULL, NULL, NULL, '5274', 10178.89, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-25', DATE '2026-04-24', 10178.89, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 136). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', '44042b56-6f77-5dd7-b0b7-3e5e548495fa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', '44042b56-6f77-5dd7-b0b7-3e5e548495fa', DATE '2026-04-24', DATE '2026-07-03', 10178.89, 9644.40, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', '44042b56-6f77-5dd7-b0b7-3e5e548495fa', 534.49, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 137 | apLIS lote 5275 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0b8a1e8e-2d02-5ff2-a46a-052cf918b692', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5275', DATE '2026-03-23', DATE '2026-03-25', 'Faturado', 3, 'PEG442118', NULL, NULL, NULL, '5275', 8341.19, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-25', DATE '2026-04-24', 8341.19, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 137). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', '0b8a1e8e-2d02-5ff2-a46a-052cf918b692');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', '0b8a1e8e-2d02-5ff2-a46a-052cf918b692', DATE '2026-04-24', DATE '2026-07-03', 8341.19, 7965.93, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', '0b8a1e8e-2d02-5ff2-a46a-052cf918b692', 375.26, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 138 | apLIS lote 5273 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('18fa32dc-6956-5a93-8a24-d762b0223df5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5273', DATE '2026-03-23', DATE '2026-03-25', 'Recebido - parcial', 7, 'PEG442161', NULL, NULL, NULL, '5273', 2017.23, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-25', DATE '2026-04-24', 2017.23, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 138). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', '18fa32dc-6956-5a93-8a24-d762b0223df5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', '18fa32dc-6956-5a93-8a24-d762b0223df5', DATE '2026-04-24', DATE '2026-07-03', 2017.23, 1983.81, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', '18fa32dc-6956-5a93-8a24-d762b0223df5', 33.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 139 | apLIS lote 5285 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('63dc3855-1b3a-5e30-b67d-37dddaad9337', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5285', DATE '2026-03-25', DATE '2026-03-25', 'Recebido - parcial', 7, 'PEG442167', NULL, NULL, NULL, '5285', 5924.25, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-25', DATE '2026-04-24', 5924.25, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 139). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', '63dc3855-1b3a-5e30-b67d-37dddaad9337');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', '63dc3855-1b3a-5e30-b67d-37dddaad9337', DATE '2026-04-24', DATE '2026-07-03', 5924.25, 5639.56, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', '63dc3855-1b3a-5e30-b67d-37dddaad9337', 284.69, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 140 | apLIS lote 5286 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2f1924fc-fd2a-5a7e-b599-67e53ee9cb27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5286', DATE '2026-03-25', DATE '2026-03-25', 'Faturado', 3, 'PEG442171', NULL, NULL, NULL, '5286', 3769.68, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-26', DATE '2026-04-24', 3769.68, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 140). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', '2f1924fc-fd2a-5a7e-b599-67e53ee9cb27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', '2f1924fc-fd2a-5a7e-b599-67e53ee9cb27', DATE '2026-04-24', DATE '2026-07-03', 3769.68, 3660.10, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', '2f1924fc-fd2a-5a7e-b599-67e53ee9cb27', 109.58, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 141 | apLIS lote 5307 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2fdca3b2-b699-5094-becd-cd247565ebfe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5307', DATE '2026-03-25', DATE '2026-03-26', 'Recebido', 4, 'PEG442565', NULL, NULL, NULL, '5307', 16845.81, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('abcd6fae-650f-5f46-849b-9cb8b085f13c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-26', DATE '2026-04-24', 16845.81, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 141). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('abcd6fae-650f-5f46-849b-9cb8b085f13c', '2fdca3b2-b699-5094-becd-cd247565ebfe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('abcd6fae-650f-5f46-849b-9cb8b085f13c', '2fdca3b2-b699-5094-becd-cd247565ebfe', DATE '2026-04-24', DATE '2026-07-03', 16845.81, 16845.81, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 142 | apLIS lote 5309 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cb12794e-e79d-5669-a645-4c504f3ad781', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5309', DATE '2026-03-25', DATE '2026-03-26', 'Recebido - parcial', 7, '442599', NULL, NULL, NULL, '5309', 8811.71, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-26', DATE '2026-04-24', 8811.71, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 142). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', 'cb12794e-e79d-5669-a645-4c504f3ad781');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', 'cb12794e-e79d-5669-a645-4c504f3ad781', DATE '2026-04-24', DATE '2026-07-03', 8811.71, 8528.65, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', 'cb12794e-e79d-5669-a645-4c504f3ad781', 283.06, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 143 | apLIS lote 5308 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('21cc4aad-6ca8-5665-819a-e10e019d23bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5308', DATE '2026-03-25', DATE '2026-03-26', 'Faturado', 3, 'PEG442612', NULL, NULL, NULL, '5308', 6198.41, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c24fb873-cdc7-52f6-8c82-4c6b8e94d3d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-27', DATE '2026-04-27', 6198.41, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 143). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c24fb873-cdc7-52f6-8c82-4c6b8e94d3d3', '21cc4aad-6ca8-5665-819a-e10e019d23bc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c24fb873-cdc7-52f6-8c82-4c6b8e94d3d3', '21cc4aad-6ca8-5665-819a-e10e019d23bc', DATE '2026-04-27', 6198.41, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 144 | apLIS lote 5319 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bd455576-aa34-5f91-83ca-02adb258cd8f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5319', DATE '2026-03-27', DATE '2026-03-27', 'Recebido - parcial', 7, 'PEG442716', NULL, NULL, NULL, '5319', 11402.33, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-03-27', DATE '2026-04-27', 11402.33, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 144). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', 'bd455576-aa34-5f91-83ca-02adb258cd8f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', 'bd455576-aa34-5f91-83ca-02adb258cd8f', DATE '2026-04-27', DATE '2026-07-03', 11402.33, 10907.42, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', 'bd455576-aa34-5f91-83ca-02adb258cd8f', 494.91, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 145 | apLIS lote 5151 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6ff3b728-7885-55a5-b8e7-6ceb17f79d61', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5151', DATE '2026-03-04', DATE '2026-03-04', 'Recebido - parcial', 7, 'PEG4257856', NULL, NULL, NULL, '5151', 18342.82, 55);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), NULL, DATE '2026-03-04', DATE '2026-05-03', 18342.82, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 145). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', '6ff3b728-7885-55a5-b8e7-6ceb17f79d61');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', '6ff3b728-7885-55a5-b8e7-6ceb17f79d61', DATE '2026-05-03', DATE '2026-04-28', 18342.82, 18342.80, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', '6ff3b728-7885-55a5-b8e7-6ceb17f79d61', 0.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 146 | apLIS lote 5161 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0250d864-9342-5286-b0ff-690406f754ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5161', DATE '2026-03-06', DATE '2026-03-06', 'Recebido', 4, '39077', NULL, NULL, NULL, '5161', 24113.18, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('83bc741b-5c6e-56eb-b2bb-53e09cabde2d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-09', DATE '2026-04-08', 24113.18, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 146). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('83bc741b-5c6e-56eb-b2bb-53e09cabde2d', '0250d864-9342-5286-b0ff-690406f754ba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('83bc741b-5c6e-56eb-b2bb-53e09cabde2d', '0250d864-9342-5286-b0ff-690406f754ba', DATE '2026-04-08', DATE '2026-05-27', 24113.18, 24113.18, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 147 | apLIS lote 5162 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad2519f6-128e-56ff-9a94-afac9a0638c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5162', DATE '2026-03-06', DATE '2026-03-06', 'Recebido', 4, '39109', NULL, NULL, NULL, '5162', 1369.33, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('168105be-9527-5a97-83d5-d88bbb613135', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-09', DATE '2026-04-08', 1369.33, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 147). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('168105be-9527-5a97-83d5-d88bbb613135', 'ad2519f6-128e-56ff-9a94-afac9a0638c9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('168105be-9527-5a97-83d5-d88bbb613135', 'ad2519f6-128e-56ff-9a94-afac9a0638c9', DATE '2026-04-08', DATE '2026-05-27', 1369.33, 1369.33, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 148 | apLIS lote 5180 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65504b8f-bb23-50cf-8ba3-07ac61dec1f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5180', DATE '2026-03-10', DATE '2026-03-10', 'Recebido - parcial', 7, '39957', NULL, NULL, NULL, '5180', 10233.37, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-10', DATE '2026-04-09', 10233.37, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 148). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8', DATE '2026-04-09', DATE '2026-05-22', 10233.37, 9900.23, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8', 333.14, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8', 1.00, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- MARÇO linha 149 | apLIS lote 5210 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4e251396-b49c-52f6-a927-9258a9a2b487', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5210', DATE '2026-03-13', DATE '2026-03-13', 'Recebido', 4, '41399', NULL, NULL, NULL, '5210', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('780e6e8e-6bd6-5ed0-b623-944ac89fa80a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-03-13', DATE '2026-03-13', 76.85, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 149). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('780e6e8e-6bd6-5ed0-b623-944ac89fa80a', '4e251396-b49c-52f6-a927-9258a9a2b487');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('780e6e8e-6bd6-5ed0-b623-944ac89fa80a', '4e251396-b49c-52f6-a927-9258a9a2b487', DATE '2026-03-13', DATE '2026-05-05', 76.85, 76.85, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 150 | apLIS lote 5276 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('91c09eae-bf95-5a35-b9ac-0e71b240b864', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5276', DATE '2026-03-24', DATE '2026-03-26', 'Recebido - parcial', 7, '210950', NULL, NULL, NULL, '5276', 16338.88, 75);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-03-27', DATE '2026-05-26', 16338.88, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 150). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', '91c09eae-bf95-5a35-b9ac-0e71b240b864');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', '91c09eae-bf95-5a35-b9ac-0e71b240b864', DATE '2026-05-26', DATE '2026-05-29', 16338.88, 14791.69, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', '91c09eae-bf95-5a35-b9ac-0e71b240b864', 1547.19, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- MARÇO linha 151 | apLIS lote 5280 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b4d29b27-3447-53e0-a963-7688375dad0d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5280', DATE '2026-03-24', DATE '2026-03-26', 'Recebido', 4, '210963', NULL, NULL, NULL, '5280', 6580.60, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7b081552-5ba9-578d-936e-b9f712a0157f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-03-27', DATE '2026-05-26', 6580.60, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 151). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7b081552-5ba9-578d-936e-b9f712a0157f', 'b4d29b27-3447-53e0-a963-7688375dad0d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7b081552-5ba9-578d-936e-b9f712a0157f', 'b4d29b27-3447-53e0-a963-7688375dad0d', DATE '2026-05-26', DATE '2026-05-29', 6580.60, 6580.60, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 152 | apLIS lote 5281 | SIS SENADO
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eca7f2d0-e762-5f40-a11c-8a4f9aa506ca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5281', DATE '2026-03-24', DATE '2026-03-26', 'Recebido', 4, '211085', NULL, NULL, NULL, '5281', 2082.45, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a64d817f-6d48-5154-a9e6-c86d72ec9e6c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-03-27', DATE '2026-03-27', 2082.45, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 152). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a64d817f-6d48-5154-a9e6-c86d72ec9e6c', 'eca7f2d0-e762-5f40-a11c-8a4f9aa506ca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a64d817f-6d48-5154-a9e6-c86d72ec9e6c', 'eca7f2d0-e762-5f40-a11c-8a4f9aa506ca', DATE '2026-03-27', DATE '2026-05-29', 2082.45, 2082.45, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 153 | apLIS lote 5282 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('08e18999-c97f-54f2-a810-b07af8985335', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5282', DATE '2026-03-24', DATE '2026-03-26', 'Recebido', 4, '211047', NULL, NULL, NULL, '5282', 2569.46, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f28a59bb-996d-594e-be4f-b0adb9e9991d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-03-27', DATE '2026-05-26', 2569.46, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 153). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f28a59bb-996d-594e-be4f-b0adb9e9991d', '08e18999-c97f-54f2-a810-b07af8985335');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f28a59bb-996d-594e-be4f-b0adb9e9991d', '08e18999-c97f-54f2-a810-b07af8985335', DATE '2026-05-26', DATE '2026-05-29', 2569.46, 2569.46, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 154 | apLIS lote 5270 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('500dd951-bd07-5d68-8aac-a6c8f8ee16b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5270', DATE '2026-03-23', DATE '2026-03-26', 'Recebido', 4, '7277267', NULL, NULL, NULL, '5270', 19586.18, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2008cd5-6761-590c-a864-cc3859ab8492', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-26', DATE '2026-04-25', 19586.18, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 154). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2008cd5-6761-590c-a864-cc3859ab8492', '500dd951-bd07-5d68-8aac-a6c8f8ee16b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a2008cd5-6761-590c-a864-cc3859ab8492', '500dd951-bd07-5d68-8aac-a6c8f8ee16b8', DATE '2026-04-25', DATE '2026-04-27', 19586.18, 19586.18, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 155 | apLIS lote 5283 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a31b4860-4b9b-5b1f-8f11-65af3ecfb161', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5283', DATE '2026-03-24', DATE '2026-03-26', 'Recebido', 4, '7277878', NULL, NULL, NULL, '5283', 25483.11, 72);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('08587bb0-e5f6-5e1b-919e-a20a76522a38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-26', DATE '2026-04-25', 25483.11, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 155). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('08587bb0-e5f6-5e1b-919e-a20a76522a38', 'a31b4860-4b9b-5b1f-8f11-65af3ecfb161');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('08587bb0-e5f6-5e1b-919e-a20a76522a38', 'a31b4860-4b9b-5b1f-8f11-65af3ecfb161', DATE '2026-04-25', DATE '2026-04-27', 25483.11, 25483.11, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 156 | apLIS lote 5284 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b007f661-b867-5c97-8898-e3b7a4698c0d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5284', DATE '2026-03-24', DATE '2026-03-26', 'Recebido', 4, '7278773', NULL, NULL, NULL, '5284', 26648.12, 68);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5abd5054-d609-5af4-aaf2-fd004d979e2d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-26', DATE '2026-04-25', 26648.12, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 156). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5abd5054-d609-5af4-aaf2-fd004d979e2d', 'b007f661-b867-5c97-8898-e3b7a4698c0d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5abd5054-d609-5af4-aaf2-fd004d979e2d', 'b007f661-b867-5c97-8898-e3b7a4698c0d', DATE '2026-04-25', DATE '2026-04-27', 26648.12, 26648.12, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 157 | apLIS lote 5327 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('81149c9f-4a46-5bda-a798-d47c84b1f2fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5327', DATE '2026-03-30', DATE '2026-03-30', 'Recebido', 4, '7284742', NULL, NULL, NULL, '5327', 4692.01, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1fa9654f-7e49-5368-8254-d32aa8249815', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-30', DATE '2026-04-29', 4692.01, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 157). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1fa9654f-7e49-5368-8254-d32aa8249815', '81149c9f-4a46-5bda-a798-d47c84b1f2fb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1fa9654f-7e49-5368-8254-d32aa8249815', '81149c9f-4a46-5bda-a798-d47c84b1f2fb', DATE '2026-04-29', DATE '2026-05-27', 4692.01, 4692.01, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 158 | apLIS lote 5328 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fb4859d5-e463-567e-882b-a732e4eef914', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5328', DATE '2026-03-30', DATE '2026-03-30', 'Faturado', 3, '7284715', NULL, NULL, NULL, '5328', 1431.88, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-30', DATE '2026-04-29', 1431.88, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 158). Responsável: Rivia. Status original na planilha: Vencido. Glosa devida: recussado.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', 'fb4859d5-e463-567e-882b-a732e4eef914');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', 'fb4859d5-e463-567e-882b-a732e4eef914', DATE '2026-04-29', DATE '2026-05-27', 1431.88, 1431.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', 'fb4859d5-e463-567e-882b-a732e4eef914', 667.78, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- MARÇO linha 159 | apLIS lote 5335 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('08aa0e06-1549-5dd9-9f44-7368b8fce41c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5335', DATE '2026-03-30', DATE '2026-03-30', 'Recebido', 4, '7285364', NULL, NULL, NULL, '5335', 3327.85, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('98ac6634-c645-5fa6-beca-579f08383240', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-03-30', DATE '2026-04-29', 3327.85, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 159). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('98ac6634-c645-5fa6-beca-579f08383240', '08aa0e06-1549-5dd9-9f44-7368b8fce41c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('98ac6634-c645-5fa6-beca-579f08383240', '08aa0e06-1549-5dd9-9f44-7368b8fce41c', DATE '2026-04-29', DATE '2026-05-27', 3327.85, 3327.85, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 160 | apLIS lote 5090 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b6e6716c-1052-55c1-8294-e1f8bbfef62b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5090', DATE '2026-02-26', DATE '2026-03-02', 'Recebido - parcial', 7, 'PEG6300000566', NULL, NULL, NULL, '5090', 7697.31, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-02', DATE '2026-04-06', 7697.31, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 160). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b', DATE '2026-04-06', DATE '2026-04-15', 7697.31, 6079.21, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b', 1618.10, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 161 | apLIS lote 5092 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cf119584-4a7b-5ca0-a9f4-8f8e5ff731dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5092', DATE '2026-02-26', DATE '2026-03-03', 'Recebido', 4, 'PEG6300000567', NULL, NULL, NULL, '5092', 3482.17, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8d72e56-1628-56c6-89d5-f839b1e9a2c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-03', DATE '2026-04-07', 3482.17, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 161). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8d72e56-1628-56c6-89d5-f839b1e9a2c8', 'cf119584-4a7b-5ca0-a9f4-8f8e5ff731dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8d72e56-1628-56c6-89d5-f839b1e9a2c8', 'cf119584-4a7b-5ca0-a9f4-8f8e5ff731dc', DATE '2026-04-07', DATE '2026-04-15', 3482.17, 3482.17, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 162 | apLIS lote 5087 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc946d87-53a4-5572-af0b-b5151a8a4c50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5087', DATE '2026-02-26', DATE '2026-03-03', 'Recebido - parcial', 7, 'PEG6300000568', NULL, NULL, NULL, '5087', 15074.16, 79);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-03', DATE '2026-04-07', 15074.16, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 162). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', DATE '2026-04-07', DATE '2026-04-15', 15074.16, 13638.37, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', 1435.79, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 163 | apLIS lote 4928 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4928', DATE '2026-01-30', DATE '2026-03-03', 'Recebido - parcial', 7, 'PEG6300000569', NULL, NULL, NULL, '4928', 13114.15, 64);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-03', DATE '2026-04-07', 13114.15, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 163). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', DATE '2026-04-07', DATE '2026-04-15', 13114.15, 11220.77, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', 1893.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 164 | apLIS lote 5088 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2719eeda-b4f4-5efa-81d7-07e04ad7dc61', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5088', DATE '2026-02-26', DATE '2026-03-03', 'Faturado', 3, 'PEG6300000570', '9076', 9058, DATE '2026-08-25', '5088', 15407.18, 82);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '9076', DATE '2026-03-03', DATE '2026-04-07', 15407.18, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 164). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61', DATE '2026-04-07', DATE '2026-04-15', 15407.18, 12738.16, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61', 2669.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 165 | apLIS lote 5089 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6bd02937-68fa-56a0-a162-fc9990867911', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5089', DATE '2026-02-26', DATE '2026-03-03', 'Recebido', 4, 'PEG6300000571', NULL, NULL, NULL, '5089', 11964.31, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b122670-4fa8-5731-9548-195e64209d49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-03', DATE '2026-04-07', 11964.31, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 165). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', '6bd02937-68fa-56a0-a162-fc9990867911');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5b122670-4fa8-5731-9548-195e64209d49', '6bd02937-68fa-56a0-a162-fc9990867911', DATE '2026-04-07', DATE '2026-04-15', 11964.31, 11587.27, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5b122670-4fa8-5731-9548-195e64209d49', '6bd02937-68fa-56a0-a162-fc9990867911', 377.04, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 166 | apLIS lote 5136 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('862c2f1a-a3dd-5e71-8ef9-648ae130f27f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5136', DATE '2026-03-03', DATE '2026-03-03', 'Recebido - parcial', 7, 'PEG6300000572', NULL, NULL, NULL, '5136', 8144.12, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-03', DATE '2026-04-07', 8144.12, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 166). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', '862c2f1a-a3dd-5e71-8ef9-648ae130f27f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', '862c2f1a-a3dd-5e71-8ef9-648ae130f27f', DATE '2026-04-07', DATE '2026-04-15', 8144.12, 7377.66, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', '862c2f1a-a3dd-5e71-8ef9-648ae130f27f', 766.46, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 167 | apLIS lote 5315 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc53228e-a35c-5cef-b42e-7613300ebb31', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5315', DATE '2026-03-26', DATE '2026-03-31', 'Faturado', 3, '260331013532', '8193', 8173, DATE '2026-05-27', '5315', 15121.98, 81);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8193', DATE '2026-03-31', DATE '2026-05-05', 15121.98, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 167). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', 'bc53228e-a35c-5cef-b42e-7613300ebb31');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', 'bc53228e-a35c-5cef-b42e-7613300ebb31', DATE '2026-05-05', DATE '2026-05-18', 15121.98, 11684.34, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', 'bc53228e-a35c-5cef-b42e-7613300ebb31', 3437.64, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 168 | apLIS lote 5316 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('29ce0f2d-ec5b-5777-9d42-29f0ffb3c133', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5316', DATE '2026-03-26', DATE '2026-03-31', 'Faturado', 3, '260331013090', '8193', 8173, DATE '2026-05-27', '5316', 19418.99, 95);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8193', DATE '2026-03-31', DATE '2026-05-05', 19418.99, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 168). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', '29ce0f2d-ec5b-5777-9d42-29f0ffb3c133');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', '29ce0f2d-ec5b-5777-9d42-29f0ffb3c133', DATE '2026-05-05', DATE '2026-05-18', 19418.99, 15205.57, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', '29ce0f2d-ec5b-5777-9d42-29f0ffb3c133', 4213.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 169 | apLIS lote 5314 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61208d68-ec38-5c2b-a2d2-0d8b474b7d16', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5314', DATE '2026-03-26', DATE '2026-03-31', 'Faturado', 3, '260331012453', '8193', 8173, DATE '2026-05-27', '5314', 15619.46, 77);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8193', DATE '2026-03-31', DATE '2026-05-05', 15619.46, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 169). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', '61208d68-ec38-5c2b-a2d2-0d8b474b7d16');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', '61208d68-ec38-5c2b-a2d2-0d8b474b7d16', DATE '2026-05-05', DATE '2026-05-18', 15619.46, 14464.71, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', '61208d68-ec38-5c2b-a2d2-0d8b474b7d16', 1154.75, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 170 | apLIS lote 5091 | 090 SULAMERICA ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('82778d0e-2403-5bec-bbfb-68067b57a449', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '5091', DATE '2026-02-26', DATE '2026-03-31', 'Recebido', 4, '260331010904', NULL, NULL, NULL, '5091', 676.34, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('433564bb-3cc3-5b06-b41c-47e77e91ed76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), NULL, DATE '2026-03-31', DATE '2026-05-05', 676.34, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 170). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('433564bb-3cc3-5b06-b41c-47e77e91ed76', '82778d0e-2403-5bec-bbfb-68067b57a449');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('433564bb-3cc3-5b06-b41c-47e77e91ed76', '82778d0e-2403-5bec-bbfb-68067b57a449', DATE '2026-05-05', DATE '2026-05-18', 676.34, 387.13, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('433564bb-3cc3-5b06-b41c-47e77e91ed76', '82778d0e-2403-5bec-bbfb-68067b57a449', 289.21, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 171 | apLIS lote 5329 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bf296ba8-ad3f-56d3-be9c-17e1c39d2f4b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5329', DATE '2026-03-30', DATE '2026-03-31', 'Recebido - parcial', 7, '260331009092', NULL, NULL, NULL, '5329', 246.16, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-31', DATE '2026-05-05', 246.16, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 171). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', 'bf296ba8-ad3f-56d3-be9c-17e1c39d2f4b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', 'bf296ba8-ad3f-56d3-be9c-17e1c39d2f4b', DATE '2026-05-05', DATE '2026-05-18', 246.16, 123.08, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', 'bf296ba8-ad3f-56d3-be9c-17e1c39d2f4b', 123.08, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 172 | apLIS lote 5317 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53e5196b-4f2a-5b6f-a58e-a552838ecac5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5317', DATE '2026-03-26', DATE '2026-03-31', 'Recebido', 4, '260331008658', '8193', 8173, DATE '2026-05-27', '5317', 13119.74, 72);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c25fb12-b53d-51b2-9913-d79ff26df029', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8193', DATE '2026-03-31', DATE '2026-05-05', 13119.74, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 172). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c25fb12-b53d-51b2-9913-d79ff26df029', '53e5196b-4f2a-5b6f-a58e-a552838ecac5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c25fb12-b53d-51b2-9913-d79ff26df029', '53e5196b-4f2a-5b6f-a58e-a552838ecac5', DATE '2026-05-05', DATE '2026-05-18', 13119.74, 9633.23, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5c25fb12-b53d-51b2-9913-d79ff26df029', '53e5196b-4f2a-5b6f-a58e-a552838ecac5', 3486.51, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 173 | apLIS lote 5330 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4d7486a2-530f-520c-ae67-fe4dd9fa95c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5330', DATE '2026-03-30', DATE '2026-03-30', 'Faturado', 3, '260331006134', NULL, NULL, NULL, '5330', 5117.38, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-03-31', DATE '2026-05-05', 5117.38, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 173). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', '4d7486a2-530f-520c-ae67-fe4dd9fa95c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', '4d7486a2-530f-520c-ae67-fe4dd9fa95c0', DATE '2026-05-05', DATE '2026-05-18', 5117.38, 2101.06, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', '4d7486a2-530f-520c-ae67-fe4dd9fa95c0', 3016.32, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 174 | apLIS lote 5344 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('afd37cb4-8c6d-54d2-b6bc-b6597096e29e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5344', DATE '2026-03-31', DATE '2026-03-31', 'Faturado', 3, '260331014771', '8193', 8173, DATE '2026-05-27', '5344', 2935.73, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('799ddb9c-ce91-579b-ad88-31dff8a3db2b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8193', DATE '2026-03-31', DATE '2026-05-05', 2935.73, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 174). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('799ddb9c-ce91-579b-ad88-31dff8a3db2b', 'afd37cb4-8c6d-54d2-b6bc-b6597096e29e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('799ddb9c-ce91-579b-ad88-31dff8a3db2b', 'afd37cb4-8c6d-54d2-b6bc-b6597096e29e', DATE '2026-05-05', DATE '2026-05-18', 2935.73, 1804.61, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('799ddb9c-ce91-579b-ad88-31dff8a3db2b', 'afd37cb4-8c6d-54d2-b6bc-b6597096e29e', 1131.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 175 | apLIS lote 5201 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3f6f59ba-625c-5d32-a43d-6b1432cf0ae3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5201', DATE '2026-03-13', DATE '2026-03-13', 'Recebido', 4, 'PEG470737', NULL, NULL, NULL, '5201', 92.08, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7149edb5-e889-5791-a339-7e1505a4c9b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-03-13', DATE '2026-04-12', 92.08, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 175). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7149edb5-e889-5791-a339-7e1505a4c9b0', '3f6f59ba-625c-5d32-a43d-6b1432cf0ae3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7149edb5-e889-5791-a339-7e1505a4c9b0', '3f6f59ba-625c-5d32-a43d-6b1432cf0ae3', DATE '2026-04-12', DATE '2026-06-13', 92.08, 92.08, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 176 | apLIS lote 5033 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a343ae0b-fcb4-5f88-bf6a-11e7a1909e27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5033', DATE '2026-02-18', DATE '2026-03-13', 'Recebido', 4, 'PEG470754', NULL, NULL, NULL, '5033', 1364.42, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b8c8b31e-3dff-5191-b2d0-b0ea9d46e43e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-03-13', DATE '2026-04-12', 1364.42, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 176). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b8c8b31e-3dff-5191-b2d0-b0ea9d46e43e', 'a343ae0b-fcb4-5f88-bf6a-11e7a1909e27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b8c8b31e-3dff-5191-b2d0-b0ea9d46e43e', 'a343ae0b-fcb4-5f88-bf6a-11e7a1909e27', DATE '2026-04-12', DATE '2026-06-13', 1364.42, 1364.42, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 177 | apLIS lote 5204 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('36672c52-9dee-5d34-ae27-9ac9607d1504', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5204', DATE '2026-03-13', DATE '2026-03-14', 'Recebido - parcial', 7, 'PEG470940', '8859', 8839, DATE '2026-07-29', '5204', 8808.09, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8859', DATE '2026-03-14', DATE '2026-04-13', 8808.09, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 177). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', '36672c52-9dee-5d34-ae27-9ac9607d1504');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', '36672c52-9dee-5d34-ae27-9ac9607d1504', DATE '2026-04-13', DATE '2026-06-13', 8808.09, 8737.61, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', '36672c52-9dee-5d34-ae27-9ac9607d1504', 70.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 178 | apLIS lote 5212 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('912c8373-14e1-5b7c-baa9-199f386032cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5212', DATE '2026-03-13', DATE '2026-03-14', 'Faturado', 3, 'PEG470941', NULL, NULL, NULL, '5212', 9626.08, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-03-14', DATE '2026-04-13', 9626.08, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 178). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', '912c8373-14e1-5b7c-baa9-199f386032cd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', '912c8373-14e1-5b7c-baa9-199f386032cd', DATE '2026-04-13', DATE '2026-06-13', 9626.08, 8658.86, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', '912c8373-14e1-5b7c-baa9-199f386032cd', 967.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 179 | apLIS lote 5167 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('70507d4d-d592-5b09-a255-1285c1538ec3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5167', DATE '2026-03-06', DATE '2026-03-06', 'Recebido', 4, 'PEG224375', NULL, NULL, NULL, '5167', 558.97, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ec36a654-ef03-5c99-a974-87fc815904e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-03-06', DATE '2026-04-17', 558.97, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 179). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ec36a654-ef03-5c99-a974-87fc815904e9', '70507d4d-d592-5b09-a255-1285c1538ec3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ec36a654-ef03-5c99-a974-87fc815904e9', '70507d4d-d592-5b09-a255-1285c1538ec3', DATE '2026-04-17', DATE '2026-04-24', 558.97, 558.97, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 180 | apLIS lote 4968 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ef757d35-8a9f-5838-b581-3bd4949e7615', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '4968', DATE '2026-02-04', DATE '2026-03-06', 'Faturado', 3, 'PEG224385', NULL, NULL, NULL, '4968', 3357.83, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-03-06', DATE '2026-04-17', 3357.83, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 180). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', 'ef757d35-8a9f-5838-b581-3bd4949e7615');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', 'ef757d35-8a9f-5838-b581-3bd4949e7615', DATE '2026-04-17', DATE '2026-04-24', 3357.83, 3357.69, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', 'ef757d35-8a9f-5838-b581-3bd4949e7615', 0.14, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 181 | apLIS lote 5172 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cc29ab67-a8f9-56ce-83d9-1ffeea56c42e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5172', DATE '2026-03-09', DATE '2026-03-09', 'Faturado', 3, 'PEG224457', NULL, NULL, NULL, '5172', 792.53, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-03-09', DATE '2026-04-21', 792.53, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 181). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', 'cc29ab67-a8f9-56ce-83d9-1ffeea56c42e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', 'cc29ab67-a8f9-56ce-83d9-1ffeea56c42e', DATE '2026-04-21', DATE '2026-04-24', 792.53, 792.51, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', 'cc29ab67-a8f9-56ce-83d9-1ffeea56c42e', 0.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 182 | apLIS lote 5246 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0202e093-619a-5f96-8841-1c0c07d602f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5246', DATE '2026-03-20', DATE '2026-03-20', 'Recebido - parcial', 7, '225095', NULL, NULL, NULL, '5246', 955.09, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-03-20', DATE '2026-05-01', 955.09, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 182). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', '0202e093-619a-5f96-8841-1c0c07d602f4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', '0202e093-619a-5f96-8841-1c0c07d602f4', DATE '2026-05-01', DATE '2026-04-24', 955.09, 955.06, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', '0202e093-619a-5f96-8841-1c0c07d602f4', 0.03, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 183 | apLIS lote 5234 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad1097d5-9538-519e-b4b7-c3d9570baaba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5234', DATE '2026-03-19', DATE '2026-03-19', 'Recebido', 4, '9951410', NULL, NULL, NULL, '5234', 508.41, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ca6c6a09-81ed-5239-8e97-af50bc5c7c6c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-03-19', DATE '2026-04-15', 508.41, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 183). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ca6c6a09-81ed-5239-8e97-af50bc5c7c6c', 'ad1097d5-9538-519e-b4b7-c3d9570baaba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ca6c6a09-81ed-5239-8e97-af50bc5c7c6c', 'ad1097d5-9538-519e-b4b7-c3d9570baaba', DATE '2026-04-15', DATE '2026-05-11', 508.41, 508.41, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 184 | apLIS lote 5237 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f574b504-9abe-51a4-bdcf-2f66bb142ea7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5237', DATE '2026-03-19', DATE '2026-03-20', 'Recebido - parcial', 7, '9961198', NULL, NULL, NULL, '5237', 12913.37, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('be10af52-b85b-578a-b2c8-89f90535f040', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-03-20', DATE '2026-04-15', 12913.37, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 184). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('be10af52-b85b-578a-b2c8-89f90535f040', 'f574b504-9abe-51a4-bdcf-2f66bb142ea7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('be10af52-b85b-578a-b2c8-89f90535f040', 'f574b504-9abe-51a4-bdcf-2f66bb142ea7', DATE '2026-04-15', DATE '2026-05-11', 12913.37, 12460.68, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('be10af52-b85b-578a-b2c8-89f90535f040', 'f574b504-9abe-51a4-bdcf-2f66bb142ea7', 452.69, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 185 | apLIS lote 5119 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('56915a6c-8fb4-5801-8f33-7f1bf85d9fe2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5119', DATE '2026-03-02', DATE '2026-03-02', 'Recebido', 4, 'PEG4158', '8192', 8172, DATE '2026-07-31', '5119', 50.19, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('96604fe6-ddc0-5516-bc09-9618141af3a6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '8192', DATE '2026-03-02', DATE '2026-04-01', 50.19, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 185). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('96604fe6-ddc0-5516-bc09-9618141af3a6', '56915a6c-8fb4-5801-8f33-7f1bf85d9fe2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('96604fe6-ddc0-5516-bc09-9618141af3a6', '56915a6c-8fb4-5801-8f33-7f1bf85d9fe2', DATE '2026-04-01', DATE '2026-07-10', 50.19, 50.19, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 186 | apLIS lote 5120 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4f27eb4c-2e61-59d0-872c-a043896a3b19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5120', DATE '2026-03-02', DATE '2026-03-02', 'Recebido', 4, 'PEG4159', '8192', 8172, DATE '2026-07-31', '5120', 864.13, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8633a19e-43aa-5fba-a261-63b739011571', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '8192', DATE '2026-03-02', DATE '2026-04-01', 864.13, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 186). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8633a19e-43aa-5fba-a261-63b739011571', '4f27eb4c-2e61-59d0-872c-a043896a3b19');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8633a19e-43aa-5fba-a261-63b739011571', '4f27eb4c-2e61-59d0-872c-a043896a3b19', DATE '2026-04-01', DATE '2026-07-10', 864.13, 787.28, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8633a19e-43aa-5fba-a261-63b739011571', '4f27eb4c-2e61-59d0-872c-a043896a3b19', 76.85, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- MARÇO linha 187 | apLIS lote 5123 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9b1d406b-92cd-5acd-b736-9efee74af3f3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5123', DATE '2026-03-02', DATE '2026-03-02', 'Recebido', 4, 'PEG60114', NULL, NULL, NULL, '5123', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('430140a7-9c04-5535-bf0c-769cb7231b62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-03-02', DATE '2026-04-01', 76.85, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 187). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('430140a7-9c04-5535-bf0c-769cb7231b62', '9b1d406b-92cd-5acd-b736-9efee74af3f3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('430140a7-9c04-5535-bf0c-769cb7231b62', '9b1d406b-92cd-5acd-b736-9efee74af3f3', DATE '2026-04-01', DATE '2026-05-06', 76.85, 76.85, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 188 | apLIS lote 4937 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('02d31b0c-86ff-5c98-9311-b585ee506701', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4937', DATE '2026-02-02', DATE '2026-03-02', 'Recebido', 4, 'PEG60121', NULL, 7905, DATE '2026-04-28', '4937', 4722.32, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('48883f8c-9e33-538a-b608-df2226e3a860', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-03-02', DATE '2026-04-01', 4722.32, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 188). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('48883f8c-9e33-538a-b608-df2226e3a860', '02d31b0c-86ff-5c98-9311-b585ee506701');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('48883f8c-9e33-538a-b608-df2226e3a860', '02d31b0c-86ff-5c98-9311-b585ee506701', DATE '2026-04-01', DATE '2026-05-06', 4722.32, 4722.32, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 189 | apLIS lote 5137 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('92d23cfb-c1ca-5a07-b9bb-c6e759c85844', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5137', DATE '2026-03-03', DATE '2026-03-03', 'Recebido', 4, 'PEG60276', '8305', 8285, DATE '2026-08-31', '5137', 1401.26, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f89b148d-9c9f-52eb-9cad-975226402258', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8305', DATE '2026-03-03', DATE '2026-04-02', 1401.26, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 189). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f89b148d-9c9f-52eb-9cad-975226402258', '92d23cfb-c1ca-5a07-b9bb-c6e759c85844');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f89b148d-9c9f-52eb-9cad-975226402258', '92d23cfb-c1ca-5a07-b9bb-c6e759c85844', DATE '2026-04-02', DATE '2026-06-18', 1401.26, 1401.26, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 190 | apLIS lote 5221 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('56a8db2c-acd9-5d35-bef0-e584d9c218a6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5221', DATE '2026-03-17', DATE '2026-03-17', 'Recebido', 4, '60596', '8001', 7981, DATE '2026-07-31', '5221', 940.98, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7e387445-2c77-5d2a-a924-1ff6148470fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8001', DATE '2026-03-17', DATE '2026-04-16', 940.98, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 190). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7e387445-2c77-5d2a-a924-1ff6148470fe', '56a8db2c-acd9-5d35-bef0-e584d9c218a6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7e387445-2c77-5d2a-a924-1ff6148470fe', '56a8db2c-acd9-5d35-bef0-e584d9c218a6', DATE '2026-04-16', DATE '2026-05-18', 940.98, 940.98, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 191 | apLIS lote 5139 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad37941a-8db5-5475-af3c-ffedabb95ef6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5139', DATE '2026-03-03', DATE '2026-03-17', 'Recebido', 4, '60613', '8001', 7981, DATE '2026-07-31', '5139', 2265.39, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a4149711-02f9-56c3-978c-9d92dc569c99', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8001', DATE '2026-03-17', DATE '2026-04-16', 2265.39, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 191). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a4149711-02f9-56c3-978c-9d92dc569c99', 'ad37941a-8db5-5475-af3c-ffedabb95ef6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a4149711-02f9-56c3-978c-9d92dc569c99', 'ad37941a-8db5-5475-af3c-ffedabb95ef6', DATE '2026-04-16', DATE '2026-05-18', 2265.39, 2265.39, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 192 | apLIS lote 5222 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac3f1799-8405-5381-a2d1-20d114c1cca3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5222', DATE '2026-03-17', DATE '2026-03-17', 'Recebido', 4, '60620', '8001', 7981, DATE '2026-07-31', '5222', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c263266-26f4-5487-840f-36963dd27046', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8001', DATE '2026-03-17', DATE '2026-04-16', 76.85, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 192). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c263266-26f4-5487-840f-36963dd27046', 'ac3f1799-8405-5381-a2d1-20d114c1cca3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3c263266-26f4-5487-840f-36963dd27046', 'ac3f1799-8405-5381-a2d1-20d114c1cca3', DATE '2026-04-16', DATE '2026-05-18', 76.85, 76.85, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 193 | apLIS lote 5025 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e85a1bda-6ec4-5b23-8e5b-1ab00d6ac71a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5025', DATE '2026-02-18', DATE '2026-03-19', 'Faturado', 3, 'P20261245287', NULL, NULL, NULL, '5025', 471.21, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-03-19', DATE '2026-04-20', 471.21, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 193). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42', 'e85a1bda-6ec4-5b23-8e5b-1ab00d6ac71a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42', 'e85a1bda-6ec4-5b23-8e5b-1ab00d6ac71a', DATE '2026-04-20', DATE '2026-04-24', 471.21, 471.16, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 194 | apLIS lote 5232 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74e0ea5b-d6cd-5088-9f3c-9bddd362ab6d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5232', DATE '2026-03-19', DATE '2026-03-19', 'Faturado', 3, 'P20261245291', NULL, 8575, DATE '2026-07-03', '5232', 8024.17, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-03-19', DATE '2026-04-20', 8024.17, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 194). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', '74e0ea5b-d6cd-5088-9f3c-9bddd362ab6d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', '74e0ea5b-d6cd-5088-9f3c-9bddd362ab6d', DATE '2026-04-20', DATE '2026-04-24', 8024.17, 7893.92, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', '74e0ea5b-d6cd-5088-9f3c-9bddd362ab6d', 130.25, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- MARÇO linha 196 | apLIS lote 5117 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3bc1a8f0-be04-5755-8598-e8cd8fdbddfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5117', DATE '2026-03-02', DATE '2026-03-02', 'Faturado', 3, '02022026', NULL, NULL, NULL, '5117', 300.00, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dc8a7236-ef3e-5f5e-9f28-98ce29346b9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-02', DATE '2026-03-02', 300.00, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 196). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dc8a7236-ef3e-5f5e-9f28-98ce29346b9a', '3bc1a8f0-be04-5755-8598-e8cd8fdbddfa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dc8a7236-ef3e-5f5e-9f28-98ce29346b9a', '3bc1a8f0-be04-5755-8598-e8cd8fdbddfa', DATE '2026-03-02', DATE '2026-03-02', 300.00, 300.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 197 | apLIS lote 5116 | Medigest Centro de Medicina Digestiva ("MEDIGEST -  ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('da8c7f33-ea90-57ac-9937-2cd05a4abb87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5116', DATE '2026-03-02', DATE '2026-03-02', 'Faturado', 3, '02032026', NULL, NULL, NULL, '5116', 1872.62, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f9a2b565-f377-5009-953c-a0a85ff2ad42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-02', DATE '2026-04-20', 1872.62, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 197). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f9a2b565-f377-5009-953c-a0a85ff2ad42', 'da8c7f33-ea90-57ac-9937-2cd05a4abb87');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f9a2b565-f377-5009-953c-a0a85ff2ad42', 'da8c7f33-ea90-57ac-9937-2cd05a4abb87', DATE '2026-04-20', DATE '2026-03-02', 1872.62, 1872.62, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 198 | apLIS lote 5115 | Medigest Centro de Medicina Digestiva ("MEDIGEST -  SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('826d5f44-cab6-5602-877b-b3aa1cdcf67f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5115', DATE '2026-03-02', DATE '2026-03-02', 'Faturado', 3, '02032026', NULL, NULL, NULL, '5115', 386.57, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('13777d19-3621-5068-bc95-5ab5270cc626', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-02', DATE '2026-04-01', 386.57, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 198). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('13777d19-3621-5068-bc95-5ab5270cc626', '826d5f44-cab6-5602-877b-b3aa1cdcf67f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('13777d19-3621-5068-bc95-5ab5270cc626', '826d5f44-cab6-5602-877b-b3aa1cdcf67f', DATE '2026-04-01', DATE '2026-03-02', 386.57, 386.57, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 199 | apLIS lote 5168 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('417fac73-ba3c-504a-b4c5-386085a45b14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5168', DATE '2026-03-06', DATE '2026-03-06', 'Faturado', 3, '06032026', NULL, NULL, NULL, '5168', 300.00, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d445e1b3-e196-590d-9b53-dede00ec2ce9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-06', DATE '2026-03-06', 300.00, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 199). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d445e1b3-e196-590d-9b53-dede00ec2ce9', '417fac73-ba3c-504a-b4c5-386085a45b14');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d445e1b3-e196-590d-9b53-dede00ec2ce9', '417fac73-ba3c-504a-b4c5-386085a45b14', DATE '2026-03-06', DATE '2026-03-06', 300.00, 300.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 201 | apLIS lote 5169 | Medigest Centro de Medicina Digestiva ("MEDIGEST -  SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65cfc3ce-e8c7-53c0-a871-6b5955fdf3ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5169', DATE '2026-03-06', DATE '2026-03-06', 'Faturado', 3, '060326', NULL, NULL, NULL, '5169', 428.41, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c98b9a1a-6167-566d-bae5-d2f27ada5b4c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-06', DATE '2026-04-05', 428.41, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 201). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c98b9a1a-6167-566d-bae5-d2f27ada5b4c', '65cfc3ce-e8c7-53c0-a871-6b5955fdf3ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c98b9a1a-6167-566d-bae5-d2f27ada5b4c', '65cfc3ce-e8c7-53c0-a871-6b5955fdf3ed', DATE '2026-04-05', DATE '2026-03-06', 428.41, 428.41, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 202 | apLIS lote 5243 | Medigest Centro de Medicina Digestiva ("MEDIGEST -  SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d113976b-ed0a-55f9-b8bf-683c7577bb62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5243', DATE '2026-03-20', DATE '2026-03-20', 'Faturado', 3, '5243.0', NULL, NULL, NULL, '5243', 1584.43, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f325f7cf-7088-51d9-977a-93a6d2512718', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-20', DATE '2026-04-19', 1584.43, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 202). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f325f7cf-7088-51d9-977a-93a6d2512718', 'd113976b-ed0a-55f9-b8bf-683c7577bb62');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f325f7cf-7088-51d9-977a-93a6d2512718', 'd113976b-ed0a-55f9-b8bf-683c7577bb62', DATE '2026-04-19', DATE '2026-03-20', 1584.43, 1584.43, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 203 | apLIS lote 5244 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7ab86c40-b25b-5050-aa5d-50c2c25f21a9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5244', DATE '2026-03-20', DATE '2026-03-20', 'Faturado', 3, '5244.0', NULL, NULL, NULL, '5244', 1650.00, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dbdf4884-2e9c-504b-9e03-b4ea0b66accc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-20', DATE '2026-04-19', 1650.00, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 203). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dbdf4884-2e9c-504b-9e03-b4ea0b66accc', '7ab86c40-b25b-5050-aa5d-50c2c25f21a9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dbdf4884-2e9c-504b-9e03-b4ea0b66accc', '7ab86c40-b25b-5050-aa5d-50c2c25f21a9', DATE '2026-04-19', DATE '2026-03-20', 1650.00, 1650.00, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- MARÇO linha 204 | apLIS lote 5245 | Medigest Centro de Medicina Digestiva ("MEDIGEST -  ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad81b7f0-322d-5434-a1ab-c7946a2c5af8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5245', DATE '2026-03-20', DATE '2026-03-20', 'Faturado', 3, '5245.0', NULL, NULL, NULL, '5245', 3902.91, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9adf32b8-909d-5870-8b08-bdf50239ac9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-03-20', DATE '2026-04-20', 3902.91, '2026-03', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, linha 204). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9adf32b8-909d-5870-8b08-bdf50239ac9d', 'ad81b7f0-322d-5434-a1ab-c7946a2c5af8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9adf32b8-909d-5870-8b08-bdf50239ac9d', 'ad81b7f0-322d-5434-a1ab-c7946a2c5af8', DATE '2026-04-20', DATE '2026-03-20', 3902.91, 3902.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba MARÇO, %'
     AND competencia = '2026-03'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 177 THEN
    RAISE EXCEPTION 'Esperados 177 títulos do backfill de março; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
