-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: valor de venda diferente por exame
-- num TUSS compartilhado
-- Migration: 20260914130000_custo_fontes_pagadoras_valor_exame.sql
--
-- Um TUSS pode ser reaproveitado por exames com nomes diferentes em
-- custo_exames (ex.: INSULINA e INSULINA BASAL sob 40316360) — nesse caso
-- custo_fontes_pagadoras tem UMA linha de preço pro TUSS, e a tela expande
-- isso em uma linha exibida por nome distinto (ver examesPorFontePagadora em
-- src/components/CostControl/domain/busca.ts). Até aqui, editar o "Valor
-- Cobrado" de qualquer uma dessas linhas exibidas mudava o valor da linha de
-- custo_fontes_pagadoras inteira, e portanto o valor de TODOS os exames que
-- compartilham aquele TUSS — não havia como um exame irmão cobrar diferente
-- do outro pra mesma fonte pagadora.
--
-- Esta tabela guarda um valor de venda que sobrescreve, só para um exame
-- específico, o valor padrão da linha de custo_fontes_pagadoras que ele
-- compartilha com os irmãos. Sem uma linha aqui, o exame continua usando o
-- valor padrão do TUSS normalmente — é uma exceção opt-in por exame, não uma
-- migração de modelo (mesmo espírito de custo_fontes_pagadoras_exclusoes,
-- que já faz o mesmo tipo de exceção por exame, mas pra "não oferecido" em
-- vez de "valor diferente").
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.custo_fontes_pagadoras_valores_exame (
  payor_id   UUID NOT NULL REFERENCES public.custo_fontes_pagadoras(id) ON DELETE CASCADE,
  exame_id   UUID NOT NULL REFERENCES public.custo_exames(id) ON DELETE CASCADE,
  valor      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payor_id, exame_id)
);

COMMENT ON TABLE public.custo_fontes_pagadoras_valores_exame IS 'Valor de venda que sobrescreve, só para um exame específico (custo_exames.id), o valor padrão de uma linha de custo_fontes_pagadoras (payor_id) — usado quando o TUSS dessa linha é compartilhado por vários nomes de exame e um deles precisa cobrar diferente dos irmãos pra mesma fonte pagadora. Ausência de linha aqui = exame usa o valor padrão do TUSS normalmente.';

CREATE OR REPLACE FUNCTION public.custo_fontes_pagadoras_valores_exame_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custo_fontes_pagadoras_valores_exame_updated_at ON public.custo_fontes_pagadoras_valores_exame;
CREATE TRIGGER trigger_custo_fontes_pagadoras_valores_exame_updated_at
  BEFORE UPDATE ON public.custo_fontes_pagadoras_valores_exame
  FOR EACH ROW EXECUTE FUNCTION public.custo_fontes_pagadoras_valores_exame_set_updated_at();

ALTER TABLE public.custo_fontes_pagadoras_valores_exame ENABLE ROW LEVEL SECURITY;

-- Mesmo gate de custo_fontes_pagadoras (20260904110000): quem gerencia
-- billing decide o valor de cada exame; quem só visualiza precisa enxergar
-- os overrides pra a tela renderizar o valor certo por linha.
DROP POLICY IF EXISTS custo_fontes_pagadoras_valores_exame_select_billing ON public.custo_fontes_pagadoras_valores_exame;
CREATE POLICY custo_fontes_pagadoras_valores_exame_select_billing ON public.custo_fontes_pagadoras_valores_exame
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

DROP POLICY IF EXISTS custo_fontes_pagadoras_valores_exame_write_billing ON public.custo_fontes_pagadoras_valores_exame;
CREATE POLICY custo_fontes_pagadoras_valores_exame_write_billing ON public.custo_fontes_pagadoras_valores_exame
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
