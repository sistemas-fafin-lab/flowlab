-- ============================================================================
-- Backfill histórico: Contas a Receber — Abril/2026 (4 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba ABRIL de "Faturamento x Recebimentos - 2026 -
-- 2° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-04;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 223 títulos, R$ 1.464.234,44 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 131 recebidos, 69 parciais, 23 previstos.
-- Glosas: 62 abertas, 3 definitivas (refaturadas em outro lote),
-- 4 revertidas (recuperadas). Status do título: trigger fat_recalcular_nota.
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
    '3781', '4851', '4872', '4874', '4935', '4975', '5012', '5069', '5127', '5143', '5188', '5242'
    '5247', '5248', '5249', '5250', '5251', '5252', '5253', '5254', '5255', '5259', '5304', '5305'
    '5306', '5310', '5318', '5320', '5324', '5337', '5338', '5339', '5340', '5341', '5342', '5343'
    '5345', '5346', '5348', '5349', '5350', '5351', '5352', '5354', '5355', '5357', '5358', '5360'
    '5362', '5364', '5365', '5367', '5368', '5369', '5372', '5375', '5377', '5379', '5380', '5382'
    '5383', '5384', '5387', '5388', '5389', '5390', '5391', '5392', '5393', '5397', '5398', '5400'
    '5401', '5405', '5408', '5409', '5410', '5411', '5412', '5414', '5416', '5417', '5418', '5419'
    '5420', '5421', '5422', '5423', '5425', '5426', '5427', '5428', '5431', '5432', '5433', '5434'
    '5436', '5438', '5439', '5440', '5441', '5442', '5443', '5444', '5445', '5462', '5463', '5464'
    '5465', '5466', '5467', '5470', '5472', '5473', '5474', '5475', '5476', '5477', '5478', '5479'
    '5480', '5481', '5483', '5484', '5485', '5488', '5489', '5490', '5491', '5492', '5493', '5494'
    '5495', '5496', '5500', '5501', '5502', '5503', '5504', '5505', '5506', '5507', '5509', '5510'
    '5511', '5512', '5515', '5517', '5518', '5519', '5520', '5521', '5524', '5525', '5526', '5527'
    '5528', '5529', '5539', '5540', '5541', '5542', '5543', '5546', '5548', '5549', '5550', '5551'
    '5560', '5561', '5562', '5563', '5564', '5565', '5568', '5569', '5570', '5572', '5573', '5574'
    '5576', '5577', '5578', '5579', '5581', '5582', '5583', '5585', '5586', '5587', '5588', '5589'
    '5590', '5591', '5594', '5595', '5597', '5602', '5603', '5604', '5605', '5607', '5609', '5611'
    '5612', '5614', '5615', '5616', '5617', '5619', '5621', '5622', '5623', '5624', '5625', '5629'
    '5630', '5631', '5633', '5635', '5636', '5737', '5739'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1052', '1054', '1078', '1098', '1101', '1122', '1123', '1129', '1197', '1204', '1210', '1227', '1228', '1231', '1232', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283');
  IF v_operadoras <> 29 THEN
    RAISE EXCEPTION 'Esperadas 29 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- ABRIL linha 25 | apLIS lote 5472 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('db8baadc-64ad-5445-bb15-7be594f329c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5472', DATE '2026-04-14', DATE '2026-04-14', 'Faturado', 3, '14042026', NULL, NULL, NULL, '5472', 1744.61, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6179f6b7-ed42-5ea9-8823-bed4d501cf89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-14', DATE '2026-06-13', 1744.61, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 25). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6179f6b7-ed42-5ea9-8823-bed4d501cf89', 'db8baadc-64ad-5445-bb15-7be594f329c9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6179f6b7-ed42-5ea9-8823-bed4d501cf89', 'db8baadc-64ad-5445-bb15-7be594f329c9', DATE '2026-06-13', DATE '2025-12-31', 1744.61, 1744.61, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 26 | apLIS lote 5473 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13c4084b-b80f-5345-a3df-949b5b85eecc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5473', DATE '2026-04-14', DATE '2026-04-24', 'Recebido', 4, '24042026', NULL, NULL, NULL, '5473', 918.45, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d5a03da0-6d7b-54f4-8834-65278311608f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-24', DATE '2026-06-23', 918.45, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 26). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d5a03da0-6d7b-54f4-8834-65278311608f', '13c4084b-b80f-5345-a3df-949b5b85eecc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d5a03da0-6d7b-54f4-8834-65278311608f', '13c4084b-b80f-5345-a3df-949b5b85eecc', DATE '2026-06-23', DATE '2025-12-31', 918.45, 918.45, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 27 | apLIS lote 5612 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1bd78509-0043-5753-b942-3bfae5909531', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5612', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '29042026', NULL, NULL, NULL, '5612', 2843.08, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3a37c116-484d-564d-841b-4b994b94d74c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 2843.08, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 27). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3a37c116-484d-564d-841b-4b994b94d74c', '1bd78509-0043-5753-b942-3bfae5909531');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3a37c116-484d-564d-841b-4b994b94d74c', '1bd78509-0043-5753-b942-3bfae5909531', DATE '2026-06-28', DATE '2026-06-28', 2843.08, 2843.08, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 28 | apLIS lote 5493 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d4673f81-bed8-52e5-9f64-5523b9199d07', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5493', DATE '2026-04-16', DATE '2026-04-16', 'Recebido', 4, '20042026', NULL, NULL, NULL, '5493', 2425.09, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65f5de7a-471a-501c-a706-aae67d66a737', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-20', DATE '2026-06-19', 2425.09, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 28). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65f5de7a-471a-501c-a706-aae67d66a737', 'd4673f81-bed8-52e5-9f64-5523b9199d07');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('65f5de7a-471a-501c-a706-aae67d66a737', 'd4673f81-bed8-52e5-9f64-5523b9199d07', DATE '2026-06-19', DATE '2026-07-31', 2425.09, 2425.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 29 | apLIS lote 5616 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd3389d3-bef4-578c-b43a-5b88d8f7b221', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5616', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '44687446', NULL, NULL, NULL, '5616', 859.64, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b113edb2-60d4-5055-b93d-1f405b9e43dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 859.64, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 29). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b113edb2-60d4-5055-b93d-1f405b9e43dd', 'dd3389d3-bef4-578c-b43a-5b88d8f7b221');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b113edb2-60d4-5055-b93d-1f405b9e43dd', 'dd3389d3-bef4-578c-b43a-5b88d8f7b221', DATE '2026-06-28', DATE '2026-06-28', 859.64, 859.64, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 30 | apLIS lote 5470 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('27d8e563-1bd2-5890-8d75-13457f1b9ab0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5470', DATE '2026-04-14', DATE '2026-04-14', 'Faturado', 3, '14042026', NULL, NULL, NULL, '5470', 22433.30, 65);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b78fc85d-f1c1-5488-991b-6ca072afde6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-14', DATE '2026-06-13', 22433.30, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 30). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b78fc85d-f1c1-5488-991b-6ca072afde6e', '27d8e563-1bd2-5890-8d75-13457f1b9ab0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b78fc85d-f1c1-5488-991b-6ca072afde6e', '27d8e563-1bd2-5890-8d75-13457f1b9ab0', DATE '2026-06-13', DATE '2026-07-15', 22433.30, 22433.30, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 31 | apLIS lote 5475 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-13)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8b9cce03-046d-52c4-b66c-50905171279f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5475', DATE '2026-04-14', DATE '2026-04-14', 'Faturado', 3, '14042026', NULL, NULL, NULL, '5475', 1352.25, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('171a632d-bae3-545d-be37-fed75b5da28c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-14', DATE '2026-06-13', 1352.25, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 31). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('171a632d-bae3-545d-be37-fed75b5da28c', '8b9cce03-046d-52c4-b66c-50905171279f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('171a632d-bae3-545d-be37-fed75b5da28c', '8b9cce03-046d-52c4-b66c-50905171279f', DATE '2026-06-13', DATE '2026-06-13', 1352.25, 1352.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 32 | apLIS lote 5737 | AMHP-DF ("AMHPDF TRF PENDÊNCIA RESOLVIDA" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-07-11)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('89ed6315-5aef-58ea-87d7-f2e077520df9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5737', DATE '2026-05-12', DATE '2026-05-12', 'Faturado', 3, '12052026', NULL, NULL, NULL, '5737', 898.69, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 898.69, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 32). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39', '89ed6315-5aef-58ea-87d7-f2e077520df9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39', '89ed6315-5aef-58ea-87d7-f2e077520df9', DATE '2026-07-11', DATE '2026-07-11', 898.69, 898.69, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 33 | apLIS lote 5739 | AMHP-DF ("AMHPDF TRF PENDÊNCIA RESOLVIDA" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-09-09)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9eefbb42-3ed6-594f-887b-004516ea3254', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5739', DATE '2026-05-12', DATE '2026-05-12', 'Recebido', 4, '12052026', NULL, NULL, NULL, '5739', 2050.21, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-05-12', DATE '2026-07-11', 2050.21, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 33). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f', '9eefbb42-3ed6-594f-887b-004516ea3254');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f', '9eefbb42-3ed6-594f-887b-004516ea3254', DATE '2026-07-11', DATE '2026-09-09', 2050.21, 2050.21, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 34 | apLIS lote 5474 | AMHP-DF ("AMHPDF TRF" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-09-09)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea3fe0fd-9e4f-5f83-b77b-1a6cb928e856', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5474', DATE '2026-04-14', DATE '2026-04-14', 'Faturado', 3, '14042026', NULL, NULL, NULL, '5474', 1602.21, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('69aa7815-b33b-5552-839a-4d84a6233ffc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-14', DATE '2026-06-13', 1602.21, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 34). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('69aa7815-b33b-5552-839a-4d84a6233ffc', 'ea3fe0fd-9e4f-5f83-b77b-1a6cb928e856');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('69aa7815-b33b-5552-839a-4d84a6233ffc', 'ea3fe0fd-9e4f-5f83-b77b-1a6cb928e856', DATE '2026-06-13', DATE '2026-09-09', 1602.21, 1602.21, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 35 | apLIS lote 5511 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-16)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8013510d-934a-506a-8834-87e09705d322', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5511', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '17042026', NULL, NULL, NULL, '5511', 3172.22, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b16470e2-8917-5f15-92aa-4ba37470ccca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-17', DATE '2026-06-16', 3172.22, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 35). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b16470e2-8917-5f15-92aa-4ba37470ccca', '8013510d-934a-506a-8834-87e09705d322');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b16470e2-8917-5f15-92aa-4ba37470ccca', '8013510d-934a-506a-8834-87e09705d322', DATE '2026-06-16', DATE '2026-06-16', 3172.22, 3172.22, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 36 | apLIS lote 5512 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-16)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5084d3a5-fb44-597e-9983-0b1e1f7373f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5512', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '17042026', NULL, NULL, NULL, '5512', 530.83, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8f97c143-db6b-5289-96c9-cae88a2d919b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-17', DATE '2026-06-16', 530.83, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 36). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8f97c143-db6b-5289-96c9-cae88a2d919b', '5084d3a5-fb44-597e-9983-0b1e1f7373f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8f97c143-db6b-5289-96c9-cae88a2d919b', '5084d3a5-fb44-597e-9983-0b1e1f7373f0', DATE '2026-06-16', DATE '2026-06-16', 530.83, 530.83, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 37 | apLIS lote 5611 | AMHP-DF ("AMHPDF - STM" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5f46c586-344e-5efb-95a2-a1a7dc02eb98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5611', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '29042026', NULL, NULL, NULL, '5611', 2724.30, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('19456a07-d18f-563b-8a9f-9996ba5b9936', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 2724.30, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 37). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('19456a07-d18f-563b-8a9f-9996ba5b9936', '5f46c586-344e-5efb-95a2-a1a7dc02eb98');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('19456a07-d18f-563b-8a9f-9996ba5b9936', '5f46c586-344e-5efb-95a2-a1a7dc02eb98', DATE '2026-06-28', DATE '2026-06-28', 2724.30, 2724.30, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 38 | apLIS lote 4851 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-06-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74d81717-373b-5bd0-b04b-06054cbd46f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4851', DATE '2026-01-15', DATE '2026-04-24', 'Faturado', 3, '24042026', NULL, NULL, NULL, '4851', 1819.67, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cfb13355-30cb-5451-b063-5728cdb5a88b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-24', DATE '2026-06-23', 1819.67, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 38). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cfb13355-30cb-5451-b063-5728cdb5a88b', '74d81717-373b-5bd0-b04b-06054cbd46f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cfb13355-30cb-5451-b063-5728cdb5a88b', '74d81717-373b-5bd0-b04b-06054cbd46f9', DATE '2026-06-23', DATE '2026-06-15', 1819.67, 1819.67, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 39 | apLIS lote 5615 | AMHP-DF ("AMHPDF - FAPES" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('76f3fa90-7099-53f6-8e94-16f3c5420543', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5615', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '29042026', NULL, NULL, NULL, '5615', 1883.01, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('66520844-b1db-5c15-b7d1-a9a6e06a8013', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 1883.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 39). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('66520844-b1db-5c15-b7d1-a9a6e06a8013', '76f3fa90-7099-53f6-8e94-16f3c5420543');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('66520844-b1db-5c15-b7d1-a9a6e06a8013', '76f3fa90-7099-53f6-8e94-16f3c5420543', DATE '2026-06-28', DATE '2026-06-28', 1883.01, 1883.01, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 40 | apLIS lote 5609 | AMHP-DF ("AMHPDF - AFFEGO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-06-02)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0e5e3af3-6626-5d65-9703-a7c5d38acc35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5609', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '29042026', NULL, NULL, NULL, '5609', 1557.43, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dde2e3bd-5fa5-50b8-9da1-1b477f242173', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 1557.43, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 40). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dde2e3bd-5fa5-50b8-9da1-1b477f242173', '0e5e3af3-6626-5d65-9703-a7c5d38acc35');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dde2e3bd-5fa5-50b8-9da1-1b477f242173', '0e5e3af3-6626-5d65-9703-a7c5d38acc35', DATE '2026-06-28', DATE '2026-06-02', 1557.43, 1557.43, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 41 | apLIS lote 5481 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d811483b-0e32-53f6-86af-03c500e110a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5481', DATE '2026-04-15', DATE '2026-04-20', 'Faturado', 3, '20042026', NULL, NULL, NULL, '5481', 17954.48, 61);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-20', DATE '2026-06-19', 17954.48, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 41). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1', 'd811483b-0e32-53f6-86af-03c500e110a2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1', 'd811483b-0e32-53f6-86af-03c500e110a2', DATE '2026-06-19', DATE '2026-08-04', 17954.48, 17954.48, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 42 | apLIS lote 5605 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c12404d-78ad-5a71-a351-a4222d560433', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5605', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '29042026', NULL, NULL, NULL, '5605', 1608.13, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94d2bef5-eb62-5e51-b475-de6c92b7fa5d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 1608.13, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 42). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94d2bef5-eb62-5e51-b475-de6c92b7fa5d', '4c12404d-78ad-5a71-a351-a4222d560433');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('94d2bef5-eb62-5e51-b475-de6c92b7fa5d', '4c12404d-78ad-5a71-a351-a4222d560433', DATE '2026-06-28', DATE '2026-06-28', 1608.13, 1608.13, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 43 | apLIS lote 5436 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-09)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a05e097-a532-5d02-ab41-8010faef25f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5436', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '44681014', NULL, NULL, NULL, '5436', 424.10, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-10', DATE '2026-06-09', 424.10, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 43). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96', '0a05e097-a532-5d02-ab41-8010faef25f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96', '0a05e097-a532-5d02-ab41-8010faef25f0', DATE '2026-06-09', DATE '2026-06-09', 424.10, 424.10, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 44 | apLIS lote 5438 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-09)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('394663d9-0252-51ea-8510-4a71e97d3db1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5438', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '44681024', NULL, NULL, NULL, '5438', 219.35, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6998736a-eb43-571c-989a-41d657b79145', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-10', DATE '2026-06-09', 219.35, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 44). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6998736a-eb43-571c-989a-41d657b79145', '394663d9-0252-51ea-8510-4a71e97d3db1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6998736a-eb43-571c-989a-41d657b79145', '394663d9-0252-51ea-8510-4a71e97d3db1', DATE '2026-06-09', DATE '2026-06-09', 219.35, 219.35, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 45 | apLIS lote 5619 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-06-28)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5a096965-a883-5034-8c18-2735fd9ca531', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5619', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '44687551', NULL, NULL, NULL, '5619', 5273.04, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a1f881c6-55b3-5307-8a3b-2c8902744774', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 5273.04, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 45). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a1f881c6-55b3-5307-8a3b-2c8902744774', '5a096965-a883-5034-8c18-2735fd9ca531');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a1f881c6-55b3-5307-8a3b-2c8902744774', '5a096965-a883-5034-8c18-2735fd9ca531', DATE '2026-06-28', DATE '2026-06-28', 5273.04, 5273.04, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 46 | apLIS lote 5439 | AMHP-DF ("AMPDF - NOTREDAME" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-05-10)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13c37156-c16e-5ff1-b723-6a3bfa471425', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5439', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '44681032', NULL, NULL, NULL, '5439', 254.88, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5c00973-9c74-5655-a653-feb641e0f7d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-10', DATE '2026-05-10', 254.88, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 46). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5c00973-9c74-5655-a653-feb641e0f7d7', '13c37156-c16e-5ff1-b723-6a3bfa471425');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b5c00973-9c74-5655-a653-feb641e0f7d7', '13c37156-c16e-5ff1-b723-6a3bfa471425', DATE '2026-05-10', DATE '2026-05-10', 254.88, 254.88, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 47 | apLIS lote 5614 | AMHP-DF ("AMPDF - NOTREDAME" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → data provável de pagamento (2026-05-29)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('428d568e-9043-5d63-ab96-2aada4f20f6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5614', DATE '2026-04-28', DATE '2026-04-29', 'Faturado', 3, '44687722', NULL, NULL, NULL, '5614', 169.08, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('49ff72be-8770-53f9-8f77-f4aff299d1f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-05-29', 169.08, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 47). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('49ff72be-8770-53f9-8f77-f4aff299d1f4', '428d568e-9043-5d63-ab96-2aada4f20f6e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('49ff72be-8770-53f9-8f77-f4aff299d1f4', '428d568e-9043-5d63-ab96-2aada4f20f6e', DATE '2026-05-29', DATE '2026-05-29', 169.08, 169.08, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 48 | apLIS lote 5440 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-08-04)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('116cf133-6c7f-551d-a5f7-04ddbbaa1338', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5440', DATE '2026-04-10', DATE '2026-04-10', 'Recebido', 4, '44681041', NULL, NULL, NULL, '5440', 317.85, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('099e720c-ef42-5fe8-9685-eabcf3ab2915', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-10', DATE '2026-06-09', 317.85, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 48). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('099e720c-ef42-5fe8-9685-eabcf3ab2915', '116cf133-6c7f-551d-a5f7-04ddbbaa1338');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('099e720c-ef42-5fe8-9685-eabcf3ab2915', '116cf133-6c7f-551d-a5f7-04ddbbaa1338', DATE '2026-06-09', DATE '2026-08-04', 317.85, 317.85, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 49 | apLIS lote 5617 | AMHP-DF ("AMHPDF - OMINT" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-07-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('308bc6bd-9f88-5f24-b44e-b73ae9d2a598', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5617', DATE '2026-04-28', DATE '2026-04-29', 'Recebido', 4, '44687393', NULL, NULL, NULL, '5617', 304.17, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9657bbb9-ce14-5b50-8920-faea67ec9d2a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-29', DATE '2026-06-28', 304.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 49). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9657bbb9-ce14-5b50-8920-faea67ec9d2a', '308bc6bd-9f88-5f24-b44e-b73ae9d2a598');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9657bbb9-ce14-5b50-8920-faea67ec9d2a', '308bc6bd-9f88-5f24-b44e-b73ae9d2a598', DATE '2026-06-28', DATE '2026-07-15', 304.17, 304.17, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 50 | apLIS lote 5443 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-08-17)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('97ab10e2-dad3-5e2b-804b-d0e6a9ad9249', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5443', DATE '2026-04-10', DATE '2026-04-13', 'Faturado', 3, '13042026', NULL, NULL, NULL, '5443', 11954.58, 55);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-13', DATE '2026-06-12', 11954.58, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 50). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', '97ab10e2-dad3-5e2b-804b-d0e6a9ad9249');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', '97ab10e2-dad3-5e2b-804b-d0e6a9ad9249', DATE '2026-06-12', DATE '2026-08-17', 11954.58, 11954.58, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 51 | apLIS lote 5242 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-06-15)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('848e0105-dbd1-5575-a917-a2e4ef1a2461', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5242', DATE '2026-03-20', DATE '2026-04-13', 'Faturado', 3, '13042026', NULL, NULL, NULL, '5242', 4387.63, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-13', DATE '2026-06-12', 4387.63, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 51). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', '848e0105-dbd1-5575-a917-a2e4ef1a2461');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', '848e0105-dbd1-5575-a917-a2e4ef1a2461', DATE '2026-06-12', DATE '2026-06-15', 4387.63, 4387.63, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 52 | apLIS lote 5518 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-08-17)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b0754cc8-5fc5-5405-b0f2-27b8b945236f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5518', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '17042026', NULL, NULL, NULL, '5518', 4070.34, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-17', DATE '2026-06-16', 4070.34, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 52). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', 'b0754cc8-5fc5-5405-b0f2-27b8b945236f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', 'b0754cc8-5fc5-5405-b0f2-27b8b945236f', DATE '2026-06-16', DATE '2026-08-17', 4070.34, 4070.34, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 53 | apLIS lote 4874 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2025-12-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('708a639f-f64b-50df-a304-2748ac321206', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4874', DATE '2026-01-22', DATE '2026-04-24', 'Recebido', 4, '24042026', NULL, NULL, NULL, '4874', 67.86, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-24', DATE '2026-06-23', 67.86, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 53). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6', '708a639f-f64b-50df-a304-2748ac321206');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6', '708a639f-f64b-50df-a304-2748ac321206', DATE '2026-06-23', DATE '2025-12-31', 67.86, 67.86, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 54 | apLIS lote 5607 | AMHP-DF ("AMHPDF - BACEN" na planilha)
-- Data Recebimento na planilha: 'MARCOS ESTAVA TENTANDO DESENVOLVER PELO CLAUDE PARA MELHORAR A BAIXA' → última baixa no apLIS (2026-07-31)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8af79f81-9dd6-5d21-add7-05c4d18552eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5607', DATE '2026-04-28', DATE '2026-04-30', 'Faturado', 3, '30042026', NULL, NULL, NULL, '5607', 6986.32, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-04-30', DATE '2026-06-29', 6986.32, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 54). Responsável: Renata, Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', '8af79f81-9dd6-5d21-add7-05c4d18552eb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', '8af79f81-9dd6-5d21-add7-05c4d18552eb', DATE '2026-06-29', DATE '2026-07-31', 6986.32, 6986.32, 'recebido', 'Renata, Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 55 | apLIS lote 5408 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('58d02138-b1a1-5ce8-8180-85b262434c92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5408', DATE '2026-04-07', DATE '2026-04-09', 'Recebido - parcial', 7, '5690533670', '8025', 8005, DATE '2026-05-15', '5408', 13563.01, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8025', DATE '2026-04-09', DATE '2026-05-09', 13563.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 55). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', '58d02138-b1a1-5ce8-8180-85b262434c92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', '58d02138-b1a1-5ce8-8180-85b262434c92', DATE '2026-05-09', DATE '2026-05-11', 13563.01, 13507.56, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', '58d02138-b1a1-5ce8-8180-85b262434c92', 55.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 56 | apLIS lote 5409 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2772a745-4f44-55cc-b988-3d414d6ca041', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5409', DATE '2026-04-07', DATE '2026-04-09', 'Recebido - parcial', 7, '5690668724', '8025', 8005, DATE '2026-05-15', '5409', 5958.45, 36);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8025', DATE '2026-04-09', DATE '2026-05-09', 5958.45, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 56). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041', DATE '2026-05-09', DATE '2026-05-11', 5958.45, 5321.81, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041', 636.64, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 57 | apLIS lote 5431 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d42fb077-0096-5ffb-9a1e-02d1b2328ed4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5431', DATE '2026-04-09', DATE '2026-04-20', 'Recebido - parcial', 7, '5701556656', '8197', 8177, DATE '2026-05-27', '5431', 1447.82, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8197', DATE '2026-04-20', DATE '2026-05-20', 1447.82, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', DATE '2026-05-20', DATE '2026-05-20', 1447.82, 999.86, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', 447.96, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 58 | apLIS lote 5525 | AMIL
-- lote digitado 5524 → lote real 5525 (pelo protocolo)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b112bb2d-7966-57d9-80d5-4b75eb446674', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5525', DATE '2026-04-20', DATE '2026-04-20', 'Recebido - parcial', 7, '5701563381', '8197', 8177, DATE '2026-05-27', '5525', 7367.80, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8197', DATE '2026-04-20', DATE '2026-05-20', 7367.80, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 58). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674', DATE '2026-05-20', DATE '2026-05-20', 7367.80, 6476.00, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674', 891.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 59 | apLIS lote 5389 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d5f7c34a-de84-5b4e-92b6-7b54af6a1e1b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5389', DATE '2026-04-02', DATE '2026-04-06', 'Recebido', 4, '1357490', '8031', 8011, DATE '2026-07-31', '5389', 7355.52, 39);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87aa194e-46b8-5926-b32a-a90681c62926', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 7355.52, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 59). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87aa194e-46b8-5926-b32a-a90681c62926', 'd5f7c34a-de84-5b4e-92b6-7b54af6a1e1b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('87aa194e-46b8-5926-b32a-a90681c62926', 'd5f7c34a-de84-5b4e-92b6-7b54af6a1e1b', DATE '2026-05-20', DATE '2026-06-08', 7355.52, 7355.52, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 60 | apLIS lote 5393 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9f1c77e6-2196-51eb-b1b9-a6e0181be2d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5393', DATE '2026-04-02', DATE '2026-04-06', 'Recebido', 4, '1357326', '8031', 8011, DATE '2026-07-31', '5393', 430.74, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d67c72a-539c-5801-8b4b-6b81cc178166', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 430.74, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 60). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d67c72a-539c-5801-8b4b-6b81cc178166', '9f1c77e6-2196-51eb-b1b9-a6e0181be2d2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8d67c72a-539c-5801-8b4b-6b81cc178166', '9f1c77e6-2196-51eb-b1b9-a6e0181be2d2', DATE '2026-05-20', DATE '2026-06-08', 430.74, 430.74, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 61 | apLIS lote 5392 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fde81088-95aa-5e68-9b14-04b8ffe1b264', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5392', DATE '2026-04-02', DATE '2026-04-06', 'Faturado', 3, '1357202', '8031', 8011, DATE '2026-07-31', '5392', 1126.00, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 1126.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 61). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', 'fde81088-95aa-5e68-9b14-04b8ffe1b264');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', 'fde81088-95aa-5e68-9b14-04b8ffe1b264', DATE '2026-05-20', DATE '2026-06-08', 1126.00, 808.56, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', 'fde81088-95aa-5e68-9b14-04b8ffe1b264', 317.44, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 62 | apLIS lote 5391 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7ec39d63-f61e-5e43-9f90-edaf370ef833', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5391', DATE '2026-04-02', DATE '2026-04-06', 'Recebido', 4, '1357700', '8031', 8011, DATE '2026-07-31', '5391', 5539.27, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3a433d66-30c9-5f4d-9d8b-01c14c9cb195', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 5539.27, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 62). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3a433d66-30c9-5f4d-9d8b-01c14c9cb195', '7ec39d63-f61e-5e43-9f90-edaf370ef833');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3a433d66-30c9-5f4d-9d8b-01c14c9cb195', '7ec39d63-f61e-5e43-9f90-edaf370ef833', DATE '2026-05-20', DATE '2026-06-08', 5539.27, 5539.27, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 63 | apLIS lote 5390 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b7433d7c-10fe-59a4-b27d-aa86132a28d9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5390', DATE '2026-04-02', DATE '2026-04-06', 'Recebido - parcial', 7, '1357665', '8031', 8011, DATE '2026-07-31', '5390', 9737.41, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 9737.41, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 63). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', 'b7433d7c-10fe-59a4-b27d-aa86132a28d9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', 'b7433d7c-10fe-59a4-b27d-aa86132a28d9', DATE '2026-05-20', DATE '2026-06-08', 9737.41, 9737.41, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 64 | apLIS lote 5388 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('de42c668-380f-54a7-baba-ee965659bcf1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5388', DATE '2026-04-02', DATE '2026-04-06', 'Recebido', 4, '1358045', '8031', 8011, DATE '2026-07-31', '5388', 10484.67, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0300df98-2b79-55a9-855b-6554f0299876', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 10484.67, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 64). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0300df98-2b79-55a9-855b-6554f0299876', 'de42c668-380f-54a7-baba-ee965659bcf1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0300df98-2b79-55a9-855b-6554f0299876', 'de42c668-380f-54a7-baba-ee965659bcf1', DATE '2026-05-20', DATE '2026-06-08', 10484.67, 10484.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 65 | apLIS lote 5387 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('28a6db0f-a7c1-566e-822b-08dd0ba56445', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5387', DATE '2026-04-02', DATE '2026-04-06', 'Recebido - parcial', 7, '1358144', '8031', 8011, DATE '2026-07-31', '5387', 11815.90, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 11815.90, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 65). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', '28a6db0f-a7c1-566e-822b-08dd0ba56445');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', '28a6db0f-a7c1-566e-822b-08dd0ba56445', DATE '2026-05-20', DATE '2026-06-08', 11815.90, 11815.90, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', '28a6db0f-a7c1-566e-822b-08dd0ba56445', 431.14, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- ABRIL linha 66 | apLIS lote 5397 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a9b2ec5b-d5e8-5612-978b-0b707010d18e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5397', DATE '2026-04-06', DATE '2026-04-06', 'Recebido', 4, '1358418', '8031', 8011, DATE '2026-07-31', '5397', 2623.24, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('67d94ab8-f23f-5aa2-ba67-cd387b42bb20', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 2623.24, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 66). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('67d94ab8-f23f-5aa2-ba67-cd387b42bb20', 'a9b2ec5b-d5e8-5612-978b-0b707010d18e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('67d94ab8-f23f-5aa2-ba67-cd387b42bb20', 'a9b2ec5b-d5e8-5612-978b-0b707010d18e', DATE '2026-05-20', DATE '2026-06-08', 2623.24, 2623.24, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 67 | apLIS lote 5398 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7b1501e3-5b0d-5018-8696-e4234a11be2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5398', DATE '2026-04-06', DATE '2026-04-06', 'Recebido', 4, '1358555', '8031', 8011, DATE '2026-07-31', '5398', 75.86, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b18ae45c-6009-5f5c-8de8-7f406a85b33a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 75.86, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 67). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b18ae45c-6009-5f5c-8de8-7f406a85b33a', '7b1501e3-5b0d-5018-8696-e4234a11be2c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b18ae45c-6009-5f5c-8de8-7f406a85b33a', '7b1501e3-5b0d-5018-8696-e4234a11be2c', DATE '2026-05-20', DATE '2026-06-08', 75.86, 75.86, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 68 | apLIS lote 5400 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6ab0c24f-ecb5-5bdd-b781-455242c929aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5400', DATE '2026-04-06', DATE '2026-04-06', 'Recebido', 4, '1358855', '8031', 8011, DATE '2026-07-31', '5400', 1853.21, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cabe659f-7862-5c59-ab21-387f66edb3fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8031', DATE '2026-04-06', DATE '2026-05-20', 1853.21, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 68). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cabe659f-7862-5c59-ab21-387f66edb3fd', '6ab0c24f-ecb5-5bdd-b781-455242c929aa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cabe659f-7862-5c59-ab21-387f66edb3fd', '6ab0c24f-ecb5-5bdd-b781-455242c929aa', DATE '2026-05-20', DATE '2026-06-08', 1853.21, 1853.21, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 69 | apLIS lote 5410 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1cb32a3f-31ae-5002-a47a-459998c53654', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5410', DATE '2026-04-07', DATE '2026-04-07', 'Recebido', 4, '340226616886_0', '8029', 8009, DATE '2026-05-15', '5410', 7911.86, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c5e3b4e2-c48b-5eed-90b5-7dff71512ef4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-04-07', DATE '2026-06-06', 7911.86, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 69). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c5e3b4e2-c48b-5eed-90b5-7dff71512ef4', '1cb32a3f-31ae-5002-a47a-459998c53654');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c5e3b4e2-c48b-5eed-90b5-7dff71512ef4', '1cb32a3f-31ae-5002-a47a-459998c53654', DATE '2026-06-06', DATE '2026-05-12', 7911.86, 7911.86, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 70 | apLIS lote 5414 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
-- Data Recebimento na planilha: 'VERIFICAR' → última baixa no apLIS (2026-04-07)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a7e7d8bd-68bd-5cb0-92f4-bad17f3d64dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5414', DATE '2026-04-07', DATE '2026-04-07', 'Recebido', 4, '340226618466_0', NULL, NULL, NULL, '5414', 1090.52, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('45aaf33e-2450-5323-95ee-34e132e8852f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-04-07', DATE '2026-06-06', 1090.52, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 70). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('45aaf33e-2450-5323-95ee-34e132e8852f', 'a7e7d8bd-68bd-5cb0-92f4-bad17f3d64dd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('45aaf33e-2450-5323-95ee-34e132e8852f', 'a7e7d8bd-68bd-5cb0-92f4-bad17f3d64dd', DATE '2026-06-06', DATE '2026-04-07', 1090.52, 1090.52, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- ABRIL linha 71 | apLIS lote 5346 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('164ae0d3-5531-5b9a-a579-42f25d988959', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5346', DATE '2026-03-31', DATE '2026-04-07', 'Recebido', 4, '340226613189_0', '8195', 8175, DATE '2026-05-27', '5346', 16130.18, 38);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b671d2b4-5239-5fd7-822d-bc2703607851', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-04-07', DATE '2026-06-06', 16130.18, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 71). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b671d2b4-5239-5fd7-822d-bc2703607851', '164ae0d3-5531-5b9a-a579-42f25d988959');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b671d2b4-5239-5fd7-822d-bc2703607851', '164ae0d3-5531-5b9a-a579-42f25d988959', DATE '2026-06-06', DATE '2026-05-18', 16130.18, 16130.18, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 72 | apLIS lote 5345 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f50de018-cd9c-5063-b4b8-c00ddc645225', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5345', DATE '2026-03-31', DATE '2026-04-07', 'Recebido', 4, '341226610540_0', '8039', 8019, DATE '2026-05-18', '5345', 4073.02, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('46a18f72-8b83-551c-aa7b-651dd52e50c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8039', DATE '2026-04-07', DATE '2026-06-06', 4073.02, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 72). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('46a18f72-8b83-551c-aa7b-651dd52e50c3', 'f50de018-cd9c-5063-b4b8-c00ddc645225');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('46a18f72-8b83-551c-aa7b-651dd52e50c3', 'f50de018-cd9c-5063-b4b8-c00ddc645225', DATE '2026-06-06', DATE '2026-05-12', 4073.02, 4073.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 73 | apLIS lote 5350 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e7503ae-e3a1-5305-8bcb-4464e7494276', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5350', DATE '2026-03-31', DATE '2026-04-07', 'Recebido', 4, '341226606768_0', '8294', 8274, DATE '2026-06-05', '5350', 7485.09, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8813505d-4aca-5e40-bea9-f31baecc352c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-04-07', DATE '2026-06-06', 7485.09, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 73). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8813505d-4aca-5e40-bea9-f31baecc352c', '6e7503ae-e3a1-5305-8bcb-4464e7494276');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8813505d-4aca-5e40-bea9-f31baecc352c', '6e7503ae-e3a1-5305-8bcb-4464e7494276', DATE '2026-06-06', DATE '2026-06-02', 7485.09, 7485.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 74 | apLIS lote 5348 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2b472be1-c80d-5dee-9ce4-363a93dcac7d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5348', DATE '2026-03-31', DATE '2026-04-07', 'Recebido', 4, '340226609093_0', '8029', 8009, DATE '2026-05-15', '5348', 1956.23, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f46a764f-c0c9-5358-abfc-8c2872b1577e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-04-07', DATE '2026-06-06', 1956.23, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 74). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f46a764f-c0c9-5358-abfc-8c2872b1577e', '2b472be1-c80d-5dee-9ce4-363a93dcac7d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f46a764f-c0c9-5358-abfc-8c2872b1577e', '2b472be1-c80d-5dee-9ce4-363a93dcac7d', DATE '2026-06-06', DATE '2026-05-12', 1956.23, 1956.23, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 75 | apLIS lote 5305 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('63262bcb-ada7-5653-baba-e3849364496a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5305', DATE '2026-03-25', DATE '2026-04-07', 'Faturado', 3, '341226603170_0', '8294', 8274, DATE '2026-06-05', '5305', 9370.54, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-04-07', DATE '2026-06-06', 9370.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 75). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', '63262bcb-ada7-5653-baba-e3849364496a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', '63262bcb-ada7-5653-baba-e3849364496a', DATE '2026-06-06', DATE '2026-05-12', 9370.54, 9345.03, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', '63262bcb-ada7-5653-baba-e3849364496a', 25.51, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', '63262bcb-ada7-5653-baba-e3849364496a', 0.03, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- ABRIL linha 76 | apLIS lote 5351 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2c43620-4441-52c1-b170-5a2fb939924b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5351', DATE '2026-03-31', DATE '2026-04-07', 'Recebido', 4, '340226606591_0', '8195', 8175, DATE '2026-05-27', '5351', 13719.13, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65bd626d-eecc-537a-8f9c-1dd98913870c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-04-07', DATE '2026-06-06', 13719.13, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 76). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65bd626d-eecc-537a-8f9c-1dd98913870c', 'e2c43620-4441-52c1-b170-5a2fb939924b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('65bd626d-eecc-537a-8f9c-1dd98913870c', 'e2c43620-4441-52c1-b170-5a2fb939924b', DATE '2026-06-06', DATE '2026-05-12', 13719.13, 13719.13, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 77 | apLIS lote 5349 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('71452f64-3e6f-51d7-92ee-59c6bb70b639', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5349', DATE '2026-03-31', DATE '2026-04-07', 'Recebido - parcial', 7, '340226605677_0', '8195', 8175, DATE '2026-05-27', '5349', 13929.54, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('428fd97e-c950-5b2c-b0dd-d6c5cab58955', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-04-07', DATE '2026-06-06', 13929.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 77). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('428fd97e-c950-5b2c-b0dd-d6c5cab58955', '71452f64-3e6f-51d7-92ee-59c6bb70b639');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('428fd97e-c950-5b2c-b0dd-d6c5cab58955', '71452f64-3e6f-51d7-92ee-59c6bb70b639', DATE '2026-06-06', DATE '2026-05-12', 13929.54, 13893.55, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('428fd97e-c950-5b2c-b0dd-d6c5cab58955', '71452f64-3e6f-51d7-92ee-59c6bb70b639', 35.99, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 78 | apLIS lote 5304 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fa8aeeff-f3e1-5e0e-bbf9-368bb102d552', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5304', DATE '2026-03-25', DATE '2026-04-07', 'Recebido', 4, '340226602651_0', '8195', 8175, DATE '2026-05-27', '5304', 33671.40, 71);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b598dac1-f45c-56fd-8a6a-f36c1dbb8ce2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8195', DATE '2026-04-07', DATE '2026-06-06', 33671.40, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 78). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b598dac1-f45c-56fd-8a6a-f36c1dbb8ce2', 'fa8aeeff-f3e1-5e0e-bbf9-368bb102d552');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b598dac1-f45c-56fd-8a6a-f36c1dbb8ce2', 'fa8aeeff-f3e1-5e0e-bbf9-368bb102d552', DATE '2026-06-06', DATE '2026-05-18', 33671.40, 33671.40, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 79 | apLIS lote 5417 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('93a26665-7458-5fe8-950d-c4b9cab8bbb8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5417', DATE '2026-04-08', DATE '2026-04-08', 'Recebido', 4, '340226628621_0', '8029', 8009, DATE '2026-05-15', '5417', 827.19, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f978bc4-329f-5a36-81e7-8b1ff16ad25d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-04-08', DATE '2026-06-07', 827.19, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 79). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f978bc4-329f-5a36-81e7-8b1ff16ad25d', '93a26665-7458-5fe8-950d-c4b9cab8bbb8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3f978bc4-329f-5a36-81e7-8b1ff16ad25d', '93a26665-7458-5fe8-950d-c4b9cab8bbb8', DATE '2026-06-07', DATE '2026-05-12', 827.19, 827.19, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 80 | apLIS lote 5418 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0a9cf86-a80d-5e6b-938c-0a149fb9205a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5418', DATE '2026-04-08', DATE '2026-04-08', 'Recebido', 4, '340226637139_0', '8029', 8009, DATE '2026-05-15', '5418', 289.17, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('729ee772-f346-5017-b1df-33c17efd4411', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8029', DATE '2026-04-08', DATE '2026-06-07', 289.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 80). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('729ee772-f346-5017-b1df-33c17efd4411', 'e0a9cf86-a80d-5e6b-938c-0a149fb9205a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('729ee772-f346-5017-b1df-33c17efd4411', 'e0a9cf86-a80d-5e6b-938c-0a149fb9205a', DATE '2026-06-07', DATE '2026-05-12', 289.17, 289.17, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 81 | apLIS lote 5500 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2bc49749-621a-5ea0-be8f-b237652a338a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5500', DATE '2026-04-16', DATE '2026-04-16', 'Recebido', 4, '340226898484_0', '8282', 8262, DATE '2026-06-02', '5500', 16112.67, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('43993684-42dc-5b8a-94f0-0d3959ec57c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8282', DATE '2026-04-16', DATE '2026-06-15', 16112.67, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 81). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('43993684-42dc-5b8a-94f0-0d3959ec57c0', '2bc49749-621a-5ea0-be8f-b237652a338a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('43993684-42dc-5b8a-94f0-0d3959ec57c0', '2bc49749-621a-5ea0-be8f-b237652a338a', DATE '2026-06-15', DATE '2026-05-27', 16112.67, 16112.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 82 | apLIS lote 5502 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('31466433-3310-53a2-890d-6a1dc9591807', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5502', DATE '2026-04-16', DATE '2026-04-16', 'Faturado', 3, '340226905684_0', '8295', 8275, DATE '2026-06-05', '5502', 17977.20, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2633d56c-ec11-54fd-8842-6c6f04b60e54', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8295', DATE '2026-04-16', DATE '2026-06-15', 17977.20, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 82). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2633d56c-ec11-54fd-8842-6c6f04b60e54', '31466433-3310-53a2-890d-6a1dc9591807');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2633d56c-ec11-54fd-8842-6c6f04b60e54', '31466433-3310-53a2-890d-6a1dc9591807', DATE '2026-06-15', DATE '2026-06-01', 17977.20, 17977.20, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 83 | apLIS lote 5412 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d5978313-29f8-57e6-a914-942e25961ee5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5412', DATE '2026-04-07', DATE '2026-04-16', 'Recebido', 4, '341226908111_0', '8277', 8257, DATE '2026-06-01', '5412', 5311.70, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8277', DATE '2026-04-16', DATE '2026-06-15', 5311.70, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 83). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', 'd5978313-29f8-57e6-a914-942e25961ee5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', 'd5978313-29f8-57e6-a914-942e25961ee5', DATE '2026-06-15', DATE '2026-05-27', 5311.70, 5286.16, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', 'd5978313-29f8-57e6-a914-942e25961ee5', 25.54, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 84 | apLIS lote 5501 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0f45cd9e-8a4c-5ecc-8b61-f42af0f8c4b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5501', DATE '2026-04-16', DATE '2026-04-16', 'Recebido', 4, '341226909270_0', '8277', 8257, DATE '2026-06-01', '5501', 1412.17, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ca8d4565-d9a7-595d-b5d7-7a0455f2af08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8277', DATE '2026-04-16', DATE '2026-06-15', 1412.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 84). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ca8d4565-d9a7-595d-b5d7-7a0455f2af08', '0f45cd9e-8a4c-5ecc-8b61-f42af0f8c4b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ca8d4565-d9a7-595d-b5d7-7a0455f2af08', '0f45cd9e-8a4c-5ecc-8b61-f42af0f8c4b8', DATE '2026-06-15', DATE '2026-05-27', 1412.17, 1412.17, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 85 | apLIS lote 5357 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('24ce0a50-246a-5263-b76e-9e9467b8297a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5357', DATE '2026-04-01', DATE '2026-04-16', 'Recebido', 4, '340226916802_0', '8278', 8258, DATE '2026-06-01', '5357', 1380.91, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c53e2dff-7a91-501b-a837-9f7651597364', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8278', DATE '2026-04-16', DATE '2026-06-15', 1380.91, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 85). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c53e2dff-7a91-501b-a837-9f7651597364', '24ce0a50-246a-5263-b76e-9e9467b8297a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c53e2dff-7a91-501b-a837-9f7651597364', '24ce0a50-246a-5263-b76e-9e9467b8297a', DATE '2026-06-15', DATE '2026-05-27', 1380.91, 1380.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 86 | apLIS lote 5358 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5c96db75-d8a7-5dcd-b976-fc0ac9be1536', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5358', DATE '2026-04-01', DATE '2026-04-16', 'Recebido - parcial', 7, '340226919024_0', '8278', 8258, DATE '2026-06-01', '5358', 3300.53, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8278', DATE '2026-04-16', DATE '2026-06-15', 3300.53, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 86). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', '5c96db75-d8a7-5dcd-b976-fc0ac9be1536');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', '5c96db75-d8a7-5dcd-b976-fc0ac9be1536', DATE '2026-06-15', DATE '2026-05-27', 3300.53, 2827.98, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', '5c96db75-d8a7-5dcd-b976-fc0ac9be1536', 472.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 87 | apLIS lote 5416 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3d00a71d-e405-5a79-b306-810dc27e8021', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5416', DATE '2026-04-07', DATE '2026-04-22', 'Recebido', 4, '340227034963_0', '8301', 8281, DATE '2026-06-08', '5416', 5737.01, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f2679b84-77fd-5ecb-a63d-d1348b405c14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8301', DATE '2026-04-22', DATE '2026-06-21', 5737.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 87). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f2679b84-77fd-5ecb-a63d-d1348b405c14', '3d00a71d-e405-5a79-b306-810dc27e8021');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f2679b84-77fd-5ecb-a63d-d1348b405c14', '3d00a71d-e405-5a79-b306-810dc27e8021', DATE '2026-06-21', DATE '2026-06-30', 5737.01, 5737.01, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 88 | apLIS lote 5352 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7a8e9da5-1a92-5895-b760-05b77698e616', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5352', DATE '2026-03-31', DATE '2026-04-22', 'Recebido - parcial', 7, '341227037261_0', '8313', 8293, DATE '2026-06-10', '5352', 2473.77, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8313', DATE '2026-04-22', DATE '2026-06-21', 2473.77, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 88). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', '7a8e9da5-1a92-5895-b760-05b77698e616');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', '7a8e9da5-1a92-5895-b760-05b77698e616', DATE '2026-06-21', DATE '2026-06-09', 2473.77, 1134.12, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', '7a8e9da5-1a92-5895-b760-05b77698e616', 1134.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 89 | apLIS lote 5507 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d4a8d73-3247-5214-b986-16cc5a56f7a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5507', DATE '2026-04-16', DATE '2026-04-22', 'Recebido - parcial', 7, '340227039890_0', '8295', 8275, DATE '2026-06-05', '5507', 16238.93, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c579ebfc-95ef-5fa0-8ea7-e60463131608', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8295', DATE '2026-04-22', DATE '2026-06-21', 16238.93, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 89). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c579ebfc-95ef-5fa0-8ea7-e60463131608', '0d4a8d73-3247-5214-b986-16cc5a56f7a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c579ebfc-95ef-5fa0-8ea7-e60463131608', '0d4a8d73-3247-5214-b986-16cc5a56f7a5', DATE '2026-06-21', DATE '2026-06-02', 16238.93, 16238.93, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 90 | apLIS lote 5517 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7ba76767-b22a-5694-94ef-dcc11eb146cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5517', DATE '2026-04-17', DATE '2026-04-22', 'Faturado', 3, '340227041855_0', '8295', 8275, DATE '2026-06-05', '5517', 3276.78, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33a71963-7585-5f63-a1f3-3fde053c8cfe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8295', DATE '2026-04-22', DATE '2026-06-21', 3276.78, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 90). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33a71963-7585-5f63-a1f3-3fde053c8cfe', '7ba76767-b22a-5694-94ef-dcc11eb146cb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('33a71963-7585-5f63-a1f3-3fde053c8cfe', '7ba76767-b22a-5694-94ef-dcc11eb146cb', DATE '2026-06-21', DATE '2026-06-02', 3276.78, 3276.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 91 | apLIS lote 5548 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('20d0caa0-b302-5c6a-a5c1-11c55ecf53dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5548', DATE '2026-04-22', DATE '2026-04-22', 'Faturado', 3, '341227042478_0', '8294', 8274, DATE '2026-06-05', '5548', 729.74, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('101ca041-8f44-5439-a71a-4321208b6c7b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8294', DATE '2026-04-22', DATE '2026-06-21', 729.74, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 91). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('101ca041-8f44-5439-a71a-4321208b6c7b', '20d0caa0-b302-5c6a-a5c1-11c55ecf53dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('101ca041-8f44-5439-a71a-4321208b6c7b', '20d0caa0-b302-5c6a-a5c1-11c55ecf53dc', DATE '2026-06-21', DATE '2026-06-02', 729.74, 729.74, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 92 | apLIS lote 5549 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a0c3272-0042-5b0d-8cea-bedbbcdfb6ac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5549', DATE '2026-04-22', DATE '2026-04-22', 'Faturado', 3, '340227046934_0', '8311', 8291, DATE '2026-06-10', '5549', 14531.84, 34);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8311', DATE '2026-04-22', DATE '2026-06-21', 14531.84, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 92). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', '1a0c3272-0042-5b0d-8cea-bedbbcdfb6ac');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', '1a0c3272-0042-5b0d-8cea-bedbbcdfb6ac', DATE '2026-06-21', DATE '2026-06-05', 14531.84, 13261.60, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', '1a0c3272-0042-5b0d-8cea-bedbbcdfb6ac', 1270.24, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 93 | apLIS lote 5550 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('255ad0ec-3399-520f-8950-c7851236ed73', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5550', DATE '2026-04-22', DATE '2026-04-22', 'Recebido', 4, '340227047275_0', '8311', 8291, DATE '2026-06-10', '5550', 359.17, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5d4fd729-32ed-59b2-8bc8-a929208f448f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8311', DATE '2026-04-22', DATE '2026-06-21', 359.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 93). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5d4fd729-32ed-59b2-8bc8-a929208f448f', '255ad0ec-3399-520f-8950-c7851236ed73');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5d4fd729-32ed-59b2-8bc8-a929208f448f', '255ad0ec-3399-520f-8950-c7851236ed73', DATE '2026-06-21', DATE '2026-06-08', 359.17, 359.17, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 94 | apLIS lote 5524 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('befbcace-8f72-5191-bbdc-f4369f0833fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5524', DATE '2026-04-20', DATE '2026-04-22', 'Faturado', 3, '340227048654_0', '8295', 8275, DATE '2026-06-05', '5524', 424.93, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5341a033-9851-5cd3-88d9-83d0f545b34d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8295', DATE '2026-04-22', DATE '2026-06-21', 424.93, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 94). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5341a033-9851-5cd3-88d9-83d0f545b34d', 'befbcace-8f72-5191-bbdc-f4369f0833fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5341a033-9851-5cd3-88d9-83d0f545b34d', 'befbcace-8f72-5191-bbdc-f4369f0833fe', DATE '2026-06-21', DATE '2026-06-02', 424.93, 424.93, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 95 | apLIS lote 5551 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f8c100f0-0823-57ce-9c87-987823df42ce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5551', DATE '2026-04-22', DATE '2026-04-22', 'Recebido - parcial', 7, '340227049158_0', '8943', 8923, DATE '2026-08-07', '5551', 289.17, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('256222b8-c811-5286-b9fe-e7d2375605ff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8943', DATE '2026-04-22', DATE '2026-06-21', 289.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 95). Responsável: Renata. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('256222b8-c811-5286-b9fe-e7d2375605ff', 'f8c100f0-0823-57ce-9c87-987823df42ce');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('256222b8-c811-5286-b9fe-e7d2375605ff', 'f8c100f0-0823-57ce-9c87-987823df42ce', DATE '2026-06-21', DATE '2026-08-04', 289.17, 31.37, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('256222b8-c811-5286-b9fe-e7d2375605ff', 'f8c100f0-0823-57ce-9c87-987823df42ce', 257.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 96 | apLIS lote 5565 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('42f2c49a-dcb1-50e7-81eb-dd38e52a19fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5565', DATE '2026-04-23', DATE '2026-04-23', 'Faturado', 3, '340227072677_0', '8322', 8302, DATE '2026-06-11', '5565', 17260.94, 38);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8322', DATE '2026-04-23', DATE '2026-06-22', 17260.94, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 96). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', '42f2c49a-dcb1-50e7-81eb-dd38e52a19fb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', '42f2c49a-dcb1-50e7-81eb-dd38e52a19fb', DATE '2026-06-22', DATE '2026-06-02', 17260.94, 17257.56, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', '42f2c49a-dcb1-50e7-81eb-dd38e52a19fb', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 97 | apLIS lote 5579 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5f26e6ad-6578-5650-a458-8f82074bff62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5579', DATE '2026-04-27', DATE '2026-04-27', 'Recebido', 4, '340227120296_0', '8322', 8302, DATE '2026-06-11', '5579', 15188.06, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8322', DATE '2026-04-27', DATE '2026-06-26', 15188.06, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 97). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', '5f26e6ad-6578-5650-a458-8f82074bff62');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', '5f26e6ad-6578-5650-a458-8f82074bff62', DATE '2026-06-26', DATE '2026-06-08', 15188.06, 15184.68, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', '5f26e6ad-6578-5650-a458-8f82074bff62', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 98 | apLIS lote 5506 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e7ffa8ca-e015-5749-96bc-1348a11e977d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5506', DATE '2026-04-16', DATE '2026-04-16', 'Recebido - parcial', 7, '340226913858_0', '8278', 8258, DATE '2026-06-01', '5506', 2957.28, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8278', DATE '2026-04-16', DATE '2026-06-15', 2957.28, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 98). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', 'e7ffa8ca-e015-5749-96bc-1348a11e977d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', 'e7ffa8ca-e015-5749-96bc-1348a11e977d', DATE '2026-06-15', DATE '2026-05-27', 2957.28, 2544.85, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', 'e7ffa8ca-e015-5749-96bc-1348a11e977d', 412.43, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 99 | apLIS lote 5306 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('604ec649-d2e1-54d6-860b-c791bc53cebc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5306', DATE '2026-03-25', DATE '2026-04-24', 'Recebido', 4, '340227100488_0', '8301', 8281, DATE '2026-06-08', '5306', 11918.55, 34);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b8eb4a50-fa08-53ac-a9c2-b25f0fc28f49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8301', DATE '2026-04-28', DATE '2026-06-27', 11918.55, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 99). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b8eb4a50-fa08-53ac-a9c2-b25f0fc28f49', '604ec649-d2e1-54d6-860b-c791bc53cebc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b8eb4a50-fa08-53ac-a9c2-b25f0fc28f49', '604ec649-d2e1-54d6-860b-c791bc53cebc', DATE '2026-06-27', DATE '2026-06-05', 11918.55, 11918.55, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 100 | apLIS lote 5411 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e9c850d3-9fe3-57cf-8762-f5b44bc8ca36', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5411', DATE '2026-04-07', DATE '2026-04-16', 'Recebido - parcial', 7, '340226911769_0', '8278', 8258, DATE '2026-06-01', '5411', 19084.66, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8278', DATE '2026-04-16', DATE '2026-06-15', 19084.66, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 100). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', 'e9c850d3-9fe3-57cf-8762-f5b44bc8ca36');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', 'e9c850d3-9fe3-57cf-8762-f5b44bc8ca36', DATE '2026-06-15', DATE '2026-05-27', 19084.66, 19081.28, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', 'e9c850d3-9fe3-57cf-8762-f5b44bc8ca36', 3.38, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 101 | apLIS lote 5578 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0b00c126-9181-5c19-ad7a-adb8d28ece64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5578', DATE '2026-04-27', DATE '2026-04-29', 'Recebido', 4, '340227226977_0', '8322', 8302, DATE '2026-06-11', '5578', 9877.54, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1632665f-0a2e-5942-aa7c-d9475a5fd087', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8322', DATE '2026-04-29', DATE '2026-06-28', 9877.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 101). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1632665f-0a2e-5942-aa7c-d9475a5fd087', '0b00c126-9181-5c19-ad7a-adb8d28ece64');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1632665f-0a2e-5942-aa7c-d9475a5fd087', '0b00c126-9181-5c19-ad7a-adb8d28ece64', DATE '2026-06-28', DATE '2026-06-08', 9877.54, 9877.54, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 102 | apLIS lote 5577 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fb5e854e-dff4-5224-ba38-6d2c04a958f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5577', DATE '2026-04-27', DATE '2026-04-29', 'Faturado', 3, '341227228867_0', '8313', 8293, DATE '2026-06-10', '5577', 9882.66, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a83966d8-a06c-5fff-9ad9-2c44fcda7afd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8313', DATE '2026-04-29', DATE '2026-06-28', 9882.66, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 102). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a83966d8-a06c-5fff-9ad9-2c44fcda7afd', 'fb5e854e-dff4-5224-ba38-6d2c04a958f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a83966d8-a06c-5fff-9ad9-2c44fcda7afd', 'fb5e854e-dff4-5224-ba38-6d2c04a958f0', DATE '2026-06-28', DATE '2026-06-08', 9882.66, 9882.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 103 | apLIS lote 5127 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c0cc5dd-da50-5f3c-813e-770a7b34ea49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5127', DATE '2026-03-02', DATE '2026-04-01', 'Recebido', 4, '276881', NULL, NULL, NULL, '5127', 1042.84, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bc1d7a53-a228-533c-b272-bb193c082314', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-04-01', DATE '2026-05-31', 1042.84, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 103). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bc1d7a53-a228-533c-b272-bb193c082314', '6c0cc5dd-da50-5f3c-813e-770a7b34ea49');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bc1d7a53-a228-533c-b272-bb193c082314', '6c0cc5dd-da50-5f3c-813e-770a7b34ea49', DATE '2026-05-31', DATE '2026-05-05', 1042.84, 1042.84, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 104 | apLIS lote 5360 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7a025c8b-4b91-5242-9381-e3d2467ef034', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5360', DATE '2026-04-01', DATE '2026-04-01', 'Recebido', 4, '276594', '7954', 7934, DATE '2026-06-26', '5360', 23613.31, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f6d5ca8a-5e62-5741-b0fc-79da9988b0d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '7954', DATE '2026-04-01', DATE '2026-05-31', 23613.31, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 104). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f6d5ca8a-5e62-5741-b0fc-79da9988b0d7', '7a025c8b-4b91-5242-9381-e3d2467ef034');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f6d5ca8a-5e62-5741-b0fc-79da9988b0d7', '7a025c8b-4b91-5242-9381-e3d2467ef034', DATE '2026-05-31', DATE '2026-05-05', 23613.31, 23613.31, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 105 | apLIS lote 5343 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f64cf590-41ac-50fe-b11d-ab552056d3e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5343', DATE '2026-03-30', DATE '2026-04-01', 'Recebido - parcial', 7, '226474126', NULL, NULL, NULL, '5343', 14011.51, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 14011.51, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 105). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', 'f64cf590-41ac-50fe-b11d-ab552056d3e3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', 'f64cf590-41ac-50fe-b11d-ab552056d3e3', DATE '2026-05-01', DATE '2026-04-28', 14011.51, 13327.90, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', 'f64cf590-41ac-50fe-b11d-ab552056d3e3', 683.61, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Renata');

-- ABRIL linha 106 | apLIS lote 5342 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eb61443e-2631-5f84-a244-6c7d66b7cfc0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5342', DATE '2026-03-30', DATE '2026-04-01', 'Recebido', 4, '226469775', NULL, NULL, NULL, '5342', 13083.95, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85c71a27-a62f-5a53-8ac6-f7affbf5a3f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 13083.95, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 106). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85c71a27-a62f-5a53-8ac6-f7affbf5a3f6', 'eb61443e-2631-5f84-a244-6c7d66b7cfc0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85c71a27-a62f-5a53-8ac6-f7affbf5a3f6', 'eb61443e-2631-5f84-a244-6c7d66b7cfc0', DATE '2026-05-01', DATE '2026-04-28', 13083.95, 13083.95, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 107 | apLIS lote 4975 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cefb0d38-aac2-5296-b02a-9ba6297cbaeb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4975', DATE '2026-02-05', DATE '2026-04-01', 'Recebido', 4, '226467578', NULL, NULL, NULL, '4975', 3341.46, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8b52f46d-1d06-5254-af6d-884ee307c980', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 3341.46, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 107). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8b52f46d-1d06-5254-af6d-884ee307c980', 'cefb0d38-aac2-5296-b02a-9ba6297cbaeb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8b52f46d-1d06-5254-af6d-884ee307c980', 'cefb0d38-aac2-5296-b02a-9ba6297cbaeb', DATE '2026-05-01', DATE '2026-04-28', 3341.46, 3341.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 108 | apLIS lote 5254 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6b99dcaa-6495-5999-b9c7-26139a9fb855', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5254', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226468075', NULL, NULL, NULL, '5254', 996.54, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 996.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 108). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', '6b99dcaa-6495-5999-b9c7-26139a9fb855');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', '6b99dcaa-6495-5999-b9c7-26139a9fb855', DATE '2026-05-01', DATE '2026-04-28', 996.54, 996.53, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', '6b99dcaa-6495-5999-b9c7-26139a9fb855', 0.01, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 109 | apLIS lote 5188 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9f386283-76a6-5be0-9371-17d224b861a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5188', DATE '2026-03-11', DATE '2026-04-01', 'Recebido - parcial', 7, '226467550', NULL, NULL, NULL, '5188', 8783.38, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0a450eb7-0471-57e9-99a6-8ae8013aea4d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 8783.38, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 109). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0a450eb7-0471-57e9-99a6-8ae8013aea4d', '9f386283-76a6-5be0-9371-17d224b861a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0a450eb7-0471-57e9-99a6-8ae8013aea4d', '9f386283-76a6-5be0-9371-17d224b861a5', DATE '2026-05-01', DATE '2026-04-28', 8783.38, 8783.38, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 110 | apLIS lote 5247 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2fc5be67-8a0a-5eb6-a0f9-70fb064a95cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5247', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226467228', NULL, NULL, NULL, '5247', 8162.64, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 8162.64, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 110). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', '2fc5be67-8a0a-5eb6-a0f9-70fb064a95cf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', '2fc5be67-8a0a-5eb6-a0f9-70fb064a95cf', DATE '2026-05-01', DATE '2026-04-28', 8162.64, 7479.03, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', '2fc5be67-8a0a-5eb6-a0f9-70fb064a95cf', 683.61, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 111 | apLIS lote 5341 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13c5a6f2-f61a-5183-9076-58a314cb434a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5341', DATE '2026-03-30', DATE '2026-04-01', 'Recebido - parcial', 7, '226478009', NULL, NULL, NULL, '5341', 13030.20, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 13030.20, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 111). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', '13c5a6f2-f61a-5183-9076-58a314cb434a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', '13c5a6f2-f61a-5183-9076-58a314cb434a', DATE '2026-05-01', DATE '2026-04-28', 13030.20, 12118.72, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', '13c5a6f2-f61a-5183-9076-58a314cb434a', 911.48, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Renata');

-- ABRIL linha 112 | apLIS lote 5249 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('217fdbef-19c8-5f73-b4ff-54b59e6ab741', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5249', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226480353', NULL, NULL, NULL, '5249', 13770.17, 47);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 13770.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 112). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', '217fdbef-19c8-5f73-b4ff-54b59e6ab741');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', '217fdbef-19c8-5f73-b4ff-54b59e6ab741', DATE '2026-05-01', DATE '2026-04-28', 13770.17, 13542.30, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', '217fdbef-19c8-5f73-b4ff-54b59e6ab741', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 113 | apLIS lote 5252 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9ada26c7-4897-5ebd-9823-f9b03014a6a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5252', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226486711', NULL, NULL, NULL, '5252', 8598.75, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 8598.75, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 113). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', '9ada26c7-4897-5ebd-9823-f9b03014a6a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', '9ada26c7-4897-5ebd-9823-f9b03014a6a5', DATE '2026-05-01', DATE '2026-04-28', 8598.75, 8370.88, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', '9ada26c7-4897-5ebd-9823-f9b03014a6a5', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 114 | apLIS lote 5248 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc84f6f5-232d-5742-be56-0423dbcb8d1f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5248', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226490118', NULL, NULL, NULL, '5248', 14779.52, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 14779.52, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 114). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', 'bc84f6f5-232d-5742-be56-0423dbcb8d1f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', 'bc84f6f5-232d-5742-be56-0423dbcb8d1f', DATE '2026-05-01', DATE '2026-04-28', 14779.52, 13868.04, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', 'bc84f6f5-232d-5742-be56-0423dbcb8d1f', 911.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 115 | apLIS lote 5362 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f441440b-b455-506e-94dd-a10f255889db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5362', DATE '2026-04-01', DATE '2026-04-01', 'Recebido - parcial', 7, '226500861', NULL, NULL, NULL, '5362', 8000.38, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 8000.38, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 115). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', 'f441440b-b455-506e-94dd-a10f255889db');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', 'f441440b-b455-506e-94dd-a10f255889db', DATE '2026-05-01', DATE '2026-04-28', 8000.38, 7544.64, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', 'f441440b-b455-506e-94dd-a10f255889db', 455.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 116 | apLIS lote 5255 | CASSI-PER ("CASSI" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a5a0bb9b-e90e-5a3e-8580-b5cab0c2f09b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1098'), '5255', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226497270', NULL, NULL, NULL, '5255', 99.90, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1098'), NULL, DATE '2026-04-01', DATE '2026-05-01', 99.90, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 116). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', 'a5a0bb9b-e90e-5a3e-8580-b5cab0c2f09b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', 'a5a0bb9b-e90e-5a3e-8580-b5cab0c2f09b', DATE '2026-05-01', DATE '2026-04-28', 99.90, 66.60, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', 'a5a0bb9b-e90e-5a3e-8580-b5cab0c2f09b', 33.30, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 117 | apLIS lote 5253 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5253', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226496868', NULL, NULL, NULL, '5253', 2107.62, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 2107.62, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 117). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', '6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', '6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2', DATE '2026-05-01', DATE '2026-04-28', 2107.62, 1889.82, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', '6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2', 217.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 118 | apLIS lote 5250 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a4a974b5-d518-50e4-9b3b-94ad2d7a6340', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5250', DATE '2026-03-20', DATE '2026-04-01', 'Recebido', 4, '226496287', NULL, NULL, NULL, '5250', 14733.06, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1a6e626e-03d4-5bc6-af3d-5eb90ef7ed1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 14733.06, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 118). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1a6e626e-03d4-5bc6-af3d-5eb90ef7ed1d', 'a4a974b5-d518-50e4-9b3b-94ad2d7a6340');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1a6e626e-03d4-5bc6-af3d-5eb90ef7ed1d', 'a4a974b5-d518-50e4-9b3b-94ad2d7a6340', DATE '2026-05-01', DATE '2026-04-28', 14733.06, 14733.06, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 120 | apLIS lote 5251 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c9fe6d13-1aad-5906-a389-d0188b1ea63d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5251', DATE '2026-03-20', DATE '2026-04-01', 'Recebido - parcial', 7, '226492128', NULL, NULL, NULL, '5251', 16250.29, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 16250.29, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 120). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', 'c9fe6d13-1aad-5906-a389-d0188b1ea63d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', 'c9fe6d13-1aad-5906-a389-d0188b1ea63d', DATE '2026-05-01', DATE '2026-04-28', 16250.29, 15338.81, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', 'c9fe6d13-1aad-5906-a389-d0188b1ea63d', 911.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 121 | apLIS lote 5365 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c61d8aca-60fe-53f7-a081-bba6aab34382', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5365', DATE '2026-04-01', DATE '2026-04-01', 'Recebido - parcial', 7, '226504789', NULL, NULL, NULL, '5365', 4761.06, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-04-01', DATE '2026-05-01', 4761.06, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 121). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', 'c61d8aca-60fe-53f7-a081-bba6aab34382');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', 'c61d8aca-60fe-53f7-a081-bba6aab34382', DATE '2026-05-01', DATE '2026-04-28', 4761.06, 4026.04, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', 'c61d8aca-60fe-53f7-a081-bba6aab34382', 735.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 122 | apLIS lote 5367 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2ec7009f-a6c1-5554-9bee-8813f3e7c877', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5367', DATE '2026-04-01', DATE '2026-04-08', 'Recebido', 4, '226653013', '7985', 7965, DATE '2026-07-31', '5367', 2598.24, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('73f20136-b4f0-517a-bbe1-2b183da462b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '7985', DATE '2026-04-08', DATE '2026-05-08', 2598.24, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 122). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('73f20136-b4f0-517a-bbe1-2b183da462b0', '2ec7009f-a6c1-5554-9bee-8813f3e7c877');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('73f20136-b4f0-517a-bbe1-2b183da462b0', '2ec7009f-a6c1-5554-9bee-8813f3e7c877', DATE '2026-05-08', DATE '2026-05-13', 2598.24, 2598.24, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 123 | apLIS lote 5420 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6764bccf-01c9-5bf2-90d9-74a2c9755c9f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5420', DATE '2026-04-08', DATE '2026-04-08', 'Recebido - parcial', 7, '226652419', '7985', 7965, DATE '2026-07-31', '5420', 18121.80, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '7985', DATE '2026-04-08', DATE '2026-05-08', 18121.80, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 123). Responsável: Renata. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', '6764bccf-01c9-5bf2-90d9-74a2c9755c9f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', '6764bccf-01c9-5bf2-90d9-74a2c9755c9f', DATE '2026-05-08', DATE '2026-05-13', 18121.80, 17893.93, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', '6764bccf-01c9-5bf2-90d9-74a2c9755c9f', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 124 | apLIS lote 5477 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('97b65593-3af3-5f0f-ad37-b2d4893c255d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5477', DATE '2026-04-14', DATE '2026-04-14', 'Recebido - parcial', 7, '226832804', '8003', 7983, DATE '2026-05-11', '5477', 26266.01, 82);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-14', DATE '2026-05-14', 26266.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 124). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', '97b65593-3af3-5f0f-ad37-b2d4893c255d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', '97b65593-3af3-5f0f-ad37-b2d4893c255d', DATE '2026-05-14', DATE '2026-05-13', 26266.01, 25582.40, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', '97b65593-3af3-5f0f-ad37-b2d4893c255d', 683.61, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 125 | apLIS lote 5476 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e0c140e-620f-540e-9355-c2ac441632be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5476', DATE '2026-04-14', DATE '2026-04-15', 'Recebido - parcial', 7, '226857923', '8003', 7983, DATE '2026-05-11', '5476', 20960.87, 69);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-15', 20960.87, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 125). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', '7e0c140e-620f-540e-9355-c2ac441632be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', '7e0c140e-620f-540e-9355-c2ac441632be', DATE '2026-05-15', DATE '2026-05-13', 20960.87, 20960.87, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', '7e0c140e-620f-540e-9355-c2ac441632be', 455.74, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- ABRIL linha 126 | apLIS lote 5483 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7d59af60-cf09-516a-ae02-a38a7dc6e0ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5483', DATE '2026-04-15', DATE '2026-04-15', 'Recebido - parcial', 7, '226862009', '8003', 7983, DATE '2026-05-11', '5483', 1809.88, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-15', 1809.88, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 126). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef', DATE '2026-05-15', DATE '2026-05-13', 1809.88, 1483.17, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef', 326.71, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Renata');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef', 829.75, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- ABRIL linha 127 | apLIS lote 5012 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('04d6e22c-3319-5fc7-8b34-470f1c3e0cbd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5012', DATE '2026-02-12', DATE '2026-04-15', 'Faturado', 3, '226862322', '8003', 7983, DATE '2026-05-11', '5012', 1053.38, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-15', 1053.38, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 127). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a', '04d6e22c-3319-5fc7-8b34-470f1c3e0cbd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a', '04d6e22c-3319-5fc7-8b34-470f1c3e0cbd', DATE '2026-05-15', DATE '2026-05-13', 1053.38, 1053.36, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 128 | apLIS lote 5484 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d866eaf-48de-5ecc-805f-9e962cbf136d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5484', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, '226863038', '8003', 7983, DATE '2026-05-11', '5484', 784.78, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bc6b3381-b143-5de0-9dd7-376b30a48aba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-15', 784.78, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 128). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bc6b3381-b143-5de0-9dd7-376b30a48aba', '0d866eaf-48de-5ecc-805f-9e962cbf136d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bc6b3381-b143-5de0-9dd7-376b30a48aba', '0d866eaf-48de-5ecc-805f-9e962cbf136d', DATE '2026-05-15', DATE '2026-05-13', 784.78, 784.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 129 | apLIS lote 5485 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8a7a0486-45d0-5188-af20-02413fbe2ba7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5485', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, '226863637', '8003', 7983, DATE '2026-05-11', '5485', 556.91, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a196c66a-5570-58a5-9b59-9b54c111b9a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-01', 556.91, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 129). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a196c66a-5570-58a5-9b59-9b54c111b9a0', '8a7a0486-45d0-5188-af20-02413fbe2ba7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a196c66a-5570-58a5-9b59-9b54c111b9a0', '8a7a0486-45d0-5188-af20-02413fbe2ba7', DATE '2026-05-01', DATE '2026-05-13', 556.91, 556.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 130 | apLIS lote 5479 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ba9cb33c-ee9b-59a1-ac9b-5aca4633ca9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5479', DATE '2026-04-15', DATE '2026-04-15', 'Recebido - parcial', 7, '226864813', '8003', 7983, DATE '2026-05-11', '5479', 3398.16, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c9da1d20-ff49-590a-a413-fd8174ae3dd8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-01', 3398.16, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 130). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c9da1d20-ff49-590a-a413-fd8174ae3dd8', 'ba9cb33c-ee9b-59a1-ac9b-5aca4633ca9a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c9da1d20-ff49-590a-a413-fd8174ae3dd8', 'ba9cb33c-ee9b-59a1-ac9b-5aca4633ca9a', DATE '2026-05-01', DATE '2026-05-13', 3398.16, 3398.15, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 131 | apLIS lote 5364 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('439d8249-5f63-59e6-a9d9-a8a8c793062d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5364', DATE '2026-04-01', DATE '2026-04-15', 'Recebido', 4, '226867220', '8003', 7983, DATE '2026-05-11', '5364', 556.91, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('da39b1b4-4425-5277-862a-b1a07a4404c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8003', DATE '2026-04-15', DATE '2026-05-01', 556.91, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 131). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('da39b1b4-4425-5277-862a-b1a07a4404c8', '439d8249-5f63-59e6-a9d9-a8a8c793062d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('da39b1b4-4425-5277-862a-b1a07a4404c8', '439d8249-5f63-59e6-a9d9-a8a8c793062d', DATE '2026-05-01', DATE '2026-05-13', 556.91, 556.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 132 | apLIS lote 5069 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('477218e4-e786-5d5e-a047-304009b94620', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5069', DATE '2026-02-25', DATE '2026-04-30', 'Faturado', 3, '2511171002238642918', '8184', 8164, DATE '2026-07-31', '5069', 1201.85, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8184', DATE '2026-04-30', DATE '2026-05-30', 1201.85, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 132). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044', '477218e4-e786-5d5e-a047-304009b94620');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044', '477218e4-e786-5d5e-a047-304009b94620', DATE '2026-05-30', DATE '2026-06-11', 1201.85, 831.04, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044', '477218e4-e786-5d5e-a047-304009b94620', 370.81, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 133 | apLIS lote 5635 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7efd9414-7aad-5b70-92bc-2c36f7adf0ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5635', DATE '2026-04-30', DATE '2026-04-30', 'Recebido - parcial', 7, '2604301733128012918', '8184', 8164, DATE '2026-07-31', '5635', 2055.34, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8184', DATE '2026-04-30', DATE '2026-05-30', 2055.34, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 133). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f', '7efd9414-7aad-5b70-92bc-2c36f7adf0ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f', '7efd9414-7aad-5b70-92bc-2c36f7adf0ed', DATE '2026-05-30', DATE '2026-06-11', 2055.34, 468.32, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f', '7efd9414-7aad-5b70-92bc-2c36f7adf0ed', 1587.02, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 134 | apLIS lote 5574 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('94a105f2-3bd4-5928-af22-1c8b678e8444', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5574', DATE '2026-04-24', DATE '2026-04-27', 'Recebido', 4, '808934', '8246', 8226, DATE '2026-07-31', '5574', 18052.01, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ccb88914-7fb1-5248-a86a-3e635de25f6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8246', DATE '2026-04-27', DATE '2026-06-26', 18052.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 134). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ccb88914-7fb1-5248-a86a-3e635de25f6b', '94a105f2-3bd4-5928-af22-1c8b678e8444');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ccb88914-7fb1-5248-a86a-3e635de25f6b', '94a105f2-3bd4-5928-af22-1c8b678e8444', DATE '2026-06-26', DATE '2026-06-19', 18052.01, 18052.01, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 135 | apLIS lote 5320 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
-- Data Recebimento '16/06/0206' → ano 2026
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('44ecdebd-088f-55e7-92c4-79ece5da1f7b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5320', DATE '2026-03-27', DATE '2026-04-28', 'Recebido', 4, '809064', '8246', 8226, DATE '2026-07-31', '5320', 3865.62, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4ea2f52b-d885-55eb-8913-234da7f984fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8246', DATE '2026-04-28', DATE '2026-06-27', 3865.62, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 135). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4ea2f52b-d885-55eb-8913-234da7f984fc', '44ecdebd-088f-55e7-92c4-79ece5da1f7b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4ea2f52b-d885-55eb-8913-234da7f984fc', '44ecdebd-088f-55e7-92c4-79ece5da1f7b', DATE '2026-06-27', DATE '2026-06-16', 3865.62, 3656.80, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4ea2f52b-d885-55eb-8913-234da7f984fc', '44ecdebd-088f-55e7-92c4-79ece5da1f7b', 208.82, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 136 | apLIS lote 5603 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed27e04a-3d16-56b4-a355-f15c6cc7468d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5603', DATE '2026-04-28', DATE '2026-04-28', 'Recebido', 4, '809177', '8246', 8226, DATE '2026-07-31', '5603', 1436.11, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('583016ab-620e-565c-bc42-2bc2629c7324', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8246', DATE '2026-04-28', DATE '2026-06-27', 1436.11, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 136). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('583016ab-620e-565c-bc42-2bc2629c7324', 'ed27e04a-3d16-56b4-a355-f15c6cc7468d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('583016ab-620e-565c-bc42-2bc2629c7324', 'ed27e04a-3d16-56b4-a355-f15c6cc7468d', DATE '2026-06-27', DATE '2026-06-19', 1436.11, 1436.11, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 137 | apLIS lote 5380 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('75b2a678-213a-5253-86e2-85eb70cc41d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5380', DATE '2026-04-02', DATE '2026-04-02', 'Recebido - parcial', 7, '669435', '7979', 7959, DATE '2026-05-05', '5380', 1929.80, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '7979', DATE '2026-04-02', DATE '2026-05-07', 1929.80, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 137). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', '75b2a678-213a-5253-86e2-85eb70cc41d5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', '75b2a678-213a-5253-86e2-85eb70cc41d5', DATE '2026-05-07', DATE '2026-05-15', 1929.80, 1768.87, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', '75b2a678-213a-5253-86e2-85eb70cc41d5', 160.93, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 138 | apLIS lote 5401 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('73e401cc-d7b0-5d49-962b-9e358a6c5ab2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5401', DATE '2026-04-06', DATE '2026-04-06', 'Recebido - parcial', 7, '187383', NULL, NULL, NULL, '5401', 755.72, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-04-06', DATE '2026-05-04', 755.72, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 138). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', '73e401cc-d7b0-5d49-962b-9e358a6c5ab2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', '73e401cc-d7b0-5d49-962b-9e358a6c5ab2', DATE '2026-05-04', DATE '2026-05-22', 755.72, 599.55, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', '73e401cc-d7b0-5d49-962b-9e358a6c5ab2', 156.17, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 139 | apLIS lote 5372 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5372', DATE '2026-04-01', DATE '2026-04-02', 'Faturado', 3, '187377', NULL, NULL, NULL, '5372', 1623.98, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-04-06', DATE '2026-05-04', 1623.98, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 139). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', 'cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', 'cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28', DATE '2026-05-04', DATE '2026-05-22', 1623.98, 1482.56, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', 'cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28', 141.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 140 | apLIS lote 5375 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61281ccc-a08e-5ec4-a863-c03f5c285123', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5375', DATE '2026-04-01', DATE '2026-04-06', 'Recebido - parcial', 7, '187371', NULL, NULL, NULL, '5375', 4342.79, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-04-07', DATE '2026-05-05', 4342.79, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 140). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', '61281ccc-a08e-5ec4-a863-c03f5c285123');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', '61281ccc-a08e-5ec4-a863-c03f5c285123', DATE '2026-05-05', DATE '2026-05-22', 4342.79, 4207.04, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', '61281ccc-a08e-5ec4-a863-c03f5c285123', 135.75, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 141 | apLIS lote 5143 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80f0b85a-18af-5ee3-a06a-054c0749ce93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5143', DATE '2026-03-03', DATE '2026-04-07', 'Em Processamento', 1, 'PEG20260407114902', '8037', 8017, DATE '2026-07-31', '5143', 1198.42, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '8037', DATE '2026-04-07', DATE '2026-06-06', 1198.42, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 141). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', '80f0b85a-18af-5ee3-a06a-054c0749ce93');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', '80f0b85a-18af-5ee3-a06a-054c0749ce93', DATE '2026-06-06', DATE '2026-06-17', 1198.42, 1110.30, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', '80f0b85a-18af-5ee3-a06a-054c0749ce93', 88.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 142 | apLIS lote 5405 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c1c0855e-2df7-5d62-8ed1-55fe3c8f1c70', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5405', DATE '2026-04-07', DATE '2026-04-20', 'Recebido', 4, '20260420140920', NULL, 8016, DATE '2026-07-31', '5405', 882.30, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('866566f7-8509-5ce1-8ea6-eb87024e997d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-04-20', DATE '2026-06-19', 882.30, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 142). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('866566f7-8509-5ce1-8ea6-eb87024e997d', 'c1c0855e-2df7-5d62-8ed1-55fe3c8f1c70');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('866566f7-8509-5ce1-8ea6-eb87024e997d', 'c1c0855e-2df7-5d62-8ed1-55fe3c8f1c70', DATE '2026-06-19', DATE '2026-06-17', 882.30, 882.30, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 143 | apLIS lote 5526 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9d130e75-96ca-585c-8903-7f0275757b3d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5526', DATE '2026-04-20', DATE '2026-04-28', 'Recebido', 4, '20260428160909', '8411', 8391, DATE '2026-08-31', '5526', 131.60, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a440834a-febc-5dcc-bd72-614b692b1e5a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '8411', DATE '2026-04-28', DATE '2026-06-27', 131.60, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 143). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a440834a-febc-5dcc-bd72-614b692b1e5a', '9d130e75-96ca-585c-8903-7f0275757b3d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a440834a-febc-5dcc-bd72-614b692b1e5a', '9d130e75-96ca-585c-8903-7f0275757b3d', DATE '2026-06-27', DATE '2026-07-08', 131.60, 131.60, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 144 | apLIS lote 3781 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6741a6fa-901a-5085-b4a7-53f1b0bcec47', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '3781', DATE '2025-03-28', DATE '2026-04-01', 'Recebido', 4, '139332052', '8708', 8688, DATE '2026-07-16', '3781', 18613.74, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8708', DATE '2026-04-02', DATE '2026-07-01', 18613.74, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 144). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', '6741a6fa-901a-5085-b4a7-53f1b0bcec47');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', '6741a6fa-901a-5085-b4a7-53f1b0bcec47', DATE '2026-07-01', DATE '2026-08-20', 18613.74, 18604.33, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', '6741a6fa-901a-5085-b4a7-53f1b0bcec47', 9.41, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 145 | apLIS lote 5355 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ada0a0b6-2a93-560b-bff0-aeb336ffedab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5355', DATE '2026-03-31', DATE '2026-04-02', 'Recebido', 4, '139832972', '8708', 8688, DATE '2026-07-16', '5355', 1177.74, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c8f9880a-1180-5b1f-88f8-757ab25c7771', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8708', DATE '2026-04-02', DATE '2026-07-01', 1177.74, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 145). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c8f9880a-1180-5b1f-88f8-757ab25c7771', 'ada0a0b6-2a93-560b-bff0-aeb336ffedab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c8f9880a-1180-5b1f-88f8-757ab25c7771', 'ada0a0b6-2a93-560b-bff0-aeb336ffedab', DATE '2026-07-01', DATE '2026-08-20', 1177.74, 1177.74, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 146 | apLIS lote 5354 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c1a0b488-bbcb-5ff5-a300-b1c1f91bdefc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5354', DATE '2026-03-31', DATE '2026-04-06', 'Recebido', 4, '143181136', '8708', 8688, DATE '2026-07-16', '5354', 18990.60, 62);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8708', DATE '2026-04-10', DATE '2026-07-09', 18990.60, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 146). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', 'c1a0b488-bbcb-5ff5-a300-b1c1f91bdefc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', 'c1a0b488-bbcb-5ff5-a300-b1c1f91bdefc', DATE '2026-07-09', DATE '2026-08-20', 18990.60, 18895.94, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', 'c1a0b488-bbcb-5ff5-a300-b1c1f91bdefc', 94.66, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 147 | apLIS lote 5442 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4beea868-3151-5917-a913-22d0f609e197', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5442', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, 'PEG166517', '8433', 8413, DATE '2026-09-30', '5442', 12389.66, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05dc8a15-8eb3-5921-a5fd-364984b166d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-10', DATE '2026-05-10', 12389.66, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 147). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05dc8a15-8eb3-5921-a5fd-364984b166d4', '4beea868-3151-5917-a913-22d0f609e197');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('05dc8a15-8eb3-5921-a5fd-364984b166d4', '4beea868-3151-5917-a913-22d0f609e197', DATE '2026-05-10', 12389.66, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 148 | apLIS lote 5441 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('244ded02-0d73-53a9-9937-a00c56abcfbf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5441', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, 'PEG166537', '8433', 8413, DATE '2026-09-30', '5441', 8604.82, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a6ca82f2-f175-5a83-b8c5-9ceb7f4a8f0a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-10', DATE '2026-05-10', 8604.82, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 148). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a6ca82f2-f175-5a83-b8c5-9ceb7f4a8f0a', '244ded02-0d73-53a9-9937-a00c56abcfbf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a6ca82f2-f175-5a83-b8c5-9ceb7f4a8f0a', '244ded02-0d73-53a9-9937-a00c56abcfbf', DATE '2026-05-10', 8604.82, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 149 | apLIS lote 5444 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0bd76b45-5537-5bb8-bde9-bfc1469631ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5444', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, 'PEG166558', '8433', 8413, DATE '2026-09-30', '5444', 131.01, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('290cd09f-793c-52bf-bdaf-c0c337aa621c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-10', DATE '2026-05-10', 131.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 149). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('290cd09f-793c-52bf-bdaf-c0c337aa621c', '0bd76b45-5537-5bb8-bde9-bfc1469631ab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('290cd09f-793c-52bf-bdaf-c0c337aa621c', '0bd76b45-5537-5bb8-bde9-bfc1469631ab', DATE '2026-05-10', 131.01, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 150 | apLIS lote 5324 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce4f2a73-f0c9-579d-9be5-5a4f6f6bb7ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5324', DATE '2026-03-27', DATE '2026-04-10', 'Faturado', 3, 'PEG166563', NULL, NULL, NULL, '5324', 179.50, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63a22f21-e6e6-58f3-bff6-d33c453ad1fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-04-10', DATE '2026-05-10', 179.50, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 150). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63a22f21-e6e6-58f3-bff6-d33c453ad1fc', 'ce4f2a73-f0c9-579d-9be5-5a4f6f6bb7ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('63a22f21-e6e6-58f3-bff6-d33c453ad1fc', 'ce4f2a73-f0c9-579d-9be5-5a4f6f6bb7ad', DATE '2026-05-10', 179.50, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 151 | apLIS lote 5445 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3542278d-6786-5e4e-88e7-7cf40f6cbb0d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5445', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, 'PEG166567', '8433', 8413, DATE '2026-09-30', '5445', 2116.07, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0e32e6f5-1832-5a70-98e6-2091ca693062', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-10', DATE '2026-05-10', 2116.07, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 151). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0e32e6f5-1832-5a70-98e6-2091ca693062', '3542278d-6786-5e4e-88e7-7cf40f6cbb0d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0e32e6f5-1832-5a70-98e6-2091ca693062', '3542278d-6786-5e4e-88e7-7cf40f6cbb0d', DATE '2026-05-10', 2116.07, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 152 | apLIS lote 5515 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0de3675-6cc6-58c5-8a7c-d199c9b2f5f2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5515', DATE '2026-04-17', DATE '2026-04-23', 'Faturado', 3, 'PEG169148', '8433', 8413, DATE '2026-09-30', '5515', 3833.41, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2d113455-d36f-5746-92d2-dc087d2eed8e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-23', DATE '2026-05-23', 3833.41, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 152). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2d113455-d36f-5746-92d2-dc087d2eed8e', 'e0de3675-6cc6-58c5-8a7c-d199c9b2f5f2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2d113455-d36f-5746-92d2-dc087d2eed8e', 'e0de3675-6cc6-58c5-8a7c-d199c9b2f5f2', DATE '2026-05-23', 3833.41, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 153 | apLIS lote 5496 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a4be6236-65fe-5f32-89e3-47ca3ac130c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5496', DATE '2026-04-16', DATE '2026-04-23', 'Faturado', 3, 'PEG169146', NULL, NULL, NULL, '5496', 2042.70, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c5f2156d-dc3f-5277-98be-956c1b0f9e9c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-04-23', DATE '2026-05-23', 2042.70, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 153). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c5f2156d-dc3f-5277-98be-956c1b0f9e9c', 'a4be6236-65fe-5f32-89e3-47ca3ac130c3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c5f2156d-dc3f-5277-98be-956c1b0f9e9c', 'a4be6236-65fe-5f32-89e3-47ca3ac130c3', DATE '2026-05-23', 2042.70, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 154 | apLIS lote 5495 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0358cffb-4d48-5d86-ab19-37b5ebd6eb0e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5495', DATE '2026-04-16', DATE '2026-04-23', 'Faturado', 3, 'PEG169179', '8433', 8413, DATE '2026-09-30', '5495', 8649.30, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b2afb3fb-b1eb-5e92-9290-6252ea937471', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-23', DATE '2026-05-23', 8649.30, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 154). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b2afb3fb-b1eb-5e92-9290-6252ea937471', '0358cffb-4d48-5d86-ab19-37b5ebd6eb0e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b2afb3fb-b1eb-5e92-9290-6252ea937471', '0358cffb-4d48-5d86-ab19-37b5ebd6eb0e', DATE '2026-05-23', 8649.30, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 155 | apLIS lote 5494 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b441cd1e-737d-5a82-b3f4-5006ce3b96fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5494', DATE '2026-04-16', DATE '2026-04-16', 'Faturado', 3, 'PEG169183', '8433', 8413, DATE '2026-09-30', '5494', 11005.62, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dd307c2e-088c-56f1-b3ba-dc5edc0ae5aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-23', DATE '2026-05-23', 11005.62, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 155). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dd307c2e-088c-56f1-b3ba-dc5edc0ae5aa', 'b441cd1e-737d-5a82-b3f4-5006ce3b96fd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('dd307c2e-088c-56f1-b3ba-dc5edc0ae5aa', 'b441cd1e-737d-5a82-b3f4-5006ce3b96fd', DATE '2026-05-23', 11005.62, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 156 | apLIS lote 5568 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b3b5a9bd-f04c-5dc1-a017-a6ca1b085e22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5568', DATE '2026-04-23', DATE '2026-04-23', 'Faturado', 3, 'PEG169223', NULL, NULL, NULL, '5568', 588.35, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-04-24', DATE '2026-05-23', 588.35, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 156). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3', 'b3b5a9bd-f04c-5dc1-a017-a6ca1b085e22');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3', 'b3b5a9bd-f04c-5dc1-a017-a6ca1b085e22', DATE '2026-05-23', 588.35, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 157 | apLIS lote 5569 | INAS GDF ("INAS-GDF" na planilha)
-- Data Provável Pagamento '23/05/0226' → ano 2026
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d4789a4-9707-5300-860f-263ddfafeb20', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5569', DATE '2026-04-24', DATE '2026-04-24', 'Faturado', 3, 'PEG169225', '8433', 8413, DATE '2026-09-30', '5569', 1245.10, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb5e7804-941b-5edf-8c12-3c3d161fdc6a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-24', DATE '2026-05-23', 1245.10, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 157). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb5e7804-941b-5edf-8c12-3c3d161fdc6a', '0d4789a4-9707-5300-860f-263ddfafeb20');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('eb5e7804-941b-5edf-8c12-3c3d161fdc6a', '0d4789a4-9707-5300-860f-263ddfafeb20', DATE '2026-05-23', 1245.10, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 158 | apLIS lote 5573 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aa13f9e7-9be2-50ec-8bdc-00cb00abe093', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5573', DATE '2026-04-24', DATE '2026-05-21', 'Faturado', 3, 'PEG169323', '8433', 8413, DATE '2026-09-30', '5573', 10502.01, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f5db7884-8d29-5c12-b084-7ceb91625a74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-24', DATE '2026-05-23', 10502.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 158). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f5db7884-8d29-5c12-b084-7ceb91625a74', 'aa13f9e7-9be2-50ec-8bdc-00cb00abe093');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f5db7884-8d29-5c12-b084-7ceb91625a74', 'aa13f9e7-9be2-50ec-8bdc-00cb00abe093', DATE '2026-05-23', 10502.01, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 159 | apLIS lote 5586 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1481d8ea-6392-5334-873e-b4ec48d2614d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5586', DATE '2026-04-27', DATE '2026-04-27', 'Em Processamento', 1, 'PEG169790', '8433', 8413, DATE '2026-09-30', '5586', 7165.21, 36);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1e3114f7-8fd7-5334-8d1d-2a210cd3f34d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-27', DATE '2026-05-27', 7165.21, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 159). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1e3114f7-8fd7-5334-8d1d-2a210cd3f34d', '1481d8ea-6392-5334-873e-b4ec48d2614d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1e3114f7-8fd7-5334-8d1d-2a210cd3f34d', '1481d8ea-6392-5334-873e-b4ec48d2614d', DATE '2026-05-27', 7165.21, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 160 | apLIS lote 5591 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b173c98a-5bc5-5642-86d6-bfee7e081ca8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5591', DATE '2026-04-27', DATE '2026-04-27', 'Faturado', 3, 'PEG170705', '8433', 8413, DATE '2026-09-30', '5591', 6452.51, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e815fbd-e38b-5d3f-84d6-6993c5890e23', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-29', DATE '2026-05-29', 6452.51, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 160). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e815fbd-e38b-5d3f-84d6-6993c5890e23', 'b173c98a-5bc5-5642-86d6-bfee7e081ca8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3e815fbd-e38b-5d3f-84d6-6993c5890e23', 'b173c98a-5bc5-5642-86d6-bfee7e081ca8', DATE '2026-05-29', 6452.51, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 161 | apLIS lote 5622 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('15859fcf-58f5-5e2c-9dd8-b228d2ff6ec1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5622', DATE '2026-04-29', DATE '2026-04-29', 'Faturado', 3, 'PEG170958', '8433', 8413, DATE '2026-09-30', '5622', 3336.78, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ee22dd6c-9b74-52be-a4d5-f045c69e2bc3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-29', DATE '2026-05-29', 3336.78, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 161). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ee22dd6c-9b74-52be-a4d5-f045c69e2bc3', '15859fcf-58f5-5e2c-9dd8-b228d2ff6ec1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ee22dd6c-9b74-52be-a4d5-f045c69e2bc3', '15859fcf-58f5-5e2c-9dd8-b228d2ff6ec1', DATE '2026-05-29', 3336.78, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 162 | apLIS lote 5576 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('31a3137a-3f56-5ba0-9f4f-facafbfa695e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5576', DATE '2026-04-24', DATE '2026-04-29', 'Faturado', 3, 'PEG170985', '8433', 8413, DATE '2026-09-30', '5576', 319.45, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('49613952-fb50-5faa-a671-5f8101adac65', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-29', DATE '2026-05-29', 319.45, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 162). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('49613952-fb50-5faa-a671-5f8101adac65', '31a3137a-3f56-5ba0-9f4f-facafbfa695e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('49613952-fb50-5faa-a671-5f8101adac65', '31a3137a-3f56-5ba0-9f4f-facafbfa695e', DATE '2026-05-29', 319.45, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 163 | apLIS lote 5623 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a955168-ea75-59f6-91c2-73bbaa8be8b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5623', DATE '2026-04-29', DATE '2026-04-29', 'Faturado', 3, 'PEG171056', '8433', 8413, DATE '2026-09-30', '5623', 4940.02, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ffca27dd-4422-5548-8078-cb76fd5fbbc9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8433', DATE '2026-04-29', DATE '2026-05-29', 4940.02, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 163). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ffca27dd-4422-5548-8078-cb76fd5fbbc9', '0a955168-ea75-59f6-91c2-73bbaa8be8b2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ffca27dd-4422-5548-8078-cb76fd5fbbc9', '0a955168-ea75-59f6-91c2-73bbaa8be8b2', DATE '2026-05-29', 4940.02, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 164 | apLIS lote 5379 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('570ae62f-c386-586b-ae7e-2a4ed4fdcbba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5379', DATE '2026-04-02', DATE '2026-04-02', 'Recebido', 4, '36439', NULL, NULL, NULL, '5379', 11934.41, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6c0d1f16-5fee-592b-b256-27c213a6c90a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), NULL, DATE '2026-04-02', DATE '2026-05-31', 11934.41, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 164). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6c0d1f16-5fee-592b-b256-27c213a6c90a', '570ae62f-c386-586b-ae7e-2a4ed4fdcbba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6c0d1f16-5fee-592b-b256-27c213a6c90a', '570ae62f-c386-586b-ae7e-2a4ed4fdcbba', DATE '2026-05-31', DATE '2026-05-26', 11934.41, 11934.41, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 165 | apLIS lote 5340 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ca713b59-c10d-510c-b191-28f9d3751adc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5340', DATE '2026-03-30', DATE '2026-04-09', 'Recebido - parcial', 7, 'PEG444715', NULL, NULL, NULL, '5340', 11021.01, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 11021.01, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 165). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', 'ca713b59-c10d-510c-b191-28f9d3751adc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', 'ca713b59-c10d-510c-b191-28f9d3751adc', DATE '2026-05-09', DATE '2026-07-03', 11021.01, 10528.09, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', 'ca713b59-c10d-510c-b191-28f9d3751adc', 492.92, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 166 | apLIS lote 5339 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1904d3e1-d651-5f6b-8b52-91b1e6aa48fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5339', DATE '2026-03-30', DATE '2026-04-09', 'Recebido', 4, 'PEG444725', NULL, NULL, NULL, '5339', 10750.46, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2c919165-ba04-5c9e-b593-2ee20f065ad2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 10750.46, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 166). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2c919165-ba04-5c9e-b593-2ee20f065ad2', '1904d3e1-d651-5f6b-8b52-91b1e6aa48fd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2c919165-ba04-5c9e-b593-2ee20f065ad2', '1904d3e1-d651-5f6b-8b52-91b1e6aa48fd', DATE '2026-05-09', DATE '2026-07-03', 10750.46, 10750.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 167 | apLIS lote 5338 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('072a4089-bf86-5bff-ad68-9c4a1b8c76d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5338', DATE '2026-03-30', DATE '2026-04-09', 'Recebido', 4, 'PEG444739', NULL, NULL, NULL, '5338', 8816.95, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('81dd08fc-cabf-59a1-b30f-34c660796a9b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 8816.95, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 167). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('81dd08fc-cabf-59a1-b30f-34c660796a9b', '072a4089-bf86-5bff-ad68-9c4a1b8c76d3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('81dd08fc-cabf-59a1-b30f-34c660796a9b', '072a4089-bf86-5bff-ad68-9c4a1b8c76d3', DATE '2026-05-09', DATE '2026-07-03', 8816.95, 8816.95, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 168 | apLIS lote 5425 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a9cb05e8-4f43-544f-8748-0c695eae77cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5425', DATE '2026-04-09', DATE '2026-04-09', 'Faturado', 3, 'PEG444747', NULL, NULL, NULL, '5425', 1213.44, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2951dbfe-7f8c-5d01-8c5e-b525e2e9689e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 1213.44, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 168). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2951dbfe-7f8c-5d01-8c5e-b525e2e9689e', 'a9cb05e8-4f43-544f-8748-0c695eae77cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2951dbfe-7f8c-5d01-8c5e-b525e2e9689e', 'a9cb05e8-4f43-544f-8748-0c695eae77cc', DATE '2026-05-09', 1213.44, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 169 | apLIS lote 5427 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5436d330-e9c5-51fc-ae8c-4ff56e0b5910', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5427', DATE '2026-04-09', DATE '2026-04-09', 'Recebido', 4, 'PEG444775', NULL, NULL, NULL, '5427', 6095.53, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e4ad434e-149f-5169-918c-cf6d0a2a8295', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 6095.53, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 169). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e4ad434e-149f-5169-918c-cf6d0a2a8295', '5436d330-e9c5-51fc-ae8c-4ff56e0b5910');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e4ad434e-149f-5169-918c-cf6d0a2a8295', '5436d330-e9c5-51fc-ae8c-4ff56e0b5910', DATE '2026-05-09', DATE '2026-07-03', 6095.53, 6095.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 170 | apLIS lote 5426 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac5b9693-18d1-503c-98dc-e6bff4694904', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5426', DATE '2026-04-09', DATE '2026-04-09', 'Recebido', 4, 'PEG444798', NULL, NULL, NULL, '5426', 7079.25, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('37ad76b0-aa93-5bad-a764-98e32151646e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 7079.25, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 170). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('37ad76b0-aa93-5bad-a764-98e32151646e', 'ac5b9693-18d1-503c-98dc-e6bff4694904');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('37ad76b0-aa93-5bad-a764-98e32151646e', 'ac5b9693-18d1-503c-98dc-e6bff4694904', DATE '2026-05-09', DATE '2026-07-03', 7079.25, 7079.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 171 | apLIS lote 5428 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('28e37e53-cd96-5f9b-83f0-05425715a909', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5428', DATE '2026-04-09', DATE '2026-04-09', 'Recebido', 4, 'PEG444808', NULL, NULL, NULL, '5428', 3038.65, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0a1ab455-9819-5e4f-849d-de0c7d5c73bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-09', DATE '2026-05-09', 3038.65, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 171). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0a1ab455-9819-5e4f-849d-de0c7d5c73bc', '28e37e53-cd96-5f9b-83f0-05425715a909');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0a1ab455-9819-5e4f-849d-de0c7d5c73bc', '28e37e53-cd96-5f9b-83f0-05425715a909', DATE '2026-05-09', DATE '2026-07-03', 3038.65, 3038.65, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 173 | apLIS lote 5337 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c732bcf6-38ce-5959-bdff-618ed128082b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5337', DATE '2026-03-30', DATE '2026-04-15', 'Faturado', 3, 'PEG445892', NULL, NULL, NULL, '5337', 1026.62, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('814ba3bf-bbf0-5725-8274-fee0fcae333b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 1026.62, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 173). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('814ba3bf-bbf0-5725-8274-fee0fcae333b', 'c732bcf6-38ce-5959-bdff-618ed128082b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('814ba3bf-bbf0-5725-8274-fee0fcae333b', 'c732bcf6-38ce-5959-bdff-618ed128082b', DATE '2026-05-15', 1026.62, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 174 | apLIS lote 5480 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a73842ea-40f2-51bf-9a8d-e519d918071e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5480', DATE '2026-04-15', DATE '2026-04-15', 'Recebido - parcial', 7, 'PEG445950', NULL, NULL, NULL, '5480', 13670.11, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 13670.11, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 174). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', 'a73842ea-40f2-51bf-9a8d-e519d918071e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', 'a73842ea-40f2-51bf-9a8d-e519d918071e', DATE '2026-05-15', DATE '2026-07-03', 13670.11, 13435.46, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', 'a73842ea-40f2-51bf-9a8d-e519d918071e', 234.65, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 175 | apLIS lote 5488 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d382e0b3-1122-54a1-aa5b-c6d9c0d9f2f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5488', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, 'PEG446072', NULL, NULL, NULL, '5488', 13126.96, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9d4f441c-71ca-5eeb-9080-8268e28b1728', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 13126.96, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 175). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9d4f441c-71ca-5eeb-9080-8268e28b1728', 'd382e0b3-1122-54a1-aa5b-c6d9c0d9f2f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9d4f441c-71ca-5eeb-9080-8268e28b1728', 'd382e0b3-1122-54a1-aa5b-c6d9c0d9f2f9', DATE '2026-05-15', DATE '2026-07-03', 13126.96, 13126.96, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 176 | apLIS lote 5489 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3bc88990-af20-54fd-a163-3789086f7601', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5489', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, 'PEG446089', NULL, NULL, NULL, '5489', 16931.48, 55);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e18f3069-bd79-5725-bcb3-da65838b42f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 16931.48, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 176). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e18f3069-bd79-5725-bcb3-da65838b42f6', '3bc88990-af20-54fd-a163-3789086f7601');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e18f3069-bd79-5725-bcb3-da65838b42f6', '3bc88990-af20-54fd-a163-3789086f7601', DATE '2026-05-15', DATE '2026-07-03', 16931.48, 16931.48, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 177 | apLIS lote 5490 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74cf605a-06ec-50c6-9932-6a2d3fe295c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5490', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, 'PEG446093', NULL, NULL, NULL, '5490', 14213.87, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e4326985-4afc-5f0f-9782-fa9d57785ec3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 14213.87, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 177). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e4326985-4afc-5f0f-9782-fa9d57785ec3', '74cf605a-06ec-50c6-9932-6a2d3fe295c2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e4326985-4afc-5f0f-9782-fa9d57785ec3', '74cf605a-06ec-50c6-9932-6a2d3fe295c2', DATE '2026-05-15', DATE '2026-07-03', 14213.87, 14213.87, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 178 | apLIS lote 5492 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('93f58f62-ee20-56e0-a149-5666fa235c7b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5492', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, 'PEG446100', NULL, NULL, NULL, '5492', 1017.48, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('22ba16fe-e6c4-52d6-9893-d6d6cc4d3d84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 1017.48, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 178). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('22ba16fe-e6c4-52d6-9893-d6d6cc4d3d84', '93f58f62-ee20-56e0-a149-5666fa235c7b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('22ba16fe-e6c4-52d6-9893-d6d6cc4d3d84', '93f58f62-ee20-56e0-a149-5666fa235c7b', DATE '2026-05-15', DATE '2026-07-03', 1017.48, 1017.48, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 179 | apLIS lote 5505 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60f76732-398e-504f-91ba-13c927ba08f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5505', DATE '2026-04-16', DATE '2026-04-16', 'Recebido', 4, 'PEG446251', NULL, NULL, NULL, '5505', 316.28, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2352c67-9429-51e4-89e3-ed3fc3c31e08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-15', DATE '2026-05-15', 316.28, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 179). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2352c67-9429-51e4-89e3-ed3fc3c31e08', '60f76732-398e-504f-91ba-13c927ba08f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a2352c67-9429-51e4-89e3-ed3fc3c31e08', '60f76732-398e-504f-91ba-13c927ba08f0', DATE '2026-05-15', DATE '2026-07-03', 316.28, 316.28, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 180 | apLIS lote 5491 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c6426292-7d7a-57b1-8319-63dcd293ecbb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5491', DATE '2026-04-15', DATE '2026-04-20', 'Recebido - parcial', 7, 'PEG446832', NULL, NULL, NULL, '5491', 14467.57, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-20', DATE '2026-05-15', 14467.57, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 180). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', 'c6426292-7d7a-57b1-8319-63dcd293ecbb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', 'c6426292-7d7a-57b1-8319-63dcd293ecbb', DATE '2026-05-15', DATE '2026-07-03', 14467.57, 14223.26, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', 'c6426292-7d7a-57b1-8319-63dcd293ecbb', 244.31, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 181 | apLIS lote 5259 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1670073f-dba9-5563-b790-dfb3934c4de3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5259', DATE '2026-03-23', DATE '2026-04-22', 'Recebido - parcial', 7, 'PEG447124', NULL, NULL, NULL, '5259', 8806.94, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-22', DATE '2026-05-15', 8806.94, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 181). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', '1670073f-dba9-5563-b790-dfb3934c4de3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', '1670073f-dba9-5563-b790-dfb3934c4de3', DATE '2026-05-15', DATE '2026-07-03', 8806.94, 8688.74, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', '1670073f-dba9-5563-b790-dfb3934c4de3', 118.20, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 182 | apLIS lote 5467 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('25395c9b-4dc7-5a80-b09f-df17e9c78944', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5467', DATE '2026-04-14', DATE '2026-04-22', 'Recebido', 4, 'PEG447130', NULL, NULL, NULL, '5467', 654.78, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('994e2f7c-73f8-52a5-baf9-985b99e403b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-22', DATE '2026-05-15', 654.78, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 182). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('994e2f7c-73f8-52a5-baf9-985b99e403b7', '25395c9b-4dc7-5a80-b09f-df17e9c78944');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('994e2f7c-73f8-52a5-baf9-985b99e403b7', '25395c9b-4dc7-5a80-b09f-df17e9c78944', DATE '2026-05-15', DATE '2026-07-03', 654.78, 654.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 183 | apLIS lote 5539 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d807cb3-7f0c-5ccf-8e16-98f65b00ea2e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5539', DATE '2026-04-22', DATE '2026-04-22', 'Faturado', 3, 'PEG447144', NULL, NULL, NULL, '5539', 10060.27, 30);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('32d398d3-01f5-5de3-86e9-602136ef2107', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-22', DATE '2026-05-15', 10060.27, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 183). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('32d398d3-01f5-5de3-86e9-602136ef2107', '0d807cb3-7f0c-5ccf-8e16-98f65b00ea2e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('32d398d3-01f5-5de3-86e9-602136ef2107', '0d807cb3-7f0c-5ccf-8e16-98f65b00ea2e', DATE '2026-05-15', DATE '2026-07-03', 10060.27, 10060.27, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 184 | apLIS lote 5543 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fdaf2f2e-83e7-51aa-953f-b3a3e01c618e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5543', DATE '2026-04-22', DATE '2026-04-22', 'Recebido', 4, '447183', NULL, NULL, NULL, '5543', 5524.91, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd72d2c5-41d7-579a-9e7b-c0aeb7fcde4e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-22', DATE '2026-05-15', 5524.91, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 184). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd72d2c5-41d7-579a-9e7b-c0aeb7fcde4e', 'fdaf2f2e-83e7-51aa-953f-b3a3e01c618e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bd72d2c5-41d7-579a-9e7b-c0aeb7fcde4e', 'fdaf2f2e-83e7-51aa-953f-b3a3e01c618e', DATE '2026-05-15', DATE '2026-07-03', 5524.91, 5524.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 185 | apLIS lote 5560 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd9e3286-cb4c-5ff1-af17-617cb952b895', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5560', DATE '2026-04-23', DATE '2026-04-23', 'Recebido', 4, 'PEG447521', NULL, NULL, NULL, '5560', 16930.53, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4224b9b3-c4c4-5251-91b4-d0b10d76f766', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-23', DATE '2026-05-15', 16930.53, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 185). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4224b9b3-c4c4-5251-91b4-d0b10d76f766', 'dd9e3286-cb4c-5ff1-af17-617cb952b895');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4224b9b3-c4c4-5251-91b4-d0b10d76f766', 'dd9e3286-cb4c-5ff1-af17-617cb952b895', DATE '2026-05-15', DATE '2026-07-03', 16930.53, 16930.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 186 | apLIS lote 5564 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('827d612f-6f51-54c6-86d2-7579241b5b72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5564', DATE '2026-04-23', DATE '2026-04-23', 'Faturado', 3, 'PEG447585', NULL, NULL, NULL, '5564', 5425.13, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-23', DATE '2026-05-15', 5425.13, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 186). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109', '827d612f-6f51-54c6-86d2-7579241b5b72');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109', '827d612f-6f51-54c6-86d2-7579241b5b72', DATE '2026-05-15', DATE '2026-07-03', 5425.13, 5406.97, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 187 | apLIS lote 5581 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5581', DATE '2026-04-27', DATE '2026-04-27', 'Recebido - parcial', 7, 'PEG448393', NULL, NULL, NULL, '5581', 10335.59, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-27', DATE '2026-05-15', 10335.59, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 187). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', 'ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', 'ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2', DATE '2026-05-15', DATE '2026-07-03', 10335.59, 7447.01, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', 'ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2', 2888.58, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 188 | apLIS lote 5585 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('112c658e-dcf8-59de-957d-dcaa3549ff53', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5585', DATE '2026-04-27', DATE '2026-04-27', 'Recebido', 4, 'PEG448436', NULL, NULL, NULL, '5585', 17930.02, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fb023e82-609f-5ef7-9ada-5d430a5cce45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-27', DATE '2026-05-15', 17930.02, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 188). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fb023e82-609f-5ef7-9ada-5d430a5cce45', '112c658e-dcf8-59de-957d-dcaa3549ff53');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fb023e82-609f-5ef7-9ada-5d430a5cce45', '112c658e-dcf8-59de-957d-dcaa3549ff53', DATE '2026-05-15', DATE '2026-07-03', 17930.02, 17930.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 189 | apLIS lote 5588 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad83365e-e4e7-599f-a7d5-1f9c527fa713', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5588', DATE '2026-04-27', DATE '2026-04-27', 'Faturado', 3, 'PEG448681', NULL, NULL, NULL, '5588', 2352.54, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f0888686-bead-552c-b9ec-16ffda412a8b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-27', DATE '2026-05-15', 2352.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 189). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f0888686-bead-552c-b9ec-16ffda412a8b', 'ad83365e-e4e7-599f-a7d5-1f9c527fa713');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f0888686-bead-552c-b9ec-16ffda412a8b', 'ad83365e-e4e7-599f-a7d5-1f9c527fa713', DATE '2026-05-15', 2352.54, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 190 | apLIS lote 5590 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4b0140bd-017e-5af6-a9fc-2e2d8442ec38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5590', DATE '2026-04-27', DATE '2026-04-27', 'Faturado', 3, 'PEG448764', NULL, NULL, NULL, '5590', 6278.32, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b8b6cc16-bcdc-5155-b95c-047b41c07eaa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-27', DATE '2026-05-15', 6278.32, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 190). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b8b6cc16-bcdc-5155-b95c-047b41c07eaa', '4b0140bd-017e-5af6-a9fc-2e2d8442ec38');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b8b6cc16-bcdc-5155-b95c-047b41c07eaa', '4b0140bd-017e-5af6-a9fc-2e2d8442ec38', DATE '2026-05-15', 6278.32, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 191 | apLIS lote 5624 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('975a991f-e3a8-582b-a715-7005acdd17b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5624', DATE '2026-04-29', DATE '2026-04-29', 'Faturado', 3, 'PEG449543', NULL, NULL, NULL, '5624', 7342.84, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f47f9c46-ce39-5490-9670-9726c9ad30e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-29', DATE '2026-05-15', 7342.84, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 191). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f47f9c46-ce39-5490-9670-9726c9ad30e0', '975a991f-e3a8-582b-a715-7005acdd17b0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f47f9c46-ce39-5490-9670-9726c9ad30e0', '975a991f-e3a8-582b-a715-7005acdd17b0', DATE '2026-05-15', 7342.84, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 192 | apLIS lote 5625 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2cf8bf0f-1dc2-5941-8b75-585c24a41d10', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5625', DATE '2026-04-29', DATE '2026-04-29', 'Faturado', 3, 'PEG449606', NULL, NULL, NULL, '5625', 3383.79, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3932687e-fb74-57e2-b8ff-45305c83f22c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-04-29', DATE '2026-05-15', 3383.79, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 192). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3932687e-fb74-57e2-b8ff-45305c83f22c', '2cf8bf0f-1dc2-5941-8b75-585c24a41d10');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3932687e-fb74-57e2-b8ff-45305c83f22c', '2cf8bf0f-1dc2-5941-8b75-585c24a41d10', DATE '2026-05-15', 3383.79, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 193 | apLIS lote 4935 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80935be2-73f5-57fc-acae-170c28022632', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '4935', DATE '2026-02-02', DATE '2026-04-01', 'Recebido', 4, '4270469', '8274', 8254, DATE '2026-08-31', '4935', 510.39, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('af748bd7-16cb-5d35-8a9e-3e3cb685a267', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '8274', DATE '2026-04-01', DATE '2026-05-31', 510.39, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 193). Responsável: Ana Lucia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('af748bd7-16cb-5d35-8a9e-3e3cb685a267', '80935be2-73f5-57fc-acae-170c28022632');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('af748bd7-16cb-5d35-8a9e-3e3cb685a267', '80935be2-73f5-57fc-acae-170c28022632', DATE '2026-05-31', DATE '2026-06-06', 510.39, 510.39, 'recebido', 'Ana Lucia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 194 | apLIS lote 5541 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bba37727-4f67-50da-ba3a-d313b9a6f3a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5541', DATE '2026-04-22', DATE '2026-04-22', 'Recebido', 4, '53457', '8306', 8286, DATE '2026-08-31', '5541', 37815.22, 75);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('464f8807-abe0-538f-a437-cb89880c3c42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8306', DATE '2026-04-22', DATE '2026-05-22', 37815.22, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 194). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('464f8807-abe0-538f-a437-cb89880c3c42', 'bba37727-4f67-50da-ba3a-d313b9a6f3a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('464f8807-abe0-538f-a437-cb89880c3c42', 'bba37727-4f67-50da-ba3a-d313b9a6f3a5', DATE '2026-05-22', DATE '2026-06-22', 37815.22, 37815.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 195 | apLIS lote 5542 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aeadbf4a-51ad-508b-90cf-eba67afbcacc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5542', DATE '2026-04-22', DATE '2026-04-22', 'Recebido', 4, '53534', '8306', 8286, DATE '2026-08-31', '5542', 4432.48, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d83b81d-10f8-59cd-a1ab-48e3ef7ea0e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8306', DATE '2026-04-22', DATE '2026-05-22', 4432.48, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 195). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d83b81d-10f8-59cd-a1ab-48e3ef7ea0e3', 'aeadbf4a-51ad-508b-90cf-eba67afbcacc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6d83b81d-10f8-59cd-a1ab-48e3ef7ea0e3', 'aeadbf4a-51ad-508b-90cf-eba67afbcacc', DATE '2026-05-22', DATE '2026-06-22', 4432.48, 4432.48, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 196 | apLIS lote 5540 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('10bc348b-a178-583d-b215-54b321a3bbff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5540', DATE '2026-04-22', DATE '2026-04-23', 'Recebido', 4, '53658', '8306', 8286, DATE '2026-08-31', '5540', 35761.49, 76);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7fbca8bd-8bee-5cb5-ba64-294e211c3079', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8306', DATE '2026-04-23', DATE '2026-05-23', 35761.49, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 196). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7fbca8bd-8bee-5cb5-ba64-294e211c3079', '10bc348b-a178-583d-b215-54b321a3bbff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7fbca8bd-8bee-5cb5-ba64-294e211c3079', '10bc348b-a178-583d-b215-54b321a3bbff', DATE '2026-05-23', DATE '2026-06-22', 35761.49, 35761.49, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 197 | apLIS lote 5597 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e3ef322-c518-5f92-b616-71b34bf7b307', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5597', DATE '2026-04-28', DATE '2026-04-28', 'Faturado', 3, '55298', '8306', 8286, DATE '2026-08-31', '5597', 1180.97, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8306', DATE '2026-04-28', DATE '2026-05-28', 1180.97, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 197). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', '6e3ef322-c518-5f92-b616-71b34bf7b307');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', '6e3ef322-c518-5f92-b616-71b34bf7b307', DATE '2026-05-28', DATE '2026-06-22', 1180.97, 589.91, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', '6e3ef322-c518-5f92-b616-71b34bf7b307', 591.06, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 198 | apLIS lote 5595 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80c9e42e-447f-529e-931a-64fb10796301', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5595', DATE '2026-04-28', DATE '2026-04-28', 'Recebido', 4, '55182', '8306', 8286, DATE '2026-08-31', '5595', 6724.06, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2cd9cb75-eb6c-5669-b57a-a8799882e76e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8306', DATE '2026-04-28', DATE '2026-05-28', 6724.06, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 198). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2cd9cb75-eb6c-5669-b57a-a8799882e76e', '80c9e42e-447f-529e-931a-64fb10796301');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2cd9cb75-eb6c-5669-b57a-a8799882e76e', '80c9e42e-447f-529e-931a-64fb10796301', DATE '2026-05-28', DATE '2026-06-22', 6724.06, 6724.06, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 199 | apLIS lote 5421 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a516f07-9af6-5c58-8c6b-3f4198eb9af3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5421', DATE '2026-04-08', DATE '2026-04-08', 'Recebido', 4, '212385', NULL, NULL, NULL, '5421', 4281.45, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63aeda8d-5caf-5de0-acd2-0f16de435a08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-08', DATE '2026-06-07', 4281.45, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 199). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63aeda8d-5caf-5de0-acd2-0f16de435a08', '0a516f07-9af6-5c58-8c6b-3f4198eb9af3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('63aeda8d-5caf-5de0-acd2-0f16de435a08', '0a516f07-9af6-5c58-8c6b-3f4198eb9af3', DATE '2026-06-07', DATE '2026-05-29', 4281.45, 4281.45, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 200 | apLIS lote 5478 | SIS SENADO ("" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1f693837-9f5d-5a68-a759-f129e8efebd6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5478', DATE '2026-04-15', DATE '2026-04-15', 'Recebido', 4, '213092', NULL, NULL, NULL, '5478', 4061.45, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('24a4156f-6394-5fe9-ba0d-5f6a84d43557', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-15', DATE '2026-04-15', 4061.45, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 200). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('24a4156f-6394-5fe9-ba0d-5f6a84d43557', '1f693837-9f5d-5a68-a759-f129e8efebd6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('24a4156f-6394-5fe9-ba0d-5f6a84d43557', '1f693837-9f5d-5a68-a759-f129e8efebd6', DATE '2026-04-15', DATE '2026-06-24', 4061.45, 4061.45, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 201 | apLIS lote 5423 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fa4ee09e-e644-5a4b-a206-63ae0bf5bb2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5423', DATE '2026-04-08', DATE '2026-04-08', 'Recebido', 4, '212387', NULL, NULL, NULL, '5423', 1373.85, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4d358310-b7ef-54bd-842b-00d55edc963a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-08', DATE '2026-06-07', 1373.85, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 201). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4d358310-b7ef-54bd-842b-00d55edc963a', 'fa4ee09e-e644-5a4b-a206-63ae0bf5bb2c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4d358310-b7ef-54bd-842b-00d55edc963a', 'fa4ee09e-e644-5a4b-a206-63ae0bf5bb2c', DATE '2026-06-07', DATE '2026-05-29', 1373.85, 1373.85, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 203 | apLIS lote 5587 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5d6133ba-a1a0-5dae-9969-82666ea4c433', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5587', DATE '2026-04-27', DATE '2026-04-27', 'Recebido', 4, '214495', NULL, NULL, NULL, '5587', 4812.53, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d360c266-ae9e-5169-9e4f-89799ef68bfc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-27', DATE '2026-06-26', 4812.53, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 203). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d360c266-ae9e-5169-9e4f-89799ef68bfc', '5d6133ba-a1a0-5dae-9969-82666ea4c433');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d360c266-ae9e-5169-9e4f-89799ef68bfc', '5d6133ba-a1a0-5dae-9969-82666ea4c433', DATE '2026-06-26', DATE '2026-06-26', 4812.53, 4812.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 204 | apLIS lote 5422 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b581105e-ff41-5380-afd0-149d0e552172', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5422', DATE '2026-04-08', DATE '2026-04-27', 'Recebido', 4, 'PEG214512', NULL, NULL, NULL, '5422', 1301.50, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('480f1c5c-3b4f-59a6-a32c-c42250833131', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-27', DATE '2026-06-26', 1301.50, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 204). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('480f1c5c-3b4f-59a6-a32c-c42250833131', 'b581105e-ff41-5380-afd0-149d0e552172');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('480f1c5c-3b4f-59a6-a32c-c42250833131', 'b581105e-ff41-5380-afd0-149d0e552172', DATE '2026-06-26', DATE '2026-06-26', 1301.50, 1301.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 205 | apLIS lote 5602 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f2366480-c3c9-5f2f-8e78-b4c4c30a2983', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5602', DATE '2026-04-28', DATE '2026-04-28', 'Recebido', 4, '214661', NULL, NULL, NULL, '5602', 1373.85, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('161bf315-af6f-5633-94ae-5a225a294699', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-04-28', DATE '2026-06-27', 1373.85, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 205). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('161bf315-af6f-5633-94ae-5a225a294699', 'f2366480-c3c9-5f2f-8e78-b4c4c30a2983');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('161bf315-af6f-5633-94ae-5a225a294699', 'f2366480-c3c9-5f2f-8e78-b4c4c30a2983', DATE '2026-06-27', DATE '2026-06-26', 1373.85, 1373.85, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 206 | apLIS lote 5419 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('594956b0-9bf8-5b48-88b8-6b4a3417b781', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5419', DATE '2026-04-08', DATE '2026-04-14', 'Recebido', 4, '7317867', NULL, NULL, NULL, '5419', 22613.97, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('652c294c-fb49-59dd-87a5-0a2cfed4bc62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-14', DATE '2026-05-14', 22613.97, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 206). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('652c294c-fb49-59dd-87a5-0a2cfed4bc62', '594956b0-9bf8-5b48-88b8-6b4a3417b781');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('652c294c-fb49-59dd-87a5-0a2cfed4bc62', '594956b0-9bf8-5b48-88b8-6b4a3417b781', DATE '2026-05-14', DATE '2026-07-27', 22613.97, 21699.41, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('652c294c-fb49-59dd-87a5-0a2cfed4bc62', '594956b0-9bf8-5b48-88b8-6b4a3417b781', 914.56, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 207 | apLIS lote 5563 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eb1ab3a3-82ca-5ef1-a365-263950416de9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5563', DATE '2026-04-23', DATE '2026-04-23', 'Recebido', 4, '7333635', NULL, NULL, NULL, '5563', 23995.22, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-23', DATE '2026-05-23', 23995.22, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 207). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', 'eb1ab3a3-82ca-5ef1-a365-263950416de9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', 'eb1ab3a3-82ca-5ef1-a365-263950416de9', DATE '2026-05-23', DATE '2026-07-27', 23995.22, 23495.00, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', 'eb1ab3a3-82ca-5ef1-a365-263950416de9', 500.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 208 | apLIS lote 5562 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('05f0ebf1-fb59-513a-b154-78cdb8a0ceb5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5562', DATE '2026-04-23', DATE '2026-04-23', 'Faturado', 3, '7334109', NULL, NULL, NULL, '5562', 18753.50, 39);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-23', DATE '2026-05-23', 18753.50, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 208). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', '05f0ebf1-fb59-513a-b154-78cdb8a0ceb5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', '05f0ebf1-fb59-513a-b154-78cdb8a0ceb5', DATE '2026-05-23', DATE '2026-07-27', 18753.50, 18586.76, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', '05f0ebf1-fb59-513a-b154-78cdb8a0ceb5', 166.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 209 | apLIS lote 5310 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3aef2a5c-15a0-5bbc-998b-40cfc6486d1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5310', DATE '2026-03-26', DATE '2026-04-23', 'Recebido', 4, '7334291', NULL, NULL, NULL, '5310', 5066.77, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('17a174a1-c934-5c31-8699-013d926be681', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-23', DATE '2026-05-23', 5066.77, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 209). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('17a174a1-c934-5c31-8699-013d926be681', '3aef2a5c-15a0-5bbc-998b-40cfc6486d1d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('17a174a1-c934-5c31-8699-013d926be681', '3aef2a5c-15a0-5bbc-998b-40cfc6486d1d', DATE '2026-05-23', DATE '2026-05-08', 5066.77, 5066.77, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 210 | apLIS lote 5561 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4a326d72-3264-521c-afd2-c7671e7830c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5561', DATE '2026-04-23', DATE '2026-04-23', 'Faturado', 3, '7334425', NULL, NULL, NULL, '5561', 17072.17, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e53fc80-894f-5d77-bb33-332a2ddf1d3b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-23', DATE '2026-05-23', 17072.17, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 210). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e53fc80-894f-5d77-bb33-332a2ddf1d3b', '4a326d72-3264-521c-afd2-c7671e7830c3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3e53fc80-894f-5d77-bb33-332a2ddf1d3b', '4a326d72-3264-521c-afd2-c7671e7830c3', DATE '2026-05-23', DATE '2026-07-27', 17072.17, 17072.17, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 211 | apLIS lote 5570 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a868774a-a483-5f54-8600-5456419ec9a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5570', DATE '2026-04-24', DATE '2026-04-24', 'Recebido', 4, '7335067', NULL, NULL, NULL, '5570', 7319.00, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f0314594-ff4d-5b31-8f46-59f3958dd5e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-24', DATE '2026-05-24', 7319.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 211). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f0314594-ff4d-5b31-8f46-59f3958dd5e4', 'a868774a-a483-5f54-8600-5456419ec9a8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f0314594-ff4d-5b31-8f46-59f3958dd5e4', 'a868774a-a483-5f54-8600-5456419ec9a8', DATE '2026-05-24', DATE '2026-05-08', 7319.00, 7319.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 212 | apLIS lote 5572 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2af2f2b-b51f-5219-88b0-09fcd4ee5260', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5572', DATE '2026-04-24', DATE '2026-04-24', 'Recebido', 4, '7335280', NULL, NULL, NULL, '5572', 188.11, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6b0a071d-bd32-5135-8cc7-29f813a561aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-24', DATE '2026-05-24', 188.11, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 212). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6b0a071d-bd32-5135-8cc7-29f813a561aa', 'c2af2f2b-b51f-5219-88b0-09fcd4ee5260');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6b0a071d-bd32-5135-8cc7-29f813a561aa', 'c2af2f2b-b51f-5219-88b0-09fcd4ee5260', DATE '2026-05-24', DATE '2026-05-08', 188.11, 188.11, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 213 | apLIS lote 5589 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('94a686a5-341c-5f09-9bff-2316a87c1a71', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5589', DATE '2026-04-27', DATE '2026-04-27', 'Recebido', 4, '7340760', NULL, NULL, NULL, '5589', 5958.71, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05029e17-b107-5dd5-a689-e7849a37bd38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-27', DATE '2026-05-27', 5958.71, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 213). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05029e17-b107-5dd5-a689-e7849a37bd38', '94a686a5-341c-5f09-9bff-2316a87c1a71');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('05029e17-b107-5dd5-a689-e7849a37bd38', '94a686a5-341c-5f09-9bff-2316a87c1a71', DATE '2026-05-27', DATE '2026-05-08', 5958.71, 5958.71, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 214 | apLIS lote 5604 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4890ba5c-fa54-5ff2-8c69-7d7847101dd1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5604', DATE '2026-04-28', DATE '2026-04-28', 'Recebido', 4, '7342283', NULL, NULL, NULL, '5604', 1194.72, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f3e28dd-eab1-5231-858e-768b588cd96f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-28', DATE '2026-05-28', 1194.72, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 214). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f3e28dd-eab1-5231-858e-768b588cd96f', '4890ba5c-fa54-5ff2-8c69-7d7847101dd1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2f3e28dd-eab1-5231-858e-768b588cd96f', '4890ba5c-fa54-5ff2-8c69-7d7847101dd1', DATE '2026-05-28', DATE '2026-05-08', 1194.72, 1194.72, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 215 | apLIS lote 5621 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('34c45a56-713e-5d44-a834-a56da90c29a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5621', DATE '2026-04-29', DATE '2026-04-29', 'Recebido', 4, '7343422', NULL, NULL, NULL, '5621', 18144.95, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5212bf72-26c5-5738-925e-92d690bcf995', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-04-29', DATE '2026-05-29', 18144.95, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 215). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5212bf72-26c5-5738-925e-92d690bcf995', '34c45a56-713e-5d44-a834-a56da90c29a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5212bf72-26c5-5738-925e-92d690bcf995', '34c45a56-713e-5d44-a834-a56da90c29a0', DATE '2026-05-29', DATE '2026-05-08', 18144.95, 18144.95, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 216 | apLIS lote 5629 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c0545ac-79e9-5f0a-a837-9214b8319b3b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5629', DATE '2026-04-30', DATE '2026-04-30', 'Recebido - parcial', 7, '260430017713', NULL, NULL, NULL, '5629', 19037.94, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-04-30', DATE '2026-06-04', 19037.94, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 216). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', '4c0545ac-79e9-5f0a-a837-9214b8319b3b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', '4c0545ac-79e9-5f0a-a837-9214b8319b3b', DATE '2026-06-04', DATE '2026-06-17', 19037.94, 17661.52, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', '4c0545ac-79e9-5f0a-a837-9214b8319b3b', 1376.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 217 | apLIS lote 5594 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c43d46be-9dc5-56f5-9604-a753066446e8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5594', DATE '2026-04-28', DATE '2026-04-30', 'Recebido - parcial', 7, '260430021102', NULL, NULL, NULL, '5594', 8465.20, 47);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-04-30', DATE '2026-06-04', 8465.20, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 217). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', 'c43d46be-9dc5-56f5-9604-a753066446e8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', 'c43d46be-9dc5-56f5-9604-a753066446e8', DATE '2026-06-04', DATE '2026-06-17', 8465.20, 7412.92, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', 'c43d46be-9dc5-56f5-9604-a753066446e8', 675.24, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 218 | apLIS lote 5633 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8926def5-047a-53c9-8356-cc9ad696d3da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5633', DATE '2026-04-30', DATE '2026-04-30', 'Recebido - parcial', 7, '260430022259', NULL, NULL, NULL, '5633', 9226.58, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-04-30', DATE '2026-06-04', 9226.58, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 218). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', '8926def5-047a-53c9-8356-cc9ad696d3da');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', '8926def5-047a-53c9-8356-cc9ad696d3da', DATE '2026-06-04', DATE '2026-06-17', 9226.58, 6822.91, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', '8926def5-047a-53c9-8356-cc9ad696d3da', 2403.67, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 219 | apLIS lote 5318 | 090 SULAMERICA ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac6d0f6d-0f4a-538a-b814-838854c4bf38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '5318', DATE '2026-03-26', DATE '2026-04-30', 'Recebido', 4, '260430023399', NULL, NULL, NULL, '5318', 1931.10, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), NULL, DATE '2026-04-30', DATE '2026-06-04', 1931.10, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 219). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', 'ac6d0f6d-0f4a-538a-b814-838854c4bf38');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', 'ac6d0f6d-0f4a-538a-b814-838854c4bf38', DATE '2026-06-04', DATE '2026-06-17', 1931.10, 1609.25, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', 'ac6d0f6d-0f4a-538a-b814-838854c4bf38', 321.85, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 220 | apLIS lote 5630 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6630bba0-5235-53de-af87-eb318dcdd4cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5630', DATE '2026-04-30', DATE '2026-04-30', 'Recebido', 4, '260430024267', NULL, NULL, NULL, '5630', 13132.96, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-04-30', DATE '2026-06-04', 13132.96, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 220). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', '6630bba0-5235-53de-af87-eb318dcdd4cb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', '6630bba0-5235-53de-af87-eb318dcdd4cb', DATE '2026-06-04', DATE '2026-06-17', 13132.96, 10658.97, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', '6630bba0-5235-53de-af87-eb318dcdd4cb', 1215.82, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 221 | apLIS lote 5631 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('405b7511-bbfd-5127-990e-a301951e4147', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '5631', DATE '2026-04-30', DATE '2026-04-30', 'Recebido - parcial', 7, '260430025805', NULL, NULL, NULL, '5631', 2518.41, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-04-30', DATE '2026-06-04', 2518.41, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 221). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', '405b7511-bbfd-5127-990e-a301951e4147');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', '405b7511-bbfd-5127-990e-a301951e4147', DATE '2026-06-04', DATE '2026-06-17', 2518.41, 1372.74, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', '405b7511-bbfd-5127-990e-a301951e4147', 934.35, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 222 | apLIS lote 5636 | 090 SULAMERICA ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('24cdfd2d-44aa-51b8-97d3-233c5c08fa37', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '5636', DATE '2026-04-30', DATE '2026-04-30', 'Recebido - parcial', 7, '260430026043', NULL, NULL, NULL, '5636', 405.16, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95aa4ecc-5f55-55af-97f7-4d169da2a523', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), NULL, DATE '2026-04-30', DATE '2026-06-04', 405.16, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 222). Responsável: Backfill. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95aa4ecc-5f55-55af-97f7-4d169da2a523', '24cdfd2d-44aa-51b8-97d3-233c5c08fa37');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95aa4ecc-5f55-55af-97f7-4d169da2a523', '24cdfd2d-44aa-51b8-97d3-233c5c08fa37', DATE '2026-06-04', DATE '2026-06-17', 405.16, 372.52, 'parcial', 'Backfill', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 223 | apLIS lote 5463 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('54855204-cc5d-5179-8849-c9ccf9000ad2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5463', DATE '2026-04-13', DATE '2026-04-13', 'Recebido', 4, '475869', '8187', 8167, DATE '2026-07-31', '5463', 722.05, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c0bd792b-809e-5ad7-9ce8-6211e9039d61', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8187', DATE '2026-04-13', DATE '2026-05-13', 722.05, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 223). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c0bd792b-809e-5ad7-9ce8-6211e9039d61', '54855204-cc5d-5179-8849-c9ccf9000ad2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c0bd792b-809e-5ad7-9ce8-6211e9039d61', '54855204-cc5d-5179-8849-c9ccf9000ad2', DATE '2026-05-13', DATE '2026-07-15', 722.05, 722.05, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 224 | apLIS lote 5464 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3ef02c2-680b-58d3-b424-68878b6e0545', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5464', DATE '2026-04-13', DATE '2026-04-13', 'Recebido', 4, '475917', '8279', 8259, DATE '2026-08-31', '5464', 73.67, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('49ad7f4e-c17a-5d24-aada-15b7fdc850d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8279', DATE '2026-04-13', DATE '2026-05-13', 73.67, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 224). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('49ad7f4e-c17a-5d24-aada-15b7fdc850d1', 'f3ef02c2-680b-58d3-b424-68878b6e0545');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('49ad7f4e-c17a-5d24-aada-15b7fdc850d1', 'f3ef02c2-680b-58d3-b424-68878b6e0545', DATE '2026-05-13', DATE '2026-07-15', 73.67, 73.67, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 225 | apLIS lote 5465 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d2ee855c-3278-59de-bbae-2b4590a4fb4d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5465', DATE '2026-04-13', DATE '2026-04-13', 'Recebido', 4, '475951', '8187', 8167, DATE '2026-07-31', '5465', 46.04, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c58ae245-f526-5d18-988e-8d6caef9d5ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8187', DATE '2026-04-13', DATE '2026-05-13', 46.04, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 225). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c58ae245-f526-5d18-988e-8d6caef9d5ad', 'd2ee855c-3278-59de-bbae-2b4590a4fb4d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c58ae245-f526-5d18-988e-8d6caef9d5ad', 'd2ee855c-3278-59de-bbae-2b4590a4fb4d', DATE '2026-05-13', DATE '2026-07-15', 46.04, 46.04, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 226 | apLIS lote 5466 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9a151586-07b6-500c-8e4c-1b5c61d4f439', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5466', DATE '2026-04-13', DATE '2026-04-13', 'Recebido', 4, '475995', '8187', 8167, DATE '2026-07-31', '5466', 20109.54, 83);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e43fc689-a7fd-5157-9d67-e1de02040bb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8187', DATE '2026-04-13', DATE '2026-05-13', 20109.54, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 226). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e43fc689-a7fd-5157-9d67-e1de02040bb1', '9a151586-07b6-500c-8e4c-1b5c61d4f439');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e43fc689-a7fd-5157-9d67-e1de02040bb1', '9a151586-07b6-500c-8e4c-1b5c61d4f439', DATE '2026-05-13', DATE '2026-07-15', 20109.54, 19968.58, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e43fc689-a7fd-5157-9d67-e1de02040bb1', '9a151586-07b6-500c-8e4c-1b5c61d4f439', 140.96, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- ABRIL linha 228 | apLIS lote 5462 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d0672506-e89c-54cd-aec8-4a8229e4b418', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5462', DATE '2026-04-13', DATE '2026-04-13', 'Recebido', 4, '475894', '8187', 8167, DATE '2026-07-31', '5462', 4299.48, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8187', DATE '2026-04-13', DATE '2026-05-13', 4299.48, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 228). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c', 'd0672506-e89c-54cd-aec8-4a8229e4b418');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c', 'd0672506-e89c-54cd-aec8-4a8229e4b418', DATE '2026-05-13', DATE '2026-07-15', 4299.48, 4110.08, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c', 'd0672506-e89c-54cd-aec8-4a8229e4b418', 189.40, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- ABRIL linha 229 | apLIS lote 5503 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bcfa9a69-ef78-5c11-bd5d-2c84534ff470', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5503', DATE '2026-04-16', DATE '2026-04-17', 'Recebido - parcial', 7, '6941365', '8186', 8166, DATE '2026-07-31', '5503', 1924.86, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-20', DATE '2026-05-15', 1924.86, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 229). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', 'bcfa9a69-ef78-5c11-bd5d-2c84534ff470');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', 'bcfa9a69-ef78-5c11-bd5d-2c84534ff470', DATE '2026-05-15', DATE '2026-06-26', 1924.86, 1848.01, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', 'bcfa9a69-ef78-5c11-bd5d-2c84534ff470', 76.85, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 230 | apLIS lote 5504 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5ab14368-a29f-5881-9dc5-ed80bda48f8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5504', DATE '2026-04-16', DATE '2026-04-20', 'Recebido - parcial', 7, '6941377', '8186', 8166, DATE '2026-07-31', '5504', 4398.57, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-20', DATE '2026-05-15', 4398.57, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 230). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', '5ab14368-a29f-5881-9dc5-ed80bda48f8c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', '5ab14368-a29f-5881-9dc5-ed80bda48f8c', DATE '2026-05-15', DATE '2026-06-26', 4398.57, 2378.08, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', '5ab14368-a29f-5881-9dc5-ed80bda48f8c', 2020.49, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 231 | apLIS lote 5527 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7573f0f5-1013-5e07-aba0-d2ab90b9e571', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5527', DATE '2026-04-20', DATE '2026-04-20', 'Recebido - parcial', 7, '6941408', '8186', 8166, DATE '2026-07-31', '5527', 10633.70, 31);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-20', DATE '2026-05-15', 10633.70, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 231). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', '7573f0f5-1013-5e07-aba0-d2ab90b9e571');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', '7573f0f5-1013-5e07-aba0-d2ab90b9e571', DATE '2026-05-15', DATE '2026-06-26', 10633.70, 9320.53, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', '7573f0f5-1013-5e07-aba0-d2ab90b9e571', 1313.17, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 232 | apLIS lote 5528 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e43f610f-5aff-5834-ab10-ff05622abe0d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5528', DATE '2026-04-20', DATE '2026-04-20', 'Recebido - parcial', 7, '6941426', '8186', 8166, DATE '2026-07-31', '5528', 2775.99, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-20', DATE '2026-05-15', 2775.99, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 232). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909', 'e43f610f-5aff-5834-ab10-ff05622abe0d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909', 'e43f610f-5aff-5834-ab10-ff05622abe0d', DATE '2026-05-15', DATE '2026-06-03', 2775.99, 2456.31, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909', 'e43f610f-5aff-5834-ab10-ff05622abe0d', 319.68, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 233 | apLIS lote 4872 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac6f9477-db3c-513e-acc8-2ed2c12a00cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4872', DATE '2026-01-21', DATE '2026-04-20', 'Recebido', 4, '6941433', '8186', 8166, DATE '2026-07-31', '4872', 1233.21, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1ecce032-e109-5be3-8619-5f36378d263d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-20', DATE '2026-05-15', 1233.21, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 233). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1ecce032-e109-5be3-8619-5f36378d263d', 'ac6f9477-db3c-513e-acc8-2ed2c12a00cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1ecce032-e109-5be3-8619-5f36378d263d', 'ac6f9477-db3c-513e-acc8-2ed2c12a00cc', DATE '2026-05-15', DATE '2026-06-03', 1233.21, 1233.21, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 234 | apLIS lote 5529 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7104dff6-7725-5894-8f07-5223e63d0201', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5529', DATE '2026-04-20', DATE '2026-04-22', 'Recebido', 4, '6941709', '8186', 8166, DATE '2026-07-31', '5529', 2797.34, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d080fcee-c008-5f56-87d1-cb1ddfdc6ec4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-22', DATE '2026-05-15', 2797.34, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 234). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d080fcee-c008-5f56-87d1-cb1ddfdc6ec4', '7104dff6-7725-5894-8f07-5223e63d0201');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d080fcee-c008-5f56-87d1-cb1ddfdc6ec4', '7104dff6-7725-5894-8f07-5223e63d0201', DATE '2026-05-15', DATE '2026-06-03', 2797.34, 2797.34, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 235 | apLIS lote 5546 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f57d7620-c47b-5b74-a599-4c45c81ea5cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5546', DATE '2026-04-22', DATE '2026-04-22', 'Recebido', 4, '6942059', '8186', 8166, DATE '2026-07-31', '5546', 79.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f191884b-89e6-55b8-8a9a-e7ab6a0efa9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8186', DATE '2026-04-22', DATE '2026-05-15', 79.92, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 235). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f191884b-89e6-55b8-8a9a-e7ab6a0efa9a', 'f57d7620-c47b-5b74-a599-4c45c81ea5cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f191884b-89e6-55b8-8a9a-e7ab6a0efa9a', 'f57d7620-c47b-5b74-a599-4c45c81ea5cc', DATE '2026-05-15', DATE '2026-06-03', 79.92, 79.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 236 | apLIS lote 5377 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c45306a-56d4-5a20-ba41-1b549caae4dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5377', DATE '2026-04-02', DATE '2026-04-02', 'Recebido', 4, '4301', '8192', 8172, DATE '2026-07-31', '5377', 1282.53, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb9a1478-2494-5dde-8f9d-0fb3b90793d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '8192', DATE '2026-04-02', DATE '2026-05-02', 1282.53, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 236). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb9a1478-2494-5dde-8f9d-0fb3b90793d8', '4c45306a-56d4-5a20-ba41-1b549caae4dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bb9a1478-2494-5dde-8f9d-0fb3b90793d8', '4c45306a-56d4-5a20-ba41-1b549caae4dc', DATE '2026-05-02', DATE '2026-07-10', 1282.53, 1282.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 239 | apLIS lote 5369 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('52824ab5-fdc4-57c4-b697-c8124788c363', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5369', DATE '2026-04-01', DATE '2026-04-02', 'Recebido', 4, '60944', '8066', 8046, DATE '2026-07-31', '5369', 281.25, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8117316-4497-59d8-9cd9-42307213095d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8066', DATE '2026-04-02', DATE '2026-05-02', 281.25, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 239). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8117316-4497-59d8-9cd9-42307213095d', '52824ab5-fdc4-57c4-b697-c8124788c363');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8117316-4497-59d8-9cd9-42307213095d', '52824ab5-fdc4-57c4-b697-c8124788c363', DATE '2026-05-02', DATE '2026-05-26', 281.25, 281.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 240 | apLIS lote 5368 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d125d9bc-f212-5349-a77f-3ca402b53e97', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5368', DATE '2026-04-01', DATE '2026-04-02', 'Recebido - parcial', 7, '60946', '8066', 8046, DATE '2026-07-31', '5368', 972.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb52122b-77e0-5dad-9330-68c3e8c6549b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8066', DATE '2026-04-02', DATE '2026-05-02', 972.92, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 240). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb52122b-77e0-5dad-9330-68c3e8c6549b', 'd125d9bc-f212-5349-a77f-3ca402b53e97');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eb52122b-77e0-5dad-9330-68c3e8c6549b', 'd125d9bc-f212-5349-a77f-3ca402b53e97', DATE '2026-05-02', DATE '2026-05-26', 972.92, 811.20, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('eb52122b-77e0-5dad-9330-68c3e8c6549b', 'd125d9bc-f212-5349-a77f-3ca402b53e97', 161.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 241 | apLIS lote 5509 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('54c58e92-84ab-5995-bce5-b99c756d489f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5509', DATE '2026-04-17', DATE '2026-04-17', 'Recebido - parcial', 7, 'P20261247631', NULL, NULL, NULL, '5509', 13074.98, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('15479d38-dae1-5aab-a660-d7a897b89a46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-04-17', DATE '2026-05-20', 13074.98, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 241). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('15479d38-dae1-5aab-a660-d7a897b89a46', '54c58e92-84ab-5995-bce5-b99c756d489f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('15479d38-dae1-5aab-a660-d7a897b89a46', '54c58e92-84ab-5995-bce5-b99c756d489f', DATE '2026-05-20', DATE '2026-05-22', 13074.98, 12564.11, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('15479d38-dae1-5aab-a660-d7a897b89a46', '54c58e92-84ab-5995-bce5-b99c756d489f', 510.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 242 | apLIS lote 5510 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('789e14d4-3de8-595c-881b-4652a6931d00', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5510', DATE '2026-04-17', DATE '2026-04-17', 'Recebido - parcial', 7, 'P20261247634', NULL, NULL, NULL, '5510', 2068.71, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-04-17', DATE '2026-05-20', 2068.71, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 242). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', '789e14d4-3de8-595c-881b-4652a6931d00');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', '789e14d4-3de8-595c-881b-4652a6931d00', DATE '2026-05-20', DATE '2026-05-22', 2068.71, 2034.08, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', '789e14d4-3de8-595c-881b-4652a6931d00', 34.63, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- ABRIL linha 244 | apLIS lote 5383 | Medigest Centro de Medicina Digestiva ("MEDIGEST - ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f19cb249-8784-532f-82ab-d90a52855bfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5383', DATE '2026-04-02', DATE '2026-04-02', 'Faturado', 3, '5383.0', NULL, NULL, NULL, '5383', 1753.98, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2956e896-591f-5a4a-866e-c52330758497', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-02', DATE '2026-05-20', 1753.98, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 244). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2956e896-591f-5a4a-866e-c52330758497', 'f19cb249-8784-532f-82ab-d90a52855bfa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2956e896-591f-5a4a-866e-c52330758497', 'f19cb249-8784-532f-82ab-d90a52855bfa', DATE '2026-05-20', DATE '2026-04-02', 1753.98, 1753.98, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 245 | apLIS lote 5384 | Medigest Centro de Medicina Digestiva ("MEDIGEST - SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5d6bd59c-37e5-59a7-8201-2474387a5dc0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5384', DATE '2026-04-02', DATE '2026-04-02', 'Faturado', 3, '5384.0', NULL, NULL, NULL, '5384', 520.62, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c99326f9-68b1-5c33-81ad-64286d016769', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-02', DATE '2026-05-02', 520.62, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 245). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c99326f9-68b1-5c33-81ad-64286d016769', '5d6bd59c-37e5-59a7-8201-2474387a5dc0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c99326f9-68b1-5c33-81ad-64286d016769', '5d6bd59c-37e5-59a7-8201-2474387a5dc0', DATE '2026-05-02', DATE '2026-04-02', 520.62, 520.62, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 246 | apLIS lote 5382 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4813ec70-2e7c-5414-b2e9-c6a23cdb010c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5382', DATE '2026-04-02', DATE '2026-04-02', 'Faturado', 3, '5382.0', NULL, NULL, NULL, '5382', 1500.00, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cf114bf3-d28d-51a7-9297-5859f6b4456c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-02', DATE '2026-04-02', 1500.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 246). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cf114bf3-d28d-51a7-9297-5859f6b4456c', '4813ec70-2e7c-5414-b2e9-c6a23cdb010c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cf114bf3-d28d-51a7-9297-5859f6b4456c', '4813ec70-2e7c-5414-b2e9-c6a23cdb010c', DATE '2026-04-02', DATE '2026-04-02', 1500.00, 1500.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 247 | apLIS lote 5433 | Medigest Centro de Medicina Digestiva ("MEDIGEST - ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8ad65558-3993-5939-9d58-4812e9f66db3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5433', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '10042026', NULL, NULL, NULL, '5433', 1708.97, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c99bcd37-5335-53cb-939d-5961b8973bd2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-10', DATE '2026-05-20', 1708.97, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 247). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c99bcd37-5335-53cb-939d-5961b8973bd2', '8ad65558-3993-5939-9d58-4812e9f66db3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c99bcd37-5335-53cb-939d-5961b8973bd2', '8ad65558-3993-5939-9d58-4812e9f66db3', DATE '2026-05-20', DATE '2026-04-10', 1708.97, 1708.97, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 248 | apLIS lote 5434 | Medigest Centro de Medicina Digestiva ("MEDIGEST - SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65ee2b33-8073-5e8a-9ea7-482e48019b58', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5434', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '10042026', NULL, NULL, NULL, '5434', 710.91, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('67b56495-6c0c-5844-88fe-81f0c37cb266', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-10', DATE '2026-05-10', 710.91, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 248). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('67b56495-6c0c-5844-88fe-81f0c37cb266', '65ee2b33-8073-5e8a-9ea7-482e48019b58');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('67b56495-6c0c-5844-88fe-81f0c37cb266', '65ee2b33-8073-5e8a-9ea7-482e48019b58', DATE '2026-05-10', DATE '2026-04-10', 710.91, 710.91, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 249 | apLIS lote 5432 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2d93bc18-07c5-5ab9-bd29-d6360ccb1335', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5432', DATE '2026-04-10', DATE '2026-04-10', 'Faturado', 3, '10042026', NULL, NULL, NULL, '5432', 450.00, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('805ddaa5-9987-5a28-9102-b184a2eb697f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-10', DATE '2026-04-10', 450.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 249). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('805ddaa5-9987-5a28-9102-b184a2eb697f', '2d93bc18-07c5-5ab9-bd29-d6360ccb1335');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('805ddaa5-9987-5a28-9102-b184a2eb697f', '2d93bc18-07c5-5ab9-bd29-d6360ccb1335', DATE '2026-04-10', DATE '2026-04-10', 450.00, 450.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 250 | apLIS lote 5519 | Medigest Centro de Medicina Digestiva ("MEDIGEST - ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('50a6ed50-da8b-5bf5-85e5-2b76a1d1b0c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5519', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '5519.0', NULL, NULL, NULL, '5519', 600.00, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63883190-8c55-50b9-b184-6ef367ef1a17', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-17', DATE '2026-05-20', 600.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 250). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63883190-8c55-50b9-b184-6ef367ef1a17', '50a6ed50-da8b-5bf5-85e5-2b76a1d1b0c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('63883190-8c55-50b9-b184-6ef367ef1a17', '50a6ed50-da8b-5bf5-85e5-2b76a1d1b0c5', DATE '2026-05-20', DATE '2026-04-17', 600.00, 600.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 251 | apLIS lote 5520 | Medigest Centro de Medicina Digestiva ("MEDIGEST - SAUDE CAIXA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d8cfb74b-b96b-539e-9a1d-9fe5df310bda', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5520', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '5520.0', NULL, NULL, NULL, '5520', 4473.14, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('acc130f0-a803-5628-8b57-f1df3f0d451b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-17', DATE '2026-05-17', 4473.14, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 251). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('acc130f0-a803-5628-8b57-f1df3f0d451b', 'd8cfb74b-b96b-539e-9a1d-9fe5df310bda');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('acc130f0-a803-5628-8b57-f1df3f0d451b', 'd8cfb74b-b96b-539e-9a1d-9fe5df310bda', DATE '2026-05-17', DATE '2026-04-17', 4473.14, 4473.14, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 252 | apLIS lote 5521 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f565d52d-0bec-53c3-88ea-6d2f9a98c154', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5521', DATE '2026-04-17', DATE '2026-04-17', 'Faturado', 3, '5521.0', NULL, NULL, NULL, '5521', 814.98, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b25d8956-6ecf-50a5-92e7-6da925e36d79', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-17', DATE '2026-04-17', 814.98, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 252). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b25d8956-6ecf-50a5-92e7-6da925e36d79', 'f565d52d-0bec-53c3-88ea-6d2f9a98c154');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b25d8956-6ecf-50a5-92e7-6da925e36d79', 'f565d52d-0bec-53c3-88ea-6d2f9a98c154', DATE '2026-04-17', DATE '2026-04-17', 814.98, 814.98, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 253 | apLIS lote 5583 | Medigest Centro de Medicina Digestiva ("MEDIGEST - ASSEFAZ" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('368b6caf-e8ef-5239-9dbd-6142536e9a86', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5583', DATE '2026-04-27', DATE '2026-04-27', 'Faturado', 3, '5583.0', NULL, NULL, NULL, '5583', 2079.20, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c70e848-c408-56ef-bf11-630ac9d2fd1e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-27', DATE '2026-05-20', 2079.20, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 253). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c70e848-c408-56ef-bf11-630ac9d2fd1e', '368b6caf-e8ef-5239-9dbd-6142536e9a86');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0c70e848-c408-56ef-bf11-630ac9d2fd1e', '368b6caf-e8ef-5239-9dbd-6142536e9a86', DATE '2026-05-20', DATE '2026-04-27', 2079.20, 2079.20, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ABRIL linha 254 | apLIS lote 5582 | Medigest Centro de Medicina Digestiva ("MEDIGEST - PARTICULAR" na planilha)
-- Data Provável Pagamento vazia → data de faturamento
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f2dc8d30-809d-5f89-be9a-de1b8e7dd134', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), '5582', DATE '2026-04-27', DATE '2026-04-27', 'Faturado', 3, '5582.0', NULL, NULL, NULL, '5582', 1050.00, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('721e45be-02a1-5e3a-9eb3-8328e114e7b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1123'), NULL, DATE '2026-04-27', DATE '2026-04-27', 1050.00, '2026-04', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, linha 254). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('721e45be-02a1-5e3a-9eb3-8328e114e7b7', 'f2dc8d30-809d-5f89-be9a-de1b8e7dd134');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('721e45be-02a1-5e3a-9eb3-8328e114e7b7', 'f2dc8d30-809d-5f89-be9a-de1b8e7dd134', DATE '2026-04-27', DATE '2026-04-27', 1050.00, 1050.00, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba ABRIL, %'
     AND competencia = '2026-04'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 223 THEN
    RAISE EXCEPTION 'Esperados 223 títulos do backfill de abril; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
