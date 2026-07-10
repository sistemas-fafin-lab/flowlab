-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A: renomeia a etapa final da trilha de cultura.
--   "Pronta p/ laudo" → "Laudo concluído".
-- O seed original (20260709131000) usa ON CONFLICT (ordem) DO NOTHING, então ele NÃO
-- atualiza linhas já semeadas — este UPDATE corrige os bancos existentes. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE ac_cultura_etapas
   SET nome = 'Laudo concluído'
 WHERE ordem = 3
   AND nome = 'Pronta p/ laudo';
