-- ============================================================================
-- Regra de emissão de NF por operadora (issue 31 do feedback do setor de
-- faturamento, 28/08)
--
-- O setor relatou que a ordem NF↔pagamento varia por convênio: pra algumas
-- operadoras a NF só pode ser emitida DEPOIS do pagamento (o convênio paga
-- primeiro, sem nota); pra outras é o inverso, a NF é o que libera o
-- pagamento (fluxo padrão já assumido pelo resto do módulo — ver
-- 20260807150000_previsao_pagamento.sql, que conta o prazo a partir do envio
-- do lote/NF). Hoje isso só dava pra saber abrindo cada lote — não tem
-- nenhuma flag em `fatinstituicao` no apLIS, é uma regra de negócio que só o
-- financeiro sabe (mesma situação de `is_clinica_parceira`, 24/08).
--
-- Mesmo padrão daquela migration: a flag entra direto em `operadoras` (já é o
-- espelho das fontes pagadoras, já tem a RLS de canManageBilling instalada em
-- 20260807120000), sem tabela nova. Sem seed — diferente das clínicas
-- parceiras, o relatório não veio com uma lista de operadoras nesse regime;
-- o financeiro cadastra pela tela de Títulos (issue 31).
-- ============================================================================

ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS nf_apos_pagamento BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN operadoras.nf_apos_pagamento IS
  'true = esta operadora só permite emitir a NF depois de receber o pagamento (o padrão do módulo é o inverso: a NF libera o pagamento). Gerenciado pela tela de Títulos, gate canManageBilling — o apLIS não tem essa distinção.';
