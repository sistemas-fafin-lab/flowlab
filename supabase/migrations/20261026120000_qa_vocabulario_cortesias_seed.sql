-- Vocabulário de curadoria de Cortesias (Motivo, Classificação e Autorizado por).
--
-- A migration 20260820120000_qualidade_piloto.sql só cria as tabelas; os itens
-- foram cadastrados à mão no projeto de teste (eqzqkztgzcngnxmihdom) e nunca
-- chegaram à produção (jqxeqmeikqclmmongclj). Lá as listas vinham vazias e os
-- selects da curadoria mostravam só "— selecione —".
--
-- Idempotente: ON CONFLICT (nome) não duplica nem reativa itens já existentes.
-- qa_colaboradores não tem UNIQUE (nome), então a deduplicação é por NOT EXISTS.

INSERT INTO qa_motivos_cortesia (nome) VALUES
  ('Amostra inadequada'),
  ('Atraso na liberação'),
  ('Clínica Parceira'),
  ('Colaboradores'),
  ('Erro de cadastro'),
  ('Erro de coleta'),
  ('Erro técnico'),
  ('Estratégia comercial'),
  ('Médico parceiro'),
  ('Outros'),
  ('Paciente VIP'),
  ('Reclamação procedente')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO qa_classificacoes_cortesia (nome) VALUES
  ('Comercial'),
  ('Humanização')
ON CONFLICT (nome) DO NOTHING;

-- Só quem autoriza cortesia, não o quadro inteiro do laboratório.
INSERT INTO qa_colaboradores (nome)
SELECT v.nome
FROM (VALUES
  ('CRISTIANE MADEIRO'),
  ('EDUARDA FABRI'),
  ('ERIKA GORINI'),
  ('LOUISE FONTEL'),
  ('MARIO GORINI')
) AS v(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM qa_colaboradores q WHERE lower(q.nome) = lower(v.nome)
);
