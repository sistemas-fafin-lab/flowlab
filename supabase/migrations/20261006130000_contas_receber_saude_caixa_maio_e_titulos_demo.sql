-- ============================================================================
-- Contas a Receber: duas correções da auditoria de emissão de 06/10
-- (lista completa em .scratch/faturamento-emissao-auditoria/titulos-divergentes.csv).
--
-- 1. SAUDE CAIXA 5864, 5865, 5866 e 5876 estão na aba MAIO da planilha do Q2,
--    mas com "Data Faturamento" em junho (25 e 26/06) — erro de digitação: no
--    apLIS os quatro fecharam e foram enviados em 25 e 26/05. A emissão passa a
--    ser o fechamento do lote (a competência já era 2026-05; o dashboard filtra
--    pela emissão: -R$ 20.048,30 em junho, +R$ 20.048,30 em maio).
--
-- 2. Remove os 5 títulos de demonstração (NF-2026-001234 a 001238, criados em
--    27/03 junto com o módulo, operadoras Unimed Regional, Bradesco Saúde, Amil
--    e SulAmérica). Não existem no apLIS e somavam R$ 190.081,25 no faturado
--    de jan a mar. Não têm lote, recebimento nem glosa vinculados.
--    Os lotes LOT-2026-001..004 (e suas requisições), também de demonstração,
--    ficam: não entram no dashboard e não estão em título nenhum.
--
-- Só toca linha que ainda está como conferida em 06/10.
-- ============================================================================

BEGIN;

UPDATE notas n
   SET data_emissao = v.emissao_nova,
       competencia  = '2026-05',
       updated_at   = NOW()
  FROM (VALUES
         ('5864', DATE '2026-06-25', DATE '2026-05-25'),
         ('5865', DATE '2026-06-25', DATE '2026-05-25'),
         ('5866', DATE '2026-06-25', DATE '2026-05-25'),
         ('5876', DATE '2026-06-26', DATE '2026-05-26')
       ) AS v(codigo_lote, emissao_atual, emissao_nova)
  JOIN lotes l     ON l.codigo_lote = v.codigo_lote
  JOIN nota_lote nl ON nl.id_lote = l.id_lote
 WHERE n.id_nota = nl.id_nota
   AND n.data_emissao = v.emissao_atual;

DELETE FROM notas n
 WHERE n.id_nota IN (
         'ffdf4347-dc48-4107-a0a4-c0c13547c7d9',  -- NF-2026-001234 Unimed Regional
         '45867166-827f-4fa7-b904-b3a52feef2ba',  -- NF-2026-001235 Unimed Regional
         '36320436-37b9-4fbf-b44a-af696fe434f0',  -- NF-2026-001236 Bradesco Saúde
         '08bda8d5-44c5-4be8-b079-bde30b45819f',  -- NF-2026-001237 Amil
         'ac8ba0cb-3aa9-45b8-b111-35747ca451f2'   -- NF-2026-001238 SulAmérica
       )
   AND n.numero_nota LIKE 'NF-2026-00123_'
   AND NOT EXISTS (SELECT 1 FROM nota_lote nl    WHERE nl.id_nota = n.id_nota)
   AND NOT EXISTS (SELECT 1 FROM recebimentos r  WHERE r.nota_id  = n.id_nota)
   AND NOT EXISTS (SELECT 1 FROM glosas g        WHERE g.nota_id  = n.id_nota);

COMMIT;
