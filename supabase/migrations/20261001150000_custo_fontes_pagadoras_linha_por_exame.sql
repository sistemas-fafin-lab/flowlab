-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: uma linha por exame por padrão
-- Migration: 20261001150000_custo_fontes_pagadoras_linha_por_exame.sql
--
-- Até aqui, `exame_id` só tinha efeito com `tuss` vazio (20260916100000):
-- com TUSS preenchido a linha valia pra TODOS os exames daquele TUSS, mesmo
-- quando o usuário tinha escolhido um exame específico no PayorFormModal
-- (que gravava o exame_id, mas ele era ignorado). Bug real: "Particular"
-- pro TUSS 40601200 criado pra BIÓPSIA SEXTANTE passou a valer pros 13
-- exames do TUSS.
--
-- Regra nova (examesPorFontePagadora em src/components/CostControl/domain/busca.ts
-- e buildOrcamentoParticular em api/_lib/orcamentoParticular.ts):
--   - exame_id preenchido → "linha de exame": vale só pra aquele exame,
--     com ou sem TUSS. Tem precedência sobre a linha geral do TUSS da mesma
--     fonte + tabela associada.
--   - exame_id null (TUSS preenchido) → "linha geral do TUSS": vale pra
--     todos os exames do TUSS (importação por planilha, ou "aplicar a
--     todos" no modal).
--
-- Dado existente: em produção, 12 linhas tinham TUSS e exame_id preenchidos
-- (revisadas uma a uma em 2026-10-01). 10 são de TUSS com um exame só ou
-- foram feitas pra um exame específico — a regra nova não muda o que elas
-- mostram. A única que de fato funcionava como linha geral do TUSS é a
-- Particular/Particular do 40601200 (R$250, com valores personalizados de
-- 10 exames) — sem zerar o exame_id dela, ela passaria a valer só pra
-- BIOPSIA SIMPLES e os demais exames do TUSS perderiam o preço Particular.
-- Por isso o UPDATE é por id, não por regra. Em outros ambientes o id não
-- existe e o UPDATE não faz nada.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.custo_fontes_pagadoras
SET exame_id = NULL
WHERE id = '86c2c09d-a593-4592-856a-0a603fd9b95e';

COMMENT ON COLUMN public.custo_fontes_pagadoras.exame_id IS 'Preenchido = linha de exame: vale só pra este exame (custo_exames.id), com ou sem TUSS, e tem precedência sobre a linha geral do TUSS da mesma fonte + tabela associada. Null = linha geral do TUSS: vale pra todos os exames com o mesmo tuss (exigido não-nulo quando tuss é vazio). Ver examesPorFontePagadora e buildOrcamentoParticular.';
