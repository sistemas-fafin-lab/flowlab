-- ═══════════════════════════════════════════════════════════════════════════════
-- Correção pontual: TUSS 40601200 tinha 3 linhas de preço "Particular"
-- duplicadas (provavelmente de reimportações em datas diferentes), fazendo a
-- integração com a Tabela Particular (que só usa a primeira linha encontrada
-- pra cada TUSS) escolher arbitrariamente a linha errada — que excluía
-- "BIOPSIA SIMPLES" e "BIOPSIA MULTIFRAGMENTOS" e usava R$450 como base em
-- vez do R$250 correto.
--
-- Efeito: mantém só a linha 86c2c09d-a593-4592-856a-0a603fd9b95e
-- (fonte_pagadora=Particular, tabela_associada=Particular, valor=250),
-- sem exclusões nem valores personalizados — os 13 exames do TUSS 40601200
-- passam a aparecer todos, todos a R$250.
--
-- Rode no SQL editor do Supabase do projeto de PRODUÇÃO
-- (jqxeqmeikqclmmongclj.supabase.co), não no de dev/staging do .env local.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Remove exclusões das 3 linhas (as 2 que serão apagadas + as 6 que
--    sobravam indevidamente na linha correta, escondendo BIOPSIA DE
--    ENDOMETRIO, HISTOPATOLÓGICO DE PELE, MAMOPLASTIA UNILATERAL/BILATERAL,
--    PECA CIRURGICA SIMPLES e PECA DE COLO UTERINO nessa linha).
DELETE FROM public.custo_fontes_pagadoras_exclusoes
WHERE payor_id IN (
  '48ba11f3-e493-4d98-acc1-2c2d3e5c4647', -- Particular/Particular, R$450 (duplicada, será apagada)
  '86c2c09d-a593-4592-856a-0a603fd9b95e', -- Particular/Particular, R$250 (linha correta — fica)
  'dde3b036-7825-4c8d-af25-7b20e69fd512'  -- Particular/PARTICULAR maiúsculo, R$450 (duplicada, será apagada)
);

-- 2) Remove valores personalizados por exame das 2 linhas duplicadas
--    (a linha correta 86c2c09d não tem nenhum).
DELETE FROM public.custo_fontes_pagadoras_valores_exame
WHERE payor_id IN (
  '48ba11f3-e493-4d98-acc1-2c2d3e5c4647',
  'dde3b036-7825-4c8d-af25-7b20e69fd512'
);

-- 3) Apaga as 2 linhas de preço duplicadas, mantendo só a de R$250.
DELETE FROM public.custo_fontes_pagadoras
WHERE id IN (
  '48ba11f3-e493-4d98-acc1-2c2d3e5c4647',
  'dde3b036-7825-4c8d-af25-7b20e69fd512'
);

-- 4) Confere o estado final: deve haver só 1 linha Particular pro TUSS
--    40601200, com valor 250, atendido=true.
SELECT id, fonte_pagadora, tabela_associada, tuss, valor, atendido
FROM public.custo_fontes_pagadoras
WHERE tuss = '40601200' AND fonte_pagadora = 'Particular';

COMMIT;
