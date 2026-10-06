-- ============================================================================
-- Meta mensal: o faturado do mês passa a ser por EMISSÃO, não por vencimento.
--
-- fat_meta_mensal_faturado somava os títulos que VENCEM no mês. Como o prazo
-- varia por operadora, a meta de out/2026 juntava emissões de jul, ago, set e
-- out: R$ 1.541.082,09 (232 títulos) contra R$ 271.937,97 (49 títulos) de
-- faturado real. O histórico de metas tinha a mesma distorção em todos os meses
-- (jan/2026: R$ 19.916,26 por vencimento × R$ 1.080.178,49 por emissão).
--
-- A emissão é o fechamento do lote (20261006120000), a mesma referência do
-- faturado do dashboard (fat_dashboard_receber) e do período da aba Títulos
-- (useContasReceber, revisão de 2026-09-24). O motivo original de usar
-- vencimento — bater com o drill-down "Ver títulos do mês" — não vale mais:
-- a lista já filtra por emissão. A emissão nunca é nula, então nenhum título
-- fica fora de todo mês.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fat_meta_mensal_faturado(p_ano INTEGER, p_mes INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desde     DATE;
  v_ate       DATE;
  v_resultado JSONB;
BEGIN
  IF NOT (public.current_user_has_permission('canViewBilling')
          OR public.current_user_has_permission('canManageBilling')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar faturamento.' USING ERRCODE = '42501';
  END IF;

  IF p_ano IS NULL OR p_mes IS NULL OR p_mes NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Informe ano e mês (1-12) válidos.';
  END IF;

  v_desde := make_date(p_ano, p_mes, 1);
  v_ate   := (v_desde + INTERVAL '1 month - 1 day')::DATE;

  SELECT jsonb_build_object(
    'faturado',   COALESCE(SUM(n.valor_total), 0),
    'qtdTitulos', COUNT(*)
  ) INTO v_resultado
    FROM notas n
    JOIN operadoras o ON o.id_operadora = n.operadora_id
   WHERE n.status <> 'cancelada'
     AND o.is_considerada_meta = true
     AND n.data_emissao BETWEEN v_desde AND v_ate;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.fat_meta_mensal_faturado(INTEGER, INTEGER) IS
  'Soma valor_total dos títulos (status <> cancelada) com emissão (fechamento do lote) no mês/ano informado, restrito às operadoras is_considerada_meta = true (whitelist da issue 36). Fonte do widget "Meta mensal" do dashboard e do histórico de metas — mesma coluna (data_emissao) do faturado do dashboard e do período da aba Títulos. Range travado no mês calendário informado, independente do filtro livre da tela do dashboard.';
