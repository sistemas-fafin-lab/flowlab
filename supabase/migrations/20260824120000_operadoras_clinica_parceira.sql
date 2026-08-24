-- ============================================================================
-- Clínicas parceiras (issue 16 do feedback do setor de faturamento, 24/08)
--
-- O apLIS não distingue clínica parceira de convênio de saúde: Nexus, ABAC e
-- Medigest (labs que enviam exame pra este laboratório processar) têm
-- exatamente as mesmas flags em fatinstituicao (FontePagadora=1, Afiliado=0,
-- Filial=0, Segmento=0) que qualquer operadora comum, como a AMHP-DF. É uma
-- classificação de negócio que só o flowlab conhece — decisão de grilling
-- (24/08): lista gerenciável em vez de config fixa no código, já que a lista
-- pode crescer ("etc." no relatório).
--
-- A flag entra direto em `operadoras` em vez de uma tabela nova: essa tabela
-- já É o espelho das fontes pagadoras do apLIS (sincronizada por
-- operadoras-sync, `aplis_id` = `fatinstituicao.IdInstituicao`), já carrega o
-- `nome` em cache e já tem a RLS de canViewBilling/canManageBilling instalada
-- em 20260807120000 — duplicar isso numa tabela à parte só criaria um segundo
-- lugar pra manter em sincronia com o mesmo apLIS.
-- ============================================================================

ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS is_clinica_parceira BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN operadoras.is_clinica_parceira IS
  'Marca operadoras que são, na verdade, clínicas parceiras (labs que enviam exame pra este laboratório processar) em vez de convênios de saúde. Gerenciado pela tela de Títulos, gate canManageBilling — o apLIS não tem essa distinção.';

-- Ponto de partida: os 3 exemplos citados no relatório. Faz o upsert pelo
-- aplis_id em vez de exigir que a operadora já tenha sido sincronizada antes
-- desta migration — se a linha ainda não existir, cria com o nome do
-- relatório; o próximo "Sincronizar operadoras" só atualiza nome/CNPJ e não
-- mexe em is_clinica_parceira (o payload do sync não inclui essa coluna).
INSERT INTO operadoras (aplis_id, nome, is_clinica_parceira)
VALUES
  ('1290', 'Nexus', true),
  ('1155', 'ABAC', true),
  ('1123', 'Medigest', true)
ON CONFLICT (aplis_id) DO UPDATE SET is_clinica_parceira = true;
