-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: exige exame_id quando TUSS é vazio
-- Migration: 20260916110000_custo_fontes_pagadoras_tuss_ou_exame_check.sql
--
-- Trava a causa raiz do bug descrito em 20260916100000 na origem: dado novo
-- não pode mais gravar TUSS vazio sem dizer a qual exame ele se refere.
--
-- IMPORTANTE: só aplicar esta migration DEPOIS de migrar as linhas legadas
-- sem TUSS (tuss = '') que ainda não têm exame_id — senão ela falha na
-- validação do dado existente. Rodar antes:
--
--   SELECT id, fonte_pagadora, tabela_associada, valor
--   FROM custo_fontes_pagadoras
--   WHERE (tuss IS NULL OR tuss = '') AND exame_id IS NULL;
--
-- Se vier alguma linha, ela precisa virar uma linha por exame (com exame_id
-- preenchido) ou ser removida antes de reaplicar esta migration.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD CONSTRAINT custo_fontes_pagadoras_tuss_ou_exame_check
  CHECK (tuss <> '' OR exame_id IS NOT NULL);
