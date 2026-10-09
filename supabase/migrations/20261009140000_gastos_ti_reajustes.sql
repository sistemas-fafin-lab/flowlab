-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — reajustes datados das despesas
-- Migration: 20261009140000_gastos_ti_reajustes.sql
-- (.scratch/gastos-ti/issues/04-despesa-painel-reajuste-encerrar.md)
--
-- Plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §4.1 (ti_despesa_reajustes), RF03, RN04.
-- Depende de 20261009130000_gastos_ti_despesas.sql.
--
-- Por que tabela própria em vez de editar ti_despesas.valor_base: editar o
-- valor reescreveria a previsão dos meses já fechados. Com reajuste datado, o
-- previsto de set/2026 continua sendo o de set/2026 depois de um reajuste em
-- jan/2027. O valor vigente numa competência = reajuste mais recente com
-- vigente_desde <= competência; sem reajuste, valor_base (domain/recorrencia.ts).
--
-- A quantidade (licenças, usuários) também pode mudar no reajuste; a quantidade
-- vigente segue a mesma regra, sem reescrever ti_despesas.quantidade.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_despesas') IS NULL THEN
    RAISE EXCEPTION 'ti_despesas não existe. Aplique 20261009130000_gastos_ti_despesas.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS public.ti_despesa_reajustes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id     uuid NOT NULL REFERENCES public.ti_despesas(id) ON DELETE CASCADE,
  vigente_desde  date NOT NULL
    CONSTRAINT ti_despesa_reajustes_vigente_desde_check CHECK (extract(day FROM vigente_desde) = 1),
  valor          numeric(15, 2) NOT NULL
    CONSTRAINT ti_despesa_reajustes_valor_check CHECK (valor > 0),
  motivo         text NOT NULL
    CONSTRAINT ti_despesa_reajustes_motivo_check CHECK (motivo IN ('reajuste_contratual', 'renegociacao', 'mudanca_quantidade', 'outro')),
  quantidade     integer
    CONSTRAINT ti_despesa_reajustes_quantidade_check CHECK (quantidade IS NULL OR quantidade > 0),
  observacao     text,
  created_by     uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ti_despesa_reajustes_despesa_mes_key UNIQUE (despesa_id, vigente_desde)
);

COMMENT ON TABLE public.ti_despesa_reajustes IS 'Mudanças de valor (e opcionalmente de quantidade) de uma despesa de TI a partir de uma competência, sem reescrever o passado (plano Gastos de TI, RF03/RN04).';
COMMENT ON COLUMN public.ti_despesa_reajustes.vigente_desde IS 'Competência (1º dia do mês) a partir da qual o novo valor vale. Sempre depois da competência inicial da despesa: no próprio mês inicial, o certo é corrigir valor_base.';
COMMENT ON COLUMN public.ti_despesa_reajustes.motivo IS 'renegociacao com valor menor que o anterior alimenta o KPI de economias do dashboard (issue 15).';
COMMENT ON COLUMN public.ti_despesa_reajustes.quantidade IS 'Nova quantidade a partir de vigente_desde, quando mudou. NULL = quantidade não mudou neste reajuste.';

-- O índice da UNIQUE (despesa_id, vigente_desde) já atende a busca por despesa.

-- Reajuste no mês inicial (ou antes) seria uma correção disfarçada: o valor
-- base passaria a valer só "a partir do início", o que é o próprio valor base.
CREATE OR REPLACE FUNCTION public.ti_despesa_reajustes_validar()
RETURNS TRIGGER AS $$
DECLARE
  v_inicio date;
BEGIN
  SELECT competencia_inicio INTO v_inicio FROM public.ti_despesas WHERE id = NEW.despesa_id;
  IF v_inicio IS NOT NULL AND NEW.vigente_desde <= v_inicio THEN
    RAISE EXCEPTION 'O reajuste precisa valer a partir de um mês depois do início da despesa (%).', to_char(v_inicio, 'MM/YYYY')
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ti_despesa_reajustes_validar ON public.ti_despesa_reajustes;
CREATE TRIGGER trigger_ti_despesa_reajustes_validar
  BEFORE INSERT OR UPDATE ON public.ti_despesa_reajustes
  FOR EACH ROW EXECUTE FUNCTION public.ti_despesa_reajustes_validar();

DROP TRIGGER IF EXISTS trg_ti_despesa_reajustes_auditoria ON public.ti_despesa_reajustes;
CREATE TRIGGER trg_ti_despesa_reajustes_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.ti_despesa_reajustes
  FOR EACH ROW EXECUTE FUNCTION public.ti_auditoria_trigger();

ALTER TABLE public.ti_despesa_reajustes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_despesa_reajustes_select ON public.ti_despesa_reajustes;
CREATE POLICY ti_despesa_reajustes_select ON public.ti_despesa_reajustes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

DROP POLICY IF EXISTS ti_despesa_reajustes_insert ON public.ti_despesa_reajustes;
CREATE POLICY ti_despesa_reajustes_insert ON public.ti_despesa_reajustes
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS ti_despesa_reajustes_update ON public.ti_despesa_reajustes;
CREATE POLICY ti_despesa_reajustes_update ON public.ti_despesa_reajustes
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'))
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

-- Remover um reajuste lançado por engano é permitido (fica na auditoria).
DROP POLICY IF EXISTS ti_despesa_reajustes_delete ON public.ti_despesa_reajustes;
CREATE POLICY ti_despesa_reajustes_delete ON public.ti_despesa_reajustes
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'));

COMMIT;
