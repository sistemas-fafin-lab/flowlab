-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX — projeto "FlowLab - test" (eqz, eqzqkztgzcngnxmihdom) — NÃO produção.
--
-- qa_requisicoes neste projeto foi criada manualmente (SQL Editor) com um
-- formato antigo/divergente, ANTES das migrations abaixo serem escritas —
-- colunas como dta_liberacao/secao_lis/dta_coleta/patologista_nome_lis/
-- motivo_retificacao_id não existem lá (em vez disso: dta_1a_liberacao,
-- nom_paciente, motivo_retificacao_curado texto solto, etc.). Como a
-- migration base usa `CREATE TABLE IF NOT EXISTS`, rodá-la de novo não
-- corrige nada — só as ALTER TABLE ADD COLUMN seguintes pegaram.
--
-- Correção: dropar a tabela (dados são só espelho do LIS, resincronizáveis
-- pelo botão "Sincronizar" da aba Indicadores — nenhuma outra tabela tem FK
-- para qa_requisicoes, confirmado em supabase/migrations/*.sql) e deixar as
-- 4 migrations de Qualidade/Indicadores recriá-la do formato certo.
--
-- COMO RODAR: Dashboard do projeto "FlowLab - test" (eqz) → SQL Editor →
-- colar este arquivo INTEIRO → Run. Transação única — se algo falhar, nada
-- é aplicado. Depois, abrir Qualidade → Indicadores e clicar em
-- "Sincronizar" para repopular.
--
-- NÃO rodar em produção (jqx) — lá o schema já está correto (confirmado em
-- 2026-09-02, ver supabase/migrations/20260901120000_qualidade_requisicoes_indicadores.sql).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS qa_requisicoes CASCADE;

-- ── [1/4] 20260901120000_qualidade_requisicoes_indicadores.sql (base) ──────

CREATE TABLE IF NOT EXISTS qa_motivos_retificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT qa_motivos_retificacao_nome_key UNIQUE (nome)
);

CREATE TABLE qa_requisicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_requisicao_lis integer NOT NULL,
  cod_requisicao text NOT NULL,
  cod_exame_tipo_lis integer,
  exame_tipo_nome_lis text,
  secao_lis text CONSTRAINT qa_requisicoes_secao_lis_check
    CHECK (secao_lis IN ('biologia_molecular', 'patologia_ap', 'histologia_citologia', 'ihq_parceiro')),
  dta_solicitacao date NOT NULL,
  dta_coleta date,
  dta_amostra_recebida date,
  dta_admissao date,
  dta_prevista date,
  dta_liberacao date,
  patologista_nome_lis text,
  retificado boolean NOT NULL DEFAULT false,
  dta_retificacao date,
  motivo_retificacao_id uuid REFERENCES qa_motivos_retificacao(id),
  resumo_retificacao_curado text,
  status_curadoria text CONSTRAINT qa_requisicoes_status_curadoria_check
    CHECK (status_curadoria IS NULL OR status_curadoria IN ('pendente', 'concluida')),
  curado_por uuid REFERENCES user_profiles(id),
  curado_em timestamptz,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_requisicoes_id_requisicao_lis_key UNIQUE (id_requisicao_lis)
);

CREATE INDEX qa_requisicoes_dta_solicitacao_idx ON qa_requisicoes (dta_solicitacao);
CREATE INDEX qa_requisicoes_secao_lis_idx ON qa_requisicoes (secao_lis);
CREATE INDEX qa_requisicoes_retificado_idx ON qa_requisicoes (retificado);

COMMENT ON TABLE qa_requisicoes IS 'Espelho de requisicao/requisicaohistorico do LIS para a aba Indicadores — Indicadores Gerais do Laboratório + 4 seções extras (Biologia Molecular, Patologia/AP, Histologia/Citologia, IHQ/parceiro), calculados no domínio a partir destas linhas. Curadoria manual só se aplica a retificado = true.';

ALTER TABLE qa_motivos_retificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_requisicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_motivos_retificacao_select ON qa_motivos_retificacao;
CREATE POLICY "qa_motivos_retificacao_select" ON qa_motivos_retificacao
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_motivos_retificacao_write ON qa_motivos_retificacao;
CREATE POLICY "qa_motivos_retificacao_write" ON qa_motivos_retificacao
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

CREATE POLICY "qa_requisicoes_select" ON qa_requisicoes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

CREATE POLICY "qa_requisicoes_insert" ON qa_requisicoes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

CREATE POLICY "qa_requisicoes_update" ON qa_requisicoes
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

CREATE OR REPLACE FUNCTION qa_requisicoes_mudou_curadoria(old_row qa_requisicoes, new_row qa_requisicoes)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT old_row.motivo_retificacao_id IS DISTINCT FROM new_row.motivo_retificacao_id
      OR old_row.resumo_retificacao_curado IS DISTINCT FROM new_row.resumo_retificacao_curado
      OR old_row.status_curadoria IS DISTINCT FROM new_row.status_curadoria;
$$;

CREATE OR REPLACE FUNCTION qa_requisicoes_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qa_requisicoes_mudou_curadoria(OLD, NEW) AND auth.uid() IS NOT NULL THEN
    INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
    VALUES (
      'qa_requisicoes',
      NEW.id,
      'update',
      jsonb_build_object(
        'motivo_retificacao_id', OLD.motivo_retificacao_id,
        'resumo_retificacao_curado', OLD.resumo_retificacao_curado,
        'status_curadoria', OLD.status_curadoria,
        'curado_por', OLD.curado_por, 'curado_em', OLD.curado_em
      ),
      jsonb_build_object(
        'motivo_retificacao_id', NEW.motivo_retificacao_id,
        'resumo_retificacao_curado', NEW.resumo_retificacao_curado,
        'status_curadoria', NEW.status_curadoria,
        'curado_por', NEW.curado_por, 'curado_em', NEW.curado_em
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_requisicoes_auditoria
  AFTER UPDATE ON qa_requisicoes
  FOR EACH ROW
  EXECUTE FUNCTION qa_requisicoes_auditoria_trigger();

-- ── [2/4] 20260901130000_qualidade_requisicoes_patologia_ap.sql ────────────

ALTER TABLE qa_requisicoes
  ADD COLUMN IF NOT EXISTS dta_prevista_setor timestamptz,
  ADD COLUMN IF NOT EXISTS recorte_coloracao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_recorte_coloracao timestamptz,
  ADD COLUMN IF NOT EXISTS consenso_pendente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_consenso_criado timestamptz,
  ADD COLUMN IF NOT EXISTS bloco_danificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_bloco_danificado timestamptz;

-- ── [3/4] 20260901140000_qualidade_requisicoes_histologia_citologia.sql ────

ALTER TABLE qa_requisicoes
  ADD COLUMN IF NOT EXISTS num_blocos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_laminas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dta_primeira_lamina_pronta timestamptz,
  ADD COLUMN IF NOT EXISTS dta_microscopia_aguardando timestamptz,
  ADD COLUMN IF NOT EXISTS amostra_nao_recebida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_amostra_nao_recebida timestamptz,
  ADD COLUMN IF NOT EXISTS material_devolvido_nao_conforme boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_material_devolvido timestamptz,
  ADD COLUMN IF NOT EXISTS bloco_danificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_bloco_danificado timestamptz;

-- ── [4/4] 20260901150000_qualidade_requisicoes_ihq_parceiro.sql ────────────

ALTER TABLE qa_requisicoes
  ADD COLUMN IF NOT EXISTS cod_exame integer,
  ADD COLUMN IF NOT EXISTS dta_envio_parceiro timestamptz,
  ADD COLUMN IF NOT EXISTS dta_retorno_laudo_fotos timestamptz,
  ADD COLUMN IF NOT EXISTS dta_retorno_amostra_devolvida timestamptz;

CREATE INDEX IF NOT EXISTS qa_requisicoes_cod_exame_idx ON qa_requisicoes (cod_exame);

COMMIT;

-- ── Conferência (rodar depois do COMMIT) ────────────────────────────────────
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'qa_requisicoes' order by 1;
-- -- deve incluir: secao_lis, dta_coleta, dta_liberacao, patologista_nome_lis,
-- -- motivo_retificacao_id, status_curadoria, dta_prevista_setor, cod_exame.
