-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: flag "Atendido pelo convênio"
-- Migration: 20260908120000_custo_fontes_pagadoras_atendido.sql
--
-- Checkbox por linha (fonte pagadora + tabela + TUSS) indicando se aquele
-- exame é atendido pelo plano de saúde daquela fonte pagadora, ou se só é
-- oferecido como particular. Diferente do resto da tabela — que é espelhado
-- do APLIS e somente leitura —, este campo é decisão do laboratório e fica
-- editável na tela (ver PayorsScreen.tsx).
--
-- Default TRUE: os 4035 registros semeados em 20260904110000 vieram de
-- preço negociado real por convênio no APLIS, então já presumem atendimento
-- pelo plano; exceções (só particular) são desmarcadas manualmente.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN IF NOT EXISTS atendido BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.custo_fontes_pagadoras.atendido IS 'TRUE = exame atendido pelo plano de saúde dessa fonte pagadora; FALSE = só atendido como particular. Editável na tela, não vem do APLIS.';
