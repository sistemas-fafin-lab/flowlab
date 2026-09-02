-- ═══════════════════════════════════════════════════════════════════════════════
-- FlowLab — UPGRADE DE PRODUÇÃO (jqxeqmeikqclmmongclj) — Qualidade / Indicadores
-- (Requisições) — base + Fase 2 (métricas ricas de Patologia/AP, Histologia/
-- Citologia e IHQ/Parceiro). Gerado em 2026-09-02, concatenando 4 migrations
-- ainda não aplicadas em nenhum ambiente, na ordem abaixo.
--
-- COMO APLICAR: Dashboard de PRODUÇÃO → SQL Editor → colar este arquivo
-- INTEIRO → Run. O SQL Editor roda o script colado como uma transação única:
-- se qualquer trecho falhar, NADA é aplicado (mesmo processo de
-- mudanca_supabase.md / prod-upgrade-fase6-8.sql).
--
-- Todas as 4 migrations são ADITIVAS (CREATE TABLE IF NOT EXISTS / ALTER TABLE
-- ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE
-- FUNCTION) — não alteram dado existente, não removem coluna nem tabela.
-- Idempotente: pode rodar de novo sem duplicar nem quebrar (todo DDL usa
-- IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS antes de recriar).
--
-- Migrations incluídas, na ordem (idênticas a supabase/migrations/):
--   [1/4] 20260901120000_qualidade_requisicoes_indicadores.sql (base — cria
--         qa_motivos_retificacao/qa_requisicoes, RLS, trigger de auditoria)
--   [2/4] 20260901130000_qualidade_requisicoes_patologia_ap.sql (issue 08 —
--         casos atrasados, recorte/coloração, consenso pendente, blocos refeitos)
--   [3/4] 20260901140000_qualidade_requisicoes_histologia_citologia.sql
--         (issue 09 — blocos/lâminas produzidos, microscopia aguardando,
--         amostra não recebida, material devolvido)
--   [4/4] 20260901150000_qualidade_requisicoes_ihq_parceiro.sql (issue 10 —
--         envio/retorno de material para laboratório parceiro, por tipo de exame)
--
-- Todas as 4 dependem de qa_auditoria e current_user_has_permission(), ambos
-- já em produção desde 20260820120000_qualidade_piloto.sql (aplicada).
--
-- ⚠️ AVISO — colisão de timestamp NÃO resolvida no repositório: os arquivos
-- 20260901120000_qualidade_requisicoes_indicadores.sql e
-- 20260901120000_hardware_alert_template.sql compartilham o mesmo timestamp
-- (idem 20260901130000_qualidade_requisicoes_patologia_ap.sql e
-- 20260901130000_quotation_pending_approval_digest_template.sql). Este script
-- NÃO registra esses 2 timestamps em supabase_migrations.schema_migrations
-- (ver §5 no fim) para não marcar os arquivos NÃO relacionados (hardware-monitor/
-- quotations) como aplicados por engano. Resolver a colisão (renomear um par)
-- antes de usar supabase db push neste projeto.
--
-- PÓS-APLICAÇÃO: nenhum segredo de Vault nem passo adicional — só o schema.
-- O primeiro "Sincronizar" na aba Indicadores popula as colunas novas a
-- partir do LIS.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ╔══ [1/4] 20260901120000_qualidade_requisicoes_indicadores.sql (base — cria qa_requisicoes) ══╗
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
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════


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


-- ╔══ [2/4] 20260901130000_qualidade_requisicoes_patologia_ap.sql (issue 08) ══╗
-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Indicadores, seção "Patologia / Anatomia Patológica":
-- métricas ricas em vez dos 4 KPIs genéricos herdados de agregarIndicadorSecao
-- (.scratch/qualidade-riscos-indicadores/issues/08-indicadores-patologia-ap-metricas.md).
--
-- `CodEvento`/`CodProblema` reconferidos AO VIVO contra o MySQL de backup
-- deste sistema em 2026-09-01 (não só copiados do projeto de referência):
--   - Casos Atrasados usa `requisicao.DtaPrevistaSetor` (prazo OPERACIONAL do
--     setor — 100% preenchido para Anátomo Patológico, 1537/1537 requisições
--     no período conferido) — deliberadamente distinto de `dta_prevista`
--     (prazo ao CLIENTE, usado por "Fora do Prazo" em Indicadores Gerais).
--   - Recorte/Nova Coloração: `requisicaohistorico.CodEvento = 3`
--     ("Corte - Coloração Esp. / Novos Cortes") — confere com o catálogo,
--     ~5% do volume de AP.
--   - Consenso Pendente: `consensodetalhe.DtaResposta IS NULL`, join por
--     `consenso.IdRequisicao` — 283 consensos criados nos últimos 90 dias
--     ainda sem resposta (backlog real e crescente).
--   - Blocos Refeitos: `requisicaoproblema.CodProblema = 19` ("Bloco
--     danificado ou quebrado") — confere com o catálogo, mas só 1 registro em
--     todo o histórico do LIS (2022-09-15): esperado ficar zerado quase
--     sempre. Decisão do time: mostrar o dado real mesmo assim, em vez de
--     omitir o indicador (mesma decisão já tomada no projeto de referência).
--
-- `bloco_danificado`/`dta_bloco_danificado` são reaproveitados pela issue 09
-- (Histologia/Citologia, "Blocos Inadequados") — mesmo campo, dois usos,
-- ambos setados pelo mesmo `CodProblema = 19` no sync (o problema não é
-- específico de uma seção no LIS).
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════


ALTER TABLE qa_requisicoes
  ADD COLUMN IF NOT EXISTS dta_prevista_setor timestamptz,
  ADD COLUMN IF NOT EXISTS recorte_coloracao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_recorte_coloracao timestamptz,
  ADD COLUMN IF NOT EXISTS consenso_pendente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_consenso_criado timestamptz,
  ADD COLUMN IF NOT EXISTS bloco_danificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dta_bloco_danificado timestamptz;

COMMENT ON COLUMN qa_requisicoes.dta_prevista_setor IS 'Espelho de requisicao.DtaPrevistaSetor — prazo OPERACIONAL do setor (Patologia/AP), distinto de dta_prevista (prazo ao cliente).';
COMMENT ON COLUMN qa_requisicoes.recorte_coloracao IS 'true quando houve ao menos 1 evento CodEvento=3 ("Corte - Coloração Esp. / Novos Cortes") no requisicaohistorico desta requisição.';
COMMENT ON COLUMN qa_requisicoes.dta_recorte_coloracao IS 'MAX(DtaEvento) do evento 3 — se houve mais de um recorte/coloração, fica com o mais recente.';
COMMENT ON COLUMN qa_requisicoes.consenso_pendente IS 'true quando existe ao menos 1 linha em consensodetalhe (via consenso.IdRequisicao) com DtaResposta IS NULL.';
COMMENT ON COLUMN qa_requisicoes.dta_consenso_criado IS 'MIN(consenso.DtaCriacao) desta requisição — referência informativa, o recorte de período usa dta_solicitacao da requisição, não esta data.';
COMMENT ON COLUMN qa_requisicoes.bloco_danificado IS 'true quando existe ao menos 1 linha em requisicaoproblema com CodProblema=19 ("Bloco danificado ou quebrado"). Reaproveitado pela seção Histologia/Citologia ("Blocos Inadequados", issue 09) — mesmo campo, dois usos.';
COMMENT ON COLUMN qa_requisicoes.dta_bloco_danificado IS 'MAX(DtaProblema) do CodProblema=19 — se houve mais de um registro, fica com o mais recente.';


-- ╔══ [3/4] 20260901140000_qualidade_requisicoes_histologia_citologia.sql (issue 09) ══╗
-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Indicadores, seção "Histologia/Citologia": métricas
-- ricas em vez dos 4 KPIs genéricos herdados de agregarIndicadorSecao
-- (.scratch/qualidade-riscos-indicadores/issues/09-indicadores-histologia-citologia-metricas.md).
--
-- `CodEvento`/`CodProblema` reconferidos AO VIVO contra o MySQL de backup
-- deste sistema em 2026-09-01 (ver corpo da issue 09):
--   - Blocos/Lâminas Produzidos: `bloco`/`lamina.DtaCriacao`, ligados à
--     requisição via `blocorequisicao`/`laminarequisicao` — 14.928 blocos e
--     11.675 lâminas nos últimos 90 dias, sinal forte.
--   - Microscopia Aguardando: `CodEvento=1000` ("Microscopia - Aguarda
--     Liberação") — 2.681 requisições nos últimos 90 dias, 100% em
--     CITOPATOLOGIA (0% em ANÁTOMO PATOLÓGICO). Por isso este indicador é
--     desta seção, NÃO de Patologia/AP (correção em relação ao projeto de
--     referência, que colocava "Microscopia Aguardando" em Patologia/AP —
--     lá o evento tinha outro perfil de uso; aqui não).
--   - Amostras Não Recebidas: `CodProblema=4` — 139 nos últimos 365 dias,
--     última ocorrência 2026-08-31 (ativo).
--   - Material Devolvido Não Conforme: `CodProblema=27` — 60 em todo o
--     histórico, 5 nos últimos 365 dias (baixa frequência esperada, mas
--     ativo).
--
-- Decisão registrada (checklist da issue 09): "Lâminas Inadequadas"
-- (CodProblema IN (20,37,41,42)) e "Amostras Insatisfatórias" (CodProblema
-- IN (10,17)) NÃO foram implementadas nesta migration. 3 dos 5 CodProblema
-- envolvidos têm ZERO registros em todo o histórico deste LIS e o quarto tem
-- 1 registro em ~2 anos — sinal forte de que a equipe operacional não usa
-- essas categorias no dia a dia (loga de outra forma, ou o fluxo não se
-- aplica aqui). Implementar do jeito que a referência fez entregaria dois
-- KPIs praticamente sempre zerados. Revisitar se o time confirmar que estas
-- categorias passam a ser usadas.
--
-- `bloco_danificado`/`dta_bloco_danificado` (issue 08) já existem e cobrem
-- "Blocos Inadequados" caso a seção precise dele no futuro — mesma ressalva
-- de baixo volume da issue 08 se aplica; não adicionado como KPI aqui por
-- não constar na lista principal da issue 09. Coluna reaproveitada via
-- `ADD COLUMN IF NOT EXISTS` (idempotente) para o caso da 08 ainda não ter
-- rodado neste ambiente.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════


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

COMMENT ON COLUMN qa_requisicoes.num_blocos IS 'Contagem de bloco.DtaCriacao ligados a esta requisição via blocorequisicao (sem filtro de data própria — mesma simplificação de recorte único já usada pelas demais colunas desta tabela, ver cabeçalho de listarRequisicoesLis). Usado por "Blocos Produzidos" em Histologia/Citologia.';
COMMENT ON COLUMN qa_requisicoes.num_laminas IS 'Contagem de lamina.DtaCriacao ligados a esta requisição via laminarequisicao. Usado por "Lâminas Produzidas" em Histologia/Citologia.';
COMMENT ON COLUMN qa_requisicoes.dta_primeira_lamina_pronta IS 'MIN(lamina.DtaCriacao) desta requisição — usado por "Tempo de Processamento" (dta_amostra_recebida → dta_primeira_lamina_pronta) em Histologia/Citologia.';
COMMENT ON COLUMN qa_requisicoes.dta_microscopia_aguardando IS 'MAX(DtaEvento) do requisicaohistorico com CodEvento=1000 ("Microscopia - Aguarda Liberação") — realocado de Patologia/AP para esta seção: no LIS, 100% das ocorrências deste evento são de CITOPATOLOGIA (ver cabeçalho desta migration).';
COMMENT ON COLUMN qa_requisicoes.amostra_nao_recebida IS 'true quando existe ao menos 1 linha em requisicaoproblema com CodProblema=4 ("Amostra não recebida").';
COMMENT ON COLUMN qa_requisicoes.dta_amostra_nao_recebida IS 'MAX(DtaProblema) do CodProblema=4 — se houve mais de um registro, fica com o mais recente.';
COMMENT ON COLUMN qa_requisicoes.material_devolvido_nao_conforme IS 'true quando existe ao menos 1 linha em requisicaoproblema com CodProblema=27 ("Devolução de Material NÃO Conforme") — diferente de amostra_nao_recebida (CodProblema=4): aqui o material chegou e foi devolvido por não conformidade.';
COMMENT ON COLUMN qa_requisicoes.dta_material_devolvido IS 'MAX(DtaProblema) do CodProblema=27 — se houve mais de um registro, fica com o mais recente.';
COMMENT ON COLUMN qa_requisicoes.bloco_danificado IS 'true quando existe ao menos 1 linha em requisicaoproblema com CodProblema=19 ("Bloco danificado ou quebrado"). Definida pela issue 08 (Patologia/AP) — repetida aqui via IF NOT EXISTS para a issue 09 ficar idempotente mesmo se a 08 ainda não tiver rodado neste ambiente. Reaproveitável por Histologia/Citologia ("Blocos Inadequados") se este KPI for ativado no futuro.';
COMMENT ON COLUMN qa_requisicoes.dta_bloco_danificado IS 'MAX(DtaProblema) do CodProblema=19 — ver bloco_danificado.';


-- ╔══ [4/4] 20260901150000_qualidade_requisicoes_ihq_parceiro.sql (issue 10) ══╗
-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Qualidade — aba Indicadores, seção "IHQ / Parceiro": tabela por tipo
-- de exame (Interna/Externa Bloco/Externa Bloco+Lâmina) em vez dos 4 KPIs
-- genéricos herdados de agregarIndicadorSecao
-- (.scratch/qualidade-riscos-indicadores/issues/10-indicadores-ihq-parceiro-metricas.md).
--
-- IMPORTANTE: esta seção é sobre envio/retorno de material para um
-- LABORATÓRIO PARCEIRO externo — conceitualmente diferente do módulo "IHQ"
-- já existente neste repo (/qualidade/ihq, api/_lib/qualidade/bdLabQualidade.ts
-- função de IHQ, que resolve o vínculo de uma requisição de IHQ com a
-- biópsia/peça original do mesmo paciente). Nenhum código é reaproveitado
-- entre os dois, mesmo com a mesma sigla.
--
-- `CodExame`/`CodEvento` reconferidos AO VIVO contra o MySQL de backup deste
-- sistema em 2026-09-01 (ver corpo da issue 10):
--   - `exame` confirma os 3 códigos com os nomes esperados: CodExame=6
--     "IMUNOISTOQUÍMICA INTERNA", 12 "IMUNOISTOQUÍMICA EXTERNA (BLOCO)", 13
--     "IMUNOISTOQUÍMICA EXTERNA (BLOCO+LÂMINA)" — todos com CodExameTipo=5
--     (já mapeado para secao_lis='ihq_parceiro' desde a migration
--     20260901120000, junto com CodExameTipo=3 "IMUNOISTOQUÍMICA"). Esta
--     tabela filtra por CodExame IN (6,12,13) especificamente, não pela
--     seção inteira — CodExameTipo=3 fica de fora das 3 linhas desta tabela,
--     mas continua contando para secao_lis='ihq_parceiro' nos Indicadores
--     Gerais.
--   - `evento` confirma os 3 códigos: CodEvento=19 "Envio material
--     parceiro", 56 "Concluído - Laudo em Fotos", 64 "Amostra DEVOLVIDA".
--   - Volume real, escopado corretamente por CodExame IN (6,12,13): 24
--     requisições nos últimos 90 dias (evento 19: 24, evento 56: 21) —
--     sinal real, mas espere linhas zeradas com frequência para os tipos
--     menos usados em qualquer período dado (isso é esperado, não um bug do
--     sync).
--
-- Decisão registrada (issue 10): os 3 tipos SEMPRE aparecem como 3 linhas
-- separadas, mesmo quando um deles tem 0 requisições no período (não omitir
-- a linha). TAT Parceiro usa o PRIMEIRO dos dois sinais de retorno (fotos ou
-- amostra devolvida), não os dois somados nem uma média dos dois.
--
-- NÃO aplicado ainda em nenhum ambiente — revisar antes de rodar no SQL
-- Editor (mesmo processo de mudanca_supabase.md).
-- ═══════════════════════════════════════════════════════════════════════════════


ALTER TABLE qa_requisicoes
  ADD COLUMN IF NOT EXISTS cod_exame integer,
  ADD COLUMN IF NOT EXISTS dta_envio_parceiro timestamptz,
  ADD COLUMN IF NOT EXISTS dta_retorno_laudo_fotos timestamptz,
  ADD COLUMN IF NOT EXISTS dta_retorno_amostra_devolvida timestamptz;

CREATE INDEX IF NOT EXISTS qa_requisicoes_cod_exame_idx ON qa_requisicoes (cod_exame);

COMMENT ON COLUMN qa_requisicoes.cod_exame IS 'Espelho de requisicao.CodExame (via exame.CodExame) — usado pela seção "IHQ / Parceiro" para separar as 3 linhas da tabela (6 Interna, 12 Externa Bloco, 13 Externa Bloco+Lâmina), distinto de cod_exame_tipo_lis (agrupamento mais amplo já usado por secao_lis).';
COMMENT ON COLUMN qa_requisicoes.dta_envio_parceiro IS 'MIN(DtaEvento) do requisicaohistorico com CodEvento=19 ("Envio material parceiro") — Imuno-histoquímica, escopo cod_exame IN (6,12,13).';
COMMENT ON COLUMN qa_requisicoes.dta_retorno_laudo_fotos IS 'MIN(DtaEvento) do CodEvento=56 ("Concluído - Laudo em Fotos") — um dos dois sinais de retorno do parceiro (mantido separado de dta_retorno_amostra_devolvida para a UI categorizar a origem).';
COMMENT ON COLUMN qa_requisicoes.dta_retorno_amostra_devolvida IS 'MIN(DtaEvento) do CodEvento=64 ("Amostra DEVOLVIDA") — o outro sinal de retorno do parceiro.';


-- ╔══ [§5] Registro das versões aplicadas (bookkeeping, opcional e seguro) ══╗
-- Só as 2 migrations com timestamp ÚNICO (sem colisão) — ver aviso no topo.
-- Se o schema de tracking da CLI existir em prod, registra as versões para
-- futuras comparações. Se não existir, não faz nada.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260901140000'), ('20260901150000')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ═══ Fim do upgrade — Qualidade / Indicadores base + Fase 2 ═══
