-- api/_lib/qualidade/cortesiasRegras.ts (R1) já produz 'nao_autorizada' para
-- cortesias sem autorização com o prazo vencido (timeout), mas o check
-- constraint criado em 20260820120000_qualidade_piloto.sql ainda só
-- permitia ('dentro_prazo', 'fora_prazo', 'sem_autorizacao') — todo upsert
-- de sync-cortesias.ts com esse estado falhava com 23514 (500 na API).
ALTER TABLE qa_cortesias DROP CONSTRAINT qa_cortesias_situacao_prazo_check;

ALTER TABLE qa_cortesias
  ADD CONSTRAINT qa_cortesias_situacao_prazo_check
  CHECK (situacao_prazo IN ('dentro_prazo', 'fora_prazo', 'sem_autorizacao', 'nao_autorizada'));
