-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — lançamentos (o realizado de cada ocorrência)
-- Migration: 20261009160000_gastos_ti_lancamentos.sql
-- (.scratch/gastos-ti/issues/06-mes-a-mes-baixa-dispensa.md)
--
-- Plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §4.1 (ti_lancamentos), RN07,
-- RN15, RN16, RN17, D6. Depende de 20261009130000_gastos_ti_despesas.sql.
--
-- As ocorrências de cada mês são CALCULADAS no frontend a partir da
-- recorrência (D6). Uma ocorrência só vira linha aqui no primeiro toque
-- (RN15): ajuste da previsão (status 'previsto', issue 07), baixa ('pago') ou
-- dispensa ('dispensado'). Nada fica travado (RN16): qualquer mês pode ser
-- editado, e toda mudança vai para ti_auditoria.
--
-- O previsto ORIGINAL não é gravado: ele sempre sai da despesa + reajustes.
-- `valor_previsto` aqui é o previsto do mês já com o ajuste — é contra o
-- original que o desvio é medido (RN11), não contra esta coluna.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_despesas') IS NULL OR to_regprocedure('public.ti_auditoria_trigger()') IS NULL THEN
    RAISE EXCEPTION 'ti_despesas/ti_auditoria_trigger() não existem. Aplique as migrations 20261001120000 e 20261001130000 antes desta.';
  END IF;
END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS public.ti_lancamentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: despesa com histórico não pode ser apagada, só encerrada (RF04).
  despesa_id        uuid NOT NULL REFERENCES public.ti_despesas(id) ON DELETE RESTRICT,
  competencia       date NOT NULL
    CONSTRAINT ti_lancamentos_competencia_check CHECK (extract(day FROM competencia) = 1),
  status            text NOT NULL
    CONSTRAINT ti_lancamentos_status_check CHECK (status IN ('previsto', 'pago', 'dispensado')),
  valor_previsto    numeric(15, 2) NOT NULL
    CONSTRAINT ti_lancamentos_valor_previsto_check CHECK (valor_previsto >= 0),
  vencimento        date NOT NULL,
  forma_pagamento   text NOT NULL
    CONSTRAINT ti_lancamentos_forma_pagamento_check CHECK (forma_pagamento IN (
      'pix', 'boleto', 'cartao_corporativo', 'debito_automatico', 'transferencia', 'outro'
    )),
  valor_pago        numeric(15, 2)
    CONSTRAINT ti_lancamentos_valor_pago_check CHECK (valor_pago IS NULL OR valor_pago >= 0),
  pago_em           date,
  nota_fiscal       text,
  motivo_dispensa   text,
  observacao        text,
  anexos            jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by        uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  updated_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Uma ocorrência tem no máximo um lançamento (RN07).
  CONSTRAINT ti_lancamentos_despesa_competencia_key UNIQUE (despesa_id, competencia),
  -- Pago ⇔ tem valor e data de pagamento. Ao voltar para previsto/dispensado, os dois saem.
  CONSTRAINT ti_lancamentos_pago_coerente_check CHECK (
    (status = 'pago') = (valor_pago IS NOT NULL AND pago_em IS NOT NULL)
  ),
  -- Dispensado ⇔ tem motivo.
  CONSTRAINT ti_lancamentos_dispensa_coerente_check CHECK (
    (status = 'dispensado') = (motivo_dispensa IS NOT NULL AND length(btrim(motivo_dispensa)) > 0)
  )
);

COMMENT ON TABLE public.ti_lancamentos IS 'Ocorrências de despesas de TI que alguém tocou: previsão ajustada no mês (previsto), paga (pago) ou dispensada (dispensado). Ocorrência sem linha aqui é previsão pura, calculada da recorrência (plano Gastos de TI, D6/RN15).';
COMMENT ON COLUMN public.ti_lancamentos.valor_previsto IS 'Previsto do mês já com o ajuste. Nasce com a previsão calculada no primeiro toque. O previsto original (recorrência + reajustes) não é gravado.';
COMMENT ON COLUMN public.ti_lancamentos.vencimento IS 'Vencimento do mês; nasce com o calculado (dia de vencimento limitado ao fim do mês) e pode ser ajustado.';
COMMENT ON COLUMN public.ti_lancamentos.anexos IS '[{path, nome, tamanho, tipo, enviado_em}] — comprovante/NF no bucket ti-gastos-anexos, prefixo lancamentos/<id>/.';

CREATE INDEX IF NOT EXISTS ti_lancamentos_competencia_idx ON public.ti_lancamentos(competencia);
CREATE INDEX IF NOT EXISTS ti_lancamentos_pago_em_idx ON public.ti_lancamentos(pago_em);
CREATE INDEX IF NOT EXISTS ti_lancamentos_vencimento_idx ON public.ti_lancamentos(vencimento);

-- ─── Validação e carimbos ───────────────────────────────────────────────────
-- Na criação, a competência precisa ser uma ocorrência da despesa (mesma conta
-- de domain/recorrencia.ts: dentro do início/fim e alinhada ao ciclo). Depois
-- de criado, despesa e competência não mudam — mudar a recorrência da despesa
-- pode deixar o lançamento "fora da recorrência" (RN17), e isso é mostrado na
-- tela, não impedido aqui.
CREATE OR REPLACE FUNCTION public.ti_lancamentos_validar()
RETURNS TRIGGER AS $$
DECLARE
  d       public.ti_despesas%ROWTYPE;
  v_ciclo integer;
  v_meses integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO d FROM public.ti_despesas WHERE id = NEW.despesa_id;
    IF FOUND THEN
      v_ciclo := CASE d.recorrencia
        WHEN 'unica' THEN 0 WHEN 'mensal' THEN 1 WHEN 'bimestral' THEN 2
        WHEN 'trimestral' THEN 3 WHEN 'semestral' THEN 6 WHEN 'anual' THEN 12 END;
      v_meses := (extract(year FROM NEW.competencia) - extract(year FROM d.competencia_inicio))::integer * 12
               + (extract(month FROM NEW.competencia) - extract(month FROM d.competencia_inicio))::integer;
      IF v_meses < 0
         OR (d.competencia_fim IS NOT NULL AND NEW.competencia > d.competencia_fim)
         OR (v_ciclo = 0 AND v_meses <> 0)
         OR (v_ciclo > 0 AND v_meses % v_ciclo <> 0) THEN
        RAISE EXCEPTION 'A despesa não tem cobrança prevista em %.', to_char(NEW.competencia, 'MM/YYYY')
          USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSE
    IF NEW.despesa_id IS DISTINCT FROM OLD.despesa_id OR NEW.competencia IS DISTINCT FROM OLD.competencia THEN
      RAISE EXCEPTION 'A despesa e a competência de um lançamento não mudam depois de criado.'
        USING ERRCODE = '23514';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ti_lancamentos_validar ON public.ti_lancamentos;
CREATE TRIGGER trigger_ti_lancamentos_validar
  BEFORE INSERT OR UPDATE ON public.ti_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.ti_lancamentos_validar();

DROP TRIGGER IF EXISTS trg_ti_lancamentos_auditoria ON public.ti_lancamentos;
CREATE TRIGGER trg_ti_lancamentos_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.ti_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.ti_auditoria_trigger();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.ti_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_lancamentos_select ON public.ti_lancamentos;
CREATE POLICY ti_lancamentos_select ON public.ti_lancamentos
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

DROP POLICY IF EXISTS ti_lancamentos_insert ON public.ti_lancamentos;
CREATE POLICY ti_lancamentos_insert ON public.ti_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS ti_lancamentos_update ON public.ti_lancamentos;
CREATE POLICY ti_lancamentos_update ON public.ti_lancamentos
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'))
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

-- Desfazer ajuste/baixa/dispensa apaga a linha (fica na auditoria).
DROP POLICY IF EXISTS ti_lancamentos_delete ON public.ti_lancamentos;
CREATE POLICY ti_lancamentos_delete ON public.ti_lancamentos
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'));

COMMIT;
