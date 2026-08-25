-- ============================================================================
-- Troca string vazia por placeholder explícito nos 6 campos fixos de
-- qa_parametros (módulo cancer) que continuam sem valor real confirmado
-- depois de 20260825140000_qualidade_cancer_seed_valores_reais_rhc.sql:
-- cancer.fonte, cancer.regiao_administrativa, cancer.municipio,
-- cancer.estado, cancer.naturalidade_fixa, cancer.nacionalidade_fixa
-- (Fonte + endereço institucional do laboratório, não do paciente).
--
-- Causa raiz (issue 11): 20260825130000 semeou esses 6 como '""'::jsonb.
-- Isso é mais perigoso que um placeholder explícito: '' se confunde com
-- "campo vazio por engano" ou com um valor real igualmente vazio, e não dá
-- nenhum sinal visual de "isto não foi preenchido de propósito" pra quem
-- olha a tela ou o CSV exportado — um CNES/endereço errado num arquivo de
-- notificação compulsória (RHC) é sério o bastante pra merecer um aviso que
-- não passe despercebido.
--
-- Os valores reais continuam sendo pendência de negócio genuína — alguém do
-- laboratório precisa informar o nome oficial do laboratório (Fonte) e os
-- códigos de região administrativa/município/estado/naturalidade/nacionalidade
-- do endereço institucional antes de qualquer envio real ao RHC.
--
-- `AND valor = '""'::jsonb`: mesma guarda de 20260825140000 — só sobrescreve
-- linha que ainda está no placeholder vazio original; não mexe em valor que
-- alguém já tenha preenchido manualmente pela tela nesse meio-tempo.
-- ============================================================================

UPDATE qa_parametros
SET valor = '"PLACEHOLDER — preencher com o valor real (ver issue 11)"'::jsonb
WHERE chave IN (
  'cancer.fonte',
  'cancer.regiao_administrativa',
  'cancer.municipio',
  'cancer.estado',
  'cancer.naturalidade_fixa',
  'cancer.nacionalidade_fixa'
)
AND valor = '""'::jsonb;
