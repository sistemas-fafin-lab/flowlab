-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: bloquear baixa de título sem número da nota (issue 34 do
-- feedback do setor de faturamento, 31/08 — depende da issue 32, que tornou
-- numero_nota opcional na criação do título).
--
-- Título sem número da nota só é um fluxo esperado para operadoras com
-- nf_apos_pagamento = true (issue 31): a NF só sai depois do pagamento. Para
-- as demais, a nota deveria existir antes do pagamento — dar baixa num título
-- assim seria um problema real, não um caso de uso.
--
-- Depende de 20260810140000_revisao_contas_receber_baixa_severidade.sql
-- (última reescrita de fat_registrar_baixa) e de
-- 20260828120000_operadoras_nf_apos_pagamento.sql (coluna
-- operadoras.nf_apos_pagamento). CREATE OR REPLACE inteiro porque não dá para
-- alterar só um trecho do corpo de uma function.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_registrar_baixa(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id          UUID;
  v_receb_id         UUID;
  v_vencimento       DATE;
  v_status           TEXT;
  v_valor_total      DECIMAL(15, 2);
  v_glosado_hoje     DECIMAL(15, 2);
  v_numero_nota      TEXT;
  v_nf_apos_pagamento BOOLEAN;
  v_soma_glosas      DECIMAL(15, 2);
  v_valor            DECIMAL(15, 2);
  v_data             DATE;
  v_glosa            JSONB;
  v_req_id           UUID;
  v_lote_id          UUID;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  v_nota_id := NULLIF(p->>'notaId', '')::UUID;
  v_valor   := COALESCE((p->>'valorRecebido')::DECIMAL(15, 2), 0);
  v_data    := COALESCE(NULLIF(p->>'dataRecebimento', '')::DATE, CURRENT_DATE);

  IF v_valor < 0 THEN
    RAISE EXCEPTION 'Valor recebido não pode ser negativo.';
  END IF;

  SELECT n.data_vencimento, n.status, n.valor_total, n.valor_glosado, n.numero_nota,
         o.nf_apos_pagamento
    INTO v_vencimento, v_status, v_valor_total, v_glosado_hoje, v_numero_nota,
         v_nf_apos_pagamento
    FROM notas n
    JOIN operadoras o ON o.id_operadora = n.operadora_id
   WHERE n.id_nota = v_nota_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita baixa.';
  END IF;

  -- Sem número da nota só é aceito para operadoras que emitem a NF depois do
  -- pagamento (issue 31) — para as demais, a nota deveria já existir.
  IF v_numero_nota IS NULL AND NOT v_nf_apos_pagamento THEN
    RAISE EXCEPTION 'Não é possível dar baixa: título sem número da nota.';
  END IF;

  IF v_valor <= 0 AND jsonb_array_length(COALESCE(p->'glosas', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe um valor recebido ou ao menos uma glosa.';
  END IF;

  -- Teto: o que já está glosado no título mais as novas glosas deste lançamento
  -- não pode passar do valor faturado. Checado antes de qualquer INSERT, para a
  -- recusa não deixar rastro.
  SELECT COALESCE(SUM((g->>'valor')::DECIMAL(15, 2)), 0)
    INTO v_soma_glosas
    FROM jsonb_array_elements(COALESCE(p->'glosas', '[]'::jsonb)) AS g;

  IF v_glosado_hoje + v_soma_glosas > v_valor_total THEN
    RAISE EXCEPTION 'Glosa(s) somam mais que o valor do título (% de um total de %).',
      to_char(v_glosado_hoje + v_soma_glosas, 'FM999999999.00'), to_char(v_valor_total, 'FM999999999.00');
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

    v_req_id  := NULLIF(v_glosa->>'requisicaoId', '')::UUID;
    v_lote_id := NULLIF(v_glosa->>'loteId', '')::UUID;

    -- A guia/lote apontado pela glosa precisa pertencer a ESTE título — senão o
    -- rateio por guia mente sobre de onde o desconto veio.
    IF v_req_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM requisicoes r
        JOIN nota_lote nl ON nl.id_lote = r.lote_id
       WHERE r.id_requisicao = v_req_id AND nl.id_nota = v_nota_id
    ) THEN
      RAISE EXCEPTION 'Requisição informada na glosa não pertence a este título.';
    END IF;

    IF v_lote_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM nota_lote nl WHERE nl.id_lote = v_lote_id AND nl.id_nota = v_nota_id
    ) THEN
      RAISE EXCEPTION 'Lote informado na glosa não pertence a este título.';
    END IF;

    INSERT INTO glosas (recebimento_id, nota_id, requisicao_id, lote_id,
                        valor, motivo, codigo_glosa, status)
    VALUES (v_receb_id,
            v_nota_id,
            v_req_id,
            v_lote_id,
            COALESCE((v_glosa->>'valor')::DECIMAL(15, 2), 0),
            v_glosa->>'motivo',
            NULLIF(v_glosa->>'codigoGlosa', ''),
            COALESCE(NULLIF(v_glosa->>'status', ''), 'aberta'));
  END LOOP;

  -- A trigger já recalculou o título a cada INSERT; nada a fazer aqui.
  RETURN v_receb_id;
END;
$$;

COMMENT ON FUNCTION public.fat_registrar_baixa(JSONB) IS 'Registra uma baixa e suas glosas num único statement atômico. Recusa valor recebido negativo, título sem número da nota (exceto operadora com nf_apos_pagamento), glosa de requisição/lote fora do título e glosas que somadas excedam o valor do título. Deixa aplis_sync_status pendente para a fase 2.';

REVOKE ALL ON FUNCTION public.fat_registrar_baixa(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_registrar_baixa(JSONB) TO authenticated;
