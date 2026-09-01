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

BEGIN;

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

COMMIT;
