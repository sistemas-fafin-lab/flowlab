-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Colaboradores: backfill de gestor_id a partir da lista trazida pelo RH
-- Migration: 20260921100000_rh_colaboradores_atualiza_gestores.sql
--
-- 20260914150000 (issue 01) deixou gestor_id nascer NULL para todo mundo, por
-- falta de dado confiável na época. O RH trouxe a lista de gestores x
-- colaboradores em 2026-09-21; esta migration aplica essa lista aos registros
-- que já existem em `colaboradores`.
--
-- Hierarquia confirmada com o RH: Louise Fontel é gestora direta de Raquel
-- (Dos Santos Avelino) e de Lucas (Moreira) — que por sua vez são gestores de
-- suas próprias equipes. Não é ciclo: é uma cadeia de 2 níveis sob Louise.
--
-- REESCRITA em 2026-09-29 com os IDs de PRODUÇÃO (jqx). A versão de 21/09
-- tinha IDs do projeto de teste (eqz), onde foi aplicada; em produção não
-- casava com ninguém e nenhum colaborador tinha gestor. Os mesmos 20 vínculos
-- foram refeitos pelo nome cadastrado (todos com cadastro único e idêntico em
-- produção), mais 11 pessoas da lista do RH que a versão anterior deixou de
-- fora só por não existirem no teste — marcadas "novo" abaixo, casadas pelo
-- nome da lista com o único candidato em produção.
--
-- Continuam DE FORA (sem colaborador cadastrado em produção):
--   Eduarda Fabri: Anna Clara
--   Paulo Vitor: Ananda, Larissa, Sophia, Ana Clara Vieira, Lohara, Graziane,
--                Luana Melo, Iveilci
--   Louise Fontel: Elisangela Felicio, Joaquina, Monica
--   Raquel: Renata
--   Suane: Elisangela Rocha
--   Lucas: Isaura, Lina
--
-- Fica de fora também a correção de conta duplicada do Lucas Moreira que a
-- versão de 21/09 fazia no teste (religar ao user_profile de
-- transporte.lab.00421@gmail.com e reativar). Em produção o colaborador já
-- está ativo, ligado ao perfil de financeirolab00421@gmail.com, e os DOIS
-- perfis estão ativos — não há como saber daqui qual é o certo. Confirmar com
-- o RH antes de mexer.
--
-- "Maria Eduarda" (sem sobrenome) segue como "Maria Eduarda Fonseca" da lista
-- do RH, como na versão anterior: único candidato restante, sem confirmação de
-- sobrenome — revisar se aparecer inconsistência.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) Pré-condição: cada ID existe em colaboradores com o nome esperado. Falha
--    alto em vez de rodar sem efeito (a versão anterior tinha IDs do teste).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_faltando TEXT;
BEGIN
  SELECT string_agg(e.nome, ', ' ORDER BY e.nome)
    INTO v_faltando
    FROM (VALUES
    ('c2bf4f44-efe2-45ec-82e5-33c631793afe'::uuid, 'ADRIANA APARECIDA SOARES DA SILV A'),
    ('9384b080-ff7e-448c-a043-ea63fa9ea9ac'::uuid, 'Adriana De Jesus Rocha'),
    ('3ea59037-afe6-448e-a9d1-6651cc3b575f'::uuid, 'Alice Tavares'),
    ('2f18c8a2-f54c-4bf0-8282-69548ff2ffa8'::uuid, 'Cleber Kendel de Andrade'),
    ('da8cecff-eb34-411c-954f-ec85b468b4ad'::uuid, 'Cristina Dos Santos Tiago'),
    ('26813aaf-9b22-432a-ab19-7e0c87f4c7e7'::uuid, 'Eduarda Fabri'),
    ('8765c73b-30c2-402e-92d1-66783e365a15'::uuid, 'Eliane Aparecida Rodrigues'),
    ('e14bbe15-b9b9-4daf-96a4-f105cbdfebbf'::uuid, 'Fabricio Nogueira Rios'),
    ('91b6e21e-9406-4a75-9866-73e747b080b0'::uuid, 'Flavia Araujo'),
    ('e6790d88-0c3f-44c3-a02d-7d421eefeaf9'::uuid, 'Gabriel Queiroz'),
    ('0b7e4085-c977-4da8-bcfa-ed3adc4f482a'::uuid, 'Gabriel Silva Carneiro'),
    ('f2cda59f-2bf2-4f5a-87bd-1c79ba02eebb'::uuid, 'Gustavo Henrique Silva Fernandes'),
    ('b793cad4-cc07-4ae8-b1a6-41d28ed7b8c0'::uuid, 'João Dos Santos Madeiro'),
    ('a53b6127-d1ab-40d6-bb78-9e09166d0b04'::uuid, 'João Pedro Dias'),
    ('4bb177f0-e868-44a8-9a1c-fa90e2652e09'::uuid, 'Jullya Evelyn Alves Branco'),
    ('8327ce6f-897a-479d-8ec8-47d61ff93c76'::uuid, 'Louise Fontel'),
    ('bfdfd34d-df01-45c7-b6f1-e20db57eb9b8'::uuid, 'Louise Marie Holanda Nunes Miyahira'),
    ('d904b715-dd86-46ab-895e-b94867d494a3'::uuid, 'Luanna Beatriz Pereira Barros'),
    ('32f6f6c5-81cb-499d-b968-3b94e9a55278'::uuid, 'Lucas Moreira'),
    ('98ce23f1-b7fd-4349-94b3-abe3663b7f97'::uuid, 'Marcia Felix'),
    ('ab1f4a6c-3bc5-4451-91eb-b4ced69819a6'::uuid, 'Marcos Junior'),
    ('b19bf11e-5fe4-4281-af58-b2009db11a57'::uuid, 'Maria Eduarda'),
    ('e3155111-57d9-4c6a-a07c-3cb535c64928'::uuid, 'Maria Eduarda Barbosa'),
    ('9f084ae7-8aea-4bcd-a607-ea60c0564b2b'::uuid, 'Marina Casseb Ferraz Saavedra Dias'),
    ('ca98e7ba-29df-4403-b7e8-0e6c54dc3761'::uuid, 'Mateus'),
    ('1cae5f09-8714-4b98-aabb-3fdd769e4e15'::uuid, 'Milena Araujo'),
    ('4d16b0ae-e300-417f-a59b-6706fcb1e7d0'::uuid, 'Paulo Vítor'),
    ('f2fb3a77-83bc-4bde-aa7f-c82c15125d0f'::uuid, 'Raquel Dos Santos Avelino'),
    ('2fb97d6e-ee75-4dd6-ac0a-4d746cde44d9'::uuid, 'Rívia Freire'),
    ('f480fe87-cb0c-4630-be37-367b9a3d29ca'::uuid, 'Samuel'),
    ('45484389-bc56-4dfd-bc04-b4f81492ee75'::uuid, 'Suane Batista De Oliveira'),
    ('ab5f645f-6185-4039-83ac-b78d9e2d70f5'::uuid, 'Surane Lopes'),
    ('da3443ee-11a1-4929-9bf2-6f6ae34332e5'::uuid, 'Thainá Moreira Diniz'),
    ('0d1f1333-0e21-47b4-9f36-2d05877f76e2'::uuid, 'VANESSA RIBEIRO DA CUNHA BARRETO'),
    ('a8b99208-76bd-47be-9ad1-fed49b48ce35'::uuid, 'Vinicius Canedo')
    ) AS e(id, nome)
    LEFT JOIN public.colaboradores c ON c.id = e.id AND btrim(c.nome) = e.nome
   WHERE c.id IS NULL;
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Colaborador(es) não encontrado(s) com esse id e nome: %', v_faltando;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1) Gestores (31 vínculos). Só onde gestor_id ainda está vazio: não
--    sobrescreve o que o RH tiver ajustado pela tela.
-- ----------------------------------------------------------------------------

-- Eduarda Fabri (26813aaf-9b22-432a-ab19-7e0c87f4c7e7) — gestor(a)
UPDATE public.colaboradores SET gestor_id = '26813aaf-9b22-432a-ab19-7e0c87f4c7e7'
 WHERE id = '9f084ae7-8aea-4bcd-a607-ea60c0564b2b' AND gestor_id IS NULL; -- Marina -> Marina Casseb Ferraz Saavedra Dias
UPDATE public.colaboradores SET gestor_id = '26813aaf-9b22-432a-ab19-7e0c87f4c7e7'
 WHERE id = '8765c73b-30c2-402e-92d1-66783e365a15' AND gestor_id IS NULL; -- Eliane Rodrigues -> Eliane Aparecida Rodrigues (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '26813aaf-9b22-432a-ab19-7e0c87f4c7e7'
 WHERE id = 'd904b715-dd86-46ab-895e-b94867d494a3' AND gestor_id IS NULL; -- Luanna -> Luanna Beatriz Pereira Barros (novo: não havia cadastro no teste)

-- Paulo Vítor (4d16b0ae-e300-417f-a59b-6706fcb1e7d0) — gestor(a)
UPDATE public.colaboradores SET gestor_id = '4d16b0ae-e300-417f-a59b-6706fcb1e7d0'
 WHERE id = 'da8cecff-eb34-411c-954f-ec85b468b4ad' AND gestor_id IS NULL; -- Cristina -> Cristina Dos Santos Tiago
UPDATE public.colaboradores SET gestor_id = '4d16b0ae-e300-417f-a59b-6706fcb1e7d0'
 WHERE id = '3ea59037-afe6-448e-a9d1-6651cc3b575f' AND gestor_id IS NULL; -- Alice -> Alice Tavares
UPDATE public.colaboradores SET gestor_id = '4d16b0ae-e300-417f-a59b-6706fcb1e7d0'
 WHERE id = 'ab5f645f-6185-4039-83ac-b78d9e2d70f5' AND gestor_id IS NULL; -- Surane -> Surane Lopes (novo: não havia cadastro no teste)

-- Louise Fontel (8327ce6f-897a-479d-8ec8-47d61ff93c76) — gestor(a)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '91b6e21e-9406-4a75-9866-73e747b080b0' AND gestor_id IS NULL; -- Flávia -> Flavia Araujo
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '9384b080-ff7e-448c-a043-ea63fa9ea9ac' AND gestor_id IS NULL; -- Adriana de Jesus -> Adriana De Jesus Rocha
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'e3155111-57d9-4c6a-a07c-3cb535c64928' AND gestor_id IS NULL; -- Maria Eduarda Barbosa
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '4bb177f0-e868-44a8-9a1c-fa90e2652e09' AND gestor_id IS NULL; -- Jullya -> Jullya Evelyn Alves Branco
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'f2fb3a77-83bc-4bde-aa7f-c82c15125d0f' AND gestor_id IS NULL; -- Raquel -> Raquel Dos Santos Avelino
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'f480fe87-cb0c-4630-be37-367b9a3d29ca' AND gestor_id IS NULL; -- Samuel
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'ab1f4a6c-3bc5-4451-91eb-b4ced69819a6' AND gestor_id IS NULL; -- Marcos -> Marcos Junior
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'ca98e7ba-29df-4403-b7e8-0e6c54dc3761' AND gestor_id IS NULL; -- Mateus
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '32f6f6c5-81cb-499d-b968-3b94e9a55278' AND gestor_id IS NULL; -- Lucas -> Lucas Moreira
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '0b7e4085-c977-4da8-bcfa-ed3adc4f482a' AND gestor_id IS NULL; -- Gabriel Carneiro -> Gabriel Silva Carneiro
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'e6790d88-0c3f-44c3-a02d-7d421eefeaf9' AND gestor_id IS NULL; -- Gabriel Queiroz
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'b793cad4-cc07-4ae8-b1a6-41d28ed7b8c0' AND gestor_id IS NULL; -- João Madeiro -> João Dos Santos Madeiro
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'a8b99208-76bd-47be-9ad1-fed49b48ce35' AND gestor_id IS NULL; -- Vinicius -> Vinicius Canedo
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'bfdfd34d-df01-45c7-b6f1-e20db57eb9b8' AND gestor_id IS NULL; -- Louise Marie -> Louise Marie Holanda Nunes Miyahira (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'e14bbe15-b9b9-4daf-96a4-f105cbdfebbf' AND gestor_id IS NULL; -- Fabricio -> Fabricio Nogueira Rios (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'c2bf4f44-efe2-45ec-82e5-33c631793afe' AND gestor_id IS NULL; -- Adriana Aparecida -> ADRIANA APARECIDA SOARES DA SILV A (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'da3443ee-11a1-4929-9bf2-6f6ae34332e5' AND gestor_id IS NULL; -- Thainá -> Thainá Moreira Diniz (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '0d1f1333-0e21-47b4-9f36-2d05877f76e2' AND gestor_id IS NULL; -- Vanessa -> VANESSA RIBEIRO DA CUNHA BARRETO (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = '2f18c8a2-f54c-4bf0-8282-69548ff2ffa8' AND gestor_id IS NULL; -- Cléber -> Cleber Kendel de Andrade (novo: não havia cadastro no teste)
UPDATE public.colaboradores SET gestor_id = '8327ce6f-897a-479d-8ec8-47d61ff93c76'
 WHERE id = 'f2cda59f-2bf2-4f5a-87bd-1c79ba02eebb' AND gestor_id IS NULL; -- Gustavo -> Gustavo Henrique Silva Fernandes (novo: não havia cadastro no teste)

-- Raquel Dos Santos Avelino (f2fb3a77-83bc-4bde-aa7f-c82c15125d0f) — gestor(a)
UPDATE public.colaboradores SET gestor_id = 'f2fb3a77-83bc-4bde-aa7f-c82c15125d0f'
 WHERE id = 'b19bf11e-5fe4-4281-af58-b2009db11a57' AND gestor_id IS NULL; -- Maria Eduarda Fonseca -> Maria Eduarda
UPDATE public.colaboradores SET gestor_id = 'f2fb3a77-83bc-4bde-aa7f-c82c15125d0f'
 WHERE id = '2fb97d6e-ee75-4dd6-ac0a-4d746cde44d9' AND gestor_id IS NULL; -- Rívia -> Rívia Freire

-- Suane Batista De Oliveira (45484389-bc56-4dfd-bc04-b4f81492ee75) — gestor(a)
UPDATE public.colaboradores SET gestor_id = '45484389-bc56-4dfd-bc04-b4f81492ee75'
 WHERE id = '98ce23f1-b7fd-4349-94b3-abe3663b7f97' AND gestor_id IS NULL; -- Márcia -> Marcia Felix
UPDATE public.colaboradores SET gestor_id = '45484389-bc56-4dfd-bc04-b4f81492ee75'
 WHERE id = 'a53b6127-d1ab-40d6-bb78-9e09166d0b04' AND gestor_id IS NULL; -- João Pedro -> João Pedro Dias
UPDATE public.colaboradores SET gestor_id = '45484389-bc56-4dfd-bc04-b4f81492ee75'
 WHERE id = '1cae5f09-8714-4b98-aabb-3fdd769e4e15' AND gestor_id IS NULL; -- Milena -> Milena Araujo (novo: não havia cadastro no teste)

COMMIT;
