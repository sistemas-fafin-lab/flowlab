-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Colaboradores: backfill de gestor_id a partir da lista trazida pelo RH
-- Migration: 20260921100000_rh_colaboradores_atualiza_gestores.sql
--
-- 20260914150000 (issue 01) deixou gestor_id nascer NULL para todo mundo, por
-- falta de dado confiável na época. O RH trouxe a lista de gestores x
-- colaboradores em 2026-09-21; esta migration aplica essa lista aos registros
-- que JÁ EXISTEM em `colaboradores` hoje.
--
-- Hierarquia confirmada com o RH: Louise Fontel é gestora direta de Raquel
-- (Dos Santos Avelino) e de Lucas (Moreira) — que por sua vez são gestores de
-- suas próprias equipes. Não é ciclo: é uma cadeia de 2 níveis sob Louise.
--
-- IDs fixados por consulta direta à produção (service role, somente leitura)
-- em 2026-09-21 — mesmo padrão de dado real hardcoded já usado em
-- 20260911100000_backfill_contas_receber_q3_2026.sql. Cada UPDATE comenta o
-- nome como veio na lista do RH e o nome exato como está cadastrado, para
-- auditoria.
--
-- Ficaram DE FORA deste backfill (não têm colaborador cadastrado em produção
-- com nome compatível, ou o match era ambíguo demais para arriscar sem
-- confirmação — ver relatório passado ao RH):
--   Eduarda Fabri: Eliane Rodrigues, Luanna, Anna Clara
--   Paulo Vitor: Ananda, Larissa, Sophia, Ana Clara Vieira, Lohara, Surane,
--                Graziane, Luana Melo, Iveilci
--   Louise Fontel: Louise Marie, Fabricio, Adriana Aparecida, Thainá,
--                  Elisangela Felicio, Joaquina, Monica, Vanessa, Cléber,
--                  Gustavo
--   Raquel: Renata
--   Suane: Elisangela Rocha, Milena
--   Lucas: Isaura, Lina
--
-- Observações que ficam registradas aqui para quem revisar depois:
--   - "Lucas Moreira" estava com status = 'desligado' e user_profile_id
--     apontando para uma conta já removida (auth deletado, virou "Usuário
--     Removido"). Causa: havia duas contas duplicadas para a mesma pessoa: o
--     RH apagou uma, mas o colaborador remanescente ficou ligado ao
--     user_profile errado (o apagado) em vez do ativo
--     (transporte.lab.00421@gmail.com). Corrigido nesta migration:
--     user_profile_id -> 7dda5483-b642-4cb2-a9e4-7f337d786aeb e
--     status -> 'ativo'.
--   - "Maria Eduarda" (sem sobrenome) foi o único candidato remanescente para
--     "Maria Eduarda Fonseca" da lista do RH (o outro "Maria Eduarda" já
--     tinha sobrenome Barbosa e foi usado para outro match). Match por
--     primeiro nome só, sem confirmação de sobrenome — revisar se aparecer
--     inconsistência.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Eduarda Fabri (0a0f3aca-6c14-4115-95d4-0d15486ce9d0) — gestora
UPDATE public.colaboradores SET gestor_id = '0a0f3aca-6c14-4115-95d4-0d15486ce9d0'
WHERE id = '3a6a944b-c3db-41cf-8e23-4eb6ad824e58'; -- Marina -> Marina Casseb Ferraz Saavedra Dias

-- Paulo Vitor / "Paulo Vítor" (599c10ec-bf8a-46e2-9fab-4364c52ce454) — gestor
UPDATE public.colaboradores SET gestor_id = '599c10ec-bf8a-46e2-9fab-4364c52ce454'
WHERE id = '3a63a756-5853-4991-9d0f-f99bb217485b'; -- Cristina -> Cristina Dos Santos Tiago
UPDATE public.colaboradores SET gestor_id = '599c10ec-bf8a-46e2-9fab-4364c52ce454'
WHERE id = '1664cb66-1158-44bb-9c8b-e2574a62c041'; -- Alice -> Alice Tavares

-- Louise Fontel (064adc33-ebaa-4087-84b6-6fdbc02f3aba) — gestora
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '14aa0a2d-8085-45c0-8cdb-c33435d80583'; -- Flávia -> Flavia Araujo
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = 'a7e7426c-f297-47ce-b92b-39c284719bdc'; -- Adriana de Jesus -> Adriana De Jesus Rocha
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = 'ee9fafd1-9722-4953-8645-cc5f49d0fab7'; -- Maria Eduarda Barbosa
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '4a4d8825-edc4-44eb-b471-8033a336aaf6'; -- Jullya -> Jullya Evelyn Alves Branco
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '70777db8-a739-4fb2-bc6e-00480b6daab2'; -- Raquel -> Raquel Dos Santos Avelino (gestora de sua própria equipe abaixo)
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '302026b9-250d-45e4-accf-66f549a1817a'; -- Samuel
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '5df7c4d2-503a-40b7-81ed-5a05a27fa6c2'; -- Marcos -> Marcos Junior
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '3238de0f-c0c8-4a6d-b878-d73f1f153819'; -- Mateus
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = 'd397d5dd-98d5-4234-8a93-9deea8649233'; -- Lucas -> Lucas Moreira (status desligado — ver observação acima; gestor de sua própria equipe abaixo)
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '6f916a1b-f6d2-497b-8604-bbf7ae98e29c'; -- Gabriel Carneiro -> Gabriel Silva Carneiro
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = 'be1d9e49-406d-469b-915e-95930dae4f92'; -- Gabriel Queiroz
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = 'a5db6e18-d9a1-498a-890d-5a94dc0bbbeb'; -- João Madeiro -> João Dos Santos Madeiro
UPDATE public.colaboradores SET gestor_id = '064adc33-ebaa-4087-84b6-6fdbc02f3aba'
WHERE id = '5c3f1a37-6759-4eb6-aa0b-5bcecfcaa62f'; -- Vinicius -> Vinicius Canedo

-- Raquel Dos Santos Avelino (70777db8-a739-4fb2-bc6e-00480b6daab2) — gestora, sob Louise Fontel
UPDATE public.colaboradores SET gestor_id = '70777db8-a739-4fb2-bc6e-00480b6daab2'
WHERE id = 'eeed9572-665a-4875-af90-65ab5cdc9d2d'; -- Maria Eduarda Fonseca -> "Maria Eduarda" (ver observação acima)
UPDATE public.colaboradores SET gestor_id = '70777db8-a739-4fb2-bc6e-00480b6daab2'
WHERE id = '974e56fd-8e1e-438d-ae3a-9557f2a7813d'; -- Rívia -> Rívia Freire

-- Suane / "Suane Batista De Oliveira" (b27a9725-4091-457a-af9d-2773fc01415d) — gestora
UPDATE public.colaboradores SET gestor_id = 'b27a9725-4091-457a-af9d-2773fc01415d'
WHERE id = '65ca68d7-52ac-4d23-ab11-9bd3fdb85732'; -- Márcia -> Marcia Felix
UPDATE public.colaboradores SET gestor_id = 'b27a9725-4091-457a-af9d-2773fc01415d'
WHERE id = '74728260-7014-412f-936f-2d7217af6575'; -- João Pedro -> João Pedro Dias

-- Lucas Moreira (d397d5dd-98d5-4234-8a93-9deea8649233) — gestor, sob Louise Fontel
-- (sem UPDATEs de subordinado aqui: Isaura e Lina, sua equipe na lista do RH, não têm colaborador cadastrado em produção)

-- Corrige duplicidade de conta: religa ao user_profile ativo e reativa o status
-- (ver observação acima).
UPDATE public.colaboradores
SET user_profile_id = '7dda5483-b642-4cb2-a9e4-7f337d786aeb', status = 'ativo'
WHERE id = 'd397d5dd-98d5-4234-8a93-9deea8649233';
