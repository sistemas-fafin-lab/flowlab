-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — Registro de Câncer
-- Migration: 20260821090000_qualidade_registrar_exportacao_rhc_fn.sql
--
-- Achado de code review em api/_lib/handlers/qualidade-gerar-exportacao-cancer.ts:
-- o handler gravava `qa_exportacoes_rhc` (INSERT) e depois vinculava os casos
-- exportados (`qa_cancer_casos.exportacao_id`, UPDATE) em duas chamadas
-- separadas ao Supabase. Se o UPDATE falhasse depois do INSERT ter sucesso,
-- ficava uma exportação "órfã": arquivo já no Storage, linha já gravada em
-- `qa_exportacoes_rhc`, mas os casos continuavam elegíveis — uma nova
-- tentativa gerava um SEGUNDO CSV e uma segunda linha para os mesmos
-- pacientes (risco de envio duplicado ao RHC, que é um relatório de
-- vigilância em saúde do governo).
--
-- Esta função faz as duas escritas dentro de uma única invocação — Postgres
-- desfaz as duas automaticamente se qualquer uma falhar, sem precisar de
-- transação explícita no cliente (supabase-js não suporta multi-statement
-- transacional). Só o service_role (o único client que os handlers de
-- Qualidade usam para esta ação) pode chamá-la.
--
-- Achado adicional (2026-08-21, depurado com acesso real ao banco): a
-- primeira versão desta função foi aplicada manualmente no SQL Editor sem o
-- parâmetro `storage_path` — `qa_exportacoes_rhc.storage_path` é NOT NULL
-- (schema pré-existente, fora do histórico deste repo), então TODA chamada
-- falhava com "null value in column storage_path violates not-null
-- constraint" depois do CSV já ter subido ao Storage (500 em
-- gerar-exportacao-cancer.ts). `p_storage_path` foi adicionado ao parâmetro
-- e ao INSERT abaixo; `qualidade-gerar-exportacao-cancer.ts` foi atualizado
-- para passar `caminhoArquivo`. Reaplicar este arquivo no SQL Editor
-- (CREATE OR REPLACE substitui a versão quebrada já publicada).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION qualidade_registrar_exportacao_rhc(
  p_id uuid,
  p_ano integer,
  p_trimestre integer,
  p_storage_path text,
  p_hash_arquivo text,
  p_total_casos integer,
  p_registrador text,
  p_gerado_por uuid,
  p_gerado_em timestamptz,
  p_caso_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO qa_exportacoes_rhc (id, ano, trimestre, storage_path, hash_arquivo, total_casos, registrador, gerado_por, gerado_em)
  VALUES (p_id, p_ano, p_trimestre, p_storage_path, p_hash_arquivo, p_total_casos, p_registrador, p_gerado_por, p_gerado_em);

  UPDATE qa_cancer_casos
     SET exportacao_id = p_id
   WHERE id = ANY(p_caso_ids);
END;
$$;

DROP FUNCTION IF EXISTS qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, integer, text, uuid, timestamptz, uuid[]);

REVOKE ALL ON FUNCTION qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, text, integer, text, uuid, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, text, integer, text, uuid, timestamptz, uuid[]) TO service_role;

COMMIT;
