-- ============================================================
-- Zerar a tabela de cotações em produção
-- Local: supabase/scripts/zerar_cotacoes.sql
-- ============================================================
--
-- Ação isolada e irreversível: apaga TODAS as cotações da base de
-- produção. Roda manualmente, uma única vez, no SQL Editor do
-- Supabase — não faz parte de nenhuma migration nem de deploy
-- automatizado.
--
-- SEM BACKUP/EXPORT PRÉVIO: decisão explícita do responsável pelo
-- produto (ver .scratch/cotacoes-aprovacao/issues/07-zerar-tabela-cotacoes-producao.md).
--
-- SÓ EXECUTAR DEPOIS que as issues 02, 03, 04, 05 e 06 estiverem
-- implementadas e validadas em produção.
--
-- O QUE É APAGADO — por cascata de banco já existente (ON DELETE
-- CASCADE a partir de quotations, ver 20260219120000_expand_quotations_module.sql
-- e 20260219130000_messaging_infrastructure.sql):
--   • quotations (a tabela em si)
--   • quotation_items
--   • quotation_invited_suppliers
--   • quotation_proposals
--   • quotation_proposal_items       (cascade a partir de quotation_proposals)
--   • quotation_approvals
--   • quotation_audit_logs
--   • quotation_messages
--
-- O QUE NÃO É AFETADO: qualquer tabela sem FK para quotations —
-- suppliers, user_profiles, purchase_requests, products etc.
-- ============================================================


-- ============================================================
-- PASSO 1 — Conferir o volume antes de apagar (opcional, mas recomendado)
-- ============================================================
-- SELECT
--   (SELECT COUNT(*) FROM quotations)                    AS quotations,
--   (SELECT COUNT(*) FROM quotation_items)                AS quotation_items,
--   (SELECT COUNT(*) FROM quotation_invited_suppliers)     AS invited_suppliers,
--   (SELECT COUNT(*) FROM quotation_proposals)             AS proposals,
--   (SELECT COUNT(*) FROM quotation_proposal_items)        AS proposal_items,
--   (SELECT COUNT(*) FROM quotation_approvals)             AS approvals,
--   (SELECT COUNT(*) FROM quotation_audit_logs)            AS audit_logs,
--   (SELECT COUNT(*) FROM quotation_messages)              AS messages;


-- ============================================================
-- PASSO 2 — Apagar (IRREVERSÍVEL — descomente e execute apenas
-- quando tiver certeza)
-- ============================================================
-- DELETE FROM quotations;


-- ============================================================
-- PASSO 3 — Conferir que zerou (deve retornar 0 em todas as linhas)
-- ============================================================
-- SELECT
--   (SELECT COUNT(*) FROM quotations)                    AS quotations,
--   (SELECT COUNT(*) FROM quotation_items)                AS quotation_items,
--   (SELECT COUNT(*) FROM quotation_invited_suppliers)     AS invited_suppliers,
--   (SELECT COUNT(*) FROM quotation_proposals)             AS proposals,
--   (SELECT COUNT(*) FROM quotation_proposal_items)        AS proposal_items,
--   (SELECT COUNT(*) FROM quotation_approvals)             AS approvals,
--   (SELECT COUNT(*) FROM quotation_audit_logs)            AS audit_logs,
--   (SELECT COUNT(*) FROM quotation_messages)              AS messages;

-- ============================================================
-- FIM
-- ============================================================
