-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Riscos: correlação N:N com Ocorrências
-- (.scratch/qualidade-riscos-indicadores/issues/05-riscos-correlacao-ocorrencias.md)
--
-- Mecanismo SEPARADO do vínculo de origem 1:N (`qa_riscos.ocorrencia_origem_id`,
-- 20260831170000_qualidade_riscos_schema.sql, issue 01): a origem responde
-- "de onde este risco nasceu" (imutável, nunca editada depois de criada); esta
-- tabela responde "quais ocorrências se relacionam com este risco hoje"
-- (livre, editável a qualquer momento). Remover uma linha daqui nunca toca
-- `ocorrencia_origem_id`, e vice-versa — os dois convivem sem se sobrescrever
-- (o frontend mescla os dois na leitura, sem duplicar — ver
-- domain/riscosCorrelacao.ts).
--
-- Depende de 20260831170000 (qa_riscos, qa_riscos_modulo_auditoria_trigger) e
-- de qa_ocorrencias (piloto original). Reaproveita
-- `qa_riscos_modulo_auditoria_trigger` em vez de duplicá-la — já é genérica
-- por TG_TABLE_NAME/TG_OP e cobre INSERT/DELETE sem precisar de função nova
-- (diferente de 20260831190000_qualidade_riscos_contingencia.sql, que
-- duplicou a função de propósito para não criar dependência de migration
-- entre módulos independentes; aqui a dependência com o schema de risco já
-- existe, via "Blocked by: 01, 02" da issue).
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. qa_riscos_ocorrencias ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_riscos_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id uuid NOT NULL REFERENCES qa_riscos(id) ON DELETE CASCADE,
  ocorrencia_id uuid NOT NULL REFERENCES qa_ocorrencias(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES user_profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_riscos_ocorrencias_unique UNIQUE (risco_id, ocorrencia_id)
);

CREATE INDEX IF NOT EXISTS idx_qa_riscos_ocorrencias_risco_id ON qa_riscos_ocorrencias(risco_id);
CREATE INDEX IF NOT EXISTS idx_qa_riscos_ocorrencias_ocorrencia_id ON qa_riscos_ocorrencias(ocorrencia_id);

COMMENT ON TABLE qa_riscos_ocorrencias IS 'Correlação N:N livre entre riscos e ocorrências — distinta de qa_riscos.ocorrencia_origem_id (origem 1:N, imutável). Um risco pode se relacionar com várias ocorrências e vice-versa; o vínculo pode ser criado/removido a qualquer momento por quem tem canManageQualidade.';

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
-- Sem policy de UPDATE: o vínculo não tem estado próprio para editar — só
-- existe (criado) ou não existe mais (removido).

ALTER TABLE qa_riscos_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_riscos_ocorrencias_select ON qa_riscos_ocorrencias;
CREATE POLICY "qa_riscos_ocorrencias_select" ON qa_riscos_ocorrencias
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_riscos_ocorrencias_insert ON qa_riscos_ocorrencias;
CREATE POLICY "qa_riscos_ocorrencias_insert" ON qa_riscos_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_riscos_ocorrencias_delete ON qa_riscos_ocorrencias;
CREATE POLICY "qa_riscos_ocorrencias_delete" ON qa_riscos_ocorrencias
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'));

-- ─── 3. Auditoria — reaproveita o trigger genérico de 20260831170000 ───────

DROP TRIGGER IF EXISTS trg_qa_riscos_ocorrencias_auditoria ON qa_riscos_ocorrencias;
CREATE TRIGGER trg_qa_riscos_ocorrencias_auditoria
  AFTER INSERT OR DELETE ON qa_riscos_ocorrencias
  FOR EACH ROW
  EXECUTE FUNCTION qa_riscos_modulo_auditoria_trigger();

COMMIT;
