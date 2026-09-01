-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Riscos: dashboard, mapa por setor e alertas
-- (.scratch/qualidade-riscos-indicadores/issues/04-riscos-dashboard-mapa-alertas.md)
--
-- Único parâmetro novo que esta issue precisa: a janela (em dias) do alerta
-- "contingência com teste a vencer" — configurável (`qa_parametros`), nunca
-- fixa no código, mesmo mecanismo de `riscos.faixas_classificacao`
-- (20260831170000_qualidade_riscos_schema.sql). A policy de leitura de
-- `qa_parametros` para `riscos.%` já existe (mesma migration), então não há
-- policy nova aqui.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO qa_parametros (modulo, chave, valor)
VALUES ('riscos', 'riscos.dias_alerta_contingencia', '20'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Dashboard e mapa por setor filtram/agregam por setor_id o tempo todo.
CREATE INDEX IF NOT EXISTS idx_qa_riscos_setor_id ON qa_riscos(setor_id);

COMMIT;
