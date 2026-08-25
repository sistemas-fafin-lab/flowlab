-- ============================================================================
-- Preenche com valor real 8 dos 15 parâmetros fixos de qa_parametros (módulo
-- cancer) que 20260825130000_qualidade_cancer_seed_parametros_cido.sql
-- criou como placeholder vazio ''.
--
-- 20260825130000 acertou em não inventar valor pra nenhum dos 15 — mas o
-- repositório não tinha, até agora, uma fonte confiável pra confirmar quais
-- desses valores já são conhecidos e quais são pendência real de negócio.
--
-- O projeto irmão Flowlab_Controle_Qualidade (implementação independente do
-- mesmo domínio) tem um dicionário de dados
-- (docs/Planing/data-dictionaries/Positivos_Cancer.md, linhas 17-38, e
-- openspec/changes/etapa-6-cancer/design.md linha 36) que confirma, testando
-- contra o mesmo LIS/MySQL do laboratório, que estes 8 campos são o próprio
-- padrão fixo do layout RHC — não são configuração do laboratório, são
-- constantes do formato nacional:
--
--   cor_ignorado           = 9 (ignorado — `paciente` não tem coluna de cor/raça)
--   endereco_codigo        = 0
--   profissao_codigo       = 0
--   meio_diagnostico       = 1 (todo caso é anatomopatológico)
--   extensao               = 1
--   caso_raro              = 2
--   estado_civil_ignorado  = 9 (ignorado — paciente.EstadoCivil existe mas nunca é preenchido, fica 0)
--   escolaridade_ignorado  = 9 (ignorado)
--
-- Os 6 campos restantes (fonte, regiao_administrativa, municipio, estado,
-- naturalidade_fixa, nacionalidade_fixa) não têm valor confirmado nem no
-- dicionário do colega — seguem como placeholder vazio, pendência real de
-- negócio (issue 11).
--
-- UPDATE, não INSERT ... ON CONFLICT DO NOTHING: as linhas já existem,
-- criadas pela 20260825130000; queremos sobrescrever o placeholder vazio.
--
-- `AND valor = '""'::jsonb`: 20260825130000 (já commitada, ca6a3f3) tornou
-- estas 8 chaves editáveis via app (CHAVES_PARAMETRO_FIXO_CANCER +
-- atualizarParametroFixoCancer) no mesmo commit em que as semeou vazias —
-- se essa migration já chegou à produção antes desta, alguém do laboratório
-- pode ter preenchido um valor manualmente pela tela nesse intervalo. Sem a
-- guarda, este UPDATE sobrescreveria esse valor manual sem aviso; com ela,
-- só mexe em linha que ainda está no placeholder vazio.
-- ============================================================================

UPDATE qa_parametros SET valor = '"9"'::jsonb WHERE chave = 'cancer.cor_ignorado' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"0"'::jsonb WHERE chave = 'cancer.endereco_codigo' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"0"'::jsonb WHERE chave = 'cancer.profissao_codigo' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"1"'::jsonb WHERE chave = 'cancer.meio_diagnostico' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"1"'::jsonb WHERE chave = 'cancer.extensao' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"2"'::jsonb WHERE chave = 'cancer.caso_raro' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"9"'::jsonb WHERE chave = 'cancer.estado_civil_ignorado' AND valor = '""'::jsonb;
UPDATE qa_parametros SET valor = '"9"'::jsonb WHERE chave = 'cancer.escolaridade_ignorado' AND valor = '""'::jsonb;
