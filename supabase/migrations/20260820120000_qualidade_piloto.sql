-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — piloto completo (Ocorrências, Cortesias, IHQ, Registro de
-- Câncer, bucket de exportação RHC e função de registro de exportação)
-- Migration: 20260820120000_qualidade_piloto.sql
--
-- Consolida em UM único arquivo (uma única transação) as 6 migrations que
-- antes formavam o deploy inicial do módulo — mantidas separadas só durante
-- o desenvolvimento, nunca aplicadas em nenhum ambiente (confirmado via
-- `supabase migration list` contra produção antes de juntar):
--   20260820120000_qualidade_ocorrencias_piloto.sql
--   20260820130000_qualidade_cortesias_piloto.sql
--   20260820140000_qualidade_ihq_piloto.sql
--   20260820150000_qualidade_cancer_piloto.sql
--   20260820160000_qualidade_exportacoes_rhc_bucket.sql
--   20260821090000_qualidade_registrar_exportacao_rhc_fn.sql
-- Nada nelas dependia de rodar em transações separadas — juntar deixa o
-- deploy inicial do módulo atômico (tudo ou nada) em vez de 6 passos.
--
-- Porte de um módulo desenvolvido em separado (flowlab-qualidade) para dentro
-- do FlowLab (via /add-module). Confirmado no banco de TESTE (projeto
-- apontado por SUPABASE_URL, eqzqkztgzcngnxmihdom, "FlowLab - test"):
-- `user_profiles`, `custom_roles`, `module_categories` e
-- `current_user_has_permission()` já existem lá, com dado real (46 perfis),
-- e as 14 tabelas de cada submódulo (ver cabeçalho de cada PARTE abaixo)
-- TAMBÉM já existem lá — foram criadas e sincronizadas com o LIS ao longo do
-- desenvolvimento separado de flowlab-qualidade.
--
-- ⚠️ CORREÇÃO (2026-08-21, depois de uma tentativa real de aplicar em
-- produção falhar com "relation qa_ocorrencias does not exist"): o texto
-- acima descreve o projeto de TESTE, não produção — são projetos Supabase
-- DIFERENTES (confirmado: `eqzqkztgzcngnxmihdom` nem aparece na lista de
-- projetos do org em produção). Checagem direta em produção
-- (`jqxeqmeikqclmmongclj`, "Flow-Lab: Produção") via `supabase db query
-- --linked` mostrou ZERO das 14 tabelas do módulo — só `user_profiles`/
-- `custom_roles`/`module_categories`/`current_user_has_permission()`
-- (infra genérica) existem lá. A PARTE -1 abaixo foi adicionada para cobrir
-- isso: cria as 14 tabelas do zero (`CREATE TABLE IF NOT EXISTS`, schema
-- extraído por introspecção do projeto de teste — colunas, tipos, defaults,
-- PK/FK/UNIQUE/CHECK e índices, via `information_schema`/`pg_catalog`, já
-- que `supabase db dump` exige Docker, indisponível neste ambiente). Com
-- isso, a migration funciona tanto em produção (cria tudo do zero) quanto
-- no projeto de teste (onde as 4 tabelas `app_*` já existem sob esse nome —
-- `IF NOT EXISTS` não interfere, e a PARTE 0 renomeia normalmente).
--
-- Acesso por current_user_has_permission('canViewQualidade' |
-- 'canManageQualidade') — mecanismo padrão do FlowLab (ver
-- src/utils/permissions.ts), não o antigo department = 'Qualidade'. Isso
-- significa que o acesso não é automático para todo mundo do departamento:
-- é preciso atribuir um cargo (custom_roles) com essas chaves — nenhum cargo
-- é seedado aqui de propósito, pois canManageQualidade dá acesso de
-- curadoria e não deve ser concedido por padrão a ninguém.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══ PARTE -1 — Cria as 14 tabelas do módulo (produção não tinha nenhuma) ═══
-- CREATE TABLE IF NOT EXISTS: em produção cria tudo do zero; no projeto de
-- teste (onde já existem) é no-op. Ordem de criação respeita as FKs entre
-- elas (uma tabela referenciada nunca vem depois de quem a referencia).
-- Schema extraído por introspecção do projeto de teste (eqzqkztgzcngnxmihdom)
-- em 2026-08-21 — colunas/tipos/defaults/constraints/índices conferidos via
-- information_schema.columns + pg_constraint + pg_indexes.
--
-- Todas as FKs para user_profiles(id) foram DEIXADAS DE FORA daqui de
-- propósito — são adicionadas pelas PARTEs A/C/D logo abaixo (que já fazem
-- o "zera valor órfão antes de criar a FK", desnecessário numa tabela recém
-- criada e vazia, mas mantido por uniformidade com o restante do arquivo).

CREATE TABLE IF NOT EXISTS app_setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT app_setores_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS app_parametros (
  chave text PRIMARY KEY,
  modulo text NOT NULL,
  valor jsonb NOT NULL,
  descricao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

CREATE TABLE IF NOT EXISTS app_auditoria (
  id bigserial PRIMARY KEY,
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  acao text NOT NULL CONSTRAINT app_auditoria_acao_check CHECK (acao IN ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb,
  autor uuid NOT NULL,
  em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_auditoria_tabela_registro_id_em_idx ON app_auditoria (tabela, registro_id, em DESC);

CREATE TABLE IF NOT EXISTS app_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor_id uuid REFERENCES app_setores(id),
  id_usuario_lis integer,
  ativo boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS app_colaboradores_lower_idx ON app_colaboradores (lower(nome));

CREATE TABLE IF NOT EXISTS qa_motivos_ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor_tipico_id uuid REFERENCES app_setores(id),
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT qa_motivos_ocorrencia_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS qa_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_ocorrencia_lis integer NOT NULL,
  num_cod integer,
  dta_ocorrencia date NOT NULL,
  cod_requisicao text,
  descricao_lis text,
  acao_imediata_lis text,
  cau_descricao_lis text,
  setor_responsavel_qualidade_lis text,
  categoria_origem_codigo integer,
  categoria_origem_lis text,
  categoria_origem_generica boolean NOT NULL DEFAULT false,
  colaborador_id uuid REFERENCES app_colaboradores(id),
  colaborador_proveniencia text NOT NULL DEFAULT 'curadoria',
  colaborador_confianca text CONSTRAINT qa_ocorrencias_colaborador_confianca_check CHECK (colaborador_confianca IN ('alta', 'media', 'baixa', 'nenhuma')),
  colaborador_sugestao_texto text,
  colaborador_confirmado_por uuid,
  colaborador_confirmado_em timestamptz,
  setor_erro_id uuid REFERENCES app_setores(id),
  motivo_id uuid REFERENCES qa_motivos_ocorrencia(id),
  resumo_curado text,
  acao_curada text,
  status_curadoria text NOT NULL DEFAULT 'pendente' CONSTRAINT qa_ocorrencias_status_curadoria_check CHECK (status_curadoria IN ('pendente', 'concluida')),
  curado_por uuid,
  curado_em timestamptz,
  revisao_pendente boolean NOT NULL DEFAULT false,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_ocorrencias_id_ocorrencia_lis_key UNIQUE (id_ocorrencia_lis)
);
CREATE INDEX IF NOT EXISTS qa_ocorrencias_dta_ocorrencia_idx ON qa_ocorrencias (dta_ocorrencia);
CREATE INDEX IF NOT EXISTS qa_ocorrencias_status_curadoria_idx ON qa_ocorrencias (status_curadoria);

CREATE TABLE IF NOT EXISTS qa_motivos_cortesia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT qa_motivos_cortesia_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS qa_classificacoes_cortesia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  CONSTRAINT qa_classificacoes_cortesia_nome_key UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS qa_cotas_cortesia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id_lis integer,
  medico_crm text,
  cota_mensal integer NOT NULL CONSTRAINT qa_cotas_cortesia_cota_mensal_check CHECK (cota_mensal >= 0),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  observacoes text,
  CONSTRAINT qa_cotas_cortesia_check CHECK (clinica_id_lis IS NOT NULL OR medico_crm IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS qa_cotas_cortesia_clinica_id_lis_idx ON qa_cotas_cortesia (clinica_id_lis);

CREATE TABLE IF NOT EXISTS qa_cortesias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_requisicao_lis integer NOT NULL,
  cod_requisicao text NOT NULL,
  dta_solicitacao date NOT NULL,
  dta_autorizacao date,
  clinica_id_lis integer,
  clinica_nome text,
  exame_nome text,
  medico_crm text,
  valor_particular numeric(12, 2),
  valor_cobrado numeric(12, 2),
  valor_concedido numeric(12, 2),
  autorizado_por_lis text,
  observacoes_lis text,
  parsing_falhou boolean NOT NULL DEFAULT false,
  dias_ate_autorizacao integer,
  situacao_prazo text CONSTRAINT qa_cortesias_situacao_prazo_check CHECK (situacao_prazo IN ('dentro_prazo', 'fora_prazo', 'sem_autorizacao')),
  aprovada_fora_do_prazo boolean NOT NULL DEFAULT false,
  divergencia_valores boolean NOT NULL DEFAULT false,
  preco_cortesia_nao_cadastrado boolean NOT NULL DEFAULT false,
  motivo_id uuid REFERENCES qa_motivos_cortesia(id),
  classificacao_id uuid REFERENCES qa_classificacoes_cortesia(id),
  autorizado_por_corrigido uuid REFERENCES app_colaboradores(id),
  observacoes_curadas text,
  status_curadoria text NOT NULL DEFAULT 'pendente' CONSTRAINT qa_cortesias_status_curadoria_check CHECK (status_curadoria IN ('pendente', 'em_analise', 'concluida', 'descartada')),
  curado_por uuid,
  curado_em timestamptz,
  revisao_pendente boolean NOT NULL DEFAULT false,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  valor_concedido_corrigido numeric(12, 2),
  valor_particular_corrigido numeric(12, 2),
  CONSTRAINT qa_cortesias_cod_requisicao_key UNIQUE (cod_requisicao)
);
CREATE INDEX IF NOT EXISTS qa_cortesias_dta_autorizacao_idx ON qa_cortesias (dta_autorizacao);
CREATE INDEX IF NOT EXISTS qa_cortesias_dta_solicitacao_idx ON qa_cortesias (dta_solicitacao);
CREATE INDEX IF NOT EXISTS qa_cortesias_situacao_prazo_idx ON qa_cortesias (situacao_prazo);
CREATE INDEX IF NOT EXISTS qa_cortesias_status_curadoria_idx ON qa_cortesias (status_curadoria);

CREATE TABLE IF NOT EXISTS qa_ihq_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_requisicao_ihq integer NOT NULL,
  cod_requisicao_ihq text NOT NULL,
  id_tarefa_bloco integer,
  dta_admissao date,
  dta_solicitacao_bloco date,
  medico_solicitante text,
  status_lis text CONSTRAINT qa_ihq_solicitacoes_status_lis_check CHECK (status_lis IN ('concluido', 'cancelado', 'em_andamento')),
  id_requisicao_original integer,
  cod_requisicao_original text,
  vinculo_proveniencia text NOT NULL DEFAULT 'heuristica' CONSTRAINT qa_ihq_solicitacoes_vinculo_proveniencia_check CHECK (vinculo_proveniencia IN ('heuristica', 'manual')),
  vinculo_confianca text CONSTRAINT qa_ihq_solicitacoes_vinculo_confianca_check CHECK (vinculo_confianca IN ('alta', 'media', 'baixa', 'nenhuma')),
  vinculo_confirmado_por uuid,
  vinculo_confirmado_em timestamptz,
  material_lis text,
  patologista_lis text,
  dta_envio_bloco date,
  dta_envio_proveniencia text CONSTRAINT qa_ihq_solicitacoes_dta_envio_proveniencia_check CHECK (dta_envio_proveniencia IN ('texto_livre', 'curadoria')),
  dta_envio_texto_original text,
  dta_retorno_bloco date,
  bloco_retornou boolean,
  lamina_enviada boolean,
  observacoes text,
  status_curadoria text NOT NULL DEFAULT 'pendente' CONSTRAINT qa_ihq_solicitacoes_status_curadoria_check CHECK (status_curadoria IN ('pendente', 'em_analise', 'concluida', 'descartada')),
  curado_por uuid,
  curado_em timestamptz,
  revisao_pendente boolean NOT NULL DEFAULT false,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_ihq_solicitacoes_id_requisicao_ihq_id_tarefa_bloco_key UNIQUE (id_requisicao_ihq, id_tarefa_bloco)
);
CREATE INDEX IF NOT EXISTS qa_ihq_solicitacoes_dta_admissao_idx ON qa_ihq_solicitacoes (dta_admissao);
CREATE INDEX IF NOT EXISTS qa_ihq_solicitacoes_status_curadoria_idx ON qa_ihq_solicitacoes (status_curadoria);
CREATE INDEX IF NOT EXISTS qa_ihq_solicitacoes_vinculo_confianca_idx ON qa_ihq_solicitacoes (vinculo_confianca);

CREATE TABLE IF NOT EXISTS qa_cido_catalogo (
  codigo text PRIMARY KEY,
  tipo text NOT NULL CONSTRAINT qa_cido_catalogo_tipo_check CHECK (tipo IN ('topografia', 'morfologia')),
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS qa_cido_catalogo_tipo_descricao_idx ON qa_cido_catalogo (tipo, descricao);

CREATE TABLE IF NOT EXISTS qa_exportacoes_rhc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  trimestre integer NOT NULL CONSTRAINT qa_exportacoes_rhc_trimestre_check CHECK (trimestre >= 1 AND trimestre <= 4),
  storage_path text NOT NULL,
  hash_arquivo text NOT NULL,
  total_casos integer NOT NULL,
  registrador text NOT NULL,
  gerado_por uuid NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qa_cancer_casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_requisicao_lis integer NOT NULL,
  cod_requisicao text NOT NULL,
  dta_diagnostico date NOT NULL,
  dta_coleta date,
  dta_coleta_divergente boolean NOT NULL DEFAULT false,
  patologista_laudo text,
  laudo_hash text,
  triagem text NOT NULL DEFAULT 'pendente' CONSTRAINT qa_cancer_casos_triagem_check CHECK (triagem IN ('pendente', 'cancer_confirmado', 'nao_cancer', 'inconclusivo')),
  triagem_justificativa text,
  triado_por uuid,
  triado_em timestamptz,
  cido_topografia_codigo text REFERENCES qa_cido_catalogo(codigo),
  cido_morfologia_codigo text REFERENCES qa_cido_catalogo(codigo),
  classificado_por uuid,
  classificado_em timestamptz,
  exportacao_id uuid REFERENCES qa_exportacoes_rhc(id),
  observacoes text,
  revisao_pendente boolean NOT NULL DEFAULT false,
  sincronizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_cancer_casos_cod_requisicao_key UNIQUE (cod_requisicao),
  CONSTRAINT qa_cancer_casos_check CHECK (
    triagem <> 'cancer_confirmado'
    OR (cido_topografia_codigo IS NOT NULL AND cido_morfologia_codigo IS NOT NULL)
    OR exportacao_id IS NULL
  )
);
CREATE INDEX IF NOT EXISTS qa_cancer_casos_dta_diagnostico_idx ON qa_cancer_casos (dta_diagnostico);
CREATE INDEX IF NOT EXISTS qa_cancer_casos_triagem_idx ON qa_cancer_casos (triagem);

-- RLS ligado explicitamente para as 14 (idempotente — ALTER ... ENABLE já
-- ligado é no-op). Necessário mesmo para as que já existiam no projeto de
-- teste (lá já estava ligado), mas é ESSENCIAL para uma tabela recém-criada
-- em produção: sem isto, authenticated/anon enxergariam todas as linhas via
-- PostgREST antes mesmo das policies abaixo existirem.
ALTER TABLE app_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_motivos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_motivos_cortesia ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_classificacoes_cortesia ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cotas_cortesia ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cortesias ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_ihq_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cido_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_exportacoes_rhc ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_cancer_casos ENABLE ROW LEVEL SECURITY;


-- ─── PARTE 0 — Renomeia tabelas legadas app_* para qa_* ────────────────────
-- app_auditoria/app_parametros/app_setores (usadas por Ocorrências, e
-- app_auditoria/app_parametros também pelas demais PARTES) e
-- app_colaboradores (usadas por Ocorrências e Cortesias). IF EXISTS torna
-- idempotente: se a migration já rodou antes, vira no-op. Precisa vir ANTES
-- de tudo que segue neste arquivo, que já referencia os nomes novos.

ALTER TABLE IF EXISTS app_auditoria RENAME TO qa_auditoria;
ALTER TABLE IF EXISTS app_parametros RENAME TO qa_parametros;
ALTER TABLE IF EXISTS app_setores RENAME TO qa_setores;
ALTER TABLE IF EXISTS app_colaboradores RENAME TO qa_colaboradores;


-- ═══ PARTE A — Ocorrências ═══════════════════════════════════════════════
-- qa_ocorrencias/qa_motivos_ocorrencia (793 linhas reais em qa_ocorrencias,
-- contagem conferida via REST) JÁ EXISTEM no banco compartilhado.

-- ─── A1. Liberar curado_por/colaborador_confirmado_por para apontar para
-- user_profiles em vez de app_usuarios ────────────────────────────────────
-- Só 4 das 793 linhas têm curado_por preenchido hoje, e as 4 apontam para o
-- único usuário de teste fake de app_usuarios (nunca usado por ninguém
-- real) — zera essas 4 antes de trocar o alvo da FK, para a constraint nova
-- não falhar. Não é perda de auditoria: o valor histórico continua em
-- qa_auditoria (JSONB, sem FK), só a coluna "atual" de qa_ocorrencias é
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

-- qa_parametros.atualizado_por e qa_auditoria.autor também referenciam
-- app_usuarios — mesmo tratamento, mesmo raciocínio (não há linha real
-- gravada por ninguém de user_profiles ainda, então zerar é seguro).

UPDATE qa_parametros
SET atualizado_por = NULL
WHERE atualizado_por IS NOT NULL
  AND atualizado_por NOT IN (SELECT id FROM user_profiles);

ALTER TABLE qa_parametros DROP CONSTRAINT IF EXISTS qa_parametros_atualizado_por_fkey;
ALTER TABLE qa_parametros
  ADD CONSTRAINT qa_parametros_atualizado_por_fkey
  FOREIGN KEY (atualizado_por) REFERENCES user_profiles(id);

-- qa_auditoria.autor é NOT NULL e tem 27 linhas reais, todas do usuário de
-- teste fake — aqui não dá para simplesmente zerar (quebraria a coluna
-- NOT NULL). Trocamos a FK para apontar para user_profiles, mas SEM validar
-- as linhas existentes (NOT VALID) — o histórico anterior a esta migration
-- fica como está (referenciando um id que não existe mais em user_profiles,
-- só não é mais checado); toda escrita NOVA passa a exigir um autor real de
-- user_profiles.
ALTER TABLE qa_auditoria DROP CONSTRAINT IF EXISTS qa_auditoria_autor_fkey;
ALTER TABLE qa_auditoria
  ADD CONSTRAINT qa_auditoria_autor_fkey
  FOREIGN KEY (autor) REFERENCES user_profiles(id) NOT VALID;

-- ─── A2. RLS de qa_ocorrencias ──────────────────────────────────────────

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

-- ─── A3. RLS de qa_motivos_ocorrencia (vocabulário de curadoria) ─────────

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

-- ─── A4. RLS de qa_setores (a tela de curadoria de Ocorrências lê a lista
-- de setores para "setor do erro") ────────────────────────────────────────

DROP POLICY IF EXISTS qa_setores_select ON qa_setores;
CREATE POLICY "qa_setores_select" ON qa_setores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- ─── A5. RLS de qa_parametros (parâmetros de negócio, P5) e qa_auditoria ──
-- Compartilhadas por todos os módulos qa_* (Ocorrências/Cortesias/IHQ/Câncer),
-- não só Ocorrências — mas bloqueadas para qualquer usuário real do FlowLab
-- hoje (app_usuario_ativo()/app_papel_atual() só reconhecem app_usuarios).
-- Ajustadas aqui porque são pré-requisito para qualquer um dos módulos
-- funcionar com usuários reais, não só Ocorrências.

DROP POLICY IF EXISTS qa_parametros_select ON qa_parametros;
-- Leitura restrita às chaves que o módulo Qualidade consome (`cancer.*` nos
-- parametros fixos de Câncer e `ihq.tat_alerta_dias` nos indicadores de IHQ)
-- — sem o filtro, canViewQualidade enxergaria TODAS as chaves da tabela
-- compartilhada, inclusive de outros módulos.
CREATE POLICY "qa_parametros_select" ON qa_parametros
  FOR SELECT TO authenticated
  USING (
    (
      public.current_user_has_permission('canViewQualidade')
      OR public.current_user_has_permission('canManageQualidade')
    )
    AND (chave LIKE 'cancer.%' OR chave LIKE 'ihq.%')
  );

DROP POLICY IF EXISTS qa_parametros_write ON qa_parametros;
-- Restrita às chaves `cancer.*`: é o único módulo do frontend que ESCREVE em
-- qa_parametros (atualizarParametroFixoCancer, sempre com o prefixo
-- `cancer.`) — sem o filtro por chave, qualquer usuário com
-- canManageQualidade ganharia escrita sobre TODAS as linhas da tabela
-- compartilhada (chaves de outros módulos).
CREATE POLICY "qa_parametros_write" ON qa_parametros
  FOR ALL TO authenticated
  USING (
    public.current_user_has_permission('canManageQualidade')
    AND chave LIKE 'cancer.%'
  )
  WITH CHECK (
    public.current_user_has_permission('canManageQualidade')
    AND chave LIKE 'cancer.%'
  );

DROP POLICY IF EXISTS qa_auditoria_select ON qa_auditoria;
CREATE POLICY "qa_auditoria_select" ON qa_auditoria
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- qa_auditoria_insert já é `for insert to service_role with check (true)` —
-- não precisa mudar, service_role sempre bypassa RLS mesmo.

-- ─── A6. Trigger de auditoria em qa_ocorrencias ──────────────────────────
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
    INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
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
-- colunas de curadoria (ver handler sync-ocorrencias.ts) — a condição
-- `qa_ocorrencias_mudou_curadoria` já garante que o sync nunca gera
-- auditoria por si só; `auth.uid() IS NOT NULL` é uma segunda trava (uma
-- conexão de service role não tem auth.uid()).

-- ─── A7. Menu — adiciona "Qualidade" em module_categories ────────────────
-- Acréscimo aditivo (nunca sobrescrever o array inteiro, só adicionar se
-- ainda não estiver lá).

UPDATE module_categories
SET items = items || '["Qualidade"]'::jsonb
WHERE id = 'operacoes'
  AND NOT (items @> '["Qualidade"]'::jsonb);


-- ═══ PARTE B — Cortesias ═════════════════════════════════════════════════
-- qa_cortesias/qa_motivos_cortesia/qa_classificacoes_cortesia/
-- qa_cotas_cortesia (120 linhas reais em qa_cortesias) JÁ EXISTEM no banco
-- compartilhado. `status_curadoria` aqui SHALL continuar com 4 estados
-- (pendente/em_analise/concluida/descartada) — Cortesias nunca passou pela
-- simplificação para binário que Ocorrências passou: curadoria aqui é
-- decisão humana genuína (motivo, classificação, quem autorizou, status),
-- não um espelho do LIS.

-- ─── B1. curado_por → user_profiles (mesmo tratamento de Ocorrências) ────
-- autorizado_por_corrigido continua apontando para qa_colaboradores — é
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

-- ─── B2. RLS de qa_cortesias, vocabulário e cotas ────────────────────────

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

-- qa_colaboradores: vocabulário de "autorizado por" (R6) — a tela de
-- curadoria de Cortesias precisa ler a lista.
DROP POLICY IF EXISTS qa_colaboradores_select ON qa_colaboradores;
CREATE POLICY "qa_colaboradores_select" ON qa_colaboradores
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewQualidade')
    OR public.current_user_has_permission('canManageQualidade')
  );

-- ─── B3. Trigger de auditoria em qa_cortesias ────────────────────────────

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
    INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
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


-- ═══ PARTE C — IHQ ═══════════════════════════════════════════════════════
-- qa_ihq_solicitacoes (97 linhas reais) JÁ EXISTE, criada fora do histórico
-- de supabase/migrations/ deste repositório (flowlab-qualidade, migrations
-- locais 20260812210000_ihq.sql + 20260819170000_qualidade_ihq_piloto.sql,
-- nunca portadas para cá).

-- ─── C1. curado_por / vinculo_confirmado_por → user_profiles ─────────────
-- Mesmo tratamento da PARTE A: zera qualquer valor que não aponte para um
-- user_profiles real antes de trocar o alvo da FK, para a constraint nova
-- não falhar.

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

-- ─── C2. RLS de qa_ihq_solicitacoes ───────────────────────────────────────
-- (ENABLE ROW LEVEL SECURITY já feito na PARTE -1.)

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

-- ─── C3. Trigger de auditoria em qa_ihq_solicitacoes ─────────────────────
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
    INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
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


-- ═══ PARTE D — Registro de Câncer ════════════════════════════════════════
-- qa_cido_catalogo, qa_exportacoes_rhc e qa_cancer_casos (311 linhas reais
-- em qa_cancer_casos) JÁ EXISTEM, criadas fora do histórico de
-- supabase/migrations/ deste repositório (flowlab-qualidade, migrations
-- locais 20260812220000_cancer.sql + 20260819180000_qualidade_cancer_piloto.sql,
-- nunca portadas para cá).
--
-- ⚠️ P10 (nenhuma PII de paciente nestas tabelas — nome/CPF/nome da
-- mãe/data de nascimento e texto do laudo são lidos do LIS sob demanda,
-- nunca persistidos aqui) continua valendo; esta PARTE não adiciona nenhuma
-- coluna nova, só ajusta RLS/FK.

-- ─── D1. triado_por / classificado_por (qa_cancer_casos) e gerado_por
-- (qa_exportacoes_rhc) → user_profiles ────────────────────────────────────

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
-- qa_auditoria.autor na PARTE A: troca a FK sem validar linhas históricas
-- (NOT VALID), para não quebrar se houver exportação antiga referenciando
-- um id que não existe mais em user_profiles.
ALTER TABLE qa_exportacoes_rhc DROP CONSTRAINT IF EXISTS qa_exportacoes_rhc_gerado_por_fkey;
ALTER TABLE qa_exportacoes_rhc
  ADD CONSTRAINT qa_exportacoes_rhc_gerado_por_fkey
  FOREIGN KEY (gerado_por) REFERENCES user_profiles(id) NOT VALID;

-- ─── D2. RLS de qa_cido_catalogo, qa_exportacoes_rhc, qa_cancer_casos ────
-- (ENABLE ROW LEVEL SECURITY já feito na PARTE -1.)

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

-- ─── D3. Trigger de auditoria em qa_cancer_casos ─────────────────────────
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
    INSERT INTO qa_auditoria (tabela, registro_id, acao, antes, depois, autor)
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


-- ═══ PARTE E — Bucket de Storage para exportações RHC ═══════════════════
-- api/_lib/handlers/qualidade-gerar-exportacao-cancer.ts sobe um CSV com PII
-- completa de paciente (nome, CPF, mãe, nascimento) a este bucket. PRIVADO
-- sempre: nenhuma policy de storage.objects é criada para `authenticated`
-- de propósito — todo acesso passa pelo dispatcher
-- /api/qualidade/{gerar-exportacao-cancer,baixar-exportacao-cancer}, que usa
-- o client service_role (bypassa RLS/storage policies) e devolve uma signed
-- URL de curta duração (5 min). Espelha o bucket `ac-apoio-requisicoes`
-- (20260723120000_ac_envio_apoio.sql), mas sem nenhuma policy de
-- authenticated — aqui não há upload nem leitura direto do navegador.

INSERT INTO storage.buckets (id, name, public)
VALUES ('qualidade-exportacoes-rhc', 'qualidade-exportacoes-rhc', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ═══ PARTE F — Função qualidade_registrar_exportacao_rhc ════════════════
-- Achado de code review em qualidade-gerar-exportacao-cancer.ts: o handler
-- gravava qa_exportacoes_rhc (INSERT) e depois vinculava os casos exportados
-- (qa_cancer_casos.exportacao_id, UPDATE) em duas chamadas separadas ao
-- Supabase. Se o UPDATE falhasse depois do INSERT ter sucesso, ficava uma
-- exportação "órfã": arquivo já no Storage, linha já gravada, mas os casos
-- continuavam elegíveis — uma nova tentativa gerava um SEGUNDO CSV e uma
-- segunda linha para os mesmos pacientes (risco de envio duplicado ao RHC,
-- que é um relatório de vigilância em saúde do governo).
--
-- Esta função faz as duas escritas dentro de uma única invocação — Postgres
-- desfaz as duas automaticamente se qualquer uma falhar, sem precisar de
-- transação explícita no cliente (supabase-js não suporta multi-statement
-- transacional). Só o service_role (o único client que os handlers de
-- Qualidade usam para esta ação) pode chamá-la.

CREATE OR REPLACE FUNCTION qualidade_registrar_exportacao_rhc(
  p_id uuid,
  p_ano integer,
  p_trimestre integer,
  p_storage_path text,
  p_hash_arquivo text,
  p_total_casos integer,
  p_registrador text,
  p_gerado_por uuid,
  p_gerado_em timestamptz,
  p_caso_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO qa_exportacoes_rhc (id, ano, trimestre, storage_path, hash_arquivo, total_casos, registrador, gerado_por, gerado_em)
  VALUES (p_id, p_ano, p_trimestre, p_storage_path, p_hash_arquivo, p_total_casos, p_registrador, p_gerado_por, p_gerado_em);

  UPDATE qa_cancer_casos
     SET exportacao_id = p_id
   WHERE id = ANY(p_caso_ids);
END;
$$;

-- Limpa uma versão anterior sem p_storage_path que chegou a ser aplicada
-- manualmente no SQL Editor de um ambiente durante o desenvolvimento (sem
-- passar por este arquivo) — qa_exportacoes_rhc.storage_path é NOT NULL, e
-- essa versão sempre falhava depois do CSV já ter subido ao Storage.
DROP FUNCTION IF EXISTS qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, integer, text, uuid, timestamptz, uuid[]);

REVOKE ALL ON FUNCTION qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, text, integer, text, uuid, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qualidade_registrar_exportacao_rhc(uuid, integer, integer, text, text, integer, text, uuid, timestamptz, uuid[]) TO service_role;

COMMIT;
