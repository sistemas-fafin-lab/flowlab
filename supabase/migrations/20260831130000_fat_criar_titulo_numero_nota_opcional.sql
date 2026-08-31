-- ═══════════════════════════════════════════════════════════════════════════════
-- fat_criar_titulo — número da nota deixa de ser obrigatório
-- Migration: 20260831130000_fat_criar_titulo_numero_nota_opcional.sql
--
-- Issue 32 do feedback do setor de faturamento (31/08): remove o
-- RAISE EXCEPTION que barrava a criação sem número da nota. String vazia
-- continua normalizada para NULL na gravação (NULLIF), nunca gravada como ''.
--
-- Depende de 20260831120000_notas_numero_nota_opcional.sql (coluna sem
-- NOT NULL) e de 20260819140000_fat_criar_titulo_codigo_requisicao.sql
-- (versão vigente da função, reconstruída aqui, não descartada).
-- CREATE OR REPLACE inteiro porque não dá para alterar só um trecho do corpo
-- de uma function.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fat_criar_titulo(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operadora_id UUID;
  v_nota_id      UUID;
  v_lote_id      UUID;
  v_aplis_lote   TEXT;
  v_total        DECIMAL(15, 2) := 0;
  v_lotes_dedup  JSONB;
  v_lote         JSONB;
  v_req          JSONB;
  v_conflito     TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF p IS NULL OR jsonb_array_length(COALESCE(p->'lotes', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um lote para criar o título.';
  END IF;

  -- Um aplisId repetido no array vira um lote só a partir daqui: soma, checagem
  -- de duplicidade e snapshot leem sempre a mesma lista deduplicada.
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_lotes_dedup
    FROM (
      SELECT DISTINCT ON (item->>'aplisId') item
        FROM jsonb_array_elements(p->'lotes') AS item
       ORDER BY item->>'aplisId'
    ) d;

  -- ─── Operadora ──────────────────────────────────────────────────────────────
  INSERT INTO operadoras (nome, cnpj, aplis_id)
  VALUES (COALESCE(NULLIF(p#>>'{operadora,nome}', ''), 'Operadora sem nome'),
          NULLIF(p#>>'{operadora,cnpj}', ''),
          NULLIF(p#>>'{operadora,aplisId}', ''))
  ON CONFLICT (aplis_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        cnpj = COALESCE(EXCLUDED.cnpj, operadoras.cnpj)
  RETURNING id_operadora INTO v_operadora_id;

  -- ─── Recusa lote já faturado ────────────────────────────────────────────────
  SELECT string_agg(DISTINCT l.aplis_id, ', ')
    INTO v_conflito
    FROM jsonb_array_elements(v_lotes_dedup) AS item
    JOIN lotes l ON l.aplis_id = item->>'aplisId'
    JOIN nota_lote nl ON nl.id_lote = l.id_lote
    JOIN notas n ON n.id_nota = nl.id_nota
   WHERE n.status <> 'cancelada';

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) % já pertencem a um título ativo.', v_conflito;
  END IF;

  -- ─── Título ─────────────────────────────────────────────────────────────────
  SELECT COALESCE(SUM((item->>'valorTotal')::DECIMAL(15, 2)), 0)
    INTO v_total
    FROM jsonb_array_elements(v_lotes_dedup) AS item;

  INSERT INTO notas (operadora_id, numero_nota, data_emissao, data_vencimento,
                     valor_total, competencia, observacoes, criado_por)
  VALUES (v_operadora_id,
          NULLIF(p->>'numeroNota', ''),
          COALESCE(NULLIF(p->>'dataEmissao', '')::DATE, CURRENT_DATE),
          NULLIF(p->>'dataVencimento', '')::DATE,
          v_total,
          NULLIF(p->>'competencia', ''),
          NULLIF(p->>'observacoes', ''),
          auth.uid())
  RETURNING id_nota INTO v_nota_id;

  -- ─── Snapshot dos lotes e das guias ─────────────────────────────────────────
  FOR v_lote IN SELECT * FROM jsonb_array_elements(v_lotes_dedup)
  LOOP
    v_aplis_lote := v_lote->>'aplisId';

    INSERT INTO lotes (operadora_id, codigo_lote, data_criacao, data_envio,
                       status, status_aplis, protocolo, nfe_numero, numero_rps,
                       data_vencimento_rps, valor_total, qtd_requisicoes,
                       aplis_id, data_snapshot)
    VALUES (v_operadora_id,
            COALESCE(NULLIF(v_lote->>'codigoLote', ''), v_aplis_lote),
            COALESCE(NULLIF(v_lote->>'dataCriacao', '')::DATE, CURRENT_DATE),
            NULLIF(v_lote->>'dataEnvio', '')::DATE,
            COALESCE(NULLIF(v_lote->>'statusLabel', ''), 'Faturado'),
            NULLIF(v_lote->>'statusAplis', '')::SMALLINT,
            NULLIF(v_lote->>'protocolo', ''),
            NULLIF(v_lote->>'nfeNumero', ''),
            NULLIF(v_lote->>'numeroRps', '')::INTEGER,
            NULLIF(v_lote->>'dataVencimentoRps', '')::DATE,
            COALESCE((v_lote->>'valorTotal')::DECIMAL(15, 2), 0),
            COALESCE((v_lote->>'qtdRequisicoes')::INTEGER, 0),
            v_aplis_lote,
            NOW())
    ON CONFLICT (aplis_id) DO UPDATE
      SET operadora_id        = EXCLUDED.operadora_id,
          codigo_lote         = EXCLUDED.codigo_lote,
          data_criacao        = EXCLUDED.data_criacao,
          data_envio          = EXCLUDED.data_envio,
          status              = EXCLUDED.status,
          status_aplis        = EXCLUDED.status_aplis,
          protocolo           = EXCLUDED.protocolo,
          nfe_numero          = EXCLUDED.nfe_numero,
          numero_rps          = EXCLUDED.numero_rps,
          data_vencimento_rps = EXCLUDED.data_vencimento_rps,
          valor_total         = EXCLUDED.valor_total,
          qtd_requisicoes     = EXCLUDED.qtd_requisicoes,
          data_snapshot       = NOW()
    RETURNING id_lote INTO v_lote_id;

    FOR v_req IN SELECT * FROM jsonb_array_elements(COALESCE(v_lote->'requisicoes', '[]'::jsonb))
    LOOP
      -- codigo_requisicao usa COALESCE(novo, existente) no upsert, como cnpj em
      -- operadoras acima: um re-sync sem CodRequisicao (apLIS devolveu vazio)
      -- não pode apagar um valor já conhecido.
      INSERT INTO requisicoes (lote_id, numero_guia, codigo_requisicao, data_criacao,
                               data_execucao, valor, status, paciente_nome,
                               procedimento_codigo, procedimento_descricao, aplis_id)
      VALUES (v_lote_id,
              COALESCE(NULLIF(v_req->>'numeroGuia', ''), 'sem-guia'),
              NULLIF(v_req->>'codigoRequisicao', ''),
              COALESCE(NULLIF(v_req->>'dataCriacao', '')::DATE, CURRENT_DATE),
              NULLIF(v_req->>'dataExecucao', '')::DATE,
              COALESCE((v_req->>'valor')::DECIMAL(15, 2), 0),
              'faturada',
              NULLIF(v_req->>'pacienteNome', ''),
              NULLIF(v_req->>'procedimentoCodigo', ''),
              NULLIF(v_req->>'procedimentoDescricao', ''),
              NULLIF(v_req->>'aplisId', ''))
      ON CONFLICT (aplis_id) DO UPDATE
        SET lote_id                = EXCLUDED.lote_id,
            numero_guia            = EXCLUDED.numero_guia,
            codigo_requisicao      = COALESCE(EXCLUDED.codigo_requisicao, requisicoes.codigo_requisicao),
            data_criacao           = EXCLUDED.data_criacao,
            data_execucao          = EXCLUDED.data_execucao,
            valor                  = EXCLUDED.valor,
            status                 = EXCLUDED.status,
            paciente_nome          = EXCLUDED.paciente_nome,
            procedimento_codigo    = EXCLUDED.procedimento_codigo,
            procedimento_descricao = EXCLUDED.procedimento_descricao;
    END LOOP;

    INSERT INTO nota_lote (id_nota, id_lote) VALUES (v_nota_id, v_lote_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_nota_id;
END;
$$;

COMMENT ON FUNCTION public.fat_criar_titulo(JSONB) IS 'Cria um título a receber agrupando lotes do apLIS, com snapshot de lotes e guias (inclui codigo_requisicao). Atômica. Deduplica lotes por aplisId. Número da nota é opcional (issue 32).';
