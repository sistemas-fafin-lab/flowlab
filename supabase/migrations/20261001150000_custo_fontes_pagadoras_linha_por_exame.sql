-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: uma linha por exame por padrão
-- Migration: 20261001150000_custo_fontes_pagadoras_linha_por_exame.sql
--
-- Até aqui, `exame_id` só tinha efeito com `tuss` vazio (20260916100000):
-- com TUSS preenchido a linha valia pra TODOS os exames daquele TUSS, mesmo
-- quando o usuário tinha escolhido um exame específico no PayorFormModal
-- (que gravava o exame_id, mas ele era ignorado). Bug real: "Particular"
-- pro TUSS 40601200 criado pra BIÓPSIA SEXTANTE passou a valer pros 13
-- exames do TUSS — duplicando a linha Particular que já existia.
--
-- Regra nova (examesPorFontePagadora em src/components/CostControl/domain/busca.ts
-- e buildOrcamentoParticular em api/_lib/orcamentoParticular.ts):
--   - exame_id preenchido → "linha de exame": vale só pra aquele exame,
--     com ou sem TUSS. Tem precedência sobre a linha geral do TUSS da mesma
--     fonte + tabela associada.
--   - exame_id null (TUSS preenchido) → "linha geral do TUSS": vale pra
--     todos os exames do TUSS, como sempre (importação por planilha, ou
--     "aplicar a todos" no modal).
--
-- Linhas existentes com TUSS preenchido E exame_id preenchido foram todas
-- vistas pelo usuário (e pela Tabela Particular) como linhas gerais do TUSS
-- — o exame_id delas nunca teve efeito. Zera o exame_id pra manter
-- exatamente o comportamento atual; só linhas novas/editadas depois desta
-- migration passam a ser linhas de exame. Pra conferir antes quais linhas
-- são afetadas:
--
--   SELECT f.id, f.fonte_pagadora, f.tabela_associada, f.tuss, f.valor, e.nome
--   FROM custo_fontes_pagadoras f JOIN custo_exames e ON e.id = f.exame_id
--   WHERE f.tuss <> '' ORDER BY f.tuss, f.fonte_pagadora;
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.custo_fontes_pagadoras
SET exame_id = NULL
WHERE tuss <> '' AND exame_id IS NOT NULL;

COMMENT ON COLUMN public.custo_fontes_pagadoras.exame_id IS 'Preenchido = linha de exame: vale só pra este exame (custo_exames.id), com ou sem TUSS, e tem precedência sobre a linha geral do TUSS da mesma fonte + tabela associada. Null = linha geral do TUSS: vale pra todos os exames com o mesmo tuss (exigido não-nulo quando tuss é vazio). Ver examesPorFontePagadora e buildOrcamentoParticular.';
