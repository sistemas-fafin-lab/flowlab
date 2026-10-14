-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: lançar as glosas do apLIS num título
-- (.scratch/faturamento-glosas-automaticas-aplis — issue 02, decisões 5, 7 e 14).
--
-- O "Aplicar baixas e glosas do apLIS" lança, por título, as glosas que a
-- prévia calculou do apLIS: uma por lote + código + status, sempre avulsas
-- (sem recebimento_id), com origem = 'aplis'. A origem é o que a prévia usa
-- para não sugerir de novo o que já entrou (descontado por título + lote +
-- código) e para separar a glosa do apLIS da digitada à mão.
--
--   glosas.origem — null = digitada; 'aplis' = lançada a partir do apLIS.
--   fat_lancar_glosas_aplis(p) — as glosas de UM título, todas ou nenhuma.
--
-- Depende de 20260807120000_contas_receber.sql (glosas.lote_id, recebimento_id
-- nullable, gatilhos de fat_recalcular_nota), 20260807130000_contas_receber_rpcs.sql
-- (fat_exigir_permissao_gestao) e 20261014120000_fat_corrigir_lancamentos.sql
-- (fat_travar_titulo_lancamento, fat_validar_glosa_lancamento, fat_auditar_lancamento).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE glosas ADD COLUMN IF NOT EXISTS origem TEXT;

ALTER TABLE glosas DROP CONSTRAINT IF EXISTS glosas_origem_check;
ALTER TABLE glosas ADD CONSTRAINT glosas_origem_check CHECK (origem IS NULL OR origem = 'aplis');

COMMENT ON COLUMN glosas.origem IS
  'De onde veio a glosa: null = digitada à mão; ''aplis'' = lançada pelo "Aplicar baixas e glosas do apLIS" (fat_lancar_glosas_aplis).';

-- ─── fat_lancar_glosas_aplis ────────────────────────────────────────────────
-- p: {
--   notaId,
--   glosas: [{ loteId, codigo, motivo, status, valor }]
-- }
-- Devolve quantas glosas foram lançadas. Qualquer recusa desfaz as do título
-- (uma chamada = uma transação).
CREATE OR REPLACE FUNCTION public.fat_lancar_glosas_aplis(p JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id     UUID := NULLIF(p->>'notaId', '')::UUID;
  v_glosas      JSONB := COALESCE(p->'glosas', '[]'::jsonb);
  v_numero_nota TEXT;
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

  -- Mesma regra da baixa do apLIS: sem número da nota, nada é lançado.
  SELECT NULLIF(TRIM(numero_nota), '') INTO v_numero_nota FROM notas WHERE id_nota = v_nota_id;
  IF v_numero_nota IS NULL THEN
    RAISE EXCEPTION 'Não é possível lançar glosa: título sem número da nota.';
  END IF;

  -- Teto antes de qualquer INSERT: glosado de hoje (fora as revertidas) mais as
  -- novas não passa do valor do título.
  SELECT COALESCE(SUM((g->>'valor')::DECIMAL(15, 2)), 0) INTO v_soma
    FROM jsonb_array_elements(v_glosas) AS g;
  IF v_glosado + v_soma > v_total THEN
    RAISE EXCEPTION 'Glosa(s) somam mais que o valor do título (% de um total de %).',
      to_char(v_glosado + v_soma, 'FM999999999.00'), to_char(v_total, 'FM999999999.00');
  END IF;

  SELECT name INTO v_user_name FROM user_profiles WHERE id = auth.uid();

  FOR v_g IN SELECT * FROM jsonb_array_elements(v_glosas)
  LOOP
    -- A glosa do apLIS é sempre de um lote: sem ele, a próxima prévia não teria
    -- como descontá-la e sugeriria de novo.
    IF NULLIF(v_g->>'loteId', '') IS NULL THEN
      RAISE EXCEPTION 'Toda glosa do apLIS precisa do lote.';
    END IF;
    -- Motivo, valor > 0 e lote vinculado a este título.
    PERFORM fat_validar_glosa_lancamento(v_nota_id, v_g);
    v_status := v_g->>'status';
    IF v_status IS NULL OR v_status NOT IN ('aberta', 'em_recurso', 'definitiva') THEN
      RAISE EXCEPTION 'Status de glosa inválido: %.', COALESCE(v_status, '(vazio)');
    END IF;

    INSERT INTO glosas (recebimento_id, nota_id, lote_id, valor, motivo, codigo_glosa,
                        status, responsavel, origem)
    VALUES (NULL,
            v_nota_id,
            (v_g->>'loteId')::UUID,
            (v_g->>'valor')::DECIMAL(15, 2),
            TRIM(v_g->>'motivo'),
            NULLIF(TRIM(v_g->>'codigo'), ''),
            v_status,
            COALESCE(v_user_name, 'Desconhecido'),
            'aplis')
    RETURNING id_glosa INTO v_novo_id;

    -- Quem confirmou fica também na auditoria dos lançamentos (performed_by).
    PERFORM fat_auditar_lancamento(v_nota_id, NULL, v_novo_id, 'glosa', 'inclusao', NULL,
      NULL, ((v_g->>'valor')::DECIMAL(15, 2))::TEXT,
      (SELECT to_jsonb(g) FROM glosas g WHERE g.id_glosa = v_novo_id),
      'Glosa do apLIS (Aplicar baixas e glosas do apLIS)');
    v_qtd := v_qtd + 1;
  END LOOP;

  -- Os gatilhos de glosas já recalcularam o título a cada INSERT.
  RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) IS
  'Lança as glosas do apLIS de um título (todas ou nenhuma): avulsas, com origem = ''aplis'', lote, código, status e responsável, e auditoria da inclusão. Exige canManageBilling. Recusa título cancelado ou sem número, lote de outro título, glosa sem lote/motivo/valor, status fora de aberta/em_recurso/definitiva e glosado acima do valor do título.';

REVOKE ALL ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) TO authenticated;

-- ─── Roteiro de teste manual (SQL Editor do Supabase) ───────────────────────
-- Rodar cada bloco dentro de BEGIN … ROLLBACK, simulando um usuário com
-- canManageBilling (troque os uuids):
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid-usuario-faturamento>","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--
-- Dados: <nota> título aberto com número; <lote> vinculado a ele (nota_lote);
-- <lote-outro> vinculado a outro título.
--
-- 1. Lote de outro título → 'Lote informado na glosa não pertence a este título.'
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[
--        {"loteId":"<lote-outro>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"aberta","valor":10}]}');
--
-- 2. Soma acima do total → 'Glosa(s) somam mais que o valor do título (…)'
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[
--        {"loteId":"<lote>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"aberta","valor":99999999}]}');
--
-- 3. Status inválido → 'Status de glosa inválido: revertida.'
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[
--        {"loteId":"<lote>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"revertida","valor":10}]}');
--
-- 4. Erro desfaz o título inteiro: a 1ª glosa é válida, a 2ª tem lote de outro
--    título → erro, e nenhuma glosa nova fica no título.
--      SELECT count(*) FROM glosas WHERE nota_id = '<nota>';            -- n
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[
--        {"loteId":"<lote>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"aberta","valor":10},
--        {"loteId":"<lote-outro>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"aberta","valor":10}]}');
--      -- (o erro aborta a transação: ROLLBACK, BEGIN e refazer o set_config)
--      SELECT count(*) FROM glosas WHERE nota_id = '<nota>';            -- n de novo
--
-- 5. Origem gravada → devolve 1; a glosa tem origem 'aplis', recebimento_id
--    nulo, lote_id, codigo_glosa, status e responsavel; o título recalculou.
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[
--        {"loteId":"<lote>","codigo":"2902","motivo":"GLOSA MANTIDA","status":"definitiva","valor":10}]}');
--      SELECT origem, recebimento_id, lote_id, codigo_glosa, status, responsavel
--        FROM glosas WHERE nota_id = '<nota>' ORDER BY created_at DESC LIMIT 1;
--      SELECT valor_glosado, status FROM notas WHERE id_nota = '<nota>';
--      SELECT acao, entidade, performed_by_name, motivo
--        FROM notas_lancamentos_audit_logs WHERE nota_id = '<nota>' ORDER BY performed_at DESC LIMIT 1;
--
-- 6. Usuário sem canManageBilling (troque o sub do set_config) →
--    'Sem permissão para gerenciar contas a receber.' (42501)
--
-- 7. Título sem número / cancelado → 'título sem número da nota' /
--    'Título cancelado não aceita correção de lançamentos.'
--
--   ROLLBACK;
