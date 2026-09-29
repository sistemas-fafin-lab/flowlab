-- ============================================================================
-- Complemento do backfill de Contas a Receber Jul/Ago/Set 2026
--
-- 20260911100000_backfill_contas_receber_q3_2026.sql deixou de fora 15 lotes
-- por "já terem título real cadastrado no sistema". A conferência que achou as
-- 12 primeiras dessas colisões foi feita contra o projeto de TESTE (eqz), não
-- contra produção (jqx) — conferido em 28/09 cruzando `lotes` dos dois
-- projetos. Dos 15, 9 de fato têm título em produção (6526, 6537, 6577 e 6707
-- criados antes do backfill; 6479, 6480, 6563, 6665 e 6669 cadastrados pela
-- tela em 24/09). Os 6 abaixo só existiam no teste e ficaram fora do Contas a
-- Receber de produção; em `notas_lote_audit_logs` não há desvinculação, então
-- não é título desfeito — nunca entraram.
--
-- Mesmo formato da migration original (1 lote → 1 título → 1 recebimento
-- previsto; status do título calculado pelo trigger), com duas diferenças:
--   - o SNAPSHOT DO LOTE vem do apLIS (fatlote/fatrps, lido em 28/09):
--     datas de criação/envio, protocolo, status STLOT, NF/RPS e quantidade de
--     guias. Os valores batem centavo a centavo com a planilha;
--   - quando o lote já tem RPS, o vencimento é o do RPS (mesma regra da
--     criação pela tela, faturamento-titulo-criar.ts) e o número da nota é o
--     da NF-e. Sem RPS, vale a data provável de pagamento da planilha.
--   Emissão, competência e responsável seguem a planilha, como no original.
--
-- Nenhuma das 6 linhas mudou entre a planilha de 11/09 e a de 24/09: todas
-- "No prazo", sem valor recebido nem glosa.
--
-- Guias (requisições) têm PII e não entram aqui: depois desta migration,
--   npx tsx supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts \
--     --lotes=6683,6684,6696,6711,6713,6715 --dry-run
-- ============================================================================

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
   WHERE aplis_id IN ('6683', '6684', '6696', '6711', '6713', '6715');
  IF v_existentes IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) já cadastrado(s) em lotes: %. Remova-os desta migration antes de rodar.', v_existentes;
  END IF;

  SELECT COUNT(*) INTO v_operadoras
    FROM operadoras
   WHERE aplis_id IN ('1008', '1228', '1253', '1281');
  IF v_operadoras <> 4 THEN
    RAISE EXCEPTION 'Esperadas 4 operadoras (1008, 1228, 1253, 1281); encontradas %.', v_operadoras;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Lotes, notas (títulos), vínculo nota_lote e recebimentos.
-- ----------------------------------------------------------------------------

-- SETEMBRO linha 72 | apLIS lote 6711 | ASSEFAZ
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b417fd42-79d2-41e4-9674-eace1bf72e93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6711', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', 3, '1590947', '6711', 2389.47, 11);
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4e174c9d-59ee-4d4d-aacc-8aa43671b539', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-10-20', 2389.47, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 72) — complemento de 28/09. Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4e174c9d-59ee-4d4d-aacc-8aa43671b539', 'b417fd42-79d2-41e4-9674-eace1bf72e93');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4e174c9d-59ee-4d4d-aacc-8aa43671b539', 'b417fd42-79d2-41e4-9674-eace1bf72e93', DATE '2026-10-20', 2389.47, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 108 | apLIS lote 6713 | FASCAL — NF-e 9178 / RPS 9161
-- Vencimento do RPS (04/10); a planilha previa 02/10.
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b4aabbb-186d-4a69-88c9-7080d1ce669e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6713', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', 3, '146576', '9178', 9161, DATE '2026-10-04', '6713', 2405.16, 6);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e5e67797-cf1b-4b7f-8f12-b90eb79139cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '9178', DATE '2026-09-04', DATE '2026-10-04', 2405.16, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 108) — complemento de 28/09. Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e5e67797-cf1b-4b7f-8f12-b90eb79139cf', '5b4aabbb-186d-4a69-88c9-7080d1ce669e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e5e67797-cf1b-4b7f-8f12-b90eb79139cf', '5b4aabbb-186d-4a69-88c9-7080d1ce669e', DATE '2026-10-04', 2405.16, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 128 | apLIS lote 6715 | POLÍCIA FEDERAL ("PMDF" na planilha) — NF-e 9263 / RPS 9247
-- Vencimento do RPS (30/11); a planilha previa 04/10.
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, nfe_numero, numero_rps, data_vencimento_rps, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cfb1a2ea-324c-49cb-8772-4c3ab3388ff5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6715', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', 3, '43129', '9263', 9247, DATE '2026-11-30', '6715', 70.62, 1);
INSERT INTO notas (id_nota, operadora_id, numero_nota, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('857e976d-3069-43c8-a77a-456665b118ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '9263', DATE '2026-09-04', DATE '2026-11-30', 70.62, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 128) — complemento de 28/09. Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('857e976d-3069-43c8-a77a-456665b118ef', 'cfb1a2ea-324c-49cb-8772-4c3ab3388ff5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('857e976d-3069-43c8-a77a-456665b118ef', 'cfb1a2ea-324c-49cb-8772-4c3ab3388ff5', DATE '2026-11-30', 70.62, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 166 | apLIS lote 6684 | TRT ("TRT PERIÓDICO" na planilha)
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f5f26d14-0bf4-420e-ba75-be4324c295a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6684', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', 3, '64395', '6684', 52.20, 1);
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('146a4dc3-7861-491f-a882-0219a7546632', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-09-01', DATE '2026-10-01', 52.20, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 166) — complemento de 28/09. Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('146a4dc3-7861-491f-a882-0219a7546632', 'f5f26d14-0bf4-420e-ba75-be4324c295a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('146a4dc3-7861-491f-a882-0219a7546632', 'f5f26d14-0bf4-420e-ba75-be4324c295a0', DATE '2026-10-01', 52.20, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 167 | apLIS lote 6683 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('72a4541f-8989-48bf-94e7-4aff21565a78', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6683', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', 3, '64404', '6683', 1539.93, 4);
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e24282ab-6b62-4e42-b240-cfc293de1a62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-09-01', DATE '2026-10-01', 1539.93, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 167) — complemento de 28/09. Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e24282ab-6b62-4e42-b240-cfc293de1a62', '72a4541f-8989-48bf-94e7-4aff21565a78');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e24282ab-6b62-4e42-b240-cfc293de1a62', '72a4541f-8989-48bf-94e7-4aff21565a78', DATE '2026-10-01', 1539.93, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 168 | apLIS lote 6696 | TRT
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, status_aplis, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a655277e-0eef-4622-9e05-11e95b48a8b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6696', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', 3, '64488', '6696', 898.69, 2);
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d0b8cf03-db2f-43ba-9c13-cb38c6994d64', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-09-02', DATE '2026-10-02', 898.69, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 168) — complemento de 28/09. Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d0b8cf03-db2f-43ba-9c13-cb38c6994d64', 'a655277e-0eef-4622-9e05-11e95b48a8b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d0b8cf03-db2f-43ba-9c13-cb38c6994d64', 'a655277e-0eef-4622-9e05-11e95b48a8b1', DATE '2026-10-02', 898.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');
