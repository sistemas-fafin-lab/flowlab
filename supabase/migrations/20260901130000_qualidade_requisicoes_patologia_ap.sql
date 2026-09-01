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

BEGIN;

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

COMMIT;
