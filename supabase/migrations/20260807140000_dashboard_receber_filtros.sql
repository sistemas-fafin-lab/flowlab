-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber — dashboard: novos KPIs e filtros de lote/nota
-- Migration: 20260807140000_dashboard_receber_filtros.sql
--
-- Depende de 20260807130000_contas_receber_rpcs.sql.
--
-- Duas mudanças em fat_dashboard_receber:
--
-- 1. Os KPIs deixam de misturar duas bases. A versão anterior somava saldo da
--    carteira inteira (totalReceber, vencido) com movimento de caixa do período
--    (recebidoPeriodo, glosadoPeriodo) na mesma linha de cards — números que não
--    fecham entre si. Agora os quatro saem do MESMO conjunto de títulos, os
--    emitidos no período filtrado, e são a decomposição de um único total:
--
--      faturado = o que foi cobrado
--      recebido = quanto disso já entrou
--      glosado  = quanto a operadora recusou (aberta + em_recurso + definitiva)
--      acatado  = quanto do glosado já virou perda assumida (definitiva)
--
--    `acatado` é sempre um subconjunto de `glosado`: é o mesmo recorte que
--    fat_recalcular_nota usa em v_definitiva. Glosa 'revertida' não entra em
--    nenhum dos dois — o recurso foi ganho e o valor voltou a ser cobrável.
--
-- 2. Dois filtros novos, p_lote e p_nota, por busca parcial case-insensitive.
--    Valem para todas as seções (KPIs, aging, operadoras, série), senão os
--    gráficos contariam títulos que os cards já excluíram.
--
-- A assinatura muda, então o DROP é obrigatório: manter as duas versões deixaria
-- a chamada por parâmetro nomeado do cliente ambígua.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.fat_dashboard_receber(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.fat_dashboard_receber(
  p_desde     DATE,
  p_ate       DATE,
  p_operadora UUID DEFAULT NULL,
  p_lote      TEXT DEFAULT NULL,
  p_nota      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids        UUID[];
  v_lote       TEXT;
  v_nota       TEXT;
  v_kpis       JSONB;
  v_aging      JSONB;
  v_operadoras JSONB;
  v_serie      JSONB;
BEGIN
  IF NOT (public.current_user_has_permission('canViewBilling')
          OR public.current_user_has_permission('canManageBilling')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar faturamento.' USING ERRCODE = '42501';
  END IF;

  v_lote := lower(NULLIF(btrim(COALESCE(p_lote, '')), ''));
  v_nota := lower(NULLIF(btrim(COALESCE(p_nota, '')), ''));

  -- Universo da tela, resolvido uma vez só. Sem recorte de data: cada seção
  -- aplica o seu (o aging olha a carteira inteira, os KPIs olham o período).
  --
  -- POSITION em vez de ILIKE de propósito: o texto vem cru do operador e `%` ou
  -- `_` digitados no número da nota viram curinga silencioso no LIKE.
  SELECT COALESCE(array_agg(n.id_nota), '{}')
    INTO v_ids
    FROM notas n
   WHERE n.status <> 'cancelada'
     AND (p_operadora IS NULL OR n.operadora_id = p_operadora)
     AND (v_nota IS NULL OR POSITION(v_nota IN lower(n.numero_nota)) > 0)
     AND (v_lote IS NULL OR EXISTS (
           SELECT 1
             FROM nota_lote nl
             JOIN lotes l ON l.id_lote = nl.id_lote
            WHERE nl.id_nota = n.id_nota
              AND (POSITION(v_lote IN lower(l.codigo_lote)) > 0
                   OR POSITION(v_lote IN lower(COALESCE(l.aplis_id, ''))) > 0)
         ));

  -- ─── KPIs ───────────────────────────────────────────────────────────────────
  -- Recortados pela emissão, para fecharem com o gráfico de série mensal: os
  -- quatro cards são exatamente a soma das barras que aparecem logo abaixo.
  WITH titulos AS (
    SELECT n.id_nota, n.valor_total, n.valor_recebido, n.valor_glosado
      FROM notas n
     WHERE n.id_nota = ANY(v_ids)
       AND n.data_emissao BETWEEN p_desde AND p_ate
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

  -- ─── Aging ──────────────────────────────────────────────────────────────────
  -- Sem recorte de data: um título vencido há seis meses é justamente o que mais
  -- importa ver. 'a_vencer' junta o que ainda não venceu com o que não tem
  -- vencimento definido — não é atraso, é dado faltando.
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
     WHERE n.id_nota = ANY(v_ids)
       AND n.status NOT IN ('recebida', 'liquidada')
       AND n.valor_saldo > 0
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
       WHERE n.id_nota = ANY(v_ids)
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
       WHERE n.id_nota = ANY(v_ids)
         AND n.data_emissao BETWEEN p_desde AND p_ate
       GROUP BY COALESCE(n.competencia, to_char(n.data_emissao, 'YYYY-MM'))
    ) s;

  RETURN jsonb_build_object(
    'kpis',         v_kpis,
    'aging',        v_aging,
    'porOperadora', v_operadoras,
    'serieMensal',  v_serie
  );
END;
$$;

COMMENT ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID, TEXT, TEXT) IS
  'Dashboard de contas a receber: faturado/recebido/glosado/acatado do período, aging da carteira, recorte por operadora e série mensal. Filtra por operadora, lote e número da nota.';

-- Grants nominais: REVOKE FROM PUBLIC não basta no Supabase, os default
-- privileges já deram EXECUTE explícito a anon/authenticated.
REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fat_dashboard_receber(DATE, DATE, UUID, TEXT, TEXT) TO authenticated;
