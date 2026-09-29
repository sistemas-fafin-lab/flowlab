-- ============================================================================
-- Backfill histórico: Contas a Receber Jul/Ago/Set 2026 (planilha do cliente)
--
-- Fonte: planilha "Faturamento x Recebimentos - 2026 - 3° Trimestre.xlsx"
-- fornecida pelo cliente (controle manual feito em Google Sheets antes deste
-- módulo existir), 445 títulos históricos (de 552 linhas na planilha; 91
-- linhas eram placeholders vazios ou continham célula quebrada; 1 linha
-- teve conflito de lote não resolvível; e 15 linhas foram excluídas por já
-- terem título real cadastrado no sistema — ver relatório de importação em
-- .scratch/faturamento-backfill-q3-2026/relatorio-importacao.md para a
-- lista completa e o motivo de cada exclusão).
--
-- Cada linha da planilha vira 1 título (nota) com 1 lote e 1 recebimento
-- (previsto ou realizado). O status do título (aberta/recebida/
-- parcialmente_recebida/glosada/liquidada) NÃO é copiado da planilha: é
-- deixado para o trigger fat_recalcular_nota calcular a partir dos valores
-- reais de recebimentos/glosas inseridos abaixo — mesma lógica usada pelo
-- fluxo operacional ao vivo.
--
-- Operadora/lote reais foram resolvidos consultando o apLIS (MySQL de
-- backup, fatlote/fatinstituicao) por número de lote/protocolo — não por
-- texto do nome do convênio na planilha, que tem variações inconsistentes
-- (ex.: "AMHPDF - BACEN"/"AMHPDF - SERPRO"/etc. são todos o mesmo
-- IdFontePagadora=1025 no apLIS; "LUMINAR" e "E-VIDA" são o mesmo 1049).
--
-- Guias/requisições (paciente, procedimento) NÃO são inseridas por esta
-- migration — contêm PII e são preenchidas por um script separado
-- (supabase/scripts/backfill-requisicoes-contas-receber-q3-2026.ts),
-- executado por quem tiver as credenciais de leitura do apLIS e escrita no
-- Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Garante que as operadoras referenciadas existem (idempotente).
--    Não sobrescreve operadoras já sincronizadas do apLIS (ON CONFLICT DO
--    NOTHING) — só cria caso a sincronização ainda não tenha rodado em prod.
--    is_considerada_meta segue a whitelist de 20260903110000: true para as
--    32 já aprovadas pelo setor de faturamento; false (default) para
--    qualquer uma fora da whitelist (ver relatório: 'SELECT', aplis_id
--    1365, não está na whitelist — fica de fora da meta até alguém marcar
--    manualmente, política já documentada naquela migration).
-- ----------------------------------------------------------------------------
INSERT INTO operadoras (aplis_id, nome, is_considerada_meta)
VALUES

  ('1000', 'BRADESCO SAUDE S/A 421715', true),
  ('1007', 'AMIL', true),
  ('1008', 'ASSEFAZ', true),
  ('1009', 'CASSI', true),
  ('1025', 'AMHP-DF', true),
  ('1049', 'E-VIDA', true),
  ('1052', 'POSTAL SAÚDE', true),
  ('1054', '090 SULAMERICA', true),
  ('1078', 'SUL AMERICA COMPANHIA DE SEGURO SAÚDE', true),
  ('1101', 'SAUDE CAIXA', true),
  ('1122', 'BRADESCO SAUDE  - 005711', true),
  ('1129', 'LAB PLANASSISTE', true),
  ('1197', 'SIS SENADO', true),
  ('1204', 'FUSEX', true),
  ('1210', 'CBMDF', true),
  ('1227', 'TST', true),
  ('1228', 'TRT', true),
  ('1231', 'TJDFT', true),
  ('1232', 'TRE-SAÚDE', true),
  ('1235', 'STF', true),
  ('1251', 'PMDF', true),
  ('1252', 'STJ', true),
  ('1253', 'FASCAL', true),
  ('1257', 'INAS GDF', true),
  ('1268', 'BRB SAÚDE', true),
  ('1281', 'POLÍCIA FEDERAL', true),
  ('1282', 'GEAP Autogestão em Saúde', true),
  ('1283', 'CÂMARA DOS DEPUTADOS', true),
  ('1365', 'SELECT', false)

ON CONFLICT (aplis_id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2) Lotes, notas (títulos), vínculo nota_lote e recebimentos.
--    UUIDs gerados neste script para poder referenciar id_lote/id_nota entre
--    as instruções sem round-trip; aplis_id é a chave real de idempotência
--    (lotes.aplis_id é UNIQUE) — rodar esta migration duas vezes falha em
--    vez de duplicar.
-- ----------------------------------------------------------------------------

-- JULHO linha 26 | apLIS lote 6286
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d6c35130-7303-4de2-949a-29f22ebb2509', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6286', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6286', 1448.46, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('95d22173-2bd6-4fd1-92bb-67a2b8c63a72', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1448.46, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 26). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('95d22173-2bd6-4fd1-92bb-67a2b8c63a72', 'd6c35130-7303-4de2-949a-29f22ebb2509');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('95d22173-2bd6-4fd1-92bb-67a2b8c63a72', 'd6c35130-7303-4de2-949a-29f22ebb2509', DATE '2026-09-13', 1448.46, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 27 | apLIS lote 6287
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('08507286-719f-4775-8973-26af9771854b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6287', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6287', 1470.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8376808a-f17f-485b-93f0-d201028d347c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1470.59, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 27). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8376808a-f17f-485b-93f0-d201028d347c', '08507286-719f-4775-8973-26af9771854b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8376808a-f17f-485b-93f0-d201028d347c', '08507286-719f-4775-8973-26af9771854b', DATE '2026-09-13', 1470.59, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 28 | apLIS lote 6302
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8c2ace15-bcbb-4fc2-a083-58541978e2aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6302', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6302', 717.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7112651f-b605-4190-879e-8e61c35199d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 717.44, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 28). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7112651f-b605-4190-879e-8e61c35199d6', '8c2ace15-bcbb-4fc2-a083-58541978e2aa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7112651f-b605-4190-879e-8e61c35199d6', '8c2ace15-bcbb-4fc2-a083-58541978e2aa', DATE '2026-09-15', 717.44, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 29 | apLIS lote 6384
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c2daf49d-9769-4c4a-9d3e-3c8e0ae31106', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6384', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6384', 181.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2cbece3f-6a8d-419e-aed2-1103f24111e6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 181.72, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 29). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2cbece3f-6a8d-419e-aed2-1103f24111e6', 'c2daf49d-9769-4c4a-9d3e-3c8e0ae31106');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2cbece3f-6a8d-419e-aed2-1103f24111e6', 'c2daf49d-9769-4c4a-9d3e-3c8e0ae31106', DATE '2026-09-22', 181.72, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 30 | apLIS lote 6280
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('183daa2b-826c-4c3a-9b12-91c4642a869f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6280', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', '14072026', '6280', 7100.39, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a4572e90-0ab8-4581-9215-d03124b4b8b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-14', DATE '2026-09-12', 7100.39, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 30). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a4572e90-0ab8-4581-9215-d03124b4b8b4', '183daa2b-826c-4c3a-9b12-91c4642a869f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a4572e90-0ab8-4581-9215-d03124b4b8b4', '183daa2b-826c-4c3a-9b12-91c4642a869f', DATE '2026-09-12', 7100.39, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 31 | apLIS lote 6313
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a40fe104-e362-4ef4-a0bb-ff904b074c70', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6313', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6313', 3811.65, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9becb062-decf-4071-b098-c84e201ddb5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 3811.65, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 31). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9becb062-decf-4071-b098-c84e201ddb5c', 'a40fe104-e362-4ef4-a0bb-ff904b074c70');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9becb062-decf-4071-b098-c84e201ddb5c', 'a40fe104-e362-4ef4-a0bb-ff904b074c70', DATE '2026-09-15', 3811.65, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 32 | apLIS lote 6377
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0035becc-3eb5-48e3-8d5f-148f81cc5ea2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6377', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6377', 447.33, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('596f7d09-f3dc-467a-bc2d-daaebef7a6d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 447.33, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 32). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('596f7d09-f3dc-467a-bc2d-daaebef7a6d8', '0035becc-3eb5-48e3-8d5f-148f81cc5ea2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('596f7d09-f3dc-467a-bc2d-daaebef7a6d8', '0035becc-3eb5-48e3-8d5f-148f81cc5ea2', DATE '2026-09-22', 447.33, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 33 | apLIS lote 6276
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dbbdafac-ed5d-4e4d-8ea7-b690ae447ea0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6276', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', '14072026', '6276', 4181.8, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ac3ad2bf-4188-4b2a-9298-f11935ec6786', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-14', DATE '2026-09-12', 4181.8, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 33). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ac3ad2bf-4188-4b2a-9298-f11935ec6786', 'dbbdafac-ed5d-4e4d-8ea7-b690ae447ea0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ac3ad2bf-4188-4b2a-9298-f11935ec6786', 'dbbdafac-ed5d-4e4d-8ea7-b690ae447ea0', DATE '2026-09-12', 4181.8, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 34 | apLIS lote 6312
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b82a5c07-e104-4685-bfc5-cc4e7e51b33f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6312', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6312', 256.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('82e598fe-54da-486b-8b91-51b7ed2e0013', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 256.19, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 34). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('82e598fe-54da-486b-8b91-51b7ed2e0013', 'b82a5c07-e104-4685-bfc5-cc4e7e51b33f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('82e598fe-54da-486b-8b91-51b7ed2e0013', 'b82a5c07-e104-4685-bfc5-cc4e7e51b33f', DATE '2026-09-15', 256.19, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 35 | apLIS lote 6310
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6717f8eb-484c-478c-97c2-1b3be6ee9e27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6310', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '1707/2026', '6310', 239.79, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33426c66-14aa-4537-a948-c460854e7bd0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 239.79, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 35). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33426c66-14aa-4537-a948-c460854e7bd0', '6717f8eb-484c-478c-97c2-1b3be6ee9e27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('33426c66-14aa-4537-a948-c460854e7bd0', '6717f8eb-484c-478c-97c2-1b3be6ee9e27', DATE '2026-09-15', 239.79, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 36 | apLIS lote 6353
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f893ccb9-5b83-4fd2-80d4-41f5cc76b794', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6353', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '22072026', '6353', 898.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-22', DATE '2026-09-20', 898.83, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 36). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814', 'f893ccb9-5b83-4fd2-80d4-41f5cc76b794');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814', 'f893ccb9-5b83-4fd2-80d4-41f5cc76b794', DATE '2026-09-20', 898.83, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 37 | apLIS lote 6383
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f7388f8e-9058-437f-88e8-e0f7e9e88f39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6383', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6383', 1538.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21660afa-51e8-4c80-9498-edf8c9e36c89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 1538.95, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 37). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21660afa-51e8-4c80-9498-edf8c9e36c89', 'f7388f8e-9058-437f-88e8-e0f7e9e88f39');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('21660afa-51e8-4c80-9498-edf8c9e36c89', 'f7388f8e-9058-437f-88e8-e0f7e9e88f39', DATE '2026-09-22', 1538.95, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 38 | apLIS lote 6284
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a76a26fd-6a25-4691-8877-bab9f24f936f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6284', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6284', 1047.73, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('567e7a18-47ff-4a4f-9f02-4af76c43b2c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1047.73, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 38). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('567e7a18-47ff-4a4f-9f02-4af76c43b2c2', 'a76a26fd-6a25-4691-8877-bab9f24f936f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('567e7a18-47ff-4a4f-9f02-4af76c43b2c2', 'a76a26fd-6a25-4691-8877-bab9f24f936f', DATE '2026-09-13', 1047.73, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 39 | apLIS lote 6285
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2b5916f9-fbf2-4edc-97b9-c0a4710c1598', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6285', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6285', 79.91, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f5848ae-84de-4b19-9bc7-bd9f01722cf0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-06-13', 79.91, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 39). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f5848ae-84de-4b19-9bc7-bd9f01722cf0', '2b5916f9-fbf2-4edc-97b9-c0a4710c1598');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7f5848ae-84de-4b19-9bc7-bd9f01722cf0', '2b5916f9-fbf2-4edc-97b9-c0a4710c1598', DATE '2026-06-13', 79.91, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 40 | apLIS lote 6304
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('67e89576-9293-450e-a5be-5eef1448b1d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6304', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6304', 1138.34, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c5ca081e-ed9d-4113-80e0-8c21d1024483', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 1138.34, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 40). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c5ca081e-ed9d-4113-80e0-8c21d1024483', '67e89576-9293-450e-a5be-5eef1448b1d2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c5ca081e-ed9d-4113-80e0-8c21d1024483', '67e89576-9293-450e-a5be-5eef1448b1d2', DATE '2026-09-15', 1138.34, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 41 | apLIS lote 6363
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0822ce10-dc87-473f-91e4-01faa9b45d58', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6363', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '23072026', '6363', 898.61, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4337be2f-4d11-4582-b1f0-f2c00530e1a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 898.61, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 41). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4337be2f-4d11-4582-b1f0-f2c00530e1a0', '0822ce10-dc87-473f-91e4-01faa9b45d58');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4337be2f-4d11-4582-b1f0-f2c00530e1a0', '0822ce10-dc87-473f-91e4-01faa9b45d58', DATE '2026-09-21', 898.61, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 42 | apLIS lote 6378
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('251a7dcb-9c8c-4692-9661-ee72409f2c3e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6378', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6378', 336.07, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f1887e02-9d2a-4616-a358-6890769ff7f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 336.07, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 42). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f1887e02-9d2a-4616-a358-6890769ff7f9', '251a7dcb-9c8c-4692-9661-ee72409f2c3e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f1887e02-9d2a-4616-a358-6890769ff7f9', '251a7dcb-9c8c-4692-9661-ee72409f2c3e', DATE '2026-09-22', 336.07, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 43 | apLIS lote 6288
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('610afd5c-e497-4b30-bb55-ea80eb7210ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6288', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6288', 873.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 873.44, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 43). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f', '610afd5c-e497-4b30-bb55-ea80eb7210ee');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f', '610afd5c-e497-4b30-bb55-ea80eb7210ee', DATE '2026-09-13', 873.44, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 44 | apLIS lote 6381
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ee2fe343-4355-47ed-89f7-997c6a326b6f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6381', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6381', 1482.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c053b58-80db-436c-b72a-74df1d946f9a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 1482.72, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 44). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c053b58-80db-436c-b72a-74df1d946f9a', 'ee2fe343-4355-47ed-89f7-997c6a326b6f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3c053b58-80db-436c-b72a-74df1d946f9a', 'ee2fe343-4355-47ed-89f7-997c6a326b6f', DATE '2026-09-22', 1482.72, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 45 | apLIS lote 6277
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e8264f67-4e01-4b04-9065-bf1e6ab8a9d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6277', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', '14072026', '6277', 4902.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-14', DATE '2026-09-12', 4902.86, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 45). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa', 'e8264f67-4e01-4b04-9065-bf1e6ab8a9d1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa', 'e8264f67-4e01-4b04-9065-bf1e6ab8a9d1', DATE '2026-09-12', 4902.86, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 46 | apLIS lote 6306
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a51e599b-dfdc-4066-b7df-43f8aa09ba12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6306', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6306', 1582.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8cce6010-a3a2-4b8e-bf3b-b0eee536876e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 1582.01, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 46). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8cce6010-a3a2-4b8e-bf3b-b0eee536876e', 'a51e599b-dfdc-4066-b7df-43f8aa09ba12');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8cce6010-a3a2-4b8e-bf3b-b0eee536876e', 'a51e599b-dfdc-4066-b7df-43f8aa09ba12', DATE '2026-09-15', 1582.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 47 | apLIS lote 6354
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed99307d-bc4d-44d5-a35b-d777cbdad62c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6354', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '23072026', '6354', 1549.6, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 1549.6, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 47). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89', 'ed99307d-bc4d-44d5-a35b-d777cbdad62c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89', 'ed99307d-bc4d-44d5-a35b-d777cbdad62c', DATE '2026-09-21', 1549.6, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 48 | apLIS lote 6359
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a0214473-ee24-4ff5-bfa9-a4d043fe41cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6359', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '23072026', '6359', 933.49, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87d06573-7af1-4767-87f8-bc8cbe5268c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 933.49, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 48). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87d06573-7af1-4767-87f8-bc8cbe5268c8', 'a0214473-ee24-4ff5-bfa9-a4d043fe41cf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('87d06573-7af1-4767-87f8-bc8cbe5268c8', 'a0214473-ee24-4ff5-bfa9-a4d043fe41cf', DATE '2026-09-21', 933.49, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 49 | apLIS lote 6382
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3c42784-4897-4e25-a128-3e255c0e3127', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6382', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6382', 880.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eadef290-7c37-4575-b7c4-367a06f236c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 880.75, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 49). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eadef290-7c37-4575-b7c4-367a06f236c2', 'f3c42784-4897-4e25-a128-3e255c0e3127');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('eadef290-7c37-4575-b7c4-367a06f236c2', 'f3c42784-4897-4e25-a128-3e255c0e3127', DATE '2026-09-22', 880.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 50 | apLIS lote 6291
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e9d7db9d-a872-4a95-b721-89e0da20f05e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6291', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6291', 57.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('27de197e-24f0-4c5c-a1c4-34945f9d46e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 57.9, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 50). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('27de197e-24f0-4c5c-a1c4-34945f9d46e9', 'e9d7db9d-a872-4a95-b721-89e0da20f05e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('27de197e-24f0-4c5c-a1c4-34945f9d46e9', 'e9d7db9d-a872-4a95-b721-89e0da20f05e', DATE '2026-09-13', 57.9, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 51 | apLIS lote 6295
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3ab55375-e359-4297-89b3-456e760c5595', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6295', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '44714040', '6295', 2560.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7e2653d2-149b-48da-b1e9-1161806fec4f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 2560.85, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 51). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7e2653d2-149b-48da-b1e9-1161806fec4f', '3ab55375-e359-4297-89b3-456e760c5595');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7e2653d2-149b-48da-b1e9-1161806fec4f', '3ab55375-e359-4297-89b3-456e760c5595', DATE '2026-09-13', 2560.85, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 52 | apLIS lote 6308
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('01cd8a90-f05a-4eba-8670-3c22d82b573d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6308', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '44715100', '6308', 62.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ac821279-552b-49e3-a558-6f16654a5412', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 62.28, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 52). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ac821279-552b-49e3-a558-6f16654a5412', '01cd8a90-f05a-4eba-8670-3c22d82b573d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ac821279-552b-49e3-a558-6f16654a5412', '01cd8a90-f05a-4eba-8670-3c22d82b573d', DATE '2026-09-15', 62.28, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 53 | apLIS lote 6420
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c71dc717-e980-4726-9f47-71e87cf93095', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6420', DATE '2026-07-30', DATE '2026-07-30', 'Faturado', '44719668', '6420', 826.2, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-30', DATE '2026-07-30', 826.2, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 53). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1', 'c71dc717-e980-4726-9f47-71e87cf93095');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1', 'c71dc717-e980-4726-9f47-71e87cf93095', DATE '2026-07-30', 826.2, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 54 | apLIS lote 6293
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e3131a6d-8798-4e36-a17e-06f3ee86b096', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6293', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '44714012', '6293', 691.36, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa7efe83-3081-4c8e-a49b-05e120dd3480', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 691.36, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 54). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa7efe83-3081-4c8e-a49b-05e120dd3480', 'e3131a6d-8798-4e36-a17e-06f3ee86b096');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('aa7efe83-3081-4c8e-a49b-05e120dd3480', 'e3131a6d-8798-4e36-a17e-06f3ee86b096', DATE '2026-09-13', 691.36, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 55 | apLIS lote 6309
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fd36825a-6330-44a4-a6f6-df195ad27548', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6309', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '44715109', '6309', 112.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b40c93ce-eae5-453f-9179-8c5255e6197e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 112.72, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 55). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b40c93ce-eae5-453f-9179-8c5255e6197e', 'fd36825a-6330-44a4-a6f6-df195ad27548');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b40c93ce-eae5-453f-9179-8c5255e6197e', 'fd36825a-6330-44a4-a6f6-df195ad27548', DATE '2026-09-15', 112.72, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 56 | apLIS lote 6367
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9152fb70-6e5c-4076-8b19-303b69d4983d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6367', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '44717202', '6367', 1102.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 1102.02, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 56). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c', '9152fb70-6e5c-4076-8b19-303b69d4983d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c', '9152fb70-6e5c-4076-8b19-303b69d4983d', DATE '2026-09-21', 1102.02, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 57 | apLIS lote 6292
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e49ec9fb-1e4c-4f3d-a104-1968ed294bf1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6292', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '44714000', '6292', 1571.8, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1672eb37-3aca-49a8-a93a-f55fe017627e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1571.8, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1672eb37-3aca-49a8-a93a-f55fe017627e', 'e49ec9fb-1e4c-4f3d-a104-1968ed294bf1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1672eb37-3aca-49a8-a93a-f55fe017627e', 'e49ec9fb-1e4c-4f3d-a104-1968ed294bf1', DATE '2026-09-13', 1571.8, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 58 | apLIS lote 6301
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4df45d2e-dfd4-4aa6-b638-5144883aecdc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6301', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '44714905', '6301', 1359.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0a4e7069-8a8a-4cf9-9c7a-babd84486ede', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 1359.14, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 58). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0a4e7069-8a8a-4cf9-9c7a-babd84486ede', '4df45d2e-dfd4-4aa6-b638-5144883aecdc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0a4e7069-8a8a-4cf9-9c7a-babd84486ede', '4df45d2e-dfd4-4aa6-b638-5144883aecdc', DATE '2026-09-15', 1359.14, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 59 | apLIS lote 6369
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ccef76b5-0559-42c6-b143-8d029a402f18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6369', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '44717211', '6369', 76.2, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('66056ce3-5c48-4484-96db-eac7b85ce98a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 76.2, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 59). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('66056ce3-5c48-4484-96db-eac7b85ce98a', 'ccef76b5-0559-42c6-b143-8d029a402f18');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('66056ce3-5c48-4484-96db-eac7b85ce98a', 'ccef76b5-0559-42c6-b143-8d029a402f18', DATE '2026-09-21', 76.2, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 60 | apLIS lote 6272
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3d1f38c9-d2d4-4742-b9d6-254d8f347423', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6272', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '13072026', '6272', 10608.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dde08209-38f4-4350-8ac8-fa3c62d5e69a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-13', DATE '2026-09-11', 10608.69, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 60). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dde08209-38f4-4350-8ac8-fa3c62d5e69a', '3d1f38c9-d2d4-4742-b9d6-254d8f347423');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('dde08209-38f4-4350-8ac8-fa3c62d5e69a', '3d1f38c9-d2d4-4742-b9d6-254d8f347423', DATE '2026-09-11', 10608.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 61 | apLIS lote 6274
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('39c2170e-4b5d-4550-8a81-1a2f7751b32d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6274', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', '14072026', '6274', 3144.15, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2e379114-a0f7-495c-a37f-a0cd1c2b13ec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-14', DATE '2026-09-12', 3144.15, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 61). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2e379114-a0f7-495c-a37f-a0cd1c2b13ec', '39c2170e-4b5d-4550-8a81-1a2f7751b32d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2e379114-a0f7-495c-a37f-a0cd1c2b13ec', '39c2170e-4b5d-4550-8a81-1a2f7751b32d', DATE '2026-09-12', 3144.15, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 62 | apLIS lote 6315
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d35506bc-347f-4b93-90db-924c9eb96fa8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6315', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '22072026', '6315', 7313.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea63012f-4f02-421c-9974-b319879f18b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-22', DATE '2026-09-20', 7313.28, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 62). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea63012f-4f02-421c-9974-b319879f18b7', 'd35506bc-347f-4b93-90db-924c9eb96fa8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ea63012f-4f02-421c-9974-b319879f18b7', 'd35506bc-347f-4b93-90db-924c9eb96fa8', DATE '2026-09-20', 7313.28, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 63 | apLIS lote 6358
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ee10922c-8414-42e7-80a3-196f4314451c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6358', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '23072026', '6358', 1199.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 1199.28, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 63). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33', 'ee10922c-8414-42e7-80a3-196f4314451c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33', 'ee10922c-8414-42e7-80a3-196f4314451c', DATE '2026-09-21', 1199.28, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 64 | apLIS lote 6380
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5708117c-c037-40b2-8229-b3a87e7fac80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6380', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '24072026', '6380', 2999.66, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1fc15b45-2a08-4e22-894a-33fe8b440648', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-24', DATE '2026-09-22', 2999.66, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 64). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1fc15b45-2a08-4e22-894a-33fe8b440648', '5708117c-c037-40b2-8229-b3a87e7fac80');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1fc15b45-2a08-4e22-894a-33fe8b440648', '5708117c-c037-40b2-8229-b3a87e7fac80', DATE '2026-09-22', 2999.66, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 65 | apLIS lote 6281
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aeef8e23-394d-4ec1-a37e-a97b7124278f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6281', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '15072026', '6281', 1000.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('15bf1d80-91c8-4dfe-9618-583ac1080c60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1000.75, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 65). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('15bf1d80-91c8-4dfe-9618-583ac1080c60', 'aeef8e23-394d-4ec1-a37e-a97b7124278f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('15bf1d80-91c8-4dfe-9618-583ac1080c60', 'aeef8e23-394d-4ec1-a37e-a97b7124278f', DATE '2026-09-13', 1000.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 66 | apLIS lote 6303
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3e550c9e-1bef-4a6b-99e6-a92f80a0109b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6303', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '17072026', '6303', 63.93, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f561367-4e51-4913-9495-8b00558a8092', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 63.93, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 66). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f561367-4e51-4913-9495-8b00558a8092', '3e550c9e-1bef-4a6b-99e6-a92f80a0109b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2f561367-4e51-4913-9495-8b00558a8092', '3e550c9e-1bef-4a6b-99e6-a92f80a0109b', DATE '2026-09-15', 63.93, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 67 | apLIS lote 6365
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4dc35263-6151-4fd9-9ebf-35b260281812', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6365', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '23072026', '6365', 63.93, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('86045f2f-add8-46e2-b059-496dc6708cf3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-23', DATE '2026-09-21', 63.93, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 67). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('86045f2f-add8-46e2-b059-496dc6708cf3', '4dc35263-6151-4fd9-9ebf-35b260281812');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('86045f2f-add8-46e2-b059-496dc6708cf3', '4dc35263-6151-4fd9-9ebf-35b260281812', DATE '2026-09-21', 63.93, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 68 | apLIS lote 6294
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('75ebf854-a610-46b7-a271-05780ecae185', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6294', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '44714019', '6294', 1642.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05d86674-7a97-4ba1-b355-a9f245502af8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-15', DATE '2026-09-13', 1642.01, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 68). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05d86674-7a97-4ba1-b355-a9f245502af8', '75ebf854-a610-46b7-a271-05780ecae185');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('05d86674-7a97-4ba1-b355-a9f245502af8', '75ebf854-a610-46b7-a271-05780ecae185', DATE '2026-09-13', 1642.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 69 | apLIS lote 6405
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4e3c5f31-521c-4e12-99ac-4d7055001f5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6405', DATE '2026-07-29', DATE '2026-07-29', 'Faturado', '44718925', '6405', 555.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b7b55874-6cac-4ede-bec9-2025704653c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-29', DATE '2026-07-29', 555.22, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 69). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b7b55874-6cac-4ede-bec9-2025704653c2', '4e3c5f31-521c-4e12-99ac-4d7055001f5c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b7b55874-6cac-4ede-bec9-2025704653c2', '4e3c5f31-521c-4e12-99ac-4d7055001f5c', DATE '2026-07-29', 555.22, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 70 | apLIS lote 6307
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce62ab60-636b-45e8-a7af-b10296a5d82f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6307', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '44715088', '6307', 676.87, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7fc2bcf0-52af-4536-ad55-b052600b04d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-07-17', DATE '2026-09-15', 676.87, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 70). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7fc2bcf0-52af-4536-ad55-b052600b04d0', 'ce62ab60-636b-45e8-a7af-b10296a5d82f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7fc2bcf0-52af-4536-ad55-b052600b04d0', 'ce62ab60-636b-45e8-a7af-b10296a5d82f', DATE '2026-09-15', 676.87, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 71 | apLIS lote 6205
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cc8501fe-44b1-4fa9-a52f-025a6f5a8075', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6205', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '5807633071', '6205', 14273.87, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-07-01', DATE '2026-07-31', 14273.87, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 71). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', 'cc8501fe-44b1-4fa9-a52f-025a6f5a8075');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', 'cc8501fe-44b1-4fa9-a52f-025a6f5a8075', DATE '2026-07-31', NULL, 14273.87, 1054.5, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', 'cc8501fe-44b1-4fa9-a52f-025a6f5a8075', 13219.37, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 72 | apLIS lote 6206
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cd3348fd-2afb-417b-81a8-1bae0e42e65d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6206', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '5807813927', '6206', 1196.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('776c82c8-0de5-4429-baa9-050eb31db88b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-07-01', DATE '2026-07-31', 1196.11, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 72). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('776c82c8-0de5-4429-baa9-050eb31db88b', 'cd3348fd-2afb-417b-81a8-1bae0e42e65d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('776c82c8-0de5-4429-baa9-050eb31db88b', 'cd3348fd-2afb-417b-81a8-1bae0e42e65d', DATE '2026-07-31', NULL, 1196.11, 0.0, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('776c82c8-0de5-4429-baa9-050eb31db88b', 'cd3348fd-2afb-417b-81a8-1bae0e42e65d', 1196.11, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 73 | apLIS lote 6255
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b1c88e8b-0427-4e45-8df1-ca6661c2f298', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6255', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '5823761032', '6255', 4076.3, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-07-10', DATE '2026-08-09', 4076.3, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 73). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', 'b1c88e8b-0427-4e45-8df1-ca6661c2f298');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', 'b1c88e8b-0427-4e45-8df1-ca6661c2f298', DATE '2026-08-09', NULL, 4076.3, 1692.08, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', 'b1c88e8b-0427-4e45-8df1-ca6661c2f298', 2384.22, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 74 | apLIS lote 6271
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cc740f9c-3b7d-4b20-92fc-d68c075ffa66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6271', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '5826483031', '6271', 2552.09, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-07-13', DATE '2026-08-12', 2552.09, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 74). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66', DATE '2026-08-12', NULL, 2552.09, 789.9, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66', 1762.19, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 75 | apLIS lote 6204
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bcc44b9e-2de2-45a2-99f7-3e467c953b1f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6204', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '1493212', '6204', 5989.82, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('42e8f1a5-4584-4214-b9af-0976c4c9342e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-07-01', DATE '2026-08-20', 5989.82, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 75). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('42e8f1a5-4584-4214-b9af-0976c4c9342e', 'bcc44b9e-2de2-45a2-99f7-3e467c953b1f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('42e8f1a5-4584-4214-b9af-0976c4c9342e', 'bcc44b9e-2de2-45a2-99f7-3e467c953b1f', DATE '2026-08-20', 5989.82, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 76 | apLIS lote 6179
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5cacf9b1-0450-4ff7-9837-b6c92cde473a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6179', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '1496582', '6179', 13499.82, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('87d88ac2-4676-433e-8cff-77ae1ba4e73f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-07-02', DATE '2026-08-20', 13499.82, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 76). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('87d88ac2-4676-433e-8cff-77ae1ba4e73f', '5cacf9b1-0450-4ff7-9837-b6c92cde473a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('87d88ac2-4676-433e-8cff-77ae1ba4e73f', '5cacf9b1-0450-4ff7-9837-b6c92cde473a', DATE '2026-08-20', 13499.82, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 77 | apLIS lote 6180
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e7c89be2-473b-436b-8f3b-b580d40e654e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6180', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '1496645', '6180', 12296.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b5be8624-de52-470c-9144-23a7561780e5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-07-02', DATE '2026-08-20', 12296.14, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 77). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b5be8624-de52-470c-9144-23a7561780e5', 'e7c89be2-473b-436b-8f3b-b580d40e654e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b5be8624-de52-470c-9144-23a7561780e5', 'e7c89be2-473b-436b-8f3b-b580d40e654e', DATE '2026-08-20', 12296.14, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 78 | apLIS lote 6181
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b7a314a8-37d8-4b1c-9dae-a26861797504', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6181', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '1496969', '6181', 16214.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ef1c1a9e-27e0-4c02-8b0f-9272c4aa6683', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-07-02', DATE '2026-08-20', 16214.59, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 78). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ef1c1a9e-27e0-4c02-8b0f-9272c4aa6683', 'b7a314a8-37d8-4b1c-9dae-a26861797504');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ef1c1a9e-27e0-4c02-8b0f-9272c4aa6683', 'b7a314a8-37d8-4b1c-9dae-a26861797504', DATE '2026-08-20', 16214.59, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 79 | apLIS lote 6182
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e7d95455-f5ee-4bf6-8b9a-76afb4a718dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6182', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '1497032', '6182', 3018.03, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('123e19ce-d281-4733-8703-ece26d7377fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-07-02', DATE '2026-08-20', 3018.03, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 79). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('123e19ce-d281-4733-8703-ece26d7377fd', 'e7d95455-f5ee-4bf6-8b9a-76afb4a718dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('123e19ce-d281-4733-8703-ece26d7377fd', 'e7d95455-f5ee-4bf6-8b9a-76afb4a718dc', DATE '2026-08-20', 3018.03, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 80 | apLIS lote 6136
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d9232a1c-4c84-4d0e-ae0a-c84eec58d073', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6136', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', '340229235214_0', '6136', 20894.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ddb3b4b5-4d6a-4093-8736-3f610cec3aad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-08', DATE '2026-09-06', 20894.28, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 80). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ddb3b4b5-4d6a-4093-8736-3f610cec3aad', 'd9232a1c-4c84-4d0e-ae0a-c84eec58d073');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ddb3b4b5-4d6a-4093-8736-3f610cec3aad', 'd9232a1c-4c84-4d0e-ae0a-c84eec58d073', DATE '2026-09-06', 20894.28, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 81 | apLIS lote 6244
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('71399491-c8d0-4a96-b3dd-992aaa8bdbcc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6244', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', '340229239304_0', '6244', 25779.52, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5ae42726-9a02-42e7-b537-50c81264dda4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-08', DATE '2026-09-06', 25779.52, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 81). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5ae42726-9a02-42e7-b537-50c81264dda4', '71399491-c8d0-4a96-b3dd-992aaa8bdbcc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5ae42726-9a02-42e7-b537-50c81264dda4', '71399491-c8d0-4a96-b3dd-992aaa8bdbcc', DATE '2026-09-06', 25779.52, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 82 | apLIS lote 6241
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7b14e626-6d69-47f3-b498-49ca0656006e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6241', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '340229282878_0', '6241', 28642.27, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a873e892-257b-4f9c-b918-afc54259c31a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-09', DATE '2026-09-07', 28642.27, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 82). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a873e892-257b-4f9c-b918-afc54259c31a', '7b14e626-6d69-47f3-b498-49ca0656006e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a873e892-257b-4f9c-b918-afc54259c31a', '7b14e626-6d69-47f3-b498-49ca0656006e', DATE '2026-09-07', DATE '2026-08-19', 28642.27, 28642.27, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 83 | apLIS lote 6242
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('260c01b6-c489-47ea-a0e0-3c422607ae5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6242', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '340229283369_0', '6242', 25765.91, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('840bf3d4-07cf-4721-9b07-7fb2f7fa5bd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-09', DATE '2026-09-07', 25765.91, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 83). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('840bf3d4-07cf-4721-9b07-7fb2f7fa5bd4', '260c01b6-c489-47ea-a0e0-3c422607ae5c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('840bf3d4-07cf-4721-9b07-7fb2f7fa5bd4', '260c01b6-c489-47ea-a0e0-3c422607ae5c', DATE '2026-09-07', DATE '2026-08-19', 25765.91, 25765.91, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 84 | apLIS lote 6246
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('98eff3d6-4e42-454f-bfce-e48fddb4aeff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6246', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '341229283497_0', '6246', 14432.57, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e163d9d-cb0f-4e07-aeef-f37564218998', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-07-09', DATE '2026-09-07', 14432.57, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 84). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e163d9d-cb0f-4e07-aeef-f37564218998', '98eff3d6-4e42-454f-bfce-e48fddb4aeff');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e163d9d-cb0f-4e07-aeef-f37564218998', '98eff3d6-4e42-454f-bfce-e48fddb4aeff', DATE '2026-09-07', DATE '2026-08-19', 14432.57, 13094.0, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 85 | apLIS lote 6250
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bcb08bd3-273d-49ee-80d3-6903ed487c9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6250', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '340229286908_0', '6250', 10817.58, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('26b4a689-3177-4c27-a485-53e68727d7db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-09', DATE '2026-09-07', 10817.58, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 85). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('26b4a689-3177-4c27-a485-53e68727d7db', 'bcb08bd3-273d-49ee-80d3-6903ed487c9d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('26b4a689-3177-4c27-a485-53e68727d7db', 'bcb08bd3-273d-49ee-80d3-6903ed487c9d', DATE '2026-09-07', DATE '2026-08-19', 10817.58, 10817.58, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 86 | apLIS lote 6252
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('892d5309-8644-44f3-8b3b-8ef9d6c125b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6252', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '341229362290_0', '6252', 7168.39, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e94cd62e-776d-47e7-8a71-ed74f1da1e18', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-07-13', DATE '2026-09-11', 7168.39, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 86). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e94cd62e-776d-47e7-8a71-ed74f1da1e18', '892d5309-8644-44f3-8b3b-8ef9d6c125b0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e94cd62e-776d-47e7-8a71-ed74f1da1e18', '892d5309-8644-44f3-8b3b-8ef9d6c125b0', DATE '2026-09-11', 7168.39, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 87 | apLIS lote 6266
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4ea74182-5025-4325-9d87-6abbd9ef7b61', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6266', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '340229363384_0', '6266', 1220.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-13', DATE '2026-09-11', 1220.64, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 87). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0', '4ea74182-5025-4325-9d87-6abbd9ef7b61');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0', '4ea74182-5025-4325-9d87-6abbd9ef7b61', DATE '2026-09-11', DATE '2026-08-31', 1220.64, 1220.64, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 88 | apLIS lote 6267
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('58a971c4-1184-4965-ad39-7b256f806df4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6267', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '340229364981_0', '6267', 15912.98, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e41775ec-60fe-4e84-903d-69bb5ca66e9e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-13', DATE '2026-09-11', 15912.98, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 88). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim (valor: R$ 683.61).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e41775ec-60fe-4e84-903d-69bb5ca66e9e', '58a971c4-1184-4965-ad39-7b256f806df4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e41775ec-60fe-4e84-903d-69bb5ca66e9e', '58a971c4-1184-4965-ad39-7b256f806df4', DATE '2026-09-11', DATE '2026-08-31', 15912.98, 15912.98, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 89 | apLIS lote 6240
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e289ef12-7b41-4736-949f-7246ca6976c9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6240', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '340229557439_0', '6240', 12728.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('862af5e3-8cb2-4364-a12c-32ff8d3cc283', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-17', DATE '2026-09-15', 12728.64, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 89). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('862af5e3-8cb2-4364-a12c-32ff8d3cc283', 'e289ef12-7b41-4736-949f-7246ca6976c9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('862af5e3-8cb2-4364-a12c-32ff8d3cc283', 'e289ef12-7b41-4736-949f-7246ca6976c9', DATE '2026-09-15', 12728.64, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 90 | apLIS lote 6254
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4c27709b-6ef6-42ae-8dd7-2d9d82472846', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6254', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '340229556731_0', '6254', 12833.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('046f0534-d6dd-4fad-b01d-e43ac47badc6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-17', DATE '2026-09-15', 12833.01, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 90). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('046f0534-d6dd-4fad-b01d-e43ac47badc6', '4c27709b-6ef6-42ae-8dd7-2d9d82472846');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('046f0534-d6dd-4fad-b01d-e43ac47badc6', '4c27709b-6ef6-42ae-8dd7-2d9d82472846', DATE '2026-09-15', DATE '2026-08-31', 12833.01, 10803.98, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 91 | apLIS lote 6328
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('654b89d1-f070-44f6-b584-eb9c0b95936d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6328', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', '340229632276_0', '6328', 32863.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d01c833-f545-4376-a96d-6eb1e34a0c49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-21', DATE '2026-09-19', 32863.78, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 91). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d01c833-f545-4376-a96d-6eb1e34a0c49', '654b89d1-f070-44f6-b584-eb9c0b95936d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7d01c833-f545-4376-a96d-6eb1e34a0c49', '654b89d1-f070-44f6-b584-eb9c0b95936d', DATE '2026-09-19', 32863.78, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 92 | apLIS lote 6335
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e3676b99-aa02-47f2-a800-0f5e8e8b8ee7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6335', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', '341229637097_0', '6335', 15596.16, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f3aecfe9-b31e-4b38-9770-99b804530129', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-07-21', DATE '2026-09-19', 15596.16, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 92). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f3aecfe9-b31e-4b38-9770-99b804530129', 'e3676b99-aa02-47f2-a800-0f5e8e8b8ee7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f3aecfe9-b31e-4b38-9770-99b804530129', 'e3676b99-aa02-47f2-a800-0f5e8e8b8ee7', DATE '2026-09-19', 15596.16, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 93 | apLIS lote 6332
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('adad28e2-c5a5-40bc-a1d9-6159cfa8ffca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6332', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', '340229640253_0', '6332', 9628.82, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d7399086-dea9-4cb9-bfcf-d1e761210de8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-21', DATE '2026-09-19', 9628.82, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 93). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d7399086-dea9-4cb9-bfcf-d1e761210de8', 'adad28e2-c5a5-40bc-a1d9-6159cfa8ffca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d7399086-dea9-4cb9-bfcf-d1e761210de8', 'adad28e2-c5a5-40bc-a1d9-6159cfa8ffca', DATE '2026-09-19', 9628.82, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 94 | apLIS lote 6374
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e05b9845-0ebd-4844-a971-6527f5c6b07a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6374', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '340229730563_0', '6374', 20487.81, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65fa9e4f-7b8b-428b-9d3a-a11f79f160a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-23', DATE '2026-09-21', 20487.81, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 94). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65fa9e4f-7b8b-428b-9d3a-a11f79f160a5', 'e05b9845-0ebd-4844-a971-6527f5c6b07a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('65fa9e4f-7b8b-428b-9d3a-a11f79f160a5', 'e05b9845-0ebd-4844-a971-6527f5c6b07a', DATE '2026-09-21', 20487.81, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 95 | apLIS lote 6392
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d61feb84-0d1c-4940-afba-826796ceb14a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6392', DATE '2026-07-27', DATE '2026-07-27', 'Faturado', '341229787941_0', '6392', 3974.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('201d6fd5-e553-4a79-a69a-f43ff0bf14e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-07-27', DATE '2026-09-25', 3974.06, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 95). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('201d6fd5-e553-4a79-a69a-f43ff0bf14e4', 'd61feb84-0d1c-4940-afba-826796ceb14a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('201d6fd5-e553-4a79-a69a-f43ff0bf14e4', 'd61feb84-0d1c-4940-afba-826796ceb14a', DATE '2026-09-25', 3974.06, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 96 | apLIS lote 6391
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('36cfe6a7-d42b-48a0-b89b-0883d949b8e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6391', DATE '2026-07-27', DATE '2026-07-27', 'Faturado', '340229786807_0', '6391', 10487.16, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cc452fda-c989-4ce7-a4a3-41e30dc48319', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-27', DATE '2026-09-25', 10487.16, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 96). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cc452fda-c989-4ce7-a4a3-41e30dc48319', '36cfe6a7-d42b-48a0-b89b-0883d949b8e1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('cc452fda-c989-4ce7-a4a3-41e30dc48319', '36cfe6a7-d42b-48a0-b89b-0883d949b8e1', DATE '2026-09-25', 10487.16, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 97 | apLIS lote 6393
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('88828c31-8df1-410e-a373-12044cb9e92f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6393', DATE '2026-07-27', DATE '2026-07-27', 'Faturado', '340229793264_0', '6393', 1907.61, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c3a453f-ada4-4f9a-93a4-78db856783d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-27', DATE '2026-09-25', 1907.61, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 97). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c3a453f-ada4-4f9a-93a4-78db856783d8', '88828c31-8df1-410e-a373-12044cb9e92f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5c3a453f-ada4-4f9a-93a4-78db856783d8', '88828c31-8df1-410e-a373-12044cb9e92f', DATE '2026-09-25', 1907.61, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 98 | apLIS lote 6397
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7c78a518-058b-47ae-940d-b061f176b93f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6397', DATE '2026-07-28', DATE '2026-07-28', 'Faturado', '340229818018_0', '6397', 16052.77, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('423a33cb-df8e-4305-9999-12dea6d0641a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-28', DATE '2026-09-28', 16052.77, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 98). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('423a33cb-df8e-4305-9999-12dea6d0641a', '7c78a518-058b-47ae-940d-b061f176b93f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('423a33cb-df8e-4305-9999-12dea6d0641a', '7c78a518-058b-47ae-940d-b061f176b93f', DATE '2026-09-28', 16052.77, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 99 | apLIS lote 6414
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bfa5febf-ea94-45b3-871c-eb4e0f60cbdf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6414', DATE '2026-07-30', DATE '2026-07-30', 'Faturado', '340229904127_0', '6414', 13536.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('61561bc4-e1f2-4d9e-9fbc-66b665c3674e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-07-30', DATE '2026-09-30', 13536.95, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 99). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('61561bc4-e1f2-4d9e-9fbc-66b665c3674e', 'bfa5febf-ea94-45b3-871c-eb4e0f60cbdf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('61561bc4-e1f2-4d9e-9fbc-66b665c3674e', 'bfa5febf-ea94-45b3-871c-eb4e0f60cbdf', DATE '2026-09-30', 13536.95, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 100 | apLIS lote 6419
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8c251bd5-1cfe-4fc2-85fb-fc0b8a8900b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6419', DATE '2026-07-30', DATE '2026-07-30', 'Faturado', '341229911129_0', '6419', 14313.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('553601e0-d242-444e-aaff-71196ac1769d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-07-30', DATE '2026-09-30', 14313.42, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 100). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('553601e0-d242-444e-aaff-71196ac1769d', '8c251bd5-1cfe-4fc2-85fb-fc0b8a8900b9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('553601e0-d242-444e-aaff-71196ac1769d', '8c251bd5-1cfe-4fc2-85fb-fc0b8a8900b9', DATE '2026-09-30', 14313.42, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 101 | apLIS lote 6200
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3142105-285c-4f41-be6f-c1d14d2e9baa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6200', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '284683', '6200', 152.89, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a3f5a282-f641-435d-87ad-aad8cce3bbf8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-07-01', DATE '2026-08-30', 152.89, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 101). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a3f5a282-f641-435d-87ad-aad8cce3bbf8', 'c3142105-285c-4f41-be6f-c1d14d2e9baa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a3f5a282-f641-435d-87ad-aad8cce3bbf8', 'c3142105-285c-4f41-be6f-c1d14d2e9baa', DATE '2026-08-30', DATE '2026-08-07', 152.89, 152.89, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 102 | apLIS lote 6199
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd8baf7d-b4a4-4497-b346-a6c3e830c08f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6199', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '284668', '6199', 879.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('96800d0a-f231-46ef-8cb7-95ebfda793ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-07-01', DATE '2026-08-30', 879.22, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 102). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim (valor: R$ 455.74).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('96800d0a-f231-46ef-8cb7-95ebfda793ed', 'dd8baf7d-b4a4-4497-b346-a6c3e830c08f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('96800d0a-f231-46ef-8cb7-95ebfda793ed', 'dd8baf7d-b4a4-4497-b346-a6c3e830c08f', DATE '2026-08-30', DATE '2026-07-31', 879.22, 879.22, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 103 | apLIS lote 6198
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d3c79c6d-f7e8-4300-a8af-575ddd0e37b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6198', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '284648', '6198', 57.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a23b2223-4379-4141-87ae-aa46cc19a94c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-07-01', DATE '2026-08-30', 57.92, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 103). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a23b2223-4379-4141-87ae-aa46cc19a94c', 'd3c79c6d-f7e8-4300-a8af-575ddd0e37b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a23b2223-4379-4141-87ae-aa46cc19a94c', 'd3c79c6d-f7e8-4300-a8af-575ddd0e37b8', DATE '2026-08-30', DATE '2026-07-31', 57.92, 57.92, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 104 | apLIS lote 6194
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c8c6ece7-a1bb-40ae-b086-61afe3195341', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6194', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '284493', '6194', 14063.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-07-01', DATE '2026-08-30', 14063.04, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 104). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', 'c8c6ece7-a1bb-40ae-b086-61afe3195341');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', 'c8c6ece7-a1bb-40ae-b086-61afe3195341', DATE '2026-08-30', DATE '2026-07-31', 14063.04, 14063.04, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 105 | apLIS lote 6216
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('621c4437-6750-4af2-99c8-48da101f676d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6216', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', '229095919', '6216', 14836.27, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('172855da-da24-4231-9bdd-962570629cdb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-03', DATE '2026-08-02', 14836.27, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 105). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('172855da-da24-4231-9bdd-962570629cdb', '621c4437-6750-4af2-99c8-48da101f676d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('172855da-da24-4231-9bdd-962570629cdb', '621c4437-6750-4af2-99c8-48da101f676d', DATE '2026-08-02', DATE '2026-08-05', 14836.27, 14132.25, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('172855da-da24-4231-9bdd-962570629cdb', '621c4437-6750-4af2-99c8-48da101f676d', 704.02, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 106 | apLIS lote 6217
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('775d93fb-11e5-4e69-9d01-b3fc59b9ffdc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6217', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', '229104804', '6217', 21322.08, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-03', DATE '2026-08-02', 21322.08, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 106). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', '775d93fb-11e5-4e69-9d01-b3fc59b9ffdc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', '775d93fb-11e5-4e69-9d01-b3fc59b9ffdc', DATE '2026-08-02', DATE '2026-08-05', 21322.08, 20618.06, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', '775d93fb-11e5-4e69-9d01-b3fc59b9ffdc', 704.02, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 107 | apLIS lote 6219
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b64f90d1-64b6-4956-a590-b6d1b27ef4af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6219', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', '229108869', '6219', 24016.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-03', DATE '2026-08-02', 24016.59, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 107). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', 'b64f90d1-64b6-4956-a590-b6d1b27ef4af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', 'b64f90d1-64b6-4956-a590-b6d1b27ef4af', DATE '2026-08-02', DATE '2026-08-05', 24016.59, 23781.91, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', 'b64f90d1-64b6-4956-a590-b6d1b27ef4af', 234.68, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 108 | apLIS lote 6221
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c548eb94-5b23-4043-a377-30733dad07e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6221', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', '229112275', '6221', 6346.24, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c1ca1be9-8778-4abd-9558-73e5c1132823', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-03', DATE '2026-08-02', 6346.24, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 108). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c1ca1be9-8778-4abd-9558-73e5c1132823', 'c548eb94-5b23-4043-a377-30733dad07e1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c1ca1be9-8778-4abd-9558-73e5c1132823', 'c548eb94-5b23-4043-a377-30733dad07e1', DATE '2026-08-02', DATE '2026-08-05', 6346.24, 6346.24, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 109 | apLIS lote 6223
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('abeb6254-0153-4757-9522-957829ff66aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6223', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', '229123514', '6223', 7301.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-06', DATE '2026-08-05', 7301.06, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 109). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', 'abeb6254-0153-4757-9522-957829ff66aa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', 'abeb6254-0153-4757-9522-957829ff66aa', DATE '2026-08-05', DATE '2026-08-05', 7301.06, 7301.05, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', 'abeb6254-0153-4757-9522-957829ff66aa', 0.01, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 110 | apLIS lote 5746
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5434b7bf-9ebd-4d50-a546-0ab9813d99ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '5746', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '229285066', '5746', 2895.49, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e3d9b4a-efbd-4037-9ab3-9c98349b9102', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-09', DATE '2026-08-08', 2895.49, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 110). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e3d9b4a-efbd-4037-9ab3-9c98349b9102', '5434b7bf-9ebd-4d50-a546-0ab9813d99ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('9e3d9b4a-efbd-4037-9ab3-9c98349b9102', '5434b7bf-9ebd-4d50-a546-0ab9813d99ad', DATE '2026-08-08', DATE '2026-08-05', 2895.49, 2895.49, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 111 | apLIS lote 6257
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('20699454-f49e-4fe6-a18e-d9961925e1be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6257', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '229346211', '6257', 30194.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-10', DATE '2026-08-09', 30194.78, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 111). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', '20699454-f49e-4fe6-a18e-d9961925e1be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', '20699454-f49e-4fe6-a18e-d9961925e1be', DATE '2026-08-09', DATE '2026-08-05', 30194.78, 27613.34, 'parcial', 'Rivia', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', '20699454-f49e-4fe6-a18e-d9961925e1be', 2581.44, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JULHO linha 112 | apLIS lote 6258
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('40ced563-34a7-430e-83c8-bcba4648c19d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6258', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '229342522', '6258', 4798.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7fa534b1-e2ba-41c0-893f-667ed3f6ee7d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-10', DATE '2026-08-09', 4798.72, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 112). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7fa534b1-e2ba-41c0-893f-667ed3f6ee7d', '40ced563-34a7-430e-83c8-bcba4648c19d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7fa534b1-e2ba-41c0-893f-667ed3f6ee7d', '40ced563-34a7-430e-83c8-bcba4648c19d', DATE '2026-08-09', DATE '2026-08-05', 4798.72, 4798.72, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 113 | apLIS lote 6120
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9775d934-2c1d-4eac-bd2e-e1fcd6c53aad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6120', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '228755877', '6120', 142.62, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b44e006-1877-4641-9d45-abfa882dc7bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-10', DATE '2026-08-09', 142.62, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 113). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b44e006-1877-4641-9d45-abfa882dc7bc', '9775d934-2c1d-4eac-bd2e-e1fcd6c53aad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9b44e006-1877-4641-9d45-abfa882dc7bc', '9775d934-2c1d-4eac-bd2e-e1fcd6c53aad', DATE '2026-08-09', 142.62, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 114 | apLIS lote 6124
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8b942b22-1610-434e-83a9-d458f8b3715a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6124', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '228764763', '6124', 507.15, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('086d06df-34e7-4d65-9a04-f53aafc29a03', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-10', DATE '2026-08-09', 507.15, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 114). Responsável: Rivia. Status original na planilha: Vencido. Refaturamento: sim (valor: R$ 326.70).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('086d06df-34e7-4d65-9a04-f53aafc29a03', '8b942b22-1610-434e-83a9-d458f8b3715a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('086d06df-34e7-4d65-9a04-f53aafc29a03', '8b942b22-1610-434e-83a9-d458f8b3715a', DATE '2026-08-09', 507.15, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 115 | apLIS lote 6260
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b593edfd-db12-4d88-9323-fa3083e91e27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6260', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '229348485', '6260', 522.27, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d66ef715-4193-4ddf-9e8b-6c0cd04897a6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-07-10', DATE '2026-08-09', 522.27, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 115). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d66ef715-4193-4ddf-9e8b-6c0cd04897a6', 'b593edfd-db12-4d88-9323-fa3083e91e27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d66ef715-4193-4ddf-9e8b-6c0cd04897a6', 'b593edfd-db12-4d88-9323-fa3083e91e27', DATE '2026-08-09', DATE '2026-08-05', 522.27, 522.27, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 116 | apLIS lote 5894
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('127c10b2-6957-4ede-b0d6-7dff4b45464f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '5894', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', '2607091042369992918', '5894', 463.74, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6f94ef01-5058-409e-8ad6-47441cd0f56d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), DATE '2026-07-09', DATE '2026-08-08', 463.74, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 116). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6f94ef01-5058-409e-8ad6-47441cd0f56d', '127c10b2-6957-4ede-b0d6-7dff4b45464f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6f94ef01-5058-409e-8ad6-47441cd0f56d', '127c10b2-6957-4ede-b0d6-7dff4b45464f', DATE '2026-08-08', 463.74, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 117 | apLIS lote 6411
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d95ee3af-8316-427e-92dc-266688bd2f0b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '6411', DATE '2026-07-30', DATE '2026-07-30', 'Faturado', '2607301013051192918', '6411', 2357.5, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3f1e711d-87c0-4544-a570-f0d1130baab9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), DATE '2026-07-30', DATE '2026-08-29', 2357.5, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 117). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3f1e711d-87c0-4544-a570-f0d1130baab9', 'd95ee3af-8316-427e-92dc-266688bd2f0b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3f1e711d-87c0-4544-a570-f0d1130baab9', 'd95ee3af-8316-427e-92dc-266688bd2f0b', DATE '2026-08-29', 2357.5, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 119 | apLIS lote 6327
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6b0dc171-b36d-4d2c-80f5-42fdc43280b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6327', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', '828941', '6327', 22610.55, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e5144d8-1a66-4144-ad27-17c475345b84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-07-21', DATE '2026-09-19', 22610.55, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 119). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e5144d8-1a66-4144-ad27-17c475345b84', '6b0dc171-b36d-4d2c-80f5-42fdc43280b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3e5144d8-1a66-4144-ad27-17c475345b84', '6b0dc171-b36d-4d2c-80f5-42fdc43280b1', DATE '2026-09-19', 22610.55, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 120 | apLIS lote 6356
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6bcefdd1-ec26-456d-b2d1-a21be9aee452', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6356', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '829165', '6356', 1515.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d0e6eba-a31b-47c4-a47c-70181652de3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-07-23', DATE '2026-09-21', 1515.44, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 120). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d0e6eba-a31b-47c4-a47c-70181652de3c', '6bcefdd1-ec26-456d-b2d1-a21be9aee452');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7d0e6eba-a31b-47c4-a47c-70181652de3c', '6bcefdd1-ec26-456d-b2d1-a21be9aee452', DATE '2026-09-21', 1515.44, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 121 | apLIS lote 6364
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3241bc3d-6f01-4ef5-b0c7-dff9a6985f8b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6364', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '829198', '6364', 898.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('08e8845e-030d-40c1-a3f0-71a2da57e245', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-07-23', DATE '2026-09-21', 898.69, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 121). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('08e8845e-030d-40c1-a3f0-71a2da57e245', '3241bc3d-6f01-4ef5-b0c7-dff9a6985f8b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('08e8845e-030d-40c1-a3f0-71a2da57e245', '3241bc3d-6f01-4ef5-b0c7-dff9a6985f8b', DATE '2026-09-21', 898.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 122 | apLIS lote 6207
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3ea5e07a-13d9-4adc-ad0e-90ec62d187ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6207', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '142013', '6207', 50.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('01c5e45f-91f6-49f6-b384-c45a81d2c21d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-02', DATE '2026-07-30', 50.19, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 122). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('01c5e45f-91f6-49f6-b384-c45a81d2c21d', '3ea5e07a-13d9-4adc-ad0e-90ec62d187ae');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('01c5e45f-91f6-49f6-b384-c45a81d2c21d', '3ea5e07a-13d9-4adc-ad0e-90ec62d187ae', DATE '2026-07-30', DATE '2026-08-17', 50.19, 50.19, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 123 | apLIS lote 6209
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8202fc5c-dcf7-4aba-b4a9-6dc197f1bdf0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6209', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '142042', '6209', 162.47, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e8367b35-8bf8-4538-b61b-b34e63d84ccd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-02', DATE '2026-07-30', 162.47, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 123). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e8367b35-8bf8-4538-b61b-b34e63d84ccd', '8202fc5c-dcf7-4aba-b4a9-6dc197f1bdf0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e8367b35-8bf8-4538-b61b-b34e63d84ccd', '8202fc5c-dcf7-4aba-b4a9-6dc197f1bdf0', DATE '2026-07-30', DATE '2026-08-17', 162.47, 162.47, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 124 | apLIS lote 6208
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0e288154-9946-4531-ac1c-f6b847fc09b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6208', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '142032', '6208', 3879.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7936ca20-2388-4fe0-b12b-100d6bb5b17d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-02', DATE '2026-07-30', 3879.11, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 124). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7936ca20-2388-4fe0-b12b-100d6bb5b17d', '0e288154-9946-4531-ac1c-f6b847fc09b1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7936ca20-2388-4fe0-b12b-100d6bb5b17d', '0e288154-9946-4531-ac1c-f6b847fc09b1', DATE '2026-07-30', DATE '2026-08-17', 3879.11, 3879.11, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 125 | apLIS lote 6210
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61d6517c-ed8e-43f4-a097-f605863ac268', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6210', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '142085', '6210', 1948.52, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b47a5f7-7164-460c-8881-a7f0a8708c48', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-02', DATE '2026-07-30', 1948.52, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 125). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b47a5f7-7164-460c-8881-a7f0a8708c48', '61d6517c-ed8e-43f4-a097-f605863ac268');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0b47a5f7-7164-460c-8881-a7f0a8708c48', '61d6517c-ed8e-43f4-a097-f605863ac268', DATE '2026-07-30', 1948.52, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 126 | apLIS lote 6211
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5e523fd3-c0a3-4af9-b955-262f0bf28b09', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6211', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '142108', '6211', 1614.49, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bb1f73e5-cec4-4e9b-82f4-8c178184c2d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-02', DATE '2026-07-30', 1614.49, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 126). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bb1f73e5-cec4-4e9b-82f4-8c178184c2d8', '5e523fd3-c0a3-4af9-b955-262f0bf28b09');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bb1f73e5-cec4-4e9b-82f4-8c178184c2d8', '5e523fd3-c0a3-4af9-b955-262f0bf28b09', DATE '2026-07-30', DATE '2026-08-17', 1614.49, 1614.49, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 127 | apLIS lote 6215
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1ff5def9-3ecb-4193-9c59-21ecbbd1a749', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6215', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', '142158', '6215', 1138.45, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0e5ebae2-43fd-4d48-91e3-e23929280c55', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-07-03', DATE '2026-07-31', 1138.45, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 127). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0e5ebae2-43fd-4d48-91e3-e23929280c55', '1ff5def9-3ecb-4193-9c59-21ecbbd1a749');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('0e5ebae2-43fd-4d48-91e3-e23929280c55', '1ff5def9-3ecb-4193-9c59-21ecbbd1a749', DATE '2026-07-31', DATE '2026-08-17', 1138.45, 1138.45, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 128 | apLIS lote 5456
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bb3df14c-2c0e-4fb5-9d35-297143b34a79', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5456', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '162008896', '5456', 1366.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c866aefa-1eb1-4919-b1cd-f4f18fda43df', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-07-01', DATE '2026-09-29', 1366.19, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 128). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c866aefa-1eb1-4919-b1cd-f4f18fda43df', 'bb3df14c-2c0e-4fb5-9d35-297143b34a79');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c866aefa-1eb1-4919-b1cd-f4f18fda43df', 'bb3df14c-2c0e-4fb5-9d35-297143b34a79', DATE '2026-09-29', 1366.19, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 129 | apLIS lote 4421
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1aff4de5-fac6-4af9-83e3-5366f610fd28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '4421', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '155772085', '4421', 10303.1, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-07-01', DATE '2026-09-29', 10303.1, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 129). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0', '1aff4de5-fac6-4af9-83e3-5366f610fd28');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0', '1aff4de5-fac6-4af9-83e3-5366f610fd28', DATE '2026-09-29', 10303.1, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 130 | apLIS lote 6222
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d04f50c8-1c70-4104-9af5-0c90a4e29a7e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6222', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', '164807556', '6222', 8898.57, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b39265f-3769-437f-9d1d-7bbb16828c90', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-07-06', DATE '2026-10-04', 8898.57, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 130). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b39265f-3769-437f-9d1d-7bbb16828c90', 'd04f50c8-1c70-4104-9af5-0c90a4e29a7e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5b39265f-3769-437f-9d1d-7bbb16828c90', 'd04f50c8-1c70-4104-9af5-0c90a4e29a7e', DATE '2026-10-04', 8898.57, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 131 | apLIS lote 6224
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fa2644ea-985a-4779-a73f-b190acd74c93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6224', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', '164815626', '6224', 2946.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4773a181-f58b-406c-840a-d60c79ef1912', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-07-06', DATE '2026-10-04', 2946.78, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 131). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4773a181-f58b-406c-840a-d60c79ef1912', 'fa2644ea-985a-4779-a73f-b190acd74c93');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4773a181-f58b-406c-840a-d60c79ef1912', 'fa2644ea-985a-4779-a73f-b190acd74c93', DATE '2026-10-04', 2946.78, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 132 | apLIS lote 5971
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d7d46853-4deb-4458-96ed-d095cc78539c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '5971', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', '167537306', '5971', 736.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05508a05-a917-4043-aa32-357ae45dbfad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-07-08', DATE '2026-10-06', 736.06, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 132). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05508a05-a917-4043-aa32-357ae45dbfad', 'd7d46853-4deb-4458-96ed-d095cc78539c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('05508a05-a917-4043-aa32-357ae45dbfad', 'd7d46853-4deb-4458-96ed-d095cc78539c', DATE '2026-10-06', 736.06, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 133 | apLIS lote 6235
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c77b2023-6c3e-424c-9a36-11fe9a0691a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6235', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', '191012', '6235', 17462.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0fffdf83-1f41-4141-9d32-1d31e764eb88', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-07', DATE '2026-08-06', 17462.0, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 133). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0fffdf83-1f41-4141-9d32-1d31e764eb88', 'c77b2023-6c3e-424c-9a36-11fe9a0691a2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0fffdf83-1f41-4141-9d32-1d31e764eb88', 'c77b2023-6c3e-424c-9a36-11fe9a0691a2', DATE '2026-08-06', 17462.0, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 134 | apLIS lote 6259
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('595301af-1c24-4f75-a9a7-a093ef39f122', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6259', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '192925', '6259', 3815.49, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e00c967e-9d93-4611-8c19-c1e21f745fdf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-15', DATE '2026-08-14', 3815.49, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 134). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e00c967e-9d93-4611-8c19-c1e21f745fdf', '595301af-1c24-4f75-a9a7-a093ef39f122');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e00c967e-9d93-4611-8c19-c1e21f745fdf', '595301af-1c24-4f75-a9a7-a093ef39f122', DATE '2026-08-14', 3815.49, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 135 | apLIS lote 6236
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aed0166a-8b2e-4780-913b-48ec08d47333', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6236', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', '192951', '6236', 442.96, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('57f1d462-b78e-4c35-8a87-07075a8ee37f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-15', DATE '2026-08-14', 442.96, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 135). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('57f1d462-b78e-4c35-8a87-07075a8ee37f', 'aed0166a-8b2e-4780-913b-48ec08d47333');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('57f1d462-b78e-4c35-8a87-07075a8ee37f', 'aed0166a-8b2e-4780-913b-48ec08d47333', DATE '2026-08-14', 442.96, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 136 | apLIS lote 6296
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('93ecace6-d711-43dc-ae7d-f0f606441f46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6296', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', '193009', '6296', 11290.41, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2426b47a-e728-419a-a9a9-bef85129f012', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-16', DATE '2026-08-15', 11290.41, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 136). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2426b47a-e728-419a-a9a9-bef85129f012', '93ecace6-d711-43dc-ae7d-f0f606441f46');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2426b47a-e728-419a-a9a9-bef85129f012', '93ecace6-d711-43dc-ae7d-f0f606441f46', DATE '2026-08-15', 11290.41, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 137 | apLIS lote 6352
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b3bb6732-ab47-4f05-981b-8bc6703e8b47', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6352', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '194571', '6352', 6036.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1cf8f8f0-4de1-490d-b9ac-7d5c52af36cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-22', DATE '2026-08-21', 6036.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 137). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1cf8f8f0-4de1-490d-b9ac-7d5c52af36cf', 'b3bb6732-ab47-4f05-981b-8bc6703e8b47');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1cf8f8f0-4de1-490d-b9ac-7d5c52af36cf', 'b3bb6732-ab47-4f05-981b-8bc6703e8b47', DATE '2026-08-21', 6036.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 138 | apLIS lote 6404
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('51fae1f9-6d28-4995-8b4d-8fef1fe3e7ec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6404', DATE '2026-07-28', DATE '2026-07-28', 'Faturado', '196882', '6404', 8660.16, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8435565e-3d1c-4a0a-9c0b-764c98034547', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-07-28', DATE '2026-08-27', 8660.16, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 138). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8435565e-3d1c-4a0a-9c0b-764c98034547', '51fae1f9-6d28-4995-8b4d-8fef1fe3e7ec');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8435565e-3d1c-4a0a-9c0b-764c98034547', '51fae1f9-6d28-4995-8b4d-8fef1fe3e7ec', DATE '2026-08-27', 8660.16, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 139 | apLIS lote 6196
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60f17dda-7d97-4732-8654-7bf4cbd9dc4b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6196', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', 'PEG 4346734', '6196', 13353.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e267fa4d-77e3-4f8b-901a-f1babaa15b02', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-07-01', DATE '2026-08-30', 13353.64, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 139). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e267fa4d-77e3-4f8b-901a-f1babaa15b02', '60f17dda-7d97-4732-8654-7bf4cbd9dc4b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e267fa4d-77e3-4f8b-901a-f1babaa15b02', '60f17dda-7d97-4732-8654-7bf4cbd9dc4b', DATE '2026-08-30', 13353.64, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 140 | apLIS lote 6127
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c737f499-5a8b-42d8-bea8-7f40b543ee35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6127', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', 'PEG 4352910', '6127', 3705.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c6bf2d13-112c-4ce3-8196-a592443b62dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-07-02', DATE '2026-08-31', 3705.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 140). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c6bf2d13-112c-4ce3-8196-a592443b62dc', 'c737f499-5a8b-42d8-bea8-7f40b543ee35');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c6bf2d13-112c-4ce3-8196-a592443b62dc', 'c737f499-5a8b-42d8-bea8-7f40b543ee35', DATE '2026-08-31', 3705.76, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 141 | apLIS lote 6156
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('93238520-be25-4175-ab00-a8a04f4be7df', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6156', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', 'PEG 39844', '6156', 6723.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4dac4322-5e51-42fc-9d55-79012f4625e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-07-01', DATE '2026-08-31', 6723.59, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 141). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4dac4322-5e51-42fc-9d55-79012f4625e1', '93238520-be25-4175-ab00-a8a04f4be7df');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('4dac4322-5e51-42fc-9d55-79012f4625e1', '93238520-be25-4175-ab00-a8a04f4be7df', DATE '2026-08-31', DATE '2026-08-27', 6723.59, 6723.59, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 142 | apLIS lote 4828
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e97e795-ff57-46ad-99b4-5fa4084faf75', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4828', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', 'PEG 465721', '4828', 8666.21, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f0028c4e-b33c-47bc-8f18-aff1d82101b7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-03', DATE '2026-08-02', 8666.21, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 142). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f0028c4e-b33c-47bc-8f18-aff1d82101b7', '6e97e795-ff57-46ad-99b4-5fa4084faf75');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f0028c4e-b33c-47bc-8f18-aff1d82101b7', '6e97e795-ff57-46ad-99b4-5fa4084faf75', DATE '2026-08-02', 8666.21, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 143 | apLIS lote 4905
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('82b68e92-8539-4a44-8a96-2c8432c7017d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4905', DATE '2026-07-03', DATE '2026-07-03', 'Faturado', 'PEG 465398', '4905', 20391.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d5a900aa-9851-49c7-8baa-d23690a73aad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-03', DATE '2026-08-02', 20391.0, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 143). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d5a900aa-9851-49c7-8baa-d23690a73aad', '82b68e92-8539-4a44-8a96-2c8432c7017d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d5a900aa-9851-49c7-8baa-d23690a73aad', '82b68e92-8539-4a44-8a96-2c8432c7017d', DATE '2026-08-02', 20391.0, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 144 | apLIS lote 6227
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('52c100b4-1d5b-4ad7-8510-716f91a2c946', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6227', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', '465833', '6227', 23998.25, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e5fe397f-d9b1-4c66-8470-ff413652095b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-06', DATE '2026-08-05', 23998.25, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 144). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e5fe397f-d9b1-4c66-8470-ff413652095b', '52c100b4-1d5b-4ad7-8510-716f91a2c946');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e5fe397f-d9b1-4c66-8470-ff413652095b', '52c100b4-1d5b-4ad7-8510-716f91a2c946', DATE '2026-08-05', 23998.25, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 145 | apLIS lote 6228
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c83ebe44-f5af-4f6c-a117-05685d53d88c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6228', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', '465979', '6228', 11589.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('117bc89f-b882-4708-ab60-a86a38a75325', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-06', DATE '2026-08-05', 11589.86, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 145). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('117bc89f-b882-4708-ab60-a86a38a75325', 'c83ebe44-f5af-4f6c-a117-05685d53d88c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('117bc89f-b882-4708-ab60-a86a38a75325', 'c83ebe44-f5af-4f6c-a117-05685d53d88c', DATE '2026-08-05', 11589.86, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 146 | apLIS lote 6220
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ebf8cf5b-45a2-47e4-8b0f-82ded2232719', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6220', DATE '2026-07-06', DATE '2026-07-06', 'Faturado', 'PEG 466001', '6220', 8396.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2ce9e273-ad74-412d-88da-7373b33cd500', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-06', DATE '2026-08-05', 8396.22, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 146). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2ce9e273-ad74-412d-88da-7373b33cd500', 'ebf8cf5b-45a2-47e4-8b0f-82ded2232719');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2ce9e273-ad74-412d-88da-7373b33cd500', 'ebf8cf5b-45a2-47e4-8b0f-82ded2232719', DATE '2026-08-05', 8396.22, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 147 | apLIS lote 6230
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53537d93-b111-4f90-b597-4c89dcdbb22c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6230', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', '466087', '6230', 1666.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d52a78dc-d14c-4149-9b8a-1ad08c9ef7f4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-07', DATE '2026-08-06', 1666.35, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 147). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d52a78dc-d14c-4149-9b8a-1ad08c9ef7f4', '53537d93-b111-4f90-b597-4c89dcdbb22c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d52a78dc-d14c-4149-9b8a-1ad08c9ef7f4', '53537d93-b111-4f90-b597-4c89dcdbb22c', DATE '2026-08-06', 1666.35, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 148 | apLIS lote 4898
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0e91c209-623d-4c1b-a9ed-34d773083443', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4898', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', 'PEG 466189', '4898', 26146.18, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('30f4390a-e1cb-454b-b50f-bd84dd0d4d44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-07', DATE '2026-08-06', 26146.18, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 148). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('30f4390a-e1cb-454b-b50f-bd84dd0d4d44', '0e91c209-623d-4c1b-a9ed-34d773083443');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('30f4390a-e1cb-454b-b50f-bd84dd0d4d44', '0e91c209-623d-4c1b-a9ed-34d773083443', DATE '2026-08-06', 26146.18, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 149 | apLIS lote 6231
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a7390ff0-7307-4bb6-a47f-b8c6a110b05e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6231', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', 'PEG 466285', '6231', 2146.41, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fe46b17f-13ce-442c-a5e4-6ad166a7208f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-07', DATE '2026-08-06', 2146.41, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 149). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fe46b17f-13ce-442c-a5e4-6ad166a7208f', 'a7390ff0-7307-4bb6-a47f-b8c6a110b05e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fe46b17f-13ce-442c-a5e4-6ad166a7208f', 'a7390ff0-7307-4bb6-a47f-b8c6a110b05e', DATE '2026-08-06', 2146.41, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 150 | apLIS lote 4989
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('91b05acd-bd38-4fb1-b482-e5aa1ed986da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4989', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', 'PEG 466349', '4989', 10353.17, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b7fb135c-4876-4c3f-8056-b37555fee5b0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-07', DATE '2026-08-06', 10353.17, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 150). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b7fb135c-4876-4c3f-8056-b37555fee5b0', '91b05acd-bd38-4fb1-b482-e5aa1ed986da');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b7fb135c-4876-4c3f-8056-b37555fee5b0', '91b05acd-bd38-4fb1-b482-e5aa1ed986da', DATE '2026-08-06', 10353.17, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 151 | apLIS lote 4827
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2d9d84ce-36ab-4760-8d16-5de8a71768ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4827', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 466488', '4827', 22201.46, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c8670921-b039-4b79-a0f2-dca97c852caa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-08', DATE '2026-08-07', 22201.46, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 151). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c8670921-b039-4b79-a0f2-dca97c852caa', '2d9d84ce-36ab-4760-8d16-5de8a71768ab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c8670921-b039-4b79-a0f2-dca97c852caa', '2d9d84ce-36ab-4760-8d16-5de8a71768ab', DATE '2026-08-07', 22201.46, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 152 | apLIS lote 6238
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e5ec0c26-5e27-4647-a244-a08c62d0fa28', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6238', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 466505', '6238', 1760.77, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ae8aa59-ffe5-4b1e-a315-d71e201118c4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-08', DATE '2026-08-07', 1760.77, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 152). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ae8aa59-ffe5-4b1e-a315-d71e201118c4', 'e5ec0c26-5e27-4647-a244-a08c62d0fa28');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6ae8aa59-ffe5-4b1e-a315-d71e201118c4', 'e5ec0c26-5e27-4647-a244-a08c62d0fa28', DATE '2026-08-07', 1760.77, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 153 | apLIS lote 4826
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3b0921d-0703-498e-bf00-04a6ce68e133', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '4826', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 466561', '4826', 15474.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2d4f91a4-5ce1-4379-9ea2-1bd8c9d83bcd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-08', DATE '2026-08-07', 15474.06, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 153). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2d4f91a4-5ce1-4379-9ea2-1bd8c9d83bcd', 'f3b0921d-0703-498e-bf00-04a6ce68e133');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2d4f91a4-5ce1-4379-9ea2-1bd8c9d83bcd', 'f3b0921d-0703-498e-bf00-04a6ce68e133', DATE '2026-08-07', 15474.06, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 154 | apLIS lote 6243
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9c937d21-045c-4973-8dc2-fa1114152400', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6243', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 466593', '6243', 5498.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('72fb35b5-0118-4858-9a7c-64b4cf902c2d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-08', DATE '2026-08-07', 5498.95, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 154). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('72fb35b5-0118-4858-9a7c-64b4cf902c2d', '9c937d21-045c-4973-8dc2-fa1114152400');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('72fb35b5-0118-4858-9a7c-64b4cf902c2d', '9c937d21-045c-4973-8dc2-fa1114152400', DATE '2026-08-07', 5498.95, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 155 | apLIS lote 6247
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('39993c40-51c4-41a5-9cde-71002ab9691c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6247', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 466647', '6247', 2700.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a112e8f8-8a11-42ca-b1a3-9096dbebe800', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-08', DATE '2026-08-07', 2700.9, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 155). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a112e8f8-8a11-42ca-b1a3-9096dbebe800', '39993c40-51c4-41a5-9cde-71002ab9691c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a112e8f8-8a11-42ca-b1a3-9096dbebe800', '39993c40-51c4-41a5-9cde-71002ab9691c', DATE '2026-08-07', 2700.9, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 156 | apLIS lote 6299
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('871bbcb5-0f86-4828-80a0-478a6dbfe119', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6299', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', '469331', '6299', 24639.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3692cf9d-dc9d-4fc5-8f89-40035f8e4bf5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-16', DATE '2026-08-17', 24639.01, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 156). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3692cf9d-dc9d-4fc5-8f89-40035f8e4bf5', '871bbcb5-0f86-4828-80a0-478a6dbfe119');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3692cf9d-dc9d-4fc5-8f89-40035f8e4bf5', '871bbcb5-0f86-4828-80a0-478a6dbfe119', DATE '2026-08-17', 24639.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 157 | apLIS lote 6300
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('753bd2ba-eff2-41a6-814a-6bfb847727a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6300', DATE '2026-07-17', DATE '2026-07-17', 'Faturado', '469634', '6300', 18464.23, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('acc6e9ab-c0a5-405d-9cc6-866cc4fd62c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-17', DATE '2026-08-18', 18464.23, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 157). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('acc6e9ab-c0a5-405d-9cc6-866cc4fd62c0', '753bd2ba-eff2-41a6-814a-6bfb847727a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('acc6e9ab-c0a5-405d-9cc6-866cc4fd62c0', '753bd2ba-eff2-41a6-814a-6bfb847727a0', DATE '2026-08-18', 18464.23, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 158 | apLIS lote 6324
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d5eda2d7-1b9b-45b7-9a26-ae8949f4104c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6324', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', '470145', '6324', 15672.34, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('56d6a23f-1b1a-4f09-8f84-2cb05cf666c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-20', DATE '2026-08-21', 15672.34, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 158). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('56d6a23f-1b1a-4f09-8f84-2cb05cf666c2', 'd5eda2d7-1b9b-45b7-9a26-ae8949f4104c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('56d6a23f-1b1a-4f09-8f84-2cb05cf666c2', 'd5eda2d7-1b9b-45b7-9a26-ae8949f4104c', DATE '2026-08-21', 15672.34, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 159 | apLIS lote 6350
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('40feee73-ebb9-4fa6-9d45-9b65407607dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6350', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '471125', '6350', 9380.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8be5ecd9-c43e-4660-b6f0-6bfa5ee58d98', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-22', DATE '2026-08-21', 9380.38, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 159). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8be5ecd9-c43e-4660-b6f0-6bfa5ee58d98', '40feee73-ebb9-4fa6-9d45-9b65407607dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8be5ecd9-c43e-4660-b6f0-6bfa5ee58d98', '40feee73-ebb9-4fa6-9d45-9b65407607dc', DATE '2026-08-21', 9380.38, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 160 | apLIS lote 6366
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53a6f0a9-db60-4791-8cb6-ba863586bb71', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6366', DATE '2026-07-23', DATE '2026-07-23', 'Faturado', '472057', '6366', 14945.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6923c10c-f54c-41e4-ae00-b9d47947fd44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-23', DATE '2026-08-21', 14945.59, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 160). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6923c10c-f54c-41e4-ae00-b9d47947fd44', '53a6f0a9-db60-4791-8cb6-ba863586bb71');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6923c10c-f54c-41e4-ae00-b9d47947fd44', '53a6f0a9-db60-4791-8cb6-ba863586bb71', DATE '2026-08-21', 14945.59, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 161 | apLIS lote 6406
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('924bf8b4-6c3e-438e-bbb8-745c4025375b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6406', DATE '2026-07-29', DATE '2026-07-29', 'Faturado', '474041', '6406', 19095.03, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3fa926c6-abd6-4c43-8548-ded1c3cbaeff', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-29', DATE '2026-07-29', 19095.03, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 161). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3fa926c6-abd6-4c43-8548-ded1c3cbaeff', '924bf8b4-6c3e-438e-bbb8-745c4025375b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3fa926c6-abd6-4c43-8548-ded1c3cbaeff', '924bf8b4-6c3e-438e-bbb8-745c4025375b', DATE '2026-07-29', 19095.03, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 162 | apLIS lote 6407
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ca3bba38-70a1-4c5e-aac9-2c83123ceeb5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6407', DATE '2026-07-29', DATE '2026-07-29', 'Faturado', '474112', '6407', 10959.61, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f8feb951-d1f6-4e3f-9494-c22e62a3e8f3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-07-29', DATE '2026-07-29', 10959.61, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 162). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f8feb951-d1f6-4e3f-9494-c22e62a3e8f3', 'ca3bba38-70a1-4c5e-aac9-2c83123ceeb5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f8feb951-d1f6-4e3f-9494-c22e62a3e8f3', 'ca3bba38-70a1-4c5e-aac9-2c83123ceeb5', DATE '2026-07-29', 10959.61, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 163 | apLIS lote 6322
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0921daca-3906-4050-a517-c6b6d14d5091', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6322', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', 'PEG 81451', '6322', 13680.26, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('80e3a3cc-8eea-4147-9369-dc0a422d53c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-07-20', DATE '2026-08-19', 13680.26, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 163). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('80e3a3cc-8eea-4147-9369-dc0a422d53c0', '0921daca-3906-4050-a517-c6b6d14d5091');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('80e3a3cc-8eea-4147-9369-dc0a422d53c0', '0921daca-3906-4050-a517-c6b6d14d5091', DATE '2026-08-19', 13680.26, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 164 | apLIS lote 6320
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e985ff8-dcbc-4533-9eef-c7497e5c30bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6320', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', 'PEG 81554', '6320', 27113.96, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7e4b57e5-3da0-4456-a498-f99ba3851425', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-07-21', DATE '2026-08-20', 27113.96, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 164). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7e4b57e5-3da0-4456-a498-f99ba3851425', '7e985ff8-dcbc-4533-9eef-c7497e5c30bd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7e4b57e5-3da0-4456-a498-f99ba3851425', '7e985ff8-dcbc-4533-9eef-c7497e5c30bd', DATE '2026-08-20', 27113.96, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 165 | apLIS lote 6319
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a7be43c9-81fe-433c-9529-04541772682f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6319', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', 'PEG 81860', '6319', 24809.29, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e96f312-2642-44bf-b5fa-e36075d93013', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-07-21', DATE '2026-08-20', 24809.29, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 165). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e96f312-2642-44bf-b5fa-e36075d93013', 'a7be43c9-81fe-433c-9529-04541772682f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3e96f312-2642-44bf-b5fa-e36075d93013', 'a7be43c9-81fe-433c-9529-04541772682f', DATE '2026-08-20', 24809.29, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 166 | apLIS lote 6323
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e4327bef-dbd5-4500-8baf-2ec18ade3c69', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6323', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', 'PEG 82062', '6323', 9156.12, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed776953-8a6f-45ad-b346-95d3d6fde48d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-07-21', DATE '2026-08-20', 9156.12, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 166). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed776953-8a6f-45ad-b346-95d3d6fde48d', 'e4327bef-dbd5-4500-8baf-2ec18ade3c69');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ed776953-8a6f-45ad-b346-95d3d6fde48d', 'e4327bef-dbd5-4500-8baf-2ec18ade3c69', DATE '2026-08-20', 9156.12, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 168 | apLIS lote 6341
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('30e04c25-382e-452e-b87f-33ed1c997657', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6341', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', 'PEG 82130', '6341', 76.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5b66cc5a-c9db-4c04-b1e6-02c3fa7dbf51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-07-21', DATE '2026-08-20', 76.85, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 168). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5b66cc5a-c9db-4c04-b1e6-02c3fa7dbf51', '30e04c25-382e-452e-b87f-33ed1c997657');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5b66cc5a-c9db-4c04-b1e6-02c3fa7dbf51', '30e04c25-382e-452e-b87f-33ed1c997657', DATE '2026-08-20', 76.85, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 169 | apLIS lote 6111
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('845c6074-8d07-453b-9f40-8173675844a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6111', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', 'PEG 223432', '6111', 763.67, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('64ed0dd0-d63d-4307-9b34-cbd7a2a2c2a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-08', DATE '2026-09-06', 763.67, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 169). Responsável: Rivia. Status original na planilha: DEVOLVIDO. Refaturamento: sim.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('64ed0dd0-d63d-4307-9b34-cbd7a2a2c2a2', '845c6074-8d07-453b-9f40-8173675844a7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('64ed0dd0-d63d-4307-9b34-cbd7a2a2c2a2', '845c6074-8d07-453b-9f40-8173675844a7', DATE '2026-09-06', DATE '2026-08-03', 763.67, 0.0, 'parcial', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 170 | apLIS lote 5406
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4d086351-9676-49d8-902e-4433e08d96c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5406', DATE '2026-07-15', DATE '2026-07-15', 'Faturado', 'PEG 224234', '5406', 3280.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6dd7159b-a9b4-471a-beb0-f55b60835b32', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-15', DATE '2026-07-15', 3280.86, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 170). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6dd7159b-a9b4-471a-beb0-f55b60835b32', '4d086351-9676-49d8-902e-4433e08d96c1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6dd7159b-a9b4-471a-beb0-f55b60835b32', '4d086351-9676-49d8-902e-4433e08d96c1', DATE '2026-07-15', 3280.86, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 171 | apLIS lote 6289
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b40bf81-9d7b-46ff-b123-937a60d661f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6289', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', 'PEG 224308', '6289', 1340.3, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aba7c5ce-81f9-4344-8488-dc120be70bb5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-16', DATE '2026-07-16', 1340.3, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 171). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aba7c5ce-81f9-4344-8488-dc120be70bb5', '5b40bf81-9d7b-46ff-b123-937a60d661f9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('aba7c5ce-81f9-4344-8488-dc120be70bb5', '5b40bf81-9d7b-46ff-b123-937a60d661f9', DATE '2026-07-16', 1340.3, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 172 | apLIS lote 6283
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b7a0c897-e18d-4f9f-a965-865be37b4da7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6283', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', 'PEG 224441', '6283', 18156.68, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e60ac45c-62c8-4d70-8e03-a90c87f1f6c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-16', DATE '2026-07-16', 18156.68, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 172). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e60ac45c-62c8-4d70-8e03-a90c87f1f6c5', 'b7a0c897-e18d-4f9f-a965-865be37b4da7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e60ac45c-62c8-4d70-8e03-a90c87f1f6c5', 'b7a0c897-e18d-4f9f-a965-865be37b4da7', DATE '2026-07-16', 18156.68, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 173 | apLIS lote 6385
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e4222871-b800-492c-902e-e4701e1f281c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6385', DATE '2026-07-27', DATE '2026-07-27', 'Faturado', '225506', '6385', 5604.94, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a555519e-5ee5-4a65-8ebd-8481d7b08188', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-27', DATE '2026-07-27', 5604.94, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 173). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a555519e-5ee5-4a65-8ebd-8481d7b08188', 'e4222871-b800-492c-902e-e4701e1f281c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a555519e-5ee5-4a65-8ebd-8481d7b08188', 'e4222871-b800-492c-902e-e4701e1f281c', DATE '2026-07-27', 5604.94, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 174 | apLIS lote 6395
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1f74fc42-8d82-49b0-b046-08b9c1496e13', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6395', DATE '2026-07-28', DATE '2026-07-28', 'Faturado', 'PEG 225710', '6395', 273.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('493d7f2f-6de2-4464-995b-59c347906606', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-28', DATE '2026-07-28', 273.51, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 174). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('493d7f2f-6de2-4464-995b-59c347906606', '1f74fc42-8d82-49b0-b046-08b9c1496e13');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('493d7f2f-6de2-4464-995b-59c347906606', '1f74fc42-8d82-49b0-b046-08b9c1496e13', DATE '2026-07-28', 273.51, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 175 | apLIS lote 6375
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6da59fbd-e906-43bf-93d0-3c962c3a6fbb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6375', DATE '2026-07-29', DATE '2026-07-29', 'Faturado', 'PEG 225877', '6375', 214.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7eb0f969-ea9e-4bcb-802a-4620b7cd0f35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-07-29', DATE '2026-07-29', 214.64, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 175). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7eb0f969-ea9e-4bcb-802a-4620b7cd0f35', '6da59fbd-e906-43bf-93d0-3c962c3a6fbb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7eb0f969-ea9e-4bcb-802a-4620b7cd0f35', '6da59fbd-e906-43bf-93d0-3c962c3a6fbb', DATE '2026-07-29', 214.64, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 176 | apLIS lote 6237
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2460b98-43c6-49c8-91c2-5a5a716ad9e8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6237', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', '7487185', '6237', 23409.29, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e707d806-35a2-4000-88cc-3e6645361740', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-07', DATE '2026-08-06', 23409.29, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 176). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e707d806-35a2-4000-88cc-3e6645361740', 'e2460b98-43c6-49c8-91c2-5a5a716ad9e8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e707d806-35a2-4000-88cc-3e6645361740', 'e2460b98-43c6-49c8-91c2-5a5a716ad9e8', DATE '2026-08-06', DATE '2026-08-11', 23409.29, 23409.29, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 177 | apLIS lote 6239
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('99191770-21e9-40fb-8379-6c8ab5a56b9e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6239', DATE '2026-07-07', DATE '2026-07-07', 'Faturado', '7487205', '6239', 68.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('382573fb-df7b-43d4-9274-06face87eb87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-07', DATE '2026-08-06', 68.75, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 177). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('382573fb-df7b-43d4-9274-06face87eb87', '99191770-21e9-40fb-8379-6c8ab5a56b9e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('382573fb-df7b-43d4-9274-06face87eb87', '99191770-21e9-40fb-8379-6c8ab5a56b9e', DATE '2026-08-06', DATE '2026-08-11', 68.75, 68.75, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 178 | apLIS lote 6256
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f4db77e6-a1d8-41f0-96ed-7cb928ff1133', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6256', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '7495227', '6256', 23090.8, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fbb8b1a7-847a-4cdc-89dc-8346365fdd33', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-10', DATE '2026-08-09', 23090.8, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 178). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fbb8b1a7-847a-4cdc-89dc-8346365fdd33', 'f4db77e6-a1d8-41f0-96ed-7cb928ff1133');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('fbb8b1a7-847a-4cdc-89dc-8346365fdd33', 'f4db77e6-a1d8-41f0-96ed-7cb928ff1133', DATE '2026-08-09', DATE '2026-08-11', 23090.8, 23090.8, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 179 | apLIS lote 4902
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6404a603-ec4d-4e31-8415-8550ff225afa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '4902', DATE '2026-07-10', DATE '2026-07-10', 'Faturado', '7495310', '4902', 375.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c9031da8-e734-4bb7-93cd-7b9f7445865a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-10', DATE '2026-08-09', 375.11, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 179). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c9031da8-e734-4bb7-93cd-7b9f7445865a', '6404a603-ec4d-4e31-8415-8550ff225afa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c9031da8-e734-4bb7-93cd-7b9f7445865a', '6404a603-ec4d-4e31-8415-8550ff225afa', DATE '2026-08-09', DATE '2026-08-11', 375.11, 375.11, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 180 | apLIS lote 6314
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('14e53469-bccf-4219-aaab-aea93888c756', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6314', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', '7508467', '6314', 23058.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('434501c0-77c4-4a7f-87f1-4865a4889bd9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-20', DATE '2026-08-19', 23058.22, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 180). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('434501c0-77c4-4a7f-87f1-4865a4889bd9', '14e53469-bccf-4219-aaab-aea93888c756');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('434501c0-77c4-4a7f-87f1-4865a4889bd9', '14e53469-bccf-4219-aaab-aea93888c756', DATE '2026-08-19', DATE '2026-08-24', 23058.22, 23058.22, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 181 | apLIS lote 6321
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3320477f-11ee-454f-bea6-05a375cabda1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6321', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', '7509353', '6321', 5222.84, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bab17d5f-f1e2-4402-aeb9-dc588e77cc45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-20', DATE '2026-08-19', 5222.84, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 181). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bab17d5f-f1e2-4402-aeb9-dc588e77cc45', '3320477f-11ee-454f-bea6-05a375cabda1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('bab17d5f-f1e2-4402-aeb9-dc588e77cc45', '3320477f-11ee-454f-bea6-05a375cabda1', DATE '2026-08-19', DATE '2026-08-24', 5222.84, 5222.84, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 182 | apLIS lote 6349
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('802e21ab-5c32-4380-9945-c3a4f3d24b42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6349', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '7514476', '6349', 3448.81, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6ee5f886-8588-489d-b030-57543557cc01', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-22', DATE '2026-08-21', 3448.81, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 182). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6ee5f886-8588-489d-b030-57543557cc01', '802e21ab-5c32-4380-9945-c3a4f3d24b42');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('6ee5f886-8588-489d-b030-57543557cc01', '802e21ab-5c32-4380-9945-c3a4f3d24b42', DATE '2026-08-21', DATE '2026-08-24', 3448.81, 3448.81, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 183 | apLIS lote 6351
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1afdcf7f-79bc-47e5-a962-5ebacb63d71f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6351', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '7514788', '6351', 324.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7c93b428-27f9-4a9b-bb29-2d41fdd080e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-07-22', DATE '2026-08-21', 324.51, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 183). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7c93b428-27f9-4a9b-bb29-2d41fdd080e1', '1afdcf7f-79bc-47e5-a962-5ebacb63d71f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('7c93b428-27f9-4a9b-bb29-2d41fdd080e1', '1afdcf7f-79bc-47e5-a962-5ebacb63d71f', DATE '2026-08-21', DATE '2026-08-24', 324.51, 324.51, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 184 | apLIS lote 6402
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('40e39dad-87a7-4df3-aa09-dea1bb623607', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6402', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731005903', '6402', 8480.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('52678899-d5f7-4093-a9bc-256ea632fd08', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-09-04', 8480.35, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 184). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('52678899-d5f7-4093-a9bc-256ea632fd08', '40e39dad-87a7-4df3-aa09-dea1bb623607');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('52678899-d5f7-4093-a9bc-256ea632fd08', '40e39dad-87a7-4df3-aa09-dea1bb623607', DATE '2026-09-04', 8480.35, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 185 | apLIS lote 6403
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0eb61d67-7a91-4f4c-974d-306dd9f59d7a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), '6403', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731012768', '6403', 1287.4, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1054'), DATE '2026-07-31', DATE '2026-09-04', 1287.4, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 185). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', '0eb61d67-7a91-4f4c-974d-306dd9f59d7a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', '0eb61d67-7a91-4f4c-974d-306dd9f59d7a', DATE '2026-09-04', 1287.4, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 186 | apLIS lote 6399
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('17785e01-84f0-475f-a1d3-0063e199dedc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6399', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731013888', '6399', 14736.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('783dfea6-d63b-4558-b078-1534a6cb6a45', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-09-04', 14736.01, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 186). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('783dfea6-d63b-4558-b078-1534a6cb6a45', '17785e01-84f0-475f-a1d3-0063e199dedc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('783dfea6-d63b-4558-b078-1534a6cb6a45', '17785e01-84f0-475f-a1d3-0063e199dedc', DATE '2026-09-04', 14736.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 187 | apLIS lote 6401
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8ea2db6f-64aa-49af-895e-aa57ea6ec33a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6401', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731005857', '6401', 4527.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f062bc06-865c-4d11-970d-06585f55b0b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-09-04', 4527.51, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 187). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f062bc06-865c-4d11-970d-06585f55b0b2', '8ea2db6f-64aa-49af-895e-aa57ea6ec33a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f062bc06-865c-4d11-970d-06585f55b0b2', '8ea2db6f-64aa-49af-895e-aa57ea6ec33a', DATE '2026-09-04', 4527.51, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 188 | apLIS lote 6427
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('99884df2-adc2-4932-99fe-09e1467e376b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6427', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731028724', '6427', 3729.91, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fdaffa23-6edd-4c61-a794-fdbfeedec031', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-09-04', 3729.91, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 188). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fdaffa23-6edd-4c61-a794-fdbfeedec031', '99884df2-adc2-4932-99fe-09e1467e376b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fdaffa23-6edd-4c61-a794-fdbfeedec031', '99884df2-adc2-4932-99fe-09e1467e376b', DATE '2026-09-04', 3729.91, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 189 | apLIS lote 6400
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('174d313e-cfb5-4943-bef9-f1843149d486', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6400', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731015043', '6400', 18334.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('60836fdc-1f63-4290-8051-c2165198b568', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-07-31', 18334.72, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 189). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('60836fdc-1f63-4290-8051-c2165198b568', '174d313e-cfb5-4943-bef9-f1843149d486');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('60836fdc-1f63-4290-8051-c2165198b568', '174d313e-cfb5-4943-bef9-f1843149d486', DATE '2026-07-31', 18334.72, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 190 | apLIS lote 6426
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('154eea9d-e7db-4f9c-8079-8499a341896b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6426', DATE '2026-07-31', DATE '2026-07-31', 'Faturado', '260731025362', '6426', 4407.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ed284ce2-029d-4d4b-9048-2d38c3aeae83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-07-31', DATE '2026-07-31', 4407.19, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 190). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ed284ce2-029d-4d4b-9048-2d38c3aeae83', '154eea9d-e7db-4f9c-8079-8499a341896b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ed284ce2-029d-4d4b-9048-2d38c3aeae83', '154eea9d-e7db-4f9c-8079-8499a341896b', DATE '2026-07-31', 4407.19, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 191 | apLIS lote 6112
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6d6a6ccc-c4cb-4e1d-b198-7b9ab5456e52', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6112', DATE '2026-07-09', DATE '2026-07-09', 'Faturado', 'PEG 490678', '6112', 2441.25, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fa228382-0aca-420e-95d4-e84f1847bcfe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-07-09', DATE '2026-08-08', 2441.25, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 191). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fa228382-0aca-420e-95d4-e84f1847bcfe', '6d6a6ccc-c4cb-4e1d-b198-7b9ab5456e52');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fa228382-0aca-420e-95d4-e84f1847bcfe', '6d6a6ccc-c4cb-4e1d-b198-7b9ab5456e52', DATE '2026-08-08', 2441.25, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 192 | apLIS lote 6262
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8a9c0834-866d-4989-bb3b-bff13cb8f2d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6262', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', 'PEG 491185', '6262', 24718.17, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('780bf5bf-6d58-444c-894c-751fb8135e6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-07-13', DATE '2026-08-12', 24718.17, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 192). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('780bf5bf-6d58-444c-894c-751fb8135e6b', '8a9c0834-866d-4989-bb3b-bff13cb8f2d1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('780bf5bf-6d58-444c-894c-751fb8135e6b', '8a9c0834-866d-4989-bb3b-bff13cb8f2d1', DATE '2026-08-12', 24718.17, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 193 | apLIS lote 6263
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3b8a773-edff-4fee-913f-0e848ef50b6a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6263', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', 'PEG 491435', '6263', 9950.21, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('201d52be-55d0-41a6-93a7-20ca3e745522', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-07-14', DATE '2026-08-13', 9950.21, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 193). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('201d52be-55d0-41a6-93a7-20ca3e745522', 'c3b8a773-edff-4fee-913f-0e848ef50b6a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('201d52be-55d0-41a6-93a7-20ca3e745522', 'c3b8a773-edff-4fee-913f-0e848ef50b6a', DATE '2026-08-13', 9950.21, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 194 | apLIS lote 6339
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0fd9649d-2b8a-44e3-b21c-06a305c1cbad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6339', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '7092796', '6339', 399.6, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5a247173-c6e3-4ebf-bda7-7a6e309a418c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-07-22', DATE '2026-08-14', 399.6, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 194). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5a247173-c6e3-4ebf-bda7-7a6e309a418c', '0fd9649d-2b8a-44e3-b21c-06a305c1cbad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('5a247173-c6e3-4ebf-bda7-7a6e309a418c', '0fd9649d-2b8a-44e3-b21c-06a305c1cbad', DATE '2026-08-14', DATE '2026-08-25', 399.6, 399.6, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 195 | apLIS lote 6342
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3beb611-abfa-4c75-afd3-9755b152dd38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6342', DATE '2026-07-22', DATE '2026-07-22', 'Faturado', '7092806', '6342', 32303.63, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-07-22', DATE '2026-08-14', 32303.63, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 195). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', 'c3beb611-abfa-4c75-afd3-9755b152dd38');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', 'c3beb611-abfa-4c75-afd3-9755b152dd38', DATE '2026-08-14', DATE '2026-08-25', 32303.63, 30216.35, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', 'c3beb611-abfa-4c75-afd3-9755b152dd38', 2087.28, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Renata');

-- JULHO linha 196 | apLIS lote 6116
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d05fc0d3-39d5-4377-8f64-1e6916e6dda0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6116', DATE '2026-07-24', DATE '2026-07-24', 'Faturado', '7097264', '6116', 79.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-07-24', DATE '2026-08-14', 79.92, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 196). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e', 'd05fc0d3-39d5-4377-8f64-1e6916e6dda0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e', 'd05fc0d3-39d5-4377-8f64-1e6916e6dda0', DATE '2026-08-14', DATE '2026-08-25', 79.92, 79.92, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, status, responsavel)
VALUES ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e', 'd05fc0d3-39d5-4377-8f64-1e6916e6dda0', 79.92, 'Glosa (backfill planilha Jul-Set/2026 — sem motivo detalhado na origem)', 'aberta', 'Rivia');

-- JULHO linha 197 | apLIS lote 6212
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53a46de2-e0c2-4ad0-8d81-f0d45a96a8a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6212', DATE '2026-07-02', DATE '2026-07-02', 'Faturado', '230301', '6212', 1934.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-07-02', DATE '2026-08-14', 1934.22, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 197). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26', '53a46de2-e0c2-4ad0-8d81-f0d45a96a8a8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26', '53a46de2-e0c2-4ad0-8d81-f0d45a96a8a8', DATE '2026-08-14', DATE '2026-08-27', 1934.22, 1796.5, 'parcial', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 198 | apLIS lote 5461
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64e39f2b-006c-4054-af54-c89c436bc099', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '5461', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '230791', '5461', 722.05, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('58e70ea4-b313-4a15-b5be-c45c048d6c7c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-07-13', DATE '2026-08-25', 722.05, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 198). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('58e70ea4-b313-4a15-b5be-c45c048d6c7c', '64e39f2b-006c-4054-af54-c89c436bc099');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('58e70ea4-b313-4a15-b5be-c45c048d6c7c', '64e39f2b-006c-4054-af54-c89c436bc099', DATE '2026-08-25', DATE '2026-08-27', 722.05, 722.05, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 199 | apLIS lote 6264
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f0536479-210e-4723-8aeb-69346c33dbd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6264', DATE '2026-07-13', DATE '2026-07-13', 'Faturado', '230794', '6264', 2116.71, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3bd77298-9a1d-4768-b1d7-e4a088c04e60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-07-13', DATE '2026-08-25', 2116.71, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 199). Responsável: Raquel. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3bd77298-9a1d-4768-b1d7-e4a088c04e60', 'f0536479-210e-4723-8aeb-69346c33dbd4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('3bd77298-9a1d-4768-b1d7-e4a088c04e60', 'f0536479-210e-4723-8aeb-69346c33dbd4', DATE '2026-08-25', DATE '2026-08-27', 2116.71, 2116.71, 'recebido', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 200 | apLIS lote 6338
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a6ca10f-8127-4cfa-958a-031b649ebc27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6338', DATE '2026-07-21', DATE '2026-07-21', 'Faturado', '231290', '6338', 1074.45, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d4f6a6c9-1e7e-4067-af16-eb166807ec42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-07-21', DATE '2026-09-02', 1074.45, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 200). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d4f6a6c9-1e7e-4067-af16-eb166807ec42', '1a6ca10f-8127-4cfa-958a-031b649ebc27');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d4f6a6c9-1e7e-4067-af16-eb166807ec42', '1a6ca10f-8127-4cfa-958a-031b649ebc27', DATE '2026-09-02', DATE '2026-08-27', 1074.45, 1074.45, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 201 | apLIS lote 5969
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1fe603e6-10b4-49a3-92bf-42f284cd2ea1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5969', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '63051', '5969', 4689.73, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ba670330-8577-40dd-9790-e26eb56fe51b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-07-01', DATE '2026-07-31', 4689.73, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 201). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ba670330-8577-40dd-9790-e26eb56fe51b', '1fe603e6-10b4-49a3-92bf-42f284cd2ea1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('ba670330-8577-40dd-9790-e26eb56fe51b', '1fe603e6-10b4-49a3-92bf-42f284cd2ea1', DATE '2026-07-31', DATE '2026-08-26', 4689.73, 4689.73, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 202 | apLIS lote 6201
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3364def9-9b15-4a00-b453-8455f61f6f7b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6201', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '63102', '6201', 239.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e0eb9bff-6320-4af3-9f9a-df01e77bd477', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-07-01', DATE '2026-07-31', 239.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 202). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e0eb9bff-6320-4af3-9f9a-df01e77bd477', '3364def9-9b15-4a00-b453-8455f61f6f7b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('e0eb9bff-6320-4af3-9f9a-df01e77bd477', '3364def9-9b15-4a00-b453-8455f61f6f7b', DATE '2026-07-31', DATE '2026-08-26', 239.76, 239.76, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 203 | apLIS lote 6162
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2ba8836a-7d95-41ad-b42e-4c8c5e9508d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6162', DATE '2026-07-08', DATE '2026-07-08', 'Faturado', '63264', '6162', 818.77, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d5c99a2c-6251-48a8-9842-9aad8b6c7ba9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-07-08', DATE '2026-08-07', 818.77, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 203). Responsável: Rivia. Status original na planilha: Vencido. [dado corrigido] número de lote da planilha não batia com o apLIS; lote real identificado via Protocolo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d5c99a2c-6251-48a8-9842-9aad8b6c7ba9', '2ba8836a-7d95-41ad-b42e-4c8c5e9508d3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('d5c99a2c-6251-48a8-9842-9aad8b6c7ba9', '2ba8836a-7d95-41ad-b42e-4c8c5e9508d3', DATE '2026-08-07', DATE '2026-08-26', 818.77, 818.77, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 204 | apLIS lote 6297
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9b242ca0-ae8f-49a3-b3e3-bba5912c90c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6297', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', '63499', '6297', 2775.99, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b4e71835-49c8-432d-957f-31ce0eedf2ef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-07-16', DATE '2026-08-15', 2775.99, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 204). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b4e71835-49c8-432d-957f-31ce0eedf2ef', '9b242ca0-ae8f-49a3-b3e3-bba5912c90c5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('b4e71835-49c8-432d-957f-31ce0eedf2ef', '9b242ca0-ae8f-49a3-b3e3-bba5912c90c5', DATE '2026-08-15', DATE '2026-08-26', 2775.99, 2775.99, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 205 | apLIS lote 6298
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c06c8082-1d49-4082-b3a3-507161a70ea8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6298', DATE '2026-07-16', DATE '2026-07-16', 'Faturado', '63500', '6298', 239.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0352d732-2086-4eac-a413-093adc50a156', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-07-16', DATE '2026-08-15', 239.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 205). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0352d732-2086-4eac-a413-093adc50a156', 'c06c8082-1d49-4082-b3a3-507161a70ea8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0352d732-2086-4eac-a413-093adc50a156', 'c06c8082-1d49-4082-b3a3-507161a70ea8', DATE '2026-08-15', 239.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 206 | apLIS lote 6279
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('73ce4be4-cfbe-4150-895b-bbdaf726b951', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '6279', DATE '2026-07-14', DATE '2026-07-14', 'Faturado', 'P20261254108', '6279', 11432.65, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('14e6fdbc-0e4b-4d60-9ddd-76d7f25fcd74', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), DATE '2026-07-14', DATE '2026-08-20', 11432.65, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 206). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('14e6fdbc-0e4b-4d60-9ddd-76d7f25fcd74', '73ce4be4-cfbe-4150-895b-bbdaf726b951');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('14e6fdbc-0e4b-4d60-9ddd-76d7f25fcd74', '73ce4be4-cfbe-4150-895b-bbdaf726b951', DATE '2026-08-20', DATE '2026-08-20', 11432.65, 11432.65, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 207 | apLIS lote 6318
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8fd873f-2e39-46bd-b5ec-d3835c246f8e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '6318', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', 'P20261254539', '6318', 549.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('193ad292-21a5-4590-b46b-2028e8a4465c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), DATE '2026-07-20', DATE '2026-08-20', 549.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 207). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('193ad292-21a5-4590-b46b-2028e8a4465c', 'a8fd873f-2e39-46bd-b5ec-d3835c246f8e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('193ad292-21a5-4590-b46b-2028e8a4465c', 'a8fd873f-2e39-46bd-b5ec-d3835c246f8e', DATE '2026-08-20', DATE '2026-08-20', 549.76, 549.76, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 208 | apLIS lote 6325
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('073607c9-77e6-4b21-ac75-16bb971b2d86', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), '6325', DATE '2026-07-20', DATE '2026-07-20', 'Faturado', 'P20261254648', '6325', 573.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('28c90e15-93fd-4f38-b8f1-31bd33bc1b8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1227'), DATE '2026-07-20', DATE '2026-08-20', 573.76, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 208). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('28c90e15-93fd-4f38-b8f1-31bd33bc1b8c', '073607c9-77e6-4b21-ac75-16bb971b2d86');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('28c90e15-93fd-4f38-b8f1-31bd33bc1b8c', '073607c9-77e6-4b21-ac75-16bb971b2d86', DATE '2026-08-20', DATE '2026-08-20', 573.76, 573.76, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- JULHO linha 209 | apLIS lote 6202
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1814424e-20ee-475d-ba8d-c16656710921', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '6202', DATE '2026-07-01', DATE '2026-07-01', 'Faturado', '4592', '6202', 2741.31, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ca4e0350-0c77-4cf5-bfac-b0f0fd6320c5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), DATE '2026-07-01', DATE '2026-07-31', 2741.31, '2026-07', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba JULHO, linha 209). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ca4e0350-0c77-4cf5-bfac-b0f0fd6320c5', '1814424e-20ee-475d-ba8d-c16656710921');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ca4e0350-0c77-4cf5-bfac-b0f0fd6320c5', '1814424e-20ee-475d-ba8d-c16656710921', DATE '2026-07-31', 2741.31, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 26 | apLIS lote 6511
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('02f10f74-1c4c-4ab9-9580-6eca6cfa8da4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6511', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727614', '6511', 4510.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8747d8f8-be07-4f7a-9238-8d927f3e7e57', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 4510.06, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 26). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8747d8f8-be07-4f7a-9238-8d927f3e7e57', '02f10f74-1c4c-4ab9-9580-6eca6cfa8da4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8747d8f8-be07-4f7a-9238-8d927f3e7e57', '02f10f74-1c4c-4ab9-9580-6eca6cfa8da4', DATE '2026-10-23', 4510.06, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 27 | apLIS lote 6623
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('48d8ecfb-0f8f-40e1-b154-ee64a21e8f4e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6623', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727707', '6623', 1327.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e21920b1-de7d-4f10-a1f7-31a75257869a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 1327.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 27). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e21920b1-de7d-4f10-a1f7-31a75257869a', '48d8ecfb-0f8f-40e1-b154-ee64a21e8f4e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e21920b1-de7d-4f10-a1f7-31a75257869a', '48d8ecfb-0f8f-40e1-b154-ee64a21e8f4e', DATE '2026-10-23', 1327.38, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 28 | apLIS lote 6492
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ff56ccc-0f22-4293-ac95-38c194e4d0c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6492', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6492', 328.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8d258421-1d86-4a1e-9399-1cc7ef927cea', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 328.02, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 28). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8d258421-1d86-4a1e-9399-1cc7ef927cea', '0ff56ccc-0f22-4293-ac95-38c194e4d0c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8d258421-1d86-4a1e-9399-1cc7ef927cea', '0ff56ccc-0f22-4293-ac95-38c194e4d0c0', DATE '2026-10-06', 328.02, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 29 | apLIS lote 6519
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f6e0447b-37de-4d77-a437-ece886b4b886', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6519', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6519', 90.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1e88f078-cf19-4d00-a0cc-49858fbd8def', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 90.85, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 29). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1e88f078-cf19-4d00-a0cc-49858fbd8def', 'f6e0447b-37de-4d77-a437-ece886b4b886');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1e88f078-cf19-4d00-a0cc-49858fbd8def', 'f6e0447b-37de-4d77-a437-ece886b4b886', DATE '2026-10-11', 90.85, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 30 | apLIS lote 6586
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('afc71e2a-ddff-4ea1-aa67-1a30bd137eb0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6586', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '19082026', '6586', 2321.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('99316d73-f3c0-47db-ab29-545ada68dcf9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-19', DATE '2026-10-18', 2321.51, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 30). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('99316d73-f3c0-47db-ab29-545ada68dcf9', 'afc71e2a-ddff-4ea1-aa67-1a30bd137eb0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('99316d73-f3c0-47db-ab29-545ada68dcf9', 'afc71e2a-ddff-4ea1-aa67-1a30bd137eb0', DATE '2026-10-18', 2321.51, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 31 | apLIS lote 6490
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1c33439f-6af7-4c8c-8d9c-71f7e823fe1e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6490', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6490', 1740.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('636abda7-2bbe-4d9c-91c3-fbe575e06c52', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 1740.92, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 31). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('636abda7-2bbe-4d9c-91c3-fbe575e06c52', '1c33439f-6af7-4c8c-8d9c-71f7e823fe1e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('636abda7-2bbe-4d9c-91c3-fbe575e06c52', '1c33439f-6af7-4c8c-8d9c-71f7e823fe1e', DATE '2026-10-06', 1740.92, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 32 | apLIS lote 6518
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('391e8b98-6c23-41af-9654-0fc00b089866', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6518', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6518', 767.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('04a0c673-3d99-46ca-bfe5-5d676c7e8b16', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 767.04, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 32). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('04a0c673-3d99-46ca-bfe5-5d676c7e8b16', '391e8b98-6c23-41af-9654-0fc00b089866');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('04a0c673-3d99-46ca-bfe5-5d676c7e8b16', '391e8b98-6c23-41af-9654-0fc00b089866', DATE '2026-10-11', 767.04, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 33 | apLIS lote 6583
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a87315c0-6e94-4d7a-9cd3-f29d51d8ab7c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6583', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '19082026', '6583', 3437.58, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('57f5b1c9-f79f-4b70-ad7b-8809a0e5c5dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-19', DATE '2026-10-18', 3437.58, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 33). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('57f5b1c9-f79f-4b70-ad7b-8809a0e5c5dd', 'a87315c0-6e94-4d7a-9cd3-f29d51d8ab7c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('57f5b1c9-f79f-4b70-ad7b-8809a0e5c5dd', 'a87315c0-6e94-4d7a-9cd3-f29d51d8ab7c', DATE '2026-10-18', 3437.58, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 34 | apLIS lote 6627
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13a5b273-95f2-4d16-9499-9decf4b24e8a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6627', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6627', 645.66, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b767b89e-aa46-461f-8d14-45621f6e8032', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-24', 645.66, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 34). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b767b89e-aa46-461f-8d14-45621f6e8032', '13a5b273-95f2-4d16-9499-9decf4b24e8a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b767b89e-aa46-461f-8d14-45621f6e8032', '13a5b273-95f2-4d16-9499-9decf4b24e8a', DATE '2026-10-24', 645.66, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 35 | apLIS lote 6634
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c418b242-3342-465e-88e2-4a857262e81b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6634', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6634', 1186.49, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a958c2d8-bde4-46a3-b47f-dc50c4adc994', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-24', 1186.49, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 35). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a958c2d8-bde4-46a3-b47f-dc50c4adc994', 'c418b242-3342-465e-88e2-4a857262e81b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a958c2d8-bde4-46a3-b47f-dc50c4adc994', 'c418b242-3342-465e-88e2-4a857262e81b', DATE '2026-10-24', 1186.49, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 36 | apLIS lote 6646
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4b866560-42ca-45df-9ea2-595049203433', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6646', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '27082026', '6646', 767.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9be1b6b2-94f5-4a64-974a-1d715fff8652', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 767.04, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 36). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9be1b6b2-94f5-4a64-974a-1d715fff8652', '4b866560-42ca-45df-9ea2-595049203433');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9be1b6b2-94f5-4a64-974a-1d715fff8652', '4b866560-42ca-45df-9ea2-595049203433', DATE '2026-08-27', 767.04, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 37 | apLIS lote 6486
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('041a9fd4-ef3a-4b37-bbf0-73dcffcd1066', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6486', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6486', 6192.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b714b2a4-98f7-422d-96e2-018e9c53f7d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 6192.28, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 37). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b714b2a4-98f7-422d-96e2-018e9c53f7d6', '041a9fd4-ef3a-4b37-bbf0-73dcffcd1066');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b714b2a4-98f7-422d-96e2-018e9c53f7d6', '041a9fd4-ef3a-4b37-bbf0-73dcffcd1066', DATE '2026-10-06', 6192.28, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 38 | apLIS lote 6525
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('53d27242-45fb-47a3-a24c-facbf225a651', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6525', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6525', 176.26, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f259e4a1-8edd-4076-9799-71e367a25096', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 176.26, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 38). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f259e4a1-8edd-4076-9799-71e367a25096', '53d27242-45fb-47a3-a24c-facbf225a651');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f259e4a1-8edd-4076-9799-71e367a25096', '53d27242-45fb-47a3-a24c-facbf225a651', DATE '2026-10-11', 176.26, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 39 | apLIS lote 6589
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2d7999ae-20de-4ba7-b18e-cbf112021f34', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6589', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '19082026', '6589', 1282.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0f5afa8e-2d73-4eb6-a59a-a76fce5bea60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-19', DATE '2026-10-18', 1282.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 39). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0f5afa8e-2d73-4eb6-a59a-a76fce5bea60', '2d7999ae-20de-4ba7-b18e-cbf112021f34');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0f5afa8e-2d73-4eb6-a59a-a76fce5bea60', '2d7999ae-20de-4ba7-b18e-cbf112021f34', DATE '2026-10-18', 1282.76, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 40 | apLIS lote 6523
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('be241c36-083b-4faf-a000-526fbdedae6c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6523', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6523', 1797.66, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('be766e5d-f131-4303-b934-012bdd0e0f71', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 1797.66, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 40). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('be766e5d-f131-4303-b934-012bdd0e0f71', 'be241c36-083b-4faf-a000-526fbdedae6c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('be766e5d-f131-4303-b934-012bdd0e0f71', 'be241c36-083b-4faf-a000-526fbdedae6c', DATE '2026-10-11', 1797.66, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 41 | apLIS lote 6600
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('556a7b8f-96ea-4b95-bdac-db554166dbe7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6600', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '19082026', '6600', 898.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('247cbc77-c833-4031-8549-1988f5731feb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-19', DATE '2026-10-18', 898.83, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 41). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('247cbc77-c833-4031-8549-1988f5731feb', '556a7b8f-96ea-4b95-bdac-db554166dbe7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('247cbc77-c833-4031-8549-1988f5731feb', '556a7b8f-96ea-4b95-bdac-db554166dbe7', DATE '2026-10-18', 898.83, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 43 | apLIS lote 6631
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('98e49cb9-73ac-4390-898f-8a6b316868d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6631', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6631', 2346.73, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fc3afc42-714f-474a-ad76-6c9d94200ea6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-18', 2346.73, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 43). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fc3afc42-714f-474a-ad76-6c9d94200ea6', '98e49cb9-73ac-4390-898f-8a6b316868d4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fc3afc42-714f-474a-ad76-6c9d94200ea6', '98e49cb9-73ac-4390-898f-8a6b316868d4', DATE '2026-10-18', 2346.73, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 44 | apLIS lote 3930
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d33ee428-730e-4313-a630-c3c67a7a451e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '3930', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '3930', 12845.66, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d657d96f-845a-4650-b54f-9ca077524da2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-18', 12845.66, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 44). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d657d96f-845a-4650-b54f-9ca077524da2', 'd33ee428-730e-4313-a630-c3c67a7a451e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d657d96f-845a-4650-b54f-9ca077524da2', 'd33ee428-730e-4313-a630-c3c67a7a451e', DATE '2026-10-18', 12845.66, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 45 | apLIS lote 4033
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b576a5cf-5604-4205-ab5e-3114dd8aaece', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '4033', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '4033', 4443.79, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('231587bd-3f03-46e5-80e8-e31dc1b298e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-18', 4443.79, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 45). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('231587bd-3f03-46e5-80e8-e31dc1b298e1', 'b576a5cf-5604-4205-ab5e-3114dd8aaece');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('231587bd-3f03-46e5-80e8-e31dc1b298e1', 'b576a5cf-5604-4205-ab5e-3114dd8aaece', DATE '2026-10-18', 4443.79, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 46 | apLIS lote 6643
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9080d66a-8ad5-44d7-9b8d-9d504d5fc76c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6643', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '27082026', '6643', 1050.84, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('709df1d5-f75b-4863-a3d4-34e07eb3f085', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 1050.84, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 46). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('709df1d5-f75b-4863-a3d4-34e07eb3f085', '9080d66a-8ad5-44d7-9b8d-9d504d5fc76c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('709df1d5-f75b-4863-a3d4-34e07eb3f085', '9080d66a-8ad5-44d7-9b8d-9d504d5fc76c', DATE '2026-08-27', 1050.84, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 47 | apLIS lote 6596
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6fc6ee0e-3b50-49d8-abfa-f2f2b467edc2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6596', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727822', '6596', 794.57, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8124d503-bf6c-4132-bc36-2db46093f2c7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 794.57, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 47). Responsável: Rivia. [atenção] lote não localizado no apLIS por ID nem Protocolo; operadora inferida pelo nome do convênio (AMHPDF).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8124d503-bf6c-4132-bc36-2db46093f2c7', '6fc6ee0e-3b50-49d8-abfa-f2f2b467edc2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8124d503-bf6c-4132-bc36-2db46093f2c7', '6fc6ee0e-3b50-49d8-abfa-f2f2b467edc2', DATE '2026-10-23', 794.57, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 48 | apLIS lote 6652
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('38d0ec4a-762c-4bf7-8f78-1f7636d0be77', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6652', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '44729197', '6652', 608.84, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea57d1fd-ec53-4572-918e-c998c6ed8224', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 608.84, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 48). Responsável: Rivia. [atenção] lote não localizado no apLIS por ID nem Protocolo; operadora inferida pelo nome do convênio (AMHPDF).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea57d1fd-ec53-4572-918e-c998c6ed8224', '38d0ec4a-762c-4bf7-8f78-1f7636d0be77');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ea57d1fd-ec53-4572-918e-c998c6ed8224', '38d0ec4a-762c-4bf7-8f78-1f7636d0be77', DATE '2026-08-27', 608.84, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 49 | apLIS lote 6595
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d87ea9fb-2409-48e5-b352-d870484b6b9b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6595', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727785', '6595', 1693.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('db27e662-a42a-44ba-b8d3-8a01dfb3ed04', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 1693.19, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 49). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('db27e662-a42a-44ba-b8d3-8a01dfb3ed04', 'd87ea9fb-2409-48e5-b352-d870484b6b9b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('db27e662-a42a-44ba-b8d3-8a01dfb3ed04', 'd87ea9fb-2409-48e5-b352-d870484b6b9b', DATE '2026-10-23', 1693.19, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 50 | apLIS lote 6650
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('494aead1-c460-44b5-bed7-879ddca03c79', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6650', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '44728997', '6650', 56.36, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('64485377-b16c-4d02-972c-4e8e24abff76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 56.36, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 50). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('64485377-b16c-4d02-972c-4e8e24abff76', '494aead1-c460-44b5-bed7-879ddca03c79');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('64485377-b16c-4d02-972c-4e8e24abff76', '494aead1-c460-44b5-bed7-879ddca03c79', DATE '2026-08-27', 56.36, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 52 | apLIS lote 6481
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('63cf99d0-4aff-40bf-9d86-1a80f578e30c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6481', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6481', 2260.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('77c7a02a-c192-42ab-ad80-5cf17ae19f37', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 2260.92, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 52). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('77c7a02a-c192-42ab-ad80-5cf17ae19f37', '63cf99d0-4aff-40bf-9d86-1a80f578e30c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('77c7a02a-c192-42ab-ad80-5cf17ae19f37', '63cf99d0-4aff-40bf-9d86-1a80f578e30c', DATE '2026-10-06', 2260.92, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 53 | apLIS lote 6521
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('04fd2034-c2c2-4e25-8fe0-b31b5af2be50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6521', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6521', 2948.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('251526cd-eb20-4685-be5e-56f40208ba24', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 2948.59, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 53). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('251526cd-eb20-4685-be5e-56f40208ba24', '04fd2034-c2c2-4e25-8fe0-b31b5af2be50');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('251526cd-eb20-4685-be5e-56f40208ba24', '04fd2034-c2c2-4e25-8fe0-b31b5af2be50', DATE '2026-10-11', 2948.59, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 54 | apLIS lote 6547
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('89356886-e80d-46ae-9b15-98ef9e02e9d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6547', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '14082026', '6547', 1797.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ef0ca27c-d6d1-4d4e-8fb9-93711d7adf3a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-14', DATE '2026-10-13', 1797.22, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 54). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ef0ca27c-d6d1-4d4e-8fb9-93711d7adf3a', '89356886-e80d-46ae-9b15-98ef9e02e9d6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ef0ca27c-d6d1-4d4e-8fb9-93711d7adf3a', '89356886-e80d-46ae-9b15-98ef9e02e9d6', DATE '2026-10-13', 1797.22, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 55 | apLIS lote 6629
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0de5ca0-0897-471c-9034-eaf117df33c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6629', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6629', 2948.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b29fffae-27d0-44c8-b0fc-44e44a00f5a4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-24', 2948.59, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 55). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b29fffae-27d0-44c8-b0fc-44e44a00f5a4', 'e0de5ca0-0897-471c-9034-eaf117df33c8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b29fffae-27d0-44c8-b0fc-44e44a00f5a4', 'e0de5ca0-0897-471c-9034-eaf117df33c8', DATE '2026-10-24', 2948.59, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 56 | apLIS lote 6642
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f3eeef2d-40fc-4f9b-b113-f15d5b42f85e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6642', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '27082026', '6642', 1256.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b1d0776f-a863-4702-8618-b5d0858ae225', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 1256.51, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 56). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b1d0776f-a863-4702-8618-b5d0858ae225', 'f3eeef2d-40fc-4f9b-b113-f15d5b42f85e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b1d0776f-a863-4702-8618-b5d0858ae225', 'f3eeef2d-40fc-4f9b-b113-f15d5b42f85e', DATE '2026-08-27', 1256.51, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 57 | apLIS lote 6491
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('db076381-9e04-4c41-8630-15d4cbe7c2cf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6491', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6491', 1101.18, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('253f3464-48b2-42c2-9a2c-7eb8a5d9b531', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 1101.18, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('253f3464-48b2-42c2-9a2c-7eb8a5d9b531', 'db076381-9e04-4c41-8630-15d4cbe7c2cf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('253f3464-48b2-42c2-9a2c-7eb8a5d9b531', 'db076381-9e04-4c41-8630-15d4cbe7c2cf', DATE '2026-10-06', 1101.18, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 58 | apLIS lote 6516
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('14c1ab33-ff6a-40ae-86c4-94896eaea27c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6516', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6516', 277.63, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f35f6e92-72e2-45a4-b6ed-638e77a5153b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 277.63, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 58). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f35f6e92-72e2-45a4-b6ed-638e77a5153b', '14c1ab33-ff6a-40ae-86c4-94896eaea27c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f35f6e92-72e2-45a4-b6ed-638e77a5153b', '14c1ab33-ff6a-40ae-86c4-94896eaea27c', DATE '2026-10-11', 277.63, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 59 | apLIS lote 6635
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('82357283-4ebb-406d-8da5-d5b1073057a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6635', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6635', 5543.57, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('afd72379-a65e-4cce-b336-276ccf62304c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-24', 5543.57, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 59). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('afd72379-a65e-4cce-b336-276ccf62304c', '82357283-4ebb-406d-8da5-d5b1073057a8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('afd72379-a65e-4cce-b336-276ccf62304c', '82357283-4ebb-406d-8da5-d5b1073057a8', DATE '2026-10-24', 5543.57, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 60 | apLIS lote 6495
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4aff6fe3-8ba6-4268-a46c-3bbc342b2993', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6495', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '10082026', '6495', 57.89, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('aa2b6927-6bfd-4814-82d0-f48ee2195e3e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-10', DATE '2026-10-09', 57.89, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 60). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('aa2b6927-6bfd-4814-82d0-f48ee2195e3e', '4aff6fe3-8ba6-4268-a46c-3bbc342b2993');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('aa2b6927-6bfd-4814-82d0-f48ee2195e3e', '4aff6fe3-8ba6-4268-a46c-3bbc342b2993', DATE '2026-10-09', 57.89, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 61 | apLIS lote 6488
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('466c4757-186e-4ebf-9177-7762593b6e1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6488', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '7082026', '6488', 4155.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('74f7fa14-5be6-481a-b16b-4a21ad69965e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-07', DATE '2026-10-06', 4155.01, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 61). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('74f7fa14-5be6-481a-b16b-4a21ad69965e', '466c4757-186e-4ebf-9177-7762593b6e1d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('74f7fa14-5be6-481a-b16b-4a21ad69965e', '466c4757-186e-4ebf-9177-7762593b6e1d', DATE '2026-10-06', 4155.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 62 | apLIS lote 6522
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('934934f2-fee5-40e2-a332-c0d8afaf1a77', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6522', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6522', 144.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f6af9b1e-b24c-4789-af54-f921e4f6f340', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 144.06, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 62). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f6af9b1e-b24c-4789-af54-f921e4f6f340', '934934f2-fee5-40e2-a332-c0d8afaf1a77');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f6af9b1e-b24c-4789-af54-f921e4f6f340', '934934f2-fee5-40e2-a332-c0d8afaf1a77', DATE '2026-10-11', 144.06, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 63 | apLIS lote 6588
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('946c324a-6b35-4684-a72c-7088fce47608', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6588', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '21082026', '6588', 407.19, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5ecd944e-148b-4028-b615-a8b1c75d4ae7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-21', DATE '2026-10-11', 407.19, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 63). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5ecd944e-148b-4028-b615-a8b1c75d4ae7', '946c324a-6b35-4684-a72c-7088fce47608');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5ecd944e-148b-4028-b615-a8b1c75d4ae7', '946c324a-6b35-4684-a72c-7088fce47608', DATE '2026-10-11', 407.19, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 64 | apLIS lote 6630
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3d52948-972a-4672-ba86-5c9ac3fccb54', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6630', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6630', 1707.91, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('390f6162-b06b-4574-9eb6-eea7b15ed826', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-11', 1707.91, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 64). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('390f6162-b06b-4574-9eb6-eea7b15ed826', 'c3d52948-972a-4672-ba86-5c9ac3fccb54');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('390f6162-b06b-4574-9eb6-eea7b15ed826', 'c3d52948-972a-4672-ba86-5c9ac3fccb54', DATE '2026-10-11', 1707.91, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 65 | apLIS lote 6520
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8666b7d7-fabc-4bf2-93c9-16a4d1e65cd7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6520', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '12082026', '6520', 676.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2d99c985-9a95-49ad-95df-c81ffcf76503', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-12', DATE '2026-10-11', 676.86, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 65). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2d99c985-9a95-49ad-95df-c81ffcf76503', '8666b7d7-fabc-4bf2-93c9-16a4d1e65cd7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2d99c985-9a95-49ad-95df-c81ffcf76503', '8666b7d7-fabc-4bf2-93c9-16a4d1e65cd7', DATE '2026-10-11', 676.86, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 66 | apLIS lote 6590
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c5768843-2591-4af7-a30a-3fa6c52d182f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6590', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '21082026', '6590', 676.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('351bebd9-7039-4f6b-a737-dd7de6df1cd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-21', DATE '2026-10-11', 676.86, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 66). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('351bebd9-7039-4f6b-a737-dd7de6df1cd4', 'c5768843-2591-4af7-a30a-3fa6c52d182f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('351bebd9-7039-4f6b-a737-dd7de6df1cd4', 'c5768843-2591-4af7-a30a-3fa6c52d182f', DATE '2026-10-11', 676.86, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 68 | apLIS lote 6515
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('60a204e2-b41e-4ef1-8306-79363238c2e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6515', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '44723541', '6515', 1465.56, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d0b72d0b-806d-442c-9847-56e54d095c84', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-11', DATE '2026-10-10', 1465.56, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 68). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d0b72d0b-806d-442c-9847-56e54d095c84', '60a204e2-b41e-4ef1-8306-79363238c2e9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d0b72d0b-806d-442c-9847-56e54d095c84', '60a204e2-b41e-4ef1-8306-79363238c2e9', DATE '2026-10-10', 1465.56, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 69 | apLIS lote 6591
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64ecb04a-36bb-4996-bdf6-0155f4f20707', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6591', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727807', '6591', 697.7, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('79a13e60-a777-4c15-a152-39606332037c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 697.7, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 69). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('79a13e60-a777-4c15-a152-39606332037c', '64ecb04a-36bb-4996-bdf6-0155f4f20707');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('79a13e60-a777-4c15-a152-39606332037c', '64ecb04a-36bb-4996-bdf6-0155f4f20707', DATE '2026-10-23', 697.7, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 70 | apLIS lote 6645
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3b3d7f11-b464-439d-94f6-692c89868a0c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6645', DATE '2026-08-26', DATE '2026-08-26', 'Faturado', '44728852', '6645', 536.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33e098fc-d1e8-44df-a1a3-267913dda028', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-26', DATE '2026-08-26', 536.04, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 70). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33e098fc-d1e8-44df-a1a3-267913dda028', '3b3d7f11-b464-439d-94f6-692c89868a0c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('33e098fc-d1e8-44df-a1a3-267913dda028', '3b3d7f11-b464-439d-94f6-692c89868a0c', DATE '2026-08-26', 536.04, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 71 | apLIS lote 6647
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e002821b-a6a3-4161-96ab-f04f3a86f7dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6647', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '44728919', '6647', 1244.8, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('43c7c3f0-50be-41fe-86f7-91a042a9fc38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 1244.8, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 71). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('43c7c3f0-50be-41fe-86f7-91a042a9fc38', 'e002821b-a6a3-4161-96ab-f04f3a86f7dc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('43c7c3f0-50be-41fe-86f7-91a042a9fc38', 'e002821b-a6a3-4161-96ab-f04f3a86f7dc', DATE '2026-08-27', 1244.8, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 72 | apLIS lote 6649
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ea6db329-dc7d-42d1-a0a5-ec52a67185d6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6649', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '44728969', '6649', 76.2, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('670c4aaa-8cb6-435c-bc0f-743255ac63dd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 76.2, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 72). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('670c4aaa-8cb6-435c-bc0f-743255ac63dd', 'ea6db329-dc7d-42d1-a0a5-ec52a67185d6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('670c4aaa-8cb6-435c-bc0f-743255ac63dd', 'ea6db329-dc7d-42d1-a0a5-ec52a67185d6', DATE '2026-08-27', 76.2, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 73 | apLIS lote 6497
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74f64657-62d5-4491-9719-e386127beb23', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6497', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '44722711', '6497', 1282.94, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-10', DATE '2026-10-09', 1282.94, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 73). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255', '74f64657-62d5-4491-9719-e386127beb23');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255', '74f64657-62d5-4491-9719-e386127beb23', DATE '2026-10-09', 1282.94, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 74 | apLIS lote 6514
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13b4445c-2586-454e-8abf-d94c164aaa09', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6514', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '44723525', '6514', 2311.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d29ff565-ba5b-4ab1-8a5a-9b4bbef773d4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-11', DATE '2026-10-10', 2311.69, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 74). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d29ff565-ba5b-4ab1-8a5a-9b4bbef773d4', '13b4445c-2586-454e-8abf-d94c164aaa09');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d29ff565-ba5b-4ab1-8a5a-9b4bbef773d4', '13b4445c-2586-454e-8abf-d94c164aaa09', DATE '2026-10-10', 2311.69, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 75 | apLIS lote 6558
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b367eea1-0a70-4617-a9f6-d03ecaeec405', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6558', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '44725510', '6558', 495.33, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f0930a6-07ec-405c-9140-f7b3d2ad6b13', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-17', DATE '2026-10-16', 495.33, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 75). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f0930a6-07ec-405c-9140-f7b3d2ad6b13', 'b367eea1-0a70-4617-a9f6-d03ecaeec405');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7f0930a6-07ec-405c-9140-f7b3d2ad6b13', 'b367eea1-0a70-4617-a9f6-d03ecaeec405', DATE '2026-10-16', 495.33, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 76 | apLIS lote 6594
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ed2afe0e-597b-42c8-a84b-8ffdca75cecf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6594', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '44727829', '6594', 152.4, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d800d9b7-cdfa-4b40-ba29-ebd1735be689', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-24', DATE '2026-10-23', 152.4, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 76). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d800d9b7-cdfa-4b40-ba29-ebd1735be689', 'ed2afe0e-597b-42c8-a84b-8ffdca75cecf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d800d9b7-cdfa-4b40-ba29-ebd1735be689', 'ed2afe0e-597b-42c8-a84b-8ffdca75cecf', DATE '2026-10-23', 152.4, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 77 | apLIS lote 6496
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f60e95ec-80aa-4da1-8d75-9ae58b316c91', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6496', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '10082026', '6496', 9672.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('530cf841-dd6d-4060-a53c-9be06b004202', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-10', DATE '2026-10-09', 9672.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 77). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('530cf841-dd6d-4060-a53c-9be06b004202', 'f60e95ec-80aa-4da1-8d75-9ae58b316c91');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('530cf841-dd6d-4060-a53c-9be06b004202', 'f60e95ec-80aa-4da1-8d75-9ae58b316c91', DATE '2026-10-09', 9672.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 78 | apLIS lote 6548
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b15dce8-615b-4f82-bcb1-df76d92183ce', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6548', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '14082026', '6548', 3601.99, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('13bf6dce-4743-4a40-b07b-428fd72e7535', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-14', DATE '2026-10-13', 3601.99, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 78). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('13bf6dce-4743-4a40-b07b-428fd72e7535', '5b15dce8-615b-4f82-bcb1-df76d92183ce');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('13bf6dce-4743-4a40-b07b-428fd72e7535', '5b15dce8-615b-4f82-bcb1-df76d92183ce', DATE '2026-10-13', 3601.99, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 79 | apLIS lote 6593
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b181e218-60a1-4a3b-b195-960a07761150', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6593', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '19082026', '6593', 2610.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6355f215-ac32-4098-a866-e9281413c1c8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-19', DATE '2026-10-18', 2610.92, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 79). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6355f215-ac32-4098-a866-e9281413c1c8', 'b181e218-60a1-4a3b-b195-960a07761150');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6355f215-ac32-4098-a866-e9281413c1c8', 'b181e218-60a1-4a3b-b195-960a07761150', DATE '2026-10-18', 2610.92, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 80 | apLIS lote 6616
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('45a591b2-7bd4-4947-a141-5cf58d464e9d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6616', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '21082026', '6616', 2319.07, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('964cd215-7b22-45dd-af87-e662e5a7046f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-21', DATE '2026-10-20', 2319.07, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 80). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('964cd215-7b22-45dd-af87-e662e5a7046f', '45a591b2-7bd4-4947-a141-5cf58d464e9d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('964cd215-7b22-45dd-af87-e662e5a7046f', '45a591b2-7bd4-4947-a141-5cf58d464e9d', DATE '2026-10-20', 2319.07, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 81 | apLIS lote 6636
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('61de89bb-13e8-4043-80a0-57f078234083', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6636', DATE '2026-08-26', DATE '2026-08-26', 'Faturado', '26082026', '6636', 1850.25, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('44a3bbfd-65ac-4ad2-b621-749415e89395', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-26', DATE '2026-10-25', 1850.25, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 81). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('44a3bbfd-65ac-4ad2-b621-749415e89395', '61de89bb-13e8-4043-80a0-57f078234083');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('44a3bbfd-65ac-4ad2-b621-749415e89395', '61de89bb-13e8-4043-80a0-57f078234083', DATE '2026-10-25', 1850.25, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 82 | apLIS lote 6651
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('939fb884-89f0-4ce5-9b7b-56481f43d081', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6651', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '27082026', '6651', 595.09, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('04571778-0fbd-47f0-8dba-38de1628acbe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 595.09, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 82). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('04571778-0fbd-47f0-8dba-38de1628acbe', '939fb884-89f0-4ce5-9b7b-56481f43d081');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('04571778-0fbd-47f0-8dba-38de1628acbe', '939fb884-89f0-4ce5-9b7b-56481f43d081', DATE '2026-08-27', 595.09, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 83 | apLIS lote 6494
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('598abe90-f75e-42f7-98c9-517fe4d351f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6494', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '10082026', '6494', 255.68, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dcef53be-1b67-453b-9a84-3fb58b20ffdd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-10', DATE '2026-10-09', 255.68, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 83). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dcef53be-1b67-453b-9a84-3fb58b20ffdd', '598abe90-f75e-42f7-98c9-517fe4d351f6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('dcef53be-1b67-453b-9a84-3fb58b20ffdd', '598abe90-f75e-42f7-98c9-517fe4d351f6', DATE '2026-10-09', 255.68, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 84 | apLIS lote 6633
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('025b2068-3990-4575-b032-2aa2435fad6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6633', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '25082026', '6633', 63.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f5b7b1d1-50c3-4798-b492-5e4120d7240c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-25', DATE '2026-10-24', 63.92, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 84). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f5b7b1d1-50c3-4798-b492-5e4120d7240c', '025b2068-3990-4575-b032-2aa2435fad6e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f5b7b1d1-50c3-4798-b492-5e4120d7240c', '025b2068-3990-4575-b032-2aa2435fad6e', DATE '2026-10-24', 63.92, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 85 | apLIS lote 6478
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('26460c33-2df7-4ba6-837d-0120072964b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6478', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '44722123', '6478', 1266.27, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c5014868-a147-42f6-8546-ab7b5d138194', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-06', DATE '2026-10-05', 1266.27, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 85). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c5014868-a147-42f6-8546-ab7b5d138194', '26460c33-2df7-4ba6-837d-0120072964b3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c5014868-a147-42f6-8546-ab7b5d138194', '26460c33-2df7-4ba6-837d-0120072964b3', DATE '2026-10-05', 1266.27, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 87 | apLIS lote 6513
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3650fe24-af90-4644-b7fd-17e338ba9b1d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6513', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '44723509', '6513', 555.21, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-11', DATE '2026-10-10', 555.21, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 87). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004', '3650fe24-af90-4644-b7fd-17e338ba9b1d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004', '3650fe24-af90-4644-b7fd-17e338ba9b1d', DATE '2026-10-10', 555.21, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 88 | apLIS lote 6648
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e1c389c9-795c-4f9c-899d-1216e44bd520', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6648', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '44728981', '6648', 484.13, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('77ceabe4-a3e3-41a7-b99b-cfd928daf43d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-08-27', DATE '2026-08-27', 484.13, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 88). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('77ceabe4-a3e3-41a7-b99b-cfd928daf43d', 'e1c389c9-795c-4f9c-899d-1216e44bd520');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('77ceabe4-a3e3-41a7-b99b-cfd928daf43d', 'e1c389c9-795c-4f9c-899d-1216e44bd520', DATE '2026-08-27', 484.13, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 89 | apLIS lote 6474
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('db5c3404-c24c-4859-8fc7-be4815e80411', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6474', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '5865072010', '6474', 12200.56, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a397a15-3625-4c0e-a0a6-4fd8223de722', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-08-06', DATE '2026-09-05', 12200.56, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 89). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a397a15-3625-4c0e-a0a6-4fd8223de722', 'db5c3404-c24c-4859-8fc7-be4815e80411');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2a397a15-3625-4c0e-a0a6-4fd8223de722', 'db5c3404-c24c-4859-8fc7-be4815e80411', DATE '2026-09-05', 12200.56, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 90 | apLIS lote 6505
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('28f798bd-30b3-41ef-a966-699e3217be01', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6505', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '5869141463', '6505', 2299.74, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f2a07d72-e743-43cb-a0d7-17050bdedd26', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-08-10', DATE '2026-09-09', 2299.74, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 90). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f2a07d72-e743-43cb-a0d7-17050bdedd26', '28f798bd-30b3-41ef-a966-699e3217be01');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f2a07d72-e743-43cb-a0d7-17050bdedd26', '28f798bd-30b3-41ef-a966-699e3217be01', DATE '2026-09-09', 2299.74, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 91 | apLIS lote 6529
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4961b4a0-76a4-4295-91f7-5286a11327c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6529', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '5873625242', '6529', 871.24, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eb1f9800-31ab-4d68-850d-d8b825f2ad6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-08-12', DATE '2026-09-11', 871.24, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 91). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eb1f9800-31ab-4d68-850d-d8b825f2ad6b', '4961b4a0-76a4-4295-91f7-5286a11327c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('eb1f9800-31ab-4d68-850d-d8b825f2ad6b', '4961b4a0-76a4-4295-91f7-5286a11327c0', DATE '2026-09-11', 871.24, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 92 | apLIS lote 6430
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('23b68233-95ae-462a-906f-0207177b8c87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6430', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1531057', '6430', 5543.05, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3ab4e921-89ca-4dec-b240-677201939dad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 5543.05, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 92). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3ab4e921-89ca-4dec-b240-677201939dad', '23b68233-95ae-462a-906f-0207177b8c87');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3ab4e921-89ca-4dec-b240-677201939dad', '23b68233-95ae-462a-906f-0207177b8c87', DATE '2026-09-20', 5543.05, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 93 | apLIS lote 6398
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b4f3f401-95f2-43ba-9439-d259d4803da6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6398', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1529596', '6398', 3674.61, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6964e779-6eae-48ab-afd7-429a42376e76', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 3674.61, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 93). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6964e779-6eae-48ab-afd7-429a42376e76', 'b4f3f401-95f2-43ba-9439-d259d4803da6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6964e779-6eae-48ab-afd7-429a42376e76', 'b4f3f401-95f2-43ba-9439-d259d4803da6', DATE '2026-09-20', 3674.61, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 94 | apLIS lote 6343
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce91f3e3-6df3-4a49-9e77-d1151a90ddf9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6343', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534064', '6343', 66.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('05adfe1f-7e5b-4422-9c66-6a00e70d9e63', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 66.28, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 94). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('05adfe1f-7e5b-4422-9c66-6a00e70d9e63', 'ce91f3e3-6df3-4a49-9e77-d1151a90ddf9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('05adfe1f-7e5b-4422-9c66-6a00e70d9e63', 'ce91f3e3-6df3-4a49-9e77-d1151a90ddf9', DATE '2026-09-20', 66.28, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 95 | apLIS lote 6388
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7fc6022e-4d64-4bae-b63b-139575d48363', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6388', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534379', '6388', 11198.7, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3833d15e-2fad-4f5b-b8b3-02d3d0522e8d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 11198.7, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 95). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3833d15e-2fad-4f5b-b8b3-02d3d0522e8d', '7fc6022e-4d64-4bae-b63b-139575d48363');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3833d15e-2fad-4f5b-b8b3-02d3d0522e8d', '7fc6022e-4d64-4bae-b63b-139575d48363', DATE '2026-09-20', 11198.7, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 96 | apLIS lote 6389
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a9e457a7-0729-4467-a79a-24006c47dc93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6389', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534316', '6389', 4640.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e779a6d6-493c-4703-b344-b58b50c626f2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 4640.59, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 96). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e779a6d6-493c-4703-b344-b58b50c626f2', 'a9e457a7-0729-4467-a79a-24006c47dc93');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e779a6d6-493c-4703-b344-b58b50c626f2', 'a9e457a7-0729-4467-a79a-24006c47dc93', DATE '2026-09-20', 4640.59, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 97 | apLIS lote 6390
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1509f76d-e32e-411e-bc3c-b203f35f7b43', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6390', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534195', '6390', 2596.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c8a8bc31-dab9-447b-8d0e-b7d16cdade50', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 2596.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 97). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c8a8bc31-dab9-447b-8d0e-b7d16cdade50', '1509f76d-e32e-411e-bc3c-b203f35f7b43');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c8a8bc31-dab9-447b-8d0e-b7d16cdade50', '1509f76d-e32e-411e-bc3c-b203f35f7b43', DATE '2026-09-20', 2596.35, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 98 | apLIS lote 6418
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('569f31fb-177a-41d9-a098-03b7c1b9bddf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6418', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534003', '6418', 4698.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('98c43214-17ff-486c-aff0-a4be8ea67d56', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 4698.42, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 98). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('98c43214-17ff-486c-aff0-a4be8ea67d56', '569f31fb-177a-41d9-a098-03b7c1b9bddf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('98c43214-17ff-486c-aff0-a4be8ea67d56', '569f31fb-177a-41d9-a098-03b7c1b9bddf', DATE '2026-09-20', 4698.42, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 99 | apLIS lote 6446
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fcb65064-ce8f-494c-add8-dba68999cf10', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6446', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1533905', '6446', 195.43, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a05be1f1-1622-419a-991a-333ebb056114', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 195.43, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 99). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a05be1f1-1622-419a-991a-333ebb056114', 'fcb65064-ce8f-494c-add8-dba68999cf10');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a05be1f1-1622-419a-991a-333ebb056114', 'fcb65064-ce8f-494c-add8-dba68999cf10', DATE '2026-09-20', 195.43, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 100 | apLIS lote 6183
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8d8a19b0-f482-4788-836e-7ba97947e561', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6183', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534460', '6183', 6387.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('432a76e2-0c47-47e8-ba72-2b44122f905a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 6387.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 100). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('432a76e2-0c47-47e8-ba72-2b44122f905a', '8d8a19b0-f482-4788-836e-7ba97947e561');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('432a76e2-0c47-47e8-ba72-2b44122f905a', '8d8a19b0-f482-4788-836e-7ba97947e561', DATE '2026-09-20', 6387.38, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 101 | apLIS lote 6387
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('009ac043-b9b6-4b8e-846d-bfbfa3706aeb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6387', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '1534453', '6387', 18505.43, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b227874-97e1-43b5-ab39-a21c9bc589db', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-03', DATE '2026-09-20', 18505.43, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 101). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b227874-97e1-43b5-ab39-a21c9bc589db', '009ac043-b9b6-4b8e-846d-bfbfa3706aeb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0b227874-97e1-43b5-ab39-a21c9bc589db', '009ac043-b9b6-4b8e-846d-bfbfa3706aeb', DATE '2026-09-20', 18505.43, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 102 | apLIS lote 6464
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8ee626a8-4793-4689-8bea-0d92b73ec254', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6464', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '1540653', '6464', 6456.73, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0f0bf6fe-1df3-47e7-9601-50a3263e2c5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-06', DATE '2026-09-20', 6456.73, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 102). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0f0bf6fe-1df3-47e7-9601-50a3263e2c5c', '8ee626a8-4793-4689-8bea-0d92b73ec254');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0f0bf6fe-1df3-47e7-9601-50a3263e2c5c', '8ee626a8-4793-4689-8bea-0d92b73ec254', DATE '2026-09-20', 6456.73, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 103 | apLIS lote 6475
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('49604e51-536a-41ff-b5c6-4f4f3fc1de37', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6475', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '1542617', '6475', 1331.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7d55b491-a3ef-41d9-acfc-4dee1ea7bdfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-08-06', DATE '2026-09-20', 1331.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 103). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7d55b491-a3ef-41d9-acfc-4dee1ea7bdfa', '49604e51-536a-41ff-b5c6-4f4f3fc1de37');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7d55b491-a3ef-41d9-acfc-4dee1ea7bdfa', '49604e51-536a-41ff-b5c6-4f4f3fc1de37', DATE '2026-09-20', 1331.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 104 | apLIS lote 4950
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('38eac44d-c837-43c7-97b2-c49e7afece92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '4950', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '340230100144_0', '4950', 16132.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0b39e5d4-7a3a-4273-8d46-2509bc7f6e11', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-06', DATE '2026-10-05', 16132.0, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 104). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0b39e5d4-7a3a-4273-8d46-2509bc7f6e11', '38eac44d-c837-43c7-97b2-c49e7afece92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0b39e5d4-7a3a-4273-8d46-2509bc7f6e11', '38eac44d-c837-43c7-97b2-c49e7afece92', DATE '2026-10-05', 16132.0, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 105 | apLIS lote 4951
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('81239b86-f660-4136-b727-9a51015ee614', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '4951', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '341230101504_0', '4951', 7672.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b64cad6-6c31-406a-8512-ccbecd44e116', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-06', DATE '2026-10-05', 7672.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 105). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b64cad6-6c31-406a-8512-ccbecd44e116', '81239b86-f660-4136-b727-9a51015ee614');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1b64cad6-6c31-406a-8512-ccbecd44e116', '81239b86-f660-4136-b727-9a51015ee614', DATE '2026-10-05', 7672.38, 'previsto', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 106 | apLIS lote 5347
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80b8c476-9863-4a1e-9a88-f30f0435f4ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5347', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '340230102069_0', '5347', 11900.99, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e5d131cb-5f81-4d6c-b9d4-8fbd439d3698', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-06', DATE '2026-10-05', 11900.99, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 106). Responsável: Maria Eduarda. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e5d131cb-5f81-4d6c-b9d4-8fbd439d3698', '80b8c476-9863-4a1e-9a88-f30f0435f4ae');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e5d131cb-5f81-4d6c-b9d4-8fbd439d3698', '80b8c476-9863-4a1e-9a88-f30f0435f4ae', DATE '2026-10-05', 11900.99, 'previsto', 'Maria Eduarda', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 107 | apLIS lote 5258
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c0e4a10c-a62a-4409-b9b6-2e05bb62b7b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '5258', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '340230101843_0', '5258', 18106.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('acb3826e-0fc5-44f3-94dd-01fc637a1a49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-06', DATE '2026-10-05', 18106.42, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 107). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('acb3826e-0fc5-44f3-94dd-01fc637a1a49', 'c0e4a10c-a62a-4409-b9b6-2e05bb62b7b2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('acb3826e-0fc5-44f3-94dd-01fc637a1a49', 'c0e4a10c-a62a-4409-b9b6-2e05bb62b7b2', DATE '2026-10-05', 18106.42, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 108 | apLIS lote 6500
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0de516ec-03a3-4664-b4e0-4bcca1d74546', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6500', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '340230215511_0', '6500', 31355.06, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f6ee338-1b8e-4f64-918a-f358d7c05003', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-11', DATE '2026-10-10', 31355.06, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 108). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f6ee338-1b8e-4f64-918a-f358d7c05003', '0de516ec-03a3-4664-b4e0-4bcca1d74546');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7f6ee338-1b8e-4f64-918a-f358d7c05003', '0de516ec-03a3-4664-b4e0-4bcca1d74546', DATE '2026-10-10', 31355.06, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 109 | apLIS lote 6501
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aa034f04-25f0-4be1-9119-f423f66e3f0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6501', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '340230230492_0', '6501', 4066.73, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('23c6a266-ea41-41cb-93c9-997317a17e38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-11', DATE '2026-10-10', 4066.73, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 109). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('23c6a266-ea41-41cb-93c9-997317a17e38', 'aa034f04-25f0-4be1-9119-f423f66e3f0f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('23c6a266-ea41-41cb-93c9-997317a17e38', 'aa034f04-25f0-4be1-9119-f423f66e3f0f', DATE '2026-10-10', 4066.73, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 110 | apLIS lote 6503
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5976ac69-8fc8-4aa7-93f1-df06e0d25c04', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6503', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '341230227269_0', '6503', 14899.77, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fc6f1f70-dcfb-4d0f-baca-19b0cfa2aea1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-11', DATE '2026-10-10', 14899.77, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 110). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fc6f1f70-dcfb-4d0f-baca-19b0cfa2aea1', '5976ac69-8fc8-4aa7-93f1-df06e0d25c04');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fc6f1f70-dcfb-4d0f-baca-19b0cfa2aea1', '5976ac69-8fc8-4aa7-93f1-df06e0d25c04', DATE '2026-10-10', 14899.77, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 111 | apLIS lote 6538
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b81b053e-b738-4ca8-861a-a605f38a3e46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6538', DATE '2026-08-13', DATE '2026-08-13', 'Faturado', '340230318804_0', '6538', 20962.55, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('31e79ae9-bd1d-4f3b-9e0f-1647ce49f9b1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-13', DATE '2026-10-12', 20962.55, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 111). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('31e79ae9-bd1d-4f3b-9e0f-1647ce49f9b1', 'b81b053e-b738-4ca8-861a-a605f38a3e46');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('31e79ae9-bd1d-4f3b-9e0f-1647ce49f9b1', 'b81b053e-b738-4ca8-861a-a605f38a3e46', DATE '2026-10-12', 20962.55, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 112 | apLIS lote 6539
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e9cca39a-5d52-4369-a93b-7b596c7d4413', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6539', DATE '2026-08-13', DATE '2026-08-13', 'Faturado', '340230319509_0', '6539', 7381.45, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f43772f-688e-4bae-80d5-ddf41782cd89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-13', DATE '2026-10-12', 7381.45, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 112). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f43772f-688e-4bae-80d5-ddf41782cd89', 'e9cca39a-5d52-4369-a93b-7b596c7d4413');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7f43772f-688e-4bae-80d5-ddf41782cd89', 'e9cca39a-5d52-4369-a93b-7b596c7d4413', DATE '2026-10-12', 7381.45, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 113 | apLIS lote 6540
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('16f1644e-b515-41ce-92ee-378327a952a5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6540', DATE '2026-08-13', DATE '2026-08-13', 'Faturado', '341230321443_0', '6540', 7195.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ff469309-eafe-4b6b-af11-1da5ecd7eac8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-13', DATE '2026-10-12', 7195.01, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 113). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ff469309-eafe-4b6b-af11-1da5ecd7eac8', '16f1644e-b515-41ce-92ee-378327a952a5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ff469309-eafe-4b6b-af11-1da5ecd7eac8', '16f1644e-b515-41ce-92ee-378327a952a5', DATE '2026-10-12', 7195.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 114 | apLIS lote 6572
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f39a3880-8987-4b0c-9bc8-78675b7e65e1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6572', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '341230439625_0', '6572', 3539.98, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b9021697-a2bc-4fbc-ae5e-a85bf8042246', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-18', DATE '2026-10-17', 3539.98, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 114). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b9021697-a2bc-4fbc-ae5e-a85bf8042246', 'f39a3880-8987-4b0c-9bc8-78675b7e65e1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b9021697-a2bc-4fbc-ae5e-a85bf8042246', 'f39a3880-8987-4b0c-9bc8-78675b7e65e1', DATE '2026-10-17', 3539.98, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 115 | apLIS lote 6571
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1af63645-06b8-42f0-874b-45c26ca95cd9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6571', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '340230440804_0', '6571', 6978.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('dda165dd-c959-4b77-926a-f3f4d8a4b145', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-18', DATE '2026-10-17', 6978.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 115). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('dda165dd-c959-4b77-926a-f3f4d8a4b145', '1af63645-06b8-42f0-874b-45c26ca95cd9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('dda165dd-c959-4b77-926a-f3f4d8a4b145', '1af63645-06b8-42f0-874b-45c26ca95cd9', DATE '2026-10-17', 6978.38, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 116 | apLIS lote 6570
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cca9549d-b034-46ca-b1b4-7ed32ad6db51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6570', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '340230444749_0', '6570', 25171.05, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('68cf7768-4671-48da-b22b-4d4630c95bfa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-18', DATE '2026-10-17', 25171.05, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 116). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('68cf7768-4671-48da-b22b-4d4630c95bfa', 'cca9549d-b034-46ca-b1b4-7ed32ad6db51');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('68cf7768-4671-48da-b22b-4d4630c95bfa', 'cca9549d-b034-46ca-b1b4-7ed32ad6db51', DATE '2026-10-17', 25171.05, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 117 | apLIS lote 6582
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c435f2bb-7d86-47a0-90cf-1bdaff6a6bb3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6582', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '341230488405_0', '6582', 144.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9c50bd07-91d9-458b-be44-36ae98aaedef', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-19', DATE '2026-10-18', 144.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 117). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9c50bd07-91d9-458b-be44-36ae98aaedef', 'c435f2bb-7d86-47a0-90cf-1bdaff6a6bb3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9c50bd07-91d9-458b-be44-36ae98aaedef', 'c435f2bb-7d86-47a0-90cf-1bdaff6a6bb3', DATE '2026-10-18', 144.76, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 118 | apLIS lote 6562
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dcb3fdf2-203b-4d3e-88c3-936ea0c81c87', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6562', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '341230542675_0', '6562', 41.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3e600e27-7259-4d30-9939-0abbbc5c1257', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-20', DATE '2026-10-19', 41.92, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 118). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3e600e27-7259-4d30-9939-0abbbc5c1257', 'dcb3fdf2-203b-4d3e-88c3-936ea0c81c87');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3e600e27-7259-4d30-9939-0abbbc5c1257', 'dcb3fdf2-203b-4d3e-88c3-936ea0c81c87', DATE '2026-10-19', 41.92, 'previsto', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 119 | apLIS lote 6609
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c1462f6-5647-4444-a59d-77f1d8004681', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6609', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '340230579184_0', '6609', 20591.17, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21715234-9b7b-47af-a52e-bf9a8649b136', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-21', DATE '2026-10-20', 20591.17, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 119). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21715234-9b7b-47af-a52e-bf9a8649b136', '3c1462f6-5647-4444-a59d-77f1d8004681');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('21715234-9b7b-47af-a52e-bf9a8649b136', '3c1462f6-5647-4444-a59d-77f1d8004681', DATE '2026-10-20', 20591.17, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 120 | apLIS lote 6612
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('153efb81-5abb-4a32-b6f6-81565a3df020', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6612', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '340230581340_0', '6612', 9918.37, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c95305f4-726e-4fae-a047-bf3210167ea1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-21', DATE '2026-10-20', 9918.37, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 120). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c95305f4-726e-4fae-a047-bf3210167ea1', '153efb81-5abb-4a32-b6f6-81565a3df020');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c95305f4-726e-4fae-a047-bf3210167ea1', '153efb81-5abb-4a32-b6f6-81565a3df020', DATE '2026-10-20', 9918.37, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 121 | apLIS lote 6580
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7d6d9c72-efbd-493a-b3a2-a9b520251a82', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6580', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '340230488406_0', '6580', 7188.87, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2a672d1e-d310-44d9-ab96-4638c8d5d853', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-21', DATE '2026-10-20', 7188.87, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 121). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2a672d1e-d310-44d9-ab96-4638c8d5d853', '7d6d9c72-efbd-493a-b3a2-a9b520251a82');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2a672d1e-d310-44d9-ab96-4638c8d5d853', '7d6d9c72-efbd-493a-b3a2-a9b520251a82', DATE '2026-10-20', 7188.87, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 122 | apLIS lote 6617
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f5e62d1e-27d4-4e17-a496-47c425d16703', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), '6617', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '341230614038_0', '6617', 9905.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6dda1644-e5bb-47c2-86fa-e45edd13840c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1000'), DATE '2026-08-25', DATE '2026-10-24', 9905.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 122). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6dda1644-e5bb-47c2-86fa-e45edd13840c', 'f5e62d1e-27d4-4e17-a496-47c425d16703');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6dda1644-e5bb-47c2-86fa-e45edd13840c', 'f5e62d1e-27d4-4e17-a496-47c425d16703', DATE '2026-10-24', 9905.76, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 123 | apLIS lote 6618
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('23dd5549-8f82-4c2b-8ba1-2b7737122427', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6618', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '340230614037_0', '6618', 11702.1, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88d0f47b-f97d-43ff-be90-af568621bcab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-25', DATE '2026-10-24', 11702.1, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 123). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88d0f47b-f97d-43ff-be90-af568621bcab', '23dd5549-8f82-4c2b-8ba1-2b7737122427');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('88d0f47b-f97d-43ff-be90-af568621bcab', '23dd5549-8f82-4c2b-8ba1-2b7737122427', DATE '2026-10-24', 11702.1, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 124 | apLIS lote 6661
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1396d12f-6837-42d9-b4eb-7e9312491d51', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), '6661', DATE '2026-08-28', DATE '2026-08-28', 'Faturado', '340230774582_0', '6661', 19332.2, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c04aa100-4a36-4d95-a80e-25733a018a7c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1122'), DATE '2026-08-28', DATE '2026-10-27', 19332.2, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 124). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c04aa100-4a36-4d95-a80e-25733a018a7c', '1396d12f-6837-42d9-b4eb-7e9312491d51');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c04aa100-4a36-4d95-a80e-25733a018a7c', '1396d12f-6837-42d9-b4eb-7e9312491d51', DATE '2026-10-27', 19332.2, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 126 | apLIS lote 6415
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1d3b777f-a91b-44eb-918f-ed5b40f64de1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6415', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '287780', '6415', 9521.56, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a0372d7c-2833-4587-af92-025f8d2feab2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-08-03', DATE '2026-10-02', 9521.56, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 126). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a0372d7c-2833-4587-af92-025f8d2feab2', '1d3b777f-a91b-44eb-918f-ed5b40f64de1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a0372d7c-2833-4587-af92-025f8d2feab2', '1d3b777f-a91b-44eb-918f-ed5b40f64de1', DATE '2026-10-02', DATE '2026-08-31', 9521.56, 9521.56, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 127 | apLIS lote 6416
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('72b3b768-2219-4997-ba5c-8b821e3cd880', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6416', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '287758', '6416', 245.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a18dc930-e022-4f39-9b9f-79b446bdfc3e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-08-03', DATE '2026-10-02', 245.42, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 127). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a18dc930-e022-4f39-9b9f-79b446bdfc3e', '72b3b768-2219-4997-ba5c-8b821e3cd880');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('a18dc930-e022-4f39-9b9f-79b446bdfc3e', '72b3b768-2219-4997-ba5c-8b821e3cd880', DATE '2026-10-02', DATE '2026-08-31', 245.42, 245.42, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 128 | apLIS lote 6429
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7b60d197-d827-46ba-93c5-e34cb8d98bca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6429', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '287160', '6429', 3073.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('10203a63-ec34-4eae-a329-34b48074a1ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-08-03', DATE '2026-10-02', 3073.0, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 128). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('10203a63-ec34-4eae-a329-34b48074a1ed', '7b60d197-d827-46ba-93c5-e34cb8d98bca');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('10203a63-ec34-4eae-a329-34b48074a1ed', '7b60d197-d827-46ba-93c5-e34cb8d98bca', DATE '2026-10-02', DATE '2026-08-31', 3073.0, 3073.0, 'recebido', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 129 | apLIS lote 6461
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0c9b5fa6-bd80-4289-a29f-a268cd08f312', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6461', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '288764', '6461', 2992.53, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c3a25f14-8931-4769-b942-d36ba6bade38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-08-05', DATE '2026-10-02', 2992.53, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 129). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c3a25f14-8931-4769-b942-d36ba6bade38', '0c9b5fa6-bd80-4289-a29f-a268cd08f312');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, registrado_por, observacoes)
VALUES ('c3a25f14-8931-4769-b942-d36ba6bade38', '0c9b5fa6-bd80-4289-a29f-a268cd08f312', DATE '2026-10-02', DATE '2026-08-31', 2992.53, 2992.53, 'recebido', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 130 | apLIS lote 6317
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bf66fe9c-576e-44ff-88d0-4130c4a0116b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6317', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '229970660', '6317', 18454.27, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4772dfda-92d1-43d8-847c-06ab20f00bd8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-03', DATE '2026-09-02', 18454.27, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 130). Responsável: Renata. Status original na planilha: Vencido. Refaturamento: sim (valor: R$ 455.74).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4772dfda-92d1-43d8-847c-06ab20f00bd8', 'bf66fe9c-576e-44ff-88d0-4130c4a0116b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4772dfda-92d1-43d8-847c-06ab20f00bd8', 'bf66fe9c-576e-44ff-88d0-4130c4a0116b', DATE '2026-09-02', 18454.27, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 131 | apLIS lote 6316
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9af977b5-70c7-43c5-bfba-b21b11aadd59', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6316', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '229583209', '6316', 23904.62, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-05', DATE '2026-09-04', 23904.62, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 131). Responsável: Renata. Status original na planilha: Vencido. Refaturamento: sim (valor: R$ 227.87).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', '9af977b5-70c7-43c5-bfba-b21b11aadd59');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', '9af977b5-70c7-43c5-bfba-b21b11aadd59', DATE '2026-09-04', 23904.62, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 132 | apLIS lote 6482
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b58eab53-b390-4d22-909b-8f37ae254811', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6482', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '230147607', '6482', 24974.63, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('527cbf24-20ff-4817-b5d9-42f1f0d0a30b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-07', DATE '2026-09-06', 24974.63, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 132). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('527cbf24-20ff-4817-b5d9-42f1f0d0a30b', 'b58eab53-b390-4d22-909b-8f37ae254811');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('527cbf24-20ff-4817-b5d9-42f1f0d0a30b', 'b58eab53-b390-4d22-909b-8f37ae254811', DATE '2026-09-06', 24974.63, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 133 | apLIS lote 6483
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('def6bd0e-9061-47d2-8759-83ff2324263e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6483', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '230140011', '6483', 28073.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94238639-e5ab-4754-acac-9039548a83fa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-07', DATE '2026-09-06', 28073.95, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 133). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94238639-e5ab-4754-acac-9039548a83fa', 'def6bd0e-9061-47d2-8759-83ff2324263e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('94238639-e5ab-4754-acac-9039548a83fa', 'def6bd0e-9061-47d2-8759-83ff2324263e', DATE '2026-09-06', 28073.95, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 134 | apLIS lote 6484
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e268720f-d862-4cc8-98e9-0fef4ce9f0b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6484', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '230153888', '6484', 16301.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3c31cc8d-948a-4117-86ab-6314c2bed4e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-07', DATE '2026-09-06', 16301.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 134). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3c31cc8d-948a-4117-86ab-6314c2bed4e4', 'e268720f-d862-4cc8-98e9-0fef4ce9f0b6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3c31cc8d-948a-4117-86ab-6314c2bed4e4', 'e268720f-d862-4cc8-98e9-0fef4ce9f0b6', DATE '2026-09-06', 16301.38, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 135 | apLIS lote 6485
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('42b96243-f5c9-46c6-a860-2d531c8106a2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6485', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '230160352', '6485', 10795.96, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fc9655a3-8977-4119-8d6f-9cb275239c32', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-07', DATE '2026-09-06', 10795.96, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 135). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fc9655a3-8977-4119-8d6f-9cb275239c32', '42b96243-f5c9-46c6-a860-2d531c8106a2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fc9655a3-8977-4119-8d6f-9cb275239c32', '42b96243-f5c9-46c6-a860-2d531c8106a2', DATE '2026-09-06', 10795.96, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 136 | apLIS lote 6493
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3597c31f-4dd5-4970-834e-46ab16704dc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6493', DATE '2026-08-07', DATE '2026-08-07', 'Faturado', '230161734', '6493', 1859.87, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4e788b3e-e165-4a54-af9b-e86058534f3c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-07', DATE '2026-09-06', 1859.87, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 136). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4e788b3e-e165-4a54-af9b-e86058534f3c', '3597c31f-4dd5-4970-834e-46ab16704dc5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4e788b3e-e165-4a54-af9b-e86058534f3c', '3597c31f-4dd5-4970-834e-46ab16704dc5', DATE '2026-09-06', 1859.87, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 137 | apLIS lote 6526
-- EXCLUÍDA: já existe título real cadastrado no sistema para este lote
-- (aplis_id=6526 já presente em `lotes` em produção — mesma situação dos
-- outros 12 lotes documentados no relatório de importação). Descoberta ao
-- rodar `supabase db push` em produção, não na conferência prévia contra o
-- apLIS. Ver .scratch/faturamento-backfill-q3-2026/relatorio-importacao.md.

-- AGOSTO linha 138 | apLIS lote 6537
-- EXCLUÍDA: já existe título real cadastrado no sistema para este lote
-- (aplis_id=6537 já presente em `lotes` em produção). Descoberta numa 3ª
-- tentativa de rodar esta migration em produção. Ver relatório de
-- importação em .scratch/faturamento-backfill-q3-2026/relatorio-importacao.md.

-- AGOSTO linha 139 | apLIS lote 6557
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('98e24448-e7f9-402c-b374-1430efa410ba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6557', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '230427905', '6557', 8106.71, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('17bea771-acdf-4556-ba22-d5fd33a484a9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-17', DATE '2026-09-16', 8106.71, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 139). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('17bea771-acdf-4556-ba22-d5fd33a484a9', '98e24448-e7f9-402c-b374-1430efa410ba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('17bea771-acdf-4556-ba22-d5fd33a484a9', '98e24448-e7f9-402c-b374-1430efa410ba', DATE '2026-09-16', 8106.71, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 140 | apLIS lote 6575
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5e078dd9-5021-4734-81ba-d4d251d3f2c2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6575', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '230465657', '6575', 12164.15, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('f7bf56d8-da26-482b-92e4-5409551728fc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-08-18', DATE '2026-09-17', 12164.15, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 140). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('f7bf56d8-da26-482b-92e4-5409551728fc', '5e078dd9-5021-4734-81ba-d4d251d3f2c2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('f7bf56d8-da26-482b-92e4-5409551728fc', '5e078dd9-5021-4734-81ba-d4d251d3f2c2', DATE '2026-09-17', 12164.15, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 141 | apLIS lote 6670
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64a3096c-2378-48d4-8e83-941baa1c2e13', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '6670', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '2608311000251642918', '6670', 9786.48, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1a5f8485-2c8e-4cbf-bdc2-835adc3df04d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), DATE '2026-08-31', DATE '2026-09-30', 9786.48, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 141). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1a5f8485-2c8e-4cbf-bdc2-835adc3df04d', '64a3096c-2378-48d4-8e83-941baa1c2e13');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1a5f8485-2c8e-4cbf-bdc2-835adc3df04d', '64a3096c-2378-48d4-8e83-941baa1c2e13', DATE '2026-09-30', 9786.48, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 142 | apLIS lote 6676
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f8d4fa63-3647-4d31-a4ee-e709c6f193a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), '6676', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '2608311717114672918', '6676', 2244.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c3e30f3b-e341-4147-b778-09c881d60055', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1210'), DATE '2026-08-31', DATE '2026-08-31', 2244.11, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 142). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c3e30f3b-e341-4147-b778-09c881d60055', 'f8d4fa63-3647-4d31-a4ee-e709c6f193a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c3e30f3b-e341-4147-b778-09c881d60055', 'f8d4fa63-3647-4d31-a4ee-e709c6f193a0', DATE '2026-08-31', 2244.11, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 143 | apLIS lote 3992
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('74294e90-3e8c-47ff-a28a-689a032644bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '3992', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '835757', '3992', 3750.58, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('97eac1e5-3463-4bf0-9c72-b185321bfb68', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-18', DATE '2026-10-17', 3750.58, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 143). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('97eac1e5-3463-4bf0-9c72-b185321bfb68', '74294e90-3e8c-47ff-a28a-689a032644bc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('97eac1e5-3463-4bf0-9c72-b185321bfb68', '74294e90-3e8c-47ff-a28a-689a032644bc', DATE '2026-10-17', 3750.58, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 144 | apLIS lote 6567
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('539ff9c5-aa8b-482a-9c47-1d6a7d110a5a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6567', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '835762', '6567', 73.66, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('54a8c3e9-fc4d-49d4-891c-f7fe6bf8b79c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-18', DATE '2026-10-17', 73.66, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 144). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('54a8c3e9-fc4d-49d4-891c-f7fe6bf8b79c', '539ff9c5-aa8b-482a-9c47-1d6a7d110a5a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('54a8c3e9-fc4d-49d4-891c-f7fe6bf8b79c', '539ff9c5-aa8b-482a-9c47-1d6a7d110a5a', DATE '2026-10-17', 73.66, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 145 | apLIS lote 6566
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('45ce4a7c-1588-422b-beea-7ffe706a9603', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6566', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '835765', '6566', 24182.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7b1d8c33-1acb-4c02-8ba8-27fe7dc1b1a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-18', DATE '2026-10-17', 24182.83, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 145). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7b1d8c33-1acb-4c02-8ba8-27fe7dc1b1a0', '45ce4a7c-1588-422b-beea-7ffe706a9603');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7b1d8c33-1acb-4c02-8ba8-27fe7dc1b1a0', '45ce4a7c-1588-422b-beea-7ffe706a9603', DATE '2026-10-17', 24182.83, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 146 | apLIS lote 6568
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b37012f6-b4b0-4b76-a66c-c02ad6746a60', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6568', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '835764', '6568', 1628.09, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('197eaa3f-3fe2-469f-8988-86b0034c9032', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-18', DATE '2026-10-17', 1628.09, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 146). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('197eaa3f-3fe2-469f-8988-86b0034c9032', 'b37012f6-b4b0-4b76-a66c-c02ad6746a60');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('197eaa3f-3fe2-469f-8988-86b0034c9032', 'b37012f6-b4b0-4b76-a66c-c02ad6746a60', DATE '2026-10-17', 1628.09, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 147 | apLIS lote 6573
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('af45a123-5a0e-4280-97ff-93927ebcdcba', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6573', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '835761', '6573', 456.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('89809fd7-2ba9-4319-a7cd-3cfbe932f24b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-18', DATE '2026-10-17', 456.9, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 147). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('89809fd7-2ba9-4319-a7cd-3cfbe932f24b', 'af45a123-5a0e-4280-97ff-93927ebcdcba');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('89809fd7-2ba9-4319-a7cd-3cfbe932f24b', 'af45a123-5a0e-4280-97ff-93927ebcdcba', DATE '2026-10-17', 456.9, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 148 | apLIS lote 6625
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5540f9a6-6fe9-4202-89ce-417e017982b8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6625', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '836718', '6625', 8734.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('562d973d-a834-4b6f-85ad-0198b632fa5f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-25', DATE '2026-10-24', 8734.69, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 148). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('562d973d-a834-4b6f-85ad-0198b632fa5f', '5540f9a6-6fe9-4202-89ce-417e017982b8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('562d973d-a834-4b6f-85ad-0198b632fa5f', '5540f9a6-6fe9-4202-89ce-417e017982b8', DATE '2026-10-24', 8734.69, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 149 | apLIS lote 6664
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('71954bcd-903c-41fe-911e-fb8c6df82050', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6664', DATE '2026-08-28', DATE '2026-08-28', 'Faturado', '837278', '6664', 4733.21, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('65d4e444-3bcb-4307-91a1-e5ae311befc1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-08-28', DATE '2026-08-28', 4733.21, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 149). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('65d4e444-3bcb-4307-91a1-e5ae311befc1', '71954bcd-903c-41fe-911e-fb8c6df82050');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('65d4e444-3bcb-4307-91a1-e5ae311befc1', '71954bcd-903c-41fe-911e-fb8c6df82050', DATE '2026-08-28', 4733.21, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 151 | apLIS lote 6423
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('595a68c0-0eb4-4f7e-971e-790158b8160c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6423', DATE '2026-08-04', DATE '2026-08-04', 'Faturado', 'PEG 196333', '6423', 9320.79, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-08-04', DATE '2026-09-01', 9320.79, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 151). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', '595a68c0-0eb4-4f7e-971e-790158b8160c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', '595a68c0-0eb4-4f7e-971e-790158b8160c', DATE '2026-09-01', 9320.79, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 152 | apLIS lote 6453
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c62eee7b-37cc-472d-a148-e9e14e430199', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6453', DATE '2026-08-04', DATE '2026-08-04', 'Faturado', 'PEG 196312', '6453', 313.22, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('353a637e-1f33-4a9c-92c2-f0a6d7e06506', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-08-04', DATE '2026-09-01', 313.22, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 152). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('353a637e-1f33-4a9c-92c2-f0a6d7e06506', 'c62eee7b-37cc-472d-a148-e9e14e430199');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('353a637e-1f33-4a9c-92c2-f0a6d7e06506', 'c62eee7b-37cc-472d-a148-e9e14e430199', DATE '2026-09-01', 313.22, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 153 | apLIS lote 6459
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('92386529-f4ed-4cdc-a187-f0e8db303bb5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6459', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '144300', '6459', 575.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3d6d4e2f-45ce-4592-a418-506e7d7af15d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-08-05', DATE '2026-09-02', 575.85, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 153). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3d6d4e2f-45ce-4592-a418-506e7d7af15d', '92386529-f4ed-4cdc-a187-f0e8db303bb5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3d6d4e2f-45ce-4592-a418-506e7d7af15d', '92386529-f4ed-4cdc-a187-f0e8db303bb5', DATE '2026-09-02', 575.85, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 154 | apLIS lote 6450
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3d17794a-9f4a-40d8-89cf-f8aa6646afaa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '6450', DATE '2026-08-04', DATE '2026-08-04', 'Faturado', '20260805143834', '6450', 422.39, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('21cff70f-c1c3-4ddb-83e9-f7c9a6692a65', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), DATE '2026-08-04', DATE '2026-10-03', 422.39, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 154). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('21cff70f-c1c3-4ddb-83e9-f7c9a6692a65', '3d17794a-9f4a-40d8-89cf-f8aa6646afaa');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('21cff70f-c1c3-4ddb-83e9-f7c9a6692a65', '3d17794a-9f4a-40d8-89cf-f8aa6646afaa', DATE '2026-10-03', 422.39, 'previsto', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 155 | apLIS lote 6443
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7f838296-0d97-4919-a8f4-1ef38f374c3d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '6443', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '20260805143754', '6443', 731.32, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a5b6be1d-c7e7-4bfd-8661-261de408a9f7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), DATE '2026-08-05', DATE '2026-10-04', 731.32, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 155). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a5b6be1d-c7e7-4bfd-8661-261de408a9f7', '7f838296-0d97-4919-a8f4-1ef38f374c3d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a5b6be1d-c7e7-4bfd-8661-261de408a9f7', '7f838296-0d97-4919-a8f4-1ef38f374c3d', DATE '2026-10-04', 731.32, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 156 | apLIS lote 6460
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1603a54e-e9ec-4a86-b8a1-16631719551b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6460', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '172258161', '6460', 14846.68, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('be4cb2e6-fed5-4d25-8e28-e116f17d9e93', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-08-05', DATE '2026-11-03', 14846.68, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 156). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('be4cb2e6-fed5-4d25-8e28-e116f17d9e93', '1603a54e-e9ec-4a86-b8a1-16631719551b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('be4cb2e6-fed5-4d25-8e28-e116f17d9e93', '1603a54e-e9ec-4a86-b8a1-16631719551b', DATE '2026-11-03', 14846.68, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 157 | apLIS lote 6504
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ba566f37-802a-466a-9339-4c03a2dc38be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6504', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '175601810', '6504', 3169.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('438fa2f8-4abd-44b6-aa75-9bee8b7e523f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-08-10', DATE '2026-11-08', 3169.14, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 157). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('438fa2f8-4abd-44b6-aa75-9bee8b7e523f', 'ba566f37-802a-466a-9339-4c03a2dc38be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('438fa2f8-4abd-44b6-aa75-9bee8b7e523f', 'ba566f37-802a-466a-9339-4c03a2dc38be', DATE '2026-11-08', 3169.14, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 158 | apLIS lote 6506
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8420060c-7c07-4866-abc9-45d356bd3bb3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6506', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '201915', '6506', 16014.57, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7b8de9bc-3817-402b-8180-a400c048bdbf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-08-11', DATE '2026-09-10', 16014.57, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 158). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7b8de9bc-3817-402b-8180-a400c048bdbf', '8420060c-7c07-4866-abc9-45d356bd3bb3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7b8de9bc-3817-402b-8180-a400c048bdbf', '8420060c-7c07-4866-abc9-45d356bd3bb3', DATE '2026-09-10', 16014.57, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 159 | apLIS lote 6545
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('063f0922-808b-4c9a-a09b-ec86903e8d83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6545', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '202913', '6545', 2835.7, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cddd20d4-b00a-40f3-b60b-e0ac26cb1315', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-08-14', DATE '2026-09-13', 2835.7, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 159). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cddd20d4-b00a-40f3-b60b-e0ac26cb1315', '063f0922-808b-4c9a-a09b-ec86903e8d83');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('cddd20d4-b00a-40f3-b60b-e0ac26cb1315', '063f0922-808b-4c9a-a09b-ec86903e8d83', DATE '2026-09-13', 2835.7, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 160 | apLIS lote 6581
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('89013036-02f6-439f-b50d-d7fbf723356d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6581', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '204143', '6581', 10967.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8f026dc4-45ac-403c-8c25-fd00f73fb49b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-08-19', DATE '2026-09-18', 10967.75, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 160). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8f026dc4-45ac-403c-8c25-fd00f73fb49b', '89013036-02f6-439f-b50d-d7fbf723356d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8f026dc4-45ac-403c-8c25-fd00f73fb49b', '89013036-02f6-439f-b50d-d7fbf723356d', DATE '2026-09-18', 10967.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 161 | apLIS lote 6644
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9214380a-09bd-41c7-8e13-47ff0d7f1a42', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), '6644', DATE '2026-08-26', DATE '2026-08-26', 'Faturado', '207468', '6644', 4755.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3034db3c-9aa7-4e32-b90b-765250350690', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1257'), DATE '2026-08-26', DATE '2026-09-25', 4755.11, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 161). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3034db3c-9aa7-4e32-b90b-765250350690', '9214380a-09bd-41c7-8e13-47ff0d7f1a42');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3034db3c-9aa7-4e32-b90b-765250350690', '9214380a-09bd-41c7-8e13-47ff0d7f1a42', DATE '2026-09-25', 4755.11, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 162 | apLIS lote 6458
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('01dfcfe8-790c-4d0c-a0db-20731bcb07be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '6458', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '723175', '6458', 3093.55, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7f1249e9-0ba0-4560-8be5-13e5ec661e35', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), DATE '2026-08-05', DATE '2026-08-05', 3093.55, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 162). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7f1249e9-0ba0-4560-8be5-13e5ec661e35', '01dfcfe8-790c-4d0c-a0db-20731bcb07be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7f1249e9-0ba0-4560-8be5-13e5ec661e35', '01dfcfe8-790c-4d0c-a0db-20731bcb07be', DATE '2026-08-05', 3093.55, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 163 | apLIS lote 6447
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a7ddd120-3e53-4e1f-9b5c-09a3c9d9f689', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6447', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '4377268', '6447', 16365.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2f287e2c-c046-4011-8d2e-3e4fb8ef3b12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-08-03', DATE '2026-10-02', 16365.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 163). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2f287e2c-c046-4011-8d2e-3e4fb8ef3b12', 'a7ddd120-3e53-4e1f-9b5c-09a3c9d9f689');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2f287e2c-c046-4011-8d2e-3e4fb8ef3b12', 'a7ddd120-3e53-4e1f-9b5c-09a3c9d9f689', DATE '2026-10-02', 16365.35, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 164 | apLIS lote 6422
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('33d68fa4-80e5-43e2-8f63-b3a2bc44bbf7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6422', DATE '2026-08-04', DATE '2026-08-04', 'Faturado', '4383278', '6422', 20.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6dfe4e4e-dd3c-43d6-b016-ee8eb3f316dc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-08-04', DATE '2026-10-03', 20.83, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 164). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6dfe4e4e-dd3c-43d6-b016-ee8eb3f316dc', '33d68fa4-80e5-43e2-8f63-b3a2bc44bbf7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6dfe4e4e-dd3c-43d6-b016-ee8eb3f316dc', '33d68fa4-80e5-43e2-8f63-b3a2bc44bbf7', DATE '2026-10-03', 20.83, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 165 | apLIS lote 6454
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('77f4ad60-4693-4ea1-b36c-591d6621b9ab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6454', DATE '2026-08-04', DATE '2026-08-04', 'Faturado', '4383208', '6454', 1097.31, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('53bdf362-b357-41e3-a678-4fdc3f99c99a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-08-04', DATE '2026-10-03', 1097.31, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 165). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('53bdf362-b357-41e3-a678-4fdc3f99c99a', '77f4ad60-4693-4ea1-b36c-591d6621b9ab');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('53bdf362-b357-41e3-a678-4fdc3f99c99a', '77f4ad60-4693-4ea1-b36c-591d6621b9ab', DATE '2026-10-03', 1097.31, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 166 | apLIS lote 6463
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c4f0aede-89b4-469e-8c67-9f9af90e46bc', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6463', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '4389955', '6463', 2340.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c949fbb2-704c-4098-9c74-83b0be7bd139', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-08-05', DATE '2026-10-04', 2340.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 166). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c949fbb2-704c-4098-9c74-83b0be7bd139', 'c4f0aede-89b4-469e-8c67-9f9af90e46bc');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c949fbb2-704c-4098-9c74-83b0be7bd139', 'c4f0aede-89b4-469e-8c67-9f9af90e46bc', DATE '2026-10-04', 2340.35, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 167 | apLIS lote 6410
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7149e85d-754e-4d49-b7f9-148c03cdb44f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6410', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '41381', '6410', 8928.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1c34e99f-4d32-48e0-a4d3-f69415ac3b2b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-08-03', DATE '2026-09-30', 8928.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 167). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1c34e99f-4d32-48e0-a4d3-f69415ac3b2b', '7149e85d-754e-4d49-b7f9-148c03cdb44f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1c34e99f-4d32-48e0-a4d3-f69415ac3b2b', '7149e85d-754e-4d49-b7f9-148c03cdb44f', DATE '2026-09-30', 8928.38, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 168 | apLIS lote 6417
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cadcead4-10ca-4200-ad9a-9fe46e323ace', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6417', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '41351', '6417', 432.58, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3041f4ac-0097-436a-8ccd-bf37bd6e4c13', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-08-03', DATE '2026-09-30', 432.58, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 168). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3041f4ac-0097-436a-8ccd-bf37bd6e4c13', 'cadcead4-10ca-4200-ad9a-9fe46e323ace');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3041f4ac-0097-436a-8ccd-bf37bd6e4c13', 'cadcead4-10ca-4200-ad9a-9fe46e323ace', DATE '2026-09-30', 432.58, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 169 | apLIS lote 6445
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('367cc6da-1cb1-4546-a09c-87c60c2a5c80', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6445', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '41405', '6445', 2523.72, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fbdaab4e-0bcc-477e-9713-0d1b6f3db150', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-08-03', DATE '2026-09-30', 2523.72, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 169). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fbdaab4e-0bcc-477e-9713-0d1b6f3db150', '367cc6da-1cb1-4546-a09c-87c60c2a5c80');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fbdaab4e-0bcc-477e-9713-0d1b6f3db150', '367cc6da-1cb1-4546-a09c-87c60c2a5c80', DATE '2026-09-30', 2523.72, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 170 | apLIS lote 6444
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6644a290-de34-44ef-b153-82ed4fdf811d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6444', DATE '2026-08-05', DATE '2026-08-05', 'Faturado', '41840', '6444', 1553.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a6054895-be79-42e9-814d-e8f2a8dc8d22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-08-05', DATE '2026-09-30', 1553.78, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 170). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a6054895-be79-42e9-814d-e8f2a8dc8d22', '6644a290-de34-44ef-b153-82ed4fdf811d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a6054895-be79-42e9-814d-e8f2a8dc8d22', '6644a290-de34-44ef-b153-82ed4fdf811d', DATE '2026-09-30', 1553.78, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 171 | apLIS lote 5429
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f9b29fc1-8328-46b2-a520-a6251fccc8c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '5429', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '476274', '5429', 895.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('79cbccb9-45ff-413c-acaa-ad66d61bc4d5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-03', DATE '2026-09-02', 895.83, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 171). Responsável: Renata. Status original na planilha: Vencido. [dado corrigido] número de lote da planilha não batia com o apLIS; lote real identificado via Protocolo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('79cbccb9-45ff-413c-acaa-ad66d61bc4d5', 'f9b29fc1-8328-46b2-a520-a6251fccc8c1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('79cbccb9-45ff-413c-acaa-ad66d61bc4d5', 'f9b29fc1-8328-46b2-a520-a6251fccc8c1', DATE '2026-09-02', 895.83, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 172 | apLIS lote 6509
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9cb89e58-a420-4787-a3a7-d6b54a439067', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6509', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '478990', '6509', 22548.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bd54bead-e25b-4a76-9de2-7697bfa98b8f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-11', DATE '2026-09-10', 22548.02, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 172). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bd54bead-e25b-4a76-9de2-7697bfa98b8f', '9cb89e58-a420-4787-a3a7-d6b54a439067');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('bd54bead-e25b-4a76-9de2-7697bfa98b8f', '9cb89e58-a420-4787-a3a7-d6b54a439067', DATE '2026-09-10', 22548.02, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 173 | apLIS lote 6512
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('cf56c746-9818-4ef4-9c42-297a786ae830', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6512', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '479132', '6512', 7652.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e3604423-5c84-4fca-8039-c198f82cc17e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-11', DATE '2026-09-10', 7652.9, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 173). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e3604423-5c84-4fca-8039-c198f82cc17e', 'cf56c746-9818-4ef4-9c42-297a786ae830');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e3604423-5c84-4fca-8039-c198f82cc17e', 'cf56c746-9818-4ef4-9c42-297a786ae830', DATE '2026-09-10', 7652.9, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 174 | apLIS lote 6517
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5b28f708-9fa4-41b9-9406-50d350f24729', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6517', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '479249', '6517', 15214.13, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('29e717c5-6b6c-431a-b28f-96eb0d64c406', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-12', DATE '2026-09-11', 15214.13, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 174). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('29e717c5-6b6c-431a-b28f-96eb0d64c406', '5b28f708-9fa4-41b9-9406-50d350f24729');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('29e717c5-6b6c-431a-b28f-96eb0d64c406', '5b28f708-9fa4-41b9-9406-50d350f24729', DATE '2026-09-11', 15214.13, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 175 | apLIS lote 6524
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0742648f-ecde-489b-aa64-a60c9f1e27a0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6524', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '479568', '6524', 17352.45, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b3e749d-d327-43b1-943d-6f37eba8cbd4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-12', DATE '2026-09-11', 17352.45, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 175). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b3e749d-d327-43b1-943d-6f37eba8cbd4', '0742648f-ecde-489b-aa64-a60c9f1e27a0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1b3e749d-d327-43b1-943d-6f37eba8cbd4', '0742648f-ecde-489b-aa64-a60c9f1e27a0', DATE '2026-09-11', 17352.45, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 176 | apLIS lote 6565
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ff5c70d9-8b3d-47fb-a7f3-c8b073030131', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6565', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '480891', '6565', 8640.5, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('88d3bcfb-5c25-46ec-b696-95d3b3cc0f12', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-17', DATE '2026-09-16', 8640.5, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 176). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('88d3bcfb-5c25-46ec-b696-95d3b3cc0f12', 'ff5c70d9-8b3d-47fb-a7f3-c8b073030131');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('88d3bcfb-5c25-46ec-b696-95d3b3cc0f12', 'ff5c70d9-8b3d-47fb-a7f3-c8b073030131', DATE '2026-09-16', 8640.5, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 177 | apLIS lote 6569
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9fec7f70-0740-4804-82fd-a55600ebcac8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6569', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '481109', '6569', 7700.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c8d7966d-37b7-4c2b-9eeb-731e92b02c2c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-18', DATE '2026-09-17', 7700.14, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 177). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c8d7966d-37b7-4c2b-9eeb-731e92b02c2c', '9fec7f70-0740-4804-82fd-a55600ebcac8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c8d7966d-37b7-4c2b-9eeb-731e92b02c2c', '9fec7f70-0740-4804-82fd-a55600ebcac8', DATE '2026-09-17', 7700.14, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 178 | apLIS lote 6574
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3751b975-213b-4122-adef-ca26b2b816f0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6574', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '481226', '6574', 17838.4, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('fabe0a8b-bcf6-4262-839a-8cecd6fa1b0f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-18', DATE '2026-09-17', 17838.4, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 178). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('fabe0a8b-bcf6-4262-839a-8cecd6fa1b0f', '3751b975-213b-4122-adef-ca26b2b816f0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('fabe0a8b-bcf6-4262-839a-8cecd6fa1b0f', '3751b975-213b-4122-adef-ca26b2b816f0', DATE '2026-09-17', 17838.4, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 179 | apLIS lote 6603
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('34e6da91-ff9a-4453-9189-0a203ebc7c6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6603', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '482124', '6603', 8159.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d4d8b133-5134-436d-a014-172e5c9caeeb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-20', DATE '2026-09-19', 8159.14, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 179). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d4d8b133-5134-436d-a014-172e5c9caeeb', '34e6da91-ff9a-4453-9189-0a203ebc7c6e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d4d8b133-5134-436d-a014-172e5c9caeeb', '34e6da91-ff9a-4453-9189-0a203ebc7c6e', DATE '2026-09-19', 8159.14, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 180 | apLIS lote 6624
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b01c29b1-69cb-440e-b517-d83133e963f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6624', DATE '2026-08-24', DATE '2026-08-24', 'Faturado', '483105', '6624', 25174.61, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d3d73f3f-4f81-4d7f-babe-efd96e396a9e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-24', DATE '2026-09-23', 25174.61, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 180). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d3d73f3f-4f81-4d7f-babe-efd96e396a9e', 'b01c29b1-69cb-440e-b517-d83133e963f6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d3d73f3f-4f81-4d7f-babe-efd96e396a9e', 'b01c29b1-69cb-440e-b517-d83133e963f6', DATE '2026-09-23', 25174.61, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 181 | apLIS lote 6638
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c94b8d98-d2eb-45a6-9e77-afabac400859', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6638', DATE '2026-08-26', DATE '2026-08-26', 'Faturado', '484269', '6638', 25412.47, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e48cbe96-e351-4708-81ac-2a95424716aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-26', DATE '2026-09-25', 25412.47, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 181). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e48cbe96-e351-4708-81ac-2a95424716aa', 'c94b8d98-d2eb-45a6-9e77-afabac400859');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e48cbe96-e351-4708-81ac-2a95424716aa', 'c94b8d98-d2eb-45a6-9e77-afabac400859', DATE '2026-09-25', 25412.47, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 182 | apLIS lote 6653
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5acdfb4d-180e-4cd3-872d-d88889669b6c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), '6653', DATE '2026-08-27', DATE '2026-08-27', 'Faturado', '484943', '6653', 7584.58, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2fda5843-602f-4052-9831-2d4bdf430c14', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1251'), DATE '2026-08-27', DATE '2026-09-26', 7584.58, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 182). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2fda5843-602f-4052-9831-2d4bdf430c14', '5acdfb4d-180e-4cd3-872d-d88889669b6c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2fda5843-602f-4052-9831-2d4bdf430c14', '5acdfb4d-180e-4cd3-872d-d88889669b6c', DATE '2026-09-26', 7584.58, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 183 | apLIS lote 6466
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('bae85490-4552-41d7-9ba4-78b447913880', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6466', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '87734', '6466', 26060.24, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5c44bfe6-3e13-4005-b0ff-4e14039cc281', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-08-06', DATE '2026-09-05', 26060.24, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 183). Responsável: Rivia. Status original na planilha: Vencido. [dado corrigido] número de lote da planilha não batia com o apLIS; lote real identificado via Protocolo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5c44bfe6-3e13-4005-b0ff-4e14039cc281', 'bae85490-4552-41d7-9ba4-78b447913880');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5c44bfe6-3e13-4005-b0ff-4e14039cc281', 'bae85490-4552-41d7-9ba4-78b447913880', DATE '2026-09-05', 26060.24, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 184 | apLIS lote 6329
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a9bcdc4-81d0-4d9c-9988-099acb73da82', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6329', DATE '2026-08-06', DATE '2026-08-06', 'Faturado', '87837', '6329', 2034.81, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('20799919-8862-4354-84e0-35d7cd17a73d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-08-06', DATE '2026-09-05', 2034.81, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 184). Responsável: Rivia. Status original na planilha: Vencido. [dado corrigido] número de lote da planilha não batia com o apLIS; lote real identificado via Protocolo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('20799919-8862-4354-84e0-35d7cd17a73d', '1a9bcdc4-81d0-4d9c-9988-099acb73da82');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('20799919-8862-4354-84e0-35d7cd17a73d', '1a9bcdc4-81d0-4d9c-9988-099acb73da82', DATE '2026-09-05', 2034.81, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 185 | apLIS lote 6607
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6fc2b786-198a-4702-a0a9-c9f34711b987', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6607', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '92586', '6607', 15771.18, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c9be3046-72d9-42dc-9c77-6b5a88790527', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-08-21', DATE '2026-09-20', 15771.18, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 185). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c9be3046-72d9-42dc-9c77-6b5a88790527', '6fc2b786-198a-4702-a0a9-c9f34711b987');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c9be3046-72d9-42dc-9c77-6b5a88790527', '6fc2b786-198a-4702-a0a9-c9f34711b987', DATE '2026-09-20', 15771.18, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 186 | apLIS lote 6608
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65755e25-59b6-46ad-8e22-8589fee88c3f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6608', DATE '2026-08-21', DATE '2026-08-21', 'Faturado', '92669', '6608', 18513.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7651f95c-32b4-4120-8ebb-e515e6329286', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-08-21', DATE '2026-09-20', 18513.01, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 186). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7651f95c-32b4-4120-8ebb-e515e6329286', '65755e25-59b6-46ad-8e22-8589fee88c3f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7651f95c-32b4-4120-8ebb-e515e6329286', '65755e25-59b6-46ad-8e22-8589fee88c3f', DATE '2026-09-20', 18513.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 187 | apLIS lote 6543
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a199327-75bf-48ae-b9c9-5d002ebada1a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6543', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '227536', '6543', 6112.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('438158f5-0297-4b92-9b3d-bd0ddcbda5b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-08-14', DATE '2026-10-13', 6112.42, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 187). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('438158f5-0297-4b92-9b3d-bd0ddcbda5b2', '1a199327-75bf-48ae-b9c9-5d002ebada1a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('438158f5-0297-4b92-9b3d-bd0ddcbda5b2', '1a199327-75bf-48ae-b9c9-5d002ebada1a', DATE '2026-10-13', 6112.42, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 188 | apLIS lote 6542
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('16d3618f-e0c9-4220-a3a8-7d9bcc97eb83', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '6542', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '227550', '6542', 13194.26, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8b24b71f-75ba-402d-9f6e-50be2a86d284', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-08-14', DATE '2026-10-13', 13194.26, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 188). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8b24b71f-75ba-402d-9f6e-50be2a86d284', '16d3618f-e0c9-4220-a3a8-7d9bcc97eb83');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8b24b71f-75ba-402d-9f6e-50be2a86d284', '16d3618f-e0c9-4220-a3a8-7d9bcc97eb83', DATE '2026-10-13', 13194.26, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 189 | apLIS lote 6413
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2ee1d770-4949-45b6-9b8d-e87a757b2396', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6413', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '7535218', '6413', 20084.31, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b176d750-4909-4278-901a-432eacf1e864', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-03', DATE '2026-09-02', 20084.31, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 189). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b176d750-4909-4278-901a-432eacf1e864', '2ee1d770-4949-45b6-9b8d-e87a757b2396');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b176d750-4909-4278-901a-432eacf1e864', '2ee1d770-4949-45b6-9b8d-e87a757b2396', DATE '2026-09-02', 20084.31, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 190 | apLIS lote 6530
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dc81059d-63aa-4ae0-af27-12151f8c21eb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6530', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '7558040', '6530', 31894.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0d9af67e-b6b4-4624-91f3-aa37ed5f4e0c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-12', DATE '2026-09-11', 31894.64, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 190). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0d9af67e-b6b4-4624-91f3-aa37ed5f4e0c', 'dc81059d-63aa-4ae0-af27-12151f8c21eb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0d9af67e-b6b4-4624-91f3-aa37ed5f4e0c', 'dc81059d-63aa-4ae0-af27-12151f8c21eb', DATE '2026-09-11', 31894.64, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 191 | apLIS lote 6531
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d813ce9e-8293-4306-b9a8-8f2ae0ab45c3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6531', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '7558065', '6531', 68.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cf8c7e68-47b6-402d-8751-a178dbeae1c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-12', DATE '2026-09-11', 68.75, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 191). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cf8c7e68-47b6-402d-8751-a178dbeae1c0', 'd813ce9e-8293-4306-b9a8-8f2ae0ab45c3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('cf8c7e68-47b6-402d-8751-a178dbeae1c0', 'd813ce9e-8293-4306-b9a8-8f2ae0ab45c3', DATE '2026-09-11', 68.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 192 | apLIS lote 6532
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('351631f9-89b6-4c2c-b1f9-9e48566e8a91', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6532', DATE '2026-08-12', DATE '2026-08-12', 'Faturado', '7558134', '6532', 2243.59, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-12', DATE '2026-09-11', 2243.59, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 192). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38', '351631f9-89b6-4c2c-b1f9-9e48566e8a91');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38', '351631f9-89b6-4c2c-b1f9-9e48566e8a91', DATE '2026-09-11', 2243.59, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 193 | apLIS lote 6576
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4545904a-2f80-45a3-b127-74b28eb5faa9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6576', DATE '2026-08-18', DATE '2026-08-18', 'Faturado', '7570493', '6576', 23699.7, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2d3ed001-8ad9-497d-b806-295b4404cffe', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-18', DATE '2026-09-17', 23699.7, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 193). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2d3ed001-8ad9-497d-b806-295b4404cffe', '4545904a-2f80-45a3-b127-74b28eb5faa9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2d3ed001-8ad9-497d-b806-295b4404cffe', '4545904a-2f80-45a3-b127-74b28eb5faa9', DATE '2026-09-17', 23699.7, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 194 | apLIS lote 6579
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a6a1e12-70a7-4898-8884-12f3f15d4628', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6579', DATE '2026-08-19', DATE '2026-08-19', 'Faturado', '7571471', '6579', 68.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-19', DATE '2026-09-18', 68.75, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 194). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9', '2a6a1e12-70a7-4898-8884-12f3f15d4628');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9', '2a6a1e12-70a7-4898-8884-12f3f15d4628', DATE '2026-09-18', 68.75, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 195 | apLIS lote 6606
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b806f142-d82b-47b4-b09b-c464f148ce8f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6606', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '7576221', '6606', 8511.34, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('390017a5-8b57-44fa-a5f2-f0a34c9426ca', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-20', DATE '2026-09-19', 8511.34, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 195). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('390017a5-8b57-44fa-a5f2-f0a34c9426ca', 'b806f142-d82b-47b4-b09b-c464f148ce8f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('390017a5-8b57-44fa-a5f2-f0a34c9426ca', 'b806f142-d82b-47b4-b09b-c464f148ce8f', DATE '2026-09-19', 8511.34, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 196 | apLIS lote 6626
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('9c54074f-a662-4704-8cca-dc20ebfc1503', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6626', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '7584237', '6626', 14874.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b3e66c7c-21e1-49d6-89cb-9aa4950b5604', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-25', DATE '2026-09-19', 14874.44, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 196). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b3e66c7c-21e1-49d6-89cb-9aa4950b5604', '9c54074f-a662-4704-8cca-dc20ebfc1503');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b3e66c7c-21e1-49d6-89cb-9aa4950b5604', '9c54074f-a662-4704-8cca-dc20ebfc1503', DATE '2026-09-19', 14874.44, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 197 | apLIS lote 6628
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd88241b-ea69-49ea-926e-bf7b992215f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6628', DATE '2026-08-25', DATE '2026-08-25', 'Faturado', '7584453', '6628', 68.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('93258dd7-bc3d-4b04-9a6a-7d8150af41b4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-25', DATE '2026-09-19', 68.75, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 197). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('93258dd7-bc3d-4b04-9a6a-7d8150af41b4', 'dd88241b-ea69-49ea-926e-bf7b992215f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('93258dd7-bc3d-4b04-9a6a-7d8150af41b4', 'dd88241b-ea69-49ea-926e-bf7b992215f8', DATE '2026-09-19', 68.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 198 | apLIS lote 6662
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6dce9cfb-174f-419b-8dff-07a1056bbf46', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6662', DATE '2026-08-28', DATE '2026-08-28', 'Faturado', '7591584', '6662', 1496.79, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('33f542cb-4c19-42ec-baae-c970e2da0495', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-28', DATE '2026-08-28', 1496.79, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 198). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('33f542cb-4c19-42ec-baae-c970e2da0495', '6dce9cfb-174f-419b-8dff-07a1056bbf46');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('33f542cb-4c19-42ec-baae-c970e2da0495', '6dce9cfb-174f-419b-8dff-07a1056bbf46', DATE '2026-08-28', 1496.79, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 199 | apLIS lote 6663
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4747f460-f475-42a0-96cd-f1ce32f8ad96', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), '6663', DATE '2026-08-28', DATE '2026-08-28', 'Faturado', '7591816', '6663', 5169.99, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c6822aab-0983-4cdf-95fb-97b8078f8e30', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1101'), DATE '2026-08-28', DATE '2026-08-28', 5169.99, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 199). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c6822aab-0983-4cdf-95fb-97b8078f8e30', '4747f460-f475-42a0-96cd-f1ce32f8ad96');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c6822aab-0983-4cdf-95fb-97b8078f8e30', '4747f460-f475-42a0-96cd-f1ce32f8ad96', DATE '2026-08-28', 5169.99, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 200 | apLIS lote 6489
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('49f3ee25-6ebb-4c2a-a7d8-f0d89d7c7ad8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1365'), '6489', DATE '2026-08-10', DATE '2026-08-10', 'Faturado', '229089', '6489', 782.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8dc0fa14-e4ea-451b-96bd-909a27498ae3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1365'), DATE '2026-08-10', DATE '2026-08-10', 782.38, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 200). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8dc0fa14-e4ea-451b-96bd-909a27498ae3', '49f3ee25-6ebb-4c2a-a7d8-f0d89d7c7ad8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8dc0fa14-e4ea-451b-96bd-909a27498ae3', '49f3ee25-6ebb-4c2a-a7d8-f0d89d7c7ad8', DATE '2026-08-10', 782.38, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 201 | apLIS lote 6435
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1a5545c7-91f5-4e2f-9cd9-15e12ce9b838', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6435', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '260803005117', '6435', 377.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c6fe9e2b-8972-4106-8cbf-702e72de7bd2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-03', DATE '2026-09-07', 377.04, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 201). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c6fe9e2b-8972-4106-8cbf-702e72de7bd2', '1a5545c7-91f5-4e2f-9cd9-15e12ce9b838');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c6fe9e2b-8972-4106-8cbf-702e72de7bd2', '1a5545c7-91f5-4e2f-9cd9-15e12ce9b838', DATE '2026-09-07', 377.04, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 202 | apLIS lote 6437
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('43deeb5e-5790-4929-911d-906be3ecf81f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6437', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '260803006397', '6437', 42.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e0066627-b2df-462a-9f44-6b6764d52be9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-03', DATE '2026-09-07', 42.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 202). Responsável: Rivia. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e0066627-b2df-462a-9f44-6b6764d52be9', '43deeb5e-5790-4929-911d-906be3ecf81f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e0066627-b2df-462a-9f44-6b6764d52be9', '43deeb5e-5790-4929-911d-906be3ecf81f', DATE '2026-09-07', 42.35, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 203 | apLIS lote 6639
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('14e4242c-20db-44bf-aeff-483060758137', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6639', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '260831007078', '6639', 19990.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-31', DATE '2026-10-05', 19990.14, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 203). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', '14e4242c-20db-44bf-aeff-483060758137');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', '14e4242c-20db-44bf-aeff-483060758137', DATE '2026-10-05', 19990.14, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 204 | apLIS lote 6640
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('02cde4a9-fa7d-4203-b3e1-dc80383e7391', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6640', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '260831012886', '6640', 14130.12, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-31', DATE '2026-10-05', 14130.12, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 204). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', '02cde4a9-fa7d-4203-b3e1-dc80383e7391');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', '02cde4a9-fa7d-4203-b3e1-dc80383e7391', DATE '2026-10-05', 14130.12, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 205 | apLIS lote 6641
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('839f4b37-a1bc-4110-a768-e7156cc999a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6641', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '260831019218', '6641', 1295.08, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-31', DATE '2026-10-05', 1295.08, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 205). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', '839f4b37-a1bc-4110-a768-e7156cc999a7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', '839f4b37-a1bc-4110-a768-e7156cc999a7', DATE '2026-10-05', 1295.08, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 206 | apLIS lote 6671
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e0b1bfdd-0db6-4690-9bd0-31afa546afb0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6671', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '260831024664', '6671', 6760.62, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-31', DATE '2026-10-05', 6760.62, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 206). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', 'e0b1bfdd-0db6-4690-9bd0-31afa546afb0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', 'e0b1bfdd-0db6-4690-9bd0-31afa546afb0', DATE '2026-10-05', 6760.62, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 207 | apLIS lote 6674
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('64b139bb-624c-4a33-b7cf-0d7ec74ff12e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), '6674', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '260831027341', '6674', 42.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1078'), DATE '2026-08-31', DATE '2026-10-05', 42.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 207). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59', '64b139bb-624c-4a33-b7cf-0d7ec74ff12e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59', '64b139bb-624c-4a33-b7cf-0d7ec74ff12e', DATE '2026-10-05', 42.35, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 208 | apLIS lote 6533
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('05f690a4-a28b-4303-ae1b-1715fabb7740', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6533', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '497596', '6533', 29818.07, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('43f976ec-b694-47ce-9ad4-b7a1d8f2d10b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-14', DATE '2026-09-13', 29818.07, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 208). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('43f976ec-b694-47ce-9ad4-b7a1d8f2d10b', '05f690a4-a28b-4303-ae1b-1715fabb7740');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('43f976ec-b694-47ce-9ad4-b7a1d8f2d10b', '05f690a4-a28b-4303-ae1b-1715fabb7740', DATE '2026-09-13', 29818.07, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 209 | apLIS lote 6546
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b70aa63d-fe42-4ee9-bdbc-107411dd7e4b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6546', DATE '2026-08-14', DATE '2026-08-14', 'Faturado', '497606', '6546', 146.62, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4a4b71a5-a59d-4206-b005-69521e7c1712', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-14', DATE '2026-09-13', 146.62, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 209). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4a4b71a5-a59d-4206-b005-69521e7c1712', 'b70aa63d-fe42-4ee9-bdbc-107411dd7e4b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4a4b71a5-a59d-4206-b005-69521e7c1712', 'b70aa63d-fe42-4ee9-bdbc-107411dd7e4b', DATE '2026-09-13', 146.62, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 210 | apLIS lote 6535
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4b7ccddc-c517-4820-8961-8633b17b8633', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6535', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '497996', '6535', 6927.03, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9a020f27-e843-489b-809b-904e5ade8119', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-17', DATE '2026-09-16', 6927.03, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 210). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9a020f27-e843-489b-809b-904e5ade8119', '4b7ccddc-c517-4820-8961-8633b17b8633');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9a020f27-e843-489b-809b-904e5ade8119', '4b7ccddc-c517-4820-8961-8633b17b8633', DATE '2026-09-16', 6927.03, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 211 | apLIS lote 6534
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('36413656-f910-4dd9-ae75-cc9f445869bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6534', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '498037', '6534', 10845.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8f6e0af2-6d4d-4717-bd6b-28220287e9e3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-17', DATE '2026-09-16', 10845.04, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 211). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8f6e0af2-6d4d-4717-bd6b-28220287e9e3', '36413656-f910-4dd9-ae75-cc9f445869bd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8f6e0af2-6d4d-4717-bd6b-28220287e9e3', '36413656-f910-4dd9-ae75-cc9f445869bd', DATE '2026-09-16', 10845.04, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 212 | apLIS lote 6553
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2f299282-56f6-40d8-966f-0b53dce133d8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6553', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '498078', '6553', 5539.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1b4795c3-49ec-4001-b12e-8f193a478d6e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-17', DATE '2026-09-16', 5539.02, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 212). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1b4795c3-49ec-4001-b12e-8f193a478d6e', '2f299282-56f6-40d8-966f-0b53dce133d8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1b4795c3-49ec-4001-b12e-8f193a478d6e', '2f299282-56f6-40d8-966f-0b53dce133d8', DATE '2026-09-16', 5539.02, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 213 | apLIS lote 6554
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4368b4c0-2b4a-4a87-af93-226801bf3949', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6554', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '498102', '6554', 1155.11, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1516ed3b-83dd-43a1-b71c-0e755fa0b736', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-17', DATE '2026-09-16', 1155.11, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 213). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1516ed3b-83dd-43a1-b71c-0e755fa0b736', '4368b4c0-2b4a-4a87-af93-226801bf3949');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1516ed3b-83dd-43a1-b71c-0e755fa0b736', '4368b4c0-2b4a-4a87-af93-226801bf3949', DATE '2026-09-16', 1155.11, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 214 | apLIS lote 6556
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a7d25cb1-699a-4743-aea2-71f3100bb694', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), '6556', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '498170', '6556', 677.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('45e9bef4-aa9b-4f2c-a695-c28509cc8554', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1231'), DATE '2026-08-17', DATE '2026-09-16', 677.69, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 214). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('45e9bef4-aa9b-4f2c-a695-c28509cc8554', 'a7d25cb1-699a-4743-aea2-71f3100bb694');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('45e9bef4-aa9b-4f2c-a695-c28509cc8554', 'a7d25cb1-699a-4743-aea2-71f3100bb694', DATE '2026-09-16', 677.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 215 | apLIS lote 4954
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('89c2eb58-a7af-449d-a9ff-3d51779f232b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '4954', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '7138518', '4954', 1274.35, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eafbbfa1-f703-41c0-8805-c65c9f6d4c6b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-08-20', DATE '2026-09-15', 1274.35, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 215). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eafbbfa1-f703-41c0-8805-c65c9f6d4c6b', '89c2eb58-a7af-449d-a9ff-3d51779f232b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('eafbbfa1-f703-41c0-8805-c65c9f6d4c6b', '89c2eb58-a7af-449d-a9ff-3d51779f232b', DATE '2026-09-15', 1274.35, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 216 | apLIS lote 6601
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8c945fe-d306-444f-92f1-84bb7164f23b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6601', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '7138528', '6601', 508.41, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('03a0c4af-2fac-43e1-8382-23d8c1c37dab', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-08-20', DATE '2026-09-15', 508.41, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 216). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('03a0c4af-2fac-43e1-8382-23d8c1c37dab', 'a8c945fe-d306-444f-92f1-84bb7164f23b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('03a0c4af-2fac-43e1-8382-23d8c1c37dab', 'a8c945fe-d306-444f-92f1-84bb7164f23b', DATE '2026-09-15', 508.41, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 217 | apLIS lote 6597
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e42e0ed8-9ee7-42bf-9e25-a6f68a971d2a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6597', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '7138533', '6597', 239.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5455d46b-2aff-4537-8270-f2206de9af39', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-08-20', DATE '2026-09-15', 239.76, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 217). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5455d46b-2aff-4537-8270-f2206de9af39', 'e42e0ed8-9ee7-42bf-9e25-a6f68a971d2a');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5455d46b-2aff-4537-8270-f2206de9af39', 'e42e0ed8-9ee7-42bf-9e25-a6f68a971d2a', DATE '2026-09-15', 239.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 218 | apLIS lote 6592
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e18cf2c3-9aac-43ec-b5ba-b657a3851738', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), '6592', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '7138549', '6592', 16540.15, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a76d5c89-f30d-4269-acdb-cb6568c0f22e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1252'), DATE '2026-08-20', DATE '2026-09-15', 16540.15, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 218). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a76d5c89-f30d-4269-acdb-cb6568c0f22e', 'e18cf2c3-9aac-43ec-b5ba-b657a3851738');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a76d5c89-f30d-4269-acdb-cb6568c0f22e', 'e18cf2c3-9aac-43ec-b5ba-b657a3851738', DATE '2026-09-15', 16540.15, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 219 | apLIS lote 6507
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ecc036be-ebbb-4615-8ae4-b8b38f575f3e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6507', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '232221', '6507', 1044.42, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('31a189d3-bf47-4bbb-b4fb-b98c5168049c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-08-11', DATE '2026-09-23', 1044.42, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 219). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('31a189d3-bf47-4bbb-b4fb-b98c5168049c', 'ecc036be-ebbb-4615-8ae4-b8b38f575f3e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('31a189d3-bf47-4bbb-b4fb-b98c5168049c', 'ecc036be-ebbb-4615-8ae4-b8b38f575f3e', DATE '2026-09-23', 1044.42, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 220 | apLIS lote 6465
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7b2ec4eb-62b0-42d6-917f-5f1f6a5ed727', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6465', DATE '2026-08-11', DATE '2026-08-11', 'Faturado', '232222', '6465', 5869.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8853b22a-ddbd-4bc4-bd96-7df614f1047e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-08-11', DATE '2026-09-23', 5869.9, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 220). Responsável: Renata, Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8853b22a-ddbd-4bc4-bd96-7df614f1047e', '7b2ec4eb-62b0-42d6-917f-5f1f6a5ed727');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8853b22a-ddbd-4bc4-bd96-7df614f1047e', '7b2ec4eb-62b0-42d6-917f-5f1f6a5ed727', DATE '2026-09-23', 5869.9, 'previsto', 'Renata, Rivia', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 221 | apLIS lote 6605
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c69bcf08-e9cc-4b8c-9154-7c36fc2927c4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6605', DATE '2026-08-20', DATE '2026-08-20', 'Faturado', '232840', '6605', 3149.63, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ad905ab3-2e43-472e-b956-f92f76b255b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-08-20', DATE '2026-10-02', 3149.63, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 221). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ad905ab3-2e43-472e-b956-f92f76b255b6', 'c69bcf08-e9cc-4b8c-9154-7c36fc2927c4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ad905ab3-2e43-472e-b956-f92f76b255b6', 'c69bcf08-e9cc-4b8c-9154-7c36fc2927c4', DATE '2026-10-02', 3149.63, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 222 | apLIS lote 6442
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e4540467-4da0-417d-892a-19e276266830', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '6442', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '11', '6442', 3441.08, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('298a95de-3ba6-4c57-bce4-076023c91937', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), DATE '2026-08-03', DATE '2026-09-02', 3441.08, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 222). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('298a95de-3ba6-4c57-bce4-076023c91937', 'e4540467-4da0-417d-892a-19e276266830');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('298a95de-3ba6-4c57-bce4-076023c91937', 'e4540467-4da0-417d-892a-19e276266830', DATE '2026-09-02', 3441.08, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 223 | apLIS lote 6441
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c627fa9d-1a1e-432a-a789-c4dd286510cd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6441', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '63722', '6441', 898.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e0cec1e-f84f-43ec-9de6-7454c50c25f9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-03', DATE '2026-09-02', 898.69, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 223). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e0cec1e-f84f-43ec-9de6-7454c50c25f9', 'c627fa9d-1a1e-432a-a789-c4dd286510cd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9e0cec1e-f84f-43ec-9de6-7454c50c25f9', 'c627fa9d-1a1e-432a-a789-c4dd286510cd', DATE '2026-09-02', 898.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 224 | apLIS lote 6434
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('f400d331-648b-4055-932b-9ece3058ab33', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6434', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '63706', '6434', 1282.53, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b2c17d6-2b31-4bfd-97bf-fe73dd8c62ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-03', DATE '2026-09-02', 1282.53, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 224). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b2c17d6-2b31-4bfd-97bf-fe73dd8c62ad', 'f400d331-648b-4055-932b-9ece3058ab33');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9b2c17d6-2b31-4bfd-97bf-fe73dd8c62ad', 'f400d331-648b-4055-932b-9ece3058ab33', DATE '2026-09-02', 1282.53, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 225 | apLIS lote 6432
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dbbb3e90-c134-4a82-9f89-7c75ffec706e', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6432', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '63704', '6432', 159.84, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3b307ed5-8198-421f-8abb-13045877c5aa', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-03', DATE '2026-09-02', 159.84, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 225). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3b307ed5-8198-421f-8abb-13045877c5aa', 'dbbb3e90-c134-4a82-9f89-7c75ffec706e');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3b307ed5-8198-421f-8abb-13045877c5aa', 'dbbb3e90-c134-4a82-9f89-7c75ffec706e', DATE '2026-09-02', 159.84, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 226 | apLIS lote 6431
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b23e2b76-529b-49da-a4ae-178609bf7bc4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6431', DATE '2026-08-03', DATE '2026-08-03', 'Faturado', '63702', '6431', 3974.05, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5a3d8788-481c-47dc-aee8-1bc398408536', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-03', DATE '2026-09-02', 3974.05, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 226). Responsável: Renata. Status original na planilha: Vencido.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5a3d8788-481c-47dc-aee8-1bc398408536', 'b23e2b76-529b-49da-a4ae-178609bf7bc4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5a3d8788-481c-47dc-aee8-1bc398408536', 'b23e2b76-529b-49da-a4ae-178609bf7bc4', DATE '2026-09-02', 3974.05, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 227 | apLIS lote 6436
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('25a102fa-a631-46e9-b81c-a7531f14453d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '6436', DATE '2026-08-17', DATE '2026-08-17', 'Faturado', '64113', '6436', 898.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('655a74dc-3a8b-4c21-bff0-4a685d50e04c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-17', DATE '2026-09-02', 898.69, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 227). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('655a74dc-3a8b-4c21-bff0-4a685d50e04c', '25a102fa-a631-46e9-b81c-a7531f14453d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('655a74dc-3a8b-4c21-bff0-4a685d50e04c', '25a102fa-a631-46e9-b81c-a7531f14453d', DATE '2026-09-02', 898.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 228 | apLIS lote 5370
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a98041f3-1a40-4304-8094-46d07f92f4bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5370', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '60939', '5370', 1438.89, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d322f81e-6ac6-4032-9245-856a1df930d3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-31', DATE '2026-09-02', 1438.89, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 228). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d322f81e-6ac6-4032-9245-856a1df930d3', 'a98041f3-1a40-4304-8094-46d07f92f4bd');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d322f81e-6ac6-4032-9245-856a1df930d3', 'a98041f3-1a40-4304-8094-46d07f92f4bd', DATE '2026-09-02', 1438.89, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 229 | apLIS lote 5371
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0684adeb-5b3c-4741-b5c1-a63941ffa1b3', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), '5371', DATE '2026-08-31', DATE '2026-08-31', 'Faturado', '60942', '5371', 3159.83, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('799bb0fe-1348-47b0-b48d-dc9f4df7dac5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1228'), DATE '2026-08-31', DATE '2026-09-02', 3159.83, '2026-08', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba AGOSTO, linha 229). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('799bb0fe-1348-47b0-b48d-dc9f4df7dac5', '0684adeb-5b3c-4741-b5c1-a63941ffa1b3');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('799bb0fe-1348-47b0-b48d-dc9f4df7dac5', '0684adeb-5b3c-4741-b5c1-a63941ffa1b3', DATE '2026-09-02', 3159.83, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- AGOSTO linha 230 | apLIS lote 6577
-- EXCLUÍDA: já existe título real cadastrado no sistema para este lote
-- (aplis_id=6577 já presente em `lotes` em produção — confirmado por
-- pré-checagem via SELECT, não por tentativa de push). Ver relatório de
-- importação em .scratch/faturamento-backfill-q3-2026/relatorio-importacao.md.

-- SETEMBRO linha 26 | apLIS lote 6756
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1179912f-00e8-46d4-b7c3-2d648df15fc5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6756', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6756', 422.17, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('656abfad-8cd9-4a22-8ba9-03cf303a11d7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 422.17, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 26). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('656abfad-8cd9-4a22-8ba9-03cf303a11d7', '1179912f-00e8-46d4-b7c3-2d648df15fc5');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('656abfad-8cd9-4a22-8ba9-03cf303a11d7', '1179912f-00e8-46d4-b7c3-2d648df15fc5', DATE '2026-11-09', 422.17, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 27 | apLIS lote 6767
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4890f359-eaea-4cb8-be74-67fb3faa2f92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6767', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6767', 1463.2, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('c133e846-35b1-4635-b5c3-c7e52e3145a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 1463.2, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 27). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('c133e846-35b1-4635-b5c3-c7e52e3145a1', '4890f359-eaea-4cb8-be74-67fb3faa2f92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('c133e846-35b1-4635-b5c3-c7e52e3145a1', '4890f359-eaea-4cb8-be74-67fb3faa2f92', DATE '2026-11-09', 1463.2, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 28 | apLIS lote 6758
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('748de301-02bb-4d9f-b35a-821074bcedd8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6758', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6758', 272.55, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d568b724-7817-4676-ade1-285e23545866', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 272.55, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 28). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d568b724-7817-4676-ade1-285e23545866', '748de301-02bb-4d9f-b35a-821074bcedd8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d568b724-7817-4676-ade1-285e23545866', '748de301-02bb-4d9f-b35a-821074bcedd8', DATE '2026-11-09', 272.55, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 29 | apLIS lote 5179
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ec53adde-4153-421c-8dea-c66f38ad29a7', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '5179', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '8092026', '5179', 3445.68, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a28840ea-9ae8-4e73-aaef-863f54a3504a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-08', DATE '2026-11-07', 3445.68, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 29). Responsável: Raquel. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a28840ea-9ae8-4e73-aaef-863f54a3504a', 'ec53adde-4153-421c-8dea-c66f38ad29a7');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a28840ea-9ae8-4e73-aaef-863f54a3504a', 'ec53adde-4153-421c-8dea-c66f38ad29a7', DATE '2026-11-07', 3445.68, 'previsto', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 30 | apLIS lote 6745
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5d9a88ac-a551-4f23-b43c-5e2d91ba5588', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6745', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6745', 4558.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('51af229a-66aa-4b50-be7f-6492e3cb9741', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 4558.85, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 30). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('51af229a-66aa-4b50-be7f-6492e3cb9741', '5d9a88ac-a551-4f23-b43c-5e2d91ba5588');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('51af229a-66aa-4b50-be7f-6492e3cb9741', '5d9a88ac-a551-4f23-b43c-5e2d91ba5588', DATE '2026-11-09', 4558.85, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 32 | apLIS lote 6738
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('660de29f-bbea-41e7-8458-fe059bda03af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6738', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '9092026', '6738', 5156.16, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('721e79da-d37e-4317-9185-e8bb08feb3cb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-09', DATE '2026-11-08', 5156.16, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 32). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('721e79da-d37e-4317-9185-e8bb08feb3cb', '660de29f-bbea-41e7-8458-fe059bda03af');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('721e79da-d37e-4317-9185-e8bb08feb3cb', '660de29f-bbea-41e7-8458-fe059bda03af', DATE '2026-11-08', 5156.16, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 33 | apLIS lote 6754
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd7498b9-6b1f-42bc-b1c2-0bc1836919c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6754', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6754', 978.76, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bed02b06-52e7-40cf-818b-b6277ba9062a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 978.76, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 33). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bed02b06-52e7-40cf-818b-b6277ba9062a', 'dd7498b9-6b1f-42bc-b1c2-0bc1836919c0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('bed02b06-52e7-40cf-818b-b6277ba9062a', 'dd7498b9-6b1f-42bc-b1c2-0bc1836919c0', DATE '2026-11-09', 978.76, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 34 | apLIS lote 6752
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('54ff0c02-0ece-4184-b7db-0b51ea9bcc06', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6752', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6752', 2260.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0ae44209-8e6b-4cad-8452-fb7249301958', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 2260.92, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 34). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0ae44209-8e6b-4cad-8452-fb7249301958', '54ff0c02-0ece-4184-b7db-0b51ea9bcc06');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0ae44209-8e6b-4cad-8452-fb7249301958', '54ff0c02-0ece-4184-b7db-0b51ea9bcc06', DATE '2026-11-09', 2260.92, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 36 | apLIS lote 6753
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('92b9c665-f3bc-4c04-b010-ad5ebcfbdd4c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6753', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6753', 2713.3, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1272ce89-a527-4349-bd64-5aabec06cd2f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 2713.3, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 36). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1272ce89-a527-4349-bd64-5aabec06cd2f', '92b9c665-f3bc-4c04-b010-ad5ebcfbdd4c');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1272ce89-a527-4349-bd64-5aabec06cd2f', '92b9c665-f3bc-4c04-b010-ad5ebcfbdd4c', DATE '2026-11-09', 2713.3, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 38 | apLIS lote 6755
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('878a8a80-6a23-41a1-876c-745515e20917', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6755', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6755', 927.53, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ea1a235d-a27d-4ae1-be90-98ec29ce602d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 927.53, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 38). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ea1a235d-a27d-4ae1-be90-98ec29ce602d', '878a8a80-6a23-41a1-876c-745515e20917');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ea1a235d-a27d-4ae1-be90-98ec29ce602d', '878a8a80-6a23-41a1-876c-745515e20917', DATE '2026-11-09', 927.53, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 40 | apLIS lote 6742
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('8253025f-2d82-4ce2-99bd-80b780cabf8b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6742', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '9092026', '6742', 3611.81, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('278a42e9-fda6-47d3-a214-8913d3ad41de', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-09', DATE '2026-11-08', 3611.81, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 40). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('278a42e9-fda6-47d3-a214-8913d3ad41de', '8253025f-2d82-4ce2-99bd-80b780cabf8b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('278a42e9-fda6-47d3-a214-8913d3ad41de', '8253025f-2d82-4ce2-99bd-80b780cabf8b', DATE '2026-11-08', 3611.81, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 41 | apLIS lote 6760
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('a8622037-5ad8-4c0d-b46d-261a30d03eec', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6760', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6760', 1111.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('55747694-7b14-41fb-9271-c8c11fa9eb5d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 1111.02, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 41). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('55747694-7b14-41fb-9271-c8c11fa9eb5d', 'a8622037-5ad8-4c0d-b46d-261a30d03eec');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('55747694-7b14-41fb-9271-c8c11fa9eb5d', 'a8622037-5ad8-4c0d-b46d-261a30d03eec', DATE '2026-11-09', 1111.02, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 43 | apLIS lote 6759
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ad86a9b7-0e9e-445b-9358-a4b89ca5a748', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6759', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6759', 1414.02, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a3d0adfb-07ce-408a-a6ab-03393f805ba9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 1414.02, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 43). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a3d0adfb-07ce-408a-a6ab-03393f805ba9', 'ad86a9b7-0e9e-445b-9358-a4b89ca5a748');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a3d0adfb-07ce-408a-a6ab-03393f805ba9', 'ad86a9b7-0e9e-445b-9358-a4b89ca5a748', DATE '2026-11-09', 1414.02, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 45 | apLIS lote 6763
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('172c25a3-0322-4f3d-9a4a-4e6c2fc02663', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6763', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733734', '6763', 5175.84, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('2bcc82db-2475-442b-8e03-fc4fc4854e89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 5175.84, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 45). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('2bcc82db-2475-442b-8e03-fc4fc4854e89', '172c25a3-0322-4f3d-9a4a-4e6c2fc02663');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('2bcc82db-2475-442b-8e03-fc4fc4854e89', '172c25a3-0322-4f3d-9a4a-4e6c2fc02663', DATE '2026-11-09', 5175.84, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 46 | apLIS lote 6764
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0e56fe4f-8b0d-4973-a57e-e3170d00a246', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6764', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733787', '6764', 62.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9b276c7c-23a5-4104-bfae-5249f2faf41a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 62.28, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 46). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9b276c7c-23a5-4104-bfae-5249f2faf41a', '0e56fe4f-8b0d-4973-a57e-e3170d00a246');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9b276c7c-23a5-4104-bfae-5249f2faf41a', '0e56fe4f-8b0d-4973-a57e-e3170d00a246', DATE '2026-11-09', 62.28, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 47 | apLIS lote 6761
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c2bc6a8-17db-413d-94bd-275db6b6a5f6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6761', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733679', '6761', 56.36, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a289a978-bfce-4c41-9fd2-901264c0ab0d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 56.36, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 47). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a289a978-bfce-4c41-9fd2-901264c0ab0d', '3c2bc6a8-17db-413d-94bd-275db6b6a5f6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a289a978-bfce-4c41-9fd2-901264c0ab0d', '3c2bc6a8-17db-413d-94bd-275db6b6a5f6', DATE '2026-11-09', 56.36, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 48 | apLIS lote 6766
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c144bb3a-b2d2-4f63-ac06-b3b94138a2e2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6766', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733851', '6766', 635.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('210c9c90-9732-4b93-8470-e145e021b392', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 635.0, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 48). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('210c9c90-9732-4b93-8470-e145e021b392', 'c144bb3a-b2d2-4f63-ac06-b3b94138a2e2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('210c9c90-9732-4b93-8470-e145e021b392', 'c144bb3a-b2d2-4f63-ac06-b3b94138a2e2', DATE '2026-11-09', 635.0, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 49 | apLIS lote 6765
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('35eee317-461a-456a-b7a8-4d2a71945ebb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6765', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733845', '6765', 635.0, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a26b4795-7fef-4b90-bdfb-a0e1f34199b6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 635.0, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 49). Responsável: Renata.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a26b4795-7fef-4b90-bdfb-a0e1f34199b6', '35eee317-461a-456a-b7a8-4d2a71945ebb');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a26b4795-7fef-4b90-bdfb-a0e1f34199b6', '35eee317-461a-456a-b7a8-4d2a71945ebb', DATE '2026-11-09', 635.0, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 50 | apLIS lote 6762
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('17906e5b-7fb7-49f7-a647-12337e7fd6be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6762', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '44733695', '6762', 1028.75, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('cb686fd7-b5a1-4911-ac07-a5c2fa93e7bd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 1028.75, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 50). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('cb686fd7-b5a1-4911-ac07-a5c2fa93e7bd', '17906e5b-7fb7-49f7-a647-12337e7fd6be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('cb686fd7-b5a1-4911-ac07-a5c2fa93e7bd', '17906e5b-7fb7-49f7-a647-12337e7fd6be', DATE '2026-11-09', 1028.75, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 52 | apLIS lote 6735
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5526c914-529f-4c97-b666-12a35ea440c1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6735', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '9092026', '6735', 6108.92, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('410848c3-9e14-4402-bb00-17ca588952fb', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-09', DATE '2026-11-08', 6108.92, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 52). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('410848c3-9e14-4402-bb00-17ca588952fb', '5526c914-529f-4c97-b666-12a35ea440c1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('410848c3-9e14-4402-bb00-17ca588952fb', '5526c914-529f-4c97-b666-12a35ea440c1', DATE '2026-11-08', 6108.92, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 57 | apLIS lote 6757
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1d667f6a-4f53-4fe5-bd55-8601be713fda', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), '6757', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '10092026', '6757', 806.64, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('472dc855-2b1f-4767-a998-ecb93e248ad6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1025'), DATE '2026-09-10', DATE '2026-11-09', 806.64, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 57). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('472dc855-2b1f-4767-a998-ecb93e248ad6', '1d667f6a-4f53-4fe5-bd55-8601be713fda');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('472dc855-2b1f-4767-a998-ecb93e248ad6', '1d667f6a-4f53-4fe5-bd55-8601be713fda', DATE '2026-11-09', 806.64, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 60 | apLIS lote 6691
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3be8ea9b-a255-4c7b-8b75-8a84268a64be', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6691', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '5900588428', '6691', 15880.04, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('ffa68d77-c718-46f7-af37-c99276b8dc49', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-09-02', DATE '2026-10-02', 15880.04, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 60). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('ffa68d77-c718-46f7-af37-c99276b8dc49', '3be8ea9b-a255-4c7b-8b75-8a84268a64be');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('ffa68d77-c718-46f7-af37-c99276b8dc49', '3be8ea9b-a255-4c7b-8b75-8a84268a64be', DATE '2026-10-02', 15880.04, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 61 | apLIS lote 6698
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('aefd7013-0dff-4dca-bf58-e46957301b8d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6698', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '5900952553', '6698', 2778.65, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a541c39d-ef32-4ec7-b8d9-abd7a347a2c0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-09-02', DATE '2026-10-02', 2778.65, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 61). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a541c39d-ef32-4ec7-b8d9-abd7a347a2c0', 'aefd7013-0dff-4dca-bf58-e46957301b8d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a541c39d-ef32-4ec7-b8d9-abd7a347a2c0', 'aefd7013-0dff-4dca-bf58-e46957301b8d', DATE '2026-10-02', 2778.65, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 62 | apLIS lote 6718
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6a63454f-a0fa-4dde-924c-d31af522a1a4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), '6718', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '5908381541', '6718', 2373.7, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9511cc6b-f337-4565-a5e7-862d8b3fcb62', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1007'), DATE '2026-09-04', DATE '2026-10-04', 2373.7, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 62). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9511cc6b-f337-4565-a5e7-862d8b3fcb62', '6a63454f-a0fa-4dde-924c-d31af522a1a4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9511cc6b-f337-4565-a5e7-862d8b3fcb62', '6a63454f-a0fa-4dde-924c-d31af522a1a4', DATE '2026-10-04', 2373.7, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 65 | apLIS lote 6656
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ce9030b6-b41d-4e89-9265-a10224f558e9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6656', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '1567249', '6656', 16210.86, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('63cb9f76-e8dc-430d-8072-d3d442dbee5c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-01', DATE '2026-10-20', 16210.86, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 65). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('63cb9f76-e8dc-430d-8072-d3d442dbee5c', 'ce9030b6-b41d-4e89-9265-a10224f558e9');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('63cb9f76-e8dc-430d-8072-d3d442dbee5c', 'ce9030b6-b41d-4e89-9265-a10224f558e9', DATE '2026-10-20', 16210.86, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 66 | apLIS lote 6692
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('80fdcb04-7df7-426e-8208-cfe99a9e8657', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6692', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '1567534', '6692', 454.99, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('17164cfd-43f4-40bd-9653-62834ce28d66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-01', DATE '2026-10-20', 454.99, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 66). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('17164cfd-43f4-40bd-9653-62834ce28d66', '80fdcb04-7df7-426e-8208-cfe99a9e8657');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('17164cfd-43f4-40bd-9653-62834ce28d66', '80fdcb04-7df7-426e-8208-cfe99a9e8657', DATE '2026-10-20', 454.99, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 67 | apLIS lote 6700
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6c9e1fad-d796-42b4-91fb-90d7f754aad0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6700', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '1586808', '6700', 198.87, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('bf9e5596-89e4-4ea9-b47c-7dc40ccae309', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-02', DATE '2026-10-20', 198.87, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 67). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('bf9e5596-89e4-4ea9-b47c-7dc40ccae309', '6c9e1fad-d796-42b4-91fb-90d7f754aad0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('bf9e5596-89e4-4ea9-b47c-7dc40ccae309', '6c9e1fad-d796-42b4-91fb-90d7f754aad0', DATE '2026-10-20', 198.87, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 68 | apLIS lote 6658
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('46c286b7-96e2-4658-8360-bcc61d94948d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6658', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '1587389', '6658', 15024.51, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e17414ee-e40f-4619-be89-59fb467b655a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-02', DATE '2026-10-20', 15024.51, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 68). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e17414ee-e40f-4619-be89-59fb467b655a', '46c286b7-96e2-4658-8360-bcc61d94948d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e17414ee-e40f-4619-be89-59fb467b655a', '46c286b7-96e2-4658-8360-bcc61d94948d', DATE '2026-10-20', 15024.51, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 69 | apLIS lote 6659
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('344d470c-e1f4-407a-91b5-71e1af112465', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6659', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '1586552', '6659', 1851.53, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6574d8ed-a7da-494f-af06-76b1ad64e788', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-10-20', 1851.53, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 69). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6574d8ed-a7da-494f-af06-76b1ad64e788', '344d470c-e1f4-407a-91b5-71e1af112465');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6574d8ed-a7da-494f-af06-76b1ad64e788', '344d470c-e1f4-407a-91b5-71e1af112465', DATE '2026-10-20', 1851.53, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 70 | apLIS lote 6660
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ebaaa7d2-a4ce-4d85-85ca-78614956df5f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6660', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '1585700', '6660', 6265.85, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('1db4d0a7-4c6a-4bcc-9f64-654dea3b044c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-10-20', 6265.85, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 70). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('1db4d0a7-4c6a-4bcc-9f64-654dea3b044c', 'ebaaa7d2-a4ce-4d85-85ca-78614956df5f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('1db4d0a7-4c6a-4bcc-9f64-654dea3b044c', 'ebaaa7d2-a4ce-4d85-85ca-78614956df5f', DATE '2026-10-20', 6265.85, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 71 | apLIS lote 6668
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e27772b0-24ed-4458-8a7d-7cc4efa5cbac', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6668', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '1585926', '6668', 2897.29, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('34bc22bc-d5ea-4cd8-8991-647b12c6a038', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-10-20', 2897.29, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 71). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('34bc22bc-d5ea-4cd8-8991-647b12c6a038', 'e27772b0-24ed-4458-8a7d-7cc4efa5cbac');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('34bc22bc-d5ea-4cd8-8991-647b12c6a038', 'e27772b0-24ed-4458-8a7d-7cc4efa5cbac', DATE '2026-10-20', 2897.29, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 73 | apLIS lote 6702
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e2a91272-293e-4c5d-938a-94285c8e3b05', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6702', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '1590700', '6702', 10600.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7125d218-b637-4543-8557-798cd3905577', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-09-03', 10600.28, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 73). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7125d218-b637-4543-8557-798cd3905577', 'e2a91272-293e-4c5d-938a-94285c8e3b05');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7125d218-b637-4543-8557-798cd3905577', 'e2a91272-293e-4c5d-938a-94285c8e3b05', DATE '2026-09-03', 10600.28, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 74 | apLIS lote 6704
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('ba602b3c-b7ae-45a7-aa8c-0a6fe4b57645', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6704', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '1590214', '6704', 20600.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d29826c3-df3a-4205-9c39-a17242870516', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-03', DATE '2026-09-03', 20600.78, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 74). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d29826c3-df3a-4205-9c39-a17242870516', 'ba602b3c-b7ae-45a7-aa8c-0a6fe4b57645');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d29826c3-df3a-4205-9c39-a17242870516', 'ba602b3c-b7ae-45a7-aa8c-0a6fe4b57645', DATE '2026-09-03', 20600.78, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 75 | apLIS lote 6723
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('739b73fa-3c7b-4727-b8a2-5eff61bce155', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), '6723', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '1593434', '6723', 1212.13, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('19353e5b-c4d3-4914-b838-12556e93e9a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1008'), DATE '2026-09-04', DATE '2026-09-04', 1212.13, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 75). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('19353e5b-c4d3-4914-b838-12556e93e9a1', '739b73fa-3c7b-4727-b8a2-5eff61bce155');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('19353e5b-c4d3-4914-b838-12556e93e9a1', '739b73fa-3c7b-4727-b8a2-5eff61bce155', DATE '2026-09-04', 1212.13, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 87 | apLIS lote 6673
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('49d1c32c-ec92-44ec-aaae-d4a4a8255e8d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6673', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '289791', '6673', 12194.78, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9c3cbb26-06d7-41f2-b20c-80fe2fb0522c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-09-01', DATE '2026-10-31', 12194.78, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 87). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9c3cbb26-06d7-41f2-b20c-80fe2fb0522c', '49d1c32c-ec92-44ec-aaae-d4a4a8255e8d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9c3cbb26-06d7-41f2-b20c-80fe2fb0522c', '49d1c32c-ec92-44ec-aaae-d4a4a8255e8d', DATE '2026-10-31', 12194.78, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 88 | apLIS lote 6693
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5f7085fc-9a54-464d-9c24-a2bb0e7a327d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), '6693', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '290851', '6693', 1687.39, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d2b165e8-646e-4116-9d27-2da6d35b6e58', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1268'), DATE '2026-09-02', DATE '2026-11-01', 1687.39, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 88). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d2b165e8-646e-4116-9d27-2da6d35b6e58', '5f7085fc-9a54-464d-9c24-a2bb0e7a327d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d2b165e8-646e-4116-9d27-2da6d35b6e58', '5f7085fc-9a54-464d-9c24-a2bb0e7a327d', DATE '2026-11-01', 1687.39, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 89 | apLIS lote 4947
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7e0a1ef2-9ddf-4e5f-82bd-0e9d9c990eb1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '4947', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '230986945', '4947', 26053.97, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('eaaa8231-cda2-4740-a432-524e7c4188f5', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-04', DATE '2026-10-04', 26053.97, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 89). Responsável: Raquel. Status original na planilha: No prazo. Refaturamento: sim (valor: R$ 455.74).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('eaaa8231-cda2-4740-a432-524e7c4188f5', '7e0a1ef2-9ddf-4e5f-82bd-0e9d9c990eb1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('eaaa8231-cda2-4740-a432-524e7c4188f5', '7e0a1ef2-9ddf-4e5f-82bd-0e9d9c990eb1', DATE '2026-10-04', 26053.97, 'previsto', 'Raquel', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 90 | apLIS lote 6728
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('793055e9-7624-4e0c-9035-16c9167bd718', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6728', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231027791', '6728', 12821.31, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('6be69c65-8a74-4172-851a-36ca4fa8466d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 12821.31, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 90). Responsável: Renata. Status original na planilha: No prazo. Refaturamento: sim (valor: R$ 227.87).');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('6be69c65-8a74-4172-851a-36ca4fa8466d', '793055e9-7624-4e0c-9035-16c9167bd718');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('6be69c65-8a74-4172-851a-36ca4fa8466d', '793055e9-7624-4e0c-9035-16c9167bd718', DATE '2026-10-08', 12821.31, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 91 | apLIS lote 6724
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('dd27d518-4848-4a48-8832-fdc7e4477b44', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6724', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231033290', '6724', 12683.9, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('afd8c8d0-9806-4714-b46f-174713dfde8c', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 12683.9, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 91). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('afd8c8d0-9806-4714-b46f-174713dfde8c', 'dd27d518-4848-4a48-8832-fdc7e4477b44');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('afd8c8d0-9806-4714-b46f-174713dfde8c', 'dd27d518-4848-4a48-8832-fdc7e4477b44', DATE '2026-10-08', 12683.9, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 92 | apLIS lote 6725
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('45693eb9-deb9-459b-822a-3e70b63c1de8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6725', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231053698', '6725', 18549.5, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e5f5c0a0-1938-4cfd-964a-2a1a2d859122', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 18549.5, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 92). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e5f5c0a0-1938-4cfd-964a-2a1a2d859122', '45693eb9-deb9-459b-822a-3e70b63c1de8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e5f5c0a0-1938-4cfd-964a-2a1a2d859122', '45693eb9-deb9-459b-822a-3e70b63c1de8', DATE '2026-10-08', 18549.5, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 93 | apLIS lote 6727
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('6e969242-b5d3-4df1-98ed-8c2945e3a0ed', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6727', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231056806', '6727', 21995.88, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e6754760-f067-495e-bc71-60fec5d2af27', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 21995.88, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 93). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e6754760-f067-495e-bc71-60fec5d2af27', '6e969242-b5d3-4df1-98ed-8c2945e3a0ed');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e6754760-f067-495e-bc71-60fec5d2af27', '6e969242-b5d3-4df1-98ed-8c2945e3a0ed', DATE '2026-10-08', 21995.88, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 94 | apLIS lote 6729
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('5a4e90e2-b4fa-4577-9549-1bd0ab40aac0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6729', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231051083', '6729', 73.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('94ed3e0e-36d5-47b9-bc45-96247ad65a3b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 73.44, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 94). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('94ed3e0e-36d5-47b9-bc45-96247ad65a3b', '5a4e90e2-b4fa-4577-9549-1bd0ab40aac0');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('94ed3e0e-36d5-47b9-bc45-96247ad65a3b', '5a4e90e2-b4fa-4577-9549-1bd0ab40aac0', DATE '2026-10-08', 73.44, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 95 | apLIS lote 6726
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('7de47b69-9cce-4667-aa67-2c0c27cd1a92', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6726', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '231058579', '6726', 22913.3, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('e47ece30-a7a7-4f1c-998f-a25960f4e8d2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-08', DATE '2026-10-08', 22913.3, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 95). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('e47ece30-a7a7-4f1c-998f-a25960f4e8d2', '7de47b69-9cce-4667-aa67-2c0c27cd1a92');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('e47ece30-a7a7-4f1c-998f-a25960f4e8d2', '7de47b69-9cce-4667-aa67-2c0c27cd1a92', DATE '2026-10-08', 22913.3, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 96 | apLIS lote 6736
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('d3000cc7-6eb2-49d8-b2a0-a93cf7586bf2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6736', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '231072696', '6736', 704.6, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('7fec01d0-59c1-4b5a-8ce0-1a76339c0dc4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-09', DATE '2026-10-09', 704.6, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 96). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('7fec01d0-59c1-4b5a-8ce0-1a76339c0dc4', 'd3000cc7-6eb2-49d8-b2a0-a93cf7586bf2');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('7fec01d0-59c1-4b5a-8ce0-1a76339c0dc4', 'd3000cc7-6eb2-49d8-b2a0-a93cf7586bf2', DATE '2026-10-09', 704.6, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 97 | apLIS lote 6737
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('e74d3222-f94e-4a47-aa84-8fc79c186f95', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), '6737', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '231078027', '6737', 2104.38, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('df3c06cd-739f-4616-90f0-91194b2d6864', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1009'), DATE '2026-09-09', DATE '2026-09-09', 2104.38, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 97). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('df3c06cd-739f-4616-90f0-91194b2d6864', 'e74d3222-f94e-4a47-aa84-8fc79c186f95');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('df3c06cd-739f-4616-90f0-91194b2d6864', 'e74d3222-f94e-4a47-aa84-8fc79c186f95', DATE '2026-09-09', 2104.38, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 101 | apLIS lote 6722
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('b287bb36-f0ec-448b-80a6-29ef8abb02ad', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), '6722', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '837973', '6722', 7394.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a33f0968-e3fd-47c4-b66d-dc4babb204af', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1283'), DATE '2026-09-04', DATE '2026-11-03', 7394.95, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 101). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a33f0968-e3fd-47c4-b66d-dc4babb204af', 'b287bb36-f0ec-448b-80a6-29ef8abb02ad');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a33f0968-e3fd-47c4-b66d-dc4babb204af', 'b287bb36-f0ec-448b-80a6-29ef8abb02ad', DATE '2026-11-03', 7394.95, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 105 | apLIS lote 6682
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('fccca2a9-0fb0-479a-90a6-07cf1fa6d235', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '6682', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '731994', '6682', 397.62, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('d04913b0-42fb-4f7d-bcb2-ae1c81b616d1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), DATE '2026-09-01', DATE '2026-10-06', 397.62, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 105). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('d04913b0-42fb-4f7d-bcb2-ae1c81b616d1', 'fccca2a9-0fb0-479a-90a6-07cf1fa6d235');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('d04913b0-42fb-4f7d-bcb2-ae1c81b616d1', 'fccca2a9-0fb0-479a-90a6-07cf1fa6d235', DATE '2026-10-06', 397.62, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 106 | apLIS lote 6716
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('010becb6-bae2-4bd4-88fa-121a90598b66', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), '6716', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '735691', '6716', 413.21, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5857e840-10df-48b4-afa6-67e1dc21856b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1049'), DATE '2026-09-04', DATE '2026-10-09', 413.21, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 106). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5857e840-10df-48b4-afa6-67e1dc21856b', '010becb6-bae2-4bd4-88fa-121a90598b66');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5857e840-10df-48b4-afa6-67e1dc21856b', '010becb6-bae2-4bd4-88fa-121a90598b66', DATE '2026-10-09', 413.21, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 107 | apLIS lote 6688
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('3c6e761d-814c-479f-bc86-d494c1345409', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6688', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '146316', '6688', 5931.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0855e4b5-4bb2-4c78-b302-bb04281a587d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-09-01', DATE '2026-09-29', 5931.01, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 107). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0855e4b5-4bb2-4c78-b302-bb04281a587d', '3c6e761d-814c-479f-bc86-d494c1345409');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0855e4b5-4bb2-4c78-b302-bb04281a587d', '3c6e761d-814c-479f-bc86-d494c1345409', DATE '2026-09-29', 5931.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 109 | apLIS lote 6717
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('13c72d90-9a6e-4367-8d54-e64acbc7b099', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), '6717', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '146590', '6717', 1414.31, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('654846cc-8446-497b-9a6a-78c8b7bd7575', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1253'), DATE '2026-09-04', DATE '2026-10-02', 1414.31, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 109). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('654846cc-8446-497b-9a6a-78c8b7bd7575', '13c72d90-9a6e-4367-8d54-e64acbc7b099');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('654846cc-8446-497b-9a6a-78c8b7bd7575', '13c72d90-9a6e-4367-8d54-e64acbc7b099', DATE '2026-10-02', 1414.31, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 112 | apLIS lote 6732
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('09a919eb-3314-423b-a6cf-e3a7e144c755', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), '6732', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '20260908160225', '6732', 1956.65, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('397cc7b9-43b7-497b-995a-035d8a1369b9', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1204'), DATE '2026-09-08', DATE '2026-11-07', 1956.65, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 112). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('397cc7b9-43b7-497b-995a-035d8a1369b9', '09a919eb-3314-423b-a6cf-e3a7e144c755');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('397cc7b9-43b7-497b-995a-035d8a1369b9', '09a919eb-3314-423b-a6cf-e3a7e144c755', DATE '2026-11-07', 1956.65, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 115 | apLIS lote 6712
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a4dc20a-18b2-4b8f-b082-30701f8331f1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6712', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '179827497', '6712', 17989.79, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4fda9463-4817-4ccd-bf81-ccbdd0b2f3a8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-09-04', DATE '2026-12-03', 17989.79, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 115). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4fda9463-4817-4ccd-bf81-ccbdd0b2f3a8', '2a4dc20a-18b2-4b8f-b082-30701f8331f1');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4fda9463-4817-4ccd-bf81-ccbdd0b2f3a8', '2a4dc20a-18b2-4b8f-b082-30701f8331f1', DATE '2026-12-03', 17989.79, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 116 | apLIS lote 6731
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c902dc8a-aced-4ba8-86b5-9df7fe4b97da', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6731', DATE '2026-09-08', DATE '2026-09-08', 'Faturado', '181515506', '6731', 6239.45, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9a5402cb-26da-48cd-a723-13f8bb43c1e4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-09-08', DATE '2026-12-07', 6239.45, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 116). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9a5402cb-26da-48cd-a723-13f8bb43c1e4', 'c902dc8a-aced-4ba8-86b5-9df7fe4b97da');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9a5402cb-26da-48cd-a723-13f8bb43c1e4', 'c902dc8a-aced-4ba8-86b5-9df7fe4b97da', DATE '2026-12-07', 6239.45, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 117 | apLIS lote 6740
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('84a943c8-901c-473f-9821-9f892a1be016', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), '6740', DATE '2026-09-09', DATE '2026-09-09', 'Faturado', '182484402', '6740', 2897.82, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('8f76b24c-2696-4b42-8c56-2e9e92773c07', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1282'), DATE '2026-09-09', DATE '2026-12-08', 2897.82, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 117). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('8f76b24c-2696-4b42-8c56-2e9e92773c07', '84a943c8-901c-473f-9821-9f892a1be016');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('8f76b24c-2696-4b42-8c56-2e9e92773c07', '84a943c8-901c-473f-9821-9f892a1be016', DATE '2026-12-08', 2897.82, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 122 | apLIS lote 6701
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('433c3b77-b137-4ed1-bb4b-af1275c7380f', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6701', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '4407173', '6701', 19531.74, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('5bb969ca-3c95-41d8-b967-096685bacc40', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-09-02', DATE '2026-11-01', 19531.74, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 122). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('5bb969ca-3c95-41d8-b967-096685bacc40', '433c3b77-b137-4ed1-bb4b-af1275c7380f');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('5bb969ca-3c95-41d8-b967-096685bacc40', '433c3b77-b137-4ed1-bb4b-af1275c7380f', DATE '2026-11-01', 19531.74, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 123 | apLIS lote 6719
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('0ad9b14c-50dc-4edf-a60c-e9f289f92924', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), '6719', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '4414181', '6719', 788.95, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('78f2aa23-7113-4514-8a0b-ca975579422a', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1052'), DATE '2026-09-04', DATE '2026-11-03', 788.95, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 123). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('78f2aa23-7113-4514-8a0b-ca975579422a', '0ad9b14c-50dc-4edf-a60c-e9f289f92924');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('78f2aa23-7113-4514-8a0b-ca975579422a', '0ad9b14c-50dc-4edf-a60c-e9f289f92924', DATE '2026-11-03', 788.95, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 124 | apLIS lote 6681
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('610c6d1d-39a6-4454-9ab3-2878d8aecf22', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6681', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '42508', '6681', 10248.44, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a025b4b3-6cd5-437b-a65d-5dbb6b5b6f15', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-09-01', DATE '2026-10-31', 10248.44, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 124). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a025b4b3-6cd5-437b-a65d-5dbb6b5b6f15', '610c6d1d-39a6-4454-9ab3-2878d8aecf22');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a025b4b3-6cd5-437b-a65d-5dbb6b5b6f15', '610c6d1d-39a6-4454-9ab3-2878d8aecf22', DATE '2026-10-31', 10248.44, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 125 | apLIS lote 6685
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4d29d0fc-3101-4eaf-b8a2-6ee327ae587b', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6685', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '42556', '6685', 450.97, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('00c5b0b5-d388-4b34-96ee-b7f3eaa0c5fd', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-09-01', DATE '2026-10-31', 450.97, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 125). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('00c5b0b5-d388-4b34-96ee-b7f3eaa0c5fd', '4d29d0fc-3101-4eaf-b8a2-6ee327ae587b');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('00c5b0b5-d388-4b34-96ee-b7f3eaa0c5fd', '4d29d0fc-3101-4eaf-b8a2-6ee327ae587b', DATE '2026-10-31', 450.97, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 126 | apLIS lote 5135
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('203831de-7aac-47d7-b748-93ba6c8d1c53', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '5135', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '42965', '5135', 2549.14, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('9e312116-f046-4225-9960-552e0fdfb1a1', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-09-02', DATE '2026-10-31', 2549.14, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 126). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('9e312116-f046-4225-9960-552e0fdfb1a1', '203831de-7aac-47d7-b748-93ba6c8d1c53');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('9e312116-f046-4225-9960-552e0fdfb1a1', '203831de-7aac-47d7-b748-93ba6c8d1c53', DATE '2026-10-31', 2549.14, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 127 | apLIS lote 6720
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('4a52a5e4-2daf-4ae3-9b33-7775b817a817', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), '6720', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '43143', '6720', 141.24, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('de86b949-2cdb-4585-b9fd-85126d8feb89', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1281'), DATE '2026-09-04', DATE '2026-09-04', 141.24, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 127). Responsável: Rivia.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('de86b949-2cdb-4585-b9fd-85126d8feb89', '4a52a5e4-2daf-4ae3-9b33-7775b817a817');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('de86b949-2cdb-4585-b9fd-85126d8feb89', '4a52a5e4-2daf-4ae3-9b33-7775b817a817', DATE '2026-09-04', 141.24, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 136 | apLIS lote 6710
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('1ecfbb3a-279c-4ab3-bc2d-90676872edb4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6710', DATE '2026-09-03', DATE '2026-09-03', 'Faturado', '97001', '6710', 27650.48, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('0c968b92-7999-4ada-bd65-c45094d861a4', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-09-03', DATE '2026-10-03', 27650.48, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 136). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('0c968b92-7999-4ada-bd65-c45094d861a4', '1ecfbb3a-279c-4ab3-bc2d-90676872edb4');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('0c968b92-7999-4ada-bd65-c45094d861a4', '1ecfbb3a-279c-4ab3-bc2d-90676872edb4', DATE '2026-10-03', 27650.48, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 137 | apLIS lote 6721
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('2a0a9f76-d5a3-44cb-81c0-2264f1031be6', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6721', DATE '2026-09-04', DATE '2026-09-04', 'Faturado', '98093', '6721', 1708.71, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3db1a75b-f381-4d97-98cb-476426bd4fa2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-09-04', DATE '2026-10-04', 1708.71, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 137). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3db1a75b-f381-4d97-98cb-476426bd4fa2', '2a0a9f76-d5a3-44cb-81c0-2264f1031be6');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3db1a75b-f381-4d97-98cb-476426bd4fa2', '2a0a9f76-d5a3-44cb-81c0-2264f1031be6', DATE '2026-10-04', 1708.71, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 138 | apLIS lote 6476
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('eb96d462-b047-438d-98a2-790eb7d048f8', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), '6476', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '99635', '6476', 1238.28, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('4f9e5a1c-eee2-4812-8c06-9a426e29fdbf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1129'), DATE '2026-09-10', DATE '2026-10-10', 1238.28, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 138). Responsável: Rivia. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('4f9e5a1c-eee2-4812-8c06-9a426e29fdbf', 'eb96d462-b047-438d-98a2-790eb7d048f8');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('4f9e5a1c-eee2-4812-8c06-9a426e29fdbf', 'eb96d462-b047-438d-98a2-790eb7d048f8', DATE '2026-10-10', 1238.28, 'previsto', 'Rivia', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 140 | apLIS lote 5424
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('56fd775f-1b76-40fc-ab66-b59ed1ce7306', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), '5424', DATE '2026-09-10', DATE '2026-09-10', 'Faturado', '230398', '5424', 348.67, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('3640fa3e-110c-48b2-85f5-57a1e1831daf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1197'), DATE '2026-09-10', DATE '2026-11-09', 348.67, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 140). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('3640fa3e-110c-48b2-85f5-57a1e1831daf', '56fd775f-1b76-40fc-ab66-b59ed1ce7306');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('3640fa3e-110c-48b2-85f5-57a1e1831daf', '56fd775f-1b76-40fc-ab66-b59ed1ce7306', DATE '2026-11-09', 348.67, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 162 | apLIS lote 6687
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('65f3c878-445c-421e-808c-1609397970ae', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6687', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '233266', '6687', 3700.09, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('b0e60d39-14d1-48e8-869c-4e44e33a88b2', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-09-01', DATE '2026-10-14', 3700.09, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 162). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('b0e60d39-14d1-48e8-869c-4e44e33a88b2', '65f3c878-445c-421e-808c-1609397970ae');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('b0e60d39-14d1-48e8-869c-4e44e33a88b2', '65f3c878-445c-421e-808c-1609397970ae', DATE '2026-10-14', 3700.09, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 163 | apLIS lote 6697
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('c3c66299-7cd9-45da-8143-72f6ef39eebf', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), '6697', DATE '2026-09-02', DATE '2026-09-02', 'Faturado', '233342', '6697', 863.01, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('064603ad-8f79-46f2-ba2e-853e55ed5296', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1235'), DATE '2026-09-02', DATE '2026-10-15', 863.01, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 163). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('064603ad-8f79-46f2-ba2e-853e55ed5296', 'c3c66299-7cd9-45da-8143-72f6ef39eebf');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('064603ad-8f79-46f2-ba2e-853e55ed5296', 'c3c66299-7cd9-45da-8143-72f6ef39eebf', DATE '2026-10-15', 863.01, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');

-- SETEMBRO linha 165 | apLIS lote 6690
INSERT INTO lotes (id_lote, operadora_id, codigo_lote, data_criacao, data_envio, status, protocolo, aplis_id, valor_total, qtd_requisicoes)
VALUES ('25ea0712-c800-4643-938b-65778e8b128d', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), '6690', DATE '2026-09-01', DATE '2026-09-01', 'Faturado', '88', '6690', 898.69, 0);
-- (sem ON CONFLICT de propósito: aplis_id é UNIQUE — se esta migration for
-- rodada 2x, ou se este lote já tiver sido registrado por outro caminho, a
-- inserção falha alto e a transação inteira dá rollback, em vez de deixar
-- nota_lote referenciando um id_lote que nunca foi persistido.)
INSERT INTO notas (id_nota, operadora_id, data_emissao, data_vencimento, valor_total, competencia, observacoes)
VALUES ('a75163f9-a0cb-492d-9698-2c1aa43a9db0', (SELECT id_operadora FROM operadoras WHERE aplis_id = '1232'), DATE '2026-09-01', DATE '2026-10-01', 898.69, '2026-09', 'Backfill planilha Faturamento x Recebimentos 2026 Q3 (aba SETEMBRO, linha 165). Responsável: Renata. Status original na planilha: No prazo.');
INSERT INTO nota_lote (id_nota, id_lote) VALUES ('a75163f9-a0cb-492d-9698-2c1aa43a9db0', '25ea0712-c800-4643-938b-65778e8b128d');
INSERT INTO recebimentos (nota_id, lote_id, data_prevista, valor_previsto, status, registrado_por, observacoes)
VALUES ('a75163f9-a0cb-492d-9698-2c1aa43a9db0', '25ea0712-c800-4643-938b-65778e8b128d', DATE '2026-10-01', 898.69, 'previsto', 'Renata', 'Backfill planilha Jul-Set/2026');
