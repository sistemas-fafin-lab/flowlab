-- ============================================================================
-- Fontes pagadoras consideradas para meta (feedback do setor de faturamento,
-- 03/09) — whitelist de negócio
--
-- O setor passou uma lista fechada de 32 fontes pagadoras que devem ser
-- consideradas nas tabelas e no dashboard do módulo Faturamento; o resto
-- ("fontes pagadoras particulares": clínicas parceiras, cortesia, labs que
-- enviam exame pra este processar etc.) não deveria mais aparecer. É uma
-- whitelist, não um blacklist: uma fonte nova/desconhecida no apLIS fica de
-- fora até alguém marcar manualmente — default false.
--
-- Conceito novo e separado de `is_clinica_parceira` (24/08) e
-- `nf_apos_pagamento` (28/08): aquelas continuam com o significado e o
-- escopo de hoje (só a lista de Títulos, no caso da primeira). Mesmo padrão
-- de ambas — a flag entra direto em `operadoras` (já é o espelho das fontes
-- pagadoras, já tem a RLS de canManageBilling instalada em 20260807120000),
-- sem tabela nova.
--
-- Timestamp antes de 20260903120000_aging_por_operadora.sql de propósito: a
-- CREATE OR REPLACE FUNCTION fat_dashboard_receber daquela migration passa a
-- referenciar operadoras.is_considerada_meta, então a coluna precisa existir
-- primeiro.
-- ============================================================================

ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS is_considerada_meta BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN operadoras.is_considerada_meta IS
  'Whitelist de negócio (lista fechada passada pelo setor de faturamento, 03/09): só fontes pagadoras marcadas aqui contam nas tabelas e no dashboard do módulo Faturamento. Default false — fonte nova/desconhecida fica de fora até alguém marcar. Gerenciado pela tela de Títulos, gate canManageBilling — o apLIS não tem essa distinção.';

-- Os 30 itens da lista que já estão sincronizados (ativos no apLIS).
UPDATE operadoras SET is_considerada_meta = true
 WHERE aplis_id IN (
   '1054', -- 090 SULAMERICA
   '1025', -- AMHP-DF
   '1007', -- AMIL
   '1008', -- ASSEFAZ
   '1122', -- BRADESCO SAUDE  - 005711
   '1000', -- BRADESCO SAUDE S/A 421715
   '1268', -- BRB SAÚDE
   '1283', -- CÂMARA DOS DEPUTADOS
   '1009', -- CASSI
   '1098', -- CASSI-PER
   '1210', -- CBMDF
   '1049', -- E-VIDA
   '1253', -- FASCAL
   '1204', -- FUSEX
   '1282', -- GEAP Autogestão em Saúde
   '1257', -- INAS GDF
   '1129', -- LAB PLANASSISTE
   '1251', -- PMDF
   '1281', -- POLÍCIA FEDERAL
   '1052', -- POSTAL SAÚDE
   '1101', -- SAUDE CAIXA
   '1197', -- SIS SENADO
   '1235', -- STF
   '1252', -- STJ
   '1078', -- SUL AMERICA COMPANHIA DE SEGURO SAÚDE
   '1231', -- TJDFT
   '1232', -- TRE-SAÚDE
   '1228', -- TRT
   '1227', -- TST
   '1102'  -- PARTICULAR
 );

-- CONAB e GAMA SAÚDE: Inativo=1 em fatinstituicao no apLIS — "Sincronizar
-- operadoras" nunca os traz (só sincroniza FontePagadora=1 AND Inativo=0), então
-- não existem em `operadoras` ainda. INSERT direto, mesmo raciocínio do seed de
-- clínicas parceiras em 20260824120000. GAMA SAÚDE tem dois registros no apLIS
-- com a mesma razão social (GAMA SAÚDE LTDA, ids 1343 e 1344) — sem elemento
-- pra desambiguar qual o setor quis dizer, inclui os dois.
INSERT INTO operadoras (aplis_id, nome, is_considerada_meta)
VALUES
  ('1026', 'CONAB', true),
  ('1343', 'GAMA SAÚDE', true),
  ('1344', 'GAMA SAÚDE - MEDICINA LABORATORIAL', true)
ON CONFLICT (aplis_id) DO UPDATE SET is_considerada_meta = true;
