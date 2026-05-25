-- Migration: Sync CPF from user_whitelist into user_profiles
-- Matching by email (reliable) instead of name.
-- Only updates profiles where cpf IS NULL to avoid overwriting existing values.
--
-- Skipped (not in whitelist or not a real person):
--   ti@laboratoriolab.com.br              (Tecnologia E Ai) - setor
--   labsuporteadm12@gmail.com             (Gabrielly Thaissa) - saiu
--   compraslab00421@gmail.com             (Setor De Compras - Lab) - setor
--   sistemas.fafin.lab@gmail.com          (Sistemas Fafin) - setor
--   transporte.lab.00421@gmail.com        (Hiago Dos Reis Leite) - saiu
--   sup.faturamento.lab@gmail.com         (Lucas Dourado) - saiu
--   labsuporte3@gmail.com                 (Sara Lacerda) - saiu
--   coleta.laboratorio.lab@gmail.com      (Francielen De Souza Mendes) - saiu
--   labsuporteadm6@gmail.com              (Juliana Cristina Barbosa) - saiu
--   marketing.laboratorio.lab@gmail.com   (Patrick Isaac) - saiu
--   copa@laboratoriolab.com.br            (Elisa Rocha) - pedir pro RH
--   faturamento@laboratoriolab.com.br     (Faturamento - Supervisão) - setor
--   ti.teste.lab@gmail.com                (345234) - deletar

UPDATE user_profiles SET cpf = '03707582183', updated_at = NOW()
  WHERE email = 'controladoria.laboratorio.lab@gmail.com'    AND cpf IS NULL; -- Marcos Junior → MARCOS DA COSTA AVELAR JUNIOR

UPDATE user_profiles SET cpf = '62020340330', updated_at = NOW()
  WHERE email = 'coord.adm.laboratorio.lab@gmail.com'        AND cpf IS NULL; -- Louise Fontel → LOUISE COELHO FONTEL

UPDATE user_profiles SET cpf = '05726669185', updated_at = NOW()
  WHERE email = 'log.almoxarifado.lab@gmail.com'             AND cpf IS NULL; -- Mateus → MATEUS ARAUJO FERREIRA

UPDATE user_profiles SET cpf = '08831959174', updated_at = NOW()
  WHERE email = 'gabriel.lab00421@gmail.com'                 AND cpf IS NULL; -- Gabriel Queiroz → GABRIEL QUEIROZ DE SOUZA

UPDATE user_profiles SET cpf = '07163966105', updated_at = NOW()
  WHERE email = 'tech2.laboratorio.lab@gmail.com'            AND cpf IS NULL; -- Gabriel Silva Carneiro

UPDATE user_profiles SET cpf = '07749642196', updated_at = NOW()
  WHERE email = 'ti.laboratorio.lab@gmail.com'               AND cpf IS NULL; -- João Dos Santos Madeiro

UPDATE user_profiles SET cpf = '08328779137', updated_at = NOW()
  WHERE id = (
    SELECT id FROM user_profiles
    WHERE email IN ('labsuportadm4@gmail.com', 'labsuporteadm4@gmail.com')
      AND cpf IS NULL
    LIMIT 1
  ); -- Jullya Evelyn Alves Branco (dois perfis duplicados — atualiza apenas 1)

UPDATE user_profiles SET cpf = '08970516107', updated_at = NOW()
  WHERE email = 'financeiro.lab9@gmail.com'                  AND cpf IS NULL; -- Samuel → SAMUEL VICTOR ALVES BRANCO

UPDATE user_profiles SET cpf = '00663714141', updated_at = NOW()
  WHERE email = 'miriamoliveira1981@gmail.com'               AND cpf IS NULL; -- Miriam Oliveira Bernardo Santos

UPDATE user_profiles SET cpf = '61114529249', updated_at = NOW()
  WHERE email = 'labrh00421@gmail.com'                       AND cpf IS NULL; -- Suane Batista De Oliveira

UPDATE user_profiles SET cpf = '92636411100', updated_at = NOW()
  WHERE id = (
    SELECT id FROM user_profiles
    WHERE email IN ('labrecepcao.2020@gmail.com', 'jesusadriana@gmail.com')
      AND cpf IS NULL
    LIMIT 1
  ); -- Adriana De Jesus Rocha (dois perfis duplicados — atualiza apenas 1)

UPDATE user_profiles SET cpf = '05696714188', updated_at = NOW()
  WHERE email = 'labsuporteadm10@gmail.com'                  AND cpf IS NULL; -- Maria Eduarda Barbosa → MARIA EDUARDA BARBOSA DE MEDEIROS

UPDATE user_profiles SET cpf = '55965164149', updated_at = NOW()
  WHERE email = 'faturalab.ana@gmail.com'                    AND cpf IS NULL; -- Ana Lucia Tavares

UPDATE user_profiles SET cpf = '06688496143', updated_at = NOW()
  WHERE email = 'financeirolab00421@gmail.com'               AND cpf IS NULL; -- Lucas Moreira → LUCAS MENDONCA MOREIRA

UPDATE user_profiles SET cpf = '78899320144', updated_at = NOW()
  WHERE email = 'comercial.laboratorio.lab@gmail.com'        AND cpf IS NULL; -- Cristiane Lacerda Dos Santos Madeiro

UPDATE user_profiles SET cpf = '05824413150', updated_at = NOW()
  WHERE email = 'biomol.laboratorio.lab02@gmail.com'         AND cpf IS NULL; -- Ana Clara → ANA CLARA VIEIRA FROIS

UPDATE user_profiles SET cpf = '05782543108', updated_at = NOW()
  WHERE email = 'rhlab00421@gmail.com'                       AND cpf IS NULL; -- João Pedro Dias

UPDATE user_profiles SET cpf = '04178365118', updated_at = NOW()
  WHERE email = 'faturalab02@gmail.com'                      AND cpf IS NULL; -- Raquel Dos Santos Avelino

UPDATE user_profiles SET cpf = '08934289147', updated_at = NOW()
  WHERE email = 'tech.laboratorio.lab@gmail.com'             AND cpf IS NULL; -- Kauã Larsson Lopes De Sousa

UPDATE user_profiles SET cpf = '08336023143', updated_at = NOW()
  WHERE email = 'qualidade.laboratorio.lab@gmail.com'        AND cpf IS NULL; -- Eduarda Fabri → EDUARDA SILVA FABRI

UPDATE user_profiles SET cpf = '79402232168', updated_at = NOW()
  WHERE email = 'atecnicalab@gmail.com'                      AND cpf IS NULL; -- Cristina Dos Santos Tiago

UPDATE user_profiles SET cpf = '03554145114', updated_at = NOW()
  WHERE email = 'contato.viviane.afonso@gmail.com'           AND cpf IS NULL; -- Viviane Da Silva Afonso → VIVIANE DA SILVA AFONSO AREVALO

UPDATE user_profiles SET cpf = '00764915100', updated_at = NOW()
  WHERE email = 'labsuporteadm9@gmail.com'                   AND cpf IS NULL; -- Flavia Araujo → FLAVIA ARAUJO DE SOUZA OLIVEIRA

UPDATE user_profiles SET cpf = '07691889151', updated_at = NOW()
  WHERE email = 'labtriagem00421@gmail.com'                  AND cpf IS NULL; -- Alice Tavares → ALICE DOS SANTOS TAVARES

UPDATE user_profiles SET cpf = '07658701181', updated_at = NOW()
  WHERE email = 'fabiathallyta.moreiramedeiros@gmail.com'    AND cpf IS NULL; -- Fabia Thallyta Moreira Medeiros

UPDATE user_profiles SET cpf = '92166920144', updated_at = NOW()
  WHERE email = 'faturamentolab2@gmail.com'                  AND cpf IS NULL; -- Rívia Freire → RIVIA FREIRE ARAUJO BARRETOS BORBA

UPDATE user_profiles SET cpf = '08486340128', updated_at = NOW()
  WHERE email = 'lab.faturamento.recurso@gmail.com'          AND cpf IS NULL; -- Maria Eduarda → MARIA EDUARDA FONSECA BOMFIM

UPDATE user_profiles SET cpf = '82736588134', updated_at = NOW()
  WHERE email = 'servicosgerais.lab2025@gmail.com'           AND cpf IS NULL; -- Marcia Felix → MARCIA FELIX RODRIGUES DE SOUSA

UPDATE user_profiles SET cpf = '04468041188', updated_at = NOW()
  WHERE email = 'medicina.laboratorial.lab@gmail.com'        AND cpf IS NULL; -- Marina Casseb Ferraz Saavedra Dias

UPDATE user_profiles SET cpf = '92603343149', updated_at = NOW()
  WHERE email = 'mariogorini@alivepro.com.br'                AND cpf IS NULL; -- mario gorini

UPDATE user_profiles SET cpf = '07679361169', updated_at = NOW()
  WHERE email = 'vinicius.canedo@laboratoriolab.com.br'      AND cpf IS NULL; -- Vinicius Canedo → VINICIUS DIAS SANTOS CANEDO

-- ── CPFs obtidos do RH após geração inicial ────────────────────────────────────
UPDATE user_profiles SET cpf = '02193979103', updated_at = NOW()
  WHERE email = 'gerenciaadm.00421@gmail.com'         AND cpf IS NULL; -- Erika Gorini

UPDATE user_profiles SET cpf = '53586948549', updated_at = NOW()
  WHERE email = 'bdr.laboratorio.lab@gmail.com'        AND cpf IS NULL; -- Cristiane Macedo Gama

UPDATE user_profiles SET cpf = '03131908106', updated_at = NOW()
  WHERE email = 'atendimento@laboratoriolab.com.br'    AND cpf IS NULL; -- Luis Feliipe da Silva Borges

-- ── Contas de setor: CPF placeholder (sem pessoa física responsável) ──────────
-- Inseridos na whitelist com identificadores fixos para permitir acesso.
INSERT INTO user_whitelist (cpf, name, activity) VALUES
  ('00000000001', 'SETOR - TECNOLOGIA E AI',         true),
  ('00000000002', 'SETOR - COMPRAS',                 true),
  ('00000000003', 'SETOR - SISTEMAS FAFIN',          true),
  ('00000000004', 'SETOR - FATURAMENTO SUPERVISAO',  true)
ON CONFLICT (cpf) DO NOTHING;

UPDATE user_profiles SET cpf = '00000000001', updated_at = NOW()
  WHERE email = 'ti@laboratoriolab.com.br'            AND cpf IS NULL; -- Tecnologia E Ai

UPDATE user_profiles SET cpf = '00000000002', updated_at = NOW()
  WHERE email = 'compraslab00421@gmail.com'            AND cpf IS NULL; -- Setor De Compras - Lab

UPDATE user_profiles SET cpf = '00000000003', updated_at = NOW()
  WHERE email = 'sistemas.fafin.lab@gmail.com'        AND cpf IS NULL; -- Sistemas Fafin

UPDATE user_profiles SET cpf = '00000000004', updated_at = NOW()
  WHERE email = 'faturamento@laboratoriolab.com.br'   AND cpf IS NULL; -- Faturamento - Supervisão

