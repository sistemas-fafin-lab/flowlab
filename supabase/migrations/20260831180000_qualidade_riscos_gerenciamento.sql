-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Riscos: gerenciamento (tratamento, plano de ação,
-- reavaliação, eficácia)
-- (.scratch/qualidade-riscos-indicadores/issues/02-riscos-gerenciamento.md)
--
-- Depende de 20260831170000_qualidade_riscos_schema.sql (qa_riscos, RLS base,
-- trigger de auditoria genérico, faixas de classificação).
--
-- Três peças novas:
--   1. `qa_riscos.tratamento` — Aceitar/Monitorar/Reduzir/Eliminar/Transferir,
--      editável (UPDATE que a migration anterior deixou para esta issue).
--   2. `qa_reavaliacoes_risco` — histórico de reavaliação (risco residual).
--      NUNCA sobrescreve `qa_riscos` (P/S iniciais ficam imutáveis lá) — cada
--      reavaliação é uma linha nova, sem UPDATE/DELETE (imutável).
--   3. `qa_planos_acao` — um risco pode ter N planos; eficácia vive como
--      colunas do próprio plano (não uma tabela à parte, é sempre 1:1) e
--      `plano_anterior_id` encadeia ciclos quando um plano é marcado como
--      não eficaz (domain/riscosGerenciamento.ts monta os ciclos a partir
--      disso). Evidência fica em bucket de storage dedicado, path guardado
--      em `evidencias` (jsonb) — igual ao array `attachments` de
--      `it_requests` (20260424130000_it_requests_attachments.sql).
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. qa_riscos.tratamento ────────────────────────────────────────────────

ALTER TABLE qa_riscos
  ADD COLUMN IF NOT EXISTS tratamento text
    CONSTRAINT qa_riscos_tratamento_check CHECK (tratamento IN (
      'aceitar', 'monitorar', 'reduzir', 'eliminar', 'transferir'
    )),
  ADD COLUMN IF NOT EXISTS tratamento_atualizado_por uuid REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS tratamento_atualizado_em timestamptz;

DROP POLICY IF EXISTS qa_riscos_update ON qa_riscos;
CREATE POLICY "qa_riscos_update" ON qa_riscos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- Amplia o trigger de auditoria (20260831170000) para cobrir UPDATE — a
-- função já é genérica (por TG_TABLE_NAME/TG_OP), só faltava o evento.
DROP TRIGGER IF EXISTS trg_qa_riscos_auditoria ON qa_riscos;
CREATE TRIGGER trg_qa_riscos_auditoria
  AFTER INSERT OR UPDATE ON qa_riscos
  FOR EACH ROW
  EXECUTE FUNCTION qa_riscos_modulo_auditoria_trigger();

-- ─── 2. qa_reavaliacoes_risco — histórico de risco residual ────────────────
-- Sem UPDATE/DELETE de propósito (nenhuma policy criada para essas ações) —
-- reavaliar é sempre um INSERT novo, nunca uma correção do que já foi salvo.

CREATE TABLE IF NOT EXISTS qa_reavaliacoes_risco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id uuid NOT NULL REFERENCES qa_riscos(id),
  probabilidade smallint NOT NULL CONSTRAINT qa_reavaliacoes_risco_probabilidade_check CHECK (probabilidade BETWEEN 1 AND 5),
  severidade smallint NOT NULL CONSTRAINT qa_reavaliacoes_risco_severidade_check CHECK (severidade BETWEEN 1 AND 5),
  score smallint GENERATED ALWAYS AS (probabilidade * severidade) STORED,
  observacao text,
  reavaliado_por uuid NOT NULL REFERENCES user_profiles(id),
  reavaliado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_reavaliacoes_risco_risco_id ON qa_reavaliacoes_risco(risco_id);

COMMENT ON TABLE qa_reavaliacoes_risco IS 'Histórico de reavaliação (risco residual) — nunca sobrescreve qa_riscos.probabilidade/severidade (risco inicial), sempre uma linha nova.';

ALTER TABLE qa_reavaliacoes_risco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_reavaliacoes_risco_select ON qa_reavaliacoes_risco;
CREATE POLICY "qa_reavaliacoes_risco_select" ON qa_reavaliacoes_risco
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_reavaliacoes_risco_insert ON qa_reavaliacoes_risco;
CREATE POLICY "qa_reavaliacoes_risco_insert" ON qa_reavaliacoes_risco
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP TRIGGER IF EXISTS trg_qa_reavaliacoes_risco_auditoria ON qa_reavaliacoes_risco;
CREATE TRIGGER trg_qa_reavaliacoes_risco_auditoria
  AFTER INSERT ON qa_reavaliacoes_risco
  FOR EACH ROW
  EXECUTE FUNCTION qa_riscos_modulo_auditoria_trigger();

-- ─── 3. qa_planos_acao — plano(s) de ação + eficácia ───────────────────────
-- `plano_anterior_id` só é preenchido quando este plano nasce de um ciclo
-- anterior marcado como não eficaz (UI: "criar próximo plano vinculado ao
-- anterior") — domain/riscosGerenciamento.ts monta a cadeia a partir dele.

CREATE TABLE IF NOT EXISTS qa_planos_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risco_id uuid NOT NULL REFERENCES qa_riscos(id),
  acao text NOT NULL,
  responsavel_id uuid NOT NULL REFERENCES user_profiles(id),
  data_prevista date,
  data_conclusao date,
  status text NOT NULL DEFAULT 'planejado'
    CONSTRAINT qa_planos_acao_status_check CHECK (status IN ('planejado', 'em_andamento', 'concluido')),
  evidencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  eficaz boolean,
  avaliado_em timestamptz,
  avaliado_por uuid REFERENCES user_profiles(id),
  observacao_eficacia text,
  plano_anterior_id uuid REFERENCES qa_planos_acao(id),
  criado_por uuid NOT NULL REFERENCES user_profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_planos_acao_risco_id ON qa_planos_acao(risco_id);
CREATE INDEX IF NOT EXISTS idx_qa_planos_acao_plano_anterior_id ON qa_planos_acao(plano_anterior_id);

COMMENT ON COLUMN qa_planos_acao.evidencias IS 'Array [{path, nome, tamanho}] — path aponta para o bucket qa-riscos-evidencias (privado, leitura via signed URL).';
COMMENT ON COLUMN qa_planos_acao.plano_anterior_id IS 'Preenchido quando este plano nasce de um ciclo anterior marcado eficaz=false — encadeia o histórico de tentativas até o risco ficar sob controle.';

ALTER TABLE qa_planos_acao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_planos_acao_select ON qa_planos_acao;
CREATE POLICY "qa_planos_acao_select" ON qa_planos_acao
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_planos_acao_insert ON qa_planos_acao;
CREATE POLICY "qa_planos_acao_insert" ON qa_planos_acao
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_planos_acao_update ON qa_planos_acao;
CREATE POLICY "qa_planos_acao_update" ON qa_planos_acao
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP TRIGGER IF EXISTS trg_qa_planos_acao_auditoria ON qa_planos_acao;
CREATE TRIGGER trg_qa_planos_acao_auditoria
  AFTER INSERT OR UPDATE ON qa_planos_acao
  FOR EACH ROW
  EXECUTE FUNCTION qa_riscos_modulo_auditoria_trigger();

-- ─── 4. Bucket de storage para evidência de plano de ação ──────────────────
-- Molde: ac-apoio-requisicoes (20260723120000_ac_envio_apoio.sql) — privado,
-- SPA sobe/lê direto via supabase-js (authenticated), leitura por signed URL
-- de curta duração. Evidência de plano de ação não é PII de paciente, mas
-- continua documento interno de auditoria de qualidade — sem motivo para
-- ser público.

INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-riscos-evidencias', 'qa-riscos-evidencias', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "qa_riscos_evidencias_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "qa_riscos_evidencias_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "qa_riscos_evidencias_storage_delete" ON storage.objects;

CREATE POLICY "qa_riscos_evidencias_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qa-riscos-evidencias');

CREATE POLICY "qa_riscos_evidencias_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qa-riscos-evidencias');

CREATE POLICY "qa_riscos_evidencias_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'qa-riscos-evidencias');

COMMIT;
