-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Riscos: cadastro, matriz 5×5 e origem por ocorrência
-- (.scratch/qualidade-riscos-indicadores/issues/01-riscos-cadastro-matriz-origem.md)
--
-- Escopo desta migration é só o que a issue 01 precisa: `qa_riscos` (cadastro)
-- e as faixas de classificação configuráveis. As demais tabelas do desenho de
-- origem (`qa_planos_acao`, `qa_reavaliacoes_risco`, `qa_planos_contingencia`,
-- `qa_testes_contingencia` — issues 02/03) ficam para suas próprias migrations,
-- em fatias verticais (ver spec.md, "Decisão de escopo").
--
-- Diferente de Ocorrências/Cortesias/IHQ/Câncer, `qa_riscos` NÃO espelha o
-- LIS — é dado nativo do Supabase, sem sync, sem distinção espelho ×
-- curadoria: toda escrita já é decisão humana autenticada.
--
-- Divergência confirmada contra o repo de origem (Flowlab_Controle_Qualidade,
-- commit d78e375): lá o acesso é por `qualidade_usuario_tem_acesso()`
-- (`department = 'Qualidade'`); aqui o módulo Qualidade já usa
-- `current_user_has_permission('canViewQualidade' | 'canManageQualidade')`
-- (mesmo padrão de `qa_ocorrencias`/`qa_cortesias` em
-- 20260820120000_qualidade_piloto.sql) — RLS abaixo segue o padrão local, não
-- o de origem. `qa_setores`/`qa_parametros`/`qa_auditoria` têm os mesmos
-- nomes/colunas nos dois repos.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. qa_riscos ───────────────────────────────────────────────────────────
-- Score é sempre P × S — coluna gerada, nunca pode divergir das colunas de
-- origem. Classificação (Baixo/Médio/Alto/Crítico) NÃO é coluna gerada aqui:
-- as faixas são configuráveis (qa_parametros), então a resolução do nível
-- fica na camada de domínio do frontend (domain/riscosClassificacao.ts).

CREATE TABLE IF NOT EXISTS qa_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES qa_setores(id),
  processo text NOT NULL,
  risco_identificado text NOT NULL,
  causa text,
  consequencia text,
  controle_existente text,
  origem_risco text NOT NULL DEFAULT 'outro'
    CONSTRAINT qa_riscos_origem_risco_check CHECK (origem_risco IN (
      'nao_conformidade', 'ocorrencia', 'auditoria', 'indicador', 'reclamacao',
      'analise_preventiva', 'falha_equipamento', 'mudanca_processo',
      'fornecedor_parceiro', 'controle_qualidade', 'outro'
    )),
  ocorrencia_origem_id uuid REFERENCES qa_ocorrencias(id),
  probabilidade smallint CONSTRAINT qa_riscos_probabilidade_check CHECK (probabilidade BETWEEN 1 AND 5),
  severidade smallint CONSTRAINT qa_riscos_severidade_check CHECK (severidade BETWEEN 1 AND 5),
  score smallint GENERATED ALWAYS AS (probabilidade * severidade) STORED,
  criado_por uuid NOT NULL REFERENCES user_profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN qa_riscos.score IS 'Probabilidade × Severidade — nunca gravado manualmente, sempre derivado.';
COMMENT ON COLUMN qa_riscos.ocorrencia_origem_id IS 'Preenchido quando o risco nasce de "Gerar risco a partir desta ocorrência" — imutável após criado (nenhuma policy de UPDATE existe para esta tabela ainda).';

-- ─── 2. RLS — mesmo mecanismo das demais abas de Qualidade ─────────────────
-- Só SELECT/INSERT: issue 01 é cadastro, sem edição (tratamento/plano de
-- ação chegam com a issue 02, que acrescenta a policy de UPDATE junto com a
-- coluna correspondente).

ALTER TABLE qa_riscos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_riscos_select ON qa_riscos;
CREATE POLICY "qa_riscos_select" ON qa_riscos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_riscos_insert ON qa_riscos;
CREATE POLICY "qa_riscos_insert" ON qa_riscos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- ─── 3. Auditoria — trigger genérico, reaproveitável pelas próximas tabelas
-- do módulo Riscos (issues 02/03) ───────────────────────────────────────────
-- Diferente de qa_ocorrencias_auditoria_trigger/qa_cortesias_auditoria_trigger
-- (que só auditam mudança de colunas de CURADORIA, porque o resto é espelho
-- do LIS), aqui não existe distinção espelho × curadoria — toda mudança é
-- decisão humana, então um único trigger genérico (por TG_TABLE_NAME/TG_OP)
-- audita INSERT (e, quando as próximas issues acrescentarem UPDATE/DELETE às
-- suas tabelas, essas ações também) sem precisar de uma função por tabela.

CREATE OR REPLACE FUNCTION qa_riscos_modulo_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registro_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_registro_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
  VALUES (
    TG_TABLE_NAME,
    v_registro_id,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_riscos_auditoria ON qa_riscos;
CREATE TRIGGER trg_qa_riscos_auditoria
  AFTER INSERT ON qa_riscos
  FOR EACH ROW
  EXECUTE FUNCTION qa_riscos_modulo_auditoria_trigger();

-- ─── 4. Faixas de classificação configuráveis (qa_parametros) ──────────────
-- Mesmo mecanismo de `cancer.*`/`ihq.*` — faixas de score NÃO ficam fixas no
-- código-fonte. Valores de exemplo do documento do cliente (1–4 baixo, 5–9
-- médio, 10–16 alto, 17–25 crítico), editável sem deploy direto na tabela.

INSERT INTO qa_parametros (modulo, chave, valor)
VALUES (
  'riscos',
  'riscos.faixas_classificacao',
  '[
    {"min": 1, "max": 4, "nivel": "baixo"},
    {"min": 5, "max": 9, "nivel": "medio"},
    {"min": 10, "max": 16, "nivel": "alto"},
    {"min": 17, "max": 25, "nivel": "critico"}
  ]'::jsonb
)
ON CONFLICT (chave) DO NOTHING;

-- Amplia a policy de leitura de qa_parametros (20260820120000_qualidade_piloto.sql,
-- A5) para incluir as chaves `riscos.*` — sem isso, canViewQualidade/
-- canManageQualidade não enxergariam `riscos.faixas_classificacao` (a policy
-- original filtra por `chave LIKE 'cancer.%' OR chave LIKE 'ihq.%'`). Sem
-- policy de escrita para `riscos.%`: nenhuma tela desta issue edita o
-- parâmetro — ajuste é direto na tabela, mesmo mecanismo de
-- `atualizarParametroFixoCancer` não se aplica aqui.

DROP POLICY IF EXISTS qa_parametros_select ON qa_parametros;
CREATE POLICY "qa_parametros_select" ON qa_parametros
  FOR SELECT TO authenticated
  USING (
    (
      public.current_user_has_permission('canViewQualidade')
      OR public.current_user_has_permission('canManageQualidade')
    )
    AND (chave LIKE 'cancer.%' OR chave LIKE 'ihq.%' OR chave LIKE 'riscos.%')
  );

COMMIT;
