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
-- Aplicada em produção (confirmado por introspecção direta em 2026-09-02).
-- Ausente do bookkeeping supabase_migrations.schema_migrations porque foi
-- aplicada manualmente via SQL Editor — rodar
-- `supabase migration repair --status applied 20260901150000` se for
-- reconciliar o histórico da CLI.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

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

COMMIT;
