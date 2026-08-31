-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Riscos: planos de contingência + histórico de testes
-- (.scratch/qualidade-riscos-indicadores/issues/03-riscos-contingencia.md)
--
-- Depende só de 20260820120000_qualidade_piloto.sql (qa_setores, RLS base) —
-- NÃO depende de 20260831170000/20260831180000 (schema/gerenciamento de
-- risco, issues 01/02). `qa_planos_contingencia` não tem FK para `qa_riscos`
-- e, deliberadamente, não reaproveita `qa_riscos_modulo_auditoria_trigger`
-- (definida em 20260831170000): plano de contingência é independente de
-- risco (requisito do cliente original, "são duas coisas relacionadas, mas
-- diferentes" — spec.md, "só precisa do shell de navegação (00), não do
-- schema de risco") — por isso esta migration define sua própria função de
-- auditoria, mesmo sendo idêntica em estrutura à de 20260831170000.
--
-- Sessão sem acesso ao repo de origem (Flowlab_Controle_Qualidade,
-- `qualidade_riscos_schema.sql`) — os valores de `status` e `resultado`
-- abaixo são uma escolha razoável desta sessão, não uma cópia confirmada do
-- desenho original; ajustar se divergir.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. Auditoria — trigger genérico próprio deste módulo ──────────────────
-- Cópia estrutural de `qa_riscos_modulo_auditoria_trigger` (20260831170000)
-- — não reaproveitada de propósito, para não criar uma dependência de
-- migration entre contingência e o schema de risco (ver nota acima).

CREATE OR REPLACE FUNCTION qa_contingencia_modulo_auditoria_trigger()
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

-- ─── 1. qa_planos_contingencia ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_planos_contingencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  setor_id uuid NOT NULL REFERENCES qa_setores(id),
  evento text NOT NULL,
  cenario text NOT NULL,
  impactos text,
  gatilho_acionamento text NOT NULL,
  acoes_imediatas text NOT NULL,
  responsaveis text,
  comunicacao text,
  materiais text,
  fornecedor_alternativo text,
  prazo_maximo_interrupcao text,
  status text NOT NULL DEFAULT 'ativo'
    CONSTRAINT qa_planos_contingencia_status_check CHECK (status IN ('ativo', 'em_revisao', 'inativo')),
  documento jsonb,
  criado_por uuid NOT NULL REFERENCES user_profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES user_profiles(id),
  atualizado_em timestamptz,
  CONSTRAINT qa_planos_contingencia_codigo_unique UNIQUE (codigo)
);

CREATE INDEX IF NOT EXISTS idx_qa_planos_contingencia_setor_id ON qa_planos_contingencia(setor_id);

COMMENT ON COLUMN qa_planos_contingencia.documento IS 'Objeto único {path, nome, tamanho} — path aponta para o bucket qa-contingencia-documentos (privado, leitura via signed URL). null até o documento ser anexado.';

ALTER TABLE qa_planos_contingencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_planos_contingencia_select ON qa_planos_contingencia;
CREATE POLICY "qa_planos_contingencia_select" ON qa_planos_contingencia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_planos_contingencia_insert ON qa_planos_contingencia;
CREATE POLICY "qa_planos_contingencia_insert" ON qa_planos_contingencia
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- UPDATE existe para permitir anexar documento depois da criação (mesmo
-- padrão de `evidencias` em qa_planos_acao) e para editar status.
DROP POLICY IF EXISTS qa_planos_contingencia_update ON qa_planos_contingencia;
CREATE POLICY "qa_planos_contingencia_update" ON qa_planos_contingencia
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP TRIGGER IF EXISTS trg_qa_planos_contingencia_auditoria ON qa_planos_contingencia;
CREATE TRIGGER trg_qa_planos_contingencia_auditoria
  AFTER INSERT OR UPDATE ON qa_planos_contingencia
  FOR EACH ROW
  EXECUTE FUNCTION qa_contingencia_modulo_auditoria_trigger();

-- ─── 2. qa_testes_contingencia — histórico de testes ───────────────────────
-- Sem UPDATE/DELETE de propósito (nenhuma policy criada para essas ações) —
-- registrar um teste novo é sempre um INSERT, nunca sobrescreve o anterior.

CREATE TABLE IF NOT EXISTS qa_testes_contingencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES qa_planos_contingencia(id),
  data_teste date NOT NULL,
  resultado text NOT NULL
    CONSTRAINT qa_testes_contingencia_resultado_check CHECK (resultado IN ('aprovado', 'aprovado_com_ressalvas', 'reprovado')),
  necessidade_melhoria boolean NOT NULL DEFAULT false,
  descricao_melhoria text,
  proxima_data_prevista date,
  observacoes text,
  registrado_por uuid NOT NULL REFERENCES user_profiles(id),
  registrado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_testes_contingencia_plano_id ON qa_testes_contingencia(plano_id);

COMMENT ON TABLE qa_testes_contingencia IS 'Histórico de testes de um plano de contingência — nunca sobrescreve um teste anterior, sempre uma linha nova.';

ALTER TABLE qa_testes_contingencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qa_testes_contingencia_select ON qa_testes_contingencia;
CREATE POLICY "qa_testes_contingencia_select" ON qa_testes_contingencia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_testes_contingencia_insert ON qa_testes_contingencia;
CREATE POLICY "qa_testes_contingencia_insert" ON qa_testes_contingencia
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP TRIGGER IF EXISTS trg_qa_testes_contingencia_auditoria ON qa_testes_contingencia;
CREATE TRIGGER trg_qa_testes_contingencia_auditoria
  AFTER INSERT ON qa_testes_contingencia
  FOR EACH ROW
  EXECUTE FUNCTION qa_contingencia_modulo_auditoria_trigger();

-- ─── 3. Bucket de storage para documento do plano de contingência ──────────
-- Molde: qa-riscos-evidencias (20260831180000_qualidade_riscos_gerenciamento.sql)
-- — privado, SPA sobe/lê direto via supabase-js (authenticated), leitura por
-- signed URL de curta duração.

INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-contingencia-documentos', 'qa-contingencia-documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "qa_contingencia_documentos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "qa_contingencia_documentos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "qa_contingencia_documentos_storage_delete" ON storage.objects;

CREATE POLICY "qa_contingencia_documentos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qa-contingencia-documentos');

CREATE POLICY "qa_contingencia_documentos_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qa-contingencia-documentos');

CREATE POLICY "qa_contingencia_documentos_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'qa-contingencia-documentos');

COMMIT;
