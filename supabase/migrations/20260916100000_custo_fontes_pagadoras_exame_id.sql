-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: identifica o exame de uma linha sem TUSS
-- Migration: 20260916100000_custo_fontes_pagadoras_exame_id.sql
--
-- examesPorFontePagadora (src/components/CostControl/domain/busca.ts) casa
-- uma linha de custo_fontes_pagadoras com exame(s) de custo_exames pelo
-- texto do TUSS. Isso é intencional quando o TUSS existe (é o recurso de
-- "TUSS compartilhado" — várias linhas de custo_exames com nomes diferentes
-- sob o mesmo código). Mas exame sem TUSS grava `tuss = ''`, e antes desta
-- migration o código usava essa string vazia como se fosse mais um valor de
-- TUSS compartilhado — ou seja, QUALQUER linha sem TUSS casava com TODOS os
-- exames sem TUSS do catálogo, misturando preços de exames sem relação
-- nenhuma entre si. Bug real encontrado em produção: uma linha "Particular"
-- sem TUSS estava exibindo 20 exames diferentes, todos ao mesmo preço.
--
-- `exame_id` resolve isso guardando o vínculo direto com o exame pretendido
-- — só é usado (e só passa a ser exigido depois da migration seguinte,
-- 20260916110000) quando `tuss` está vazio. Pra TUSS preenchido, o
-- comportamento de compartilhamento por texto continua exatamente como
-- antes.
--
-- Não adiciona a CHECK de "tuss ou exame_id" aqui de propósito: linhas
-- legadas sem TUSS já existem em produção sem exame_id (é o próprio dado
-- gerado pelo bug) e precisam ser migradas manualmente pra uma linha por
-- exame antes que essa exigência possa ser aplicada — ver
-- 20260916110000_custo_fontes_pagadoras_tuss_ou_exame_check.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN exame_id UUID REFERENCES public.custo_exames(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.custo_fontes_pagadoras.exame_id IS 'Exame específico desta linha — só usado (e exigido a partir da migration 20260916110000) quando tuss está vazio, pra desambiguar entre exames sem código TUSS. Null quando tuss está preenchido (o casamento nesse caso é por texto, ver examesPorFontePagadora).';

-- A UNIQUE anterior (fonte_pagadora, tabela_associada, tuss) impedia mais de
-- uma linha sem TUSS por (fonte_pagadora, tabela_associada) — o que
-- inviabiliza ter uma linha por exame. Troca por uma constraint que também
-- considera exame_id: duas linhas sem TUSS pra exames diferentes agora
-- coexistem; duas linhas pro MESMO exame (mesmo exame_id) continuam
-- proibidas.
ALTER TABLE public.custo_fontes_pagadoras
  DROP CONSTRAINT custo_fontes_pagadoras_fonte_tabela_tuss_key;

ALTER TABLE public.custo_fontes_pagadoras
  ADD CONSTRAINT custo_fontes_pagadoras_fonte_tabela_tuss_exame_key
  UNIQUE (fonte_pagadora, tabela_associada, tuss, exame_id);
