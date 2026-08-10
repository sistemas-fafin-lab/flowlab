-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — achados de severidade baixa/nit da revisão
-- Migration: 20260810140000_revisao_contas_receber_baixa_severidade.sql
--
-- Depende de 20260810130000_baixa_valor_negativo.sql (que já reescreveu
-- fat_registrar_baixa) e, por tabela, de 20260807150000_previsao_pagamento.sql
-- (última reescrita de fat_dashboard_receber).
--
-- Achados fechados aqui: 1.2, 1.3, 2.3, 2.4 e a parte de 2.6 que ainda não tinha
-- sido resolvida pelas reescritas 20260807140000/150000 (timezone da glosa e o
-- filtro duplicado de "abertos" já saíram de cena nelas).
--
-- AUTOSSUFICIENTE (IF EXISTS / OR REPLACE em tudo): há drift conhecido entre
-- eqz (test) e jqx (prod).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_registrar_baixa(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'fat_registrar_baixa(JSONB) não existe. Aplique as migrations de contas a receber antes desta.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1.2 — índices duplicados/redundantes
--
-- idx_recebimentos_data_receb_valor prometia (data_receb, valor) mas nasceu
-- idêntica a idx_recebimentos_data_receb (base, só data_receb) — nome mentindo
-- sobre a coluna. Vira de fato composta, que é o que o KPI de recebido-no-período
-- varre (soma valor_recebido filtrado por data_receb), e a antiga simples,
-- agora prefixo redundante dela, sai de cena.
--
-- idx_notas_data_vencimento (base) e idx_glosas_nota (base) são prefixos dos
-- compostos que esta feature criou (idx_notas_vencimento_status,
-- idx_glosas_nota_status) — todo plano que usaria o simples usa o composto
-- igual ou melhor.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_recebimentos_data_receb_valor;
DROP INDEX IF EXISTS idx_recebimentos_data_receb;
CREATE INDEX IF NOT EXISTS idx_recebimentos_data_receb_valor ON recebimentos(data_receb, valor_recebido);

DROP INDEX IF EXISTS idx_notas_data_vencimento;
DROP INDEX IF EXISTS idx_glosas_nota;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1.3 — comentário impreciso de notas.valor_saldo
--
-- O motivo real de STORED (e não uma view) é que não existe coluna gerada
-- VIRTUAL antes do Postgres 18 — STORED é a única opção disponível, não uma
-- escolha de performance para aging. Nada no módulo filtra ou ordena por
-- valor_saldo hoje: useContasReceber ordena por data_vencimento/data_emissao e
-- fat_dashboard_receber filtra por status + data_vencimento.
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN public.notas.valor_saldo IS
  'valor_total - valor_recebido - valor_glosado. Derivada; é o que ainda se espera receber. STORED porque não existe coluna gerada VIRTUAL antes do Postgres 18 — não é escolha de performance.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2.3 — fat_criar_titulo não deduplicava lotes por aplisId
--
-- payload com o mesmo aplisId duas vezes somava o valor duas vezes em
-- valor_total, mas nota_lote (PK composta) só gravava um vínculo — o título
-- cobrava o dobro do que os lotes vinculados somavam. O handler já deduplica
-- (new Set), mas a RPC é GRANT EXECUTE TO authenticated e não deveria depender
-- de o chamador ter limpado o payload.
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
  IF COALESCE(NULLIF(p->>'numeroNota', ''), '') = '' THEN
    RAISE EXCEPTION 'Número da nota é obrigatório.';
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
          p->>'numeroNota',
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
      INSERT INTO requisicoes (lote_id, numero_guia, data_criacao, data_execucao,
                               valor, status, paciente_nome, procedimento_codigo,
                               procedimento_descricao, aplis_id)
      VALUES (v_lote_id,
              COALESCE(NULLIF(v_req->>'numeroGuia', ''), 'sem-guia'),
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

COMMENT ON FUNCTION public.fat_criar_titulo(JSONB) IS 'Cria um título a receber agrupando lotes do apLIS, com snapshot de lotes e guias. Atômica. Deduplica lotes por aplisId.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2.4 — glosa não validada contra o título
--
-- fat_registrar_baixa inseria as glosas sem conferir mais nada além do motivo:
-- requisicaoId/loteId de outro título eram aceitos (o rateio por guia passava a
-- apontar pra fora), e não havia teto — uma glosa maior que o título deixava
-- valor_saldo bem negativo sem aviso nenhum. Diferente do excesso em
-- valorRecebido (achado 4.4, aceito por decisão consciente do operador com
-- confirmação explícita na tela), uma glosa maior que o valor faturado não tem
-- cenário legítimo: a operadora não pode recusar mais do que foi cobrado dela.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_registrar_baixa(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id      UUID;
  v_receb_id     UUID;
  v_vencimento   DATE;
  v_status       TEXT;
  v_valor_total  DECIMAL(15, 2);
  v_glosado_hoje DECIMAL(15, 2);
  v_soma_glosas  DECIMAL(15, 2);
  v_valor        DECIMAL(15, 2);
  v_data         DATE;
  v_glosa        JSONB;
  v_req_id       UUID;
  v_lote_id      UUID;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  v_nota_id := NULLIF(p->>'notaId', '')::UUID;
  v_valor   := COALESCE((p->>'valorRecebido')::DECIMAL(15, 2), 0);
  v_data    := COALESCE(NULLIF(p->>'dataRecebimento', '')::DATE, CURRENT_DATE);

  IF v_valor < 0 THEN
    RAISE EXCEPTION 'Valor recebido não pode ser negativo.';
  END IF;

  SELECT data_vencimento, status, valor_total, valor_glosado
    INTO v_vencimento, v_status, v_valor_total, v_glosado_hoje
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

COMMENT ON FUNCTION public.fat_registrar_baixa(JSONB) IS 'Registra uma baixa e suas glosas num único statement atômico. Recusa valor recebido negativo, glosa de requisição/lote fora do título e glosas que somadas excedam o valor do título. Deixa aplis_sync_status pendente para a fase 2.';

REVOKE ALL ON FUNCTION public.fat_criar_titulo(JSONB)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_criar_titulo(JSONB)    TO authenticated;
REVOKE ALL ON FUNCTION public.fat_registrar_baixa(JSONB)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_registrar_baixa(JSONB) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2.6 — p_desde/p_ate nulos em fat_dashboard_receber devolviam zero em silêncio
--
-- O hook sempre manda os dois como string, então isto é robustez e não um bug em
-- produção — mas um zero silencioso é o pior tipo de resposta errada num
-- dashboard financeiro. A ambiguidade de qtdTitulos (kpis = período,
-- porOperadora = carteira inteira) fica documentada no tipo TS, que é onde o
-- consumo dos dois lado a lado acontece; a timezone da glosa e o filtro
-- duplicado de "abertos" já saíram de cena nas reescritas 140000/150000.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_dashboard_receber(
  p_desde      DATE,
  p_ate        DATE,
  p_operadoras UUID[] DEFAULT NULL,
  p_lotes      TEXT[] DEFAULT NULL,
  p_notas      TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids         UUID[];
  v_ids_periodo UUID[];
  v_operadoras_f UUID[];
  v_lotes       TEXT[];
  v_notas       TEXT[];
  v_kpis        JSONB;
  v_prazos      JSONB;
  v_aging       JSONB;
  v_operadoras  JSONB;
  v_previsao    JSONB;
  v_serie       JSONB;
BEGIN
  IF NOT (public.current_user_has_permission('canViewBilling')
          OR public.current_user_has_permission('canManageBilling')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar faturamento.' USING ERRCODE = '42501';
  END IF;

  IF p_desde IS NULL OR p_ate IS NULL THEN
    RAISE EXCEPTION 'Informe o período (desde/até).';
  END IF;

  v_operadoras_f := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_operadoras, '{}'::UUID[])) AS x
                           WHERE x IS NOT NULL);
  v_lotes        := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM unnest(COALESCE(p_lotes, '{}'::TEXT[])) AS x
                           WHERE btrim(COALESCE(x, '')) <> '');
  v_notas        := ARRAY(SELECT DISTINCT lower(btrim(x)) FROM unnest(COALESCE(p_notas, '{}'::TEXT[])) AS x
                           WHERE btrim(COALESCE(x, '')) <> '');

  SELECT COALESCE(array_agg(n.id_nota), '{}')
    INTO v_ids
    FROM notas n
   WHERE n.status <> 'cancelada'
     AND (cardinality(v_operadoras_f) = 0 OR n.operadora_id = ANY(v_operadoras_f))
     AND (cardinality(v_notas) = 0 OR EXISTS (
           SELECT 1 FROM unnest(v_notas) AS termo
            WHERE POSITION(termo IN lower(n.numero_nota)) > 0
         ))
     AND (cardinality(v_lotes) = 0 OR EXISTS (
           SELECT 1
             FROM nota_lote nl
             JOIN lotes l ON l.id_lote = nl.id_lote
             CROSS JOIN unnest(v_lotes) AS termo
            WHERE nl.id_nota = n.id_nota
              AND (POSITION(termo IN lower(l.codigo_lote)) > 0
                   OR POSITION(termo IN lower(COALESCE(l.aplis_id, ''))) > 0)
         ));

  SELECT COALESCE(array_agg(n.id_nota), '{}')
    INTO v_ids_periodo
    FROM notas n
   WHERE n.id_nota = ANY(v_ids)
     AND n.data_emissao BETWEEN p_desde AND p_ate;

  WITH titulos AS (
    SELECT n.id_nota, n.valor_total, n.valor_recebido, n.valor_glosado
      FROM notas n
     WHERE n.id_nota = ANY(v_ids_periodo)
  )
  SELECT jsonb_build_object(
    'faturado',   (SELECT COALESCE(SUM(valor_total), 0)    FROM titulos),
    'recebido',   (SELECT COALESCE(SUM(valor_recebido), 0) FROM titulos),
    'glosado',    (SELECT COALESCE(SUM(valor_glosado), 0)  FROM titulos),
    'acatado',    (SELECT COALESCE(SUM(g.valor), 0)
                     FROM glosas g
                    WHERE g.nota_id IN (SELECT id_nota FROM titulos)
                      AND g.status = 'definitiva'),
    'qtdTitulos', (SELECT COUNT(*) FROM titulos)
  ) INTO v_kpis;

  SELECT jsonb_build_object(
    'prazoPrevistoDias',  ROUND(AVG(dias_previstos)::NUMERIC, 1),
    'prazoMedioDias',     ROUND(AVG(dias_reais)::NUMERIC, 1),
    'prazoPonderadoDias', ROUND((SUM(dias_reais * peso) / NULLIF(SUM(peso), 0))::NUMERIC, 1),
    'prazoBaseTitulos',   COUNT(*) FILTER (WHERE dias_reais IS NOT NULL)
  ) INTO v_prazos
  FROM public.fat_prazos_titulos(v_ids_periodo);

  v_kpis := v_kpis || v_prazos;

  SELECT jsonb_build_object(
    'a_vencer', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso IS NULL OR atraso <= 0), 0),
    'd1_30',    COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 1 AND 30), 0),
    'd31_60',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 31 AND 60), 0),
    'd61_90',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 61 AND 90), 0),
    'd90_mais', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso > 90), 0)
  ) INTO v_aging
  FROM (
    -- Brasília, não UTC: CURRENT_DATE no Supabase é UTC, e depois das 21h de
    -- Brasília já discordava por um dia do badge de atraso da lista (que compara
    -- com a data local do navegador) — o mesmo título aparecia "vence em 1d" na
    -- linha e já dentro do bucket d1_30 no aging.
    SELECT n.valor_saldo, ((now() AT TIME ZONE 'America/Sao_Paulo')::DATE - n.data_vencimento) AS atraso
      FROM notas n
     WHERE n.id_nota = ANY(v_ids)
       AND n.status NOT IN ('recebida', 'liquidada')
       AND n.valor_saldo > 0
  ) t;

  -- qtdTitulos aqui é a carteira inteira (todo título não cancelado da
  -- operadora), não recortada pelo período — mesmo escopo de saldo/faturado/
  -- glosado nesta seção. Ver o comentário do tipo DashboardReceber no frontend.
  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha->>'saldo')::NUMERIC DESC), '[]'::jsonb)
    INTO v_operadoras
    FROM (
      SELECT jsonb_build_object(
               'operadoraId',    o.id_operadora,
               'nome',           o.nome,
               'saldo',          COALESCE(SUM(n.valor_saldo), 0),
               'qtdTitulos',     COUNT(n.id_nota),
               'faturado',       COALESCE(SUM(n.valor_total), 0),
               'glosado',        COALESCE(SUM(n.valor_glosado), 0),
               'percentualGlosa', CASE WHEN COALESCE(SUM(n.valor_total), 0) > 0
                                       THEN ROUND(100 * SUM(n.valor_glosado) / SUM(n.valor_total), 1)
                                       ELSE 0 END
             ) AS linha
        FROM operadoras o
        JOIN notas n ON n.operadora_id = o.id_operadora
       WHERE n.id_nota = ANY(v_ids)
       GROUP BY o.id_operadora, o.nome
    ) s;

  SELECT COALESCE(jsonb_agg(linha ORDER BY linha->>'nome'), '[]'::jsonb)
    INTO v_previsao
    FROM (
      SELECT jsonb_build_object(
               'operadoraId',    o.id_operadora,
               'nome',           o.nome,
               'regra',          o.regra_prazo_descricao,
               'qtdTitulos',     COUNT(*),
               'prazoPrevisto',  ROUND(AVG(pz.dias_previstos)::NUMERIC, 1),
               'prazoMedio',     ROUND(AVG(pz.dias_reais)::NUMERIC, 1),
               'prazoPonderado', ROUND((SUM(pz.dias_reais * pz.peso)
                                        / NULLIF(SUM(pz.peso), 0))::NUMERIC, 1),
               'base',           COUNT(pz.dias_reais)
             ) AS linha
        FROM public.fat_prazos_titulos(v_ids_periodo) pz
        JOIN operadoras o ON o.id_operadora = pz.operadora_id
       GROUP BY o.id_operadora, o.nome, o.regra_prazo_descricao
    ) s;

  SELECT COALESCE(jsonb_agg(linha ORDER BY linha->>'competencia'), '[]'::jsonb)
    INTO v_serie
    FROM (
      SELECT jsonb_build_object(
               'competencia', COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM')),
               'faturado',    COALESCE(SUM(n.valor_total), 0),
               'recebido',    COALESCE(SUM(n.valor_recebido), 0),
               'glosado',     COALESCE(SUM(n.valor_glosado), 0)
             ) AS linha
        FROM notas n
       WHERE n.id_nota = ANY(v_ids_periodo)
       GROUP BY COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM'))
    ) s;

  RETURN jsonb_build_object(
    'kpis',               v_kpis,
    'aging',              v_aging,
    'porOperadora',       v_operadoras,
    'previsaoOperadoras', v_previsao,
    'serieMensal',        v_serie
  );
END;
$$;

COMMENT ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) IS
  'Dashboard de contas a receber: faturado/recebido/glosado/acatado e prazos previsto/médio/ponderado do período, aging da carteira, recorte por operadora e série mensal. Filtros de operadora, lote e nota aceitam vários valores (OR dentro do campo, AND entre campos). Recusa p_desde/p_ate nulos.';

REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) TO authenticated;
