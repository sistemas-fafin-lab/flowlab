-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: elegibilidade de desconto automático
-- por exame (Particular)
-- Migration: 20260910090000_custo_fontes_pagadoras_elegivel_desconto_particular.sql
--
-- Checkbox por linha indicando se aquele exame conta para a política de
-- desconto automático por volume do orçamento Particular na Tabela Particular
-- (5+ exames elegíveis distintos ou R$300 acumulado = 10%; 10+ ou R$1.000 =
-- 15%). Só tem sentido nas linhas fonte_pagadora='Particular' — nas demais
-- fica FALSE e é ignorado, mesmo padrão de "coluna que só importa pra um
-- subconjunto de linhas" já usado por `atendido` (20260908120000). Editável
-- na tela (PayorsScreen), não vem do APLIS.
--
-- Backfill: marca TRUE nas linhas fonte_pagadora='Particular' cujo tuss está
-- entre os 48 TUSS distintos hoje marcados "Sim" na coluna "Desconto
-- automático" da planilha "Tabela Comparativo de Valores A C.xlsx" (aba
-- "Orçamento Particular"), preservando a política de desconto já vigente.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD COLUMN IF NOT EXISTS elegivel_desconto_particular BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.custo_fontes_pagadoras.elegivel_desconto_particular IS 'TRUE = exame conta para a política de desconto automático por volume do orçamento Particular na Tabela Particular (5+ exames elegíveis distintos ou R$300 acumulado = 10%; 10+ ou R$1.000 = 15%). Só tem sentido nas linhas fonte_pagadora=''Particular'' — nas demais fica FALSE e é ignorado, mesmo padrão de "coluna que só importa pra um subconjunto de linhas" já usado por "atendido". Editável na tela (PayorsScreen), não vem do APLIS.';

UPDATE public.custo_fontes_pagadoras
SET elegivel_desconto_particular = TRUE
WHERE fonte_pagadora = 'Particular'
  AND tuss IN (
    '40301060','40301087','40301150','40301281','40301397','40301400',
    '40301419','40301630','40301648','40301842','40301990','40302040',
    '40302113','40302199','40302318','40302423','40302504','40302512',
    '40302580','40302750','40302830','40304264','40304361','40305465',
    '40306852','40308391','40311210','40313190','40313328','40316106',
    '40316190','40316211','40316220','40316246','40316270','40316289',
    '40316300','40316335','40316360','40316408','40316416','40316424',
    '40316467','40316491','40316505','40316513','40316521','40316572'
  );
