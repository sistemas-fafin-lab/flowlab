-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — IHQ
-- Migration: 20260820140000_qualidade_ihq_piloto.sql
--
-- `qa_ihq_solicitacoes` JÁ EXISTE neste banco compartilhado (97 linhas reais,
-- contagem conferida via REST antes de escrever esta migration) — criada
-- fora do histórico de supabase/migrations/ deste repositório, num
-- desenvolvimento em separado (flowlab-qualidade, migrations locais
-- 20260812210000_ihq.sql + 20260819170000_qualidade_ihq_piloto.sql, nunca
-- portadas para cá). Esta migration só adapta RLS/constraints — não cria
-- nada.
--
-- Acesso por current_user_has_permission('canViewQualidade' | 'canManageQualidade')
-- — mesmo mecanismo padrão do FlowLab usado nas migrations de Ocorrências e
-- Cortesias (20260820120000/130000). Idempotente: roda sem erro mesmo que a
-- versão anterior (department = 'Qualidade', via qualidade_usuario_tem_acesso())
-- já tenha sido aplicada por fora deste repositório.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor. A ação de API `confirmar-vinculo-ihq` (que grava
-- vinculo_confirmado_por/vinculo_confirmado_em) não está coberta por esta
-- migration — depende do handler em api/_lib/handlers/, ainda por escrever.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. curado_por / vinculo_confirmado_por → user_profiles ─────────────────
-- Mesmo tratamento das migrations de Ocorrências/Cortesias: zera qualquer
-- valor que não aponte para um user_profiles real antes de trocar o alvo da
-- FK, para a constraint nova não falhar. Idempotente mesmo se já corrigido.

UPDATE qa_ihq_solicitacoes
SET curado_por = NULL
WHERE curado_por IS NOT NULL
  AND curado_por NOT IN (SELECT id FROM user_profiles);

UPDATE qa_ihq_solicitacoes
SET vinculo_confirmado_por = NULL
WHERE vinculo_confirmado_por IS NOT NULL
  AND vinculo_confirmado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE qa_ihq_solicitacoes DROP CONSTRAINT IF EXISTS qa_ihq_solicitacoes_curado_por_fkey;
ALTER TABLE qa_ihq_solicitacoes
  ADD CONSTRAINT qa_ihq_solicitacoes_curado_por_fkey
  FOREIGN KEY (curado_por) REFERENCES user_profiles(id);

ALTER TABLE qa_ihq_solicitacoes DROP CONSTRAINT IF EXISTS qa_ihq_solicitacoes_vinculo_confirmado_por_fkey;
ALTER TABLE qa_ihq_solicitacoes
  ADD CONSTRAINT qa_ihq_solicitacoes_vinculo_confirmado_por_fkey
  FOREIGN KEY (vinculo_confirmado_por) REFERENCES user_profiles(id);

-- ─── 2. RLS de qa_ihq_solicitacoes ───────────────────────────────────────────

ALTER TABLE qa_ihq_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_ihq_solicitacoes_select ON qa_ihq_solicitacoes;
CREATE POLICY "qa_ihq_solicitacoes_select" ON qa_ihq_solicitacoes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_ihq_solicitacoes_insert ON qa_ihq_solicitacoes;
CREATE POLICY "qa_ihq_solicitacoes_insert" ON qa_ihq_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_ihq_solicitacoes_update ON qa_ihq_solicitacoes;
CREATE POLICY "qa_ihq_solicitacoes_update" ON qa_ihq_solicitacoes
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- Nenhuma policy de DELETE: descarte é mudança de status_curadoria, não remoção.

-- ─── 3. Trigger de auditoria em qa_ihq_solicitacoes ────────────────────────────
-- Cobre curadoria E confirmação de vínculo.

CREATE OR REPLACE FUNCTION qa_ihq_solicitacoes_mudou_curadoria(old_row qa_ihq_solicitacoes, new_row qa_ihq_solicitacoes)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT old_row.lamina_enviada IS DISTINCT FROM new_row.lamina_enviada
      OR old_row.observacoes IS DISTINCT FROM new_row.observacoes
      OR old_row.status_curadoria IS DISTINCT FROM new_row.status_curadoria
      OR old_row.dta_envio_bloco IS DISTINCT FROM new_row.dta_envio_bloco
      OR old_row.dta_envio_proveniencia IS DISTINCT FROM new_row.dta_envio_proveniencia
      OR old_row.cod_requisicao_original IS DISTINCT FROM new_row.cod_requisicao_original
      OR old_row.vinculo_proveniencia IS DISTINCT FROM new_row.vinculo_proveniencia
      OR old_row.material_lis IS DISTINCT FROM new_row.material_lis
      OR old_row.patologista_lis IS DISTINCT FROM new_row.patologista_lis;
$$;

CREATE OR REPLACE FUNCTION qa_ihq_solicitacoes_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qa_ihq_solicitacoes_mudou_curadoria(OLD, NEW) AND auth.uid() IS NOT NULL THEN
    INSERT INTO app_auditoria (tabela, registro_id, acao, antes, depois, autor)
    VALUES (
      'qa_ihq_solicitacoes',
      NEW.id,
      'update',
      jsonb_build_object(
        'lamina_enviada', OLD.lamina_enviada, 'observacoes', OLD.observacoes,
        'status_curadoria', OLD.status_curadoria, 'dta_envio_bloco', OLD.dta_envio_bloco,
        'dta_envio_proveniencia', OLD.dta_envio_proveniencia,
        'cod_requisicao_original', OLD.cod_requisicao_original, 'vinculo_proveniencia', OLD.vinculo_proveniencia,
        'material_lis', OLD.material_lis, 'patologista_lis', OLD.patologista_lis,
        'curado_por', OLD.curado_por, 'curado_em', OLD.curado_em
      ),
      jsonb_build_object(
        'lamina_enviada', NEW.lamina_enviada, 'observacoes', NEW.observacoes,
        'status_curadoria', NEW.status_curadoria, 'dta_envio_bloco', NEW.dta_envio_bloco,
        'dta_envio_proveniencia', NEW.dta_envio_proveniencia,
        'cod_requisicao_original', NEW.cod_requisicao_original, 'vinculo_proveniencia', NEW.vinculo_proveniencia,
        'material_lis', NEW.material_lis, 'patologista_lis', NEW.patologista_lis,
        'curado_por', NEW.curado_por, 'curado_em', NEW.curado_em
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_ihq_solicitacoes_auditoria ON qa_ihq_solicitacoes;
CREATE TRIGGER trg_qa_ihq_solicitacoes_auditoria
  AFTER UPDATE ON qa_ihq_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION qa_ihq_solicitacoes_auditoria_trigger();

COMMIT;
