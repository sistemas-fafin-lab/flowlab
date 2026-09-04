-- ═══════════════════════════════════════════════════════════════════════════════
-- Aging da carteira quebrado por operadora, no dashboard de Contas a Receber
--
-- Reaproveita a mesma subquery de atraso do bloco `aging` (títulos em aberto de
-- qualquer período, já filtrados por v_ids), só que agrupada por operadora em vez
-- de somada num total único. O frontend decide quantas operadoras cabem legíveis
-- num gráfico empilhado — aqui devolve a carteira inteira, ordenada pelo maior
-- saldo total.
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
  v_ids               UUID[];
  v_ids_periodo        UUID[];
  v_operadoras_f       UUID[];
  v_lotes              TEXT[];
  v_notas              TEXT[];
  v_kpis               JSONB;
  v_prazos             JSONB;
  v_aging              JSONB;
  v_aging_operadora    JSONB;
  v_operadoras         JSONB;
  v_previsao           JSONB;
  v_serie              JSONB;
  v_motivos            JSONB;
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
    JOIN operadoras o ON o.id_operadora = n.operadora_id
   WHERE n.status <> 'cancelada'
     AND o.is_considerada_meta = true
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

  -- Mesmo recorte e cálculo de atraso do bloco `aging` acima, só que agrupado por
  -- operadora em vez de somado num total único. `total` é a soma dos 5 buckets —
  -- serve pro frontend ordenar e decidir quais operadoras entram no gráfico.
  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha->>'total')::NUMERIC DESC), '[]'::jsonb)
    INTO v_aging_operadora
    FROM (
      SELECT jsonb_build_object(
               'operadoraId', o.id_operadora,
               'nome',        o.nome,
               'a_vencer',    COALESCE(SUM(t.valor_saldo) FILTER (WHERE t.atraso IS NULL OR t.atraso <= 0), 0),
               'd1_30',       COALESCE(SUM(t.valor_saldo) FILTER (WHERE t.atraso BETWEEN 1 AND 30), 0),
               'd31_60',      COALESCE(SUM(t.valor_saldo) FILTER (WHERE t.atraso BETWEEN 31 AND 60), 0),
               'd61_90',      COALESCE(SUM(t.valor_saldo) FILTER (WHERE t.atraso BETWEEN 61 AND 90), 0),
               'd90_mais',    COALESCE(SUM(t.valor_saldo) FILTER (WHERE t.atraso > 90), 0),
               'total',       COALESCE(SUM(t.valor_saldo), 0)
             ) AS linha
        FROM operadoras o
        JOIN (
              SELECT n.operadora_id, n.valor_saldo,
                     ((now() AT TIME ZONE 'America/Sao_Paulo')::DATE - n.data_vencimento) AS atraso
                FROM notas n
               WHERE n.id_nota = ANY(v_ids)
                 AND n.status NOT IN ('recebida', 'liquidada')
                 AND n.valor_saldo > 0
             ) t ON t.operadora_id = o.id_operadora
       GROUP BY o.id_operadora, o.nome
    ) s;

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

  -- Top 8 motivos por valor glosado, no mesmo escopo de status que
  -- notas.valor_glosado (trigger em 20260807120000_contas_receber.sql):
  -- 'revertida' fica de fora porque o recurso foi ganho e o valor voltou a ser
  -- cobrável — sem esse filtro uma glosa revertida ainda inflaria o motivo no
  -- gráfico mesmo não contando mais em kpis.glosado.
  --
  -- Normalizado por lower(btrim(...)) com espaços internos colapsados, para não
  -- separar o mesmo motivo lançado com espaçamento diferente. O rótulo exibido é
  -- o primeiro texto lançado no grupo (created_at), buscado só para os 8
  -- vencedores — não existe catálogo de motivos na tabela nativa (só no legado
  -- apLIS).
  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha->>'valor')::NUMERIC DESC), '[]'::jsonb)
    INTO v_motivos
    FROM (
      SELECT jsonb_build_object(
               'motivo',     (SELECT btrim(g2.motivo)
                                 FROM glosas g2
                                WHERE g2.nota_id = ANY(v_ids_periodo)
                                  AND g2.status IN ('aberta', 'em_recurso', 'definitiva')
                                  AND regexp_replace(lower(btrim(g2.motivo)), '\s+', ' ', 'g') = agr.chave
                                ORDER BY g2.created_at
                                LIMIT 1),
               'valor',      agr.valor,
               'quantidade', agr.quantidade
             ) AS linha
        FROM (
          SELECT regexp_replace(lower(btrim(g.motivo)), '\s+', ' ', 'g') AS chave,
                 SUM(g.valor) AS valor,
                 COUNT(*) AS quantidade
            FROM glosas g
           WHERE g.nota_id = ANY(v_ids_periodo)
             AND g.status IN ('aberta', 'em_recurso', 'definitiva')
           GROUP BY chave
           ORDER BY SUM(g.valor) DESC
           LIMIT 8
        ) agr
    ) s;

  RETURN jsonb_build_object(
    'kpis',               v_kpis,
    'aging',              v_aging,
    'agingPorOperadora',  v_aging_operadora,
    'porOperadora',       v_operadoras,
    'previsaoOperadoras', v_previsao,
    'serieMensal',        v_serie,
    'porMotivo',          v_motivos
  );
END;
$$;

COMMENT ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) IS
  'Dashboard de contas a receber: faturado/recebido/glosado/acatado e prazos previsto/médio/ponderado do período, aging da carteira (total e por operadora), recorte por operadora, série mensal e top 8 motivos de glosa por valor. Filtros de operadora, lote e nota aceitam vários valores (OR dentro do campo, AND entre campos). Recusa p_desde/p_ate nulos.';

REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID[], TEXT[], TEXT[]) TO authenticated;
