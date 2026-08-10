-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — RPCs
-- Migration: 20260807130000_contas_receber_rpcs.sql
--
-- Depende de 20260807120000_contas_receber.sql.
--
-- As três funções são SECURITY DEFINER: com a RLS restritiva que a migration
-- anterior instalou, uma função INVOKER que precisa ler `lotes` para checar
-- duplicidade e escrever em cinco tabelas na mesma transação esbarraria nas
-- policies em ordens difíceis de prever — o mesmo problema já enfrentado nas
-- RPCs ac_*. Em troca, cada uma valida a permissão na primeira linha: sem esse
-- guard, SECURITY DEFINER seria um buraco aberto a qualquer usuário logado.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Guard comum ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_exigir_permissao_gestao()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_has_permission('canManageBilling') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar contas a receber.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- fat_criar_titulo — agrupa lotes do apLIS num título a receber
--
-- Atômica por necessidade: o título só faz sentido junto do snapshot dos lotes e
-- das guias. Se o snapshot falhar no meio, um título com valor pela metade seria
-- cobrado errado da operadora.
--
-- Payload (montado por api/_lib/handlers/faturamento-titulo-criar.ts):
-- {
--   "operadora": { "aplisId": "12", "nome": "…", "cnpj": "…" },
--   "numeroNota": "NF-1", "dataEmissao": "2026-08-07",
--   "dataVencimento": "2026-09-10" | null,
--   "competencia": "2026-08", "observacoes": "…" | null,
--   "lotes": [{
--     "aplisId": "6423", "codigoLote": "6423",
--     "statusAplis": 3, "statusLabel": "Faturado",
--     "dataCriacao": "2026-07-01", "dataEnvio": "2026-07-05",
--     "protocolo": …, "nfeNumero": …, "numeroRps": …, "dataVencimentoRps": …,
--     "valorTotal": 9320.79, "qtdRequisicoes": 42,
--     "requisicoes": [{ "aplisId": "…", "numeroGuia": "…", "dataCriacao": "…",
--                       "dataExecucao": "…", "valor": 100.0, "pacienteNome": "…",
--                       "procedimentoCodigo": "…", "procedimentoDescricao": "…" }]
--   }]
-- }
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

  -- ─── Operadora ──────────────────────────────────────────────────────────────
  -- Espelhada de fatinstituicao por aplis_id. prazo_pagamento_dias fica de fora
  -- do UPDATE de propósito: é editável no FlowLab e a sync não pode desfazer o
  -- que o financeiro ajustou.
  INSERT INTO operadoras (nome, cnpj, aplis_id)
  VALUES (COALESCE(NULLIF(p#>>'{operadora,nome}', ''), 'Operadora sem nome'),
          NULLIF(p#>>'{operadora,cnpj}', ''),
          NULLIF(p#>>'{operadora,aplisId}', ''))
  ON CONFLICT (aplis_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        cnpj = COALESCE(EXCLUDED.cnpj, operadoras.cnpj)
  RETURNING id_operadora INTO v_operadora_id;

  -- ─── Recusa lote já faturado ────────────────────────────────────────────────
  -- Antes de qualquer escrita: cobrar o mesmo lote duas vezes é o erro caro
  -- deste fluxo, e a checagem tem que ver o estado ANTES do upsert do snapshot.
  -- Título cancelado não conta — o lote volta a estar disponível.
  SELECT string_agg(DISTINCT l.aplis_id, ', ')
    INTO v_conflito
    FROM jsonb_array_elements(p->'lotes') AS item
    JOIN lotes l ON l.aplis_id = item->>'aplisId'
    JOIN nota_lote nl ON nl.id_lote = l.id_lote
    JOIN notas n ON n.id_nota = nl.id_nota
   WHERE n.status <> 'cancelada';

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Lote(s) % já pertencem a um título ativo.', v_conflito;
  END IF;

  -- ─── Título ─────────────────────────────────────────────────────────────────
  -- valor_total sai da soma dos snapshots, não de um campo do payload: é a mesma
  -- conta que a listagem mostrou ao operador, e não há como divergir.
  SELECT COALESCE(SUM((item->>'valorTotal')::DECIMAL(15, 2)), 0)
    INTO v_total
    FROM jsonb_array_elements(p->'lotes') AS item;

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
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p->'lotes')
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

COMMENT ON FUNCTION public.fat_criar_titulo(JSONB) IS 'Cria um título a receber agrupando lotes do apLIS, com snapshot de lotes e guias. Atômica.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- fat_registrar_baixa — uma baixa e, no mesmo statement, as glosas que a
-- explicam.
--
-- Atômica porque baixa sem as glosas correspondentes deixa o saldo mentindo: o
-- título apareceria devendo os R$ 400 que a operadora já recusou pagar, e o
-- aging cobraria eternamente um valor que ninguém vai receber.
--
-- Payload:
-- { "notaId": "uuid", "valorRecebido": 600.00, "dataRecebimento": "2026-09-12",
--   "bancoNome": …, "bancoConta": …, "formaRecebimento": …, "observacoes": …,
--   "glosas": [{ "valor": 400.0, "motivo": "…", "codigoGlosa": …,
--                "status": "definitiva", "requisicaoId": uuid|null,
--                "loteId": uuid|null }] }
-- ═══════════════════════════════════════════════════════════════════════════════
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

COMMENT ON FUNCTION public.fat_registrar_baixa(JSONB) IS 'Registra uma baixa e suas glosas num único statement atômico. Deixa aplis_sync_status pendente para a fase 2.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- fat_dashboard_receber — KPIs, aging, por operadora e série mensal num round-trip
--
-- Agregado no banco, e não no cliente: o aging precisa varrer TODOS os títulos
-- em aberto, inclusive os emitidos fora do período filtrado — um título vencido
-- há 6 meses é justamente o que mais importa ver. Trazer isso para o cliente
-- significaria baixar a base inteira de títulos a cada abertura da tela.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fat_dashboard_receber(
  p_desde     DATE,
  p_ate       DATE,
  p_operadora UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpis         JSONB;
  v_aging        JSONB;
  v_operadoras   JSONB;
  v_serie        JSONB;
BEGIN
  IF NOT (public.current_user_has_permission('canViewBilling')
          OR public.current_user_has_permission('canManageBilling')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar faturamento.' USING ERRCODE = '42501';
  END IF;

  -- Títulos que ainda têm o que cobrar. 'liquidada' e 'recebida' saem porque não
  -- têm saldo; 'cancelada' porque nunca será cobrada.
  WITH abertos AS (
    SELECT n.*
      FROM notas n
     WHERE n.status NOT IN ('cancelada', 'recebida', 'liquidada')
       AND n.valor_saldo > 0
       AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
  ),
  recebido_periodo AS (
    SELECT COALESCE(SUM(r.valor_recebido), 0) AS valor,
           AVG(r.data_receb - n.data_vencimento) AS prazo_medio
      FROM recebimentos r
      JOIN notas n ON n.id_nota = r.nota_id
     WHERE r.status IN ('recebido', 'parcial')
       AND r.data_receb BETWEEN p_desde AND p_ate
       AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
  ),
  glosado_periodo AS (
    -- glosas não têm data própria no schema; created_at é quando o operador a
    -- lançou, que é o que o financeiro quer ver no período.
    SELECT COALESCE(SUM(g.valor), 0) AS valor
      FROM glosas g
      JOIN notas n ON n.id_nota = g.nota_id
     WHERE g.status IN ('aberta', 'em_recurso', 'definitiva')
       AND g.created_at::DATE BETWEEN p_desde AND p_ate
       AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
  )
  SELECT jsonb_build_object(
    'totalReceber',    (SELECT COALESCE(SUM(valor_saldo), 0) FROM abertos),
    'qtdTitulos',      (SELECT COUNT(*) FROM abertos),
    'vencido',         (SELECT COALESCE(SUM(valor_saldo), 0) FROM abertos
                         WHERE data_vencimento IS NOT NULL AND data_vencimento < CURRENT_DATE),
    'recebidoPeriodo', (SELECT valor FROM recebido_periodo),
    'glosadoPeriodo',  (SELECT valor FROM glosado_periodo),
    -- Positivo = recebeu depois do vencimento. NULL quando não houve baixa no período.
    'prazoMedioDias',  (SELECT ROUND(prazo_medio::NUMERIC, 1) FROM recebido_periodo)
  ) INTO v_kpis;

  -- Aging por dias de atraso sobre o vencimento. 'a_vencer' junta o que ainda
  -- não venceu com o que não tem vencimento definido (lote sem RPS e operadora
  -- sem prazo cadastrado) — não é atraso, é dado faltando.
  SELECT jsonb_build_object(
    'a_vencer', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso IS NULL OR atraso <= 0), 0),
    'd1_30',    COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 1 AND 30), 0),
    'd31_60',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 31 AND 60), 0),
    'd61_90',   COALESCE(SUM(valor_saldo) FILTER (WHERE atraso BETWEEN 61 AND 90), 0),
    'd90_mais', COALESCE(SUM(valor_saldo) FILTER (WHERE atraso > 90), 0)
  ) INTO v_aging
  FROM (
    SELECT n.valor_saldo, (CURRENT_DATE - n.data_vencimento) AS atraso
      FROM notas n
     WHERE n.status NOT IN ('cancelada', 'recebida', 'liquidada')
       AND n.valor_saldo > 0
       AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
  ) t;

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
       WHERE n.status <> 'cancelada'
         AND (p_operadora IS NULL OR o.id_operadora = p_operadora)
       GROUP BY o.id_operadora, o.nome
    ) s;

  -- Faturado × recebido × glosado por competência, recortado pela emissão.
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
       WHERE n.status <> 'cancelada'
         AND n.data_emissao BETWEEN p_desde AND p_ate
         AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
       GROUP BY COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM'))
    ) s;

  RETURN jsonb_build_object(
    'kpis',        v_kpis,
    'aging',       v_aging,
    'porOperadora', v_operadoras,
    'serieMensal', v_serie
  );
END;
$$;

COMMENT ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID) IS 'KPIs, aging, recorte por operadora e série mensal de contas a receber num único round-trip.';

-- ─── Grants ───────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.fat_exigir_permissao_gestao()             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_criar_titulo(JSONB)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_registrar_baixa(JSONB)                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_recalcular_nota(UUID)                 FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fat_criar_titulo(JSONB)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fat_registrar_baixa(JSONB)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID) TO authenticated;
