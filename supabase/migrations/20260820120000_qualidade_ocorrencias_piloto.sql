-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — piloto Ocorrências
-- Migration: 20260820120000_qualidade_ocorrencias_piloto.sql
--
-- Porte de um módulo desenvolvido em separado (flowlab-qualidade) para dentro
-- do FlowLab (via /add-module). Confirmado neste banco (projeto apontado por
-- SUPABASE_URL, eqzqkztgzcngnxmihdom): `user_profiles`, `custom_roles`,
-- `module_categories` e `current_user_has_permission()` já existem, com dado
-- real (46 perfis). `qa_ocorrencias`, `qa_motivos_ocorrencia`, `app_auditoria`,
-- `app_parametros`, `app_setores` TAMBÉM já existem aqui — são as tabelas que o
-- projeto flowlab-qualidade criou e sincronizou com o LIS ao longo do
-- desenvolvimento (793 linhas reais em qa_ocorrencias, contagem conferida via
-- REST antes de escrever esta migration). Esta migration NÃO cria nada que já
-- existe — só adapta RLS/constraints.
--
-- Critério de acesso: ao contrário da primeira versão desta migration (que
-- usava department = 'Qualidade' via user_roles_view, fora do catálogo de
-- permissões), esta versão usa o mecanismo padrão do FlowLab —
-- current_user_has_permission('canViewQualidade' | 'canManageQualidade') —
-- para ficar consistente com os demais módulos (ver src/utils/permissions.ts).
-- Isso significa que o acesso não é mais automático para todo mundo com
-- department = 'Qualidade': é preciso atribuir um cargo (custom_roles) com
-- essas chaves aos usuários do departamento — nenhum cargo é seedado aqui de
-- propósito, pois canManageQualidade dá acesso de curadoria e não deve ser
-- concedido por padrão a ninguém (nem ao cargo "Solicitante" default).
--
-- Escopo: esta migration só toca RLS/constraints de qa_ocorrencias,
-- qa_motivos_ocorrencia, app_setores, app_parametros, app_auditoria — não
-- mexe em nenhuma tabela/policy de Cortesias, IHQ, Câncer, nem em nada do
-- FlowLab fora do escopo de Qualidade (products, quotations,
-- analises-clinicas, etc. inalterados).
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md). A sincronização com o LIS
-- (sync-ocorrencias e as demais ações de /api/qualidade/*) não está coberta
-- por esta migration — ver issue correspondente em .scratch/qualidade/.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Liberar curado_por/colaborador_confirmado_por para apontar para
-- user_profiles em vez de app_usuarios ────────────────────────────────────────
--
-- Só 4 das 793 linhas têm curado_por preenchido hoje, e as 4 apontam para o
-- único usuário de teste fake de app_usuarios (nunca usado por ninguém
-- real) — zera essas 4 antes de trocar o alvo da FK, para a constraint nova
-- não falhar. Não é perda de auditoria: o valor histórico continua em
-- app_auditoria (JSONB, sem FK), só a coluna "atual" de qa_ocorrencias é
-- que precisa ficar consistente com o novo alvo.

UPDATE qa_ocorrencias
SET curado_por = NULL
WHERE curado_por IS NOT NULL
  AND curado_por NOT IN (SELECT id FROM user_profiles);

UPDATE qa_ocorrencias
SET colaborador_confirmado_por = NULL
WHERE colaborador_confirmado_por IS NOT NULL
  AND colaborador_confirmado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE qa_ocorrencias DROP CONSTRAINT IF EXISTS qa_ocorrencias_curado_por_fkey;
ALTER TABLE qa_ocorrencias
  ADD CONSTRAINT qa_ocorrencias_curado_por_fkey
  FOREIGN KEY (curado_por) REFERENCES user_profiles(id);

ALTER TABLE qa_ocorrencias DROP CONSTRAINT IF EXISTS qa_ocorrencias_colaborador_confirmado_por_fkey;
ALTER TABLE qa_ocorrencias
  ADD CONSTRAINT qa_ocorrencias_colaborador_confirmado_por_fkey
  FOREIGN KEY (colaborador_confirmado_por) REFERENCES user_profiles(id);

-- app_parametros.atualizado_por e app_auditoria.autor também referenciam
-- app_usuarios — mesmo tratamento, mesmo raciocínio (não há linha real
-- gravada por ninguém de user_profiles ainda, então zerar é seguro).

UPDATE app_parametros
SET atualizado_por = NULL
WHERE atualizado_por IS NOT NULL
  AND atualizado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE app_parametros DROP CONSTRAINT IF EXISTS app_parametros_atualizado_por_fkey;
ALTER TABLE app_parametros
  ADD CONSTRAINT app_parametros_atualizado_por_fkey
  FOREIGN KEY (atualizado_por) REFERENCES user_profiles(id);

-- app_auditoria.autor é NOT NULL e tem 27 linhas reais, todas do usuário de
-- teste fake — aqui não dá para simplesmente zerar (quebraria a coluna
-- NOT NULL). Trocamos a FK para apontar para user_profiles, mas SEM validar
-- as linhas existentes (NOT VALID) — o histórico anterior a esta migration
-- fica como está (referenciando um id que não existe mais em user_profiles,
-- só não é mais checado); toda escrita NOVA passa a exigir um autor real de
-- user_profiles.
ALTER TABLE app_auditoria DROP CONSTRAINT IF EXISTS app_auditoria_autor_fkey;
ALTER TABLE app_auditoria
  ADD CONSTRAINT app_auditoria_autor_fkey
  FOREIGN KEY (autor) REFERENCES user_profiles(id) NOT VALID;

-- ─── 2. RLS de qa_ocorrencias ───────────────────────────────────────────────

DROP POLICY IF EXISTS qa_ocorrencias_select ON qa_ocorrencias;
CREATE POLICY "qa_ocorrencias_select" ON qa_ocorrencias
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_ocorrencias_insert ON qa_ocorrencias;
CREATE POLICY "qa_ocorrencias_insert" ON qa_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

DROP POLICY IF EXISTS qa_ocorrencias_update ON qa_ocorrencias;
CREATE POLICY "qa_ocorrencias_update" ON qa_ocorrencias
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- ─── 3. RLS de qa_motivos_ocorrencia (vocabulário de curadoria) ────────────────

DROP POLICY IF EXISTS qa_motivos_ocorrencia_select ON qa_motivos_ocorrencia;
CREATE POLICY "qa_motivos_ocorrencia_select" ON qa_motivos_ocorrencia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

DROP POLICY IF EXISTS qa_motivos_ocorrencia_write ON qa_motivos_ocorrencia;
CREATE POLICY "qa_motivos_ocorrencia_write" ON qa_motivos_ocorrencia
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageQualidade'))
  WITH CHECK (public.current_user_has_permission('canManageQualidade'));

-- ─── 3b. RLS de app_setores (a tela de curadoria de Ocorrências lê a lista
-- de setores para "setor do erro") ──────────────────────────────────────────

DROP POLICY IF EXISTS app_setores_select ON app_setores;
CREATE POLICY "app_setores_select" ON app_setores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- ─── 4. RLS de app_parametros (parâmetros de negócio, P5) e app_auditoria ──────
-- Compartilhadas por todos os módulos qa_* (Ocorrências/Cortesias/IHQ/Câncer),
-- não só Ocorrências — mas bloqueadas para qualquer usuário real do FlowLab
-- hoje (app_usuario_ativo()/app_papel_atual() só reconhecem app_usuarios).
-- Ajustadas aqui porque são pré-requisito para qualquer um dos módulos
-- funcionar com usuários reais, não só o piloto de Ocorrências.

DROP POLICY IF EXISTS app_parametros_select ON app_parametros;
-- Leitura restrita às chaves que o módulo Qualidade consome (`cancer.*` nos
-- parametros fixos de Câncer e `ihq.tat_alerta_dias` nos indicadores de IHQ)
-- — sem o filtro, canViewQualidade enxergaria TODAS as chaves da tabela
-- compartilhada, inclusive de outros módulos.
CREATE POLICY "app_parametros_select" ON app_parametros
  FOR SELECT TO authenticated
  USING (
    (
      public.current_user_has_permission('canViewQualidade')
      OR public.current_user_has_permission('canManageQualidade')
    )
    AND (chave LIKE 'cancer.%' OR chave LIKE 'ihq.%')
  );

DROP POLICY IF EXISTS app_parametros_write ON app_parametros;
-- Restrita às chaves `cancer.*`: é o único módulo do frontend que ESCREVE em
-- app_parametros (atualizarParametroFixoCancer, sempre com o prefixo
-- `cancer.`) — sem o filtro por chave, qualquer usuário com
-- canManageQualidade ganharia escrita sobre TODAS as linhas da tabela
-- compartilhada (chaves de outros módulos).
CREATE POLICY "app_parametros_write" ON app_parametros
  FOR ALL TO authenticated
  USING (
    public.current_user_has_permission('canManageQualidade')
    AND chave LIKE 'cancer.%'
  )
  WITH CHECK (
    public.current_user_has_permission('canManageQualidade')
    AND chave LIKE 'cancer.%'
  );

DROP POLICY IF EXISTS app_auditoria_select ON app_auditoria;
CREATE POLICY "app_auditoria_select" ON app_auditoria
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- app_auditoria_insert já é `for insert to service_role with check (true)` —
-- não precisa mudar, service_role sempre bypassa RLS mesmo.

-- ─── 4b. Trigger de auditoria em qa_ocorrencias ────────────────────────────────
-- Curadoria é um `update` direto do frontend (RLS, sem handler no meio) —
-- sem um trigger, a auditoria simplesmente para de acontecer. Audita só
-- quando uma coluna de CURADORIA muda (nunca quando é só o sync escrevendo
-- o espelho), autor = auth.uid() (funciona porque a escrita agora é
-- autenticada como o próprio usuário, não service_role).

CREATE OR REPLACE FUNCTION qa_ocorrencias_mudou_curadoria(old_row qa_ocorrencias, new_row qa_ocorrencias)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT old_row.colaborador_id IS DISTINCT FROM new_row.colaborador_id
      OR old_row.setor_erro_id IS DISTINCT FROM new_row.setor_erro_id
      OR old_row.motivo_id IS DISTINCT FROM new_row.motivo_id
      OR old_row.resumo_curado IS DISTINCT FROM new_row.resumo_curado
      OR old_row.acao_curada IS DISTINCT FROM new_row.acao_curada;
$$;

CREATE OR REPLACE FUNCTION qa_ocorrencias_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF qa_ocorrencias_mudou_curadoria(OLD, NEW) AND auth.uid() IS NOT NULL THEN
    INSERT INTO app_auditoria (tabela, registro_id, acao, antes, depois, autor)
    VALUES (
      'qa_ocorrencias',
      NEW.id,
      'update',
      jsonb_build_object(
        'colaborador_id', OLD.colaborador_id, 'setor_erro_id', OLD.setor_erro_id,
        'motivo_id', OLD.motivo_id, 'resumo_curado', OLD.resumo_curado, 'acao_curada', OLD.acao_curada,
        'curado_por', OLD.curado_por, 'curado_em', OLD.curado_em
      ),
      jsonb_build_object(
        'colaborador_id', NEW.colaborador_id, 'setor_erro_id', NEW.setor_erro_id,
        'motivo_id', NEW.motivo_id, 'resumo_curado', NEW.resumo_curado, 'acao_curada', NEW.acao_curada,
        'curado_por', NEW.curado_por, 'curado_em', NEW.curado_em
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_ocorrencias_auditoria ON qa_ocorrencias;
CREATE TRIGGER trg_qa_ocorrencias_auditoria
  AFTER UPDATE ON qa_ocorrencias
  FOR EACH ROW
  EXECUTE FUNCTION qa_ocorrencias_auditoria_trigger();

-- Sync (service role) também passa por este AFTER UPDATE, mas nunca toca
-- colunas de curadoria (ver handler sync-ocorrencias.ts, ainda por escrever) —
-- a condição `qa_ocorrencias_mudou_curadoria` já garante que o sync nunca
-- gera auditoria por si só; `auth.uid() IS NOT NULL` é uma segunda trava (uma
-- conexão de service role não tem auth.uid()).

-- ─── 5. Menu — adiciona "Qualidade" em module_categories ───────────────────────
-- Acréscimo aditivo (nunca sobrescrever o array inteiro, só adicionar se
-- ainda não estiver lá).

UPDATE module_categories
SET items = items || '["Qualidade"]'::jsonb
WHERE id = 'operacoes'
  AND NOT (items @> '["Qualidade"]'::jsonb);

COMMIT;
