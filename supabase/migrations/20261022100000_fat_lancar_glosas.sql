-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: "Lançar glosa" passa por RPC, com teto e auditoria
-- (.scratch/faturamento-lancar-glosa-teto).
--
-- Até aqui o "Lançar glosa" fazia INSERT direto em `glosas`: sem o teto que
-- fat_registrar_baixa, fat_lancar_glosas_aplis e fat_corrigir_lancamento
-- aplicam (glosado ≤ total do título) e sem linha em
-- notas_lancamentos_audit_logs. Caso real (lote 5774, FuSEx): título de
-- R$ 750,16 com R$ 88,12 já glosados pelo apLIS recebeu uma glosa manual de
-- R$ 750,16 — glosado de R$ 838,28, e a inclusão não aparecia em "Alterações".
--
--   fat_lancar_glosas(p) — as glosas avulsas (sem baixa) de UM título, todas
--   ou nenhuma, com o mesmo teto e a mesma auditoria das outras RPCs.
--
-- Depende de 20261014120000_fat_corrigir_lancamentos.sql
-- (fat_travar_titulo_lancamento, fat_validar_glosa_lancamento,
-- fat_auditar_lancamento) e 20261014190000_fat_lancar_glosas_aplis.sql
-- (glosas.origem, glosas.responsavel).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── fat_lancar_glosas ──────────────────────────────────────────────────────
-- p: {
--   notaId,
--   glosas: [{ valor, motivo, codigoGlosa?, status?, requisicaoId?, loteId? }]
-- }
-- Devolve quantas glosas foram lançadas.
CREATE OR REPLACE FUNCTION public.fat_lancar_glosas(p JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id     UUID := NULLIF(p->>'notaId', '')::UUID;
  v_glosas      JSONB := COALESCE(p->'glosas', '[]'::jsonb);
  v_total       DECIMAL(15, 2);
  v_glosado     DECIMAL(15, 2);
  v_soma        DECIMAL(15, 2);
  v_user_name   TEXT;
  v_g           JSONB;
  v_status      TEXT;
  v_novo_id     UUID;
  v_qtd         INTEGER := 0;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF jsonb_typeof(v_glosas) <> 'array' OR jsonb_array_length(v_glosas) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma glosa.';
  END IF;

  -- Trava o título e recusa cancelado; devolve o total e o glosado de partida.
  SELECT t.v_valor_total, t.v_glosado INTO v_total, v_glosado
    FROM fat_travar_titulo_lancamento(v_nota_id) t;

  -- Teto antes de qualquer INSERT: glosado de hoje (fora as revertidas) mais as
  -- novas não passa do valor do título. A mensagem diz quanto já está glosado:
  -- é o que o operador não viu quando lançou o valor cheio por cima.
  SELECT COALESCE(SUM((g->>'valor')::DECIMAL(15, 2)), 0) INTO v_soma
    FROM jsonb_array_elements(v_glosas) AS g;
  IF v_glosado + v_soma > v_total THEN
    RAISE EXCEPTION 'Glosa(s) somam mais que o valor do título: já há % glosados, + % desta glosa, num total de %. Para registrar o total da glosa, lance só a diferença ou corrija as glosas existentes em "Editar título".',
      to_char(v_glosado, 'FM999999990.00'), to_char(v_soma, 'FM999999990.00'),
      to_char(v_total, 'FM999999990.00');
  END IF;

  SELECT name INTO v_user_name FROM user_profiles WHERE id = auth.uid();

  FOR v_g IN SELECT * FROM jsonb_array_elements(v_glosas)
  LOOP
    -- Motivo, valor > 0 e guia/lote vinculados a este título.
    PERFORM fat_validar_glosa_lancamento(v_nota_id, v_g);
    v_status := COALESCE(NULLIF(v_g->>'status', ''), 'aberta');
    IF v_status NOT IN ('aberta', 'em_recurso', 'definitiva') THEN
      RAISE EXCEPTION 'Status de glosa inválido: %.', v_status;
    END IF;

    INSERT INTO glosas (recebimento_id, nota_id, requisicao_id, lote_id, valor, motivo,
                        codigo_glosa, status, responsavel)
    VALUES (NULL,
            v_nota_id,
            NULLIF(v_g->>'requisicaoId', '')::UUID,
            NULLIF(v_g->>'loteId', '')::UUID,
            (v_g->>'valor')::DECIMAL(15, 2),
            TRIM(v_g->>'motivo'),
            NULLIF(TRIM(v_g->>'codigoGlosa'), ''),
            v_status,
            COALESCE(v_user_name, 'Desconhecido'))
    RETURNING id_glosa INTO v_novo_id;

    PERFORM fat_auditar_lancamento(v_nota_id, NULL, v_novo_id, 'glosa', 'inclusao', NULL,
      NULL, ((v_g->>'valor')::DECIMAL(15, 2))::TEXT,
      (SELECT to_jsonb(g) FROM glosas g WHERE g.id_glosa = v_novo_id),
      'Glosa lançada (Lançar glosa)');
    v_qtd := v_qtd + 1;
  END LOOP;

  -- Os gatilhos de glosas já recalcularam o título a cada INSERT.
  RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.fat_lancar_glosas(JSONB) IS
  'Lança glosas avulsas (sem baixa) num título, todas ou nenhuma, com auditoria da inclusão. Exige canManageBilling. Recusa título cancelado, guia/lote de outro título, glosa sem motivo/valor, status fora de aberta/em_recurso/definitiva e glosado acima do valor do título.';

REVOKE ALL ON FUNCTION public.fat_lancar_glosas(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_lancar_glosas(JSONB) TO authenticated;

-- ─── Roteiro de teste manual (SQL Editor do Supabase) ───────────────────────
-- Dentro de BEGIN … ROLLBACK, simulando um usuário com canManageBilling:
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid-usuario-faturamento>","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--
-- 1. Acima do total → 'Glosa(s) somam mais que o valor do título: já há …'
--      SELECT fat_lancar_glosas('{"notaId":"<nota>","glosas":[{"valor":99999999,"motivo":"teste"}]}');
--
-- 2. Lançamento válido → devolve 1; glosa sem recebimento_id, origem nula,
--    responsavel preenchido; linha 'inclusao' na auditoria; título recalculado.
--      SELECT fat_lancar_glosas('{"notaId":"<nota>","glosas":[{"valor":10,"motivo":"teste"}]}');
--      SELECT recebimento_id, origem, responsavel FROM glosas WHERE nota_id = '<nota>' ORDER BY created_at DESC LIMIT 1;
--      SELECT acao, entidade, valor_novo, motivo FROM notas_lancamentos_audit_logs
--       WHERE nota_id = '<nota>' ORDER BY performed_at DESC LIMIT 1;
--
-- 3. Lote de outro título → 'Lote informado na glosa não pertence a este título.'
-- 4. Título cancelado → 'Título cancelado não aceita correção de lançamentos.'
-- 5. Sem canManageBilling → 'Sem permissão para gerenciar contas a receber.'
--
--   ROLLBACK;
