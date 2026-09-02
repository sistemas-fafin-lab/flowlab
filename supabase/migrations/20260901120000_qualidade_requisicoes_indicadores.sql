-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Indicadores: espelho de Requisições + curadoria de
-- retificação (.scratch/qualidade-riscos-indicadores/issues/06-indicadores-requisicoes.md)
--
-- qa_requisicoes espelha `requisicao` (+ eventos de `requisicaohistorico`) do
-- MySQL de backup do LIS, mesmo padrão de sync de Ocorrências/Cortesias/IHQ/
-- Câncer (20260820120000_qualidade_piloto.sql) — service_role escreve as
-- colunas de espelho, nunca as de curadoria (motivo_retificacao_id/
-- resumo_retificacao_curado/status_curadoria/curado_por/curado_em).
--
-- Módulo INDEPENDENTE de Riscos — não referencia qa_riscos nem qa_ocorrencias
-- (a métrica "Não Conformidades por Setor" da aba Indicadores lê
-- qa_ocorrencias diretamente do lado do cliente, reaproveitando
-- domain/ocorrenciasIndicadores.ts já existente — sem FK nem tabela nova
-- aqui).
--
-- Categorização por seção (Biologia Molecular / Patologia-AP / Histologia-
-- Citologia / IHQ-parceiro) usa `exame.CodExameTipo` do LIS (catálogo estável
-- por exame, conferido ao vivo no MySQL de backup em 2026-09-01), não
-- `evento`/`setor` (que refletem o PASSO atual do fluxo, não o tipo do
-- exame — ~65% das requisições têm `requisicao.CodEvento` apontando para o
-- setor "Arquivo Morto", que é só o status final do workflow):
--   1  ANÁTOMO PATOLÓGICO, 8 HISTOPATOLÓGICO, 9 BIÓPSIA SIMPLES,
--      10 FRAGMENTOS MÚLTIPLOS, 11 MARGENS PEÇAS, 19 PAAF  → patologia_ap
--   2  CITOPATOLOGIA                                        → histologia_citologia
--   3  IMUNOISTOQUÍMICA, 5 EXAMES REALIZADOS POR PARCEIROS   → ihq_parceiro
--   6  CAPTURA HÍBRIDA, 7 PAINEL DE HIBRIDIZAÇÃO, 18 PCR      → biologia_molecular
-- Qualquer outro CodExameTipo (REVISÃO INTERNA, FATURAMENTO EXTERNO, REDE
-- APLIS, MEDICINA LABORATORIAL) ou CodExame nulo fica com secao_lis NULL —
-- conta para "Indicadores Gerais", mas não entra em nenhuma das 4 seções
-- extras.
--
-- Retificação de laudo detectada via `requisicaohistorico` com
-- `CodEvento = 54` ("Retificação de laudo", conferido ao vivo) — o motivo em
-- si não existe estruturado no LIS, por isso a curadoria manual
-- (mesmo padrão de `qa_motivos_ocorrencia`/`qa_ocorrencias`).
--
-- Aplicada em produção (confirmado por introspecção direta em 2026-09-02 —
-- ver supabase/scripts/prod-upgrade-qualidade-indicadores-fase2.sql para o
-- contexto). Ausente do bookkeeping supabase_migrations.schema_migrations
-- porque foi aplicada manualmente via SQL Editor, não via `supabase db push`
-- — rodar `supabase migration repair --status applied 20260901120000` se
-- for reconciliar o histórico da CLI.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Vocabulário de curadoria: motivo de retificação ────────────────────

CREATE TABLE IF NOT EXISTS qa_motivos_retificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT qa_motivos_retificacao_nome_key UNIQUE (nome)
);

-- ─── 2. qa_requisicoes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_requisicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_requisicao_lis integer NOT NULL,
  cod_requisicao text NOT NULL,
  cod_exame_tipo_lis integer,
  exame_tipo_nome_lis text,
  -- Derivada de cod_exame_tipo_lis pelo handler de sync (ver mapeamento no
  -- cabeçalho) — NULL quando o tipo de exame não cai em nenhuma das 4 seções
  -- extras (ainda conta para os Indicadores Gerais).
  secao_lis text CONSTRAINT qa_requisicoes_secao_lis_check
    CHECK (secao_lis IN ('biologia_molecular', 'patologia_ap', 'histologia_citologia', 'ihq_parceiro')),
  dta_solicitacao date NOT NULL,
  dta_coleta date,
  -- Evento 20 ("Triagem de Amostra - Recebida") — distinto de dta_admissao.
  dta_amostra_recebida date,
  -- Evento 1 ("Admissão").
  dta_admissao date,
  dta_prevista date,
  -- `requisicao.Dta1aLiberacao` (1ª liberação) — não `DtaFinalizacao`, que é
  -- reescrita quando o laudo é retificado depois (mediria o TAT errado).
  dta_liberacao date,
  patologista_nome_lis text,
  retificado boolean NOT NULL DEFAULT false,
  -- MAX(DtaEvento) do evento 54 — se retificado mais de uma vez, fica com a
  -- retificação mais recente.
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

CREATE INDEX IF NOT EXISTS qa_requisicoes_dta_solicitacao_idx ON qa_requisicoes (dta_solicitacao);
CREATE INDEX IF NOT EXISTS qa_requisicoes_secao_lis_idx ON qa_requisicoes (secao_lis);
CREATE INDEX IF NOT EXISTS qa_requisicoes_retificado_idx ON qa_requisicoes (retificado);

COMMENT ON TABLE qa_requisicoes IS 'Espelho de requisicao/requisicaohistorico do LIS para a aba Indicadores — Indicadores Gerais do Laboratório + 4 seções extras (Biologia Molecular, Patologia/AP, Histologia/Citologia, IHQ/parceiro), calculados no domínio a partir destas linhas. Curadoria manual só se aplica a retificado = true.';

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS qa_requisicoes_select ON qa_requisicoes;
CREATE POLICY "qa_requisicoes_select" ON qa_requisicoes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_requisicoes_insert ON qa_requisicoes;
CREATE POLICY "qa_requisicoes_insert" ON qa_requisicoes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_requisicoes_update ON qa_requisicoes;
CREATE POLICY "qa_requisicoes_update" ON qa_requisicoes
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- ─── 4. Trigger de auditoria (curadoria de retificação) ────────────────────
-- Mesmo racional de qa_ocorrencias_auditoria_trigger (20260820120000): audita
-- só quando uma coluna de CURADORIA muda e auth.uid() não é nulo — o sync
-- (service_role) nunca dispara isto, porque nunca escreve essas colunas.

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

DROP TRIGGER IF EXISTS trg_qa_requisicoes_auditoria ON qa_requisicoes;
CREATE TRIGGER trg_qa_requisicoes_auditoria
  AFTER UPDATE ON qa_requisicoes
  FOR EACH ROW
  EXECUTE FUNCTION qa_requisicoes_auditoria_trigger();

COMMIT;
