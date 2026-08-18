-- Restringe o fluxo de Culturas (ac_culturas) a exatamente 3 tipos SWAB:
-- Streptococcus Grupo B, Fungos + Antifungigrama e Cultura + Antibiograma
-- (genérica). Os demais exames hoje marcados is_cultura = true (urina/fezes/
-- variantes) saem do fluxo de Culturas, mas continuam ativos e solicitáveis
-- no catálogo geral — não são desativados. Histórico de ac_culturas (snapshot
-- via exame_nome) permanece intacto.
UPDATE ac_exames
SET is_cultura = false
WHERE nome IN (
  'COPROCULTURA',
  'COPROCULTURA-FEZES',
  'CULTURA BACTERIANA (EM DIVERSOS MATERIAIS BIOLÓGICOS)',
  'CULTURA, URINA COM CONTAGEM DE COLÔNIAS',
  'UROCULTURA COM ANTIBIOGRAMA'
);
