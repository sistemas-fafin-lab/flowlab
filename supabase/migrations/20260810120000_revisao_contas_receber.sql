-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — correções da revisão (docs/plans/faturamento/revisao-contas-receber.md)
-- Migration: 20260810120000_revisao_contas_receber.sql
--
-- Depende de 20260807150000_previsao_pagamento.sql.
--
-- Dois achados de severidade alta/média corrigidos aqui:
--
--  1.4 — REVOKE ALL ... FROM PUBLIC não fecha nada no Supabase: os default
--        privileges do projeto dão GRANT EXECUTE explícito a anon/authenticated
--        em toda função nova de public, e revogar de PUBLIC não mexe num grant
--        explícito. fat_recalcular_nota não tem guard de permissão nenhum (só é
--        chamada de dentro de outra SECURITY DEFINER) e ficou executável por
--        qualquer usuário logado, inclusive sem nenhuma permissão de faturamento.
--
--  2.1/3.1 — operadoras.cnpj é UNIQUE, mas o apLIS cadastra matriz/filial e
--        planos distintos da mesma operadora como fontes pagadoras separadas
--        com o mesmo CNPJ. O upsert de fat_criar_titulo é por aplis_id e
--        esbarra na constraint errada quando um CNPJ já pertence a outra
--        aplis_id — e o mesmo acontece na sync de operadoras assim que a linha
--        que detém o CNPJ hoje não é reprocessada antes da que o disputa. Quem
--        manda é aplis_id; o apLIS admite CNPJ repetido, então a constraint sai.
--
-- AUTOSSUFICIENTE (IF EXISTS / OR REPLACE em tudo): há drift conhecido entre
-- eqz (test) e jqx (prod).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_criar_titulo(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'fat_criar_titulo(JSONB) não existe. Aplique as migrations de contas a receber antes desta.';
  END IF;
END $$;

-- ─── 1.4 — grants nominais ────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.fat_recalcular_nota(UUID)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fat_exigir_permissao_gestao() FROM PUBLIC, anon, authenticated;

-- ─── 2.1/3.1 — CNPJ repetido entre fontes pagadoras ──────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.operadoras'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) ILIKE '%(cnpj)%'
  LOOP
    EXECUTE format('ALTER TABLE public.operadoras DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

COMMENT ON COLUMN public.operadoras.cnpj IS 'CNPJ da fonte pagadora no apLIS. Não é único: matriz/filial e planos distintos da mesma operadora podem compartilhar o mesmo CNPJ com aplis_id diferente.';
