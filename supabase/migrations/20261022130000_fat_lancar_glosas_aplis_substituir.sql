-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: as glosas do apLIS substituem as digitadas à mão
-- (.scratch/faturamento-glosas-sincronizar-aplis).
--
-- Até aqui o "Aplicar baixas e glosas do apLIS" pulava o título com glosa
-- digitada ("título já tem glosa lançada"). Caso real (lote 5774, FuSEx):
-- título de R$ 750,16 com R$ 88,12 do apLIS e duas glosas à mão (750,16 e
-- 662,04) — glosado de R$ 1.500,32, e o "Aplicar" não mexia nele.
--
-- Decisão de 22/10/2026: o apLIS manda. A prévia passa a mandar, junto das
-- glosas a lançar, os ids das glosas digitadas que elas substituem; esta RPC
-- exclui essas (auditoria 'exclusao') e lança as do apLIS na mesma transação.
--
--   fat_lancar_glosas_aplis(p) — p ganha `substituir: [id_glosa]`. `glosas`
--   pode vir vazio quando há o que substituir (o já lançado do apLIS cobre o
--   título e só sobram as digitadas a tirar).
--
-- Depende de 20261014190000_fat_lancar_glosas_aplis.sql (versão anterior desta
-- função, glosas.origem) e 20261014120000_fat_corrigir_lancamentos.sql
-- (fat_travar_titulo_lancamento, fat_validar_glosa_lancamento, fat_auditar_lancamento).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── fat_lancar_glosas_aplis ────────────────────────────────────────────────
-- p: {
--   notaId,
--   glosas: [{ loteId, codigo, motivo, status, valor }],
--   substituir?: [id_glosa]   -- digitadas à mão (origem nula), não revertidas
-- }
-- Devolve quantas glosas foram lançadas. Qualquer recusa desfaz o título
-- inteiro, exclusões inclusive (uma chamada = uma transação).
CREATE OR REPLACE FUNCTION public.fat_lancar_glosas_aplis(p JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id     UUID := NULLIF(p->>'notaId', '')::UUID;
  v_glosas      JSONB := COALESCE(p->'glosas', '[]'::jsonb);
  v_substituir  JSONB := COALESCE(p->'substituir', '[]'::jsonb);
  v_total       DECIMAL(15, 2);
  v_glosado     DECIMAL(15, 2);
  v_soma        DECIMAL(15, 2);
  v_removido    DECIMAL(15, 2) := 0;
  v_user_name   TEXT;
  v_g           JSONB;
  v_id          UUID;
  v_glosa_atual glosas%ROWTYPE;
  v_status      TEXT;
  v_novo_id     UUID;
  v_qtd         INTEGER := 0;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF jsonb_typeof(v_glosas) <> 'array' OR jsonb_typeof(v_substituir) <> 'array' THEN
    RAISE EXCEPTION 'Glosas e substituídas precisam ser listas.';
  END IF;
  IF jsonb_array_length(v_glosas) = 0 AND jsonb_array_length(v_substituir) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma glosa.';
  END IF;

  -- Trava o título e recusa cancelado; devolve o total e o glosado de partida.
  SELECT t.v_valor_total, t.v_glosado INTO v_total, v_glosado
    FROM fat_travar_titulo_lancamento(v_nota_id) t;

  -- ── Digitadas que saem ───────────────────────────────────────────────────
  -- Só as deste título, digitadas à mão e que contam no glosado: a prévia
  -- nunca manda outra, e uma glosa do apLIS ou revertida aqui é dado mudado
  -- desde a prévia (refazer).
  FOR v_g IN SELECT * FROM jsonb_array_elements(v_substituir)
  LOOP
    v_id := NULLIF(v_g #>> '{}', '')::UUID;
    SELECT * INTO v_glosa_atual FROM glosas
     WHERE id_glosa = v_id
       AND nota_id = v_nota_id
       AND origem IS NULL
       AND status IN ('aberta', 'em_recurso', 'definitiva')
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Glosa a substituir não é uma glosa digitada deste título (refaça a prévia).';
    END IF;

    PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'exclusao', NULL,
      v_glosa_atual.valor::TEXT, NULL, to_jsonb(v_glosa_atual),
      'Substituída pela glosa do apLIS (Aplicar baixas e glosas do apLIS)');
    DELETE FROM glosas WHERE id_glosa = v_id;
    v_removido := v_removido + v_glosa_atual.valor;
  END LOOP;

  -- Teto antes de qualquer INSERT: glosado de hoje (fora as revertidas e as
  -- que acabaram de sair) mais as novas não passa do valor do título.
  SELECT COALESCE(SUM((g->>'valor')::DECIMAL(15, 2)), 0) INTO v_soma
    FROM jsonb_array_elements(v_glosas) AS g;
  IF v_glosado - v_removido + v_soma > v_total THEN
    RAISE EXCEPTION 'Glosa(s) somam mais que o valor do título (% de um total de %).',
      to_char(v_glosado - v_removido + v_soma, 'FM999999999.00'), to_char(v_total, 'FM999999999.00');
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

  -- Os gatilhos de glosas já recalcularam o título a cada DELETE e INSERT.
  RETURN v_qtd;
END;
$$;

COMMENT ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) IS
  'Lança as glosas do apLIS de um título (todas ou nenhuma): avulsas, com origem = ''aplis'', lote, código, status e responsável, e auditoria da inclusão. Exclui antes, na mesma transação, as glosas digitadas que elas substituem (`substituir`), com auditoria da exclusão. Exige canManageBilling. Aceita título sem número da nota. Recusa título cancelado, glosa a substituir que não é digitada/ativa deste título, lote de outro título, glosa sem lote/motivo/valor, status fora de aberta/em_recurso/definitiva e glosado acima do valor do título.';

REVOKE ALL ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_lancar_glosas_aplis(JSONB) TO authenticated;

-- ─── Roteiro de teste manual (SQL Editor do Supabase) ───────────────────────
-- Dentro de BEGIN … ROLLBACK, simulando um usuário com canManageBilling:
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid-usuario-faturamento>","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--
-- Dados: <nota> com <lote>, uma glosa digitada <manual> (origem nula) e uma do
-- apLIS <aplis>.
--
-- 1. Substitui → a <manual> some, a nova entra com origem 'aplis'; auditoria
--    'exclusao' + 'inclusao'; glosado recalculado.
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","substituir":["<manual>"],"glosas":[
--        {"loteId":"<lote>","codigo":null,"motivo":"Glosa total (apLIS)","status":"aberta","valor":10}]}');
--      SELECT acao, valor_anterior, valor_novo, motivo FROM notas_lancamentos_audit_logs
--       WHERE nota_id = '<nota>' ORDER BY performed_at DESC LIMIT 2;
--
-- 2. Só substituir (glosas vazio) → devolve 0 e a <manual> sai.
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","substituir":["<manual>"],"glosas":[]}');
--
-- 3. Substituir uma glosa do apLIS → 'Glosa a substituir não é uma glosa digitada deste título (refaça a prévia).'
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","substituir":["<aplis>"],"glosas":[]}');
--
-- 4. Teto conta a que sai: título de 100 com <manual> de 100 → substituir e
--    lançar 100 passa; lançar 100 sem substituir → 'Glosa(s) somam mais…'.
--
-- 5. Sem nada → 'Informe ao menos uma glosa.'
--      SELECT fat_lancar_glosas_aplis('{"notaId":"<nota>","glosas":[]}');
--
--   ROLLBACK;
