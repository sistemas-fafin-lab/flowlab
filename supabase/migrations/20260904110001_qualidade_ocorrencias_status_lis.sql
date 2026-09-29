-- Ocorrências: status passa a vir do apLIS, não mais da curadoria manual.
--
-- `ocorrencia.Status` (MySQL do laboratório) confirmado ao vivo em
-- 2026-09-04 cruzando a distribuição de valores com o preenchimento das
-- colunas de workflow (Apr*=aprovação/decisão de RNC, Imp*=implementação,
-- Val*=validação, Efi*=eficácia):
--   1  = "Decidir sobre abertura de RNC" (decisão pendente, nada mais preenchido)
--   9  = "Concluído com eficácia" (Apr/Val/Efi resultado = 1, tudo finalizado)
--   11 = "Concluído sem RNC" (AprResultado = 0, finalizado sem abrir RNC)
-- Demais códigos (4, 5 e os não observados nos dados conferidos) ficam de
-- fora da classificação — decisão do dono do produto: só 1/9/11 têm
-- semântica confirmada, os outros não viram nem "pendente" nem "concluída".
--
-- `status_curadoria` era escrito por `salvarCuradoriaOcorrencia` (calculado
-- a partir de colaborador/setor/motivo preenchidos) — isso NUNCA reproduzia
-- a situação real da ocorrência no LIS. Substituído: agora só o sync
-- (`qualidade-sync-ocorrencias`, service_role) escreve esta coluna, a partir
-- do código do apLIS. O nome da coluna fica igual (evita reescrever RLS/
-- índice/trigger) — o que muda é quem escreve e com que base.

ALTER TABLE qa_ocorrencias ADD COLUMN IF NOT EXISTS cod_status_lis integer;
COMMENT ON COLUMN qa_ocorrencias.cod_status_lis IS 'ocorrencia.Status bruto do apLIS — só para depuração/rastreio; status_curadoria já traz a leitura (pendente/concluida/NULL).';

-- Nem toda ocorrência tem um código classificável (1/9/11) — `status_curadoria`
-- passa a aceitar NULL para "fica de fora" em vez de forçar 'pendente'.
ALTER TABLE qa_ocorrencias ALTER COLUMN status_curadoria DROP DEFAULT;
ALTER TABLE qa_ocorrencias ALTER COLUMN status_curadoria DROP NOT NULL;
COMMENT ON COLUMN qa_ocorrencias.status_curadoria IS 'Derivado de ocorrencia.Status no apLIS pelo sync (cod 1=pendente, 9/11=concluida, outros=NULL) — não é mais editável via curadoria manual.';
