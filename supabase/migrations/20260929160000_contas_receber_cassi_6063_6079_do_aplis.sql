-- ============================================================================
-- Contas a Receber: baixa e glosa dos lotes CASSI 6063 e 6079 alinhadas ao apLIS
--
-- Os dois títulos vieram do backfill Jan–Jun (20260929140500, aba JUNHO da
-- planilha do setor) e são os únicos da CASSI de junho que divergem do apLIS
-- (fatrequisicaoprocedimento, conferido em 29/09). O apLIS é a fonte da verdade:
--
--   6063 — planilha: recebido 17.360,08 em 15/07, glosa 1.367,22.
--          apLIS: recebido 16.852,93 em 14/07, glosa 1.874,37 em 6 guias:
--            5 × 227,87 "NÃO AUTORIZADO PELA AUDITORIA" (1426) — os 1.367,22
--              que a planilha tinha;
--            507,15 "VALOR APRESENTADO A MAIOR" (1705), requisição 187611,
--              glosa total — a planilha contou esse valor como recebido.
--          (O lote 6124, também R$ 507,15, é outra requisição: não é recobro.)
--   6079 — planilha: sem valor recebido (ficou "Aberta", 73 dias em atraso).
--          apLIS: recebido 1.558,40 em 14/07, sem glosa.
--
-- Atualiza o recebimento que o backfill criou (não cria outro) e troca a glosa
-- agregada da planilha pelas glosas por guia do apLIS, ligadas à baixa, à guia
-- e ao lote, como a tela de baixa grava. Status do título: trigger
-- fat_recalcular_nota (6063 fica parcialmente_recebida com glosa aberta e saldo
-- 0; 6079 fica recebida).
--
-- Só corrige se os dois títulos ainda estiverem como o backfill deixou; se
-- alguém já mexeu pela tela, falha sem alterar nada.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Pré-condição: estado exato do backfill.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM recebimentos
     WHERE id_receb = '4d508ff6-4fb3-4e72-b76b-32dd268f1292'
       AND nota_id = '8be25eb0-1a99-5c5a-99dc-12b92c21f153'
       AND status = 'parcial' AND valor_recebido = 17360.08
  ) OR (SELECT COUNT(*) FROM recebimentos WHERE nota_id = '8be25eb0-1a99-5c5a-99dc-12b92c21f153') <> 1
    OR (SELECT COUNT(*) FROM glosas WHERE nota_id = '8be25eb0-1a99-5c5a-99dc-12b92c21f153') <> 1
    OR NOT EXISTS (SELECT 1 FROM glosas WHERE id_glosa = 'd5061e6e-8905-4c12-9c45-6af862649ddf' AND valor = 1367.22)
  THEN
    RAISE EXCEPTION 'Título do lote 6063 não está mais como o backfill deixou; corrigir à mão.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recebimentos
     WHERE id_receb = '38e85ee4-ff83-4f3c-bade-499554aa95c8'
       AND nota_id = '732e8a79-403f-59a1-a3b4-9b0e9dd067b9'
       AND status = 'previsto' AND valor_recebido = 0
  ) OR (SELECT COUNT(*) FROM recebimentos WHERE nota_id = '732e8a79-403f-59a1-a3b4-9b0e9dd067b9') <> 1
    OR EXISTS (SELECT 1 FROM glosas WHERE nota_id = '732e8a79-403f-59a1-a3b4-9b0e9dd067b9')
  THEN
    RAISE EXCEPTION 'Título do lote 6079 não está mais como o backfill deixou; corrigir à mão.';
  END IF;

  IF (SELECT COUNT(*) FROM requisicoes
       WHERE lote_id = '5f458342-1d4c-597e-8227-9e1bf2426865'
         AND aplis_id IN ('184623', '186675', '187611', '188322', '188372', '191543')) <> 6 THEN
    RAISE EXCEPTION 'Guias glosadas do lote 6063 não encontradas em requisicoes.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) 6063: recebido e data do apLIS; glosas por guia no lugar da agregada.
-- ----------------------------------------------------------------------------
UPDATE recebimentos
   SET valor_recebido = 16852.93,
       data_receb     = DATE '2026-07-14',
       observacoes    = 'Backfill planilha Jan-Jun/2026 — recebido e data corrigidos pelo apLIS em 29/09 (planilha: 17.360,08 em 15/07)'
 WHERE id_receb = '4d508ff6-4fb3-4e72-b76b-32dd268f1292';

DELETE FROM glosas WHERE id_glosa = 'd5061e6e-8905-4c12-9c45-6af862649ddf';

INSERT INTO glosas (recebimento_id, nota_id, requisicao_id, lote_id, valor, motivo, codigo_glosa, status, responsavel)
SELECT '4d508ff6-4fb3-4e72-b76b-32dd268f1292',
       '8be25eb0-1a99-5c5a-99dc-12b92c21f153',
       r.id_requisicao,
       '5f458342-1d4c-597e-8227-9e1bf2426865',
       g.valor, g.motivo, g.codigo, 'aberta', 'Renata'
  FROM (VALUES
    ('184623', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426'),
    ('186675', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426'),
    ('187611', 507.15, 'VALOR APRESENTADO A MAIOR',     '1705'),
    ('188322', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426'),
    ('188372', 227.87, 'NÃO AUTORIZADO PELA AUDITORIA', '1426'),
    ('191543', 455.74, 'NÃO AUTORIZADO PELA AUDITORIA', '1426')
  ) AS g(aplis_id, valor, motivo, codigo)
  JOIN requisicoes r
    ON r.aplis_id = g.aplis_id
   AND r.lote_id = '5f458342-1d4c-597e-8227-9e1bf2426865';

-- ----------------------------------------------------------------------------
-- 2) 6079: o previsto vira baixa integral, na data do apLIS.
-- ----------------------------------------------------------------------------
UPDATE recebimentos
   SET status         = 'recebido',
       valor_recebido = 1558.40,
       data_receb     = DATE '2026-07-14',
       observacoes    = 'Backfill planilha Jan-Jun/2026 — baixa pelo apLIS em 29/09 (planilha sem valor recebido)'
 WHERE id_receb = '38e85ee4-ff83-4f3c-bade-499554aa95c8';

-- ----------------------------------------------------------------------------
-- 3) Conferência: os dois títulos batem com o apLIS.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notas WHERE id_nota = '8be25eb0-1a99-5c5a-99dc-12b92c21f153'
                  AND valor_recebido = 16852.93 AND valor_glosado = 1874.37 AND valor_saldo = 0) THEN
    RAISE EXCEPTION 'Título do lote 6063 não fechou com o apLIS após a correção.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notas WHERE id_nota = '732e8a79-403f-59a1-a3b4-9b0e9dd067b9'
                  AND valor_recebido = 1558.40 AND status = 'recebida') THEN
    RAISE EXCEPTION 'Título do lote 6079 não fechou com o apLIS após a correção.';
  END IF;
END $$;

COMMIT;
