-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — orçamento anual por categoria
-- Migration: 20261009170000_gastos_ti_orcamentos.sql
-- (.scratch/gastos-ti/issues/14-orcamento.md)
--
-- Plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §4.1 (ti_orcamentos), RF23, RN13, D10.
-- Depende de 20261009120000_gastos_ti_categorias.sql.
--
-- Um valor anual por categoria e ano, dividido igualmente pelos 12 meses (RN13,
-- feito no frontend). Categoria sem linha aqui = sem orçamento (diferente de
-- orçamento zero, que é uma linha com valor 0).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_categorias') IS NULL OR to_regprocedure('public.ti_auditoria_trigger()') IS NULL THEN
    RAISE EXCEPTION 'ti_categorias/ti_auditoria_trigger() não existem. Aplique 20261009120000_gastos_ti_categorias.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS public.ti_orcamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           smallint NOT NULL
    CONSTRAINT ti_orcamentos_ano_check CHECK (ano BETWEEN 2000 AND 2100),
  categoria_id  uuid NOT NULL REFERENCES public.ti_categorias(id),
  valor_anual   numeric(15, 2) NOT NULL
    CONSTRAINT ti_orcamentos_valor_anual_check CHECK (valor_anual >= 0),
  observacao    text,
  created_by    uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  updated_by    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ti_orcamentos_ano_categoria_key UNIQUE (ano, categoria_id)
);

COMMENT ON TABLE public.ti_orcamentos IS 'Orçamento anual de TI por categoria (plano Gastos de TI, RF23). Distribuído igualmente pelos 12 meses no frontend (RN13). Sem linha = categoria sem orçamento.';
COMMENT ON COLUMN public.ti_orcamentos.valor_anual IS 'Valor do ano inteiro. Zero é um orçamento válido (nada previsto para a categoria).';

CREATE OR REPLACE FUNCTION public.ti_orcamentos_set_carimbos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ti_orcamentos_carimbos ON public.ti_orcamentos;
CREATE TRIGGER trigger_ti_orcamentos_carimbos
  BEFORE INSERT OR UPDATE ON public.ti_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.ti_orcamentos_set_carimbos();

DROP TRIGGER IF EXISTS trg_ti_orcamentos_auditoria ON public.ti_orcamentos;
CREATE TRIGGER trg_ti_orcamentos_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.ti_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.ti_auditoria_trigger();

ALTER TABLE public.ti_orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_orcamentos_select ON public.ti_orcamentos;
CREATE POLICY ti_orcamentos_select ON public.ti_orcamentos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

DROP POLICY IF EXISTS ti_orcamentos_insert ON public.ti_orcamentos;
CREATE POLICY ti_orcamentos_insert ON public.ti_orcamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS ti_orcamentos_update ON public.ti_orcamentos;
CREATE POLICY ti_orcamentos_update ON public.ti_orcamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'))
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

-- Apagar a linha = tirar o orçamento da categoria naquele ano (fica na auditoria).
DROP POLICY IF EXISTS ti_orcamentos_delete ON public.ti_orcamentos;
CREATE POLICY ti_orcamentos_delete ON public.ti_orcamentos
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'));

COMMIT;
