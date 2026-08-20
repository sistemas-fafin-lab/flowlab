-- ═══════════════════════════════════════════════════════════════════════════════
-- UPGRADE DE PROD — controla_consumo para Biologia Molecular (bookkeeping)
-- Arquivo: supabase/scripts/prod-upgrade-biomol-20260819.sql
-- Gerado em 2026-08-19
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- COMO RODAR: cole o arquivo INTEIRO no SQL Editor do Supabase (produção,
-- jqxeqmeikqclmmongclj) e execute de uma vez. Transação única, idempotente.
--
-- Verificado ao vivo em 2026-08-19: stock_locations.controla_consumo JÁ é true
-- para 'Biologia Molecular' em prod (aplicado manualmente em algum momento, sem
-- registro na tabela de controle — mesmo padrão de outras 4 migrations achadas
-- no backlog de 2026-08-19). Este script não muda comportamento nenhum — o
-- UPDATE não afeta nenhuma linha (WHERE controla_consumo IS DISTINCT FROM true).
-- Serve só para registrar a versão 20260701140000 no bookkeeping.
--
-- Migration incluída: 20260701140000_fase5_controla_consumo_biomol
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260701140000_fase5_controla_consumo_biomol
-- ═══════════════════════════════════════════════════════════════════════════════

/*
  # Fase 5 — Liga controla_consumo para Biologia Molecular (§5 / §2.7)

  Plano: docs/PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md (§5, §4.2)

  Decisão do usuário: Biologia Molecular é o setor opt-in do controle de consumo
  em 2 etapas (recebe a retirada de solicitação como TRANSFERÊNCIA e depois baixa
  o consumo real). Os demais setores seguem em baixa direta (out).

  Idempotente: reaplicar não muda nada. O CHECK ck_stock_locations_consumo_rastreavel
  já garante rastreavel=true (Biologia Molecular nasceu rastreável no seed aditivo).

  NB: só tem efeito real com o cutover aplicado + o frontend da Parte B, que
  resolve o department da solicitação para este local (processRetirada, com a
  normalização código↔rótulo).
*/

UPDATE stock_locations
   SET controla_consumo = true, updated_at = now()
 WHERE department = 'Biologia Molecular'
   AND rastreavel = true
   AND controla_consumo IS DISTINCT FROM true;

-- ╔══ Registro da versão aplicada (bookkeeping) ══╗
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260701140000')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA FINAL
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT department, rastreavel, controla_consumo
  FROM stock_locations
 WHERE department = 'Biologia Molecular';
-- controla_consumo precisa estar 'true' na linha acima.

COMMIT;
