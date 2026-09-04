-- ============================================================
-- Backfill: títulos sem data_vencimento (invisíveis na lista de Títulos)
-- Local: supabase/scripts/backfill_vencimento_titulos.sql
-- ============================================================
--
-- A lista de Títulos filtra por data_vencimento dentro do período selecionado
-- (issue 40, useContasReceber.ts). NULL nunca satisfaz .gte()/.lte(), então um
-- título criado sem vencimento fica escondido para sempre, em qualquer
-- período — sem aviso, sem erro.
--
-- Isso podia acontecer quando o lote ainda não tinha ido para a operadora
-- (sem data_envio) e não tinha vencimento de RPS: o handler
-- (api/_lib/handlers/faturamento-titulo-criar.ts) deixava data_vencimento
-- NULL nesse caso. Comum na AMHP-DF, que nem grava data de envio no apLIS
-- (issue 03) — títulos dela nunca tinham aviso na tela de criação.
--
-- O handler foi corrigido para, nesse caso, estimar o vencimento a partir da
-- emissão em vez de deixar NULL (mesma regra da operadora, fat_prever_vencimento).
-- Este script aplica a MESMA correção aos títulos já criados antes do fix.
--
-- Rode a Parte 1 primeiro para conferir o que seria afetado. Só rode a Parte 2
-- (UPDATE) depois de revisar a lista — cada linha aqui é uma estimativa, não
-- o vencimento real; o financeiro pode ajustar manualmente qualquer uma
-- depois, editando o título.
-- ============================================================

-- ─── Parte 1: conferência (só leitura) ──────────────────────────────────────
SELECT
  n.id_nota,
  n.numero_nota,
  n.data_emissao,
  n.status,
  o.nome AS operadora,
  fat_prever_vencimento(o.aplis_id, o.nome, n.data_emissao) AS vencimento_estimado
FROM notas n
JOIN operadoras o ON o.id_operadora = n.operadora_id
WHERE n.data_vencimento IS NULL
  AND n.status <> 'cancelada'
ORDER BY n.data_emissao DESC;

-- ─── Parte 2: aplica a estimativa (rode só depois de revisar a Parte 1) ────
-- UPDATE notas n
--    SET data_vencimento = fat_prever_vencimento(o.aplis_id, o.nome, n.data_emissao),
--        updated_at = NOW()
--   FROM operadoras o
--  WHERE o.id_operadora = n.operadora_id
--    AND n.data_vencimento IS NULL
--    AND n.status <> 'cancelada';
