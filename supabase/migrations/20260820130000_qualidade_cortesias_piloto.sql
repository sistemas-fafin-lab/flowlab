-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — Cortesias (segundo submódulo, mesmo padrão do piloto
-- de Ocorrências — ver 20260820120000_qualidade_ocorrencias_piloto.sql)
-- Migration: 20260820130000_qualidade_cortesias_piloto.sql
--
-- `qa_cortesias`/`qa_motivos_cortesia`/`qa_classificacoes_cortesia`/
-- `qa_cotas_cortesia`/`app_colaboradores` JÁ EXISTEM neste banco
-- compartilhado (120 linhas reais em qa_cortesias, sincronizadas ao longo
-- do desenvolvimento de flowlab-qualidade) — esta migration só adapta RLS
-- e FKs, não cria nada.
--
-- Diferença de Ocorrências: `status_curadoria` aqui SHALL continuar com 4
-- estados (pendente/em_analise/concluida/descartada) — Cortesias nunca
-- passou pela simplificação para binário que Ocorrências passou. Curadoria
-- aqui é decisão humana genuína (motivo, classificação, quem autorizou,
-- status), não um espelho do LIS.
--
-- Acesso por current_user_has_permission('canViewQualidade' | 'canManageQualidade')
-- — mesmo mecanismo padrão do FlowLab usado na migration de Ocorrências.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. curado_por → user_profiles (mesmo tratamento de Ocorrências) ──────────
-- autorizado_por_corrigido continua apontando para app_colaboradores — é
-- vocabulário de PESSOAS DA CLÍNICA/LIS que autorizam cortesias (ex.: "Mario
-- Gorini"), não usuários do FlowLab — não muda.

UPDATE qa_cortesias
SET curado_por = NULL
WHERE curado_por IS NOT NULL
  AND curado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE qa_cortesias DROP CONSTRAINT IF EXISTS qa_cortesias_curado_por_fkey;
ALTER TABLE qa_cortesias
  ADD CONSTRAINT qa_cortesias_curado_por_fkey
  FOREIGN KEY (curado_por) REFERENCES user_profiles(id);

-- ─── 2. RLS de qa_cortesias, vocabulário e cotas ───────────────────────────────

DROP POLICY IF EXISTS qa_cortesias_select ON qa_cortesias;
CREATE POLICY "qa_cortesias_select" ON qa_cortesias
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_cortesias_insert ON qa_cortesias;
CREATE POLICY "qa_cortesias_insert" ON qa_cortesias
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_cortesias_update ON qa_cortesias;
CREATE POLICY "qa_cortesias_update" ON qa_cortesias
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_motivos_cortesia_select ON qa_motivos_cortesia;
CREATE POLICY "qa_motivos_cortesia_select" ON qa_motivos_cortesia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_motivos_cortesia_write ON qa_motivos_cortesia;
CREATE POLICY "qa_motivos_cortesia_write" ON qa_motivos_cortesia
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_classificacoes_cortesia_select ON qa_classificacoes_cortesia;
CREATE POLICY "qa_classificacoes_cortesia_select" ON qa_classificacoes_cortesia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_classificacoes_cortesia_write ON qa_classificacoes_cortesia;
CREATE POLICY "qa_classificacoes_cortesia_write" ON qa_classificacoes_cortesia
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_cotas_cortesia_select ON qa_cotas_cortesia;
CREATE POLICY "qa_cotas_cortesia_select" ON qa_cotas_cortesia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );
DROP POLICY IF EXISTS qa_cotas_cortesia_write ON qa_cotas_cortesia;
CREATE POLICY "qa_cotas_cortesia_write" ON qa_cotas_cortesia
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- app_colaboradores: vocabulário de "autorizado por" (R6) — a tela de
-- curadoria de Cortesias precisa ler a lista.
DROP POLICY IF EXISTS app_colaboradores_select ON app_colaboradores;
CREATE POLICY "app_colaboradores_select" ON app_colaboradores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- ─── 3. Trigger de auditoria em qa_cortesias ────────────────────────────────

CREATE OR REPLACE FUNCTION qa_cortesias_mudou_curadoria(old_row qa_cortesias, new_row qa_cortesias)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT old_row.motivo_id IS DISTINCT FROM new_row.motivo_id
      OR old_row.classificacao_id IS DISTINCT FROM new_row.classificacao_id
      OR old_row.autorizado_por_corrigido IS DISTINCT FROM new_row.autorizado_por_corrigido
      OR old_row.observacoes_curadas IS DISTINCT FROM new_row.observacoes_curadas
      OR old_row.status_curadoria IS DISTINCT FROM new_row.status_curadoria
      OR old_row.valor_concedido_corrigido IS DISTINCT FROM new_row.valor_concedido_corrigido
      OR old_row.valor_particular_corrigido IS DISTINCT FROM new_row.valor_particular_corrigido;
$$;

CREATE OR REPLACE FUNCTION qa_cortesias_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qa_cortesias_mudou_curadoria(OLD, NEW) AND auth.uid() IS NOT NULL THEN
    INSERT INTO app_auditoria (tabela, registro_id, acao, antes, depois, autor)
    VALUES (
      'qa_cortesias',
      NEW.id,
      'update',
      jsonb_build_object(
        'motivo_id', OLD.motivo_id, 'classificacao_id', OLD.classificacao_id,
        'autorizado_por_corrigido', OLD.autorizado_por_corrigido, 'observacoes_curadas', OLD.observacoes_curadas,
        'status_curadoria', OLD.status_curadoria, 'valor_concedido_corrigido', OLD.valor_concedido_corrigido,
        'valor_particular_corrigido', OLD.valor_particular_corrigido,
        'curado_por', OLD.curado_por, 'curado_em', OLD.curado_em
      ),
      jsonb_build_object(
        'motivo_id', NEW.motivo_id, 'classificacao_id', NEW.classificacao_id,
        'autorizado_por_corrigido', NEW.autorizado_por_corrigido, 'observacoes_curadas', NEW.observacoes_curadas,
        'status_curadoria', NEW.status_curadoria, 'valor_concedido_corrigido', NEW.valor_concedido_corrigido,
        'valor_particular_corrigido', NEW.valor_particular_corrigido,
        'curado_por', NEW.curado_por, 'curado_em', NEW.curado_em
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_cortesias_auditoria ON qa_cortesias;
CREATE TRIGGER trg_qa_cortesias_auditoria
  AFTER UPDATE ON qa_cortesias
  FOR EACH ROW
  EXECUTE FUNCTION qa_cortesias_auditoria_trigger();

COMMIT;
