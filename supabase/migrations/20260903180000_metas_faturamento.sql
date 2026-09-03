-- ═══════════════════════════════════════════════════════════════════════════════
-- Meta mensal de faturamento (issue 43, feedback do setor, 03/09)
--
-- P2 do levantamento de requisitos: complementa a whitelist de fontes
-- pagadoras da issue 36 (operadoras.is_considerada_meta) com o valor da meta
-- em si — um número único global por mês/ano (soma de todas as fontes já
-- marcadas na whitelist, não quebrado por operadora), sem repetição
-- automática: se o setor não cadastrar a meta de um mês, o dashboard mostra
-- "meta não definida" nesse mês em vez de repetir silenciosamente o valor do
-- mês anterior.
--
-- Auditoria/motivo de exceção da whitelist em si (is_considerada_meta) já é
-- coberta pela issue 44 — não duplicada aqui.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.metas_faturamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano         INTEGER NOT NULL,
  mes         INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_meta  DECIMAL(15, 2) NOT NULL CHECK (valor_meta >= 0),
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes)
);

COMMENT ON TABLE public.metas_faturamento IS 'Meta mensal de faturamento: valor único global (soma das fontes marcadas operadoras.is_considerada_meta) por ano/mês. Uma linha por mês, sem repetição automática do mês anterior quando o setor não cadastra a meta do mês corrente.';

-- Trigger em vez de DEFAULT auth.uid(): a tela grava por upsert (INSERT na
-- primeira vez, UPDATE nas seguintes), e um DEFAULT só se aplicaria no INSERT.
CREATE OR REPLACE FUNCTION public.metas_faturamento_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_metas_faturamento_updated_at ON public.metas_faturamento;
CREATE TRIGGER trigger_metas_faturamento_updated_at
  BEFORE INSERT OR UPDATE ON public.metas_faturamento
  FOR EACH ROW EXECUTE FUNCTION public.metas_faturamento_set_updated_at();

-- ─── RLS — mesmo padrão de operadoras (20260807120000): canViewBilling lê,
-- canManageBilling grava. Sem policy de DELETE: não há tela para remover uma
-- meta já cadastrada nesta entrega.
ALTER TABLE public.metas_faturamento ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'metas_faturamento'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.metas_faturamento', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "metas_faturamento_select_billing" ON public.metas_faturamento
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "metas_faturamento_insert_billing" ON public.metas_faturamento
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

CREATE POLICY "metas_faturamento_update_billing" ON public.metas_faturamento
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- Faturado do mês/ano da meta, restrito às fontes da whitelist — não misturar
-- com o `faturado` do período livre dos KPIs do dashboard (fat_dashboard_receber
-- soma por data_emissao dentro do range escolhido na tela): aqui o range é
-- sempre o mês calendário da meta, travado, independente do filtro da tela.
-- ═══════════════════════════════════════════════════════════════════════════════

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

  -- Por data_vencimento, não data_emissao: o item 5 do spec reaproveita
  -- TitulosList.tsx (desde/ate = este range) como lista "por trás do número"
  -- do widget, e TitulosList já filtra por vencimento (issue 40). Somar por
  -- emissão aqui faria o agregado do widget e a lista de drill-down mostrarem
  -- dois conjuntos de títulos diferentes — exatamente o que o "não pode ser só
  -- gráfico/número" pede para evitar. NULL não compara em BETWEEN (mesmo
  -- comportamento do .gte/.lte do PostgREST em useContasReceber.ts): título
  -- sem vencimento fica fora do cálculo, igual fica fora da lista.
  SELECT jsonb_build_object(
    'faturado',   COALESCE(SUM(n.valor_total), 0),
    'qtdTitulos', COUNT(*)
  ) INTO v_resultado
    FROM notas n
    JOIN operadoras o ON o.id_operadora = n.operadora_id
   WHERE n.status <> 'cancelada'
     AND o.is_considerada_meta = true
     AND n.data_vencimento BETWEEN v_desde AND v_ate;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.fat_meta_mensal_faturado(INTEGER, INTEGER) IS
  'Soma valor_total dos títulos (status <> cancelada) com vencimento no mês/ano informado, restrito às operadoras is_considerada_meta = true (whitelist da issue 36). Fonte do widget "Meta mensal" do dashboard — mesmo range e mesma coluna (data_vencimento) que TitulosList.tsx usa no drill-down "Ver títulos do mês", para o agregado e a lista sempre baterem. Range travado no mês calendário informado, independente do filtro livre da tela do dashboard.';

REVOKE ALL ON FUNCTION public.fat_meta_mensal_faturado(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fat_meta_mensal_faturado(INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.fat_meta_mensal_faturado(INTEGER, INTEGER) TO authenticated;
