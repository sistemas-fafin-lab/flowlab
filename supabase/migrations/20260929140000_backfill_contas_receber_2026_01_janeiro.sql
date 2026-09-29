-- ============================================================================
-- Backfill histórico: Contas a Receber — Janeiro/2026 (1 de 6)
--
-- Parte do backfill Jan–Jun/2026, dividido em uma migration por mês para caber
-- no SQL editor. Cada uma é independente (pré-condições e transação próprias) e
-- pode rodar sozinha. Fonte: aba JANEIRO de "Faturamento x Recebimentos - 2026 -
-- 1° Trimestre.xlsx", recebida em 29/09. Mesmo formato do backfill do 3º tri
-- (20260911100000), já com as correções que aquele precisou depois
-- (20260928120000..150000):
--   - operadora, datas de criação/envio, protocolo, status STLOT, NF-e/RPS e
--     quantidade de guias vêm do apLIS (fatlote/fatrps, lido em 29/09);
--   - valor: soma de fatrequisicaoprocedimento.ValorLiquido no apLIS quando o
--     título não tem baixa nem glosa (regra de 20260928140000); com baixa ou
--     glosa, o "Valor Enviado" da planilha, sobre o qual o pagamento veio;
--   - emissão = "Data Faturamento", vencimento = "Data Provável Pagamento"
--     (não o do RPS, ver 20260928130000), competência = 2026-01;
--   - colisões conferidas contra PRODUÇÃO (jqx), não contra o teste.
--
-- 106 títulos, R$ 1.080.178,49 (1 lote → 1 título → 1 recebimento).
-- Recebimentos: 55 recebidos, 44 parciais, 7 previstos.
-- Glosas: 40 abertas, 10 definitivas (refaturadas em outro lote),
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
    '4460', '4625', '4671', '4728', '4729', '4732', '4736', '4750', '4763', '4779', '4780', '4781'
    '4786', '4787', '4788', '4789', '4792', '4797', '4799', '4800', '4802', '4803', '4804', '4805'
    '4806', '4807', '4808', '4809', '4810', '4811', '4812', '4813', '4814', '4815', '4816', '4817'
    '4818', '4821', '4822', '4823', '4824', '4825', '4829', '4830', '4831', '4832', '4833', '4837'
    '4838', '4840', '4841', '4843', '4844', '4845', '4846', '4848', '4849', '4850', '4852', '4853'
    '4854', '4855', '4856', '4857', '4859', '4860', '4861', '4863', '4864', '4865', '4866', '4868'
    '4869', '4870', '4875', '4876', '4878', '4879', '4880', '4883', '4884', '4885', '4894', '4895'
    '4896', '4897', '4899', '4901', '4903', '4904', '4909', '4910', '4911', '4913', '4914', '4915'
    '4916', '4917', '4919', '4920', '4922', '4923', '4926', '4927', '4929', '4930'
   );
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1000', '1007', '1008', '1009', '1025', '1049', '1078', '1101', '1122', '1129', '1197', '1204', '1210', '1227', '1228', '1231', '1235', '1251', '1252', '1253', '1257', '1268', '1281', '1282', '1283');
  IF v_operadoras <> 25 THEN
    RAISE EXCEPTION 'Esperadas 25 operadoras do apLIS; encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote, recebimentos e glosas.
--    UUIDs fixos (gerados no script) para ligar as linhas sem round-trip.
-- ----------------------------------------------------------------------------

-- JANEIRO linha 25 | apLIS lote 4849 | AMHP-DF ("AMHPDF - UNAFISCO" na planilha)
-- Data Faturamento 2025-01-15 → 2026-01-15 (fechamento no apLIS 2026-01-15)
-- Data Provável Pagamento 2025-03-16 → 2026-03-16
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d4a2654e-1c35-507a-876c-3e5abb5d1be9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4849', DATE '2026-01-15', DATE '2026-01-15', 'Recebido', 4, '15012026', NULL, NULL, NULL, '4849', 1000.75, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa2bec02-6a65-5585-abe4-1c2ef029f03f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-15', DATE '2026-03-16', 1000.75, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 25). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa2bec02-6a65-5585-abe4-1c2ef029f03f', 'd4a2654e-1c35-507a-876c-3e5abb5d1be9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('aa2bec02-6a65-5585-abe4-1c2ef029f03f', 'd4a2654e-1c35-507a-876c-3e5abb5d1be9', DATE '2026-03-16', DATE '2026-04-02', 1000.75, 1000.75, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 26 | apLIS lote 4841 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('30acfa93-3cfa-59d5-b801-d9e1a224f61b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4841', DATE '2026-01-13', DATE '2026-01-14', 'Recebido - parcial', 7, '14012026', NULL, NULL, NULL, '4841', 1378.20, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33d42e95-33ab-5025-95e7-cccd74994d3b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-14', DATE '2026-03-15', 1378.20, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 26). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33d42e95-33ab-5025-95e7-cccd74994d3b', '30acfa93-3cfa-59d5-b801-d9e1a224f61b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('33d42e95-33ab-5025-95e7-cccd74994d3b', '30acfa93-3cfa-59d5-b801-d9e1a224f61b', DATE '2026-03-15', DATE '2026-04-08', 1378.20, 321.15, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('33d42e95-33ab-5025-95e7-cccd74994d3b', '30acfa93-3cfa-59d5-b801-d9e1a224f61b', 1057.05, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 27 | apLIS lote 4763 | AMHP-DF ("AMHPDF - CASEMBRAPA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a28c07af-0a8b-55da-b278-4ceb64e8600a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4763', DATE '2025-12-24', DATE '2026-01-15', 'Recebido', 4, '15012026', NULL, NULL, NULL, '4763', 11279.58, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c06e96c3-9f15-58dc-97f5-808a582dbaeb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-15', DATE '2026-03-16', 11279.58, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 27). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c06e96c3-9f15-58dc-97f5-808a582dbaeb', 'a28c07af-0a8b-55da-b278-4ceb64e8600a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c06e96c3-9f15-58dc-97f5-808a582dbaeb', 'a28c07af-0a8b-55da-b278-4ceb64e8600a', DATE '2026-03-16', DATE '2026-04-02', 11279.58, 11279.58, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 28 | apLIS lote 4855 | AMHP-DF ("AMHPDF - CARE PLUS" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d92bacb5-0315-55e0-9a29-9bc69f6ddc31', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4855', DATE '2026-01-16', DATE '2026-01-16', 'Recebido', 4, '44651975', NULL, NULL, NULL, '4855', 2269.40, 5);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-16', DATE '2026-03-17', 2269.40, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 28). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', 'd92bacb5-0315-55e0-9a29-9bc69f6ddc31');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', 'd92bacb5-0315-55e0-9a29-9bc69f6ddc31', DATE '2026-03-17', DATE '2026-03-09', 2269.40, 73.95, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', 'd92bacb5-0315-55e0-9a29-9bc69f6ddc31', 2195.45, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 29 | apLIS lote 4843 | AMHP-DF ("AMHPDF TRF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bb48c5b4-a90d-5007-96cb-e641e46ce7cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4843', DATE '2026-01-13', DATE '2026-01-14', 'Recebido', 4, '14012026', NULL, NULL, NULL, '4843', 19303.59, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('562aeafa-ef81-59cd-b806-4b760c56cc61', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-14', DATE '2026-03-15', 19303.59, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 29). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('562aeafa-ef81-59cd-b806-4b760c56cc61', 'bb48c5b4-a90d-5007-96cb-e641e46ce7cc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('562aeafa-ef81-59cd-b806-4b760c56cc61', 'bb48c5b4-a90d-5007-96cb-e641e46ce7cc', DATE '2026-03-15', DATE '2026-04-02', 19303.59, 19303.59, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 30 | apLIS lote 4845 | AMHP-DF ("AMHPDF - STM" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad376600-44dc-557e-b910-02b7d70a52ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4845', DATE '2026-01-14', DATE '2026-01-15', 'Recebido', 4, '15012026', NULL, NULL, NULL, '4845', 230.52, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('253c5e5e-55a4-5e43-a960-4b9860d85acb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-15', DATE '2026-03-16', 230.52, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 30). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('253c5e5e-55a4-5e43-a960-4b9860d85acb', 'ad376600-44dc-557e-b910-02b7d70a52ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('253c5e5e-55a4-5e43-a960-4b9860d85acb', 'ad376600-44dc-557e-b910-02b7d70a52ad', DATE '2026-03-16', DATE '2026-04-02', 230.52, 230.52, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 31 | apLIS lote 4850 | AMHP-DF ("AMHPDF - CASEC /CODEVASF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1c4e3241-bff5-5d34-8b54-d33a23bbebdc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4850', DATE '2026-01-15', DATE '2026-01-16', 'Recebido', 4, '16012026', NULL, NULL, NULL, '4850', 2591.10, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('430993ce-45e6-551e-965c-a7270d890a3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-16', DATE '2026-03-17', 2591.10, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 31). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('430993ce-45e6-551e-965c-a7270d890a3a', '1c4e3241-bff5-5d34-8b54-d33a23bbebdc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('430993ce-45e6-551e-965c-a7270d890a3a', '1c4e3241-bff5-5d34-8b54-d33a23bbebdc', DATE '2026-03-17', DATE '2026-04-02', 2591.10, 2591.10, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 32 | apLIS lote 4833 | LAB PLANASSISTE ("AMHPDF - PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e40d69c2-12ad-5f6c-abe2-c41402552b1e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '4833', DATE '2026-01-09', DATE '2026-01-13', 'Recebido', 4, '13012026', NULL, NULL, NULL, '4833', 24227.88, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8673faf4-024d-5f4e-ab54-8111e4869eca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-01-13', DATE '2026-03-14', 24227.88, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 32). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8673faf4-024d-5f4e-ab54-8111e4869eca', 'e40d69c2-12ad-5f6c-abe2-c41402552b1e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8673faf4-024d-5f4e-ab54-8111e4869eca', 'e40d69c2-12ad-5f6c-abe2-c41402552b1e', DATE '2026-03-14', DATE '2026-04-02', 24227.88, 24227.88, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 33 | apLIS lote 4848 | AMHP-DF ("AMHPDF - AFFEGO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b94a4548-42ae-53bd-b55c-61252cb77e2a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4848', DATE '2026-01-15', DATE '2026-01-15', 'Faturado', 3, '15012026', NULL, NULL, NULL, '4848', 59.12, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4f60dab8-58e0-51db-a846-2b1278d4b5cc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-15', DATE '2026-03-16', 59.12, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 33). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4f60dab8-58e0-51db-a846-2b1278d4b5cc', 'b94a4548-42ae-53bd-b55c-61252cb77e2a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4f60dab8-58e0-51db-a846-2b1278d4b5cc', 'b94a4548-42ae-53bd-b55c-61252cb77e2a', DATE '2026-03-16', DATE '2026-04-02', 59.12, 57.90, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4f60dab8-58e0-51db-a846-2b1278d4b5cc', 'b94a4548-42ae-53bd-b55c-61252cb77e2a', 1.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 34 | apLIS lote 4854 | AMHP-DF ("AMHPDF - SERPRO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8b8be80c-fc50-5155-8fce-d774f9b134b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4854', DATE '2026-01-16', DATE '2026-01-16', 'Recebido', 4, '16012026', NULL, NULL, NULL, '4854', 574.08, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('292a5097-643d-5e13-8dd4-f266a92ea4af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-16', DATE '2026-03-17', 574.08, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 34). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('292a5097-643d-5e13-8dd4-f266a92ea4af', '8b8be80c-fc50-5155-8fce-d774f9b134b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('292a5097-643d-5e13-8dd4-f266a92ea4af', '8b8be80c-fc50-5155-8fce-d774f9b134b8', DATE '2026-03-17', DATE '2026-04-08', 574.08, 574.08, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 35 | apLIS lote 4856 | AMHP-DF ("AMHPDF - CONAB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b00ceea8-f1a0-560f-8926-3600a371b25c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4856', DATE '2026-01-16', DATE '2026-01-26', 'Recebido', 4, '26012026', NULL, NULL, NULL, '4856', 2490.09, 10);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d3c826a-d57b-5dbf-ae20-408da19550c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-26', DATE '2026-03-27', 2490.09, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 35). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d3c826a-d57b-5dbf-ae20-408da19550c1', 'b00ceea8-f1a0-560f-8926-3600a371b25c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6d3c826a-d57b-5dbf-ae20-408da19550c1', 'b00ceea8-f1a0-560f-8926-3600a371b25c', DATE '2026-03-27', DATE '2026-04-02', 2490.09, 2490.09, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 36 | apLIS lote 4853 | AMHP-DF ("AMHPDF - PROASA" na planilha)
-- Data Faturamento 2025-01-16 → 2026-01-16 (fechamento no apLIS 2026-01-16)
-- Data Provável Pagamento 2025-03-17 → 2026-03-17
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f68c3382-9e4f-52e2-96dd-8efc4a499d45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4853', DATE '2026-01-16', DATE '2026-01-16', 'Recebido - parcial', 7, '44651932', NULL, NULL, NULL, '4853', 124.56, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c5d09d8c-c2bd-502a-868e-a72adfa81343', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-16', DATE '2026-03-17', 124.56, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 36). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c5d09d8c-c2bd-502a-868e-a72adfa81343', 'f68c3382-9e4f-52e2-96dd-8efc4a499d45');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c5d09d8c-c2bd-502a-868e-a72adfa81343', 'f68c3382-9e4f-52e2-96dd-8efc4a499d45', DATE '2026-03-17', DATE '2026-03-09', 124.56, 59.89, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c5d09d8c-c2bd-502a-868e-a72adfa81343', 'f68c3382-9e4f-52e2-96dd-8efc4a499d45', 64.67, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 37 | apLIS lote 4852 | AMHP-DF ("AMPDF - NOTREDAME" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('617865b3-6148-5025-886f-1c62063d4c3d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4852', DATE '2026-01-16', DATE '2026-01-16', 'Faturado', 3, '44651917', NULL, NULL, NULL, '4852', 1597.14, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b6f812e-49a9-5d0f-a722-b24aec020377', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-16', DATE '2026-02-15', 1597.14, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 37). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b6f812e-49a9-5d0f-a722-b24aec020377', '617865b3-6148-5025-886f-1c62063d4c3d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b6f812e-49a9-5d0f-a722-b24aec020377', '617865b3-6148-5025-886f-1c62063d4c3d', DATE '2026-02-15', DATE '2026-04-02', 1597.14, 1597.14, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 38 | apLIS lote 4846 | AMHP-DF ("AMHPDF - OMINT" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3a151fff-4711-577c-8849-ce67249f4f57', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4846', DATE '2026-01-15', DATE '2026-01-15', 'Faturado', 3, '44651799', NULL, NULL, NULL, '4846', 3322.08, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f2bbe3e9-b782-5537-a04e-516a80dbd874', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-15', DATE '2026-03-16', 3322.08, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 38). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f2bbe3e9-b782-5537-a04e-516a80dbd874', '3a151fff-4711-577c-8849-ce67249f4f57');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f2bbe3e9-b782-5537-a04e-516a80dbd874', '3a151fff-4711-577c-8849-ce67249f4f57', DATE '2026-03-16', DATE '2026-04-08', 3322.08, 262.92, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('f2bbe3e9-b782-5537-a04e-516a80dbd874', '3a151fff-4711-577c-8849-ce67249f4f57', 3059.16, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 39 | apLIS lote 4866 | AMHP-DF ("AMHPDF - BACEN" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3a2f1f49-a57c-582f-b1fd-9af63b813697', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4866', DATE '2026-01-19', DATE '2026-01-22', 'Recebido', 4, '22012026', NULL, NULL, NULL, '4866', 20003.65, 83);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d86becfd-005b-59c0-be8f-a62edfa65a95', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), NULL, DATE '2026-01-22', DATE '2026-03-23', 20003.65, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 39). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d86becfd-005b-59c0-be8f-a62edfa65a95', '3a2f1f49-a57c-582f-b1fd-9af63b813697');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d86becfd-005b-59c0-be8f-a62edfa65a95', '3a2f1f49-a57c-582f-b1fd-9af63b813697', DATE '2026-03-23', DATE '2026-04-02', 20003.65, 20003.65, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 40 | apLIS lote 4817 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('837ab1fb-39f1-5892-8218-7724180c8114', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '4817', DATE '2026-01-06', DATE '2026-01-07', 'Recebido', 4, '5565290392', NULL, NULL, NULL, '4817', 12660.01, 73);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-01-07', DATE '2026-02-06', 12660.01, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 40). Responsável: Ana. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', '837ab1fb-39f1-5892-8218-7724180c8114');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', '837ab1fb-39f1-5892-8218-7724180c8114', DATE '2026-02-06', DATE '2026-02-06', 12660.01, 12305.01, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', '837ab1fb-39f1-5892-8218-7724180c8114', 355.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 41 | apLIS lote 4818 | AMIL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9c11d697-baeb-5c5e-a067-0bca220033f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '4818', DATE '2026-01-06', DATE '2026-01-06', 'Recebido - parcial', 7, '5563471380', NULL, NULL, NULL, '4818', 1836.97, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), NULL, DATE '2026-01-07', DATE '2026-02-06', 1836.97, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 41). Responsável: Ana. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', '9c11d697-baeb-5c5e-a067-0bca220033f5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', '9c11d697-baeb-5c5e-a067-0bca220033f5', DATE '2026-02-06', DATE '2026-02-06', 1836.97, 1240.97, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', '9c11d697-baeb-5c5e-a067-0bca220033f5', 596.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 42 | apLIS lote 4780 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea48f723-1609-5eed-9c79-670660319ad4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4780', DATE '2025-12-26', DATE '2026-01-06', 'Recebido', 4, '1247054', NULL, NULL, NULL, '4780', 14850.15, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05dbe0d6-f7ff-589f-bdcf-70c18b5945d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-06', DATE '2026-02-20', 14850.15, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 42). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05dbe0d6-f7ff-589f-bdcf-70c18b5945d7', 'ea48f723-1609-5eed-9c79-670660319ad4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('05dbe0d6-f7ff-589f-bdcf-70c18b5945d7', 'ea48f723-1609-5eed-9c79-670660319ad4', DATE '2026-02-20', DATE '2026-05-12', 14850.15, 14850.15, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 43 | apLIS lote 4809 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a1b6a77-49ec-5802-b277-b7e4b67c8a76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4809', DATE '2026-01-05', DATE '2026-01-05', 'Recebido', 4, '1244117', NULL, NULL, NULL, '4809', 12514.91, 60);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4a5b691e-d8ad-5de6-b3d6-2903b4d8fef0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-05', DATE '2026-02-20', 12514.91, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 43). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4a5b691e-d8ad-5de6-b3d6-2903b4d8fef0', '1a1b6a77-49ec-5802-b277-b7e4b67c8a76');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4a5b691e-d8ad-5de6-b3d6-2903b4d8fef0', '1a1b6a77-49ec-5802-b277-b7e4b67c8a76', DATE '2026-02-20', DATE '2026-05-12', 12514.91, 12514.91, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 44 | apLIS lote 4808 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1af0ee4c-ccfd-5f36-ae2a-c55e0c40dc29', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4808', DATE '2026-01-05', DATE '2026-01-06', 'Recebido', 4, '1247755', NULL, NULL, NULL, '4808', 13673.66, 67);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff47954b-9bd2-5f18-8fad-b4ee53eef58d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-06', DATE '2026-02-20', 13673.66, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 44). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff47954b-9bd2-5f18-8fad-b4ee53eef58d', '1af0ee4c-ccfd-5f36-ae2a-c55e0c40dc29');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ff47954b-9bd2-5f18-8fad-b4ee53eef58d', '1af0ee4c-ccfd-5f36-ae2a-c55e0c40dc29', DATE '2026-02-20', DATE '2026-05-12', 13673.66, 13673.66, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 45 | apLIS lote 4781 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('26d47bcd-ca30-57be-a28b-3997a40009fa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4781', DATE '2025-12-26', DATE '2026-01-06', 'Recebido', 4, '1248308', NULL, NULL, NULL, '4781', 15356.04, 62);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7bbe77aa-3086-5528-b5f1-2672424a2d74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-06', DATE '2026-02-20', 15356.04, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 45). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7bbe77aa-3086-5528-b5f1-2672424a2d74', '26d47bcd-ca30-57be-a28b-3997a40009fa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7bbe77aa-3086-5528-b5f1-2672424a2d74', '26d47bcd-ca30-57be-a28b-3997a40009fa', DATE '2026-02-20', DATE '2026-05-12', 15356.04, 15356.04, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 46 | apLIS lote 4779 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b8c9044c-2076-5a11-b164-71d919b942ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4779', DATE '2025-12-26', DATE '2026-01-07', 'Recebido', 4, '1250983', NULL, NULL, NULL, '4779', 3815.35, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6a973a7b-3bcf-56b2-92cb-d8caeb0730dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-07', DATE '2026-02-20', 3815.35, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 46). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6a973a7b-3bcf-56b2-92cb-d8caeb0730dd', 'b8c9044c-2076-5a11-b164-71d919b942ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6a973a7b-3bcf-56b2-92cb-d8caeb0730dd', 'b8c9044c-2076-5a11-b164-71d919b942ed', DATE '2026-02-20', DATE '2026-05-12', 3815.35, 3815.35, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 47 | apLIS lote 4825 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('97dc0660-5827-5d0b-b3b0-dc16fb5943b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '4825', DATE '2026-01-07', DATE '2026-01-07', 'Recebido', 4, '1251288', NULL, NULL, NULL, '4825', 5777.17, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), NULL, DATE '2026-01-07', DATE '2026-02-20', 5777.17, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 47). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', '97dc0660-5827-5d0b-b3b0-dc16fb5943b0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', '97dc0660-5827-5d0b-b3b0-dc16fb5943b0', DATE '2026-02-20', DATE '2026-05-12', 5777.17, 5088.18, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', '97dc0660-5827-5d0b-b3b0-dc16fb5943b0', 688.99, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 48 | apLIS lote 4732 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f7c69ef2-4afe-5439-999c-0ef92ef52da0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4732', DATE '2025-12-12', DATE '2026-01-12', 'Recebido - parcial', 7, '340224360239_0', NULL, NULL, NULL, '4732', 13644.31, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0e98823a-0afe-59ed-8045-8e9151d7230b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-12', DATE '2026-03-13', 13644.31, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 48). Responsável: Ana. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0e98823a-0afe-59ed-8045-8e9151d7230b', 'f7c69ef2-4afe-5439-999c-0ef92ef52da0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0e98823a-0afe-59ed-8045-8e9151d7230b', 'f7c69ef2-4afe-5439-999c-0ef92ef52da0', DATE '2026-03-13', 13644.31, 'previsto', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0e98823a-0afe-59ed-8045-8e9151d7230b', 'f7c69ef2-4afe-5439-999c-0ef92ef52da0', 13644.31, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Ana');

-- JANEIRO linha 49 | apLIS lote 4736 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ae7a43df-a460-5824-baa6-4609e067deb3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4736', DATE '2025-12-12', DATE '2026-01-12', 'Faturado', 3, '341224361021_0', NULL, NULL, NULL, '4736', 4297.14, 21);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a2be36df-3482-5202-bb9a-d69a7db29870', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-12', DATE '2026-03-13', 4297.14, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 49). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a2be36df-3482-5202-bb9a-d69a7db29870', 'ae7a43df-a460-5824-baa6-4609e067deb3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a2be36df-3482-5202-bb9a-d69a7db29870', 'ae7a43df-a460-5824-baa6-4609e067deb3', DATE '2026-03-13', 4297.14, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a2be36df-3482-5202-bb9a-d69a7db29870', 'ae7a43df-a460-5824-baa6-4609e067deb3', 4297.14, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- JANEIRO linha 50 | apLIS lote 4799 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67b3c7ba-b9dc-53aa-b9aa-a9c258c3daa5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4799', DATE '2025-12-31', DATE '2026-01-12', 'Faturado', 3, '341224362772_0', NULL, NULL, NULL, '4799', 29887.54, 51);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('759a4004-1539-5d72-bc2d-11f0202e31fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-12', DATE '2026-03-13', 29887.54, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 50). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('759a4004-1539-5d72-bc2d-11f0202e31fd', '67b3c7ba-b9dc-53aa-b9aa-a9c258c3daa5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('759a4004-1539-5d72-bc2d-11f0202e31fd', '67b3c7ba-b9dc-53aa-b9aa-a9c258c3daa5', DATE '2026-03-13', 29887.54, 'previsto', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('759a4004-1539-5d72-bc2d-11f0202e31fd', '67b3c7ba-b9dc-53aa-b9aa-a9c258c3daa5', 29887.54, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- JANEIRO linha 51 | apLIS lote 4800 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f31ee062-c334-58f1-b0df-e31bcf1abc27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4800', DATE '2025-12-31', DATE '2026-01-12', 'Faturado', 3, '341224363503_0', NULL, NULL, NULL, '4800', 2747.08, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5a446282-f098-5509-bfdf-d7cab5c67767', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-12', DATE '2026-03-13', 2747.08, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 51). Responsável: Ana. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5a446282-f098-5509-bfdf-d7cab5c67767', 'f31ee062-c334-58f1-b0df-e31bcf1abc27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5a446282-f098-5509-bfdf-d7cab5c67767', 'f31ee062-c334-58f1-b0df-e31bcf1abc27', DATE '2026-03-13', 2747.08, 'previsto', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5a446282-f098-5509-bfdf-d7cab5c67767', 'f31ee062-c334-58f1-b0df-e31bcf1abc27', 2747.08, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Ana');

-- JANEIRO linha 52 | apLIS lote 4802 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96e25976-35c5-5725-bc4f-9ec18f1fc559', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4802', DATE '2025-12-31', DATE '2026-01-12', 'Faturado', 3, '340224365599_0', NULL, NULL, NULL, '4802', 9151.03, 37);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('10f053ff-720d-5271-8a0f-6286eb239394', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-12', DATE '2026-03-13', 9151.03, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 52). Responsável: Ana. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('10f053ff-720d-5271-8a0f-6286eb239394', '96e25976-35c5-5725-bc4f-9ec18f1fc559');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('10f053ff-720d-5271-8a0f-6286eb239394', '96e25976-35c5-5725-bc4f-9ec18f1fc559', DATE '2026-03-13', 9151.03, 'previsto', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('10f053ff-720d-5271-8a0f-6286eb239394', '96e25976-35c5-5725-bc4f-9ec18f1fc559', 9151.03, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Ana');

-- JANEIRO linha 53 | apLIS lote 4803 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3089e912-52eb-5212-a83c-2a310c0d2945', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4803', DATE '2025-12-31', DATE '2026-01-12', 'Faturado', 3, '340224366036_0', NULL, NULL, NULL, '4803', 11230.81, 38);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d174af0-ad78-5f79-8085-4122567bb046', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-12', DATE '2026-03-13', 11230.81, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 53). Responsável: Ana. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d174af0-ad78-5f79-8085-4122567bb046', '3089e912-52eb-5212-a83c-2a310c0d2945');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6d174af0-ad78-5f79-8085-4122567bb046', '3089e912-52eb-5212-a83c-2a310c0d2945', DATE '2026-03-13', 11230.81, 'previsto', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6d174af0-ad78-5f79-8085-4122567bb046', '3089e912-52eb-5212-a83c-2a310c0d2945', 11230.81, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Ana');

-- JANEIRO linha 54 | apLIS lote 4876 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e366130b-66b2-5d74-978a-77f1bbdcedd5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4876', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, '341224700492_0', NULL, NULL, NULL, '4876', 264.66, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed8f19d7-cc2b-516c-938c-c7520f35c694', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-23', DATE '2026-03-24', 264.66, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 54). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed8f19d7-cc2b-516c-938c-c7520f35c694', 'e366130b-66b2-5d74-978a-77f1bbdcedd5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ed8f19d7-cc2b-516c-938c-c7520f35c694', 'e366130b-66b2-5d74-978a-77f1bbdcedd5', DATE '2026-03-24', DATE '2026-02-27', 264.66, 264.66, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 55 | apLIS lote 4797 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('707b5db7-dd84-57f1-bf17-d6af5b8e446c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4797', DATE '2025-12-31', DATE '2025-12-31', 'Recebido', 4, '341224167252_0', NULL, NULL, NULL, '4797', 17563.35, 56);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-23', DATE '2026-03-24', 17563.35, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 55). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', '707b5db7-dd84-57f1-bf17-d6af5b8e446c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', '707b5db7-dd84-57f1-bf17-d6af5b8e446c', DATE '2026-03-24', DATE '2026-03-17', 17563.35, 14727.45, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', '707b5db7-dd84-57f1-bf17-d6af5b8e446c', 2835.90, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 56 | apLIS lote 4879 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c1386022-2f40-5500-a72d-ea69acf53336', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4879', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, '341224701196_0', NULL, NULL, NULL, '4879', 10944.55, 27);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1db5cacf-3188-5c6e-8930-e37529792373', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-23', DATE '2026-03-24', 10944.55, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 56). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1db5cacf-3188-5c6e-8930-e37529792373', 'c1386022-2f40-5500-a72d-ea69acf53336');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('1db5cacf-3188-5c6e-8930-e37529792373', 'c1386022-2f40-5500-a72d-ea69acf53336', DATE '2026-03-24', DATE '2026-02-27', 10944.55, 10944.55, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 57 | apLIS lote 4880 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6205c8a9-5ba6-5b96-bb86-db9365715701', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4880', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, 'PEG340224701737_0', NULL, NULL, NULL, '4880', 4908.34, 17);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7690b278-2b67-5a61-b8d4-68009a49c000', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-23', DATE '2026-03-24', 4908.34, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 57). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7690b278-2b67-5a61-b8d4-68009a49c000', '6205c8a9-5ba6-5b96-bb86-db9365715701');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7690b278-2b67-5a61-b8d4-68009a49c000', '6205c8a9-5ba6-5b96-bb86-db9365715701', DATE '2026-03-24', DATE '2026-02-27', 4908.34, 4908.34, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 58 | apLIS lote 4885 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('66833dba-f177-5c1d-a6a3-0f6e358d1a0a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4885', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, '340224702296_0', NULL, NULL, NULL, '4885', 8491.65, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-23', DATE '2026-03-24', 8491.65, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 58). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', '66833dba-f177-5c1d-a6a3-0f6e358d1a0a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', '66833dba-f177-5c1d-a6a3-0f6e358d1a0a', DATE '2026-03-24', DATE '2026-02-27', 8491.65, 8466.10, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', '66833dba-f177-5c1d-a6a3-0f6e358d1a0a', 25.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 59 | apLIS lote 4884 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8ed3b2f-ffa2-53d4-9eb4-cc39fe3890e7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4884', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, 'PEG340224703261_0', NULL, NULL, NULL, '4884', 29750.30, 75);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52214f7c-c512-5604-975f-3e8816b55089', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-23', DATE '2026-03-24', 29750.30, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 59). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52214f7c-c512-5604-975f-3e8816b55089', 'a8ed3b2f-ffa2-53d4-9eb4-cc39fe3890e7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('52214f7c-c512-5604-975f-3e8816b55089', 'a8ed3b2f-ffa2-53d4-9eb4-cc39fe3890e7', DATE '2026-03-24', DATE '2026-02-27', 29750.30, 29750.30, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 60 | apLIS lote 4913 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('296409f1-7ebe-5fc6-b3ca-7688a4174a9e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4913', DATE '2026-01-28', DATE '2026-01-29', 'Recebido', 4, 'PEG340224821335_0', NULL, NULL, NULL, '4913', 1295.86, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4b64016c-906e-529c-97b9-f788362dfde2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-29', DATE '2026-03-30', 1295.86, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 60). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4b64016c-906e-529c-97b9-f788362dfde2', '296409f1-7ebe-5fc6-b3ca-7688a4174a9e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4b64016c-906e-529c-97b9-f788362dfde2', '296409f1-7ebe-5fc6-b3ca-7688a4174a9e', DATE '2026-03-30', DATE '2026-03-05', 1295.86, 1295.86, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 61 | apLIS lote 4909 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('35c2ee4a-1238-5c86-a3c5-873f91350476', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4909', DATE '2026-01-28', DATE '2026-01-29', 'Recebido', 4, 'PEG341224821647_0', NULL, NULL, NULL, '4909', 3710.29, 9);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-29', DATE '2026-03-30', 3710.29, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 61). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', '35c2ee4a-1238-5c86-a3c5-873f91350476');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', '35c2ee4a-1238-5c86-a3c5-873f91350476', DATE '2026-03-30', DATE '2026-02-27', 3710.29, 3684.74, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', '35c2ee4a-1238-5c86-a3c5-873f91350476', 25.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 62 | apLIS lote 4878 | BRADESCO SAUDE S/A 421715 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd5af62d-9ca3-5b11-8365-7b62aae46a45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4878', DATE '2026-01-23', DATE '2026-01-29', 'Recebido', 4, 'PEG341224822191_0', NULL, NULL, NULL, '4878', 264.66, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a1b02872-40f3-5dfa-b173-f44902a3706e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), NULL, DATE '2026-01-29', DATE '2026-03-30', 264.66, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 62). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a1b02872-40f3-5dfa-b173-f44902a3706e', 'cd5af62d-9ca3-5b11-8365-7b62aae46a45');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a1b02872-40f3-5dfa-b173-f44902a3706e', 'cd5af62d-9ca3-5b11-8365-7b62aae46a45', DATE '2026-03-30', DATE '2026-03-05', 264.66, 264.66, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 63 | apLIS lote 4911 | BRADESCO SAUDE  - 005711 ("BRADESCO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2dd2784e-f215-5ea2-89c7-f03566070492', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4911', DATE '2026-01-28', DATE '2026-01-29', 'Recebido', 4, 'PEG340224824708_0', NULL, NULL, NULL, '4911', 28003.70, 69);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), NULL, DATE '2026-01-29', DATE '2026-03-30', 28003.70, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 63). Responsável: Raquel. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', '2dd2784e-f215-5ea2-89c7-f03566070492');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', '2dd2784e-f215-5ea2-89c7-f03566070492', DATE '2026-03-30', DATE '2026-03-16', 28003.70, 23521.72, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', '2dd2784e-f215-5ea2-89c7-f03566070492', 25.55, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 64 | apLIS lote 4804 | BRB SAÚDE ("BRB" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3b61049c-1e62-5e72-8620-c0755bea2bbb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '4804', DATE '2026-01-02', DATE '2026-01-02', 'Recebido', 4, '267095', NULL, NULL, NULL, '4804', 17205.36, 40);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('725cd7dc-a69f-5a4e-8a35-e2ceb44c74ca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), NULL, DATE '2026-01-02', DATE '2026-03-03', 17205.36, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 64). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('725cd7dc-a69f-5a4e-8a35-e2ceb44c74ca', '3b61049c-1e62-5e72-8620-c0755bea2bbb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('725cd7dc-a69f-5a4e-8a35-e2ceb44c74ca', '3b61049c-1e62-5e72-8620-c0755bea2bbb', DATE '2026-03-03', DATE '2026-03-06', 17205.36, 17205.36, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 65 | apLIS lote 4811 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1da1fb4b-6cf9-5a5f-81f6-875f1c3bc2f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4811', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '224227389', NULL, NULL, NULL, '4811', 24133.02, 72);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 24133.02, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 65). Responsável: Ana. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2', '1da1fb4b-6cf9-5a5f-81f6-875f1c3bc2f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2', '1da1fb4b-6cf9-5a5f-81f6-875f1c3bc2f0', DATE '2026-02-04', DATE '2026-02-04', 24133.02, 24133.02, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2', '1da1fb4b-6cf9-5a5f-81f6-875f1c3bc2f0', 911.48, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Ana');

-- JANEIRO linha 66 | apLIS lote 4812 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f18a0898-6bb1-5951-9444-f7a80bd80dfc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4812', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '224227440', NULL, NULL, NULL, '4812', 21482.18, 83);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3741e0d5-5976-596a-8ff8-72126795624e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 21482.18, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 66). Responsável: Ana. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3741e0d5-5976-596a-8ff8-72126795624e', 'f18a0898-6bb1-5951-9444-f7a80bd80dfc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3741e0d5-5976-596a-8ff8-72126795624e', 'f18a0898-6bb1-5951-9444-f7a80bd80dfc', DATE '2026-02-04', DATE '2026-02-04', 21482.18, 21482.18, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3741e0d5-5976-596a-8ff8-72126795624e', 'f18a0898-6bb1-5951-9444-f7a80bd80dfc', 455.74, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Ana');

-- JANEIRO linha 67 | apLIS lote 4813 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3ecfc396-39eb-53a2-bddb-1ed2ef62509f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4813', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '224227575', NULL, NULL, NULL, '4813', 22778.25, 72);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 22778.25, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 67). Responsável: Ana. Status original na planilha: No prazo. Refaturamento: Sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', '3ecfc396-39eb-53a2-bddb-1ed2ef62509f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', '3ecfc396-39eb-53a2-bddb-1ed2ef62509f', DATE '2026-02-04', DATE '2026-02-04', 22778.25, 22550.38, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', '3ecfc396-39eb-53a2-bddb-1ed2ef62509f', 227.87, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Ana');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', '3ecfc396-39eb-53a2-bddb-1ed2ef62509f', 683.61, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Ana');

-- JANEIRO linha 68 | apLIS lote 4814 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('04ae20c6-8a41-5c1e-ba29-73cd9fc8da0e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4814', DATE '2026-01-05', DATE '2026-01-05', 'Recebido', 4, '224227601', NULL, NULL, NULL, '4814', 12990.57, 50);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fa10b676-63f5-5c2b-a0cc-16d037a7372c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 12990.57, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 68). Responsável: Ana. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fa10b676-63f5-5c2b-a0cc-16d037a7372c', '04ae20c6-8a41-5c1e-ba29-73cd9fc8da0e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fa10b676-63f5-5c2b-a0cc-16d037a7372c', '04ae20c6-8a41-5c1e-ba29-73cd9fc8da0e', DATE '2026-02-04', DATE '2026-02-04', 12990.57, 12990.57, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 69 | apLIS lote 4815 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64f53310-2102-5930-9d3a-545089b4e99f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4815', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '224227623', NULL, NULL, NULL, '4815', 29816.83, 94);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 29816.83, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 69). Responsável: Ana. Status original na planilha: No prazo. Glosa devida: não.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', '64f53310-2102-5930-9d3a-545089b4e99f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', '64f53310-2102-5930-9d3a-545089b4e99f', DATE '2026-02-04', DATE '2026-02-04', 29816.83, 28449.61, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', '64f53310-2102-5930-9d3a-545089b4e99f', 1367.22, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 70 | apLIS lote 4816 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2ba90b4e-1c75-54d5-b08e-8267116200ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4816', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '224227697', NULL, NULL, NULL, '4816', 12469.52, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-05', DATE '2026-02-04', 12469.52, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 70). Responsável: Ana. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', '2ba90b4e-1c75-54d5-b08e-8267116200ef');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', '2ba90b4e-1c75-54d5-b08e-8267116200ef', DATE '2026-02-04', DATE '2026-02-04', 12469.52, 12469.39, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', '2ba90b4e-1c75-54d5-b08e-8267116200ef', 0.13, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 71 | apLIS lote 4863 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7c9214c3-16fb-5ee2-8b93-83c2688f3e78', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4863', DATE '2026-01-19', DATE '2026-01-19', 'Recebido - parcial', 7, '224557890', NULL, NULL, NULL, '4863', 23785.21, 89);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-19', DATE '2026-02-18', 23785.21, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 71). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', '7c9214c3-16fb-5ee2-8b93-83c2688f3e78');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', '7c9214c3-16fb-5ee2-8b93-83c2688f3e78', DATE '2026-02-18', DATE '2026-03-04', 23785.21, 23557.32, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', '7c9214c3-16fb-5ee2-8b93-83c2688f3e78', 227.89, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 72 | apLIS lote 4865 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('51f6fc3a-9f6e-59ef-9e86-f7dc744329ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4865', DATE '2026-01-19', DATE '2026-01-19', 'Recebido', 4, '224560461', NULL, NULL, NULL, '4865', 2119.20, 11);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4bff4d73-9d9c-5df6-8687-11c6fa64ffd3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-19', DATE '2026-02-18', 2119.20, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 72). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4bff4d73-9d9c-5df6-8687-11c6fa64ffd3', '51f6fc3a-9f6e-59ef-9e86-f7dc744329ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4bff4d73-9d9c-5df6-8687-11c6fa64ffd3', '51f6fc3a-9f6e-59ef-9e86-f7dc744329ed', DATE '2026-02-18', DATE '2026-03-04', 2119.20, 2119.20, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 73 | apLIS lote 4864 | CASSI
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('41742508-466d-521d-896c-8262cf19c510', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4864', DATE '2026-01-19', DATE '2026-01-19', 'Recebido', 4, '224563346', NULL, NULL, NULL, '4864', 3396.18, 12);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2538c9da-59e8-56af-b9d7-f7503e4d1d1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), NULL, DATE '2026-01-19', DATE '2026-02-18', 3396.18, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 73). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2538c9da-59e8-56af-b9d7-f7503e4d1d1d', '41742508-466d-521d-896c-8262cf19c510');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2538c9da-59e8-56af-b9d7-f7503e4d1d1d', '41742508-466d-521d-896c-8262cf19c510', DATE '2026-02-18', DATE '2026-03-04', 3396.18, 3396.18, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 74 | apLIS lote 4929 | CBMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2c1566f7-9b90-5b98-babd-884a2a29b1fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '4929', DATE '2026-01-30', DATE '2026-01-30', 'Recebido', 4, '2601301507247262918', NULL, NULL, NULL, '4929', 695.61, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('37b1a88e-ea4f-55a5-9146-65e9c29eda01', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), NULL, DATE '2026-01-30', DATE '2026-03-01', 695.61, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 74). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('37b1a88e-ea4f-55a5-9146-65e9c29eda01', '2c1566f7-9b90-5b98-babd-884a2a29b1fb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('37b1a88e-ea4f-55a5-9146-65e9c29eda01', '2c1566f7-9b90-5b98-babd-884a2a29b1fb', DATE '2026-03-01', DATE '2026-03-30', 695.61, 659.61, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 75 | apLIS lote 4899 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f7287a76-332f-51ba-ad7d-801a7a2e964b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '4899', DATE '2026-01-26', DATE '2026-01-26', 'Recebido - parcial', 7, '789254', NULL, NULL, NULL, '4899', 17061.30, 53);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-01-28', DATE '2026-03-29', 17061.30, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 75). Responsável: Rivia. Status original na planilha: No prazo. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', 'f7287a76-332f-51ba-ad7d-801a7a2e964b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', 'f7287a76-332f-51ba-ad7d-801a7a2e964b', DATE '2026-03-29', DATE '2026-03-23', 17061.30, 17060.87, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', 'f7287a76-332f-51ba-ad7d-801a7a2e964b', 0.43, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 76 | apLIS lote 4914 | CÂMARA DOS DEPUTADOS ("CAMARA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b5683ff7-a9fc-53a9-aafa-d3671e552e46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '4914', DATE '2026-01-29', DATE '2026-01-29', 'Recebido', 4, '789707', NULL, NULL, NULL, '4914', 7393.90, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fa66f981-2085-5ba0-9f46-73b240251994', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), NULL, DATE '2026-01-29', DATE '2026-03-30', 7393.90, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 76). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fa66f981-2085-5ba0-9f46-73b240251994', 'b5683ff7-a9fc-53a9-aafa-d3671e552e46');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fa66f981-2085-5ba0-9f46-73b240251994', 'b5683ff7-a9fc-53a9-aafa-d3671e552e46', DATE '2026-03-30', DATE '2026-03-23', 7393.90, 7393.90, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 77 | apLIS lote 4821 | E-VIDA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d9f146c9-b540-5b92-b2a4-c3f4f061c94b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '4821', DATE '2026-01-06', DATE '2026-01-07', 'Recebido - parcial', 7, '639235', NULL, NULL, NULL, '4821', 3080.67, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), NULL, DATE '2026-01-07', DATE '2026-02-11', 3080.67, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 77). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', 'd9f146c9-b540-5b92-b2a4-c3f4f061c94b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', 'd9f146c9-b540-5b92-b2a4-c3f4f061c94b', DATE '2026-02-11', DATE '2026-03-13', 3080.67, 2778.46, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', 'd9f146c9-b540-5b92-b2a4-c3f4f061c94b', 302.21, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 78 | apLIS lote 4625 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('20a1cb21-f896-5214-886a-82f0911f2b3b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '4625', DATE '2025-11-11', DATE '2026-01-02', 'Recebido', 4, '130204', NULL, NULL, NULL, '4625', 774.89, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df8b0d14-3289-5b2d-bba1-71100127e738', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-01-02', DATE '2026-01-30', 774.89, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 78). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df8b0d14-3289-5b2d-bba1-71100127e738', '20a1cb21-f896-5214-886a-82f0911f2b3b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('df8b0d14-3289-5b2d-bba1-71100127e738', '20a1cb21-f896-5214-886a-82f0911f2b3b', DATE '2026-01-30', DATE '2026-05-22', 774.89, 774.89, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 80 | apLIS lote 4728 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1e5cdaf-05f1-5a23-a480-cebd088e5c25', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '4728', DATE '2025-12-11', DATE '2026-01-02', 'Recebido - parcial', 7, '130187', NULL, NULL, NULL, '4728', 13792.72, 52);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0a263432-9246-57a7-b833-22692f550517', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-01-02', DATE '2026-01-30', 13792.72, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 80). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0a263432-9246-57a7-b833-22692f550517', 'b1e5cdaf-05f1-5a23-a480-cebd088e5c25');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0a263432-9246-57a7-b833-22692f550517', 'b1e5cdaf-05f1-5a23-a480-cebd088e5c25', DATE '2026-01-30', DATE '2026-05-22', 13792.72, 10333.97, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('0a263432-9246-57a7-b833-22692f550517', 'b1e5cdaf-05f1-5a23-a480-cebd088e5c25', 3011.66, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 81 | apLIS lote 4729 | FASCAL
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dadaafd6-e963-5a5f-a9fa-9a72692241d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '4729', DATE '2025-12-12', DATE '2026-01-02', 'Faturado', 3, '130206', NULL, NULL, NULL, '4729', 5348.65, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6d677709-d5c6-56d9-8e99-d80bae8a102f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), NULL, DATE '2026-01-02', DATE '2026-01-30', 5348.65, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 81). Responsável: Rivia. Status original na planilha: Vencido. Refaturamento: GLOSA TOTAL -REFATURADO. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6d677709-d5c6-56d9-8e99-d80bae8a102f', 'dadaafd6-e963-5a5f-a9fa-9a72692241d2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6d677709-d5c6-56d9-8e99-d80bae8a102f', 'dadaafd6-e963-5a5f-a9fa-9a72692241d2', DATE '2026-01-30', 5348.65, 'previsto', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6d677709-d5c6-56d9-8e99-d80bae8a102f', 'dadaafd6-e963-5a5f-a9fa-9a72692241d2', 5348.65, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Rivia');

-- JANEIRO linha 82 | apLIS lote 4805 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a4db142a-a640-5dc9-803d-daac3f555d1f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '4805', DATE '2026-01-02', DATE '2026-01-16', 'Recebido', 4, '20260102141551', NULL, NULL, NULL, '4805', 234.06, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('01915c99-3f9f-50e1-b19a-9e5be8cb42cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-01-02', DATE '2026-03-03', 234.06, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 82). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('01915c99-3f9f-50e1-b19a-9e5be8cb42cd', 'a4db142a-a640-5dc9-803d-daac3f555d1f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('01915c99-3f9f-50e1-b19a-9e5be8cb42cd', 'a4db142a-a640-5dc9-803d-daac3f555d1f', DATE '2026-03-03', DATE '2026-03-19', 234.06, 234.06, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 83 | apLIS lote 4857 | FUSEX
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8e44cbc1-af7a-5b22-807d-dfa04912f53e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '4857', DATE '2026-01-16', DATE '2026-01-21', 'Recebido', 4, '20260116114532', NULL, NULL, NULL, '4857', 279.06, 2);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('abc42ce7-3c59-5263-80cc-004f478be154', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), NULL, DATE '2026-01-16', DATE '2026-03-17', 279.06, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 83). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('abc42ce7-3c59-5263-80cc-004f478be154', '8e44cbc1-af7a-5b22-807d-dfa04912f53e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('abc42ce7-3c59-5263-80cc-004f478be154', '8e44cbc1-af7a-5b22-807d-dfa04912f53e', DATE '2026-03-17', DATE '2026-04-01', 279.06, 279.06, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 84 | apLIS lote 4829 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1db8414d-5f16-5565-ba01-5ce9163f3086', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4829', DATE '2026-01-07', DATE '2026-01-08', 'Recebido', 4, '120545530', NULL, NULL, NULL, '4829', 8576.35, 32);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-01-08', DATE '2026-04-08', 8576.35, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 84). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1', '1db8414d-5f16-5565-ba01-5ce9163f3086');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1', '1db8414d-5f16-5565-ba01-5ce9163f3086', DATE '2026-04-08', DATE '2026-04-23', 8576.35, 8333.60, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1', '1db8414d-5f16-5565-ba01-5ce9163f3086', 242.75, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 85 | apLIS lote 4830 | GEAP Autogestão em Saúde ("GEAP" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0c6ba73a-1b37-5d44-a6c0-6ae7ea55a883', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4830', DATE '2026-01-07', DATE '2026-01-09', 'Recebido - parcial', 7, '121078607', NULL, NULL, NULL, '4830', 2393.71, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), NULL, DATE '2026-01-09', DATE '2026-04-09', 2393.71, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 85). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c', '0c6ba73a-1b37-5d44-a6c0-6ae7ea55a883');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c', '0c6ba73a-1b37-5d44-a6c0-6ae7ea55a883', DATE '2026-04-09', DATE '2026-04-23', 2393.71, 1416.76, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c', '0c6ba73a-1b37-5d44-a6c0-6ae7ea55a883', 434.20, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 86 | apLIS lote 4822 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('edd1167e-d9c1-534e-b352-612bb524b879', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4822', DATE '2026-01-07', DATE '2026-01-07', 'Recebido', 4, '139594', NULL, NULL, NULL, '4822', 5463.92, 24);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-07', DATE '2026-02-06', 5463.92, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 86). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', 'edd1167e-d9c1-534e-b352-612bb524b879');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', 'edd1167e-d9c1-534e-b352-612bb524b879', DATE '2026-02-06', DATE '2026-06-25', 5463.92, 5461.41, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', 'edd1167e-d9c1-534e-b352-612bb524b879', 2.51, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 87 | apLIS lote 4824 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c320ff15-c2a2-5951-ae37-3103c9b250de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4824', DATE '2026-01-07', DATE '2026-01-07', 'Faturado', 3, '139630', NULL, NULL, NULL, '4824', 3999.83, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-07', DATE '2026-02-06', 3999.83, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 87). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', 'c320ff15-c2a2-5951-ae37-3103c9b250de');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', 'c320ff15-c2a2-5951-ae37-3103c9b250de', DATE '2026-02-06', DATE '2026-06-25', 3999.83, 3989.83, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', 'c320ff15-c2a2-5951-ae37-3103c9b250de', 10.00, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 88 | apLIS lote 4859 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('af2e7561-5e90-573a-bacb-bc053f223f44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4859', DATE '2026-01-16', DATE '2026-01-21', 'Faturado', 3, '143255', NULL, NULL, NULL, '4859', 4233.15, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-21', DATE '2026-02-20', 4233.15, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 88). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', 'af2e7561-5e90-573a-bacb-bc053f223f44');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', 'af2e7561-5e90-573a-bacb-bc053f223f44', DATE '2026-02-20', DATE '2026-06-25', 4233.15, 4181.64, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', 'af2e7561-5e90-573a-bacb-bc053f223f44', 51.51, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 89 | apLIS lote 4792 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f2134e57-f36e-51c0-9c72-5741bbffb49d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4792', DATE '2025-12-30', DATE '2026-01-21', 'Recebido', 4, '143290', NULL, NULL, NULL, '4792', 4901.71, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('28cac9e8-573d-5be7-acd4-a9456899aba8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-21', DATE '2026-02-20', 4901.71, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 89). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('28cac9e8-573d-5be7-acd4-a9456899aba8', 'f2134e57-f36e-51c0-9c72-5741bbffb49d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('28cac9e8-573d-5be7-acd4-a9456899aba8', 'f2134e57-f36e-51c0-9c72-5741bbffb49d', DATE '2026-02-20', DATE '2026-06-25', 4901.71, 4901.71, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 90 | apLIS lote 4823 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd807fea-f41b-551d-b4f6-8ae56f805cec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4823', DATE '2026-01-07', DATE '2026-01-21', 'Faturado', 3, '143399', NULL, NULL, NULL, '4823', 21953.26, 90);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87c2e465-5df6-53cf-a8f6-f8d3ca426920', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-21', DATE '2026-02-20', 21953.26, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 90). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87c2e465-5df6-53cf-a8f6-f8d3ca426920', 'cd807fea-f41b-551d-b4f6-8ae56f805cec');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('87c2e465-5df6-53cf-a8f6-f8d3ca426920', 'cd807fea-f41b-551d-b4f6-8ae56f805cec', DATE '2026-02-20', DATE '2026-06-25', 21953.26, 21953.26, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 91 | apLIS lote 4930 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0a795b57-b180-5431-b771-b8e74ab2894f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4930', DATE '2026-01-30', DATE '2026-01-30', 'Recebido', 4, 'PEG147102', NULL, NULL, NULL, '4930', 6115.40, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('29ddbe47-1404-514f-8797-da27e9e5c519', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-30', DATE '2026-03-01', 6115.40, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 91). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('29ddbe47-1404-514f-8797-da27e9e5c519', '0a795b57-b180-5431-b771-b8e74ab2894f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('29ddbe47-1404-514f-8797-da27e9e5c519', '0a795b57-b180-5431-b771-b8e74ab2894f', DATE '2026-03-01', DATE '2026-06-25', 6115.40, 6115.40, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 92 | apLIS lote 4922 | INAS GDF ("INAS-GDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0f70679c-9fa0-5c40-9c77-355dd67776ec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '4922', DATE '2026-01-29', DATE '2026-01-30', 'Faturado', 3, 'PEG147187', NULL, NULL, NULL, '4922', 19150.85, 78);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), NULL, DATE '2026-01-30', DATE '2026-03-01', 19150.85, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 92). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', '0f70679c-9fa0-5c40-9c77-355dd67776ec');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', '0f70679c-9fa0-5c40-9c77-355dd67776ec', DATE '2026-03-01', DATE '2026-06-25', 19150.85, 19117.52, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', '0f70679c-9fa0-5c40-9c77-355dd67776ec', 33.33, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 93 | apLIS lote 4750 | POLÍCIA FEDERAL ("PF SAUDE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('43cb1581-59df-538a-a049-0b2b90eb6b77', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '4750', DATE '2025-12-18', DATE '2026-01-02', 'Recebido', 4, '32643', NULL, NULL, NULL, '4750', 7615.04, 29);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('903fd196-f174-5d18-99cf-0b9712a8e10b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), NULL, DATE '2026-01-02', DATE '2026-02-28', 7615.04, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 93). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('903fd196-f174-5d18-99cf-0b9712a8e10b', '43cb1581-59df-538a-a049-0b2b90eb6b77');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('903fd196-f174-5d18-99cf-0b9712a8e10b', '43cb1581-59df-538a-a049-0b2b90eb6b77', DATE '2026-02-28', DATE '2026-05-01', 7615.04, 7615.04, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 97 | apLIS lote 4894 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('96085706-c994-51aa-9bfc-2b4225ca5cfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4894', DATE '2026-01-26', DATE '2026-01-28', 'Recebido', 4, 'PEG4894', NULL, NULL, NULL, '4894', 137.64, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('97b62eaf-3692-548e-a3e8-9762d8fba5dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-01-28', DATE '2026-02-27', 137.64, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 97). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('97b62eaf-3692-548e-a3e8-9762d8fba5dd', '96085706-c994-51aa-9bfc-2b4225ca5cfa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('97b62eaf-3692-548e-a3e8-9762d8fba5dd', '96085706-c994-51aa-9bfc-2b4225ca5cfa', DATE '2026-02-27', DATE '2026-04-10', 137.64, 137.67, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 98 | apLIS lote 4897 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('49d070df-ec68-55e5-b459-73e8ab4c85fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4897', DATE '2026-01-26', DATE '2026-01-28', 'Recebido', 4, 'PEG425871', NULL, NULL, NULL, '4897', 6634.92, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('85cb1306-12d8-5670-b5d8-9e908dfd59ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-01-28', DATE '2026-02-27', 6634.92, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 98). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('85cb1306-12d8-5670-b5d8-9e908dfd59ad', '49d070df-ec68-55e5-b459-73e8ab4c85fd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('85cb1306-12d8-5670-b5d8-9e908dfd59ad', '49d070df-ec68-55e5-b459-73e8ab4c85fd', DATE '2026-02-27', DATE '2026-04-10', 6634.92, 6634.92, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 99 | apLIS lote 4901 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c1b87423-301f-580c-9a22-c45ac84f0d85', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4901', DATE '2026-01-27', DATE '2026-01-28', 'Recebido', 4, 'PEG425886', NULL, NULL, NULL, '4901', 15336.11, 42);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ac9221e9-efe2-5433-a1eb-96e94d467807', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-01-28', DATE '2026-02-27', 15336.11, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 99). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ac9221e9-efe2-5433-a1eb-96e94d467807', 'c1b87423-301f-580c-9a22-c45ac84f0d85');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ac9221e9-efe2-5433-a1eb-96e94d467807', 'c1b87423-301f-580c-9a22-c45ac84f0d85', DATE '2026-02-27', DATE '2026-04-10', 15336.11, 15336.11, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 100 | apLIS lote 4896 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4eafaff6-86b4-592e-84d3-074fd03f6587', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4896', DATE '2026-01-26', DATE '2026-01-28', 'Recebido', 4, 'PEG425912', NULL, NULL, NULL, '4896', 29933.11, 96);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6006410a-b375-56fa-99cb-7a7003e9413b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-01-28', DATE '2026-02-27', 29933.11, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 100). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6006410a-b375-56fa-99cb-7a7003e9413b', '4eafaff6-86b4-592e-84d3-074fd03f6587');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6006410a-b375-56fa-99cb-7a7003e9413b', '4eafaff6-86b4-592e-84d3-074fd03f6587', DATE '2026-02-27', DATE '2026-04-10', 29933.11, 29933.11, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 101 | apLIS lote 4895 | PMDF
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('efda57e0-0d9e-57e4-a1d8-77ecbdbc1fdb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4895', DATE '2026-01-26', DATE '2026-01-28', 'Recebido', 4, 'PEG425941', NULL, NULL, NULL, '4895', 29562.16, 98);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b49883d0-9219-5585-bc75-af2588744bd2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), NULL, DATE '2026-01-28', DATE '2026-02-27', 29562.16, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 101). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b49883d0-9219-5585-bc75-af2588744bd2', 'efda57e0-0d9e-57e4-a1d8-77ecbdbc1fdb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b49883d0-9219-5585-bc75-af2588744bd2', 'efda57e0-0d9e-57e4-a1d8-77ecbdbc1fdb', DATE '2026-02-27', DATE '2026-04-10', 29562.16, 29562.16, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 103 | apLIS lote 4831 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c593052-e488-51e8-9590-0e07216be492', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '4831', DATE '2026-01-09', DATE '2026-01-12', 'Recebido', 4, '13264', NULL, NULL, NULL, '4831', 17678.41, 35);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9c7b5585-4b63-54f5-8119-8b4007665e00', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-01-12', DATE '2026-02-11', 17678.41, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 103). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9c7b5585-4b63-54f5-8119-8b4007665e00', '6c593052-e488-51e8-9590-0e07216be492');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9c7b5585-4b63-54f5-8119-8b4007665e00', '6c593052-e488-51e8-9590-0e07216be492', DATE '2026-02-11', DATE '2026-03-12', 17678.41, 17678.41, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 104 | apLIS lote 4832 | LAB PLANASSISTE ("PLAN ASSISTE" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c029e14a-a77e-577e-a4b1-48bb02eef826', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '4832', DATE '2026-01-09', DATE '2026-01-12', 'Recebido', 4, '13481', NULL, NULL, NULL, '4832', 879.23, 3);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f68a69ad-c85c-5c48-b9db-be9cebc63a55', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), NULL, DATE '2026-01-12', DATE '2026-02-11', 879.23, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 104). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f68a69ad-c85c-5c48-b9db-be9cebc63a55', 'c029e14a-a77e-577e-a4b1-48bb02eef826');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('f68a69ad-c85c-5c48-b9db-be9cebc63a55', 'c029e14a-a77e-577e-a4b1-48bb02eef826', DATE '2026-02-11', DATE '2026-03-12', 879.23, 879.23, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 105 | apLIS lote 4875 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('934421d2-c427-539f-9a5a-97ffecf59f48', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '4875', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, '203125', NULL, NULL, NULL, '4875', 1974.65, 7);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('55f32c7a-b45c-588c-9312-d7c823f09b12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-01-23', DATE '2026-03-24', 1974.65, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 105). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('55f32c7a-b45c-588c-9312-d7c823f09b12', '934421d2-c427-539f-9a5a-97ffecf59f48');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('55f32c7a-b45c-588c-9312-d7c823f09b12', '934421d2-c427-539f-9a5a-97ffecf59f48', DATE '2026-03-24', DATE '2026-03-31', 1974.65, 1974.65, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 106 | apLIS lote 4883 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9d62aba9-007d-500e-8bab-3e70fb3c04d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '4883', DATE '2026-01-23', DATE '2026-01-23', 'Recebido', 4, '203154', NULL, NULL, NULL, '4883', 9738.52, 45);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c12b5b04-64fa-5e30-882a-ee4f2921644c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-01-23', DATE '2026-03-24', 9738.52, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 106). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c12b5b04-64fa-5e30-882a-ee4f2921644c', '9d62aba9-007d-500e-8bab-3e70fb3c04d1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c12b5b04-64fa-5e30-882a-ee4f2921644c', '9d62aba9-007d-500e-8bab-3e70fb3c04d1', DATE '2026-03-24', DATE '2026-03-31', 9738.52, 9172.46, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('c12b5b04-64fa-5e30-882a-ee4f2921644c', '9d62aba9-007d-500e-8bab-3e70fb3c04d1', 566.06, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 107 | apLIS lote 4923 | SIS SENADO
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('02aa38ec-d6f5-5302-9fce-090a20858e0b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '4923', DATE '2026-01-30', DATE '2026-01-30', 'Recebido - parcial', 7, '204112', NULL, NULL, NULL, '4923', 5546.90, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), NULL, DATE '2026-01-23', DATE '2026-03-24', 5546.90, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 107). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', '02aa38ec-d6f5-5302-9fce-090a20858e0b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', '02aa38ec-d6f5-5302-9fce-090a20858e0b', DATE '2026-03-24', DATE '2026-03-31', 5546.90, 2561.63, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', '02aa38ec-d6f5-5302-9fce-090a20858e0b', 2985.27, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 108 | apLIS lote 4789 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('378050d0-169a-54bf-8986-707dcef81204', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4789', DATE '2025-12-30', DATE '2025-12-31', 'Recebido', 4, '7110131', NULL, NULL, NULL, '4789', 31194.34, 89);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-02', DATE '2026-02-01', 31194.34, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 108). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', '378050d0-169a-54bf-8986-707dcef81204');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', '378050d0-169a-54bf-8986-707dcef81204', DATE '2026-02-01', DATE '2026-06-22', 31194.34, 31194.34, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', '378050d0-169a-54bf-8986-707dcef81204', 350.92, 'Glosa recuperada (backfill planilha Jan-Jun/2026 — recebido + glosa passam do valor enviado)', 'revertida', 'Rivia');

-- JANEIRO linha 109 | apLIS lote 4903 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e80bde06-46ef-5811-940a-093b1dfbb290', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4903', DATE '2026-01-27', DATE '2026-01-28', 'Recebido', 4, '7157010', NULL, NULL, NULL, '4903', 8240.98, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ea4f9de-a142-5685-b4f5-868f9a506731', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-28', DATE '2026-02-27', 8240.98, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 109). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ea4f9de-a142-5685-b4f5-868f9a506731', 'e80bde06-46ef-5811-940a-093b1dfbb290');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6ea4f9de-a142-5685-b4f5-868f9a506731', 'e80bde06-46ef-5811-940a-093b1dfbb290', DATE '2026-02-27', DATE '2026-04-17', 8240.98, 8240.98, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 110 | apLIS lote 4904 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1b5a8675-7f22-5b0c-bbad-7198a8321324', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4904', DATE '2026-01-27', DATE '2026-01-28', 'Recebido', 4, '7157732', NULL, NULL, NULL, '4904', 29302.22, 100);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0ced36d4-3eb2-5fa9-bab6-fd02c21727a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-28', DATE '2026-02-27', 29302.22, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 110). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0ced36d4-3eb2-5fa9-bab6-fd02c21727a8', '1b5a8675-7f22-5b0c-bbad-7198a8321324');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0ced36d4-3eb2-5fa9-bab6-fd02c21727a8', '1b5a8675-7f22-5b0c-bbad-7198a8321324', DATE '2026-02-27', DATE '2026-04-17', 29302.22, 29302.22, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 111 | apLIS lote 4910 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('edadb6a7-0490-5962-b381-b4a57fc1d4b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4910', DATE '2026-01-28', DATE '2026-01-28', 'Recebido', 4, '7158473', NULL, NULL, NULL, '4910', 6420.39, 20);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ee67b4cb-1daf-5621-9281-5c0688a87aa5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-28', DATE '2026-02-27', 6420.39, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 111). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ee67b4cb-1daf-5621-9281-5c0688a87aa5', 'edadb6a7-0490-5962-b381-b4a57fc1d4b9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ee67b4cb-1daf-5621-9281-5c0688a87aa5', 'edadb6a7-0490-5962-b381-b4a57fc1d4b9', DATE '2026-02-27', DATE '2026-04-17', 6420.39, 6420.39, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 112 | apLIS lote 4915 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a4935d73-9e77-538f-9f05-3f09e30078b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4915', DATE '2026-01-29', DATE '2026-01-29', 'Recebido', 4, '7159929', NULL, NULL, NULL, '4915', 2466.01, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21fa3626-5fe2-5c99-93e8-1745539f7e1c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-29', DATE '2026-02-28', 2466.01, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 112). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21fa3626-5fe2-5c99-93e8-1745539f7e1c', 'a4935d73-9e77-538f-9f05-3f09e30078b4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('21fa3626-5fe2-5c99-93e8-1745539f7e1c', 'a4935d73-9e77-538f-9f05-3f09e30078b4', DATE '2026-02-28', DATE '2026-04-17', 2466.01, 2466.01, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 113 | apLIS lote 4927 | SAUDE CAIXA
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2c01fad8-76cc-5dd3-b153-bde7de1f8b39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4927', DATE '2026-01-30', DATE '2026-01-30', 'Recebido', 4, '7163304', NULL, NULL, NULL, '4927', 8752.41, 22);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d41d23c-ab57-5b34-9b0c-a9552d813c02', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), NULL, DATE '2026-01-30', DATE '2026-03-01', 8752.41, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 113). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d41d23c-ab57-5b34-9b0c-a9552d813c02', '2c01fad8-76cc-5dd3-b153-bde7de1f8b39');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7d41d23c-ab57-5b34-9b0c-a9552d813c02', '2c01fad8-76cc-5dd3-b153-bde7de1f8b39', DATE '2026-03-01', DATE '2026-04-17', 8752.41, 8752.41, 'recebido', 'Rivia', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 114 | apLIS lote 4926 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ab436651-ba87-56a4-9471-6e90be4ccdfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4926', DATE '2026-01-30', DATE '2026-01-30', 'Recebido - parcial', 7, 'PEG260130014639', NULL, NULL, NULL, '4926', 3208.59, 15);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-30', DATE '2026-03-06', 3208.59, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 114). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', 'ab436651-ba87-56a4-9471-6e90be4ccdfa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', 'ab436651-ba87-56a4-9471-6e90be4ccdfa', DATE '2026-03-06', DATE '2026-03-17', 3208.59, 2243.19, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', 'ab436651-ba87-56a4-9471-6e90be4ccdfa', 588.36, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 115 | apLIS lote 4460 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('685e2135-490d-52db-9818-7b9aa81f8f32', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4460', DATE '2025-09-29', DATE '2026-01-05', 'Recebido', 4, '260105000063', '9199', 9182, DATE '2026-09-14', '4460', 7277.62, 33);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4590ad4d-0ed7-542a-9fe1-888952f33f94', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '9199', DATE '2026-01-05', DATE '2026-02-09', 7277.62, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 115). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4590ad4d-0ed7-542a-9fe1-888952f33f94', '685e2135-490d-52db-9818-7b9aa81f8f32');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4590ad4d-0ed7-542a-9fe1-888952f33f94', '685e2135-490d-52db-9818-7b9aa81f8f32', DATE '2026-02-09', DATE '2026-02-19', 7277.62, 5778.45, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('4590ad4d-0ed7-542a-9fe1-888952f33f94', '685e2135-490d-52db-9818-7b9aa81f8f32', 1499.17, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 116 | apLIS lote 4786 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d0309a90-15da-59e5-8173-f76b56864f53', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4786', DATE '2025-12-30', DATE '2026-01-30', 'Recebido - parcial', 7, '260105000214', NULL, NULL, NULL, '4786', 17916.91, 92);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-05', DATE '2026-02-09', 17916.91, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 116). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', 'd0309a90-15da-59e5-8173-f76b56864f53');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', 'd0309a90-15da-59e5-8173-f76b56864f53', DATE '2026-02-09', DATE '2026-02-19', 17916.91, 14675.33, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', 'd0309a90-15da-59e5-8173-f76b56864f53', 1941.06, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 117 | apLIS lote 4787 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e1865597-b1da-53ed-bf0e-81de7123e264', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4787', DATE '2025-12-30', DATE '2026-01-05', 'Recebido', 4, '260105000439', NULL, NULL, NULL, '4787', 13484.27, 74);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('61f6a84d-d402-593f-9979-553449bb1096', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-05', DATE '2026-02-09', 13484.27, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 117). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', 'e1865597-b1da-53ed-bf0e-81de7123e264');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('61f6a84d-d402-593f-9979-553449bb1096', 'e1865597-b1da-53ed-bf0e-81de7123e264', DATE '2026-02-09', DATE '2026-02-19', 13484.27, 11020.42, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('61f6a84d-d402-593f-9979-553449bb1096', 'e1865597-b1da-53ed-bf0e-81de7123e264', 1540.37, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 118 | apLIS lote 4788 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('635a53dd-80b4-5c2f-8708-2983469236e8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4788', DATE '2025-12-30', DATE '2026-01-05', 'Recebido - parcial', 7, '260105001151', NULL, NULL, NULL, '4788', 17424.07, 88);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-05', DATE '2026-02-09', 17424.07, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 118). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', '635a53dd-80b4-5c2f-8708-2983469236e8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', '635a53dd-80b4-5c2f-8708-2983469236e8', DATE '2026-02-09', DATE '2026-02-19', 17424.07, 13303.49, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', '635a53dd-80b4-5c2f-8708-2983469236e8', 2006.30, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 119 | apLIS lote 4671 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0bd0e0dc-0260-5bfa-8fc8-2148285ab156', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4671', DATE '2025-11-27', DATE '2026-01-05', 'Recebido', 4, '260105001219', '9200', 9183, DATE '2026-09-14', '4671', 5201.65, 28);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('86344a95-3405-5b15-917e-1f03cfd8bea9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '9200', DATE '2026-01-05', DATE '2026-02-09', 5201.65, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 119). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('86344a95-3405-5b15-917e-1f03cfd8bea9', '0bd0e0dc-0260-5bfa-8fc8-2148285ab156');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('86344a95-3405-5b15-917e-1f03cfd8bea9', '0bd0e0dc-0260-5bfa-8fc8-2148285ab156', DATE '2026-02-09', DATE '2026-02-19', 5201.65, 2131.15, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('86344a95-3405-5b15-917e-1f03cfd8bea9', '0bd0e0dc-0260-5bfa-8fc8-2148285ab156', 2114.85, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 120 | apLIS lote 4916 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a217e46b-3ab1-5301-93a0-4482e2df728d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4916', DATE '2026-01-29', DATE '2026-01-30', 'Recebido - parcial', 7, '260130004353', NULL, NULL, NULL, '4916', 649.58, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-30', DATE '2026-03-06', 649.58, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 120). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', 'a217e46b-3ab1-5301-93a0-4482e2df728d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', 'a217e46b-3ab1-5301-93a0-4482e2df728d', DATE '2026-03-06', DATE '2026-02-19', 649.58, 267.32, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', 'a217e46b-3ab1-5301-93a0-4482e2df728d', 211.32, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 121 | apLIS lote 4917 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4e4c7e59-366f-5e4f-bce9-c9f050f45684', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4917', DATE '2026-01-29', DATE '2026-01-30', 'Faturado', 3, '260130006321', '8956', 8936, DATE '2026-08-10', '4917', 18124.53, 99);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '8956', DATE '2026-01-30', DATE '2026-03-06', 18124.53, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 121). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef', '4e4c7e59-366f-5e4f-bce9-c9f050f45684');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef', '4e4c7e59-366f-5e4f-bce9-c9f050f45684', DATE '2026-03-06', DATE '2026-03-17', 18124.53, 13699.69, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef', '4e4c7e59-366f-5e4f-bce9-c9f050f45684', 2327.89, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 123 | apLIS lote 4920 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5695ff1a-3f7f-5ca3-871b-a23f80cd4c49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4920', DATE '2026-01-29', DATE '2026-01-30', 'Recebido - parcial', 7, 'PEG260130010224', NULL, NULL, NULL, '4920', 2674.48, 14);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-30', DATE '2026-03-06', 2674.48, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 123). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', '5695ff1a-3f7f-5ca3-871b-a23f80cd4c49');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', '5695ff1a-3f7f-5ca3-871b-a23f80cd4c49', DATE '2026-03-06', DATE '2026-03-17', 2674.48, 2374.92, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', '5695ff1a-3f7f-5ca3-871b-a23f80cd4c49', 299.56, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Raquel');

-- JANEIRO linha 124 | apLIS lote 4919 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE ("SUL AMERICA" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5878e82d-5d5c-597a-b8b9-07b2438d43dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '4919', DATE '2026-01-29', DATE '2026-01-30', 'Recebido', 4, '260130011103', NULL, NULL, NULL, '4919', 13649.56, 70);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), NULL, DATE '2026-01-30', DATE '2026-03-06', 13649.56, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 124). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', '5878e82d-5d5c-597a-b8b9-07b2438d43dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', '5878e82d-5d5c-597a-b8b9-07b2438d43dc', DATE '2026-03-06', DATE '2026-03-17', 13649.56, 10379.14, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', '5878e82d-5d5c-597a-b8b9-07b2438d43dc', 1173.47, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 125 | apLIS lote 4837 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f63fb006-de87-5355-8018-f02ac8005159', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '4837', DATE '2026-01-12', DATE '2026-01-14', 'Recebido', 4, '460853', NULL, NULL, NULL, '4837', 13358.59, 46);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6311f015-495e-5ada-852d-f4f6244cba97', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-01-14', DATE '2026-02-13', 13358.59, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 125). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6311f015-495e-5ada-852d-f4f6244cba97', 'f63fb006-de87-5355-8018-f02ac8005159');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6311f015-495e-5ada-852d-f4f6244cba97', 'f63fb006-de87-5355-8018-f02ac8005159', DATE '2026-02-13', DATE '2026-04-16', 13358.59, 13358.59, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 126 | apLIS lote 4838 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fcfed428-5f17-5532-b5af-07393dec4058', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '4838', DATE '2026-01-12', DATE '2026-01-14', 'Recebido', 4, '460856', NULL, NULL, NULL, '4838', 16783.69, 48);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-01-14', DATE '2026-02-13', 16783.69, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 126). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', 'fcfed428-5f17-5532-b5af-07393dec4058');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', 'fcfed428-5f17-5532-b5af-07393dec4058', DATE '2026-02-13', DATE '2026-04-16', 16783.69, 16539.49, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', 'fcfed428-5f17-5532-b5af-07393dec4058', 244.20, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 127 | apLIS lote 4844 | TJDFT ("TJDF" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('40e463eb-626f-538f-90da-66542e2b8729', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '4844', DATE '2026-01-14', DATE '2026-01-14', 'Faturado', 3, '461082', NULL, NULL, NULL, '4844', 4704.91, 13);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('be14f0a7-343e-5af1-be37-386e44839d3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), NULL, DATE '2026-01-14', DATE '2026-02-13', 4704.91, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 127). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('be14f0a7-343e-5af1-be37-386e44839d3a', '40e463eb-626f-538f-90da-66542e2b8729');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('be14f0a7-343e-5af1-be37-386e44839d3a', '40e463eb-626f-538f-90da-66542e2b8729', DATE '2026-02-13', DATE '2026-04-19', 4704.91, 3704.18, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('be14f0a7-343e-5af1-be37-386e44839d3a', '40e463eb-626f-538f-90da-66542e2b8729', 1000.73, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 128 | apLIS lote 4806 | STF ("STF-MED" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9f3af33f-3bd5-5c31-95a6-7a5a1135600e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '4806', DATE '2026-01-02', DATE '2026-01-05', 'Recebido', 4, '221319', NULL, NULL, NULL, '4806', 9503.13, 23);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d4cf35d7-80f6-5ef5-9197-201a69c3072f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), NULL, DATE '2026-01-12', DATE '2026-02-24', 9503.13, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 128). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d4cf35d7-80f6-5ef5-9197-201a69c3072f', '9f3af33f-3bd5-5c31-95a6-7a5a1135600e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d4cf35d7-80f6-5ef5-9197-201a69c3072f', '9f3af33f-3bd5-5c31-95a6-7a5a1135600e', DATE '2026-02-24', DATE '2026-03-26', 9503.13, 9503.13, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 129 | apLIS lote 4868 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('25b47e35-9e92-55f3-91a1-32039d43daf2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4868', DATE '2026-01-21', DATE '2026-01-22', 'Recebido', 4, '9349601', NULL, NULL, NULL, '4868', 3653.23, 8);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('51ddf83a-2ec1-584c-a72b-a63e80639cff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-01-22', DATE '2026-02-13', 3653.23, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 129). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('51ddf83a-2ec1-584c-a72b-a63e80639cff', '25b47e35-9e92-55f3-91a1-32039d43daf2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('51ddf83a-2ec1-584c-a72b-a63e80639cff', '25b47e35-9e92-55f3-91a1-32039d43daf2', DATE '2026-02-13', DATE '2026-03-17', 3653.23, 3653.23, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 130 | apLIS lote 4870 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('221ec1b5-b3b9-5d46-9a72-e17368cb05c4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4870', DATE '2026-01-21', DATE '2026-01-22', 'Recebido - parcial', 7, '9349917', NULL, NULL, NULL, '4870', 11846.54, 26);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('565b3271-fb3c-58a3-9a72-bc4e037b531a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-01-22', DATE '2026-02-13', 11846.54, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 130). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('565b3271-fb3c-58a3-9a72-bc4e037b531a', '221ec1b5-b3b9-5d46-9a72-e17368cb05c4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('565b3271-fb3c-58a3-9a72-bc4e037b531a', '221ec1b5-b3b9-5d46-9a72-e17368cb05c4', DATE '2026-02-13', DATE '2026-03-17', 11846.54, 9921.68, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('565b3271-fb3c-58a3-9a72-bc4e037b531a', '221ec1b5-b3b9-5d46-9a72-e17368cb05c4', 1924.86, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- JANEIRO linha 131 | apLIS lote 4869 | STJ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8400db37-4d87-5f28-b866-97c44dc119d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4869', DATE '2026-01-21', DATE '2026-01-22', 'Recebido', 4, '9350193', NULL, NULL, NULL, '4869', 30146.93, 66);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('328f847a-228b-550e-8353-44328642b564', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), NULL, DATE '2026-01-22', DATE '2026-02-13', 30146.93, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 131). Responsável: Raquel. Status original na planilha: Vencido. Refaturamento: sim. Glosa devida: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('328f847a-228b-550e-8353-44328642b564', '8400db37-4d87-5f28-b866-97c44dc119d4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('328f847a-228b-550e-8353-44328642b564', '8400db37-4d87-5f28-b866-97c44dc119d4', DATE '2026-02-13', DATE '2026-03-17', 30146.93, 25671.51, 'parcial', 'Raquel', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('328f847a-228b-550e-8353-44328642b564', '8400db37-4d87-5f28-b866-97c44dc119d4', 4475.42, 'Glosa refaturada em outro lote (backfill planilha Jan-Jun/2026)', 'definitiva', 'Raquel');

-- JANEIRO linha 132 | apLIS lote 4807 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ec59a625-72ef-51f7-aa2a-6c6de60a19b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4807', DATE '2026-01-02', DATE '2026-01-05', 'Recebido', 4, '58629', NULL, NULL, NULL, '4807', 717.53, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a1508b7d-ca96-5380-bd2f-f23847727865', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-01-05', DATE '2026-02-04', 717.53, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 132). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a1508b7d-ca96-5380-bd2f-f23847727865', 'ec59a625-72ef-51f7-aa2a-6c6de60a19b4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a1508b7d-ca96-5380-bd2f-f23847727865', 'ec59a625-72ef-51f7-aa2a-6c6de60a19b4', DATE '2026-02-04', DATE '2026-03-13', 717.53, 717.53, 'recebido', 'Ana', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 133 | apLIS lote 4810 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('782eb62b-7ec2-55a8-9f97-09cdae21f3e6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4810', DATE '2026-01-05', DATE '2026-01-05', 'Recebido - parcial', 7, '58630', NULL, NULL, NULL, '4810', 2992.23, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-01-05', DATE '2026-02-04', 2992.23, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 133). Responsável: Ana. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', '782eb62b-7ec2-55a8-9f97-09cdae21f3e6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', '782eb62b-7ec2-55a8-9f97-09cdae21f3e6', DATE '2026-02-04', DATE '2026-03-24', 2992.23, 2592.39, 'parcial', 'Ana', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', '782eb62b-7ec2-55a8-9f97-09cdae21f3e6', 399.84, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Ana');

-- JANEIRO linha 134 | apLIS lote 4840 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3770f757-6195-5aca-bc3e-9ddaf5059156', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '4840', DATE '2026-01-13', DATE '2026-01-16', 'Recebido - parcial', 7, '59049', NULL, NULL, NULL, '4840', 4140.67, 4);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), NULL, DATE '2026-01-16', DATE '2026-02-15', 4140.67, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 134). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', '3770f757-6195-5aca-bc3e-9ddaf5059156');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', '3770f757-6195-5aca-bc3e-9ddaf5059156', DATE '2026-02-15', DATE '2026-04-17', 4140.67, 3589.58, 'parcial', 'Rivia', 'Backfill planilha Jan-Jun/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', '3770f757-6195-5aca-bc3e-9ddaf5059156', 551.09, 'Glosa (backfill planilha Jan-Jun/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JANEIRO linha 135 | apLIS lote 4860 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('154b2305-8c7f-5fb6-9442-426f8ae57e2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '4860', DATE '2026-01-19', DATE '2026-01-20', 'Recebido', 4, 'P20261240350', NULL, NULL, NULL, '4860', 2657.73, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb1c0699-0974-565d-a514-f73bb67117c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-01-20', DATE '2026-02-20', 2657.73, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 135). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb1c0699-0974-565d-a514-f73bb67117c0', '154b2305-8c7f-5fb6-9442-426f8ae57e2c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bb1c0699-0974-565d-a514-f73bb67117c0', '154b2305-8c7f-5fb6-9442-426f8ae57e2c', DATE '2026-02-20', DATE '2026-03-20', 2657.73, 2657.73, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- JANEIRO linha 136 | apLIS lote 4861 | TST
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4bc2f589-8568-5b97-b423-8ed270b4438c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '4861', DATE '2026-01-19', DATE '2026-01-20', 'Recebido', 4, 'P20261240364', NULL, NULL, NULL, '4861', 25932.38, 59);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8eef9ce3-ecc8-5d7c-805a-f28335e8bd11', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), NULL, DATE '2026-01-20', DATE '2026-02-20', 25932.38, '2026-01', 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, linha 136). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8eef9ce3-ecc8-5d7c-805a-f28335e8bd11', '4bc2f589-8568-5b97-b423-8ed270b4438c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('8eef9ce3-ecc8-5d7c-805a-f28335e8bd11', '4bc2f589-8568-5b97-b423-8ed270b4438c', DATE '2026-02-20', DATE '2026-03-30', 25932.38, 25932.38, 'recebido', 'Raquel', 'Backfill planilha Jan-Jun/2026');

-- ----------------------------------------------------------------------------
-- 2) Conferência: todos os títulos do mês entraram, com operadora.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_notas INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_notas
    FROM notas
   WHERE observacoes LIKE 'Backfill planilha Faturamento x Recebimentos 2026 Q1 (aba JANEIRO, %'
     AND competencia = '2026-01'
     AND operadora_id IS NOT NULL;
  IF v_notas <> 106 THEN
    RAISE EXCEPTION 'Esperados 106 títulos do backfill de janeiro; encontrados %.', v_notas;
  END IF;
END $$;

COMMIT;
