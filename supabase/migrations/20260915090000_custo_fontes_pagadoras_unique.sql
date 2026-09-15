-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — Fontes Pagadoras: impede linhas duplicadas
-- Migration: 20260915090000_custo_fontes_pagadoras_unique.sql
--
-- O modal "Nova linha de fonte pagadora" (PayorFormModal) não tinha proteção
-- contra duplo clique/duplo submit no botão Salvar, e o banco não impedia
-- INSERTs repetidos: cada clique extra virava uma linha nova de verdade,
-- causando duplicação/triplicação relatada pelo usuário. A correção
-- client-side (desabilitar o botão durante o submit) já evita novas
-- ocorrências; esta constraint é a defesa em profundidade no banco.
--
-- fonte_pagadora + tabela_associada + tuss já é a chave de casamento usada
-- por importPayors (useCostControl.ts) — ver comentário "Casamento (upsert)
-- por fonte_pagadora + tabela_associada + tuss" — então duas linhas com essa
-- mesma tripla nunca deveriam coexistir.
--
-- Se esta migration falhar por já existirem duplicatas na tabela (geradas
-- pelo próprio bug), é preciso identificar e remover manualmente as linhas
-- extras antes de reaplicar — não fazemos isso aqui automaticamente porque
-- `valor` é dado financeiro usado em faturamento e a escolha de qual linha
-- manter exige revisão humana.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_fontes_pagadoras
  ADD CONSTRAINT custo_fontes_pagadoras_fonte_tabela_tuss_key
  UNIQUE (fonte_pagadora, tabela_associada, tuss);
