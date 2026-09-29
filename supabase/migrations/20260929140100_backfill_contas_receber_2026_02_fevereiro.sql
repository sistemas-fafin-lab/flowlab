-- ============================================================================
-- Backfill histórico: Contas a Receber — Fevereiro/2026 (2 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba FEVEREIRO de "Faturamento x Recebimentos - 2026 -
-- 1° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-02;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 113 títulos, R$ 1.020.428,75 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 66 recebidos, 45 parciais, 2 previstos.
-- Glosas: 44 abertas, 1 definitivas (refaturadas em outro lote),
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
    '4862', '4867', '4871', '4877', '4881', '4882', '4908', '4924', '4931', '4932', '4933', '4934'
    '4936', '4938', '4939', '4940', '4941', '4942', '4943', '4955', '4956', '4957', '4958', '4959'
    '4960', '4961', '4962', '4963', '4964', '4965', '4966', '4969', '4970', '4971', '4972', '4973'
    '4974', '4976', '4977', '4978', '4986', '4987', '4988', '4990', '4992', '4993', '4994', '4995'
    '4996', '4997', '4998', '4999', '5000', '5001', '5002', '5003', '5004', '5007', '5008', '5009'
    '5010', '5011', '5013', '5014', '5017', '5018', '5022', '5023', '5024', '5026', '5027', '5028'
    '5029', '5030', '5031', '5032', '5035', '5036', '5037', '5038', '5039', '5040', '5041', '5042'
    '5045', '5049', '5050', '5051', '5053', '5054', '5055', '5056', '5057', '5060', '5063', '5064'
    '5065', '5066', '5070', '5074', '5077', '5079', '5080', '5081', '5082', '5083', '5084', '5093'
    '5094', '5097', '5101', '5114', '5653'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1052', '1101', '1122', '1197', '1204', '1227', '1228', '1231', '1232', '1235', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283', '1343');
  IF v_operadoras <> 25 THEN
    RAISE EXCEPTION 'Esperadas 25 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- FEVEREIRO linha 25 | apLIS lote 5060 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea5db88f-925f-5ff9-b632-41ae75d2d0b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5060', DATE '2026-02-23', DATE '2026-02-25', 'Recebido - parcial', 7, '25022026', NULL, NULL, NULL, '5060', 23927.99, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1f15146a-6a05-54e4-ab21-a52e64665249', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-25', DATE '2026-04-26', 23927.99, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 25). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1f15146a-6a05-54e4-ab21-a52e64665249', 'ea5db88f-925f-5ff9-b632-41ae75d2d0b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1f15146a-6a05-54e4-ab21-a52e64665249', 'ea5db88f-925f-5ff9-b632-41ae75d2d0b6', DATE '2026-04-26', DATE '2026-04-17', 23927.99, 23927.99, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 26 | apLIS lote 5029 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('af5c7c7b-1d00-57a7-b574-2aa133a99e7e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5029', DATE '2026-02-18', DATE '2026-02-18', 'Recebido', 4, '44662624', NULL, NULL, NULL, '5029', 3810.62, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3ed81277-5848-5fc3-801b-b637465d6ab2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-18', DATE '2026-04-19', 3810.62, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 26). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3ed81277-5848-5fc3-801b-b637465d6ab2', 'af5c7c7b-1d00-57a7-b574-2aa133a99e7e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3ed81277-5848-5fc3-801b-b637465d6ab2', 'af5c7c7b-1d00-57a7-b574-2aa133a99e7e', DATE '2026-04-19', DATE '2026-04-02', 3810.62, 3810.62, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 27 | apLIS lote 5039 | AMHP-DF ("AMHPDF TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('51585fe0-f2fd-5616-af7a-852b1b4e1790', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5039', DATE '2026-02-19', DATE '2026-02-23', 'Faturado', 3, '23022026', '8030', 8010, DATE '2026-06-30', '5039', 25736.34, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '8030', DATE '2026-02-23', DATE '2026-04-24', 25736.34, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 27). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', '51585fe0-f2fd-5616-af7a-852b1b4e1790');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', '51585fe0-f2fd-5616-af7a-852b1b4e1790', DATE '2026-04-24', DATE '2026-04-02', 25736.34, 25736.34, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 28 | apLIS lote 5028 | AMHP-DF ("AMHPDF - PETROBRÁS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c5d966c-6828-5602-880c-f29a0d570a24', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5028', DATE '2026-02-18', DATE '2026-02-18', 'Recebido', 4, '44662581', NULL, NULL, NULL, '5028', 797.47, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-18', DATE '2026-04-19', 797.47, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 28). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8', '6c5d966c-6828-5602-880c-f29a0d570a24');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8', '6c5d966c-6828-5602-880c-f29a0d570a24', DATE '2026-04-19', DATE '2026-04-02', 797.47, 797.47, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 29 | apLIS lote 5024 | AMHP-DF ("AMHPDF - PROASA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2d195875-1617-5538-a4c2-59b56110b86f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5024', DATE '2026-02-18', DATE '2026-02-18', 'Faturado', 3, '44662551', NULL, NULL, NULL, '5024', 2579.79, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('329efbcb-03cc-57a9-95e6-893e1a9e9fe6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-18', DATE '2026-04-19', 2579.79, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 29). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('329efbcb-03cc-57a9-95e6-893e1a9e9fe6', '2d195875-1617-5538-a4c2-59b56110b86f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('329efbcb-03cc-57a9-95e6-893e1a9e9fe6', '2d195875-1617-5538-a4c2-59b56110b86f', DATE '2026-04-19', DATE '2026-04-02', 2579.79, 2579.79, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 30 | apLIS lote 5027 | AMHP-DF ("AMHPDF - NOTREDAME" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5a1120a3-7034-57f2-b3ca-5122c5b8e055', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5027', DATE '2026-02-18', DATE '2026-02-18', 'Recebido - parcial', 7, '44662566', NULL, NULL, NULL, '5027', 635.00, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8962b837-4e89-5282-9938-fc45395e7962', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-18', DATE '2026-04-19', 635.00, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 30). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8962b837-4e89-5282-9938-fc45395e7962', '5a1120a3-7034-57f2-b3ca-5122c5b8e055');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8962b837-4e89-5282-9938-fc45395e7962', '5a1120a3-7034-57f2-b3ca-5122c5b8e055', DATE '2026-04-19', DATE '2026-04-22', 635.00, 635.00, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 31 | apLIS lote 5035 | AMHP-DF ("AMHPDF - NOTREDAME" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d87acd6e-947c-553f-8771-155671f229c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5035', DATE '2026-02-18', DATE '2026-02-19', 'Recebido - parcial', 7, '44662926', NULL, NULL, NULL, '5035', 1329.74, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-19', DATE '2026-04-20', 1329.74, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 31). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f', 'd87acd6e-947c-553f-8771-155671f229c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f', 'd87acd6e-947c-553f-8771-155671f229c5', DATE '2026-04-20', DATE '2026-04-02', 1329.74, 1329.74, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 32 | apLIS lote 5031 | AMHP-DF ("AMHPDF - OMINT" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9460f2fe-32f3-52e6-b597-c0a4168aa0dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5031', DATE '2026-02-18', DATE '2026-02-18', 'Recebido - parcial', 7, '44662725', NULL, NULL, NULL, '5031', 5490.66, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63d79cc8-c535-508c-a65b-3c597b8561b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-02-18', DATE '2026-04-19', 5490.66, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 32). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63d79cc8-c535-508c-a65b-3c597b8561b3', '9460f2fe-32f3-52e6-b597-c0a4168aa0dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('63d79cc8-c535-508c-a65b-3c597b8561b3', '9460f2fe-32f3-52e6-b597-c0a4168aa0dc', DATE '2026-04-19', DATE '2026-04-02', 5490.66, 5490.66, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 33 | apLIS lote 4978 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ee040fce-276c-588a-9d47-ece5f07629dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '4978', DATE '2026-02-05', DATE '2026-02-05', 'Recebido', 4, 'PEG5602676357', NULL, NULL, NULL, '4978', 500.52, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-02-05', DATE '2026-03-07', 500.52, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 33). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', 'ee040fce-276c-588a-9d47-ece5f07629dd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', 'ee040fce-276c-588a-9d47-ece5f07629dd', DATE '2026-03-07', DATE '2026-04-25', 500.52, 340.52, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', 'ee040fce-276c-588a-9d47-ece5f07629dd', 160.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 34 | apLIS lote 4977 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5ae77b79-c119-59ab-bcf7-3b2556eb8732', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '4977', DATE '2026-02-05', DATE '2026-02-05', 'Recebido', 4, 'PEG5602806999', NULL, NULL, NULL, '4977', 2903.92, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-02-05', DATE '2026-03-07', 2903.92, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 34). Responsável: Raquel. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', '5ae77b79-c119-59ab-bcf7-3b2556eb8732');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', '5ae77b79-c119-59ab-bcf7-3b2556eb8732', DATE '2026-03-07', DATE '2026-04-26', 2903.92, 2743.92, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', '5ae77b79-c119-59ab-bcf7-3b2556eb8732', 160.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 35 | apLIS lote 4976 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cf08dd82-e37a-59bb-a792-c11a9718bf35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '4976', DATE '2026-02-05', DATE '2026-02-05', 'Recebido', 4, 'PEG5602965673', NULL, NULL, NULL, '4976', 12096.71, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c79d5f2-92b1-59a1-91dd-4147ac4bf8a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-02-05', DATE '2026-03-07', 12096.71, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 35). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c79d5f2-92b1-59a1-91dd-4147ac4bf8a2', 'cf08dd82-e37a-59bb-a792-c11a9718bf35');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3c79d5f2-92b1-59a1-91dd-4147ac4bf8a2', 'cf08dd82-e37a-59bb-a792-c11a9718bf35', DATE '2026-03-07', DATE '2026-04-27', 12096.71, 12096.71, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 36 | apLIS lote 5014 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cb79c29d-3004-5826-87bc-f2ae5fb9b7f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '5014', DATE '2026-02-12', DATE '2026-02-13', 'Recebido', 4, 'PEG5614205174', NULL, NULL, NULL, '5014', 8078.89, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('72cff773-d9d5-5949-bc48-37072abee748', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-02-13', DATE '2026-02-13', 8078.89, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 36). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', 'cb79c29d-3004-5826-87bc-f2ae5fb9b7f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('72cff773-d9d5-5949-bc48-37072abee748', 'cb79c29d-3004-5826-87bc-f2ae5fb9b7f9', DATE '2026-02-13', DATE '2026-04-28', 8078.89, 7368.89, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('72cff773-d9d5-5949-bc48-37072abee748', 'cb79c29d-3004-5826-87bc-f2ae5fb9b7f9', 710.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 37 | apLIS lote 4956 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ac22ec15-712d-512b-9ceb-259bb31c474f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4956', DATE '2026-02-03', DATE '2026-02-04', 'Recebido', 4, '1283915', NULL, NULL, NULL, '4956', 16451.42, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fc280ff3-aed5-5ae5-8a0a-66996e590f72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-04', DATE '2026-03-20', 16451.42, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 37). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fc280ff3-aed5-5ae5-8a0a-66996e590f72', 'ac22ec15-712d-512b-9ceb-259bb31c474f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fc280ff3-aed5-5ae5-8a0a-66996e590f72', 'ac22ec15-712d-512b-9ceb-259bb31c474f', DATE '2026-03-20', DATE '2026-04-16', 16451.42, 16451.42, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 38 | apLIS lote 4957 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('45f2accf-48c2-5150-80f0-a47132836f0a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4957', DATE '2026-02-03', DATE '2026-02-05', 'Recebido', 4, '1285955', NULL, NULL, NULL, '4957', 14679.29, 80);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-05', DATE '2026-03-20', 14679.29, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 38). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', '45f2accf-48c2-5150-80f0-a47132836f0a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', '45f2accf-48c2-5150-80f0-a47132836f0a', DATE '2026-03-20', DATE '2026-04-16', 14679.29, 14679.29, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 39 | apLIS lote 4966 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ec76997e-e6e1-5b0e-a409-26e918a4badd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4966', DATE '2026-02-04', DATE '2026-02-06', 'Recebido', 4, '1289647', NULL, NULL, NULL, '4966', 7477.07, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1930b366-53b1-566c-9e47-fad81beb5163', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-06', DATE '2026-03-20', 7477.07, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 39). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1930b366-53b1-566c-9e47-fad81beb5163', 'ec76997e-e6e1-5b0e-a409-26e918a4badd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1930b366-53b1-566c-9e47-fad81beb5163', 'ec76997e-e6e1-5b0e-a409-26e918a4badd', DATE '2026-03-20', DATE '2026-04-16', 7477.07, 7477.07, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 40 | apLIS lote 4990 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a0028d2-5c5e-5eec-96a6-ccb0de969527', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4990', DATE '2026-02-06', DATE '2026-02-06', 'Recebido', 4, '1289029', NULL, NULL, NULL, '4990', 12033.24, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('70a4488e-ebe7-5abd-9d15-205cd3f17e70', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-06', DATE '2026-03-20', 12033.24, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 40). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('70a4488e-ebe7-5abd-9d15-205cd3f17e70', '1a0028d2-5c5e-5eec-96a6-ccb0de969527');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('70a4488e-ebe7-5abd-9d15-205cd3f17e70', '1a0028d2-5c5e-5eec-96a6-ccb0de969527', DATE '2026-03-20', DATE '2026-04-16', 12033.24, 12033.24, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 41 | apLIS lote 4958 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('057ce2ac-b865-53fc-b56e-d6b035979957', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4958', DATE '2026-02-03', DATE '2026-02-06', 'Recebido', 4, '1288939', NULL, NULL, NULL, '4958', 11223.04, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f979044b-aed0-5068-9235-313f27e816a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-06', DATE '2026-03-20', 11223.04, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 41). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f979044b-aed0-5068-9235-313f27e816a0', '057ce2ac-b865-53fc-b56e-d6b035979957');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f979044b-aed0-5068-9235-313f27e816a0', '057ce2ac-b865-53fc-b56e-d6b035979957', DATE '2026-03-20', DATE '2026-04-16', 11223.04, 11223.04, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 42 | apLIS lote 4959 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bae91d18-4e44-546f-9486-3776f13e319c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4959', DATE '2026-02-03', DATE '2026-02-06', 'Recebido', 4, '1290524', NULL, NULL, NULL, '4959', 1498.88, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-06', DATE '2026-03-20', 1498.88, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 42). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', 'bae91d18-4e44-546f-9486-3776f13e319c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', 'bae91d18-4e44-546f-9486-3776f13e319c', DATE '2026-03-20', DATE '2026-04-16', 1498.88, 1498.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 43 | apLIS lote 4960 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2388d35f-1d04-585e-afa2-457f335e35f1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4960', DATE '2026-02-03', DATE '2026-02-06', 'Recebido - parcial', 7, '1290407', NULL, NULL, NULL, '4960', 575.28, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-02-06', DATE '2026-03-20', 575.28, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 43). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', '2388d35f-1d04-585e-afa2-457f335e35f1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', '2388d35f-1d04-585e-afa2-457f335e35f1', DATE '2026-03-20', DATE '2026-04-16', 575.28, 431.14, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', '2388d35f-1d04-585e-afa2-457f335e35f1', 144.14, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 44 | apLIS lote 4882 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9061fd9d-cd7b-5585-aaaf-d24e9f96cc3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4882', DATE '2026-01-23', DATE '2026-02-10', 'Recebido - parcial', 7, 'PEG340225142585_0', NULL, NULL, NULL, '4882', 6783.20, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-10', DATE '2026-04-11', 6783.20, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 44). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', '9061fd9d-cd7b-5585-aaaf-d24e9f96cc3c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', '9061fd9d-cd7b-5585-aaaf-d24e9f96cc3c', DATE '2026-04-11', DATE '2026-03-16', 6783.20, 6004.74, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', '9061fd9d-cd7b-5585-aaaf-d24e9f96cc3c', 778.46, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 45 | apLIS lote 4881 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0852be1b-e5e0-5887-8167-82c0e93f431c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4881', DATE '2026-01-23', DATE '2026-02-10', 'Recebido', 4, 'PEG340225145768_0', NULL, NULL, NULL, '4881', 23203.90, 63);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d1c67b70-66ba-5846-a719-8b81df01507e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-10', DATE '2026-04-11', 23203.90, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 45). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d1c67b70-66ba-5846-a719-8b81df01507e', '0852be1b-e5e0-5887-8167-82c0e93f431c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d1c67b70-66ba-5846-a719-8b81df01507e', '0852be1b-e5e0-5887-8167-82c0e93f431c', DATE '2026-04-11', DATE '2026-03-17', 23203.90, 23203.90, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 46 | apLIS lote 4877 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('afa62059-9a6e-56b4-af28-0a9dbb226c47', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4877', DATE '2026-01-23', DATE '2026-02-10', 'Recebido - parcial', 7, 'PEG341225147036_0', NULL, NULL, NULL, '4877', 17563.35, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('325053e9-9e25-53bb-8e86-d714bb60408c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-02-10', DATE '2026-04-11', 17563.35, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 46). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('325053e9-9e25-53bb-8e86-d714bb60408c', 'afa62059-9a6e-56b4-af28-0a9dbb226c47');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('325053e9-9e25-53bb-8e86-d714bb60408c', 'afa62059-9a6e-56b4-af28-0a9dbb226c47', DATE '2026-04-11', DATE '2026-03-17', 17563.35, 17158.23, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('325053e9-9e25-53bb-8e86-d714bb60408c', 'afa62059-9a6e-56b4-af28-0a9dbb226c47', 405.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 47 | apLIS lote 4995 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0db0989b-3009-5e84-a865-61a371a87761', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4995', DATE '2026-02-09', DATE '2026-02-10', 'Recebido', 4, 'PEG340225148883_0', NULL, NULL, NULL, '4995', 23212.64, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-10', DATE '2026-04-11', 23212.64, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 47). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', '0db0989b-3009-5e84-a865-61a371a87761');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', '0db0989b-3009-5e84-a865-61a371a87761', DATE '2026-04-11', DATE '2026-03-17', 23212.64, 23118.14, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', '0db0989b-3009-5e84-a865-61a371a87761', 94.50, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 48 | apLIS lote 4996 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('71cfdb57-c452-59aa-ae5f-68bb3023a97c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4996', DATE '2026-02-09', DATE '2026-02-10', 'Em Processamento', 1, 'PEG340225149800_0', NULL, NULL, NULL, '4996', 19732.24, 58);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-10', DATE '2026-04-11', 19732.24, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 48). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', '71cfdb57-c452-59aa-ae5f-68bb3023a97c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', '71cfdb57-c452-59aa-ae5f-68bb3023a97c', DATE '2026-04-11', DATE '2026-03-17', 19732.24, 19732.24, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', '71cfdb57-c452-59aa-ae5f-68bb3023a97c', 405.12, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Raquel');

-- FEVEREIRO linha 49 | apLIS lote 4994 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1d46699d-05c9-5ad0-8658-d1698dddb51f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4994', DATE '2026-02-09', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG341225517296_0', '8022', 8002, DATE '2026-04-16', '4994', 23597.27, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '8022', DATE '2026-02-25', DATE '2026-04-26', 23597.27, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 49). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', '1d46699d-05c9-5ad0-8658-d1698dddb51f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', '1d46699d-05c9-5ad0-8658-d1698dddb51f', DATE '2026-04-26', DATE '2026-04-09', 23597.27, 23571.73, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', '1d46699d-05c9-5ad0-8658-d1698dddb51f', 25.54, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 50 | apLIS lote 4908 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b40523ef-c2cc-5684-ab8d-1044d3318d43', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4908', DATE '2026-01-28', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG340225518790_0', NULL, NULL, NULL, '4908', 3146.79, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-25', DATE '2026-04-26', 3146.79, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 50). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', 'b40523ef-c2cc-5684-ab8d-1044d3318d43');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', 'b40523ef-c2cc-5684-ab8d-1044d3318d43', DATE '2026-04-26', DATE '2026-04-09', 3146.79, 2746.37, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', 'b40523ef-c2cc-5684-ab8d-1044d3318d43', 400.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 51 | apLIS lote 4997 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3990e27-41cc-5b6f-ace4-2fa1838915e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4997', DATE '2026-02-09', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG340225527001_0', NULL, NULL, NULL, '4997', 42050.46, 75);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94482fa2-3e8f-5475-9655-656e98ba61b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-25', DATE '2026-04-26', 42050.46, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 51). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94482fa2-3e8f-5475-9655-656e98ba61b1', 'f3990e27-41cc-5b6f-ace4-2fa1838915e3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('94482fa2-3e8f-5475-9655-656e98ba61b1', 'f3990e27-41cc-5b6f-ace4-2fa1838915e3', DATE '2026-04-26', DATE '2026-04-09', 42050.46, 41240.20, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('94482fa2-3e8f-5475-9655-656e98ba61b1', 'f3990e27-41cc-5b6f-ace4-2fa1838915e3', 810.26, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 52 | apLIS lote 4998 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed36ab9f-0e5e-50b2-8514-5029819ec22b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4998', DATE '2026-02-09', DATE '2026-02-25', 'Recebido', 4, 'PEG340225527631_0', NULL, NULL, NULL, '4998', 529.32, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a832ac05-8f64-5657-a571-7913e95e1ee6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-25', DATE '2026-04-26', 529.32, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 52). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a832ac05-8f64-5657-a571-7913e95e1ee6', 'ed36ab9f-0e5e-50b2-8514-5029819ec22b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a832ac05-8f64-5657-a571-7913e95e1ee6', 'ed36ab9f-0e5e-50b2-8514-5029819ec22b', DATE '2026-04-26', DATE '2026-04-09', 529.32, 529.32, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 53 | apLIS lote 5002 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cc2cf5a0-4bab-52fb-85b9-1724f96cc8eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5002', DATE '2026-02-10', DATE '2026-02-25', 'Recebido', 4, 'PEG340225529978_0', NULL, NULL, NULL, '5002', 1364.86, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('60390258-4037-5747-a215-ffb133b44f64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-25', DATE '2026-04-26', 1364.86, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 53). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('60390258-4037-5747-a215-ffb133b44f64', 'cc2cf5a0-4bab-52fb-85b9-1724f96cc8eb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('60390258-4037-5747-a215-ffb133b44f64', 'cc2cf5a0-4bab-52fb-85b9-1724f96cc8eb', DATE '2026-04-26', DATE '2026-04-09', 1364.86, 1364.86, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 54 | apLIS lote 5079 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c7fc45f7-33d7-569c-9f3f-29403c68c459', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '5079', DATE '2026-02-26', DATE '2026-02-26', 'Recebido', 4, 'PEG341225547510_0', NULL, NULL, NULL, '5079', 3459.46, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f172cec2-067c-5169-8eb3-694e21f5b3e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-02-26', DATE '2026-04-27', 3459.46, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 54). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f172cec2-067c-5169-8eb3-694e21f5b3e3', 'c7fc45f7-33d7-569c-9f3f-29403c68c459');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f172cec2-067c-5169-8eb3-694e21f5b3e3', 'c7fc45f7-33d7-569c-9f3f-29403c68c459', DATE '2026-04-27', DATE '2026-04-09', 3459.46, 3459.46, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 55 | apLIS lote 5080 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('124881a0-234d-5445-9614-4e9cce814320', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5080', DATE '2026-02-26', DATE '2026-02-26', 'Recebido', 4, 'PEG340225550552_0', NULL, NULL, NULL, '5080', 13272.19, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d3ea0baa-b152-5b86-8186-9047843d55a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-26', DATE '2026-04-27', 13272.19, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 55). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d3ea0baa-b152-5b86-8186-9047843d55a2', '124881a0-234d-5445-9614-4e9cce814320');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d3ea0baa-b152-5b86-8186-9047843d55a2', '124881a0-234d-5445-9614-4e9cce814320', DATE '2026-04-27', DATE '2026-04-09', 13272.19, 12705.13, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d3ea0baa-b152-5b86-8186-9047843d55a2', '124881a0-234d-5445-9614-4e9cce814320', 567.06, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 56 | apLIS lote 5077 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('29dc04a5-41db-5c17-945e-a8cab27f2055', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5077', DATE '2026-02-25', DATE '2026-02-26', 'Recebido', 4, 'PEG340225557808_0', NULL, NULL, NULL, '5077', 25669.02, 70);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('802f7822-74b8-5e29-9709-b41608024ee8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-26', DATE '2026-04-27', 25669.02, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 56). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('802f7822-74b8-5e29-9709-b41608024ee8', '29dc04a5-41db-5c17-945e-a8cab27f2055');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('802f7822-74b8-5e29-9709-b41608024ee8', '29dc04a5-41db-5c17-945e-a8cab27f2055', DATE '2026-04-27', DATE '2026-04-09', 25669.02, 25669.02, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 57 | apLIS lote 5003 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('87f343ae-3dee-521d-a7ae-71793a1dd056', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5003', DATE '2026-02-10', DATE '2026-02-26', 'Recebido - parcial', 7, 'PEG340225559928_0', NULL, NULL, NULL, '5003', 5842.93, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-26', DATE '2026-04-27', 5842.93, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 57). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba', '87f343ae-3dee-521d-a7ae-71793a1dd056');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba', '87f343ae-3dee-521d-a7ae-71793a1dd056', DATE '2026-04-27', DATE '2026-04-09', 5842.93, 5842.93, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 58 | apLIS lote 5074 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6aac5e59-3daf-5d99-b0c1-5ce52966f7a3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5074', DATE '2026-02-25', DATE '2026-02-26', 'Recebido', 4, 'PEG340225559342_0', NULL, NULL, NULL, '5074', 25669.02, 58);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-26', DATE '2026-04-27', 25669.02, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 58). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', '6aac5e59-3daf-5d99-b0c1-5ce52966f7a3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', '6aac5e59-3daf-5d99-b0c1-5ce52966f7a3', DATE '2026-04-27', DATE '2026-04-09', 25669.02, 25633.03, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', '6aac5e59-3daf-5d99-b0c1-5ce52966f7a3', 35.99, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 59 | apLIS lote 5101 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a60a10ea-0d51-57ef-b5b1-e2e4e7e98710', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5101', DATE '2026-02-27', DATE '2026-02-27', 'Recebido - parcial', 7, '340225582292_0', NULL, NULL, NULL, '5101', 8763.54, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-02-26', DATE '2026-04-27', 8763.54, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 59). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab', 'a60a10ea-0d51-57ef-b5b1-e2e4e7e98710');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab', 'a60a10ea-0d51-57ef-b5b1-e2e4e7e98710', DATE '2026-04-27', DATE '2026-04-09', 8763.54, 8363.12, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab', 'a60a10ea-0d51-57ef-b5b1-e2e4e7e98710', 400.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 60 | apLIS lote 4955 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b222c1eb-779c-50c7-9afb-4af5814d9318', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '4955', DATE '2026-02-03', DATE '2026-02-03', 'Recebido', 4, 'PEG271287', NULL, NULL, NULL, '4955', 552.55, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('55d7a7d4-bbd9-53a3-b58c-c5e8f0fa677f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-02-03', DATE '2026-04-04', 552.55, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 60). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('55d7a7d4-bbd9-53a3-b58c-c5e8f0fa677f', 'b222c1eb-779c-50c7-9afb-4af5814d9318');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('55d7a7d4-bbd9-53a3-b58c-c5e8f0fa677f', 'b222c1eb-779c-50c7-9afb-4af5814d9318', DATE '2026-04-04', DATE '2026-03-06', 552.55, 552.55, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 61 | apLIS lote 4942 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('808dce77-ffdd-5a67-ad2d-ca0e1c29ff2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '4942', DATE '2026-02-02', DATE '2026-02-03', 'Recebido', 4, 'PEG271309', NULL, NULL, NULL, '4942', 15620.92, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('da62ccd3-3e59-5aff-a71e-05e03e0dc230', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-02-03', DATE '2026-04-04', 15620.92, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 61). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('da62ccd3-3e59-5aff-a71e-05e03e0dc230', '808dce77-ffdd-5a67-ad2d-ca0e1c29ff2c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('da62ccd3-3e59-5aff-a71e-05e03e0dc230', '808dce77-ffdd-5a67-ad2d-ca0e1c29ff2c', DATE '2026-04-04', DATE '2026-03-06', 15620.92, 15620.92, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 62 | apLIS lote 4970 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bb235355-2233-518f-bee1-46c979bfaed5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4970', DATE '2026-02-04', DATE '2026-02-05', 'Recebido - parcial', 7, 'PEG225016783', NULL, NULL, NULL, '4970', 12683.23, 47);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-04', DATE '2026-03-06', 12683.23, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 62). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', 'bb235355-2233-518f-bee1-46c979bfaed5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', 'bb235355-2233-518f-bee1-46c979bfaed5', DATE '2026-03-06', DATE '2026-03-04', 12683.23, 12227.47, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', 'bb235355-2233-518f-bee1-46c979bfaed5', 455.76, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 63 | apLIS lote 4973 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ebed129f-a3ff-572e-94b1-b8bea48afeb2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4973', DATE '2026-02-04', DATE '2026-02-05', 'Recebido', 4, 'PEG225018159', NULL, NULL, NULL, '4973', 8755.20, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('491cdc82-23fc-5346-9e41-ec5ded629dac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-04', DATE '2026-03-06', 8755.20, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 63). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('491cdc82-23fc-5346-9e41-ec5ded629dac', 'ebed129f-a3ff-572e-94b1-b8bea48afeb2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('491cdc82-23fc-5346-9e41-ec5ded629dac', 'ebed129f-a3ff-572e-94b1-b8bea48afeb2', DATE '2026-03-06', DATE '2026-03-04', 8755.20, 8755.20, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 64 | apLIS lote 4971 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d836cabd-988d-5280-9977-8017fd1f52c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4971', DATE '2026-02-04', DATE '2026-02-05', 'Recebido - parcial', 7, 'PEG225020219', NULL, NULL, NULL, '4971', 16269.07, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ad82dbf8-5545-5f29-a778-670810b9d4a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-04', DATE '2026-03-06', 16269.07, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 64). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ad82dbf8-5545-5f29-a778-670810b9d4a2', 'd836cabd-988d-5280-9977-8017fd1f52c9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ad82dbf8-5545-5f29-a778-670810b9d4a2', 'd836cabd-988d-5280-9977-8017fd1f52c9', DATE '2026-03-06', DATE '2026-03-04', 16269.07, 16269.06, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 65 | apLIS lote 4972 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4baebd4f-82f6-5487-bc44-1d557f466ee3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4972', DATE '2026-02-04', DATE '2026-02-05', 'Recebido - parcial', 7, 'PEG225021253', NULL, NULL, NULL, '4972', 16006.35, 64);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-04', DATE '2026-03-06', 16006.35, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 65). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', '4baebd4f-82f6-5487-bc44-1d557f466ee3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', '4baebd4f-82f6-5487-bc44-1d557f466ee3', DATE '2026-03-06', DATE '2026-03-04', 16006.35, 15778.47, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', '4baebd4f-82f6-5487-bc44-1d557f466ee3', 227.88, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 66 | apLIS lote 5007 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('713211ed-5406-57e2-b54a-cfdccac17e4a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5007', DATE '2026-02-11', DATE '2026-02-11', 'Recebido - parcial', 7, 'PEG225190887', NULL, NULL, NULL, '5007', 24958.27, 95);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-11', DATE '2026-03-13', 24958.27, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 66). Responsável: Raquel. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', '713211ed-5406-57e2-b54a-cfdccac17e4a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', '713211ed-5406-57e2-b54a-cfdccac17e4a', DATE '2026-03-13', DATE '2026-03-20', 24958.27, 24730.37, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', '713211ed-5406-57e2-b54a-cfdccac17e4a', 227.90, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 67 | apLIS lote 5008 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('826af4d4-6ccc-5143-b8aa-1ef52bbc45de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5008', DATE '2026-02-12', DATE '2026-02-12', 'Recebido', 4, 'PEG225223658', NULL, NULL, NULL, '5008', 1113.82, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5bf043a4-d928-5553-ab66-c6a0cfdf02a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-12', DATE '2026-03-14', 1113.82, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 67). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5bf043a4-d928-5553-ab66-c6a0cfdf02a2', '826af4d4-6ccc-5143-b8aa-1ef52bbc45de');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5bf043a4-d928-5553-ab66-c6a0cfdf02a2', '826af4d4-6ccc-5143-b8aa-1ef52bbc45de', DATE '2026-03-14', DATE '2026-03-20', 1113.82, 1113.82, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 68 | apLIS lote 5009 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ca6da51b-ade3-5426-b241-153314dde753', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5009', DATE '2026-02-12', DATE '2026-02-12', 'Recebido - parcial', 7, 'PEG225229049', NULL, NULL, NULL, '5009', 8127.08, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a104cb63-81be-5295-b2ec-50cf9ec4c021', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-12', DATE '2026-03-14', 8127.08, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 68). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a104cb63-81be-5295-b2ec-50cf9ec4c021', 'ca6da51b-ade3-5426-b241-153314dde753');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a104cb63-81be-5295-b2ec-50cf9ec4c021', 'ca6da51b-ade3-5426-b241-153314dde753', DATE '2026-03-14', DATE '2026-03-20', 8127.08, 8127.08, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 69 | apLIS lote 4974 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('abe74228-5d35-5b13-8bec-40ea5d7d6adf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4974', DATE '2026-02-05', DATE '2026-02-12', 'Recebido - parcial', 7, 'PEG225231292', NULL, NULL, NULL, '4974', 9114.20, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-12', DATE '2026-03-14', 9114.20, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 69). Responsável: Raquel. Status original na planilha: Vencido. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', 'abe74228-5d35-5b13-8bec-40ea5d7d6adf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', 'abe74228-5d35-5b13-8bec-40ea5d7d6adf', DATE '2026-03-14', DATE '2026-03-20', 9114.20, 8886.33, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', 'abe74228-5d35-5b13-8bec-40ea5d7d6adf', 227.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 70 | apLIS lote 5010 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3114ea1-f608-5123-9cad-39d5c61b598d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5010', DATE '2026-02-12', DATE '2026-02-12', 'Recebido', 4, 'PEG225236590', NULL, NULL, NULL, '5010', 10707.99, 36);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('00121a27-bc8e-5f22-a5e6-21c0da70c04c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-12', DATE '2026-03-14', 10707.99, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 70). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('00121a27-bc8e-5f22-a5e6-21c0da70c04c', 'c3114ea1-f608-5123-9cad-39d5c61b598d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('00121a27-bc8e-5f22-a5e6-21c0da70c04c', 'c3114ea1-f608-5123-9cad-39d5c61b598d', DATE '2026-03-14', DATE '2026-03-20', 10707.99, 10707.99, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 71 | apLIS lote 5013 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fbb22928-cb6d-5f63-856c-c149e5295ac6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5013', DATE '2026-02-12', DATE '2026-02-12', 'Recebido - parcial', 7, 'PEG225239686', NULL, NULL, NULL, '5013', 3436.83, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-12', DATE '2026-03-14', 3436.83, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 71). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', 'fbb22928-cb6d-5f63-856c-c149e5295ac6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', 'fbb22928-cb6d-5f63-856c-c149e5295ac6', DATE '2026-03-14', DATE '2026-03-20', 3436.83, 3208.96, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', 'fbb22928-cb6d-5f63-856c-c149e5295ac6', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- FEVEREIRO linha 72 | apLIS lote 5050 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('218cca74-06e1-5835-a098-e4f181b2e714', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5050', DATE '2026-02-20', DATE '2026-02-20', 'Recebido', 4, 'PEG225427613', NULL, NULL, NULL, '5050', 8530.11, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb6888f0-2868-5491-b8d5-684dac870e8a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-20', DATE '2026-03-22', 8530.11, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 72). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb6888f0-2868-5491-b8d5-684dac870e8a', '218cca74-06e1-5835-a098-e4f181b2e714');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eb6888f0-2868-5491-b8d5-684dac870e8a', '218cca74-06e1-5835-a098-e4f181b2e714', DATE '2026-03-22', DATE '2026-03-20', 8530.11, 8530.11, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 73 | apLIS lote 5049 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9742e5b9-cee7-525c-8af1-f87a704c6359', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5049', DATE '2026-02-20', DATE '2026-02-20', 'Recebido', 4, 'PEG225432297', NULL, NULL, NULL, '5049', 14952.17, 54);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('27ef79b5-adc6-5fd2-88a5-24ef11e358e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-20', DATE '2026-03-22', 14952.17, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 73). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('27ef79b5-adc6-5fd2-88a5-24ef11e358e3', '9742e5b9-cee7-525c-8af1-f87a704c6359');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('27ef79b5-adc6-5fd2-88a5-24ef11e358e3', '9742e5b9-cee7-525c-8af1-f87a704c6359', DATE '2026-03-22', DATE '2026-03-20', 14952.17, 14952.17, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 74 | apLIS lote 5051 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2692d28b-0e24-5d93-adf3-788d1fe3e099', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5051', DATE '2026-02-20', DATE '2026-02-20', 'Recebido', 4, 'PEG225433223', NULL, NULL, NULL, '5051', 1163.58, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('306a566a-779d-507d-8853-41f10a233ffd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-02-20', DATE '2026-03-22', 1163.58, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 74). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('306a566a-779d-507d-8853-41f10a233ffd', '2692d28b-0e24-5d93-adf3-788d1fe3e099');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('306a566a-779d-507d-8853-41f10a233ffd', '2692d28b-0e24-5d93-adf3-788d1fe3e099', DATE '2026-03-22', DATE '2026-03-20', 1163.58, 1163.58, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 75 | apLIS lote 5082 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4f2caafe-02c7-523c-b1b0-facb68ae42cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5082', DATE '2026-02-26', DATE '2026-02-26', 'Recebido', 4, '796057', NULL, NULL, NULL, '5082', 24061.24, 64);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e2277d78-6b55-550b-ae3e-fee3f16752b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-02-26', DATE '2026-04-27', 24061.24, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 75). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e2277d78-6b55-550b-ae3e-fee3f16752b1', '4f2caafe-02c7-523c-b1b0-facb68ae42cd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e2277d78-6b55-550b-ae3e-fee3f16752b1', '4f2caafe-02c7-523c-b1b0-facb68ae42cd', DATE '2026-04-27', DATE '2026-04-28', 24061.24, 24061.24, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 76 | apLIS lote 5084 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8e40dbd3-6f0d-5131-b13d-cc8e772f3831', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5084', DATE '2026-02-26', DATE '2026-02-27', 'Recebido', 4, '796130', NULL, NULL, NULL, '5084', 3998.71, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8169b582-e81d-5d71-b93d-5fdf93cd11a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-02-27', DATE '2026-04-28', 3998.71, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 76). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8169b582-e81d-5d71-b93d-5fdf93cd11a1', '8e40dbd3-6f0d-5131-b13d-cc8e772f3831');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8169b582-e81d-5d71-b93d-5fdf93cd11a1', '8e40dbd3-6f0d-5131-b13d-cc8e772f3831', DATE '2026-04-28', DATE '2026-04-28', 3998.71, 3998.71, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 77 | apLIS lote 5093 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6118d935-9967-5e99-ad3f-fc1c11a33239', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '5093', DATE '2026-02-26', DATE '2026-02-27', 'Recebido - parcial', 7, '79162', NULL, NULL, NULL, '5093', 2337.77, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-02-27', DATE '2026-04-28', 2337.77, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 77). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', '6118d935-9967-5e99-ad3f-fc1c11a33239');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', '6118d935-9967-5e99-ad3f-fc1c11a33239', DATE '2026-04-28', DATE '2026-04-28', 2337.77, 1725.48, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', '6118d935-9967-5e99-ad3f-fc1c11a33239', 612.29, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 78 | apLIS lote 4964 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('816123ae-201c-5a53-9aae-b0c01656d454', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '4964', DATE '2026-02-03', DATE '2026-02-03', 'Recebido', 4, 'PEG644401', NULL, NULL, NULL, '4964', 48.37, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95c48fe9-9ab6-538b-bc2a-e3008ff0d935', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), NULL, DATE '2026-02-03', DATE '2026-03-10', 48.37, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 78). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95c48fe9-9ab6-538b-bc2a-e3008ff0d935', '816123ae-201c-5a53-9aae-b0c01656d454');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('95c48fe9-9ab6-538b-bc2a-e3008ff0d935', '816123ae-201c-5a53-9aae-b0c01656d454', DATE '2026-03-10', DATE '2026-04-22', 48.37, 48.37, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 79 | apLIS lote 4963 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('54e071a4-167c-529a-962f-f69f115b9400', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '4963', DATE '2026-02-03', DATE '2026-02-03', 'Recebido', 4, 'PEG644422', NULL, NULL, NULL, '4963', 2425.47, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), NULL, DATE '2026-02-03', DATE '2026-03-10', 2425.47, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 79). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', '54e071a4-167c-529a-962f-f69f115b9400');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', '54e071a4-167c-529a-962f-f69f115b9400', DATE '2026-03-10', DATE '2026-03-06', 2425.47, 1858.66, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', '54e071a4-167c-529a-962f-f69f115b9400', 401.89, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 80 | apLIS lote 4932 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('03bd3ec6-a1e8-5e52-b896-cc48295d5252', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '4932', DATE '2026-02-02', DATE '2026-02-02', 'Recebido - parcial', 7, '181231', NULL, NULL, NULL, '4932', 10527.83, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-02-02', DATE '2026-03-02', 10527.83, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 80). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', '03bd3ec6-a1e8-5e52-b896-cc48295d5252');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', '03bd3ec6-a1e8-5e52-b896-cc48295d5252', DATE '2026-03-02', DATE '2026-05-22', 10527.83, 8385.83, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', '03bd3ec6-a1e8-5e52-b896-cc48295d5252', 2142.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 81 | apLIS lote 4969 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('109eda05-b161-597b-a010-5fe79266ba28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '4969', DATE '2026-02-04', DATE '2026-02-04', 'Recebido - parcial', 7, '181518', NULL, NULL, NULL, '4969', 3775.31, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-02-04', DATE '2026-03-04', 3775.31, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 81). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', '109eda05-b161-597b-a010-5fe79266ba28');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', '109eda05-b161-597b-a010-5fe79266ba28', DATE '2026-03-04', DATE '2026-05-22', 3775.31, 3504.88, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', '109eda05-b161-597b-a010-5fe79266ba28', 270.43, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 82 | apLIS lote 4961 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6df53221-7928-5c0f-b3fd-cd6dca66a334', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '4961', DATE '2026-02-03', DATE '2026-02-20', 'Recebido', 4, 'PEG20260203145802', NULL, NULL, NULL, '4961', 781.82, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('514cd3b6-614f-5736-93fe-c808138e42ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-02-03', DATE '2026-04-04', 781.82, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 82). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('514cd3b6-614f-5736-93fe-c808138e42ee', '6df53221-7928-5c0f-b3fd-cd6dca66a334');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('514cd3b6-614f-5736-93fe-c808138e42ee', '6df53221-7928-5c0f-b3fd-cd6dca66a334', DATE '2026-04-04', DATE '2026-06-01', 781.82, 781.82, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 83 | apLIS lote 4962 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b0507af9-7352-5798-a1c1-2c4270e67d24', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '4962', DATE '2026-02-03', DATE '2026-02-13', 'Recebido', 4, 'PEG20260213141453', NULL, NULL, NULL, '4962', 987.57, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('971d817e-0e0c-55d5-b5ac-e4a74c7b5d03', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-02-13', DATE '2026-04-14', 987.57, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 83). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('971d817e-0e0c-55d5-b5ac-e4a74c7b5d03', 'b0507af9-7352-5798-a1c1-2c4270e67d24');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('971d817e-0e0c-55d5-b5ac-e4a74c7b5d03', 'b0507af9-7352-5798-a1c1-2c4270e67d24', DATE '2026-04-14', DATE '2026-03-11', 987.57, 987.57, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 84 | apLIS lote 4965 | GAMA SAÚDE ("GAMA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('41171a09-abf5-5fb2-8c2a-a9c60ee01d78', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), '4965', DATE '2026-02-03', DATE '2026-02-04', 'Faturado', 3, 'PEG14147299', NULL, NULL, NULL, '4965', 275.12, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d31569f8-0485-5235-8c6f-bab31d92365c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1343'), NULL, DATE '2026-02-04', DATE '2026-04-05', 275.12, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 84). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d31569f8-0485-5235-8c6f-bab31d92365c', '41171a09-abf5-5fb2-8c2a-a9c60ee01d78');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d31569f8-0485-5235-8c6f-bab31d92365c', '41171a09-abf5-5fb2-8c2a-a9c60ee01d78', DATE '2026-04-05', 275.12, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 85 | apLIS lote 4992 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('44de6212-c1c1-57ef-9be7-65d35dbd7b11', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4992', DATE '2026-02-09', DATE '2026-02-09', 'Recebido', 4, '128580934', '8033', 8013, DATE '2026-07-31', '4992', 12353.42, 43);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f1533740-799d-56e9-ad05-2601d739a2ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8033', DATE '2026-02-10', DATE '2026-05-11', 12353.42, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 85). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f1533740-799d-56e9-ad05-2601d739a2ee', '44de6212-c1c1-57ef-9be7-65d35dbd7b11');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f1533740-799d-56e9-ad05-2601d739a2ee', '44de6212-c1c1-57ef-9be7-65d35dbd7b11', DATE '2026-05-11', DATE '2026-05-26', 12353.42, 12353.42, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 86 | apLIS lote 4993 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ae2d2bcb-0458-5df8-bedb-06b12393ecb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4993', DATE '2026-02-09', DATE '2026-02-09', 'Recebido - parcial', 7, '129407010', '8033', 8013, DATE '2026-07-31', '4993', 4693.05, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '8033', DATE '2026-02-10', DATE '2026-05-11', 4693.05, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 86). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', 'ae2d2bcb-0458-5df8-bedb-06b12393ecb1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', 'ae2d2bcb-0458-5df8-bedb-06b12393ecb1', DATE '2026-05-11', DATE '2026-05-26', 4693.05, 3523.63, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', 'ae2d2bcb-0458-5df8-bedb-06b12393ecb1', 1169.42, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 87 | apLIS lote 4999 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0fece9b3-debc-5a28-8dc8-471e6b500ab4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4999', DATE '2026-02-09', DATE '2026-02-09', 'Recebido', 4, '128727846', NULL, NULL, NULL, '4999', 52.32, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f3ffbef6-13ae-5315-a110-ce57198948db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-02-10', DATE '2026-05-11', 52.32, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 87). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f3ffbef6-13ae-5315-a110-ce57198948db', '0fece9b3-debc-5a28-8dc8-471e6b500ab4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f3ffbef6-13ae-5315-a110-ce57198948db', '0fece9b3-debc-5a28-8dc8-471e6b500ab4', DATE '2026-05-11', DATE '2026-05-26', 52.32, 52.32, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 88 | apLIS lote 5004 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33903948-f955-5ecf-a9a1-0da0239f5fd3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5004', DATE '2026-02-10', DATE '2026-02-27', 'Recebido', 4, 'PEG154037', '8026', 8006, DATE '2026-07-31', '5004', 13354.83, 57);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e35223b0-5780-55bf-863d-d841f8ddd4ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8026', DATE '2026-02-27', DATE '2026-03-29', 13354.83, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 88). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e35223b0-5780-55bf-863d-d841f8ddd4ab', '33903948-f955-5ecf-a9a1-0da0239f5fd3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e35223b0-5780-55bf-863d-d841f8ddd4ab', '33903948-f955-5ecf-a9a1-0da0239f5fd3', DATE '2026-03-29', DATE '2026-06-25', 13354.83, 13354.83, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 89 | apLIS lote 4867 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e02f05f6-01c5-58cd-a090-c53c633936c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4867', DATE '2026-01-20', DATE '2026-02-27', 'Faturado', 3, 'PEG154291', '8026', 8006, DATE '2026-07-31', '4867', 3415.37, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8026', DATE '2026-02-27', DATE '2026-03-29', 3415.37, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 89). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8', 'e02f05f6-01c5-58cd-a090-c53c633936c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8', 'e02f05f6-01c5-58cd-a090-c53c633936c5', DATE '2026-03-29', DATE '2026-06-25', 3415.37, 3415.37, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 90 | apLIS lote 4924 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d5395802-823b-556f-a87c-c54bd5349f37', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4924', DATE '2026-01-30', DATE '2026-02-27', 'Em Processamento', 1, 'pendencia', '8026', 8006, DATE '2026-07-31', '4924', 6176.50, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c0f4a810-e515-500f-9fff-9b456cc65551', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8026', DATE '2026-02-27', DATE '2026-03-29', 6176.50, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 90). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c0f4a810-e515-500f-9fff-9b456cc65551', 'd5395802-823b-556f-a87c-c54bd5349f37');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c0f4a810-e515-500f-9fff-9b456cc65551', 'd5395802-823b-556f-a87c-c54bd5349f37', DATE '2026-03-29', DATE '2026-06-25', 6176.50, 6091.14, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c0f4a810-e515-500f-9fff-9b456cc65551', 'd5395802-823b-556f-a87c-c54bd5349f37', 85.36, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 91 | apLIS lote 5097 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8a83e17a-48d2-51cd-b57f-c4f03872c0b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5097', DATE '2026-02-26', DATE '2026-02-27', 'Recebido', 4, 'PEG154425', NULL, NULL, NULL, '5097', 51.66, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a3b94cec-4f52-5c39-bc01-4d4925ac9410', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-02-27', DATE '2026-03-29', 51.66, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 91). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a3b94cec-4f52-5c39-bc01-4d4925ac9410', '8a83e17a-48d2-51cd-b57f-c4f03872c0b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a3b94cec-4f52-5c39-bc01-4d4925ac9410', '8a83e17a-48d2-51cd-b57f-c4f03872c0b1', DATE '2026-03-29', DATE '2026-06-25', 51.66, 51.66, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 92 | apLIS lote 5114 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('721b37f1-e6bf-5458-a3ed-93340024f4e5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5114', DATE '2026-02-27', DATE '2026-02-27', 'Recebido', 4, 'PEG154488', '8026', 8006, DATE '2026-07-31', '5114', 3075.70, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('339eb322-fa98-51d4-8ffe-e3105b06112a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8026', DATE '2026-02-27', DATE '2026-03-29', 3075.70, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 92). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('339eb322-fa98-51d4-8ffe-e3105b06112a', '721b37f1-e6bf-5458-a3ed-93340024f4e5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('339eb322-fa98-51d4-8ffe-e3105b06112a', '721b37f1-e6bf-5458-a3ed-93340024f4e5', DATE '2026-03-29', DATE '2026-06-25', 3075.70, 3075.70, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 93 | apLIS lote 5094 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65fe2ddf-f62e-53be-b503-26bbcc7be533', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '5094', DATE '2026-02-26', DATE '2026-02-27', 'Recebido', 4, 'PEG154729', '8026', 8006, DATE '2026-07-31', '5094', 24600.65, 92);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('98dafcf9-6e6b-5745-bd16-3b868b47459a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '8026', DATE '2026-02-27', DATE '2026-03-29', 24600.65, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 93). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('98dafcf9-6e6b-5745-bd16-3b868b47459a', '65fe2ddf-f62e-53be-b503-26bbcc7be533');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('98dafcf9-6e6b-5745-bd16-3b868b47459a', '65fe2ddf-f62e-53be-b503-26bbcc7be533', DATE '2026-03-29', DATE '2026-06-25', 24600.65, 23856.18, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('98dafcf9-6e6b-5745-bd16-3b868b47459a', '65fe2ddf-f62e-53be-b503-26bbcc7be533', 744.47, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 94 | apLIS lote 4940 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
-- Data Recebimento na planilha: 'COBRAR NOVAMENTE' → última baixa no apLIS (2026-01-27)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4e68cd1c-0877-5921-8113-5ee944719416', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '4940', DATE '2026-02-02', DATE '2026-02-02', 'Recebido', 4, '33808', NULL, NULL, NULL, '4940', 5030.70, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('89fe0f9b-0564-5b1c-8e6a-e50580eb21eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), NULL, DATE '2026-02-02', DATE '2026-03-31', 5030.70, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 94). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('89fe0f9b-0564-5b1c-8e6a-e50580eb21eb', '4e68cd1c-0877-5921-8113-5ee944719416');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('89fe0f9b-0564-5b1c-8e6a-e50580eb21eb', '4e68cd1c-0877-5921-8113-5ee944719416', DATE '2026-03-31', DATE '2026-01-27', 5030.70, 5030.70, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026 — data de recebimento estimada');

-- FEVEREIRO linha 95 | apLIS lote 4987 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3045a82e-3afb-5a5c-a44c-a2e98d1a7be3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4987', DATE '2026-02-05', DATE '2026-02-06', 'Recebido', 4, 'PEG429172', NULL, NULL, NULL, '4987', 14502.45, 49);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b870fb1d-ce53-51c6-9719-0c3c8979680a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-02-06', DATE '2026-03-08', 14502.45, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 95). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b870fb1d-ce53-51c6-9719-0c3c8979680a', '3045a82e-3afb-5a5c-a44c-a2e98d1a7be3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b870fb1d-ce53-51c6-9719-0c3c8979680a', '3045a82e-3afb-5a5c-a44c-a2e98d1a7be3', DATE '2026-03-08', DATE '2026-03-23', 14502.45, 14502.45, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 96 | apLIS lote 4986 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9324c970-a654-55ff-9dc9-d123e9c3efa2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4986', DATE '2026-02-05', DATE '2026-02-06', 'Recebido - parcial', 7, 'PEG429197', '7983', 7963, DATE '2026-05-05', '4986', 30683.56, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-06', DATE '2026-03-08', 30683.56, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 96). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', '9324c970-a654-55ff-9dc9-d123e9c3efa2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', '9324c970-a654-55ff-9dc9-d123e9c3efa2', DATE '2026-03-08', DATE '2026-05-25', 30683.56, 30069.59, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', '9324c970-a654-55ff-9dc9-d123e9c3efa2', 613.97, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 97 | apLIS lote 5653 | PMDF
-- lote digitado 4900 → lote real 5653 (pelo protocolo)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('194b7362-402d-5022-a36d-31c69e57f7fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5653', DATE '2026-05-05', DATE '2026-02-06', 'Faturado', 3, '429266', '7983', 7963, DATE '2026-05-05', '5653', 607.73, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-06', DATE '2026-03-08', 607.73, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 97). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', '194b7362-402d-5022-a36d-31c69e57f7fc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', '194b7362-402d-5022-a36d-31c69e57f7fc', DATE '2026-03-08', DATE '2026-05-25', 607.73, 595.57, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', '194b7362-402d-5022-a36d-31c69e57f7fc', 12.16, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 98 | apLIS lote 5053 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('84a67b6a-e372-57b6-bee0-3c4f44c0e96c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5053', DATE '2026-02-23', DATE '2026-02-23', 'Recebido', 4, 'PEG434478', '7983', 7963, DATE '2026-05-05', '5053', 77.20, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aae84f93-5614-5570-942d-a22a7d928e3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-23', DATE '2026-03-25', 77.20, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 98). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aae84f93-5614-5570-942d-a22a7d928e3a', '84a67b6a-e372-57b6-bee0-3c4f44c0e96c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aae84f93-5614-5570-942d-a22a7d928e3a', '84a67b6a-e372-57b6-bee0-3c4f44c0e96c', DATE '2026-03-25', DATE '2026-05-25', 77.20, 77.20, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 99 | apLIS lote 5054 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('785255de-5c86-5f67-b524-c05231fad8a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5054', DATE '2026-02-23', DATE '2026-02-23', 'Recebido', 4, 'PEG434670', '7983', 7963, DATE '2026-05-05', '5054', 20941.43, 67);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6bdf0ed3-4190-58d7-b81e-f7d58d4e6a5b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-23', DATE '2026-03-25', 20941.43, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 99). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6bdf0ed3-4190-58d7-b81e-f7d58d4e6a5b', '785255de-5c86-5f67-b524-c05231fad8a8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6bdf0ed3-4190-58d7-b81e-f7d58d4e6a5b', '785255de-5c86-5f67-b524-c05231fad8a8', DATE '2026-03-25', DATE '2026-05-25', 20941.43, 20941.43, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 100 | apLIS lote 5055 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aec43b15-e5ac-5baf-bdee-cf0f40f74c17', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5055', DATE '2026-02-23', DATE '2026-02-23', 'Recebido', 4, 'PEG434672', '7983', 7963, DATE '2026-05-05', '5055', 22274.69, 68);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fcb2e681-a357-5258-9437-a087d3fc0cac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-23', DATE '2026-03-25', 22274.69, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 100). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fcb2e681-a357-5258-9437-a087d3fc0cac', 'aec43b15-e5ac-5baf-bdee-cf0f40f74c17');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fcb2e681-a357-5258-9437-a087d3fc0cac', 'aec43b15-e5ac-5baf-bdee-cf0f40f74c17', DATE '2026-03-25', DATE '2026-05-25', 22274.69, 22274.69, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 101 | apLIS lote 5063 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2291916-0b98-5a6a-a5fa-1b2e6ac595b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5063', DATE '2026-02-23', DATE '2026-02-23', 'Faturado', 3, 'PEG434739', '7983', 7963, DATE '2026-05-05', '5063', 442.89, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-23', DATE '2026-03-25', 442.89, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 101). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', 'c2291916-0b98-5a6a-a5fa-1b2e6ac595b4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', 'c2291916-0b98-5a6a-a5fa-1b2e6ac595b4', DATE '2026-03-25', DATE '2026-05-25', 442.89, 392.62, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', 'c2291916-0b98-5a6a-a5fa-1b2e6ac595b4', 50.27, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 102 | apLIS lote 4988 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c3e2376-456c-5809-8a29-b27fd83a4632', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4988', DATE '2026-02-05', DATE '2026-02-23', 'Recebido - parcial', 7, 'PEG434902', '7983', 7963, DATE '2026-05-05', '4988', 29099.63, 41);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-24', DATE '2026-03-26', 29099.63, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 102). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', '6c3e2376-456c-5809-8a29-b27fd83a4632');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', '6c3e2376-456c-5809-8a29-b27fd83a4632', DATE '2026-03-26', DATE '2026-05-25', 29099.63, 27647.91, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', '6c3e2376-456c-5809-8a29-b27fd83a4632', 1451.72, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 103 | apLIS lote 5064 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4d373f8b-2c91-5f7a-88ce-551cd499eff5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5064', DATE '2026-02-24', DATE '2026-02-24', 'Recebido - parcial', 7, 'PEG435061', NULL, NULL, NULL, '5064', 3233.41, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-02-24', DATE '2026-03-26', 3233.41, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 103). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', '4d373f8b-2c91-5f7a-88ce-551cd499eff5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', '4d373f8b-2c91-5f7a-88ce-551cd499eff5', DATE '2026-03-26', DATE '2026-07-03', 3233.41, 3004.54, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', '4d373f8b-2c91-5f7a-88ce-551cd499eff5', 228.87, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 106 | apLIS lote 5066 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('93ba0015-bd4b-5beb-b8cd-0003370fed25', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5066', DATE '2026-02-25', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG435179', '7983', 7963, DATE '2026-05-05', '5066', 122.56, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-25', DATE '2026-03-27', 122.56, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 106). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', '93ba0015-bd4b-5beb-b8cd-0003370fed25');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', '93ba0015-bd4b-5beb-b8cd-0003370fed25', DATE '2026-03-27', DATE '2026-05-25', 122.56, 113.08, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', '93ba0015-bd4b-5beb-b8cd-0003370fed25', 9.48, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 107 | apLIS lote 5057 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a60490f-b373-5053-8af0-c49a4b93ba2b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5057', DATE '2026-02-23', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG435210', '7983', 7963, DATE '2026-05-05', '5057', 26150.95, 25);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-25', DATE '2026-03-27', 26150.95, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 107). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', '0a60490f-b373-5053-8af0-c49a4b93ba2b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', '0a60490f-b373-5053-8af0-c49a4b93ba2b', DATE '2026-03-27', DATE '2026-05-25', 26150.95, 25150.81, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', '0a60490f-b373-5053-8af0-c49a4b93ba2b', 1000.14, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', '0a60490f-b373-5053-8af0-c49a4b93ba2b', 4.00, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Raquel');

-- FEVEREIRO linha 108 | apLIS lote 5065 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2db0f71b-c4e7-59b4-b261-c908803f9b56', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5065', DATE '2026-02-24', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG435212', '7983', 7963, DATE '2026-05-05', '5065', 16721.82, 38);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-25', DATE '2026-03-27', 16721.82, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 108). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', '2db0f71b-c4e7-59b4-b261-c908803f9b56');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', '2db0f71b-c4e7-59b4-b261-c908803f9b56', DATE '2026-03-27', DATE '2026-05-25', 16721.82, 16265.10, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', '2db0f71b-c4e7-59b4-b261-c908803f9b56', 456.72, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 109 | apLIS lote 5056 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2dc520c-5c48-55f9-9eed-16f5c62100d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5056', DATE '2026-02-23', DATE '2026-02-25', 'Recebido - parcial', 7, 'PEG435286', '7983', 7963, DATE '2026-05-05', '5056', 23750.55, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '7983', DATE '2026-02-25', DATE '2026-03-27', 23750.55, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 109). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', 'c2dc520c-5c48-55f9-9eed-16f5c62100d3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', 'c2dc520c-5c48-55f9-9eed-16f5c62100d3', DATE '2026-03-27', DATE '2026-05-25', 23750.55, 22547.10, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', 'c2dc520c-5c48-55f9-9eed-16f5c62100d3', 1203.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 110 | apLIS lote 4933 | POSTAL SAÚDE ("POSTAL" na planilha)
-- Data Faturamento 2025-02-02 → 2026-02-02 (fechamento no apLIS 2026-02-02)
-- Data Provável Pagamento 2025-04-03 → 2026-04-03
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c854727a-aa67-53e4-926f-65022370b817', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '4933', DATE '2026-02-02', DATE '2026-02-02', 'Recebido', 4, 'PEG4218397', NULL, NULL, NULL, '4933', 2836.95, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('53d2d489-dcd7-5206-954a-0782d2073b23', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), NULL, DATE '2026-02-02', DATE '2026-04-03', 2836.95, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 110). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('53d2d489-dcd7-5206-954a-0782d2073b23', 'c854727a-aa67-53e4-926f-65022370b817');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('53d2d489-dcd7-5206-954a-0782d2073b23', 'c854727a-aa67-53e4-926f-65022370b817', DATE '2026-04-03', DATE '2026-04-07', 2836.95, 2836.95, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 111 | apLIS lote 4934 | POSTAL SAÚDE ("POSTAL" na planilha)
-- Data Faturamento 2025-02-02 → 2026-02-02 (fechamento no apLIS 2026-02-02)
-- Data Provável Pagamento 2025-04-03 → 2026-04-03
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c739573-9fbd-5551-a050-7408f582d70c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '4934', DATE '2026-02-02', DATE '2026-04-29', 'Recebido', 4, 'PEG4220197', NULL, NULL, NULL, '4934', 1120.40, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), NULL, DATE '2026-02-02', DATE '2026-04-03', 1120.40, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 111). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', '4c739573-9fbd-5551-a050-7408f582d70c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', '4c739573-9fbd-5551-a050-7408f582d70c', DATE '2026-04-03', DATE '2026-04-08', 1120.40, 610.01, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', '4c739573-9fbd-5551-a050-7408f582d70c', 510.39, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 112 | apLIS lote 4943 | POSTAL SAÚDE ("POSTAL" na planilha)
-- Data Faturamento 2025-02-03 → 2026-02-03 (fechamento no apLIS 2026-02-03)
-- Data Provável Pagamento 2025-04-04 → 2026-04-04
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e41359f-583c-5ea8-93fa-f70bcfc2edf1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '4943', DATE '2026-02-03', DATE '2026-02-03', 'Recebido', 4, 'PEG4223201', NULL, NULL, NULL, '4943', 1199.44, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ab0f0efa-8363-5f42-8d8c-c047600d968d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), NULL, DATE '2026-02-03', DATE '2026-04-04', 1199.44, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 112). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ab0f0efa-8363-5f42-8d8c-c047600d968d', '6e41359f-583c-5ea8-93fa-f70bcfc2edf1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ab0f0efa-8363-5f42-8d8c-c047600d968d', '6e41359f-583c-5ea8-93fa-f70bcfc2edf1', DATE '2026-04-04', DATE '2026-04-09', 1199.44, 1199.44, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 114 | apLIS lote 5000 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0d4a9078-120c-58d4-a86f-3eb0f61742c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5000', DATE '2026-02-10', DATE '2026-02-12', 'Faturado', 3, '205637', NULL, NULL, NULL, '5000', 13339.08, 65);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5ca46bd6-0c13-58f1-b9ac-6996e4452d38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-02-12', DATE '2026-04-13', 13339.08, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 114). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5ca46bd6-0c13-58f1-b9ac-6996e4452d38', '0d4a9078-120c-58d4-a86f-3eb0f61742c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5ca46bd6-0c13-58f1-b9ac-6996e4452d38', '0d4a9078-120c-58d4-a86f-3eb0f61742c5', DATE '2026-04-13', DATE '2026-04-10', 13339.08, 13339.08, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 115 | apLIS lote 5001 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2e6c1b79-1329-507f-a7e3-9db61f5ee17c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5001', DATE '2026-02-10', DATE '2026-02-11', 'Recebido - parcial', 7, '205551', NULL, NULL, NULL, '5001', 2362.39, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-02-12', DATE '2026-04-13', 2362.39, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 115). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', '2e6c1b79-1329-507f-a7e3-9db61f5ee17c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', '2e6c1b79-1329-507f-a7e3-9db61f5ee17c', DATE '2026-04-13', DATE '2026-04-11', 2362.39, 2356.70, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', '2e6c1b79-1329-507f-a7e3-9db61f5ee17c', 5.69, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 116 | apLIS lote 5011 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a68ace7d-52f9-5022-9f15-5fb326fee9a9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5011', DATE '2026-02-12', DATE '2026-02-12', 'Faturado', 3, '205684', NULL, NULL, NULL, '5011', 1424.18, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4f879f72-1631-5d29-a0a6-261d4981ae19', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-02-13', DATE '2026-04-14', 1424.18, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 116). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4f879f72-1631-5d29-a0a6-261d4981ae19', 'a68ace7d-52f9-5022-9f15-5fb326fee9a9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4f879f72-1631-5d29-a0a6-261d4981ae19', 'a68ace7d-52f9-5022-9f15-5fb326fee9a9', DATE '2026-04-14', 1424.18, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4f879f72-1631-5d29-a0a6-261d4981ae19', 'a68ace7d-52f9-5022-9f15-5fb326fee9a9', 1424.18, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 117 | apLIS lote 5017 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('30dfa912-062c-5946-a154-727d21e2d61d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5017', DATE '2026-02-13', DATE '2026-02-13', 'Recebido - parcial', 7, '7197839', NULL, NULL, NULL, '5017', 34373.04, 97);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-13', DATE '2026-03-15', 34373.04, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 117). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128', '30dfa912-062c-5946-a154-727d21e2d61d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128', '30dfa912-062c-5946-a154-727d21e2d61d', DATE '2026-03-15', DATE '2026-04-13', 34373.04, 32336.36, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128', '30dfa912-062c-5946-a154-727d21e2d61d', 2036.68, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 118 | apLIS lote 5022 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9c16cc3b-1466-5f45-a12e-2d09809df6d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5022', DATE '2026-02-13', DATE '2026-02-13', 'Recebido', 4, '7197903', NULL, NULL, NULL, '5022', 4022.67, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d529a4c6-b300-5c77-86a1-0285f24aa7ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-13', DATE '2026-03-15', 4022.67, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 118). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d529a4c6-b300-5c77-86a1-0285f24aa7ab', '9c16cc3b-1466-5f45-a12e-2d09809df6d3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d529a4c6-b300-5c77-86a1-0285f24aa7ab', '9c16cc3b-1466-5f45-a12e-2d09809df6d3', DATE '2026-03-15', DATE '2026-04-13', 4022.67, 4022.67, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 119 | apLIS lote 5070 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('502f9152-64a5-5d2a-99c6-46d098e76638', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5070', DATE '2026-02-25', DATE '2026-02-25', 'Recebido', 4, '7217506', NULL, NULL, NULL, '5070', 4427.13, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1d6209f4-1bf9-53d4-9630-7911e1e8f996', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-25', DATE '2026-03-27', 4427.13, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 119). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1d6209f4-1bf9-53d4-9630-7911e1e8f996', '502f9152-64a5-5d2a-99c6-46d098e76638');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1d6209f4-1bf9-53d4-9630-7911e1e8f996', '502f9152-64a5-5d2a-99c6-46d098e76638', DATE '2026-03-27', DATE '2026-04-13', 4427.13, 4427.13, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1d6209f4-1bf9-53d4-9630-7911e1e8f996', '502f9152-64a5-5d2a-99c6-46d098e76638', 1433.67, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- FEVEREIRO linha 120 | apLIS lote 5018 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8a5febb8-fe85-5490-bc18-3d1d4fda19c7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5018', DATE '2026-02-13', DATE '2026-02-26', 'Recebido', 4, '7218299', NULL, NULL, NULL, '5018', 16389.54, 44);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f7168950-3090-52d1-abd2-c6b848b2b546', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-26', DATE '2026-03-28', 16389.54, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 120). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f7168950-3090-52d1-abd2-c6b848b2b546', '8a5febb8-fe85-5490-bc18-3d1d4fda19c7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f7168950-3090-52d1-abd2-c6b848b2b546', '8a5febb8-fe85-5490-bc18-3d1d4fda19c7', DATE '2026-03-28', DATE '2026-04-13', 16389.54, 16243.90, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f7168950-3090-52d1-abd2-c6b848b2b546', '8a5febb8-fe85-5490-bc18-3d1d4fda19c7', 145.64, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- FEVEREIRO linha 121 | apLIS lote 5081 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bd9c61e5-31de-5fa6-bdc4-f77048c9f1e0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5081', DATE '2026-02-26', DATE '2026-02-26', 'Recebido - parcial', 7, '7218853', NULL, NULL, NULL, '5081', 17878.02, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('00b0cd5a-c92f-58fb-ae36-57c206aed5ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-26', DATE '2026-03-28', 17878.02, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 121). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('00b0cd5a-c92f-58fb-ae36-57c206aed5ad', 'bd9c61e5-31de-5fa6-bdc4-f77048c9f1e0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('00b0cd5a-c92f-58fb-ae36-57c206aed5ad', 'bd9c61e5-31de-5fa6-bdc4-f77048c9f1e0', DATE '2026-03-28', DATE '2026-04-17', 17878.02, 17878.02, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 122 | apLIS lote 5083 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('684cc37c-2572-54a1-8fd1-82d29df39310', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '5083', DATE '2026-02-26', DATE '2026-02-26', 'Recebido', 4, '7218972', NULL, NULL, NULL, '5083', 770.72, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63e1aec9-2b19-58fa-8548-bfa1be98d92e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-02-26', DATE '2026-03-28', 770.72, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 122). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63e1aec9-2b19-58fa-8548-bfa1be98d92e', '684cc37c-2572-54a1-8fd1-82d29df39310');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('63e1aec9-2b19-58fa-8548-bfa1be98d92e', '684cc37c-2572-54a1-8fd1-82d29df39310', DATE '2026-03-28', DATE '2026-04-18', 770.72, 770.72, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 123 | apLIS lote 5036 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1c889df-5ae9-536f-b045-aaacff9a8ee0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5036', DATE '2026-02-18', DATE '2026-02-19', 'Recebido', 4, '466971', NULL, NULL, NULL, '5036', 4734.69, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7fe79d0b-fae1-51c3-a5ba-4cfbbdac042e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 4734.69, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 123). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7fe79d0b-fae1-51c3-a5ba-4cfbbdac042e', 'b1c889df-5ae9-536f-b045-aaacff9a8ee0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7fe79d0b-fae1-51c3-a5ba-4cfbbdac042e', 'b1c889df-5ae9-536f-b045-aaacff9a8ee0', DATE '2026-03-21', DATE '2026-04-19', 4734.69, 4734.69, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 124 | apLIS lote 5032 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8a730eaa-a294-5b09-9dff-d026bb4961ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5032', DATE '2026-02-18', DATE '2026-02-19', 'Recebido', 4, '467033', NULL, NULL, NULL, '5032', 5766.11, 16);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e52fc69c-9b7d-5f73-afaf-0e12887e7d2b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 5766.11, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 124). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e52fc69c-9b7d-5f73-afaf-0e12887e7d2b', '8a730eaa-a294-5b09-9dff-d026bb4961ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e52fc69c-9b7d-5f73-afaf-0e12887e7d2b', '8a730eaa-a294-5b09-9dff-d026bb4961ad', DATE '2026-03-21', DATE '2026-04-20', 5766.11, 5766.11, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 125 | apLIS lote 4862 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e7564926-213a-5261-a962-9e9bd3a56e58', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '4862', DATE '2026-01-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467037', NULL, NULL, NULL, '4862', 3146.39, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('142b8e0d-a0a8-5e37-a526-7e5f843eb84a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 3146.39, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 125). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('142b8e0d-a0a8-5e37-a526-7e5f843eb84a', 'e7564926-213a-5261-a962-9e9bd3a56e58');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('142b8e0d-a0a8-5e37-a526-7e5f843eb84a', 'e7564926-213a-5261-a962-9e9bd3a56e58', DATE '2026-03-21', DATE '2026-04-21', 3146.39, 3146.39, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 126 | apLIS lote 5038 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b72df068-c6c3-575e-b83d-23afc008f9c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5038', DATE '2026-02-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467043', NULL, NULL, NULL, '5038', 73.67, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f4fed9a-6dda-5422-8a13-3c34521d1889', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 73.67, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 126). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f4fed9a-6dda-5422-8a13-3c34521d1889', 'b72df068-c6c3-575e-b83d-23afc008f9c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2f4fed9a-6dda-5422-8a13-3c34521d1889', 'b72df068-c6c3-575e-b83d-23afc008f9c5', DATE '2026-03-21', DATE '2026-04-22', 73.67, 73.67, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 127 | apLIS lote 5037 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('55417ef2-9b44-54ca-85ca-87a4567d6aca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5037', DATE '2026-02-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467052', NULL, NULL, NULL, '5037', 126.96, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f23fb080-fc44-5e0a-99ed-af2671dcfbcd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 126.96, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 127). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f23fb080-fc44-5e0a-99ed-af2671dcfbcd', '55417ef2-9b44-54ca-85ca-87a4567d6aca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f23fb080-fc44-5e0a-99ed-af2671dcfbcd', '55417ef2-9b44-54ca-85ca-87a4567d6aca', DATE '2026-03-21', DATE '2026-04-23', 126.96, 126.96, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 128 | apLIS lote 5041 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c91c9e22-2496-58e1-986f-191ea231c8f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5041', DATE '2026-02-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467074', NULL, NULL, NULL, '5041', 73.67, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f88ea8f7-cfb6-5aca-83eb-318ef686e1de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 73.67, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 128). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f88ea8f7-cfb6-5aca-83eb-318ef686e1de', 'c91c9e22-2496-58e1-986f-191ea231c8f7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f88ea8f7-cfb6-5aca-83eb-318ef686e1de', 'c91c9e22-2496-58e1-986f-191ea231c8f7', DATE '2026-03-21', DATE '2026-04-24', 73.67, 73.67, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 129 | apLIS lote 5042 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8e48534e-e314-594a-a20a-9d2aec0287cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5042', DATE '2026-02-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467089', NULL, NULL, NULL, '5042', 3761.45, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e44c591-12bf-56df-8e81-d56da8bd7668', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 3761.45, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 129). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e44c591-12bf-56df-8e81-d56da8bd7668', '8e48534e-e314-594a-a20a-9d2aec0287cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e44c591-12bf-56df-8e81-d56da8bd7668', '8e48534e-e314-594a-a20a-9d2aec0287cc', DATE '2026-03-21', DATE '2026-04-25', 3761.45, 3761.45, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 131 | apLIS lote 5040 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8ddb7f4c-4492-56a9-8ed0-da89e3e253ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '5040', DATE '2026-02-19', DATE '2026-02-19', 'Recebido', 4, 'PEG467097', NULL, NULL, NULL, '5040', 73.67, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fef8f341-16c5-5857-a92f-3265c89e430e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-02-19', DATE '2026-03-21', 73.67, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 131). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fef8f341-16c5-5857-a92f-3265c89e430e', '8ddb7f4c-4492-56a9-8ed0-da89e3e253ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fef8f341-16c5-5857-a92f-3265c89e430e', '8ddb7f4c-4492-56a9-8ed0-da89e3e253ad', DATE '2026-03-21', DATE '2026-04-27', 73.67, 73.67, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 133 | apLIS lote 4939 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dc00c9da-fb5c-5975-856c-992d2f080c9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '4939', DATE '2026-02-02', DATE '2026-02-02', 'Recebido - parcial', 7, 'PEG222254', NULL, NULL, NULL, '4939', 3648.97, 19);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-02-02', DATE '2026-03-17', 3648.97, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 133). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', 'dc00c9da-fb5c-5975-856c-992d2f080c9a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', 'dc00c9da-fb5c-5975-856c-992d2f080c9a', DATE '2026-03-17', DATE '2026-05-21', 3648.97, 3648.80, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', 'dc00c9da-fb5c-5975-856c-992d2f080c9a', 0.17, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 134 | apLIS lote 4941 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('50b516c3-8e1f-5048-83b9-3637d165b201', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '4941', DATE '2026-02-02', DATE '2026-02-04', 'Faturado', 3, 'PEG222442', NULL, NULL, NULL, '4941', 935.80, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-02-04', DATE '2026-03-19', 935.80, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 134). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', '50b516c3-8e1f-5048-83b9-3637d165b201');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', '50b516c3-8e1f-5048-83b9-3637d165b201', DATE '2026-03-19', DATE '2026-05-21', 935.80, 935.76, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', '50b516c3-8e1f-5048-83b9-3637d165b201', 0.04, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 135 | apLIS lote 5023 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3404e563-cd5a-54d0-b615-73d080db1c50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5023', DATE '2026-02-18', DATE '2026-02-18', 'Recebido', 4, 'PEG223233', NULL, NULL, NULL, '5023', 2283.38, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eef13560-6da3-59de-89ae-ce9811be94e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-02-18', DATE '2026-04-02', 2283.38, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 135). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eef13560-6da3-59de-89ae-ce9811be94e1', '3404e563-cd5a-54d0-b615-73d080db1c50');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('eef13560-6da3-59de-89ae-ce9811be94e1', '3404e563-cd5a-54d0-b615-73d080db1c50', DATE '2026-04-02', DATE '2026-05-01', 2283.38, 2104.06, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('eef13560-6da3-59de-89ae-ce9811be94e1', '3404e563-cd5a-54d0-b615-73d080db1c50', 179.32, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 136 | apLIS lote 4871 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e02b98f9-3e15-55ad-89e2-ea9fd481f1d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4871', DATE '2026-01-21', DATE '2026-02-20', 'Recebido', 4, 'PEG9585810', NULL, NULL, NULL, '4871', 1928.51, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-02-20', DATE '2026-03-13', 1928.51, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 136). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8', 'e02b98f9-3e15-55ad-89e2-ea9fd481f1d1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8', 'e02b98f9-3e15-55ad-89e2-ea9fd481f1d1', DATE '2026-03-13', DATE '2026-05-02', 1928.51, 1420.10, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8', 'e02b98f9-3e15-55ad-89e2-ea9fd481f1d1', 508.41, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 137 | apLIS lote 5030 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('662aa395-f3ae-590e-8ff1-2b9afac9eb4f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '5030', DATE '2026-02-18', DATE '2026-02-20', 'Recebido - parcial', 7, 'PEG9586223', NULL, NULL, NULL, '5030', 21935.97, 64);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed6f200c-daaa-5f78-92ee-63ebcf0da444', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-02-20', DATE '2026-03-13', 21935.97, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 137). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed6f200c-daaa-5f78-92ee-63ebcf0da444', '662aa395-f3ae-590e-8ff1-2b9afac9eb4f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ed6f200c-daaa-5f78-92ee-63ebcf0da444', '662aa395-f3ae-590e-8ff1-2b9afac9eb4f', DATE '2026-03-13', DATE '2026-05-03', 21935.97, 20447.01, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ed6f200c-daaa-5f78-92ee-63ebcf0da444', '662aa395-f3ae-590e-8ff1-2b9afac9eb4f', 1488.96, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 138 | apLIS lote 4931 | TRE-SAÚDE ("TRE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e636e6a-3a61-5ffc-a50d-b99b3c191466', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '4931', DATE '2026-02-02', DATE '2026-02-02', 'Recebido', 4, '4048', NULL, NULL, NULL, '4931', 76.85, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('712275ae-ee9f-5663-8df4-7165d51cd404', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), NULL, DATE '2026-02-02', DATE '2026-03-04', 76.85, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 138). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('712275ae-ee9f-5663-8df4-7165d51cd404', '6e636e6a-3a61-5ffc-a50d-b99b3c191466');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('712275ae-ee9f-5663-8df4-7165d51cd404', '6e636e6a-3a61-5ffc-a50d-b99b3c191466', DATE '2026-03-04', DATE '2026-04-01', 76.85, 76.85, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 139 | apLIS lote 4938 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c390081e-7c83-5d52-bdae-dcbf34eb6fe4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4938', DATE '2026-02-02', DATE '2026-02-02', 'Recebido - parcial', 7, 'PEG59368', NULL, NULL, NULL, '4938', 636.03, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-02-02', DATE '2026-03-04', 636.03, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 139). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', 'c390081e-7c83-5d52-bdae-dcbf34eb6fe4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', 'c390081e-7c83-5d52-bdae-dcbf34eb6fe4', DATE '2026-03-04', DATE '2026-05-05', 636.03, 505.91, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', 'c390081e-7c83-5d52-bdae-dcbf34eb6fe4', 130.12, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- FEVEREIRO linha 140 | apLIS lote 4936 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fdb50cc2-14e1-556a-801a-63fb507eacd2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4936', DATE '2026-02-02', DATE '2026-02-02', 'Recebido', 4, 'PEG59375', NULL, NULL, NULL, '4936', 2202.58, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1dada99a-8904-54a6-97f8-73e7b65f9d94', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-02-02', DATE '2026-03-04', 2202.58, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 140). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1dada99a-8904-54a6-97f8-73e7b65f9d94', 'fdb50cc2-14e1-556a-801a-63fb507eacd2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1dada99a-8904-54a6-97f8-73e7b65f9d94', 'fdb50cc2-14e1-556a-801a-63fb507eacd2', DATE '2026-03-04', DATE '2026-05-06', 2202.58, 2202.58, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- FEVEREIRO linha 141 | apLIS lote 5045 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('39703318-1b40-5931-80c8-f176583f99a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5045', DATE '2026-02-19', DATE '2026-02-20', 'Recebido - parcial', 7, 'P20261243152', NULL, NULL, NULL, '5045', 50.19, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-02-20', DATE '2026-03-20', 50.19, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 141). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', '39703318-1b40-5931-80c8-f176583f99a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', '39703318-1b40-5931-80c8-f176583f99a5', DATE '2026-03-20', DATE '2026-03-20', 50.19, 50.19, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', '39703318-1b40-5931-80c8-f176583f99a5', 0.01, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Raquel');

-- FEVEREIRO linha 142 | apLIS lote 5026 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('782d225f-1f36-5b81-a931-6041de28f1c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '5026', DATE '2026-02-18', DATE '2026-02-20', 'Recebido', 4, 'P20261243177', NULL, NULL, NULL, '5026', 10520.59, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-02-20', DATE '2026-03-20', 10520.59, '2026-02', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, linha 142). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', '782d225f-1f36-5b81-a931-6041de28f1c3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', '782d225f-1f36-5b81-a931-6041de28f1c3', DATE '2026-03-20', DATE '2026-03-20', 10520.59, 10570.78, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', '782d225f-1f36-5b81-a931-6041de28f1c3', 50.19, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Raquel');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba FEVEREIRO, %'
     AND competencia = '2026-02'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 113 THEN
    RAISE EXCEPTION 'Esperados 113 títulos do backfill de fevereiro; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
