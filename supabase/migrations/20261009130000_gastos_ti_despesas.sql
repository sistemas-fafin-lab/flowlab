-- ═══════════════════════════════════════════════════════════════════════════════
-- Gastos de TI — despesas
-- Migration: 20261009130000_gastos_ti_despesas.sql
-- (.scratch/gastos-ti/issues/03-despesas-cadastro-lista.md)
--
-- Plano: docs/plans/gastos-ti/PLANO_GASTOS_TI.md §4.1 (ti_despesas), D3, D4, D7, D8.
-- Depende de 20261009120000_gastos_ti_categorias.sql (ti_categorias,
-- ti_auditoria_trigger).
--
-- A despesa é o COMPROMISSO cadastrado. As ocorrências de cada mês não são
-- gravadas: saem da recorrência no frontend (domain/recorrencia.ts, D6). Por
-- isso não existe coluna de status — futura/ativa/encerrada vem das datas
-- (RN08), e encerrar é definir competencia_fim.
--
-- Competências são sempre o 1º dia do mês (CHECK abaixo); o frontend trafega
-- como texto 'YYYY-MM-01', nunca como Date com fuso (RNF07).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_categorias') IS NULL OR to_regprocedure('public.ti_auditoria_trigger()') IS NULL THEN
    RAISE EXCEPTION 'ti_categorias/ti_auditoria_trigger() não existem. Aplique 20261009120000_gastos_ti_categorias.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

CREATE TABLE IF NOT EXISTS public.ti_despesas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- O quê
  descricao               text NOT NULL
    CONSTRAINT ti_despesas_descricao_check CHECK (descricao = btrim(descricao) AND length(descricao) > 0),
  categoria_id            uuid NOT NULL REFERENCES public.ti_categorias(id),
  natureza                text NOT NULL
    CONSTRAINT ti_despesas_natureza_check CHECK (natureza IN ('opex', 'capex')),
  quantidade              integer
    CONSTRAINT ti_despesas_quantidade_check CHECK (quantidade IS NULL OR quantidade > 0),
  unidade                 text,

  -- Quem
  fornecedor_id           uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  fornecedor_nome         text NOT NULL
    CONSTRAINT ti_despesas_fornecedor_nome_check CHECK (fornecedor_nome = btrim(fornecedor_nome) AND length(fornecedor_nome) > 0),
  setor                   text,
  responsavel_id          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  -- Quanto e quando
  tipo_valor              text NOT NULL DEFAULT 'fixo'
    CONSTRAINT ti_despesas_tipo_valor_check CHECK (tipo_valor IN ('fixo', 'variavel')),
  valor_base              numeric(15, 2) NOT NULL
    CONSTRAINT ti_despesas_valor_base_check CHECK (valor_base > 0),
  recorrencia             text NOT NULL
    CONSTRAINT ti_despesas_recorrencia_check CHECK (recorrencia IN ('unica', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  competencia_inicio      date NOT NULL
    CONSTRAINT ti_despesas_competencia_inicio_check CHECK (extract(day FROM competencia_inicio) = 1),
  competencia_fim         date
    CONSTRAINT ti_despesas_competencia_fim_check CHECK (
      competencia_fim IS NULL
      OR (extract(day FROM competencia_fim) = 1 AND competencia_fim >= competencia_inicio)
    ),
  dia_vencimento          smallint NOT NULL
    CONSTRAINT ti_despesas_dia_vencimento_check CHECK (dia_vencimento BETWEEN 1 AND 31),
  forma_pagamento         text NOT NULL
    CONSTRAINT ti_despesas_forma_pagamento_check CHECK (forma_pagamento IN (
      'pix', 'boleto', 'cartao_corporativo', 'debito_automatico', 'transferencia', 'outro'
    )),
  meio_pagamento_detalhe  text,
  moeda_original          text
    CONSTRAINT ti_despesas_moeda_original_check CHECK (moeda_original IS NULL OR moeda_original ~ '^[A-Z]{3}$'),
  valor_original          numeric(15, 2)
    CONSTRAINT ti_despesas_valor_original_check CHECK (valor_original IS NULL OR valor_original > 0),
  numero_contrato         text,
  renovacao_automatica    boolean NOT NULL DEFAULT false,
  aviso_renovacao_dias    smallint NOT NULL DEFAULT 30
    CONSTRAINT ti_despesas_aviso_renovacao_dias_check CHECK (aviso_renovacao_dias BETWEEN 0 AND 365),

  -- Autorização (D3: texto livre)
  autorizado_por          text NOT NULL
    CONSTRAINT ti_despesas_autorizado_por_check CHECK (autorizado_por = btrim(autorizado_por) AND length(autorizado_por) > 0),
  autorizado_em           date,

  observacoes             text,
  anexos                  jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_by              uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  updated_by              uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_despesas IS 'Despesas de TI (o compromisso: o que se paga, a quem, quanto, com que recorrência e quem autorizou). As ocorrências mensais são calculadas a partir da recorrência, não gravadas (plano Gastos de TI, D6).';
COMMENT ON COLUMN public.ti_despesas.valor_base IS 'Valor por ocorrência desde a competência inicial. Mudanças de preço daqui em diante entram como reajuste datado (ti_despesa_reajustes, issue 04), não editando esta coluna.';
COMMENT ON COLUMN public.ti_despesas.tipo_valor IS 'fixo: o valor é o contratado. variavel: o valor é estimativa (cloud, telefonia, consumo de IA) e o real entra mês a mês.';
COMMENT ON COLUMN public.ti_despesas.competencia_inicio IS 'Primeira competência (1º dia do mês). Para recorrência única, é a única ocorrência.';
COMMENT ON COLUMN public.ti_despesas.competencia_fim IS 'Última competência (encerramento ou fim de contrato). NULL = sem prazo.';
COMMENT ON COLUMN public.ti_despesas.dia_vencimento IS 'Dia do vencimento dentro da competência; 29–31 caem no último dia nos meses mais curtos (regra no frontend).';
COMMENT ON COLUMN public.ti_despesas.fornecedor_nome IS 'Nome do fornecedor copiado no cadastro. Obrigatório: suppliers tem DELETE físico, e o nome precisa sobreviver a ele (D4).';
COMMENT ON COLUMN public.ti_despesas.moeda_original IS 'Só informativo (D8): o valor do módulo é sempre o pago em R$.';
COMMENT ON COLUMN public.ti_despesas.setor IS 'Setor beneficiado, um valor de DEPARTMENTS (src/utils/permissions.ts). Texto livre no banco, como user_profiles.department.';
COMMENT ON COLUMN public.ti_despesas.autorizado_por IS 'Nome de quem autorizou, digitado livremente (D3).';
COMMENT ON COLUMN public.ti_despesas.anexos IS '[{path, nome, tamanho, tipo, enviado_em}] — arquivos no bucket privado ti-gastos-anexos (20261009150000_gastos_ti_anexos.sql).';

CREATE INDEX IF NOT EXISTS ti_despesas_categoria_id_idx ON public.ti_despesas(categoria_id);
CREATE INDEX IF NOT EXISTS ti_despesas_fornecedor_id_idx ON public.ti_despesas(fornecedor_id);
CREATE INDEX IF NOT EXISTS ti_despesas_setor_idx ON public.ti_despesas(setor);
CREATE INDEX IF NOT EXISTS ti_despesas_competencia_fim_idx ON public.ti_despesas(competencia_fim);

-- Carimbos: updated_at/updated_by sempre do servidor (padrão de
-- metas_faturamento), e created_by/created_at imutáveis depois de criados.
CREATE OR REPLACE FUNCTION public.ti_despesas_set_carimbos()
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

DROP TRIGGER IF EXISTS trigger_ti_despesas_carimbos ON public.ti_despesas;
CREATE TRIGGER trigger_ti_despesas_carimbos
  BEFORE INSERT OR UPDATE ON public.ti_despesas
  FOR EACH ROW EXECUTE FUNCTION public.ti_despesas_set_carimbos();

DROP TRIGGER IF EXISTS trg_ti_despesas_auditoria ON public.ti_despesas;
CREATE TRIGGER trg_ti_despesas_auditoria
  AFTER INSERT OR UPDATE OR DELETE ON public.ti_despesas
  FOR EACH ROW EXECUTE FUNCTION public.ti_auditoria_trigger();

ALTER TABLE public.ti_despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_despesas_select ON public.ti_despesas;
CREATE POLICY ti_despesas_select ON public.ti_despesas
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewGastosTI')
    OR public.current_user_has_permission('canManageGastosTI')
  );

DROP POLICY IF EXISTS ti_despesas_insert ON public.ti_despesas;
CREATE POLICY ti_despesas_insert ON public.ti_despesas
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

DROP POLICY IF EXISTS ti_despesas_update ON public.ti_despesas;
CREATE POLICY ti_despesas_update ON public.ti_despesas
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'))
  WITH CHECK (public.current_user_has_permission('canManageGastosTI'));

-- DELETE liberado para quem gerencia: o que impede apagar despesa com histórico
-- é o ON DELETE RESTRICT de ti_lancamentos (issue 06), não a falta de policy.
DROP POLICY IF EXISTS ti_despesas_delete ON public.ti_despesas;
CREATE POLICY ti_despesas_delete ON public.ti_despesas
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission('canManageGastosTI'));

COMMIT;
