-- Prévia de 20261026120000_fat_saldo_glosa_acatada.sql — SOMENTE LEITURA.
--
-- Rode ANTES da migration, no banco onde ela vai ser aplicada (a foto de
-- Glosas e Recursos precisa estar sincronizada). Compara, título a título:
--
--   saldo antigo = notas.valor_saldo  (total − recebido − glosa definitiva da tabela `glosas`)
--   saldo novo   = total − recebido − glosa acatada da foto (status 18 e 8, líquido − recebido)
--
-- e o status que cada regra dá. Duas consultas: o resumo e as 50 maiores
-- diferenças, para anexar à issue 13 (.scratch/glosas-recursos-dashboard/issues/).
-- A view temporária some ao fim da sessão.

CREATE TEMP VIEW fat_saldo_previa AS
WITH acatada AS (
  SELECT nl.id_nota, SUM(r.liquido - r.recebido) AS valor
    FROM (SELECT DISTINCT nl.id_nota, l.aplis_id
            FROM nota_lote nl
            JOIN lotes l ON l.id_lote = nl.id_lote
           WHERE l.aplis_id IS NOT NULL) nl
    JOIN glosa_recurso_requisicoes r ON r.id_lote_faturamento::TEXT = nl.aplis_id
   WHERE r.status_aplis IN (18, 8)
   GROUP BY nl.id_nota
),
comparacao AS (
  SELECT n.id_nota,
         n.numero_nota,
         o.nome                                                         AS operadora,
         n.status                                                       AS status_antigo,
         COALESCE(n.valor_total, 0)                                     AS total,
         COALESCE(n.valor_recebido, 0)                                  AS recebido,
         COALESCE(n.valor_glosado_definitivo, 0)                        AS glosa_definitiva,
         COALESCE(a.valor, 0)                                           AS glosa_acatada,
         n.valor_saldo                                                  AS saldo_antigo,
         COALESCE(n.valor_total, 0) - COALESCE(n.valor_recebido, 0) - COALESCE(a.valor, 0) AS saldo_novo
    FROM notas n
    LEFT JOIN operadoras o ON o.id_operadora = n.operadora_id
    LEFT JOIN acatada a ON a.id_nota = n.id_nota
)
SELECT c.*,
       saldo_novo - saldo_antigo AS diferenca,
       CASE
           WHEN status_antigo = 'cancelada'                      THEN 'cancelada'
           WHEN total > 0 AND recebido >= total                  THEN 'recebida'
           WHEN total > 0 AND recebido + glosa_acatada >= total  THEN 'liquidada'
           WHEN recebido > 0                                     THEN 'parcialmente_recebida'
           WHEN glosa_acatada > 0                                THEN 'glosada'
           ELSE                                                       'aberta'
         END AS status_novo
  FROM comparacao c;

-- Resumo
SELECT COUNT(*) FILTER (WHERE diferenca <> 0)                     AS titulos_com_saldo_diferente,
       COUNT(*) FILTER (WHERE status_novo <> status_antigo)       AS titulos_com_status_diferente,
       SUM(diferenca) FILTER (WHERE status_antigo <> 'cancelada') AS diferenca_total_saldo,
       SUM(glosa_definitiva)                                      AS glosa_definitiva_que_sai,
       SUM(glosa_acatada)                                         AS glosa_acatada_que_entra
  FROM fat_saldo_previa;

-- As 50 maiores diferenças
SELECT numero_nota, operadora, status_antigo, status_novo, total, recebido,
       glosa_definitiva, glosa_acatada, saldo_antigo, saldo_novo, diferenca
  FROM fat_saldo_previa
 WHERE diferenca <> 0 OR status_novo <> status_antigo
 ORDER BY ABS(diferenca) DESC, numero_nota
 LIMIT 50;
