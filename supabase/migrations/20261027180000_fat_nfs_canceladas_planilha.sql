-- ============================================================================
-- Contas a Receber: NFs canceladas da planilha "CONTROLE DE EMISSÃO DE NOTAS"
--
-- Gerada por supabase/scripts/importar-nfs-canceladas-planilha.ts com a aba
-- "NF CANCELADAS FORA APLIS", o Supabase de produção e o apLIS (backup MySQL) lidos
-- em 27/10/2026. Issue 04 de .scratch/faturamento-nf-cancelada; o relatório
-- (o que foi ligado a um título, o que não foi e por quê) está em
-- .scratch/faturamento-nf-cancelada/relatorio-importacao-planilha.md.
--
-- 11 NFs, origem 'planilha', 0 ligadas ao título que as
-- substituiu e 11 só à operadora. Motivo, valor e emissão vêm da planilha;
-- a data do cancelamento é a emissão do título substituto ou, sem título, a da NF.
--
-- Precisa de 20261027170000_fat_nf_canceladas.sql. Entra uma vez só: rodar de
-- novo esbarra na chave (operadora, número) e desfaz tudo. Os ids são de
-- produção: no projeto de teste os INSERT falham na FK. Tudo numa transação;
-- qualquer divergência na conferência desfaz tudo.
-- ============================================================================

BEGIN;

-- NF 7724 — E-VIDA, R$ 48,37, emitida em 30/03/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, 'cb7af37b-183b-42fb-aed2-09a6b1b0a6ad', '7724', 48.37, DATE '2026-03-30', DATE '2026-03-30', 'Emitda com a retenção do CONFINS errada', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7496 — SIS, R$ 6.941,85, emitida em 04/03/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '0946028d-a13a-4979-b49c-9c59b1206ce3', '7496', 6941.85, DATE '2026-03-04', DATE '2026-03-04', '7466 - Emitida para o SIS, quando era pra ser FASCAL', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7495 — SIS, R$ 96,24, emitida em 05/03/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '0946028d-a13a-4979-b49c-9c59b1206ce3', '7495', 96.24, DATE '2026-03-05', DATE '2026-03-05', '7495 - Emitida para o SIS, quando era pra ser FASCAL', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7498 — SIS, R$ 5.348,65, emitida em 05/03/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '0946028d-a13a-4979-b49c-9c59b1206ce3', '7498', 5348.65, DATE '2026-03-05', DATE '2026-03-05', '7498 - Emitida para o SIS, quando era pra ser FASCAL', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7504 — PLAN ASSISTE, R$ 37.956,81, emitida em 09/03/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '3d3d8d16-4a65-4581-b7d2-a4413e016739', '7504', 37956.81, DATE '2026-03-09', DATE '2026-03-09', '7504 - Emitida para o PLAN ASSISTE, quando era pra ser PLAN ASSISTE-MPU', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7831 — GEAP, R$ 10.535,86, emitida em 16/04/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '45a9f207-b8f0-4004-9ba8-f05e094bb068', '7831', 10535.86, DATE '2026-04-16', DATE '2026-04-16', 'Geap solicitou cancelamento, pois não estará no mapa paga pgto. eamail 16/04', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7914 — TJDFT, R$ 18.852,91, emitida em 23/04/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, '7541a30b-92d5-4d3e-9db3-4afafa9e4a3d', '7914', 18852.91, DATE '2026-04-23', DATE '2026-04-23', ' Foi emitida com valor Bruto errado. Valor correto: R$ 18.852,97.', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7996 — TRT, R$ 940,98, emitida em 07/05/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, 'f4051fbc-7e2c-4252-978f-4a5a8b6147d5', '7996', 940.98, DATE '2026-05-07', DATE '2026-05-07', 'Foi emitida com valor menor', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7787 — STF MED, R$ 6.867,86, emitida em 11/05/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, 'a3a18aae-4eaf-42b1-b3ae-9d2bd5c4e34d', '7787', 6867.86, DATE '2026-05-11', DATE '2026-05-11', 'Solicitação do conênio va email, devido terem solicitado com peg de ano diferente', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7793 — BRADESCO, R$ 20.954,24, emitida em 15/04/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, 'f43f7193-9701-4c3f-868c-5d6578e6ca26', '7793', 20954.24, DATE '2026-04-15', DATE '2026-04-15', 'emitida errada no campo de descrição.', 'planilha', 'Importação da planilha (27/10/2026)');

-- NF 7990 — BRADESCO OPERADORA, R$ 6.582,79, emitida em 05/05/2026 → sem título
INSERT INTO fat_nfs_canceladas (nota_id, operadora_id, numero_nota, valor, data_emissao, data_cancelamento, motivo, origem, registrado_por_nome)
VALUES (NULL, 'f43f7193-9701-4c3f-868c-5d6578e6ca26', '7990', 6582.79, DATE '2026-05-05', DATE '2026-05-05', 'emitida com a competência errada', 'planilha', 'Importação da planilha (27/10/2026)');

-- Conferência: as 11 NFs entraram, cada uma com a operadora e o título
-- esperados, e nenhum número se repete na mesma operadora.
DO $$
DECLARE
  v_faltando TEXT;
  v_repetidos TEXT;
  v_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM fat_nfs_canceladas
   WHERE origem = 'planilha' AND numero_nota IN ('7724', '7496', '7495', '7498', '7504', '7831', '7914', '7996', '7787', '7793', '7990');
  IF v_total <> 11 THEN
    RAISE EXCEPTION 'Importação da planilha: % NFs canceladas da planilha, esperadas 11', v_total;
  END IF;

  SELECT string_agg(e.numero, ', ')
    INTO v_faltando
    FROM (VALUES
      ('cb7af37b-183b-42fb-aed2-09a6b1b0a6ad'::uuid, '7724', NULL::uuid),
      ('0946028d-a13a-4979-b49c-9c59b1206ce3'::uuid, '7496', NULL::uuid),
      ('0946028d-a13a-4979-b49c-9c59b1206ce3'::uuid, '7495', NULL::uuid),
      ('0946028d-a13a-4979-b49c-9c59b1206ce3'::uuid, '7498', NULL::uuid),
      ('3d3d8d16-4a65-4581-b7d2-a4413e016739'::uuid, '7504', NULL::uuid),
      ('45a9f207-b8f0-4004-9ba8-f05e094bb068'::uuid, '7831', NULL::uuid),
      ('7541a30b-92d5-4d3e-9db3-4afafa9e4a3d'::uuid, '7914', NULL::uuid),
      ('f4051fbc-7e2c-4252-978f-4a5a8b6147d5'::uuid, '7996', NULL::uuid),
      ('a3a18aae-4eaf-42b1-b3ae-9d2bd5c4e34d'::uuid, '7787', NULL::uuid),
      ('f43f7193-9701-4c3f-868c-5d6578e6ca26'::uuid, '7793', NULL::uuid),
      ('f43f7193-9701-4c3f-868c-5d6578e6ca26'::uuid, '7990', NULL::uuid)
    ) AS e(operadora_id, numero, nota_id)
    LEFT JOIN fat_nfs_canceladas c
      ON c.operadora_id = e.operadora_id AND c.numero_nota = e.numero AND c.origem = 'planilha'
   WHERE c.id IS NULL
      OR c.nota_id IS DISTINCT FROM e.nota_id;
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Importação da planilha: NFs canceladas fora do esperado: %', v_faltando;
  END IF;

  SELECT string_agg(numero_nota, ', ')
    INTO v_repetidos
    FROM (SELECT numero_nota FROM fat_nfs_canceladas GROUP BY operadora_id, numero_nota HAVING COUNT(*) > 1) r;
  IF v_repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Importação da planilha: número de NF cancelada repetido na operadora: %', v_repetidos;
  END IF;
END $$;

COMMIT;
