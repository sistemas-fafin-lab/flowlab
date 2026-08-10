-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — fat_registrar_baixa recusa valor recebido negativo
-- Migration: 20260810130000_baixa_valor_negativo.sql
--
-- Depende de 20260807130000_contas_receber_rpcs.sql.
--
-- O guard original só barra valorRecebido <= 0 quando NÃO há glosa nenhuma no
-- payload — assim que uma glosa é incluída, um valor negativo passa direto e
-- fat_recalcular_nota soma esse negativo em notas.valor_recebido, inflando
-- valor_saldo além de valor_total. Achado pelo /code-review em
-- src/modules/faturamento/components/BaixaModal.tsx, que tinha o mesmo buraco
-- no client (corrigido junto) — mas a RPC é GRANT EXECUTE TO authenticated e
-- pode ser chamada direto pelo supabase-js, então o guard tem que estar aqui.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_registrar_baixa(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'fat_registrar_baixa(JSONB) não existe. Aplique as migrations de contas a receber antes desta.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fat_registrar_baixa(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id    UUID;
  v_receb_id   UUID;
  v_vencimento DATE;
  v_status     TEXT;
  v_valor      DECIMAL(15, 2);
  v_data       DATE;
  v_glosa      JSONB;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  v_nota_id := NULLIF(p->>'notaId', '')::UUID;
  v_valor   := COALESCE((p->>'valorRecebido')::DECIMAL(15, 2), 0);
  v_data    := COALESCE(NULLIF(p->>'dataRecebimento', '')::DATE, CURRENT_DATE);

  IF v_valor < 0 THEN
    RAISE EXCEPTION 'Valor recebido não pode ser negativo.';
  END IF;

  SELECT data_vencimento, status INTO v_vencimento, v_status
    FROM notas WHERE id_nota = v_nota_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita baixa.';
  END IF;

  IF v_valor <= 0 AND jsonb_array_length(COALESCE(p->'glosas', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe um valor recebido ou ao menos uma glosa.';
  END IF;

  -- data_prevista é NOT NULL no schema legado e não tem default. O vencimento do
  -- título é a previsão certa; sem ele, a própria data da baixa.
  INSERT INTO recebimentos (nota_id, data_prevista, data_receb, valor_previsto,
                            valor_recebido, status, banco_nome, banco_conta,
                            forma_recebimento, observacoes, registrado_por_id,
                            aplis_sync_status)
  VALUES (v_nota_id,
          COALESCE(v_vencimento, v_data),
          v_data,
          v_valor,
          v_valor,
          'recebido',
          NULLIF(p->>'bancoNome', ''),
          NULLIF(p->>'bancoConta', ''),
          NULLIF(p->>'formaRecebimento', ''),
          NULLIF(p->>'observacoes', ''),
          auth.uid(),
          'pendente')
  RETURNING id_receb INTO v_receb_id;

  FOR v_glosa IN SELECT * FROM jsonb_array_elements(COALESCE(p->'glosas', '[]'::jsonb))
  LOOP
    IF COALESCE(NULLIF(v_glosa->>'motivo', ''), '') = '' THEN
      RAISE EXCEPTION 'Toda glosa precisa de motivo.';
    END IF;

    INSERT INTO glosas (recebimento_id, nota_id, requisicao_id, lote_id,
                        valor, motivo, codigo_glosa, status)
    VALUES (v_receb_id,
            v_nota_id,
            NULLIF(v_glosa->>'requisicaoId', '')::UUID,
            NULLIF(v_glosa->>'loteId', '')::UUID,
            COALESCE((v_glosa->>'valor')::DECIMAL(15, 2), 0),
            v_glosa->>'motivo',
            NULLIF(v_glosa->>'codigoGlosa', ''),
            COALESCE(NULLIF(v_glosa->>'status', ''), 'aberta'));
  END LOOP;

  -- A trigger já recalculou o título a cada INSERT; nada a fazer aqui.
  RETURN v_receb_id;
END;
$$;

COMMENT ON FUNCTION public.fat_registrar_baixa(JSONB) IS 'Registra uma baixa e suas glosas num único statement atômico. Recusa valor recebido negativo. Deixa aplis_sync_status pendente para a fase 2.';

-- CREATE OR REPLACE preserva os grants existentes, mas o Supabase dá GRANT
-- default a toda função nova — reafirma nominalmente por segurança/clareza.
REVOKE ALL ON FUNCTION public.fat_registrar_baixa(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_registrar_baixa(JSONB) TO authenticated;
