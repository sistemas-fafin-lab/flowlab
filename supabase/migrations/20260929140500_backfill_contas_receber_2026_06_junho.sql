-- ============================================================================
-- Backfill histórico: Contas a Receber — Junho/2026 (6 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba JUNHO de "Faturamento x Recebimentos - 2026 -
-- 2° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-06;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 219 títulos, R$ 1.296.184,29 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 141 recebidos, 47 parciais, 31 previstos.
-- Glosas: 44 abertas, 2 definitivas (refaturadas em outro lote),
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
    '1996', '5665', '5667', '5675', '5676', '5692', '5700', '5710', '5726', '5774', '5835', '5836'
    '5843', '5858', '5859', '5879', '5899', '5902', '5905', '5907', '5910', '5911', '5930', '5931'
    '5932', '5933', '5934', '5935', '5936', '5937', '5938', '5939', '5940', '5941', '5942', '5944'
    '5946', '5947', '5949', '5950', '5951', '5952', '5953', '5954', '5955', '5956', '5957', '5958'
    '5959', '5960', '5961', '5962', '5964', '5965', '5966', '5970', '5973', '5974', '5978', '5979'
    '5982', '5983', '5984', '5985', '5986', '5987', '5988', '5989', '5991', '5992', '5993', '5994'
    '5996', '5997', '5998', '6001', '6002', '6003', '6005', '6006', '6008', '6009', '6010', '6011'
    '6013', '6014', '6015', '6016', '6017', '6018', '6019', '6021', '6024', '6025', '6026', '6027'
    '6028', '6029', '6030', '6031', '6032', '6033', '6034', '6035', '6036', '6037', '6038', '6039'
    '6041', '6046', '6047', '6048', '6050', '6053', '6055', '6056', '6057', '6058', '6059', '6060'
    '6061', '6062', '6063', '6064', '6065', '6066', '6067', '6068', '6069', '6070', '6071', '6072'
    '6073', '6074', '6075', '6076', '6078', '6079', '6080', '6081', '6083', '6084', '6087', '6088'
    '6089', '6090', '6091', '6092', '6094', '6095', '6096', '6097', '6099', '6100', '6101', '6102'
    '6103', '6104', '6106', '6107', '6108', '6109', '6113', '6114', '6117', '6118', '6119', '6121'
    '6122', '6123', '6125', '6128', '6131', '6132', '6133', '6134', '6135', '6137', '6138', '6139'
    '6140', '6141', '6142', '6143', '6144', '6145', '6146', '6147', '6148', '6149', '6151', '6152'
    '6153', '6154', '6155', '6157', '6158', '6159', '6160', '6161', '6163', '6164', '6165', '6166'
    '6171', '6172', '6173', '6174', '6175', '6177', '6178', '6184', '6185', '6186', '6187', '6188'
    '6189', '6190', '6197'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1052', '1054', '1078', '1101', '1122', '1129', '1197', '1204', '1210', '1227', '1228', '1231', '1232', '1235', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283', '1343');
  IF v_operadoras <> 29 THEN
    RAISE EXCEPTION 'Esperadas 29 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- JUNHO linha 25 | apLIS lote 6011 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c65d13e7-95c7-57eb-b956-5e2461cca4df', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6011', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '10062026', NULL, NULL, NULL, '6011', 936.82, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5148d737-5959-5a9a-a555-e1abc1441390', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 936.82, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 25). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5148d737-5959-5a9a-a555-e1abc1441390', 'c65d13e7-95c7-57eb-b956-5e2461cca4df');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5148d737-5959-5a9a-a555-e1abc1441390', 'c65d13e7-95c7-57eb-b956-5e2461cca4df', DATE '2026-08-09', DATE '2026-07-13', 936.82, 936.82, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 26 | apLIS lote 6013 | AMHP-DF ("AMHPDF - LIFE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4f5bd929-bb68-535e-b268-e8d57906defc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6013', DATE '2026-06-10', DATE '2026-06-10', 'Faturado', 3, '10062026', NULL, NULL, NULL, '6013', 794.58, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e87cfdd2-211f-5552-8967-6c5f07e1fc4b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 794.58, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 26). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e87cfdd2-211f-5552-8967-6c5f07e1fc4b', '4f5bd929-bb68-535e-b268-e8d57906defc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e87cfdd2-211f-5552-8967-6c5f07e1fc4b', '4f5bd929-bb68-535e-b268-e8d57906defc', DATE '2026-08-09', DATE '2026-07-13', 794.58, 794.58, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 27 | apLIS lote 6017 | AMHP-DF ("AMHPDF - CONAB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74103d60-fcbf-5009-8910-a38e4043a66c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6017', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '10062026', NULL, NULL, NULL, '6017', 181.72, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 181.72, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 27). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1', '74103d60-fcbf-5009-8910-a38e4043a66c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1', '74103d60-fcbf-5009-8910-a38e4043a66c', DATE '2026-08-09', DATE '2026-07-13', 181.72, 181.72, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 28 | apLIS lote 5911 | AMHP-DF ("AMHPDF - CASEMBRAPA PEND 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('90dd6b83-89d5-59d8-be78-660134c13a22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5911', DATE '2026-05-28', DATE '2026-06-10', 'Recebido', 4, '10062026', NULL, NULL, NULL, '5911', 68.95, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9951074e-0a95-50cb-9db4-03455e556c03', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 68.95, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 28). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9951074e-0a95-50cb-9db4-03455e556c03', '90dd6b83-89d5-59d8-be78-660134c13a22');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9951074e-0a95-50cb-9db4-03455e556c03', '90dd6b83-89d5-59d8-be78-660134c13a22', DATE '2026-08-09', DATE '2026-07-13', 68.95, 68.95, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 29 | apLIS lote 6037 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('237814e4-cc3a-5b83-9bb9-6c9da5c4390d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6037', DATE '2026-06-11', DATE '2026-06-11', 'Recebido - parcial', 7, '11062026', NULL, NULL, NULL, '6037', 5316.29, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-11', DATE '2026-08-10', 5316.29, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 29). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', '237814e4-cc3a-5b83-9bb9-6c9da5c4390d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', '237814e4-cc3a-5b83-9bb9-6c9da5c4390d', DATE '2026-08-10', DATE '2026-07-13', 5316.29, 5316.29, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 30 | apLIS lote 6083 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('642a575f-5d4d-561e-9606-16bdfd5443ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6083', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '18062026', NULL, NULL, NULL, '6083', 1945.39, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9dd42586-6513-5b23-90cd-001ce3cf194e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 1945.39, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 30). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9dd42586-6513-5b23-90cd-001ce3cf194e', '642a575f-5d4d-561e-9606-16bdfd5443ba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9dd42586-6513-5b23-90cd-001ce3cf194e', '642a575f-5d4d-561e-9606-16bdfd5443ba', DATE '2026-08-17', DATE '2026-07-13', 1945.39, 1945.39, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 31 | apLIS lote 6131 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b2f52469-764e-5d31-a8e0-fa3b94282452', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6131', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '22062026', NULL, NULL, NULL, '6131', 137.90, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('75c84b89-9f10-55bc-97cf-e687f2ea76d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-22', DATE '2026-08-21', 137.90, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 31). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('75c84b89-9f10-55bc-97cf-e687f2ea76d1', 'b2f52469-764e-5d31-a8e0-fa3b94282452');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('75c84b89-9f10-55bc-97cf-e687f2ea76d1', 'b2f52469-764e-5d31-a8e0-fa3b94282452', DATE '2026-08-21', DATE '2026-07-13', 137.90, 137.90, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 32 | apLIS lote 6164 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('caf05560-fa93-521d-879e-de2318815264', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6164', DATE '2026-06-25', DATE '2026-06-25', 'Recebido', 4, '25062026', NULL, NULL, NULL, '6164', 688.65, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dd7c2c00-c1db-53ad-a5cf-6f1955940898', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-25', DATE '2026-08-24', 688.65, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 32). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dd7c2c00-c1db-53ad-a5cf-6f1955940898', 'caf05560-fa93-521d-879e-de2318815264');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dd7c2c00-c1db-53ad-a5cf-6f1955940898', 'caf05560-fa93-521d-879e-de2318815264', DATE '2026-08-24', DATE '2026-07-13', 688.65, 688.65, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 33 | apLIS lote 6018 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f2346549-3152-509d-939d-3ea132a2e034', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6018', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '44701932', NULL, NULL, NULL, '6018', 2935.35, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c47f039-ef8e-5fc5-b8a8-460e041df728', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 2935.35, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 33). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c47f039-ef8e-5fc5-b8a8-460e041df728', 'f2346549-3152-509d-939d-3ea132a2e034');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0c47f039-ef8e-5fc5-b8a8-460e041df728', 'f2346549-3152-509d-939d-3ea132a2e034', DATE '2026-08-09', DATE '2026-07-13', 2935.35, 2935.35, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 34 | apLIS lote 6019 | AMHP-DF ("AMHPDF - CARE PLUS PEND 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('70f43902-be53-5268-b27e-805acc6c9d3f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6019', DATE '2026-06-10', DATE '2026-07-16', 'Recebido', 4, '44702121', NULL, NULL, NULL, '6019', 822.76, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('91db6a58-35e1-5292-b3ab-218af97e57fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 822.76, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 34). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('91db6a58-35e1-5292-b3ab-218af97e57fd', '70f43902-be53-5268-b27e-805acc6c9d3f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('91db6a58-35e1-5292-b3ab-218af97e57fd', '70f43902-be53-5268-b27e-805acc6c9d3f', DATE '2026-08-09', DATE '2026-07-13', 822.76, 822.76, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 35 | apLIS lote 6072 | AMHP-DF ("AMHPDF - CARE PLUS PEND 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('88ee9c35-22ff-5440-afaf-26ee4780f20c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6072', DATE '2026-06-17', DATE '2026-06-17', 'Faturado', 3, '44704467', NULL, NULL, NULL, '6072', 1266.05, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4c80ab60-3c86-5edc-b6a2-afd910276625', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-17', DATE '2026-08-16', 1266.05, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 35). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4c80ab60-3c86-5edc-b6a2-afd910276625', '88ee9c35-22ff-5440-afaf-26ee4780f20c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4c80ab60-3c86-5edc-b6a2-afd910276625', '88ee9c35-22ff-5440-afaf-26ee4780f20c', DATE '2026-08-16', DATE '2026-07-13', 1266.05, 1266.05, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 36 | apLIS lote 6141 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('934688f4-1a42-5358-8567-38613f6404cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6141', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '44706256', NULL, NULL, NULL, '6141', 678.43, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa40b0f7-9bd0-5ef7-9391-79013e7634a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 678.43, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 36). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa40b0f7-9bd0-5ef7-9391-79013e7634a1', '934688f4-1a42-5358-8567-38613f6404cd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aa40b0f7-9bd0-5ef7-9391-79013e7634a1', '934688f4-1a42-5358-8567-38613f6404cd', DATE '2026-08-22', DATE '2026-07-13', 678.43, 678.43, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 37 | apLIS lote 6028 | AMHP-DF ("AMHPDF - TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('02bc4d0b-f7b9-5819-abec-19fdee36cf18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6028', DATE '2026-06-10', DATE '2026-06-11', 'Recebido', 4, '11062026', NULL, NULL, NULL, '6028', 10697.92, 31);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3d1e76b4-4241-59a8-9bb1-35f7b47c0875', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-11', DATE '2026-08-10', 10697.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 37). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3d1e76b4-4241-59a8-9bb1-35f7b47c0875', '02bc4d0b-f7b9-5819-abec-19fdee36cf18');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3d1e76b4-4241-59a8-9bb1-35f7b47c0875', '02bc4d0b-f7b9-5819-abec-19fdee36cf18', DATE '2026-08-10', DATE '2026-07-13', 10697.92, 10697.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 38 | apLIS lote 6089 | AMHP-DF ("AMHPDF - TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8ae9b07b-593b-5e96-b8cb-ceb192254397', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6089', DATE '2026-06-18', DATE '2026-06-18', 'Recebido - parcial', 7, '18062026', NULL, NULL, NULL, '6089', 5243.09, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 5243.09, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 38). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', '8ae9b07b-593b-5e96-b8cb-ceb192254397');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', '8ae9b07b-593b-5e96-b8cb-ceb192254397', DATE '2026-08-17', DATE '2026-07-13', 5243.09, 5243.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 39 | apLIS lote 6088 | AMHP-DF ("AMHPDF - TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d50bc67-065f-592b-8572-f9cff485776a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6088', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '18062026', NULL, NULL, NULL, '6088', 159.86, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('12f446c0-0f32-5880-b4b7-6bea171c536b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 159.86, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 39). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('12f446c0-0f32-5880-b4b7-6bea171c536b', '0d50bc67-065f-592b-8572-f9cff485776a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('12f446c0-0f32-5880-b4b7-6bea171c536b', '0d50bc67-065f-592b-8572-f9cff485776a', DATE '2026-08-17', DATE '2026-07-13', 159.86, 159.86, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 40 | apLIS lote 6146 | AMHP-DF ("AMHPDF - TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('45fdb1e6-dfee-537e-bbfa-c29779e0486b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6146', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '23062026', NULL, NULL, NULL, '6146', 495.98, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('49599558-0d2e-5b04-9906-1fb7a97c5162', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 495.98, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 40). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('49599558-0d2e-5b04-9906-1fb7a97c5162', '45fdb1e6-dfee-537e-bbfa-c29779e0486b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('49599558-0d2e-5b04-9906-1fb7a97c5162', '45fdb1e6-dfee-537e-bbfa-c29779e0486b', DATE '2026-08-22', DATE '2026-07-13', 495.98, 495.98, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 41 | apLIS lote 6175 | AMHP-DF ("AMHPDF - TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9aff72b3-8d4a-5f5f-82aa-8614f8254e5b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6175', DATE '2026-06-26', DATE '2026-06-26', 'Faturado', 3, '26062026', NULL, NULL, NULL, '6175', 4107.70, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-26', DATE '2026-08-25', 4107.70, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 41). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', '9aff72b3-8d4a-5f5f-82aa-8614f8254e5b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', '9aff72b3-8d4a-5f5f-82aa-8614f8254e5b', DATE '2026-08-25', DATE '2026-07-13', 4107.70, 4107.70, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 42 | apLIS lote 6027 | AMHP-DF ("AMHPDF - STM" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8aafcde4-f69c-5fb3-90bc-84505c632d59', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6027', DATE '2026-06-10', DATE '2026-06-10', 'Faturado', 3, '10062026', NULL, NULL, NULL, '6027', 4572.20, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 4572.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 42). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd', '8aafcde4-f69c-5fb3-90bc-84505c632d59');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd', '8aafcde4-f69c-5fb3-90bc-84505c632d59', DATE '2026-08-09', DATE '2026-07-13', 4572.20, 4572.20, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 43 | apLIS lote 6084 | AMHP-DF ("AMHPDF - STM" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('39ef28a2-b34d-53b3-81a1-f1644699c703', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6084', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '18062026', NULL, NULL, NULL, '6084', 1727.68, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f50ae64-580b-5763-b610-a0905aaa2e4f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 1727.68, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 43). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f50ae64-580b-5763-b610-a0905aaa2e4f', '39ef28a2-b34d-53b3-81a1-f1644699c703');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7f50ae64-580b-5763-b610-a0905aaa2e4f', '39ef28a2-b34d-53b3-81a1-f1644699c703', DATE '2026-08-17', DATE '2026-07-13', 1727.68, 1727.68, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 44 | apLIS lote 6145 | AMHP-DF ("AMHPDF - STM" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67bf925c-3e16-53bd-a3b5-7da787cc46d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6145', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '23062026', NULL, NULL, NULL, '6145', 1792.66, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('96905c71-3e89-5ae0-8388-6f034636ccec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 1792.66, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 44). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('96905c71-3e89-5ae0-8388-6f034636ccec', '67bf925c-3e16-53bd-a3b5-7da787cc46d7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('96905c71-3e89-5ae0-8388-6f034636ccec', '67bf925c-3e16-53bd-a3b5-7da787cc46d7', DATE '2026-08-22', DATE '2026-07-13', 1792.66, 1792.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 45 | apLIS lote 6166 | AMHP-DF ("AMHPDF - STM" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('914076e2-8f6f-5ea2-951f-f469ed8cfd3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6166', DATE '2026-06-26', DATE '2026-06-26', 'Recebido', 4, '26062026', NULL, NULL, NULL, '6166', 898.61, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2e6cd6e4-574b-5888-8c91-c49ef88f34b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-26', DATE '2026-08-25', 898.61, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 45). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2e6cd6e4-574b-5888-8c91-c49ef88f34b2', '914076e2-8f6f-5ea2-951f-f469ed8cfd3a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2e6cd6e4-574b-5888-8c91-c49ef88f34b2', '914076e2-8f6f-5ea2-951f-f469ed8cfd3a', DATE '2026-08-25', DATE '2026-07-13', 898.61, 898.61, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 46 | apLIS lote 6014 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc78b52b-13ba-5f38-ba69-f4f091b5696d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6014', DATE '2026-06-10', DATE '2026-06-10', 'Faturado', 3, '10062026', NULL, NULL, NULL, '6014', 3031.48, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 3031.48, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 46). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', 'fc78b52b-13ba-5f38-ba69-f4f091b5696d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', 'fc78b52b-13ba-5f38-ba69-f4f091b5696d', DATE '2026-08-09', DATE '2026-07-13', 3031.48, 3031.48, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 47 | apLIS lote 6143 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3645dced-ebf7-5dc3-9e05-d07e7ec38439', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6143', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '23062026', NULL, NULL, NULL, '6143', 66.04, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('256f6a18-913b-500e-bdc1-5d6ca4ee8a66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 66.04, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 47). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('256f6a18-913b-500e-bdc1-5d6ca4ee8a66', '3645dced-ebf7-5dc3-9e05-d07e7ec38439');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('256f6a18-913b-500e-bdc1-5d6ca4ee8a66', '3645dced-ebf7-5dc3-9e05-d07e7ec38439', DATE '2026-08-22', DATE '2026-07-13', 66.04, 66.04, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 48 | apLIS lote 6024 | AMHP-DF ("AMHPDF - AFFEGO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3eafd34c-c943-5622-90c1-03ef01760a80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6024', DATE '2026-06-10', DATE '2026-06-10', 'Faturado', 3, '10062026', NULL, NULL, NULL, '6024', 1035.79, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('46691706-b4b1-512f-a20c-9cdde454e168', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 1035.79, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 48). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('46691706-b4b1-512f-a20c-9cdde454e168', '3eafd34c-c943-5622-90c1-03ef01760a80');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('46691706-b4b1-512f-a20c-9cdde454e168', '3eafd34c-c943-5622-90c1-03ef01760a80', DATE '2026-08-09', DATE '2026-07-13', 1035.79, 1035.79, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 49 | apLIS lote 6033 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f317f6ef-c671-523f-80c5-568c0ff9c2e7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6033', DATE '2026-06-11', DATE '2026-06-11', 'Recebido', 4, '11062026', NULL, NULL, NULL, '6033', 4611.46, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dc1cb607-a165-5e55-99b8-608cd1942322', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-11', DATE '2026-08-10', 4611.46, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 49). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dc1cb607-a165-5e55-99b8-608cd1942322', 'f317f6ef-c671-523f-80c5-568c0ff9c2e7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('dc1cb607-a165-5e55-99b8-608cd1942322', 'f317f6ef-c671-523f-80c5-568c0ff9c2e7', DATE '2026-08-10', DATE '2026-07-13', 4611.46, 4611.46, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 50 | apLIS lote 6080 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('884ffba2-12d8-5a35-94a3-44f041c89b9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6080', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '18062026', NULL, NULL, NULL, '6080', 831.95, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 831.95, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 50). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f', '884ffba2-12d8-5a35-94a3-44f041c89b9a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f', '884ffba2-12d8-5a35-94a3-44f041c89b9a', DATE '2026-08-17', DATE '2026-07-13', 831.95, 831.95, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 51 | apLIS lote 6173 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fb880277-f2d3-559f-80f7-2956fc3a86bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6173', DATE '2026-06-26', DATE '2026-06-26', 'Recebido', 4, '26062026', NULL, NULL, NULL, '6173', 1711.44, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-26', DATE '2026-08-25', 1711.44, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 51). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8', 'fb880277-f2d3-559f-80f7-2956fc3a86bf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8', 'fb880277-f2d3-559f-80f7-2956fc3a86bf', DATE '2026-08-25', DATE '2026-07-13', 1711.44, 1711.44, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 52 | apLIS lote 6015 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4db682d3-066b-5c1e-8df1-b3ac4b4a09f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6015', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '10062026', NULL, NULL, NULL, '6015', 2432.44, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c2ae92c-8e9b-5209-85d8-f317f9ee143f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 2432.44, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 52). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c2ae92c-8e9b-5209-85d8-f317f9ee143f', '4db682d3-066b-5c1e-8df1-b3ac4b4a09f4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3c2ae92c-8e9b-5209-85d8-f317f9ee143f', '4db682d3-066b-5c1e-8df1-b3ac4b4a09f4', DATE '2026-08-09', DATE '2026-07-13', 2432.44, 2432.44, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 53 | apLIS lote 6132 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('989bf314-bad6-510e-aa00-47c5c59916c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6132', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '22062023', NULL, NULL, NULL, '6132', 2707.48, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('848e2407-775f-565d-8344-ef94994cb7c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-22', DATE '2026-08-21', 2707.48, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 53). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('848e2407-775f-565d-8344-ef94994cb7c6', '989bf314-bad6-510e-aa00-47c5c59916c1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('848e2407-775f-565d-8344-ef94994cb7c6', '989bf314-bad6-510e-aa00-47c5c59916c1', DATE '2026-08-21', DATE '2026-07-13', 2707.48, 2707.48, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 54 | apLIS lote 6172 | AMHP-DF ("AMHPDF - PETROBRAS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80e5da63-b4c3-5285-a27a-6f92d2373724', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6172', DATE '2026-06-26', DATE '2026-06-26', 'Recebido', 4, '26062026', NULL, NULL, NULL, '6172', 120.60, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eaf7d55a-0596-5a02-a9ea-8772acf3650f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-26', DATE '2026-08-25', 120.60, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 54). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eaf7d55a-0596-5a02-a9ea-8772acf3650f', '80e5da63-b4c3-5285-a27a-6f92d2373724');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eaf7d55a-0596-5a02-a9ea-8772acf3650f', '80e5da63-b4c3-5285-a27a-6f92d2373724', DATE '2026-08-25', DATE '2026-07-13', 120.60, 120.60, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 55 | apLIS lote 5910 | AMHP-DF ("AMHPDF - PROASA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a5bac1fa-3112-5813-8d19-df4a728eecb0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5910', DATE '2026-05-28', DATE '2026-06-10', 'Recebido', 4, '44702008', NULL, NULL, NULL, '5910', 278.43, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('90e844ba-b60a-590c-b978-426bf536f51a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 278.43, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 55). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('90e844ba-b60a-590c-b978-426bf536f51a', 'a5bac1fa-3112-5813-8d19-df4a728eecb0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('90e844ba-b60a-590c-b978-426bf536f51a', 'a5bac1fa-3112-5813-8d19-df4a728eecb0', DATE '2026-08-09', DATE '2026-07-13', 278.43, 278.43, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 56 | apLIS lote 6026 | AMHP-DF ("AMHPDF - PROASA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('679c6043-4b2e-5f6a-9d30-7df5f5343de3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6026', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '44702011', NULL, NULL, NULL, '6026', 701.65, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('72f6423d-a0e2-52b6-b806-a05df9f1dcac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 701.65, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 56). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('72f6423d-a0e2-52b6-b806-a05df9f1dcac', '679c6043-4b2e-5f6a-9d30-7df5f5343de3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('72f6423d-a0e2-52b6-b806-a05df9f1dcac', '679c6043-4b2e-5f6a-9d30-7df5f5343de3', DATE '2026-08-09', DATE '2026-07-13', 701.65, 701.65, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 57 | apLIS lote 6058 | AMHP-DF ("AMHPDF - PROASA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4d5768ea-8ec7-5e92-8891-38e0ad25c7fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6058', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '44703709', NULL, NULL, NULL, '6058', 701.65, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('600bf95a-e36e-5078-8acc-c7271b8edbe2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-15', DATE '2026-08-14', 701.65, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('600bf95a-e36e-5078-8acc-c7271b8edbe2', '4d5768ea-8ec7-5e92-8891-38e0ad25c7fc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('600bf95a-e36e-5078-8acc-c7271b8edbe2', '4d5768ea-8ec7-5e92-8891-38e0ad25c7fc', DATE '2026-08-14', DATE '2026-07-13', 701.65, 701.65, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 58 | apLIS lote 6025 | AMHP-DF ("AMHPDF - PROASA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a4b19604-b64b-5aee-a4c6-a0c4db2e1cc2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6025', DATE '2026-06-10', DATE '2026-06-10', 'Faturado', 3, '44702037', NULL, NULL, NULL, '6025', 2024.81, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 2024.81, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 58). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', 'a4b19604-b64b-5aee-a4c6-a0c4db2e1cc2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', 'a4b19604-b64b-5aee-a4c6-a0c4db2e1cc2', DATE '2026-08-09', DATE '2026-07-13', 2024.81, 2024.81, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 59 | apLIS lote 6137 | AMHP-DF ("AMHPDF - PROASA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e76328a8-1f06-5660-98e1-da72a4f74874', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6137', DATE '2026-06-23', DATE '2026-06-23', 'Faturado', 3, '44706220', NULL, NULL, NULL, '6137', 4106.67, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 4106.67, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 59). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', 'e76328a8-1f06-5660-98e1-da72a4f74874');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', 'e76328a8-1f06-5660-98e1-da72a4f74874', DATE '2026-08-22', DATE '2026-07-13', 4106.67, 4106.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 60 | apLIS lote 6177 | AMHP-DF ("AMHPDF - PROASA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('23093347-1e4a-5140-83ab-5d09350e61e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6177', DATE '2026-06-26', DATE '2026-06-26', 'Faturado', 3, '44708020', NULL, NULL, NULL, '6177', 3866.91, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-26', DATE '2026-08-25', 3866.91, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 60). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', '23093347-1e4a-5140-83ab-5d09350e61e9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', '23093347-1e4a-5140-83ab-5d09350e61e9', DATE '2026-08-25', DATE '2026-07-13', 3866.91, 3866.91, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 61 | apLIS lote 6016 | AMHP-DF ("AMHPDF - HAPVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8217899-f47c-58fd-9379-7cca62d29ab1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6016', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '44701872', NULL, NULL, NULL, '6016', 1270.00, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb0f0433-3b49-5b94-a276-c1accb2c76e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 1270.00, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 61). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb0f0433-3b49-5b94-a276-c1accb2c76e9', 'a8217899-f47c-58fd-9379-7cca62d29ab1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bb0f0433-3b49-5b94-a276-c1accb2c76e9', 'a8217899-f47c-58fd-9379-7cca62d29ab1', DATE '2026-08-09', DATE '2026-07-13', 1270.00, 1270.00, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 62 | apLIS lote 5907 | AMHP-DF ("AMHPDF - HAPVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b8b23715-042e-502c-8c0d-87703c6c0128', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5907', DATE '2026-05-28', DATE '2026-06-10', 'Recebido', 4, '44702083', NULL, NULL, NULL, '5907', 1905.00, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b287032-5327-59df-9b73-c2fe75bcb567', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 1905.00, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 62). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b287032-5327-59df-9b73-c2fe75bcb567', 'b8b23715-042e-502c-8c0d-87703c6c0128');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5b287032-5327-59df-9b73-c2fe75bcb567', 'b8b23715-042e-502c-8c0d-87703c6c0128', DATE '2026-08-09', DATE '2026-07-13', 1905.00, 1905.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 63 | apLIS lote 6140 | AMHP-DF ("AMHPDF - HAPVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('644a06e0-40be-5f7b-806a-65315fb8d054', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6140', DATE '2026-06-23', DATE '2026-06-23', 'Faturado', 3, '44706243', NULL, NULL, NULL, '6140', 1554.64, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('37da0817-5300-5619-805f-257b35e6b024', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 1554.64, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 63). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('37da0817-5300-5619-805f-257b35e6b024', '644a06e0-40be-5f7b-806a-65315fb8d054');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('37da0817-5300-5619-805f-257b35e6b024', '644a06e0-40be-5f7b-806a-65315fb8d054', DATE '2026-08-22', DATE '2026-07-13', 1554.64, 1554.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 64 | apLIS lote 6021 | AMHP-DF ("AMHPDF - OMINT" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4ba0f344-645f-5071-8754-ba80b4ba084c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6021', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '44701962', NULL, NULL, NULL, '6021', 2351.49, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5f591fc6-2a0a-5483-8342-b459b41ba5c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 2351.49, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 64). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5f591fc6-2a0a-5483-8342-b459b41ba5c6', '4ba0f344-645f-5071-8754-ba80b4ba084c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5f591fc6-2a0a-5483-8342-b459b41ba5c6', '4ba0f344-645f-5071-8754-ba80b4ba084c', DATE '2026-08-09', DATE '2026-07-13', 2351.49, 2351.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 65 | apLIS lote 5905 | AMHP-DF ("AMHPDF - OMINT PEND 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bf36acb1-40b5-5cd9-a242-37cf2388dbd3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5905', DATE '2026-05-28', DATE '2026-06-10', 'Faturado', 3, '44702100', NULL, NULL, NULL, '5905', 989.23, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff31a886-bcf4-5d22-a532-feb1a22a4fd3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 989.23, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 65). Responsável: Rivia. Status original na planilha: GLOSA - INATIVO.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff31a886-bcf4-5d22-a532-feb1a22a4fd3', 'bf36acb1-40b5-5cd9-a242-37cf2388dbd3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ff31a886-bcf4-5d22-a532-feb1a22a4fd3', 'bf36acb1-40b5-5cd9-a242-37cf2388dbd3', DATE '2026-08-09', 989.23, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 66 | apLIS lote 6142 | AMHP-DF ("AMHPDF - OMINT" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5a5c1409-ef67-55b6-b9cc-405eb983de68', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6142', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '44706263', NULL, NULL, NULL, '6142', 1028.75, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b28b531-6a1b-540e-a257-03ba040e82f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 1028.75, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 66). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b28b531-6a1b-540e-a257-03ba040e82f4', '5a5c1409-ef67-55b6-b9cc-405eb983de68');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9b28b531-6a1b-540e-a257-03ba040e82f4', '5a5c1409-ef67-55b6-b9cc-405eb983de68', DATE '2026-08-22', DATE '2026-07-13', 1028.75, 1028.75, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 67 | apLIS lote 5902 | AMHP-DF ("AMHPDF - BACEN PEND 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc878576-073e-542f-98b8-5897f6e8ad82', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5902', DATE '2026-05-27', DATE '2026-06-10', 'Recebido', 4, '10062026', NULL, NULL, NULL, '5902', 3408.49, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-10', DATE '2026-08-09', 3408.49, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 67). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', 'bc878576-073e-542f-98b8-5897f6e8ad82');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', 'bc878576-073e-542f-98b8-5897f6e8ad82', DATE '2026-08-09', DATE '2026-07-13', 3408.49, 3408.49, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 68 | apLIS lote 6039 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6155a38b-5f67-5ead-b6e2-c76c7c6818d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6039', DATE '2026-06-11', DATE '2026-06-11', 'Faturado', 3, '11062026', NULL, NULL, NULL, '6039', 9743.49, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-11', DATE '2026-08-10', 9743.49, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 68). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a', '6155a38b-5f67-5ead-b6e2-c76c7c6818d6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a', '6155a38b-5f67-5ead-b6e2-c76c7c6818d6', DATE '2026-08-10', DATE '2026-07-13', 9743.49, 9743.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 69 | apLIS lote 6038 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc343d81-9289-5ade-b445-2835dbcb7d27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6038', DATE '2026-06-11', DATE '2026-06-12', 'Recebido', 4, '12062026', NULL, NULL, NULL, '6038', 13157.35, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('de002ae5-0e65-506e-91f1-7e34d8762a7a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-12', DATE '2026-08-11', 13157.35, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 69). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('de002ae5-0e65-506e-91f1-7e34d8762a7a', 'fc343d81-9289-5ade-b445-2835dbcb7d27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('de002ae5-0e65-506e-91f1-7e34d8762a7a', 'fc343d81-9289-5ade-b445-2835dbcb7d27', DATE '2026-08-11', DATE '2026-07-13', 13157.35, 13157.35, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 70 | apLIS lote 6076 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('954b342c-b385-5c89-9682-dad94a0ef896', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6076', DATE '2026-06-17', DATE '2026-06-18', 'Faturado', 3, '18062026', NULL, NULL, NULL, '6076', 6154.11, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c88b53a-6496-52b4-8197-40dbfacaf957', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 6154.11, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 70). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c88b53a-6496-52b4-8197-40dbfacaf957', '954b342c-b385-5c89-9682-dad94a0ef896');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0c88b53a-6496-52b4-8197-40dbfacaf957', '954b342c-b385-5c89-9682-dad94a0ef896', DATE '2026-08-17', DATE '2026-07-13', 6154.11, 6154.11, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 71 | apLIS lote 6091 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c6f29977-d429-5937-b5ee-148a1767272d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6091', DATE '2026-06-18', DATE '2026-06-18', 'Faturado', 3, '18062026', NULL, NULL, NULL, '6091', 1009.95, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('78a5fd39-bb5d-5c14-a518-93513d3209f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-18', DATE '2026-08-17', 1009.95, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 71). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('78a5fd39-bb5d-5c14-a518-93513d3209f6', 'c6f29977-d429-5937-b5ee-148a1767272d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('78a5fd39-bb5d-5c14-a518-93513d3209f6', 'c6f29977-d429-5937-b5ee-148a1767272d', DATE '2026-08-17', DATE '2026-07-13', 1009.95, 1009.95, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 72 | apLIS lote 6125 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33dc0d1d-f486-5d18-a1ab-a4bac747580b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6125', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '22062026', NULL, NULL, NULL, '6125', 3868.09, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65ca2223-8f2a-5358-9a72-0c20a1383b28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-22', DATE '2026-08-21', 3868.09, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 72). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65ca2223-8f2a-5358-9a72-0c20a1383b28', '33dc0d1d-f486-5d18-a1ab-a4bac747580b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('65ca2223-8f2a-5358-9a72-0c20a1383b28', '33dc0d1d-f486-5d18-a1ab-a4bac747580b', DATE '2026-08-21', DATE '2026-07-13', 3868.09, 3868.09, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 73 | apLIS lote 6161 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ee41295f-1bb6-51bb-b353-5c4027b02967', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6161', DATE '2026-06-25', DATE '2026-06-25', 'Faturado', 3, '25062026', NULL, NULL, NULL, '6161', 3265.29, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65828bec-9138-5f08-a19c-537674affcbc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-25', DATE '2026-08-24', 3265.29, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 73). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65828bec-9138-5f08-a19c-537674affcbc', 'ee41295f-1bb6-51bb-b353-5c4027b02967');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('65828bec-9138-5f08-a19c-537674affcbc', 'ee41295f-1bb6-51bb-b353-5c4027b02967', DATE '2026-08-24', DATE '2026-07-13', 3265.29, 3265.29, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 74 | apLIS lote 6144 | AMHP-DF ("AMHPDF - CAMED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67bf1b52-8e6e-5d20-9bca-78b92e2160dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6144', DATE '2026-06-23', DATE '2026-06-23', 'Faturado', 3, '23062026', NULL, NULL, NULL, '6144', 812.50, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-06-23', DATE '2026-08-22', 812.50, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 74). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418', '67bf1b52-8e6e-5d20-9bca-78b92e2160dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418', '67bf1b52-8e6e-5d20-9bca-78b92e2160dc', DATE '2026-08-22', DATE '2026-07-13', 812.50, 812.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 75 | apLIS lote 5936 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('adc7ac79-062a-5141-8e87-1a66f5d53382', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5936', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '5758841861', '8700', 8680, DATE '2026-07-16', '5936', 1605.80, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b85c3d08-d70d-5752-a812-90f673df7295', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8700', DATE '2026-06-01', DATE '2026-07-01', 1605.80, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 75). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b85c3d08-d70d-5752-a812-90f673df7295', 'adc7ac79-062a-5141-8e87-1a66f5d53382');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b85c3d08-d70d-5752-a812-90f673df7295', 'adc7ac79-062a-5141-8e87-1a66f5d53382', DATE '2026-07-01', DATE '2026-07-02', 1605.80, 1605.08, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 76 | apLIS lote 5937 | AMIL ("AMIL PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('12278ef7-5131-5209-b463-38af24301343', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5937', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '5759183075', '8700', 8680, DATE '2026-07-16', '5937', 766.90, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c7f2c9a5-ed87-533b-baf4-f1bd4c5ab082', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8700', DATE '2026-06-01', DATE '2026-07-01', 766.90, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 76). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c7f2c9a5-ed87-533b-baf4-f1bd4c5ab082', '12278ef7-5131-5209-b463-38af24301343');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c7f2c9a5-ed87-533b-baf4-f1bd4c5ab082', '12278ef7-5131-5209-b463-38af24301343', DATE '2026-07-01', DATE '2026-07-02', 766.90, 766.90, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 77 | apLIS lote 5935 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('76aa0cec-d34e-5fda-b2c8-6c9df87bdb38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5935', DATE '2026-06-01', DATE '2026-06-01', 'Recebido - parcial', 7, '5758585145', '8700', 8680, DATE '2026-07-16', '5935', 409.04, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8700', DATE '2026-06-01', DATE '2026-07-01', 409.04, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 77). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', '76aa0cec-d34e-5fda-b2c8-6c9df87bdb38');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', '76aa0cec-d34e-5fda-b2c8-6c9df87bdb38', DATE '2026-07-01', DATE '2026-07-02', 409.04, 409.04, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', '76aa0cec-d34e-5fda-b2c8-6c9df87bdb38', 204.52, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- JUNHO linha 78 | apLIS lote 5930 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('218a0650-c408-5e23-a0a6-585512ac83f3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5930', DATE '2026-06-01', DATE '2026-06-01', 'Recebido - parcial', 7, '5758200298', '8700', 8680, DATE '2026-07-16', '5930', 9029.53, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8700', DATE '2026-06-01', DATE '2026-07-01', 9029.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 78). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', '218a0650-c408-5e23-a0a6-585512ac83f3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', '218a0650-c408-5e23-a0a6-585512ac83f3', DATE '2026-07-01', DATE '2026-07-02', 9029.53, 9029.53, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', '218a0650-c408-5e23-a0a6-585512ac83f3', 565.45, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Renata');

-- JUNHO linha 79 | apLIS lote 5899 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fe6a3e02-d674-5aab-b8be-a60668be2c84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5899', DATE '2026-05-27', DATE '2026-06-01', 'Recebido', 4, '5757531480', '8700', 8680, DATE '2026-07-16', '5899', 1076.90, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7bbea3c4-b279-5b11-83d0-43f0180eab9b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8700', DATE '2026-06-01', DATE '2026-07-01', 1076.90, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 79). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7bbea3c4-b279-5b11-83d0-43f0180eab9b', 'fe6a3e02-d674-5aab-b8be-a60668be2c84');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7bbea3c4-b279-5b11-83d0-43f0180eab9b', 'fe6a3e02-d674-5aab-b8be-a60668be2c84', DATE '2026-07-01', DATE '2026-07-02', 1076.90, 1076.90, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 80 | apLIS lote 5970 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d08ac653-6100-59ad-9f85-c76f72dcf9dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5970', DATE '2026-06-03', DATE '2026-06-03', 'Recebido', 4, '5770136136', '8701', 8681, DATE '2026-07-16', '5970', 1333.80, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c295ded8-4c0c-5af6-b9be-0a3145363f74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8701', DATE '2026-06-03', DATE '2026-07-03', 1333.80, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 80). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c295ded8-4c0c-5af6-b9be-0a3145363f74', 'd08ac653-6100-59ad-9f85-c76f72dcf9dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c295ded8-4c0c-5af6-b9be-0a3145363f74', 'd08ac653-6100-59ad-9f85-c76f72dcf9dc', DATE '2026-07-03', DATE '2026-07-03', 1333.80, 1333.80, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 81 | apLIS lote 6050 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8b41ac7f-9237-5943-a017-f2044f21d206', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6050', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '5786747224', '8737', 8717, DATE '2026-09-30', '6050', 2883.32, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd1a311f-c8a5-5424-b0d6-a4e7a891df10', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8737', DATE '2026-06-15', DATE '2026-07-15', 2883.32, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 81). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd1a311f-c8a5-5424-b0d6-a4e7a891df10', '8b41ac7f-9237-5943-a017-f2044f21d206');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bd1a311f-c8a5-5424-b0d6-a4e7a891df10', '8b41ac7f-9237-5943-a017-f2044f21d206', DATE '2026-07-15', DATE '2026-07-15', 2883.32, 2883.32, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 82 | apLIS lote 6123 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ef45373-e74e-599e-b118-1cc4899a196e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6123', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '5793409706', '8882', 8862, DATE '2026-07-31', '6123', 684.95, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f4746ead-db9a-5110-8ae4-5b7c030bfae1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '8882', DATE '2026-06-22', DATE '2026-07-22', 684.95, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 82). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f4746ead-db9a-5110-8ae4-5b7c030bfae1', '0ef45373-e74e-599e-b118-1cc4899a196e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f4746ead-db9a-5110-8ae4-5b7c030bfae1', '0ef45373-e74e-599e-b118-1cc4899a196e', DATE '2026-07-22', DATE '2026-07-15', 684.95, 684.95, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 83 | apLIS lote 5931 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('998a3d60-fc24-5c3e-bd01-7265e8be6575', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5931', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '1426165', '8690', 8670, DATE '2026-09-30', '5931', 15937.92, 78);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f1cd7abc-97b2-5628-8f17-353b82a8012a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-01', DATE '2026-07-20', 15937.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 83). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f1cd7abc-97b2-5628-8f17-353b82a8012a', '998a3d60-fc24-5c3e-bd01-7265e8be6575');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f1cd7abc-97b2-5628-8f17-353b82a8012a', '998a3d60-fc24-5c3e-bd01-7265e8be6575', DATE '2026-07-20', DATE '2026-08-07', 15937.92, 15937.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 84 | apLIS lote 5726 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('14369719-0b7c-5930-8f78-0ad2ca3279b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5726', DATE '2026-05-11', DATE '2026-06-01', 'Recebido', 4, '1425405', '8690', 8670, DATE '2026-09-30', '5726', 3756.80, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('55778b96-e5f1-58c1-920a-5b337cf023a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-01', DATE '2026-07-20', 3756.80, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 84). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('55778b96-e5f1-58c1-920a-5b337cf023a5', '14369719-0b7c-5930-8f78-0ad2ca3279b7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('55778b96-e5f1-58c1-920a-5b337cf023a5', '14369719-0b7c-5930-8f78-0ad2ca3279b7', DATE '2026-07-20', DATE '2026-08-07', 3756.80, 3756.80, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 85 | apLIS lote 5932 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce67a447-ea8c-5dca-9961-7f1d0c36809d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5932', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '1426686', '8690', 8670, DATE '2026-09-30', '5932', 17276.25, 82);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('153bdc77-6201-5264-bddd-02ab0bfc3ec6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-01', DATE '2026-07-20', 17276.25, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 85). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('153bdc77-6201-5264-bddd-02ab0bfc3ec6', 'ce67a447-ea8c-5dca-9961-7f1d0c36809d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('153bdc77-6201-5264-bddd-02ab0bfc3ec6', 'ce67a447-ea8c-5dca-9961-7f1d0c36809d', DATE '2026-07-20', DATE '2026-08-07', 17276.25, 17276.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 87 | apLIS lote 5933 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b8a727fd-2cc2-5f3a-90e7-98e615a82b79', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5933', DATE '2026-06-01', DATE '2026-06-02', 'Recebido', 4, '1427816', '8690', 8670, DATE '2026-09-30', '5933', 12608.38, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('78fe5024-1d2a-52df-9423-2b60d62c9f9c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-02', DATE '2026-07-20', 12608.38, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 87). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('78fe5024-1d2a-52df-9423-2b60d62c9f9c', 'b8a727fd-2cc2-5f3a-90e7-98e615a82b79');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('78fe5024-1d2a-52df-9423-2b60d62c9f9c', 'b8a727fd-2cc2-5f3a-90e7-98e615a82b79', DATE '2026-07-20', DATE '2026-08-07', 12608.38, 12608.38, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 88 | apLIS lote 5941 | ASSEFAZ ("ASSEFAZ PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1dab332-d3b7-56de-9515-da4e448b0688', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5941', DATE '2026-06-01', DATE '2026-06-02', 'Faturado', 3, '1428394', '8690', 8670, DATE '2026-09-30', '5941', 1374.21, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85c2b760-da00-58d3-b471-f5e2529e2ee2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-02', DATE '2026-07-20', 1374.21, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 88). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85c2b760-da00-58d3-b471-f5e2529e2ee2', 'b1dab332-d3b7-56de-9515-da4e448b0688');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85c2b760-da00-58d3-b471-f5e2529e2ee2', 'b1dab332-d3b7-56de-9515-da4e448b0688', DATE '2026-07-20', DATE '2026-08-07', 1374.21, 1056.04, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('85c2b760-da00-58d3-b471-f5e2529e2ee2', 'b1dab332-d3b7-56de-9515-da4e448b0688', 318.17, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 89 | apLIS lote 5934 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed9c2af4-9378-53ec-b5be-2bcbc72df0a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5934', DATE '2026-06-01', DATE '2026-06-02', 'Faturado', 3, '1428345', '8690', 8670, DATE '2026-09-30', '5934', 2758.23, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('20a77b37-ce84-5af7-b05a-66a4ad13e529', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-02', DATE '2026-07-20', 2758.23, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 89). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('20a77b37-ce84-5af7-b05a-66a4ad13e529', 'ed9c2af4-9378-53ec-b5be-2bcbc72df0a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('20a77b37-ce84-5af7-b05a-66a4ad13e529', 'ed9c2af4-9378-53ec-b5be-2bcbc72df0a5', DATE '2026-07-20', DATE '2026-08-07', 2758.23, 2758.23, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 90 | apLIS lote 5946 | ASSEFAZ ("ASSEFAZ PENDÊNCIA - 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('95ab26c0-ea1e-58de-b6a8-0f0bd70db917', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5946', DATE '2026-06-02', DATE '2026-06-02', 'Recebido', 4, '1429312', '8690', 8670, DATE '2026-09-30', '5946', 3527.71, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-02', DATE '2026-07-20', 3527.71, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 90). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc', '95ab26c0-ea1e-58de-b6a8-0f0bd70db917');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc', '95ab26c0-ea1e-58de-b6a8-0f0bd70db917', DATE '2026-07-20', DATE '2026-08-07', 3527.71, 3096.97, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc', '95ab26c0-ea1e-58de-b6a8-0f0bd70db917', 430.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 91 | apLIS lote 5949 | ASSEFAZ ("ASSEFAZ PENDÊNCIA - 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b133a143-c970-55f3-9544-5c49821cdc95', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5949', DATE '2026-06-02', DATE '2026-06-02', 'Faturado', 3, '1429665', '8690', 8670, DATE '2026-09-30', '5949', 3199.28, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-02', DATE '2026-07-20', 3199.28, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 91). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', 'b133a143-c970-55f3-9544-5c49821cdc95');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', 'b133a143-c970-55f3-9544-5c49821cdc95', DATE '2026-07-20', DATE '2026-08-07', 3199.28, 3003.85, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', 'b133a143-c970-55f3-9544-5c49821cdc95', 195.43, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 92 | apLIS lote 5957 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1f045de0-f55c-5f15-b259-bcd72deab850', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5957', DATE '2026-06-03', DATE '2026-06-03', 'Recebido', 4, '1431150', '8690', 8670, DATE '2026-09-30', '5957', 4182.76, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4ec8996c-e900-5542-bebf-251340cd143c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-03', DATE '2026-07-20', 4182.76, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 92). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4ec8996c-e900-5542-bebf-251340cd143c', '1f045de0-f55c-5f15-b259-bcd72deab850');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4ec8996c-e900-5542-bebf-251340cd143c', '1f045de0-f55c-5f15-b259-bcd72deab850', DATE '2026-07-20', DATE '2026-08-07', 4182.76, 4182.76, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 93 | apLIS lote 5700 | ASSEFAZ ("ASSEFAZ PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('08fd280a-63e2-5883-9edb-0d5be65a4c00', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '5700', DATE '2026-05-08', DATE '2026-06-03', 'Recebido', 4, '1463572', '8690', 8670, DATE '2026-09-30', '5700', 2638.37, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1f937a9e-0a3a-5b7c-a7c4-f34d1f93ec5f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '8690', DATE '2026-06-03', DATE '2026-07-20', 2638.37, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 93). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1f937a9e-0a3a-5b7c-a7c4-f34d1f93ec5f', '08fd280a-63e2-5883-9edb-0d5be65a4c00');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1f937a9e-0a3a-5b7c-a7c4-f34d1f93ec5f', '08fd280a-63e2-5883-9edb-0d5be65a4c00', DATE '2026-07-20', DATE '2026-08-07', 2638.37, 2638.37, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 94 | apLIS lote 5858 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a22de77-ca79-51cd-91ad-10f5f7fab882', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5858', DATE '2026-05-25', DATE '2026-06-11', 'Recebido', 4, '340228415367_0', NULL, NULL, NULL, '5858', 20341.70, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('688ef7f1-d942-567c-a94e-0ccf1f911b72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-16', DATE '2026-08-15', 20341.70, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 94). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('688ef7f1-d942-567c-a94e-0ccf1f911b72', '0a22de77-ca79-51cd-91ad-10f5f7fab882');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('688ef7f1-d942-567c-a94e-0ccf1f911b72', '0a22de77-ca79-51cd-91ad-10f5f7fab882', DATE '2026-08-15', DATE '2026-07-22', 20341.70, 20341.70, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 95 | apLIS lote 5859 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('55e5888c-24bc-56d4-af6e-e5c9639a3fd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5859', DATE '2026-05-25', DATE '2026-06-11', 'Recebido', 4, '340228415366_0', NULL, NULL, NULL, '5859', 18418.07, 39);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f4e0a20-42c6-5d68-9b7b-ae9aae9751c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-16', DATE '2026-08-15', 18418.07, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 95). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f4e0a20-42c6-5d68-9b7b-ae9aae9751c9', '55e5888c-24bc-56d4-af6e-e5c9639a3fd4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3f4e0a20-42c6-5d68-9b7b-ae9aae9751c9', '55e5888c-24bc-56d4-af6e-e5c9639a3fd4', DATE '2026-08-15', DATE '2026-07-22', 18418.07, 18418.07, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 96 | apLIS lote 6032 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('47bb57a8-2abb-5c93-b643-70843cf045ff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6032', DATE '2026-06-11', DATE '2026-06-11', 'Recebido', 4, '340228424904_0', NULL, NULL, NULL, '6032', 31722.24, 79);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('20137fa4-0940-5e87-bc86-902a93dd7426', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-16', DATE '2026-08-15', 31722.24, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 96). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('20137fa4-0940-5e87-bc86-902a93dd7426', '47bb57a8-2abb-5c93-b643-70843cf045ff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('20137fa4-0940-5e87-bc86-902a93dd7426', '47bb57a8-2abb-5c93-b643-70843cf045ff', DATE '2026-08-15', DATE '2026-07-22', 31722.24, 31722.24, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 97 | apLIS lote 6029 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d9e808f2-d611-5757-83b7-f23f601d6dd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6029', DATE '2026-06-11', DATE '2026-06-15', 'Recebido', 4, '341228483417_0', '9266', 9250, DATE '2026-10-25', '6029', 3380.97, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1372b251-50c6-5983-b687-2f02575d4dcf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '9266', DATE '2026-06-16', DATE '2026-08-15', 3380.97, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 97). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1372b251-50c6-5983-b687-2f02575d4dcf', 'd9e808f2-d611-5757-83b7-f23f601d6dd4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1372b251-50c6-5983-b687-2f02575d4dcf', 'd9e808f2-d611-5757-83b7-f23f601d6dd4', DATE '2026-08-15', DATE '2026-07-28', 3380.97, 3380.97, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 98 | apLIS lote 6030 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dbe16625-2b0f-55b0-b8f4-5484ad51fd2f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6030', DATE '2026-06-11', DATE '2026-06-12', 'Faturado', 3, '341228456574_0', '9049', 9031, DATE '2026-08-19', '6030', 21502.10, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('151a1781-0b6f-5da8-a746-c11c210a7dc1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '9049', DATE '2026-06-17', DATE '2026-08-16', 21502.10, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 98). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('151a1781-0b6f-5da8-a746-c11c210a7dc1', 'dbe16625-2b0f-55b0-b8f4-5484ad51fd2f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('151a1781-0b6f-5da8-a746-c11c210a7dc1', 'dbe16625-2b0f-55b0-b8f4-5484ad51fd2f', DATE '2026-08-16', DATE '2026-08-18', 21502.10, 21502.10, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 99 | apLIS lote 6031 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6031', DATE '2026-06-11', DATE '2026-06-12', 'Recebido - parcial', 7, '340228469965_0', NULL, NULL, NULL, '6031', 15316.15, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-17', DATE '2026-08-16', 15316.15, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 99). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', DATE '2026-08-16', DATE '2026-07-22', 15316.15, 11733.91, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 3582.24, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 100 | apLIS lote 6035 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8acf469-7348-5d07-8a72-f6b027cb3b16', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6035', DATE '2026-06-11', DATE '2026-06-12', 'Recebido', 4, '340228451198_0', NULL, NULL, NULL, '6035', 18706.94, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('56314685-bfaf-5e9c-a875-caeac6bf0f90', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-17', DATE '2026-08-16', 18706.94, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 100). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('56314685-bfaf-5e9c-a875-caeac6bf0f90', 'a8acf469-7348-5d07-8a72-f6b027cb3b16');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('56314685-bfaf-5e9c-a875-caeac6bf0f90', 'a8acf469-7348-5d07-8a72-f6b027cb3b16', DATE '2026-08-16', DATE '2026-07-23', 18706.94, 18706.94, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 101 | apLIS lote 6036 | BRADESCO SAUDE  - 005711 ("BRADESCO PENDÊNCIA 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea0e8608-a86f-5992-a6ef-458e44f64bf2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6036', DATE '2026-06-11', DATE '2026-06-17', 'Recebido - parcial', 7, '340228570924_0', NULL, NULL, NULL, '6036', 676.20, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('860c1a62-326f-5657-94c3-908eb45714f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-17', DATE '2026-08-16', 676.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 101). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('860c1a62-326f-5657-94c3-908eb45714f7', 'ea0e8608-a86f-5992-a6ef-458e44f64bf2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('860c1a62-326f-5657-94c3-908eb45714f7', 'ea0e8608-a86f-5992-a6ef-458e44f64bf2', DATE '2026-08-16', DATE '2026-07-27', 676.20, 351.42, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('860c1a62-326f-5657-94c3-908eb45714f7', 'ea0e8608-a86f-5992-a6ef-458e44f64bf2', 324.78, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 102 | apLIS lote 6081 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2ac089e-c216-5d50-9a4d-49debd2d61b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6081', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '340228616601_0', NULL, NULL, NULL, '6081', 635.12, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e3a4cc04-1451-54fb-b784-9cdb21e01236', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-18', DATE '2026-08-17', 635.12, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 102). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e3a4cc04-1451-54fb-b784-9cdb21e01236', 'e2ac089e-c216-5d50-9a4d-49debd2d61b0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e3a4cc04-1451-54fb-b784-9cdb21e01236', 'e2ac089e-c216-5d50-9a4d-49debd2d61b0', DATE '2026-08-17', DATE '2026-07-29', 635.12, 635.12, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 103 | apLIS lote 6097 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('395e5124-de78-5e76-ad84-adc87c507c16', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6097', DATE '2026-06-19', DATE '2026-06-19', 'Recebido', 4, '340228658540_0', '8975', 8956, DATE '2026-10-31', '6097', 26129.64, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8a253a0f-9edb-53a5-bdb1-c4751d0de34a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8975', DATE '2026-06-19', DATE '2026-08-18', 26129.64, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 103). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8a253a0f-9edb-53a5-bdb1-c4751d0de34a', '395e5124-de78-5e76-ad84-adc87c507c16');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8a253a0f-9edb-53a5-bdb1-c4751d0de34a', '395e5124-de78-5e76-ad84-adc87c507c16', DATE '2026-08-18', DATE '2026-08-04', 26129.64, 26129.64, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 104 | apLIS lote 6101 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d6ffa00b-8c87-5af3-a9f8-2acf43e885e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6101', DATE '2026-06-19', DATE '2026-06-19', 'Recebido - parcial', 7, '340228674141_0', NULL, NULL, NULL, '6101', 8680.06, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0994b648-3d91-5c33-8f88-07579bc905bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-19', DATE '2026-08-18', 8680.06, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 104). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0994b648-3d91-5c33-8f88-07579bc905bf', 'd6ffa00b-8c87-5af3-a9f8-2acf43e885e3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0994b648-3d91-5c33-8f88-07579bc905bf', 'd6ffa00b-8c87-5af3-a9f8-2acf43e885e3', DATE '2026-08-18', DATE '2026-07-30', 8680.06, 8680.06, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 105 | apLIS lote 6107 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7b3f4ce9-d68a-543b-b6b3-6de4b5b5ad62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6107', DATE '2026-06-19', DATE '2026-06-19', 'Faturado', 3, '341228676109_0', NULL, NULL, NULL, '6107', 10707.92, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('647fe66a-7267-5f4b-89c2-8ae2852075c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-06-19', DATE '2026-08-18', 10707.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 105). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('647fe66a-7267-5f4b-89c2-8ae2852075c0', '7b3f4ce9-d68a-543b-b6b3-6de4b5b5ad62');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('647fe66a-7267-5f4b-89c2-8ae2852075c0', '7b3f4ce9-d68a-543b-b6b3-6de4b5b5ad62', DATE '2026-08-18', DATE '2026-07-30', 10707.92, 10707.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 106 | apLIS lote 6108 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('15c4f7bb-b967-5005-9465-4f576b148960', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6108', DATE '2026-06-19', DATE '2026-06-19', 'Recebido - parcial', 7, '340228678829_0', NULL, NULL, NULL, '6108', 8185.99, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-19', DATE '2026-08-18', 8185.99, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 106). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', '15c4f7bb-b967-5005-9465-4f576b148960');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', '15c4f7bb-b967-5005-9465-4f576b148960', DATE '2026-08-18', DATE '2026-07-30', 8185.99, 7902.46, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', '15c4f7bb-b967-5005-9465-4f576b148960', 283.53, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 107 | apLIS lote 6099 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7f49ddef-96de-5a48-96b3-c84ebe86555d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6099', DATE '2026-06-19', DATE '2026-06-19', 'Recebido - parcial', 7, '340228659337_0', NULL, NULL, NULL, '6099', 8263.22, 18);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-22', DATE '2026-08-21', 8263.22, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 107). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', '7f49ddef-96de-5a48-96b3-c84ebe86555d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', '7f49ddef-96de-5a48-96b3-c84ebe86555d', DATE '2026-08-21', DATE '2026-07-29', 8263.22, 8263.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', '7f49ddef-96de-5a48-96b3-c84ebe86555d', 661.57, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- JUNHO linha 108 | apLIS lote 6100 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce5a8fdb-f4b6-569a-a91f-f3b4528370b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6100', DATE '2026-06-19', DATE '2026-06-19', 'Recebido', 4, '340228662610_0', NULL, NULL, NULL, '6100', 309.74, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ee5da3d7-1a9f-5e7b-8e92-3ef958d82378', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-22', DATE '2026-08-21', 309.74, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 108). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ee5da3d7-1a9f-5e7b-8e92-3ef958d82378', 'ce5a8fdb-f4b6-569a-a91f-f3b4528370b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ee5da3d7-1a9f-5e7b-8e92-3ef958d82378', 'ce5a8fdb-f4b6-569a-a91f-f3b4528370b8', DATE '2026-08-21', DATE '2026-07-30', 309.74, 309.74, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 109 | apLIS lote 6102 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0644a2b7-2edd-5ca0-8b11-c797aca942a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6102', DATE '2026-06-19', DATE '2026-06-19', 'Faturado', 3, '341228665228_0', NULL, NULL, NULL, '6102', 1323.89, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e22504af-6476-5078-a1f8-adce9a86ee9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-06-22', DATE '2026-08-21', 1323.89, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 109). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e22504af-6476-5078-a1f8-adce9a86ee9d', '0644a2b7-2edd-5ca0-8b11-c797aca942a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e22504af-6476-5078-a1f8-adce9a86ee9d', '0644a2b7-2edd-5ca0-8b11-c797aca942a5', DATE '2026-08-21', DATE '2026-07-30', 1323.89, 1323.89, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 110 | apLIS lote 6119 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b66ca9a-e182-53ec-90f6-f18296a1962b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6119', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '340228754729_0', NULL, NULL, NULL, '6119', 1040.25, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('413814f7-a787-5e07-b850-beb70bab6a64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-22', DATE '2026-08-21', 1040.25, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 110). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('413814f7-a787-5e07-b850-beb70bab6a64', '5b66ca9a-e182-53ec-90f6-f18296a1962b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('413814f7-a787-5e07-b850-beb70bab6a64', '5b66ca9a-e182-53ec-90f6-f18296a1962b', DATE '2026-08-21', DATE '2026-07-30', 1040.25, 1040.25, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 111 | apLIS lote 6034 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('09ca9187-96be-5a2b-ae22-3df502d9322b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6034', DATE '2026-06-11', DATE '2026-06-16', 'Recebido - parcial', 7, '340228445335_0', NULL, NULL, NULL, '6034', 34392.92, 86);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d34b385-8b2e-5752-b181-519074fe04d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-23', DATE '2026-08-22', 34392.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 111). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d34b385-8b2e-5752-b181-519074fe04d2', '09ca9187-96be-5a2b-ae22-3df502d9322b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7d34b385-8b2e-5752-b181-519074fe04d2', '09ca9187-96be-5a2b-ae22-3df502d9322b', DATE '2026-08-22', DATE '2026-07-23', 34392.92, 34392.92, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 112 | apLIS lote 6133 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d3bc1b01-d2fe-555a-ba6a-f36f1212a835', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6133', DATE '2026-06-23', DATE '2026-06-23', 'Recebido - parcial', 7, '340228785318_0', '8948', 8928, DATE '2026-08-10', '6133', 3681.91, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c78f884-dde2-5a97-b82e-a9e5134c29a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8948', DATE '2026-06-23', DATE '2026-08-22', 3681.91, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 112). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c78f884-dde2-5a97-b82e-a9e5134c29a7', 'd3bc1b01-d2fe-555a-ba6a-f36f1212a835');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c78f884-dde2-5a97-b82e-a9e5134c29a7', 'd3bc1b01-d2fe-555a-ba6a-f36f1212a835', DATE '2026-08-22', DATE '2026-08-04', 3681.91, 3681.91, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 113 | apLIS lote 6134 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7bd9efaa-bb04-5aca-8a55-d91e14fcaa81', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6134', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '341228783785_0', '8944', 8924, DATE '2026-08-07', '6134', 2175.12, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f4ca0f9-6868-581d-bd0a-4b89c2966595', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8944', DATE '2026-06-23', DATE '2026-08-22', 2175.12, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 113). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f4ca0f9-6868-581d-bd0a-4b89c2966595', '7bd9efaa-bb04-5aca-8a55-d91e14fcaa81');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3f4ca0f9-6868-581d-bd0a-4b89c2966595', '7bd9efaa-bb04-5aca-8a55-d91e14fcaa81', DATE '2026-08-22', DATE '2026-08-04', 2175.12, 2175.12, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 114 | apLIS lote 6135 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('90337626-8139-5c9f-b92a-76dfcb078f04', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6135', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '340228801489_0', '8948', 8928, DATE '2026-08-10', '6135', 7079.96, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ed869d9-32f0-5886-a076-43ac3107c08e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '8948', DATE '2026-06-23', DATE '2026-08-22', 7079.96, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 114). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ed869d9-32f0-5886-a076-43ac3107c08e', '90337626-8139-5c9f-b92a-76dfcb078f04');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6ed869d9-32f0-5886-a076-43ac3107c08e', '90337626-8139-5c9f-b92a-76dfcb078f04', DATE '2026-08-22', DATE '2026-08-04', 7079.96, 7079.96, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 115 | apLIS lote 6138 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c4438f95-21b4-565d-8704-abad8e277f53', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6138', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '340228781967_0', NULL, NULL, NULL, '6138', 320.54, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a9e04af8-4b07-5c0d-9ed9-994f1f08e8d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-06-23', DATE '2026-08-22', 320.54, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 115). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a9e04af8-4b07-5c0d-9ed9-994f1f08e8d1', 'c4438f95-21b4-565d-8704-abad8e277f53');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a9e04af8-4b07-5c0d-9ed9-994f1f08e8d1', 'c4438f95-21b4-565d-8704-abad8e277f53', DATE '2026-08-22', DATE '2026-07-30', 320.54, 320.54, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 116 | apLIS lote 6139 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67f655ff-3ec7-5d39-80a6-664fe88786f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6139', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '341228783139_0', '8944', 8924, DATE '2026-08-07', '6139', 2109.69, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eced3df3-8c62-5cb6-bf0e-952bc421975f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8944', DATE '2026-06-23', DATE '2026-08-22', 2109.69, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 116). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eced3df3-8c62-5cb6-bf0e-952bc421975f', '67f655ff-3ec7-5d39-80a6-664fe88786f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eced3df3-8c62-5cb6-bf0e-952bc421975f', '67f655ff-3ec7-5d39-80a6-664fe88786f8', DATE '2026-08-22', DATE '2026-08-04', 2109.69, 2109.69, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 117 | apLIS lote 5942 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1200b416-890f-5010-9ec6-57d589a41aa0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5942', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '282176', '8570', 8550, DATE '2026-09-30', '5942', 93.38, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6c4dbd6a-2be7-52a5-82e9-5a09d1a9d88e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '8570', DATE '2026-06-01', DATE '2026-07-31', 93.38, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 117). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6c4dbd6a-2be7-52a5-82e9-5a09d1a9d88e', '1200b416-890f-5010-9ec6-57d589a41aa0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6c4dbd6a-2be7-52a5-82e9-5a09d1a9d88e', '1200b416-890f-5010-9ec6-57d589a41aa0', DATE '2026-07-31', DATE '2026-07-07', 93.38, 93.38, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 118 | apLIS lote 5939 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('25c7151a-b15d-555b-8700-120359198680', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5939', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '282088', '8569', 8549, DATE '2026-09-30', '5939', 1178.47, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c4f57477-d32f-5029-a48b-1d051f07da8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '8569', DATE '2026-06-01', DATE '2026-07-31', 1178.47, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 118). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c4f57477-d32f-5029-a48b-1d051f07da8c', '25c7151a-b15d-555b-8700-120359198680');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c4f57477-d32f-5029-a48b-1d051f07da8c', '25c7151a-b15d-555b-8700-120359198680', DATE '2026-07-31', DATE '2026-07-07', 1178.47, 1178.47, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 119 | apLIS lote 5938 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('75cedc01-f994-5fd3-874f-6dd4173d8733', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '5938', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '281926', '8567', 8547, DATE '2026-09-30', '5938', 10244.44, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '8567', DATE '2026-06-01', DATE '2026-07-31', 10244.44, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 119). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', '75cedc01-f994-5fd3-874f-6dd4173d8733');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', '75cedc01-f994-5fd3-874f-6dd4173d8733', DATE '2026-07-31', DATE '2026-07-07', 10244.44, 10244.44, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 120 | apLIS lote 6197 | BRB SAÚDE ("BRB/ PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a96e260e-7745-5e8f-9ab0-1deb0ce3a6af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6197', DATE '2026-07-01', DATE '2026-07-01', 'Recebido', 4, '281677', NULL, NULL, NULL, '6197', 59.51, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f042ec0a-3aa3-568c-8715-deeb76aad766', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-06-01', DATE '2026-07-31', 59.51, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 120). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f042ec0a-3aa3-568c-8715-deeb76aad766', 'a96e260e-7745-5e8f-9ab0-1deb0ce3a6af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f042ec0a-3aa3-568c-8715-deeb76aad766', 'a96e260e-7745-5e8f-9ab0-1deb0ce3a6af', DATE '2026-07-31', DATE '2026-07-07', 59.51, 59.51, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 121 | apLIS lote 5836 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a5e409a1-0ae1-56b7-8bf6-1281de309689', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5836', DATE '2026-05-21', DATE '2026-05-21', 'Recebido', 4, '227846886', '8600', 8580, DATE '2026-09-30', '5836', 35.66, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b041741-1a20-512b-aa3a-a1c7335e80ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-08', DATE '2026-07-08', 35.66, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 121). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b041741-1a20-512b-aa3a-a1c7335e80ab', 'a5e409a1-0ae1-56b7-8bf6-1281de309689');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b041741-1a20-512b-aa3a-a1c7335e80ab', 'a5e409a1-0ae1-56b7-8bf6-1281de309689', DATE '2026-07-08', DATE '2026-07-08', 35.66, 35.66, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 122 | apLIS lote 5982 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6a813d83-4e17-5ec9-a9c5-0e3979bb1d83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5982', DATE '2026-06-08', DATE '2026-06-08', 'Faturado', 3, '228308950', '8600', 8580, DATE '2026-09-30', '5982', 27116.17, 96);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-08', DATE '2026-07-08', 27116.17, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 122). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', '6a813d83-4e17-5ec9-a9c5-0e3979bb1d83');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', '6a813d83-4e17-5ec9-a9c5-0e3979bb1d83', DATE '2026-07-08', DATE '2026-07-08', 27116.17, 26432.56, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', '6a813d83-4e17-5ec9-a9c5-0e3979bb1d83', 683.61, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 123 | apLIS lote 5983 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('263b79e1-0c4f-5ea7-9775-67e33bbecb2f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5983', DATE '2026-06-08', DATE '2026-06-08', 'Faturado', 3, '228302356', '8600', 8580, DATE '2026-09-30', '5983', 24147.03, 92);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-08', DATE '2026-07-08', 24147.03, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 123). Responsável: Rivia. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', '263b79e1-0c4f-5ea7-9775-67e33bbecb2f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', '263b79e1-0c4f-5ea7-9775-67e33bbecb2f', DATE '2026-07-08', DATE '2026-07-08', 24147.03, 23919.16, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', '263b79e1-0c4f-5ea7-9775-67e33bbecb2f', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Rivia');

-- JUNHO linha 124 | apLIS lote 5986 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9b3c2cdc-5b99-5263-8e0a-06d22e80f3e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5986', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '228285661', '8600', 8580, DATE '2026-09-30', '5986', 18991.18, 65);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e5fab097-84bc-536d-9672-c50701615208', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-08', DATE '2026-07-08', 18991.18, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 124). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e5fab097-84bc-536d-9672-c50701615208', '9b3c2cdc-5b99-5263-8e0a-06d22e80f3e3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e5fab097-84bc-536d-9672-c50701615208', '9b3c2cdc-5b99-5263-8e0a-06d22e80f3e3', DATE '2026-07-08', DATE '2026-07-08', 18991.18, 18763.31, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e5fab097-84bc-536d-9672-c50701615208', '9b3c2cdc-5b99-5263-8e0a-06d22e80f3e3', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 125 | apLIS lote 5989 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eebeccde-dfaa-51d5-93e4-d9d5f5e3c759', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5989', DATE '2026-06-08', DATE '2026-06-08', 'Recebido', 4, '228288240', '8600', 8580, DATE '2026-09-30', '5989', 735.02, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b2b16025-6871-5af3-add0-9b03892b069c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-08', DATE '2026-07-08', 735.02, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 125). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b2b16025-6871-5af3-add0-9b03892b069c', 'eebeccde-dfaa-51d5-93e4-d9d5f5e3c759');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b2b16025-6871-5af3-add0-9b03892b069c', 'eebeccde-dfaa-51d5-93e4-d9d5f5e3c759', DATE '2026-07-08', DATE '2026-07-08', 735.02, 735.02, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 126 | apLIS lote 5988 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f195c28c-0f1b-59e3-ba8f-d712b64f741b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5988', DATE '2026-06-08', DATE '2026-06-09', 'Recebido', 4, '228320825', '8600', 8580, DATE '2026-09-30', '5988', 2764.29, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cb56635a-ae91-5e1e-9370-f600761de8e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8600', DATE '2026-06-09', DATE '2026-07-09', 2764.29, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 126). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cb56635a-ae91-5e1e-9370-f600761de8e1', 'f195c28c-0f1b-59e3-ba8f-d712b64f741b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cb56635a-ae91-5e1e-9370-f600761de8e1', 'f195c28c-0f1b-59e3-ba8f-d712b64f741b', DATE '2026-07-09', DATE '2026-07-08', 2764.29, 2764.29, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 127 | apLIS lote 6060 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bac304ab-c162-5e75-a489-daf5d2831a19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6060', DATE '2026-06-15', DATE '2026-06-16', 'Recebido - parcial', 7, '228524491', '8663', 8643, DATE '2026-09-30', '6060', 16987.71, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('060407b8-5afd-560f-b46e-4722febc715b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-16', DATE '2026-07-16', 16987.71, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 127). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('060407b8-5afd-560f-b46e-4722febc715b', 'bac304ab-c162-5e75-a489-daf5d2831a19');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('060407b8-5afd-560f-b46e-4722febc715b', 'bac304ab-c162-5e75-a489-daf5d2831a19', DATE '2026-07-16', DATE '2026-07-15', 16987.71, 16759.84, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('060407b8-5afd-560f-b46e-4722febc715b', 'bac304ab-c162-5e75-a489-daf5d2831a19', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Renata');

-- JUNHO linha 128 | apLIS lote 6061 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bd90f84a-079c-566e-ad93-7504a5910186', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6061', DATE '2026-06-16', DATE '2026-06-16', 'Recebido', 4, '228527175', '8663', 8643, DATE '2026-09-30', '6061', 17507.04, 65);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e2ba408b-26d3-5afd-95e1-9c2c005799a3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-16', DATE '2026-07-16', 17507.04, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 128). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e2ba408b-26d3-5afd-95e1-9c2c005799a3', 'bd90f84a-079c-566e-ad93-7504a5910186');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e2ba408b-26d3-5afd-95e1-9c2c005799a3', 'bd90f84a-079c-566e-ad93-7504a5910186', DATE '2026-07-16', DATE '2026-07-15', 17507.04, 17507.04, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 129 | apLIS lote 6063 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5f458342-1d4c-597e-8227-9e1bf2426865', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6063', DATE '2026-06-16', DATE '2026-06-16', 'Recebido - parcial', 7, '228531806', '8663', 8643, DATE '2026-09-30', '6063', 18727.30, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8be25eb0-1a99-5c5a-99dc-12b92c21f153', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-16', DATE '2026-07-16', 18727.30, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 129). Responsável: Renata. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8be25eb0-1a99-5c5a-99dc-12b92c21f153', '5f458342-1d4c-597e-8227-9e1bf2426865');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8be25eb0-1a99-5c5a-99dc-12b92c21f153', '5f458342-1d4c-597e-8227-9e1bf2426865', DATE '2026-07-16', DATE '2026-07-15', 18727.30, 17360.08, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8be25eb0-1a99-5c5a-99dc-12b92c21f153', '5f458342-1d4c-597e-8227-9e1bf2426865', 1367.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 130 | apLIS lote 6064 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3d196cea-72fd-5ae0-acd5-c3a5a650d920', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6064', DATE '2026-06-16', DATE '2026-06-16', 'Recebido', 4, '228533436', '8663', 8643, DATE '2026-09-30', '6064', 6144.78, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('abc56f76-a32d-5645-816d-e0b9ed22e5a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-16', DATE '2026-07-16', 6144.78, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 130). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('abc56f76-a32d-5645-816d-e0b9ed22e5a7', '3d196cea-72fd-5ae0-acd5-c3a5a650d920');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('abc56f76-a32d-5645-816d-e0b9ed22e5a7', '3d196cea-72fd-5ae0-acd5-c3a5a650d920', DATE '2026-07-16', DATE '2026-07-15', 6144.78, 6144.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 131 | apLIS lote 6065 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ff4d7568-3ff4-5d6e-a153-8d45d48ec417', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6065', DATE '2026-06-16', DATE '2026-06-16', 'Recebido', 4, '228537236', '8663', 8643, DATE '2026-09-30', '6065', 5034.41, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0bf90b97-bd94-5f92-bacb-60f76cb5fa6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-16', DATE '2026-07-16', 5034.41, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 131). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0bf90b97-bd94-5f92-bacb-60f76cb5fa6b', 'ff4d7568-3ff4-5d6e-a153-8d45d48ec417');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0bf90b97-bd94-5f92-bacb-60f76cb5fa6b', 'ff4d7568-3ff4-5d6e-a153-8d45d48ec417', DATE '2026-07-16', DATE '2026-07-15', 5034.41, 5034.41, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 132 | apLIS lote 6074 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('87b4a409-15a8-5908-9fed-648cbc2b2168', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6074', DATE '2026-06-17', DATE '2026-06-17', 'Faturado', 3, '228587635', '8663', 8643, DATE '2026-09-30', '6074', 381.66, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-17', DATE '2026-07-17', 381.66, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 132). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', '87b4a409-15a8-5908-9fed-648cbc2b2168');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', '87b4a409-15a8-5908-9fed-648cbc2b2168', DATE '2026-07-17', DATE '2026-07-15', 381.66, 381.65, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', '87b4a409-15a8-5908-9fed-648cbc2b2168', 0.01, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 133 | apLIS lote 6078 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ec5cb783-6951-5469-9c7c-7ed7bac157ce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6078', DATE '2026-06-18', DATE '2026-06-18', 'Recebido - parcial', 7, '228608295', '8663', 8643, DATE '2026-09-30', '6078', 5427.03, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-18', DATE '2026-07-18', 5427.03, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 133). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', 'ec5cb783-6951-5469-9c7c-7ed7bac157ce');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', 'ec5cb783-6951-5469-9c7c-7ed7bac157ce', DATE '2026-07-18', DATE '2026-07-15', 5427.03, 4971.29, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', 'ec5cb783-6951-5469-9c7c-7ed7bac157ce', 455.74, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 134 | apLIS lote 6079 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60d33686-fc0e-594d-85ac-f08a36d076fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6079', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '228612149', '8663', 8643, DATE '2026-09-30', '6079', 1558.40, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('732e8a79-403f-59a1-a3b4-9b0e9dd067b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '8663', DATE '2026-06-18', DATE '2026-07-18', 1558.40, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 134). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('732e8a79-403f-59a1-a3b4-9b0e9dd067b9', '60d33686-fc0e-594d-85ac-f08a36d076fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('732e8a79-403f-59a1-a3b4-9b0e9dd067b9', '60d33686-fc0e-594d-85ac-f08a36d076fe', DATE '2026-07-18', 1558.40, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 135 | apLIS lote 6121 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('22191bea-9f01-51ee-87c6-ecf88c104df8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6121', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '822284', '8885', 8865, DATE '2026-10-31', '6121', 2181.22, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4a60355c-c222-562b-8654-824899d33993', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8885', DATE '2026-06-22', DATE '2026-08-21', 2181.22, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 135). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4a60355c-c222-562b-8654-824899d33993', '22191bea-9f01-51ee-87c6-ecf88c104df8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4a60355c-c222-562b-8654-824899d33993', '22191bea-9f01-51ee-87c6-ecf88c104df8', DATE '2026-08-21', DATE '2026-08-18', 2181.22, 2181.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 136 | apLIS lote 6153 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b99ce22b-ee26-5f39-8959-5a034c328122', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6153', DATE '2026-06-23', DATE '2026-06-24', 'Recebido', 4, '822576', '8885', 8865, DATE '2026-10-31', '6153', 5125.83, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('54bc81bb-6214-57bb-b617-e3a348c0415a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8885', DATE '2026-06-24', DATE '2026-08-23', 5125.83, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 136). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('54bc81bb-6214-57bb-b617-e3a348c0415a', 'b99ce22b-ee26-5f39-8959-5a034c328122');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('54bc81bb-6214-57bb-b617-e3a348c0415a', 'b99ce22b-ee26-5f39-8959-5a034c328122', DATE '2026-08-23', DATE '2026-08-18', 5125.83, 5125.83, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 137 | apLIS lote 6152 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('97a5ab57-e6e1-57f2-af8a-75a64c02a6b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6152', DATE '2026-06-23', DATE '2026-06-24', 'Recebido', 4, '822638', '8885', 8865, DATE '2026-10-31', '6152', 32425.16, 93);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('44759474-2143-5a21-8e95-74f3038c99e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8885', DATE '2026-06-25', DATE '2026-08-24', 32425.16, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 137). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('44759474-2143-5a21-8e95-74f3038c99e1', '97a5ab57-e6e1-57f2-af8a-75a64c02a6b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('44759474-2143-5a21-8e95-74f3038c99e1', '97a5ab57-e6e1-57f2-af8a-75a64c02a6b6', DATE '2026-08-24', DATE '2026-08-18', 32425.16, 32425.16, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 138 | apLIS lote 6160 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9ca550c9-068f-5c89-82f9-8575058ea342', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6160', DATE '2026-06-25', DATE '2026-06-25', 'Recebido', 4, '822761', '8885', 8865, DATE '2026-10-31', '6160', 528.75, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('34543761-d698-5b14-a5e6-22bc2b3eee26', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '8885', DATE '2026-06-25', DATE '2026-08-24', 528.75, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 138). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('34543761-d698-5b14-a5e6-22bc2b3eee26', '9ca550c9-068f-5c89-82f9-8575058ea342');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('34543761-d698-5b14-a5e6-22bc2b3eee26', '9ca550c9-068f-5c89-82f9-8575058ea342', DATE '2026-08-24', DATE '2026-08-18', 528.75, 528.75, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 139 | apLIS lote 6187 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3a0bef83-15a6-58a1-91d5-996d935e8bae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '6187', DATE '2026-06-30', DATE '2026-06-30', 'Faturado', 3, '2606301349427262918', '8842', 8822, DATE '2026-09-30', '6187', 2305.93, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f32a25fd-35ae-50ba-ac49-fbbbe5621d03', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '8842', DATE '2026-06-30', DATE '2026-07-30', 2305.93, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 139). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f32a25fd-35ae-50ba-ac49-fbbbe5621d03', '3a0bef83-15a6-58a1-91d5-996d935e8bae');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f32a25fd-35ae-50ba-ac49-fbbbe5621d03', '3a0bef83-15a6-58a1-91d5-996d935e8bae', DATE '2026-07-30', DATE '2026-08-10', 2305.93, 885.00, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 140 | apLIS lote 5958 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3b091a86-16c3-51c6-afd6-6b31ab069a33', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5958', DATE '2026-06-03', DATE '2026-06-03', 'Recebido - parcial', 7, '699042', '8575', 8555, DATE '2026-09-30', '5958', 4821.94, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '8575', DATE '2026-06-03', DATE '2026-07-08', 4821.94, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 140). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33', DATE '2026-07-08', DATE '2026-07-17', 4821.94, 4364.38, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33', 457.56, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 141 | apLIS lote 5959 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc348716-fd4a-526d-9c10-361c5ba754d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '5959', DATE '2026-06-03', DATE '2026-06-03', 'Recebido', 4, '699069', '8475', 8455, DATE '2026-06-29', '5959', 93.77, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e471100-0f7a-5eb0-b1b5-5eb52ed105c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '8475', DATE '2026-06-03', DATE '2026-07-08', 93.77, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 141). Responsável: Renata. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e471100-0f7a-5eb0-b1b5-5eb52ed105c5', 'bc348716-fd4a-526d-9c10-361c5ba754d0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e471100-0f7a-5eb0-b1b5-5eb52ed105c5', 'bc348716-fd4a-526d-9c10-361c5ba754d0', DATE '2026-07-08', DATE '2026-07-17', 93.77, 93.77, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 142 | apLIS lote 5947 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6bbab090-1b21-58fb-8fea-ce402b431221', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5947', DATE '2026-06-02', DATE '2026-06-02', 'Recebido - parcial', 7, '140270', NULL, NULL, NULL, '5947', 7659.46, 30);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-06-02', DATE '2026-06-30', 7659.46, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 142). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', '6bbab090-1b21-58fb-8fea-ce402b431221');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', '6bbab090-1b21-58fb-8fea-ce402b431221', DATE '2026-06-30', DATE '2026-07-17', 7659.46, 6954.46, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', '6bbab090-1b21-58fb-8fea-ce402b431221', 705.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 143 | apLIS lote 5676 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bc20accf-90e1-5fc8-b7dc-74f45ecb0d98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5676', DATE '2026-05-06', DATE '2026-06-02', 'Recebido', 4, '140311', NULL, NULL, NULL, '5676', 2750.52, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0f508473-7b02-53d0-8a46-6349dee6ec18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-06-02', DATE '2026-06-30', 2750.52, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 143). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0f508473-7b02-53d0-8a46-6349dee6ec18', 'bc20accf-90e1-5fc8-b7dc-74f45ecb0d98');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0f508473-7b02-53d0-8a46-6349dee6ec18', 'bc20accf-90e1-5fc8-b7dc-74f45ecb0d98', DATE '2026-06-30', DATE '2026-08-06', 2750.52, 2750.52, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 144 | apLIS lote 5960 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('16e2dd10-4a0c-5f9e-9af1-e38a37b90790', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '5960', DATE '2026-06-03', DATE '2026-06-03', 'Faturado', 3, '140436', NULL, NULL, NULL, '5960', 703.52, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b55fe1b-57bf-593f-932d-02952ee7f53b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-06-03', DATE '2026-07-01', 703.52, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 144). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b55fe1b-57bf-593f-932d-02952ee7f53b', '16e2dd10-4a0c-5f9e-9af1-e38a37b90790');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5b55fe1b-57bf-593f-932d-02952ee7f53b', '16e2dd10-4a0c-5f9e-9af1-e38a37b90790', DATE '2026-07-01', 703.52, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5b55fe1b-57bf-593f-932d-02952ee7f53b', '16e2dd10-4a0c-5f9e-9af1-e38a37b90790', 703.52, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 145 | apLIS lote 5774 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('230f9543-0858-5240-a2de-908647a2a478', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '5774', DATE '2026-05-15', DATE '2026-09-23', 'Conciliação', 2, '20260603140634', NULL, NULL, NULL, '5774', 750.16, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4ee57a38-47c9-56a4-8934-a40184ee14d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-06-03', DATE '2026-08-02', 750.16, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 145). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4ee57a38-47c9-56a4-8934-a40184ee14d7', '230f9543-0858-5240-a2de-908647a2a478');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4ee57a38-47c9-56a4-8934-a40184ee14d7', '230f9543-0858-5240-a2de-908647a2a478', DATE '2026-08-02', 750.16, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 146 | apLIS lote 5966 | GAMA SAÚDE ("GAMA SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f00505b6-6767-599e-9500-582f0c39f9af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), '5966', DATE '2026-06-03', DATE '2026-06-03', 'Faturado', 3, '16687983', '8292', 8272, DATE '2026-08-31', '5966', 491.38, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a26eb8e6-2c4a-5e58-8bab-c31017d9f39d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), '8292', DATE '2026-06-03', DATE '2026-08-02', 491.38, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 146). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a26eb8e6-2c4a-5e58-8bab-c31017d9f39d', 'f00505b6-6767-599e-9500-582f0c39f9af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a26eb8e6-2c4a-5e58-8bab-c31017d9f39d', 'f00505b6-6767-599e-9500-582f0c39f9af', DATE '2026-08-02', 491.38, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 147 | apLIS lote 5675 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3b41ed92-d955-5d0e-ba27-70d138b937b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5675', DATE '2026-05-06', DATE '2026-05-07', 'Faturado', 3, '153927795', NULL, NULL, NULL, '5675', 2477.59, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d84aefd7-cd9b-5875-8c60-83333e8db4ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-01', DATE '2026-08-30', 2477.59, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 147). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d84aefd7-cd9b-5875-8c60-83333e8db4ef', '3b41ed92-d955-5d0e-ba27-70d138b937b2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d84aefd7-cd9b-5875-8c60-83333e8db4ef', '3b41ed92-d955-5d0e-ba27-70d138b937b2', DATE '2026-08-30', 2477.59, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 148 | apLIS lote 5692 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e68f8a7c-9070-5c28-a115-57395d7fdb41', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5692', DATE '2026-05-08', DATE '2026-05-08', 'Faturado', 3, '153974231', NULL, NULL, NULL, '5692', 2037.29, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ce2ec358-d2d7-5ee6-9a5f-b2aa61659429', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-01', DATE '2026-08-30', 2037.29, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 148). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ce2ec358-d2d7-5ee6-9a5f-b2aa61659429', 'e68f8a7c-9070-5c28-a115-57395d7fdb41');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ce2ec358-d2d7-5ee6-9a5f-b2aa61659429', 'e68f8a7c-9070-5c28-a115-57395d7fdb41', DATE '2026-08-30', 2037.29, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 150 | apLIS lote 5952 | GEAP Autogestão em Saúde ("GEAP RESOLVIDA / 2025" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33d07c21-168d-5504-b86b-3f76d912336a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5952', DATE '2026-06-02', DATE '2026-06-03', 'Faturado', 3, '156017373', NULL, NULL, NULL, '5952', 1135.77, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('343209a0-6857-574a-9c5c-90ce45bf94d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-03', DATE '2026-09-01', 1135.77, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 150). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('343209a0-6857-574a-9c5c-90ce45bf94d0', '33d07c21-168d-5504-b86b-3f76d912336a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('343209a0-6857-574a-9c5c-90ce45bf94d0', '33d07c21-168d-5504-b86b-3f76d912336a', DATE '2026-09-01', 1135.77, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 151 | apLIS lote 5710 | GEAP Autogestão em Saúde ("GEAP  PENDÊNCIA RESOLVIDA (ASS)" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c9f2b20-c40f-57ae-957c-3a8880b5723f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5710', DATE '2026-05-11', DATE '2026-06-03', 'Faturado', 3, '156716333', NULL, NULL, NULL, '5710', 825.53, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4c8f4816-0c94-51ea-88c3-490d84866239', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-03', DATE '2026-09-01', 825.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 151). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4c8f4816-0c94-51ea-88c3-490d84866239', '3c9f2b20-c40f-57ae-957c-3a8880b5723f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4c8f4816-0c94-51ea-88c3-490d84866239', '3c9f2b20-c40f-57ae-957c-3a8880b5723f', DATE '2026-09-01', 825.53, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 152 | apLIS lote 5964 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1a3264d-910e-58b2-891c-92e8114195f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5964', DATE '2026-06-03', DATE '2026-06-05', 'Faturado', 3, '157576858', NULL, NULL, NULL, '5964', 19292.94, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('89dbb842-b270-5a73-91b2-158179dffa9e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-05', DATE '2026-09-03', 19292.94, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 152). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('89dbb842-b270-5a73-91b2-158179dffa9e', 'b1a3264d-910e-58b2-891c-92e8114195f7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('89dbb842-b270-5a73-91b2-158179dffa9e', 'b1a3264d-910e-58b2-891c-92e8114195f7', DATE '2026-09-03', 19292.94, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 153 | apLIS lote 5965 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7c3d5960-ddec-5d4b-819a-ddd717b3a810', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5965', DATE '2026-06-03', DATE '2026-06-05', 'Faturado', 3, '157243633', NULL, NULL, NULL, '5965', 8062.53, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c9313ea3-4c7c-5c71-b2eb-93fcb2c6688b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-06-05', DATE '2026-09-03', 8062.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 153). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c9313ea3-4c7c-5c71-b2eb-93fcb2c6688b', '7c3d5960-ddec-5d4b-819a-ddd717b3a810');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c9313ea3-4c7c-5c71-b2eb-93fcb2c6688b', '7c3d5960-ddec-5d4b-819a-ddd717b3a810', DATE '2026-09-03', 8062.53, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 154 | apLIS lote 5998 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60e62e65-4710-5b89-ad1c-67ed7bfccae6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5998', DATE '2026-06-09', DATE '2026-06-09', 'Faturado', 3, '182167', '9081', 9063, DATE '2026-11-30', '5998', 6908.82, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f140b28-7d5e-5494-aaf8-27eabc72575a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-09', DATE '2026-07-09', 6908.82, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 154). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f140b28-7d5e-5494-aaf8-27eabc72575a', '60e62e65-4710-5b89-ad1c-67ed7bfccae6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3f140b28-7d5e-5494-aaf8-27eabc72575a', '60e62e65-4710-5b89-ad1c-67ed7bfccae6', DATE '2026-07-09', 6908.82, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 155 | apLIS lote 5997 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ca31aa07-de34-5473-adc8-8b0f68489c68', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5997', DATE '2026-06-09', DATE '2026-06-09', 'Faturado', 3, '182197', '9081', 9063, DATE '2026-11-30', '5997', 11945.68, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('32e1ccf6-5a27-5d91-a377-aac9cda859ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-09', DATE '2026-07-09', 11945.68, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 155). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('32e1ccf6-5a27-5d91-a377-aac9cda859ee', 'ca31aa07-de34-5473-adc8-8b0f68489c68');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('32e1ccf6-5a27-5d91-a377-aac9cda859ee', 'ca31aa07-de34-5473-adc8-8b0f68489c68', DATE '2026-07-09', 11945.68, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 156 | apLIS lote 6001 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('af46467b-b6ca-5a82-9511-701f722a52c6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6001', DATE '2026-06-09', DATE '2026-06-09', 'Faturado', 3, '182212', '9081', 9063, DATE '2026-11-30', '6001', 1194.95, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7cd7b175-40f2-5af6-9191-a80a6c70b68f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-09', DATE '2026-07-09', 1194.95, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 156). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7cd7b175-40f2-5af6-9191-a80a6c70b68f', 'af46467b-b6ca-5a82-9511-701f722a52c6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7cd7b175-40f2-5af6-9191-a80a6c70b68f', 'af46467b-b6ca-5a82-9511-701f722a52c6', DATE '2026-07-09', 1194.95, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 157 | apLIS lote 6002 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fbd96bf0-cd58-5f99-854a-92c5564c13f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6002', DATE '2026-06-09', DATE '2026-06-09', 'Faturado', 3, '182215', '9081', 9063, DATE '2026-11-30', '6002', 825.53, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('29928b40-d5df-5925-9065-8479fff0aca7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-09', DATE '2026-07-09', 825.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 157). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('29928b40-d5df-5925-9065-8479fff0aca7', 'fbd96bf0-cd58-5f99-854a-92c5564c13f7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('29928b40-d5df-5925-9065-8479fff0aca7', 'fbd96bf0-cd58-5f99-854a-92c5564c13f7', DATE '2026-07-09', 825.53, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 158 | apLIS lote 6066 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('786541ac-29e8-5944-96a2-6a7a42df411d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6066', DATE '2026-06-16', DATE '2026-06-16', 'Faturado', 3, '183336', '9081', 9063, DATE '2026-11-30', '6066', 9192.20, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ac3c5dd6-2e91-500b-89a6-e4203e1acada', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-16', DATE '2026-07-16', 9192.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 158). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ac3c5dd6-2e91-500b-89a6-e4203e1acada', '786541ac-29e8-5944-96a2-6a7a42df411d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ac3c5dd6-2e91-500b-89a6-e4203e1acada', '786541ac-29e8-5944-96a2-6a7a42df411d', DATE '2026-07-16', 9192.20, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 159 | apLIS lote 6087 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('24cc86a8-382a-51bb-ac79-46a3cf9848a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6087', DATE '2026-06-18', DATE '2026-06-18', 'Faturado', 3, '183997', '9081', 9063, DATE '2026-11-30', '6087', 406.76, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7502634c-aa59-5f56-ab23-562b925c31ec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-18', DATE '2026-07-18', 406.76, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 159). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7502634c-aa59-5f56-ab23-562b925c31ec', '24cc86a8-382a-51bb-ac79-46a3cf9848a1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7502634c-aa59-5f56-ab23-562b925c31ec', '24cc86a8-382a-51bb-ac79-46a3cf9848a1', DATE '2026-07-18', 406.76, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 160 | apLIS lote 6148 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f9efea4f-2dec-5a15-9be4-632557151a9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6148', DATE '2026-06-23', DATE '2026-06-23', 'Faturado', 3, '185185', '9081', 9063, DATE '2026-11-30', '6148', 938.64, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('48aabc4e-6204-58de-a59f-29d28754e6aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-23', DATE '2026-07-23', 938.64, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 160). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('48aabc4e-6204-58de-a59f-29d28754e6aa', 'f9efea4f-2dec-5a15-9be4-632557151a9d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('48aabc4e-6204-58de-a59f-29d28754e6aa', 'f9efea4f-2dec-5a15-9be4-632557151a9d', DATE '2026-07-23', 938.64, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 161 | apLIS lote 6147 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6f96fd3c-5451-5f31-9472-5d88c987d677', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6147', DATE '2026-06-23', DATE '2026-06-23', 'Faturado', 3, '23062026', '9081', 9063, DATE '2026-11-30', '6147', 5972.71, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4232a501-a18e-5d64-aaee-c5330cadc596', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-23', DATE '2026-07-23', 5972.71, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 161). Responsável: Renata. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4232a501-a18e-5d64-aaee-c5330cadc596', '6f96fd3c-5451-5f31-9472-5d88c987d677');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4232a501-a18e-5d64-aaee-c5330cadc596', '6f96fd3c-5451-5f31-9472-5d88c987d677', DATE '2026-07-23', 5972.71, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 162 | apLIS lote 6163 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5a10bcdd-4333-598a-bf00-7771b0bbf6e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6163', DATE '2026-06-25', DATE '2026-06-25', 'Faturado', 3, '351873', '9081', 9063, DATE '2026-11-30', '6163', 442.96, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6e9cbbe2-c816-5af5-bd5b-413acfd1d479', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-25', DATE '2026-07-25', 442.96, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 162). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6e9cbbe2-c816-5af5-bd5b-413acfd1d479', '5a10bcdd-4333-598a-bf00-7771b0bbf6e3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6e9cbbe2-c816-5af5-bd5b-413acfd1d479', '5a10bcdd-4333-598a-bf00-7771b0bbf6e3', DATE '2026-07-25', 442.96, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 163 | apLIS lote 6165 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('97ba8b4c-effd-50c1-929d-c3e312744679', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6165', DATE '2026-06-25', DATE '2026-06-26', 'Faturado', 3, '187489', '9081', 9063, DATE '2026-11-30', '6165', 36.20, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('03af70ad-3b46-5c80-a2c8-be959d672e8f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-26', DATE '2026-07-26', 36.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 163). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('03af70ad-3b46-5c80-a2c8-be959d672e8f', '97ba8b4c-effd-50c1-929d-c3e312744679');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('03af70ad-3b46-5c80-a2c8-be959d672e8f', '97ba8b4c-effd-50c1-929d-c3e312744679', DATE '2026-07-26', 36.20, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 164 | apLIS lote 6171 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('71971b17-6ca9-5668-b3f2-bd9a5e67580f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6171', DATE '2026-06-26', DATE '2026-06-26', 'Faturado', 3, '187590', '9081', 9063, DATE '2026-11-30', '6171', 36.20, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a5342a13-96ad-55d5-9b08-cde6bec44836', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-26', DATE '2026-07-26', 36.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 164). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a5342a13-96ad-55d5-9b08-cde6bec44836', '71971b17-6ca9-5668-b3f2-bd9a5e67580f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a5342a13-96ad-55d5-9b08-cde6bec44836', '71971b17-6ca9-5668-b3f2-bd9a5e67580f', DATE '2026-07-26', 36.20, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 165 | apLIS lote 6106 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e5d819d-f088-55dd-a6be-ff31529a6588', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6106', DATE '2026-06-19', DATE '2026-06-26', 'Faturado', 3, '187611', '9081', 9063, DATE '2026-11-30', '6106', 885.92, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ad9fcff-17c2-54e1-8461-fb66cdde9f57', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-26', DATE '2026-07-26', 885.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 165). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ad9fcff-17c2-54e1-8461-fb66cdde9f57', '6e5d819d-f088-55dd-a6be-ff31529a6588');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6ad9fcff-17c2-54e1-8461-fb66cdde9f57', '6e5d819d-f088-55dd-a6be-ff31529a6588', DATE '2026-07-26', 885.92, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 166 | apLIS lote 6174 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2e00959-97ec-5b10-b0bd-1707fc889c8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6174', DATE '2026-06-26', DATE '2026-06-26', 'Faturado', 3, '187828', '9081', 9063, DATE '2026-11-30', '6174', 4413.86, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f744217d-d5dc-5a51-9384-f31f7191d19e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '9081', DATE '2026-06-26', DATE '2026-07-26', 4413.86, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 166). Responsável: Rivia. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f744217d-d5dc-5a51-9384-f31f7191d19e', 'c2e00959-97ec-5b10-b0bd-1707fc889c8c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f744217d-d5dc-5a51-9384-f31f7191d19e', 'c2e00959-97ec-5b10-b0bd-1707fc889c8c', DATE '2026-07-26', 4413.86, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 167 | apLIS lote 5665 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9a0f04cd-3540-535c-933c-8f0f5ed9cc81', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5665', DATE '2026-05-06', DATE '2026-05-06', 'Faturado', 3, '4331525', '9233', 9217, DATE '2026-11-30', '5665', 1588.56, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e6d00dae-bf69-5825-b2b3-d1b36e06dcc9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '9233', DATE '2026-06-03', DATE '2026-08-02', 1588.56, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 167). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e6d00dae-bf69-5825-b2b3-d1b36e06dcc9', '9a0f04cd-3540-535c-933c-8f0f5ed9cc81');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e6d00dae-bf69-5825-b2b3-d1b36e06dcc9', '9a0f04cd-3540-535c-933c-8f0f5ed9cc81', DATE '2026-08-02', 1588.56, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 168 | apLIS lote 5667 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('69a6d8db-5fa6-5699-a618-d442cb96d598', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5667', DATE '2026-05-06', DATE '2026-06-03', 'Faturado', 3, '4331561', '9233', 9217, DATE '2026-11-30', '5667', 66.70, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd892d4e-969c-5215-bbb4-d0ae11c37012', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '9233', DATE '2026-06-03', DATE '2026-08-02', 66.70, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 168). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd892d4e-969c-5215-bbb4-d0ae11c37012', '69a6d8db-5fa6-5699-a618-d442cb96d598');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('bd892d4e-969c-5215-bbb4-d0ae11c37012', '69a6d8db-5fa6-5699-a618-d442cb96d598', DATE '2026-08-02', 66.70, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 169 | apLIS lote 5955 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eb2261a4-beb3-5177-9572-e28c264cd1d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5955', DATE '2026-06-03', DATE '2026-06-03', 'Faturado', 3, '4332773', '9233', 9217, DATE '2026-11-30', '5955', 14769.22, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('77dde167-d8c3-5bae-8e38-76e36d81fd48', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '9233', DATE '2026-06-03', DATE '2026-08-02', 14769.22, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 169). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('77dde167-d8c3-5bae-8e38-76e36d81fd48', 'eb2261a4-beb3-5177-9572-e28c264cd1d5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('77dde167-d8c3-5bae-8e38-76e36d81fd48', 'eb2261a4-beb3-5177-9572-e28c264cd1d5', DATE '2026-08-02', 14769.22, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 170 | apLIS lote 5961 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('034f6979-26be-5f1e-80d8-8e5da5e73965', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5961', DATE '2026-06-03', DATE '2026-06-03', 'Faturado', 3, '4333615', '9233', 9217, DATE '2026-11-30', '5961', 1967.77, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('016000a8-4c41-50c0-851f-5fa2557c12cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '9233', DATE '2026-06-03', DATE '2026-08-02', 1967.77, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 170). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('016000a8-4c41-50c0-851f-5fa2557c12cb', '034f6979-26be-5f1e-80d8-8e5da5e73965');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('016000a8-4c41-50c0-851f-5fa2557c12cb', '034f6979-26be-5f1e-80d8-8e5da5e73965', DATE '2026-08-02', 1967.77, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 171 | apLIS lote 5962 | POSTAL SAÚDE ("POSTAL" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a606244-e00c-5d28-8e80-c18c296f1e89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '5962', DATE '2026-06-03', DATE '2026-06-03', 'Faturado', 3, '4333775', '9233', 9217, DATE '2026-11-30', '5962', 1299.26, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('307a3c98-5bf3-5093-9492-290d349d14d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '9233', DATE '2026-06-03', DATE '2026-08-02', 1299.26, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 171). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('307a3c98-5bf3-5093-9492-290d349d14d7', '2a606244-e00c-5d28-8e80-c18c296f1e89');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('307a3c98-5bf3-5093-9492-290d349d14d7', '2a606244-e00c-5d28-8e80-c18c296f1e89', DATE '2026-08-02', 1299.26, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 172 | apLIS lote 5954 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dbea9f3d-faa0-5250-b902-8ddb1bd43b3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5954', DATE '2026-06-03', DATE '2026-06-03', 'Recebido', 4, '39115', '8453', 8433, DATE '2026-07-27', '5954', 7610.51, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b23d012e-67c9-55c8-a60c-f95150f87a89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '8453', DATE '2026-06-03', DATE '2026-07-31', 7610.51, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 172). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b23d012e-67c9-55c8-a60c-f95150f87a89', 'dbea9f3d-faa0-5250-b902-8ddb1bd43b3c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b23d012e-67c9-55c8-a60c-f95150f87a89', 'dbea9f3d-faa0-5250-b902-8ddb1bd43b3c', DATE '2026-07-31', 7610.51, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 173 | apLIS lote 5956 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('beee0f18-0490-554a-8473-d828186ee6ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5956', DATE '2026-06-03', DATE '2026-06-03', 'Recebido', 4, '39126', '8453', 8433, DATE '2026-07-27', '5956', 1010.55, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('66d740e8-4d39-5ffd-8964-52cd56e0e630', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '8453', DATE '2026-06-03', DATE '2026-07-31', 1010.55, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 173). Responsável: Renata. Status original na planilha: —.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('66d740e8-4d39-5ffd-8964-52cd56e0e630', 'beee0f18-0490-554a-8473-d828186ee6ab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('66d740e8-4d39-5ffd-8964-52cd56e0e630', 'beee0f18-0490-554a-8473-d828186ee6ab', DATE '2026-07-31', 1010.55, 'previsto', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 174 | apLIS lote 5993 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('48ce2cdc-ed23-5f2e-8675-5b75da601353', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5993', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457865', '8841', 8821, DATE '2026-07-28', '5993', 14096.00, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-09', DATE '2026-07-09', 14096.00, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 174). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', '48ce2cdc-ed23-5f2e-8675-5b75da601353');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', '48ce2cdc-ed23-5f2e-8675-5b75da601353', DATE '2026-07-09', DATE '2026-08-07', 14096.00, 13813.64, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', '48ce2cdc-ed23-5f2e-8675-5b75da601353', 282.36, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 175 | apLIS lote 5992 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('278ed9e8-5178-5f0a-99cd-c2f83becc072', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5992', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457754', '8841', 8821, DATE '2026-07-28', '5992', 11265.31, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-08', DATE '2026-07-08', 11265.31, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 175). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', '278ed9e8-5178-5f0a-99cd-c2f83becc072');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', '278ed9e8-5178-5f0a-99cd-c2f83becc072', DATE '2026-07-08', DATE '2026-08-07', 11265.31, 11039.59, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', '278ed9e8-5178-5f0a-99cd-c2f83becc072', 225.72, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 176 | apLIS lote 5991 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d7590095-effa-540f-9bc8-b4a138378d2f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5991', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457666', '8841', 8821, DATE '2026-07-28', '5991', 692.68, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-08', DATE '2026-07-08', 692.68, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 176). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', 'd7590095-effa-540f-9bc8-b4a138378d2f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', 'd7590095-effa-540f-9bc8-b4a138378d2f', DATE '2026-07-08', DATE '2026-08-07', 692.68, 678.84, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', 'd7590095-effa-540f-9bc8-b4a138378d2f', 13.84, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 177 | apLIS lote 5984 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('63756ae5-87b9-59ed-a43b-4988065b6f22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5984', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457665', '8841', 8821, DATE '2026-07-28', '5984', 18303.42, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-08', DATE '2026-07-08', 18303.42, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 177). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', '63756ae5-87b9-59ed-a43b-4988065b6f22');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', '63756ae5-87b9-59ed-a43b-4988065b6f22', DATE '2026-07-08', DATE '2026-08-07', 18303.42, 17937.20, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', '63756ae5-87b9-59ed-a43b-4988065b6f22', 366.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 178 | apLIS lote 5985 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5985', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457586', '8841', 8821, DATE '2026-07-28', '5985', 16947.51, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-08', DATE '2026-07-08', 16947.51, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 178). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', 'd80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', 'd80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681', DATE '2026-07-08', DATE '2026-08-07', 16947.51, 16377.07, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', 'd80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681', 570.44, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 179 | apLIS lote 5987 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a1ead683-ec25-5e0e-9f82-4e80ffbf5e33', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5987', DATE '2026-06-08', DATE '2026-06-08', 'Recebido - parcial', 7, '457527', '8841', 8821, DATE '2026-07-28', '5987', 16900.23, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-08', DATE '2026-07-08', 16900.23, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 179). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', 'a1ead683-ec25-5e0e-9f82-4e80ffbf5e33');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', 'a1ead683-ec25-5e0e-9f82-4e80ffbf5e33', DATE '2026-07-08', DATE '2026-08-07', 16900.23, 16562.10, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', 'a1ead683-ec25-5e0e-9f82-4e80ffbf5e33', 338.13, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 180 | apLIS lote 6003 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60d0577e-2c49-58b7-bebd-f140bb31eac3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6003', DATE '2026-06-09', DATE '2026-06-09', 'Recebido - parcial', 7, '458097', '8841', 8821, DATE '2026-07-28', '6003', 4254.11, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-09', DATE '2026-07-09', 4254.11, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 180). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', '60d0577e-2c49-58b7-bebd-f140bb31eac3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', '60d0577e-2c49-58b7-bebd-f140bb31eac3', DATE '2026-07-09', DATE '2026-08-07', 4254.11, 4144.44, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', '60d0577e-2c49-58b7-bebd-f140bb31eac3', 109.67, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 181 | apLIS lote 6005 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5e97a663-8d81-55a7-a487-f38a3298dcd6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6005', DATE '2026-06-09', DATE '2026-06-09', 'Recebido - parcial', 7, '458119', '8841', 8821, DATE '2026-07-28', '6005', 2232.23, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-09', DATE '2026-07-09', 2232.23, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 181). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', '5e97a663-8d81-55a7-a487-f38a3298dcd6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', '5e97a663-8d81-55a7-a487-f38a3298dcd6', DATE '2026-07-09', DATE '2026-08-07', 2232.23, 2187.45, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', '5e97a663-8d81-55a7-a487-f38a3298dcd6', 44.78, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 182 | apLIS lote 6069 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2b9a93c4-bbdd-5d78-82fd-ee480e01712b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6069', DATE '2026-06-16', DATE '2026-06-16', 'Recebido - parcial', 7, '460174', '8841', 8821, DATE '2026-07-28', '6069', 23510.53, 75);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-16', DATE '2026-07-16', 23510.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 182). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', '2b9a93c4-bbdd-5d78-82fd-ee480e01712b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', '2b9a93c4-bbdd-5d78-82fd-ee480e01712b', DATE '2026-07-16', DATE '2026-08-07', 23510.53, 23040.13, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', '2b9a93c4-bbdd-5d78-82fd-ee480e01712b', 470.40, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 183 | apLIS lote 6070 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c85bfb9-b716-568e-bc1e-dc3498ec5704', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6070', DATE '2026-06-16', DATE '2026-06-17', 'Recebido', 4, '460282', '8841', 8821, DATE '2026-07-28', '6070', 14834.77, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('47891631-5602-5e3d-ba03-fbcfb4c89503', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-17', DATE '2026-07-17', 14834.77, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 183). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('47891631-5602-5e3d-ba03-fbcfb4c89503', '6c85bfb9-b716-568e-bc1e-dc3498ec5704');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('47891631-5602-5e3d-ba03-fbcfb4c89503', '6c85bfb9-b716-568e-bc1e-dc3498ec5704', DATE '2026-07-17', DATE '2026-08-07', 14834.77, 14834.77, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 184 | apLIS lote 6075 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7a977aef-a9df-5d56-ac4e-7ddfa37bab77', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6075', DATE '2026-06-17', DATE '2026-06-17', 'Recebido - parcial', 7, '460581', '8841', 8821, DATE '2026-07-28', '6075', 1751.25, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-17', DATE '2026-07-17', 1751.25, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 184). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', '7a977aef-a9df-5d56-ac4e-7ddfa37bab77');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', '7a977aef-a9df-5d56-ac4e-7ddfa37bab77', DATE '2026-07-17', DATE '2026-08-07', 1751.25, 1716.25, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', '7a977aef-a9df-5d56-ac4e-7ddfa37bab77', 35.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 185 | apLIS lote 6095 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd65bce0-9f92-587c-99a6-71144abbfaac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6095', DATE '2026-06-18', DATE '2026-06-18', 'Recebido - parcial', 7, '461149', '8841', 8821, DATE '2026-07-28', '6095', 2561.55, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-18', DATE '2026-07-18', 2561.55, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 185). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', 'cd65bce0-9f92-587c-99a6-71144abbfaac');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', 'cd65bce0-9f92-587c-99a6-71144abbfaac', DATE '2026-07-18', DATE '2026-08-07', 2561.55, 2510.31, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', 'cd65bce0-9f92-587c-99a6-71144abbfaac', 51.24, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 186 | apLIS lote 6096 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b0ec58d4-7686-5c52-b299-04e8dc08e4de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6096', DATE '2026-06-18', DATE '2026-06-19', 'Recebido - parcial', 7, '461434', '8841', 8821, DATE '2026-07-28', '6096', 9077.00, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-19', DATE '2026-07-19', 9077.00, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 186). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', 'b0ec58d4-7686-5c52-b299-04e8dc08e4de');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', 'b0ec58d4-7686-5c52-b299-04e8dc08e4de', DATE '2026-07-19', DATE '2026-08-07', 9077.00, 8895.20, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', 'b0ec58d4-7686-5c52-b299-04e8dc08e4de', 181.80, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 187 | apLIS lote 5879 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0545a3a5-b54a-5f9a-8c8a-55f149103dd0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5879', DATE '2026-05-26', DATE '2026-06-22', 'Recebido - parcial', 7, '461836', '8841', 8821, DATE '2026-07-28', '5879', 1995.56, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('de08ceab-5553-5bda-9290-0993f713d306', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-22', DATE '2026-07-22', 1995.56, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 187). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('de08ceab-5553-5bda-9290-0993f713d306', '0545a3a5-b54a-5f9a-8c8a-55f149103dd0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('de08ceab-5553-5bda-9290-0993f713d306', '0545a3a5-b54a-5f9a-8c8a-55f149103dd0', DATE '2026-07-22', DATE '2026-08-07', 1995.56, 1747.77, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('de08ceab-5553-5bda-9290-0993f713d306', '0545a3a5-b54a-5f9a-8c8a-55f149103dd0', 247.79, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 188 | apLIS lote 6117 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ef5ed6d5-ee14-5579-9a04-616f617fbb0e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6117', DATE '2026-06-22', DATE '2026-06-22', 'Recebido - parcial', 7, '462026', '8841', 8821, DATE '2026-07-28', '6117', 8561.51, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-22', DATE '2026-07-22', 8561.51, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 188). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', 'ef5ed6d5-ee14-5579-9a04-616f617fbb0e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', 'ef5ed6d5-ee14-5579-9a04-616f617fbb0e', DATE '2026-07-22', DATE '2026-08-07', 8561.51, 8390.20, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', 'ef5ed6d5-ee14-5579-9a04-616f617fbb0e', 171.31, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 189 | apLIS lote 6118 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a7d4bb4-43a5-579b-9dcc-635edc947357', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6118', DATE '2026-06-22', DATE '2026-06-22', 'Recebido - parcial', 7, '462129', '8841', 8821, DATE '2026-07-28', '6118', 11074.28, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-22', DATE '2026-07-22', 11074.28, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 189). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', '2a7d4bb4-43a5-579b-9dcc-635edc947357');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', '2a7d4bb4-43a5-579b-9dcc-635edc947357', DATE '2026-07-22', DATE '2026-08-07', 11074.28, 10852.49, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', '2a7d4bb4-43a5-579b-9dcc-635edc947357', 221.79, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 190 | apLIS lote 6122 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1b9f3492-2b76-5ed4-a11f-3ea1ef6594e6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6122', DATE '2026-06-22', DATE '2026-06-25', 'Recebido - parcial', 7, '463087', '8841', 8821, DATE '2026-07-28', '6122', 11932.92, 34);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-25', DATE '2026-07-25', 11932.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 190). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', '1b9f3492-2b76-5ed4-a11f-3ea1ef6594e6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', '1b9f3492-2b76-5ed4-a11f-3ea1ef6594e6', DATE '2026-07-25', DATE '2026-08-07', 11932.92, 11694.10, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', '1b9f3492-2b76-5ed4-a11f-3ea1ef6594e6', 238.82, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 191 | apLIS lote 6178 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc1e8838-c015-555b-b6a0-bd75daec2f21', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6178', DATE '2026-06-29', DATE '2026-06-29', 'Recebido', 4, '463906', '8841', 8821, DATE '2026-07-28', '6178', 8844.45, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d765512-0db4-5ba8-8a95-9c1625bdf83c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-29', DATE '2026-07-29', 8844.45, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 191). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d765512-0db4-5ba8-8a95-9c1625bdf83c', 'fc1e8838-c015-555b-b6a0-bd75daec2f21');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8d765512-0db4-5ba8-8a95-9c1625bdf83c', 'fc1e8838-c015-555b-b6a0-bd75daec2f21', DATE '2026-07-29', DATE '2026-08-07', 8844.45, 8844.45, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 192 | apLIS lote 6104 | LAB PLANASSISTE ("PLAN ASSISTE - PERIÓDICO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fe7c70e2-be9c-5cd6-b559-6182c82362b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6104', DATE '2026-06-19', DATE '2026-06-19', 'Recebido', 4, '72370', '8692', 8672, DATE '2026-09-30', '6104', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('15770459-68e4-5311-8fc5-530b5119f1c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8692', DATE '2026-06-19', DATE '2026-07-19', 76.85, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 192). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('15770459-68e4-5311-8fc5-530b5119f1c8', 'fe7c70e2-be9c-5cd6-b559-6182c82362b7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('15770459-68e4-5311-8fc5-530b5119f1c8', 'fe7c70e2-be9c-5cd6-b559-6182c82362b7', DATE '2026-07-19', DATE '2026-08-05', 76.85, 76.85, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 193 | apLIS lote 6184 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('125af1c8-ac83-5636-972a-1925a4d3805f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6184', DATE '2026-06-29', DATE '2026-06-29', 'Recebido', 4, '463945', '8841', 8821, DATE '2026-07-28', '6184', 12394.47, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eeb0265b-2017-5014-8563-e6f3d1e39350', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '8841', DATE '2026-06-29', DATE '2026-07-29', 12394.47, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 193). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eeb0265b-2017-5014-8563-e6f3d1e39350', '125af1c8-ac83-5636-972a-1925a4d3805f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eeb0265b-2017-5014-8563-e6f3d1e39350', '125af1c8-ac83-5636-972a-1925a4d3805f', DATE '2026-07-29', DATE '2026-08-07', 12394.47, 12394.47, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 194 | apLIS lote 5974 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d19129dc-7c1d-52c8-92ba-67a2d9e7b7cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5974', DATE '2026-06-05', DATE '2026-06-05', 'Recebido', 4, '68249', '8628', 8608, DATE '2026-07-06', '5974', 17266.78, 39);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21c65a2a-13c2-5430-bc72-43314c98f61b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8628', DATE '2026-06-05', DATE '2026-07-05', 17266.78, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 194). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21c65a2a-13c2-5430-bc72-43314c98f61b', 'd19129dc-7c1d-52c8-92ba-67a2d9e7b7cb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21c65a2a-13c2-5430-bc72-43314c98f61b', 'd19129dc-7c1d-52c8-92ba-67a2d9e7b7cb', DATE '2026-07-05', DATE '2026-07-22', 17266.78, 17266.78, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 195 | apLIS lote 5973 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a3a23b82-bb49-56d7-824e-4cd899f4de0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5973', DATE '2026-06-05', DATE '2026-06-05', 'Recebido', 4, '68403', '8628', 8608, DATE '2026-07-06', '5973', 22748.38, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('737eeb16-9f83-5cca-8c5a-60022e800e12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8628', DATE '2026-06-05', DATE '2026-07-05', 22748.38, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 195). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('737eeb16-9f83-5cca-8c5a-60022e800e12', 'a3a23b82-bb49-56d7-824e-4cd899f4de0f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('737eeb16-9f83-5cca-8c5a-60022e800e12', 'a3a23b82-bb49-56d7-824e-4cd899f4de0f', DATE '2026-07-05', DATE '2026-07-22', 22748.38, 22748.38, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 196 | apLIS lote 5978 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1df8a783-34af-5ddf-a7a2-266fd64b53bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5978', DATE '2026-06-05', DATE '2026-06-05', 'Recebido', 4, '68568', '8628', 8608, DATE '2026-07-06', '5978', 4870.24, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd7b01ac-3360-50b1-981b-a71d6ed9ecc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8628', DATE '2026-06-05', DATE '2026-07-05', 4870.24, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 196). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd7b01ac-3360-50b1-981b-a71d6ed9ecc5', '1df8a783-34af-5ddf-a7a2-266fd64b53bf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bd7b01ac-3360-50b1-981b-a71d6ed9ecc5', '1df8a783-34af-5ddf-a7a2-266fd64b53bf', DATE '2026-07-05', DATE '2026-07-22', 4870.24, 4870.24, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 197 | apLIS lote 5979 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd9f9c44-c29e-5d21-b4e3-378ef8e63aa9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '5979', DATE '2026-06-05', DATE '2026-06-05', 'Recebido', 4, '68595', '8628', 8608, DATE '2026-07-06', '5979', 787.28, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f4cb783-4e4c-5013-ae91-07b3b93a72f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8628', DATE '2026-06-05', DATE '2026-07-05', 787.28, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 197). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f4cb783-4e4c-5013-ae91-07b3b93a72f7', 'cd9f9c44-c29e-5d21-b4e3-378ef8e63aa9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3f4cb783-4e4c-5013-ae91-07b3b93a72f7', 'cd9f9c44-c29e-5d21-b4e3-378ef8e63aa9', DATE '2026-07-05', DATE '2026-07-22', 787.28, 787.28, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 198 | apLIS lote 6062 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3dbe20d0-716b-5b91-a6df-70c3ded7c241', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6062', DATE '2026-06-16', DATE '2026-06-16', 'Recebido', 4, '71218', '8692', 8672, DATE '2026-09-30', '6062', 18687.26, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d1a930e7-bebc-5e2b-a2f6-fe7a302bfa84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8692', DATE '2026-06-17', DATE '2026-07-17', 18687.26, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 198). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d1a930e7-bebc-5e2b-a2f6-fe7a302bfa84', '3dbe20d0-716b-5b91-a6df-70c3ded7c241');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d1a930e7-bebc-5e2b-a2f6-fe7a302bfa84', '3dbe20d0-716b-5b91-a6df-70c3ded7c241', DATE '2026-07-17', DATE '2026-08-05', 18687.26, 18687.26, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 199 | apLIS lote 6067 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d9d33bfe-ce75-5eeb-bbd6-70e96b0620f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6067', DATE '2026-06-16', DATE '2026-06-17', 'Recebido', 4, '71211', '8692', 8672, DATE '2026-09-30', '6067', 787.28, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('48dc0446-3791-5762-b807-79ed78c8e172', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8692', DATE '2026-06-17', DATE '2026-07-17', 787.28, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 199). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('48dc0446-3791-5762-b807-79ed78c8e172', 'd9d33bfe-ce75-5eeb-bbd6-70e96b0620f5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('48dc0446-3791-5762-b807-79ed78c8e172', 'd9d33bfe-ce75-5eeb-bbd6-70e96b0620f5', DATE '2026-07-17', DATE '2026-08-05', 787.28, 787.28, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 200 | apLIS lote 6103 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e68afdb8-e730-5d06-9140-1f721018ea6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6103', DATE '2026-06-19', DATE '2026-06-19', 'Faturado', 3, '72391', '8692', 8672, DATE '2026-09-30', '6103', 2097.90, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '8692', DATE '2026-06-19', DATE '2026-07-19', 2097.90, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 200). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', 'e68afdb8-e730-5d06-9140-1f721018ea6f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', 'e68afdb8-e730-5d06-9140-1f721018ea6f', DATE '2026-07-19', DATE '2026-08-05', 2097.90, 2080.70, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', 'e68afdb8-e730-5d06-9140-1f721018ea6f', 17.20, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 201 | apLIS lote 5843 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a278d553-53e2-5d69-9190-c223a81bfedb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5843', DATE '2026-05-21', DATE '2026-06-15', 'Recebido', 4, '220557', NULL, NULL, NULL, '5843', 7453.07, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6beb1db0-3755-5c96-9733-71f67fc9b9ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-06-16', DATE '2026-08-15', 7453.07, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 201). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6beb1db0-3755-5c96-9733-71f67fc9b9ae', 'a278d553-53e2-5d69-9190-c223a81bfedb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6beb1db0-3755-5c96-9733-71f67fc9b9ae', 'a278d553-53e2-5d69-9190-c223a81bfedb', DATE '2026-08-15', DATE '2026-08-24', 7453.07, 7453.07, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 202 | apLIS lote 6056 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('38b6a22b-5de6-5bfe-831a-f6ccedf0f66e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6056', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '220559', NULL, NULL, NULL, '6056', 2521.18, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('84477b56-89ce-5c3c-bbf0-60de7bae7f1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-06-16', DATE '2026-08-15', 2521.18, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 202). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('84477b56-89ce-5c3c-bbf0-60de7bae7f1d', '38b6a22b-5de6-5bfe-831a-f6ccedf0f66e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('84477b56-89ce-5c3c-bbf0-60de7bae7f1d', '38b6a22b-5de6-5bfe-831a-f6ccedf0f66e', DATE '2026-08-15', DATE '2026-08-24', 2521.18, 2521.18, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 203 | apLIS lote 6057 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('472e6768-505a-51bd-89f7-6c671955383c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6057', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '220560', NULL, NULL, NULL, '6057', 3355.44, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4ae7e292-bf2a-5134-a7e0-70a9c7b03725', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-06-16', DATE '2026-08-15', 3355.44, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 203). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4ae7e292-bf2a-5134-a7e0-70a9c7b03725', '472e6768-505a-51bd-89f7-6c671955383c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4ae7e292-bf2a-5134-a7e0-70a9c7b03725', '472e6768-505a-51bd-89f7-6c671955383c', DATE '2026-08-15', DATE '2026-08-24', 3355.44, 3355.44, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 205 | apLIS lote 6006 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('37963b5b-7aeb-56ba-bb8f-bbc142e807bb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6006', DATE '2026-06-09', DATE '2026-06-09', 'Recebido', 4, '7429404', NULL, NULL, NULL, '6006', 19206.05, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c1b30dbe-f5eb-5445-80b2-9f5ab9b29c94', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-09', DATE '2026-07-09', 19206.05, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 205). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c1b30dbe-f5eb-5445-80b2-9f5ab9b29c94', '37963b5b-7aeb-56ba-bb8f-bbc142e807bb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c1b30dbe-f5eb-5445-80b2-9f5ab9b29c94', '37963b5b-7aeb-56ba-bb8f-bbc142e807bb', DATE '2026-07-09', DATE '2026-07-20', 19206.05, 19206.05, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 206 | apLIS lote 6008 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61b7cf89-4d72-5802-8b16-7112d64436a9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6008', DATE '2026-06-09', DATE '2026-06-09', 'Recebido', 4, '7429515', NULL, NULL, NULL, '6008', 17545.02, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('454d6833-76da-547c-a82d-18441baa6003', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-09', DATE '2026-07-09', 17545.02, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 206). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('454d6833-76da-547c-a82d-18441baa6003', '61b7cf89-4d72-5802-8b16-7112d64436a9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('454d6833-76da-547c-a82d-18441baa6003', '61b7cf89-4d72-5802-8b16-7112d64436a9', DATE '2026-07-09', DATE '2026-07-20', 17545.02, 17545.02, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 207 | apLIS lote 6009 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2daabdcd-3630-507c-a617-f587691e905c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6009', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '7429967', NULL, NULL, NULL, '6009', 1822.98, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7db15e49-64be-5f53-9952-85673d66c7eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-10', DATE '2026-07-10', 1822.98, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 207). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7db15e49-64be-5f53-9952-85673d66c7eb', '2daabdcd-3630-507c-a617-f587691e905c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7db15e49-64be-5f53-9952-85673d66c7eb', '2daabdcd-3630-507c-a617-f587691e905c', DATE '2026-07-10', DATE '2026-07-20', 1822.98, 1822.98, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 208 | apLIS lote 6010 | SAUDE CAIXA ("SAUDE CAIXA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bdfc1d22-6e43-5c4b-afed-1427b72ea0dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6010', DATE '2026-06-10', DATE '2026-06-10', 'Recebido', 4, '7429981', NULL, NULL, NULL, '6010', 436.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('13cca922-cb7d-596a-bdba-700356ae383c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-10', DATE '2026-07-10', 436.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 208). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('13cca922-cb7d-596a-bdba-700356ae383c', 'bdfc1d22-6e43-5c4b-afed-1427b72ea0dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('13cca922-cb7d-596a-bdba-700356ae383c', 'bdfc1d22-6e43-5c4b-afed-1427b72ea0dc', DATE '2026-07-10', DATE '2026-07-20', 436.92, 436.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 209 | apLIS lote 6068 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4aebb390-6ce3-554c-af7a-1b647e313305', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6068', DATE '2026-06-16', DATE '2026-06-16', 'Recebido', 4, '7445079', '8683', 8663, DATE '2026-09-30', '6068', 22899.33, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b9153c41-752c-5336-b220-b29b40389eff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '8683', DATE '2026-06-16', DATE '2026-07-16', 22899.33, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 209). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b9153c41-752c-5336-b220-b29b40389eff', '4aebb390-6ce3-554c-af7a-1b647e313305');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b9153c41-752c-5336-b220-b29b40389eff', '4aebb390-6ce3-554c-af7a-1b647e313305', DATE '2026-07-16', DATE '2026-07-20', 22899.33, 22899.33, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 210 | apLIS lote 6071 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3883ee6-5c7b-56bb-831f-998c29195223', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6071', DATE '2026-06-17', DATE '2026-06-17', 'Recebido', 4, '7446508', '8683', 8663, DATE '2026-09-30', '6071', 1536.20, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('204bd9d6-3300-5c9d-ae25-37308ce5faee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '8683', DATE '2026-06-17', DATE '2026-07-17', 1536.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 210). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('204bd9d6-3300-5c9d-ae25-37308ce5faee', 'f3883ee6-5c7b-56bb-831f-998c29195223');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('204bd9d6-3300-5c9d-ae25-37308ce5faee', 'f3883ee6-5c7b-56bb-831f-998c29195223', DATE '2026-07-17', DATE '2026-07-20', 1536.20, 1536.20, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 211 | apLIS lote 6109 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b64ae669-89ad-54ae-b39a-0f00e8767769', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6109', DATE '2026-06-19', DATE '2026-06-19', 'Recebido', 4, '7453214', '8683', 8663, DATE '2026-09-30', '6109', 4010.56, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7c80ff30-3925-5d2d-86c4-73be96c4b5a6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '8683', DATE '2026-06-19', DATE '2026-07-19', 4010.56, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 211). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7c80ff30-3925-5d2d-86c4-73be96c4b5a6', 'b64ae669-89ad-54ae-b39a-0f00e8767769');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7c80ff30-3925-5d2d-86c4-73be96c4b5a6', 'b64ae669-89ad-54ae-b39a-0f00e8767769', DATE '2026-07-19', DATE '2026-07-20', 4010.56, 4010.56, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 212 | apLIS lote 6128 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eed71221-0f91-584b-a0a0-ad2ec1e0c3fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6128', DATE '2026-06-22', DATE '2026-06-22', 'Recebido', 4, '7456225', NULL, NULL, NULL, '6128', 68.75, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('580a1938-eafe-59b8-934e-9db4b9baae07', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-22', DATE '2026-07-22', 68.75, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 212). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('580a1938-eafe-59b8-934e-9db4b9baae07', 'eed71221-0f91-584b-a0a0-ad2ec1e0c3fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('580a1938-eafe-59b8-934e-9db4b9baae07', 'eed71221-0f91-584b-a0a0-ad2ec1e0c3fe', DATE '2026-07-22', DATE '2026-07-27', 68.75, 68.75, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 213 | apLIS lote 6149 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0e67654-da3c-5b77-8b82-ac8351a0adb4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6149', DATE '2026-06-23', DATE '2026-06-23', 'Recebido', 4, '7458189', NULL, NULL, NULL, '6149', 20461.00, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2a703e7-4f42-5942-a3eb-9120808dc3fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-23', DATE '2026-07-23', 20461.00, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 213). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2a703e7-4f42-5942-a3eb-9120808dc3fe', 'e0e67654-da3c-5b77-8b82-ac8351a0adb4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a2a703e7-4f42-5942-a3eb-9120808dc3fe', 'e0e67654-da3c-5b77-8b82-ac8351a0adb4', DATE '2026-07-23', DATE '2026-07-27', 20461.00, 20461.00, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 214 | apLIS lote 6159 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('37dff0ff-dbe0-5f5f-bca0-38fd00a7ee87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6159', DATE '2026-06-24', DATE '2026-06-24', 'Recebido', 4, '7459970', NULL, NULL, NULL, '6159', 10954.34, 30);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e026fea-87c5-596f-8bb7-3fd9d99fac86', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-25', DATE '2026-07-25', 10954.34, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 214). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e026fea-87c5-596f-8bb7-3fd9d99fac86', '37dff0ff-dbe0-5f5f-bca0-38fd00a7ee87');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e026fea-87c5-596f-8bb7-3fd9d99fac86', '37dff0ff-dbe0-5f5f-bca0-38fd00a7ee87', DATE '2026-07-25', DATE '2026-07-27', 10954.34, 10954.34, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 215 | apLIS lote 6185 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5035b79a-6ed3-5a48-9f47-d3f5ece29496', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6185', DATE '2026-06-29', DATE '2026-06-29', 'Recebido', 4, '7469269', NULL, NULL, NULL, '6185', 9068.06, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0ada252f-56de-5871-9e9d-238bced27267', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-06-29', DATE '2026-07-29', 9068.06, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 215). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0ada252f-56de-5871-9e9d-238bced27267', '5035b79a-6ed3-5a48-9f47-d3f5ece29496');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0ada252f-56de-5871-9e9d-238bced27267', '5035b79a-6ed3-5a48-9f47-d3f5ece29496', DATE '2026-07-29', DATE '2026-08-11', 9068.06, 9068.06, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 216 | apLIS lote 6155 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fc86c21b-8b04-5c36-957e-4e92a01be748', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6155', DATE '2026-06-24', DATE '2026-06-30', 'Recebido - parcial', 7, '260630005256', NULL, NULL, NULL, '6155', 10527.10, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cef25854-2c77-56e2-9068-2be687be6688', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 10527.10, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 216). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', 'fc86c21b-8b04-5c36-957e-4e92a01be748');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cef25854-2c77-56e2-9068-2be687be6688', 'fc86c21b-8b04-5c36-957e-4e92a01be748', DATE '2026-08-04', DATE '2026-07-15', 10527.10, 9342.38, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cef25854-2c77-56e2-9068-2be687be6688', 'fc86c21b-8b04-5c36-957e-4e92a01be748', 765.33, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 217 | apLIS lote 6157 | 090 SULAMERICA ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e666bbb-8445-5274-ac08-ac033da159c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '6157', DATE '2026-06-24', DATE '2026-06-29', 'Recebido - parcial', 7, '260630004646', NULL, NULL, NULL, '6157', 2574.80, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), NULL, DATE '2026-06-30', DATE '2026-08-04', 2574.80, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 217). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', '7e666bbb-8445-5274-ac08-ac033da159c8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', '7e666bbb-8445-5274-ac08-ac033da159c8', DATE '2026-08-04', DATE '2026-07-15', 2574.80, 2285.59, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', '7e666bbb-8445-5274-ac08-ac033da159c8', 289.21, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 218 | apLIS lote 6154 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('26e6c5f7-7cdc-5864-8309-938db760101d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6154', DATE '2026-06-24', DATE '2026-06-30', 'Recebido - parcial', 7, '260630004980', NULL, NULL, NULL, '6154', 10823.55, 58);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 10823.55, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 218). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', '26e6c5f7-7cdc-5864-8309-938db760101d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', '26e6c5f7-7cdc-5864-8309-938db760101d', DATE '2026-08-04', DATE '2026-07-15', 10823.55, 9328.00, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', '26e6c5f7-7cdc-5864-8309-938db760101d', 949.11, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 219 | apLIS lote 6151 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad0a0b7f-cac2-5717-bbac-824e7b9e4e18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6151', DATE '2026-06-23', DATE '2026-06-23', 'Recebido - parcial', 7, '260630004282', NULL, NULL, NULL, '6151', 10996.25, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 10996.25, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 219). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', 'ad0a0b7f-cac2-5717-bbac-824e7b9e4e18');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', 'ad0a0b7f-cac2-5717-bbac-824e7b9e4e18', DATE '2026-08-04', DATE '2026-07-15', 10996.25, 8257.17, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', 'ad0a0b7f-cac2-5717-bbac-824e7b9e4e18', 2739.08, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 220 | apLIS lote 6186 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a58f41e1-80cc-5bed-8611-4c640951e31f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6186', DATE '2026-06-30', DATE '2026-06-30', 'Recebido - parcial', 7, '260630020946', NULL, NULL, NULL, '6186', 1749.75, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 1749.75, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 220). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', 'a58f41e1-80cc-5bed-8611-4c640951e31f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', 'a58f41e1-80cc-5bed-8611-4c640951e31f', DATE '2026-08-04', DATE '2026-07-15', 1749.75, 1330.36, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', 'a58f41e1-80cc-5bed-8611-4c640951e31f', 419.39, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 221 | apLIS lote 6158 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('70f13c50-9f67-5084-9dbe-2e1dd90e1655', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6158', DATE '2026-06-24', DATE '2026-06-30', 'Recebido - parcial', 7, '260630022637', NULL, NULL, NULL, '6158', 1079.70, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 1079.70, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 221). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', '70f13c50-9f67-5084-9dbe-2e1dd90e1655');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', '70f13c50-9f67-5084-9dbe-2e1dd90e1655', DATE '2026-08-04', DATE '2026-08-17', 1079.70, 453.88, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', '70f13c50-9f67-5084-9dbe-2e1dd90e1655', 625.82, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 222 | apLIS lote 6188 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8573ddef-898b-544f-81b4-c76dc1495942', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6188', DATE '2026-06-30', DATE '2026-06-30', 'Recebido - parcial', 7, '260630023081', NULL, NULL, NULL, '6188', 636.87, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 636.87, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 222). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', '8573ddef-898b-544f-81b4-c76dc1495942');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', '8573ddef-898b-544f-81b4-c76dc1495942', DATE '2026-08-04', DATE '2026-07-15', 636.87, 372.15, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', '8573ddef-898b-544f-81b4-c76dc1495942', 264.72, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 223 | apLIS lote 6190 | 090 SULAMERICA ("SUL AMERICA PENDÊNCIA RESOLVIDA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3cffa131-f0f8-5e08-a5c0-a3d77b676f87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '6190', DATE '2026-06-30', DATE '2026-06-30', 'Recebido - parcial', 7, '260630024430', NULL, NULL, NULL, '6190', 747.97, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fa41830c-560b-54c5-b452-96bd0225612a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), NULL, DATE '2026-06-30', DATE '2026-08-04', 747.97, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 223). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fa41830c-560b-54c5-b452-96bd0225612a', '3cffa131-f0f8-5e08-a5c0-a3d77b676f87');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fa41830c-560b-54c5-b452-96bd0225612a', '3cffa131-f0f8-5e08-a5c0-a3d77b676f87', DATE '2026-08-04', DATE '2026-07-15', 747.97, 339.88, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fa41830c-560b-54c5-b452-96bd0225612a', '3cffa131-f0f8-5e08-a5c0-a3d77b676f87', 118.88, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 224 | apLIS lote 6189 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0850c8ca-2bd8-5ab5-b321-07404f6bc868', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6189', DATE '2026-06-30', DATE '2026-06-30', 'Recebido - parcial', 7, '260630024673', NULL, NULL, NULL, '6189', 1675.27, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-06-30', DATE '2026-08-04', 1675.27, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 224). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', '0850c8ca-2bd8-5ab5-b321-07404f6bc868');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', '0850c8ca-2bd8-5ab5-b321-07404f6bc868', DATE '2026-08-04', DATE '2026-07-15', 1675.27, 1463.95, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', '0850c8ca-2bd8-5ab5-b321-07404f6bc868', 211.32, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 225 | apLIS lote 6041 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4b515fbf-ebe8-523e-976b-0285e593c69b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6041', DATE '2026-06-12', DATE '2026-06-12', 'Recebido', 4, '485943', '8756', 8736, DATE '2026-09-30', '6041', 11838.07, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f74bfcf1-78a0-5cd8-ad6f-eb847ce06cf7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8756', DATE '2026-06-12', DATE '2026-07-12', 11838.07, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 225). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f74bfcf1-78a0-5cd8-ad6f-eb847ce06cf7', '4b515fbf-ebe8-523e-976b-0285e593c69b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f74bfcf1-78a0-5cd8-ad6f-eb847ce06cf7', '4b515fbf-ebe8-523e-976b-0285e593c69b', DATE '2026-07-12', DATE '2026-09-15', 11838.07, 11838.07, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 226 | apLIS lote 6046 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5bc63ad1-6c6c-567f-a56a-a540175ad235', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6046', DATE '2026-06-12', DATE '2026-06-15', 'Recebido', 4, '486084', '8756', 8736, DATE '2026-09-30', '6046', 16669.83, 55);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f98e836d-3810-5a81-b84a-5dcf077a78b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8756', DATE '2026-06-13', DATE '2026-07-13', 16669.83, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 226). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f98e836d-3810-5a81-b84a-5dcf077a78b0', '5bc63ad1-6c6c-567f-a56a-a540175ad235');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f98e836d-3810-5a81-b84a-5dcf077a78b0', '5bc63ad1-6c6c-567f-a56a-a540175ad235', DATE '2026-07-13', DATE '2026-09-15', 16669.83, 16669.83, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 227 | apLIS lote 6048 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f26cf5ac-edaf-5ed1-940c-fca70682b480', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6048', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '486182', '8756', 8736, DATE '2026-09-30', '6048', 3540.59, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f2a0735e-f246-5fcf-9946-3ce419867bcc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8756', DATE '2026-06-13', DATE '2026-07-13', 3540.59, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 227). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f2a0735e-f246-5fcf-9946-3ce419867bcc', 'f26cf5ac-edaf-5ed1-940c-fca70682b480');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f2a0735e-f246-5fcf-9946-3ce419867bcc', 'f26cf5ac-edaf-5ed1-940c-fca70682b480', DATE '2026-07-13', DATE '2026-09-15', 3540.59, 3540.59, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 228 | apLIS lote 6047 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1351f12d-928e-508d-b62c-9e871402e319', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6047', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '486539', '8756', 8736, DATE '2026-09-30', '6047', 5573.66, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('26f4c1a8-1051-56d8-a272-85608a29a94f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '8756', DATE '2026-06-13', DATE '2026-07-13', 5573.66, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 228). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('26f4c1a8-1051-56d8-a272-85608a29a94f', '1351f12d-928e-508d-b62c-9e871402e319');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('26f4c1a8-1051-56d8-a272-85608a29a94f', '1351f12d-928e-508d-b62c-9e871402e319', DATE '2026-07-13', DATE '2026-09-15', 5573.66, 5573.66, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 229 | apLIS lote 5994 | STF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7235c74d-0a38-5772-a332-21b8b0092519', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5994', DATE '2026-06-09', DATE '2026-06-09', 'Recebido', 4, '229103', NULL, NULL, NULL, '5994', 1533.94, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a0fe1d24-f3fb-5ecf-b04a-f2a4215c1242', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-06-09', DATE '2026-07-22', 1533.94, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 229). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a0fe1d24-f3fb-5ecf-b04a-f2a4215c1242', '7235c74d-0a38-5772-a332-21b8b0092519');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a0fe1d24-f3fb-5ecf-b04a-f2a4215c1242', '7235c74d-0a38-5772-a332-21b8b0092519', DATE '2026-07-22', DATE '2026-08-27', 1533.94, 1533.94, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 230 | apLIS lote 5996 | STF
-- Data Recebimento '27/08/0226' → ano 2026
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('83b378ca-3669-5d84-a8e7-fe686450c1c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5996', DATE '2026-06-09', DATE '2026-06-09', 'Recebido', 4, '229104', NULL, NULL, NULL, '5996', 173.49, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('75dcf291-153f-5e12-9696-cb468c0252d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-06-09', DATE '2026-07-22', 173.49, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 230). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('75dcf291-153f-5e12-9696-cb468c0252d5', '83b378ca-3669-5d84-a8e7-fe686450c1c1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('75dcf291-153f-5e12-9696-cb468c0252d5', '83b378ca-3669-5d84-a8e7-fe686450c1c1', DATE '2026-07-22', DATE '2026-08-27', 173.49, 173.49, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 231 | apLIS lote 6059 | STF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('29925763-c772-5418-a38e-7aa446e4858a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6059', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '229479', NULL, NULL, NULL, '6059', 1796.50, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b77e14ff-e426-5fa8-9332-7d142f02a570', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-06-15', DATE '2026-07-28', 1796.50, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 231). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b77e14ff-e426-5fa8-9332-7d142f02a570', '29925763-c772-5418-a38e-7aa446e4858a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b77e14ff-e426-5fa8-9332-7d142f02a570', '29925763-c772-5418-a38e-7aa446e4858a', DATE '2026-07-28', DATE '2026-08-27', 1796.50, 1796.50, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 232 | apLIS lote 6090 | STJ ("STJ - PERIÓDICO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d8873eb4-127d-5f09-9949-e86f28b7ea5f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6090', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '10919109', '8691', 8671, DATE '2026-09-30', '6090', 79.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1dc83e11-434f-5238-a7d8-80ee99f5ec2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8691', DATE '2026-06-18', DATE '2026-07-15', 79.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 232). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1dc83e11-434f-5238-a7d8-80ee99f5ec2c', 'd8873eb4-127d-5f09-9949-e86f28b7ea5f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1dc83e11-434f-5238-a7d8-80ee99f5ec2c', 'd8873eb4-127d-5f09-9949-e86f28b7ea5f', DATE '2026-07-15', DATE '2026-07-24', 79.92, 79.92, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 233 | apLIS lote 6092 | STJ ("STJ - PERIÓDICO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2406dfb-d39b-5d68-bf91-3acebeaaa45f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6092', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '10921400', '8691', 8671, DATE '2026-09-30', '6092', 399.60, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f87cf333-05ef-5cfe-87c4-63e303606eb6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8691', DATE '2026-06-18', DATE '2026-07-15', 399.60, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 233). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f87cf333-05ef-5cfe-87c4-63e303606eb6', 'e2406dfb-d39b-5d68-bf91-3acebeaaa45f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f87cf333-05ef-5cfe-87c4-63e303606eb6', 'e2406dfb-d39b-5d68-bf91-3acebeaaa45f', DATE '2026-07-15', DATE '2026-07-24', 399.60, 399.60, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 234 | apLIS lote 6094 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8912f7be-2c83-53dd-86c9-d1f60755f21d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6094', DATE '2026-06-18', DATE '2026-06-18', 'Recebido', 4, '10921367', '8691', 8671, DATE '2026-09-30', '6094', 156.77, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('086c1e2b-b328-5d37-a721-cf8e18a7f756', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8691', DATE '2026-06-18', DATE '2026-07-15', 156.77, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 234). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('086c1e2b-b328-5d37-a721-cf8e18a7f756', '8912f7be-2c83-53dd-86c9-d1f60755f21d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('086c1e2b-b328-5d37-a721-cf8e18a7f756', '8912f7be-2c83-53dd-86c9-d1f60755f21d', DATE '2026-07-15', DATE '2026-07-24', 156.77, 156.77, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 235 | apLIS lote 6073 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bb63c2bf-6023-5d31-9094-afbe2f10f0cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6073', DATE '2026-06-17', DATE '2026-06-18', 'Recebido - parcial', 7, '10921208', '8691', 8671, DATE '2026-09-30', '6073', 17148.53, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8691', DATE '2026-06-18', DATE '2026-07-15', 17148.53, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 235). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', 'bb63c2bf-6023-5d31-9094-afbe2f10f0cf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', 'bb63c2bf-6023-5d31-9094-afbe2f10f0cf', DATE '2026-07-15', DATE '2026-07-24', 17148.53, 16646.69, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', 'bb63c2bf-6023-5d31-9094-afbe2f10f0cf', 501.84, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 236 | apLIS lote 5835 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('255f5901-eb59-5ad2-b076-44a111bcfd4a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5835', DATE '2026-05-21', DATE '2026-06-19', 'Recebido - parcial', 7, '10924400', '8691', 8671, DATE '2026-09-30', '5835', 4574.20, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '8691', DATE '2026-06-19', DATE '2026-07-15', 4574.20, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 236). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', '255f5901-eb59-5ad2-b076-44a111bcfd4a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', '255f5901-eb59-5ad2-b076-44a111bcfd4a', DATE '2026-07-15', DATE '2026-07-24', 4574.20, 4239.64, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', '255f5901-eb59-5ad2-b076-44a111bcfd4a', 334.56, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JUNHO linha 237 | apLIS lote 5940 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('522c0a20-06a6-54ee-be17-b8af806d0d05', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5940', DATE '2026-06-01', DATE '2026-06-01', 'Recebido', 4, '4483', '8764', 8744, DATE '2026-09-30', '5940', 898.69, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('70870e7c-63e4-5922-b699-116a72fe8bfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '8764', DATE '2026-06-01', DATE '2026-07-01', 898.69, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 237). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('70870e7c-63e4-5922-b699-116a72fe8bfa', '522c0a20-06a6-54ee-be17-b8af806d0d05');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('70870e7c-63e4-5922-b699-116a72fe8bfa', '522c0a20-06a6-54ee-be17-b8af806d0d05', DATE '2026-07-01', DATE '2026-09-14', 898.69, 898.69, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 238 | apLIS lote 5944 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('47cc6ec3-8ed8-5bf9-bcc3-45282e18317f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '5944', DATE '2026-06-02', DATE '2026-06-02', 'Recebido', 4, '4492', '8764', 8744, DATE '2026-09-30', '5944', 79.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('adbc54f6-e374-53df-929d-623945f88a9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '8764', DATE '2026-06-02', DATE '2026-07-02', 79.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 238). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('adbc54f6-e374-53df-929d-623945f88a9a', '47cc6ec3-8ed8-5bf9-bcc3-45282e18317f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('adbc54f6-e374-53df-929d-623945f88a9a', '47cc6ec3-8ed8-5bf9-bcc3-45282e18317f', DATE '2026-07-02', DATE '2026-09-14', 79.92, 79.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 239 | apLIS lote 5951 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('48c7d8de-e256-5adb-8ca6-d346433d70fe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5951', DATE '2026-06-02', DATE '2026-06-02', 'Recebido', 4, '62572', '8696', 8676, DATE '2026-09-30', '5951', 79.92, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('64ab4d9b-d080-5741-9fd2-e0893fab7b83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8696', DATE '2026-06-02', DATE '2026-07-02', 79.92, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 239). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('64ab4d9b-d080-5741-9fd2-e0893fab7b83', '48c7d8de-e256-5adb-8ca6-d346433d70fe');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('64ab4d9b-d080-5741-9fd2-e0893fab7b83', '48c7d8de-e256-5adb-8ca6-d346433d70fe', DATE '2026-07-02', DATE '2026-07-23', 79.92, 79.92, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 240 | apLIS lote 5950 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2d547d28-acf5-5d67-b5c3-95d92889118b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5950', DATE '2026-06-02', DATE '2026-06-02', 'Recebido', 4, '62570', '8696', 8676, DATE '2026-09-30', '5950', 6450.67, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('efac810d-f368-5a9d-888d-b0a891e7cb7b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8696', DATE '2026-06-02', DATE '2026-07-02', 6450.67, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 240). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('efac810d-f368-5a9d-888d-b0a891e7cb7b', '2d547d28-acf5-5d67-b5c3-95d92889118b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('efac810d-f368-5a9d-888d-b0a891e7cb7b', '2d547d28-acf5-5d67-b5c3-95d92889118b', DATE '2026-07-02', DATE '2026-07-23', 6450.67, 6450.67, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 241 | apLIS lote 1996 | TRT ("TRT / PENDÊNCIA DE 2023" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bcbba671-e18f-55a8-a0bd-f830ce70ca81', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '1996', DATE '2023-01-27', DATE '2026-06-02', 'Faturado', 3, '62575', '8696', 8676, DATE '2026-09-30', '1996', 2874.44, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8696', DATE '2026-06-02', DATE '2026-07-02', 2874.44, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 241). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', 'bcbba671-e18f-55a8-a0bd-f830ce70ca81');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', 'bcbba671-e18f-55a8-a0bd-f830ce70ca81', DATE '2026-07-02', DATE '2026-07-23', 2874.44, 2182.13, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', 'bcbba671-e18f-55a8-a0bd-f830ce70ca81', 692.31, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 242 | apLIS lote 5953 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fe2a0af5-3b89-563b-8ed8-8e0786c8726c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5953', DATE '2026-06-02', DATE '2026-06-02', 'Recebido', 4, '62576', '8696', 8676, DATE '2026-09-30', '5953', 281.25, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2c435209-f054-5c82-9bb9-d00c8fffb148', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8696', DATE '2026-06-02', DATE '2026-07-02', 281.25, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 242). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2c435209-f054-5c82-9bb9-d00c8fffb148', 'fe2a0af5-3b89-563b-8ed8-8e0786c8726c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2c435209-f054-5c82-9bb9-d00c8fffb148', 'fe2a0af5-3b89-563b-8ed8-8e0786c8726c', DATE '2026-07-02', DATE '2026-07-23', 281.25, 281.25, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 243 | apLIS lote 6055 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c650320b-a165-5ead-b74a-ed62ea20f2cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6055', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '62718', '8843', 8823, DATE '2026-09-30', '6055', 468.23, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d634715-8aaa-57ad-a094-cf67ebe2bc5a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '8843', DATE '2026-06-15', DATE '2026-07-15', 468.23, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 243). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d634715-8aaa-57ad-a094-cf67ebe2bc5a', 'c650320b-a165-5ead-b74a-ed62ea20f2cd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6d634715-8aaa-57ad-a094-cf67ebe2bc5a', 'c650320b-a165-5ead-b74a-ed62ea20f2cd', DATE '2026-07-15', DATE '2026-08-05', 468.23, 468.23, 'recebido', 'Renata', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 244 | apLIS lote 6053 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3914cf6-9687-5347-9d82-921f45066c92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6053', DATE '2026-06-15', DATE '2026-06-15', 'Recebido', 4, '62720', '9175', 9158, DATE '2026-10-31', '6053', 4797.37, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '9175', DATE '2026-06-15', DATE '2026-07-15', 4797.37, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 244). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', 'c3914cf6-9687-5347-9d82-921f45066c92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', 'c3914cf6-9687-5347-9d82-921f45066c92', DATE '2026-07-15', DATE '2026-09-14', 4797.37, 4362.53, 'parcial', 'Renata', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', 'c3914cf6-9687-5347-9d82-921f45066c92', 434.84, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JUNHO linha 246 | apLIS lote 6113 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9f28104b-5a8c-551b-8b0e-bde71d998a51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '6113', DATE '2026-06-19', DATE '2026-06-19', 'Recebido', 4, 'P20261252183', NULL, NULL, NULL, '6113', 2101.30, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('07c41c7a-db28-5dbf-8961-0651b7bbe930', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-06-19', DATE '2026-07-20', 2101.30, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 246). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('07c41c7a-db28-5dbf-8961-0651b7bbe930', '9f28104b-5a8c-551b-8b0e-bde71d998a51');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('07c41c7a-db28-5dbf-8961-0651b7bbe930', '9f28104b-5a8c-551b-8b0e-bde71d998a51', DATE '2026-07-20', DATE '2026-07-20', 2101.30, 2101.30, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JUNHO linha 247 | apLIS lote 6114 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('460d14ad-f426-5b38-9246-62c0829d3b71', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '6114', DATE '2026-06-22', DATE '2026-06-22', 'Faturado', 3, 'P20261252261', NULL, NULL, NULL, '6114', 17283.46, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('613dabd6-fb21-5fbd-aa11-4077646a04bf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-06-22', DATE '2026-07-20', 17283.46, '2026-06', 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, linha 247). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('613dabd6-fb21-5fbd-aa11-4077646a04bf', '460d14ad-f426-5b38-9246-62c0829d3b71');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('613dabd6-fb21-5fbd-aa11-4077646a04bf', '460d14ad-f426-5b38-9246-62c0829d3b71', DATE '2026-07-20', DATE '2026-07-20', 17283.46, 17283.46, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q2 (aba JUNHO, %'
     AND competencia = '2026-06'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 219 THEN
    RAISE EXCEPTION 'Esperados 219 títulos do backfill de junho; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
