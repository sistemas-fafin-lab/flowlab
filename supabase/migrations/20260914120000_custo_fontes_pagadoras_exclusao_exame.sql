-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: excluir só um exame de um TUSS
-- compartilhado, sem apagar o preço nem os demais exames que dependem dele
-- Migration: 20260914120000_custo_fontes_pagadoras_exclusao_exame.sql
--
-- Um TUSS pode ser reaproveitado por exames com nomes diferentes em
-- custo_exames (ex.: INSULINA e INSULINA BASAL sob 40316360) — nesse caso
-- custo_fontes_pagadoras tem UMA linha de preço pro TUSS, e a tela expande
-- isso em uma linha exibida por nome distinto (ver examesPorFontePagadora em
-- src/components/CostControl/domain/busca.ts). Antes desta migration,
-- excluir qualquer uma dessas linhas exibidas apagava a linha de preço
-- inteira, levando junto todos os nomes que a compartilhavam.
--
-- Esta tabela registra "este exame não é oferecido por esta fonte pagadora",
-- sem mexer no preço em si nem no cadastro do exame (custo_exames) — os
-- demais nomes que compartilham o mesmo TUSS continuam vinculados ao mesmo
-- preço normalmente. O preço só some de vez se todos os nomes que o
-- compartilham forem excluídos (nenhuma limpeza automática — fica como uma
-- linha de preço sem exame visível até reverter ou ela ser reaproveitada).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.custo_fontes_pagadoras_exclusoes (
  payor_id   UUID NOT NULL REFERENCES public.custo_fontes_pagadoras(id) ON DELETE CASCADE,
  exame_id   UUID NOT NULL REFERENCES public.custo_exames(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payor_id, exame_id)
);

COMMENT ON TABLE public.custo_fontes_pagadoras_exclusoes IS 'Marca que um exame específico (custo_exames.id) não é oferecido por uma linha de custo_fontes_pagadoras (payor_id) — usado quando o TUSS dessa linha é compartilhado por vários nomes de exame e só um deles deve deixar de aparecer, sem apagar o preço nem os demais nomes.';

ALTER TABLE public.custo_fontes_pagadoras_exclusoes ENABLE ROW LEVEL SECURITY;

-- Mesmo gate de custo_fontes_pagadoras (20260904110000): quem gerencia
-- billing decide o que excluir; quem só visualiza precisa enxergar as
-- exclusões pra a tela renderizar a lista corretamente.
DROP POLICY IF EXISTS custo_fontes_pagadoras_exclusoes_select_billing ON public.custo_fontes_pagadoras_exclusoes;
CREATE POLICY custo_fontes_pagadoras_exclusoes_select_billing ON public.custo_fontes_pagadoras_exclusoes
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

DROP POLICY IF EXISTS custo_fontes_pagadoras_exclusoes_write_billing ON public.custo_fontes_pagadoras_exclusoes;
CREATE POLICY custo_fontes_pagadoras_exclusoes_write_billing ON public.custo_fontes_pagadoras_exclusoes
  FOR ALL TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));
