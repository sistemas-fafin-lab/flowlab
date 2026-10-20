-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — vínculo do catálogo de exames com cobrança/teste do apLIS
-- Migration: 20261020210000_custo_exames_vinculo_aplis.sql
--
-- custo_exames veio de uma planilha e não tem nenhum id do apLIS: não há como
-- dizer "a cobrança X / teste Y do apLIS é este exame do catálogo". Sem isso a
-- Admissão não sabe qual TUSS pedir ao AEL para uma requisição de convênio
-- (.scratch/controle-custos-vinculo-aplis-tuss/spec.md).
--
-- Duas colunas, nulas: a cobrança (fatexametipo.IdExameTipo) e, quando a
-- cobrança tem testes (PCR, Captura Híbrida), o teste (patteste.IdTeste).
-- Editadas na aba Exames do Controle de Custos; a RLS da tabela já cobre.
--
-- Unicidade do par entre os exames ligados, com "sem teste" contando como um
-- valor (COALESCE(..., 0) — IdTeste do apLIS começa em 1): uma cobrança pode ter
-- um exame "sem teste" e vários exames "com teste X", mas o mesmo par nunca fica
-- em dois exames, senão não haveria como saber qual TUSS vale. O nome do índice
-- é lido pela tela (useCostControl) para trocar o erro genérico por uma
-- mensagem clara.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.custo_exames
  ADD COLUMN IF NOT EXISTS aplis_id_exame_tipo INTEGER NULL,
  ADD COLUMN IF NOT EXISTS aplis_id_teste      INTEGER NULL;

ALTER TABLE public.custo_exames
  DROP CONSTRAINT IF EXISTS custo_exames_aplis_teste_exige_cobranca;
ALTER TABLE public.custo_exames
  ADD CONSTRAINT custo_exames_aplis_teste_exige_cobranca
  CHECK (aplis_id_teste IS NULL OR aplis_id_exame_tipo IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custo_exames_vinculo_aplis
  ON public.custo_exames (aplis_id_exame_tipo, COALESCE(aplis_id_teste, 0))
  WHERE aplis_id_exame_tipo IS NOT NULL;

COMMENT ON COLUMN public.custo_exames.aplis_id_exame_tipo IS 'Id da cobrança no apLIS (fatexametipo.IdExameTipo), não do flowlab. Vazio = exame sem vínculo: a Admissão não manda TUSS para essa cobrança.';
COMMENT ON COLUMN public.custo_exames.aplis_id_teste IS 'Id do teste no apLIS (patteste.IdTeste), não do flowlab. Só com aplis_id_exame_tipo preenchido. Vazio = o exame vale para a cobrança sem teste; sem cobrança, não mandar TUSS.';
