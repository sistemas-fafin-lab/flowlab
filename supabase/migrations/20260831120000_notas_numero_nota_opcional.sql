-- ============================================================================
-- Contas a Receber: número da nota deixa de ser obrigatório (issue 32 do
-- feedback do setor de faturamento, 31/08)
--
-- Pré-requisito da issue 31 (regra de NF antes/depois do pagamento por
-- operadora, 20260828120000_operadoras_nf_apos_pagamento.sql): operadoras com
-- nf_apos_pagamento = true só recebem o número da NF depois de já terem sido
-- pagas, mas hoje `numero_nota` é NOT NULL e obriga o operador a inventar um
-- número só para conseguir criar o título.
--
-- Mantém TEXT, sem valor default — string vazia continua proibida pela RPC
-- (normalizada para NULL na gravação), só o NOT NULL sai.
-- ============================================================================

ALTER TABLE public.notas ALTER COLUMN numero_nota DROP NOT NULL;

COMMENT ON COLUMN public.notas.numero_nota IS
  'Número da nota fiscal. Pode ser NULL: algumas operadoras (nf_apos_pagamento = true, ver operadoras.nf_apos_pagamento) só emitem a NF depois do pagamento, então o título nasce sem número e é completado depois.';
