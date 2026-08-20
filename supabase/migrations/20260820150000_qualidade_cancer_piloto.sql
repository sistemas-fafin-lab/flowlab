-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — Registro de Câncer
-- Migration: 20260820150000_qualidade_cancer_piloto.sql
--
-- `qa_cido_catalogo`, `qa_exportacoes_rhc` e `qa_cancer_casos` JÁ EXISTEM
-- neste banco compartilhado (311 linhas reais em qa_cancer_casos, contagem
-- conferida via REST antes de escrever esta migration) — criadas fora do
-- histórico de supabase/migrations/ deste repositório, num desenvolvimento
-- em separado (flowlab-qualidade, migrations locais 20260812220000_cancer.sql
-- + 20260819180000_qualidade_cancer_piloto.sql, nunca portadas para cá).
-- Esta migration só adapta RLS/constraints — não cria nada.
--
-- Acesso por current_user_has_permission('canViewQualidade' | 'canManageQualidade')
-- — mesmo mecanismo padrão do FlowLab usado nas demais migrations de
-- Qualidade (20260820120000/130000/140000). Idempotente.
--
-- ⚠️ P10 (nenhuma PII de paciente nestas tabelas — nome/CPF/nome da
-- mãe/data de nascimento e texto do laudo são lidos do LIS sob demanda,
-- nunca persistidos aqui) continua valendo; esta migration não adiciona
-- nenhuma coluna nova, só ajusta RLS/FK.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor. As ações de API `buscar-funil-cancer`, `buscar-detalhe-cancer`,
-- `sync-cancer`, `gerar-exportacao-cancer`, `baixar-exportacao-cancer`
-- não são cobertas por esta migration — dependem de handlers em
-- api/_lib/handlers/ e da lógica de regras de negócio
-- (api/_lib/qualidade/cancerRegras.ts), ambos ainda por escrever/localizar.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. triado_por / classificado_por (qa_cancer_casos) e gerado_por
-- (qa_exportacoes_rhc) → user_profiles ────────────────────────────────────────
-- Mesmo tratamento das demais migrations de Qualidade. Idempotente mesmo se
-- já corrigido.

UPDATE qa_cancer_casos
SET triado_por = NULL
WHERE triado_por IS NOT NULL
  AND triado_por NOT IN (SELECT id FROM user_profiles);

UPDATE qa_cancer_casos
SET classificado_por = NULL
WHERE classificado_por IS NOT NULL
  AND classificado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE qa_cancer_casos DROP CONSTRAINT IF EXISTS qa_cancer_casos_triado_por_fkey;
ALTER TABLE qa_cancer_casos
  ADD CONSTRAINT qa_cancer_casos_triado_por_fkey
  FOREIGN KEY (triado_por) REFERENCES user_profiles(id);

ALTER TABLE qa_cancer_casos DROP CONSTRAINT IF EXISTS qa_cancer_casos_classificado_por_fkey;
ALTER TABLE qa_cancer_casos
  ADD CONSTRAINT qa_cancer_casos_classificado_por_fkey
  FOREIGN KEY (classificado_por) REFERENCES user_profiles(id);

-- qa_exportacoes_rhc.gerado_por é NOT NULL — mesmo tratamento de
-- app_auditoria.autor nas migrations anteriores: troca a FK sem validar
-- linhas históricas (NOT VALID), para não quebrar se houver exportação
-- antiga referenciando um id que não existe mais em user_profiles.
ALTER TABLE qa_exportacoes_rhc DROP CONSTRAINT IF EXISTS qa_exportacoes_rhc_gerado_por_fkey;
ALTER TABLE qa_exportacoes_rhc
  ADD CONSTRAINT qa_exportacoes_rhc_gerado_por_fkey
  FOREIGN KEY (gerado_por) REFERENCES user_profiles(id) NOT VALID;

-- ─── 2. RLS de qa_cido_catalogo, qa_exportacoes_rhc, qa_cancer_casos ───────────

ALTER TABLE qa_cido_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_exportacoes_rhc ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cancer_casos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_cido_catalogo_select ON qa_cido_catalogo;
CREATE POLICY "qa_cido_catalogo_select" ON qa_cido_catalogo
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_cido_catalogo_write ON qa_cido_catalogo;
CREATE POLICY "qa_cido_catalogo_write" ON qa_cido_catalogo
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_exportacoes_rhc_select ON qa_exportacoes_rhc;
CREATE POLICY "qa_exportacoes_rhc_select" ON qa_exportacoes_rhc
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_exportacoes_rhc_insert ON qa_exportacoes_rhc;
CREATE POLICY "qa_exportacoes_rhc_insert" ON qa_exportacoes_rhc
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_cancer_casos_select ON qa_cancer_casos;
CREATE POLICY "qa_cancer_casos_select" ON qa_cancer_casos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_cancer_casos_insert ON qa_cancer_casos;
CREATE POLICY "qa_cancer_casos_insert" ON qa_cancer_casos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));
DROP POLICY IF EXISTS qa_cancer_casos_update ON qa_cancer_casos;
CREATE POLICY "qa_cancer_casos_update" ON qa_cancer_casos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));
-- Nenhuma policy de DELETE: descarte é mudança de status, nunca remoção.

-- ─── 3. Trigger de auditoria em qa_cancer_casos ────────────────────────────────
-- Cobre triagem e classificação CID-O.

CREATE OR REPLACE FUNCTION qa_cancer_casos_mudou_curadoria(old_row qa_cancer_casos, new_row qa_cancer_casos)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT old_row.triagem IS DISTINCT FROM new_row.triagem
      OR old_row.triagem_justificativa IS DISTINCT FROM new_row.triagem_justificativa
      OR old_row.cido_topografia_codigo IS DISTINCT FROM new_row.cido_topografia_codigo
      OR old_row.cido_morfologia_codigo IS DISTINCT FROM new_row.cido_morfologia_codigo
      OR old_row.observacoes IS DISTINCT FROM new_row.observacoes;
$$;

CREATE OR REPLACE FUNCTION qa_cancer_casos_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qa_cancer_casos_mudou_curadoria(OLD, NEW) AND auth.uid() IS NOT NULL THEN
    INSERT INTO app_auditoria (tabela, registro_id, acao, antes, depois, autor)
    VALUES (
      'qa_cancer_casos',
      NEW.id,
      'update',
      jsonb_build_object(
        'triagem', OLD.triagem, 'triagem_justificativa', OLD.triagem_justificativa,
        'cido_topografia_codigo', OLD.cido_topografia_codigo, 'cido_morfologia_codigo', OLD.cido_morfologia_codigo,
        'observacoes', OLD.observacoes,
        'triado_por', OLD.triado_por, 'triado_em', OLD.triado_em,
        'classificado_por', OLD.classificado_por, 'classificado_em', OLD.classificado_em
      ),
      jsonb_build_object(
        'triagem', NEW.triagem, 'triagem_justificativa', NEW.triagem_justificativa,
        'cido_topografia_codigo', NEW.cido_topografia_codigo, 'cido_morfologia_codigo', NEW.cido_morfologia_codigo,
        'observacoes', NEW.observacoes,
        'triado_por', NEW.triado_por, 'triado_em', NEW.triado_em,
        'classificado_por', NEW.classificado_por, 'classificado_em', NEW.classificado_em
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cancer_casos_auditoria ON qa_cancer_casos;
CREATE TRIGGER trg_qa_cancer_casos_auditoria
  AFTER UPDATE ON qa_cancer_casos
  FOR EACH ROW
  EXECUTE FUNCTION qa_cancer_casos_auditoria_trigger();

COMMIT;
