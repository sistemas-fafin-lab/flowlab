-- ============================================================================
-- Contas a Receber: títulos da planilha acertados pelo apLIS (20/10/2026)
--
-- Gerada por supabase/scripts/acerto-titulos-planilha-pelo-aplis.ts com o
-- Supabase de produção e o apLIS (backup MySQL) lidos em 20/10/2026. Os
-- backfills Jan–Jun e Jul–Set/2026 gravaram o valor, a baixa e a glosa da
-- planilha do cliente; nos títulos abaixo eles não batem com o apLIS, que é o
-- correto (.scratch/faturamento-acerto-titulos-aplis/relatorio.md).
--
-- Por título: valor do título/lote = apLIS; baixas e glosas da planilha saem;
-- baixa repetida sai; entram as baixas (uma por data de recebimento) e as
-- glosas (origem 'aplis') do apLIS. Títulos com baixa ou glosa digitada que
-- não fecha com o apLIS ficaram de fora (relatório, "manual").
--
-- 668 títulos. Diferenças: valor -69136,24, recebido 61235,18, glosa -162370,13.
--
-- Os ids são de produção: no projeto de teste os DELETE/UPDATE não acham nada e
-- a conferência do fim aborta. Tudo numa transação; qualquer divergência na
-- conferência desfaz tudo.
-- ============================================================================

BEGIN;

-- sem número | TJDFT | lote(s) 6534
UPDATE lotes SET valor_total = 10635.46 WHERE id_lote = '36413656-f910-4dd9-ae75-cc9f445869bd';
UPDATE notas SET valor_total = 10635.46 WHERE id_nota = '8f6e0af2-6d4d-4717-bd6b-28220287e9e3';
SELECT fat_recalcular_nota('8f6e0af2-6d4d-4717-bd6b-28220287e9e3');

-- sem número | AMHP-DF | lote(s) 6367
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c', DATE '2026-09-21', DATE '2026-09-30', 1244.18, 1244.18, 'recebido', 'Baixa do apLIS — lote(s) 6367 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c');

-- sem número | AMHP-DF | lote(s) 6382
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eadef290-7c37-4575-b7c4-367a06f236c2', DATE '2026-09-22', DATE '2026-09-30', 880.75, 880.75, 'recebido', 'Baixa do apLIS — lote(s) 6382 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eadef290-7c37-4575-b7c4-367a06f236c2');

-- sem número | AMHP-DF | lote(s) 6383
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21660afa-51e8-4c80-9498-edf8c9e36c89', DATE '2026-09-22', DATE '2026-08-31', 1362.69, 1362.69, 'recebido', 'Baixa do apLIS — lote(s) 6383 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('21660afa-51e8-4c80-9498-edf8c9e36c89');

-- sem número | AMHP-DF | lote(s) 6384
UPDATE lotes SET valor_total = 181.70 WHERE id_lote = 'c2daf49d-9769-4c4a-9d3e-3c8e0ae31106';
UPDATE notas SET valor_total = 181.70 WHERE id_nota = '2cbece3f-6a8d-419e-aed2-1103f24111e6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2cbece3f-6a8d-419e-aed2-1103f24111e6', DATE '2026-09-22', DATE '2026-09-15', 90.86, 90.86, 'recebido', 'Baixa do apLIS — lote(s) 6384 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2cbece3f-6a8d-419e-aed2-1103f24111e6', DATE '2026-09-22', DATE '2026-09-17', 90.86, 90.86, 'recebido', 'Baixa do apLIS — lote(s) 6384 (recebido em 17/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2cbece3f-6a8d-419e-aed2-1103f24111e6');

-- sem número | AMHP-DF | lote(s) 6405
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7b55874-6cac-4ede-bec9-2025704653c2', DATE '2026-07-29', DATE '2026-09-30', 555.21, 555.21, 'recebido', 'Baixa do apLIS — lote(s) 6405 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b7b55874-6cac-4ede-bec9-2025704653c2');

-- sem número | AMHP-DF | lote(s) 6420
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1', DATE '2026-07-30', DATE '2026-09-30', 701.64, 701.64, 'recebido', 'Baixa do apLIS — lote(s) 6420 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1');

-- sem número | AMHP-DF | lote(s) 6486
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b714b2a4-98f7-422d-96e2-018e9c53f7d6', DATE '2026-10-06', DATE '2026-09-30', 3994.97, 3994.97, 'recebido', 'Baixa do apLIS — lote(s) 6486 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b714b2a4-98f7-422d-96e2-018e9c53f7d6');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6571
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dda165dd-c959-4b77-926a-f3f4d8a4b145', DATE '2026-10-17', DATE '2026-09-29', 6818.11, 6818.11, 'recebido', 'Baixa do apLIS — lote(s) 6571 (recebido em 29/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dda165dd-c959-4b77-926a-f3f4d8a4b145');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6570
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('68cf7768-4671-48da-b22b-4d4630c95bfa', DATE '2026-10-17', DATE '2026-09-29', 20787.60, 20787.60, 'recebido', 'Baixa do apLIS — lote(s) 6570 (recebido em 29/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('68cf7768-4671-48da-b22b-4d4630c95bfa');

-- sem número | AMHP-DF | lote(s) 6281
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('15bf1d80-91c8-4dfe-9618-583ac1080c60', DATE '2026-09-13', DATE '2026-09-15', 1000.75, 1000.75, 'recebido', 'Baixa do apLIS — lote(s) 6281 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('15bf1d80-91c8-4dfe-9618-583ac1080c60');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6580
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2a672d1e-d310-44d9-ab96-4638c8d5d853', DATE '2026-10-20', DATE '2026-09-29', 7188.87, 7188.87, 'recebido', 'Baixa do apLIS — lote(s) 6580 (recebido em 29/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2a672d1e-d310-44d9-ab96-4638c8d5d853');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 6617
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6dda1644-e5bb-47c2-86fa-e45edd13840c', DATE '2026-10-24', DATE '2026-10-15', 9905.76, 9905.76, 'recebido', 'Baixa do apLIS — lote(s) 6617 (recebido em 15/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6dda1644-e5bb-47c2-86fa-e45edd13840c');

-- sem número | AMHP-DF | lote(s) 6496
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('530cf841-dd6d-4060-a53c-9be06b004202', DATE '2026-10-09', DATE '2026-09-30', 3010.59, 3010.59, 'recebido', 'Baixa do apLIS — lote(s) 6496 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('530cf841-dd6d-4060-a53c-9be06b004202');

-- sem número | AMHP-DF | lote(s) 6497
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255', DATE '2026-10-09', DATE '2026-09-30', 1282.94, 1282.94, 'recebido', 'Baixa do apLIS — lote(s) 6497 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255');

-- sem número | AMHP-DF | lote(s) 6511
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8747d8f8-be07-4f7a-9238-8d927f3e7e57', DATE '2026-10-23', DATE '2026-09-30', 782.37, 782.37, 'recebido', 'Baixa do apLIS — lote(s) 6511 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8747d8f8-be07-4f7a-9238-8d927f3e7e57');

-- sem número | AMHP-DF | lote(s) 6513
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004', DATE '2026-10-10', DATE '2026-09-30', 555.21, 555.21, 'recebido', 'Baixa do apLIS — lote(s) 6513 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004');

-- NF 9125 | CASSI | lote(s) 6316
DELETE FROM recebimentos WHERE id_receb IN ('7d3ae8cd-e415-4e55-91a4-cae6833ad05e');
UPDATE lotes SET valor_total = 23669.95 WHERE id_lote = '9af977b5-70c7-43c5-bfba-b21b11aadd59';
UPDATE notas SET valor_total = 23669.95 WHERE id_nota = '697021c3-dc8b-4798-9c24-8484d82c12da';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', DATE '2026-09-04', DATE '2026-08-31', 23149.35, 23149.35, 'recebido', 'Baixa do apLIS — lote(s) 6316 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', '9af977b5-70c7-43c5-bfba-b21b11aadd59', 469.36, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('697021c3-dc8b-4798-9c24-8484d82c12da', '9af977b5-70c7-43c5-bfba-b21b11aadd59', 51.24, 'ATENDIMENTO NÃO CONFIRMADO PELO BENEFICIÁRIO', '3096', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('697021c3-dc8b-4798-9c24-8484d82c12da');

-- sem número | AMHP-DF | lote(s) 6548
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('13bf6dce-4743-4a40-b07b-428fd72e7535', DATE '2026-10-13', DATE '2026-09-30', 3281.99, 3281.99, 'recebido', 'Baixa do apLIS — lote(s) 6548 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('13bf6dce-4743-4a40-b07b-428fd72e7535');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 6562
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3e600e27-7259-4d30-9939-0abbbc5c1257', DATE '2026-10-19', DATE '2026-10-15', 59.89, 59.89, 'recebido', 'Baixa do apLIS — lote(s) 6562 (recebido em 15/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3e600e27-7259-4d30-9939-0abbbc5c1257');

-- NF 9128 | BRB SAÚDE | lote(s) 6429
DELETE FROM recebimentos WHERE id_receb IN ('44c32dc6-715d-49ba-b4c7-b26c0e1e77de');
SELECT fat_recalcular_nota('10203a63-ec34-4eae-a329-34b48074a1ed');

-- sem número | AMHP-DF | lote(s) 6623
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e21920b1-de7d-4f10-a1f7-31a75257869a', DATE '2026-10-23', DATE '2026-09-30', 367.76, 367.76, 'recebido', 'Baixa do apLIS — lote(s) 6623 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e21920b1-de7d-4f10-a1f7-31a75257869a');

-- NF 8910 | FASCAL | lote(s) 6423
DELETE FROM recebimentos WHERE id_receb IN ('77d2b964-557b-4f29-b557-28f04d5f4f78');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-05-21', 898.69, 898.69, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-06-10', 176.25, 176.25, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 10/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-06-16', 281.25, 281.25, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 16/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-06-26', 705.00, 705.00, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 26/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-01', 176.25, 176.25, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-03', 499.03, 499.03, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-07', 239.76, 239.76, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 07/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-08', 1042.71, 1042.71, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 08/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-09', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 09/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-13', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 13/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-14', 738.79, 738.79, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 14/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-15', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-16', 319.68, 319.68, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 16/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-17', 559.44, 559.44, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-22', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 22/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-23', 2565.06, 2565.06, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 23/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-24', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 24/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-27', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 27/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', DATE '2026-09-01', DATE '2026-07-28', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 6423 (recebido em 28/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d6c3d663-8dd4-4e93-a9af-91f473faeced', '595a68c0-0eb4-4f7e-971e-790158b8160c', 159.84, 'GUIA SEM ASSINATURA DO ASSISTIDO.', '1319', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d6c3d663-8dd4-4e93-a9af-91f473faeced');

-- sem número | AMHP-DF | lote(s) 6303
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f561367-4e51-4913-9495-8b00558a8092', DATE '2026-09-15', DATE '2026-09-15', 63.93, 63.93, 'recebido', 'Baixa do apLIS — lote(s) 6303 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2f561367-4e51-4913-9495-8b00558a8092');

-- sem número | AMHP-DF | lote(s) 6365
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86045f2f-add8-46e2-b059-496dc6708cf3', DATE '2026-09-21', DATE '2026-09-15', 63.93, 63.93, 'recebido', 'Baixa do apLIS — lote(s) 6365 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('86045f2f-add8-46e2-b059-496dc6708cf3');

-- sem número | SAUDE CAIXA | lote(s) 6531
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cf8c7e68-47b6-402d-8751-a178dbeae1c0', DATE '2026-09-11', DATE '2026-09-11', 68.75, 68.75, 'recebido', 'Baixa do apLIS — lote(s) 6531 (recebido em 11/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cf8c7e68-47b6-402d-8751-a178dbeae1c0');

-- sem número | AMHP-DF | lote(s) 6302
UPDATE lotes SET valor_total = 1115.33 WHERE id_lote = '8c2ace15-bcbb-4fc2-a083-58541978e2aa';
UPDATE notas SET valor_total = 1115.33 WHERE id_nota = '7112651f-b605-4190-879e-8e61c35199d6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7112651f-b605-4190-879e-8e61c35199d6', DATE '2026-09-15', DATE '2026-09-15', 1115.34, 1115.34, 'recebido', 'Baixa do apLIS — lote(s) 6302 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7112651f-b605-4190-879e-8e61c35199d6');

-- sem número | SAUDE CAIXA | lote(s) 6579
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9', DATE '2026-09-18', DATE '2026-09-14', 68.75, 68.75, 'recebido', 'Baixa do apLIS — lote(s) 6579 (recebido em 14/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9');

-- sem número | SAUDE CAIXA | lote(s) 6606
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('390017a5-8b57-44fa-a5f2-f0a34c9426ca', DATE '2026-09-19', DATE '2026-09-14', 8511.34, 8511.34, 'recebido', 'Baixa do apLIS — lote(s) 6606 (recebido em 14/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('390017a5-8b57-44fa-a5f2-f0a34c9426ca');

-- sem número | SAUDE CAIXA | lote(s) 6413
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b176d750-4909-4278-901a-432eacf1e864', DATE '2026-09-02', DATE '2026-09-14', 18693.15, 18693.15, 'recebido', 'Baixa do apLIS — lote(s) 6413 (recebido em 14/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b176d750-4909-4278-901a-432eacf1e864');

-- sem número | SAUDE CAIXA | lote(s) 6532
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38', DATE '2026-09-11', DATE '2025-12-31', 1426.77, 1426.77, 'recebido', 'Baixa do apLIS — lote(s) 6532 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6641
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', DATE '2026-10-05', DATE '2026-07-23', 102.89, 102.89, 'recebido', 'Baixa do apLIS — lote(s) 6641 (recebido em 23/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', DATE '2026-10-05', DATE '2026-07-28', 123.08, 123.08, 'recebido', 'Baixa do apLIS — lote(s) 6641 (recebido em 28/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', DATE '2026-10-05', DATE '2026-08-06', 123.08, 123.08, 'recebido', 'Baixa do apLIS — lote(s) 6641 (recebido em 06/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', DATE '2026-10-05', DATE '2026-08-11', 144.24, 144.24, 'recebido', 'Baixa do apLIS — lote(s) 6641 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c2d6b448-bd77-4001-b16b-ef8d981b6695', DATE '2026-10-05', DATE '2026-08-13', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6641 (recebido em 13/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c2d6b448-bd77-4001-b16b-ef8d981b6695');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6674
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59', DATE '2026-10-05', DATE '2026-08-31', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6674 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6671
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-12', 61.54, 61.54, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 12/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-17', 61.54, 61.54, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-19', 61.54, 61.54, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-21', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 21/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-25', 2256.20, 2256.20, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 25/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-26', 480.93, 480.93, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 26/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-27', 965.83, 965.83, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 27/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-28', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 28/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d7311c8f-cb3b-4bed-b838-bddd4c97f543', DATE '2026-10-05', DATE '2026-08-31', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6671 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d7311c8f-cb3b-4bed-b838-bddd4c97f543');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6640
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-07-31', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-03', 2180.52, 2180.52, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 03/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-04', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-05', 869.88, 869.88, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 05/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-06', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 06/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-07', 504.09, 504.09, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 07/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-10', 2201.50, 2201.50, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 10/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-12', 408.14, 408.14, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 12/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-14', 589.89, 589.89, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-17', 995.67, 995.67, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-18', 1677.56, 1677.56, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 18/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-20', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('212407e6-ec5d-499a-80ba-41ffd393b450', DATE '2026-10-05', DATE '2026-08-21', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6640 (recebido em 21/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('212407e6-ec5d-499a-80ba-41ffd393b450');

-- sem número | AMIL | lote(s) 6206
DELETE FROM glosas WHERE id_glosa IN ('e593231d-f6cb-49eb-9105-9687b08b1b74');
DELETE FROM recebimentos WHERE id_receb IN ('2dda950e-b70c-4be6-b2bb-b90af95d620a');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('776c82c8-0de5-4429-baa9-050eb31db88b', 'cd3348fd-2afb-417b-81a8-1bae0e42e65d', 1196.11, 'COBRANÇA EM GUIA INDEVIDA', '1304', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('776c82c8-0de5-4429-baa9-050eb31db88b');

-- NF 9018 | AMIL | lote(s) 6271
DELETE FROM glosas WHERE id_glosa IN ('a5935eb3-2332-48a8-b26b-1ab191df6f10');
DELETE FROM recebimentos WHERE id_receb IN ('aff5f3ea-e157-4938-8dcb-a0bfa6ff5b8d');
UPDATE lotes SET valor_total = 2346.09 WHERE id_lote = 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66';
UPDATE notas SET valor_total = 2346.09 WHERE id_nota = '49a6ec97-048b-4624-8247-62ad9f032c27';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', DATE '2026-08-12', DATE '2026-07-10', 789.90, 789.90, 'recebido', 'Baixa do apLIS — lote(s) 6271 (recebido em 10/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66', 1207.59, 'COBRANÇA EM GUIA INDEVIDA', '1304', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('49a6ec97-048b-4624-8247-62ad9f032c27', 'cc740f9c-3b7d-4b20-92fc-d68c075ffa66', 348.60, 'MENSAGEM INCONSISTENTE OU INCOMPLETA', '5007', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('49a6ec97-048b-4624-8247-62ad9f032c27');

-- NF 9018 | AMIL | lote(s) 6255
DELETE FROM glosas WHERE id_glosa IN ('ffd3bff1-e03f-4bdb-99a7-da835b760acd');
DELETE FROM recebimentos WHERE id_receb IN ('e141b7a5-9f47-4b15-a8f9-b4dcb5a988fc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', DATE '2026-08-09', DATE '2026-07-06', 394.95, 394.95, 'recebido', 'Baixa do apLIS — lote(s) 6255 (recebido em 06/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', 'b1c88e8b-0427-4e45-8df1-ca6661c2f298', 3286.40, 'COBRANÇA EM GUIA INDEVIDA', '1304', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c', 'b1c88e8b-0427-4e45-8df1-ca6661c2f298', 394.95, 'NECESSÁRIO O ENVIO DO PEDIDO DO PROFISSIONAL SOLICITANTE', '3120', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c');

-- NF 9018 | AMIL | lote(s) 6205
DELETE FROM glosas WHERE id_glosa IN ('9d6995d8-dc81-4ba8-9268-f03a56682245');
DELETE FROM recebimentos WHERE id_receb IN ('3b6b06af-4799-44e0-b435-0e2e4fe5f04d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', DATE '2026-07-31', DATE '2026-06-17', 394.95, 394.95, 'recebido', 'Baixa do apLIS — lote(s) 6205 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', DATE '2026-07-31', DATE '2026-06-22', 264.60, 264.60, 'recebido', 'Baixa do apLIS — lote(s) 6205 (recebido em 22/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', DATE '2026-07-31', DATE '2026-06-26', 394.95, 394.95, 'recebido', 'Baixa do apLIS — lote(s) 6205 (recebido em 26/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', 'cc8501fe-44b1-4fa9-a52f-025a6f5a8075', 13175.08, 'COBRANÇA EM GUIA INDEVIDA', '1304', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d8530908-9e73-4954-9630-ac521a76c1ee', 'cc8501fe-44b1-4fa9-a52f-025a6f5a8075', 44.29, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d8530908-9e73-4954-9630-ac521a76c1ee');

-- sem número | GEAP Autogestão em Saúde | lote(s) 6731
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9a5402cb-26da-48cd-a723-13f8bb43c1e4', DATE '2026-12-07', DATE '2025-08-30', 6239.45, 6239.45, 'recebido', 'Baixa do apLIS — lote(s) 6731 (recebido em 30/08/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9a5402cb-26da-48cd-a723-13f8bb43c1e4');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6266
DELETE FROM recebimentos WHERE id_receb IN ('7d8379cf-c8b7-44d3-8656-edda536603dc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0', DATE '2026-09-11', DATE '2026-07-13', 1060.37, 1060.37, 'recebido', 'Baixa do apLIS — lote(s) 6266 (recebido em 13/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0', '4ea74182-5025-4325-9d87-6abbd9ef7b61', 160.27, 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', '1006', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0645ec03-91bb-45b3-b5df-2f4aac9df3d0');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6240
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('862af5e3-8cb2-4364-a12c-32ff8d3cc283', DATE '2026-09-15', DATE '2026-07-17', 12728.64, 12728.64, 'recebido', 'Baixa do apLIS — lote(s) 6240 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('862af5e3-8cb2-4364-a12c-32ff8d3cc283');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 6335
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f3aecfe9-b31e-4b38-9770-99b804530129', DATE '2026-09-19', DATE '2026-10-15', 15596.16, 15596.16, 'recebido', 'Baixa do apLIS — lote(s) 6335 (recebido em 15/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f3aecfe9-b31e-4b38-9770-99b804530129');

-- sem número | AMHP-DF | lote(s) 6288
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f', DATE '2026-09-13', DATE '2026-09-15', 873.44, 873.44, 'recebido', 'Baixa do apLIS — lote(s) 6288 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f');

-- sem número | AMHP-DF | lote(s) 6381
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3c053b58-80db-436c-b72a-74df1d946f9a', DATE '2026-09-22', DATE '2026-09-15', 1482.72, 1482.72, 'recebido', 'Baixa do apLIS — lote(s) 6381 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3c053b58-80db-436c-b72a-74df1d946f9a');

-- NF 8860 | CASSI | lote(s) 6216
DELETE FROM glosas WHERE id_glosa IN ('d3e2d284-2797-41d1-b7d6-963b92265553');
DELETE FROM recebimentos WHERE id_receb IN ('86477441-f779-4313-9d07-44c4b7dc5177');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('172855da-da24-4231-9bdd-962570629cdb', DATE '2026-08-02', DATE '2026-08-04', 14132.25, 14132.25, 'recebido', 'Baixa do apLIS — lote(s) 6216 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('172855da-da24-4231-9bdd-962570629cdb', '621c4437-6750-4af2-99c8-48da101f676d', 704.02, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('172855da-da24-4231-9bdd-962570629cdb');

-- NF 8874 | BRB SAÚDE | lote(s) 6194
DELETE FROM recebimentos WHERE id_receb IN ('b4690ac0-ee91-495b-8db2-ed659d8c5536');
UPDATE lotes SET valor_total = 14006.04 WHERE id_lote = 'c8c6ece7-a1bb-40ae-b086-61afe3195341';
UPDATE notas SET valor_total = 14006.04 WHERE id_nota = '507b0c51-7225-45db-8dec-6a3c42f079c8';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-05-26', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-01', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 01/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-05', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-08', 2167.92, 2167.92, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 08/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-09', 1105.10, 1105.10, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-10', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 10/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-12', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-16', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 16/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-17', 1083.96, 1083.96, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-18', 595.05, 595.05, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 18/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-19', 42.50, 42.50, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-22', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 22/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-25', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-29', 1594.01, 1594.01, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 29/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('507b0c51-7225-45db-8dec-6a3c42f079c8', DATE '2026-08-30', DATE '2026-06-30', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 6194 (recebido em 30/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('507b0c51-7225-45db-8dec-6a3c42f079c8');

-- NF 8878 | CASSI | lote(s) 6223
DELETE FROM glosas WHERE id_glosa IN ('46736612-6f8c-446c-80a1-8f2fb855879b');
DELETE FROM recebimentos WHERE id_receb IN ('d9da91be-b9d0-4bd9-8399-f74816cf85e7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', DATE '2026-08-05', DATE '2026-08-04', 7301.05, 7301.05, 'recebido', 'Baixa do apLIS — lote(s) 6223 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('37b11053-6e96-4e47-8ff5-0739a11f88ba', 'abeb6254-0153-4757-9522-957829ff66aa', 0.01, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('37b11053-6e96-4e47-8ff5-0739a11f88ba');

-- sem número | CBMDF | lote(s) 5894
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6f94ef01-5058-409e-8ad6-47441cd0f56d', DATE '2026-08-08', DATE '2026-08-10', 463.74, 463.74, 'recebido', 'Baixa do apLIS — lote(s) 5894 (recebido em 10/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6f94ef01-5058-409e-8ad6-47441cd0f56d');

-- NF 8878 | CASSI | lote(s) 6257
DELETE FROM glosas WHERE id_glosa IN ('c39b8cfe-9255-4696-bcee-a351c5b8e59c');
DELETE FROM recebimentos WHERE id_receb IN ('ea8cb726-d047-4f1e-b61a-2936b7fe55aa');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', DATE '2026-08-09', DATE '2026-08-04', 27613.34, 27613.34, 'recebido', 'Baixa do apLIS — lote(s) 6257 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a04f3ba7-5497-4316-af80-5ae05b0fb265', '20699454-f49e-4fe6-a18e-d9961925e1be', 2581.44, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a04f3ba7-5497-4316-af80-5ae05b0fb265');

-- NF 8860 | CASSI | lote(s) 6219
DELETE FROM glosas WHERE id_glosa IN ('8a447564-283f-4716-bb0b-77015306e45c');
DELETE FROM recebimentos WHERE id_receb IN ('8a1cd95a-337f-4661-a0a5-42a4a4ecea39');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', DATE '2026-08-02', DATE '2026-08-04', 23781.91, 23781.91, 'recebido', 'Baixa do apLIS — lote(s) 6219 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ce289f17-bf36-4a0d-8eae-3fa513519444', 'b64f90d1-64b6-4956-a590-b6d1b27ef4af', 234.68, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ce289f17-bf36-4a0d-8eae-3fa513519444');

-- sem número | GEAP Autogestão em Saúde | lote(s) 5456
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c866aefa-1eb1-4919-b1cd-f4f18fda43df', DATE '2026-09-29', DATE '2025-02-25', 52.32, 52.32, 'recebido', 'Baixa do apLIS — lote(s) 5456 (recebido em 25/02/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c866aefa-1eb1-4919-b1cd-f4f18fda43df', DATE '2026-09-29', DATE '2025-10-15', 417.65, 417.65, 'recebido', 'Baixa do apLIS — lote(s) 5456 (recebido em 15/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c866aefa-1eb1-4919-b1cd-f4f18fda43df');

-- sem número | GEAP Autogestão em Saúde | lote(s) 4421
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0', DATE '2026-09-29', DATE '2025-10-16', 10303.10, 10303.10, 'recebido', 'Baixa do apLIS — lote(s) 4421 (recebido em 16/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0');

-- NF 8860 | CASSI | lote(s) 6217
DELETE FROM glosas WHERE id_glosa IN ('71fc3a47-8ab4-486a-a099-60389521f982');
DELETE FROM recebimentos WHERE id_receb IN ('4ef6d991-3f95-4747-b3d1-dce91baea394');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', DATE '2026-08-02', DATE '2026-08-04', 20618.06, 20618.06, 'recebido', 'Baixa do apLIS — lote(s) 6217 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ff58c668-d246-4b1f-bb01-cc605624337a', '775d93fb-11e5-4e69-9d01-b3fc59b9ffdc', 704.02, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ff58c668-d246-4b1f-bb01-cc605624337a');

-- sem número | AMHP-DF | lote(s) 3930
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d657d96f-845a-4650-b54f-9ca077524da2', DATE '2026-10-18', DATE '2025-12-31', 8824.30, 8824.30, 'recebido', 'Baixa do apLIS — lote(s) 3930 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d657d96f-845a-4650-b54f-9ca077524da2', DATE '2026-10-18', DATE '2026-08-04', 4020.76, 4020.76, 'recebido', 'Baixa do apLIS — lote(s) 3930 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d657d96f-845a-4650-b54f-9ca077524da2');

-- sem número | AMHP-DF | lote(s) 4033
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('231587bd-3f03-46e5-80e8-e31dc1b298e1', DATE '2026-10-18', DATE '2025-12-31', 3786.44, 3786.44, 'recebido', 'Baixa do apLIS — lote(s) 4033 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('231587bd-3f03-46e5-80e8-e31dc1b298e1');

-- sem número | AMHP-DF | lote(s) 5179
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a28840ea-9ae8-4e73-aaef-863f54a3504a', DATE '2026-11-07', DATE '2025-12-31', 1718.06, 1718.06, 'recebido', 'Baixa do apLIS — lote(s) 5179 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a28840ea-9ae8-4e73-aaef-863f54a3504a', DATE '2026-11-07', DATE '2026-08-17', 767.05, 767.05, 'recebido', 'Baixa do apLIS — lote(s) 5179 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a28840ea-9ae8-4e73-aaef-863f54a3504a');

-- sem número | AMHP-DF | lote(s) 6272
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dde08209-38f4-4350-8ac8-fa3c62d5e69a', DATE '2026-09-11', DATE '2026-09-15', 8618.68, 8618.68, 'recebido', 'Baixa do apLIS — lote(s) 6272 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dde08209-38f4-4350-8ac8-fa3c62d5e69a');

-- sem número | AMHP-DF | lote(s) 6274
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e379114-a0f7-495c-a37f-a0cd1c2b13ec', DATE '2026-09-12', DATE '2026-09-15', 2406.81, 2406.81, 'recebido', 'Baixa do apLIS — lote(s) 6274 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2e379114-a0f7-495c-a37f-a0cd1c2b13ec');

-- sem número | PMDF | lote(s) 6243
UPDATE lotes SET valor_total = 4138.97 WHERE id_lote = '9c937d21-045c-4973-8dc2-fa1114152400';
UPDATE notas SET valor_total = 4138.97 WHERE id_nota = '72fb35b5-0118-4858-9a7c-64b4cf902c2d';
SELECT fat_recalcular_nota('72fb35b5-0118-4858-9a7c-64b4cf902c2d');

-- sem número | AMHP-DF | lote(s) 6276
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ac3ad2bf-4188-4b2a-9298-f11935ec6786', DATE '2026-09-12', DATE '2026-09-15', 4181.80, 4181.80, 'recebido', 'Baixa do apLIS — lote(s) 6276 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ac3ad2bf-4188-4b2a-9298-f11935ec6786');

-- sem número | AMHP-DF | lote(s) 6277
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa', DATE '2026-09-12', DATE '2026-09-15', 4491.72, 4491.72, 'recebido', 'Baixa do apLIS — lote(s) 6277 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa');

-- sem número | AMHP-DF | lote(s) 6280
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a4572e90-0ab8-4581-9215-d03124b4b8b4', DATE '2026-09-12', DATE '2026-09-15', 6515.00, 6515.00, 'recebido', 'Baixa do apLIS — lote(s) 6280 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a4572e90-0ab8-4581-9215-d03124b4b8b4');

-- sem número | AMHP-DF | lote(s) 6284
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('567e7a18-47ff-4a4f-9f02-4af76c43b2c2', DATE '2026-09-13', DATE '2025-12-31', 965.77, 965.77, 'recebido', 'Baixa do apLIS — lote(s) 6284 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('567e7a18-47ff-4a4f-9f02-4af76c43b2c2');

-- sem número | AMHP-DF | lote(s) 6285
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7f5848ae-84de-4b19-9bc7-bd9f01722cf0', DATE '2026-06-13', DATE '2026-09-15', 79.91, 79.91, 'recebido', 'Baixa do apLIS — lote(s) 6285 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7f5848ae-84de-4b19-9bc7-bd9f01722cf0');

-- sem número | AMHP-DF | lote(s) 6286
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95d22173-2bd6-4fd1-92bb-67a2b8c63a72', DATE '2026-09-13', DATE '2026-09-15', 1448.46, 1448.46, 'recebido', 'Baixa do apLIS — lote(s) 6286 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('95d22173-2bd6-4fd1-92bb-67a2b8c63a72');

-- sem número | AMHP-DF | lote(s) 6287
UPDATE lotes SET valor_total = 1072.68 WHERE id_lote = '08507286-719f-4775-8973-26af9771854b';
UPDATE notas SET valor_total = 1072.68 WHERE id_nota = '8376808a-f17f-485b-93f0-d201028d347c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8376808a-f17f-485b-93f0-d201028d347c', DATE '2026-09-13', DATE '2026-09-15', 355.25, 355.25, 'recebido', 'Baixa do apLIS — lote(s) 6287 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8376808a-f17f-485b-93f0-d201028d347c');

-- sem número | AMHP-DF | lote(s) 6291
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('27de197e-24f0-4c5c-a1c4-34945f9d46e9', DATE '2026-09-13', DATE '2026-09-15', 57.90, 57.90, 'recebido', 'Baixa do apLIS — lote(s) 6291 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('27de197e-24f0-4c5c-a1c4-34945f9d46e9');

-- sem número | AMHP-DF | lote(s) 6292
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1672eb37-3aca-49a8-a93a-f55fe017627e', DATE '2026-09-13', DATE '2026-09-30', 1571.80, 1571.80, 'recebido', 'Baixa do apLIS — lote(s) 6292 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1672eb37-3aca-49a8-a93a-f55fe017627e');

-- sem número | AMHP-DF | lote(s) 6294
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('05d86674-7a97-4ba1-b355-a9f245502af8', DATE '2026-09-13', DATE '2026-08-31', 859.62, 859.62, 'recebido', 'Baixa do apLIS — lote(s) 6294 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('05d86674-7a97-4ba1-b355-a9f245502af8', DATE '2026-09-13', DATE '2026-09-30', 639.37, 639.37, 'recebido', 'Baixa do apLIS — lote(s) 6294 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('05d86674-7a97-4ba1-b355-a9f245502af8');

-- sem número | AMHP-DF | lote(s) 6295
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7e2653d2-149b-48da-b1e9-1161806fec4f', DATE '2026-09-13', DATE '2026-09-30', 1095.27, 1095.27, 'recebido', 'Baixa do apLIS — lote(s) 6295 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7e2653d2-149b-48da-b1e9-1161806fec4f');

-- sem número | AMHP-DF | lote(s) 6301
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a4e7069-8a8a-4cf9-9c7a-babd84486ede', DATE '2026-09-15', DATE '2026-08-04', 1306.93, 1306.93, 'recebido', 'Baixa do apLIS — lote(s) 6301 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0a4e7069-8a8a-4cf9-9c7a-babd84486ede');

-- sem número | AMHP-DF | lote(s) 6304
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c5ca081e-ed9d-4113-80e0-8c21d1024483', DATE '2026-09-15', DATE '2026-09-30', 1138.34, 1138.34, 'recebido', 'Baixa do apLIS — lote(s) 6304 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c5ca081e-ed9d-4113-80e0-8c21d1024483');

-- sem número | AMHP-DF | lote(s) 6306
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8cce6010-a3a2-4b8e-bf3b-b0eee536876e', DATE '2026-09-15', DATE '2026-09-30', 1014.19, 1014.19, 'recebido', 'Baixa do apLIS — lote(s) 6306 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8cce6010-a3a2-4b8e-bf3b-b0eee536876e');

-- sem número | AMHP-DF | lote(s) 6307
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7fc2bcf0-52af-4536-ad55-b052600b04d0', DATE '2026-09-15', DATE '2026-09-30', 676.87, 676.87, 'recebido', 'Baixa do apLIS — lote(s) 6307 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7fc2bcf0-52af-4536-ad55-b052600b04d0');

-- sem número | AMHP-DF | lote(s) 6308
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ac821279-552b-49e3-a558-6f16654a5412', DATE '2026-09-15', DATE '2026-09-30', 62.28, 62.28, 'recebido', 'Baixa do apLIS — lote(s) 6308 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ac821279-552b-49e3-a558-6f16654a5412');

-- sem número | 090 SULAMERICA | lote(s) 6403
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', DATE '2026-09-04', DATE '2026-06-24', 321.85, 321.85, 'recebido', 'Baixa do apLIS — lote(s) 6403 (recebido em 24/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', DATE '2026-09-04', DATE '2026-06-25', 321.85, 321.85, 'recebido', 'Baixa do apLIS — lote(s) 6403 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('29a53480-38a0-4ba2-952a-ec0e41028f35', DATE '2026-09-04', DATE '2026-06-30', 643.70, 643.70, 'recebido', 'Baixa do apLIS — lote(s) 6403 (recebido em 30/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('29a53480-38a0-4ba2-952a-ec0e41028f35');

-- sem número | AMHP-DF | lote(s) 6310
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('33426c66-14aa-4537-a948-c460854e7bd0', DATE '2026-09-15', DATE '2026-09-30', 239.79, 239.79, 'recebido', 'Baixa do apLIS — lote(s) 6310 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('33426c66-14aa-4537-a948-c460854e7bd0');

-- sem número | AMHP-DF | lote(s) 6312
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('82e598fe-54da-486b-8b91-51b7ed2e0013', DATE '2026-09-15', DATE '2026-09-15', 256.19, 256.19, 'recebido', 'Baixa do apLIS — lote(s) 6312 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('82e598fe-54da-486b-8b91-51b7ed2e0013');

-- sem número | AMHP-DF | lote(s) 6313
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9becb062-decf-4071-b098-c84e201ddb5c', DATE '2026-09-15', DATE '2026-09-15', 3811.65, 3811.65, 'recebido', 'Baixa do apLIS — lote(s) 6313 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9becb062-decf-4071-b098-c84e201ddb5c');

-- sem número | AMHP-DF | lote(s) 6315
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ea63012f-4f02-421c-9974-b319879f18b7', DATE '2026-09-20', DATE '2026-09-30', 4185.15, 4185.15, 'recebido', 'Baixa do apLIS — lote(s) 6315 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ea63012f-4f02-421c-9974-b319879f18b7');

-- sem número | AMHP-DF | lote(s) 6353
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814', DATE '2026-09-20', DATE '2026-09-15', 898.83, 898.83, 'recebido', 'Baixa do apLIS — lote(s) 6353 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814');

-- sem número | AMHP-DF | lote(s) 6358
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33', DATE '2026-09-21', DATE '2026-09-30', 275.43, 275.43, 'recebido', 'Baixa do apLIS — lote(s) 6358 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33');

-- sem número | AMHP-DF | lote(s) 6363
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4337be2f-4d11-4582-b1f0-f2c00530e1a0', DATE '2026-09-21', DATE '2026-09-30', 898.61, 898.61, 'recebido', 'Baixa do apLIS — lote(s) 6363 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4337be2f-4d11-4582-b1f0-f2c00530e1a0');

-- sem número | AMHP-DF | lote(s) 6369
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('66056ce3-5c48-4484-96db-eac7b85ce98a', DATE '2026-09-21', DATE '2026-09-30', 76.20, 76.20, 'recebido', 'Baixa do apLIS — lote(s) 6369 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('66056ce3-5c48-4484-96db-eac7b85ce98a');

-- sem número | AMHP-DF | lote(s) 6377
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('596f7d09-f3dc-467a-bc2d-daaebef7a6d8', DATE '2026-09-22', DATE '2026-09-15', 378.38, 378.38, 'recebido', 'Baixa do apLIS — lote(s) 6377 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('596f7d09-f3dc-467a-bc2d-daaebef7a6d8');

-- sem número | AMHP-DF | lote(s) 6378
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f1887e02-9d2a-4616-a358-6890769ff7f9', DATE '2026-09-22', DATE '2026-09-30', 336.07, 336.07, 'recebido', 'Baixa do apLIS — lote(s) 6378 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f1887e02-9d2a-4616-a358-6890769ff7f9');

-- sem número | AMHP-DF | lote(s) 6380
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1fc15b45-2a08-4e22-894a-33fe8b440648', DATE '2026-09-22', DATE '2026-09-30', 2999.66, 2999.66, 'recebido', 'Baixa do apLIS — lote(s) 6380 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1fc15b45-2a08-4e22-894a-33fe8b440648');

-- sem número | AMHP-DF | lote(s) 6354
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89', DATE '2026-09-21', DATE '2026-09-30', 354.24, 354.24, 'recebido', 'Baixa do apLIS — lote(s) 6354 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6639
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-07-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 27/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-07-31', 1118.28, 1118.28, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-03', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 03/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-04', 449.23, 449.23, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-05', 170.50, 170.50, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 05/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-06', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 06/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-07', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 07/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-10', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 10/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-11', 1677.56, 1677.56, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-12', 2577.28, 2577.28, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 12/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-13', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 13/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-18', 2171.94, 2171.94, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 18/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-19', 796.43, 796.43, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-20', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd', DATE '2026-10-05', DATE '2026-08-24', 3556.72, 3556.72, 'recebido', 'Baixa do apLIS — lote(s) 6639 (recebido em 24/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cfff3201-ac30-4f26-92c7-56a44ddc3fbd');

-- NF 9017 | STJ | lote(s) 6342
DELETE FROM glosas WHERE id_glosa IN ('e3020d42-cc74-49c2-93f5-087617673aff');
DELETE FROM recebimentos WHERE id_receb IN ('5e31c4bb-fd75-48b0-972d-d2d5052c9ac3');
UPDATE lotes SET valor_total = 31404.94 WHERE id_lote = 'c3beb611-abfa-4c75-afd3-9755b152dd38';
UPDATE notas SET valor_total = 31404.94 WHERE id_nota = '196c0ed3-50e9-4478-bc17-4f352d14efcb';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', DATE '2026-08-14', DATE '2026-08-25', 26915.25, 26915.25, 'recebido', 'Baixa do apLIS — lote(s) 6342 (recebido em 25/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('196c0ed3-50e9-4478-bc17-4f352d14efcb', 'c3beb611-abfa-4c75-afd3-9755b152dd38', 1505.52, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('196c0ed3-50e9-4478-bc17-4f352d14efcb');

-- sem número | STF | lote(s) 6212
DELETE FROM recebimentos WHERE id_receb IN ('c446fac7-0663-47ab-981e-375815b7b054');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26', DATE '2026-08-14', DATE '2026-08-27', 1934.22, 1934.22, 'recebido', 'Baixa do apLIS — lote(s) 6212 (recebido em 27/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26');

-- NF 9017 | STJ | lote(s) 6116
DELETE FROM glosas WHERE id_glosa IN ('1d44514c-e767-4a6c-b878-7da003f80968');
DELETE FROM recebimentos WHERE id_receb IN ('2bd8fe17-694c-4d79-aee4-7ebae428fb02');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e', DATE '2026-08-14', DATE '2026-08-25', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 6116 (recebido em 25/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('83b123e3-2a6c-40f1-ae14-74cfe8600b6e');

-- NF 9002 | TRT | lote(s) 6297
DELETE FROM recebimentos WHERE id_receb IN ('277c59f2-ba4e-48ec-9441-480ff457be9c');
UPDATE lotes SET valor_total = 2696.07 WHERE id_lote = '9b242ca0-ae8f-49a3-b3e3-bba5912c90c5';
UPDATE notas SET valor_total = 2696.07 WHERE id_nota = 'b4e71835-49c8-432d-957f-31ce0eedf2ef';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b4e71835-49c8-432d-957f-31ce0eedf2ef', DATE '2026-08-15', DATE '2026-08-26', 2696.07, 2696.07, 'recebido', 'Baixa do apLIS — lote(s) 6297 (recebido em 26/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b4e71835-49c8-432d-957f-31ce0eedf2ef');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4803
DELETE FROM glosas WHERE id_glosa IN ('b0e5bac3-a420-4d98-8f6b-0cd9c9529d9f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d174af0-ad78-5f79-8085-4122567bb046', DATE '2026-03-13', DATE '2026-09-30', 11230.81, 11230.81, 'recebido', 'Baixa do apLIS — lote(s) 4803 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6d174af0-ad78-5f79-8085-4122567bb046');

-- sem número | GEAP Autogestão em Saúde | lote(s) 4829
DELETE FROM glosas WHERE id_glosa IN ('d7634713-792f-4ea9-b1bf-e545f2851c23');
DELETE FROM recebimentos WHERE id_receb IN ('347841db-2790-485b-819f-7af88545a91d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1', DATE '2026-04-08', DATE '2026-04-23', 8576.35, 8576.35, 'recebido', 'Baixa do apLIS — lote(s) 4829 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1');

-- sem número | GEAP Autogestão em Saúde | lote(s) 4830
DELETE FROM glosas WHERE id_glosa IN ('89d125af-7ce5-43c8-81ef-6bd96d4022e9');
DELETE FROM recebimentos WHERE id_receb IN ('d61a4f21-cef7-4067-8f40-ec6df365393b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c', DATE '2026-04-09', DATE '2026-04-23', 1416.76, 1416.76, 'recebido', 'Baixa do apLIS — lote(s) 4830 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4797
DELETE FROM glosas WHERE id_glosa IN ('dc8775e9-a378-4c4f-bd77-f3e129bfefe5');
DELETE FROM recebimentos WHERE id_receb IN ('11ba61e6-c6ba-4178-8530-912ac25f181e');
UPDATE lotes SET valor_total = 28465.80 WHERE id_lote = '707b5db7-dd84-57f1-bf17-d6af5b8e446c';
UPDATE notas SET valor_total = 28465.80 WHERE id_nota = '48ea103a-cb82-54f8-bf32-40b3354cf41f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', DATE '2026-03-24', DATE '2026-02-09', 26845.29, 26845.29, 'recebido', 'Baixa do apLIS — lote(s) 4797 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('48ea103a-cb82-54f8-bf32-40b3354cf41f', '707b5db7-dd84-57f1-bf17-d6af5b8e446c', 405.12, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('48ea103a-cb82-54f8-bf32-40b3354cf41f');

-- sem número | SIS SENADO | lote(s) 4883
DELETE FROM glosas WHERE id_glosa IN ('f311576f-debb-4acd-82c9-3db61a1ab4dd');
DELETE FROM recebimentos WHERE id_receb IN ('f81197eb-62f8-41b8-b733-d4b774b6cb95');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c12b5b04-64fa-5e30-882a-ee4f2921644c', DATE '2026-03-24', DATE '2026-03-31', 9688.19, 9688.19, 'recebido', 'Baixa do apLIS — lote(s) 4883 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c12b5b04-64fa-5e30-882a-ee4f2921644c');

-- sem número | SIS SENADO | lote(s) 4923
DELETE FROM glosas WHERE id_glosa IN ('ce946f19-c97b-47c4-8403-71de9f9c77e8');
DELETE FROM recebimentos WHERE id_receb IN ('78a7cc1e-1cf2-4d13-8d98-03875372e20f');
UPDATE lotes SET valor_total = 5225.44 WHERE id_lote = '02aa38ec-d6f5-5302-9fce-090a20858e0b';
UPDATE notas SET valor_total = 5225.44 WHERE id_nota = '6da8415d-6d02-5504-a99c-11e5236c6a36';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', DATE '2026-03-24', DATE '2026-03-31', 2597.23, 2597.23, 'recebido', 'Baixa do apLIS — lote(s) 4923 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', '02aa38ec-d6f5-5302-9fce-090a20858e0b', 276.55, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6da8415d-6d02-5504-a99c-11e5236c6a36', '02aa38ec-d6f5-5302-9fce-090a20858e0b', 446.93, 'COBRANÇA FORA DO PRAZO ESTIPULADO NO CONTRATO', '3091', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6da8415d-6d02-5504-a99c-11e5236c6a36');

-- sem número | SAUDE CAIXA | lote(s) 4789
DELETE FROM glosas WHERE id_glosa IN ('fbf28e9a-5aed-4931-927c-7965f07d00a5');
DELETE FROM recebimentos WHERE id_receb IN ('e1bf1f1a-e821-4116-9521-34932e6834cc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', DATE '2026-02-01', DATE '2026-01-16', 87.13, 87.13, 'recebido', 'Baixa do apLIS — lote(s) 4789 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', DATE '2026-02-01', DATE '2026-02-18', 30755.69, 30755.69, 'recebido', 'Baixa do apLIS — lote(s) 4789 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('423243d4-0159-534f-87c5-ebed6eab1884', '378050d0-169a-54bf-8986-707dcef81204', 351.52, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('423243d4-0159-534f-87c5-ebed6eab1884');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4802
DELETE FROM glosas WHERE id_glosa IN ('dcfd60e3-40c2-4530-9a42-a592af4b5466');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('10f053ff-720d-5271-8a0f-6286eb239394', DATE '2026-03-13', DATE '2026-09-30', 9151.03, 9151.03, 'recebido', 'Baixa do apLIS — lote(s) 4802 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('10f053ff-720d-5271-8a0f-6286eb239394');

-- sem número | AMHP-DF | lote(s) 4850
DELETE FROM recebimentos WHERE id_receb IN ('d06eb319-c38e-455c-abb0-c434445d7f41');
UPDATE lotes SET valor_total = 2677.50 WHERE id_lote = '1c4e3241-bff5-5d34-8b54-d33a23bbebdc';
UPDATE notas SET valor_total = 2677.50 WHERE id_nota = '430993ce-45e6-551e-965c-a7270d890a3a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('430993ce-45e6-551e-965c-a7270d890a3a', DATE '2026-03-17', DATE '2026-04-02', 2677.50, 2677.50, 'recebido', 'Baixa do apLIS — lote(s) 4850 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('430993ce-45e6-551e-965c-a7270d890a3a');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4926
DELETE FROM glosas WHERE id_glosa IN ('36925b19-5ae3-44bd-9c22-886f35cb4777');
DELETE FROM recebimentos WHERE id_receb IN ('f017028f-d86d-4f93-b547-73d521a4250c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', DATE '2026-03-06', DATE '2026-01-27', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 4926 (recebido em 27/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', DATE '2026-03-06', DATE '2026-01-29', 2096.95, 2096.95, 'recebido', 'Baixa do apLIS — lote(s) 4926 (recebido em 29/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6a0531ba-97fc-50db-9e43-56d9cc456183', DATE '2026-03-06', DATE '2026-10-08', 272.86, 272.86, 'recebido', 'Baixa do apLIS — lote(s) 4926 (recebido em 08/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6a0531ba-97fc-50db-9e43-56d9cc456183');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4786
DELETE FROM glosas WHERE id_glosa IN ('d3a899c5-b895-4035-99c6-c31ea5321799');
DELETE FROM recebimentos WHERE id_receb IN ('831960e2-5b89-4999-9a78-e2bff2d33b5d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-11-17', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 17/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-11-26', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 26/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-11-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 27/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-11-28', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 28/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-01', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 01/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-02', 1719.91, 1719.91, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 02/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-03', 912.23, 912.23, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 03/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-04', 84.70, 84.70, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 04/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-05', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 05/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-08', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-09', 910.97, 910.97, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-10', 82.44, 82.44, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-11', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-12', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 12/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-15', 504.09, 504.09, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 15/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-16', 2473.99, 2473.99, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-17', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-18', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-19', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 19/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-22', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 22/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-23', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 23/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-25', 29.84, 29.84, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 25/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-29', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2025-12-30', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 30/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', DATE '2026-02-09', DATE '2026-01-05', 827.53, 827.53, 'recebido', 'Baixa do apLIS — lote(s) 4786 (recebido em 05/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b270739f-c5a0-50b5-9f04-4dd964fcb400', 'd0309a90-15da-59e5-8173-f76b56864f53', 13.51, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b270739f-c5a0-50b5-9f04-4dd964fcb400');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4787
DELETE FROM glosas WHERE id_glosa IN ('34ecfff0-c815-4b10-95a1-6d99ea3dac30');
DELETE FROM recebimentos WHERE id_receb IN ('d7b8fbb6-db24-4087-a209-6c73d85b8b98');
UPDATE lotes SET valor_total = 13277.73 WHERE id_lote = 'e1865597-b1da-53ed-bf0e-81de7123e264';
UPDATE notas SET valor_total = 13277.73 WHERE id_nota = '61f6a84d-d402-593f-9979-553449bb1096';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-11-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 27/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-11-28', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 28/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-11-29', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 29/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-01', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 01/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-02', 1385.22, 1385.22, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 02/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-04', 504.09, 504.09, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 04/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-05', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 05/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-08', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-09', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-10', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-12', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 12/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-16', 1317.85, 1317.85, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-18', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-19', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 19/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-22', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 22/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-26', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 26/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-29', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('61f6a84d-d402-593f-9979-553449bb1096', DATE '2026-02-09', DATE '2025-12-31', 3106.23, 3106.23, 'recebido', 'Baixa do apLIS — lote(s) 4787 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('61f6a84d-d402-593f-9979-553449bb1096');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4885
DELETE FROM glosas WHERE id_glosa IN ('2a94e9a7-71dd-4e23-8cc0-b7dbf0465122');
DELETE FROM recebimentos WHERE id_receb IN ('f0578cce-de0e-4c74-90bf-4e839610e6a4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', DATE '2026-03-24', DATE '2026-02-27', 8466.10, 8466.10, 'recebido', 'Baixa do apLIS — lote(s) 4885 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5be66109-4fef-5581-b7b2-e302fe3aa680', '66833dba-f177-5c1d-a6a3-0f6e358d1a0a', 25.55, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5be66109-4fef-5581-b7b2-e302fe3aa680');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4788
DELETE FROM glosas WHERE id_glosa IN ('de1855e7-a486-49f4-92b4-25c561d10641');
DELETE FROM recebimentos WHERE id_receb IN ('5df56371-09fa-4d42-ae07-d4d3940f965d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-11-19', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 19/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-11-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 27/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-01', 827.53, 827.53, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 01/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-02', 2085.70, 2085.70, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 02/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-04', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 04/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-08', 1762.26, 1762.26, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-09', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-10', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-11', 869.88, 869.88, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-12', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 12/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-15', 418.26, 418.26, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 15/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-16', 786.31, 786.31, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-17', 1686.16, 1686.16, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-18', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-19', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 19/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-22', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 22/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-23', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 23/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-29', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2025-12-30', 2114.28, 2114.28, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 30/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', DATE '2026-02-09', DATE '2026-01-05', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 4788 (recebido em 05/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a9fcfd03-b545-5de5-8087-39aa319b4994', '635a53dd-80b4-5c2f-8708-2983469236e8', 78.75, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a9fcfd03-b545-5de5-8087-39aa319b4994');

-- NF 9199 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4460
DELETE FROM glosas WHERE id_glosa IN ('051b2ea6-3550-4443-b266-4a85c8d343a8');
DELETE FROM recebimentos WHERE id_receb IN ('6f7991e0-d79a-412c-a755-facaff951fbe');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4590ad4d-0ed7-542a-9fe1-888952f33f94', DATE '2026-02-09', DATE '2026-09-02', 5778.45, 5778.45, 'recebido', 'Baixa do apLIS — lote(s) 4460 (recebido em 02/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4590ad4d-0ed7-542a-9fe1-888952f33f94');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4916
DELETE FROM glosas WHERE id_glosa IN ('b960d5f1-b860-475f-ad34-ac646ff3cdf2');
DELETE FROM recebimentos WHERE id_receb IN ('8b56999e-cd86-49bb-b1e7-9428afaf191d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', DATE '2026-03-06', DATE '2025-12-15', 61.54, 61.54, 'recebido', 'Baixa do apLIS — lote(s) 4916 (recebido em 15/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', DATE '2026-03-06', DATE '2026-01-14', 61.24, 61.24, 'recebido', 'Baixa do apLIS — lote(s) 4916 (recebido em 14/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', DATE '2026-03-06', DATE '2026-01-19', 88.24, 88.24, 'recebido', 'Baixa do apLIS — lote(s) 4916 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fd4dbf96-a453-559e-b69c-4deb8454fe1f', DATE '2026-03-06', DATE '2026-10-08', 211.32, 211.32, 'recebido', 'Baixa do apLIS — lote(s) 4916 (recebido em 08/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('fd4dbf96-a453-559e-b69c-4deb8454fe1f');

-- sem número | AMHP-DF | lote(s) 4841
DELETE FROM glosas WHERE id_glosa IN ('1f51a632-5f95-4b0a-9f80-e56a244eb24a');
DELETE FROM recebimentos WHERE id_receb IN ('f94057cd-4cda-4145-8fc4-9314adcc6881');
UPDATE lotes SET valor_total = 1349.92 WHERE id_lote = '30acfa93-3cfa-59d5-b801-d9e1a224f61b';
UPDATE notas SET valor_total = 1349.92 WHERE id_nota = '33d42e95-33ab-5025-95e7-cccd74994d3b';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('33d42e95-33ab-5025-95e7-cccd74994d3b', DATE '2026-03-15', DATE '2026-09-12', 321.15, 321.15, 'recebido', 'Baixa do apLIS — lote(s) 4841 (recebido em 12/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('33d42e95-33ab-5025-95e7-cccd74994d3b');

-- sem número | ASSEFAZ | lote(s) 4825
DELETE FROM glosas WHERE id_glosa IN ('198c4cf6-1b1f-444f-abe5-2b00a73c4639');
DELETE FROM recebimentos WHERE id_receb IN ('cbb54c13-d0d2-46c7-8e02-4b8918f25360');
UPDATE lotes SET valor_total = 4726.83 WHERE id_lote = '97dc0660-5827-5d0b-b3b0-dc16fb5943b0';
UPDATE notas SET valor_total = 4726.83 WHERE id_nota = '1de82c58-a58b-5ee2-aafd-ab4583d485db';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', DATE '2026-02-20', DATE '2025-11-29', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 4825 (recebido em 29/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', DATE '2026-02-20', DATE '2025-12-08', 1520.79, 1520.79, 'recebido', 'Baixa do apLIS — lote(s) 4825 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', DATE '2026-02-20', DATE '2025-12-11', 361.35, 361.35, 'recebido', 'Baixa do apLIS — lote(s) 4825 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', DATE '2026-02-20', DATE '2026-01-07', 1724.56, 1724.56, 'recebido', 'Baixa do apLIS — lote(s) 4825 (recebido em 07/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1de82c58-a58b-5ee2-aafd-ab4583d485db', DATE '2026-02-20', DATE '2026-09-12', 688.99, 688.99, 'recebido', 'Baixa do apLIS — lote(s) 4825 (recebido em 12/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1de82c58-a58b-5ee2-aafd-ab4583d485db');

-- NF 8956 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4917
DELETE FROM glosas WHERE id_glosa IN ('b03b32cd-9f49-4d83-9325-0c09fca1e910');
DELETE FROM recebimentos WHERE id_receb IN ('02df2dc5-7829-417c-9f74-0e602fe49335');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef', DATE '2026-03-06', DATE '2026-08-04', 13699.69, 13699.69, 'recebido', 'Baixa do apLIS — lote(s) 4917 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3bc33148-bc76-5f2a-94cb-4f2700aac1ef');

-- sem número | AMHP-DF | lote(s) 4849
DELETE FROM recebimentos WHERE id_receb IN ('2ea47f81-dfc9-4989-9640-660b119661d5');
UPDATE lotes SET valor_total = 936.82 WHERE id_lote = 'd4a2654e-1c35-507a-876c-3e5abb5d1be9';
UPDATE notas SET valor_total = 936.82 WHERE id_nota = 'aa2bec02-6a65-5585-abe4-1c2ef029f03f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa2bec02-6a65-5585-abe4-1c2ef029f03f', DATE '2026-03-16', DATE '2026-04-02', 936.82, 936.82, 'recebido', 'Baixa do apLIS — lote(s) 4849 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('aa2bec02-6a65-5585-abe4-1c2ef029f03f');

-- NF 9200 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4671
DELETE FROM glosas WHERE id_glosa IN ('596f36f2-926d-422c-b238-d2c876627aa9');
DELETE FROM recebimentos WHERE id_receb IN ('20162ea0-e140-4a61-8006-cb724b612811');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86344a95-3405-5b15-917e-1f03cfd8bea9', DATE '2026-02-09', DATE '2026-09-02', 2131.15, 2131.15, 'recebido', 'Baixa do apLIS — lote(s) 4671 (recebido em 02/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('86344a95-3405-5b15-917e-1f03cfd8bea9');

-- sem número | LAB PLANASSISTE | lote(s) 4833
DELETE FROM recebimentos WHERE id_receb IN ('e068909e-545b-4125-83a6-f2f5f4234b3f');
UPDATE lotes SET valor_total = 24848.87 WHERE id_lote = 'e40d69c2-12ad-5f6c-abe2-c41402552b1e';
UPDATE notas SET valor_total = 24848.87 WHERE id_nota = '8673faf4-024d-5f4e-ab54-8111e4869eca';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8673faf4-024d-5f4e-ab54-8111e4869eca', DATE '2026-03-14', DATE '2026-04-02', 24848.87, 24848.87, 'recebido', 'Baixa do apLIS — lote(s) 4833 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8673faf4-024d-5f4e-ab54-8111e4869eca');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4920
DELETE FROM glosas WHERE id_glosa IN ('79211be3-9ef2-4036-a0ab-b204642907be');
DELETE FROM recebimentos WHERE id_receb IN ('595c201c-c635-4312-bd7b-ad0deea94517');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2025-12-18', 480.93, 480.93, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-01-06', 29.84, 29.84, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 06/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-01-07', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 07/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-01-08', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 08/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-01-27', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 27/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-01-28', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 28/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', DATE '2026-03-06', DATE '2026-10-08', 294.02, 294.02, 'recebido', 'Baixa do apLIS — lote(s) 4920 (recebido em 08/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1', '5695ff1a-3f7f-5ca3-871b-a23f80cd4c49', 149.78, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('06b224f6-b631-51b2-bf8a-8a1a0c84bca1');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4919
DELETE FROM glosas WHERE id_glosa IN ('1a083aa8-04b3-4aec-8322-fbefe368e61b');
DELETE FROM recebimentos WHERE id_receb IN ('4c07b0c8-67ca-4366-a4d7-4f6b7056115f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-15', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-16', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-20', 127.05, 127.05, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 20/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-21', 3457.15, 3457.15, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-22', 4193.90, 4193.90, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 22/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-01-23', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 23/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef7a8f21-5192-521d-95df-97633a8e5ed4', DATE '2026-03-06', DATE '2026-03-31', 2851.03, 2851.03, 'recebido', 'Baixa do apLIS — lote(s) 4919 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ef7a8f21-5192-521d-95df-97633a8e5ed4');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4800
DELETE FROM glosas WHERE id_glosa IN ('6bbe3fc3-41dd-4b3c-8ba2-d7a62d872fe1');
SELECT fat_recalcular_nota('5a446282-f098-5509-bfdf-d7cab5c67767');

-- sem número | TJDFT | lote(s) 4838
DELETE FROM glosas WHERE id_glosa IN ('b67bd7b5-0485-4f86-a86d-b894e5aeea01');
DELETE FROM recebimentos WHERE id_receb IN ('e5bf0b50-793e-42a2-b1b1-67337db18ac7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', DATE '2026-02-13', DATE '2026-04-16', 16507.78, 16507.78, 'recebido', 'Baixa do apLIS — lote(s) 4838 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('19677dbb-0df7-5eaa-89ef-86da9329e878', 'fcfed428-5f17-5532-b5af-07393dec4058', 36.00, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('19677dbb-0df7-5eaa-89ef-86da9329e878');

-- sem número | TJDFT | lote(s) 4844
DELETE FROM glosas WHERE id_glosa IN ('8e7e1b92-a6cf-4e2f-86bc-1685b2a759c8');
DELETE FROM recebimentos WHERE id_receb IN ('73d837bd-ec6c-4ee1-b03c-b34009e74069');
UPDATE lotes SET valor_total = 3704.18 WHERE id_lote = '40e463eb-626f-538f-90da-66542e2b8729';
UPDATE notas SET valor_total = 3704.18 WHERE id_nota = 'be14f0a7-343e-5af1-be37-386e44839d3a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('be14f0a7-343e-5af1-be37-386e44839d3a', DATE '2026-02-13', DATE '2026-04-16', 3704.18, 3704.18, 'recebido', 'Baixa do apLIS — lote(s) 4844 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('be14f0a7-343e-5af1-be37-386e44839d3a');

-- sem número | AMHP-DF | lote(s) 4856
DELETE FROM recebimentos WHERE id_receb IN ('ca26269e-265b-4d01-ae73-a8a3e0a062d0');
UPDATE lotes SET valor_total = 1676.27 WHERE id_lote = 'b00ceea8-f1a0-560f-8926-3600a371b25c';
UPDATE notas SET valor_total = 1676.27 WHERE id_nota = '6d3c826a-d57b-5dbf-ae20-408da19550c1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d3c826a-d57b-5dbf-ae20-408da19550c1', DATE '2026-03-27', DATE '2026-04-02', 1676.27, 1676.27, 'recebido', 'Baixa do apLIS — lote(s) 4856 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6d3c826a-d57b-5dbf-ae20-408da19550c1');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4732
DELETE FROM glosas WHERE id_glosa IN ('f51393d3-8b58-4edc-b94a-c50c3c0c6a88');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0e98823a-0afe-59ed-8045-8e9151d7230b', 'f7c69ef2-4afe-5439-999c-0ef92ef52da0', 13644.31, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0e98823a-0afe-59ed-8045-8e9151d7230b');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4909
DELETE FROM glosas WHERE id_glosa IN ('4663e9a6-3870-4d6b-9145-710dd3315fe7');
DELETE FROM recebimentos WHERE id_receb IN ('808769cd-b402-4770-8035-682f461af196');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', DATE '2026-03-30', DATE '2026-01-15', 852.74, 852.74, 'recebido', 'Baixa do apLIS — lote(s) 4909 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b408b580-4c0f-5429-a08f-e40eb880593a', DATE '2026-03-30', DATE '2026-03-05', 2857.55, 2857.55, 'recebido', 'Baixa do apLIS — lote(s) 4909 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b408b580-4c0f-5429-a08f-e40eb880593a');

-- sem número | STF | lote(s) 4806
DELETE FROM recebimentos WHERE id_receb IN ('6a43e18e-54bd-457e-9af1-48f849996b2d');
UPDATE lotes SET valor_total = 9505.13 WHERE id_lote = '9f3af33f-3bd5-5c31-95a6-7a5a1135600e';
UPDATE notas SET valor_total = 9505.13 WHERE id_nota = 'd4cf35d7-80f6-5ef5-9197-201a69c3072f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d4cf35d7-80f6-5ef5-9197-201a69c3072f', DATE '2026-02-24', DATE '2026-03-26', 9505.13, 9505.13, 'recebido', 'Baixa do apLIS — lote(s) 4806 (recebido em 26/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d4cf35d7-80f6-5ef5-9197-201a69c3072f');

-- sem número | AMHP-DF | lote(s) 4853
DELETE FROM glosas WHERE id_glosa IN ('ad07df74-fa35-44d8-a059-c7037acf065a');
DELETE FROM recebimentos WHERE id_receb IN ('dd094529-4447-49ee-8926-b8669adc0d71');
UPDATE lotes SET valor_total = 119.78 WHERE id_lote = 'f68c3382-9e4f-52e2-96dd-8efc4a499d45';
UPDATE notas SET valor_total = 119.78 WHERE id_nota = 'c5d09d8c-c2bd-502a-868e-a72adfa81343';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c5d09d8c-c2bd-502a-868e-a72adfa81343', DATE '2026-03-17', DATE '2026-04-08', 119.78, 119.78, 'recebido', 'Baixa do apLIS — lote(s) 4853 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c5d09d8c-c2bd-502a-868e-a72adfa81343');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4911
DELETE FROM glosas WHERE id_glosa IN ('1f2a6e3f-bba8-4999-b359-950395a63ad0');
DELETE FROM recebimentos WHERE id_receb IN ('c96847de-2d02-49da-a432-869d68fda58f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', DATE '2026-03-30', DATE '2026-01-21', 635.12, 635.12, 'recebido', 'Baixa do apLIS — lote(s) 4911 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2a0bbd41-ac55-547d-af15-c256b0cfa99e', DATE '2026-03-30', DATE '2026-03-16', 27368.58, 27368.58, 'recebido', 'Baixa do apLIS — lote(s) 4911 (recebido em 16/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2a0bbd41-ac55-547d-af15-c256b0cfa99e');

-- sem número | AMHP-DF | lote(s) 4855
DELETE FROM glosas WHERE id_glosa IN ('c9482971-0b03-4c52-9ebf-edd329881ee1');
DELETE FROM recebimentos WHERE id_receb IN ('22f8a442-1969-4dc3-925f-d10a2aee22a2');
UPDATE lotes SET valor_total = 2121.50 WHERE id_lote = 'd92bacb5-0315-55e0-9a29-9bc69f6ddc31';
UPDATE notas SET valor_total = 2121.50 WHERE id_nota = '86a82593-991e-5034-881e-1e1ad7eb5503';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', DATE '2026-03-17', DATE '2025-12-31', 147.90, 147.90, 'recebido', 'Baixa do apLIS — lote(s) 4855 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', DATE '2026-03-17', DATE '2026-03-09', 73.95, 73.95, 'recebido', 'Baixa do apLIS — lote(s) 4855 (recebido em 09/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86a82593-991e-5034-881e-1e1ad7eb5503', DATE '2026-03-17', DATE '2026-04-08', 1899.65, 1899.65, 'recebido', 'Baixa do apLIS — lote(s) 4855 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('86a82593-991e-5034-881e-1e1ad7eb5503');

-- sem número | STJ | lote(s) 4870
DELETE FROM glosas WHERE id_glosa IN ('fdf87a62-6672-41c6-8243-2297ee979e0c');
DELETE FROM recebimentos WHERE id_receb IN ('7ad14262-591e-48a5-9770-ee615281bdb2');
UPDATE lotes SET valor_total = 9921.68 WHERE id_lote = '221ec1b5-b3b9-5d46-9a72-e17368cb05c4';
UPDATE notas SET valor_total = 9921.68 WHERE id_nota = '565b3271-fb3c-58a3-9a72-bc4e037b531a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('565b3271-fb3c-58a3-9a72-bc4e037b531a', DATE '2026-02-13', DATE '2026-03-20', 9921.68, 9921.68, 'recebido', 'Baixa do apLIS — lote(s) 4870 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('565b3271-fb3c-58a3-9a72-bc4e037b531a');

-- sem número | AMHP-DF | lote(s) 4852
DELETE FROM recebimentos WHERE id_receb IN ('7399c4ed-75ee-4495-872b-811f2b735cec');
UPDATE lotes SET valor_total = 635.00 WHERE id_lote = '617865b3-6148-5025-886f-1c62063d4c3d';
UPDATE notas SET valor_total = 635.00 WHERE id_nota = '4b6f812e-49a9-5d0f-a722-b24aec020377';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4b6f812e-49a9-5d0f-a722-b24aec020377', DATE '2026-02-15', DATE '2026-04-02', 48.10, 48.10, 'recebido', 'Baixa do apLIS — lote(s) 4852 (sem data de recebimento no apLIS; data da planilha)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4b6f812e-49a9-5d0f-a722-b24aec020377');

-- sem número | CASSI | lote(s) 4811
DELETE FROM glosas WHERE id_glosa IN ('db4351a6-5609-49a6-889f-e8cc472b2503');
DELETE FROM recebimentos WHERE id_receb IN ('cad68cae-be8a-44bf-9598-e08d3d21b010');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2', DATE '2026-02-04', DATE '2026-02-03', 24133.02, 24133.02, 'recebido', 'Baixa do apLIS — lote(s) 4811 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cf57d98e-6d0f-5b75-aa00-5f6391b469b2');

-- sem número | CASSI | lote(s) 4812
DELETE FROM glosas WHERE id_glosa IN ('b5a393e6-b26b-43fb-9400-73aea00befcd');
DELETE FROM recebimentos WHERE id_receb IN ('ee411468-1c7f-48d7-96a7-8dd7be20de7b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3741e0d5-5976-596a-8ff8-72126795624e', DATE '2026-02-04', DATE '2026-02-03', 21482.18, 21482.18, 'recebido', 'Baixa do apLIS — lote(s) 4812 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3741e0d5-5976-596a-8ff8-72126795624e');

-- sem número | CASSI | lote(s) 4813
DELETE FROM glosas WHERE id_glosa IN ('4a38e2cf-57de-4bf5-b613-81fcc11f1f61', '048aecd9-b531-4a55-9e7a-2e2ea584b617');
DELETE FROM recebimentos WHERE id_receb IN ('21aa1fd6-a74f-4359-9290-167afb4d15b4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', DATE '2026-02-04', DATE '2026-02-03', 20852.47, 20852.47, 'recebido', 'Baixa do apLIS — lote(s) 4813 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221', DATE '2026-02-04', DATE '2026-04-08', 1925.78, 1925.78, 'recebido', 'Baixa do apLIS — lote(s) 4813 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221');

-- sem número | AMHP-DF | lote(s) 4846
DELETE FROM glosas WHERE id_glosa IN ('085da7b7-7174-44eb-bd39-643f313a8fca');
DELETE FROM recebimentos WHERE id_receb IN ('698e52ef-8d20-4c85-85b8-f7423ba13894');
UPDATE lotes SET valor_total = 262.92 WHERE id_lote = '3a151fff-4711-577c-8849-ce67249f4f57';
UPDATE notas SET valor_total = 262.92 WHERE id_nota = 'f2bbe3e9-b782-5537-a04e-516a80dbd874';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f2bbe3e9-b782-5537-a04e-516a80dbd874', DATE '2026-03-16', DATE '2026-04-08', 262.92, 262.92, 'recebido', 'Baixa do apLIS — lote(s) 4846 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f2bbe3e9-b782-5537-a04e-516a80dbd874');

-- sem número | AMHP-DF | lote(s) 4848
DELETE FROM glosas WHERE id_glosa IN ('b54beaf7-0b41-450c-9cdd-33c1601554fd');
DELETE FROM recebimentos WHERE id_receb IN ('351bd47c-7d50-4b15-8d3d-711874349f65');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4f60dab8-58e0-51db-a846-2b1278d4b5cc', DATE '2026-03-16', DATE '2026-04-02', 57.90, 57.90, 'recebido', 'Baixa do apLIS — lote(s) 4848 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4f60dab8-58e0-51db-a846-2b1278d4b5cc');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4736
DELETE FROM glosas WHERE id_glosa IN ('e595bc5a-efa4-44b6-a7c4-73265ecdf78f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a2be36df-3482-5202-bb9a-d69a7db29870', DATE '2026-03-13', DATE '2026-09-30', 4297.14, 4297.14, 'recebido', 'Baixa do apLIS — lote(s) 4736 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a2be36df-3482-5202-bb9a-d69a7db29870');

-- sem número | AMHP-DF | lote(s) 4763
DELETE FROM recebimentos WHERE id_receb IN ('d774b28e-8745-4ebb-934c-ce4f81da482a');
UPDATE lotes SET valor_total = 10809.43 WHERE id_lote = 'a28c07af-0a8b-55da-b278-4ceb64e8600a';
UPDATE notas SET valor_total = 10809.43 WHERE id_nota = 'c06e96c3-9f15-58dc-97f5-808a582dbaeb';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c06e96c3-9f15-58dc-97f5-808a582dbaeb', DATE '2026-03-16', DATE '2026-03-09', 231.26, 231.26, 'recebido', 'Baixa do apLIS — lote(s) 4763 (recebido em 09/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c06e96c3-9f15-58dc-97f5-808a582dbaeb', DATE '2026-03-16', DATE '2026-04-02', 10578.17, 10578.17, 'recebido', 'Baixa do apLIS — lote(s) 4763 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c06e96c3-9f15-58dc-97f5-808a582dbaeb');

-- sem número | CASSI | lote(s) 4815
DELETE FROM glosas WHERE id_glosa IN ('d7a4acc4-80f1-4e42-9b77-2456bf70afbc');
DELETE FROM recebimentos WHERE id_receb IN ('9a4eeaed-9ad3-4270-ba81-3b0b800adeda');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', DATE '2026-02-04', DATE '2026-02-03', 28449.61, 28449.61, 'recebido', 'Baixa do apLIS — lote(s) 4815 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4378f26b-e782-59fc-b622-a5167a1334da', '64f53310-2102-5930-9d3a-545089b4e99f', 1367.22, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4378f26b-e782-59fc-b622-a5167a1334da');

-- sem número | STJ | lote(s) 4869
DELETE FROM glosas WHERE id_glosa IN ('ef3bd78b-e45c-4ad8-838c-957762303414');
DELETE FROM recebimentos WHERE id_receb IN ('f063c8ba-d9e5-4dd7-8ba0-85e18a5fc698');
UPDATE lotes SET valor_total = 25671.51 WHERE id_lote = '8400db37-4d87-5f28-b866-97c44dc119d4';
UPDATE notas SET valor_total = 25671.51 WHERE id_nota = '328f847a-228b-550e-8353-44328642b564';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('328f847a-228b-550e-8353-44328642b564', DATE '2026-02-13', DATE '2026-05-21', 25671.51, 25671.51, 'recebido', 'Baixa do apLIS — lote(s) 4869 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('328f847a-228b-550e-8353-44328642b564');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4799
DELETE FROM glosas WHERE id_glosa IN ('0bf79a57-20ce-4d24-9ae9-acdea27c1c25');
SELECT fat_recalcular_nota('759a4004-1539-5d72-bc2d-11f0202e31fd');

-- sem número | CASSI | lote(s) 4816
DELETE FROM glosas WHERE id_glosa IN ('f7cefb5f-a304-436f-a89f-1c146f7c5dd2');
DELETE FROM recebimentos WHERE id_receb IN ('32d14cbf-1c49-44ac-880a-a4aadae3d32d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', DATE '2026-02-04', DATE '2026-02-03', 12469.39, 12469.39, 'recebido', 'Baixa do apLIS — lote(s) 4816 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d', '2ba90b4e-1c75-54d5-b08e-8267116200ef', 0.13, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d');

-- sem número | TRT | lote(s) 4810
DELETE FROM glosas WHERE id_glosa IN ('adb1601a-f895-4221-8541-6e6f006ee671');
DELETE FROM recebimentos WHERE id_receb IN ('d950b604-9029-4562-8038-aea2d052f8dc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', DATE '2026-02-04', DATE '2026-03-23', 920.56, 920.56, 'recebido', 'Baixa do apLIS — lote(s) 4810 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', DATE '2026-02-04', DATE '2026-03-24', 1151.11, 1151.11, 'recebido', 'Baixa do apLIS — lote(s) 4810 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2bdf711f-a499-5abf-801e-689cedd14444', '782eb62b-7ec2-55a8-9f97-09cdae21f3e6', 920.56, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2bdf711f-a499-5abf-801e-689cedd14444');

-- sem número | INAS GDF | lote(s) 4822
DELETE FROM glosas WHERE id_glosa IN ('52eed9bf-5f3c-48ba-afaf-1be51cd8d671');
DELETE FROM recebimentos WHERE id_receb IN ('cee7d627-bc43-46d5-945a-d8940d7368ac');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', DATE '2026-02-06', DATE '2026-06-25', 5461.41, 5461.41, 'recebido', 'Baixa do apLIS — lote(s) 4822 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8d1ed233-7eb5-5822-922c-ff2236ed9e94', 'edd1167e-d9c1-534e-b352-612bb524b879', 2.51, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8d1ed233-7eb5-5822-922c-ff2236ed9e94');

-- sem número | CASSI | lote(s) 4863
DELETE FROM glosas WHERE id_glosa IN ('86ee0a6c-eb14-4566-8ac4-36a0cd636648');
DELETE FROM recebimentos WHERE id_receb IN ('e87312fe-9b90-4663-a33e-5d8da28646c8');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', DATE '2026-02-18', DATE '2026-03-03', 23557.32, 23557.32, 'recebido', 'Baixa do apLIS — lote(s) 4863 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', '7c9214c3-16fb-5ee2-8b93-83c2688f3e78', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('09ad475a-0cc5-551f-99f3-7969b0d4d936', '7c9214c3-16fb-5ee2-8b93-83c2688f3e78', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('09ad475a-0cc5-551f-99f3-7969b0d4d936');

-- sem número | AMHP-DF | lote(s) 4866
DELETE FROM recebimentos WHERE id_receb IN ('4cd067a4-530f-45ed-bc2a-8d7c5d9044b5');
UPDATE lotes SET valor_total = 20122.59 WHERE id_lote = '3a2f1f49-a57c-582f-b1fd-9af63b813697';
UPDATE notas SET valor_total = 20122.59 WHERE id_nota = 'd86becfd-005b-59c0-be8f-a62edfa65a95';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d86becfd-005b-59c0-be8f-a62edfa65a95', DATE '2026-03-23', DATE '2026-04-02', 19826.60, 19826.60, 'recebido', 'Baixa do apLIS — lote(s) 4866 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d86becfd-005b-59c0-be8f-a62edfa65a95', DATE '2026-03-23', DATE '2026-06-02', 295.99, 295.99, 'recebido', 'Baixa do apLIS — lote(s) 4866 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d86becfd-005b-59c0-be8f-a62edfa65a95');

-- sem número | TRT | lote(s) 4840
DELETE FROM glosas WHERE id_glosa IN ('1f9dbe26-e97f-439e-9e8e-a35fc0f419af');
DELETE FROM recebimentos WHERE id_receb IN ('6ad31bb6-a421-453c-b2da-222f839cae63');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', DATE '2026-02-15', DATE '2026-04-17', 3680.41, 3680.41, 'recebido', 'Baixa do apLIS — lote(s) 4840 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b9fd711b-83be-5517-92f7-6097db4a2e39', '3770f757-6195-5aca-bc3e-9ddaf5059156', 149.94, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b9fd711b-83be-5517-92f7-6097db4a2e39');

-- sem número | AMIL | lote(s) 4817
DELETE FROM glosas WHERE id_glosa IN ('4571f9ec-9cec-433e-9cc8-6dff5d0a99c9');
DELETE FROM recebimentos WHERE id_receb IN ('3ee00967-d12a-49c0-aba0-3d47d09f8561');
UPDATE lotes SET valor_total = 12305.01 WHERE id_lote = '837ab1fb-39f1-5892-8218-7724180c8114';
UPDATE notas SET valor_total = 12305.01 WHERE id_nota = 'd9da8233-2eaf-5c74-ab23-e727289d499a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-03', 817.43, 817.43, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 03/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-04', 285.35, 285.35, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 04/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-05', 2072.25, 2072.25, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 05/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-08', 1023.80, 1023.80, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-09', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-10', 440.35, 440.35, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-11', 411.90, 411.90, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-12', 1121.90, 1121.90, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 12/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-15', 405.53, 405.53, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 15/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-16', 155.00, 155.00, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-17', 1303.90, 1303.90, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-23', 1148.90, 1148.90, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 23/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-26', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 26/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2025-12-30', 793.90, 793.90, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 30/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2026-01-02', 610.45, 610.45, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 02/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d9da8233-2eaf-5c74-ab23-e727289d499a', DATE '2026-02-06', DATE '2026-01-06', 1147.45, 1147.45, 'recebido', 'Baixa do apLIS — lote(s) 4817 (recebido em 06/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d9da8233-2eaf-5c74-ab23-e727289d499a');

-- sem número | INAS GDF | lote(s) 4824
DELETE FROM glosas WHERE id_glosa IN ('acb9dc4f-6679-41fd-b49a-eec8b68e8133');
DELETE FROM recebimentos WHERE id_receb IN ('7504ce23-557c-4fe7-960f-c2fd04491ad6');
UPDATE lotes SET valor_total = 3990.83 WHERE id_lote = 'c320ff15-c2a2-5951-ae37-3103c9b250de';
UPDATE notas SET valor_total = 3990.83 WHERE id_nota = '4bfcd361-71b3-54ed-8027-1e500f0a3928';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', DATE '2026-02-06', DATE '2026-06-25', 3203.81, 3203.81, 'recebido', 'Baixa do apLIS — lote(s) 4824 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', DATE '2026-02-06', DATE '2026-07-10', 775.27, 775.27, 'recebido', 'Baixa do apLIS — lote(s) 4824 (recebido em 10/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4bfcd361-71b3-54ed-8027-1e500f0a3928', 'c320ff15-c2a2-5951-ae37-3103c9b250de', 11.36, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4bfcd361-71b3-54ed-8027-1e500f0a3928');

-- sem número | INAS GDF | lote(s) 4859
DELETE FROM glosas WHERE id_glosa IN ('18c5ff0a-31af-4c2c-81d2-941599982a74');
DELETE FROM recebimentos WHERE id_receb IN ('4a5e5d9f-67db-4766-b416-5b0487047531');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', DATE '2026-02-20', DATE '2026-06-25', 4181.65, 4181.65, 'recebido', 'Baixa do apLIS — lote(s) 4859 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c6076cab-ddd1-507f-80fe-baaef6f350f5', 'af2e7561-5e90-573a-bacb-bc053f223f44', 51.50, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c6076cab-ddd1-507f-80fe-baaef6f350f5');

-- sem número | CBMDF | lote(s) 4929
DELETE FROM recebimentos WHERE id_receb IN ('1eeeaea8-1c96-434a-991a-f4bcadbcc46c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('37b1a88e-ea4f-55a5-9146-65e9c29eda01', DATE '2026-03-01', DATE '2026-03-30', 695.61, 695.61, 'recebido', 'Baixa do apLIS — lote(s) 4929 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('37b1a88e-ea4f-55a5-9146-65e9c29eda01');

-- sem número | CÂMARA DOS DEPUTADOS | lote(s) 4899
DELETE FROM glosas WHERE id_glosa IN ('3d09a21a-5aea-45ef-8260-6470c165d022');
DELETE FROM recebimentos WHERE id_receb IN ('da7ad624-7600-4ff6-8aae-bcc82bfc7224');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', DATE '2026-03-29', DATE '2026-03-24', 17060.87, 17060.87, 'recebido', 'Baixa do apLIS — lote(s) 4899 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014', 'f7287a76-332f-51ba-ad7d-801a7a2e964b', 0.43, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('04d1d4c5-83ee-5215-8ef9-65a33b1a9014');

-- sem número | INAS GDF | lote(s) 4823
DELETE FROM recebimentos WHERE id_receb IN ('abf715cf-de1d-4bfe-b0de-11f7b07e87a9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('87c2e465-5df6-53cf-a8f6-f8d3ca426920', DATE '2026-02-20', DATE '2026-06-25', 21546.50, 21546.50, 'recebido', 'Baixa do apLIS — lote(s) 4823 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('87c2e465-5df6-53cf-a8f6-f8d3ca426920');

-- sem número | AMHP-DF | lote(s) 4843
DELETE FROM recebimentos WHERE id_receb IN ('2afa6078-4ba5-474e-90a4-04bceb6a7170');
UPDATE lotes SET valor_total = 17912.03 WHERE id_lote = 'bb48c5b4-a90d-5007-96cb-e641e46ce7cc';
UPDATE notas SET valor_total = 17912.03 WHERE id_nota = '562aeafa-ef81-59cd-b806-4b760c56cc61';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('562aeafa-ef81-59cd-b806-4b760c56cc61', DATE '2026-03-15', DATE '2026-04-02', 17912.03, 17912.03, 'recebido', 'Baixa do apLIS — lote(s) 4843 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('562aeafa-ef81-59cd-b806-4b760c56cc61');

-- sem número | INAS GDF | lote(s) 4922
DELETE FROM glosas WHERE id_glosa IN ('5b9d9288-040a-46e7-910c-a84f553c3df2');
DELETE FROM recebimentos WHERE id_receb IN ('b6edd2b4-e11f-4753-9ee9-26aac4a89845');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', DATE '2026-03-01', DATE '2026-06-25', 19117.52, 19117.52, 'recebido', 'Baixa do apLIS — lote(s) 4922 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6a1ec375-302f-5e38-ba7f-54758552624e', '0f70679c-9fa0-5c40-9c77-355dd67776ec', 33.33, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6a1ec375-302f-5e38-ba7f-54758552624e');

-- sem número | E-VIDA | lote(s) 4821
DELETE FROM glosas WHERE id_glosa IN ('55c83b42-c38d-4e4d-bded-bfdb015a42de');
DELETE FROM recebimentos WHERE id_receb IN ('76eab810-6314-4b66-a91f-c61c04f5bfde');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-01', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 01/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-02', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 02/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-04', 687.04, 687.04, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 04/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-05', 450.26, 450.26, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 05/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-10', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-11', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-17', 638.67, 638.67, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2025-12-18', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', DATE '2026-02-11', DATE '2026-01-07', 556.92, 556.92, 'recebido', 'Baixa do apLIS — lote(s) 4821 (recebido em 07/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', 'd9f146c9-b540-5b92-b2a4-c3f4f061c94b', 48.37, 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', '1006', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('952cb4c4-68ac-56f1-b053-9e341eab5c12', 'd9f146c9-b540-5b92-b2a4-c3f4f061c94b', 7.30, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('952cb4c4-68ac-56f1-b053-9e341eab5c12');

-- sem número | AMIL | lote(s) 4818
DELETE FROM glosas WHERE id_glosa IN ('e46f715e-ea6f-4e5a-a02a-a42077b6eef0');
DELETE FROM recebimentos WHERE id_receb IN ('fa780c08-3a2d-4da3-98eb-965615830217');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-11-26', 120.00, 120.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 26/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-03', 80.00, 80.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 03/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-05', 120.00, 120.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 05/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-10', 56.90, 56.90, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 10/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-16', 240.00, 240.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-17', 169.04, 169.04, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-23', 480.00, 480.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 23/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2025-12-24', 60.00, 60.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 24/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('147a5a72-75a2-5b68-b26b-04218f4c69f1', DATE '2026-02-06', DATE '2026-01-06', 1296.00, 1296.00, 'recebido', 'Baixa do apLIS — lote(s) 4818 (recebido em 06/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('147a5a72-75a2-5b68-b26b-04218f4c69f1');

-- sem número | FASCAL | lote(s) 4728
DELETE FROM glosas WHERE id_glosa IN ('2a270824-883b-4030-bf98-374bc9efe10e');
DELETE FROM recebimentos WHERE id_receb IN ('de5cebb9-91fd-4571-b540-3db771ad8b0b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-10-03', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 03/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-10-06', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 06/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-10-23', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 23/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-10-27', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 27/10/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-03', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 03/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-06', 445.93, 445.93, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 06/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-14', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 14/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-17', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 17/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-21', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 21/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-25', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 25/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-26', 1310.06, 1310.06, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 26/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-27', 2466.42, 2466.42, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 27/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-11-28', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 28/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-01', 1994.82, 1994.82, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 01/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-02', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 02/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-08', 50.19, 50.19, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-09', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-11', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 11/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-16', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-17', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-18', 230.55, 230.55, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 18/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-19', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 19/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-22', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 22/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-23', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 23/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-24', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 24/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a263432-9246-57a7-b833-22692f550517', DATE '2026-01-30', DATE '2025-12-29', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4728 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0a263432-9246-57a7-b833-22692f550517', 'b1e5cdaf-05f1-5a23-a480-cebd088e5c25', 3011.66, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0a263432-9246-57a7-b833-22692f550517');

-- sem número | FASCAL | lote(s) 4729
DELETE FROM glosas WHERE id_glosa IN ('2de718dc-bc73-468c-99c8-2436c02813c2');
UPDATE lotes SET valor_total = 5248.26 WHERE id_lote = 'dadaafd6-e963-5a5f-a9fa-9a72692241d2';
UPDATE notas SET valor_total = 5248.26 WHERE id_nota = '6d677709-d5c6-56d9-8e99-d80bae8a102f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d677709-d5c6-56d9-8e99-d80bae8a102f', DATE '2026-01-30', DATE '2026-10-01', 5248.26, 5248.26, 'recebido', 'Baixa do apLIS — lote(s) 4729 (recebido em 01/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6d677709-d5c6-56d9-8e99-d80bae8a102f');

-- sem número | AMHP-DF | lote(s) 4845
DELETE FROM recebimentos WHERE id_receb IN ('5ee86b28-6e3a-420f-b47e-c93bcd498950');
UPDATE lotes SET valor_total = 220.98 WHERE id_lote = 'ad376600-44dc-557e-b910-02b7d70a52ad';
UPDATE notas SET valor_total = 220.98 WHERE id_nota = '253c5e5e-55a4-5e43-a960-4b9860d85acb';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('253c5e5e-55a4-5e43-a960-4b9860d85acb', DATE '2026-03-16', DATE '2026-04-02', 220.98, 220.98, 'recebido', 'Baixa do apLIS — lote(s) 4845 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('253c5e5e-55a4-5e43-a960-4b9860d85acb');

-- sem número | TRT | lote(s) 4938
DELETE FROM glosas WHERE id_glosa IN ('71d608df-579f-4d8f-a63d-d342dcdbb367');
DELETE FROM recebimentos WHERE id_receb IN ('253257eb-fbf3-4289-b842-3343d13d299e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', DATE '2026-03-04', DATE '2026-04-01', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4938 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('476bd9f8-a53b-51cb-9617-9a67d96254af', 'c390081e-7c83-5d52-bdae-dcbf34eb6fe4', 338.94, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('476bd9f8-a53b-51cb-9617-9a67d96254af');

-- sem número | AMHP-DF | lote(s) 5060
DELETE FROM recebimentos WHERE id_receb IN ('21eb97f8-7e54-4d96-8fee-2234c4a96e08');
UPDATE lotes SET valor_total = 22587.41 WHERE id_lote = 'ea5db88f-925f-5ff9-b632-41ae75d2d0b6';
UPDATE notas SET valor_total = 22587.41 WHERE id_nota = '1f15146a-6a05-54e4-ab21-a52e64665249';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1f15146a-6a05-54e4-ab21-a52e64665249', DATE '2026-04-26', DATE '2026-09-12', 13226.16, 13226.16, 'recebido', 'Baixa do apLIS — lote(s) 5060 (recebido em 12/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1f15146a-6a05-54e4-ab21-a52e64665249', 'ea5db88f-925f-5ff9-b632-41ae75d2d0b6', 172.19, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1f15146a-6a05-54e4-ab21-a52e64665249');

-- sem número | SAUDE CAIXA | lote(s) 5017
DELETE FROM glosas WHERE id_glosa IN ('92042009-bc9d-4409-a164-ec8648ea3e0b');
DELETE FROM recebimentos WHERE id_receb IN ('31f40930-8325-48e2-9781-27a80030293a');
UPDATE lotes SET valor_total = 32336.36 WHERE id_lote = '30dfa912-062c-5946-a154-727d21e2d61d';
UPDATE notas SET valor_total = 32336.36 WHERE id_nota = '20c9c6dd-b3c9-5fed-ac61-762eb24f1128';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128', DATE '2026-03-15', DATE '2026-04-17', 30299.68, 30299.68, 'recebido', 'Baixa do apLIS — lote(s) 5017 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('20c9c6dd-b3c9-5fed-ac61-762eb24f1128');

-- sem número | SAUDE CAIXA | lote(s) 5018
DELETE FROM glosas WHERE id_glosa IN ('cd32e790-89ed-4cc4-9758-d967a1cfe636');
DELETE FROM recebimentos WHERE id_receb IN ('1ea93578-7d96-4ebf-b855-1600cbbe515b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f7168950-3090-52d1-abd2-c6b848b2b546', DATE '2026-03-28', DATE '2026-04-17', 16389.54, 16389.54, 'recebido', 'Baixa do apLIS — lote(s) 5018 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f7168950-3090-52d1-abd2-c6b848b2b546');

-- sem número | AMHP-DF | lote(s) 5035
DELETE FROM recebimentos WHERE id_receb IN ('52fcdb9c-f7a1-44cb-80e7-c855d08a5cb2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f', DATE '2026-04-20', DATE '2026-04-02', 191.72, 191.72, 'recebido', 'Baixa do apLIS — lote(s) 5035 (sem data de recebimento no apLIS; data da planilha)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f', 'd87acd6e-947c-553f-8771-155671f229c5', 6.80, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9882dfeb-9574-596c-b32d-e1d1b8ffa32f');

-- NF 8033 | GEAP Autogestão em Saúde | lote(s) 4993
DELETE FROM glosas WHERE id_glosa IN ('f5dcf95f-77f6-45a9-a48f-24a343f9f75d');
DELETE FROM recebimentos WHERE id_receb IN ('55141639-b895-4312-b77c-0c669b185a43');
UPDATE lotes SET valor_total = 4553.32 WHERE id_lote = 'ae2d2bcb-0458-5df8-bedb-06b12393ecb1';
UPDATE notas SET valor_total = 4553.32 WHERE id_nota = 'e9384ecd-59d4-57c3-b12e-97f794ec6718';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', DATE '2026-05-11', DATE '2026-05-26', 3383.90, 3383.90, 'recebido', 'Baixa do apLIS — lote(s) 4993 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e9384ecd-59d4-57c3-b12e-97f794ec6718', 'ae2d2bcb-0458-5df8-bedb-06b12393ecb1', 1169.42, 'QUANTIDADE SOLICITADA ACIMA DA QUANTIDADE PERMITIDA', '1423', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e9384ecd-59d4-57c3-b12e-97f794ec6718');

-- NF 8026 | INAS GDF | lote(s) 5094
DELETE FROM glosas WHERE id_glosa IN ('218d0bd5-834d-4429-9bed-80898db7e7ac');
DELETE FROM recebimentos WHERE id_receb IN ('d255cdc1-48c1-4215-971d-d03f06ef7ab7');
UPDATE lotes SET valor_total = 23485.62 WHERE id_lote = '65fe2ddf-f62e-53be-b503-26bbcc7be533';
UPDATE notas SET valor_total = 23485.62 WHERE id_nota = '98dafcf9-6e6b-5745-bd16-3b868b47459a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('98dafcf9-6e6b-5745-bd16-3b868b47459a', DATE '2026-03-29', DATE '2026-06-25', 23485.62, 23485.62, 'recebido', 'Baixa do apLIS — lote(s) 5094 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('98dafcf9-6e6b-5745-bd16-3b868b47459a');

-- NF 7983 | PMDF | lote(s) 5056
DELETE FROM glosas WHERE id_glosa IN ('eebe14a3-6515-4495-a9cb-99c51c2efa8d');
DELETE FROM recebimentos WHERE id_receb IN ('42e3d726-85d3-47e1-bf2a-dd242d4af119');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', DATE '2026-03-27', DATE '2026-05-29', 22321.47, 22321.47, 'recebido', 'Baixa do apLIS — lote(s) 5056 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df23e177-fa20-5bbe-a77d-d096e6f890f2', 'c2dc520c-5c48-55f9-9eed-16f5c62100d3', 1203.45, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('df23e177-fa20-5bbe-a77d-d096e6f890f2');

-- NF 7983 | PMDF | lote(s) 5065
DELETE FROM glosas WHERE id_glosa IN ('e8280236-c591-4048-a9fe-eb1949201faa');
DELETE FROM recebimentos WHERE id_receb IN ('1c9e6644-16f4-4e79-a181-5670914f5c04');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', DATE '2026-03-27', DATE '2026-05-29', 16265.10, 16265.10, 'recebido', 'Baixa do apLIS — lote(s) 5065 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1e339098-595e-5427-b1ca-1e4df639c07d', '2db0f71b-c4e7-59b4-b261-c908803f9b56', 456.72, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1e339098-595e-5427-b1ca-1e4df639c07d');

-- sem número | CASSI | lote(s) 5013
DELETE FROM glosas WHERE id_glosa IN ('a5fb2af5-eed8-4be4-ab64-9ff4e89e11f4');
DELETE FROM recebimentos WHERE id_receb IN ('01e0eaf8-27e2-44f2-b0d6-e3d9a18c592e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', DATE '2026-03-14', DATE '2026-03-17', 3208.96, 3208.96, 'recebido', 'Baixa do apLIS — lote(s) 5013 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bbcf22b4-18b8-5498-850d-93769aa4ae01', 'fbb22928-cb6d-5f63-856c-c149e5295ac6', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('bbcf22b4-18b8-5498-850d-93769aa4ae01');

-- sem número | SAUDE CAIXA | lote(s) 5070
DELETE FROM glosas WHERE id_glosa IN ('94df8142-d0d1-4df5-a120-688f93167a87');
DELETE FROM recebimentos WHERE id_receb IN ('e247db6a-a466-43ce-a9e5-e2ca8c243b4c');
UPDATE lotes SET valor_total = 2993.46 WHERE id_lote = '502f9152-64a5-5d2a-99c6-46d098e76638';
UPDATE notas SET valor_total = 2993.46 WHERE id_nota = '1d6209f4-1bf9-53d4-9630-7911e1e8f996';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1d6209f4-1bf9-53d4-9630-7911e1e8f996', DATE '2026-03-27', DATE '2026-04-17', 2993.46, 2993.46, 'recebido', 'Baixa do apLIS — lote(s) 5070 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1d6209f4-1bf9-53d4-9630-7911e1e8f996');

-- sem número | SIS SENADO | lote(s) 5011
DELETE FROM glosas WHERE id_glosa IN ('88686063-a155-4e70-8912-c92f4838fc08');
SELECT fat_recalcular_nota('4f879f72-1631-5d29-a0a6-261d4981ae19');

-- NF 7983 | PMDF | lote(s) 5057
DELETE FROM glosas WHERE id_glosa IN ('69871b7b-c65c-4dc8-93ca-2c6ae15e09b4', '6e40d98b-5319-41fc-a8f1-2e3ea22dc9a1');
DELETE FROM recebimentos WHERE id_receb IN ('10c6eb32-1e8c-4429-84d9-7da52d891359');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', DATE '2026-03-27', DATE '2026-05-29', 25067.76, 25067.76, 'recebido', 'Baixa do apLIS — lote(s) 5057 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f33ded75-37cc-53df-a2be-c59db5e03931', '0a60490f-b373-5053-8af0-c49a4b93ba2b', 1025.45, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f33ded75-37cc-53df-a2be-c59db5e03931');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5003
DELETE FROM recebimentos WHERE id_receb IN ('45680f77-0021-4090-8c35-5b00ee5f33f1');
UPDATE lotes SET valor_total = 4802.68 WHERE id_lote = '87f343ae-3dee-521d-a7ae-71793a1dd056';
UPDATE notas SET valor_total = 4802.68 WHERE id_nota = 'f5c10c4a-bd01-5213-8bd8-ded2c2e938ba';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba', DATE '2026-04-27', DATE '2026-02-26', 4167.56, 4167.56, 'recebido', 'Baixa do apLIS — lote(s) 5003 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5074
DELETE FROM glosas WHERE id_glosa IN ('4a67ae83-5c8c-4141-8f15-d5a26fbb664c');
DELETE FROM recebimentos WHERE id_receb IN ('9bcf5aa9-6586-4f27-a216-27b9c1213cce');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', DATE '2026-04-27', DATE '2026-04-09', 25633.03, 25633.03, 'recebido', 'Baixa do apLIS — lote(s) 5074 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('57cec540-d9be-59f5-852b-b8093e0cf821', '6aac5e59-3daf-5d99-b0c1-5ce52966f7a3', 35.99, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('57cec540-d9be-59f5-852b-b8093e0cf821');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5077
DELETE FROM recebimentos WHERE id_receb IN ('023cc20d-58cb-4781-baa9-18dae87bc288');
UPDATE lotes SET valor_total = 26912.22 WHERE id_lote = '29dc04a5-41db-5c17-945e-a8cab27f2055';
UPDATE notas SET valor_total = 26912.22 WHERE id_nota = '802f7822-74b8-5e29-9709-b41608024ee8';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('802f7822-74b8-5e29-9709-b41608024ee8', DATE '2026-04-27', DATE '2026-04-09', 26912.22, 26912.22, 'recebido', 'Baixa do apLIS — lote(s) 5077 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('802f7822-74b8-5e29-9709-b41608024ee8');

-- sem número | SIS SENADO | lote(s) 5001
DELETE FROM glosas WHERE id_glosa IN ('1485b593-be0d-4fef-98da-594f95b3e190');
DELETE FROM recebimentos WHERE id_receb IN ('b9ef97e4-8191-4abf-a229-7215e870bfce');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', DATE '2026-04-13', DATE '2026-04-17', 2356.70, 2356.70, 'recebido', 'Baixa do apLIS — lote(s) 5001 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4b337678-278f-58ee-bad5-57d1466f09a2', '2e6c1b79-1329-507f-a7e3-9db61f5ee17c', 5.69, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4b337678-278f-58ee-bad5-57d1466f09a2');

-- sem número | AMHP-DF | lote(s) 5031
DELETE FROM recebimentos WHERE id_receb IN ('a8da7722-f983-462a-bfb1-26f07e03edcb');
UPDATE lotes SET valor_total = 2983.61 WHERE id_lote = '9460f2fe-32f3-52e6-b597-c0a4168aa0dc';
UPDATE notas SET valor_total = 2983.61 WHERE id_nota = '63d79cc8-c535-508c-a65b-3c597b8561b3';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('63d79cc8-c535-508c-a65b-3c597b8561b3', DATE '2026-04-19', DATE '2026-04-02', 3026.57, 3026.57, 'recebido', 'Baixa do apLIS — lote(s) 5031 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('63d79cc8-c535-508c-a65b-3c597b8561b3');

-- NF 7983 | PMDF | lote(s) 5066
DELETE FROM glosas WHERE id_glosa IN ('92260702-c9dd-4590-a349-72d7f9cead61');
DELETE FROM recebimentos WHERE id_receb IN ('87c94495-0746-4dc6-9ded-56feb7a89c9a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', DATE '2026-03-27', DATE '2026-07-29', 113.08, 113.08, 'recebido', 'Baixa do apLIS — lote(s) 5066 (recebido em 29/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d427187a-610f-52b3-ad83-ffb3da04c972', '93ba0015-bd4b-5beb-b8cd-0003370fed25', 9.48, 'ADMISSÃO APÓS O DESLIGAMENTO DO CREDENCIADO DA REDE', '1205', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d427187a-610f-52b3-ad83-ffb3da04c972');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5101
DELETE FROM glosas WHERE id_glosa IN ('a47a6a28-4590-4d43-8585-a1183f57f4e0');
DELETE FROM recebimentos WHERE id_receb IN ('73e4d5f5-648a-4862-a14b-ddf68c5b05a1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab', DATE '2026-04-27', DATE '2026-04-09', 8763.54, 8763.54, 'recebido', 'Baixa do apLIS — lote(s) 5101 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('167c2dd3-34d3-5fe5-82a2-d8736b9490ab');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4995
DELETE FROM glosas WHERE id_glosa IN ('1026f3e0-15bd-4670-90f2-0a232bad1fe7');
DELETE FROM recebimentos WHERE id_receb IN ('c9d3251c-9b70-410f-ab9e-84efcff93852');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', DATE '2026-04-11', DATE '2026-03-17', 23118.14, 23118.14, 'recebido', 'Baixa do apLIS — lote(s) 4995 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('802ba640-5e31-5cdc-a770-14f325306fbe', '0db0989b-3009-5e84-a865-61a371a87761', 94.50, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('802ba640-5e31-5cdc-a770-14f325306fbe');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5080
DELETE FROM glosas WHERE id_glosa IN ('1f784a44-f86a-47dd-9b0c-ec523490f8e9');
DELETE FROM recebimentos WHERE id_receb IN ('88e0a676-a8ae-4a78-a227-00930613e187');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d3ea0baa-b152-5b86-8186-9047843d55a2', DATE '2026-04-27', DATE '2026-04-09', 12705.13, 12705.13, 'recebido', 'Baixa do apLIS — lote(s) 5080 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d3ea0baa-b152-5b86-8186-9047843d55a2');

-- sem número | CASSI | lote(s) 4970
DELETE FROM glosas WHERE id_glosa IN ('b9d20eda-186a-4513-abb1-f6e5373f0f55');
DELETE FROM recebimentos WHERE id_receb IN ('d2565d3b-f60e-4e8b-b442-4102badd48a9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', DATE '2026-03-06', DATE '2026-03-03', 12227.47, 12227.47, 'recebido', 'Baixa do apLIS — lote(s) 4970 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', 'bb235355-2233-518f-bee1-46c979bfaed5', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663', 'bb235355-2233-518f-bee1-46c979bfaed5', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663');

-- sem número | AMIL | lote(s) 5014
DELETE FROM glosas WHERE id_glosa IN ('dfb3dea9-c5f5-4263-8d52-b0daa5afcdd1');
DELETE FROM recebimentos WHERE id_receb IN ('15c292f7-1ba4-43cc-9de8-753bc230e462');
UPDATE lotes SET valor_total = 7368.89 WHERE id_lote = 'cb79c29d-3004-5826-87bc-f2ae5fb9b7f9';
UPDATE notas SET valor_total = 7368.89 WHERE id_nota = '72cff773-d9d5-5949-bc48-37072abee748';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-01-15', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-01-16', 510.00, 510.00, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-03', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-04', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 04/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-05', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-06', 1200.88, 1200.88, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-09', 154.00, 154.00, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-10', 1093.45, 1093.45, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-11', 50.53, 50.53, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72cff773-d9d5-5949-bc48-37072abee748', DATE '2026-02-13', DATE '2026-02-12', 2214.33, 2214.33, 'recebido', 'Baixa do apLIS — lote(s) 5014 (recebido em 12/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('72cff773-d9d5-5949-bc48-37072abee748');

-- sem número | ASSEFAZ | lote(s) 4957
DELETE FROM recebimentos WHERE id_receb IN ('52f8a45e-8b95-4436-bd60-b409de4360a1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-09', 195.43, 195.43, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 09/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-13', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 13/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-14', 2542.83, 2542.83, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 14/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-15', 1331.76, 1331.76, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-17', 1293.42, 1293.42, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 17/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-19', 2743.93, 2743.93, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-20', 1048.31, 1048.31, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 20/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-21', 2780.33, 2780.33, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c7fba69f-8703-5271-950a-e26caf4ddf26', DATE '2026-03-20', DATE '2026-01-22', 2388.47, 2388.47, 'recebido', 'Baixa do apLIS — lote(s) 4957 (recebido em 22/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c7fba69f-8703-5271-950a-e26caf4ddf26');

-- NF 8026 | INAS GDF | lote(s) 4924
DELETE FROM glosas WHERE id_glosa IN ('034443be-c2ac-40e9-b0b3-1b972d775f18');
DELETE FROM recebimentos WHERE id_receb IN ('c4ad6d4d-c4a8-4b56-adc5-94a5b4a7cbcc');
UPDATE lotes SET valor_total = 5541.76 WHERE id_lote = 'd5395802-823b-556f-a87c-c54bd5349f37';
UPDATE notas SET valor_total = 5541.76 WHERE id_nota = 'c0f4a810-e515-500f-9fff-9b456cc65551';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c0f4a810-e515-500f-9fff-9b456cc65551', DATE '2026-03-29', DATE '2026-06-25', 5541.39, 5541.39, 'recebido', 'Baixa do apLIS — lote(s) 4924 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c0f4a810-e515-500f-9fff-9b456cc65551');

-- sem número | STJ | lote(s) 5030
DELETE FROM glosas WHERE id_glosa IN ('3408b47c-a49c-4833-b604-ba8922b0199d');
DELETE FROM recebimentos WHERE id_receb IN ('be8a8c20-0634-433a-985f-6763836506c3');
UPDATE lotes SET valor_total = 20447.01 WHERE id_lote = '662aa395-f3ae-590e-8ff1-2b9afac9eb4f';
UPDATE notas SET valor_total = 20447.01 WHERE id_nota = 'ed6f200c-daaa-5f78-92ee-63ebcf0da444';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ed6f200c-daaa-5f78-92ee-63ebcf0da444', DATE '2026-03-13', DATE '2026-04-30', 20447.01, 20447.01, 'recebido', 'Baixa do apLIS — lote(s) 5030 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ed6f200c-daaa-5f78-92ee-63ebcf0da444');

-- sem número | PMDF | lote(s) 5064
DELETE FROM glosas WHERE id_glosa IN ('cc464c6d-37c2-445d-8237-adca70ab4e3a');
DELETE FROM recebimentos WHERE id_receb IN ('54f92568-c51b-4c62-b88b-99c682954e4e');
UPDATE lotes SET valor_total = 3189.50 WHERE id_lote = '4d373f8b-2c91-5f7a-88ce-551cd499eff5';
UPDATE notas SET valor_total = 3189.50 WHERE id_nota = '5c17dc1d-32a9-5f83-a834-1d3225769ba5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', DATE '2026-03-26', DATE '2026-07-30', 2960.63, 2960.63, 'recebido', 'Baixa do apLIS — lote(s) 5064 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', '4d373f8b-2c91-5f7a-88ce-551cd499eff5', 164.77, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c17dc1d-32a9-5f83-a834-1d3225769ba5', '4d373f8b-2c91-5f7a-88ce-551cd499eff5', 64.10, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5c17dc1d-32a9-5f83-a834-1d3225769ba5');

-- sem número | STJ | lote(s) 4871
DELETE FROM glosas WHERE id_glosa IN ('dcd40b9a-573d-41c4-9f6c-052964c92b4e');
DELETE FROM recebimentos WHERE id_receb IN ('60120c6a-c10a-404c-b583-8dab6dfd59b4');
UPDATE lotes SET valor_total = 1420.10 WHERE id_lote = 'e02b98f9-3e15-55ad-89e2-ea9fd481f1d1';
UPDATE notas SET valor_total = 1420.10 WHERE id_nota = 'a8468ebb-31e8-5f9c-bc39-c752b483f3f8';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8', DATE '2026-03-13', DATE '2026-04-30', 1420.10, 1420.10, 'recebido', 'Baixa do apLIS — lote(s) 4871 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a8468ebb-31e8-5f9c-bc39-c752b483f3f8');

-- sem número | STF | lote(s) 5023
DELETE FROM glosas WHERE id_glosa IN ('e3acb12e-ccc9-4547-b665-bf8f42685639');
DELETE FROM recebimentos WHERE id_receb IN ('277c790a-54d6-402e-b506-4a1816cecc6a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eef13560-6da3-59de-89ae-ce9811be94e1', DATE '2026-04-02', DATE '2026-03-23', 2283.38, 2283.38, 'recebido', 'Baixa do apLIS — lote(s) 5023 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eef13560-6da3-59de-89ae-ce9811be94e1');

-- sem número | STF | lote(s) 4941
DELETE FROM glosas WHERE id_glosa IN ('c4156edb-4526-4e85-a36a-d853e3e24b03');
DELETE FROM recebimentos WHERE id_receb IN ('e6235f0b-8ef4-42b1-848a-4061de193270');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', DATE '2026-03-19', DATE '2026-05-22', 935.76, 935.76, 'recebido', 'Baixa do apLIS — lote(s) 4941 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2ea7d537-38ab-58dc-b192-182c39b10eca', '50b516c3-8e1f-5048-83b9-3637d165b201', 0.04, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2ea7d537-38ab-58dc-b192-182c39b10eca');

-- NF 7983 | PMDF | lote(s) 4988
DELETE FROM glosas WHERE id_glosa IN ('2e296358-13e7-486e-8dbe-ebdea09d3934');
DELETE FROM recebimentos WHERE id_receb IN ('35614638-8262-4424-837e-3d85da800369');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', DATE '2026-03-26', DATE '2026-07-29', 27643.51, 27643.51, 'recebido', 'Baixa do apLIS — lote(s) 4988 (recebido em 29/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3a51a1f3-875f-5490-8327-9043d3027b08', '6c3e2376-456c-5809-8a29-b27fd83a4632', 1451.72, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3a51a1f3-875f-5490-8327-9043d3027b08');

-- sem número | STF | lote(s) 4939
DELETE FROM glosas WHERE id_glosa IN ('0b3efd80-90f7-4935-9525-350ec122e0fa');
DELETE FROM recebimentos WHERE id_receb IN ('7ba237d2-142d-47dd-8aac-f7b6dfc18f95');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', DATE '2026-03-17', DATE '2026-05-22', 3648.80, 3648.80, 'recebido', 'Baixa do apLIS — lote(s) 4939 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79', 'dc00c9da-fb5c-5975-856c-992d2f080c9a', 0.17, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('74a52d2a-7b5d-5123-b5c5-73dc09a32f79');

-- NF 7983 | PMDF | lote(s) 5063
DELETE FROM glosas WHERE id_glosa IN ('031b41b2-c66e-438b-8335-163ad3c7a13c');
DELETE FROM recebimentos WHERE id_receb IN ('a0f657f9-79d3-487a-b06e-1cbe3c738a15');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', DATE '2026-03-25', DATE '2026-05-29', 392.62, 392.62, 'recebido', 'Baixa do apLIS — lote(s) 5063 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('51feaa9e-b973-55e6-bf65-ad92148e6fbb', 'c2291916-0b98-5a6a-a5fa-1b2e6ac595b4', 50.27, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('51feaa9e-b973-55e6-bf65-ad92148e6fbb');

-- sem número | ASSEFAZ | lote(s) 4959
DELETE FROM recebimentos WHERE id_receb IN ('4aac3632-db6c-42d6-b85d-f73d139a3a53');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2025-12-29', 606.88, 606.88, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-09', 119.27, 119.27, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 09/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-10', 247.14, 247.14, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 10/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-15', 254.60, 254.60, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-16', 75.86, 75.86, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-19', 119.27, 119.27, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-26', 75.86, 75.86, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 26/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5', DATE '2026-03-20', DATE '2026-01-27', 127.30, 127.30, 'recebido', 'Baixa do apLIS — lote(s) 4959 (recebido em 27/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5c7a7070-1ff5-5ee8-abd4-d094aad59af5');

-- sem número | AMIL | lote(s) 4978
DELETE FROM glosas WHERE id_glosa IN ('9f3f0ba5-91d3-43a3-9c2c-898a750d4c08');
DELETE FROM recebimentos WHERE id_receb IN ('bde4597a-7230-4d97-a607-cd3fc4fd8acc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', DATE '2026-03-07', DATE '2025-12-29', 340.52, 340.52, 'recebido', 'Baixa do apLIS — lote(s) 4978 (recebido em 29/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('39a4517f-f2ef-53c8-9972-1c343357254e', DATE '2026-03-07', DATE '2026-06-05', 160.00, 160.00, 'recebido', 'Baixa do apLIS — lote(s) 4978 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('39a4517f-f2ef-53c8-9972-1c343357254e');

-- sem número | FASCAL | lote(s) 4969
DELETE FROM glosas WHERE id_glosa IN ('17a8262a-3cba-4301-985e-4a89b673f077');
DELETE FROM recebimentos WHERE id_receb IN ('50470af0-e01a-4a62-9528-ed2e66a63add');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2025-09-25', 787.28, 787.28, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 25/09/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-01-08', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 08/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-01-13', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 13/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-01-29', 169.47, 169.47, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 29/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-01-30', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 30/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-02-02', 220.24, 220.24, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', DATE '2026-03-04', DATE '2026-02-03', 1453.45, 1453.45, 'recebido', 'Baixa do apLIS — lote(s) 4969 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d963a687-1764-5fe8-ae2a-00c24f12562c', '109eda05-b161-597b-a010-5fe79266ba28', 50.19, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d963a687-1764-5fe8-ae2a-00c24f12562c');

-- sem número | CASSI | lote(s) 4971
DELETE FROM recebimentos WHERE id_receb IN ('a4c7bf2b-af5e-48f0-9f36-e52928255140');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ad82dbf8-5545-5f29-a778-670810b9d4a2', DATE '2026-03-06', DATE '2026-03-03', 16269.06, 16269.06, 'recebido', 'Baixa do apLIS — lote(s) 4971 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ad82dbf8-5545-5f29-a778-670810b9d4a2', 'd836cabd-988d-5280-9977-8017fd1f52c9', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ad82dbf8-5545-5f29-a778-670810b9d4a2');

-- sem número | CASSI | lote(s) 4972
DELETE FROM glosas WHERE id_glosa IN ('9b511360-53ab-48fc-9ecf-e229a412b463');
DELETE FROM recebimentos WHERE id_receb IN ('8247a991-021a-4be9-ae7d-84817f9c232a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', DATE '2026-03-06', DATE '2026-03-03', 15778.47, 15778.47, 'recebido', 'Baixa do apLIS — lote(s) 4972 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', '4baebd4f-82f6-5487-bc44-1d557f466ee3', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('fff4ff11-d08a-54a3-a602-05e819deebd9', '4baebd4f-82f6-5487-bc44-1d557f466ee3', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('fff4ff11-d08a-54a3-a602-05e819deebd9');

-- sem número | FASCAL | lote(s) 4932
DELETE FROM glosas WHERE id_glosa IN ('4cf7c81a-6b91-42b6-ab02-39ae975e2462');
DELETE FROM recebimentos WHERE id_receb IN ('79216be7-1f74-446f-bf7e-a2474353d0b4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2025-11-11', 692.46, 692.46, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 11/11/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2025-12-08', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 08/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2025-12-09', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 09/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2025-12-15', 1233.21, 1233.21, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 15/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2025-12-16', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 16/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-12', 1075.68, 1075.68, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 12/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-15', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-19', 230.55, 230.55, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-20', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 20/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-21', 527.64, 527.64, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-22', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 22/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-23', 1233.21, 1233.21, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 23/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-26', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 26/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-27', 1310.06, 1310.06, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 27/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-01-28', 153.70, 153.70, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 28/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', DATE '2026-03-02', DATE '2026-02-02', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 4932 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', '03bd3ec6-a1e8-5e52-b896-cc48295d5252', 76.85, 'NÚMERO DA CARTEIRA INVÁLIDO', '1001', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('83dc421e-34ad-5f7c-8be8-29d9753663af', '03bd3ec6-a1e8-5e52-b896-cc48295d5252', 1728.26, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('83dc421e-34ad-5f7c-8be8-29d9753663af');

-- sem número | CASSI | lote(s) 5007
DELETE FROM glosas WHERE id_glosa IN ('45c1a3fe-e398-42af-a89f-696ec27897c0');
DELETE FROM recebimentos WHERE id_receb IN ('eeb10019-7d2c-4584-b9e9-e13921f0090a');
UPDATE lotes SET valor_total = 25141.40 WHERE id_lote = '713211ed-5406-57e2-b54a-cfdccac17e4a';
UPDATE notas SET valor_total = 25141.40 WHERE id_nota = '14a7a630-8fca-5b10-bb85-14bcdbf33925';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', DATE '2026-03-13', DATE '2026-03-17', 24516.44, 24516.44, 'recebido', 'Baixa do apLIS — lote(s) 5007 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', '713211ed-5406-57e2-b54a-cfdccac17e4a', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('14a7a630-8fca-5b10-bb85-14bcdbf33925', '713211ed-5406-57e2-b54a-cfdccac17e4a', 0.03, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('14a7a630-8fca-5b10-bb85-14bcdbf33925');

-- sem número | CASSI | lote(s) 5009
DELETE FROM recebimentos WHERE id_receb IN ('d3cd870b-27b8-46e7-8cc7-a08c00874a7b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a104cb63-81be-5295-b2ec-50cf9ec4c021', DATE '2026-03-14', DATE '2026-03-17', 7671.34, 7671.34, 'recebido', 'Baixa do apLIS — lote(s) 5009 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a104cb63-81be-5295-b2ec-50cf9ec4c021', 'ca6da51b-ade3-5426-b241-153314dde753', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a104cb63-81be-5295-b2ec-50cf9ec4c021');

-- sem número | CÂMARA DOS DEPUTADOS | lote(s) 5093
DELETE FROM glosas WHERE id_glosa IN ('6e247a6e-909e-4816-a473-4200281d3f96');
DELETE FROM recebimentos WHERE id_receb IN ('0574604d-5eec-4f53-847f-64a98e88f0c9');
UPDATE lotes SET valor_total = 1724.44 WHERE id_lote = '6118d935-9967-5e99-ad3f-fc1c11a33239';
UPDATE notas SET valor_total = 1724.44 WHERE id_nota = '628813a4-7bc7-515b-aa49-0590f5457f5c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', DATE '2026-04-28', DATE '2026-04-28', 1678.89, 1678.89, 'recebido', 'Baixa do apLIS — lote(s) 5093 (recebido em 28/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('628813a4-7bc7-515b-aa49-0590f5457f5c', '6118d935-9967-5e99-ad3f-fc1c11a33239', 39.84, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('628813a4-7bc7-515b-aa49-0590f5457f5c');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4997
DELETE FROM glosas WHERE id_glosa IN ('f3b6ec9e-66b5-4244-b070-6c08f9f71793');
DELETE FROM recebimentos WHERE id_receb IN ('ec0fcad1-3493-42ba-b34f-8786595a25e2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94482fa2-3e8f-5475-9655-656e98ba61b1', DATE '2026-04-26', DATE '2026-04-09', 42050.46, 42050.46, 'recebido', 'Baixa do apLIS — lote(s) 4997 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('94482fa2-3e8f-5475-9655-656e98ba61b1');

-- NF 8026 | INAS GDF | lote(s) 4867
DELETE FROM recebimentos WHERE id_receb IN ('47c50cdb-355d-4652-aa1a-eaa5e21356fa');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8', DATE '2026-03-29', DATE '2026-06-25', 3414.98, 3414.98, 'recebido', 'Baixa do apLIS — lote(s) 4867 (recebido em 25/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8', 'e02f05f6-01c5-58cd-a090-c53c633936c5', 0.39, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3b3f6ee3-644a-59df-a3e9-a640518b8ea8');

-- sem número | POSTAL SAÚDE | lote(s) 4934
DELETE FROM glosas WHERE id_glosa IN ('815f33ba-dda6-45d8-adca-720ee7577caa');
DELETE FROM recebimentos WHERE id_receb IN ('6176dc36-a10d-478f-86cf-59d9f2324ea6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', DATE '2026-04-03', DATE '2026-07-14', 99.62, 99.62, 'recebido', 'Baixa do apLIS — lote(s) 4934 (recebido em 14/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8ee54454-7931-57b2-95c4-11f374b6e936', DATE '2026-04-03', DATE '2026-09-12', 1020.78, 1020.78, 'recebido', 'Baixa do apLIS — lote(s) 4934 (recebido em 12/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8ee54454-7931-57b2-95c4-11f374b6e936');

-- sem número | SIS SENADO | lote(s) 5000
DELETE FROM recebimentos WHERE id_receb IN ('e0a7d97b-4065-4f91-a3ae-d7bfb3a7eeff');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5ca46bd6-0c13-58f1-b9ac-6996e4452d38', DATE '2026-04-13', DATE '2026-04-10', 13328.63, 13328.63, 'recebido', 'Baixa do apLIS — lote(s) 5000 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5ca46bd6-0c13-58f1-b9ac-6996e4452d38');

-- sem número | CASSI | lote(s) 4974
DELETE FROM glosas WHERE id_glosa IN ('f0aa1f96-1ff4-4dc8-bd74-a5d4f75d70d9');
DELETE FROM recebimentos WHERE id_receb IN ('2792f566-152d-4031-9255-5b99d814650f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', DATE '2026-03-14', DATE '2026-03-17', 8886.33, 8886.33, 'recebido', 'Baixa do apLIS — lote(s) 4974 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0aea3a84-c5d6-54c3-b805-a8346e258d8a', 'abe74228-5d35-5b13-8bec-40ea5d7d6adf', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0aea3a84-c5d6-54c3-b805-a8346e258d8a');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4996
DELETE FROM glosas WHERE id_glosa IN ('f0561219-c560-4aa6-9d3f-875639b990da');
DELETE FROM recebimentos WHERE id_receb IN ('25ffae2f-1164-47e9-9346-90b9421d7585');
UPDATE lotes SET valor_total = 19327.11 WHERE id_lote = '71cfdb57-c452-59aa-ae5f-68bb3023a97c';
UPDATE notas SET valor_total = 19327.11 WHERE id_nota = 'e14b28ed-381f-5bba-9d92-e4e1d1a615da';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', DATE '2026-04-11', DATE '2026-03-13', 18921.99, 18921.99, 'recebido', 'Baixa do apLIS — lote(s) 4996 (recebido em 13/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e14b28ed-381f-5bba-9d92-e4e1d1a615da', '71cfdb57-c452-59aa-ae5f-68bb3023a97c', 405.12, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e14b28ed-381f-5bba-9d92-e4e1d1a615da');

-- NF 7983 | PMDF | lote(s) 5653
DELETE FROM glosas WHERE id_glosa IN ('db8c41b4-1ccf-4d34-8168-dbfe82ad3f62');
DELETE FROM recebimentos WHERE id_receb IN ('674c5141-8d19-4960-8d38-049f5f8cdf40');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', DATE '2026-03-08', DATE '2026-05-29', 595.57, 595.57, 'recebido', 'Baixa do apLIS — lote(s) 5653 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1b6d7b2b-8115-5523-b946-e5866068c232', '194b7362-402d-5022-a36d-31c69e57f7fc', 12.16, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1b6d7b2b-8115-5523-b946-e5866068c232');

-- sem número | AMIL | lote(s) 4977
DELETE FROM glosas WHERE id_glosa IN ('9b16d6c9-9af1-4f4e-87c8-3db2d7c85e96');
DELETE FROM recebimentos WHERE id_receb IN ('762d841e-909a-408c-abf5-f65726ab88d6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-06', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 06/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-07', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 07/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-09', 497.25, 497.25, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 09/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-13', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 13/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-14', 599.90, 599.90, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 14/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-15', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-01-19', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1635b3-03a7-5e01-83d8-dba93ec2f049', DATE '2026-03-07', DATE '2026-02-18', 244.52, 244.52, 'recebido', 'Baixa do apLIS — lote(s) 4977 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3d1635b3-03a7-5e01-83d8-dba93ec2f049');

-- NF 8022 | BRADESCO SAUDE S/A 421715 | lote(s) 4994
DELETE FROM glosas WHERE id_glosa IN ('ae6b9fbd-84a7-4f85-a88e-ba941858c446');
DELETE FROM recebimentos WHERE id_receb IN ('d58b2e0f-7afa-48f0-9cf1-5a004ab0f3b4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', DATE '2026-04-26', DATE '2026-04-09', 144.77, 144.77, 'recebido', 'Baixa do apLIS — lote(s) 4994 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', DATE '2026-04-26', DATE '2026-04-30', 23426.96, 23426.96, 'recebido', 'Baixa do apLIS — lote(s) 4994 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('005278a9-575e-5344-afaa-e68d73ca2d80', '1d46699d-05c9-5ad0-8658-d1698dddb51f', 25.54, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('005278a9-575e-5344-afaa-e68d73ca2d80');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4882
DELETE FROM glosas WHERE id_glosa IN ('59dcc074-2db0-4c00-b164-c58ffa3b20a7');
DELETE FROM recebimentos WHERE id_receb IN ('54bc2400-ade8-4a14-a9ab-ddca574578c5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', DATE '2026-04-11', DATE '2026-03-12', 6737.70, 6737.70, 'recebido', 'Baixa do apLIS — lote(s) 4882 (recebido em 12/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('547c2afe-38bd-5cba-a4bf-92acf6932c75', '9061fd9d-cd7b-5585-aaaf-d24e9f96cc3c', 45.50, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('547c2afe-38bd-5cba-a4bf-92acf6932c75');

-- sem número | TST | lote(s) 5026
DELETE FROM glosas WHERE id_glosa IN ('89a6849e-28f9-4086-95cc-826be3621df7');
DELETE FROM recebimentos WHERE id_receb IN ('72e79c6b-a59c-488e-b537-59ea564b6721');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', DATE '2026-03-20', DATE '2026-03-30', 10520.44, 10520.44, 'recebido', 'Baixa do apLIS — lote(s) 5026 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3', '782d225f-1f36-5b81-a931-6041de28f1c3', 0.15, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3');

-- sem número | ASSEFAZ | lote(s) 4960
DELETE FROM glosas WHERE id_glosa IN ('30a6dde9-dc51-44af-b698-42bdc5752d7b');
DELETE FROM recebimentos WHERE id_receb IN ('742d41e6-f2a2-4dfa-abfb-34fdb0207db0');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', DATE '2026-03-20', DATE '2025-12-17', 143.06, 143.06, 'recebido', 'Baixa do apLIS — lote(s) 4960 (recebido em 17/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', DATE '2026-03-20', DATE '2026-02-06', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 4960 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e7e6f88f-109b-5c0a-af87-d99ba437733d', '2388d35f-1d04-585e-afa2-457f335e35f1', 1.08, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e7e6f88f-109b-5c0a-af87-d99ba437733d');

-- NF 7983 | PMDF | lote(s) 4986
DELETE FROM glosas WHERE id_glosa IN ('96317d34-5ec8-4f2d-afa3-b1294910564f');
DELETE FROM recebimentos WHERE id_receb IN ('146f3248-badf-43b4-9421-b399319a6e7c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', DATE '2026-03-08', DATE '2026-05-29', 30069.59, 30069.59, 'recebido', 'Baixa do apLIS — lote(s) 4986 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a2eff431-d3bc-5363-93c1-d7471181378e', '9324c970-a654-55ff-9dc9-d123e9c3efa2', 613.97, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a2eff431-d3bc-5363-93c1-d7471181378e');

-- sem número | SAUDE CAIXA | lote(s) 5081
DELETE FROM recebimentos WHERE id_receb IN ('e138684d-7332-4ba4-a3a0-ef5d3c2a3ed6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('00b0cd5a-c92f-58fb-ae36-57c206aed5ad', DATE '2026-03-28', DATE '2026-04-17', 17210.24, 17210.24, 'recebido', 'Baixa do apLIS — lote(s) 5081 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('00b0cd5a-c92f-58fb-ae36-57c206aed5ad');

-- NF 8030 | AMHP-DF | lote(s) 5039
DELETE FROM recebimentos WHERE id_receb IN ('1829634f-f199-43ff-bafb-69eb7e9534ad');
UPDATE lotes SET valor_total = 24188.01 WHERE id_lote = '51585fe0-f2fd-5616-af7a-852b1b4e1790';
UPDATE notas SET valor_total = 24188.01 WHERE id_nota = '742f351d-eb48-51b2-9290-08b5f9065606';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', DATE '2026-04-24', DATE '2025-12-31', 2922.53, 2922.53, 'recebido', 'Baixa do apLIS — lote(s) 5039 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', DATE '2026-04-24', DATE '2026-04-01', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5039 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', DATE '2026-04-24', DATE '2026-04-02', 16764.67, 16764.67, 'recebido', 'Baixa do apLIS — lote(s) 5039 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', DATE '2026-04-24', DATE '2026-05-06', 169.47, 169.47, 'recebido', 'Baixa do apLIS — lote(s) 5039 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('742f351d-eb48-51b2-9290-08b5f9065606', DATE '2026-04-24', DATE '2026-06-02', 3956.93, 3956.93, 'recebido', 'Baixa do apLIS — lote(s) 5039 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('742f351d-eb48-51b2-9290-08b5f9065606');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 4877
DELETE FROM glosas WHERE id_glosa IN ('2b9c1e38-6124-4099-8b34-49efbe058fcc');
DELETE FROM recebimentos WHERE id_receb IN ('5acc21ce-deea-4cec-b17a-e58703cbeb40');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('325053e9-9e25-53bb-8e86-d714bb60408c', DATE '2026-04-11', DATE '2026-03-17', 17563.35, 17563.35, 'recebido', 'Baixa do apLIS — lote(s) 4877 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('325053e9-9e25-53bb-8e86-d714bb60408c');

-- sem número | TST | lote(s) 5045
DELETE FROM glosas WHERE id_glosa IN ('489c6e9f-3eed-4468-a74c-752f2295314d');
DELETE FROM recebimentos WHERE id_receb IN ('c0043854-b281-4261-a251-800ed78123d3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', DATE '2026-03-20', DATE '2026-03-20', 50.18, 50.18, 'recebido', 'Baixa do apLIS — lote(s) 5045 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c418292c-180a-5d4d-af74-110ea7de81fb', '39703318-1b40-5931-80c8-f176583f99a5', 0.01, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c418292c-180a-5d4d-af74-110ea7de81fb');

-- sem número | E-VIDA | lote(s) 4963
DELETE FROM glosas WHERE id_glosa IN ('46d7cdbd-3b5a-4e9b-ad2f-050a4d84d91a');
DELETE FROM recebimentos WHERE id_receb IN ('fa3541b3-44a6-41e1-b9ad-06c8c7f04b8f');
UPDATE lotes SET valor_total = 2023.58 WHERE id_lote = '54e071a4-167c-529a-962f-f69f115b9400';
UPDATE notas SET valor_total = 2023.58 WHERE id_nota = 'b0a5f8f1-ade5-5057-8127-098f66af0743';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-13', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 13/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-14', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 14/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-15', 690.69, 690.69, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-20', 95.26, 95.26, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 20/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-21', 46.89, 46.89, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-23', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 23/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-26', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 26/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-28', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 28/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b0a5f8f1-ade5-5057-8127-098f66af0743', DATE '2026-03-10', DATE '2026-01-30', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 4963 (recebido em 30/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b0a5f8f1-ade5-5057-8127-098f66af0743');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 4908
DELETE FROM glosas WHERE id_glosa IN ('dc980e5d-905c-4f9a-83f0-fcdf1d780975');
DELETE FROM recebimentos WHERE id_receb IN ('0e048904-954d-4cba-9f92-7a0d11b79adb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', DATE '2026-04-26', DATE '2026-04-09', 2746.37, 2746.37, 'recebido', 'Baixa do apLIS — lote(s) 4908 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('740138d8-0c3e-5373-87a7-1918bdd7f1c8', 'b40523ef-c2cc-5684-ab8d-1044d3318d43', 400.42, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('740138d8-0c3e-5373-87a7-1918bdd7f1c8');

-- sem número | AMHP-DF | lote(s) 5028
DELETE FROM recebimentos WHERE id_receb IN ('2de67142-940e-4e61-91c7-f3825867ef97');
UPDATE lotes SET valor_total = 776.13 WHERE id_lote = '6c5d966c-6828-5602-880c-f29a0d570a24';
UPDATE notas SET valor_total = 776.13 WHERE id_nota = '21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8', DATE '2026-04-19', DATE '2026-04-02', 798.47, 798.47, 'recebido', 'Baixa do apLIS — lote(s) 5028 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8');

-- sem número | AMHP-DF | lote(s) 5024
DELETE FROM recebimentos WHERE id_receb IN ('671800ab-5a78-4081-89ff-fbe7f17398ad');
UPDATE lotes SET valor_total = 2348.77 WHERE id_lote = '2d195875-1617-5538-a4c2-59b56110b86f';
UPDATE notas SET valor_total = 2348.77 WHERE id_nota = '329efbcb-03cc-57a9-95e6-893e1a9e9fe6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('329efbcb-03cc-57a9-95e6-893e1a9e9fe6', DATE '2026-04-19', DATE '2026-04-02', 2442.27, 2442.27, 'recebido', 'Baixa do apLIS — lote(s) 5024 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('329efbcb-03cc-57a9-95e6-893e1a9e9fe6');

-- sem número | AMHP-DF | lote(s) 5027
DELETE FROM recebimentos WHERE id_receb IN ('bef7279f-29e6-4d16-84de-d80e9cdd40f7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8962b837-4e89-5282-9938-fc45395e7962', DATE '2026-04-19', DATE '2026-04-02', 537.55, 537.55, 'recebido', 'Baixa do apLIS — lote(s) 5027 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8962b837-4e89-5282-9938-fc45395e7962', '5a1120a3-7034-57f2-b3ca-5122c5b8e055', 97.45, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8962b837-4e89-5282-9938-fc45395e7962');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5330
DELETE FROM glosas WHERE id_glosa IN ('c50487c7-138a-4a0c-92f3-3c8252a19c1f');
DELETE FROM recebimentos WHERE id_receb IN ('9d83c24e-0c6c-406b-8a12-56bce2cb6113');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', DATE '2026-05-05', DATE '2026-05-18', 3232.18, 3232.18, 'recebido', 'Baixa do apLIS — lote(s) 5330 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14', '4d7486a2-530f-520c-ae67-fe4dd9fa95c0', 377.04, '1814 - COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', NULL, 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14');

-- NF 8030 | AMHP-DF | lote(s) 5206
DELETE FROM recebimentos WHERE id_receb IN ('b9260369-922c-409c-8bdd-717eed1a526a');
UPDATE lotes SET valor_total = 1230.27 WHERE id_lote = 'b0af5f99-d08a-5ac0-ad09-445712d4e7a7';
UPDATE notas SET valor_total = 1230.27 WHERE id_nota = 'd83b6191-71dc-5694-a335-4e992e0f8eac';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', DATE '2026-05-12', DATE '2026-05-03', 383.05, 383.05, 'recebido', 'Baixa do apLIS — lote(s) 5206 (recebido em 03/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', DATE '2026-05-12', DATE '2026-05-15', 192.80, 192.80, 'recebido', 'Baixa do apLIS — lote(s) 5206 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d83b6191-71dc-5694-a335-4e992e0f8eac', 'b0af5f99-d08a-5ac0-ad09-445712d4e7a7', 172.20, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d83b6191-71dc-5694-a335-4e992e0f8eac');

-- NF 8030 | AMHP-DF | lote(s) 5241
DELETE FROM recebimentos WHERE id_receb IN ('a7c00e31-a609-407f-a250-2536ee8390ff');
UPDATE lotes SET valor_total = 23859.33 WHERE id_lote = 'e7f25f86-a63d-5a39-8a59-42de9a2ed7f3';
UPDATE notas SET valor_total = 23859.33 WHERE id_nota = 'a0925e93-12af-5973-aecf-1917630e95c0';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a0925e93-12af-5973-aecf-1917630e95c0', DATE '2026-05-22', DATE '2026-08-04', 23859.33, 23859.33, 'recebido', 'Baixa do apLIS — lote(s) 5241 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a0925e93-12af-5973-aecf-1917630e95c0');

-- NF 8030 | AMHP-DF | lote(s) 5185
DELETE FROM recebimentos WHERE id_receb IN ('650a2716-b7df-4b01-be62-2e92d9ddd968');
UPDATE lotes SET valor_total = 2643.29 WHERE id_lote = '9dc102ce-fe57-5bd6-92b0-004db886052b';
UPDATE notas SET valor_total = 2643.29 WHERE id_nota = 'fe2613c5-b2e7-549a-8018-41ce21ac6142';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fe2613c5-b2e7-549a-8018-41ce21ac6142', DATE '2026-05-10', DATE '2026-05-15', 4092.94, 4092.94, 'recebido', 'Baixa do apLIS — lote(s) 5185 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('fe2613c5-b2e7-549a-8018-41ce21ac6142');

-- sem número | AMHP-DF | lote(s) 5196
DELETE FROM recebimentos WHERE id_receb IN ('2bbba159-2058-4884-8a6b-4cf7baed0902');
UPDATE lotes SET valor_total = 350.38 WHERE id_lote = '91a58921-638f-5030-8c9b-4b89811e4a1d';
UPDATE notas SET valor_total = 350.38 WHERE id_nota = 'a985828d-beb3-588b-bfd5-837b26f1a734';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a985828d-beb3-588b-bfd5-837b26f1a734', DATE '2026-05-11', DATE '2026-05-15', 294.49, 294.49, 'recebido', 'Baixa do apLIS — lote(s) 5196 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a985828d-beb3-588b-bfd5-837b26f1a734');

-- NF 8030 | AMHP-DF | lote(s) 5239
DELETE FROM recebimentos WHERE id_receb IN ('3a407add-e828-4f5a-8fff-ed36399f4089');
UPDATE lotes SET valor_total = 40.59 WHERE id_lote = '821a492c-3e65-53d6-88ca-917066b4b62f';
UPDATE notas SET valor_total = 40.59 WHERE id_nota = '48836bca-0d6c-5bcf-9e62-9a82f238fddd';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('48836bca-0d6c-5bcf-9e62-9a82f238fddd', DATE '2026-05-18', DATE '2026-05-19', 42.56, 42.56, 'recebido', 'Baixa do apLIS — lote(s) 5239 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('48836bca-0d6c-5bcf-9e62-9a82f238fddd');

-- sem número | AMHP-DF | lote(s) 5192
DELETE FROM recebimentos WHERE id_receb IN ('e646d500-83a5-4dba-8fce-8aa83f1837eb');
UPDATE lotes SET valor_total = 753.10 WHERE id_lote = 'ddaab687-1bb3-5c87-bf0e-73998beb4a64';
UPDATE notas SET valor_total = 753.10 WHERE id_nota = '2b47a72d-db55-5d27-b448-f60ea4f179d2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2b47a72d-db55-5d27-b448-f60ea4f179d2', DATE '2026-05-11', DATE '2026-05-19', 705.89, 705.89, 'recebido', 'Baixa do apLIS — lote(s) 5192 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2b47a72d-db55-5d27-b448-f60ea4f179d2');

-- NF 8030 | AMHP-DF | lote(s) 5166
DELETE FROM recebimentos WHERE id_receb IN ('531c3c74-b678-42c6-bfef-542622b04e87');
UPDATE lotes SET valor_total = 8526.57 WHERE id_lote = '4032a2ec-8091-59e8-9638-942acee3ea9b';
UPDATE notas SET valor_total = 8526.57 WHERE id_nota = '18b5f243-a73e-555e-861c-4f8e987c83ca';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', DATE '2026-05-09', DATE '2026-05-19', 6363.22, 6363.22, 'recebido', 'Baixa do apLIS — lote(s) 5166 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', '4032a2ec-8091-59e8-9638-942acee3ea9b', 132.62, 'NÃO EXISTE INFORMAÇÃO SOBRE A SENHA DE AUTORIZAÇÃO DO PROCEDIMENTO', '1403', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('18b5f243-a73e-555e-861c-4f8e987c83ca', '4032a2ec-8091-59e8-9638-942acee3ea9b', 481.23, 'SERVIÇO SOLICITADO FORA DA COBERTURA', '1420', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('18b5f243-a73e-555e-861c-4f8e987c83ca');

-- sem número | AMHP-DF | lote(s) 5207
DELETE FROM recebimentos WHERE id_receb IN ('f97a090c-994c-46bc-94a9-33332e30b682');
UPDATE lotes SET valor_total = 66.31 WHERE id_lote = '8d414322-6b54-5ed3-b9ff-97c0111995ba';
UPDATE notas SET valor_total = 66.31 WHERE id_nota = '95608998-cb94-5c40-9788-378fff72f690';
SELECT fat_recalcular_nota('95608998-cb94-5c40-9788-378fff72f690');

-- NF 8030 | AMHP-DF | lote(s) 5230
DELETE FROM recebimentos WHERE id_receb IN ('a0fabab2-3d3d-4a50-81d1-2ce5e022b06e');
UPDATE lotes SET valor_total = 3946.18 WHERE id_lote = '0ec42bc2-90de-510f-91a3-4aa28cca7f1c';
UPDATE notas SET valor_total = 3946.18 WHERE id_nota = 'd0c178ec-5773-5951-b39a-6ba1f2c56d67';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d0c178ec-5773-5951-b39a-6ba1f2c56d67', DATE '2026-05-17', DATE '2026-05-15', 2679.53, 2679.53, 'recebido', 'Baixa do apLIS — lote(s) 5230 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d0c178ec-5773-5951-b39a-6ba1f2c56d67');

-- sem número | AMHP-DF | lote(s) 5205
DELETE FROM recebimentos WHERE id_receb IN ('f559c5a5-a72f-470f-8c72-619c63209acb');
UPDATE lotes SET valor_total = 1645.52 WHERE id_lote = '01ebea91-a9da-5582-8528-fbc382bf0c1a';
UPDATE notas SET valor_total = 1645.52 WHERE id_nota = 'b664d9e2-6dd6-56db-93cb-83ba81485985';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b664d9e2-6dd6-56db-93cb-83ba81485985', DATE '2026-05-12', DATE '2026-05-06', 1682.38, 1682.38, 'recebido', 'Baixa do apLIS — lote(s) 5205 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b664d9e2-6dd6-56db-93cb-83ba81485985');

-- sem número | AMHP-DF | lote(s) 5238
DELETE FROM recebimentos WHERE id_receb IN ('3b01a8b9-74ba-41f9-b913-62decd9becf6');
UPDATE lotes SET valor_total = 1645.52 WHERE id_lote = '38c6fa29-fe00-5fbe-a650-d422d6eb8ef2';
UPDATE notas SET valor_total = 1645.52 WHERE id_nota = '196585d5-4824-5000-89ae-985c259d35b1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('196585d5-4824-5000-89ae-985c259d35b1', DATE '2026-05-18', DATE '2026-05-06', 936.89, 936.89, 'recebido', 'Baixa do apLIS — lote(s) 5238 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('196585d5-4824-5000-89ae-985c259d35b1');

-- NF 8030 | AMHP-DF | lote(s) 5208
DELETE FROM recebimentos WHERE id_receb IN ('887da4f0-01dd-4e89-ad62-620e2ef8c361');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('112199eb-8888-5c71-993e-9834413141fd', DATE '2026-05-12', DATE '2026-05-15', 195.64, 195.64, 'recebido', 'Baixa do apLIS — lote(s) 5208 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('112199eb-8888-5c71-993e-9834413141fd', DATE '2026-05-12', DATE '2026-09-15', 145.55, 145.55, 'recebido', 'Baixa do apLIS — lote(s) 5208 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('112199eb-8888-5c71-993e-9834413141fd');

-- sem número | AMHP-DF | lote(s) 5227
DELETE FROM recebimentos WHERE id_receb IN ('5e4e9ba6-e28f-4531-bec8-40b20522e716');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a6e4b79e-984a-51fc-b14c-77bb7911c4c6', DATE '2026-05-17', DATE '2026-05-15', 129.60, 129.60, 'recebido', 'Baixa do apLIS — lote(s) 5227 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a6e4b79e-984a-51fc-b14c-77bb7911c4c6');

-- NF 8030 | AMHP-DF | lote(s) 5233
DELETE FROM recebimentos WHERE id_receb IN ('c370b2d2-49c2-46d3-a1a2-49546982c441');
UPDATE lotes SET valor_total = 2280.99 WHERE id_lote = 'c702b9e7-da40-56d5-8b9d-8020a5489763';
UPDATE notas SET valor_total = 2280.99 WHERE id_nota = 'd8158c48-28d5-59b0-ad8c-ca54b26ca6d0';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0', DATE '2026-05-18', DATE '2026-05-19', 2383.74, 2383.74, 'recebido', 'Baixa do apLIS — lote(s) 5233 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0');

-- NF 8030 | AMHP-DF | lote(s) 5202
DELETE FROM recebimentos WHERE id_receb IN ('cb9c1197-6750-4727-87e0-b6bea14d47d2');
UPDATE lotes SET valor_total = 1062.51 WHERE id_lote = '9450402b-f92a-57ac-88b6-1557a87571e1';
UPDATE notas SET valor_total = 1062.51 WHERE id_nota = '537cdbf5-f7ef-5911-9264-a5f5172b4d62';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('537cdbf5-f7ef-5911-9264-a5f5172b4d62', DATE '2026-05-12', DATE '2026-05-15', 1104.95, 1104.95, 'recebido', 'Baixa do apLIS — lote(s) 5202 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('537cdbf5-f7ef-5911-9264-a5f5172b4d62');

-- sem número | AMHP-DF | lote(s) 5236
DELETE FROM recebimentos WHERE id_receb IN ('7ca054f6-fc9c-45fb-b6d1-9be762504eb8');
UPDATE lotes SET valor_total = 73.28 WHERE id_lote = 'ac882605-b4d5-5693-a0a8-e949173f40d8';
UPDATE notas SET valor_total = 73.28 WHERE id_nota = '28409cad-5ee7-5f8f-b0ef-4aee7c845c72';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('28409cad-5ee7-5f8f-b0ef-4aee7c845c72', DATE '2026-05-18', DATE '2026-03-10', 73.28, 73.28, 'recebido', 'Baixa do apLIS — lote(s) 5236 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('28409cad-5ee7-5f8f-b0ef-4aee7c845c72');

-- sem número | LAB PLANASSISTE | lote(s) 5163
DELETE FROM recebimentos WHERE id_receb IN ('2962dbc8-b54a-413c-8e41-b6eaaaf34024');
UPDATE lotes SET valor_total = 5985.49 WHERE id_lote = '0ca0d3d3-8f0c-57b5-82f4-efd66d66f36e';
UPDATE notas SET valor_total = 5985.49 WHERE id_nota = '8d66e227-a0ba-56b9-9754-17a6de6f1930';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8d66e227-a0ba-56b9-9754-17a6de6f1930', DATE '2026-05-08', DATE '2026-05-18', 5985.49, 5985.49, 'recebido', 'Baixa do apLIS — lote(s) 5163 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8d66e227-a0ba-56b9-9754-17a6de6f1930');

-- sem número | LAB PLANASSISTE | lote(s) 5171
DELETE FROM recebimentos WHERE id_receb IN ('fbdf3ab9-159d-4288-8f54-2b5d167f5ef2');
UPDATE lotes SET valor_total = 16173.28 WHERE id_lote = '593cc32d-aeab-58d4-9750-413680d0f0f0';
UPDATE notas SET valor_total = 16173.28 WHERE id_nota = 'aeee244c-1907-532e-8ec2-25d2849f9796';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aeee244c-1907-532e-8ec2-25d2849f9796', DATE '2026-05-08', DATE '2026-05-19', 11009.48, 11009.48, 'recebido', 'Baixa do apLIS — lote(s) 5171 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('aeee244c-1907-532e-8ec2-25d2849f9796');

-- sem número | AMHP-DF | lote(s) 5195
DELETE FROM recebimentos WHERE id_receb IN ('417752ab-054f-49b8-9642-0f7e1626f204');
SELECT fat_recalcular_nota('a8f3fadb-e4ca-5b26-9aea-871d1afe584a');

-- sem número | AMHP-DF | lote(s) 5190
DELETE FROM recebimentos WHERE id_receb IN ('a879583d-8b9a-433d-a07b-0b1aeacbc5c6');
UPDATE lotes SET valor_total = 4067.61 WHERE id_lote = '80ad4bf7-a4d4-5f51-8372-c619af18eb2c';
UPDATE notas SET valor_total = 4067.61 WHERE id_nota = 'cc33da98-4dd8-51d1-96da-dae79f178756';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc33da98-4dd8-51d1-96da-dae79f178756', DATE '2026-05-11', DATE '2025-12-31', 1720.91, 1720.91, 'recebido', 'Baixa do apLIS — lote(s) 5190 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc33da98-4dd8-51d1-96da-dae79f178756', DATE '2026-05-11', DATE '2026-06-02', 246.31, 246.31, 'recebido', 'Baixa do apLIS — lote(s) 5190 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cc33da98-4dd8-51d1-96da-dae79f178756');

-- sem número | AMHP-DF | lote(s) 5229
DELETE FROM recebimentos WHERE id_receb IN ('7da88ace-efcc-4178-abba-879ee0360392');
UPDATE lotes SET valor_total = 901.97 WHERE id_lote = '0118f4fb-6a82-5ae0-a5e9-4b2a0cc1c6f8';
UPDATE notas SET valor_total = 901.97 WHERE id_nota = '06066c94-6e06-5446-a496-503fa30add9b';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('06066c94-6e06-5446-a496-503fa30add9b', DATE '2026-05-17', DATE '2026-06-02', 159.82, 159.82, 'recebido', 'Baixa do apLIS — lote(s) 5229 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('06066c94-6e06-5446-a496-503fa30add9b');

-- sem número | AMHP-DF | lote(s) 5198
DELETE FROM recebimentos WHERE id_receb IN ('fdb3eaeb-f97d-48e1-abcb-c89cf08196c6');
UPDATE lotes SET valor_total = 218.03 WHERE id_lote = '88a2d5c1-229a-5183-bad9-834e35cdc0b6';
UPDATE notas SET valor_total = 218.03 WHERE id_nota = '1a3ff490-df50-5eba-9c70-ae038b46e691';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1a3ff490-df50-5eba-9c70-ae038b46e691', DATE '2026-05-11', DATE '2026-05-15', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5198 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1a3ff490-df50-5eba-9c70-ae038b46e691');

-- sem número | AMHP-DF | lote(s) 5193
DELETE FROM recebimentos WHERE id_receb IN ('fc58439d-c516-49ed-9a72-85511586a67a');
UPDATE lotes SET valor_total = 1949.85 WHERE id_lote = 'ea5c7bd8-001b-5f67-aefe-259c9d1311f9';
UPDATE notas SET valor_total = 1949.85 WHERE id_nota = 'df26b171-493b-5d1f-b93f-468e475275f6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df26b171-493b-5d1f-b93f-468e475275f6', DATE '2026-05-11', DATE '2026-06-02', 864.04, 864.04, 'recebido', 'Baixa do apLIS — lote(s) 5193 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('df26b171-493b-5d1f-b93f-468e475275f6');

-- NF 8030 | AMHP-DF | lote(s) 5184
DELETE FROM recebimentos WHERE id_receb IN ('ce978d4f-62b1-4c91-bbe8-b342ae1eb762');
UPDATE lotes SET valor_total = 9926.97 WHERE id_lote = '15573330-8973-536c-b6cc-30caa9d11f6f';
UPDATE notas SET valor_total = 9926.97 WHERE id_nota = 'e22b7a64-beaa-5880-8a17-7a40f98463b9';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e22b7a64-beaa-5880-8a17-7a40f98463b9', DATE '2026-05-10', DATE '2026-05-15', 7306.23, 7306.23, 'recebido', 'Baixa do apLIS — lote(s) 5184 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e22b7a64-beaa-5880-8a17-7a40f98463b9');

-- NF 8030 | AMHP-DF | lote(s) 5209
DELETE FROM recebimentos WHERE id_receb IN ('9f844a05-4469-426e-ad2b-d4b8bc660d9c');
UPDATE lotes SET valor_total = 58.68 WHERE id_lote = '8025c8fb-2d8e-5851-acd4-d318dcb3e68d';
UPDATE notas SET valor_total = 58.68 WHERE id_nota = '630085bf-10f7-5d47-a98c-c367294f249e';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('630085bf-10f7-5d47-a98c-c367294f249e', DATE '2026-05-12', DATE '2026-05-19', 60.30, 60.30, 'recebido', 'Baixa do apLIS — lote(s) 5209 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('630085bf-10f7-5d47-a98c-c367294f249e');

-- sem número | AMHP-DF | lote(s) 5231
DELETE FROM recebimentos WHERE id_receb IN ('dd56cf44-deb6-4226-8069-bab790d2593e');
UPDATE lotes SET valor_total = 3594.29 WHERE id_lote = '3c19f18d-2ac8-56d5-aeb2-b8a69a567dc8';
UPDATE notas SET valor_total = 3594.29 WHERE id_nota = 'd84bad2a-9280-5355-a387-08d53bfff953';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d84bad2a-9280-5355-a387-08d53bfff953', DATE '2026-05-18', DATE '2026-06-02', 3693.02, 3693.02, 'recebido', 'Baixa do apLIS — lote(s) 5231 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d84bad2a-9280-5355-a387-08d53bfff953');

-- sem número | AMHP-DF | lote(s) 5211
DELETE FROM recebimentos WHERE id_receb IN ('e31dfa2c-fe44-4312-9a03-5d699169a4da');
UPDATE lotes SET valor_total = 614.91 WHERE id_lote = '3b43a598-e458-5a58-b241-56509074e57b';
UPDATE notas SET valor_total = 614.91 WHERE id_nota = '7c6c2990-d14e-5aad-809c-16b67801e270';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7c6c2990-d14e-5aad-809c-16b67801e270', DATE '2026-05-12', DATE '2026-06-02', 639.37, 639.37, 'recebido', 'Baixa do apLIS — lote(s) 5211 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7c6c2990-d14e-5aad-809c-16b67801e270');

-- sem número | AMHP-DF | lote(s) 5223
DELETE FROM recebimentos WHERE id_receb IN ('0a0b62ef-172b-4b58-bd56-9ca1fe0de5a5');
UPDATE lotes SET valor_total = 1029.52 WHERE id_lote = '96c949a2-19f2-5f67-bf98-74457a769bb8';
UPDATE notas SET valor_total = 1029.52 WHERE id_nota = '71502a28-1520-5176-ae77-b488e558fe85';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('71502a28-1520-5176-ae77-b488e558fe85', DATE '2026-05-17', DATE '2025-12-31', 1029.52, 1029.52, 'recebido', 'Baixa do apLIS — lote(s) 5223 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('71502a28-1520-5176-ae77-b488e558fe85');

-- sem número | AMHP-DF | lote(s) 5240
DELETE FROM recebimentos WHERE id_receb IN ('ec6bb64f-5343-49a0-9f1d-31e174452603');
UPDATE lotes SET valor_total = 2863.08 WHERE id_lote = '17101e77-5c8d-5064-bd70-d1558b8f2052';
UPDATE notas SET valor_total = 2863.08 WHERE id_nota = '0c5864c1-1b26-53cc-a7b7-9db86f62c759';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c5864c1-1b26-53cc-a7b7-9db86f62c759', DATE '2026-05-18', DATE '2026-06-02', 2957.43, 2957.43, 'recebido', 'Baixa do apLIS — lote(s) 5240 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0c5864c1-1b26-53cc-a7b7-9db86f62c759');

-- sem número | AMHP-DF | lote(s) 5235
DELETE FROM recebimentos WHERE id_receb IN ('49926e7d-5a23-4ad0-bef5-56ba91abd269');
UPDATE lotes SET valor_total = 416.60 WHERE id_lote = '295cdd5e-3b87-56d6-8824-a26f95a63ac0';
UPDATE notas SET valor_total = 416.60 WHERE id_nota = '8cee2f56-118e-52d0-b056-d9efb118237c';
SELECT fat_recalcular_nota('8cee2f56-118e-52d0-b056-d9efb118237c');

-- NF 8030 | AMHP-DF | lote(s) 5199
DELETE FROM recebimentos WHERE id_receb IN ('26b9b1df-5ed8-4149-9724-52ebffbb63b9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('19391c80-5c03-52c2-adeb-e83a6b990214', DATE '2026-05-12', DATE '2026-05-15', 2224.51, 2224.51, 'recebido', 'Baixa do apLIS — lote(s) 5199 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('19391c80-5c03-52c2-adeb-e83a6b990214');

-- sem número | AMHP-DF | lote(s) 5228
DELETE FROM recebimentos WHERE id_receb IN ('9d5a0dd8-5d93-492e-8197-fa03f5c1c0be');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42', DATE '2026-05-17', DATE '2026-05-15', 568.17, 568.17, 'recebido', 'Baixa do apLIS — lote(s) 5228 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42');

-- sem número | AMIL | lote(s) 5159
DELETE FROM recebimentos WHERE id_receb IN ('c17f4aff-103c-4e1b-ac09-2fcd8e247714');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-01-09', 355.00, 355.00, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 09/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-01-16', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-01-19', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-06', 200.00, 200.00, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-10', 200.00, 200.00, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-11', 183.45, 183.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-19', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-20', 55.45, 55.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 20/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-26', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-02-27', 200.00, 200.00, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-03-02', 410.45, 410.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', DATE '2026-04-04', DATE '2026-03-05', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5159 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2224bec4-3229-5a55-b325-4300eac7d59e', '294e3b3e-2249-50d4-8172-d88587c50958', 155.00, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2224bec4-3229-5a55-b325-4300eac7d59e');

-- sem número | AMIL | lote(s) 5158
DELETE FROM glosas WHERE id_glosa IN ('63f0dcff-7145-4dd9-b7d5-b550651d44cf');
DELETE FROM recebimentos WHERE id_receb IN ('db345751-ce5d-42db-bea1-ff75ef8872c0');
UPDATE lotes SET valor_total = 8679.36 WHERE id_lote = '76331db7-d4cb-5f62-ab97-56e44e674037';
UPDATE notas SET valor_total = 8679.36 WHERE id_nota = 'dfe20150-02bc-5a02-a407-9aa6c597c2e0';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2025-12-26', 120.00, 120.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 26/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-01-16', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-01-26', 227.00, 227.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 26/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-05', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-07', 685.35, 685.35, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 07/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-09', 155.00, 155.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-11', 22.08, 22.08, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-13', 992.45, 992.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 13/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-18', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-19', 693.45, 693.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-20', 200.00, 200.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 20/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-24', 1842.35, 1842.35, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 24/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-25', 1076.90, 1076.90, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-26', 605.53, 605.53, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-02-27', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-03-02', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-03-03', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dfe20150-02bc-5a02-a407-9aa6c597c2e0', DATE '2026-04-05', DATE '2026-06-05', 160.00, 160.00, 'recebido', 'Baixa do apLIS — lote(s) 5158 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dfe20150-02bc-5a02-a407-9aa6c597c2e0');

-- sem número | AMIL | lote(s) 5157
DELETE FROM glosas WHERE id_glosa IN ('1d896e78-5e30-4718-b50c-6637b450a93f');
DELETE FROM recebimentos WHERE id_receb IN ('d55dc36a-4c41-483a-9e67-8abf44e8a84e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-01-21', 481.00, 481.00, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-05', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-07', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 07/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-09', 920.45, 920.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-10', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-11', 22.08, 22.08, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-19', 1305.35, 1305.35, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-23', 1715.80, 1715.80, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 23/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-24', 1207.25, 1207.25, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 24/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-25', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-26', 56.90, 56.90, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-02-27', 1076.90, 1076.90, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-03-02', 1502.45, 1502.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-03-03', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('923df05b-279c-53ee-b85f-6ff87bf57184', DATE '2026-04-08', DATE '2026-06-05', 148.00, 148.00, 'recebido', 'Baixa do apLIS — lote(s) 5157 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('923df05b-279c-53ee-b85f-6ff87bf57184');

-- sem número | ASSEFAZ | lote(s) 5131
DELETE FROM glosas WHERE id_glosa IN ('3f3a604f-ff11-45c5-b3d2-b619a29046ce');
DELETE FROM recebimentos WHERE id_receb IN ('3bc18b0a-07fe-4c44-9e20-d494d0a7ed07');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-03', 1057.71, 1057.71, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-04', 1801.24, 1801.24, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 04/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-05', 3337.79, 3337.79, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-06', 1973.80, 1973.80, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-09', 507.82, 507.82, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-10', 2607.38, 2607.38, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', DATE '2026-04-20', DATE '2026-02-11', 1293.42, 1293.42, 'recebido', 'Baixa do apLIS — lote(s) 5131 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8858ae39-a91e-5ace-ba60-8bd83cf0f804', '1811f2c1-a9ee-5d5d-9a18-8c8e48eab841', 76.68, 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', '1006', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8858ae39-a91e-5ace-ba60-8bd83cf0f804');

-- sem número | ASSEFAZ | lote(s) 5132
DELETE FROM glosas WHERE id_glosa IN ('c345ef35-d924-48b4-9ee3-8faea360941a');
DELETE FROM recebimentos WHERE id_receb IN ('00a7da6f-880c-44ed-b318-63e4a80e9b46');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-02', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-18', 626.57, 626.57, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-19', 3056.32, 3056.32, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-20', 1919.99, 1919.99, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 20/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-23', 1800.89, 1800.89, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 23/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-25', 1762.90, 1762.90, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-26', 469.48, 469.48, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', DATE '2026-04-20', DATE '2026-02-27', 1293.42, 1293.42, 'recebido', 'Baixa do apLIS — lote(s) 5132 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a', 'fa2267c1-1cd5-53ad-95fe-f4d157433fd1', 3.43, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a');

-- sem número | ASSEFAZ | lote(s) 5140
DELETE FROM glosas WHERE id_glosa IN ('8f79f3d4-09a3-4fb7-8934-9dcac91f4450');
DELETE FROM recebimentos WHERE id_receb IN ('d4fd89fa-7fa7-4b12-b4c1-70213b21e67e');
UPDATE lotes SET valor_total = 9113.37 WHERE id_lote = '7749cb27-9a3d-50a6-9a94-72de74be7eb8';
UPDATE notas SET valor_total = 9113.37 WHERE id_nota = 'f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-14', 438.86, 438.86, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 14/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-18', 1789.07, 1789.07, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-19', 862.28, 862.28, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-20', 1057.71, 1057.71, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 20/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-23', 1293.42, 1293.42, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 23/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-24', 823.94, 823.94, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 24/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-25', 2115.42, 2115.42, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-26', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 26/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4', DATE '2026-04-20', DATE '2026-02-27', 1214.80, 1214.80, 'recebido', 'Baixa do apLIS — lote(s) 5140 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4');

-- sem número | ASSEFAZ | lote(s) 4991
DELETE FROM glosas WHERE id_glosa IN ('ec925f3d-5b28-4725-b189-6b6861f8d73b');
DELETE FROM recebimentos WHERE id_receb IN ('7135bb6f-949d-4230-b71b-f4aeb0b7458d');
UPDATE lotes SET valor_total = 2795.29 WHERE id_lote = 'da78e13d-7f13-5d49-b474-3ecc476dc3b6';
UPDATE notas SET valor_total = 2795.29 WHERE id_nota = 'b7a02eae-d2a5-5182-bbcc-40a79b20d5d2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-01-12', 198.87, 198.87, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 12/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-01-29', 175.01, 175.01, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 29/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-01-30', 75.86, 75.86, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 30/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-02-02', 198.87, 198.87, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-02-03', 119.27, 119.27, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-02-10', 119.27, 119.27, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-02-11', 75.86, 75.86, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 11/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-03-03', 482.75, 482.75, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2', DATE '2026-04-20', DATE '2026-03-04', 1349.53, 1349.53, 'recebido', 'Baixa do apLIS — lote(s) 4991 (recebido em 04/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2');

-- sem número | ASSEFAZ | lote(s) 5150
DELETE FROM glosas WHERE id_glosa IN ('38c521e0-740a-4f9e-8237-612afaa707b3');
DELETE FROM recebimentos WHERE id_receb IN ('044d5afe-7e9f-4dc0-8af5-46508eded193');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-01-12', 436.54, 436.54, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 12/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-01-28', 206.35, 206.35, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 28/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-02-02', 1074.10, 1074.10, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-02-03', 584.05, 584.05, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-02-12', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 12/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-03-02', 1575.18, 1575.18, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-03-03', 1724.56, 1724.56, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', DATE '2026-04-20', DATE '2026-03-05', 639.78, 639.78, 'recebido', 'Baixa do apLIS — lote(s) 5150 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', 'e6423254-ec7d-50a5-8a60-6951f0c3ee25', 106.49, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9b508a56-3350-5b04-8201-55bf41c2ffff', 'e6423254-ec7d-50a5-8a60-6951f0c3ee25', 27.51, 'COBRANÇA DE PROCEDIMENTO INCLUSO NO PROCEDIMENTO PRINCIPAL', '1817', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9b508a56-3350-5b04-8201-55bf41c2ffff');

-- NF 8195 | BRADESCO SAUDE  - 005711 | lote(s) 5075
DELETE FROM glosas WHERE id_glosa IN ('fc8ccf8b-d1d5-4072-8325-e951236d32ef');
DELETE FROM recebimentos WHERE id_receb IN ('92cc1d0d-4408-431f-a894-78517093c810');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', DATE '2026-05-25', DATE '2026-05-12', 28909.50, 28909.50, 'recebido', 'Baixa do apLIS — lote(s) 5075 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', '44df7984-0f5b-555a-b22a-eeb0e7020462', 405.13, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5a2accf1-ac66-5dae-873b-a7827ad8ab26', '44df7984-0f5b-555a-b22a-eeb0e7020462', 400.13, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5a2accf1-ac66-5dae-873b-a7827ad8ab26');

-- NF 8294 | BRADESCO SAUDE S/A 421715 | lote(s) 5296
DELETE FROM glosas WHERE id_glosa IN ('c12e8e07-c79b-4f18-a632-4d1a1565f74c');
DELETE FROM recebimentos WHERE id_receb IN ('7890a8d9-61ce-48a4-8799-41e18d25940d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', DATE '2026-05-25', DATE '2026-06-03', 1015.28, 1015.28, 'recebido', 'Baixa do apLIS — lote(s) 5296 (recebido em 03/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('896f8a5a-26b7-5be4-9952-2df1cc7202d1', '4739dc4a-ed0c-5172-9a49-f72db30bba60', 128.89, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('896f8a5a-26b7-5be4-9952-2df1cc7202d1');

-- NF 8029 | BRADESCO SAUDE  - 005711 | lote(s) 5292
DELETE FROM glosas WHERE id_glosa IN ('d13b6cdc-6d36-4281-b3b2-9b04d3e10e6a');
SELECT fat_recalcular_nota('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b');

-- NF 8000 | BRADESCO SAUDE  - 005711 | lote(s) 5287
DELETE FROM glosas WHERE id_glosa IN ('4bcf7f2a-e963-4478-b3a9-b7c31c357c99');
DELETE FROM recebimentos WHERE id_receb IN ('26579dd2-3c5f-4d78-8366-bf38cecc711a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', DATE '2026-05-25', DATE '2026-05-05', 3914.74, 3914.74, 'recebido', 'Baixa do apLIS — lote(s) 5287 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('517f99f7-e6b1-5bc1-89df-1ed87c241202', '790ec238-4a23-5a8c-a736-c612eaca5eee', 25.54, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('517f99f7-e6b1-5bc1-89df-1ed87c241202');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5288
DELETE FROM glosas WHERE id_glosa IN ('424b3a3d-504f-452b-a7c6-d921fdd8598c');
DELETE FROM recebimentos WHERE id_receb IN ('5c2d2aa5-740d-4af0-a859-5dcee86a685e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', DATE '2026-05-25', DATE '2026-05-05', 13869.27, 13869.27, 'recebido', 'Baixa do apLIS — lote(s) 5288 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1ed8e465-5858-5e1f-ab7f-4d6731229868', 'f9ae8a3c-9e18-5eda-bac2-d793049b8600', 51.08, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1ed8e465-5858-5e1f-ab7f-4d6731229868');

-- NF 8294 | BRADESCO SAUDE S/A 421715 | lote(s) 5291
DELETE FROM glosas WHERE id_glosa IN ('1fccdb77-24a4-43af-a8cd-b5bcf53666b2');
DELETE FROM recebimentos WHERE id_receb IN ('75d4af6e-af56-4166-9f4a-b437b31b1147');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', DATE '2026-05-25', DATE '2026-05-05', 7286.14, 7286.14, 'recebido', 'Baixa do apLIS — lote(s) 5291 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', DATE '2026-05-25', DATE '2026-06-03', 3295.89, 3295.89, 'recebido', 'Baixa do apLIS — lote(s) 5291 (recebido em 03/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a', '78b1116d-689c-50b4-b813-b30f4c128253', 430.67, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0c62e3b4-18f8-506a-a96d-2fe272b6a11a');

-- NF 8294 | BRADESCO SAUDE S/A 421715 | lote(s) 5068
DELETE FROM glosas WHERE id_glosa IN ('320e48aa-4b5a-4414-9ba5-7f0e1dddba7d');
DELETE FROM recebimentos WHERE id_receb IN ('023bcb37-dc9e-44e9-9dbc-8bf41587e2a9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', DATE '2026-05-25', DATE '2026-05-05', 12283.15, 12283.15, 'recebido', 'Baixa do apLIS — lote(s) 5068 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5a086b37-66bd-5f4b-a018-f61d36b87134', '990a2fbb-0575-59d2-be58-ef2f9826011b', 25.54, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5a086b37-66bd-5f4b-a018-f61d36b87134');

-- NF 8278 | BRADESCO SAUDE  - 005711 | lote(s) 5289
DELETE FROM glosas WHERE id_glosa IN ('4d1cad61-20f1-46a7-970d-8235e473b755');
DELETE FROM recebimentos WHERE id_receb IN ('d6838107-4dec-4b5f-a8cd-a5a0755f5dfc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', DATE '2026-05-25', DATE '2026-05-27', 18059.07, 18059.07, 'recebido', 'Baixa do apLIS — lote(s) 5289 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7', 'fe1ca174-9769-510c-90f9-63fa9366c4ab', 25.54, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('32a86c53-57ff-52d6-8aca-ccd061a1bcb7');

-- NF 8195 | BRADESCO SAUDE  - 005711 | lote(s) 5301
DELETE FROM glosas WHERE id_glosa IN ('992e7de2-d71f-46b8-9e68-a2b89eb6d8ea');
DELETE FROM recebimentos WHERE id_receb IN ('8be91386-77e2-45f4-8a68-b3619c809fad');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('33c269ab-71bf-503a-b567-552c27934405', DATE '2026-05-25', DATE '2026-05-05', 10797.19, 10797.19, 'recebido', 'Baixa do apLIS — lote(s) 5301 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('33c269ab-71bf-503a-b567-552c27934405', '53a1165d-0267-5454-a3cd-5280a2a460e5', 11.10, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('33c269ab-71bf-503a-b567-552c27934405');

-- NF 8195 | BRADESCO SAUDE  - 005711 | lote(s) 5303
DELETE FROM glosas WHERE id_glosa IN ('62f3113e-b8c0-4ed1-84fb-eb4cb610c4f0');
DELETE FROM recebimentos WHERE id_receb IN ('e17d9526-890b-4f95-b574-f8877ea8802b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', DATE '2026-05-25', DATE '2026-03-26', 15980.36, 15980.36, 'recebido', 'Baixa do apLIS — lote(s) 5303 (recebido em 26/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', '18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1', 540.34, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c36a1018-fefa-5d31-923d-e6695856044a', '18d3e6d9-8797-51f4-a802-ae8bf6ebc6a1', 1215.39, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c36a1018-fefa-5d31-923d-e6695856044a');

-- NF 8000 | BRADESCO SAUDE  - 005711 | lote(s) 5298
DELETE FROM glosas WHERE id_glosa IN ('379c3f66-d80a-485f-b54a-b78ec181d670');
DELETE FROM recebimentos WHERE id_receb IN ('79565be5-a5c2-4af6-b12a-50edf8885397');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', DATE '2026-05-26', DATE '2026-05-05', 12643.41, 12643.41, 'recebido', 'Baixa do apLIS — lote(s) 5298 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b55874df-1db0-5cbd-aa15-824cef66a7c8', 'b1828b68-fa78-513e-b3c8-ca0ddb056f15', 229.98, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b55874df-1db0-5cbd-aa15-824cef66a7c8');

-- sem número | CBMDF | lote(s) 5356
DELETE FROM glosas WHERE id_glosa IN ('c45157a7-ca90-42d1-8936-f55ad2882f60');
DELETE FROM recebimentos WHERE id_receb IN ('0d395816-a8db-496b-bed3-2f889253095f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', DATE '2026-04-30', DATE '2026-05-11', 1991.11, 1991.11, 'recebido', 'Baixa do apLIS — lote(s) 5356 (recebido em 11/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b30f7157-b900-57c7-ac76-83a9c5137a56', '8eec7b8e-2cde-57d5-82b0-26d80fdff7be', 193.75, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b30f7157-b900-57c7-ac76-83a9c5137a56');

-- sem número | CASSI | lote(s) 5189
DELETE FROM glosas WHERE id_glosa IN ('829bff48-2844-4644-a94c-49e4021161a2');
DELETE FROM recebimentos WHERE id_receb IN ('99bbd26e-5dc7-454a-b947-bfbcde6c19d1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', DATE '2026-04-11', DATE '2026-04-14', 21777.22, 21777.22, 'recebido', 'Baixa do apLIS — lote(s) 5189 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', '0a106e79-b44b-5b17-8c8c-f2bd18681563', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0b4999f2-3c34-5ac2-864e-99e06c493ea2', '0a106e79-b44b-5b17-8c8c-f2bd18681563', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0b4999f2-3c34-5ac2-864e-99e06c493ea2');

-- sem número | CASSI | lote(s) 5191
DELETE FROM glosas WHERE id_glosa IN ('e132d2be-dcce-4a0a-89f2-c4f51718243c');
DELETE FROM recebimentos WHERE id_receb IN ('3ba5e2fe-9335-4ae2-b6f2-c435c9cde3c4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', DATE '2026-04-11', DATE '2026-04-14', 16883.99, 16883.99, 'recebido', 'Baixa do apLIS — lote(s) 5191 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1b8a3cc6-65d3-5f0b-833a-baf85917700d', '862a4d85-d973-5d9d-9ad2-c7538a7e35f8', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1b8a3cc6-65d3-5f0b-833a-baf85917700d');

-- NF 8579 | CÂMARA DOS DEPUTADOS | lote(s) 5312
DELETE FROM glosas WHERE id_glosa IN ('bee1055c-6c6f-4f47-ac68-876e26a01ec4', 'ea16593f-3d31-41c4-941e-b1bf5ca372ac');
DELETE FROM recebimentos WHERE id_receb IN ('9f1457d3-e764-4c69-a775-0ad1c72ecfd6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e', DATE '2026-05-26', DATE '2026-07-20', 15949.43, 15949.43, 'recebido', 'Baixa do apLIS — lote(s) 5312 (recebido em 20/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e');

-- sem número | FASCAL | lote(s) 5124
DELETE FROM glosas WHERE id_glosa IN ('260fbb36-ef1b-4ef8-84e8-69ed15a099cb');
DELETE FROM recebimentos WHERE id_receb IN ('615a2cbe-2e8f-483c-886b-5a0013308342');
UPDATE lotes SET valor_total = 6891.66 WHERE id_lote = '50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5';
UPDATE notas SET valor_total = 6891.66 WHERE id_nota = '2e7cbc31-7039-5dbf-99be-94d7bdf98ac7';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-01-16', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-02-05', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-02-06', 540.29, 540.29, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-02-09', 1203.07, 1203.07, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-02-13', 710.91, 710.91, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 13/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', DATE '2026-03-30', DATE '2026-02-25', 864.13, 864.13, 'recebido', 'Baixa do apLIS — lote(s) 5124 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7', '50ef303e-d9b7-5aff-9e58-4a9a3bf74fd5', 3419.56, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7');

-- NF 8639 | GEAP Autogestão em Saúde | lote(s) 5156
DELETE FROM glosas WHERE id_glosa IN ('40653cfb-148d-4d8a-8957-be84736f12e7');
DELETE FROM recebimentos WHERE id_receb IN ('191b12de-e038-44b5-84a3-0a47640f4914');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', DATE '2026-06-04', DATE '2026-08-20', 11884.60, 11884.60, 'recebido', 'Baixa do apLIS — lote(s) 5156 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f11c04b6-750d-531b-bb77-8e0d8dc7f233', 'd00f07bb-0b95-5b66-9ce3-caa19ebe3cff', 529.20, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f11c04b6-750d-531b-bb77-8e0d8dc7f233');

-- sem número | PMDF | lote(s) 5181
DELETE FROM glosas WHERE id_glosa IN ('7784cc50-612e-498b-8271-47c208f5860d');
DELETE FROM recebimentos WHERE id_receb IN ('08a63e1b-549d-4017-b957-38c8c6b3b6ac');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', DATE '2026-04-10', DATE '2026-07-30', 12875.81, 12875.81, 'recebido', 'Baixa do apLIS — lote(s) 5181 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('aa188b1d-db94-5157-9cb4-efe7b97ce933', '822a3d15-3b90-5a0a-b5a1-c564d8fc5a51', 340.26, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('aa188b1d-db94-5157-9cb4-efe7b97ce933');

-- sem número | PMDF | lote(s) 5176
DELETE FROM glosas WHERE id_glosa IN ('dfd8dd14-1880-47c9-a1b4-3e05f4e22b32');
DELETE FROM recebimentos WHERE id_receb IN ('bc09008f-310c-41ff-8db5-053e621ed113');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', DATE '2026-04-10', DATE '2026-07-30', 28735.34, 28735.34, 'recebido', 'Baixa do apLIS — lote(s) 5176 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14', '6f7812a4-cfa2-502b-a89e-bde3fa0e9d56', 8.88, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14');

-- sem número | PMDF | lote(s) 5186
DELETE FROM glosas WHERE id_glosa IN ('4ea02ba6-cc7a-4562-959a-6c92e3d9566f');
DELETE FROM recebimentos WHERE id_receb IN ('ec0de18d-739e-47ff-ba09-aa2d88227fe6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', DATE '2026-04-10', DATE '2026-07-30', 8095.55, 8095.55, 'recebido', 'Baixa do apLIS — lote(s) 5186 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5fe9af1c-9874-5791-940e-2a19ea15b44b', 'ab78c598-617f-5e64-8770-b9163a72bc3c', 408.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5fe9af1c-9874-5791-940e-2a19ea15b44b');

-- sem número | PMDF | lote(s) 5178
DELETE FROM glosas WHERE id_glosa IN ('f6d3124e-4335-4a80-a9d6-de8b0a3a1922');
DELETE FROM recebimentos WHERE id_receb IN ('b56d11e7-41da-4691-ba09-bd32f5238f5b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', DATE '2026-04-10', DATE '2026-07-30', 50809.42, 50809.42, 'recebido', 'Baixa do apLIS — lote(s) 5178 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', 'e9c986c7-cfce-5cba-b3a8-28cb803eb5be', 2714.15, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('336a2b24-8231-50d4-aa48-cb4cc40b911a', 'e9c986c7-cfce-5cba-b3a8-28cb803eb5be', 8.88, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('336a2b24-8231-50d4-aa48-cb4cc40b911a');

-- sem número | PMDF | lote(s) 5271
DELETE FROM recebimentos WHERE id_receb IN ('05c6120f-751a-4a57-aae8-8fd8c5098d13');
UPDATE lotes SET valor_total = 711.63 WHERE id_lote = 'dd2e53ed-75eb-53db-966d-f7a6295d1c0a';
UPDATE notas SET valor_total = 711.63 WHERE id_nota = '4cee8078-2f18-5eae-b8fd-9751101a4558';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4cee8078-2f18-5eae-b8fd-9751101a4558', DATE '2026-04-22', DATE '2026-07-30', 1106.98, 1106.98, 'recebido', 'Baixa do apLIS — lote(s) 5271 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4cee8078-2f18-5eae-b8fd-9751101a4558');

-- sem número | PMDF | lote(s) 5277
DELETE FROM glosas WHERE id_glosa IN ('ff7d5659-99c6-451a-9c64-11c0303d895e');
DELETE FROM recebimentos WHERE id_receb IN ('5df04a0b-cdf1-4709-bbc4-b9254cb39d7e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', DATE '2026-04-23', DATE '2026-07-30', 4875.24, 4875.24, 'recebido', 'Baixa do apLIS — lote(s) 5277 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('7b5c03ba-01c7-53be-9436-c841f59d127d', 'e748c127-45de-5c48-988b-d81354b16276', 311.47, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('7b5c03ba-01c7-53be-9436-c841f59d127d');

-- sem número | PMDF | lote(s) 5278
DELETE FROM glosas WHERE id_glosa IN ('7451e91f-5cf5-40cb-b7ae-c152afc3b89a');
DELETE FROM recebimentos WHERE id_receb IN ('dbc41b32-f87a-4f54-b768-2f595699b022');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', DATE '2026-04-23', DATE '2026-07-30', 9015.76, 9015.76, 'recebido', 'Baixa do apLIS — lote(s) 5278 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('eec72b20-cc59-52ec-95c0-f9399013dbdd', '9eae3e15-c656-508a-87e2-f346a3238df2', 527.80, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('eec72b20-cc59-52ec-95c0-f9399013dbdd');

-- sem número | PMDF | lote(s) 5279
DELETE FROM glosas WHERE id_glosa IN ('b91bd1e0-e305-40d9-98d9-b97ce2a11e9d');
DELETE FROM recebimentos WHERE id_receb IN ('ea25aef5-1683-41cf-9d2e-014e9913ef74');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', DATE '2026-04-24', DATE '2026-07-30', 8460.62, 8460.62, 'recebido', 'Baixa do apLIS — lote(s) 5279 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', '3380126a-ffba-5b8a-9ff7-3ac125a1df6b', 295.54, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0dbfcd74-9e34-5f0d-9df9-432f00100b52', '3380126a-ffba-5b8a-9ff7-3ac125a1df6b', 16.12, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0dbfcd74-9e34-5f0d-9df9-432f00100b52');

-- sem número | PMDF | lote(s) 5274
DELETE FROM glosas WHERE id_glosa IN ('1f755189-2380-4002-a2d4-4729d78d2529');
DELETE FROM recebimentos WHERE id_receb IN ('0d75a88f-29c2-4759-be60-cf680b9246b1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', DATE '2026-04-24', DATE '2026-09-10', 8772.45, 8772.45, 'recebido', 'Baixa do apLIS — lote(s) 5274 (recebido em 10/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5916a2ad-b29f-5f30-b89a-0b84452d66d5', '44042b56-6f77-5dd7-b0b7-3e5e548495fa', 624.40, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5916a2ad-b29f-5f30-b89a-0b84452d66d5');

-- sem número | PMDF | lote(s) 5275
DELETE FROM glosas WHERE id_glosa IN ('56d75096-b723-4aea-abe2-700d55b0f6c4');
DELETE FROM recebimentos WHERE id_receb IN ('d6dd0d1b-34c5-4cf6-8370-c5ddcc3930da');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', DATE '2026-04-24', DATE '2026-07-30', 7916.67, 7916.67, 'recebido', 'Baixa do apLIS — lote(s) 5275 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf', '0b8a1e8e-2d02-5ff2-a46a-052cf918b692', 375.26, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf');

-- sem número | PMDF | lote(s) 5273
DELETE FROM glosas WHERE id_glosa IN ('13dffaca-bff3-4596-830d-314956ca74ab');
DELETE FROM recebimentos WHERE id_receb IN ('6e7c42e8-0564-47c4-829f-e4fbbe9e7210');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', DATE '2026-04-24', DATE '2026-07-30', 1983.81, 1983.81, 'recebido', 'Baixa do apLIS — lote(s) 5273 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ee9b91f1-263a-563f-ae05-98e95b5823b3', '18fa32dc-6956-5a93-8a24-d762b0223df5', 33.42, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ee9b91f1-263a-563f-ae05-98e95b5823b3');

-- sem número | PMDF | lote(s) 5285
DELETE FROM glosas WHERE id_glosa IN ('e8ebf88c-e62a-4661-9c02-147ddaf36db0');
DELETE FROM recebimentos WHERE id_receb IN ('233766c7-a902-4b9e-8a48-a7f4a236bc0d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', DATE '2026-04-24', DATE '2026-07-30', 5027.49, 5027.49, 'recebido', 'Baixa do apLIS — lote(s) 5285 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('7530a0a6-d8be-5589-97ca-d576f28ad8f9', '63dc3855-1b3a-5e30-b67d-37dddaad9337', 458.43, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('7530a0a6-d8be-5589-97ca-d576f28ad8f9');

-- sem número | PMDF | lote(s) 5286
DELETE FROM glosas WHERE id_glosa IN ('df6c1e69-3bdf-403c-84ac-0922baa30d09');
DELETE FROM recebimentos WHERE id_receb IN ('99192b84-c441-473f-8cd2-5ac9a90aae3b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', DATE '2026-04-24', DATE '2026-07-30', 3660.10, 3660.10, 'recebido', 'Baixa do apLIS — lote(s) 5286 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('41eaee45-0cc3-58ad-976f-a4fae9243f29', '2f1924fc-fd2a-5a7e-b599-67e53ee9cb27', 109.58, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('41eaee45-0cc3-58ad-976f-a4fae9243f29');

-- sem número | PMDF | lote(s) 5309
DELETE FROM glosas WHERE id_glosa IN ('22ecd22d-ac3e-4c9b-910d-5643e8027622');
DELETE FROM recebimentos WHERE id_receb IN ('6a34ebc0-1f7a-44f0-9b7c-7c2194b71073');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', DATE '2026-04-24', DATE '2026-07-30', 8451.85, 8451.85, 'recebido', 'Baixa do apLIS — lote(s) 5309 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('99fa1782-0ccf-5f37-92e4-167cf743e91d', 'cb12794e-e79d-5669-a645-4c504f3ad781', 283.06, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('99fa1782-0ccf-5f37-92e4-167cf743e91d');

-- sem número | PMDF | lote(s) 5319
DELETE FROM glosas WHERE id_glosa IN ('5ecbb3a8-5f85-420a-805f-905cae425be4');
DELETE FROM recebimentos WHERE id_receb IN ('25634352-62c6-44bd-81fb-7e67278429f6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', DATE '2026-04-27', DATE '2026-09-10', 9218.88, 9218.88, 'recebido', 'Baixa do apLIS — lote(s) 5319 (recebido em 10/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9', 'bd455576-aa34-5f91-83ca-02adb258cd8f', 429.38, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9');

-- sem número | POSTAL SAÚDE | lote(s) 5151
DELETE FROM glosas WHERE id_glosa IN ('5dfe8199-4122-4a9b-803e-abc087a7c39a');
DELETE FROM recebimentos WHERE id_receb IN ('1e6020a9-e9d9-4439-93dc-66dabf118734');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', DATE '2026-05-03', DATE '2026-04-29', 18342.80, 18342.80, 'recebido', 'Baixa do apLIS — lote(s) 5151 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ea93e743-b93e-5dae-9161-8426d6c410b7', '6ff3b728-7885-55a5-b8e7-6ceb17f79d61', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ea93e743-b93e-5dae-9161-8426d6c410b7');

-- sem número | LAB PLANASSISTE | lote(s) 5180
DELETE FROM glosas WHERE id_glosa IN ('2f2e7b20-2e8b-4372-b411-19b0f619c6be', '881a8876-4816-4b86-888a-e9155475e0ec');
DELETE FROM recebimentos WHERE id_receb IN ('86b0338f-eaec-4658-9a63-c22960deee01');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', DATE '2026-04-09', DATE '2026-05-20', 8987.83, 8987.83, 'recebido', 'Baixa do apLIS — lote(s) 5180 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', DATE '2026-04-09', DATE '2026-05-22', 912.40, 912.40, 'recebido', 'Baixa do apLIS — lote(s) 5180 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8', 29.02, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('816e5587-0936-5c5c-8ae4-5bd201793a72', '65504b8f-bb23-50cf-8ba3-07ac61dec1f8', 304.12, 'ITEM NÃO CONTRATADO', '3142', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('816e5587-0936-5c5c-8ae4-5bd201793a72');

-- sem número | SIS SENADO | lote(s) 5276
DELETE FROM glosas WHERE id_glosa IN ('2dce361f-a8a8-4476-ab60-97eb52fc83ca');
DELETE FROM recebimentos WHERE id_receb IN ('d367f765-972c-4cbc-a268-0a857789a218');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', DATE '2026-05-26', DATE '2026-06-01', 14791.69, 14791.69, 'recebido', 'Baixa do apLIS — lote(s) 5276 (recebido em 01/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', '91c09eae-bf95-5a35-b9ac-0e71b240b864', 515.73, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42', '91c09eae-bf95-5a35-b9ac-0e71b240b864', 515.73, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42');

-- sem número | SAUDE CAIXA | lote(s) 5283
DELETE FROM recebimentos WHERE id_receb IN ('d48b3357-9cc6-4319-b6bf-29dbcb3a0267');
UPDATE lotes SET valor_total = 24885.75 WHERE id_lote = 'a31b4860-4b9b-5b1f-8f11-65af3ecfb161';
UPDATE notas SET valor_total = 24885.75 WHERE id_nota = '08587bb0-e5f6-5e1b-919e-a20a76522a38';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('08587bb0-e5f6-5e1b-919e-a20a76522a38', DATE '2026-04-25', DATE '2026-04-27', 24885.75, 24885.75, 'recebido', 'Baixa do apLIS — lote(s) 5283 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('08587bb0-e5f6-5e1b-919e-a20a76522a38');

-- sem número | SAUDE CAIXA | lote(s) 5328
DELETE FROM glosas WHERE id_glosa IN ('38784513-3b75-4533-b899-40eebf4a6d43');
DELETE FROM recebimentos WHERE id_receb IN ('f7003de1-07e5-4502-b932-74e8a7002199');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', DATE '2026-04-29', DATE '2026-05-25', 1292.71, 1292.71, 'recebido', 'Baixa do apLIS — lote(s) 5328 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3856d373-0efb-5756-a9b3-0b25bb3565a4', 'fb4859d5-e463-567e-882b-a732e4eef914', 139.17, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3856d373-0efb-5756-a9b3-0b25bb3565a4');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5090
DELETE FROM glosas WHERE id_glosa IN ('3a191a13-c73e-47e3-9bb2-7ec69432954a');
DELETE FROM recebimentos WHERE id_receb IN ('1826033b-6b5a-4d8f-b1cc-8905f2742449');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-01-30', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 30/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-02-02', 2904.98, 2904.98, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-02-03', 911.77, 911.77, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 03/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-02-04', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 04/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-02-16', 80.81, 80.81, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 16/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', DATE '2026-04-06', DATE '2026-04-15', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5090 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b', 11.99, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b', 88.24, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb', 'b6e6716c-1052-55c1-8294-e1f8bbfef62b', 9.71, 'Código 3309 (do apLIS)', '3309', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2f6a5f59-b633-597f-ae67-0e23b54ec0eb');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5087
DELETE FROM glosas WHERE id_glosa IN ('fdb77238-75b0-445b-be6a-ea68920a6008');
DELETE FROM recebimentos WHERE id_receb IN ('53e53f67-b0bf-4b95-9155-7b9bca05fc1e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-06', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-09', 511.50, 511.50, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-10', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-12', 990.10, 990.10, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 12/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-13', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 13/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-18', 212.85, 212.85, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 18/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-19', 170.50, 170.50, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 19/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-20', 682.38, 682.38, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 20/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-21', 4109.20, 4109.20, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 21/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-23', 2536.06, 2536.06, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 23/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-24', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 24/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-02-25', 452.03, 452.03, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 25/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', DATE '2026-04-07', DATE '2026-04-15', 1288.01, 1288.01, 'recebido', 'Baixa do apLIS — lote(s) 5087 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', 50.32, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', 25.81, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', 176.48, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5e99e53d-15f5-57bd-b71e-47a118c91764', 'fc946d87-53a4-5572-af0b-b5151a8a4c50', 9.71, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5e99e53d-15f5-57bd-b71e-47a118c91764');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 4928
DELETE FROM glosas WHERE id_glosa IN ('7a6aa43d-f70b-4609-b5ab-7dc002525afa');
DELETE FROM recebimentos WHERE id_receb IN ('6bca3b23-1629-4cef-836a-16075078f0de');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-06', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 06/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-14', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 14/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-15', 140.37, 140.37, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-16', 212.85, 212.85, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 16/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-17', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 17/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-19', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 19/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-20', 2071.93, 2071.93, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 20/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-21', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 21/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-22', 144.24, 144.24, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 22/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-23', 438.58, 438.58, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 23/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-26', 754.08, 754.08, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 26/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-29', 504.09, 504.09, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 29/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-01-30', 1215.82, 1215.82, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 30/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-02-02', 871.42, 871.42, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-02-04', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 04/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', DATE '2026-04-07', DATE '2026-04-15', 1677.56, 1677.56, 'recebido', 'Baixa do apLIS — lote(s) 4928 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', 2.22, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', 373.29, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1b863d5c-7de2-52ca-9f9c-3525e9684077', 'ffdc3afc-588e-5fc9-9d18-11fcc8831cf1', 9.71, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1b863d5c-7de2-52ca-9f9c-3525e9684077');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5089
DELETE FROM glosas WHERE id_glosa IN ('50e05003-3c70-4cb4-94b8-ebfed36c41f6');
DELETE FROM recebimentos WHERE id_receb IN ('68cba76f-01f9-4f4f-ab5d-f57df83e2bde');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-01-09', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 09/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-01-23', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 23/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-02-04', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 04/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-02-05', 910.97, 910.97, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 05/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-02-06', 2558.69, 2558.69, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 06/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-02-07', 1635.21, 1635.21, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 07/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-02-09', 3851.52, 3851.52, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-04-15', 1665.05, 1665.05, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b122670-4fa8-5731-9548-195e64209d49', DATE '2026-04-07', DATE '2026-04-16', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5089 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5b122670-4fa8-5731-9548-195e64209d49');

-- NF 9076 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5088
DELETE FROM glosas WHERE id_glosa IN ('e29fc9a0-7bc9-4fc9-953b-5cd826f305b2');
DELETE FROM recebimentos WHERE id_receb IN ('a7c8e02e-b3d9-4616-918d-ec73309309dc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', DATE '2026-04-07', DATE '2026-08-20', 12738.16, 12738.16, 'recebido', 'Baixa do apLIS — lote(s) 5088 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61', 9.71, 'COBRANÇA DE PROCEDIMENTO SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '1813', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a', '2719eeda-b4f4-5efa-81d7-07e04ad7dc61', 137.67, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5136
DELETE FROM glosas WHERE id_glosa IN ('9bf17c73-ddf2-4e29-aca7-1528e1771dca');
DELETE FROM recebimentos WHERE id_receb IN ('9318cd3a-bf15-45fb-bb5d-492bd8888bd8');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', DATE '2026-04-07', DATE '2026-02-27', 912.23, 912.23, 'recebido', 'Baixa do apLIS — lote(s) 5136 (recebido em 27/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', DATE '2026-04-07', DATE '2026-02-28', 2893.38, 2893.38, 'recebido', 'Baixa do apLIS — lote(s) 5136 (recebido em 28/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', DATE '2026-04-07', DATE '2026-03-02', 2648.57, 2648.57, 'recebido', 'Baixa do apLIS — lote(s) 5136 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', DATE '2026-04-07', DATE '2026-03-03', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5136 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', DATE '2026-04-07', DATE '2026-04-15', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5136 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('7796239d-32c4-53c3-9ca7-2d06f0dafd88', '862c2f1a-a3dd-5e71-8ef9-648ae130f27f', 12.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('7796239d-32c4-53c3-9ca7-2d06f0dafd88');

-- NF 8193 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5315
DELETE FROM glosas WHERE id_glosa IN ('d9fb821e-a92a-4728-bd2b-64408b7e42ce');
DELETE FROM recebimentos WHERE id_receb IN ('549cb75c-18ad-4895-b421-fef76c9257aa');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', DATE '2026-05-05', DATE '2026-05-20', 11684.34, 11684.34, 'recebido', 'Baixa do apLIS — lote(s) 5315 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('10a13bef-5968-548b-9cb0-01eae11ed874', 'bc53228e-a35c-5cef-b42e-7613300ebb31', 1.93, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('10a13bef-5968-548b-9cb0-01eae11ed874');

-- NF 8193 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5317
DELETE FROM glosas WHERE id_glosa IN ('17363822-2544-4272-904d-371a0e0c962e');
DELETE FROM recebimentos WHERE id_receb IN ('0bb6a77c-0309-4157-bcd6-39441307aa62');
UPDATE lotes SET valor_total = 13077.39 WHERE id_lote = '53e5196b-4f2a-5b6f-a58e-a552838ecac5';
UPDATE notas SET valor_total = 13077.39 WHERE id_nota = '5c25fb12-b53d-51b2-9913-d79ff26df029';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c25fb12-b53d-51b2-9913-d79ff26df029', DATE '2026-05-05', DATE '2026-05-18', 9633.23, 9633.23, 'recebido', 'Baixa do apLIS — lote(s) 5317 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5c25fb12-b53d-51b2-9913-d79ff26df029');

-- sem número | 090 SULAMERICA | lote(s) 5091
DELETE FROM glosas WHERE id_glosa IN ('27c390d4-fec4-4d0d-b77d-8321ab93bed2');
DELETE FROM recebimentos WHERE id_receb IN ('dee793c3-c4d9-4dfa-bc02-2f3dfa3639f1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('433564bb-3cc3-5b06-b41c-47e77e91ed76', DATE '2026-05-05', DATE '2026-05-18', 676.34, 676.34, 'recebido', 'Baixa do apLIS — lote(s) 5091 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('433564bb-3cc3-5b06-b41c-47e77e91ed76');

-- NF 8193 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5316
DELETE FROM glosas WHERE id_glosa IN ('3246fdef-b973-4900-a4bf-9e1cd6107966');
DELETE FROM recebimentos WHERE id_receb IN ('52a141a2-70e6-42a7-b9ae-ff80c54f64a0');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', DATE '2026-05-05', DATE '2026-05-18', 15205.57, 15205.57, 'recebido', 'Baixa do apLIS — lote(s) 5316 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b9528259-50ea-5e5d-84f4-3239dcd4300d', '29ce0f2d-ec5b-5777-9d42-29f0ffb3c133', 22.50, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b9528259-50ea-5e5d-84f4-3239dcd4300d');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5329
DELETE FROM glosas WHERE id_glosa IN ('15bb4aee-c252-4ab0-9a9a-1291ec575a38');
DELETE FROM recebimentos WHERE id_receb IN ('42fd243f-aca2-4edf-82f2-e80d09a70b27');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', DATE '2026-05-05', DATE '2026-05-18', 123.08, 123.08, 'recebido', 'Baixa do apLIS — lote(s) 5329 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07', 'bf296ba8-ad3f-56d3-be9c-17e1c39d2f4b', 123.08, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('df9fc9dc-57a2-53d8-9c1e-6628ba813d07');

-- NF 8193 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5314
DELETE FROM glosas WHERE id_glosa IN ('12e1cdf4-7f2d-4ba5-a4fb-9010187daf7d');
DELETE FROM recebimentos WHERE id_receb IN ('6dd6ce9f-7de7-47f8-8461-6461ec6242de');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', DATE '2026-05-05', DATE '2026-05-18', 14464.71, 14464.71, 'recebido', 'Baixa do apLIS — lote(s) 5314 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6', '61208d68-ec38-5c2b-a2d2-0d8b474b7d16', 389.42, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e1e1a5b0-c4ec-504c-9115-9dea41d858c6');

-- NF 8193 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5344
DELETE FROM glosas WHERE id_glosa IN ('51e6550d-4304-48e6-99ba-2e4b49e264d5');
DELETE FROM recebimentos WHERE id_receb IN ('3eae00d1-47b5-4f0d-9416-ea556038065b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('799ddb9c-ce91-579b-ad88-31dff8a3db2b', DATE '2026-05-05', DATE '2026-05-18', 1804.61, 1804.61, 'recebido', 'Baixa do apLIS — lote(s) 5344 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('799ddb9c-ce91-579b-ad88-31dff8a3db2b');

-- NF 8859 | TJDFT | lote(s) 5204
DELETE FROM glosas WHERE id_glosa IN ('9b88fc2a-843a-47f4-97cf-2d428db22f69');
DELETE FROM recebimentos WHERE id_receb IN ('27c76b25-df63-416f-8f52-f2f24b8d840a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', DATE '2026-04-13', DATE '2026-06-13', 8737.61, 8737.61, 'recebido', 'Baixa do apLIS — lote(s) 5204 (recebido em 13/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('369f93c1-8dbc-5828-a5aa-5919afcaef10', '36672c52-9dee-5d34-ae27-9ac9607d1504', 70.48, 'PROCEDIMENTO NÃO AUTORIZADO', '1815', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('369f93c1-8dbc-5828-a5aa-5919afcaef10');

-- sem número | TJDFT | lote(s) 5212
DELETE FROM glosas WHERE id_glosa IN ('8118817c-e1ed-4cde-9db1-99dab8190612');
DELETE FROM recebimentos WHERE id_receb IN ('32cc105e-e80b-46c2-939f-302e005342c3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', DATE '2026-04-13', DATE '2026-06-13', 8658.86, 8658.86, 'recebido', 'Baixa do apLIS — lote(s) 5212 (recebido em 13/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2868eafc-6b64-5046-a6c5-9316aa3b7219', '912c8373-14e1-5b7c-baa9-199f386032cd', 967.22, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2868eafc-6b64-5046-a6c5-9316aa3b7219');

-- sem número | STF | lote(s) 4968
DELETE FROM glosas WHERE id_glosa IN ('c582e8f0-baa0-4ead-806f-9755c561b310');
DELETE FROM recebimentos WHERE id_receb IN ('63db995e-a33b-4116-ae8c-ecf36ebbe4f7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', DATE '2026-04-17', DATE '2026-04-27', 3357.69, 3357.69, 'recebido', 'Baixa do apLIS — lote(s) 4968 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('10e93427-93b3-5823-a87d-fd495f9cb15b', 'ef757d35-8a9f-5838-b581-3bd4949e7615', 0.14, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('10e93427-93b3-5823-a87d-fd495f9cb15b');

-- sem número | STF | lote(s) 5172
DELETE FROM glosas WHERE id_glosa IN ('45968d5a-ccec-49e8-ac14-1171c7206efd');
DELETE FROM recebimentos WHERE id_receb IN ('b7069da2-7f71-4d05-b66c-59806bfc1046');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', DATE '2026-04-21', DATE '2026-04-27', 792.51, 792.51, 'recebido', 'Baixa do apLIS — lote(s) 5172 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501', 'cc29ab67-a8f9-56ce-83d9-1ffeea56c42e', 0.02, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501');

-- sem número | STF | lote(s) 5246
DELETE FROM glosas WHERE id_glosa IN ('0aab477d-62d9-4354-ae6d-1e8253f76cfd');
DELETE FROM recebimentos WHERE id_receb IN ('94e566a6-bcca-4586-8b4d-86baca914c5e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', DATE '2026-05-01', DATE '2026-04-27', 955.06, 955.06, 'recebido', 'Baixa do apLIS — lote(s) 5246 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05', '0202e093-619a-5f96-8841-1c0c07d602f4', 0.03, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05');

-- sem número | STJ | lote(s) 5237
DELETE FROM glosas WHERE id_glosa IN ('906db219-a1f7-4bd9-a154-23da692e955b');
DELETE FROM recebimentos WHERE id_receb IN ('c973612a-1fbd-4ffe-a3f3-4e1d4a34e896');
UPDATE lotes SET valor_total = 10132.79 WHERE id_lote = 'f574b504-9abe-51a4-bdcf-2f66bb142ea7';
UPDATE notas SET valor_total = 10132.79 WHERE id_nota = 'be10af52-b85b-578a-b2c8-89f90535f040';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('be10af52-b85b-578a-b2c8-89f90535f040', DATE '2026-04-15', DATE '2026-05-15', 10132.79, 10132.79, 'recebido', 'Baixa do apLIS — lote(s) 5237 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('be10af52-b85b-578a-b2c8-89f90535f040');

-- NF 8192 | TRE-SAÚDE | lote(s) 5120
DELETE FROM glosas WHERE id_glosa IN ('e355c12d-a867-4fb7-992e-f2d20325d541');
DELETE FROM recebimentos WHERE id_receb IN ('a304c2c6-ebff-4c36-8475-1f207ae82aba');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8633a19e-43aa-5fba-a261-63b739011571', DATE '2026-04-01', DATE '2026-07-10', 787.28, 787.28, 'recebido', 'Baixa do apLIS — lote(s) 5120 (recebido em 10/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8633a19e-43aa-5fba-a261-63b739011571');

-- sem número | TST | lote(s) 5025
DELETE FROM recebimentos WHERE id_receb IN ('940ea174-ce40-44c2-aaf8-6aa3925431fc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42', DATE '2026-04-20', DATE '2026-04-24', 471.16, 471.16, 'recebido', 'Baixa do apLIS — lote(s) 5025 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42', 'e85a1bda-6ec4-5b23-8e5b-1ab00d6ac71a', 0.05, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42');

-- sem número | TST | lote(s) 5232
DELETE FROM glosas WHERE id_glosa IN ('7943750b-e957-44ce-aa2c-8c4a66287081');
DELETE FROM recebimentos WHERE id_receb IN ('cf180883-5657-40f1-8d0c-89250899e34f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', DATE '2026-04-20', DATE '2026-04-24', 8136.70, 8136.70, 'recebido', 'Baixa do apLIS — lote(s) 5232 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811', DATE '2026-04-20', DATE '2026-07-28', 22.50, 22.50, 'recebido', 'Baixa do apLIS — lote(s) 5232 (recebido em 28/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5117
DELETE FROM recebimentos WHERE id_receb IN ('3ba8d335-8deb-4a31-aa49-937101802226');
SELECT fat_recalcular_nota('dc8a7236-ef3e-5f5e-9f28-98ce29346b9a');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5116
DELETE FROM recebimentos WHERE id_receb IN ('20423211-23c3-4f3a-a725-a1c269d48f04');
SELECT fat_recalcular_nota('f9a2b565-f377-5009-953c-a0a85ff2ad42');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5115
DELETE FROM recebimentos WHERE id_receb IN ('944ae0a0-eecd-4c67-b0a1-574f7ac9ae36');
SELECT fat_recalcular_nota('13777d19-3621-5068-bc95-5ab5270cc626');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5168
DELETE FROM recebimentos WHERE id_receb IN ('a3a6168b-22e2-4122-8a6b-7d0c9ca7b189');
UPDATE lotes SET valor_total = 450.00 WHERE id_lote = '417fac73-ba3c-504a-b4c5-386085a45b14';
UPDATE notas SET valor_total = 450.00 WHERE id_nota = 'd445e1b3-e196-590d-9b53-dede00ec2ce9';
SELECT fat_recalcular_nota('d445e1b3-e196-590d-9b53-dede00ec2ce9');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5169
DELETE FROM recebimentos WHERE id_receb IN ('53dcc780-2a06-4cc1-b4e4-feafda6ec1a2');
UPDATE lotes SET valor_total = 230.94 WHERE id_lote = '65cfc3ce-e8c7-53c0-a871-6b5955fdf3ed';
UPDATE notas SET valor_total = 230.94 WHERE id_nota = 'c98b9a1a-6167-566d-bae5-d2f27ada5b4c';
SELECT fat_recalcular_nota('c98b9a1a-6167-566d-bae5-d2f27ada5b4c');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5243
DELETE FROM recebimentos WHERE id_receb IN ('ab019554-91bb-46a5-a2a8-cff185b7af6c');
UPDATE lotes SET valor_total = 1726.85 WHERE id_lote = 'd113976b-ed0a-55f9-b8bf-683c7577bb62';
UPDATE notas SET valor_total = 1726.85 WHERE id_nota = 'f325f7cf-7088-51d9-977a-93a6d2512718';
SELECT fat_recalcular_nota('f325f7cf-7088-51d9-977a-93a6d2512718');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5244
DELETE FROM recebimentos WHERE id_receb IN ('393e7a58-fe11-4a0c-b997-cec864c9a18f');
UPDATE lotes SET valor_total = 2355.00 WHERE id_lote = '7ab86c40-b25b-5050-aa5d-50c2c25f21a9';
UPDATE notas SET valor_total = 2355.00 WHERE id_nota = 'dbdf4884-2e9c-504b-9e03-b4ea0b66accc';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dbdf4884-2e9c-504b-9e03-b4ea0b66accc', DATE '2026-04-19', DATE '2026-03-20', 300.00, 300.00, 'recebido', 'Baixa do apLIS — lote(s) 5244 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dbdf4884-2e9c-504b-9e03-b4ea0b66accc');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5245
DELETE FROM recebimentos WHERE id_receb IN ('87831176-f596-4c91-9b30-c662fa84feea');
UPDATE lotes SET valor_total = 4396.49 WHERE id_lote = 'ad81b7f0-322d-5434-a1ab-c7946a2c5af8';
UPDATE notas SET valor_total = 4396.49 WHERE id_nota = '9adf32b8-909d-5870-8b08-bdf50239ac9d';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9adf32b8-909d-5870-8b08-bdf50239ac9d', DATE '2026-04-20', DATE '2026-03-20', 117.26, 117.26, 'recebido', 'Baixa do apLIS — lote(s) 5245 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9adf32b8-909d-5870-8b08-bdf50239ac9d');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5520
DELETE FROM recebimentos WHERE id_receb IN ('a622511f-77ef-4453-8876-ab98311e9149');
UPDATE lotes SET valor_total = 4076.19 WHERE id_lote = 'd8cfb74b-b96b-539e-9a1d-9fe5df310bda';
UPDATE notas SET valor_total = 4076.19 WHERE id_nota = 'acc130f0-a803-5628-8b57-f1df3f0d451b';
SELECT fat_recalcular_nota('acc130f0-a803-5628-8b57-f1df3f0d451b');

-- NF 8187 | TJDFT | lote(s) 5465
DELETE FROM recebimentos WHERE id_receb IN ('e1e399f8-375b-4497-a35f-3c106d30c723');
SELECT fat_recalcular_nota('c58ae245-f526-5d18-988e-8d6caef9d5ad');

-- NF 8187 | TJDFT | lote(s) 5466
DELETE FROM glosas WHERE id_glosa IN ('e945a9f6-e41f-470b-a43e-7117190a406b');
DELETE FROM recebimentos WHERE id_receb IN ('3097cbb7-c75e-4021-92c7-0070a2e67f19');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e43fc689-a7fd-5157-9d67-e1de02040bb1', DATE '2026-05-13', DATE '2026-07-17', 19968.58, 19968.58, 'recebido', 'Baixa do apLIS — lote(s) 5466 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e43fc689-a7fd-5157-9d67-e1de02040bb1');

-- NF 8186 | STJ | lote(s) 5503
DELETE FROM glosas WHERE id_glosa IN ('02c0d974-5438-4d2a-a2a3-cfbc387b217c');
DELETE FROM recebimentos WHERE id_receb IN ('ffd821fb-9d87-420b-bc4d-1aa5f4dfba05');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', DATE '2026-05-15', DATE '2026-07-01', 1848.01, 1848.01, 'recebido', 'Baixa do apLIS — lote(s) 5503 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5', 'bcfa9a69-ef78-5c11-bd5d-2c84534ff470', 76.85, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5');

-- NF 8186 | STJ | lote(s) 5504
DELETE FROM glosas WHERE id_glosa IN ('d6a695da-4f7a-4525-b834-e1dca850a009');
DELETE FROM recebimentos WHERE id_receb IN ('44891a6b-b32d-4313-a901-7948e1d1e396');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', DATE '2026-05-15', DATE '2026-07-01', 2378.08, 2378.08, 'recebido', 'Baixa do apLIS — lote(s) 5504 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62', '5ab14368-a29f-5881-9dc5-ed80bda48f8c', 2020.49, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3ce3a7a9-4a4b-5755-98cb-5eea94611a62');

-- NF 8186 | STJ | lote(s) 5527
DELETE FROM glosas WHERE id_glosa IN ('096d6973-8d99-40f8-9d73-54302912d31c');
DELETE FROM recebimentos WHERE id_receb IN ('e05d2ea3-8541-4835-8270-1628dbf5ed9d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', DATE '2026-05-15', DATE '2026-07-01', 9320.53, 9320.53, 'recebido', 'Baixa do apLIS — lote(s) 5527 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', '7573f0f5-1013-5e07-aba0-d2ab90b9e571', 334.56, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('08c620d9-37dc-5444-b051-4aa1c93612a0', '7573f0f5-1013-5e07-aba0-d2ab90b9e571', 978.61, 'NECESSÁRIO O ENVIO DO PEDIDO DO PROFISSIONAL SOLICITANTE', '3120', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('08c620d9-37dc-5444-b051-4aa1c93612a0');

-- NF 8186 | STJ | lote(s) 5528
DELETE FROM glosas WHERE id_glosa IN ('b3c8d4b9-27d3-441e-8246-1bfb30a01dd7');
DELETE FROM recebimentos WHERE id_receb IN ('16a8e556-2531-4dcd-b850-2cedf48d195c');
UPDATE lotes SET valor_total = 2456.31 WHERE id_lote = 'e43f610f-5aff-5834-ab10-ff05622abe0d';
UPDATE notas SET valor_total = 2456.31 WHERE id_nota = 'ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909', DATE '2026-05-15', DATE '2026-07-01', 2456.31, 2456.31, 'recebido', 'Baixa do apLIS — lote(s) 5528 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909');

-- NF 8066 | TRT | lote(s) 5368
DELETE FROM glosas WHERE id_glosa IN ('edade636-18ab-435a-922b-28f167d2d3aa');
DELETE FROM recebimentos WHERE id_receb IN ('9796cb21-aa9f-460c-a7b3-d2f41ac1ac2a');
UPDATE lotes SET valor_total = 1103.13 WHERE id_lote = 'd125d9bc-f212-5349-a77f-3ca402b53e97';
UPDATE notas SET valor_total = 1103.13 WHERE id_nota = 'eb52122b-77e0-5dad-9330-68c3e8c6549b';
SELECT fat_recalcular_nota('eb52122b-77e0-5dad-9330-68c3e8c6549b');

-- sem número | TST | lote(s) 5509
DELETE FROM glosas WHERE id_glosa IN ('e6e2a5ac-d8d3-4d6c-bb2f-52e2d98e0409');
DELETE FROM recebimentos WHERE id_receb IN ('07a8d4e5-17d1-4f0a-b189-273d5b5f8b9a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('15479d38-dae1-5aab-a660-d7a897b89a46', DATE '2026-05-20', DATE '2026-05-22', 13274.48, 13274.48, 'recebido', 'Baixa do apLIS — lote(s) 5509 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('15479d38-dae1-5aab-a660-d7a897b89a46');

-- sem número | TST | lote(s) 5510
DELETE FROM glosas WHERE id_glosa IN ('5f710dd2-bfc8-4f46-837b-d10ff21b71f6');
DELETE FROM recebimentos WHERE id_receb IN ('88d52178-940a-4448-acbd-a827554b5863');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', DATE '2026-05-20', DATE '2026-05-22', 2034.26, 2034.26, 'recebido', 'Baixa do apLIS — lote(s) 5510 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c692fe6-a941-5412-86bb-61c70e87d34f', '789e14d4-3de8-595c-881b-4652a6931d00', 34.45, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5c692fe6-a941-5412-86bb-61c70e87d34f');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5383
DELETE FROM recebimentos WHERE id_receb IN ('d0bc6afc-cc90-412c-b69f-353322abd10f');
UPDATE lotes SET valor_total = 1681.31 WHERE id_lote = 'f19cb249-8784-532f-82ab-d90a52855bfa';
UPDATE notas SET valor_total = 1681.31 WHERE id_nota = '2956e896-591f-5a4a-866e-c52330758497';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2956e896-591f-5a4a-866e-c52330758497', DATE '2026-05-20', DATE '2026-03-24', 248.56, 248.56, 'recebido', 'Baixa do apLIS — lote(s) 5383 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2956e896-591f-5a4a-866e-c52330758497');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5384
DELETE FROM recebimentos WHERE id_receb IN ('3fa2e80a-4294-4721-98a9-c5105b21053b');
UPDATE lotes SET valor_total = 236.97 WHERE id_lote = '5d6bd59c-37e5-59a7-8201-2474387a5dc0';
UPDATE notas SET valor_total = 236.97 WHERE id_nota = 'c99326f9-68b1-5c33-81ad-64286d016769';
SELECT fat_recalcular_nota('c99326f9-68b1-5c33-81ad-64286d016769');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5382
DELETE FROM recebimentos WHERE id_receb IN ('225e6981-631a-45cd-b010-cd1cb712e142');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cf114bf3-d28d-51a7-9297-5859f6b4456c', DATE '2026-04-02', DATE '2026-03-24', 150.00, 150.00, 'recebido', 'Baixa do apLIS — lote(s) 5382 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cf114bf3-d28d-51a7-9297-5859f6b4456c');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5433
DELETE FROM recebimentos WHERE id_receb IN ('5d69250a-0b1f-4345-af19-71876d60680f');
SELECT fat_recalcular_nota('c99bcd37-5335-53cb-939d-5961b8973bd2');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5434
DELETE FROM recebimentos WHERE id_receb IN ('205df520-d63c-478d-b2ff-766ec6566545');
SELECT fat_recalcular_nota('67b56495-6c0c-5844-88fe-81f0c37cb266');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5432
DELETE FROM recebimentos WHERE id_receb IN ('66cd129f-512e-4986-b941-bdfdbf64ed91');
SELECT fat_recalcular_nota('805ddaa5-9987-5a28-9102-b184a2eb697f');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5519
DELETE FROM recebimentos WHERE id_receb IN ('d2568c99-95a8-4e33-a9a4-4add5044e69f');
SELECT fat_recalcular_nota('63883190-8c55-50b9-b184-6ef367ef1a17');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5521
DELETE FROM recebimentos WHERE id_receb IN ('fbd03a39-18f5-4805-8aa7-5ae52fc43838');
SELECT fat_recalcular_nota('b25d8956-6ecf-50a5-92e7-6da925e36d79');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5583
DELETE FROM recebimentos WHERE id_receb IN ('db8b059d-f2bf-4d38-971d-061713117e3a');
SELECT fat_recalcular_nota('0c70e848-c408-56ef-bf11-630ac9d2fd1e');

-- sem número | Medigest Centro de Medicina Digestiva | lote(s) 5582
DELETE FROM recebimentos WHERE id_receb IN ('052b6ac0-ce66-49d2-ad44-c342cf3eb24d');
SELECT fat_recalcular_nota('721e45be-02a1-5e3a-9eb3-8328e114e7b7');

-- sem número | AMHP-DF | lote(s) 5472
DELETE FROM recebimentos WHERE id_receb IN ('9cb1d014-a092-40b3-a043-d92d13d97ca4');
UPDATE lotes SET valor_total = 1475.00 WHERE id_lote = 'db8baadc-64ad-5445-bb15-7be594f329c9';
UPDATE notas SET valor_total = 1475.00 WHERE id_nota = '6179f6b7-ed42-5ea9-8823-bed4d501cf89';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6179f6b7-ed42-5ea9-8823-bed4d501cf89', DATE '2026-06-13', DATE '2025-12-31', 1159.83, 1159.83, 'recebido', 'Baixa do apLIS — lote(s) 5472 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6179f6b7-ed42-5ea9-8823-bed4d501cf89');

-- sem número | AMHP-DF | lote(s) 5612
DELETE FROM recebimentos WHERE id_receb IN ('a094a917-42b3-4c5a-a2f2-6e698e271c9a');
UPDATE lotes SET valor_total = 2846.08 WHERE id_lote = '1bd78509-0043-5753-b942-3bfae5909531';
UPDATE notas SET valor_total = 2846.08 WHERE id_nota = '3a37c116-484d-564d-841b-4b994b94d74c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3a37c116-484d-564d-841b-4b994b94d74c', DATE '2026-06-28', DATE '2026-07-03', 1503.93, 1503.93, 'recebido', 'Baixa do apLIS — lote(s) 5612 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3a37c116-484d-564d-841b-4b994b94d74c');

-- sem número | AMHP-DF | lote(s) 5493
DELETE FROM recebimentos WHERE id_receb IN ('814f950f-4f06-4ea1-b085-8e5f0e0c5b6f');
UPDATE lotes SET valor_total = 2332.41 WHERE id_lote = 'd4673f81-bed8-52e5-9f64-5523b9199d07';
UPDATE notas SET valor_total = 2332.41 WHERE id_nota = '65f5de7a-471a-501c-a706-aae67d66a737';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65f5de7a-471a-501c-a706-aae67d66a737', DATE '2026-06-19', DATE '2026-06-15', 226.77, 226.77, 'recebido', 'Baixa do apLIS — lote(s) 5493 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65f5de7a-471a-501c-a706-aae67d66a737', DATE '2026-06-19', DATE '2026-07-31', 1912.48, 1912.48, 'recebido', 'Baixa do apLIS — lote(s) 5493 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('65f5de7a-471a-501c-a706-aae67d66a737');

-- sem número | AMHP-DF | lote(s) 5616
DELETE FROM recebimentos WHERE id_receb IN ('11c46f3b-149c-4bac-a4a8-3723613418a3');
UPDATE lotes SET valor_total = 822.76 WHERE id_lote = 'dd3389d3-bef4-578c-b43a-5b88d8f7b221';
UPDATE notas SET valor_total = 822.76 WHERE id_nota = 'b113edb2-60d4-5055-b93d-1f405b9e43dd';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b113edb2-60d4-5055-b93d-1f405b9e43dd', DATE '2026-06-28', DATE '2026-07-03', 859.62, 859.62, 'recebido', 'Baixa do apLIS — lote(s) 5616 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b113edb2-60d4-5055-b93d-1f405b9e43dd');

-- sem número | AMHP-DF | lote(s) 5470
DELETE FROM recebimentos WHERE id_receb IN ('d4eace1d-c5e9-4c09-9f32-cf2d847d9c67');
UPDATE lotes SET valor_total = 20762.12 WHERE id_lote = '27d8e563-1bd2-5890-8d75-13457f1b9ab0';
UPDATE notas SET valor_total = 20762.12 WHERE id_nota = 'b78fc85d-f1c1-5488-991b-6ca072afde6e';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b78fc85d-f1c1-5488-991b-6ca072afde6e', DATE '2026-06-13', DATE '2026-07-03', 15914.58, 15914.58, 'recebido', 'Baixa do apLIS — lote(s) 5470 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b78fc85d-f1c1-5488-991b-6ca072afde6e', DATE '2026-06-13', DATE '2026-07-15', 4618.73, 4618.73, 'recebido', 'Baixa do apLIS — lote(s) 5470 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b78fc85d-f1c1-5488-991b-6ca072afde6e');

-- sem número | AMHP-DF | lote(s) 5475
DELETE FROM recebimentos WHERE id_receb IN ('a8448e7b-844d-4766-af0e-a308357262d4');
UPDATE lotes SET valor_total = 1246.56 WHERE id_lote = '8b9cce03-046d-52c4-b66c-50905171279f';
UPDATE notas SET valor_total = 1246.56 WHERE id_nota = '171a632d-bae3-545d-be37-fed75b5da28c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('171a632d-bae3-545d-be37-fed75b5da28c', DATE '2026-06-13', DATE '2026-07-03', 1143.45, 1143.45, 'recebido', 'Baixa do apLIS — lote(s) 5475 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('171a632d-bae3-545d-be37-fed75b5da28c');

-- sem número | AMHP-DF | lote(s) 5737
DELETE FROM recebimentos WHERE id_receb IN ('fcbddb95-84b0-4fd3-a6a4-98d9dbd36172');
UPDATE lotes SET valor_total = 828.42 WHERE id_lote = '89ed6315-5aef-58ea-87d7-f2e077520df9';
UPDATE notas SET valor_total = 828.42 WHERE id_nota = '0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39', DATE '2026-07-11', DATE '2026-08-04', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 5737 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39');

-- sem número | AMHP-DF | lote(s) 5739
DELETE FROM recebimentos WHERE id_receb IN ('db2f1346-a48d-4d84-a05e-b3282a451b70');
UPDATE lotes SET valor_total = 1889.88 WHERE id_lote = '9eefbb42-3ed6-594f-887b-004516ea3254';
UPDATE notas SET valor_total = 1889.88 WHERE id_nota = '1b3f293f-1b08-5898-ab9d-31ddbeae4e0f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f', DATE '2026-07-11', DATE '2026-09-09', 1889.88, 1889.88, 'recebido', 'Baixa do apLIS — lote(s) 5739 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f');

-- sem número | AMHP-DF | lote(s) 5474
DELETE FROM recebimentos WHERE id_receb IN ('e6d473ad-e818-4eb6-a5ba-ddee474e1675');
UPDATE lotes SET valor_total = 1525.04 WHERE id_lote = 'ea3fe0fd-9e4f-5f83-b77b-1a6cb928e856';
UPDATE notas SET valor_total = 1525.04 WHERE id_nota = '69aa7815-b33b-5552-839a-4d84a6233ffc';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('69aa7815-b33b-5552-839a-4d84a6233ffc', DATE '2026-06-13', DATE '2026-07-03', 319.68, 319.68, 'recebido', 'Baixa do apLIS — lote(s) 5474 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('69aa7815-b33b-5552-839a-4d84a6233ffc', DATE '2026-06-13', DATE '2026-09-09', 73.67, 73.67, 'recebido', 'Baixa do apLIS — lote(s) 5474 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('69aa7815-b33b-5552-839a-4d84a6233ffc');

-- sem número | AMHP-DF | lote(s) 5511
DELETE FROM recebimentos WHERE id_receb IN ('b551ab70-88f0-4710-9668-dd7142c8d0b4');
UPDATE lotes SET valor_total = 2926.89 WHERE id_lote = '8013510d-934a-506a-8834-87e09705d322';
UPDATE notas SET valor_total = 2926.89 WHERE id_nota = 'b16470e2-8917-5f15-92aa-4ba37470ccca';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b16470e2-8917-5f15-92aa-4ba37470ccca', DATE '2026-06-16', DATE '2026-07-03', 2273.61, 2273.61, 'recebido', 'Baixa do apLIS — lote(s) 5511 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b16470e2-8917-5f15-92aa-4ba37470ccca');

-- sem número | AMHP-DF | lote(s) 5512
DELETE FROM recebimentos WHERE id_receb IN ('19ab010e-0f9f-4172-bb82-17ad6ae383e1');
UPDATE lotes SET valor_total = 499.31 WHERE id_lote = '5084d3a5-fb44-597e-9983-0b1e1f7373f0';
UPDATE notas SET valor_total = 499.31 WHERE id_nota = '8f97c143-db6b-5289-96c9-cae88a2d919b';
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8f97c143-db6b-5289-96c9-cae88a2d919b', '5084d3a5-fb44-597e-9983-0b1e1f7373f0', 258.71, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8f97c143-db6b-5289-96c9-cae88a2d919b');

-- sem número | AMHP-DF | lote(s) 5611
DELETE FROM recebimentos WHERE id_receb IN ('ab8c8e67-4906-4d5e-ba15-797023fb0625');
UPDATE lotes SET valor_total = 2511.21 WHERE id_lote = '5f46c586-344e-5efb-95a2-a1a7dc02eb98';
UPDATE notas SET valor_total = 2511.21 WHERE id_nota = '19456a07-d18f-563b-8a9f-9996ba5b9936';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('19456a07-d18f-563b-8a9f-9996ba5b9936', DATE '2026-06-28', DATE '2026-07-03', 517.73, 517.73, 'recebido', 'Baixa do apLIS — lote(s) 5611 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('19456a07-d18f-563b-8a9f-9996ba5b9936');

-- sem número | AMHP-DF | lote(s) 4851
DELETE FROM recebimentos WHERE id_receb IN ('977f24b0-11ef-4335-8785-29f55635bf66');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfb13355-30cb-5451-b063-5728cdb5a88b', DATE '2026-06-23', DATE '2025-12-31', 589.09, 589.09, 'recebido', 'Baixa do apLIS — lote(s) 4851 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cfb13355-30cb-5451-b063-5728cdb5a88b', DATE '2026-06-23', DATE '2026-06-15', 939.48, 939.48, 'recebido', 'Baixa do apLIS — lote(s) 4851 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cfb13355-30cb-5451-b063-5728cdb5a88b');

-- sem número | AMHP-DF | lote(s) 5615
DELETE FROM recebimentos WHERE id_receb IN ('06b85cb6-e16f-442b-8176-a8635812c746');
UPDATE lotes SET valor_total = 1828.38 WHERE id_lote = '76f3fa90-7099-53f6-8e94-16f3c5420543';
UPDATE notas SET valor_total = 1828.38 WHERE id_nota = '66520844-b1db-5c15-b7d1-a9a6e06a8013';
SELECT fat_recalcular_nota('66520844-b1db-5c15-b7d1-a9a6e06a8013');

-- sem número | AMHP-DF | lote(s) 5609
DELETE FROM recebimentos WHERE id_receb IN ('9653c3e8-668f-43f9-9e5e-da1de6c578d6');
UPDATE lotes SET valor_total = 1623.10 WHERE id_lote = '0e5e3af3-6626-5d65-9703-a7c5d38acc35';
UPDATE notas SET valor_total = 1623.10 WHERE id_nota = 'dde2e3bd-5fa5-50b8-9da1-1b477f242173';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dde2e3bd-5fa5-50b8-9da1-1b477f242173', DATE '2026-06-28', DATE '2026-06-02', 591.99, 591.99, 'recebido', 'Baixa do apLIS — lote(s) 5609 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dde2e3bd-5fa5-50b8-9da1-1b477f242173', DATE '2026-06-28', DATE '2026-07-03', 57.90, 57.90, 'recebido', 'Baixa do apLIS — lote(s) 5609 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dde2e3bd-5fa5-50b8-9da1-1b477f242173');

-- sem número | AMHP-DF | lote(s) 5481
DELETE FROM recebimentos WHERE id_receb IN ('0fffde21-4be3-4d82-8bfa-9cc40681065d');
UPDATE lotes SET valor_total = 17046.72 WHERE id_lote = 'd811483b-0e32-53f6-86af-03c500e110a2';
UPDATE notas SET valor_total = 17046.72 WHERE id_nota = '0d9321d7-ca2e-5cc1-94d7-29d298395ca1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1', DATE '2026-06-19', DATE '2026-07-03', 12653.97, 12653.97, 'recebido', 'Baixa do apLIS — lote(s) 5481 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1', DATE '2026-06-19', DATE '2026-08-04', 136.78, 136.78, 'recebido', 'Baixa do apLIS — lote(s) 5481 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0d9321d7-ca2e-5cc1-94d7-29d298395ca1');

-- sem número | AMHP-DF | lote(s) 5605
DELETE FROM recebimentos WHERE id_receb IN ('0c3977e7-b3ac-4056-8cb1-b4ca17b84d61');
UPDATE lotes SET valor_total = 1526.90 WHERE id_lote = '4c12404d-78ad-5a71-a351-a4222d560433';
UPDATE notas SET valor_total = 1526.90 WHERE id_nota = '94d2bef5-eb62-5e51-b475-de6c92b7fa5d';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94d2bef5-eb62-5e51-b475-de6c92b7fa5d', DATE '2026-06-28', DATE '2026-07-03', 1253.89, 1253.89, 'recebido', 'Baixa do apLIS — lote(s) 5605 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('94d2bef5-eb62-5e51-b475-de6c92b7fa5d');

-- sem número | AMHP-DF | lote(s) 5436
DELETE FROM recebimentos WHERE id_receb IN ('0473426b-fe2a-494e-b87c-131ccea5667d');
UPDATE lotes SET valor_total = 412.76 WHERE id_lote = '0a05e097-a532-5d02-ab41-8010faef25f0';
UPDATE notas SET valor_total = 412.76 WHERE id_nota = '9af76ffc-0642-5e8a-8e58-b9c90cdf1d96';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96', DATE '2026-06-09', DATE '2026-06-17', 424.10, 424.10, 'recebido', 'Baixa do apLIS — lote(s) 5436 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96');

-- sem número | AMHP-DF | lote(s) 5438
DELETE FROM recebimentos WHERE id_receb IN ('854ffb01-d3b8-4308-94bd-e3690e2ef046');
UPDATE lotes SET valor_total = 210.93 WHERE id_lote = '394663d9-0252-51ea-8510-4a71e97d3db1';
UPDATE notas SET valor_total = 210.93 WHERE id_nota = '6998736a-eb43-571c-989a-41d657b79145';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6998736a-eb43-571c-989a-41d657b79145', DATE '2026-06-09', DATE '2026-07-03', 219.35, 219.35, 'recebido', 'Baixa do apLIS — lote(s) 5438 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6998736a-eb43-571c-989a-41d657b79145');

-- sem número | AMHP-DF | lote(s) 5619
DELETE FROM recebimentos WHERE id_receb IN ('fdb475d4-5fe2-48ad-9c59-056370c29a6b');
UPDATE lotes SET valor_total = 5071.29 WHERE id_lote = '5a096965-a883-5034-8c18-2735fd9ca531';
UPDATE notas SET valor_total = 5071.29 WHERE id_nota = 'a1f881c6-55b3-5307-8a3b-2c8902744774';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a1f881c6-55b3-5307-8a3b-2c8902744774', DATE '2026-06-28', DATE '2026-07-03', 3869.74, 3869.74, 'recebido', 'Baixa do apLIS — lote(s) 5619 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a1f881c6-55b3-5307-8a3b-2c8902744774');

-- sem número | AMHP-DF | lote(s) 5439
DELETE FROM recebimentos WHERE id_receb IN ('84ddd470-8322-4171-8bbe-722c752fe88c');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b5c00973-9c74-5655-a653-feb641e0f7d7', '13c37156-c16e-5ff1-b723-6a3bfa471425', 254.88, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b5c00973-9c74-5655-a653-feb641e0f7d7');

-- sem número | AMHP-DF | lote(s) 5614
DELETE FROM recebimentos WHERE id_receb IN ('5ae6d5ae-9828-4824-8c3f-55b28be03a1f');
SELECT fat_recalcular_nota('49ff72be-8770-53f9-8f77-f4aff299d1f4');

-- sem número | AMHP-DF | lote(s) 5440
DELETE FROM recebimentos WHERE id_receb IN ('e23b419e-1d3f-4b64-b372-db525922f7e3');
UPDATE lotes SET valor_total = 305.65 WHERE id_lote = '116cf133-6c7f-551d-a5f7-04ddbbaa1338';
UPDATE notas SET valor_total = 305.65 WHERE id_nota = '099e720c-ef42-5fe8-9685-eabcf3ab2915';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('099e720c-ef42-5fe8-9685-eabcf3ab2915', DATE '2026-06-09', DATE '2026-06-15', 241.65, 241.65, 'recebido', 'Baixa do apLIS — lote(s) 5440 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('099e720c-ef42-5fe8-9685-eabcf3ab2915', DATE '2026-06-09', DATE '2026-08-04', 73.28, 73.28, 'recebido', 'Baixa do apLIS — lote(s) 5440 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('099e720c-ef42-5fe8-9685-eabcf3ab2915');

-- sem número | AMHP-DF | lote(s) 5617
DELETE FROM recebimentos WHERE id_receb IN ('81966a79-13fd-4cb7-8175-e80bb7baa317');
UPDATE lotes SET valor_total = 292.50 WHERE id_lote = '308bc6bd-9f88-5f24-b44e-b73ae9d2a598';
UPDATE notas SET valor_total = 292.50 WHERE id_nota = '9657bbb9-ce14-5b50-8920-faea67ec9d2a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9657bbb9-ce14-5b50-8920-faea67ec9d2a', DATE '2026-06-28', DATE '2026-07-15', 304.17, 304.17, 'recebido', 'Baixa do apLIS — lote(s) 5617 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9657bbb9-ce14-5b50-8920-faea67ec9d2a');

-- sem número | AMHP-DF | lote(s) 5443
DELETE FROM recebimentos WHERE id_receb IN ('1e198e86-d388-41d8-b58c-981ec16469fe');
UPDATE lotes SET valor_total = 12489.50 WHERE id_lote = '97ab10e2-dad3-5e2b-804b-d0e6a9ad9249';
UPDATE notas SET valor_total = 12489.50 WHERE id_nota = '135c60d4-f407-5ae3-b8e4-c3d0b6040cb1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', DATE '2026-06-12', DATE '2026-06-02', 8016.15, 8016.15, 'recebido', 'Baixa do apLIS — lote(s) 5443 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', DATE '2026-06-12', DATE '2026-06-15', 391.10, 391.10, 'recebido', 'Baixa do apLIS — lote(s) 5443 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', DATE '2026-06-12', DATE '2026-08-17', 725.82, 725.82, 'recebido', 'Baixa do apLIS — lote(s) 5443 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1', '97ab10e2-dad3-5e2b-804b-d0e6a9ad9249', 138.78, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1');

-- sem número | AMHP-DF | lote(s) 5242
DELETE FROM recebimentos WHERE id_receb IN ('eb34bde1-e1df-44cb-ada3-f287caef5b8c');
UPDATE lotes SET valor_total = 4594.90 WHERE id_lote = '848e0105-dbd1-5575-a917-a2e4ef1a2461';
UPDATE notas SET valor_total = 4594.90 WHERE id_nota = '75aaa3ac-d001-5c72-9db5-a69cd9f01e72';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', DATE '2026-06-12', DATE '2026-06-15', 1483.97, 1483.97, 'recebido', 'Baixa do apLIS — lote(s) 5242 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', DATE '2026-06-12', DATE '2026-06-17', 235.58, 235.58, 'recebido', 'Baixa do apLIS — lote(s) 5242 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72', '848e0105-dbd1-5575-a917-a2e4ef1a2461', 1099.69, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('75aaa3ac-d001-5c72-9db5-a69cd9f01e72');

-- sem número | AMHP-DF | lote(s) 5518
DELETE FROM recebimentos WHERE id_receb IN ('a53c1e31-b249-4c83-b3d6-50b85a999b39');
UPDATE lotes SET valor_total = 3660.88 WHERE id_lote = 'b0754cc8-5fc5-5405-b0f2-27b8b945236f';
UPDATE notas SET valor_total = 3660.88 WHERE id_nota = 'f053e13b-2a39-5dc6-91b2-4e340be2d55a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', DATE '2026-06-16', DATE '2026-07-31', 1902.98, 1902.98, 'recebido', 'Baixa do apLIS — lote(s) 5518 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', DATE '2026-06-16', DATE '2026-08-17', 696.04, 696.04, 'recebido', 'Baixa do apLIS — lote(s) 5518 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f053e13b-2a39-5dc6-91b2-4e340be2d55a', 'b0754cc8-5fc5-5405-b0f2-27b8b945236f', 81.60, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f053e13b-2a39-5dc6-91b2-4e340be2d55a');

-- sem número | AMHP-DF | lote(s) 4874
DELETE FROM recebimentos WHERE id_receb IN ('dbaabc57-c5a2-4211-b6b4-f2cb7d7f82ce');
UPDATE lotes SET valor_total = 63.75 WHERE id_lote = '708a639f-f64b-50df-a304-2748ac321206';
UPDATE notas SET valor_total = 63.75 WHERE id_nota = 'ebf2d28c-8c01-5c47-bff4-5db27c22a3f6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6', DATE '2026-06-23', DATE '2025-12-31', 63.75, 63.75, 'recebido', 'Baixa do apLIS — lote(s) 4874 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6');

-- NF 8025 | AMIL | lote(s) 5409
DELETE FROM glosas WHERE id_glosa IN ('394b435e-df1e-458b-b227-f10bf288887c');
DELETE FROM recebimentos WHERE id_receb IN ('1dcc3e7e-f6a8-4309-824d-347900889c1c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', DATE '2026-05-09', DATE '2026-03-30', 5321.81, 5321.81, 'recebido', 'Baixa do apLIS — lote(s) 5409 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041', 200.00, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041', 53.19, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('285fccb5-740c-582e-852f-93e21d40bfa5', '2772a745-4f44-55cc-b988-3d414d6ca041', 28.45, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('285fccb5-740c-582e-852f-93e21d40bfa5');

-- sem número | AMHP-DF | lote(s) 5607
DELETE FROM recebimentos WHERE id_receb IN ('4c721780-d7c5-4a62-a0b0-d90909ad8f90');
UPDATE lotes SET valor_total = 6924.14 WHERE id_lote = '8af79f81-9dd6-5d21-add7-05c4d18552eb';
UPDATE notas SET valor_total = 6924.14 WHERE id_nota = '5d553b1d-abbe-5d20-92bc-9772c7f93f74';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', DATE '2026-06-29', DATE '2026-06-02', 63.75, 63.75, 'recebido', 'Baixa do apLIS — lote(s) 5607 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', DATE '2026-06-29', DATE '2026-06-15', 2669.53, 2669.53, 'recebido', 'Baixa do apLIS — lote(s) 5607 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', DATE '2026-06-29', DATE '2026-07-31', 35.03, 35.03, 'recebido', 'Baixa do apLIS — lote(s) 5607 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5d553b1d-abbe-5d20-92bc-9772c7f93f74', '8af79f81-9dd6-5d21-add7-05c4d18552eb', 1766.39, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5d553b1d-abbe-5d20-92bc-9772c7f93f74');

-- NF 8025 | AMIL | lote(s) 5408
DELETE FROM glosas WHERE id_glosa IN ('fea959d9-def8-49f1-a0fd-87fa3d323e33');
DELETE FROM recebimentos WHERE id_receb IN ('d412a692-e25b-4a84-a45a-6d206eab3f35');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-02-02', 355.00, 355.00, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 02/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-02-10', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 10/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-02-23', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 23/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-02', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-05', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-06', 440.35, 440.35, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 06/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-09', 1688.80, 1688.80, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 09/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-10', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-12', 793.90, 793.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 12/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-13', 1840.90, 1840.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 13/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-14', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 14/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-16', 921.90, 921.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 16/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-17', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-18', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 18/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-19', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 19/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-23', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-24', 693.45, 693.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-25', 1532.96, 1532.96, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 25/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-03-31', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', DATE '2026-05-09', DATE '2026-04-01', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5408 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', '58d02138-b1a1-5ce8-8180-85b262434c92', 28.45, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f30b748d-966c-5713-a868-bb8ca9836f9d', '58d02138-b1a1-5ce8-8180-85b262434c92', 27.00, 'SERVIÇO NÃO CONTRATADO PARA O PRESTADOR', '2514', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f30b748d-966c-5713-a868-bb8ca9836f9d');

-- NF 8197 | AMIL | lote(s) 5431
DELETE FROM glosas WHERE id_glosa IN ('6fec90a1-031b-4f52-9a25-bb8c0c47750c');
DELETE FROM recebimentos WHERE id_receb IN ('28e3834a-e722-4676-9fd7-1647d23fc954');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-01-15', 169.04, 169.04, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 15/01/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-03-02', 154.00, 154.00, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-03-06', 155.02, 155.02, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 06/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-03-19', 84.52, 84.52, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 19/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-03-20', 275.02, 275.02, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-04-01', 42.26, 42.26, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', DATE '2026-05-20', DATE '2026-04-02', 120.00, 120.00, 'recebido', 'Baixa do apLIS — lote(s) 5431 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', 120.00, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', 167.96, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', 80.00, 'SERVIÇO NÃO CONTRATADO PARA O PRESTADOR', '2514', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('498a8b21-baa4-55a9-bc2a-427216c73031', 'd42fb077-0096-5ffb-9a1e-02d1b2328ed4', 80.00, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('498a8b21-baa4-55a9-bc2a-427216c73031');

-- NF 8197 | AMIL | lote(s) 5525
DELETE FROM glosas WHERE id_glosa IN ('84dbec30-2f38-49a2-9f20-0fdfee36017d');
DELETE FROM recebimentos WHERE id_receb IN ('73b00d0b-0292-4d25-81b0-72c300e53af8');
UPDATE lotes SET valor_total = 7296.35 WHERE id_lote = 'b112bb2d-7966-57d9-80d5-4b75eb446674';
UPDATE notas SET valor_total = 7296.35 WHERE id_nota = 'af55e738-fa1a-5f42-affb-1e82cdae8fa4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-03-17', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-03-30', 410.45, 410.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-02', 256.90, 256.90, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-03', 538.45, 538.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 03/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-06', 1195.35, 1195.35, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-07', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-08', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-09', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-10', 1150.35, 1150.35, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-13', 921.90, 921.90, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 13/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', DATE '2026-05-20', DATE '2026-04-15', 823.80, 823.80, 'recebido', 'Baixa do apLIS — lote(s) 5525 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674', 182.00, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674', 43.00, 'PROCEDIMENTOS MÉDICOS DUPLICADOS', '1807', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('af55e738-fa1a-5f42-affb-1e82cdae8fa4', 'b112bb2d-7966-57d9-80d5-4b75eb446674', 595.35, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('af55e738-fa1a-5f42-affb-1e82cdae8fa4');

-- NF 8031 | ASSEFAZ | lote(s) 5392
DELETE FROM glosas WHERE id_glosa IN ('427fce97-0bde-437d-93b5-2a70bf08f4ea');
DELETE FROM recebimentos WHERE id_receb IN ('ee8f0677-2359-4c25-9c0c-4521c1962826');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', DATE '2026-05-20', DATE '2026-03-09', 732.23, 732.23, 'recebido', 'Baixa do apLIS — lote(s) 5392 (recebido em 09/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', DATE '2026-05-20', DATE '2026-03-13', 76.33, 76.33, 'recebido', 'Baixa do apLIS — lote(s) 5392 (recebido em 13/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5', 'fde81088-95aa-5e68-9b14-04b8ffe1b264', 317.44, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('cc43204d-5f15-5687-b12f-6c56cbc6b6f5');

-- NF 8031 | ASSEFAZ | lote(s) 5390
DELETE FROM recebimentos WHERE id_receb IN ('fd27a6fe-b144-4151-a456-59095361b8c2');
UPDATE lotes SET valor_total = 9775.75 WHERE id_lote = 'b7433d7c-10fe-59a4-b27d-aa86132a28d9';
UPDATE notas SET valor_total = 9775.75 WHERE id_nota = '611a5d51-a260-5c60-bc19-4c1efdafa717';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-02-24', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 24/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-16', 862.28, 862.28, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 16/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-17', 1396.27, 1396.27, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-18', 469.48, 469.48, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 18/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-19', 3056.32, 3056.32, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 19/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-20', 1956.39, 1956.39, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-23', 1527.19, 1527.19, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('611a5d51-a260-5c60-bc19-4c1efdafa717', DATE '2026-05-20', DATE '2026-03-25', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5390 (recebido em 25/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('611a5d51-a260-5c60-bc19-4c1efdafa717');

-- NF 8031 | ASSEFAZ | lote(s) 5387
DELETE FROM glosas WHERE id_glosa IN ('20dbcdb4-7315-499c-b7bc-d7d5d49a511d');
DELETE FROM recebimentos WHERE id_receb IN ('7ee53597-221f-434c-834b-25b29abee99f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-10', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-13', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 13/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-16', 1589.38, 1589.38, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 16/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-17', 2508.22, 2508.22, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 17/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-18', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 18/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-19', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 19/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-20', 2939.36, 2939.36, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-21', 1686.22, 1686.22, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 21/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-23', 469.48, 469.48, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-24', 1019.37, 1019.37, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', DATE '2026-05-20', DATE '2026-03-25', 626.57, 626.57, 'recebido', 'Baixa do apLIS — lote(s) 5387 (recebido em 25/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('38c2f48b-913b-5b03-8aba-f670e5885083', '28a6db0f-a7c1-566e-822b-08dd0ba56445', 431.14, 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', '1006', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('38c2f48b-913b-5b03-8aba-f670e5885083');

-- NF 8294 | BRADESCO SAUDE S/A 421715 | lote(s) 5305
DELETE FROM glosas WHERE id_glosa IN ('2a5ebfc7-ade7-486d-8558-317f9f1f72c5', 'c7467143-f768-4278-8c58-9f342196bdcf');
DELETE FROM recebimentos WHERE id_receb IN ('a610bfda-b6ae-48cd-b822-69cae635a0ef');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', DATE '2026-06-06', DATE '2026-05-03', 144.77, 144.77, 'recebido', 'Baixa do apLIS — lote(s) 5305 (recebido em 03/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', DATE '2026-06-06', DATE '2026-05-12', 9200.23, 9200.23, 'recebido', 'Baixa do apLIS — lote(s) 5305 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0530feac-d4b7-5110-9f76-f4e3e57286be', '63262bcb-ada7-5653-baba-e3849364496a', 25.54, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0530feac-d4b7-5110-9f76-f4e3e57286be');

-- NF 8195 | BRADESCO SAUDE  - 005711 | lote(s) 5349
DELETE FROM glosas WHERE id_glosa IN ('1478bd70-6c30-46df-9067-7ff9f7b523b2');
DELETE FROM recebimentos WHERE id_receb IN ('5066e91f-601d-4c9c-9e41-465d0e0ce1c7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('428fd97e-c950-5b2c-b0dd-d6c5cab58955', DATE '2026-06-06', DATE '2026-05-12', 7097.82, 7097.82, 'recebido', 'Baixa do apLIS — lote(s) 5349 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('428fd97e-c950-5b2c-b0dd-d6c5cab58955');

-- NF 8277 | BRADESCO SAUDE S/A 421715 | lote(s) 5412
DELETE FROM glosas WHERE id_glosa IN ('222e9061-727d-4320-b246-5098c95401e6');
DELETE FROM recebimentos WHERE id_receb IN ('72b46614-d089-466c-98c5-fa349fe8256d');
UPDATE lotes SET valor_total = 5290.85 WHERE id_lote = 'd5978313-29f8-57e6-a914-942e25961ee5';
UPDATE notas SET valor_total = 5290.85 WHERE id_nota = '9a5fe305-cac7-5bea-851a-e5ca2ccf9a88';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', DATE '2026-06-15', DATE '2026-05-27', 5146.09, 5146.09, 'recebido', 'Baixa do apLIS — lote(s) 5412 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88', 'd5978313-29f8-57e6-a914-942e25961ee5', 144.76, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88');

-- NF 8278 | BRADESCO SAUDE  - 005711 | lote(s) 5358
DELETE FROM glosas WHERE id_glosa IN ('304b0422-13d0-45fa-9fe7-d1fa6700328e');
DELETE FROM recebimentos WHERE id_receb IN ('42366e7c-bed6-41c4-a09d-97239b7b3069');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', DATE '2026-06-15', DATE '2025-05-27', 94.52, 94.52, 'recebido', 'Baixa do apLIS — lote(s) 5358 (recebido em 27/05/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', DATE '2026-06-15', DATE '2026-05-27', 2733.47, 2733.47, 'recebido', 'Baixa do apLIS — lote(s) 5358 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4418cc42-8863-5b77-a648-96cc6a21c307', '5c96db75-d8a7-5dcd-b976-fc0ac9be1536', 472.54, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4418cc42-8863-5b77-a648-96cc6a21c307');

-- NF 8313 | BRADESCO SAUDE S/A 421715 | lote(s) 5352
DELETE FROM glosas WHERE id_glosa IN ('5cff071c-6d4b-4f55-a682-de8ef5048d85');
DELETE FROM recebimentos WHERE id_receb IN ('4b9bb8b5-e7a6-43a2-942f-76472a3497ae');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', DATE '2026-06-21', DATE '2026-06-09', 1134.12, 1134.12, 'recebido', 'Baixa do apLIS — lote(s) 5352 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4e850ee5-624e-5c9c-941e-a3adeff9775f', '7a8e9da5-1a92-5895-b760-05b77698e616', 1134.12, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4e850ee5-624e-5c9c-941e-a3adeff9775f');

-- NF 8295 | BRADESCO SAUDE  - 005711 | lote(s) 5507
DELETE FROM recebimentos WHERE id_receb IN ('d42553d0-5cd3-4205-8578-9f696a341567');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c579ebfc-95ef-5fa0-8ea7-e60463131608', DATE '2026-06-21', DATE '2026-04-22', 16191.62, 16191.62, 'recebido', 'Baixa do apLIS — lote(s) 5507 (recebido em 22/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c579ebfc-95ef-5fa0-8ea7-e60463131608');

-- NF 8311 | BRADESCO SAUDE  - 005711 | lote(s) 5549
DELETE FROM glosas WHERE id_glosa IN ('bb42961b-8d0b-4d14-ac9b-608025a102d4');
DELETE FROM recebimentos WHERE id_receb IN ('4ebc2bd4-6b28-46f5-9504-c66f22cdf96f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', DATE '2026-06-21', DATE '2026-06-08', 13261.60, 13261.60, 'recebido', 'Baixa do apLIS — lote(s) 5549 (recebido em 08/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a1d363be-a198-53c8-9e05-3c3a856d89ef', '1a0c3272-0042-5b0d-8cea-bedbbcdfb6ac', 1270.24, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a1d363be-a198-53c8-9e05-3c3a856d89ef');

-- NF 8295 | BRADESCO SAUDE  - 005711 | lote(s) 5524
DELETE FROM recebimentos WHERE id_receb IN ('383f86cd-b83f-426b-802b-3621f6d69f9d');
SELECT fat_recalcular_nota('5341a033-9851-5cd3-88d9-83d0f545b34d');

-- NF 8943 | BRADESCO SAUDE  - 005711 | lote(s) 5551
DELETE FROM glosas WHERE id_glosa IN ('0e32dd2b-5440-440b-8f17-54e700c00374');
DELETE FROM recebimentos WHERE id_receb IN ('2b06d6e7-bda1-46ac-8ae1-0884dfce5448');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('256222b8-c811-5286-b9fe-e7d2375605ff', DATE '2026-06-21', DATE '2026-08-04', 31.37, 31.37, 'recebido', 'Baixa do apLIS — lote(s) 5551 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('256222b8-c811-5286-b9fe-e7d2375605ff');

-- NF 8322 | BRADESCO SAUDE  - 005711 | lote(s) 5565
DELETE FROM glosas WHERE id_glosa IN ('17e65b4a-763a-4c17-ad42-bf38ccc25244');
DELETE FROM recebimentos WHERE id_receb IN ('4973ffa8-be39-40ed-ac6a-3a19e387dc66');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', DATE '2026-06-22', DATE '2026-06-03', 17197.67, 17197.67, 'recebido', 'Baixa do apLIS — lote(s) 5565 (recebido em 03/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', DATE '2026-06-22', DATE '2026-06-09', 58.89, 58.89, 'recebido', 'Baixa do apLIS — lote(s) 5565 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11', '42f2c49a-dcb1-50e7-81eb-dd38e52a19fb', 3.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11');

-- NF 8322 | BRADESCO SAUDE  - 005711 | lote(s) 5579
DELETE FROM glosas WHERE id_glosa IN ('222a3f11-36a4-42f6-b7ca-a2713118a3b4');
DELETE FROM recebimentos WHERE id_receb IN ('bafb4b2f-1896-4093-b095-4b1d855ef0c3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', DATE '2026-06-26', DATE '2026-06-09', 15184.68, 15184.68, 'recebido', 'Baixa do apLIS — lote(s) 5579 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a32e2e77-98de-54e4-babe-98b2f9a363d0', '5f26e6ad-6578-5650-a458-8f82074bff62', 3.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a32e2e77-98de-54e4-babe-98b2f9a363d0');

-- NF 8278 | BRADESCO SAUDE  - 005711 | lote(s) 5506
DELETE FROM glosas WHERE id_glosa IN ('8be8261e-fc39-4f1e-a2e3-ef95257924f7');
DELETE FROM recebimentos WHERE id_receb IN ('87d1adb0-f0cb-4e16-a60e-6669b9c0161f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', DATE '2026-06-15', DATE '2026-05-27', 2312.83, 2312.83, 'recebido', 'Baixa do apLIS — lote(s) 5506 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5355942b-b225-5cc7-b06a-537afcf67d57', 'e7ffa8ca-e015-5749-96bc-1348a11e977d', 644.45, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5355942b-b225-5cc7-b06a-537afcf67d57');

-- NF 8278 | BRADESCO SAUDE  - 005711 | lote(s) 5411
DELETE FROM glosas WHERE id_glosa IN ('0031bb6b-771b-4d3c-96db-c77f19c7d4dd');
DELETE FROM recebimentos WHERE id_receb IN ('95fe5f76-f679-407c-aca2-b9b1266c9461');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', DATE '2026-06-15', DATE '2026-05-27', 19011.94, 19011.94, 'recebido', 'Baixa do apLIS — lote(s) 5411 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb', 'e9c850d3-9fe3-57cf-8762-f5b44bc8ca36', 63.29, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b4e210ec-fe25-5f33-a94b-c945f6bea5fb');

-- NF 8313 | BRADESCO SAUDE S/A 421715 | lote(s) 5577
DELETE FROM recebimentos WHERE id_receb IN ('8adbea0a-8ed1-4a19-b41d-3b2253454ab0');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a83966d8-a06c-5fff-9ad9-2c44fcda7afd', DATE '2026-06-28', DATE '2026-06-09', 8032.15, 8032.15, 'recebido', 'Baixa do apLIS — lote(s) 5577 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a83966d8-a06c-5fff-9ad9-2c44fcda7afd');

-- sem número | CASSI | lote(s) 5343
DELETE FROM glosas WHERE id_glosa IN ('b7b5ab99-6d7b-4c82-9681-2298dfb56eb1');
DELETE FROM recebimentos WHERE id_receb IN ('a401f235-ae9a-43f7-a99d-c6d160f6d427');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', DATE '2026-05-01', DATE '2026-04-27', 13327.90, 13327.90, 'recebido', 'Baixa do apLIS — lote(s) 5343 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa', 'f64cf590-41ac-50fe-b11d-ab552056d3e3', 683.61, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa');

-- sem número | CASSI | lote(s) 5254
DELETE FROM glosas WHERE id_glosa IN ('2decfa56-aab9-4c11-afec-b9693fb8d939');
DELETE FROM recebimentos WHERE id_receb IN ('c3c2b660-3239-4bd3-ac7e-c30553a61d3c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', DATE '2026-05-01', DATE '2026-04-27', 996.53, 996.53, 'recebido', 'Baixa do apLIS — lote(s) 5254 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6b11a560-d23c-572e-805e-842b966f2ea6', '6b99dcaa-6495-5999-b9c7-26139a9fb855', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6b11a560-d23c-572e-805e-842b966f2ea6');

-- sem número | CASSI | lote(s) 5188
DELETE FROM recebimentos WHERE id_receb IN ('4437ec6e-17c5-4b78-9081-b0d3089a236f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a450eb7-0471-57e9-99a6-8ae8013aea4d', DATE '2026-05-01', DATE '2026-04-27', 8783.36, 8783.36, 'recebido', 'Baixa do apLIS — lote(s) 5188 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0a450eb7-0471-57e9-99a6-8ae8013aea4d', '9f386283-76a6-5be0-9371-17d224b861a5', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0a450eb7-0471-57e9-99a6-8ae8013aea4d');

-- sem número | CASSI | lote(s) 5247
DELETE FROM glosas WHERE id_glosa IN ('b9f8aa9e-d428-426e-9cfc-830603238462');
DELETE FROM recebimentos WHERE id_receb IN ('bfbf006f-e723-4f54-865e-6e2646eb77a1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', DATE '2026-05-01', DATE '2026-04-27', 7479.03, 7479.03, 'recebido', 'Baixa do apLIS — lote(s) 5247 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c3b213f8-513e-53ee-8de8-dbf264edf686', '2fc5be67-8a0a-5eb6-a0f9-70fb064a95cf', 683.61, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c3b213f8-513e-53ee-8de8-dbf264edf686');

-- sem número | CASSI | lote(s) 5341
DELETE FROM glosas WHERE id_glosa IN ('574954d4-60e2-4928-9e7c-178803d6234a');
DELETE FROM recebimentos WHERE id_receb IN ('1a191c63-cfa6-4406-a470-13da9b26ac50');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', DATE '2026-05-01', DATE '2026-04-27', 12118.72, 12118.72, 'recebido', 'Baixa do apLIS — lote(s) 5341 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', '13c5a6f2-f61a-5183-9076-58a314cb434a', 455.74, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4dd06007-312f-51cc-94ae-9c2d0274d5de', '13c5a6f2-f61a-5183-9076-58a314cb434a', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4dd06007-312f-51cc-94ae-9c2d0274d5de');

-- sem número | CASSI | lote(s) 5249
DELETE FROM glosas WHERE id_glosa IN ('0bb2c840-8aff-4a7d-aae0-894c695f0141');
DELETE FROM recebimentos WHERE id_receb IN ('c67c2974-3ea9-4f0f-a367-4ce4935c1c44');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', DATE '2026-05-01', DATE '2026-04-27', 13542.30, 13542.30, 'recebido', 'Baixa do apLIS — lote(s) 5249 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('da53402c-e47d-56cb-81ec-93e4e13bfc76', '217fdbef-19c8-5f73-b4ff-54b59e6ab741', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('da53402c-e47d-56cb-81ec-93e4e13bfc76');

-- sem número | CASSI | lote(s) 5252
DELETE FROM glosas WHERE id_glosa IN ('a7225063-1e7e-469e-831f-a56aa768103e');
DELETE FROM recebimentos WHERE id_receb IN ('f8770a4d-1ae3-4dc8-9725-f2dfaad0a26a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', DATE '2026-05-01', DATE '2026-04-27', 8370.88, 8370.88, 'recebido', 'Baixa do apLIS — lote(s) 5252 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a6ecf363-229b-51c7-b257-e6d155286135', '9ada26c7-4897-5ebd-9823-f9b03014a6a5', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a6ecf363-229b-51c7-b257-e6d155286135');

-- sem número | CASSI | lote(s) 5248
DELETE FROM glosas WHERE id_glosa IN ('a666bfa0-b1da-4ebf-9cd1-025aca810677');
DELETE FROM recebimentos WHERE id_receb IN ('0b39a06e-23e9-4b4e-a630-93940ac74976');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', DATE '2026-05-01', DATE '2026-04-27', 13868.04, 13868.04, 'recebido', 'Baixa do apLIS — lote(s) 5248 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4bb337d5-5bfc-5693-81a0-73004a9faa19', 'bc84f6f5-232d-5742-be56-0423dbcb8d1f', 911.48, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4bb337d5-5bfc-5693-81a0-73004a9faa19');

-- sem número | CASSI | lote(s) 5362
DELETE FROM glosas WHERE id_glosa IN ('aeeabf83-c4a2-4854-ab39-d534ab06a77d');
DELETE FROM recebimentos WHERE id_receb IN ('1c1c773e-5bcf-4de5-8f08-ee22e795e05a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', DATE '2026-05-01', DATE '2026-04-27', 7544.64, 7544.64, 'recebido', 'Baixa do apLIS — lote(s) 5362 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d', 'f441440b-b455-506e-94dd-a10f255889db', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('f31838da-6fea-5aeb-a6b1-2eedaab4b14d');

-- sem número | CASSI-PER | lote(s) 5255
DELETE FROM glosas WHERE id_glosa IN ('afddcdcb-b6fc-4db1-9028-bf5cb4ff5077');
DELETE FROM recebimentos WHERE id_receb IN ('632ff589-3bd4-4a88-9f41-237aa5f747fa');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', DATE '2026-05-01', DATE '2026-04-27', 66.60, 66.60, 'recebido', 'Baixa do apLIS — lote(s) 5255 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('01e8bc5a-02ed-55db-9fd8-023074261d3f', 'a5a0bb9b-e90e-5a3e-8580-b5cab0c2f09b', 33.30, 'SERVIÇO SOLICITADO FORA DA COBERTURA', '1420', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('01e8bc5a-02ed-55db-9fd8-023074261d3f');

-- sem número | CASSI | lote(s) 5253
DELETE FROM glosas WHERE id_glosa IN ('1e97b197-b9b7-4f73-a729-69f46c73ad33');
DELETE FROM recebimentos WHERE id_receb IN ('0f253e98-e405-47ed-9da4-6800ee45fffb');
UPDATE lotes SET valor_total = 2178.93 WHERE id_lote = '6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2';
UPDATE notas SET valor_total = 2178.93 WHERE id_nota = '793b1b5c-217c-57dd-ac35-e6c63fb8f4e9';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', DATE '2026-05-01', DATE '2026-04-27', 1889.82, 1889.82, 'recebido', 'Baixa do apLIS — lote(s) 5253 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9', '6f98b1d4-6b34-54be-bb1d-a95fb3d3dcf2', 217.80, 'NÃO EXISTE INFORMAÇÃO SOBRE A SENHA DE AUTORIZAÇÃO DO PROCEDIMENTO', '1403', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9');

-- sem número | CASSI | lote(s) 5251
DELETE FROM glosas WHERE id_glosa IN ('ee88026f-92ee-4fe4-b5a5-6f7b49b3ef5d');
DELETE FROM recebimentos WHERE id_receb IN ('6ac35b1c-1f6e-4c34-bd66-dbf99bf7b752');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', DATE '2026-05-01', DATE '2026-04-27', 15338.81, 15338.81, 'recebido', 'Baixa do apLIS — lote(s) 5251 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('36945b59-fcba-5d63-a0cb-19740c60e033', 'c9fe6d13-1aad-5906-a389-d0188b1ea63d', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('36945b59-fcba-5d63-a0cb-19740c60e033');

-- sem número | CASSI | lote(s) 5365
DELETE FROM glosas WHERE id_glosa IN ('8d2a097f-2082-439a-83f7-9c3bf8c4a419');
DELETE FROM recebimentos WHERE id_receb IN ('31fd80e9-64ca-418a-b0d8-ca755d60a2c5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', DATE '2026-05-01', DATE '2026-04-27', 4026.04, 4026.04, 'recebido', 'Baixa do apLIS — lote(s) 5365 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', 'c61d8aca-60fe-53f7-a081-bba6aab34382', 507.15, 'ITEM PAGO EM OUTRA GUIA', '1305', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e6eba16f-8c79-5e17-98b7-9da5963aaaca', 'c61d8aca-60fe-53f7-a081-bba6aab34382', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e6eba16f-8c79-5e17-98b7-9da5963aaaca');

-- NF 7985 | CASSI | lote(s) 5367
DELETE FROM recebimentos WHERE id_receb IN ('db840372-ae34-4969-8316-7291bd9ac33c');
UPDATE lotes SET valor_total = 2526.93 WHERE id_lote = '2ec7009f-a6c1-5554-9bee-8813f3e7c877';
UPDATE notas SET valor_total = 2526.93 WHERE id_nota = '73f20136-b4f0-517a-bbe1-2b183da462b0';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('73f20136-b4f0-517a-bbe1-2b183da462b0', DATE '2026-05-08', DATE '2026-05-12', 2526.93, 2526.93, 'recebido', 'Baixa do apLIS — lote(s) 5367 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('73f20136-b4f0-517a-bbe1-2b183da462b0');

-- NF 7985 | CASSI | lote(s) 5420
DELETE FROM glosas WHERE id_glosa IN ('89acec81-0676-48a5-9a83-1fb1c334f722');
DELETE FROM recebimentos WHERE id_receb IN ('e8719905-59d4-48c1-81c2-a28e674c2a35');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', DATE '2026-05-08', DATE '2026-05-12', 17893.93, 17893.93, 'recebido', 'Baixa do apLIS — lote(s) 5420 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d1188ec1-2572-549c-ab69-fad2b36ef5ea', '6764bccf-01c9-5bf2-90d9-74a2c9755c9f', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d1188ec1-2572-549c-ab69-fad2b36ef5ea');

-- NF 8003 | CASSI | lote(s) 5477
DELETE FROM glosas WHERE id_glosa IN ('c46d4cc1-bc9b-413a-85c4-2b23637f2e78');
DELETE FROM recebimentos WHERE id_receb IN ('10394ae1-6d7b-4e1c-88bf-ad08317ace28');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', DATE '2026-05-14', DATE '2026-05-12', 25582.40, 25582.40, 'recebido', 'Baixa do apLIS — lote(s) 5477 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('52d2ffe7-afde-5be1-aef4-7067642cb19a', '97b65593-3af3-5f0f-ad37-b2d4893c255d', 683.61, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('52d2ffe7-afde-5be1-aef4-7067642cb19a');

-- NF 8003 | CASSI | lote(s) 5476
DELETE FROM glosas WHERE id_glosa IN ('4a12e66b-8456-493e-8fc4-78364b74ae5c');
DELETE FROM recebimentos WHERE id_receb IN ('f9421be3-3902-4dff-93b5-dc808f32e596');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', DATE '2026-05-15', DATE '2026-05-12', 20505.13, 20505.13, 'recebido', 'Baixa do apLIS — lote(s) 5476 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0aa99aef-73c4-5f58-803f-da3b9c1c1057', '7e0c140e-620f-540e-9355-c2ac441632be', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0aa99aef-73c4-5f58-803f-da3b9c1c1057');

-- NF 8003 | CASSI | lote(s) 5483
DELETE FROM glosas WHERE id_glosa IN ('1956008f-ac6a-4fa5-8b12-54df52b51d8c', 'ee6c7512-1002-454c-9c85-4ac6d97907e4');
DELETE FROM recebimentos WHERE id_receb IN ('aa8b9452-4169-4b78-9a11-d781f891381f');
UPDATE lotes SET valor_total = 1881.19 WHERE id_lote = '7d59af60-cf09-516a-ae02-a38a7dc6e0ef';
UPDATE notas SET valor_total = 1881.19 WHERE id_nota = '77510da4-d67c-5b12-b2cb-159d15b7bfc2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', DATE '2026-05-15', DATE '2026-05-12', 1483.17, 1483.17, 'recebido', 'Baixa do apLIS — lote(s) 5483 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef', 326.70, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('77510da4-d67c-5b12-b2cb-159d15b7bfc2', '7d59af60-cf09-516a-ae02-a38a7dc6e0ef', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('77510da4-d67c-5b12-b2cb-159d15b7bfc2');

-- NF 8003 | CASSI | lote(s) 5012
DELETE FROM recebimentos WHERE id_receb IN ('ef219872-7f00-4188-8dfd-6ae670006713');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a', DATE '2026-05-15', DATE '2026-05-12', 1053.36, 1053.36, 'recebido', 'Baixa do apLIS — lote(s) 5012 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a', '04d6e22c-3319-5fc7-8b34-470f1c3e0cbd', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a');

-- NF 8003 | CASSI | lote(s) 5479
DELETE FROM recebimentos WHERE id_receb IN ('3610e005-cfee-4a32-86e0-f8561e98ebb1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c9da1d20-ff49-590a-a413-fd8174ae3dd8', DATE '2026-05-01', DATE '2026-05-12', 3398.15, 3398.15, 'recebido', 'Baixa do apLIS — lote(s) 5479 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c9da1d20-ff49-590a-a413-fd8174ae3dd8', 'ba9cb33c-ee9b-59a1-ac9b-5aca4633ca9a', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c9da1d20-ff49-590a-a413-fd8174ae3dd8');

-- NF 7979 | E-VIDA | lote(s) 5380
DELETE FROM glosas WHERE id_glosa IN ('7d2ecbdd-4465-485c-b8bd-eba69dbe3bc0');
DELETE FROM recebimentos WHERE id_receb IN ('5b68c697-9b18-4274-885c-8502ee73d4c9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', DATE '2026-05-07', DATE '2026-03-25', 1768.87, 1768.87, 'recebido', 'Baixa do apLIS — lote(s) 5380 (recebido em 25/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('fd65698d-ca4d-5f31-8c59-058187b768ce', '75b2a678-213a-5253-86e2-85eb70cc41d5', 3.65, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('fd65698d-ca4d-5f31-8c59-058187b768ce');

-- NF 8184 | CBMDF | lote(s) 5069
DELETE FROM glosas WHERE id_glosa IN ('8c96809f-2f1e-4510-80b5-7835be2118fa');
DELETE FROM recebimentos WHERE id_receb IN ('c909aecd-95f6-4d7a-907c-a298aee9ccd3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044', DATE '2026-05-30', DATE '2026-06-11', 676.10, 676.10, 'recebido', 'Baixa do apLIS — lote(s) 5069 (recebido em 11/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4c02ed5e-5fc9-55a6-b0a7-e01756d38044');

-- NF 8184 | CBMDF | lote(s) 5635
DELETE FROM glosas WHERE id_glosa IN ('60f7dfac-74d0-41ce-a471-322279ca9526');
DELETE FROM recebimentos WHERE id_receb IN ('08587eb1-df96-4180-aa1d-466ecec1ed03');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f', DATE '2026-05-30', DATE '2026-06-11', 468.32, 468.32, 'recebido', 'Baixa do apLIS — lote(s) 5635 (recebido em 11/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('58a3a74f-7cd8-5a88-8e2d-331f30447c7f');

-- NF 8246 | CÂMARA DOS DEPUTADOS | lote(s) 5320
DELETE FROM glosas WHERE id_glosa IN ('a48490e3-1d5a-431b-96df-3c608bd638b1');
DELETE FROM recebimentos WHERE id_receb IN ('0d669ef3-0727-4e38-890c-288ac3b11829');
UPDATE lotes SET valor_total = 3656.80 WHERE id_lote = '44ecdebd-088f-55e7-92c4-79ece5da1f7b';
UPDATE notas SET valor_total = 3656.80 WHERE id_nota = '4ea2f52b-d885-55eb-8913-234da7f984fc';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4ea2f52b-d885-55eb-8913-234da7f984fc', DATE '2026-06-27', DATE '2026-07-02', 3656.80, 3656.80, 'recebido', 'Baixa do apLIS — lote(s) 5320 (recebido em 02/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4ea2f52b-d885-55eb-8913-234da7f984fc');

-- sem número | FASCAL | lote(s) 5401
DELETE FROM glosas WHERE id_glosa IN ('cb19c582-b91e-451a-b10c-f8d48b889557');
DELETE FROM recebimentos WHERE id_receb IN ('5c3e8bce-1cce-4d01-86d7-1d12e46c0cf3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', DATE '2026-05-04', DATE '2026-03-24', 445.87, 445.87, 'recebido', 'Baixa do apLIS — lote(s) 5401 (recebido em 24/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', DATE '2026-05-04', DATE '2026-03-26', 153.68, 153.68, 'recebido', 'Baixa do apLIS — lote(s) 5401 (recebido em 26/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', '73e401cc-d7b0-5d49-962b-9e358a6c5ab2', 132.12, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9a00a3dd-f010-5221-be7c-94030ac0a6bd', '73e401cc-d7b0-5d49-962b-9e358a6c5ab2', 24.05, 'VALOR TOTAL DO PROCEDIMENTO DIFERENTE DO VALOR PROCESSADO', '1805', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9a00a3dd-f010-5221-be7c-94030ac0a6bd');

-- sem número | FASCAL | lote(s) 5372
DELETE FROM glosas WHERE id_glosa IN ('feb4b98b-bc43-43a7-b248-317285e815cb');
DELETE FROM recebimentos WHERE id_receb IN ('901b237d-cb34-43e0-b460-493a5e4b35c9');
UPDATE lotes SET valor_total = 1634.88 WHERE id_lote = 'cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28';
UPDATE notas SET valor_total = 1634.88 WHERE id_nota = '6047ccda-6dcd-59ab-9519-5514a5951119';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', DATE '2026-05-04', DATE '2026-03-25', 914.12, 914.12, 'recebido', 'Baixa do apLIS — lote(s) 5372 (recebido em 25/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', DATE '2026-05-04', DATE '2026-05-05', 579.34, 579.34, 'recebido', 'Baixa do apLIS — lote(s) 5372 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6047ccda-6dcd-59ab-9519-5514a5951119', 'cabd62e2-3dcc-55ef-8a9e-c97e77bc0c28', 141.42, 'VALOR TOTAL DO PROCEDIMENTO DIFERENTE DO VALOR PROCESSADO', '1805', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6047ccda-6dcd-59ab-9519-5514a5951119');

-- sem número | FASCAL | lote(s) 5375
DELETE FROM glosas WHERE id_glosa IN ('f083df00-97a8-4fd3-a62b-e574051489ed');
DELETE FROM recebimentos WHERE id_receb IN ('c3b1b237-9def-4bc7-95f7-fadd68dcde5b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-03-02', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 02/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-03-03', 307.40, 307.40, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-03-04', 76.85, 76.85, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 04/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-03-10', 230.55, 230.55, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-03-11', 127.04, 127.04, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 11/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f5efbe20-6eb3-5545-9622-208fc1f5afd6', DATE '2026-05-05', DATE '2026-10-01', 3524.10, 3524.10, 'recebido', 'Baixa do apLIS — lote(s) 5375 (recebido em 01/10/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f5efbe20-6eb3-5545-9622-208fc1f5afd6');

-- NF 8037 | FUSEX | lote(s) 5143
DELETE FROM glosas WHERE id_glosa IN ('396d23cc-00b0-4179-a168-fda99944bf11');
DELETE FROM recebimentos WHERE id_receb IN ('e1188466-a2c2-4609-a633-4b9ff579014b');
UPDATE lotes SET valor_total = 1110.30 WHERE id_lote = '80f0b85a-18af-5ee3-a06a-054c0749ce93';
UPDATE notas SET valor_total = 1110.30 WHERE id_nota = 'ca5d492c-48bc-51b5-8a52-f52417e09622';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', DATE '2026-06-06', DATE '2026-06-17', 933.18, 933.18, 'recebido', 'Baixa do apLIS — lote(s) 5143 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca5d492c-48bc-51b5-8a52-f52417e09622', DATE '2026-06-06', DATE '2026-06-19', 177.12, 177.12, 'recebido', 'Baixa do apLIS — lote(s) 5143 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ca5d492c-48bc-51b5-8a52-f52417e09622');

-- NF 8433 | INAS GDF | lote(s) 5515
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2d113455-d36f-5746-92d2-dc087d2eed8e', 'e0de3675-6cc6-58c5-8a7c-d199c9b2f5f2', 0.39, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2d113455-d36f-5746-92d2-dc087d2eed8e');

-- NF 8708 | GEAP Autogestão em Saúde | lote(s) 3781
DELETE FROM glosas WHERE id_glosa IN ('34cd4fde-f221-4793-a808-46935bfbcdbc');
DELETE FROM recebimentos WHERE id_receb IN ('b62c0e19-f5ab-45f8-b1f6-c6baae98b79e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', DATE '2026-07-01', DATE '2026-08-20', 18604.33, 18604.33, 'recebido', 'Baixa do apLIS — lote(s) 3781 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1d6b62dc-6a8e-5f53-b955-16e65a7de481', '6741a6fa-901a-5085-b4a7-53f1b0bcec47', 9.41, 'QUANTIDADE SOLICITADA ACIMA DA QUANTIDADE PERMITIDA', '1423', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1d6b62dc-6a8e-5f53-b955-16e65a7de481');

-- sem número | INAS GDF | lote(s) 5324
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('63a22f21-e6e6-58f3-bff6-d33c453ad1fc', DATE '2026-05-10', DATE '2026-09-03', 179.50, 179.50, 'recebido', 'Baixa do apLIS — lote(s) 5324 (recebido em 03/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('63a22f21-e6e6-58f3-bff6-d33c453ad1fc');

-- NF 8708 | GEAP Autogestão em Saúde | lote(s) 5354
DELETE FROM glosas WHERE id_glosa IN ('fcdda761-5d9c-453d-8bee-290702b6368a');
DELETE FROM recebimentos WHERE id_receb IN ('61badcae-3efd-437b-b43d-77bfa2034d08');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', DATE '2026-07-09', DATE '2026-08-20', 18895.94, 18895.94, 'recebido', 'Baixa do apLIS — lote(s) 5354 (recebido em 20/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e39273d0-b597-5fce-a6a8-41471b00a187', 'c1a0b488-bbcb-5ff5-a300-b1c1f91bdefc', 36.09, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e39273d0-b597-5fce-a6a8-41471b00a187');

-- sem número | INAS GDF | lote(s) 5568
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3', DATE '2026-05-23', DATE '2026-09-03', 588.35, 588.35, 'recebido', 'Baixa do apLIS — lote(s) 5568 (recebido em 03/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3');

-- sem número | PMDF | lote(s) 5340
DELETE FROM glosas WHERE id_glosa IN ('3c05e53f-801d-4efa-90ec-0d9f84923ac1');
DELETE FROM recebimentos WHERE id_receb IN ('1d92455f-60ac-41ea-b012-07b01209960f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', DATE '2026-05-09', DATE '2026-07-30', 10528.09, 10528.09, 'recebido', 'Baixa do apLIS — lote(s) 5340 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45', 'ca713b59-c10d-510c-b191-28f9d3751adc', 492.92, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45');

-- NF 8433 | INAS GDF | lote(s) 5586
UPDATE lotes SET valor_total = 7044.99 WHERE id_lote = '1481d8ea-6392-5334-873e-b4ec48d2614d';
UPDATE notas SET valor_total = 7044.99 WHERE id_nota = '1e3114f7-8fd7-5334-8d1d-2a210cd3f34d';
SELECT fat_recalcular_nota('1e3114f7-8fd7-5334-8d1d-2a210cd3f34d');

-- NF 8433 | INAS GDF | lote(s) 5622
UPDATE lotes SET valor_total = 3300.54 WHERE id_lote = '15859fcf-58f5-5e2c-9dd8-b228d2ff6ec1';
UPDATE notas SET valor_total = 3300.54 WHERE id_nota = 'ee22dd6c-9b74-52be-a4d5-f045c69e2bc3';
SELECT fat_recalcular_nota('ee22dd6c-9b74-52be-a4d5-f045c69e2bc3');

-- sem número | INAS GDF | lote(s) 5496
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c5f2156d-dc3f-5277-98be-956c1b0f9e9c', DATE '2026-05-23', DATE '2026-09-03', 2042.31, 2042.31, 'recebido', 'Baixa do apLIS — lote(s) 5496 (recebido em 03/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c5f2156d-dc3f-5277-98be-956c1b0f9e9c');

-- sem número | PMDF | lote(s) 5480
DELETE FROM glosas WHERE id_glosa IN ('5448cee2-e6c8-43c0-b19d-45529b8701e2');
DELETE FROM recebimentos WHERE id_receb IN ('1690282e-eff6-4dad-8ac4-32a58b324c0c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', DATE '2026-05-15', DATE '2026-07-30', 13324.94, 13324.94, 'recebido', 'Baixa do apLIS — lote(s) 5480 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8', 'a73842ea-40f2-51bf-9a8d-e519d918071e', 234.65, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d66b4a4b-0e44-5b1c-8948-07d798cac5c8');

-- sem número | PMDF | lote(s) 5491
DELETE FROM glosas WHERE id_glosa IN ('b798f1ad-b4e0-46a3-90b1-80606d9454b5');
DELETE FROM recebimentos WHERE id_receb IN ('916fd13a-4f36-406e-ba08-ccd7dde6c730');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', DATE '2026-05-15', DATE '2026-07-30', 13817.14, 13817.14, 'recebido', 'Baixa do apLIS — lote(s) 5491 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('75f74c60-5e9d-592d-aaee-4b891c2d8989', 'c6426292-7d7a-57b1-8319-63dcd293ecbb', 244.31, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('75f74c60-5e9d-592d-aaee-4b891c2d8989');

-- sem número | PMDF | lote(s) 5259
DELETE FROM glosas WHERE id_glosa IN ('1ce955e0-1fbc-4427-bbe9-ec041220126f');
DELETE FROM recebimentos WHERE id_receb IN ('de733f87-b7b4-479b-96ae-c4b33bc3b358');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', DATE '2026-05-15', DATE '2026-07-30', 8688.74, 8688.74, 'recebido', 'Baixa do apLIS — lote(s) 5259 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('fa5c7de2-ccf1-5c9b-a265-71590617b62b', '1670073f-dba9-5563-b790-dfb3934c4de3', 118.20, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('fa5c7de2-ccf1-5c9b-a265-71590617b62b');

-- sem número | PMDF | lote(s) 5564
DELETE FROM recebimentos WHERE id_receb IN ('af7c9e96-0f40-48f0-8269-d7db18a9c70f');
UPDATE lotes SET valor_total = 5680.74 WHERE id_lote = '827d612f-6f51-54c6-86d2-7579241b5b72';
UPDATE notas SET valor_total = 5680.74 WHERE id_nota = '5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109', DATE '2026-05-15', DATE '2026-07-03', 5071.32, 5071.32, 'recebido', 'Baixa do apLIS — lote(s) 5564 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109');

-- sem número | PMDF | lote(s) 5581
DELETE FROM glosas WHERE id_glosa IN ('a466c206-9864-4f48-9366-0efbc86fa2ce');
DELETE FROM recebimentos WHERE id_receb IN ('3dd710e6-93dc-4507-9a68-7df0a0d78fc7');
UPDATE lotes SET valor_total = 8891.30 WHERE id_lote = 'ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2';
UPDATE notas SET valor_total = 8891.30 WHERE id_nota = '31005941-8d6f-5d94-9f8b-d74537b2002a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', DATE '2026-05-15', DATE '2026-07-30', 5469.82, 5469.82, 'recebido', 'Baixa do apLIS — lote(s) 5581 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('31005941-8d6f-5d94-9f8b-d74537b2002a', 'ba4f5fef-110e-56c7-9c3b-3dc62fd7f4d2', 1444.29, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('31005941-8d6f-5d94-9f8b-d74537b2002a');

-- NF 8306 | LAB PLANASSISTE | lote(s) 5597
DELETE FROM glosas WHERE id_glosa IN ('8e54f42a-e6d2-46e0-82aa-017635bc01dd');
DELETE FROM recebimentos WHERE id_receb IN ('16e767ae-ec63-4eb7-8345-0b604047e79b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', DATE '2026-05-28', DATE '2026-06-22', 589.91, 589.91, 'recebido', 'Baixa do apLIS — lote(s) 5597 (recebido em 22/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('90356160-5d0f-5f44-9d21-3c8511790674', '6e3ef322-c518-5f92-b616-71b34bf7b307', 591.06, 'GUIA SEM ASSINATURA DO ASSISTIDO.', '1319', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('90356160-5d0f-5f44-9d21-3c8511790674');

-- sem número | SAUDE CAIXA | lote(s) 5419
DELETE FROM glosas WHERE id_glosa IN ('d0d5ba20-41e2-463c-ac94-83863a03c1ce');
DELETE FROM recebimentos WHERE id_receb IN ('122d6bb7-1651-4fcf-b514-4b49bf4cf925');
UPDATE lotes SET valor_total = 21699.41 WHERE id_lote = '594956b0-9bf8-5b48-88b8-6b4a3417b781';
UPDATE notas SET valor_total = 21699.41 WHERE id_nota = '652c294c-fb49-59dd-87a5-0a2cfed4bc62';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('652c294c-fb49-59dd-87a5-0a2cfed4bc62', DATE '2026-05-14', DATE '2026-05-25', 21699.41, 21699.41, 'recebido', 'Baixa do apLIS — lote(s) 5419 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('652c294c-fb49-59dd-87a5-0a2cfed4bc62');

-- sem número | SAUDE CAIXA | lote(s) 5563
DELETE FROM glosas WHERE id_glosa IN ('220717e8-16de-4309-b265-3c9b01ff5242');
DELETE FROM recebimentos WHERE id_receb IN ('06cda9a6-b6bf-484f-85ed-2d34b9242102');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', DATE '2026-05-23', DATE '2026-05-25', 22604.52, 22604.52, 'recebido', 'Baixa do apLIS — lote(s) 5563 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12', 'eb1ab3a3-82ca-5ef1-a365-263950416de9', 695.35, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d37f6b78-81ae-5d95-b5ac-659ea70d3b12');

-- sem número | SAUDE CAIXA | lote(s) 5562
DELETE FROM glosas WHERE id_glosa IN ('cca23c51-4bd6-4036-b38f-7cc08c22100d');
DELETE FROM recebimentos WHERE id_receb IN ('94f10b60-1e6a-4fc7-9e5f-f0937a3c7042');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', DATE '2026-05-23', DATE '2026-04-27', 528.61, 528.61, 'recebido', 'Baixa do apLIS — lote(s) 5562 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', DATE '2026-05-23', DATE '2026-05-25', 16676.42, 16676.42, 'recebido', 'Baixa do apLIS — lote(s) 5562 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', DATE '2026-05-23', DATE '2026-07-27', 324.51, 324.51, 'recebido', 'Baixa do apLIS — lote(s) 5562 (recebido em 27/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bd465739-85d3-5438-b862-1aeec66ec37f', '05f0ebf1-fb59-513a-b154-78cdb8a0ceb5', 166.74, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('bd465739-85d3-5438-b862-1aeec66ec37f');

-- sem número | SAUDE CAIXA | lote(s) 5561
DELETE FROM recebimentos WHERE id_receb IN ('76ea8674-4394-4bd5-8106-b97bfadc0e7a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3e53fc80-894f-5d77-bb33-332a2ddf1d3b', DATE '2026-05-23', DATE '2026-05-25', 15681.47, 15681.47, 'recebido', 'Baixa do apLIS — lote(s) 5561 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3e53fc80-894f-5d77-bb33-332a2ddf1d3b');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5629
DELETE FROM glosas WHERE id_glosa IN ('3501ca59-c345-4e5d-a153-c7759927a2f5');
DELETE FROM recebimentos WHERE id_receb IN ('08ccec6a-1f7a-4983-9344-f72cd70923dd');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-03-30', 72.19, 72.19, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-03-31', 137.47, 137.47, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-01', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-02', 868.62, 868.62, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-06', 2636.77, 2636.77, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-07', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-08', 2096.95, 2096.95, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-09', 1899.73, 1899.73, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-13', 1215.82, 1215.82, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 13/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-14', 5325.02, 5325.02, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-15', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-16', 2116.80, 2116.80, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-17', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa8bd94d-3495-5028-8b4a-5058b192cc94', DATE '2026-06-04', DATE '2026-04-24', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5629 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('aa8bd94d-3495-5028-8b4a-5058b192cc94');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5594
DELETE FROM glosas WHERE id_glosa IN ('37a58720-65db-4419-b99b-c12064c838e0');
DELETE FROM recebimentos WHERE id_receb IN ('86b6aa6a-be0a-48f3-a5a6-1665e3e46c3e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-09', 1697.41, 1697.41, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-10', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-13', 465.09, 465.09, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 13/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-14', 1739.76, 1739.76, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-15', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-16', 586.53, 586.53, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-20', 1737.50, 1737.50, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-22', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 22/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4739dcee-92a4-5c14-8897-00d9f287f970', DATE '2026-06-04', DATE '2026-04-27', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 5594 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4739dcee-92a4-5c14-8897-00d9f287f970');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5633
DELETE FROM glosas WHERE id_glosa IN ('2a25be7a-f5e7-4205-a4fc-457fc488bc8c');
DELETE FROM recebimentos WHERE id_receb IN ('b027ba99-d23f-41c8-a832-36b35723ae6b');
UPDATE lotes SET valor_total = 8849.54 WHERE id_lote = '8926def5-047a-53c9-8356-cc9ad696d3da';
UPDATE notas SET valor_total = 8849.54 WHERE id_nota = '25c9db3e-9d9b-53d2-9096-69615b08d64d';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-09', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-16', 84.70, 84.70, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-17', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-20', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-22', 796.43, 796.43, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 22/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-23', 1459.55, 1459.55, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-24', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-27', 1320.37, 1320.37, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('25c9db3e-9d9b-53d2-9096-69615b08d64d', DATE '2026-06-04', DATE '2026-04-28', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5633 (recebido em 28/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('25c9db3e-9d9b-53d2-9096-69615b08d64d');

-- sem número | 090 SULAMERICA | lote(s) 5318
DELETE FROM glosas WHERE id_glosa IN ('4f764d32-b6a6-4882-a09d-f09ad36721c4');
DELETE FROM recebimentos WHERE id_receb IN ('b1c460e2-7d33-486f-a0e5-7ef4b3237876');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', DATE '2026-06-04', DATE '2026-04-22', 321.85, 321.85, 'recebido', 'Baixa do apLIS — lote(s) 5318 (recebido em 22/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9e5100b9-d228-5228-a56d-8cb5f46535a6', DATE '2026-06-04', DATE '2026-06-15', 1609.25, 1609.25, 'recebido', 'Baixa do apLIS — lote(s) 5318 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9e5100b9-d228-5228-a56d-8cb5f46535a6');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5630
DELETE FROM glosas WHERE id_glosa IN ('421cfbe2-2fc5-4fd5-b3ff-4f0c012bd60a');
DELETE FROM recebimentos WHERE id_receb IN ('bd51d399-8fca-43d3-875a-aef3355265fb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-03-05', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-03-27', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 27/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-03-30', 1677.56, 1677.56, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-03-31', 2618.37, 2618.37, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-01', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-02', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-06', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-07', 449.23, 449.23, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-08', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-09', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-13', 3312.77, 3312.77, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 13/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03b3b58b-b72d-5284-81a4-63ea0215af21', DATE '2026-06-04', DATE '2026-04-23', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5630 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('03b3b58b-b72d-5284-81a4-63ea0215af21');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5631
DELETE FROM glosas WHERE id_glosa IN ('b4c2aa7a-ed0a-4906-bd02-32b6ceaa50f4');
DELETE FROM recebimentos WHERE id_receb IN ('56f3a055-d963-4ef6-ba55-406a370aea0c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-03-23', 119.78, 119.78, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 23/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-03-30', 247.13, 247.13, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-03-31', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 31/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-04-01', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-04-07', 123.08, 123.08, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-04-08', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', DATE '2026-06-04', DATE '2026-04-17', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 5631 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e', '405b7511-bbfd-5127-990e-a301951e4147', 451.82, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0e25dc25-cdca-540c-8a3d-5db2b5dca21e');

-- sem número | 090 SULAMERICA | lote(s) 5636
DELETE FROM recebimentos WHERE id_receb IN ('72799822-3c7c-460f-968e-0a93027fa8dc');
UPDATE lotes SET valor_total = 83.31 WHERE id_lote = '24cdfd2d-44aa-51b8-97d3-233c5c08fa37';
UPDATE notas SET valor_total = 83.31 WHERE id_nota = '95aa4ecc-5f55-55af-97f7-4d169da2a523';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95aa4ecc-5f55-55af-97f7-4d169da2a523', DATE '2026-06-04', DATE '2026-03-27', 32.64, 32.64, 'recebido', 'Baixa do apLIS — lote(s) 5636 (recebido em 27/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95aa4ecc-5f55-55af-97f7-4d169da2a523', DATE '2026-06-04', DATE '2026-06-17', 50.67, 50.67, 'recebido', 'Baixa do apLIS — lote(s) 5636 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('95aa4ecc-5f55-55af-97f7-4d169da2a523');

-- NF 8187 | TJDFT | lote(s) 5462
DELETE FROM glosas WHERE id_glosa IN ('6995f493-d1ea-43b2-b70b-7ee6ab04446d');
DELETE FROM recebimentos WHERE id_receb IN ('bf4decdc-ff26-48aa-bf9c-b27469b7bf2e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c', DATE '2026-05-13', DATE '2026-07-17', 4110.08, 4110.08, 'recebido', 'Baixa do apLIS — lote(s) 5462 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c');

-- sem número | CASSI | lote(s) 5761
DELETE FROM glosas WHERE id_glosa IN ('ce597142-cd45-437a-9a0a-dea3e2e030d3');
DELETE FROM recebimentos WHERE id_receb IN ('b09a2ce4-4be6-4d7e-b143-52382dbac390');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', DATE '2026-06-13', DATE '2026-06-09', 10956.36, 10956.36, 'recebido', 'Baixa do apLIS — lote(s) 5761 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d', '3cabe036-cb74-5158-b61f-208a55f391f7', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d');

-- sem número | CASSI | lote(s) 5748
DELETE FROM glosas WHERE id_glosa IN ('9fc8cf28-c0c4-4279-974a-c5fb4d7428f7');
DELETE FROM recebimentos WHERE id_receb IN ('d9ceaa7a-5468-4d3b-92e3-80d1f8ea4d2a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21b892b4-385f-5fc5-8be9-840a561c93b1', DATE '2026-06-12', DATE '2026-06-09', 12518.78, 12518.78, 'recebido', 'Baixa do apLIS — lote(s) 5748 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('21b892b4-385f-5fc5-8be9-840a561c93b1');

-- sem número | CASSI | lote(s) 5698
DELETE FROM glosas WHERE id_glosa IN ('213be560-992f-4709-b422-e700cd504f3f');
DELETE FROM recebimentos WHERE id_receb IN ('7321c65e-504d-43fd-939c-dc95ecaad77a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', DATE '2026-06-12', DATE '2026-06-09', 639.03, 639.03, 'recebido', 'Baixa do apLIS — lote(s) 5698 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2a9fbe03-835d-5ce5-bad2-469344175f6f', '563645a0-3fbd-507a-a4a8-aa923bf25050', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2a9fbe03-835d-5ce5-bad2-469344175f6f');

-- sem número | SIS SENADO | lote(s) 5804
DELETE FROM recebimentos WHERE id_receb IN ('7aaa8391-0d58-4cf8-b793-70d37b19d4de');
UPDATE lotes SET valor_total = 2039.69 WHERE id_lote = 'ac83bf51-ed31-5870-b298-62755ff246c0';
UPDATE notas SET valor_total = 2039.69 WHERE id_nota = '4088c686-da0b-53a8-a07b-67c146f718c1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4088c686-da0b-53a8-a07b-67c146f718c1', DATE '2026-07-20', DATE '2026-07-23', 2039.69, 2039.69, 'recebido', 'Baixa do apLIS — lote(s) 5804 (recebido em 23/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4088c686-da0b-53a8-a07b-67c146f718c1');

-- NF 8473 | LAB PLANASSISTE | lote(s) 5776
DELETE FROM glosas WHERE id_glosa IN ('21ff1ebb-56fa-494c-bcd9-23415bb1f791');
DELETE FROM recebimentos WHERE id_receb IN ('3617a5e3-613e-4829-b68c-5bfe4f2db2d2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', DATE '2026-06-14', DATE '2026-07-06', 37070.95, 37070.95, 'recebido', 'Baixa do apLIS — lote(s) 5776 (recebido em 06/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de', '0574f7bb-5537-5944-9275-c2a19f6b11cb', 920.50, 'GUIA SEM ASSINATURA DO ASSISTIDO.', '1319', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de');

-- sem número | CASSI | lote(s) 5687
DELETE FROM glosas WHERE id_glosa IN ('d035f9a3-1d34-4a57-9126-27ecefdb8f5e');
DELETE FROM recebimentos WHERE id_receb IN ('d3e8d477-02f9-47de-b287-1e02d333aac8');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', DATE '2026-06-12', DATE '2026-06-09', 3326.82, 3326.82, 'recebido', 'Baixa do apLIS — lote(s) 5687 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('88ea1812-4165-53fa-b549-81f6a8de68f4', 'ec70db27-6d07-546e-be9c-343914469344', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('88ea1812-4165-53fa-b549-81f6a8de68f4');

-- sem número | AMHP-DF | lote(s) 5848
DELETE FROM recebimentos WHERE id_receb IN ('2a39faf2-44e6-4987-b7fb-42faca8f2204');
UPDATE lotes SET valor_total = 12594.87 WHERE id_lote = 'f219f80e-ce59-530b-80b2-afab3a472ed5';
UPDATE notas SET valor_total = 12594.87 WHERE id_nota = 'eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef', DATE '2026-07-24', DATE '2026-08-04', 12594.87, 12594.87, 'recebido', 'Baixa do apLIS — lote(s) 5848 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef');

-- NF 8959 | LAB PLANASSISTE | lote(s) 5789
DELETE FROM recebimentos WHERE id_receb IN ('73b3a68c-9969-4c86-8ac0-6c11053c5f71');
UPDATE lotes SET valor_total = 5102.74 WHERE id_lote = 'e2439003-f120-5c8e-96d6-2d514b23b8fd';
UPDATE notas SET valor_total = 5102.74 WHERE id_nota = '2c8b0855-a0aa-5c97-8dd7-9f820babf3bf';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf', DATE '2026-06-17', DATE '2026-08-24', 5102.74, 5102.74, 'recebido', 'Baixa do apLIS — lote(s) 5789 (recebido em 24/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf');

-- sem número | CASSI | lote(s) 5702
DELETE FROM glosas WHERE id_glosa IN ('a28f3f67-e274-4a46-b3bc-eef8afe03a5b');
DELETE FROM recebimentos WHERE id_receb IN ('385a0237-cc1c-4cb9-b343-a4854ab41c6a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', DATE '2026-06-10', DATE '2026-06-09', 7894.56, 7894.56, 'recebido', 'Baixa do apLIS — lote(s) 5702 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('57a06624-aec1-52fd-b842-f6a9a02abfad', '7e37a58c-febf-5b44-9a72-80a57d44d599', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('57a06624-aec1-52fd-b842-f6a9a02abfad');

-- NF 8240 | CASSI | lote(s) 5688
DELETE FROM glosas WHERE id_glosa IN ('b1dbe828-4d97-4a57-82f8-f2cb811b19b9');
DELETE FROM recebimentos WHERE id_receb IN ('dc2cb384-8a72-4335-a177-80661c0b896e');
UPDATE lotes SET valor_total = 6114.15 WHERE id_lote = 'ad77a1cf-8679-5568-bd5c-dbf0e4332558';
UPDATE notas SET valor_total = 6114.15 WHERE id_nota = '87388ab8-06ed-5fac-b5d4-88871aacda44';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', DATE '2026-06-07', DATE '2026-06-09', 6114.13, 6114.13, 'recebido', 'Baixa do apLIS — lote(s) 5688 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('87388ab8-06ed-5fac-b5d4-88871aacda44', 'ad77a1cf-8679-5568-bd5c-dbf0e4332558', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('87388ab8-06ed-5fac-b5d4-88871aacda44');

-- NF 8240 | CASSI | lote(s) 5683
DELETE FROM glosas WHERE id_glosa IN ('ac3dd41c-a225-42a8-b733-793ab9795d16');
DELETE FROM recebimentos WHERE id_receb IN ('b81b6b30-2532-4df5-80a6-ab8188a90b93');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', DATE '2026-06-07', DATE '2026-06-09', 25613.37, 25613.37, 'recebido', 'Baixa do apLIS — lote(s) 5683 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('17cfba74-484d-5d55-aa0c-8a1a68aa9906', '500d4402-ef05-557a-8ec4-ed4f6b41c249', 911.48, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('17cfba74-484d-5d55-aa0c-8a1a68aa9906');

-- NF 8240 | CASSI | lote(s) 5363
DELETE FROM glosas WHERE id_glosa IN ('4878021e-60b7-4bcc-87a3-864860e5c5a1');
DELETE FROM recebimentos WHERE id_receb IN ('cf1b4ffc-50dd-4771-9791-0cd5210f0a16');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', DATE '2026-06-07', DATE '2026-06-09', 2257.03, 2257.03, 'recebido', 'Baixa do apLIS — lote(s) 5363 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c05b2ca4-8921-5019-a4a5-1938d0bc999c', '3d224600-6546-58f1-9866-cd89e732bb8e', 0.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c05b2ca4-8921-5019-a4a5-1938d0bc999c');

-- NF 8240 | CASSI | lote(s) 5685
DELETE FROM glosas WHERE id_glosa IN ('77a4aa9b-90eb-46e3-b328-b8704ad91a73');
DELETE FROM recebimentos WHERE id_receb IN ('0b6bf03e-c995-403f-a986-fe28fb7c23c5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', DATE '2026-06-06', DATE '2026-06-09', 26807.83, 26807.83, 'recebido', 'Baixa do apLIS — lote(s) 5685 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe', 'f29db4b7-34fa-53ac-aa0a-c36913bf9de7', 1595.09, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe');

-- NF 8240 | CASSI | lote(s) 5684
DELETE FROM glosas WHERE id_glosa IN ('85b61773-bb01-4ba2-a2c1-dd33fb0265a8');
DELETE FROM recebimentos WHERE id_receb IN ('ee63bfc7-1373-46a4-ab67-276f8f0a6c24');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', DATE '2026-06-06', DATE '2026-06-09', 28518.88, 28518.88, 'recebido', 'Baixa do apLIS — lote(s) 5684 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', 'ffb238d7-b7bb-5433-b142-56402e426f50', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c', 'ffb238d7-b7bb-5433-b142-56402e426f50', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('df124c26-a4ed-5d19-ac9a-26a5c622ec9c');

-- NF 8240 | CASSI | lote(s) 5552
DELETE FROM glosas WHERE id_glosa IN ('49f997e1-2009-4f7b-b4c1-37fe970c1fa4');
DELETE FROM recebimentos WHERE id_receb IN ('85d7544c-8c65-4375-a272-fa5c56ce4ea4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('24093a05-5b09-510c-9160-efd5b3937fd0', DATE '2026-06-06', DATE '2026-06-09', 12438.26, 12438.26, 'recebido', 'Baixa do apLIS — lote(s) 5552 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('24093a05-5b09-510c-9160-efd5b3937fd0');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5873
DELETE FROM glosas WHERE id_glosa IN ('d10e8250-8466-454b-a315-64ac27af9cd6');
DELETE FROM recebimentos WHERE id_receb IN ('584e9130-5ada-4d6f-b89a-c77b150d3e5f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', DATE '2026-07-24', DATE '2026-05-26', 141.93, 141.93, 'recebido', 'Baixa do apLIS — lote(s) 5873 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('70785315-8db2-5192-be17-b96ab447e1fc', 'f5674e2d-1e88-58b1-9cac-b33d87d9910c', 3412.15, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('70785315-8db2-5192-be17-b96ab447e1fc');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 5860
DELETE FROM glosas WHERE id_glosa IN ('b7537c15-b10f-4a9a-93fb-b25f61933ab1');
DELETE FROM recebimentos WHERE id_receb IN ('a65870b3-c7ef-4230-90c4-a0d8c244d216');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', DATE '2026-07-24', DATE '2026-05-25', 4075.77, 4075.77, 'recebido', 'Baixa do apLIS — lote(s) 5860 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('254647cb-291a-5054-b670-ce9ffdd3cb83', DATE '2026-07-24', DATE '2026-06-30', 4184.49, 4184.49, 'recebido', 'Baixa do apLIS — lote(s) 5860 (recebido em 30/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('254647cb-291a-5054-b670-ce9ffdd3cb83');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5857
DELETE FROM glosas WHERE id_glosa IN ('961c00dd-3fae-4bf3-811b-a65e347c25d6');
DELETE FROM recebimentos WHERE id_receb IN ('df02cf8b-7b21-4ff4-982d-8fe85f81c2de');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', DATE '2026-07-24', DATE '2026-05-25', 1965.73, 1965.73, 'recebido', 'Baixa do apLIS — lote(s) 5857 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3d0d042e-2d27-57ed-9c12-1e440841f93a', 'f4e42276-f401-555c-930e-7f4cd5a85941', 4938.05, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3d0d042e-2d27-57ed-9c12-1e440841f93a');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5724
DELETE FROM recebimentos WHERE id_receb IN ('448d0ca2-b96a-4c26-a916-27440ef1cbe6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', DATE '2026-07-03', DATE '2026-04-02', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5724 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', DATE '2026-07-03', DATE '2026-04-08', 408.14, 408.14, 'recebido', 'Baixa do apLIS — lote(s) 5724 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', DATE '2026-07-03', DATE '2026-04-09', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 5724 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', '7f94e0fb-504d-5ad2-bff1-80a7e9bd3dd7', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0b12654d-481a-5d16-b293-959846dd7009', '7f94e0fb-504d-5ad2-bff1-80a7e9bd3dd7', 88.24, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0b12654d-481a-5d16-b293-959846dd7009');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5908
DELETE FROM glosas WHERE id_glosa IN ('1b7c79d0-0723-4339-a998-e3f457f577fb');
DELETE FROM recebimentos WHERE id_receb IN ('eb00c8b6-2778-49fa-8e52-68372539c682');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-04-14', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-04-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-04-28', 479.07, 479.07, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 28/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-04-29', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-04-30', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-04', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 04/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-05', 1666.31, 1666.31, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-06', 2558.69, 2558.69, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-07', 504.09, 504.09, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-12', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-13', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-15', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', DATE '2026-07-03', DATE '2026-05-18', 460.61, 460.61, 'recebido', 'Baixa do apLIS — lote(s) 5908 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('12bf6e30-6b8c-5372-a1be-c089687a527f', 'fc3a2d61-2a03-50e6-80ec-e359838f3c18', 12.38, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('12bf6e30-6b8c-5372-a1be-c089687a527f');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5909
DELETE FROM glosas WHERE id_glosa IN ('dd372cc0-09e5-4d30-951b-8696a07c4d22');
DELETE FROM recebimentos WHERE id_receb IN ('5efe8393-92c3-4525-b025-56e16bf96327');
UPDATE lotes SET valor_total = 9887.90 WHERE id_lote = '72b6cf14-5ec0-57c6-b446-8e025f58fdc8';
UPDATE notas SET valor_total = 9887.90 WHERE id_nota = '9935f496-370a-5f7a-b59d-f3fa382f505a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-04-30', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-06', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-07', 29.84, 29.84, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-12', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-13', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-14', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 14/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-15', 954.09, 954.09, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-20', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-22', 2862.18, 2862.18, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', DATE '2026-07-03', DATE '2026-05-25', 1215.82, 1215.82, 'recebido', 'Baixa do apLIS — lote(s) 5909 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8', 61.54, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9935f496-370a-5f7a-b59d-f3fa382f505a', '72b6cf14-5ec0-57c6-b446-8e025f58fdc8', 97.54, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9935f496-370a-5f7a-b59d-f3fa382f505a');

-- NF 8272 | POSTAL SAÚDE | lote(s) 5154
DELETE FROM glosas WHERE id_glosa IN ('d23e248f-ab31-4386-b6fd-6f249aaa3f2c');
DELETE FROM recebimentos WHERE id_receb IN ('3596584d-b339-4be1-adf4-558da2c42a30');
UPDATE lotes SET valor_total = 8282.27 WHERE id_lote = '2f223682-e728-5b36-a83f-6b34783bc2b6';
UPDATE notas SET valor_total = 8282.27 WHERE id_nota = 'b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', DATE '2026-07-03', DATE '2026-07-02', 8282.26, 8282.26, 'recebido', 'Baixa do apLIS — lote(s) 5154 (recebido em 02/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5', '2f223682-e728-5b36-a83f-6b34783bc2b6', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5906
DELETE FROM glosas WHERE id_glosa IN ('267b79ad-17f3-4b04-8d10-0c6110261841');
DELETE FROM recebimentos WHERE id_receb IN ('5290171f-1f96-4c48-b233-4cda1bebd237');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-04-23', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-04-27', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-04-29', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-04-30', 1719.91, 1719.91, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-04', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 04/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-05', 1794.90, 1794.90, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-07', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-11', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 11/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-12', 41.22, 41.22, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', DATE '2026-07-03', DATE '2026-05-13', 449.36, 449.36, 'recebido', 'Baixa do apLIS — lote(s) 5906 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', '226d823e-8f65-5c0b-8ae9-4bc8f52ba357', 13.51, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('20ebc0e2-4aea-5dbb-91ee-c20439702e19', '226d823e-8f65-5c0b-8ae9-4bc8f52ba357', 9.71, 'Código 3309 (do apLIS)', '3309', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('20ebc0e2-4aea-5dbb-91ee-c20439702e19');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5827
DELETE FROM glosas WHERE id_glosa IN ('6c18e587-4021-41cb-a76b-f542e3b42343');
DELETE FROM recebimentos WHERE id_receb IN ('50ddb1c7-f38d-476b-8526-86f76f358bfe');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9d0460cd-ac6d-5e52-8991-5adf29567016', DATE '2026-07-20', DATE '2026-05-21', 9746.81, 9746.81, 'recebido', 'Baixa do apLIS — lote(s) 5827 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9d0460cd-ac6d-5e52-8991-5adf29567016');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 5837
DELETE FROM glosas WHERE id_glosa IN ('b85c874e-2d2d-4da1-9bec-031e840f3f88');
DELETE FROM recebimentos WHERE id_receb IN ('336745d7-4bf4-4973-80fb-002600065877');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', DATE '2026-07-20', DATE '2026-06-30', 867.39, 867.39, 'recebido', 'Baixa do apLIS — lote(s) 5837 (recebido em 30/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b', '5e1d84ff-201b-5da9-a8dc-f59d64ec10b8', 3.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b');

-- NF 8669 | INAS GDF | lote(s) 5768
DELETE FROM recebimentos WHERE id_receb IN ('25865b9e-4838-42a8-8815-8720c9f20c5a');
SELECT fat_recalcular_nota('141ae7bf-ae68-5e3f-966a-04ed05727458');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5916
DELETE FROM glosas WHERE id_glosa IN ('543f82ee-6cb1-463f-b9f9-b23bf18c86ca');
DELETE FROM recebimentos WHERE id_receb IN ('b79d825c-7b56-4798-b294-ab158f286c59');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', DATE '2026-07-03', DATE '2026-05-08', 2030.51, 2030.51, 'recebido', 'Baixa do apLIS — lote(s) 5916 (recebido em 08/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', DATE '2026-07-03', DATE '2026-05-11', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 5916 (recebido em 11/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', DATE '2026-07-03', DATE '2026-05-12', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 5916 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', DATE '2026-07-03', DATE '2026-05-19', 2516.34, 2516.34, 'recebido', 'Baixa do apLIS — lote(s) 5916 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', DATE '2026-07-03', DATE '2026-05-20', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5916 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527', 170.50, 'Código 3202 (do apLIS)', '3202', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('86b9a195-cec9-5fb8-add5-e5a824ad6381', '44e2766e-f0ed-5993-9531-04a5ad015527', 97.54, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('86b9a195-cec9-5fb8-add5-e5a824ad6381');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5915
DELETE FROM glosas WHERE id_glosa IN ('f13f025a-35ad-44a0-bba4-2903b35dbd4b');
DELETE FROM recebimentos WHERE id_receb IN ('0af5958e-fec1-4a8f-bcd0-e20f107a04e4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-04', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 04/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-05', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-06', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-11', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 11/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-12', 796.43, 796.43, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-14', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 14/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-19', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-20', 869.88, 869.88, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-21', 1635.21, 1635.21, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-26', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', DATE '2026-07-03', DATE '2026-05-27', 84.70, 84.70, 'recebido', 'Baixa do apLIS — lote(s) 5915 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('183180c0-49f6-5758-b0b6-1120f1ee5633', '175f2b1f-d5bf-5d56-bc3a-64a9a2b3d072', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('183180c0-49f6-5758-b0b6-1120f1ee5633');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5923
DELETE FROM recebimentos WHERE id_receb IN ('7acc3f54-df77-4d7c-ae68-6cd35efbc3e6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', DATE '2026-07-03', DATE '2026-04-20', 102.89, 102.89, 'recebido', 'Baixa do apLIS — lote(s) 5923 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', DATE '2026-07-03', DATE '2026-05-25', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5923 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', DATE '2026-07-03', DATE '2026-05-27', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5923 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('31b321eb-6c54-5fd0-876e-72aabb343761', DATE '2026-07-03', DATE '2026-05-28', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 5923 (recebido em 28/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('31b321eb-6c54-5fd0-876e-72aabb343761');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 5833
DELETE FROM recebimentos WHERE id_receb IN ('f1758119-4dd0-4af1-8572-6b0811bef390');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf', DATE '2026-07-19', DATE '2026-06-30', 14278.11, 14278.11, 'recebido', 'Baixa do apLIS — lote(s) 5833 (recebido em 30/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf');

-- NF 8961 | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 5929
DELETE FROM glosas WHERE id_glosa IN ('4365479a-b503-492c-88d2-1567c4d5f9c4');
DELETE FROM recebimentos WHERE id_receb IN ('773f8631-f7be-4017-a30a-79b7cdd77f0a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-03-30', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 30/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-04-01', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-04-09', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 09/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-04-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-05', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-06', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-12', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-14', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 14/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-15', 377.04, 377.04, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b293d685-258a-50e9-96a5-1138f8290f45', DATE '2026-07-03', DATE '2026-05-19', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 5929 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b293d685-258a-50e9-96a5-1138f8290f45');

-- NF 8452 | TJDFT | lote(s) 5721
DELETE FROM glosas WHERE id_glosa IN ('9a003a9e-b7c9-411d-9c2a-78515474bd40');
DELETE FROM recebimentos WHERE id_receb IN ('7392478e-cffc-4e62-a525-5150a0732b9f');
UPDATE lotes SET valor_total = 3084.80 WHERE id_lote = 'd42ff2c9-f74f-510d-813d-6f23d9323f8c';
UPDATE notas SET valor_total = 3084.80 WHERE id_nota = '95413d59-814c-5d7f-a46c-3635c2677eb4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95413d59-814c-5d7f-a46c-3635c2677eb4', DATE '2026-06-14', DATE '2026-08-14', 3084.80, 3084.80, 'recebido', 'Baixa do apLIS — lote(s) 5721 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('95413d59-814c-5d7f-a46c-3635c2677eb4');

-- NF 8272 | POSTAL SAÚDE | lote(s) 5637
DELETE FROM glosas WHERE id_glosa IN ('2254bea9-70e9-4cbb-9859-126dd14adc29');
DELETE FROM recebimentos WHERE id_receb IN ('9de2e808-63fe-4197-8d91-cad427a7a40b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', DATE '2026-07-03', DATE '2026-07-02', 28504.46, 28504.46, 'recebido', 'Baixa do apLIS — lote(s) 5637 (recebido em 02/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('40ed34b6-449b-56a8-8305-658d4b9a15bc', '144e579d-8c3d-5570-b5aa-8504d07a7f37', 523.13, 'COBRANÇA DE PROCEDIMENTO QUE EXIGE AUTORIZAÇÃO PRÉVIA', '1818', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('40ed34b6-449b-56a8-8305-658d4b9a15bc');

-- NF 8564 | TJDFT | lote(s) 5757
DELETE FROM glosas WHERE id_glosa IN ('95ee63de-fe59-4002-a6ae-e38bc42ca656');
DELETE FROM recebimentos WHERE id_receb IN ('4d5a1b09-ef48-4e7c-ac4e-22674b0e993d');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', DATE '2026-06-14', DATE '2026-08-14', 76.61, 76.61, 'recebido', 'Baixa do apLIS — lote(s) 5757 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74', '57877bfc-d654-566d-9398-d61e819867ed', 70.48, 'PROCEDIMENTO NÃO AUTORIZADO', '1815', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2a8eeb9f-5792-53d9-be68-e381e4d5ce74');

-- NF 8452 | TJDFT | lote(s) 5758
DELETE FROM glosas WHERE id_glosa IN ('979da20d-c5a2-4aa9-9dbe-ba14933367c0');
DELETE FROM recebimentos WHERE id_receb IN ('bc903d7c-0bac-4211-9628-302b41192e03');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', DATE '2026-06-14', DATE '2026-08-14', 1813.33, 1813.33, 'recebido', 'Baixa do apLIS — lote(s) 5758 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae', '9332e6b2-2a7e-53bb-815f-88428b0414c4', 0.76, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae');

-- NF 8452 | TJDFT | lote(s) 5755
DELETE FROM glosas WHERE id_glosa IN ('23158fea-ee11-4279-9a3e-86f3e4e37de8');
DELETE FROM recebimentos WHERE id_receb IN ('3ba40ccc-6a0b-45d3-92cb-49b83812077c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', DATE '2026-06-14', DATE '2026-08-14', 4731.50, 4731.50, 'recebido', 'Baixa do apLIS — lote(s) 5755 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('14b8e50c-a9be-5396-a045-7b21f7719d2a', 'e0f835ea-8f37-5be3-8979-fd50b963c75e', 73.31, 'PROCEDIMENTO NÃO AUTORIZADO', '1815', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('14b8e50c-a9be-5396-a045-7b21f7719d2a');

-- sem número | AMHP-DF | lote(s) 5735
DELETE FROM recebimentos WHERE id_receb IN ('e5149eba-0ca9-4eb4-83a9-bbdf794ae0c3');
UPDATE lotes SET valor_total = 792.69 WHERE id_lote = 'da443d09-b695-5a81-b9e1-54e4af8214ff';
UPDATE notas SET valor_total = 792.69 WHERE id_nota = '2b634aea-cb93-5c16-a61f-b1b23c859ae1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2b634aea-cb93-5c16-a61f-b1b23c859ae1', DATE '2026-07-11', DATE '2026-06-02', 463.50, 463.50, 'recebido', 'Baixa do apLIS — lote(s) 5735 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2b634aea-cb93-5c16-a61f-b1b23c859ae1', DATE '2026-07-11', DATE '2026-06-15', 344.71, 344.71, 'recebido', 'Baixa do apLIS — lote(s) 5735 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2b634aea-cb93-5c16-a61f-b1b23c859ae1');

-- NF 8452 | TJDFT | lote(s) 5753
DELETE FROM glosas WHERE id_glosa IN ('9641d0c6-aaa8-40ca-9dfa-1bde8fb3fc82');
DELETE FROM recebimentos WHERE id_receb IN ('a24c7bbe-f427-4426-9080-5298f869aa62');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', DATE '2026-06-14', DATE '2026-08-14', 15249.27, 15249.27, 'recebido', 'Baixa do apLIS — lote(s) 5753 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', 'e300ba6f-412e-5787-acbd-2fa86a8ce306', 74.33, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5', 'e300ba6f-412e-5787-acbd-2fa86a8ce306', 6.61, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('45ea4ea5-93e2-54cb-8244-ce72d2121ee5');

-- NF 8452 | TJDFT | lote(s) 5200
DELETE FROM glosas WHERE id_glosa IN ('848d595f-4c81-48d0-b16f-2ad44240c9d0');
DELETE FROM recebimentos WHERE id_receb IN ('e756c170-a45a-4228-921f-264e54b8cfbf');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', DATE '2026-06-14', DATE '2026-08-14', 12909.62, 12909.62, 'recebido', 'Baixa do apLIS — lote(s) 5200 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', 'c9c64cbc-966b-59c9-9564-7e82f90d72cc', 100.77, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5ff76833-9571-53b5-a107-f42d010da85f', 'c9c64cbc-966b-59c9-9564-7e82f90d72cc', 234.99, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5ff76833-9571-53b5-a107-f42d010da85f');

-- sem número | POSTAL SAÚDE | lote(s) 5647
DELETE FROM recebimentos WHERE id_receb IN ('2d359138-788d-4de7-bd99-4df710525ed9');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0aa5a68f-98e9-58be-be5e-587111864cff', '0515d94c-754f-5b22-aaea-b0e1e8d26353', 8.78, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0aa5a68f-98e9-58be-be5e-587111864cff', '0515d94c-754f-5b22-aaea-b0e1e8d26353', 5192.39, 'DOCUMENTAÇÃO INCOMPLETA, INCORRETA OU AUSENTE', '3052', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0aa5a68f-98e9-58be-be5e-587111864cff');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5812
DELETE FROM glosas WHERE id_glosa IN ('66da4b08-e4d2-408a-954f-483d13a854e2');
DELETE FROM recebimentos WHERE id_receb IN ('d159e5bf-a66d-4b5b-bae3-be7d8bb648cb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', DATE '2026-07-19', DATE '2026-05-20', 16860.05, 16860.05, 'recebido', 'Baixa do apLIS — lote(s) 5812 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a4446b1f-1cac-59a2-9319-081288cd4d81', '2fab303b-9c8f-59a2-9805-85665ae5e098', 3.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a4446b1f-1cac-59a2-9319-081288cd4d81');

-- NF 8452 | TJDFT | lote(s) 5767
DELETE FROM glosas WHERE id_glosa IN ('42f4d887-60f0-432f-9804-9e6a882c0255');
DELETE FROM recebimentos WHERE id_receb IN ('4aa5a298-5e36-4bc8-a6c0-de3e0ec8509e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8e38784d-f943-5c94-adac-87662e9de773', DATE '2026-06-14', DATE '2026-08-14', 1804.18, 1804.18, 'recebido', 'Baixa do apLIS — lote(s) 5767 (recebido em 14/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8e38784d-f943-5c94-adac-87662e9de773', '56204c5f-87f5-5f96-818b-c14d21910db9', 6.61, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8e38784d-f943-5c94-adac-87662e9de773', '56204c5f-87f5-5f96-818b-c14d21910db9', 1275.92, 'PROCEDIMENTO NÃO AUTORIZADO', '1815', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8e38784d-f943-5c94-adac-87662e9de773');

-- NF 8317 | STJ | lote(s) 5805
DELETE FROM glosas WHERE id_glosa IN ('fc955435-31b8-4b89-ae88-76a0843aa511');
DELETE FROM recebimentos WHERE id_receb IN ('db312394-1cf7-4c7e-ba55-c5b5ad316f7b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', DATE '2026-06-15', DATE '2026-07-01', 30412.84, 30412.84, 'recebido', 'Baixa do apLIS — lote(s) 5805 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('127bd150-6c67-5272-94fd-41e0e4a7f91d', 'b42160fd-b3d9-569c-8ea2-2b8cfa7168f2', 1170.96, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('127bd150-6c67-5272-94fd-41e0e4a7f91d');

-- NF 8317 | STJ | lote(s) 5839
DELETE FROM glosas WHERE id_glosa IN ('ab361831-2dc2-4c3f-8b5a-70bbebed3a1f');
DELETE FROM recebimentos WHERE id_receb IN ('aef066c0-3974-4bc1-bda9-d77e47b91165');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', DATE '2026-06-15', DATE '2026-07-01', 132.12, 132.12, 'recebido', 'Baixa do apLIS — lote(s) 5839 (recebido em 01/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('dbdedbf8-825b-511c-881c-af2d6bea8e14', '7bdabc09-2cc1-5a5c-9dad-7906d5a2ac76', 79.92, 'FATURAMENTO INVÁLIDO', '1713', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('dbdedbf8-825b-511c-881c-af2d6bea8e14');

-- sem número | FASCAL | lote(s) 5657
DELETE FROM glosas WHERE id_glosa IN ('966f794f-d194-4fa8-acc4-4511dac3ab6a');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22', 'a46f77bd-5dca-59e9-86d5-7d6c3bfc8284', 319.68, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22');

-- NF 8317 | STJ | lote(s) 5821
DELETE FROM recebimentos WHERE id_receb IN ('14ac9c9b-d166-45c5-88d8-a643c943b5d4');
SELECT fat_recalcular_nota('dfdff833-c3a8-522c-9d34-753a602d0bf9');

-- sem número | TST | lote(s) 5844
DELETE FROM glosas WHERE id_glosa IN ('aad8375b-49db-4657-9f31-a8833ccfdc7f');
DELETE FROM recebimentos WHERE id_receb IN ('9e9d951a-c360-481f-a227-f52d302973eb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', DATE '2026-06-20', DATE '2026-07-10', 4328.19, 4328.19, 'recebido', 'Baixa do apLIS — lote(s) 5844 (recebido em 10/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4', '3c4231d7-8648-51d9-b19b-a6a8a6c62434', 0.07, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8961fb8b-f0e5-5045-b78f-bdca95caa3d4');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 5808
DELETE FROM glosas WHERE id_glosa IN ('abc8a3f5-2ea4-45d7-8807-4793b9dc08da');
DELETE FROM recebimentos WHERE id_receb IN ('bf64e9d8-095a-4187-aa6e-5d4fbf84b033');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', DATE '2026-07-19', DATE '2026-05-20', 21109.14, 21109.14, 'recebido', 'Baixa do apLIS — lote(s) 5808 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e9160fcf-911a-5b03-b56b-63c9e3b418b5', 'df272414-6e29-5c7e-85b2-f9a4f0a6d900', 3.38, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e9160fcf-911a-5b03-b56b-63c9e3b418b5');

-- sem número | CASSI | lote(s) 5763
DELETE FROM glosas WHERE id_glosa IN ('98787a6a-f2ca-422d-9245-900d2479eef3');
DELETE FROM recebimentos WHERE id_receb IN ('306de192-b50c-4808-b97f-028f047178a5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', DATE '2026-06-13', DATE '2026-06-09', 5747.21, 5747.21, 'recebido', 'Baixa do apLIS — lote(s) 5763 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d462fda9-bb0b-519e-97f7-70d29aba9d0f', '9bbc01e1-cd6b-565c-821d-51af0c843ea7', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d462fda9-bb0b-519e-97f7-70d29aba9d0f');

-- NF 8409 | ASSEFAZ | lote(s) 5697
DELETE FROM glosas WHERE id_glosa IN ('885718ed-4124-4aa4-9534-c00b4e0cb686');
DELETE FROM recebimentos WHERE id_receb IN ('fd680c05-cc12-4211-901f-a9b41153b592');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', DATE '2026-06-20', DATE '2026-05-04', 400.86, 400.86, 'recebido', 'Baixa do apLIS — lote(s) 5697 (recebido em 04/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', DATE '2026-06-20', DATE '2026-05-05', 425.59, 425.59, 'recebido', 'Baixa do apLIS — lote(s) 5697 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', '7e10b121-1942-5a7e-8bf1-6c299aa269c0', 55.02, 'NÚMERO DA CARTEIRA INVÁLIDO', '1001', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3', '7e10b121-1942-5a7e-8bf1-6c299aa269c0', 1.12, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('589d7ba7-c30f-5df4-90e9-d5f72a553ab3');

-- sem número | AMHP-DF | lote(s) 5704
DELETE FROM recebimentos WHERE id_receb IN ('3814f67a-8320-40c8-a156-8024a471d5e0');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', DATE '2026-07-10', DATE '2026-06-02', 291.90, 291.90, 'recebido', 'Baixa do apLIS — lote(s) 5704 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', DATE '2026-07-10', DATE '2026-07-03', 80.60, 80.60, 'recebido', 'Baixa do apLIS — lote(s) 5704 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', DATE '2026-07-10', DATE '2026-07-15', 118.02, 118.02, 'recebido', 'Baixa do apLIS — lote(s) 5704 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6fcff783-2b6f-51a2-b728-45991f1449ae', '64e0363c-0b31-5619-979f-fa5a23fe1778', 22.48, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6fcff783-2b6f-51a2-b728-45991f1449ae');

-- sem número | AMHP-DF | lote(s) 5620
DELETE FROM recebimentos WHERE id_receb IN ('8d1e1c53-2f43-422b-a7e5-64622e55dce7');
UPDATE lotes SET valor_total = 760.33 WHERE id_lote = '2c82c05c-4504-5e36-96e6-36b656b48b78';
UPDATE notas SET valor_total = 760.33 WHERE id_nota = '0f17bbd5-97c9-5b3f-86c5-0e444f93e17a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a', DATE '2026-07-12', DATE '2026-07-17', 794.58, 794.58, 'recebido', 'Baixa do apLIS — lote(s) 5620 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a');

-- sem número | AMHP-DF | lote(s) 5608
DELETE FROM recebimentos WHERE id_receb IN ('b3ac1c9a-6c4b-4cea-9075-53492dcdf15e');
UPDATE lotes SET valor_total = 5366.26 WHERE id_lote = 'ebdbc9c8-c3c5-5cf1-9440-c5bd3775f488';
UPDATE notas SET valor_total = 5366.26 WHERE id_nota = '1d94fa52-7295-5606-b2fb-325b8a45a3fb';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1d94fa52-7295-5606-b2fb-325b8a45a3fb', DATE '2026-07-03', DATE '2026-06-17', 3306.76, 3306.76, 'recebido', 'Baixa do apLIS — lote(s) 5608 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('1d94fa52-7295-5606-b2fb-325b8a45a3fb');

-- sem número | AMHP-DF | lote(s) 5740
DELETE FROM recebimentos WHERE id_receb IN ('f79a4fb3-3aec-4335-ad2b-db2c7a087c69');
UPDATE lotes SET valor_total = 1742.71 WHERE id_lote = '386ade40-f86c-56c3-bebc-738cfa82c476';
UPDATE notas SET valor_total = 1742.71 WHERE id_nota = '3101e4d0-535a-5dcd-b3f4-03bbf36dfa56';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56', DATE '2026-07-12', DATE '2026-07-31', 453.17, 453.17, 'recebido', 'Baixa do apLIS — lote(s) 5740 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56', DATE '2026-07-12', DATE '2026-08-04', 1306.93, 1306.93, 'recebido', 'Baixa do apLIS — lote(s) 5740 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56');

-- sem número | AMHP-DF | lote(s) 5883
DELETE FROM recebimentos WHERE id_receb IN ('5552ab5a-fdba-426e-86d1-4bfc66e06dbd');
UPDATE lotes SET valor_total = 717.44 WHERE id_lote = '5ada7602-837d-52c4-a59d-3bae2e4e7ca0';
UPDATE notas SET valor_total = 717.44 WHERE id_nota = 'abe49c02-b178-53a8-840d-d8ed2bc30eff';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('abe49c02-b178-53a8-840d-d8ed2bc30eff', DATE '2026-07-25', DATE '2026-07-15', 1115.34, 1115.34, 'recebido', 'Baixa do apLIS — lote(s) 5883 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('abe49c02-b178-53a8-840d-d8ed2bc30eff');

-- sem número | AMHP-DF | lote(s) 5610
DELETE FROM recebimentos WHERE id_receb IN ('1fc14385-3a18-4d9b-b9c0-4956c268b65e');
UPDATE lotes SET valor_total = 2412.21 WHERE id_lote = 'f8a9de6a-91ec-5faa-a643-846abe87791c';
UPDATE notas SET valor_total = 2412.21 WHERE id_nota = 'f3dc6e0c-78a5-5a75-968a-5e290b5aa346';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346', DATE '2026-07-03', DATE '2026-06-15', 1740.95, 1740.95, 'recebido', 'Baixa do apLIS — lote(s) 5610 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346', DATE '2026-07-03', DATE '2026-07-15', 767.05, 767.05, 'recebido', 'Baixa do apLIS — lote(s) 5610 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f3dc6e0c-78a5-5a75-968a-5e290b5aa346');

-- sem número | AMHP-DF | lote(s) 5733
DELETE FROM recebimentos WHERE id_receb IN ('dff3793d-98b7-49a3-a5cf-8c53e98847f4');
UPDATE lotes SET valor_total = 3920.06 WHERE id_lote = '5f65baab-403f-5369-bf83-c09c147630cb';
UPDATE notas SET valor_total = 3920.06 WHERE id_nota = 'd95ef509-dae0-5405-98c2-555729e6cb8c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d95ef509-dae0-5405-98c2-555729e6cb8c', DATE '2026-07-11', DATE '2026-07-15', 2999.25, 2999.25, 'recebido', 'Baixa do apLIS — lote(s) 5733 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d95ef509-dae0-5405-98c2-555729e6cb8c', DATE '2026-07-11', DATE '2026-07-17', 68.95, 68.95, 'recebido', 'Baixa do apLIS — lote(s) 5733 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d95ef509-dae0-5405-98c2-555729e6cb8c');

-- NF 8409 | ASSEFAZ | lote(s) 5666
DELETE FROM glosas WHERE id_glosa IN ('42818be5-25ad-463d-8694-d8daf7d5ccf9');
DELETE FROM recebimentos WHERE id_receb IN ('a6505be6-045f-41d0-b8f2-b46e92329191');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-15', 809.11, 809.11, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-20', 741.42, 741.42, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-23', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-24', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-27', 23.85, 23.85, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-04-30', 862.28, 862.28, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-05-04', 626.57, 626.57, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 04/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', DATE '2026-06-20', DATE '2026-05-06', 270.99, 270.99, 'recebido', 'Baixa do apLIS — lote(s) 5666 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b27544a9-a615-5a67-9451-b4128e73c153', '9813581a-660a-5f8c-b7e0-f0bfc1aa33bf', 0.27, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b27544a9-a615-5a67-9451-b4128e73c153');

-- sem número | AMHP-DF | lote(s) 5871
DELETE FROM recebimentos WHERE id_receb IN ('a12e81b6-4bee-4510-a945-3f6f8fe3eeb1');
UPDATE lotes SET valor_total = 1285.69 WHERE id_lote = '41173023-4a4b-5212-b0e5-89540deb7598';
UPDATE notas SET valor_total = 1285.69 WHERE id_nota = '4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7', DATE '2026-07-24', DATE '2026-07-15', 1155.32, 1155.32, 'recebido', 'Baixa do apLIS — lote(s) 5871 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7');

-- sem número | AMHP-DF | lote(s) 5606
DELETE FROM recebimentos WHERE id_receb IN ('f6dbfc31-bcb0-40bc-a893-c040090adcaf');
UPDATE lotes SET valor_total = 5793.98 WHERE id_lote = '55604166-c526-5d00-aa14-38809a8982f6';
UPDATE notas SET valor_total = 5793.98 WHERE id_nota = 'eed7cf1d-8439-55d2-8b1e-cc0e6755968f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', DATE '2026-07-03', DATE '2026-07-03', 660.14, 660.14, 'recebido', 'Baixa do apLIS — lote(s) 5606 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', DATE '2026-07-03', DATE '2026-07-15', 5494.47, 5494.47, 'recebido', 'Baixa do apLIS — lote(s) 5606 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f', DATE '2026-07-03', DATE '2026-07-17', 104.40, 104.40, 'recebido', 'Baixa do apLIS — lote(s) 5606 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eed7cf1d-8439-55d2-8b1e-cc0e6755968f');

-- sem número | AMHP-DF | lote(s) 5705
DELETE FROM recebimentos WHERE id_receb IN ('737cb944-7975-44b0-a7e8-a3d368e2106f');
UPDATE lotes SET valor_total = 6954.88 WHERE id_lote = 'd1acbf4d-c123-593d-9b7d-d546b56edd7f';
UPDATE notas SET valor_total = 6954.88 WHERE id_nota = '0116bc36-f035-5783-b362-b07878f9f5de';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0116bc36-f035-5783-b362-b07878f9f5de', DATE '2026-07-10', DATE '2026-08-04', 6954.88, 6954.88, 'recebido', 'Baixa do apLIS — lote(s) 5705 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0116bc36-f035-5783-b362-b07878f9f5de');

-- sem número | AMHP-DF | lote(s) 5867
DELETE FROM recebimentos WHERE id_receb IN ('3daf464f-a30f-4635-a8e4-9fef35f511c4');
UPDATE lotes SET valor_total = 10394.74 WHERE id_lote = 'c442852c-7e30-5252-a9d0-26fefdcb2260';
UPDATE notas SET valor_total = 10394.74 WHERE id_nota = '8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6', DATE '2026-07-24', DATE '2026-08-04', 10394.74, 10394.74, 'recebido', 'Baixa do apLIS — lote(s) 5867 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6');

-- sem número | AMHP-DF | lote(s) 5632
DELETE FROM recebimentos WHERE id_receb IN ('a7d48bc6-4648-4699-ba05-79f5b4fdefff');
UPDATE lotes SET valor_total = 220.98 WHERE id_lote = '77866c0d-3b1d-5665-a152-e338ac7c228b';
UPDATE notas SET valor_total = 220.98 WHERE id_nota = '2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5', DATE '2026-07-03', DATE '2026-07-15', 239.73, 239.73, 'recebido', 'Baixa do apLIS — lote(s) 5632 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5');

-- sem número | AMHP-DF | lote(s) 5468
DELETE FROM recebimentos WHERE id_receb IN ('011cd5a0-d7bd-4501-9413-81e881526ef1');
UPDATE lotes SET valor_total = 2128.88 WHERE id_lote = 'd5e455ba-671c-501f-8251-a2df065a2a86';
UPDATE notas SET valor_total = 2128.88 WHERE id_nota = '7bbe9a6b-80f7-5686-af5c-fffef9bcc03f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f', DATE '2026-07-11', DATE '2026-08-04', 2128.88, 2128.88, 'recebido', 'Baixa do apLIS — lote(s) 5468 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f');

-- sem número | AMHP-DF | lote(s) 5743
DELETE FROM recebimentos WHERE id_receb IN ('ea0e14be-7c54-4eb9-b53f-afb85f0572d8');
UPDATE lotes SET valor_total = 994.22 WHERE id_lote = '00c0d9cd-3903-5fa8-bc3e-6bde9e2130fe';
UPDATE notas SET valor_total = 994.22 WHERE id_nota = 'bd25a6c0-a1bb-56ab-af79-30689b75d610';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bd25a6c0-a1bb-56ab-af79-30689b75d610', DATE '2026-07-13', DATE '2026-09-09', 994.22, 994.22, 'recebido', 'Baixa do apLIS — lote(s) 5743 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('bd25a6c0-a1bb-56ab-af79-30689b75d610');

-- sem número | AMHP-DF | lote(s) 5868
DELETE FROM recebimentos WHERE id_receb IN ('6915f951-25df-4629-b066-f209c6f21d57');
UPDATE lotes SET valor_total = 6501.43 WHERE id_lote = '86ce1edc-4b2f-5cfd-9fab-df8ea41ace0f';
UPDATE notas SET valor_total = 6501.43 WHERE id_nota = '8974b833-0f09-547b-ad22-dfcb60a8e3e7';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8974b833-0f09-547b-ad22-dfcb60a8e3e7', DATE '2026-07-24', DATE '2026-08-04', 6501.43, 6501.43, 'recebido', 'Baixa do apLIS — lote(s) 5868 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8974b833-0f09-547b-ad22-dfcb60a8e3e7');

-- NF 8409 | ASSEFAZ | lote(s) 5643
DELETE FROM glosas WHERE id_glosa IN ('b70dcb65-d26f-407f-b2d8-064376b603ce');
DELETE FROM recebimentos WHERE id_receb IN ('dc0f85ab-a911-4e86-85f8-96ebc7dee21f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-03-06', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 06/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-03-09', 1057.71, 1057.71, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 09/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-03-10', 431.14, 431.14, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-03-18', 1253.14, 1253.14, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 18/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-03-26', 862.28, 862.28, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 26/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-01', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-06', 1017.43, 1017.43, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-08', 268.38, 268.38, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 08/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-14', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-15', 38.34, 38.34, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', DATE '2026-06-20', DATE '2026-04-20', 454.99, 454.99, 'recebido', 'Baixa do apLIS — lote(s) 5643 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('11be043f-78cd-5298-89a2-5198b7a27470', '81a507b0-60da-5953-ac17-04172e488a5f', 38.34, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('11be043f-78cd-5298-89a2-5198b7a27470');

-- sem número | AMHP-DF | lote(s) 5870
DELETE FROM recebimentos WHERE id_receb IN ('db4113e6-c7c8-44a6-a807-fb0968faa6c7');
UPDATE lotes SET valor_total = 325.24 WHERE id_lote = '43346a63-0ad1-533f-b2b0-8fe15640c463';
UPDATE notas SET valor_total = 325.24 WHERE id_nota = '3da56901-8a41-5774-86f2-5f5af1d0be51';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3da56901-8a41-5774-86f2-5f5af1d0be51', DATE '2026-07-24', DATE '2026-07-15', 259.20, 259.20, 'recebido', 'Baixa do apLIS — lote(s) 5870 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3da56901-8a41-5774-86f2-5f5af1d0be51', DATE '2026-07-24', DATE '2026-07-31', 66.04, 66.04, 'recebido', 'Baixa do apLIS — lote(s) 5870 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3da56901-8a41-5774-86f2-5f5af1d0be51');

-- sem número | AMHP-DF | lote(s) 5741
DELETE FROM recebimentos WHERE id_receb IN ('84ae8505-2210-456e-96e1-80368ac018aa');
UPDATE lotes SET valor_total = 34.79 WHERE id_lote = 'b3881877-3a84-54d8-b717-9d69c5d61d5e';
UPDATE notas SET valor_total = 34.79 WHERE id_nota = '52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f', DATE '2026-07-12', DATE '2026-08-04', 34.79, 34.79, 'recebido', 'Baixa do apLIS — lote(s) 5741 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f');

-- sem número | AMHP-DF | lote(s) 5887
DELETE FROM recebimentos WHERE id_receb IN ('0228edde-e87a-4863-ad9b-e32523cb303c');
UPDATE lotes SET valor_total = 59.12 WHERE id_lote = 'b2a57dfd-4474-5039-93d8-317d44e28f62';
UPDATE notas SET valor_total = 59.12 WHERE id_nota = '32b582b4-b094-58d8-b1a0-065d390164a1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('32b582b4-b094-58d8-b1a0-065d390164a1', DATE '2026-07-25', DATE '2026-08-04', 59.12, 59.12, 'recebido', 'Baixa do apLIS — lote(s) 5887 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('32b582b4-b094-58d8-b1a0-065d390164a1');

-- NF 8409 | ASSEFAZ | lote(s) 5644
DELETE FROM glosas WHERE id_glosa IN ('463cf6a8-5e0e-48c7-acf9-ead5c02781cf');
DELETE FROM recebimentos WHERE id_receb IN ('2b59f4df-66c1-466a-9bf0-2e4224ef03d2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', DATE '2026-06-20', DATE '2026-04-17', 1231.69, 1231.69, 'recebido', 'Baixa do apLIS — lote(s) 5644 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', '085f12af-5437-52ec-8cf9-71a142853cda', 27.51, 'NÚMERO DA CARTEIRA INVÁLIDO', '1001', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a', '085f12af-5437-52ec-8cf9-71a142853cda', 5.48, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9d1acb4c-d4db-5499-8b61-7622e2c5a39a');

-- sem número | AMHP-DF | lote(s) 5706
DELETE FROM recebimentos WHERE id_receb IN ('37a4314d-c762-4f9a-9c95-1f84c4bdcf96');
UPDATE lotes SET valor_total = 2618.87 WHERE id_lote = 'f1292394-99b4-51ca-bba6-f199220eba12';
UPDATE notas SET valor_total = 2618.87 WHERE id_nota = '8b65c7fa-5cbb-5100-ae50-a18a1c7d607b';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b', DATE '2026-07-10', DATE '2026-07-31', 252.89, 252.89, 'recebido', 'Baixa do apLIS — lote(s) 5706 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b', DATE '2026-07-10', DATE '2026-08-04', 2183.31, 2183.31, 'recebido', 'Baixa do apLIS — lote(s) 5706 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b');

-- NF 8410 | AMIL | lote(s) 5764
DELETE FROM glosas WHERE id_glosa IN ('8e6c29f1-8685-4ed9-a27b-97a4ac8cf856');
DELETE FROM recebimentos WHERE id_receb IN ('6583209b-57b9-446b-bfda-000f558eca90');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', DATE '2026-06-13', DATE '2026-05-08', 1378.80, 1378.80, 'recebido', 'Baixa do apLIS — lote(s) 5764 (recebido em 08/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', DATE '2026-06-13', DATE '2026-05-11', 2300.70, 2300.70, 'recebido', 'Baixa do apLIS — lote(s) 5764 (recebido em 11/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', DATE '2026-06-13', DATE '2026-05-12', 256.90, 256.90, 'recebido', 'Baixa do apLIS — lote(s) 5764 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', DATE '2026-06-13', DATE '2026-05-13', 1745.70, 1745.70, 'recebido', 'Baixa do apLIS — lote(s) 5764 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('21b76c88-69a0-54cc-93e6-8f0fc60dd632', 'd46487c8-87e5-5965-a7d8-d94abed2a44e', 28.45, 'COBRANÇA DE PROCEDIMENTO NÃO SOLICITADO PELO MÉDICO', '1810', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('21b76c88-69a0-54cc-93e6-8f0fc60dd632');

-- sem número | AMHP-DF | lote(s) 5869
DELETE FROM recebimentos WHERE id_receb IN ('d6606ecd-b87b-4c3f-ad44-774986c137e6');
UPDATE lotes SET valor_total = 4276.27 WHERE id_lote = '85db04e7-9d0e-5062-a382-1170fd733efe';
UPDATE notas SET valor_total = 4276.27 WHERE id_nota = '42821cb8-bd63-5d15-b368-db3beb2ac72f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('42821cb8-bd63-5d15-b368-db3beb2ac72f', DATE '2026-07-24', DATE '2026-08-04', 4276.27, 4276.27, 'recebido', 'Baixa do apLIS — lote(s) 5869 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('42821cb8-bd63-5d15-b368-db3beb2ac72f');

-- sem número | AMHP-DF | lote(s) 5734
DELETE FROM recebimentos WHERE id_receb IN ('b324b14b-584a-4a2f-b8cd-ba856b1c6ea3');
UPDATE lotes SET valor_total = 524.35 WHERE id_lote = 'bff7b97d-62ff-5cca-ae60-e6b2803d85e7';
UPDATE notas SET valor_total = 524.35 WHERE id_nota = 'cd97e919-5220-5423-8b12-0fdc69a53220';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cd97e919-5220-5423-8b12-0fdc69a53220', DATE '2026-07-11', DATE '2026-08-04', 524.35, 524.35, 'recebido', 'Baixa do apLIS — lote(s) 5734 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cd97e919-5220-5423-8b12-0fdc69a53220');

-- sem número | AMHP-DF | lote(s) 5613
DELETE FROM recebimentos WHERE id_receb IN ('cb5db1ea-ecc9-4f08-a7f6-deea363c4dec');
UPDATE lotes SET valor_total = 2710.73 WHERE id_lote = '3018909b-4e1c-54ca-8120-188f81d5dbf4';
UPDATE notas SET valor_total = 2710.73 WHERE id_nota = 'a6813d3e-65aa-5a1c-8e81-b13e9f1d7199';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199', DATE '2026-07-11', DATE '2026-07-17', 2785.22, 2785.22, 'recebido', 'Baixa do apLIS — lote(s) 5613 (recebido em 17/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199');

-- sem número | AMHP-DF | lote(s) 5882
DELETE FROM recebimentos WHERE id_receb IN ('b65fbdf1-7a0e-4ace-8213-0d1bd750202c');
UPDATE lotes SET valor_total = 503.71 WHERE id_lote = '05c55c9d-e46b-538b-92cf-30105288aef7';
UPDATE notas SET valor_total = 503.71 WHERE id_nota = '0a588a4a-1798-5e23-812d-75a6be7575d2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0a588a4a-1798-5e23-812d-75a6be7575d2', DATE '2026-07-25', DATE '2026-08-04', 503.71, 503.71, 'recebido', 'Baixa do apLIS — lote(s) 5882 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0a588a4a-1798-5e23-812d-75a6be7575d2');

-- sem número | AMHP-DF | lote(s) 5897
DELETE FROM recebimentos WHERE id_receb IN ('37bea96c-f1a9-421d-b88f-3d21059d5501');
UPDATE lotes SET valor_total = 658.77 WHERE id_lote = 'd31bcb81-9af8-5520-a4e2-7f2159d16d6f';
UPDATE notas SET valor_total = 658.77 WHERE id_nota = '6d949751-236f-51d4-9b2b-4f4a2c619c98';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d949751-236f-51d4-9b2b-4f4a2c619c98', DATE '2026-07-26', DATE '2026-08-04', 658.77, 658.77, 'recebido', 'Baixa do apLIS — lote(s) 5897 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('6d949751-236f-51d4-9b2b-4f4a2c619c98');

-- sem número | AMHP-DF | lote(s) 5762
DELETE FROM recebimentos WHERE id_receb IN ('26498210-79b0-4960-bc11-70bb39a177f3');
UPDATE lotes SET valor_total = 1631.00 WHERE id_lote = 'e5a4406f-cf5c-589e-8a95-a41e165da996';
UPDATE notas SET valor_total = 1631.00 WHERE id_nota = '67ee6916-9994-56aa-96f0-b7f4bb2f30e4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('67ee6916-9994-56aa-96f0-b7f4bb2f30e4', DATE '2026-07-13', DATE '2026-08-04', 1631.00, 1631.00, 'recebido', 'Baixa do apLIS — lote(s) 5762 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('67ee6916-9994-56aa-96f0-b7f4bb2f30e4');

-- sem número | AMHP-DF | lote(s) 5903
DELETE FROM recebimentos WHERE id_receb IN ('53014cef-2bce-46e7-9732-cbd05468f2d6');
UPDATE lotes SET valor_total = 311.91 WHERE id_lote = '89873479-e664-50ca-ab22-92f7504697b9';
UPDATE notas SET valor_total = 311.91 WHERE id_nota = 'c39204fc-2937-5cf5-8727-61455fa63ae5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c39204fc-2937-5cf5-8727-61455fa63ae5', DATE '2026-07-26', DATE '2026-08-04', 311.91, 311.91, 'recebido', 'Baixa do apLIS — lote(s) 5903 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c39204fc-2937-5cf5-8727-61455fa63ae5');

-- sem número | AMHP-DF | lote(s) 5896
DELETE FROM recebimentos WHERE id_receb IN ('2e330924-6330-4173-a806-79943bb8db48');
UPDATE lotes SET valor_total = 2931.56 WHERE id_lote = '61388d79-8b3c-5142-afa9-eb22daaecb5e';
UPDATE notas SET valor_total = 2931.56 WHERE id_nota = '2e352596-ddd2-594a-918c-bb0d8f89fc66';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e352596-ddd2-594a-918c-bb0d8f89fc66', DATE '2026-07-26', DATE '2026-08-04', 2931.56, 2931.56, 'recebido', 'Baixa do apLIS — lote(s) 5896 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2e352596-ddd2-594a-918c-bb0d8f89fc66');

-- sem número | AMHP-DF | lote(s) 5927
DELETE FROM recebimentos WHERE id_receb IN ('f5f5e044-0b2f-413b-9350-22f8a50b44fa');
UPDATE lotes SET valor_total = 1349.60 WHERE id_lote = '0ea2a3cf-f7a8-5b2f-9fe0-ca0b13bae20a';
UPDATE notas SET valor_total = 1349.60 WHERE id_nota = 'a05c941f-f8a9-52f0-933f-904677a943b4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a05c941f-f8a9-52f0-933f-904677a943b4', DATE '2026-07-28', DATE '2026-08-04', 1349.60, 1349.60, 'recebido', 'Baixa do apLIS — lote(s) 5927 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a05c941f-f8a9-52f0-933f-904677a943b4');

-- sem número | AMHP-DF | lote(s) 5904
DELETE FROM recebimentos WHERE id_receb IN ('b78d80ff-d61e-422a-a67b-22c65c1736f8');
UPDATE lotes SET valor_total = 1306.93 WHERE id_lote = 'e084d477-9750-5f8b-8f96-f9b904a1fc48';
UPDATE notas SET valor_total = 1306.93 WHERE id_nota = 'a9d3e571-e079-5d30-9e5d-99287c91262d';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a9d3e571-e079-5d30-9e5d-99287c91262d', DATE '2026-07-28', DATE '2026-07-31', 1359.14, 1359.14, 'recebido', 'Baixa do apLIS — lote(s) 5904 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a9d3e571-e079-5d30-9e5d-99287c91262d');

-- NF 8410 | AMIL | lote(s) 5681
DELETE FROM glosas WHERE id_glosa IN ('66eed993-aa9a-4821-8450-ccdf11a22321');
DELETE FROM recebimentos WHERE id_receb IN ('04abcc3a-6dd8-4ee8-b007-9d01f9502f88');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', DATE '2026-06-12', DATE '2026-03-10', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5681 (recebido em 10/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', DATE '2026-06-12', DATE '2026-04-06', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5681 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', DATE '2026-06-12', DATE '2026-04-17', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5681 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', DATE '2026-06-12', DATE '2026-04-20', 1003.45, 1003.45, 'recebido', 'Baixa do apLIS — lote(s) 5681 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', DATE '2026-06-12', DATE '2026-04-24', 537.00, 537.00, 'recebido', 'Baixa do apLIS — lote(s) 5681 (recebido em 24/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', 'cb7ea3f3-38ee-541d-ae8a-25deaa688098', 411.90, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b5f3cb96-2fd4-51fd-a232-f444a0630d28', 'cb7ea3f3-38ee-541d-ae8a-25deaa688098', 86.00, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b5f3cb96-2fd4-51fd-a232-f444a0630d28');

-- sem número | AMHP-DF | lote(s) 5742
DELETE FROM recebimentos WHERE id_receb IN ('14d5c231-e8ff-49c0-9f2a-d1542cb3471b');
SELECT fat_recalcular_nota('c7fba8f9-dd8d-53a4-ae1d-f931962c596e');

-- NF 8410 | AMIL | lote(s) 5747
DELETE FROM glosas WHERE id_glosa IN ('4d7d8e5d-96ed-43b4-a73a-a2c80d81d9b6');
DELETE FROM recebimentos WHERE id_receb IN ('516838d0-950b-4205-94ed-3e977a9b4631');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', DATE '2026-06-12', DATE '2026-03-20', 848.45, 848.45, 'recebido', 'Baixa do apLIS — lote(s) 5747 (recebido em 20/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', DATE '2026-06-12', DATE '2026-04-14', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5747 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', DATE '2026-06-12', DATE '2026-04-30', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5747 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', '8853c3e7-02c3-574f-a96c-069563659725', 28.45, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('85384788-3c79-5306-b4cf-2b01dc6f71c3', '8853c3e7-02c3-574f-a96c-069563659725', 27.00, 'SERVIÇO NÃO CONTRATADO PARA O PRESTADOR', '2514', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('85384788-3c79-5306-b4cf-2b01dc6f71c3');

-- sem número | AMHP-DF | lote(s) 5888
DELETE FROM recebimentos WHERE id_receb IN ('7749dbda-8d5e-4e97-b0c4-abd7cf491749');
UPDATE lotes SET valor_total = 1453.49 WHERE id_lote = '1ccd961e-1e86-549c-8503-3e7435d3e4db';
UPDATE notas SET valor_total = 1453.49 WHERE id_nota = 'ddcc03c6-e577-50dd-a8bc-ccc43594227c';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ddcc03c6-e577-50dd-a8bc-ccc43594227c', DATE '2026-07-25', DATE '2026-07-31', 1359.14, 1359.14, 'recebido', 'Baixa do apLIS — lote(s) 5888 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ddcc03c6-e577-50dd-a8bc-ccc43594227c', DATE '2026-07-25', DATE '2026-08-04', 146.56, 146.56, 'recebido', 'Baixa do apLIS — lote(s) 5888 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ddcc03c6-e577-50dd-a8bc-ccc43594227c');

-- NF 8410 | AMIL | lote(s) 5693
DELETE FROM glosas WHERE id_glosa IN ('75961429-106b-45b4-acd1-2c8750ee5824');
DELETE FROM recebimentos WHERE id_receb IN ('c148f734-8f89-4cfa-95a8-42f966aa0ed9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', DATE '2026-06-12', DATE '2026-04-14', 238.52, 238.52, 'recebido', 'Baixa do apLIS — lote(s) 5693 (recebido em 14/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', DATE '2026-06-12', DATE '2026-04-20', 228.45, 228.45, 'recebido', 'Baixa do apLIS — lote(s) 5693 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', DATE '2026-06-12', DATE '2026-05-07', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5693 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', '5d1fc1de-28c8-57db-b55a-7d41e931c434', 383.45, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('95aa3302-2efd-53f1-9eb1-5a28d67b6763', '5d1fc1de-28c8-57db-b55a-7d41e931c434', 80.00, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('95aa3302-2efd-53f1-9eb1-5a28d67b6763');

-- sem número | FASCAL | lote(s) 5648
DELETE FROM glosas WHERE id_glosa IN ('57cfbad9-f769-462a-9a11-b568e60ba83b');
DELETE FROM recebimentos WHERE id_receb IN ('b68eafd7-52f8-4c74-a6d5-e38281ba7211');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', DATE '2026-06-02', DATE '2026-02-09', 76.84, 76.84, 'recebido', 'Baixa do apLIS — lote(s) 5648 (recebido em 09/02/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', DATE '2026-06-02', DATE '2026-03-18', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 5648 (recebido em 18/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', DATE '2026-06-02', DATE '2026-03-19', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 5648 (recebido em 19/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', DATE '2026-06-02', DATE '2026-04-07', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 5648 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', '311992e0-5788-5916-8fc5-ab271beb990a', 5144.13, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('59e4d577-f866-533f-9ff6-0019612e84de', '311992e0-5788-5916-8fc5-ab271beb990a', 3.08, 'VALOR TOTAL DO PROCEDIMENTO DIFERENTE DO VALOR PROCESSADO', '1805', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('59e4d577-f866-533f-9ff6-0019612e84de');

-- sem número | AMHP-DF | lote(s) 5701
DELETE FROM recebimentos WHERE id_receb IN ('d8e08f87-2712-4024-a1df-3396774791b5');
UPDATE lotes SET valor_total = 5597.33 WHERE id_lote = 'da9c5310-0835-5644-8dfa-5ba15dd0985a';
UPDATE notas SET valor_total = 5597.33 WHERE id_nota = 'a8278c14-0c04-5452-bafd-37fd8d28a580';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', DATE '2026-07-10', DATE '2026-06-02', 5373.73, 5373.73, 'recebido', 'Baixa do apLIS — lote(s) 5701 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', DATE '2026-07-10', DATE '2026-07-15', 53.55, 53.55, 'recebido', 'Baixa do apLIS — lote(s) 5701 (recebido em 15/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', DATE '2026-07-10', DATE '2026-07-31', 32.35, 32.35, 'recebido', 'Baixa do apLIS — lote(s) 5701 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a8278c14-0c04-5452-bafd-37fd8d28a580', 'da9c5310-0835-5644-8dfa-5ba15dd0985a', 10.20, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a8278c14-0c04-5452-bafd-37fd8d28a580');

-- NF 8410 | AMIL | lote(s) 5679
DELETE FROM glosas WHERE id_glosa IN ('34a52e28-0703-4779-ad75-06259b6cb4f7');
DELETE FROM recebimentos WHERE id_receb IN ('77675e0d-66fa-43c7-b6fb-fb264ad60143');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', DATE '2026-06-06', DATE '2026-04-15', 310.04, 310.04, 'recebido', 'Baixa do apLIS — lote(s) 5679 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', DATE '2026-06-06', DATE '2026-04-16', 169.04, 169.04, 'recebido', 'Baixa do apLIS — lote(s) 5679 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', DATE '2026-06-06', DATE '2026-04-20', 253.56, 253.56, 'recebido', 'Baixa do apLIS — lote(s) 5679 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', DATE '2026-06-06', DATE '2026-04-27', 204.52, 204.52, 'recebido', 'Baixa do apLIS — lote(s) 5679 (recebido em 27/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', 'f34f9ce6-0603-5cf4-9aab-046fb40c6a47', 65.96, 'COBRANÇA DE PROCEDIMENTO EM DUPLICIDADE', '1702', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5366211c-9a9b-5f43-a30a-c8a590c078ed', 'f34f9ce6-0603-5cf4-9aab-046fb40c6a47', 80.00, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5366211c-9a9b-5f43-a30a-c8a590c078ed');

-- sem número | PMDF | lote(s) 5788
DELETE FROM recebimentos WHERE id_receb IN ('459184d9-fc02-40f3-aa71-de99ed4df095');
UPDATE lotes SET valor_total = 16109.40 WHERE id_lote = '881f2a84-7512-525c-9b3d-81946a535d25';
UPDATE notas SET valor_total = 16109.40 WHERE id_nota = 'a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb', DATE '2026-06-17', DATE '2026-07-03', 16109.40, 16109.40, 'recebido', 'Baixa do apLIS — lote(s) 5788 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb');

-- NF 8410 | AMIL | lote(s) 5678
DELETE FROM glosas WHERE id_glosa IN ('9850a5f0-a488-4deb-9a6b-39acfbdfb565');
DELETE FROM recebimentos WHERE id_receb IN ('f4a42894-f880-4d5e-8ef9-b59e24033c4f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-03-05', 227.00, 227.00, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 05/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-06', 28.45, 28.45, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 06/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-07', 1076.90, 1076.90, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 07/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-16', 382.00, 382.00, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-17', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 17/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-20', 766.90, 766.90, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 20/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-22', 411.90, 411.90, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 22/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-04-23', 22.08, 22.08, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', DATE '2026-06-05', DATE '2026-05-05', 383.45, 383.45, 'recebido', 'Baixa do apLIS — lote(s) 5678 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab', '5764d498-c535-53e3-a5bc-3f852d06c2db', 43.00, 'CAMPO CONDICIONADO NÃO PREENCHIDO OU INCORRETO', '3111', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e9286550-68ff-5f9c-9ffb-3e8b270e20ab');

-- sem número | AMHP-DF | lote(s) 5901
DELETE FROM recebimentos WHERE id_receb IN ('5fdc78d8-8226-4ffa-99e0-56ff9bf22844');
UPDATE lotes SET valor_total = 147.90 WHERE id_lote = '64e6b731-7354-5155-95cd-238eb0ea9e68';
UPDATE notas SET valor_total = 147.90 WHERE id_nota = '02b3ed5f-dd1f-5fc1-8e29-fe09739fd391';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391', DATE '2026-07-26', DATE '2025-12-31', 147.90, 147.90, 'recebido', 'Baixa do apLIS — lote(s) 5901 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391');

-- sem número | PMDF | lote(s) 5783
DELETE FROM glosas WHERE id_glosa IN ('5393264e-ce96-41f2-b71c-72cf8c650d08');
DELETE FROM recebimentos WHERE id_receb IN ('f56ed5eb-5c24-4736-a1e7-66b6f3fbe753');
UPDATE lotes SET valor_total = 7899.82 WHERE id_lote = '72ed118a-1f8c-563c-b117-c627438c19e4';
UPDATE notas SET valor_total = 7899.82 WHERE id_nota = 'e2e6796e-c781-52fe-9cbf-35f4aed3be3a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a', DATE '2026-06-17', DATE '2026-07-30', 8374.12, 8374.12, 'recebido', 'Baixa do apLIS — lote(s) 5783 (recebido em 30/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e2e6796e-c781-52fe-9cbf-35f4aed3be3a');

-- NF 8265 | E-VIDA | lote(s) 5656
DELETE FROM glosas WHERE id_glosa IN ('a0f02bcb-2116-4b6f-98da-b683e2e0d5a6');
DELETE FROM recebimentos WHERE id_receb IN ('da3f82ae-532d-4300-9dd4-69d110ab78bd');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-01', 96.74, 96.74, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 01/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-02', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 02/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-10', 450.26, 450.26, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-13', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 13/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-15', 145.11, 145.11, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 15/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-23', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', DATE '2026-06-09', DATE '2026-04-29', 1185.67, 1185.67, 'recebido', 'Baixa do apLIS — lote(s) 5656 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('34057382-dfa7-531c-809f-7ce04b44ce1e', '56f0998c-3662-57aa-b3b3-4490a1248c42', 3.65, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('34057382-dfa7-531c-809f-7ce04b44ce1e');

-- sem número | PMDF | lote(s) 5782
DELETE FROM recebimentos WHERE id_receb IN ('6b820ff6-a44e-4621-a5c4-3eb912043266');
UPDATE lotes SET valor_total = 5233.51 WHERE id_lote = '737a66ff-be45-56b5-a09c-321acd8cd680';
UPDATE notas SET valor_total = 5233.51 WHERE id_nota = 'b909cdef-8a3d-5a81-be6b-f36b586caa05';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b909cdef-8a3d-5a81-be6b-f36b586caa05', DATE '2026-06-17', DATE '2026-07-03', 5233.51, 5233.51, 'recebido', 'Baixa do apLIS — lote(s) 5782 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('b909cdef-8a3d-5a81-be6b-f36b586caa05');

-- sem número | AMHP-DF | lote(s) 5413
DELETE FROM recebimentos WHERE id_receb IN ('0289a755-d9c2-4361-b12f-d8cf88146440');
UPDATE lotes SET valor_total = 63.75 WHERE id_lote = 'a89c4c3c-b374-5c7c-8002-9daed0433748';
UPDATE notas SET valor_total = 63.75 WHERE id_nota = 'f4a56a07-9156-515f-964e-bf047314a3e2';
SELECT fat_recalcular_nota('f4a56a07-9156-515f-964e-bf047314a3e2');

-- NF 8263 | E-VIDA | lote(s) 5381
DELETE FROM glosas WHERE id_glosa IN ('82758ca5-9eb5-4d2b-a037-75e3fe29d884');
DELETE FROM recebimentos WHERE id_receb IN ('d5d3e3f5-d815-4631-bc3f-b7f942ae25f4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', DATE '2026-06-09', DATE '2026-03-03', 102.07, 102.07, 'recebido', 'Baixa do apLIS — lote(s) 5381 (recebido em 03/03/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', DATE '2026-06-09', DATE '2026-04-16', 166.03, 166.03, 'recebido', 'Baixa do apLIS — lote(s) 5381 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9cde170b-024c-594d-8048-74074e37fbf3', '81dc0a68-0a6f-5eba-810c-e5ec84be0c66', 166.03, 'NÃO EXISTE INFORMAÇÃO SOBRE A SENHA DE AUTORIZAÇÃO DO PROCEDIMENTO', '1403', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9cde170b-024c-594d-8048-74074e37fbf3');

-- sem número | AMHP-DF | lote(s) 5890
DELETE FROM recebimentos WHERE id_receb IN ('2c3776a3-ac64-41f7-b67d-df1856d9a58f');
UPDATE lotes SET valor_total = 477.79 WHERE id_lote = '7695a4a9-a04a-5653-b31f-2c6f9aabfd89';
UPDATE notas SET valor_total = 477.79 WHERE id_nota = 'eb338995-fe4b-55e3-a922-fa0bfdc0223a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eb338995-fe4b-55e3-a922-fa0bfdc0223a', DATE '2026-07-25', DATE '2026-07-03', 499.23, 499.23, 'recebido', 'Baixa do apLIS — lote(s) 5890 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eb338995-fe4b-55e3-a922-fa0bfdc0223a');

-- sem número | AMHP-DF | lote(s) 5886
DELETE FROM recebimentos WHERE id_receb IN ('cc3a8738-bb3a-416b-85bf-543038e993c7');
UPDATE lotes SET valor_total = 753.10 WHERE id_lote = '9a0230f5-1619-5dcf-bc4f-d5f9f1701d58';
UPDATE notas SET valor_total = 753.10 WHERE id_nota = 'f12d8be6-c19b-525c-bc0c-74f8a31ab3b5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5', DATE '2026-07-25', DATE '2026-07-31', 775.61, 775.61, 'recebido', 'Baixa do apLIS — lote(s) 5886 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5');

-- NF 8402 | CASSI | lote(s) 5822
DELETE FROM glosas WHERE id_glosa IN ('643a62b8-f42d-4374-ad2c-2c2c3b7f8ee6');
DELETE FROM recebimentos WHERE id_receb IN ('4fbb94a3-54db-47a5-b0d3-312decad3c9a');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', DATE '2026-06-19', DATE '2026-06-23', 12910.95, 12910.95, 'recebido', 'Baixa do apLIS — lote(s) 5822 (recebido em 23/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2', 'e5b4b67f-ea53-503f-8ea2-cb529e4fa28d', 227.87, 'QUANTIDADE SERVIÇO SOLICITADA ACIMA DA AUTORIZADA', '1408', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('bb09239c-46ef-54e6-bb58-a2f1ec574aa2');

-- NF 8467 | TRT | lote(s) 5659
DELETE FROM glosas WHERE id_glosa IN ('48dfff71-841e-46e9-887c-d526915ec13f');
DELETE FROM recebimentos WHERE id_receb IN ('0cfa764d-a213-4fe6-9119-1c07af53cdc2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', DATE '2026-06-04', DATE '2026-07-08', 4667.36, 4667.36, 'recebido', 'Baixa do apLIS — lote(s) 5659 (recebido em 08/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', 'bca3880f-a536-5c48-96a2-be8886737dd1', 319.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9b8a9bdf-e713-505d-b21e-d109396ab281', 'bca3880f-a536-5c48-96a2-be8886737dd1', 79.92, 'COBRANÇA DE EXAME COM AUSÊNCIA DE RESULTADO OU LAUDO TÉCNICO.', '2714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9b8a9bdf-e713-505d-b21e-d109396ab281');

-- sem número | AMHP-DF | lote(s) 5889
DELETE FROM recebimentos WHERE id_receb IN ('31cae580-105f-4e86-a93e-8e334dce2098');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('52159b59-08cf-5ffc-9329-0f29bf8afdb1', '46d1c735-28bc-51e2-957a-99064bee61e9', 184.02, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('52159b59-08cf-5ffc-9329-0f29bf8afdb1');

-- sem número | PMDF | lote(s) 5799
DELETE FROM recebimentos WHERE id_receb IN ('c8255fbe-3801-4f3a-aede-1ba6a01e22dc');
UPDATE lotes SET valor_total = 12172.83 WHERE id_lote = '33a4cf29-c831-5ac5-86e2-f2d3c3f1e1dc';
UPDATE notas SET valor_total = 12172.83 WHERE id_nota = '16e05aa1-e979-5888-a753-ca700d52fa04';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('16e05aa1-e979-5888-a753-ca700d52fa04', DATE '2026-06-18', DATE '2026-07-03', 12172.83, 12172.83, 'recebido', 'Baixa do apLIS — lote(s) 5799 (recebido em 03/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('16e05aa1-e979-5888-a753-ca700d52fa04');

-- sem número | AMHP-DF | lote(s) 5900
DELETE FROM recebimentos WHERE id_receb IN ('98e18f71-7185-4d7d-8fdb-c04371269dfc');
UPDATE lotes SET valor_total = 63.75 WHERE id_lote = '5b87ef61-445d-5415-8a5e-ab5d5b1a79c9';
UPDATE notas SET valor_total = 63.75 WHERE id_nota = '65e623cb-c7d2-5a94-9dd9-c69156741b24';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65e623cb-c7d2-5a94-9dd9-c69156741b24', DATE '2026-07-26', DATE '2025-12-31', 63.75, 63.75, 'recebido', 'Baixa do apLIS — lote(s) 5900 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('65e623cb-c7d2-5a94-9dd9-c69156741b24');

-- sem número | AMHP-DF | lote(s) 5881
DELETE FROM recebimentos WHERE id_receb IN ('96aa7d1b-b009-4cc2-a602-b5ec662f5cc4');
UPDATE lotes SET valor_total = 982.09 WHERE id_lote = '5ee8b18a-9900-53f7-8a55-673f31126137';
UPDATE notas SET valor_total = 982.09 WHERE id_nota = '120a97c4-34c0-5cad-afe2-130fd0d53954';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('120a97c4-34c0-5cad-afe2-130fd0d53954', DATE '2026-07-25', DATE '2026-07-31', 1121.57, 1121.57, 'recebido', 'Baixa do apLIS — lote(s) 5881 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('120a97c4-34c0-5cad-afe2-130fd0d53954');

-- NF 8402 | CASSI | lote(s) 5792
DELETE FROM recebimentos WHERE id_receb IN ('d66da27d-a67c-47aa-a8b4-0c5d7a29678d');
UPDATE lotes SET valor_total = 784.78 WHERE id_lote = 'ab21acaa-c6f5-5b2b-b28b-6bf12fc5aedc';
UPDATE notas SET valor_total = 784.78 WHERE id_nota = '33fc1c8c-d323-551f-8f3f-2ae0436edf34';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('33fc1c8c-d323-551f-8f3f-2ae0436edf34', DATE '2026-06-18', DATE '2026-06-23', 784.78, 784.78, 'recebido', 'Baixa do apLIS — lote(s) 5792 (recebido em 23/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('33fc1c8c-d323-551f-8f3f-2ae0436edf34');

-- sem número | TST | lote(s) 6114
DELETE FROM recebimentos WHERE id_receb IN ('42710dde-5083-4647-9867-802d91eab1aa');
SELECT fat_recalcular_nota('613dabd6-fb21-5fbd-aa11-4077646a04bf');

-- sem número | AMHP-DF | lote(s) 6013
DELETE FROM recebimentos WHERE id_receb IN ('6638be7b-5805-4cb5-9c6d-971c9ba0af28');
UPDATE lotes SET valor_total = 760.33 WHERE id_lote = '4f5bd929-bb68-535e-b268-e8d57906defc';
UPDATE notas SET valor_total = 760.33 WHERE id_nota = 'e87cfdd2-211f-5552-8967-6c5f07e1fc4b';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e87cfdd2-211f-5552-8967-6c5f07e1fc4b', DATE '2026-08-09', DATE '2026-08-19', 794.58, 794.58, 'recebido', 'Baixa do apLIS — lote(s) 6013 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('e87cfdd2-211f-5552-8967-6c5f07e1fc4b');

-- sem número | AMHP-DF | lote(s) 6017
DELETE FROM recebimentos WHERE id_receb IN ('1fa7669b-a51e-4eab-a840-65a4a86f396b');
UPDATE lotes SET valor_total = 181.70 WHERE id_lote = '74103d60-fcbf-5009-8910-a38e4043a66c';
UPDATE notas SET valor_total = 181.70 WHERE id_nota = '0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1', DATE '2026-08-09', DATE '2026-08-17', 181.72, 181.72, 'recebido', 'Baixa do apLIS — lote(s) 6017 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1');

-- sem número | AMHP-DF | lote(s) 5911
DELETE FROM recebimentos WHERE id_receb IN ('44c3a88e-e11d-450a-8c68-69357dfbeb0e');
UPDATE lotes SET valor_total = 66.31 WHERE id_lote = '90dd6b83-89d5-59d8-be78-660134c13a22';
UPDATE notas SET valor_total = 66.31 WHERE id_nota = '9951074e-0a95-50cb-9db4-03455e556c03';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9951074e-0a95-50cb-9db4-03455e556c03', DATE '2026-08-09', DATE '2025-12-31', 66.31, 66.31, 'recebido', 'Baixa do apLIS — lote(s) 5911 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9951074e-0a95-50cb-9db4-03455e556c03');

-- sem número | AMHP-DF | lote(s) 6037
DELETE FROM recebimentos WHERE id_receb IN ('9d60d351-fa33-4693-929c-ff9b8e28787c');
UPDATE lotes SET valor_total = 5143.23 WHERE id_lote = '237814e4-cc3a-5b83-9bb9-6c9da5c4390d';
UPDATE notas SET valor_total = 5143.23 WHERE id_nota = 'f196d8a7-1a81-5bea-afa5-e588db85a233';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', DATE '2026-08-10', DATE '2026-08-17', 2435.14, 2435.14, 'recebido', 'Baixa do apLIS — lote(s) 6037 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', DATE '2026-08-10', DATE '2026-08-19', 563.00, 563.00, 'recebido', 'Baixa do apLIS — lote(s) 6037 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', DATE '2026-08-10', DATE '2026-08-31', 563.00, 563.00, 'recebido', 'Baixa do apLIS — lote(s) 6037 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('f196d8a7-1a81-5bea-afa5-e588db85a233', DATE '2026-08-10', DATE '2026-09-09', 66.31, 66.31, 'recebido', 'Baixa do apLIS — lote(s) 6037 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('f196d8a7-1a81-5bea-afa5-e588db85a233');

-- sem número | AMHP-DF | lote(s) 6083
DELETE FROM recebimentos WHERE id_receb IN ('c1bbc1fa-331f-4df6-b935-068375240d50');
UPDATE lotes SET valor_total = 1883.19 WHERE id_lote = '642a575f-5d4d-561e-9606-16bdfd5443ba';
UPDATE notas SET valor_total = 1883.19 WHERE id_nota = '9dd42586-6513-5b23-90cd-001ce3cf194e';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9dd42586-6513-5b23-90cd-001ce3cf194e', DATE '2026-08-17', DATE '2026-08-17', 1945.39, 1945.39, 'recebido', 'Baixa do apLIS — lote(s) 6083 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9dd42586-6513-5b23-90cd-001ce3cf194e');

-- sem número | AMHP-DF | lote(s) 6131
DELETE FROM recebimentos WHERE id_receb IN ('5e013fce-0cc6-4032-b830-14b76ed429bf');
UPDATE lotes SET valor_total = 132.62 WHERE id_lote = 'b2f52469-764e-5d31-a8e0-fa3b94282452';
UPDATE notas SET valor_total = 132.62 WHERE id_nota = '75c84b89-9f10-55bc-97cf-e687f2ea76d1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('75c84b89-9f10-55bc-97cf-e687f2ea76d1', DATE '2026-08-21', DATE '2026-08-17', 68.95, 68.95, 'recebido', 'Baixa do apLIS — lote(s) 6131 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('75c84b89-9f10-55bc-97cf-e687f2ea76d1', DATE '2026-08-21', DATE '2026-08-31', 68.95, 68.95, 'recebido', 'Baixa do apLIS — lote(s) 6131 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('75c84b89-9f10-55bc-97cf-e687f2ea76d1');

-- sem número | AMHP-DF | lote(s) 6164
DELETE FROM recebimentos WHERE id_receb IN ('d7aeb421-73d2-4201-ab82-a37bcd0c71f4');
UPDATE lotes SET valor_total = 575.02 WHERE id_lote = 'caf05560-fa93-521d-879e-de2318815264';
UPDATE notas SET valor_total = 575.02 WHERE id_nota = 'dd7c2c00-c1db-53ad-a5cf-6f1955940898';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dd7c2c00-c1db-53ad-a5cf-6f1955940898', DATE '2026-08-24', DATE '2026-08-17', 206.85, 206.85, 'recebido', 'Baixa do apLIS — lote(s) 6164 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dd7c2c00-c1db-53ad-a5cf-6f1955940898', DATE '2026-08-24', DATE '2026-08-31', 481.80, 481.80, 'recebido', 'Baixa do apLIS — lote(s) 6164 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dd7c2c00-c1db-53ad-a5cf-6f1955940898');

-- sem número | AMHP-DF | lote(s) 6018
DELETE FROM recebimentos WHERE id_receb IN ('e0dc468a-266b-44d8-aff4-dccaa82b5ee2');
UPDATE lotes SET valor_total = 2817.96 WHERE id_lote = 'f2346549-3152-509d-939d-3ea132a2e034';
UPDATE notas SET valor_total = 2817.96 WHERE id_nota = '0c47f039-ef8e-5fc5-b8a8-460e041df728';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c47f039-ef8e-5fc5-b8a8-460e041df728', DATE '2026-08-09', DATE '2026-08-04', 1355.24, 1355.24, 'recebido', 'Baixa do apLIS — lote(s) 6018 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c47f039-ef8e-5fc5-b8a8-460e041df728', DATE '2026-08-09', DATE '2026-09-15', 782.37, 782.37, 'recebido', 'Baixa do apLIS — lote(s) 6018 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0c47f039-ef8e-5fc5-b8a8-460e041df728');

-- sem número | AMHP-DF | lote(s) 6072
DELETE FROM recebimentos WHERE id_receb IN ('82ddee5b-82f6-4cc5-9050-270023d32336');
UPDATE lotes SET valor_total = 1225.85 WHERE id_lote = '88ee9c35-22ff-5440-afaf-26ee4780f20c';
UPDATE notas SET valor_total = 1225.85 WHERE id_nota = '4c80ab60-3c86-5edc-b6a2-afd910276625';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('4c80ab60-3c86-5edc-b6a2-afd910276625', DATE '2026-08-16', DATE '2026-09-08', 77.27, 77.27, 'recebido', 'Baixa do apLIS — lote(s) 6072 (recebido em 08/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('4c80ab60-3c86-5edc-b6a2-afd910276625');

-- sem número | AMHP-DF | lote(s) 6141
DELETE FROM recebimentos WHERE id_receb IN ('b95aa500-1ffd-4181-ae90-1aed1287e822');
UPDATE lotes SET valor_total = 649.37 WHERE id_lote = '934688f4-1a42-5358-8567-38613f6404cd';
UPDATE notas SET valor_total = 649.37 WHERE id_nota = 'aa40b0f7-9bd0-5ef7-9391-79013e7634a1';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('aa40b0f7-9bd0-5ef7-9391-79013e7634a1', DATE '2026-08-22', DATE '2026-08-31', 678.40, 678.40, 'recebido', 'Baixa do apLIS — lote(s) 6141 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('aa40b0f7-9bd0-5ef7-9391-79013e7634a1');

-- sem número | AMHP-DF | lote(s) 6028
DELETE FROM recebimentos WHERE id_receb IN ('fa3a84d5-0aec-458b-9af9-9ad41b12b834');
UPDATE lotes SET valor_total = 9859.90 WHERE id_lote = '02bc4d0b-f7b9-5819-abec-19fdee36cf18';
UPDATE notas SET valor_total = 9859.90 WHERE id_nota = '3d1e76b4-4241-59a8-9bb1-35f7b47c0875';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3d1e76b4-4241-59a8-9bb1-35f7b47c0875', DATE '2026-08-10', DATE '2026-08-17', 9961.47, 9961.47, 'recebido', 'Baixa do apLIS — lote(s) 6028 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3d1e76b4-4241-59a8-9bb1-35f7b47c0875');

-- sem número | AMHP-DF | lote(s) 6089
DELETE FROM recebimentos WHERE id_receb IN ('c5dc4009-3986-4429-a2b4-c188c32ca20e');
UPDATE lotes SET valor_total = 4684.96 WHERE id_lote = '8ae9b07b-593b-5e96-b8cb-ceb192254397';
UPDATE notas SET valor_total = 4684.96 WHERE id_nota = 'ef750f3f-fe7a-5f21-9fea-e55ae306dfd3';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', DATE '2026-08-17', DATE '2026-08-17', 1698.81, 1698.81, 'recebido', 'Baixa do apLIS — lote(s) 6089 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', DATE '2026-08-17', DATE '2026-08-31', 1797.66, 1797.66, 'recebido', 'Baixa do apLIS — lote(s) 6089 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3', DATE '2026-08-17', DATE '2026-09-09', 1108.57, 1108.57, 'recebido', 'Baixa do apLIS — lote(s) 6089 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3');

-- sem número | AMHP-DF | lote(s) 6088
DELETE FROM recebimentos WHERE id_receb IN ('1bc4d783-3e93-44e1-a4a5-de7fea4f696b');
UPDATE lotes SET valor_total = 147.34 WHERE id_lote = '0d50bc67-065f-592b-8572-f9cff485776a';
UPDATE notas SET valor_total = 147.34 WHERE id_nota = '12f446c0-0f32-5880-b4b7-6bea171c536b';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12f446c0-0f32-5880-b4b7-6bea171c536b', DATE '2026-08-17', DATE '2026-09-09', 73.67, 73.67, 'recebido', 'Baixa do apLIS — lote(s) 6088 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('12f446c0-0f32-5880-b4b7-6bea171c536b', DATE '2026-08-17', DATE '2026-09-15', 73.67, 73.67, 'recebido', 'Baixa do apLIS — lote(s) 6088 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('12f446c0-0f32-5880-b4b7-6bea171c536b');

-- sem número | AMHP-DF | lote(s) 6146
DELETE FROM recebimentos WHERE id_receb IN ('84f72b3d-8044-4668-bd0f-5b5495dd818b');
UPDATE lotes SET valor_total = 457.16 WHERE id_lote = '45fdb1e6-dfee-537e-bbfa-c29779e0486b';
UPDATE notas SET valor_total = 457.16 WHERE id_nota = '49599558-0d2e-5b04-9906-1fb7a97c5162';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('49599558-0d2e-5b04-9906-1fb7a97c5162', DATE '2026-08-22', DATE '2026-08-31', 495.98, 495.98, 'recebido', 'Baixa do apLIS — lote(s) 6146 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('49599558-0d2e-5b04-9906-1fb7a97c5162');

-- sem número | AMHP-DF | lote(s) 6175
DELETE FROM recebimentos WHERE id_receb IN ('aa3f60ea-9cef-410f-b710-28bf1b33fe89');
UPDATE lotes SET valor_total = 3785.98 WHERE id_lote = '9aff72b3-8d4a-5f5f-82aa-8614f8254e5b';
UPDATE notas SET valor_total = 3785.98 WHERE id_nota = 'cc38b364-5b5f-5998-b240-ca7410082106';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', DATE '2026-08-25', DATE '2026-08-17', 2776.42, 2776.42, 'recebido', 'Baixa do apLIS — lote(s) 6175 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', DATE '2026-08-25', DATE '2026-08-19', 176.26, 176.26, 'recebido', 'Baixa do apLIS — lote(s) 6175 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cc38b364-5b5f-5998-b240-ca7410082106', DATE '2026-08-25', DATE '2026-08-31', 1155.02, 1155.02, 'recebido', 'Baixa do apLIS — lote(s) 6175 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('cc38b364-5b5f-5998-b240-ca7410082106');

-- sem número | AMHP-DF | lote(s) 6027
DELETE FROM recebimentos WHERE id_receb IN ('0ee09db9-c730-4c3c-a820-6653a4f05735');
UPDATE lotes SET valor_total = 4052.13 WHERE id_lote = '8aafcde4-f69c-5fb3-90bc-84505c632d59';
UPDATE notas SET valor_total = 4052.13 WHERE id_nota = 'c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd', DATE '2026-08-09', DATE '2026-08-17', 3905.36, 3905.36, 'recebido', 'Baixa do apLIS — lote(s) 6027 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd');

-- sem número | AMHP-DF | lote(s) 6084
DELETE FROM recebimentos WHERE id_receb IN ('8a62663d-97e9-457f-8be8-f796783eef0f');
UPDATE lotes SET valor_total = 1592.57 WHERE id_lote = '39ef28a2-b34d-53b3-81a1-f1644699c703';
UPDATE notas SET valor_total = 1592.57 WHERE id_nota = '7f50ae64-580b-5763-b610-a0905aaa2e4f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7f50ae64-580b-5763-b610-a0905aaa2e4f', DATE '2026-08-17', DATE '2026-08-31', 1362.31, 1362.31, 'recebido', 'Baixa do apLIS — lote(s) 6084 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7f50ae64-580b-5763-b610-a0905aaa2e4f', DATE '2026-08-17', DATE '2026-09-15', 336.84, 336.84, 'recebido', 'Baixa do apLIS — lote(s) 6084 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7f50ae64-580b-5763-b610-a0905aaa2e4f');

-- sem número | AMHP-DF | lote(s) 6145
DELETE FROM recebimentos WHERE id_receb IN ('5f94ab7e-fa94-40cb-89b2-03988bd54779');
UPDATE lotes SET valor_total = 1700.55 WHERE id_lote = '67bf925c-3e16-53bd-a3b5-7da787cc46d7';
UPDATE notas SET valor_total = 1700.55 WHERE id_nota = '96905c71-3e89-5ae0-8388-6f034636ccec';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('96905c71-3e89-5ae0-8388-6f034636ccec', DATE '2026-08-22', DATE '2026-08-31', 1740.46, 1740.46, 'recebido', 'Baixa do apLIS — lote(s) 6145 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('96905c71-3e89-5ae0-8388-6f034636ccec');

-- sem número | AMHP-DF | lote(s) 6166
DELETE FROM recebimentos WHERE id_receb IN ('ada735de-ad6a-455d-94a3-f53559b2d52f');
UPDATE lotes SET valor_total = 828.31 WHERE id_lote = '914076e2-8f6f-5ea2-951f-f469ed8cfd3a';
UPDATE notas SET valor_total = 828.31 WHERE id_nota = '2e6cd6e4-574b-5888-8c91-c49ef88f34b2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2e6cd6e4-574b-5888-8c91-c49ef88f34b2', DATE '2026-08-25', DATE '2026-08-31', 898.61, 898.61, 'recebido', 'Baixa do apLIS — lote(s) 6166 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('2e6cd6e4-574b-5888-8c91-c49ef88f34b2');

-- sem número | AMHP-DF | lote(s) 6014
DELETE FROM recebimentos WHERE id_receb IN ('08561383-cfd8-445a-b50b-817408d80055');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', DATE '2026-08-09', DATE '2026-08-17', 1680.84, 1680.84, 'recebido', 'Baixa do apLIS — lote(s) 6014 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', DATE '2026-08-09', DATE '2026-08-19', 675.32, 675.32, 'recebido', 'Baixa do apLIS — lote(s) 6014 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('204779c0-8ef7-5369-8bd2-0962357ab449', 'fc78b52b-13ba-5f38-ba69-f4f091b5696d', 675.32, 'EVENTO GLOSADO POR AUDITORIA (ESPECIFICAR)', '3018', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('204779c0-8ef7-5369-8bd2-0962357ab449');

-- sem número | AMHP-DF | lote(s) 6024
DELETE FROM recebimentos WHERE id_receb IN ('b5843a7d-27da-4e24-ab5b-7f49e4a9013b');
UPDATE lotes SET valor_total = 1048.04 WHERE id_lote = '3eafd34c-c943-5622-90c1-03ef01760a80';
UPDATE notas SET valor_total = 1048.04 WHERE id_nota = '46691706-b4b1-512f-a20c-9cdde454e168';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('46691706-b4b1-512f-a20c-9cdde454e168', DATE '2026-08-09', DATE '2026-08-17', 57.90, 57.90, 'recebido', 'Baixa do apLIS — lote(s) 6024 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('46691706-b4b1-512f-a20c-9cdde454e168');

-- sem número | AMHP-DF | lote(s) 6033
DELETE FROM recebimentos WHERE id_receb IN ('a8dd1d48-1bde-4611-aba7-c344dbed0394');
UPDATE lotes SET valor_total = 4706.86 WHERE id_lote = 'f317f6ef-c671-523f-80c5-568c0ff9c2e7';
UPDATE notas SET valor_total = 4706.86 WHERE id_nota = 'dc1cb607-a165-5e55-99b8-608cd1942322';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('dc1cb607-a165-5e55-99b8-608cd1942322', DATE '2026-08-10', DATE '2026-08-17', 4174.89, 4174.89, 'recebido', 'Baixa do apLIS — lote(s) 6033 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('dc1cb607-a165-5e55-99b8-608cd1942322');

-- sem número | AMHP-DF | lote(s) 6080
DELETE FROM recebimentos WHERE id_receb IN ('0eb2501d-6fa6-4af5-ba09-9e89dbbaaef1');
UPDATE lotes SET valor_total = 789.93 WHERE id_lote = '884ffba2-12d8-5a35-94a3-44f041c89b9a';
UPDATE notas SET valor_total = 789.93 WHERE id_nota = 'd04a35b3-bf19-5d14-b7f9-4f5c91525a0f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f', DATE '2026-08-17', DATE '2026-08-31', 263.13, 263.13, 'recebido', 'Baixa do apLIS — lote(s) 6080 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f', DATE '2026-08-17', DATE '2026-09-09', 394.59, 394.59, 'recebido', 'Baixa do apLIS — lote(s) 6080 (recebido em 09/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f');

-- sem número | AMHP-DF | lote(s) 6173
DELETE FROM recebimentos WHERE id_receb IN ('b4798ed3-e070-4621-93f2-af0cfe7ad1ee');
UPDATE lotes SET valor_total = 1624.94 WHERE id_lote = 'fb880277-f2d3-559f-80f7-2956fc3a86bf';
UPDATE notas SET valor_total = 1624.94 WHERE id_nota = 'c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8', DATE '2026-08-25', DATE '2026-08-31', 1411.52, 1411.52, 'recebido', 'Baixa do apLIS — lote(s) 6173 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8', DATE '2026-08-25', DATE '2026-09-15', 295.17, 295.17, 'recebido', 'Baixa do apLIS — lote(s) 6173 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8');

-- sem número | AMHP-DF | lote(s) 6015
DELETE FROM recebimentos WHERE id_receb IN ('167e782f-075c-4aa9-bd8b-4dae9ee5352b');
UPDATE lotes SET valor_total = 1204.91 WHERE id_lote = '4db682d3-066b-5c1e-8df1-b3ac4b4a09f4';
UPDATE notas SET valor_total = 1204.91 WHERE id_nota = '3c2ae92c-8e9b-5209-85d8-f317f9ee143f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3c2ae92c-8e9b-5209-85d8-f317f9ee143f', DATE '2026-08-09', DATE '2026-08-17', 1296.65, 1296.65, 'recebido', 'Baixa do apLIS — lote(s) 6015 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('3c2ae92c-8e9b-5209-85d8-f317f9ee143f');

-- sem número | AMHP-DF | lote(s) 6132
DELETE FROM recebimentos WHERE id_receb IN ('ba7cb2f4-2ec5-4efd-b75d-0f1a6f5b1729');
UPDATE lotes SET valor_total = 2635.08 WHERE id_lote = '989bf314-bad6-510e-aa00-47c5c59916c1';
UPDATE notas SET valor_total = 2635.08 WHERE id_nota = '848e2407-775f-565d-8344-ef94994cb7c6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('848e2407-775f-565d-8344-ef94994cb7c6', DATE '2026-08-21', DATE '2026-08-31', 2707.48, 2707.48, 'recebido', 'Baixa do apLIS — lote(s) 6132 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('848e2407-775f-565d-8344-ef94994cb7c6');

-- sem número | AMHP-DF | lote(s) 6172
DELETE FROM recebimentos WHERE id_receb IN ('2f787dfb-e57d-4fb5-8a83-3eb1c4c710e2');
UPDATE lotes SET valor_total = 117.36 WHERE id_lote = '80e5da63-b4c3-5285-a27a-6f92d2373724';
UPDATE notas SET valor_total = 117.36 WHERE id_nota = 'eaf7d55a-0596-5a02-a9ea-8772acf3650f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('eaf7d55a-0596-5a02-a9ea-8772acf3650f', DATE '2026-08-25', DATE '2026-08-31', 120.60, 120.60, 'recebido', 'Baixa do apLIS — lote(s) 6172 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('eaf7d55a-0596-5a02-a9ea-8772acf3650f');

-- sem número | AMHP-DF | lote(s) 5910
DELETE FROM recebimentos WHERE id_receb IN ('533123a8-68c2-4bb8-9285-a84c1afb72e6');
UPDATE lotes SET valor_total = 273.16 WHERE id_lote = 'a5bac1fa-3112-5813-8d19-df4a728eecb0';
UPDATE notas SET valor_total = 273.16 WHERE id_nota = '90e844ba-b60a-590c-b978-426bf536f51a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('90e844ba-b60a-590c-b978-426bf536f51a', DATE '2026-08-09', DATE '2025-12-31', 273.16, 273.16, 'recebido', 'Baixa do apLIS — lote(s) 5910 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('90e844ba-b60a-590c-b978-426bf536f51a');

-- sem número | AMHP-DF | lote(s) 6026
DELETE FROM recebimentos WHERE id_receb IN ('048c543d-35d5-4c33-b494-c9e53eb9a479');
UPDATE lotes SET valor_total = 674.80 WHERE id_lote = '679c6043-4b2e-5f6a-9d30-7df5f5343de3';
UPDATE notas SET valor_total = 674.80 WHERE id_nota = '72f6423d-a0e2-52b6-b806-a05df9f1dcac';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('72f6423d-a0e2-52b6-b806-a05df9f1dcac', DATE '2026-08-09', DATE '2025-12-31', 674.80, 674.80, 'recebido', 'Baixa do apLIS — lote(s) 6026 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('72f6423d-a0e2-52b6-b806-a05df9f1dcac');

-- sem número | AMHP-DF | lote(s) 6058
DELETE FROM recebimentos WHERE id_receb IN ('125bdcda-e9e8-4f39-b0a5-6285dd9f8b45');
UPDATE lotes SET valor_total = 674.80 WHERE id_lote = '4d5768ea-8ec7-5e92-8891-38e0ad25c7fc';
UPDATE notas SET valor_total = 674.80 WHERE id_nota = '600bf95a-e36e-5078-8acc-c7271b8edbe2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('600bf95a-e36e-5078-8acc-c7271b8edbe2', DATE '2026-08-14', DATE '2025-12-31', 674.80, 674.80, 'recebido', 'Baixa do apLIS — lote(s) 6058 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('600bf95a-e36e-5078-8acc-c7271b8edbe2');

-- sem número | AMHP-DF | lote(s) 6025
DELETE FROM recebimentos WHERE id_receb IN ('a97c11eb-6995-4d1b-b1e7-a2643c2e016f');
UPDATE lotes SET valor_total = 1947.32 WHERE id_lote = 'a4b19604-b64b-5aee-a4c6-a0c4db2e1cc2';
UPDATE notas SET valor_total = 1947.32 WHERE id_nota = 'bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', DATE '2026-08-09', DATE '2025-12-31', 59.89, 59.89, 'recebido', 'Baixa do apLIS — lote(s) 6025 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', DATE '2026-08-09', DATE '2026-08-17', 961.67, 961.67, 'recebido', 'Baixa do apLIS — lote(s) 6025 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9', DATE '2026-08-09', DATE '2026-08-19', 1000.86, 1000.86, 'recebido', 'Baixa do apLIS — lote(s) 6025 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9');

-- sem número | AMHP-DF | lote(s) 6137
DELETE FROM recebimentos WHERE id_receb IN ('62a55097-29d7-4251-8234-7b6056a6f0bc');
UPDATE lotes SET valor_total = 3949.60 WHERE id_lote = 'e76328a8-1f06-5660-98e1-da72a4f74874';
UPDATE notas SET valor_total = 3949.60 WHERE id_nota = '88571ce4-4b60-5243-8d6d-051cfe5c3805';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', DATE '2026-08-22', DATE '2026-08-17', 599.83, 599.83, 'recebido', 'Baixa do apLIS — lote(s) 6137 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', DATE '2026-08-22', DATE '2026-08-31', 1377.34, 1377.34, 'recebido', 'Baixa do apLIS — lote(s) 6137 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('88571ce4-4b60-5243-8d6d-051cfe5c3805', DATE '2026-08-22', DATE '2026-09-08', 701.65, 701.65, 'recebido', 'Baixa do apLIS — lote(s) 6137 (recebido em 08/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('88571ce4-4b60-5243-8d6d-051cfe5c3805');

-- sem número | AMHP-DF | lote(s) 6177
DELETE FROM recebimentos WHERE id_receb IN ('e25b3650-561c-472f-bc8a-8a9390ef64dc');
UPDATE lotes SET valor_total = 3759.06 WHERE id_lote = '23093347-1e4a-5140-83ab-5d09350e61e9';
UPDATE notas SET valor_total = 3759.06 WHERE id_nota = '7465307b-ec49-511a-b7c1-26ba76de89b0';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', DATE '2026-08-25', DATE '2026-08-17', 96.20, 96.20, 'recebido', 'Baixa do apLIS — lote(s) 6177 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', DATE '2026-08-25', DATE '2026-08-31', 3040.70, 3040.70, 'recebido', 'Baixa do apLIS — lote(s) 6177 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7465307b-ec49-511a-b7c1-26ba76de89b0', DATE '2026-08-25', DATE '2026-09-08', 701.65, 701.65, 'recebido', 'Baixa do apLIS — lote(s) 6177 (recebido em 08/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7465307b-ec49-511a-b7c1-26ba76de89b0');

-- sem número | AMHP-DF | lote(s) 6140
DELETE FROM recebimentos WHERE id_receb IN ('4c68f5ab-a9bf-409f-a916-c8dfc382d037');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('37da0817-5300-5619-805f-257b35e6b024', DATE '2026-08-22', DATE '2026-08-17', 554.45, 554.45, 'recebido', 'Baixa do apLIS — lote(s) 6140 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('37da0817-5300-5619-805f-257b35e6b024', DATE '2026-08-22', DATE '2026-09-30', 62.28, 62.28, 'recebido', 'Baixa do apLIS — lote(s) 6140 (recebido em 30/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('37da0817-5300-5619-805f-257b35e6b024');

-- sem número | AMHP-DF | lote(s) 6021
DELETE FROM recebimentos WHERE id_receb IN ('f4b17b45-d536-4ca0-a2c8-2907cd9ce631');
UPDATE lotes SET valor_total = 2261.20 WHERE id_lote = '4ba0f344-645f-5071-8754-ba80b4ba084c';
UPDATE notas SET valor_total = 2261.20 WHERE id_nota = '5f591fc6-2a0a-5483-8342-b459b41ba5c6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5f591fc6-2a0a-5483-8342-b459b41ba5c6', DATE '2026-08-09', DATE '2026-08-04', 2261.20, 2261.20, 'recebido', 'Baixa do apLIS — lote(s) 6021 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5f591fc6-2a0a-5483-8342-b459b41ba5c6');

-- sem número | AMHP-DF | lote(s) 6142
DELETE FROM recebimentos WHERE id_receb IN ('546f6058-2069-452e-89e0-43ebea567e27');
UPDATE lotes SET valor_total = 989.23 WHERE id_lote = '5a5c1409-ef67-55b6-b9cc-405eb983de68';
UPDATE notas SET valor_total = 989.23 WHERE id_nota = '9b28b531-6a1b-540e-a257-03ba040e82f4';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9b28b531-6a1b-540e-a257-03ba040e82f4', DATE '2026-08-22', DATE '2026-08-31', 1028.75, 1028.75, 'recebido', 'Baixa do apLIS — lote(s) 6142 (recebido em 31/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('9b28b531-6a1b-540e-a257-03ba040e82f4');

-- sem número | AMHP-DF | lote(s) 5902
DELETE FROM recebimentos WHERE id_receb IN ('9d536fa9-37b2-44a9-86ce-e1cab4e8a860');
UPDATE lotes SET valor_total = 3637.67 WHERE id_lote = 'bc878576-073e-542f-98b8-5897f6e8ad82';
UPDATE notas SET valor_total = 3637.67 WHERE id_nota = 'b60a4d05-3dbf-50ef-95d0-13e0e8de0b45';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', DATE '2026-08-09', DATE '2025-12-31', 391.32, 391.32, 'recebido', 'Baixa do apLIS — lote(s) 5902 (recebido em 31/12/2025)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', DATE '2026-08-09', DATE '2026-05-15', 1386.72, 1386.72, 'recebido', 'Baixa do apLIS — lote(s) 5902 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', DATE '2026-08-09', DATE '2026-07-31', 1154.65, 1154.65, 'recebido', 'Baixa do apLIS — lote(s) 5902 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45', 'bc878576-073e-542f-98b8-5897f6e8ad82', 395.05, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45');

-- sem número | AMHP-DF | lote(s) 6039
DELETE FROM recebimentos WHERE id_receb IN ('a7077a65-2380-41e6-95a4-4eab74717669');
UPDATE lotes SET valor_total = 8904.29 WHERE id_lote = '6155a38b-5f67-5ead-b6e2-c76c7c6818d6';
UPDATE notas SET valor_total = 8904.29 WHERE id_nota = 'ecedb0e8-9aa4-5ddd-bc6e-1c700807260a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a', DATE '2026-08-10', DATE '2026-07-31', 595.11, 595.11, 'recebido', 'Baixa do apLIS — lote(s) 6039 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a', DATE '2026-08-10', DATE '2026-08-04', 8628.19, 8628.19, 'recebido', 'Baixa do apLIS — lote(s) 6039 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a');

-- sem número | AMHP-DF | lote(s) 6038
DELETE FROM recebimentos WHERE id_receb IN ('0a9ba97d-ddab-491a-9b85-027bf3c7387f');
UPDATE lotes SET valor_total = 11706.56 WHERE id_lote = 'fc343d81-9289-5ade-b445-2835dbcb7d27';
UPDATE notas SET valor_total = 11706.56 WHERE id_nota = 'de002ae5-0e65-506e-91f1-7e34d8762a7a';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('de002ae5-0e65-506e-91f1-7e34d8762a7a', DATE '2026-08-11', DATE '2026-08-04', 11706.56, 11706.56, 'recebido', 'Baixa do apLIS — lote(s) 6038 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('de002ae5-0e65-506e-91f1-7e34d8762a7a');

-- sem número | AMHP-DF | lote(s) 6076
DELETE FROM recebimentos WHERE id_receb IN ('94aad407-4447-4b45-8c9b-6498f967cd6b');
UPDATE lotes SET valor_total = 5577.17 WHERE id_lote = '954b342c-b385-5c89-9682-dad94a0ef896';
UPDATE notas SET valor_total = 5577.17 WHERE id_nota = '0c88b53a-6496-52b4-8197-40dbfacaf957';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c88b53a-6496-52b4-8197-40dbfacaf957', DATE '2026-08-17', DATE '2026-08-04', 5513.42, 5513.42, 'recebido', 'Baixa do apLIS — lote(s) 6076 (recebido em 04/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0c88b53a-6496-52b4-8197-40dbfacaf957', DATE '2026-08-17', DATE '2026-09-15', 61.10, 61.10, 'recebido', 'Baixa do apLIS — lote(s) 6076 (recebido em 15/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0c88b53a-6496-52b4-8197-40dbfacaf957');

-- sem número | AMHP-DF | lote(s) 6091
DELETE FROM recebimentos WHERE id_receb IN ('e2a55955-6c99-40aa-b62a-3d245177c839');
UPDATE lotes SET valor_total = 981.24 WHERE id_lote = 'c6f29977-d429-5937-b5ee-148a1767272d';
UPDATE notas SET valor_total = 981.24 WHERE id_nota = '78a5fd39-bb5d-5c14-a518-93513d3209f6';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('78a5fd39-bb5d-5c14-a518-93513d3209f6', DATE '2026-08-17', DATE '2026-08-17', 488.21, 488.21, 'recebido', 'Baixa do apLIS — lote(s) 6091 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('78a5fd39-bb5d-5c14-a518-93513d3209f6');

-- sem número | AMHP-DF | lote(s) 6125
DELETE FROM recebimentos WHERE id_receb IN ('3eefaf67-5583-4904-8e33-34a898f832f1');
UPDATE lotes SET valor_total = 3729.30 WHERE id_lote = '33dc0d1d-f486-5d18-a1ab-a4bac747580b';
UPDATE notas SET valor_total = 3729.30 WHERE id_nota = '65ca2223-8f2a-5358-9a72-0c20a1383b28';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65ca2223-8f2a-5358-9a72-0c20a1383b28', DATE '2026-08-21', DATE '2026-08-17', 2394.08, 2394.08, 'recebido', 'Baixa do apLIS — lote(s) 6125 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65ca2223-8f2a-5358-9a72-0c20a1383b28', DATE '2026-08-21', DATE '2026-08-19', 1412.87, 1412.87, 'recebido', 'Baixa do apLIS — lote(s) 6125 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('65ca2223-8f2a-5358-9a72-0c20a1383b28');

-- sem número | AMHP-DF | lote(s) 6161
DELETE FROM recebimentos WHERE id_receb IN ('342ae419-688f-4ab8-a00f-d2f14184cc59');
UPDATE lotes SET valor_total = 2880.04 WHERE id_lote = 'ee41295f-1bb6-51bb-b353-5c4027b02967';
UPDATE notas SET valor_total = 2880.04 WHERE id_nota = '65828bec-9138-5f08-a19c-537674affcbc';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65828bec-9138-5f08-a19c-537674affcbc', DATE '2026-08-24', DATE '2026-08-17', 1846.56, 1846.56, 'recebido', 'Baixa do apLIS — lote(s) 6161 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('65828bec-9138-5f08-a19c-537674affcbc', DATE '2026-08-24', DATE '2026-08-19', 945.82, 945.82, 'recebido', 'Baixa do apLIS — lote(s) 6161 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('65828bec-9138-5f08-a19c-537674affcbc');

-- sem número | AMHP-DF | lote(s) 6144
DELETE FROM recebimentos WHERE id_receb IN ('fa456b6a-79ad-4636-8af2-6a1aa8f24044');
UPDATE lotes SET valor_total = 781.26 WHERE id_lote = '67bf1b52-8e6e-5d20-9bca-78b92e2160dc';
UPDATE notas SET valor_total = 781.26 WHERE id_nota = '74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418', DATE '2026-08-22', DATE '2026-08-19', 812.50, 812.50, 'recebido', 'Baixa do apLIS — lote(s) 6144 (recebido em 19/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418');

-- NF 8700 | AMIL | lote(s) 5935
DELETE FROM glosas WHERE id_glosa IN ('f819e91b-7437-424e-ae7c-d00ead03f7f5');
DELETE FROM recebimentos WHERE id_receb IN ('1084033f-d48a-4ed4-91bd-5b8210720dab');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', DATE '2026-07-01', DATE '2026-05-27', 204.52, 204.52, 'recebido', 'Baixa do apLIS — lote(s) 5935 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c09b5e8f-45a2-521f-a745-19400ac65c06', '76aa0cec-d34e-5fda-b2c8-6c9df87bdb38', 204.52, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c09b5e8f-45a2-521f-a745-19400ac65c06');

-- NF 8690 | ASSEFAZ | lote(s) 5946
DELETE FROM glosas WHERE id_glosa IN ('0ec9164b-9e95-44b8-b2a7-7d86bdcea4ee');
DELETE FROM recebimentos WHERE id_receb IN ('74897d7b-cbcd-4ffc-8be0-2f70c7c178e8');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc', DATE '2026-07-20', DATE '2026-09-03', 3096.97, 3096.97, 'recebido', 'Baixa do apLIS — lote(s) 5946 (recebido em 03/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('03bcb648-4a2c-58fb-a94e-27d4c3c50acc');

-- NF 8700 | AMIL | lote(s) 5930
DELETE FROM glosas WHERE id_glosa IN ('dd0b8e0c-17d0-4ae8-902b-b9c61d28b86b');
DELETE FROM recebimentos WHERE id_receb IN ('4a59c6ae-1ab5-419f-8fc3-e1cc4b3ab81c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-15', 1148.90, 1148.90, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-18', 852.25, 852.25, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-19', 1487.35, 1487.35, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-21', 1939.33, 1939.33, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-22', 1192.45, 1192.45, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-25', 411.90, 411.90, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-28', 820.00, 820.00, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 28/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', DATE '2026-07-01', DATE '2026-05-29', 611.90, 611.90, 'recebido', 'Baixa do apLIS — lote(s) 5930 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', '218a0650-c408-5e23-a0a6-585512ac83f3', 27.00, 'PROCEDIMENTO NÃO AUTORIZADO', '1402', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed', '218a0650-c408-5e23-a0a6-585512ac83f3', 538.45, 'COBRANÇA DE PROCEDIMENTO COM DATA DE AUTORIZAÇÃO POSTERIOR À DO ATENDIMENTO.', '1814', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e52c15c9-c982-5cbc-bbad-9b7b63c076ed');

-- NF 8690 | ASSEFAZ | lote(s) 5941
DELETE FROM glosas WHERE id_glosa IN ('4792abea-3e97-47cd-a834-bb5c9208dacc');
DELETE FROM recebimentos WHERE id_receb IN ('080dd4a1-ce48-4991-b98f-8e717e7df973');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('85c2b760-da00-58d3-b471-f5e2529e2ee2', DATE '2026-07-20', DATE '2026-08-07', 1056.04, 1056.04, 'recebido', 'Baixa do apLIS — lote(s) 5941 (recebido em 07/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('85c2b760-da00-58d3-b471-f5e2529e2ee2');

-- NF 8690 | ASSEFAZ | lote(s) 5934
DELETE FROM recebimentos WHERE id_receb IN ('ec91bd2b-5336-46f0-9917-d77e342084b4');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('20a77b37-ce84-5af7-b05a-66a4ad13e529', DATE '2026-07-20', DATE '2026-08-07', 2682.37, 2682.37, 'recebido', 'Baixa do apLIS — lote(s) 5934 (recebido em 07/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('20a77b37-ce84-5af7-b05a-66a4ad13e529', 'ed9c2af4-9378-53ec-b5be-2bcbc72df0a5', 75.86, 'COBRANÇA DE PROCEDIMENTO SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '1813', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('20a77b37-ce84-5af7-b05a-66a4ad13e529');

-- NF 8690 | ASSEFAZ | lote(s) 5949
DELETE FROM glosas WHERE id_glosa IN ('a2eed65a-8695-4c64-b72b-30136cffaf3d');
DELETE FROM recebimentos WHERE id_receb IN ('eea8ebc8-13b8-48a7-b270-508d07b36b7b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', DATE '2026-07-20', DATE '2026-08-07', 2871.06, 2871.06, 'recebido', 'Baixa do apLIS — lote(s) 5949 (recebido em 07/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e62de9f1-d067-5c96-9cee-c985067f42ec', 'b133a143-c970-55f3-9544-5c49821cdc95', 195.43, 'COBRANÇA DE PROCEDIMENTO SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '1813', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e62de9f1-d067-5c96-9cee-c985067f42ec');

-- NF 9049 | BRADESCO SAUDE S/A 421715 | lote(s) 6030
DELETE FROM recebimentos WHERE id_receb IN ('b5425e8b-770b-4238-ab21-151cb67a392c');
SELECT fat_recalcular_nota('151a1781-0b6f-5da8-a746-c11c210a7dc1');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6031
DELETE FROM glosas WHERE id_glosa IN ('a73666ef-7a38-4214-9a5b-45b3e5c2b48d');
DELETE FROM recebimentos WHERE id_receb IN ('ab03ebf3-b93c-439e-b851-84f1e0c6a567');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', DATE '2026-08-16', DATE '2026-06-12', 11702.54, 11702.54, 'recebido', 'Baixa do apLIS — lote(s) 6031 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 959.72, 'ATENDIMENTO APÓS O DESLIGAMENTO DO BENEFICIÁRIO', '1006', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 220.39, 'BENEFICIÁRIO COM ATENDIMENTO SUSPENSO', '1016', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 6.76, 'VALOR APRESENTADO A MAIOR', '1705', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 725.56, 'COBRANÇA DE PROCEDIMENTO SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '1813', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('76034b2f-40ca-5d76-adaf-b9bf30efa359', 'fbad1c32-c2a1-5deb-a84d-d0e2d5dae44c', 1701.18, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('76034b2f-40ca-5d76-adaf-b9bf30efa359');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6035
DELETE FROM recebimentos WHERE id_receb IN ('5ff064d2-061e-4e24-80b2-b4dc6c2a0998');
UPDATE lotes SET valor_total = 18071.82 WHERE id_lote = 'a8acf469-7348-5d07-8a72-f6b027cb3b16';
UPDATE notas SET valor_total = 18071.82 WHERE id_nota = '56314685-bfaf-5e9c-a875-caeac6bf0f90';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('56314685-bfaf-5e9c-a875-caeac6bf0f90', DATE '2026-08-16', DATE '2026-06-12', 18071.82, 18071.82, 'recebido', 'Baixa do apLIS — lote(s) 6035 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('56314685-bfaf-5e9c-a875-caeac6bf0f90');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6036
DELETE FROM glosas WHERE id_glosa IN ('f67e0003-f796-4ee4-9029-7fdf8ba968f8');
DELETE FROM recebimentos WHERE id_receb IN ('d1b3c499-f3de-4e06-8e2f-bbbc8f19ba4c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('860c1a62-326f-5657-94c3-908eb45714f7', DATE '2026-08-16', DATE '2026-06-17', 351.42, 351.42, 'recebido', 'Baixa do apLIS — lote(s) 6036 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('860c1a62-326f-5657-94c3-908eb45714f7');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6101
DELETE FROM recebimentos WHERE id_receb IN ('233891b8-970a-463d-b852-1efb27dc67cd');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0994b648-3d91-5c33-8f88-07579bc905bf', DATE '2026-08-18', DATE '2026-06-19', 7183.09, 7183.09, 'recebido', 'Baixa do apLIS — lote(s) 6101 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('0994b648-3d91-5c33-8f88-07579bc905bf');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 6107
DELETE FROM recebimentos WHERE id_receb IN ('620a5255-95a4-451a-9345-5cdc0d71931d');
SELECT fat_recalcular_nota('647fe66a-7267-5f4b-89c2-8ae2852075c0');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6108
DELETE FROM glosas WHERE id_glosa IN ('92c4698e-0ac2-4d22-a18c-32e1669fec7a');
DELETE FROM recebimentos WHERE id_receb IN ('a2097bb5-9de6-4f15-9d61-b03f08b277c5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', DATE '2026-08-18', DATE '2026-05-27', 1040.25, 1040.25, 'recebido', 'Baixa do apLIS — lote(s) 6108 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('60f14123-25d7-512d-9534-b5ebe3e0acd7', DATE '2026-08-18', DATE '2026-06-19', 6862.21, 6862.21, 'recebido', 'Baixa do apLIS — lote(s) 6108 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('60f14123-25d7-512d-9534-b5ebe3e0acd7');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6099
DELETE FROM glosas WHERE id_glosa IN ('790f2339-e6ba-45c4-9b1e-5d9cc94a663f');
DELETE FROM recebimentos WHERE id_receb IN ('3b36cd70-049b-4279-ad9b-09a2187dcdab');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', DATE '2026-08-21', DATE '2026-06-19', 7601.65, 7601.65, 'recebido', 'Baixa do apLIS — lote(s) 6099 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e', '7f49ddef-96de-5a48-96b3-c84ebe86555d', 661.57, 'CODIFICAÇÃO INCORRETA/INADEQUADA DO PROCEDIMENTO.', '2601', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d5aab073-52aa-5403-b0a6-fddcac2b8b2e');

-- sem número | BRADESCO SAUDE S/A 421715 | lote(s) 6102
DELETE FROM recebimentos WHERE id_receb IN ('ed2d0c56-3572-421b-be6c-c0630983ab9f');
SELECT fat_recalcular_nota('e22504af-6476-5078-a1f8-adce9a86ee9d');

-- sem número | BRADESCO SAUDE  - 005711 | lote(s) 6034
DELETE FROM recebimentos WHERE id_receb IN ('9dee8576-480d-4634-827c-31b4beb9bcdf');
UPDATE lotes SET valor_total = 35028.04 WHERE id_lote = '09ca9187-96be-5a2b-ae22-3df502d9322b';
UPDATE notas SET valor_total = 35028.04 WHERE id_nota = '7d34b385-8b2e-5752-b181-519074fe04d2';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('7d34b385-8b2e-5752-b181-519074fe04d2', DATE '2026-08-22', DATE '2026-06-12', 34980.73, 34980.73, 'recebido', 'Baixa do apLIS — lote(s) 6034 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('7d34b385-8b2e-5752-b181-519074fe04d2');

-- NF 8948 | BRADESCO SAUDE  - 005711 | lote(s) 6133
DELETE FROM recebimentos WHERE id_receb IN ('0295bd0c-dc13-4f1a-9c0e-f1cc73eb945b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5c78f884-dde2-5a97-b82e-a9e5134c29a7', DATE '2026-08-22', DATE '2026-06-23', 3634.60, 3634.60, 'recebido', 'Baixa do apLIS — lote(s) 6133 (recebido em 23/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5c78f884-dde2-5a97-b82e-a9e5134c29a7');

-- NF 8567 | BRB SAÚDE | lote(s) 5938
DELETE FROM recebimentos WHERE id_receb IN ('6f17ae9a-e1b2-4d81-808c-da62b7528dd4');
UPDATE lotes SET valor_total = 10244.11 WHERE id_lote = '75cedc01-f994-5fd3-874f-6dd4173d8733';
UPDATE notas SET valor_total = 10244.11 WHERE id_nota = '5961429a-83c2-52d6-8e97-10c2438cdb6f';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-04-29', 42.50, 42.50, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-04-30', 510.05, 510.05, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 30/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-05', 42.50, 42.50, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-06', 42.50, 42.50, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-07', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-08', 1594.01, 1594.01, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 08/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-13', 1041.46, 1041.46, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-15', 1594.01, 1594.01, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-19', 42.50, 42.50, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-20', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-21', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-22', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-26', 552.55, 552.55, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5961429a-83c2-52d6-8e97-10c2438cdb6f', DATE '2026-07-31', DATE '2026-05-28', 2571.83, 2571.83, 'recebido', 'Baixa do apLIS — lote(s) 5938 (recebido em 28/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('5961429a-83c2-52d6-8e97-10c2438cdb6f');

-- NF 8600 | CASSI | lote(s) 5982
DELETE FROM glosas WHERE id_glosa IN ('9109352b-b956-43b5-9e0b-6a9458d56cc2');
DELETE FROM recebimentos WHERE id_receb IN ('a74ed5c4-ffa2-4c82-9610-f4c2c543a1b2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', DATE '2026-07-08', DATE '2026-07-08', 26432.56, 26432.56, 'recebido', 'Baixa do apLIS — lote(s) 5982 (recebido em 08/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0', '6a813d83-4e17-5ec9-a9c5-0e3979bb1d83', 683.61, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('a8ce3ba6-1e99-59c9-bc24-4845bede42c0');

-- NF 8600 | CASSI | lote(s) 5983
DELETE FROM glosas WHERE id_glosa IN ('277501cc-7693-4c3b-a792-df4f2bfbf9b3');
DELETE FROM recebimentos WHERE id_receb IN ('4cc5a8bc-86d4-4660-97f8-2afa70dc95d1');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', DATE '2026-07-08', DATE '2026-07-08', 23919.16, 23919.16, 'recebido', 'Baixa do apLIS — lote(s) 5983 (recebido em 08/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('0832a715-b9a7-5678-99a6-799e4b234fd7', '263b79e1-0c4f-5ea7-9775-67e33bbecb2f', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('0832a715-b9a7-5678-99a6-799e4b234fd7');

-- NF 8600 | CASSI | lote(s) 5986
DELETE FROM glosas WHERE id_glosa IN ('fffe8aef-919f-4190-b17f-c10fc5e8615f');
DELETE FROM recebimentos WHERE id_receb IN ('5089dec1-6ecf-4c75-8077-08778a32ca9f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e5fab097-84bc-536d-9672-c50701615208', DATE '2026-07-08', DATE '2026-07-07', 18763.31, 18763.31, 'recebido', 'Baixa do apLIS — lote(s) 5986 (recebido em 07/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e5fab097-84bc-536d-9672-c50701615208', '9b3c2cdc-5b99-5263-8e0a-06d22e80f3e3', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e5fab097-84bc-536d-9672-c50701615208');

-- NF 8663 | CASSI | lote(s) 6060
DELETE FROM glosas WHERE id_glosa IN ('caffdeeb-7192-4687-ba1d-8bd03a92ef61');
DELETE FROM recebimentos WHERE id_receb IN ('ade1f7ef-a2bf-4d5d-87bf-69a49f6f0f33');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('060407b8-5afd-560f-b46e-4722febc715b', DATE '2026-07-16', DATE '2026-07-14', 16759.84, 16759.84, 'recebido', 'Baixa do apLIS — lote(s) 6060 (recebido em 14/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('060407b8-5afd-560f-b46e-4722febc715b', 'bac304ab-c162-5e75-a489-daf5d2831a19', 227.87, 'VERSÃO DO PADRÃO INVÁLIDA', '5028', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('060407b8-5afd-560f-b46e-4722febc715b');

-- NF 8663 | CASSI | lote(s) 6074
DELETE FROM glosas WHERE id_glosa IN ('a828837b-a35e-4420-98e7-54588bb7a374');
DELETE FROM recebimentos WHERE id_receb IN ('9e5b85d5-5678-4427-bbc9-bebba0d32fbb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', DATE '2026-07-17', DATE '2026-07-14', 381.65, 381.65, 'recebido', 'Baixa do apLIS — lote(s) 6074 (recebido em 14/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d23fb864-16cc-5e52-ab14-a514ef82ae4f', '87b4a409-15a8-5908-9fed-648cbc2b2168', 0.01, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d23fb864-16cc-5e52-ab14-a514ef82ae4f');

-- NF 8663 | CASSI | lote(s) 6078
DELETE FROM glosas WHERE id_glosa IN ('604727ff-abad-49a8-9012-54cfa0c9bb29');
DELETE FROM recebimentos WHERE id_receb IN ('6828b03c-0758-447d-b47b-d660b277a657');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', DATE '2026-07-18', DATE '2026-07-14', 4971.29, 4971.29, 'recebido', 'Baixa do apLIS — lote(s) 6078 (recebido em 14/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6361aea0-f704-5609-8768-3b6b4f4f99a8', 'ec5cb783-6951-5469-9c7c-7ed7bac157ce', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6361aea0-f704-5609-8768-3b6b4f4f99a8');

-- NF 8575 | E-VIDA | lote(s) 5958
DELETE FROM glosas WHERE id_glosa IN ('2007a54f-638e-496d-bc8a-acdac3b38b1d');
DELETE FROM recebimentos WHERE id_receb IN ('4ab7036c-f5be-46e8-ba92-25b9d06d0d87');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-04-10', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-04-16', 450.26, 450.26, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 16/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-05', 401.89, 401.89, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 05/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-06', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-07', 95.26, 95.26, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-15', 687.04, 687.04, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 15/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-19', 450.26, 450.26, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 19/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-20', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 20/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-21', 48.37, 48.37, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 21/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-22', 498.63, 498.63, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 22/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', DATE '2026-07-08', DATE '2026-05-29', 1137.30, 1137.30, 'recebido', 'Baixa do apLIS — lote(s) 5958 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33', 48.37, 'NÃO EXISTE INFORMAÇÃO SOBRE A SENHA DE AUTORIZAÇÃO DO PROCEDIMENTO', '1403', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33', 401.89, 'COBRANÇA FORA DO PRAZO DE VALIDADE', '1701', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c', '3b091a86-16c3-51c6-afd6-6b31ab069a33', 7.30, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c');

-- sem número | FASCAL | lote(s) 5947
DELETE FROM glosas WHERE id_glosa IN ('19edc261-7d22-45c4-85ab-a051e0a6feda');
DELETE FROM recebimentos WHERE id_receb IN ('a75a161a-1405-40d9-abab-1a594ff4b47b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-04-10', 578.95, 578.95, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 10/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-04-23', 898.69, 898.69, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 23/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-04-28', 578.95, 578.95, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 28/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-06', 2021.32, 2021.32, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 06/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-07', 898.69, 898.69, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-08', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 08/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-12', 176.25, 176.25, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 12/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-13', 561.32, 561.32, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-14', 239.76, 239.76, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 14/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-18', 361.17, 361.17, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 18/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-25', 79.92, 79.92, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-26', 239.76, 239.76, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', DATE '2026-06-30', DATE '2026-05-27', 159.84, 159.84, 'recebido', 'Baixa do apLIS — lote(s) 5947 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('94adce4e-f6d3-560c-aa9e-a9706fea900f', '6bbab090-1b21-58fb-8fea-ce402b431221', 705.00, 'NÚMERO DA CARTEIRA INVÁLIDO', '1001', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('94adce4e-f6d3-560c-aa9e-a9706fea900f');

-- sem número | FASCAL | lote(s) 5960
DELETE FROM glosas WHERE id_glosa IN ('29f23aeb-cc30-4343-ba86-cda842a9d530');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5b55fe1b-57bf-593f-932d-02952ee7f53b', '16e2dd10-4a0c-5f9e-9af1-e38a37b90790', 703.52, 'ASSINATURA DO TITULAR / RESPONSÁVEL INEXISTENTE', '1010', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5b55fe1b-57bf-593f-932d-02952ee7f53b');

-- NF 9233 | POSTAL SAÚDE | lote(s) 5955
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('77dde167-d8c3-5bae-8e38-76e36d81fd48', 'eb2261a4-beb3-5177-9572-e28c264cd1d5', 0.01, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('77dde167-d8c3-5bae-8e38-76e36d81fd48');

-- NF 8841 | PMDF | lote(s) 5993
DELETE FROM glosas WHERE id_glosa IN ('42225262-909a-485c-9853-4f90b345b5e7');
DELETE FROM recebimentos WHERE id_receb IN ('2acbbba5-da33-40d0-92f5-ec2be4f1e0d7');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', DATE '2026-07-09', DATE '2026-08-11', 13799.79, 13799.79, 'recebido', 'Baixa do apLIS — lote(s) 5993 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082', '48ce2cdc-ed23-5f2e-8675-5b75da601353', 296.21, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5aaa0af7-9699-5f8c-9c55-cca66cfb6082');

-- NF 8841 | PMDF | lote(s) 5992
DELETE FROM glosas WHERE id_glosa IN ('2fe93808-7f42-47c8-bd9d-a87076217a91');
DELETE FROM recebimentos WHERE id_receb IN ('f7cc787a-6193-4eb9-a182-1b52be198812');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', DATE '2026-07-08', DATE '2026-08-11', 10709.08, 10709.08, 'recebido', 'Baixa do apLIS — lote(s) 5992 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7', '278ed9e8-5178-5f0a-99cd-c2f83becc072', 556.23, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9a60a91e-9634-56b1-b36c-40cb3bb0cef7');

-- NF 8841 | PMDF | lote(s) 5991
DELETE FROM glosas WHERE id_glosa IN ('db9ac6e6-e589-4e3b-b68b-5c36cb116a1f');
DELETE FROM recebimentos WHERE id_receb IN ('417fa199-eca0-42a4-8956-c09b5fabf3dc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', DATE '2026-07-08', DATE '2026-08-11', 678.84, 678.84, 'recebido', 'Baixa do apLIS — lote(s) 5991 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('2f217e05-ee9e-54ca-b89a-22e885a73718', 'd7590095-effa-540f-9bc8-b4a138378d2f', 13.84, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('2f217e05-ee9e-54ca-b89a-22e885a73718');

-- NF 8841 | PMDF | lote(s) 5984
DELETE FROM glosas WHERE id_glosa IN ('0efbfdea-8960-4bfc-979a-3e3a4a5dfe73');
DELETE FROM recebimentos WHERE id_receb IN ('b13d6382-b356-4042-8b02-636879f2fa33');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', DATE '2026-07-08', DATE '2026-08-11', 17937.20, 17937.20, 'recebido', 'Baixa do apLIS — lote(s) 5984 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59', '63756ae5-87b9-59ed-a43b-4988065b6f22', 366.22, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59');

-- NF 8841 | PMDF | lote(s) 5985
DELETE FROM glosas WHERE id_glosa IN ('e4a9b54f-2926-4e84-9910-d5c615dd2dbd');
DELETE FROM recebimentos WHERE id_receb IN ('cc093166-23a6-4fe1-8137-7b40c1685bb2');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', DATE '2026-07-08', DATE '2026-08-11', 16377.07, 16377.07, 'recebido', 'Baixa do apLIS — lote(s) 5985 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', 'd80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681', 236.08, 'GUIA COM CÓDIGO DE SERVIÇO PREENCHIDO INCORRETAMENTE.', '1318', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cf7e5f16-e92a-5a34-a45d-adbe303332e1', 'd80dedb7-b7ec-5f1c-8a32-cc0f1f3d1681', 334.36, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('cf7e5f16-e92a-5a34-a45d-adbe303332e1');

-- NF 8841 | PMDF | lote(s) 5987
DELETE FROM glosas WHERE id_glosa IN ('0ccdb2fb-235f-406e-a193-16a1042c1185');
DELETE FROM recebimentos WHERE id_receb IN ('268af719-c8ba-48b7-9860-31b7eb5985c5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', DATE '2026-07-08', DATE '2026-08-11', 16562.10, 16562.10, 'recebido', 'Baixa do apLIS — lote(s) 5987 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd', 'a1ead683-ec25-5e0e-9f82-4e80ffbf5e33', 338.13, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('9c513cd9-9ad1-59e9-a491-4615daf0b2cd');

-- NF 8841 | PMDF | lote(s) 6003
DELETE FROM glosas WHERE id_glosa IN ('875b4d76-5ec9-41d0-974a-904739e07b4f');
DELETE FROM recebimentos WHERE id_receb IN ('773c42ec-e1c6-4b8f-ba9f-ce3ce07eb0f4');
UPDATE lotes SET valor_total = 4490.19 WHERE id_lote = '60d0577e-2c49-58b7-bebd-f140bb31eac3';
UPDATE notas SET valor_total = 4490.19 WHERE id_nota = 'e46d8507-b9e9-5429-a3e2-2fc5faab1ed5';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', DATE '2026-07-09', DATE '2026-08-11', 4144.44, 4144.44, 'recebido', 'Baixa do apLIS — lote(s) 6003 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5', '60d0577e-2c49-58b7-bebd-f140bb31eac3', 109.67, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5');

-- NF 8841 | PMDF | lote(s) 6005
DELETE FROM glosas WHERE id_glosa IN ('04030cd7-b1ba-4290-a847-532b2e9ae298');
DELETE FROM recebimentos WHERE id_receb IN ('b89c5e73-50b9-4807-9a37-2c02f578b4b0');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', DATE '2026-07-09', DATE '2026-08-11', 2187.45, 2187.45, 'recebido', 'Baixa do apLIS — lote(s) 6005 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('32424e4f-a836-5f1f-827b-716aad24dd8d', '5e97a663-8d81-55a7-a487-f38a3298dcd6', 44.78, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('32424e4f-a836-5f1f-827b-716aad24dd8d');

-- NF 8841 | PMDF | lote(s) 6069
DELETE FROM glosas WHERE id_glosa IN ('d603dc65-57e2-4a1f-83a2-1e15c56b20b5');
DELETE FROM recebimentos WHERE id_receb IN ('56d32d40-eb6c-429a-8ec7-b68aefeb6879');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', DATE '2026-07-16', DATE '2026-08-11', 22496.78, 22496.78, 'recebido', 'Baixa do apLIS — lote(s) 6069 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('182ff25f-e912-5022-8098-7b373bfaea46', '2b9a93c4-bbdd-5d78-82fd-ee480e01712b', 459.31, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('182ff25f-e912-5022-8098-7b373bfaea46');

-- NF 8841 | PMDF | lote(s) 6075
DELETE FROM glosas WHERE id_glosa IN ('d156e7c2-c63f-4ab9-a984-5873479928e2');
DELETE FROM recebimentos WHERE id_receb IN ('45ea9126-7be8-4628-8b59-b6d26d9aee42');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', DATE '2026-07-17', DATE '2026-08-11', 1716.25, 1716.25, 'recebido', 'Baixa do apLIS — lote(s) 6075 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cdb546d6-c95e-50d5-8398-aebabfe3bd63', '7a977aef-a9df-5d56-ac4e-7ddfa37bab77', 35.00, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('cdb546d6-c95e-50d5-8398-aebabfe3bd63');

-- NF 8841 | PMDF | lote(s) 6095
DELETE FROM glosas WHERE id_glosa IN ('2a91a898-b938-4028-97e8-d2d44bdf4805');
DELETE FROM recebimentos WHERE id_receb IN ('405a98ed-c3b7-43b8-9a2b-eb380a9af2e6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', DATE '2026-07-18', DATE '2026-08-11', 2510.31, 2510.31, 'recebido', 'Baixa do apLIS — lote(s) 6095 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('bea42edd-9196-5577-87df-6e7e411d12e8', 'cd65bce0-9f92-587c-99a6-71144abbfaac', 51.24, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('bea42edd-9196-5577-87df-6e7e411d12e8');

-- NF 8841 | PMDF | lote(s) 6096
DELETE FROM glosas WHERE id_glosa IN ('1376a77e-14d0-4c9b-a7ea-e5dc9a06ad6b');
DELETE FROM recebimentos WHERE id_receb IN ('792ca05a-c984-4286-b887-9b2d375746e6');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', DATE '2026-07-19', DATE '2026-08-11', 8895.20, 8895.20, 'recebido', 'Baixa do apLIS — lote(s) 6096 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('5269c203-1c7b-5757-b8fd-400a4a7bc824', 'b0ec58d4-7686-5c52-b299-04e8dc08e4de', 181.80, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('5269c203-1c7b-5757-b8fd-400a4a7bc824');

-- NF 8841 | PMDF | lote(s) 5879
DELETE FROM glosas WHERE id_glosa IN ('2f9883fb-e144-4500-8a46-52232562fa57');
DELETE FROM recebimentos WHERE id_receb IN ('a1c8b47a-4502-43d1-9c5a-142b94f52123');
UPDATE lotes SET valor_total = 1985.98 WHERE id_lote = '0545a3a5-b54a-5f9a-8c8a-55f149103dd0';
UPDATE notas SET valor_total = 1985.98 WHERE id_nota = 'de08ceab-5553-5bda-9290-0993f713d306';
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('de08ceab-5553-5bda-9290-0993f713d306', DATE '2026-07-22', DATE '2026-08-11', 1388.97, 1388.97, 'recebido', 'Baixa do apLIS — lote(s) 5879 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('de08ceab-5553-5bda-9290-0993f713d306', '0545a3a5-b54a-5f9a-8c8a-55f149103dd0', 1.14, 'COBRANÇA DE HONORÁRIOS EM DUPLICIDADE.', '2607', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('de08ceab-5553-5bda-9290-0993f713d306', '0545a3a5-b54a-5f9a-8c8a-55f149103dd0', 188.17, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('de08ceab-5553-5bda-9290-0993f713d306');

-- NF 8841 | PMDF | lote(s) 6117
DELETE FROM glosas WHERE id_glosa IN ('420dfec8-76c2-4af4-bd5c-d53b57b752a5');
DELETE FROM recebimentos WHERE id_receb IN ('01cd8ca0-4f44-4110-8666-3473bba3c6d9');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', DATE '2026-07-22', DATE '2026-08-11', 8390.20, 8390.20, 'recebido', 'Baixa do apLIS — lote(s) 6117 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93', 'ef5ed6d5-ee14-5579-9a04-616f617fbb0e', 171.31, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93');

-- NF 8841 | PMDF | lote(s) 6118
DELETE FROM glosas WHERE id_glosa IN ('cc2a275d-4661-4892-a6b8-c9aa3969ac34');
DELETE FROM recebimentos WHERE id_receb IN ('53708584-dc2b-4aaa-a999-4760becd2a64');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', DATE '2026-07-22', DATE '2026-08-11', 10852.49, 10852.49, 'recebido', 'Baixa do apLIS — lote(s) 6118 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('1a741c07-944f-561d-997e-4902c3a1a525', '2a7d4bb4-43a5-579b-9dcc-635edc947357', 221.79, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('1a741c07-944f-561d-997e-4902c3a1a525');

-- NF 8841 | PMDF | lote(s) 6122
DELETE FROM glosas WHERE id_glosa IN ('b8b2c6a0-686f-4047-8f45-6b58f840f508');
DELETE FROM recebimentos WHERE id_receb IN ('5687dca0-76d1-4dc3-89f2-0464116eccb5');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', DATE '2026-07-25', DATE '2026-08-11', 11694.10, 11694.10, 'recebido', 'Baixa do apLIS — lote(s) 6122 (recebido em 11/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('d759d00e-90ac-5f02-b7b2-aa3613e05a42', '1b9f3492-2b76-5ed4-a11f-3ea1ef6594e6', 238.82, 'GLOSA MANTIDA', '2902', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('d759d00e-90ac-5f02-b7b2-aa3613e05a42');

-- NF 8692 | LAB PLANASSISTE | lote(s) 6103
DELETE FROM glosas WHERE id_glosa IN ('dba06880-6780-4055-9c6f-c4eb943b05b9');
DELETE FROM recebimentos WHERE id_receb IN ('e012de95-b4dc-4824-8773-cdcf9817a200');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', DATE '2026-07-19', DATE '2026-08-05', 2080.70, 2080.70, 'recebido', 'Baixa do apLIS — lote(s) 6103 (recebido em 05/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('585003fa-6f4a-5602-8988-42c9ace534ca', 'e68afdb8-e730-5d06-9140-1f721018ea6f', 17.20, 'VALOR APRESENTADO A MAIOR', '1705', 'definitiva', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('585003fa-6f4a-5602-8988-42c9ace534ca');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6155
DELETE FROM glosas WHERE id_glosa IN ('cb306025-8661-4a21-a9ca-8117d54b7a73');
DELETE FROM recebimentos WHERE id_receb IN ('5353db75-b851-4573-ba2e-c9a2b6d32acb');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-01', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 01/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-02', 1300.52, 1300.52, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-03', 1677.56, 1677.56, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 03/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-05', 2096.95, 2096.95, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-08', 2505.09, 2505.09, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 08/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', DATE '2026-08-04', DATE '2026-06-09', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 6155 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('cef25854-2c77-56e2-9068-2be687be6688', 'fc86c21b-8b04-5c36-957e-4e92a01be748', 11.25, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('cef25854-2c77-56e2-9068-2be687be6688');

-- sem número | 090 SULAMERICA | lote(s) 6157
DELETE FROM glosas WHERE id_glosa IN ('5dc8fa08-4e38-4390-a994-8446c684530f');
DELETE FROM recebimentos WHERE id_receb IN ('ada750c6-7cd2-474f-babb-51ce2cb0976f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', DATE '2026-08-04', DATE '2026-08-17', 2285.59, 2285.59, 'recebido', 'Baixa do apLIS — lote(s) 6157 (recebido em 17/08/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8620ba2e-6217-5eaf-97c3-85ea77208cc7', '7e666bbb-8445-5274-ac08-ac033da159c8', 289.21, 'COBRANÇA DE PROCEDIMENTO/EXAME SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '2705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8620ba2e-6217-5eaf-97c3-85ea77208cc7');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6154
DELETE FROM glosas WHERE id_glosa IN ('cc9ffc82-aefe-45ae-a288-14907f57348b');
DELETE FROM recebimentos WHERE id_receb IN ('77337bda-ea71-425c-8822-e65c68e7e718');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-05-26', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 26/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-05-27', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 27/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-05-28', 1666.31, 1666.31, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 28/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-05-29', 923.48, 923.48, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-05-30', 289.21, 289.21, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 30/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-01', 1258.17, 1258.17, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 01/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-02', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-03', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 03/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-05', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-18', 461.74, 461.74, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 18/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-19', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-22', 881.13, 881.13, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 22/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', DATE '2026-08-04', DATE '2026-06-23', 869.88, 869.88, 'recebido', 'Baixa do apLIS — lote(s) 6154 (recebido em 23/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', '26e6c5f7-7cdc-5864-8309-938db760101d', 22.50, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3932efd1-f472-5344-9c64-a14c7928795a', '26e6c5f7-7cdc-5864-8309-938db760101d', 87.83, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3932efd1-f472-5344-9c64-a14c7928795a');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6151
DELETE FROM glosas WHERE id_glosa IN ('efc5f5e2-d6d2-4e25-9705-af0636fcf7b4');
DELETE FROM recebimentos WHERE id_receb IN ('b8174669-aba6-41d7-a473-ef869ffb143e');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-02', 838.78, 838.78, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-10', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 10/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-11', 662.85, 662.85, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 11/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-12', 796.43, 796.43, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-15', 502.96, 502.96, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-16', 3062.78, 3062.78, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 16/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-17', 84.70, 84.70, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 17/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-18', 589.89, 589.89, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 18/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', DATE '2026-08-04', DATE '2026-06-19', 1299.39, 1299.39, 'recebido', 'Baixa do apLIS — lote(s) 6151 (recebido em 19/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', 'ad0a0b7f-cac2-5717-bbac-824e7b9e4e18', 2.26, 'VALOR APRESENTADO A MAIOR', '1705', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ca81a6de-338c-5341-8170-eae3ae18836d', 'ad0a0b7f-cac2-5717-bbac-824e7b9e4e18', 97.54, 'Código 3309 (do apLIS)', '3309', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ca81a6de-338c-5341-8170-eae3ae18836d');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6186
DELETE FROM glosas WHERE id_glosa IN ('1abc8675-7510-454a-998a-3dfd0ebe98a7');
DELETE FROM recebimentos WHERE id_receb IN ('6ec1338e-0026-45fa-807b-fca7fec3ba44');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', DATE '2026-08-04', DATE '2026-06-09', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6186 (recebido em 09/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', DATE '2026-08-04', DATE '2026-06-10', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6186 (recebido em 10/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', DATE '2026-08-04', DATE '2026-06-11', 406.88, 406.88, 'recebido', 'Baixa do apLIS — lote(s) 6186 (recebido em 11/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', DATE '2026-08-04', DATE '2026-06-12', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6186 (recebido em 12/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('247f3ec4-3044-5179-9c6f-55d9d92b6105', DATE '2026-08-04', DATE '2026-06-24', 42.35, 42.35, 'recebido', 'Baixa do apLIS — lote(s) 6186 (recebido em 24/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('247f3ec4-3044-5179-9c6f-55d9d92b6105');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6158
DELETE FROM glosas WHERE id_glosa IN ('5968c3e7-2af3-4946-b672-2d03b31c4c2c');
DELETE FROM recebimentos WHERE id_receb IN ('2087cdb5-d0f5-4606-b72e-f958a865c88f');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', DATE '2026-08-04', DATE '2026-05-07', 144.24, 144.24, 'recebido', 'Baixa do apLIS — lote(s) 6158 (recebido em 07/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', DATE '2026-08-04', DATE '2026-05-28', 144.24, 144.24, 'recebido', 'Baixa do apLIS — lote(s) 6158 (recebido em 28/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', DATE '2026-08-04', DATE '2026-05-29', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 6158 (recebido em 29/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', DATE '2026-08-04', DATE '2026-06-08', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 6158 (recebido em 08/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', '70f13c50-9f67-5084-9dbe-2e1dd90e1655', 88.24, 'COBRANÇA DE PROCEDIMENTO SEM JUSTIFICATIVA PARA REALIZAÇÃO OU COM JUSTIFICATIVA INSUFICIENTE.', '1813', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('df860f03-b303-5d8a-94d0-8f56e2b7f593', '70f13c50-9f67-5084-9dbe-2e1dd90e1655', 537.58, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('df860f03-b303-5d8a-94d0-8f56e2b7f593');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6188
DELETE FROM glosas WHERE id_glosa IN ('3e82b78f-06e0-4524-a543-57c5a732df59');
DELETE FROM recebimentos WHERE id_receb IN ('eaa7ca66-cbbc-4f4d-ad3b-50f835ec301c');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', DATE '2026-08-04', DATE '2026-05-13', 124.05, 124.05, 'recebido', 'Baixa do apLIS — lote(s) 6188 (recebido em 13/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', DATE '2026-08-04', DATE '2026-05-25', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 6188 (recebido em 25/05/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', DATE '2026-08-04', DATE '2026-06-05', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 6188 (recebido em 05/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', DATE '2026-08-04', DATE '2026-06-08', 82.70, 82.70, 'recebido', 'Baixa do apLIS — lote(s) 6188 (recebido em 08/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('3dc5940c-69a5-5519-b1ee-1cb18daf9688', '8573ddef-898b-544f-81b4-c76dc1495942', 176.48, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('3dc5940c-69a5-5519-b1ee-1cb18daf9688');

-- sem número | 090 SULAMERICA | lote(s) 6190
DELETE FROM glosas WHERE id_glosa IN ('9b725943-fc61-4a2a-8ea1-6516a6ab5d5e');
DELETE FROM recebimentos WHERE id_receb IN ('63e974fa-2dd8-4928-8e30-84dcc603a4dc');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fa41830c-560b-54c5-b452-96bd0225612a', DATE '2026-08-04', DATE '2026-06-24', 289.21, 289.21, 'recebido', 'Baixa do apLIS — lote(s) 6190 (recebido em 24/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
SELECT fat_recalcular_nota('fa41830c-560b-54c5-b452-96bd0225612a');

-- sem número | SUL AMERICA COMPANHIA DE SEGURO SAÚDE | lote(s) 6189
DELETE FROM glosas WHERE id_glosa IN ('f24bc7e6-342d-48b1-9f9b-357701285244');
DELETE FROM recebimentos WHERE id_receb IN ('ef873821-ba70-441f-bc6b-7b7d2c16d43b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', DATE '2026-08-04', DATE '2026-04-29', 144.24, 144.24, 'recebido', 'Baixa do apLIS — lote(s) 6189 (recebido em 29/04/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', DATE '2026-08-04', DATE '2026-06-02', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6189 (recebido em 02/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', DATE '2026-08-04', DATE '2026-06-11', 419.39, 419.39, 'recebido', 'Baixa do apLIS — lote(s) 6189 (recebido em 11/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', DATE '2026-08-04', DATE '2026-06-15', 480.93, 480.93, 'recebido', 'Baixa do apLIS — lote(s) 6189 (recebido em 15/06/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('8552722e-ccf2-5506-8727-45a4a0147b67', '0850c8ca-2bd8-5ab5-b321-07404f6bc868', 211.32, 'NECESSÁRIO ENVIO DO RESULTADO DO EXAME ANÁTOMO PATOLÓGICO', '1839', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('8552722e-ccf2-5506-8727-45a4a0147b67');

-- NF 8691 | STJ | lote(s) 6073
DELETE FROM glosas WHERE id_glosa IN ('57b68b8d-3179-4dc4-b834-1db5d17e0f0f');
DELETE FROM recebimentos WHERE id_receb IN ('3ec5586c-3d4c-4617-997e-dd187436151b');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', DATE '2026-07-15', DATE '2026-07-31', 16646.69, 16646.69, 'recebido', 'Baixa do apLIS — lote(s) 6073 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('fe229e92-dd1d-5426-b6af-4ae8fea1c777', 'bb63c2bf-6023-5d31-9094-afbe2f10f0cf', 501.84, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('fe229e92-dd1d-5426-b6af-4ae8fea1c777');

-- NF 8691 | STJ | lote(s) 5835
DELETE FROM glosas WHERE id_glosa IN ('4b435314-338d-4d3e-a944-187796298093');
DELETE FROM recebimentos WHERE id_receb IN ('10b414b3-0664-4af5-9912-8d7d5a59d2c3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', DATE '2026-07-15', DATE '2026-07-31', 4239.64, 4239.64, 'recebido', 'Baixa do apLIS — lote(s) 5835 (recebido em 31/07/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb', '255f5901-eb59-5ad2-b076-44a111bcfd4a', 334.56, 'VALOR DO SERVIÇO SUPERIOR AO VALOR DE TABELA', '1714', 'em_recurso', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb');

-- NF 8696 | TRT | lote(s) 1996
DELETE FROM glosas WHERE id_glosa IN ('be568e05-2576-47b4-8d7c-b366d9a34537');
DELETE FROM recebimentos WHERE id_receb IN ('4ad4c201-8df4-4c70-a5d2-c44ab4c21dd3');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', DATE '2026-07-02', DATE '2023-03-20', 729.94, 729.94, 'recebido', 'Baixa do apLIS — lote(s) 1996 (recebido em 20/03/2023)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('404a92c9-1288-59cd-bf42-acb10ee82f46', 'bcbba671-e18f-55a8-a0bd-f830ce70ca81', 692.31, 'EVENTO GLOSADO POR AUDITORIA (ESPECIFICAR)', '3018', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('404a92c9-1288-59cd-bf42-acb10ee82f46');

-- NF 9175 | TRT | lote(s) 6053
DELETE FROM glosas WHERE id_glosa IN ('909d04c4-2f14-43c0-8a46-c9aecea2d8e9');
DELETE FROM recebimentos WHERE id_receb IN ('3b281cd5-c646-46cc-93aa-164bb4803720');
INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto, valor_recebido, status, observacoes, registrado_por, aplis_sync_status) VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', DATE '2026-07-15', DATE '2026-09-14', 4362.53, 4362.53, 'recebido', 'Baixa do apLIS — lote(s) 6053 (recebido em 14/09/2026)', 'Acerto pelo apLIS (20/10/2026)', 'pendente');
INSERT INTO glosas (nota_id, lote_id, valor, motivo, codigo_glosa, status, responsavel, origem) VALUES ('c3aeff87-0580-51f3-bde4-192e80d715ed', 'c3914cf6-9687-5347-9d82-921f45066c92', 434.84, 'NÃO AUTORIZADO PELA AUDITORIA', '1426', 'aberta', 'Acerto pelo apLIS (20/10/2026)', 'aplis');
SELECT fat_recalcular_nota('c3aeff87-0580-51f3-bde4-192e80d715ed');

-- Conferência: cada título tem de terminar com o valor, o recebido e a glosa do apLIS.
DO $$
DECLARE
  v_errados TEXT;
BEGIN
  SELECT string_agg(e.id::text, ', ')
    INTO v_errados
    FROM (VALUES
      ('8f6e0af2-6d4d-4717-bd6b-28220287e9e3'::uuid, 10635.46, 0.00, 0.00),
      ('1b4c5150-00e9-4a2e-81a7-788aadf5ed3c'::uuid, 1102.02, 1244.18, 26.11),
      ('eadef290-7c37-4575-b7c4-367a06f236c2'::uuid, 836.22, 880.75, 0.00),
      ('21660afa-51e8-4c80-9498-edf8c9e36c89'::uuid, 1418.39, 1362.69, 0.00),
      ('2cbece3f-6a8d-419e-aed2-1103f24111e6'::uuid, 181.70, 181.72, 0.00),
      ('b7b55874-6cac-4ede-bec9-2025704653c2'::uuid, 531.34, 555.21, 0.00),
      ('3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1'::uuid, 794.58, 701.64, 0.00),
      ('b714b2a4-98f7-422d-96e2-018e9c53f7d6'::uuid, 5707.22, 3994.97, 0.00),
      ('dda165dd-c959-4b77-926a-f3f4d8a4b145'::uuid, 6978.38, 6818.11, 0.00),
      ('68cf7768-4671-48da-b22b-4d4630c95bfa'::uuid, 25171.05, 20787.60, 0.00),
      ('15bf1d80-91c8-4dfe-9618-583ac1080c60'::uuid, 1000.75, 1000.75, 0.00),
      ('2a672d1e-d310-44d9-ab96-4638c8d5d853'::uuid, 7188.87, 7188.87, 0.00),
      ('6dda1644-e5bb-47c2-86fa-e45edd13840c'::uuid, 9905.76, 9905.76, 0.00),
      ('530cf841-dd6d-4060-a53c-9be06b004202'::uuid, 8626.49, 3010.59, 0.00),
      ('c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255'::uuid, 1233.65, 1282.94, 0.00),
      ('8747d8f8-be07-4f7a-9238-8d927f3e7e57'::uuid, 4118.24, 782.37, 0.00),
      ('3c8024d4-b7cf-4cb9-b1f9-665bad5ab004'::uuid, 531.34, 555.21, 0.00),
      ('697021c3-dc8b-4798-9c24-8484d82c12da'::uuid, 23669.95, 23149.35, 520.60),
      ('13bf6dce-4743-4a40-b07b-428fd72e7535'::uuid, 3215.96, 3281.99, 0.00),
      ('3e600e27-7259-4d30-9939-0abbbc5c1257'::uuid, 59.89, 59.89, 0.00),
      ('10203a63-ec34-4eae-a329-34b48074a1ed'::uuid, 3073.00, 0.00, 0.00),
      ('e21920b1-de7d-4f10-a1f7-31a75257869a'::uuid, 1174.77, 367.76, 0.00),
      ('d6c3d663-8dd4-4e93-a9af-91f473faeced'::uuid, 9320.79, 9160.95, 159.84),
      ('2f561367-4e51-4913-9495-8b00558a8092'::uuid, 63.93, 63.93, 0.00),
      ('86045f2f-add8-46e2-b059-496dc6708cf3'::uuid, 63.93, 63.93, 0.00),
      ('cf8c7e68-47b6-402d-8751-a178dbeae1c0'::uuid, 68.75, 68.75, 0.00),
      ('7112651f-b605-4190-879e-8e61c35199d6'::uuid, 1115.33, 1115.34, 0.00),
      ('7df8177b-7f85-4dc4-bd43-fd7505f1f6f9'::uuid, 68.75, 68.75, 0.00),
      ('390017a5-8b57-44fa-a5f2-f0a34c9426ca'::uuid, 8511.34, 8511.34, 0.00),
      ('b176d750-4909-4278-901a-432eacf1e864'::uuid, 18693.15, 18693.15, 0.00),
      ('76a1ecc7-fc7d-42de-a5cc-bc27af86cb38'::uuid, 1426.77, 1426.77, 0.00),
      ('c2d6b448-bd77-4001-b16b-ef8d981b6695'::uuid, 1295.08, 535.64, 697.90),
      ('81184b1c-f9d0-46aa-8d54-fe2f35bc4b59'::uuid, 42.35, 42.35, 0.00),
      ('d7311c8f-cb3b-4bed-b838-bddd4c97f543'::uuid, 6760.62, 5607.49, 399.05),
      ('212407e6-ec5d-499a-80ba-41ffd393b450'::uuid, 14130.12, 12028.29, 216.63),
      ('776c82c8-0de5-4429-baa9-050eb31db88b'::uuid, 1196.11, 0.00, 1196.11),
      ('49a6ec97-048b-4624-8247-62ad9f032c27'::uuid, 2346.09, 789.90, 1556.19),
      ('bf2f160f-78ba-4f03-973e-bab4ee5b5b8c'::uuid, 4076.30, 394.95, 3681.35),
      ('d8530908-9e73-4954-9630-ac521a76c1ee'::uuid, 14273.87, 1054.50, 13219.37),
      ('9a5402cb-26da-48cd-a723-13f8bb43c1e4'::uuid, 6239.45, 6239.45, 0.00),
      ('0645ec03-91bb-45b3-b5df-2f4aac9df3d0'::uuid, 1220.64, 1060.37, 160.27),
      ('862af5e3-8cb2-4364-a12c-32ff8d3cc283'::uuid, 12728.64, 12728.64, 0.00),
      ('f3aecfe9-b31e-4b38-9770-99b804530129'::uuid, 15596.16, 15596.16, 0.00),
      ('ae4a5de4-0a47-4f2f-b0c8-bf9094ea2f6f'::uuid, 873.44, 873.44, 0.00),
      ('3c053b58-80db-436c-b72a-74df1d946f9a'::uuid, 1482.72, 1482.72, 0.00),
      ('172855da-da24-4231-9bdd-962570629cdb'::uuid, 14836.27, 14132.25, 704.02),
      ('507b0c51-7225-45db-8dec-6a3c42f079c8'::uuid, 14006.04, 14006.04, 0.00),
      ('37b11053-6e96-4e47-8ff5-0739a11f88ba'::uuid, 7301.06, 7301.05, 0.01),
      ('6f94ef01-5058-409e-8ad6-47441cd0f56d'::uuid, 463.74, 463.74, 0.00),
      ('a04f3ba7-5497-4316-af80-5ae05b0fb265'::uuid, 30194.78, 27613.34, 2581.44),
      ('ce289f17-bf36-4a0d-8eae-3fa513519444'::uuid, 24016.59, 23781.91, 234.68),
      ('c866aefa-1eb1-4919-b1cd-f4f18fda43df'::uuid, 1366.19, 469.97, 0.00),
      ('e0dbe2c9-b1f3-4114-be7f-189e72ff5eb0'::uuid, 10303.10, 10303.10, 0.00),
      ('ff58c668-d246-4b1f-bb01-cc605624337a'::uuid, 21322.08, 20618.06, 704.02),
      ('d657d96f-845a-4650-b54f-9ca077524da2'::uuid, 12845.06, 12845.06, 0.00),
      ('231587bd-3f03-46e5-80e8-e31dc1b298e1'::uuid, 3786.44, 3786.44, 0.00),
      ('a28840ea-9ae8-4e73-aaef-863f54a3504a'::uuid, 3193.58, 2485.11, 0.00),
      ('dde08209-38f4-4350-8ac8-fa3c62d5e69a'::uuid, 9005.21, 8618.68, 441.29),
      ('2e379114-a0f7-495c-a37f-a0cd1c2b13ec'::uuid, 3211.85, 2406.81, 33.17),
      ('72fb35b5-0118-4858-9a7c-64b4cf902c2d'::uuid, 4138.97, 0.00, 0.00),
      ('ac3ad2bf-4188-4b2a-9298-f11935ec6786'::uuid, 3854.30, 4181.80, 0.00),
      ('d8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa'::uuid, 4655.04, 4491.72, 0.00),
      ('a4572e90-0ab8-4581-9215-d03124b4b8b4'::uuid, 6856.22, 6515.00, 0.00),
      ('567e7a18-47ff-4a4f-9f02-4af76c43b2c2'::uuid, 965.77, 965.77, 0.00),
      ('7f5848ae-84de-4b19-9bc7-bd9f01722cf0'::uuid, 73.66, 79.91, 0.00),
      ('95d22173-2bd6-4fd1-92bb-67a2b8c63a72'::uuid, 2027.80, 1448.46, 0.00),
      ('8376808a-f17f-485b-93f0-d201028d347c'::uuid, 1072.68, 355.25, 0.00),
      ('27de197e-24f0-4c5c-a1c4-34945f9d46e9'::uuid, 59.12, 57.90, 0.00),
      ('1672eb37-3aca-49a8-a93a-f55fe017627e'::uuid, 1511.44, 1571.80, 0.00),
      ('05d86674-7a97-4ba1-b355-a9f245502af8'::uuid, 1571.57, 1498.99, 109.44),
      ('7e2653d2-149b-48da-b1e9-1161806fec4f'::uuid, 1788.01, 1095.27, 0.00),
      ('0a4e7069-8a8a-4cf9-9c7a-babd84486ede'::uuid, 1306.93, 1306.93, 0.00),
      ('c5ca081e-ed9d-4113-80e0-8c21d1024483'::uuid, 1049.29, 1138.34, 0.00),
      ('8cce6010-a3a2-4b8e-bf3b-b0eee536876e'::uuid, 1502.02, 1014.19, 0.00),
      ('7fc2bcf0-52af-4536-ad55-b052600b04d0'::uuid, 658.77, 676.87, 0.00),
      ('ac821279-552b-49e3-a558-6f16654a5412'::uuid, 59.89, 62.28, 0.00),
      ('29a53480-38a0-4ba2-952a-ec0e41028f35'::uuid, 1287.40, 1287.40, 0.00),
      ('33426c66-14aa-4537-a948-c460854e7bd0'::uuid, 221.01, 239.79, 0.00),
      ('82e598fe-54da-486b-8b91-51b7ed2e0013'::uuid, 236.15, 256.19, 0.00),
      ('9becb062-decf-4071-b098-c84e201ddb5c'::uuid, 3666.10, 3811.65, 0.00),
      ('ea63012f-4f02-421c-9974-b319879f18b7'::uuid, 7492.99, 4185.15, 0.00),
      ('370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814'::uuid, 828.42, 898.83, 0.00),
      ('7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33'::uuid, 1179.06, 275.43, 0.00),
      ('4337be2f-4d11-4582-b1f0-f2c00530e1a0'::uuid, 828.31, 898.61, 0.00),
      ('66056ce3-5c48-4484-96db-eac7b85ce98a'::uuid, 73.28, 76.20, 0.00),
      ('596f7d09-f3dc-467a-bc2d-daaebef7a6d8'::uuid, 1035.33, 378.38, 0.00),
      ('f1887e02-9d2a-4616-a358-6890769ff7f9'::uuid, 309.79, 336.07, 0.00),
      ('1fc15b45-2a08-4e22-894a-33fe8b440648'::uuid, 2728.04, 2999.66, 0.00),
      ('f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89'::uuid, 1426.65, 354.24, 1021.91),
      ('cfff3201-ac30-4f26-92c7-56a44ddc3fbd'::uuid, 19990.17, 17385.33, 677.29),
      ('196c0ed3-50e9-4478-bc17-4f352d14efcb'::uuid, 31404.94, 26915.25, 1505.52),
      ('88a9ac49-019f-4f6b-9b3f-f1b3e4dfab26'::uuid, 1934.22, 1934.22, 0.00),
      ('83b123e3-2a6c-40f1-ae14-74cfe8600b6e'::uuid, 79.92, 79.92, 0.00),
      ('b4e71835-49c8-432d-957f-31ce0eedf2ef'::uuid, 2696.07, 2696.07, 0.00),
      ('6d174af0-ad78-5f79-8085-4122567bb046'::uuid, 11230.81, 11230.81, 0.00),
      ('5ff54fe2-b378-58d0-b5c1-c7e1b71461a1'::uuid, 8576.35, 8576.35, 0.00),
      ('a9921dc7-0b70-5c32-b1d9-ccbaebdff38c'::uuid, 2393.71, 1416.76, 0.00),
      ('48ea103a-cb82-54f8-bf32-40b3354cf41f'::uuid, 28465.80, 26845.29, 405.12),
      ('c12b5b04-64fa-5e30-882a-ee4f2921644c'::uuid, 9738.52, 9688.19, 0.00),
      ('6da8415d-6d02-5504-a99c-11e5236c6a36'::uuid, 5225.44, 2597.23, 723.48),
      ('423243d4-0159-534f-87c5-ebed6eab1884'::uuid, 31194.34, 30842.82, 351.52),
      ('10f053ff-720d-5271-8a0f-6286eb239394'::uuid, 9151.03, 9151.03, 0.00),
      ('430993ce-45e6-551e-965c-a7270d890a3a'::uuid, 2677.50, 2677.50, 0.00),
      ('6a0531ba-97fc-50db-9e43-56d9cc456183'::uuid, 3208.59, 3208.59, 0.00),
      ('b270739f-c5a0-50b5-9f04-4dd964fcb400'::uuid, 17916.91, 15975.85, 13.51),
      ('61f6a84d-d402-593f-9979-553449bb1096'::uuid, 13277.73, 13277.73, 0.00),
      ('5be66109-4fef-5581-b7b2-e302fe3aa680'::uuid, 8491.65, 8466.10, 25.55),
      ('a9fcfd03-b545-5de5-8087-39aa319b4994'::uuid, 17424.07, 15417.77, 78.75),
      ('4590ad4d-0ed7-542a-9fe1-888952f33f94'::uuid, 7277.62, 6900.58, 0.00),
      ('fd4dbf96-a453-559e-b69c-4deb8454fe1f'::uuid, 649.58, 422.34, 0.00),
      ('33d42e95-33ab-5025-95e7-cccd74994d3b'::uuid, 1349.92, 321.15, 0.00),
      ('1de82c58-a58b-5ee2-aafd-ab4583d485db'::uuid, 4726.83, 4726.83, 0.00),
      ('3bc33148-bc76-5f2a-94cb-4f2700aac1ef'::uuid, 18124.53, 18124.53, 0.00),
      ('aa2bec02-6a65-5585-abe4-1c2ef029f03f'::uuid, 936.82, 936.82, 0.00),
      ('86344a95-3405-5b15-917e-1f03cfd8bea9'::uuid, 5201.65, 5201.65, 0.00),
      ('8673faf4-024d-5f4e-ab54-8111e4869eca'::uuid, 24848.87, 24848.87, 0.00),
      ('06b224f6-b631-51b2-bf8a-8a1a0c84bca1'::uuid, 2674.48, 2524.70, 149.78),
      ('ef7a8f21-5192-521d-95df-97633a8e5ed4'::uuid, 13649.56, 13230.17, 0.00),
      ('5a446282-f098-5509-bfdf-d7cab5c67767'::uuid, 2747.08, 0.00, 0.00),
      ('19677dbb-0df7-5eaa-89ef-86da9329e878'::uuid, 16783.69, 16507.78, 36.00),
      ('be14f0a7-343e-5af1-be37-386e44839d3a'::uuid, 3704.18, 3704.18, 0.00),
      ('6d3c826a-d57b-5dbf-ae20-408da19550c1'::uuid, 1676.27, 1676.27, 0.00),
      ('0e98823a-0afe-59ed-8045-8e9151d7230b'::uuid, 13644.31, 0.00, 13644.31),
      ('b408b580-4c0f-5429-a08f-e40eb880593a'::uuid, 3710.29, 3710.29, 0.00),
      ('d4cf35d7-80f6-5ef5-9197-201a69c3072f'::uuid, 9505.13, 9505.13, 0.00),
      ('c5d09d8c-c2bd-502a-868e-a72adfa81343'::uuid, 119.78, 119.78, 0.00),
      ('2a0bbd41-ac55-547d-af15-c256b0cfa99e'::uuid, 28003.70, 28003.70, 0.00),
      ('86a82593-991e-5034-881e-1e1ad7eb5503'::uuid, 2121.50, 2121.50, 0.00),
      ('565b3271-fb3c-58a3-9a72-bc4e037b531a'::uuid, 9921.68, 9921.68, 0.00),
      ('4b6f812e-49a9-5d0f-a722-b24aec020377'::uuid, 635.00, 48.10, 0.00),
      ('cf57d98e-6d0f-5b75-aa00-5f6391b469b2'::uuid, 24133.02, 24133.02, 0.00),
      ('3741e0d5-5976-596a-8ff8-72126795624e'::uuid, 21482.18, 21482.18, 0.00),
      ('ed5b7df5-d9c5-5b9c-a09b-82f4e31ae221'::uuid, 22778.25, 22778.25, 0.00),
      ('f2bbe3e9-b782-5537-a04e-516a80dbd874'::uuid, 262.92, 262.92, 0.00),
      ('4f60dab8-58e0-51db-a846-2b1278d4b5cc'::uuid, 59.12, 57.90, 0.00),
      ('a2be36df-3482-5202-bb9a-d69a7db29870'::uuid, 4297.14, 4297.14, 0.00),
      ('c06e96c3-9f15-58dc-97f5-808a582dbaeb'::uuid, 10809.43, 10809.43, 0.00),
      ('4378f26b-e782-59fc-b622-a5167a1334da'::uuid, 29816.83, 28449.61, 1367.22),
      ('328f847a-228b-550e-8353-44328642b564'::uuid, 25671.51, 25671.51, 0.00),
      ('759a4004-1539-5d72-bc2d-11f0202e31fd'::uuid, 29887.54, 0.00, 0.00),
      ('6a8596de-d7be-53bd-8eb5-5ab6bcd2530d'::uuid, 12469.52, 12469.39, 0.13),
      ('2bdf711f-a499-5abf-801e-689cedd14444'::uuid, 2992.23, 2071.67, 920.56),
      ('8d1ed233-7eb5-5822-922c-ff2236ed9e94'::uuid, 5463.92, 5461.41, 2.51),
      ('09ad475a-0cc5-551f-99f3-7969b0d4d936'::uuid, 23785.21, 23557.32, 227.89),
      ('d86becfd-005b-59c0-be8f-a62edfa65a95'::uuid, 20122.59, 20122.59, 0.00),
      ('b9fd711b-83be-5517-92f7-6097db4a2e39'::uuid, 4140.67, 3680.41, 149.94),
      ('d9da8233-2eaf-5c74-ab23-e727289d499a'::uuid, 12305.01, 12305.01, 0.00),
      ('4bfcd361-71b3-54ed-8027-1e500f0a3928'::uuid, 3990.83, 3979.08, 11.36),
      ('c6076cab-ddd1-507f-80fe-baaef6f350f5'::uuid, 4233.15, 4181.65, 51.50),
      ('37b1a88e-ea4f-55a5-9146-65e9c29eda01'::uuid, 695.61, 695.61, 0.00),
      ('04d1d4c5-83ee-5215-8ef9-65a33b1a9014'::uuid, 17061.30, 17060.87, 0.43),
      ('87c2e465-5df6-53cf-a8f6-f8d3ca426920'::uuid, 21953.26, 21546.50, 0.00),
      ('562aeafa-ef81-59cd-b806-4b760c56cc61'::uuid, 17912.03, 17912.03, 0.00),
      ('6a1ec375-302f-5e38-ba7f-54758552624e'::uuid, 19150.85, 19117.52, 33.33),
      ('952cb4c4-68ac-56f1-b053-9e341eab5c12'::uuid, 3080.67, 3025.00, 55.67),
      ('147a5a72-75a2-5b68-b26b-04218f4c69f1'::uuid, 1836.97, 2621.94, 0.00),
      ('0a263432-9246-57a7-b833-22692f550517'::uuid, 13792.72, 10781.06, 3011.66),
      ('6d677709-d5c6-56d9-8e99-d80bae8a102f'::uuid, 5248.26, 5248.26, 0.00),
      ('253c5e5e-55a4-5e43-a960-4b9860d85acb'::uuid, 220.98, 220.98, 0.00),
      ('476bd9f8-a53b-51cb-9617-9a67d96254af'::uuid, 636.03, 76.85, 338.94),
      ('1f15146a-6a05-54e4-ab21-a52e64665249'::uuid, 22587.41, 13226.16, 172.19),
      ('20c9c6dd-b3c9-5fed-ac61-762eb24f1128'::uuid, 32336.36, 30299.68, 0.00),
      ('f7168950-3090-52d1-abd2-c6b848b2b546'::uuid, 16389.54, 16389.54, 0.00),
      ('9882dfeb-9574-596c-b32d-e1d1b8ffa32f'::uuid, 1329.74, 191.72, 6.80),
      ('e9384ecd-59d4-57c3-b12e-97f794ec6718'::uuid, 4553.32, 3383.90, 1169.42),
      ('98dafcf9-6e6b-5745-bd16-3b868b47459a'::uuid, 23485.62, 23485.62, 0.00),
      ('df23e177-fa20-5bbe-a77d-d096e6f890f2'::uuid, 23750.55, 22321.47, 1203.45),
      ('1e339098-595e-5427-b1ca-1e4df639c07d'::uuid, 16721.82, 16265.10, 456.72),
      ('bbcf22b4-18b8-5498-850d-93769aa4ae01'::uuid, 3436.83, 3208.96, 227.87),
      ('1d6209f4-1bf9-53d4-9630-7911e1e8f996'::uuid, 2993.46, 2993.46, 0.00),
      ('4f879f72-1631-5d29-a0a6-261d4981ae19'::uuid, 1424.18, 0.00, 0.00),
      ('f33ded75-37cc-53df-a2be-c59db5e03931'::uuid, 26150.95, 25067.76, 1025.45),
      ('f5c10c4a-bd01-5213-8bd8-ded2c2e938ba'::uuid, 4802.68, 4167.56, 0.00),
      ('57cec540-d9be-59f5-852b-b8093e0cf821'::uuid, 25669.02, 25633.03, 35.99),
      ('802f7822-74b8-5e29-9709-b41608024ee8'::uuid, 26912.22, 26912.22, 0.00),
      ('4b337678-278f-58ee-bad5-57d1466f09a2'::uuid, 2362.39, 2356.70, 5.69),
      ('63d79cc8-c535-508c-a65b-3c597b8561b3'::uuid, 2983.61, 3026.57, 0.00),
      ('d427187a-610f-52b3-ad83-ffb3da04c972'::uuid, 122.56, 113.08, 9.48),
      ('167c2dd3-34d3-5fe5-82a2-d8736b9490ab'::uuid, 8763.54, 8763.54, 0.00),
      ('802ba640-5e31-5cdc-a770-14f325306fbe'::uuid, 23212.64, 23118.14, 94.50),
      ('d3ea0baa-b152-5b86-8186-9047843d55a2'::uuid, 13272.19, 12705.13, 0.00),
      ('5c9be3c1-6ed9-5542-b53f-05c7d4c6f663'::uuid, 12683.23, 12227.47, 455.76),
      ('72cff773-d9d5-5949-bc48-37072abee748'::uuid, 7368.89, 7013.89, 0.00),
      ('c7fba69f-8703-5271-950a-e26caf4ddf26'::uuid, 14679.29, 14755.62, 0.00),
      ('c0f4a810-e515-500f-9fff-9b456cc65551'::uuid, 5541.76, 5541.39, 0.00),
      ('ed6f200c-daaa-5f78-92ee-63ebcf0da444'::uuid, 20447.01, 20447.01, 0.00),
      ('5c17dc1d-32a9-5f83-a834-1d3225769ba5'::uuid, 3189.50, 2960.63, 228.87),
      ('a8468ebb-31e8-5f9c-bc39-c752b483f3f8'::uuid, 1420.10, 1420.10, 0.00),
      ('eef13560-6da3-59de-89ae-ce9811be94e1'::uuid, 2283.38, 2283.38, 0.00),
      ('2ea7d537-38ab-58dc-b192-182c39b10eca'::uuid, 935.80, 935.76, 0.04),
      ('3a51a1f3-875f-5490-8327-9043d3027b08'::uuid, 29099.63, 27643.51, 1451.72),
      ('74a52d2a-7b5d-5123-b5c5-73dc09a32f79'::uuid, 3648.97, 3648.80, 0.17),
      ('51feaa9e-b973-55e6-bf65-ad92148e6fbb'::uuid, 442.89, 392.62, 50.27),
      ('5c7a7070-1ff5-5ee8-abd4-d094aad59af5'::uuid, 1498.88, 1626.18, 0.00),
      ('39a4517f-f2ef-53c8-9972-1c343357254e'::uuid, 500.52, 500.52, 0.00),
      ('d963a687-1764-5fe8-ae2a-00c24f12562c'::uuid, 3775.31, 3725.12, 50.19),
      ('ad82dbf8-5545-5f29-a778-670810b9d4a2'::uuid, 16269.07, 16269.06, 0.01),
      ('fff4ff11-d08a-54a3-a602-05e819deebd9'::uuid, 16006.35, 15778.47, 227.88),
      ('83dc421e-34ad-5f7c-8be8-29d9753663af'::uuid, 10527.83, 8722.72, 1805.11),
      ('14a7a630-8fca-5b10-bb85-14bcdbf33925'::uuid, 25141.40, 24516.44, 227.90),
      ('a104cb63-81be-5295-b2ec-50cf9ec4c021'::uuid, 8127.08, 7671.34, 455.74),
      ('628813a4-7bc7-515b-aa49-0590f5457f5c'::uuid, 1724.44, 1678.89, 39.84),
      ('94482fa2-3e8f-5475-9655-656e98ba61b1'::uuid, 42050.46, 42050.46, 0.00),
      ('3b3f6ee3-644a-59df-a3e9-a640518b8ea8'::uuid, 3415.37, 3414.98, 0.39),
      ('8ee54454-7931-57b2-95c4-11f374b6e936'::uuid, 1120.40, 1120.40, 0.00),
      ('5ca46bd6-0c13-58f1-b9ac-6996e4452d38'::uuid, 13339.08, 13328.63, 0.00),
      ('0aea3a84-c5d6-54c3-b805-a8346e258d8a'::uuid, 9114.20, 8886.33, 227.87),
      ('e14b28ed-381f-5bba-9d92-e4e1d1a615da'::uuid, 19327.11, 18921.99, 405.12),
      ('1b6d7b2b-8115-5523-b946-e5866068c232'::uuid, 607.73, 595.57, 12.16),
      ('3d1635b3-03a7-5e01-83d8-dba93ec2f049'::uuid, 2903.92, 2903.92, 0.00),
      ('005278a9-575e-5344-afaa-e68d73ca2d80'::uuid, 23597.27, 23571.73, 25.54),
      ('547c2afe-38bd-5cba-a4bf-92acf6932c75'::uuid, 6783.20, 6737.70, 45.50),
      ('b9d3ef1b-ab90-5a17-a9f2-c875642de3d3'::uuid, 10520.59, 10520.44, 0.15),
      ('e7e6f88f-109b-5c0a-af87-d99ba437733d'::uuid, 575.28, 574.20, 1.08),
      ('a2eff431-d3bc-5363-93c1-d7471181378e'::uuid, 30683.56, 30069.59, 613.97),
      ('00b0cd5a-c92f-58fb-ae36-57c206aed5ad'::uuid, 17878.02, 17210.24, 0.00),
      ('742f351d-eb48-51b2-9290-08b5f9065606'::uuid, 24188.01, 23890.45, 0.00),
      ('325053e9-9e25-53bb-8e86-d714bb60408c'::uuid, 17563.35, 17563.35, 0.00),
      ('c418292c-180a-5d4d-af74-110ea7de81fb'::uuid, 50.19, 50.18, 0.01),
      ('b0a5f8f1-ade5-5057-8127-098f66af0743'::uuid, 2023.58, 2023.58, 0.00),
      ('740138d8-0c3e-5373-87a7-1918bdd7f1c8'::uuid, 3146.79, 2746.37, 400.42),
      ('21e9f51b-0c3e-5c59-89c4-4a57e7bdb4d8'::uuid, 776.13, 798.47, 0.00),
      ('329efbcb-03cc-57a9-95e6-893e1a9e9fe6'::uuid, 2348.77, 2442.27, 0.00),
      ('8962b837-4e89-5282-9938-fc45395e7962'::uuid, 635.00, 537.55, 97.45),
      ('9fc2b8f0-77b7-52da-84e7-cfa13afd8d14'::uuid, 5117.38, 3232.18, 377.04),
      ('d83b6191-71dc-5694-a335-4e992e0f8eac'::uuid, 1230.27, 575.85, 172.20),
      ('a0925e93-12af-5973-aecf-1917630e95c0'::uuid, 23859.33, 23859.33, 0.00),
      ('fe2613c5-b2e7-549a-8018-41ce21ac6142'::uuid, 2643.29, 4092.94, 0.00),
      ('a985828d-beb3-588b-bfd5-837b26f1a734'::uuid, 350.38, 294.49, 0.00),
      ('48836bca-0d6c-5bcf-9e62-9a82f238fddd'::uuid, 40.59, 42.56, 0.00),
      ('2b47a72d-db55-5d27-b448-f60ea4f179d2'::uuid, 753.10, 705.89, 0.00),
      ('18b5f243-a73e-555e-861c-4f8e987c83ca'::uuid, 8526.57, 6363.22, 613.85),
      ('95608998-cb94-5c40-9788-378fff72f690'::uuid, 66.31, 0.00, 0.00),
      ('d0c178ec-5773-5951-b39a-6ba1f2c56d67'::uuid, 3946.18, 2679.53, 0.00),
      ('b664d9e2-6dd6-56db-93cb-83ba81485985'::uuid, 1645.52, 1682.38, 0.00),
      ('196585d5-4824-5000-89ae-985c259d35b1'::uuid, 1645.52, 936.89, 0.00),
      ('112199eb-8888-5c71-993e-9834413141fd'::uuid, 573.14, 341.19, 0.00),
      ('a6e4b79e-984a-51fc-b14c-77bb7911c4c6'::uuid, 216.00, 129.60, 0.00),
      ('d8158c48-28d5-59b0-ad8c-ca54b26ca6d0'::uuid, 2280.99, 2383.74, 0.00),
      ('537cdbf5-f7ef-5911-9264-a5f5172b4d62'::uuid, 1062.51, 1104.95, 0.00),
      ('28409cad-5ee7-5f8f-b0ef-4aee7c845c72'::uuid, 73.28, 73.28, 0.00),
      ('8d66e227-a0ba-56b9-9754-17a6de6f1930'::uuid, 5985.49, 5985.49, 0.00),
      ('aeee244c-1907-532e-8ec2-25d2849f9796'::uuid, 16173.28, 11009.48, 0.00),
      ('a8f3fadb-e4ca-5b26-9aea-871d1afe584a'::uuid, 68.39, 0.00, 0.00),
      ('cc33da98-4dd8-51d1-96da-dae79f178756'::uuid, 4067.61, 1967.22, 0.00),
      ('06066c94-6e06-5446-a496-503fa30add9b'::uuid, 901.97, 159.82, 0.00),
      ('1a3ff490-df50-5eba-9c70-ae038b46e691'::uuid, 218.03, 76.85, 0.00),
      ('df26b171-493b-5d1f-b93f-468e475275f6'::uuid, 1949.85, 864.04, 0.00),
      ('e22b7a64-beaa-5880-8a17-7a40f98463b9'::uuid, 9926.97, 7306.23, 0.00),
      ('630085bf-10f7-5d47-a98c-c367294f249e'::uuid, 58.68, 60.30, 0.00),
      ('d84bad2a-9280-5355-a387-08d53bfff953'::uuid, 3594.29, 3693.02, 0.00),
      ('7c6c2990-d14e-5aad-809c-16b67801e270'::uuid, 614.91, 639.37, 0.00),
      ('71502a28-1520-5176-ae77-b488e558fe85'::uuid, 1029.52, 1029.52, 0.00),
      ('0c5864c1-1b26-53cc-a7b7-9db86f62c759'::uuid, 2863.08, 2957.43, 0.00),
      ('8cee2f56-118e-52d0-b056-d9efb118237c'::uuid, 416.60, 0.00, 0.00),
      ('19391c80-5c03-52c2-adeb-e83a6b990214'::uuid, 2808.23, 2224.51, 0.00),
      ('4e9c20ee-869a-560a-bd80-2a8ed2d7bf42'::uuid, 848.36, 568.17, 0.00),
      ('2224bec4-3229-5a55-b325-4300eac7d59e'::uuid, 3320.15, 3165.15, 155.00),
      ('dfe20150-02bc-5a02-a407-9aa6c597c2e0'::uuid, 8679.36, 8679.36, 0.00),
      ('923df05b-279c-53ee-b85f-6ff87bf57184'::uuid, 9531.98, 9531.98, 0.00),
      ('8858ae39-a91e-5ace-ba60-8bd83cf0f804'::uuid, 12655.84, 12579.16, 76.68),
      ('5d5606a3-17f1-5e9d-a49d-03e4b7498f6a'::uuid, 10971.34, 10967.91, 3.43),
      ('f6fe6af3-8605-5bf6-b2e4-cefee5eda1c4'::uuid, 9113.37, 10026.64, 0.00),
      ('b7a02eae-d2a5-5182-bbcc-40a79b20d5d2'::uuid, 2795.29, 2795.29, 0.00),
      ('9b508a56-3350-5b04-8201-55bf41c2ffff'::uuid, 6805.70, 6671.70, 134.00),
      ('5a2accf1-ac66-5dae-873b-a7827ad8ab26'::uuid, 31745.41, 30940.15, 805.26),
      ('896f8a5a-26b7-5be4-9952-2df1cc7202d1'::uuid, 1144.17, 1015.28, 128.89),
      ('ff1ad414-c1b9-54ad-b179-d7cf55e79e0b'::uuid, 809.83, 0.00, 0.00),
      ('517f99f7-e6b1-5bc1-89df-1ed87c241202'::uuid, 3940.28, 3914.74, 25.54),
      ('1ed8e465-5858-5e1f-ab7f-4d6731229868'::uuid, 13920.35, 13869.27, 51.08),
      ('0c62e3b4-18f8-506a-a96d-2fe272b6a11a'::uuid, 11012.70, 10582.03, 430.67),
      ('5a086b37-66bd-5f4b-a018-f61d36b87134'::uuid, 13118.95, 13093.41, 25.54),
      ('32a86c53-57ff-52d6-8aca-ccd061a1bcb7'::uuid, 18489.74, 18464.20, 25.54),
      ('33c269ab-71bf-503a-b567-552c27934405'::uuid, 13111.24, 10797.19, 11.10),
      ('c36a1018-fefa-5d31-923d-e6695856044a'::uuid, 17736.09, 15980.36, 1755.73),
      ('b55874df-1db0-5cbd-aa15-824cef66a7c8'::uuid, 13913.65, 13683.67, 229.98),
      ('b30f7157-b900-57c7-ac76-83a9c5137a56'::uuid, 2184.86, 1991.11, 193.75),
      ('0b4999f2-3c34-5ac2-864e-99e06c493ea2'::uuid, 22460.83, 21777.22, 683.61),
      ('1b8a3cc6-65d3-5f0b-833a-baf85917700d'::uuid, 17111.86, 16883.99, 227.87),
      ('dcaf32b3-4d0f-535e-b1a5-b5d447dbe18e'::uuid, 16023.09, 16023.09, 0.00),
      ('2e7cbc31-7039-5dbf-99be-94d7bdf98ac7'::uuid, 6891.66, 3472.10, 3419.56),
      ('f11c04b6-750d-531b-bb77-8e0d8dc7f233'::uuid, 12413.80, 11884.60, 529.20),
      ('aa188b1d-db94-5157-9cb4-efe7b97ce933'::uuid, 13220.47, 12875.81, 340.26),
      ('d37dc8ea-5ac2-51ed-b40d-cd3c91c58e14'::uuid, 28744.22, 28735.34, 8.88),
      ('5fe9af1c-9874-5791-940e-2a19ea15b44b'::uuid, 8503.57, 8095.55, 408.02),
      ('336a2b24-8231-50d4-aa48-cb4cc40b911a'::uuid, 53841.13, 50809.42, 2723.03),
      ('4cee8078-2f18-5eae-b8fd-9751101a4558'::uuid, 711.63, 1106.98, 0.00),
      ('7b5c03ba-01c7-53be-9436-c841f59d127d'::uuid, 5592.86, 4875.24, 311.47),
      ('eec72b20-cc59-52ec-95c0-f9399013dbdd'::uuid, 9570.16, 9015.76, 527.80),
      ('0dbfcd74-9e34-5f0d-9df9-432f00100b52'::uuid, 10593.44, 8460.62, 311.66),
      ('5916a2ad-b29f-5f30-b89a-0b84452d66d5'::uuid, 10178.89, 8772.45, 624.40),
      ('ba01ec6e-c55f-5364-abfe-fa4984d5dbdf'::uuid, 8341.19, 7916.67, 375.26),
      ('ee9b91f1-263a-563f-ae05-98e95b5823b3'::uuid, 2017.23, 1983.81, 33.42),
      ('7530a0a6-d8be-5589-97ca-d576f28ad8f9'::uuid, 5924.25, 5027.49, 458.43),
      ('41eaee45-0cc3-58ad-976f-a4fae9243f29'::uuid, 3769.68, 3660.10, 109.58),
      ('99fa1782-0ccf-5f37-92e4-167cf743e91d'::uuid, 8811.71, 8451.85, 283.06),
      ('cfe53259-05ed-5d9c-8d85-8a7dafb96aa9'::uuid, 11402.33, 9218.88, 429.38),
      ('ea93e743-b93e-5dae-9161-8426d6c410b7'::uuid, 18342.82, 18342.80, 0.02),
      ('816e5587-0936-5c5c-8ae4-5bd201793a72'::uuid, 10233.37, 9900.23, 333.14),
      ('c3944d2d-6bbc-5830-b8dd-fa0486ce5a42'::uuid, 16338.88, 14791.69, 1031.46),
      ('08587bb0-e5f6-5e1b-919e-a20a76522a38'::uuid, 24885.75, 24885.75, 0.00),
      ('3856d373-0efb-5756-a9b3-0b25bb3565a4'::uuid, 1431.88, 1292.71, 139.17),
      ('2f6a5f59-b633-597f-ae67-0e23b54ec0eb'::uuid, 7697.31, 6079.21, 109.94),
      ('5e99e53d-15f5-57bd-b71e-47a118c91764'::uuid, 15074.16, 14811.84, 262.32),
      ('1b863d5c-7de2-52ca-9f9c-3525e9684077'::uuid, 13114.15, 12309.54, 385.22),
      ('5b122670-4fa8-5731-9548-195e64209d49'::uuid, 11964.31, 11964.31, 0.00),
      ('63b1b32a-2ca4-5a62-85fc-7baa53ea1d5a'::uuid, 15407.18, 13454.48, 158.63),
      ('7796239d-32c4-53c3-9ca7-2d06f0dafd88'::uuid, 8144.12, 8131.74, 12.38),
      ('10a13bef-5968-548b-9cb0-01eae11ed874'::uuid, 15121.98, 11684.34, 1.93),
      ('5c25fb12-b53d-51b2-9913-d79ff26df029'::uuid, 13077.39, 13077.39, 0.00),
      ('433564bb-3cc3-5b06-b41c-47e77e91ed76'::uuid, 676.34, 676.34, 0.00),
      ('b9528259-50ea-5e5d-84f4-3239dcd4300d'::uuid, 19418.99, 17091.90, 22.50),
      ('df9fc9dc-57a2-53d8-9c1e-6628ba813d07'::uuid, 246.16, 123.08, 123.08),
      ('e1e1a5b0-c4ec-504c-9115-9dea41d858c6'::uuid, 15619.46, 15230.04, 389.42),
      ('799ddb9c-ce91-579b-ad88-31dff8a3db2b'::uuid, 2935.73, 1804.61, 0.00),
      ('369f93c1-8dbc-5828-a5aa-5919afcaef10'::uuid, 8808.09, 8737.61, 70.48),
      ('2868eafc-6b64-5046-a6c5-9316aa3b7219'::uuid, 9626.08, 8658.86, 967.22),
      ('10e93427-93b3-5823-a87d-fd495f9cb15b'::uuid, 3357.83, 3357.69, 0.14),
      ('e46b8fd6-babf-5cd5-8ef3-e9d5832c9501'::uuid, 792.53, 792.51, 0.02),
      ('b4a14c0c-caf2-59fc-8b6d-ba34c5445b05'::uuid, 955.09, 955.06, 0.03),
      ('be10af52-b85b-578a-b2c8-89f90535f040'::uuid, 10132.79, 10132.79, 0.00),
      ('8633a19e-43aa-5fba-a261-63b739011571'::uuid, 864.13, 864.13, 0.00),
      ('b5fd8df7-704a-5b11-97f8-d9ff8fc6cf42'::uuid, 471.21, 471.16, 0.05),
      ('e2db53b1-bb4a-57ba-ab57-27d0eaa2f811'::uuid, 8024.17, 8159.20, 0.00),
      ('dc8a7236-ef3e-5f5e-9f28-98ce29346b9a'::uuid, 300.00, 0.00, 0.00),
      ('f9a2b565-f377-5009-953c-a0a85ff2ad42'::uuid, 1872.62, 0.00, 0.00),
      ('13777d19-3621-5068-bc95-5ab5270cc626'::uuid, 386.57, 0.00, 0.00),
      ('d445e1b3-e196-590d-9b53-dede00ec2ce9'::uuid, 450.00, 0.00, 0.00),
      ('c98b9a1a-6167-566d-bae5-d2f27ada5b4c'::uuid, 230.94, 0.00, 0.00),
      ('f325f7cf-7088-51d9-977a-93a6d2512718'::uuid, 1726.85, 0.00, 0.00),
      ('dbdf4884-2e9c-504b-9e03-b4ea0b66accc'::uuid, 2355.00, 300.00, 0.00),
      ('9adf32b8-909d-5870-8b08-bdf50239ac9d'::uuid, 4396.49, 117.26, 0.00),
      ('acc130f0-a803-5628-8b57-f1df3f0d451b'::uuid, 4076.19, 0.00, 0.00),
      ('c58ae245-f526-5d18-988e-8d6caef9d5ad'::uuid, 46.04, 0.00, 0.00),
      ('e43fc689-a7fd-5157-9d67-e1de02040bb1'::uuid, 20109.54, 19968.58, 0.00),
      ('f6a408c2-4662-5fd3-9322-1cc6dd68ebc5'::uuid, 1924.86, 1848.01, 76.85),
      ('3ce3a7a9-4a4b-5755-98cb-5eea94611a62'::uuid, 4398.57, 2378.08, 2020.49),
      ('08c620d9-37dc-5444-b051-4aa1c93612a0'::uuid, 10633.70, 9320.53, 1313.17),
      ('ae9fea6c-a17a-5756-b6e5-ae8ecfa5a909'::uuid, 2456.31, 2456.31, 0.00),
      ('eb52122b-77e0-5dad-9330-68c3e8c6549b'::uuid, 1103.13, 0.00, 0.00),
      ('15479d38-dae1-5aab-a660-d7a897b89a46'::uuid, 13074.98, 13274.48, 0.00),
      ('5c692fe6-a941-5412-86bb-61c70e87d34f'::uuid, 2068.71, 2034.26, 34.45),
      ('2956e896-591f-5a4a-866e-c52330758497'::uuid, 1681.31, 248.56, 0.00),
      ('c99326f9-68b1-5c33-81ad-64286d016769'::uuid, 236.97, 0.00, 0.00),
      ('cf114bf3-d28d-51a7-9297-5859f6b4456c'::uuid, 1500.00, 150.00, 0.00),
      ('c99bcd37-5335-53cb-939d-5961b8973bd2'::uuid, 1708.97, 0.00, 0.00),
      ('67b56495-6c0c-5844-88fe-81f0c37cb266'::uuid, 710.91, 0.00, 0.00),
      ('805ddaa5-9987-5a28-9102-b184a2eb697f'::uuid, 450.00, 0.00, 0.00),
      ('63883190-8c55-50b9-b184-6ef367ef1a17'::uuid, 600.00, 0.00, 0.00),
      ('b25d8956-6ecf-50a5-92e7-6da925e36d79'::uuid, 814.98, 0.00, 0.00),
      ('0c70e848-c408-56ef-bf11-630ac9d2fd1e'::uuid, 2079.20, 0.00, 0.00),
      ('721e45be-02a1-5e3a-9eb3-8328e114e7b7'::uuid, 1050.00, 0.00, 0.00),
      ('6179f6b7-ed42-5ea9-8823-bed4d501cf89'::uuid, 1475.00, 1159.83, 0.00),
      ('3a37c116-484d-564d-841b-4b994b94d74c'::uuid, 2846.08, 1503.93, 0.00),
      ('65f5de7a-471a-501c-a706-aae67d66a737'::uuid, 2332.41, 2139.25, 0.00),
      ('b113edb2-60d4-5055-b93d-1f405b9e43dd'::uuid, 822.76, 859.62, 0.00),
      ('b78fc85d-f1c1-5488-991b-6ca072afde6e'::uuid, 20762.12, 20533.31, 0.00),
      ('171a632d-bae3-545d-be37-fed75b5da28c'::uuid, 1246.56, 1143.45, 0.00),
      ('0d65a2e5-06c5-55a5-a0b4-6f0fc4751d39'::uuid, 828.42, 79.92, 0.00),
      ('1b3f293f-1b08-5898-ab9d-31ddbeae4e0f'::uuid, 1889.88, 1889.88, 0.00),
      ('69aa7815-b33b-5552-839a-4d84a6233ffc'::uuid, 1525.04, 393.35, 0.00),
      ('b16470e2-8917-5f15-92aa-4ba37470ccca'::uuid, 2926.89, 2273.61, 0.00),
      ('8f97c143-db6b-5289-96c9-cae88a2d919b'::uuid, 499.31, 0.00, 258.71),
      ('19456a07-d18f-563b-8a9f-9996ba5b9936'::uuid, 2511.21, 517.73, 0.00),
      ('cfb13355-30cb-5451-b063-5728cdb5a88b'::uuid, 1819.67, 1528.57, 0.00),
      ('66520844-b1db-5c15-b7d1-a9a6e06a8013'::uuid, 1828.38, 0.00, 0.00),
      ('dde2e3bd-5fa5-50b8-9da1-1b477f242173'::uuid, 1623.10, 649.89, 0.00),
      ('0d9321d7-ca2e-5cc1-94d7-29d298395ca1'::uuid, 17046.72, 12790.75, 0.00),
      ('94d2bef5-eb62-5e51-b475-de6c92b7fa5d'::uuid, 1526.90, 1253.89, 0.00),
      ('9af76ffc-0642-5e8a-8e58-b9c90cdf1d96'::uuid, 412.76, 424.10, 0.00),
      ('6998736a-eb43-571c-989a-41d657b79145'::uuid, 210.93, 219.35, 0.00),
      ('a1f881c6-55b3-5307-8a3b-2c8902744774'::uuid, 5071.29, 3869.74, 0.00),
      ('b5c00973-9c74-5655-a653-feb641e0f7d7'::uuid, 254.88, 0.00, 254.88),
      ('49ff72be-8770-53f9-8f77-f4aff299d1f4'::uuid, 169.08, 0.00, 0.00),
      ('099e720c-ef42-5fe8-9685-eabcf3ab2915'::uuid, 305.65, 314.93, 0.00),
      ('9657bbb9-ce14-5b50-8920-faea67ec9d2a'::uuid, 292.50, 304.17, 0.00),
      ('135c60d4-f407-5ae3-b8e4-c3d0b6040cb1'::uuid, 12489.50, 9133.07, 138.78),
      ('75aaa3ac-d001-5c72-9db5-a69cd9f01e72'::uuid, 4594.90, 1719.55, 1099.69),
      ('f053e13b-2a39-5dc6-91b2-4e340be2d55a'::uuid, 3660.88, 2599.02, 81.60),
      ('ebf2d28c-8c01-5c47-bff4-5db27c22a3f6'::uuid, 63.75, 63.75, 0.00),
      ('285fccb5-740c-582e-852f-93e21d40bfa5'::uuid, 5958.45, 5676.81, 281.64),
      ('5d553b1d-abbe-5d20-92bc-9772c7f93f74'::uuid, 6924.14, 2768.31, 1766.39),
      ('f30b748d-966c-5713-a868-bb8ca9836f9d'::uuid, 13563.01, 13507.56, 55.45),
      ('498a8b21-baa4-55a9-bc2a-427216c73031'::uuid, 1447.82, 999.86, 447.96),
      ('af55e738-fa1a-5f42-affb-1e82cdae8fa4'::uuid, 7296.35, 6476.00, 820.35),
      ('cc43204d-5f15-5687-b12f-6c56cbc6b6f5'::uuid, 1126.00, 808.56, 317.44),
      ('611a5d51-a260-5c60-bc19-4c1efdafa717'::uuid, 9775.75, 9737.41, 0.00),
      ('38c2f48b-913b-5b03-8aba-f670e5885083'::uuid, 11815.90, 11384.76, 431.14),
      ('0530feac-d4b7-5110-9f76-f4e3e57286be'::uuid, 9370.54, 9345.00, 25.54),
      ('428fd97e-c950-5b2c-b0dd-d6c5cab58955'::uuid, 13929.54, 7097.82, 0.00),
      ('9a5fe305-cac7-5bea-851a-e5ca2ccf9a88'::uuid, 5290.85, 5146.09, 144.76),
      ('4418cc42-8863-5b77-a648-96cc6a21c307'::uuid, 3300.53, 2827.99, 472.54),
      ('4e850ee5-624e-5c9c-941e-a3adeff9775f'::uuid, 2473.77, 1339.65, 1134.12),
      ('c579ebfc-95ef-5fa0-8ea7-e60463131608'::uuid, 16238.93, 16191.62, 0.00),
      ('a1d363be-a198-53c8-9e05-3c3a856d89ef'::uuid, 14531.84, 13261.60, 1270.24),
      ('5341a033-9851-5cd3-88d9-83d0f545b34d'::uuid, 424.93, 0.00, 0.00),
      ('256222b8-c811-5286-b9fe-e7d2375605ff'::uuid, 289.17, 31.37, 0.00),
      ('30cf4e0b-c067-5cbd-a59f-d4cfb04fcd11'::uuid, 17260.94, 17256.56, 3.38),
      ('a32e2e77-98de-54e4-babe-98b2f9a363d0'::uuid, 15188.06, 15184.68, 3.38),
      ('5355942b-b225-5cc7-b06a-537afcf67d57'::uuid, 2957.28, 2312.83, 644.45),
      ('b4e210ec-fe25-5f33-a94b-c945f6bea5fb'::uuid, 19084.66, 19011.94, 63.29),
      ('a83966d8-a06c-5fff-9ad9-2c44fcda7afd'::uuid, 9882.66, 8032.15, 0.00),
      ('2c0c9a9d-ada2-5ecf-a1cf-ab0a6cbdc7fa'::uuid, 14011.51, 13327.90, 683.61),
      ('6b11a560-d23c-572e-805e-842b966f2ea6'::uuid, 996.54, 996.53, 0.01),
      ('0a450eb7-0471-57e9-99a6-8ae8013aea4d'::uuid, 8783.38, 8783.36, 0.02),
      ('c3b213f8-513e-53ee-8de8-dbf264edf686'::uuid, 8162.64, 7479.03, 683.61),
      ('4dd06007-312f-51cc-94ae-9c2d0274d5de'::uuid, 13030.20, 12118.72, 911.48),
      ('da53402c-e47d-56cb-81ec-93e4e13bfc76'::uuid, 13770.17, 13542.30, 227.87),
      ('a6ecf363-229b-51c7-b257-e6d155286135'::uuid, 8598.75, 8370.88, 227.87),
      ('4bb337d5-5bfc-5693-81a0-73004a9faa19'::uuid, 14779.52, 13868.04, 911.48),
      ('f31838da-6fea-5aeb-a6b1-2eedaab4b14d'::uuid, 8000.38, 7544.64, 455.74),
      ('01e8bc5a-02ed-55db-9fd8-023074261d3f'::uuid, 99.90, 66.60, 33.30),
      ('793b1b5c-217c-57dd-ac35-e6c63fb8f4e9'::uuid, 2178.93, 1889.82, 217.80),
      ('36945b59-fcba-5d63-a0cb-19740c60e033'::uuid, 16250.29, 15338.81, 455.74),
      ('e6eba16f-8c79-5e17-98b7-9da5963aaaca'::uuid, 4761.06, 4026.04, 735.02),
      ('73f20136-b4f0-517a-bbe1-2b183da462b0'::uuid, 2526.93, 2526.93, 0.00),
      ('d1188ec1-2572-549c-ab69-fad2b36ef5ea'::uuid, 18121.80, 17893.93, 227.87),
      ('52d2ffe7-afde-5be1-aef4-7067642cb19a'::uuid, 26266.01, 25582.40, 683.61),
      ('0aa99aef-73c4-5f58-803f-da3b9c1c1057'::uuid, 20960.87, 20505.13, 455.74),
      ('77510da4-d67c-5b12-b2cb-159d15b7bfc2'::uuid, 1881.19, 1483.17, 326.71),
      ('0ef0a26d-e369-5e16-aa8a-6fcf1da6fd6a'::uuid, 1053.38, 1053.36, 0.02),
      ('c9da1d20-ff49-590a-a413-fd8174ae3dd8'::uuid, 3398.16, 3398.15, 0.01),
      ('fd65698d-ca4d-5f31-8c59-058187b768ce'::uuid, 1929.80, 1926.15, 3.65),
      ('4c02ed5e-5fc9-55a6-b0a7-e01756d38044'::uuid, 1201.85, 676.10, 0.00),
      ('58a3a74f-7cd8-5a88-8e2d-331f30447c7f'::uuid, 2055.34, 468.32, 0.00),
      ('4ea2f52b-d885-55eb-8913-234da7f984fc'::uuid, 3656.80, 3656.80, 0.00),
      ('9a00a3dd-f010-5221-be7c-94030ac0a6bd'::uuid, 755.72, 599.55, 156.17),
      ('6047ccda-6dcd-59ab-9519-5514a5951119'::uuid, 1634.88, 1493.46, 141.42),
      ('f5efbe20-6eb3-5545-9622-208fc1f5afd6'::uuid, 4342.79, 4342.79, 0.00),
      ('ca5d492c-48bc-51b5-8a52-f52417e09622'::uuid, 1110.30, 1110.30, 0.00),
      ('2d113455-d36f-5746-92d2-dc087d2eed8e'::uuid, 3833.41, 3833.02, 0.39),
      ('1d6b62dc-6a8e-5f53-b955-16e65a7de481'::uuid, 18613.74, 18604.33, 9.41),
      ('63a22f21-e6e6-58f3-bff6-d33c453ad1fc'::uuid, 179.50, 179.50, 0.00),
      ('e39273d0-b597-5fce-a6a8-41471b00a187'::uuid, 18990.60, 18954.51, 36.09),
      ('d1b7cad9-cb3e-5e10-aedf-c70dda0372d3'::uuid, 588.35, 588.35, 0.00),
      ('4b3b0400-bd34-5a4d-9bf9-2e7b17683a45'::uuid, 11021.01, 10528.09, 492.92),
      ('1e3114f7-8fd7-5334-8d1d-2a210cd3f34d'::uuid, 7044.99, 3574.11, 0.00),
      ('ee22dd6c-9b74-52be-a4d5-f045c69e2bc3'::uuid, 3300.54, 2913.51, 0.00),
      ('c5f2156d-dc3f-5277-98be-956c1b0f9e9c'::uuid, 2042.70, 2042.31, 0.39),
      ('d66b4a4b-0e44-5b1c-8948-07d798cac5c8'::uuid, 13670.11, 13324.94, 234.65),
      ('75f74c60-5e9d-592d-aaee-4b891c2d8989'::uuid, 14467.57, 13817.14, 244.31),
      ('fa5c7de2-ccf1-5c9b-a265-71590617b62b'::uuid, 8806.94, 8688.74, 118.20),
      ('5b6d31f5-b3bc-546c-ae32-2b9ff3ea9109'::uuid, 5680.74, 5071.32, 0.00),
      ('31005941-8d6f-5d94-9f8b-d74537b2002a'::uuid, 8891.30, 5469.82, 1444.29),
      ('90356160-5d0f-5f44-9d21-3c8511790674'::uuid, 1180.97, 589.91, 591.06),
      ('652c294c-fb49-59dd-87a5-0a2cfed4bc62'::uuid, 21699.41, 21699.41, 0.00),
      ('d37f6b78-81ae-5d95-b5ac-659ea70d3b12'::uuid, 23995.22, 22604.52, 695.35),
      ('bd465739-85d3-5438-b862-1aeec66ec37f'::uuid, 18753.50, 17529.54, 166.74),
      ('3e53fc80-894f-5d77-bb33-332a2ddf1d3b'::uuid, 17072.17, 15681.47, 0.00),
      ('aa8bd94d-3495-5028-8b4a-5058b192cc94'::uuid, 19037.94, 19766.84, 0.00),
      ('4739dcee-92a4-5c14-8897-00d9f287f970'::uuid, 8465.20, 8742.63, 0.00),
      ('25c9db3e-9d9b-53d2-9096-69615b08d64d'::uuid, 8849.54, 7143.22, 0.00),
      ('9e5100b9-d228-5228-a56d-8cb5f46535a6'::uuid, 1931.10, 1931.10, 0.00),
      ('03b3b58b-b72d-5284-81a4-63ea0215af21'::uuid, 13132.96, 13132.96, 0.00),
      ('0e25dc25-cdca-540c-8a3d-5db2b5dca21e'::uuid, 2518.41, 1494.17, 451.82),
      ('95aa4ecc-5f55-55af-97f7-4d169da2a523'::uuid, 83.31, 83.31, 0.00),
      ('bf15e1f7-8db7-573e-bb7e-6f7bb3df273c'::uuid, 4299.48, 4299.48, 0.00),
      ('85c76fb2-6c72-5bd6-9135-a85cb58d6d8d'::uuid, 11412.10, 10956.36, 455.74),
      ('21b892b4-385f-5fc5-8be9-840a561c93b1'::uuid, 12746.65, 12518.78, 0.00),
      ('2a9fbe03-835d-5ce5-bad2-469344175f6f'::uuid, 639.04, 639.03, 0.01),
      ('4088c686-da0b-53a8-a07b-67c146f718c1'::uuid, 2039.69, 2039.69, 0.00),
      ('5c262903-2af5-5cf6-a6b7-3b7c0a3eb0de'::uuid, 41838.37, 37070.95, 920.50),
      ('88ea1812-4165-53fa-b549-81f6a8de68f4'::uuid, 3326.84, 3326.82, 0.02),
      ('eecff5f3-f4ca-5fc9-9f66-b97ee649c7ef'::uuid, 12594.87, 12594.87, 0.00),
      ('2c8b0855-a0aa-5c97-8dd7-9f820babf3bf'::uuid, 5102.74, 5102.74, 0.00),
      ('57a06624-aec1-52fd-b842-f6a9a02abfad'::uuid, 8350.30, 7894.56, 455.74),
      ('87388ab8-06ed-5fac-b5d4-88871aacda44'::uuid, 6114.15, 6114.13, 0.02),
      ('17cfba74-484d-5d55-aa0c-8a1a68aa9906'::uuid, 26524.85, 25613.37, 911.48),
      ('c05b2ca4-8921-5019-a4a5-1938d0bc999c'::uuid, 2257.05, 2257.03, 0.02),
      ('051076e5-f3a8-5ba8-8e4e-7f43846cb2fe'::uuid, 28402.92, 26807.83, 1595.09),
      ('df124c26-a4ed-5d19-ac9a-26a5c622ec9c'::uuid, 29202.49, 28518.88, 683.61),
      ('24093a05-5b09-510c-9160-efd5b3937fd0'::uuid, 12894.00, 12438.26, 0.00),
      ('70785315-8db2-5192-be17-b96ab447e1fc'::uuid, 3554.08, 141.93, 3412.15),
      ('254647cb-291a-5054-b670-ce9ffdd3cb83'::uuid, 8260.26, 8260.26, 0.00),
      ('3d0d042e-2d27-57ed-9c12-1e440841f93a'::uuid, 6903.78, 1965.73, 4938.05),
      ('0b12654d-481a-5d16-b293-959846dd7009'::uuid, 1009.72, 910.23, 99.49),
      ('12bf6e30-6b8c-5372-a1be-c089687a527f'::uuid, 9540.36, 8396.86, 12.38),
      ('9935f496-370a-5f7a-b59d-f3fa382f505a'::uuid, 9887.90, 7705.32, 170.33),
      ('b8450e3c-ec5d-5a7d-81b2-fc130c3f64c5'::uuid, 8282.27, 8282.26, 0.01),
      ('20ebc0e2-4aea-5dbb-91ee-c20439702e19'::uuid, 10696.50, 8661.03, 23.22),
      ('9d0460cd-ac6d-5e52-8991-5adf29567016'::uuid, 10128.23, 9746.81, 0.00),
      ('72b5f1d6-4ff1-534c-b6c5-e0098ef3650b'::uuid, 870.77, 867.39, 3.38),
      ('141ae7bf-ae68-5e3f-966a-04ed05727458'::uuid, 12058.93, 12058.93, 0.00),
      ('86b9a195-cec9-5fb8-add5-e5a824ad6381'::uuid, 9147.09, 7567.28, 279.29),
      ('183180c0-49f6-5758-b0b6-1120f1ee5633'::uuid, 11031.19, 8503.60, 11.25),
      ('31b321eb-6c54-5fd0-876e-72aabb343761'::uuid, 2660.58, 2199.84, 0.00),
      ('b7af1ef2-ac8c-5157-99e4-f75bf90aefdf'::uuid, 24976.04, 14278.11, 0.00),
      ('b293d685-258a-50e9-96a5-1138f8290f45'::uuid, 3732.16, 3312.77, 0.00),
      ('95413d59-814c-5d7f-a46c-3635c2677eb4'::uuid, 3084.80, 3084.80, 0.00),
      ('40ed34b6-449b-56a8-8305-658d4b9a15bc'::uuid, 29027.59, 28504.46, 523.13),
      ('2a8eeb9f-5792-53d9-be68-e381e4d5ce74'::uuid, 147.09, 76.61, 70.48),
      ('6392d0a6-7f02-5dfb-9d66-f0f7a612a2ae'::uuid, 1877.63, 1813.33, 0.76),
      ('14b8e50c-a9be-5396-a045-7b21f7719d2a'::uuid, 4804.81, 4731.50, 73.31),
      ('2b634aea-cb93-5c16-a61f-b1b23c859ae1'::uuid, 792.69, 808.21, 0.00),
      ('45ea4ea5-93e2-54cb-8244-ce72d2121ee5'::uuid, 15336.82, 15255.88, 80.94),
      ('5ff76833-9571-53b5-a107-f42d010da85f'::uuid, 13251.99, 12916.23, 335.76),
      ('0aa5a68f-98e9-58be-be5e-587111864cff'::uuid, 5201.17, 0.00, 5201.17),
      ('a4446b1f-1cac-59a2-9319-081288cd4d81'::uuid, 16863.43, 16860.05, 3.38),
      ('8e38784d-f943-5c94-adac-87662e9de773'::uuid, 3086.71, 1804.18, 1282.53),
      ('127bd150-6c67-5272-94fd-41e0e4a7f91d'::uuid, 31583.80, 30412.84, 1170.96),
      ('dbdedbf8-825b-511c-881c-af2d6bea8e14'::uuid, 212.04, 132.12, 79.92),
      ('d20ebf0e-7548-5b5d-882f-3b45c9bb2a22'::uuid, 319.68, 0.00, 319.68),
      ('dfdff833-c3a8-522c-9d34-753a602d0bf9'::uuid, 3464.51, 0.00, 0.00),
      ('8961fb8b-f0e5-5045-b78f-bdca95caa3d4'::uuid, 4328.26, 4328.19, 0.07),
      ('e9160fcf-911a-5b03-b56b-63c9e3b418b5'::uuid, 21112.52, 21109.14, 3.38),
      ('d462fda9-bb0b-519e-97f7-70d29aba9d0f'::uuid, 5975.08, 5747.21, 227.87),
      ('589d7ba7-c30f-5df4-90e9-d5f72a553ab3'::uuid, 882.59, 826.45, 56.14),
      ('6fcff783-2b6f-51a2-b728-45991f1449ae'::uuid, 599.20, 490.52, 22.48),
      ('0f17bbd5-97c9-5b3f-86c5-0e444f93e17a'::uuid, 760.33, 794.58, 0.00),
      ('1d94fa52-7295-5606-b2fb-325b8a45a3fb'::uuid, 5366.26, 3306.76, 0.00),
      ('3101e4d0-535a-5dcd-b3f4-03bbf36dfa56'::uuid, 1742.71, 1760.10, 0.00),
      ('abe49c02-b178-53a8-840d-d8ed2bc30eff'::uuid, 717.44, 1115.34, 0.00),
      ('f3dc6e0c-78a5-5a75-968a-5e290b5aa346'::uuid, 2412.21, 2508.00, 0.00),
      ('d95ef509-dae0-5405-98c2-555729e6cb8c'::uuid, 3920.06, 3068.20, 0.00),
      ('b27544a9-a615-5a67-9451-b4128e73c153'::uuid, 4196.77, 4196.50, 0.27),
      ('4280cf20-d6cc-5b9b-91ea-2f5e85e64bf7'::uuid, 1285.69, 1155.32, 0.00),
      ('eed7cf1d-8439-55d2-8b1e-cc0e6755968f'::uuid, 5793.98, 6259.01, 0.00),
      ('0116bc36-f035-5783-b362-b07878f9f5de'::uuid, 6954.88, 6954.88, 0.00),
      ('8bf68cc6-2d5d-53e2-a8c6-beb703cf8ee6'::uuid, 10394.74, 10394.74, 0.00),
      ('2fad09f0-10aa-5fbd-85dc-cb9c2bfc27d5'::uuid, 220.98, 239.73, 0.00),
      ('7bbe9a6b-80f7-5686-af5c-fffef9bcc03f'::uuid, 2128.88, 2128.88, 0.00),
      ('bd25a6c0-a1bb-56ab-af79-30689b75d610'::uuid, 994.22, 994.22, 0.00),
      ('8974b833-0f09-547b-ad22-dfcb60a8e3e7'::uuid, 6501.43, 6501.43, 0.00),
      ('11be043f-78cd-5298-89a2-5198b7a27470'::uuid, 5929.57, 5891.23, 38.34),
      ('3da56901-8a41-5774-86f2-5f5af1d0be51'::uuid, 325.24, 325.24, 0.00),
      ('52e0fa2e-2649-5bf2-8f3a-ae605fab4c9f'::uuid, 34.79, 34.79, 0.00),
      ('32b582b4-b094-58d8-b1a0-065d390164a1'::uuid, 59.12, 59.12, 0.00),
      ('9d1acb4c-d4db-5499-8b61-7622e2c5a39a'::uuid, 1303.02, 1270.03, 32.99),
      ('8b65c7fa-5cbb-5100-ae50-a18a1c7d607b'::uuid, 2618.87, 2436.20, 0.00),
      ('21b76c88-69a0-54cc-93e6-8f0fc60dd632'::uuid, 5710.55, 5682.10, 28.45),
      ('42821cb8-bd63-5d15-b368-db3beb2ac72f'::uuid, 4276.27, 4276.27, 0.00),
      ('cd97e919-5220-5423-8b12-0fdc69a53220'::uuid, 524.35, 524.35, 0.00),
      ('a6813d3e-65aa-5a1c-8e81-b13e9f1d7199'::uuid, 2710.73, 2785.22, 0.00),
      ('0a588a4a-1798-5e23-812d-75a6be7575d2'::uuid, 503.71, 503.71, 0.00),
      ('6d949751-236f-51d4-9b2b-4f4a2c619c98'::uuid, 658.77, 658.77, 0.00),
      ('67ee6916-9994-56aa-96f0-b7f4bb2f30e4'::uuid, 1631.00, 1631.00, 0.00),
      ('c39204fc-2937-5cf5-8727-61455fa63ae5'::uuid, 311.91, 311.91, 0.00),
      ('2e352596-ddd2-594a-918c-bb0d8f89fc66'::uuid, 2931.56, 2931.56, 0.00),
      ('a05c941f-f8a9-52f0-933f-904677a943b4'::uuid, 1349.60, 1349.60, 0.00),
      ('a9d3e571-e079-5d30-9e5d-99287c91262d'::uuid, 1306.93, 1359.14, 0.00),
      ('b5f3cb96-2fd4-51fd-a232-f444a0630d28'::uuid, 2877.25, 2379.35, 497.90),
      ('c7fba8f9-dd8d-53a4-ae1d-f931962c596e'::uuid, 365.30, 0.00, 0.00),
      ('85384788-3c79-5306-b4cf-2b01dc6f71c3'::uuid, 1670.80, 1615.35, 55.45),
      ('ddcc03c6-e577-50dd-a8bc-ccc43594227c'::uuid, 1453.49, 1505.70, 0.00),
      ('95aa3302-2efd-53f1-9eb1-5a28d67b6763'::uuid, 1313.87, 850.42, 463.45),
      ('59e4d577-f866-533f-9ff6-0019612e84de'::uuid, 5463.81, 316.60, 5147.21),
      ('a8278c14-0c04-5452-bafd-37fd8d28a580'::uuid, 5597.33, 5459.63, 10.20),
      ('5366211c-9a9b-5f43-a30a-c8a590c078ed'::uuid, 1083.12, 937.16, 145.96),
      ('a2ec71b1-d1e3-5718-ae1c-d9e563a3efbb'::uuid, 16109.40, 16109.40, 0.00),
      ('e9286550-68ff-5f9c-9ffb-3e8b270e20ab'::uuid, 4108.58, 4065.58, 43.00),
      ('02b3ed5f-dd1f-5fc1-8e29-fe09739fd391'::uuid, 147.90, 147.90, 0.00),
      ('e2e6796e-c781-52fe-9cbf-35f4aed3be3a'::uuid, 7899.82, 8374.12, 0.00),
      ('34057382-dfa7-531c-809f-7ce04b44ce1e'::uuid, 2476.80, 2473.15, 3.65),
      ('b909cdef-8a3d-5a81-be6b-f36b586caa05'::uuid, 5233.51, 5233.51, 0.00),
      ('f4a56a07-9156-515f-964e-bf047314a3e2'::uuid, 63.75, 0.00, 0.00),
      ('9cde170b-024c-594d-8048-74074e37fbf3'::uuid, 434.13, 268.10, 166.03),
      ('eb338995-fe4b-55e3-a922-fa0bfdc0223a'::uuid, 477.79, 499.23, 0.00),
      ('f12d8be6-c19b-525c-bc0c-74f8a31ab3b5'::uuid, 753.10, 775.61, 0.00),
      ('bb09239c-46ef-54e6-bb58-a2f1ec574aa2'::uuid, 13138.82, 12910.95, 227.87),
      ('9b8a9bdf-e713-505d-b21e-d109396ab281'::uuid, 5067.02, 4667.36, 399.66),
      ('52159b59-08cf-5ffc-9329-0f29bf8afdb1'::uuid, 1146.16, 0.00, 184.02),
      ('16e05aa1-e979-5888-a753-ca700d52fa04'::uuid, 12172.83, 12172.83, 0.00),
      ('65e623cb-c7d2-5a94-9dd9-c69156741b24'::uuid, 63.75, 63.75, 0.00),
      ('120a97c4-34c0-5cad-afe2-130fd0d53954'::uuid, 982.09, 1121.57, 0.00),
      ('33fc1c8c-d323-551f-8f3f-2ae0436edf34'::uuid, 784.78, 784.78, 0.00),
      ('613dabd6-fb21-5fbd-aa11-4077646a04bf'::uuid, 17283.46, 0.00, 0.00),
      ('e87cfdd2-211f-5552-8967-6c5f07e1fc4b'::uuid, 760.33, 794.58, 0.00),
      ('0b9fa08b-7e4f-5d11-b6bc-8e6c9b2b25a1'::uuid, 181.70, 181.72, 0.00),
      ('9951074e-0a95-50cb-9db4-03455e556c03'::uuid, 66.31, 66.31, 0.00),
      ('f196d8a7-1a81-5bea-afa5-e588db85a233'::uuid, 5143.23, 3627.45, 0.00),
      ('9dd42586-6513-5b23-90cd-001ce3cf194e'::uuid, 1883.19, 1945.39, 0.00),
      ('75c84b89-9f10-55bc-97cf-e687f2ea76d1'::uuid, 132.62, 137.90, 0.00),
      ('dd7c2c00-c1db-53ad-a5cf-6f1955940898'::uuid, 575.02, 688.65, 0.00),
      ('0c47f039-ef8e-5fc5-b8a8-460e041df728'::uuid, 2817.96, 2137.61, 0.00),
      ('4c80ab60-3c86-5edc-b6a2-afd910276625'::uuid, 1225.85, 77.27, 0.00),
      ('aa40b0f7-9bd0-5ef7-9391-79013e7634a1'::uuid, 649.37, 678.40, 0.00),
      ('3d1e76b4-4241-59a8-9bb1-35f7b47c0875'::uuid, 9859.90, 9961.47, 0.00),
      ('ef750f3f-fe7a-5f21-9fea-e55ae306dfd3'::uuid, 4684.96, 4605.04, 0.00),
      ('12f446c0-0f32-5880-b4b7-6bea171c536b'::uuid, 147.34, 147.34, 0.00),
      ('49599558-0d2e-5b04-9906-1fb7a97c5162'::uuid, 457.16, 495.98, 0.00),
      ('cc38b364-5b5f-5998-b240-ca7410082106'::uuid, 3785.98, 4107.70, 0.00),
      ('c42600b1-2dbc-55e3-bfff-5bf7d75fa3bd'::uuid, 4052.13, 3905.36, 0.00),
      ('7f50ae64-580b-5763-b610-a0905aaa2e4f'::uuid, 1592.57, 1699.15, 0.00),
      ('96905c71-3e89-5ae0-8388-6f034636ccec'::uuid, 1700.55, 1740.46, 0.00),
      ('2e6cd6e4-574b-5888-8c91-c49ef88f34b2'::uuid, 828.31, 898.61, 0.00),
      ('204779c0-8ef7-5369-8bd2-0962357ab449'::uuid, 3031.48, 2356.16, 675.32),
      ('46691706-b4b1-512f-a20c-9cdde454e168'::uuid, 1048.04, 57.90, 0.00),
      ('dc1cb607-a165-5e55-99b8-608cd1942322'::uuid, 4706.86, 4174.89, 0.00),
      ('d04a35b3-bf19-5d14-b7f9-4f5c91525a0f'::uuid, 789.93, 657.72, 0.00),
      ('c1f3d2a0-664a-5b1e-bff0-6a7bf8d2e2e8'::uuid, 1624.94, 1706.69, 0.00),
      ('3c2ae92c-8e9b-5209-85d8-f317f9ee143f'::uuid, 1204.91, 1296.65, 0.00),
      ('848e2407-775f-565d-8344-ef94994cb7c6'::uuid, 2635.08, 2707.48, 0.00),
      ('eaf7d55a-0596-5a02-a9ea-8772acf3650f'::uuid, 117.36, 120.60, 0.00),
      ('90e844ba-b60a-590c-b978-426bf536f51a'::uuid, 273.16, 273.16, 0.00),
      ('72f6423d-a0e2-52b6-b806-a05df9f1dcac'::uuid, 674.80, 674.80, 0.00),
      ('600bf95a-e36e-5078-8acc-c7271b8edbe2'::uuid, 674.80, 674.80, 0.00),
      ('bfdcdfb4-dd53-5211-ae44-6b3ff1e018e9'::uuid, 1947.32, 2022.42, 0.00),
      ('88571ce4-4b60-5243-8d6d-051cfe5c3805'::uuid, 3949.60, 2678.82, 0.00),
      ('7465307b-ec49-511a-b7c1-26ba76de89b0'::uuid, 3759.06, 3838.55, 0.00),
      ('37da0817-5300-5619-805f-257b35e6b024'::uuid, 1554.64, 616.73, 0.00),
      ('5f591fc6-2a0a-5483-8342-b459b41ba5c6'::uuid, 2261.20, 2261.20, 0.00),
      ('9b28b531-6a1b-540e-a257-03ba040e82f4'::uuid, 989.23, 1028.75, 0.00),
      ('b60a4d05-3dbf-50ef-95d0-13e0e8de0b45'::uuid, 3637.67, 2932.69, 395.05),
      ('ecedb0e8-9aa4-5ddd-bc6e-1c700807260a'::uuid, 8904.29, 9223.30, 0.00),
      ('de002ae5-0e65-506e-91f1-7e34d8762a7a'::uuid, 11706.56, 11706.56, 0.00),
      ('0c88b53a-6496-52b4-8197-40dbfacaf957'::uuid, 5577.17, 5574.52, 0.00),
      ('78a5fd39-bb5d-5c14-a518-93513d3209f6'::uuid, 981.24, 488.21, 0.00),
      ('65ca2223-8f2a-5358-9a72-0c20a1383b28'::uuid, 3729.30, 3806.95, 0.00),
      ('65828bec-9138-5f08-a19c-537674affcbc'::uuid, 2880.04, 2792.38, 0.00),
      ('74bb30cc-dcbc-58d8-a6cb-ff28a2c3f418'::uuid, 781.26, 812.50, 0.00),
      ('c09b5e8f-45a2-521f-a745-19400ac65c06'::uuid, 409.04, 204.52, 204.52),
      ('03bcb648-4a2c-58fb-a94e-27d4c3c50acc'::uuid, 3527.71, 3527.71, 0.00),
      ('e52c15c9-c982-5cbc-bbad-9b7b63c076ed'::uuid, 9029.53, 8464.08, 565.45),
      ('85c2b760-da00-58d3-b471-f5e2529e2ee2'::uuid, 1374.21, 1067.60, 0.00),
      ('20a77b37-ce84-5af7-b05a-66a4ad13e529'::uuid, 2758.23, 2682.37, 75.86),
      ('e62de9f1-d067-5c96-9cee-c985067f42ec'::uuid, 3199.28, 2871.06, 195.43),
      ('151a1781-0b6f-5da8-a746-c11c210a7dc1'::uuid, 21502.10, 0.00, 0.00),
      ('76034b2f-40ca-5d76-adaf-b9bf30efa359'::uuid, 15316.15, 11702.54, 3613.61),
      ('56314685-bfaf-5e9c-a875-caeac6bf0f90'::uuid, 18071.82, 18071.82, 0.00),
      ('860c1a62-326f-5657-94c3-908eb45714f7'::uuid, 676.20, 351.42, 0.00),
      ('0994b648-3d91-5c33-8f88-07579bc905bf'::uuid, 8680.06, 7183.09, 0.00),
      ('647fe66a-7267-5f4b-89c2-8ae2852075c0'::uuid, 10707.92, 0.00, 0.00),
      ('60f14123-25d7-512d-9534-b5ebe3e0acd7'::uuid, 8185.99, 7902.46, 0.00),
      ('d5aab073-52aa-5403-b0a6-fddcac2b8b2e'::uuid, 8263.22, 7601.65, 661.57),
      ('e22504af-6476-5078-a1f8-adce9a86ee9d'::uuid, 1323.89, 0.00, 0.00),
      ('7d34b385-8b2e-5752-b181-519074fe04d2'::uuid, 35028.04, 34980.73, 0.00),
      ('5c78f884-dde2-5a97-b82e-a9e5134c29a7'::uuid, 3681.91, 3634.60, 0.00),
      ('5961429a-83c2-52d6-8e97-10c2438cdb6f'::uuid, 10244.11, 10244.11, 0.00),
      ('a8ce3ba6-1e99-59c9-bc24-4845bede42c0'::uuid, 27116.17, 26432.56, 683.61),
      ('0832a715-b9a7-5678-99a6-799e4b234fd7'::uuid, 24147.03, 23919.16, 227.87),
      ('e5fab097-84bc-536d-9672-c50701615208'::uuid, 18991.18, 18763.31, 227.87),
      ('060407b8-5afd-560f-b46e-4722febc715b'::uuid, 16987.71, 16759.84, 227.87),
      ('d23fb864-16cc-5e52-ab14-a514ef82ae4f'::uuid, 381.66, 381.65, 0.01),
      ('6361aea0-f704-5609-8768-3b6b4f4f99a8'::uuid, 5427.03, 4971.29, 455.74),
      ('6d270c00-6247-5fa0-96e9-8f8b8a99dd1c'::uuid, 4821.94, 4364.38, 457.56),
      ('94adce4e-f6d3-560c-aa9e-a9706fea900f'::uuid, 7659.46, 6954.46, 705.00),
      ('5b55fe1b-57bf-593f-932d-02952ee7f53b'::uuid, 703.52, 0.00, 703.52),
      ('77dde167-d8c3-5bae-8e38-76e36d81fd48'::uuid, 14769.22, 14769.21, 0.01),
      ('5aaa0af7-9699-5f8c-9c55-cca66cfb6082'::uuid, 14096.00, 13799.79, 296.21),
      ('9a60a91e-9634-56b1-b36c-40cb3bb0cef7'::uuid, 11265.31, 10709.08, 556.23),
      ('2f217e05-ee9e-54ca-b89a-22e885a73718'::uuid, 692.68, 678.84, 13.84),
      ('e0ea3eb3-cca4-53fd-8cbe-13169cc2db59'::uuid, 18303.42, 17937.20, 366.22),
      ('cf7e5f16-e92a-5a34-a45d-adbe303332e1'::uuid, 16947.51, 16377.07, 570.44),
      ('9c513cd9-9ad1-59e9-a491-4615daf0b2cd'::uuid, 16900.23, 16562.10, 338.13),
      ('e46d8507-b9e9-5429-a3e2-2fc5faab1ed5'::uuid, 4490.19, 4144.44, 109.67),
      ('32424e4f-a836-5f1f-827b-716aad24dd8d'::uuid, 2232.23, 2187.45, 44.78),
      ('182ff25f-e912-5022-8098-7b373bfaea46'::uuid, 23510.53, 22496.78, 459.31),
      ('cdb546d6-c95e-50d5-8398-aebabfe3bd63'::uuid, 1751.25, 1716.25, 35.00),
      ('bea42edd-9196-5577-87df-6e7e411d12e8'::uuid, 2561.55, 2510.31, 51.24),
      ('5269c203-1c7b-5757-b8fd-400a4a7bc824'::uuid, 9077.00, 8895.20, 181.80),
      ('de08ceab-5553-5bda-9290-0993f713d306'::uuid, 1985.98, 1388.97, 189.31),
      ('21c5e4e0-bfb2-5062-aee9-0f466f6a7f93'::uuid, 8561.51, 8390.20, 171.31),
      ('1a741c07-944f-561d-997e-4902c3a1a525'::uuid, 11074.28, 10852.49, 221.79),
      ('d759d00e-90ac-5f02-b7b2-aa3613e05a42'::uuid, 11932.92, 11694.10, 238.82),
      ('585003fa-6f4a-5602-8988-42c9ace534ca'::uuid, 2097.90, 2080.70, 17.20),
      ('cef25854-2c77-56e2-9068-2be687be6688'::uuid, 10527.10, 9342.38, 11.25),
      ('8620ba2e-6217-5eaf-97c3-85ea77208cc7'::uuid, 2574.80, 2285.59, 289.21),
      ('3932efd1-f472-5344-9c64-a14c7928795a'::uuid, 10823.55, 9328.00, 110.33),
      ('ca81a6de-338c-5341-8170-eae3ae18836d'::uuid, 10996.25, 8257.17, 99.80),
      ('247f3ec4-3044-5179-9c6f-55d9d92b6105'::uuid, 1749.75, 1330.36, 0.00),
      ('df860f03-b303-5d8a-94d0-8f56e2b7f593'::uuid, 1079.70, 453.88, 625.82),
      ('3dc5940c-69a5-5519-b1ee-1cb18daf9688'::uuid, 636.87, 372.15, 176.48),
      ('fa41830c-560b-54c5-b452-96bd0225612a'::uuid, 747.97, 289.21, 0.00),
      ('8552722e-ccf2-5506-8727-45a4a0147b67'::uuid, 1675.27, 1463.95, 211.32),
      ('fe229e92-dd1d-5426-b6af-4ae8fea1c777'::uuid, 17148.53, 16646.69, 501.84),
      ('ed8261fc-aabe-5d62-9a6f-7d21b35d61cb'::uuid, 4574.20, 4239.64, 334.56),
      ('404a92c9-1288-59cd-bf42-acb10ee82f46'::uuid, 2874.44, 729.94, 692.31),
      ('c3aeff87-0580-51f3-bde4-192e80d715ed'::uuid, 4797.37, 4362.53, 434.84)
    ) AS e(id, valor, recebido, glosado)
    LEFT JOIN notas n ON n.id_nota = e.id
   WHERE n.id_nota IS NULL
      OR n.valor_total <> e.valor
      OR n.valor_recebido <> e.recebido
      OR n.valor_glosado <> e.glosado;
  IF v_errados IS NOT NULL THEN
    RAISE EXCEPTION 'Acerto pelo apLIS: títulos fora do esperado (os dados mudaram desde a geração?): %', v_errados;
  END IF;
END $$;

COMMIT;
