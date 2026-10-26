-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — unificação das tabelas associadas duplicadas
-- Migration: 20261026130000_custo_tabelas_associadas_unificacao.sql
--
-- Spec: .scratch/controle-custos-tabela-associada/spec.md (ticket 06).
-- GERADA por supabase/scripts/unificar-tabelas-associadas.ts a partir do mapa
-- e das escolhas de preço do faturamento (ticket 05) — não editar à mão;
-- se as linhas mudarem, a conferência inicial aborta e é preciso gerar de novo.
--
-- Mapa de junção:
--   "Particular": "PARTICULAR", "part", "PART", "" → "Particular"
--
-- 6 linha(s) apontadas para o destino, 1 removida(s),
-- 1 exclusão(ões) e 0 valor(es) personalizado(s) passados
-- para a linha que fica, 0 escolha(s) de preço.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. O banco ainda tem o que o plano leu
CREATE TEMP TABLE _unif_tabelas (fonte_pagadora TEXT, nome TEXT) ON COMMIT DROP;
INSERT INTO _unif_tabelas VALUES
  ('Particular', 'Particular'),
  ('Particular', 'PARTICULAR'),
  ('Particular', 'part'),
  ('Particular', 'PART'),
  ('Particular', '');

CREATE TEMP TABLE _unif_linhas (
  id UUID, fonte_pagadora TEXT, tabela_associada TEXT, tuss TEXT, exame_id UUID,
  valor NUMERIC, atendido BOOLEAN, elegivel_desconto_particular BOOLEAN
) ON COMMIT DROP;
INSERT INTO _unif_linhas VALUES
  ('bef24389-64f1-47d9-9876-33ebb7bf09a7'::uuid, 'Particular', 'Particular', '40305112', NULL::uuid, 592::numeric, true, false),
  ('044cdd76-1507-4750-bf3f-c40fd5fda519'::uuid, 'Particular', 'Particular', '40311015', NULL::uuid, 197::numeric, true, false),
  ('f3d514d0-9208-4d3f-8022-d394746d6027'::uuid, 'Particular', 'Particular', '40322270', NULL::uuid, 48.7::numeric, true, false),
  ('e52f06d6-6320-4390-8f52-6e7314daaa1d'::uuid, 'Particular', 'Particular', '40313042', NULL::uuid, 57::numeric, true, false),
  ('e9f9f5e0-483d-48e2-9567-7ec3d7101c0a'::uuid, 'Particular', 'Particular', '40301109', NULL::uuid, 28::numeric, true, false),
  ('7fb84131-1b29-4454-9294-d2ff131bdf67'::uuid, 'Particular', 'Particular', '40313301', NULL::uuid, 545::numeric, true, false),
  ('16e7703f-bf9e-48f0-b40c-c0b25aad4626'::uuid, 'Particular', 'Particular', '40316122', NULL::uuid, 107::numeric, true, false),
  ('64181ec3-ab1b-447b-8068-a0053c0d5ac5'::uuid, 'Particular', 'Particular', '40301478', NULL::uuid, 111::numeric, true, false),
  ('fa2dda74-a065-4899-868b-32e13297b69c'::uuid, 'Particular', 'Particular', '40306631', NULL::uuid, 82::numeric, true, false),
  ('70877ceb-96cc-44fe-a6c7-5bf15f522b31'::uuid, 'Particular', 'Particular', '40306640', NULL::uuid, 91::numeric, true, false),
  ('eafcab18-7525-4f9e-9460-48cea23c6514'::uuid, 'Particular', 'Particular', '40313107', NULL::uuid, 124::numeric, true, false),
  ('f1da3a23-5b98-4167-95ca-f268765b2d2a'::uuid, 'Particular', 'Particular', '40301486', NULL::uuid, 99::numeric, true, false),
  ('5966f9fc-b540-4a46-824c-b51a03081e74'::uuid, 'Particular', 'Particular', '40316807', NULL::uuid, 6086::numeric, true, false),
  ('f083dbe0-c4db-400c-be83-a241d294ca7a'::uuid, 'Particular', 'Particular', '40308650', NULL::uuid, 189::numeric, true, false),
  ('ebdf751c-a7a8-45d6-b9b8-53b0c2ea18e1'::uuid, 'Particular', 'Particular', '40302776', NULL::uuid, 370::numeric, true, false),
  ('fcc33162-e6c7-481a-8fc1-05e545fad7f4'::uuid, 'Particular', 'Particular', '40306860', NULL::uuid, 34::numeric, true, false),
  ('5caeff57-f86c-4ab0-94ec-afeda254d1e6'::uuid, 'Particular', 'Particular', '40304175', NULL::uuid, 144::numeric, true, false),
  ('7e93a7ea-345c-449f-b2f1-a0a1808653a0'::uuid, 'Particular', 'Particular', '40301834', NULL::uuid, 88::numeric, true, false),
  ('005d3902-8860-4462-b0ba-189ef74b7f5d'::uuid, 'Particular', 'Particular', '40304272', NULL::uuid, 65::numeric, true, false),
  ('8c068d03-608c-4e41-901e-3a308125d715'::uuid, 'Particular', 'Particular', '40301885', NULL::uuid, 28::numeric, true, false),
  ('523a2841-971d-4566-bf9d-03c46bc5b59a'::uuid, 'Particular', 'Particular', '40308685', NULL::uuid, 1193::numeric, true, false),
  ('63f33e0b-d278-407b-9d6c-997d300c90d8'::uuid, 'Particular', 'Particular', '40321878', NULL::uuid, 499::numeric, true, false),
  ('f19238ae-078e-4b26-aa49-2299c4388043'::uuid, 'Particular', 'Particular', '40302741', NULL::uuid, 599::numeric, true, false),
  ('5574c90b-a4a4-489a-974b-fbd9e01936ae'::uuid, 'Particular', 'Particular', '40305422', NULL::uuid, 163::numeric, true, false),
  ('654040dc-4491-4706-adc7-9ef51a346485'::uuid, 'Particular', 'Particular', '40302210', NULL::uuid, 95::numeric, true, false),
  ('16388f98-a50b-4177-a9ff-3baab78cb043'::uuid, 'Particular', 'Particular', '40302229', NULL::uuid, 57::numeric, true, false),
  ('b1bbcaa6-d4d5-4319-8673-4f20a5c6d65d'::uuid, 'Particular', 'Particular', '40305775', NULL::uuid, 65::numeric, true, false),
  ('4a2879d5-f8ed-4112-bab9-8f50b4739272'::uuid, 'Particular', 'Particular', '40307743', NULL::uuid, 30::numeric, true, false),
  ('e473193a-1665-48fe-8a24-1371d7df3cf5'::uuid, 'Particular', 'Particular', '40307760', NULL::uuid, 36::numeric, true, false),
  ('fb098446-df3a-4784-9c6b-b307b6ff517e'::uuid, 'Particular', 'Particular', '40308286', NULL::uuid, 54::numeric, true, false),
  ('6171ede4-cbb8-4897-9c29-f2f29d17f01e'::uuid, 'Particular', 'Particular', '40306127', NULL::uuid, 95::numeric, true, false),
  ('b1ac3422-eeca-4e11-a105-9b9cf70fa096'::uuid, 'Particular', 'Particular', '40307891', NULL::uuid, 176::numeric, true, false),
  ('7b70fe13-02af-4eea-b8a9-529a5243dd50'::uuid, 'Particular', 'Particular', '40324796', NULL::uuid, 162::numeric, true, false),
  ('4ea4489d-5ec1-4bab-96fb-1195f9116057'::uuid, 'Particular', 'Particular', '40301419', NULL::uuid, 52::numeric, true, true),
  ('c750128e-5c52-4b2a-81f3-6d3a0188081d'::uuid, 'Particular', 'Particular', '40301648', NULL::uuid, 44::numeric, true, true),
  ('f4438e29-326f-4da2-8a69-88da8655786c'::uuid, 'Particular', 'Particular', '40316211', NULL::uuid, 45::numeric, true, true),
  ('9d1216b8-95c7-4edb-b796-3891e8fd8f40'::uuid, 'Particular', 'Particular', '40316220', NULL::uuid, 78::numeric, true, true),
  ('f3faee3c-4b3c-434d-b366-30345e8f70ea'::uuid, 'Particular', 'Particular', '40311210', NULL::uuid, 26::numeric, true, true),
  ('5138ca9a-486e-4d9f-975e-31f0334154f2'::uuid, 'Particular', 'Particular', '40316246', NULL::uuid, 78::numeric, true, true),
  ('194fde60-f48a-4f81-8050-b2d821a09293'::uuid, 'Particular', 'Particular', '', 'e1715fa4-724a-45d3-9914-e7fb88c37b27'::uuid, 350::numeric, true, false),
  ('90cdf612-ee97-4ca1-9c86-e2e5c54a3f6a'::uuid, 'Particular', 'Particular', '', '0633bfa7-fca4-4c95-b2ee-bfee0e814e9d'::uuid, 2490::numeric, true, false),
  ('c6e7cc94-7b66-4e31-a014-03f18ecdd5ab'::uuid, 'Particular', 'Particular', '', '918586dd-441c-48a2-942f-f32b8481fd0a'::uuid, 3196::numeric, true, false),
  ('52ede91f-9dd6-4b10-b285-6ac3286f3378'::uuid, 'Particular', 'Particular', 'biopsia s', NULL::uuid, 1000::numeric, true, false),
  ('c6e74682-156c-4dc9-8a93-2602780de5b8'::uuid, 'Particular', 'Particular', '40311058', NULL::uuid, 205::numeric, true, false),
  ('26ee4c5e-4271-456d-89a1-6947f18ec104'::uuid, 'Particular', 'Particular', '40316017', NULL::uuid, 105::numeric, true, false),
  ('1abb25e7-8855-418e-933a-7acc920c196c'::uuid, 'Particular', 'Particular', '40305090', NULL::uuid, 1300::numeric, true, false),
  ('faae22f1-8434-4e60-8210-1d9d25dc5e0a'::uuid, 'Particular', 'Particular', '40301028', NULL::uuid, 400::numeric, true, false),
  ('09e56581-33dd-44c2-88a9-48dad0513665'::uuid, 'Particular', 'Particular', '40313069', NULL::uuid, 61::numeric, true, false),
  ('4b1886cd-f3d3-4fdf-9a84-4fcc4add1cb8'::uuid, 'Particular', 'Particular', '40316793', NULL::uuid, 105::numeric, true, false),
  ('3d1481dc-5079-4890-81aa-2a3e7f3c28bc'::uuid, 'Particular', 'Particular', '40301168', NULL::uuid, 113::numeric, true, false),
  ('52867d6d-685e-42d1-80ac-bb7eec95f190'::uuid, 'Particular', 'Particular', '40316041', NULL::uuid, 157::numeric, true, false),
  ('59b25e95-f011-4ac5-883f-1f851ab070fe'::uuid, 'Particular', 'Particular', '40301222', NULL::uuid, 24::numeric, true, false),
  ('b8af7865-dd0a-4a8e-9f43-3e56d09cea7b'::uuid, 'Particular', 'Particular', '40301230', NULL::uuid, 21::numeric, true, false),
  ('7f99cc3e-8181-4df1-9a26-1e0bbb2e58f8'::uuid, 'Particular', 'Particular', '40316050', NULL::uuid, 131::numeric, true, false),
  ('666dd7db-4112-4461-bf1a-3b8c0f7ee6e2'::uuid, 'Particular', 'Particular', '40301249', NULL::uuid, 78::numeric, true, false),
  ('ae4bb492-21b7-4428-93d6-4d8114032130'::uuid, 'Particular', 'Particular', '40301257', NULL::uuid, 51::numeric, true, false),
  ('51e25e6a-da59-4c6d-a5e6-167ba8e4a065'::uuid, 'Particular', 'Particular', '40316068', NULL::uuid, 78::numeric, true, false),
  ('f9585f3a-a205-4343-8fec-a5bdd77ec183'::uuid, 'Particular', 'Particular', '40301273', NULL::uuid, 130::numeric, true, false),
  ('6d4776ee-70a5-473e-8060-b8f48371bc76'::uuid, 'Particular', 'Particular', '40316076', NULL::uuid, 132::numeric, true, false),
  ('97582661-de67-4454-be81-bc2a74415cd1'::uuid, 'Particular', 'Particular', '40306402', NULL::uuid, 169.14::numeric, true, false),
  ('91ddb1c2-d038-4b53-a5a6-f1b12ca99b37'::uuid, 'Particular', 'Particular', '40306097', NULL::uuid, 105.8::numeric, true, false),
  ('484bd4a1-f54a-4d09-9e9b-16c82940bd19'::uuid, 'Particular', 'Particular', '40306992', NULL::uuid, 78::numeric, true, false),
  ('9a8d446e-bc07-4945-b19e-b56701d401ec'::uuid, 'Particular', 'Particular', '40305341', NULL::uuid, 325.75::numeric, true, false),
  ('a45e28c0-856e-41fa-98a3-868a2a7faccc'::uuid, 'Particular', 'Particular', '40310426', NULL::uuid, 113::numeric, true, false),
  ('b44cd73c-95b8-4eab-b34d-c5a681508df8'::uuid, 'Particular', 'Particular', '40304019', NULL::uuid, 80::numeric, true, false),
  ('30f943b9-4593-4319-bbee-9155a09dfcac'::uuid, 'Particular', 'Particular', '40324176', NULL::uuid, 435::numeric, true, false),
  ('e6529b78-7f7b-4d33-8eff-829c9fce7cee'::uuid, 'Particular', 'Particular', '40308553', NULL::uuid, 177::numeric, true, false),
  ('0b21b344-b16f-47d9-b2c8-94802b7fdfc1'::uuid, 'Particular', 'Particular', '40304191', NULL::uuid, 600::numeric, true, false),
  ('41b59011-0830-4fb1-826b-890263714957'::uuid, 'Particular', 'Particular', '40304060', NULL::uuid, 286::numeric, true, false),
  ('f403fd13-892c-487c-bb80-b5b8880d43fe'::uuid, 'Particular', 'Particular', '40301354', NULL::uuid, 86::numeric, true, false),
  ('91c2f41f-8da0-4b45-ae32-c5e9a5402621'::uuid, 'Particular', 'Particular', '40301362', NULL::uuid, 86::numeric, true, false),
  ('0835bdf1-70f0-46a6-8c25-e0087a8a03d5'::uuid, 'Particular', 'Particular', '40316661', NULL::uuid, 1600::numeric, true, false),
  ('84187f16-4e0e-46eb-be48-cd23a0f7f133'::uuid, 'Particular', 'Particular', '40306445', NULL::uuid, 38::numeric, true, false),
  ('a5433053-d204-40b0-8be0-903b18ad7f44'::uuid, 'Particular', 'Particular', '40310051', NULL::uuid, 50::numeric, true, false),
  ('4d0d6219-a16f-4a7b-b79c-cfae6a112f84'::uuid, 'Particular', 'Particular', '40310060', NULL::uuid, 75::numeric, true, false),
  ('ba669394-87e3-41d7-b7e2-e923add3da25'::uuid, 'Particular', 'Particular', '40305767', NULL::uuid, 45::numeric, true, false),
  ('c9be6ac3-e5f9-46f6-a103-d046b0c3302c'::uuid, 'Particular', 'Particular', '40308898', NULL::uuid, 1121::numeric, true, false),
  ('d8d42793-27b0-4713-abf4-17765c383983'::uuid, 'Particular', 'Particular', '40306470', NULL::uuid, 187::numeric, true, false),
  ('f02d3dc7-df2c-4564-9130-66a065aa2fc5'::uuid, 'Particular', 'Particular', '40316165', NULL::uuid, 184::numeric, true, false),
  ('528c9c58-49b0-4274-834d-4109029b949a'::uuid, 'Particular', 'Particular', '40303330', NULL::uuid, 276::numeric, true, false),
  ('2756ce10-9a6e-44aa-adfe-ef953f6b0575'::uuid, 'Particular', 'Particular', '40301555', NULL::uuid, 21::numeric, true, false),
  ('86a21c55-f41e-4d3d-9fca-548e03804ea4'::uuid, 'Particular', 'Particular', '40306135', NULL::uuid, 86::numeric, true, false),
  ('ce9bf4f0-6619-4242-bd7c-74626221eee4'::uuid, 'Particular', 'Particular', '40306143', NULL::uuid, 86::numeric, true, false),
  ('2c1700b2-5184-4204-bd0f-caa4480714b4'::uuid, 'Particular', 'Particular', '40306151', NULL::uuid, 86::numeric, true, false),
  ('bb6f7076-562d-4804-964b-b91aaa14158b'::uuid, 'Particular', 'Particular', '49901010', NULL::uuid, 309::numeric, true, false),
  ('096b0e94-3941-4398-ac81-d564ac651158'::uuid, 'Particular', 'Particular', '40307433', NULL::uuid, 270::numeric, true, false),
  ('0e677062-868e-4199-a3c5-b1e3625a3a67'::uuid, 'Particular', 'Particular', '40305449', NULL::uuid, 1123.5::numeric, true, false),
  ('286b487c-d150-4470-b995-ea7e0ee53d30'::uuid, 'Particular', 'Particular', '40323781', NULL::uuid, 775.75::numeric, true, false),
  ('f23ee9cd-8ec0-4f68-92fe-6f0416d290ed'::uuid, 'Particular', 'Particular', '40306259', NULL::uuid, 278::numeric, true, false),
  ('e06a9293-323e-4136-98c7-218943003da4'::uuid, 'Particular', 'Particular', '40601269', NULL::uuid, 250::numeric, true, false),
  ('4d70e3c2-7bdd-4a63-a407-a3acb7d22eb6'::uuid, 'Particular', 'Particular', '40306062', NULL::uuid, 86::numeric, true, false),
  ('3817d4e1-dc46-48b0-949e-195cba8c697a'::uuid, 'Particular', 'Particular', '40306887', NULL::uuid, 440::numeric, true, false),
  ('e416c5a7-8bc7-4b24-b10d-6828d69c4ade'::uuid, 'Particular', 'Particular', '40306305', NULL::uuid, 131::numeric, true, false),
  ('a857a86a-06eb-4090-903b-cc2d174fafbd'::uuid, 'Particular', 'Particular', '40306313', NULL::uuid, 69::numeric, true, false),
  ('3c727cbb-25db-4a90-86e3-9df248f1fa0d'::uuid, 'Particular', 'Particular', '40306208', NULL::uuid, 145.68::numeric, true, false),
  ('e81b6fc5-3cad-41b3-92f1-b12effb695d5'::uuid, 'Particular', 'Particular', '40316092', NULL::uuid, 80.6::numeric, true, false),
  ('dbcdb776-ae51-4eaa-9b06-141f0679e5ce'::uuid, 'Particular', 'Particular', '40316432', NULL::uuid, 163::numeric, true, false),
  ('457f4111-a2d1-4b34-97bd-2481380d7c5e'::uuid, 'Particular', 'Particular', '40316170', NULL::uuid, 250::numeric, true, false),
  ('05291b04-cbd8-405b-a8d7-0c8ae3af5037'::uuid, 'Particular', 'Particular', '40310230', NULL::uuid, 45.45::numeric, true, false),
  ('4602a329-90f6-446c-968e-c84a71a9237c'::uuid, 'Particular', 'Particular', '40316378', NULL::uuid, 89::numeric, true, false),
  ('a63ece5e-009c-4a03-b323-d84b768d1907'::uuid, 'Particular', 'Particular', '40319040', NULL::uuid, 767.79::numeric, true, false),
  ('6a6004ed-47ce-4c63-9d3b-e21938fd1c31'::uuid, 'Particular', 'Particular', '40301427', NULL::uuid, 21::numeric, true, false),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, 'Particular', 'Particular', '40601293', NULL::uuid, 180::numeric, true, false),
  ('d096aa0d-f44e-43df-861e-aa877b805f33'::uuid, 'Particular', 'Particular', '40501051', NULL::uuid, 890::numeric, true, false),
  ('7f25688a-0cac-47d7-addd-04fe3ef3b4fa'::uuid, 'Particular', 'Particular', '40308561', NULL::uuid, 177::numeric, true, false),
  ('0221f777-f7c9-4e37-81bd-e844c984b5cb'::uuid, 'Particular', 'Particular', '40501221', NULL::uuid, 3822.77::numeric, true, false),
  ('77b443d8-5f73-4cb9-8817-26157af9e799'::uuid, 'Particular', 'Particular', '40322424', NULL::uuid, 187::numeric, true, false),
  ('51b4dc45-9f1c-47a8-a28e-306740d2c350'::uuid, 'Particular', 'Particular', '40601129', NULL::uuid, 175::numeric, true, false),
  ('834bb403-3ff5-4c05-af2c-398e3fd67374'::uuid, 'Particular', 'Particular', '40601250', NULL::uuid, 250::numeric, true, false),
  ('a9125aae-e309-47aa-baab-203dd5f33261'::uuid, 'Particular', 'Particular', '40601323', NULL::uuid, 99::numeric, true, false),
  ('399a227f-94a6-43de-a1f2-aa9e85ad14a6'::uuid, 'Particular', 'Particular', '40301559', NULL::uuid, 23::numeric, true, false),
  ('7f8fd7cb-85fc-4a78-bbb4-d8d88f2a9214'::uuid, 'Particular', 'Particular', '40304922', NULL::uuid, 59::numeric, true, false),
  ('07681772-2883-4b84-a2f3-8e6bc21fd61e'::uuid, 'Particular', 'Particular', '40301575', NULL::uuid, 199::numeric, true, false),
  ('6811474c-329d-48f4-8799-442c803efccd'::uuid, 'Particular', 'Particular', '40319067', NULL::uuid, 231::numeric, true, false),
  ('6585d9d5-5cdb-4890-bb8d-00b3a124a0fd'::uuid, 'Particular', 'Particular', '40304574', NULL::uuid, 2471.42::numeric, true, false),
  ('856f0810-18c0-45ad-b9f2-efc446e977f9'::uuid, 'Particular', 'Particular', '40301583', NULL::uuid, 23::numeric, true, false),
  ('89a50926-9e75-47a2-b752-d030c0517466'::uuid, 'Particular', 'Particular', '40301591', NULL::uuid, 40::numeric, true, false),
  ('b4bf4cdf-b616-40c3-b22b-f5eebd06530b'::uuid, 'Particular', 'Particular', '40301605', NULL::uuid, 21::numeric, true, false),
  ('dbf02c0f-d652-4061-bc5f-d803d96171e2'::uuid, 'Particular', 'Particular', '40302695', NULL::uuid, 19::numeric, true, false),
  ('67429495-eeb3-43f2-92b6-be29eeb54911'::uuid, 'Particular', 'Particular', '40306747', NULL::uuid, 56::numeric, true, false),
  ('200b59fe-c2b5-4deb-ba1c-d220406b759b'::uuid, 'Particular', 'Particular', '40306704', NULL::uuid, 40::numeric, true, false),
  ('b7886bb4-0dd1-487a-97e5-fd14d81311d2'::uuid, 'Particular', 'Particular', '40316181', NULL::uuid, 220::numeric, true, false),
  ('669394dd-d485-43ee-9ee0-07fee72b7c98'::uuid, 'Particular', 'Particular', '40304108', NULL::uuid, 45::numeric, true, false),
  ('71198bf7-e8bc-4873-9c2d-a9abc45b9086'::uuid, 'Particular', 'Particular', '40304884', NULL::uuid, 99::numeric, true, false),
  ('412a843e-a8cc-4e16-a868-934490eb2329'::uuid, 'Particular', 'Particular', '40310183', NULL::uuid, 61::numeric, true, false),
  ('d13171cf-a8cd-46c6-8c73-6862ae9375d6'::uuid, 'Particular', 'Particular', '40303039', NULL::uuid, 119::numeric, true, false),
  ('40759972-d3a1-4e2c-88cc-6cfbfeb70f5f'::uuid, 'Particular', 'Particular', '40305210', NULL::uuid, 145::numeric, true, false),
  ('7a9db984-8092-4d8d-a60b-04c8824e0ba6'::uuid, 'Particular', 'Particular', '40301508', NULL::uuid, 42::numeric, true, false),
  ('983ca96d-d6dd-4ba3-9a0a-e6f7c556431f'::uuid, 'Particular', 'Particular', '40301656', NULL::uuid, 42::numeric, true, false),
  ('aa1ce35d-5df9-48e2-8926-65f12134cd7c'::uuid, 'Particular', 'Particular', '40308014', NULL::uuid, 40::numeric, true, false),
  ('1d614d22-0d8b-4408-82f2-8b6948337acb'::uuid, 'Particular', 'Particular', '40313310', NULL::uuid, 139::numeric, true, false),
  ('20da94e7-fe95-423f-a8d6-652790cc9692'::uuid, 'Particular', 'Particular', '40310140', NULL::uuid, 150::numeric, true, false),
  ('3d25a03c-c20a-4b61-b1ef-115b54846998'::uuid, 'Particular', 'Particular', '40310558', NULL::uuid, 150::numeric, true, false),
  ('7a7269fd-9233-4b30-ab8e-105584cc0101'::uuid, 'Particular', 'Particular', '40316000', NULL::uuid, 2200::numeric, true, false),
  ('c9c962ef-cee2-4e52-94ae-4a05ccab1267'::uuid, 'Particular', 'Particular', '40324192', NULL::uuid, 90::numeric, true, false),
  ('c6717d43-c52f-4c8a-96d3-d454bd0903a7'::uuid, 'Particular', 'Particular', '40306798', NULL::uuid, 90::numeric, true, false),
  ('a0105f2d-c433-48ee-8eca-c1819482380e'::uuid, 'Particular', 'Particular', '40301699', NULL::uuid, 396::numeric, true, false),
  ('4300bacf-9429-4fb8-b2a3-522434de2d30'::uuid, 'Particular', 'Particular', '40314359', NULL::uuid, 450.16::numeric, true, false),
  ('69461e01-5693-44d0-80f8-f6fe2ac0028f'::uuid, 'Particular', 'Particular', '40313140', NULL::uuid, 559.76::numeric, true, false),
  ('157ec6c5-67d0-4487-b228-66849025fc32'::uuid, 'Particular', 'Particular', '40304906', NULL::uuid, 180::numeric, true, false),
  ('27ee57d4-3491-499c-8f78-0b0a7f962106'::uuid, 'Particular', 'Particular', '40303284', NULL::uuid, 1964.58::numeric, true, false),
  ('3611bfd8-b86f-450f-9574-7569eab9cfed'::uuid, 'Particular', 'Particular', '40304353', NULL::uuid, 65::numeric, true, false),
  ('8fcace9a-447f-45b9-b0da-e93d2c8626db'::uuid, 'Particular', 'Particular', '40301788', NULL::uuid, 51::numeric, true, false),
  ('7aaeef81-eacf-4ce2-96ba-b856aca58448'::uuid, 'Particular', 'Particular', '40301761', NULL::uuid, 65::numeric, true, false),
  ('4781bce3-debb-4b90-b804-00a8c42ec672'::uuid, 'Particular', 'Particular', '40302717', NULL::uuid, 65::numeric, true, false),
  ('aa6a2533-c0c4-4ca9-a6a4-30bcbda96a7b'::uuid, 'Particular', 'Particular', '40306260', NULL::uuid, 153::numeric, true, false),
  ('601302e3-2f0a-4477-b989-48a0d4f6873e'::uuid, 'Particular', 'Particular', '40307573', NULL::uuid, 36.5::numeric, true, false),
  ('27b78e7d-998d-43a2-9e13-c40255f46ef6'::uuid, 'Particular', 'Particular', '40307581', NULL::uuid, 88::numeric, true, false),
  ('19e482c1-3c7f-42ed-91d6-67fb0d7eb65a'::uuid, 'Particular', 'Particular', '40307565', NULL::uuid, 82::numeric, true, false),
  ('51058a24-ab8b-4cf6-9378-21beb5f067bb'::uuid, 'Particular', 'Particular', '40305295', NULL::uuid, 168::numeric, true, false),
  ('6d95de23-5680-409e-ba4a-4aa355080d25'::uuid, 'Particular', 'Particular', '40307719', NULL::uuid, 130::numeric, true, false),
  ('96096895-6b21-469a-8ff5-3f9631418db9'::uuid, 'Particular', 'Particular', '40316254', NULL::uuid, 109::numeric, true, false),
  ('106143c6-f1a2-4057-8c2a-7aae353d9a2a'::uuid, 'Particular', 'Particular', '40316262', NULL::uuid, 103::numeric, true, false),
  ('24b50a17-e671-43a7-a3a9-de5afb6a4034'::uuid, 'Particular', 'Particular', '40712046', NULL::uuid, 504::numeric, true, false),
  ('0c8bbf11-ca3d-4091-8f0f-4bfd517971cd'::uuid, 'Particular', 'Particular', '40503402', NULL::uuid, 315::numeric, true, false),
  ('82ac2e75-e339-45f3-ae7f-fc19cb81d589'::uuid, 'Particular', 'Particular', '40322319', NULL::uuid, 638.47::numeric, true, false),
  ('28a5ec1f-fee1-4e04-b6ca-a281c97bcb0f'::uuid, 'Particular', 'Particular', '41301188', NULL::uuid, 42::numeric, true, false),
  ('e147a0e2-ed34-48d0-90d2-acbe2e9fed92'::uuid, 'Particular', 'Particular', '41301226', NULL::uuid, 75::numeric, true, false),
  ('03ad7172-1c14-46f2-be8e-ace31aa09c5b'::uuid, 'Particular', 'Particular', '40306615', NULL::uuid, 61::numeric, true, false),
  ('a1354fbf-7333-4001-9070-c6f10bb21a1a'::uuid, 'Particular', 'Particular', '40601137', NULL::uuid, 75::numeric, true, false),
  ('31bdff98-9a89-4cfe-aa62-e4a93c033d44'::uuid, 'Particular', 'Particular', '40306666', NULL::uuid, 78::numeric, true, false),
  ('547f5356-76bf-4121-921f-1fe7f1a2146b'::uuid, 'Particular', 'Particular', '40306674', NULL::uuid, 86::numeric, true, false),
  ('823f4212-5f4e-429c-a7c7-920317fe9c89'::uuid, 'Particular', 'Particular', '40301567', NULL::uuid, 61::numeric, true, false),
  ('fca5e665-31c7-4aa5-bb30-bd4b213b3170'::uuid, 'Particular', 'Particular', '40310124', NULL::uuid, 113::numeric, true, false),
  ('13eea369-1694-407e-9254-27d12b6d17d7'::uuid, 'Particular', 'Particular', '40310213', NULL::uuid, 113::numeric, true, false),
  ('a1fbcda3-73cb-4f5b-a687-0e5ac4fd8951'::uuid, 'Particular', 'Particular', '40301958', NULL::uuid, 28::numeric, true, false),
  ('627ad114-25da-4860-b6ad-03dbd1bcf3e0'::uuid, 'Particular', 'Particular', '40316203', NULL::uuid, 86::numeric, true, false),
  ('1ba5a1f5-d28c-46f3-8218-a5929e06d7cf'::uuid, 'Particular', 'Particular', '40306321', NULL::uuid, 59::numeric, true, false),
  ('14bc831f-aa7b-44c7-bed1-4f962ecf9a37'::uuid, 'Particular', 'Particular', '40302059', NULL::uuid, 69.98::numeric, true, false),
  ('3992c085-9c37-4d71-8456-8246a9e7f6cf'::uuid, 'Particular', 'Particular', '40304116', NULL::uuid, 163::numeric, true, false),
  ('7ebe6571-23f9-499e-b16b-040fb145cb68'::uuid, 'Particular', 'Particular', '40303055', NULL::uuid, 82::numeric, true, false),
  ('88189c09-a50b-439e-9401-4f9b3f4d9cb3'::uuid, 'Particular', 'Particular', '40304299', NULL::uuid, 39::numeric, true, false),
  ('d96d7b38-cea3-4f2c-a45e-21d9fc0abf7f'::uuid, 'Particular', 'Particular', '40306933', NULL::uuid, 78::numeric, true, false),
  ('879bd5ec-fbbe-4558-924c-c0c0aaf28ad0'::uuid, 'Particular', 'Particular', '40306941', NULL::uuid, 86::numeric, true, false),
  ('958498bf-316d-4ac8-8d1b-02ba046f7194'::uuid, 'Particular', 'Particular', '40306968', NULL::uuid, 69::numeric, true, false),
  ('23a419a9-e689-4d94-b115-5c0b0e04133a'::uuid, 'Particular', 'Particular', '40306984', NULL::uuid, 65::numeric, true, false),
  ('b55fe3ea-89a1-486b-a4a8-dbcbe1449bcf'::uuid, 'Particular', 'Particular', '40306976', NULL::uuid, 65::numeric, true, false),
  ('d66979a7-c968-4184-bf28-7765eb8fd9bd'::uuid, 'Particular', 'Particular', '40307018', NULL::uuid, 72::numeric, true, false),
  ('d0a5b3c6-880e-4666-b90d-952c3e69dce1'::uuid, 'Particular', 'Particular', '40314103', NULL::uuid, 678::numeric, true, false),
  ('f0f87ee9-aac5-4634-b8c3-009f3d31fa15'::uuid, 'Particular', 'Particular', '40307026', NULL::uuid, 132::numeric, true, false),
  ('b0ea6b0b-dee1-4d7f-a194-62a1182475b4'::uuid, 'Particular', 'Particular', '40303209', NULL::uuid, 273.42::numeric, true, false),
  ('3276aef1-c985-4a7b-ab84-b47729b7ab23'::uuid, 'Particular', 'Particular', '40304337', NULL::uuid, 21::numeric, true, false),
  ('ad97c0f9-2d81-49c4-9763-133bf166e883'::uuid, 'Particular', 'Particular', '40302075', NULL::uuid, 47::numeric, true, false),
  ('746e3867-54ed-4df3-a9c8-9bbda800be65'::uuid, 'Particular', 'Particular', '40304370', NULL::uuid, 34::numeric, true, false),
  ('7411712e-0cd0-4e82-abfe-826a9738f619'::uuid, 'Particular', 'Particular', '40306950', NULL::uuid, 69::numeric, true, false),
  ('44078fc6-9ff1-4a43-86ef-dd4990bbcb62'::uuid, 'Particular', 'Particular', '40324362', NULL::uuid, 231::numeric, true, false),
  ('56d89e1c-2d4b-40f1-aa6f-96e4b9518173'::uuid, 'Particular', 'Particular', '40324370', NULL::uuid, 292::numeric, true, false),
  ('80387e0a-90c2-4116-89d4-13848a746535'::uuid, 'Particular', 'Particular', '40312151', NULL::uuid, 76.8::numeric, true, false),
  ('cdc919db-a37f-4d85-bce1-4468345528e6'::uuid, 'Particular', 'Particular', '40307085', NULL::uuid, 65::numeric, true, false),
  ('fcfec162-1291-469f-acef-fc5db1725f52'::uuid, 'Particular', 'Particular', '40307093', NULL::uuid, 89::numeric, true, false),
  ('38e7d47f-15b4-402a-8ceb-6442859bfba7'::uuid, 'Particular', 'Particular', '40307131', NULL::uuid, 648.5::numeric, true, false),
  ('8085875d-bf52-4328-91c3-d96a2972fbbb'::uuid, 'Particular', 'Particular', '40314120', NULL::uuid, 118::numeric, true, false),
  ('4d189afe-90cc-421c-b9d5-4a2ac6bfadcd'::uuid, 'Particular', 'Particular', '40307182', NULL::uuid, 118::numeric, true, false),
  ('af56b7d7-cd4e-47ed-8458-2f1890cc1595'::uuid, 'Particular', 'Particular', '40316890', NULL::uuid, 400.5::numeric, true, false),
  ('8399ad81-bd5f-4060-a972-09ca512bfa8f'::uuid, 'Particular', 'Particular', '40314162', NULL::uuid, 766::numeric, true, false),
  ('f7daca5e-e0c6-4a46-9118-a12076ddd330'::uuid, 'Particular', 'Particular', '40307212', NULL::uuid, 113::numeric, true, false),
  ('f0e8cccd-2257-46c0-b03a-7fe91d544ec7'::uuid, 'Particular', 'Particular', '40307220', NULL::uuid, 65::numeric, true, false),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'Particular', 'Particular', '40307263', NULL::uuid, 200::numeric, true, false),
  ('1555b759-8c27-499f-9bb3-2965c2ff0a1d'::uuid, 'Particular', 'Particular', '40307255', NULL::uuid, 200::numeric, true, false),
  ('1e182269-c34b-413e-adbe-c4eccf120cd1'::uuid, 'Particular', 'Particular', '40307344', NULL::uuid, 149::numeric, true, false),
  ('d322ebd0-2b92-46c6-9f1c-24209339af8a'::uuid, 'Particular', 'Particular', '40307271', NULL::uuid, 116::numeric, true, false),
  ('14add7dc-4f6d-4403-b3b7-894b3f80d33c'::uuid, 'Particular', 'Particular', '40316440', NULL::uuid, 187::numeric, true, false),
  ('708aa9cb-9274-408c-8bfc-be7d99b6b26f'::uuid, 'Particular', 'Particular', '40305406', NULL::uuid, 149::numeric, true, false),
  ('b2d29c64-0d93-400a-a843-c9a1a2b83433'::uuid, 'Particular', 'Particular', '40324648', NULL::uuid, 700::numeric, true, false),
  ('fba37eca-724f-49cc-9cfd-eb55f46b216a'::uuid, 'Particular', 'Particular', '40302725', NULL::uuid, 2213::numeric, true, false),
  ('a216ef11-d290-40cf-9713-ffc7ab74c7e4'::uuid, 'Particular', 'Particular', '40316343', NULL::uuid, 149::numeric, true, false),
  ('728b2feb-406b-4a06-9d05-33ae63d56188'::uuid, 'Particular', 'Particular', '40324478', NULL::uuid, 65::numeric, true, false),
  ('10af32dc-11b3-40c8-a079-9cbaed8096af'::uuid, 'Particular', 'Particular', '40307280', NULL::uuid, 139::numeric, true, false),
  ('3e4ec7b3-db3b-4119-9e50-7c4531461459'::uuid, 'Particular', 'Particular', '40324087', NULL::uuid, 65::numeric, true, false),
  ('7649b4a0-2836-4fbd-b551-154baba938c8'::uuid, 'Particular', 'Particular', '40502082', NULL::uuid, 698.22::numeric, true, false),
  ('3d528da7-bd6c-4ebe-b51d-b529fcb04d5c'::uuid, 'Particular', 'Particular', '40321231', NULL::uuid, 40::numeric, true, false),
  ('c9d5ae84-819c-4e0b-8581-bdee36180448'::uuid, 'Particular', 'Particular', '40316351', NULL::uuid, 128::numeric, true, false),
  ('a8f45a73-aa1c-46ee-8857-cb2de2e68edd'::uuid, 'Particular', 'Particular', '40302041', NULL::uuid, 61::numeric, true, false),
  ('6a0b505e-c74c-4f1d-8f35-66533b09c86f'::uuid, 'Particular', 'Particular', '40321240', NULL::uuid, 430::numeric, true, false),
  ('10cc046c-c2f5-47ad-acdf-d7bc08b94077'::uuid, 'Particular', 'Particular', '40321258', NULL::uuid, 478::numeric, true, false),
  ('b70b7577-63a3-4180-9d68-9a1fdb119e3d'::uuid, 'Particular', 'Particular', '40321282', NULL::uuid, 501.13::numeric, true, false),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, 'Particular', 'Particular', '40601285', NULL::uuid, 340::numeric, true, false),
  ('a471cac3-a2be-4663-935d-1a509440c833'::uuid, 'Particular', 'Particular', '40002213', NULL::uuid, 149::numeric, true, false),
  ('f1cad0b2-5e25-47a6-b6c5-92b2ba17a870'::uuid, 'Particular', 'Particular', '40302237', NULL::uuid, 19::numeric, true, false),
  ('08acd7ae-c1b4-41d7-9b78-1cd951fffa5e'::uuid, 'Particular', 'Particular', '40321967', NULL::uuid, 69.54::numeric, true, false),
  ('e168c300-0416-4d42-b60e-bb35a02a1297'::uuid, 'Particular', 'Particular', '40321398', NULL::uuid, 770::numeric, true, false),
  ('7602856a-86b5-4914-8223-9b8ffed20bf0'::uuid, 'Particular', 'Particular', '40307522', NULL::uuid, 105::numeric, true, false),
  ('8994052d-03c0-49ca-b347-d3313542e4c1'::uuid, 'Particular', 'Particular', '40307530', NULL::uuid, 128::numeric, true, false),
  ('94e5b02e-6b3d-4440-91ef-488dba0787ac'::uuid, 'Particular', 'Particular', '40311171', NULL::uuid, 44::numeric, true, false),
  ('286494ac-4904-4718-a390-046a6c93a199'::uuid, 'Particular', 'Particular', '40311341', NULL::uuid, 91::numeric, true, false),
  ('afa569e8-49dd-4bad-bf60-92743ab844a1'::uuid, 'Particular', 'Particular', '40302245', NULL::uuid, 109::numeric, true, false),
  ('e40106dd-4e1b-437f-9b44-62bd235efd69'::uuid, 'Particular', 'Particular', '40503143', NULL::uuid, 3000::numeric, true, false),
  ('cdfc909a-3faf-4e4f-ae2f-2900609ccd0c'::uuid, 'Particular', 'Particular', '40314286', NULL::uuid, 560::numeric, true, false),
  ('27150ce3-18af-4c2d-8d09-960d5ccd09a4'::uuid, 'Particular', 'Particular', '40314057', NULL::uuid, 590::numeric, true, false),
  ('94136208-5fa8-4053-a77c-46d1959a8e14'::uuid, 'Particular', 'Particular', '40321436', NULL::uuid, 640::numeric, true, false),
  ('988da13c-2dca-41ac-9b5c-a33eb9f61bcc'::uuid, 'Particular', 'Particular', '40301125', NULL::uuid, 90::numeric, true, false),
  ('56792b3c-8576-42ac-8c12-0215609b1ffd'::uuid, 'Particular', 'Particular', '40304326', NULL::uuid, 3196::numeric, true, false),
  ('78161030-c0b4-4265-913a-da24f6f0d45f'::uuid, 'Particular', 'Particular', '40303110', NULL::uuid, 28::numeric, true, false),
  ('5dfe0f61-5f5e-44a4-b133-1cc97bf97886'::uuid, 'Particular', 'Particular', '40307611', NULL::uuid, 153::numeric, true, false),
  ('cffa1967-4fc8-4bdf-af87-182de09c51f4'::uuid, 'Particular', 'Particular', '40308383', NULL::uuid, 59::numeric, true, false),
  ('da0b16f5-bc17-4be7-8027-acbda5dd8da8'::uuid, 'Particular', 'Particular', '40314154', NULL::uuid, 420::numeric, true, false),
  ('2b9689b9-d832-46e0-952c-82ec1b6f965a'::uuid, 'Particular', 'Particular', '40601218', NULL::uuid, 499::numeric, true, false),
  ('2847e636-7050-47fd-a7d8-2ca9f1316a00'::uuid, 'Particular', 'Particular', '40601226', NULL::uuid, 299::numeric, true, false),
  ('cb4d6d74-a9c7-4ae3-922c-db005137e779'::uuid, 'Particular', 'Particular', '40316394', NULL::uuid, 54::numeric, true, false),
  ('2d042781-f747-4601-ad70-800110ec940f'::uuid, 'Particular', 'Particular', '40302890', NULL::uuid, 3635::numeric, true, false),
  ('45267d93-78ae-44c1-bedf-53b0fa2f6377'::uuid, 'Particular', 'Particular', '40302903', NULL::uuid, 3000::numeric, true, false),
  ('dd70a3ab-247e-4254-af11-c80c8f9f5eb5'::uuid, 'Particular', 'Particular', '40503780', NULL::uuid, 739.25::numeric, true, false),
  ('6848eeb5-b4ab-4ded-8488-474f9c1f1b17'::uuid, 'Particular', 'Particular', '40503372', NULL::uuid, 628.5::numeric, true, false),
  ('3b6fe67f-f6a4-446b-904d-8c0328b3d5a9'::uuid, 'Particular', 'Particular', '40503771', NULL::uuid, 1188.11::numeric, true, false),
  ('e931fdfb-1fa8-4c15-94fc-1fd0e1de8387'::uuid, 'Particular', 'Particular', '40317030', NULL::uuid, 1174.05::numeric, true, false),
  ('fe30c89d-56cc-4fa6-a4ed-19c76866d620'::uuid, 'Particular', 'Particular', '90010158', NULL::uuid, 1701.95::numeric, true, false),
  ('433dc080-399f-444c-bbb5-be83ee3aba19'::uuid, 'Particular', 'Particular', '40323706', NULL::uuid, 639::numeric, true, false),
  ('7e3408e8-5ad4-46f6-8511-b88075392252'::uuid, 'Particular', 'Particular', '40304507', NULL::uuid, 230::numeric, true, false),
  ('8f751980-367c-4efa-bed7-82f868e6d1b3'::uuid, 'Particular', 'Particular', '40304787', NULL::uuid, 626::numeric, true, false),
  ('f4423f7a-2de5-49ea-a274-5e94a7a74815'::uuid, 'Particular', 'Particular', '40314197', NULL::uuid, 726::numeric, true, false),
  ('492869bf-8b61-49ca-af94-5d9b709ccc5b'::uuid, 'Particular', 'Particular', '40311180', NULL::uuid, 24::numeric, true, false),
  ('537378de-e2cb-49d4-b276-79d3583a4cb5'::uuid, 'Particular', 'Particular', '40302377', NULL::uuid, 30::numeric, true, false),
  ('2116c217-6060-4840-983b-98b68e13fffd'::uuid, 'Particular', 'Particular', '40302385', NULL::uuid, 32::numeric, true, false),
  ('4a888045-3c80-4359-adaf-2f72f5670f62'::uuid, 'Particular', 'Particular', '40301218', NULL::uuid, 58::numeric, true, false),
  ('a3d01d78-4442-490f-aa31-956e0a75fb5f'::uuid, 'Particular', 'Particular', '40319326', NULL::uuid, 512::numeric, true, false),
  ('4654b06d-29ca-43b8-b929-5645cf20cb15'::uuid, 'Particular', 'Particular', '40305627', NULL::uuid, 50::numeric, true, false),
  ('793876fd-3def-44aa-96b4-f8e2d9254954'::uuid, 'Particular', 'Particular', '40316130', NULL::uuid, 113::numeric, true, false),
  ('f459c1b3-25a0-47ce-b277-e6f815cb1aaa'::uuid, 'Particular', 'Particular', '40316149', NULL::uuid, 113::numeric, true, false),
  ('552a7d98-aa20-4aa5-806c-7381efad7fd8'::uuid, 'Particular', 'Particular', '40304312', NULL::uuid, 25::numeric, true, false),
  ('d3a44bbc-f5f2-46ba-9d61-c49df8ffee51'::uuid, 'Particular', 'Particular', '40322246', NULL::uuid, 462.58::numeric, true, false),
  ('91a1cb8a-c4a9-4447-acb1-7a7392933d6e'::uuid, 'Particular', 'Particular', '40322483', NULL::uuid, 62::numeric, true, false),
  ('4991660c-8794-425e-93b2-5a978d53a789'::uuid, 'Particular', 'Particular', '40302407', NULL::uuid, 15::numeric, true, false),
  ('57caf517-b44d-4283-b0c8-c76abc84ceff'::uuid, 'Particular', 'Particular', '40308820', NULL::uuid, 91::numeric, true, false),
  ('903142b8-0f66-4761-a576-1424a0cf4c62'::uuid, 'Particular', 'Particular', '40304558', NULL::uuid, 24::numeric, true, false),
  ('c2e5951e-0d21-4d63-91f3-0e1911a8c31a'::uuid, 'Particular', 'Particular', '40306100', NULL::uuid, 65::numeric, true, false),
  ('c90a64e1-9d9f-43cc-91f8-da9597cba554'::uuid, 'Particular', 'Particular', '40314618', NULL::uuid, 565::numeric, true, false),
  ('63cbfa30-366e-419c-aea1-5d21c6ee7cfc'::uuid, 'Particular', 'Particular', '40307697', NULL::uuid, 65::numeric, true, false),
  ('c5c4ad03-3e49-418e-8c6c-578ef5aceaac'::uuid, 'Particular', 'Particular', '40307700', NULL::uuid, 86::numeric, true, false),
  ('acec3e85-448c-4e0a-a0cd-f07ecc9bd9d8'::uuid, 'Particular', 'Particular', '40324419', NULL::uuid, 890::numeric, true, false),
  ('7efaabd7-2fbd-4e7e-8a19-74265250ecb4'::uuid, 'Particular', 'Particular', '40303136', NULL::uuid, 30::numeric, true, false),
  ('5a595c4d-b9d4-490a-a5dc-2767b5d1d0c3'::uuid, 'Particular', 'Particular', '40324788', NULL::uuid, 178::numeric, true, false),
  ('41a89bba-17c1-4ecd-9e54-13603a22b83f'::uuid, 'Particular', 'Particular', '40307727', NULL::uuid, 130::numeric, true, false),
  ('2bd27267-8da6-45da-877a-fbf5048faf18'::uuid, 'Particular', 'Particular', '40313255', NULL::uuid, 128::numeric, true, false),
  ('a3b08ecc-6aaf-46b3-8372-ff528d9c3aba'::uuid, 'Particular', 'Particular', '40321550', NULL::uuid, 160::numeric, true, false),
  ('a7068529-4605-4215-9241-4daccf11fa8b'::uuid, 'Particular', 'Particular', '49901028', NULL::uuid, 151::numeric, true, false),
  ('7827cbde-c9c8-46b1-8665-40af9ef5b5d0'::uuid, 'Particular', 'Particular', '40312330', NULL::uuid, 368::numeric, true, false),
  ('9e3cf0f9-e580-4c93-a59f-af43bb4e3bf9'::uuid, 'Particular', 'Particular', '40307735', NULL::uuid, 59::numeric, true, false),
  ('5cbd54f6-2466-4770-b0a8-3afce2e51da8'::uuid, 'Particular', 'Particular', '40503666', NULL::uuid, 929::numeric, false, false),
  ('f913022a-9960-4817-9fe9-59d04b0d78dc'::uuid, 'Particular', 'Particular', '40503801', 'ee12628c-a175-4e44-949e-b2ef00fdf890'::uuid, 5391::numeric, true, false),
  ('a9f2b93c-a914-480c-8c35-107f9858f278'::uuid, 'Particular', 'Particular', '40306119', NULL::uuid, 86::numeric, true, false),
  ('5a08a624-fb82-42f6-a5b3-94d6acc391e1'::uuid, 'Particular', 'Particular', '40306089', NULL::uuid, 86::numeric, true, false),
  ('51f551ba-40e4-4245-9247-74c6e2d7b4c2'::uuid, 'Particular', 'Particular', '40316459', NULL::uuid, 103::numeric, true, false),
  ('6aebcb77-6600-4a72-931a-ade7d64a04b4'::uuid, 'Particular', 'Particular', '40316475', NULL::uuid, 443.67::numeric, true, false),
  ('d5c6c71f-1f0e-4a82-bef3-ce7ebd6f746e'::uuid, 'Particular', 'Particular', '40316483', NULL::uuid, 921.39::numeric, true, false),
  ('6af4a14e-938d-4092-bff7-e0b1dc51d44d'::uuid, 'Particular', 'Particular', '40316556', NULL::uuid, 51::numeric, true, false),
  ('5502007f-f8b8-4a50-95c2-e5c5c1e1dcb6'::uuid, 'Particular', 'Particular', '40316548', NULL::uuid, 63::numeric, true, false),
  ('80763b6b-a81e-4f4e-9af5-50c504522fdf'::uuid, 'Particular', 'Particular', '40304590', NULL::uuid, 28::numeric, true, false),
  ('a6a5e050-3118-4337-986d-f28747df1cd4'::uuid, 'Particular', 'Particular', '40304639', NULL::uuid, 23::numeric, true, false),
  ('3db97e76-4f28-401c-bae3-5bde1ac2e1a0'::uuid, 'Particular', 'Particular', '40316530', NULL::uuid, 105::numeric, true, false),
  ('64794920-6fc3-46de-850d-247a9f2c220f'::uuid, 'Particular', 'Particular', '40306348', NULL::uuid, 91::numeric, true, false),
  ('022ab462-1350-42af-996f-80ad26ec16a8'::uuid, 'Particular', 'Particular', '40307824', NULL::uuid, 86::numeric, true, false),
  ('6066e5f4-b2cd-4d50-b643-ceddc583b5cc'::uuid, 'Particular', 'Particular', '40307832', NULL::uuid, 57::numeric, true, false),
  ('392a7cdb-f312-4dda-9bc7-97003b8afd05'::uuid, 'Particular', 'Particular', '40316084', NULL::uuid, 168::numeric, true, false),
  ('98972be0-9883-464a-90fc-efdb8ce832b8'::uuid, 'Particular', 'Particular', '40302520', NULL::uuid, 40::numeric, true, false),
  ('343029b5-ca13-4337-8ed1-ebb73a1a0519'::uuid, 'Particular', 'Particular', '40302547', NULL::uuid, 30::numeric, true, false),
  ('dfa7000a-898e-4193-a368-110499e3db73'::uuid, 'Particular', 'Particular', '40321665', NULL::uuid, 466.62::numeric, true, false),
  ('0351cb79-88c4-476b-828c-e2c89afa7c91'::uuid, 'Particular', 'Particular', '40302571', NULL::uuid, 103::numeric, true, false),
  ('4d8d0d14-5dfb-43df-9ff8-987c9891d4cd'::uuid, 'Particular', 'Particular', '40306623', NULL::uuid, 78::numeric, true, false),
  ('9e6e7193-1b14-4098-b77c-a9e27005f832'::uuid, 'Particular', 'Particular', '40308162', NULL::uuid, 137::numeric, true, false),
  ('730c7f66-ba58-4c54-9cf8-8e9d86de3fff'::uuid, 'Particular', 'Particular', '40308170', NULL::uuid, 157::numeric, true, false),
  ('d4853ae5-15e0-4d92-bc1d-645c415c10cd'::uuid, 'Particular', 'Particular', '40314405', NULL::uuid, 486::numeric, true, false),
  ('dffa8a46-ca66-4494-ab4c-83d2894dbcb1'::uuid, 'Particular', 'Particular', '40302601', NULL::uuid, 236::numeric, true, false),
  ('f75ce301-450b-48f0-b56c-354f45d0fe3f'::uuid, 'Particular', 'Particular', '40302784', NULL::uuid, 173::numeric, true, false),
  ('86a25d14-fcb4-4555-90e5-172c654ea5c2'::uuid, 'Particular', 'Particular', '40302792', NULL::uuid, 189::numeric, true, false),
  ('24f5fcc9-553d-4502-aa58-60ed7ee0377c'::uuid, 'Particular', 'Particular', '40302806', NULL::uuid, 545::numeric, true, false),
  ('4eaa2173-96ac-4648-9b57-066f67423d0d'::uuid, 'Particular', 'Particular', '40322262', NULL::uuid, 1374::numeric, true, false),
  ('91b0e5e7-a020-4325-8368-a4c1586b5c17'::uuid, 'Particular', 'Particular', '40302814', NULL::uuid, 220::numeric, true, false),
  ('f47d729f-178e-4b44-8d00-498c65b31861'::uuid, 'Particular', 'Particular', '40322122', NULL::uuid, 478::numeric, true, false),
  ('a4185da4-bc06-46a4-bf2d-e747836329a1'::uuid, 'Particular', 'Particular', '40305015', NULL::uuid, 159::numeric, true, false),
  ('82dfedd7-3389-4fb1-942a-44b675cbb4dc'::uuid, 'Particular', 'Particular', '40302610', NULL::uuid, 236::numeric, true, false),
  ('82cb0294-17de-4ae3-98a3-8c2756a53a92'::uuid, 'Particular', 'Particular', '40302849', NULL::uuid, 629.47::numeric, true, false),
  ('936a657e-1f56-4a7e-8217-025dd7853452'::uuid, 'Particular', 'Particular', '40324591', NULL::uuid, 461::numeric, true, false),
  ('a20c02bf-f92e-488f-9f79-f63b3d801f66'::uuid, 'Particular', 'Particular', '40324605', NULL::uuid, 461::numeric, true, false),
  ('b58ac7b2-e48c-4e79-ac6f-060f6d236e93'::uuid, 'Particular', 'Particular', '40301087', NULL::uuid, 59::numeric, true, true),
  ('d5b3f6a3-223d-4f7e-bae0-046cb70deec1'::uuid, 'Particular', 'Particular', '40301150', NULL::uuid, 26::numeric, true, true),
  ('119d1652-65e4-47ce-85e5-91fcaae4519a'::uuid, 'Particular', 'Particular', '40301281', NULL::uuid, 30::numeric, true, true),
  ('3aeb8f86-d38c-488e-8f33-f8c46c177ea0'::uuid, 'Particular', 'Particular', '40301397', NULL::uuid, 24::numeric, true, true),
  ('ac0a50e7-9df8-41c5-bf0a-bcf5c931cad7'::uuid, 'Particular', 'Particular', '40313190', NULL::uuid, 56::numeric, true, true),
  ('ef07a132-7fea-4205-af2c-55e47c9da725'::uuid, 'Particular', 'Particular', '40307751', NULL::uuid, 490.16::numeric, true, false),
  ('5e6e717b-b012-4c16-a985-162433283b53'::uuid, 'Particular', 'Particular', '40316564', NULL::uuid, 319::numeric, false, false),
  ('ba5a632d-9007-4629-8eb2-77825c3f1fef'::uuid, 'Particular', 'Particular', '40322254', NULL::uuid, 539::numeric, false, false),
  ('30cc7610-df98-46d5-a9f2-5bf1505945c4'::uuid, 'Particular', 'Particular', '40306852', NULL::uuid, 86::numeric, true, true),
  ('9935e01b-1b02-49d5-89e9-f0a0f921895b'::uuid, 'Particular', 'Particular', '40316270', NULL::uuid, 82::numeric, true, true),
  ('1739bf81-801c-4f70-9052-be24760db9bd'::uuid, 'Particular', 'Particular', '40301842', NULL::uuid, 24::numeric, true, true),
  ('4feb6190-f3b9-48d8-8d51-ce5b2edee794'::uuid, 'Particular', 'Particular', '40304264', NULL::uuid, 35::numeric, true, true),
  ('66235a10-dead-4013-99b1-6cc1e43738a6'::uuid, 'Particular', 'Particular', '40301990', NULL::uuid, 26::numeric, true, true),
  ('ce07727a-034d-499b-b177-bd2e9c5a71c0'::uuid, 'Particular', 'Particular', '40316300', NULL::uuid, 141::numeric, true, true),
  ('47ee4673-fad3-4da5-be4c-8c4e83fa9665'::uuid, 'Particular', 'Particular', '40304361', NULL::uuid, 38::numeric, true, true),
  ('d93a4d80-5af8-4d2b-a407-2e430ba975d0'::uuid, 'Particular', 'Particular', '40302113', NULL::uuid, 120::numeric, true, true),
  ('9ca247da-86f0-48a2-a0d9-7467176ae42c'::uuid, 'Particular', 'Particular', '40316289', NULL::uuid, 59::numeric, true, true),
  ('7f80b019-75f9-4779-9afe-98b6d4035bb7'::uuid, 'Particular', 'Particular', '40316335', NULL::uuid, 51::numeric, true, true),
  ('6da9e68b-1557-47eb-b85b-2beb81df79a2'::uuid, 'Particular', 'Particular', '40302199', NULL::uuid, 24::numeric, true, true),
  ('cac5f746-6d22-4cbc-be78-75011fb36649'::uuid, 'Particular', 'Particular', '40305465', NULL::uuid, 42::numeric, true, true),
  ('62fef99c-e1ec-4528-a2de-5e780266030c'::uuid, 'Particular', 'Particular', '40316424', NULL::uuid, 139::numeric, true, true),
  ('a64b1f5e-9ec0-4969-97ef-7d9c9231e4ab'::uuid, 'Particular', 'Particular', '40308391', NULL::uuid, 65::numeric, true, true),
  ('89222975-e32e-4913-8a33-31afece04e14'::uuid, 'Particular', 'Particular', '40302750', NULL::uuid, 86::numeric, true, true),
  ('9e0ea80b-a3ff-490c-b892-b2730f1c9d69'::uuid, 'Particular', 'Particular', '40302318', NULL::uuid, 19::numeric, true, true),
  ('e65f3075-8b8e-4ab6-9a41-653db6c4b3e9'::uuid, 'Particular', 'Particular', '40316408', NULL::uuid, 63::numeric, true, true),
  ('3bd6ae46-00c7-49ce-b4d3-5045db25184f'::uuid, 'Particular', 'Particular', '40316416', NULL::uuid, 65::numeric, true, true),
  ('68136c3a-5b84-4349-9fa1-bdd878e7756b'::uuid, 'Particular', 'Particular', '40316467', NULL::uuid, 61::numeric, true, true),
  ('a0059222-ab30-4c0a-88bc-d03c358a92b4'::uuid, 'Particular', 'Particular', '40316491', NULL::uuid, 70::numeric, true, true),
  ('c4cd8602-ad5a-40f9-ad94-01b954d98769'::uuid, 'Particular', 'Particular', '40316505', NULL::uuid, 95::numeric, true, true),
  ('5566617f-b6e7-404e-b4ea-df4e0185bce8'::uuid, 'Particular', 'Particular', '40316513', NULL::uuid, 65::numeric, true, true),
  ('db7da788-1c3c-4024-bfa3-f4e29061884f'::uuid, 'Particular', 'Particular', '40316521', NULL::uuid, 51::numeric, true, true),
  ('b44c1bf1-0ea3-4f79-b230-af0a2c897ae0'::uuid, 'Particular', 'Particular', '40316106', NULL::uuid, 78::numeric, true, true),
  ('7d1bb27b-33a2-47b1-9c58-c8a56f34c83c'::uuid, 'Particular', 'Particular', '40302504', NULL::uuid, 26::numeric, true, true),
  ('9ce79968-7cb1-42a5-8f4f-2f2eda9e5978'::uuid, 'Particular', 'Particular', '40302512', NULL::uuid, 26::numeric, true, true),
  ('2ea806fc-85bb-475c-93b7-5dbe6932fab1'::uuid, 'Particular', 'Particular', '40302580', NULL::uuid, 24::numeric, true, true),
  ('a4851e5e-8110-4015-8370-a275410950f9'::uuid, 'Particular', 'Particular', '40316572', NULL::uuid, 72::numeric, true, true),
  ('a81a00e6-3f32-4589-b166-92a3b6e0a02a'::uuid, 'Particular', 'Particular', '40301060', NULL::uuid, 139::numeric, true, true),
  ('fa06821c-bdcc-48be-84c3-59886ce8726d'::uuid, 'Particular', 'Particular', '40302830', NULL::uuid, 141::numeric, true, true),
  ('a2e0243d-c8d1-4c48-97ba-f3e99f61f037'::uuid, 'Particular', 'Particular', '40313328', NULL::uuid, 45::numeric, true, true),
  ('2b99ba04-56b3-4dc6-a41b-a908b1e082ab'::uuid, 'Particular', 'Particular', '40301400', NULL::uuid, 26::numeric, true, false),
  ('8c385e38-1bb8-4115-b51d-062e3496da49'::uuid, 'Particular', 'Particular', '40314073', NULL::uuid, 569.49::numeric, true, false),
  ('5f92eb65-2c03-4d9e-b4c3-b0d36f1ee329'::uuid, 'Particular', 'Particular', '40301931', NULL::uuid, 21::numeric, true, false),
  ('93dc2fd7-3145-4275-8541-ffb6cb59f349'::uuid, 'Particular', 'Particular', '40302040', NULL::uuid, 24::numeric, true, false),
  ('c398f885-8d25-4971-a922-2cee8d8728cc'::uuid, 'Particular', 'Particular', '40302423', NULL::uuid, 17::numeric, true, false),
  ('c1cc722b-0960-4c1b-91b9-2ec117c43379'::uuid, 'Particular', 'Particular', '40316190', NULL::uuid, 56::numeric, true, true),
  ('a8ae7cca-bd63-436c-a743-9448b11bd054'::uuid, 'Particular', 'Particular', '40301630', NULL::uuid, 24::numeric, true, true),
  ('43afabd4-aa86-4f28-93b7-11e1ace89409'::uuid, 'Particular', 'PARTICULAR', '40306712', NULL::uuid, 40::numeric, true, false),
  ('40c6f60d-c684-41f0-8113-2005b3cd757c'::uuid, 'Particular', 'Particular', '40301729', NULL::uuid, 28::numeric, true, false),
  ('2eb63ad3-be3d-4f24-9d72-946688cb6296'::uuid, 'Particular', 'Particular', 'micro', NULL::uuid, 299::numeric, true, false),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'Particular', 'PARTICULAR', '', '8f3aad2c-5693-489e-84f0-3a9a0421806c'::uuid, 309::numeric, true, false),
  ('c663713b-3a6e-4946-9802-ddb49302f89b'::uuid, 'Particular', 'Particular', '', 'a791b020-0830-4c95-9364-0c4d7810553a'::uuid, 257::numeric, true, false),
  ('af0d8224-3962-4892-9072-fc5c02ca99b0'::uuid, 'Particular', 'Particular', '', '3ba1895e-f250-4bf7-88a9-31e22ecc49d5'::uuid, 1250::numeric, true, false),
  ('588fae7e-81af-4688-81ac-9e46fcff068e'::uuid, 'Particular', 'Particular', '', '167e8c88-850b-4067-9c89-0c509e4de2b7'::uuid, 1145::numeric, true, false),
  ('5417321c-a683-454e-bc56-cee86885b562'::uuid, 'Particular', 'Particular', '', 'da90b8e4-3d33-4410-a135-6f673deb2a80'::uuid, 623::numeric, true, false),
  ('a37fdb15-f091-483e-aafc-820596e8cad4'::uuid, 'Particular', 'Particular', '', '3e7d861d-a0d8-4403-8161-7e8089b4838c'::uuid, 299::numeric, true, false),
  ('6461fe8f-9fb2-4ff0-9671-aedf08bedce9'::uuid, 'Particular', 'Particular', '', '3b909ce7-131b-4003-8099-66364f290b1f'::uuid, 8700::numeric, true, false),
  ('eaef50d3-17b4-419c-a61e-c71449bba1ec'::uuid, 'Particular', 'Particular', '', 'edad349f-e9d0-4bb0-9e36-f281218b6433'::uuid, 471.72::numeric, true, false),
  ('6daec0e4-2808-4467-8418-255e8c00d4d5'::uuid, 'Particular', 'Particular', '', '6ff70f3e-6e5f-4288-a611-d6f3494b904e'::uuid, 645.34::numeric, true, false),
  ('a6215831-9283-49e1-a1f7-576a8b9b2e73'::uuid, 'Particular', 'Particular', '', '4f7c7ad9-a326-4487-89ad-78884a8eaa7d'::uuid, 399::numeric, true, false),
  ('64208228-4c5c-402a-adca-cd22743c3a22'::uuid, 'Particular', 'Particular', '', 'b03dab7b-5509-44ad-bc34-723e3d912783'::uuid, 497::numeric, true, false),
  ('fa168665-c658-4c21-bd7e-55f815f241b6'::uuid, 'Particular', 'Particular', '', 'd76e5dcc-ff26-4413-91d5-7ed0445c4be1'::uuid, 504::numeric, true, false),
  ('38db9687-fbe4-465f-ba30-07fdd73628fa'::uuid, 'Particular', 'Particular', '', '22fca945-e169-421d-81c2-bdd8cce72743'::uuid, 289.76::numeric, true, false),
  ('9ca89145-e4c7-4927-857a-dfca05a74553'::uuid, 'Particular', 'Particular', '', 'f5b4dc4d-1285-4dff-8721-12ac073f5157'::uuid, 65::numeric, true, false),
  ('4241fd6c-b94c-4d34-8fd3-2d2a0349eefb'::uuid, 'Particular', 'Particular', '', '735c6322-daf3-44ab-8332-8feef43db22e'::uuid, 180::numeric, true, false),
  ('99eeaef6-35a2-4d77-856c-2cfcaf0e4cea'::uuid, 'Particular', 'Particular', '40302687', 'c6172c58-e3ab-42f5-b371-aff42356fa1f'::uuid, 468::numeric, true, false),
  ('fc340ee0-8388-49f2-ab63-3c7ee3444194'::uuid, 'Particular', '', '40307298 ', '548985eb-28c2-4b8e-9119-50945412c1de'::uuid, 165::numeric, true, false),
  ('9971a113-df68-4d8b-b88b-b4500914e813'::uuid, 'Particular', 'Particular', '40306356', '0312ed7a-ecbf-4c42-b2b1-127771f25d22'::uuid, 64::numeric, true, false),
  ('c7a4bd5b-e766-4eb6-bfa9-bb5522dcca7c'::uuid, 'Particular', 'Particular', '40310280', '72b2cf60-9706-4757-a2a4-ad9a96cf86a3'::uuid, 195.52::numeric, true, false),
  ('75eca6be-5097-499b-aae0-2ef0a34654ba'::uuid, 'Particular', 'Particular', '40303128', '40b50b0d-3848-4ef3-8916-3087c6b92389'::uuid, 56.61::numeric, true, false),
  ('8a6fd6e8-bfae-4fa1-9bde-515447427230'::uuid, 'Particular', 'Particular', '40601196', '3b484c94-7406-4210-9cc1-e5baa515c234'::uuid, 450::numeric, true, false),
  ('0376031c-133d-42fc-a9b2-ad1e6022c1df'::uuid, 'Particular', 'part', 'SNP Array / CGH Array - Resíduos ovulares', NULL::uuid, 5000::numeric, true, false),
  ('760988ca-aed7-42b7-a27a-36438d6ae445'::uuid, 'Particular', 'part', '40503240', NULL::uuid, 5000::numeric, true, false),
  ('6bd7c52d-e30f-4dc3-9a48-70e21bffcf74'::uuid, 'Particular', 'Particular', '40324125', 'e20e83e0-a5bb-4dea-b2fc-40501d419acc'::uuid, 510.73::numeric, true, false),
  ('c1ba6c9e-45ec-41d6-84c5-d6dc934bd700'::uuid, 'Particular', 'PART', '40601200', '05037839-e8b6-4d43-9cb5-5d7e55055238'::uuid, 1000::numeric, true, false),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, 'Particular', 'Particular', '40601200', NULL::uuid, 250::numeric, true, false),
  ('81873817-22f5-4274-a792-51a0defb3ff2'::uuid, 'Particular', 'Particular', '40601200', '05037839-e8b6-4d43-9cb5-5d7e55055238'::uuid, 1000::numeric, true, false),
  ('c5627ef9-0231-4c24-928e-8463aa16cd74'::uuid, 'Particular', 'part', '4031636', NULL::uuid, 30::numeric, true, false),
  ('b57d7676-9fbb-461b-aa4c-06a352e7ea92'::uuid, 'Particular', 'Particular', '40316360', '08b651a8-334f-405f-9188-0aec438a22db'::uuid, 30::numeric, true, false),
  ('6007830d-edea-4e31-8fdf-c3d1f46edde2'::uuid, 'Particular', 'Particular', '40314235', '8cf20ca7-e222-46d6-9cea-c0031cd80185'::uuid, 1469.38::numeric, true, false),
  ('31158a10-d17e-4cb2-a062-48f301b9c984'::uuid, 'Particular', 'Particular', '', 'fdb2b1ee-6f45-4881-a2a4-79ba0da4c292'::uuid, 1454.04::numeric, true, false),
  ('fafc1021-b5af-4df7-9ded-bfc34a490edd'::uuid, 'Particular', 'Particular', '40314049', '1ccbd251-537f-45de-81cb-12e2fcbcb9c3'::uuid, 816.32::numeric, true, false),
  ('a7d2c4c2-58bf-4934-97ec-612ece270d82'::uuid, 'Particular', 'Particular', '40503310', '9a98837a-fa51-4dce-a615-618df2aac5da'::uuid, 489.9::numeric, true, false),
  ('130ea5c2-63bb-4e19-8c2e-3451b3e13f95'::uuid, 'Particular', 'Particular', '40503801', 'a703e48c-482e-428c-8a8c-24d56a7a353b'::uuid, 10122.36::numeric, true, false);

CREATE TEMP TABLE _unif_exclusoes (payor_id UUID, exame_id UUID) ON COMMIT DROP;
INSERT INTO _unif_exclusoes VALUES
  ('c398f885-8d25-4971-a922-2cee8d8728cc'::uuid, '8f314556-1dc9-4b32-b5d7-52547fe57fd9'::uuid),
  ('e473193a-1665-48fe-8a24-1371d7df3cf5'::uuid, '139e904a-77c4-47f0-9b48-2541bf64fe26'::uuid),
  ('e473193a-1665-48fe-8a24-1371d7df3cf5'::uuid, 'a4b54d37-b1ce-4820-9b5d-c5f5222ead24'::uuid),
  ('4ea4489d-5ec1-4bab-96fb-1195f9116057'::uuid, '9823eaff-be4d-4a97-8e70-4f43006aa884'::uuid),
  ('db7da788-1c3c-4024-bfa3-f4e29061884f'::uuid, '2b0c5dac-9611-4295-9686-06fa9567c20e'::uuid),
  ('cffa1967-4fc8-4bdf-af87-182de09c51f4'::uuid, '00eddc8a-9efd-45fc-9044-6e83d26755d1'::uuid),
  ('c1ba6c9e-45ec-41d6-84c5-d6dc934bd700'::uuid, '56dcb00e-0ee0-4648-a64e-c2388dab2298'::uuid),
  ('c1ba6c9e-45ec-41d6-84c5-d6dc934bd700'::uuid, 'f8ddce53-d8a8-42df-a2a6-587339f1cb99'::uuid),
  ('81873817-22f5-4274-a792-51a0defb3ff2'::uuid, 'f8ddce53-d8a8-42df-a2a6-587339f1cb99'::uuid),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '4dc6cf38-4731-4dd6-b739-3559f5b1314d'::uuid),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '9ef49c1d-4384-47d6-9c43-5ac47ac72255'::uuid),
  ('e147a0e2-ed34-48d0-90d2-acbe2e9fed92'::uuid, 'c0ade7e2-f18a-474c-a17f-afae2cb1031f'::uuid),
  ('afa569e8-49dd-4bad-bf60-92743ab844a1'::uuid, '9e2d99c0-2d5c-4976-9c59-d911e73a9219'::uuid);

CREATE TEMP TABLE _unif_valores (payor_id UUID, exame_id UUID, valor NUMERIC) ON COMMIT DROP;
INSERT INTO _unif_valores VALUES
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'edad349f-e9d0-4bb0-9e36-f281218b6433'::uuid, 471.72::numeric),
  ('457f4111-a2d1-4b34-97bd-2481380d7c5e'::uuid, '9243326a-c3c0-4def-97db-8506bc768ff2'::uuid, 515::numeric),
  ('2b9689b9-d832-46e0-952c-82ec1b6f965a'::uuid, 'efd5e4cb-7904-4e1f-bfe2-6b84ef15d7d1'::uuid, 321::numeric),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '4dc6cf38-4731-4dd6-b739-3559f5b1314d'::uuid, 275::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '8b690cb4-f45c-4ae0-a487-aadefed34c9c'::uuid, 170::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '822a00a8-7afe-4d2d-a7c5-3d8cdd6110ad'::uuid, 199::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, 'acb7604c-27da-4cf2-a82c-7dc5b9f5dd83'::uuid, 199::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '7b8d0405-275a-48af-9ce9-4666fce46ba9'::uuid, 599::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '7049dd9e-8170-4170-92d8-4eb5c32a2f25'::uuid, 250::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '37ca0d85-8da1-44de-b4e5-d9f15057c34b'::uuid, 199::numeric),
  ('dbcdb776-ae51-4eaa-9b06-141f0679e5ce'::uuid, '4b099b5c-69cd-4f62-8772-2eb9d6225278'::uuid, 65::numeric),
  ('03ad7172-1c14-46f2-be8e-ace31aa09c5b'::uuid, '657c9970-6e3a-4424-9572-b1b5a698a436'::uuid, 78::numeric),
  ('6a6004ed-47ce-4c63-9d3b-e21938fd1c31'::uuid, 'f191f42d-9a14-4a4a-98f4-fe7c8512d644'::uuid, 40::numeric),
  ('e40106dd-4e1b-437f-9b44-62bd235efd69'::uuid, '91beb0a4-40ab-4621-afbc-64f1acda3f2c'::uuid, 720::numeric),
  ('cdfc909a-3faf-4e4f-ae2f-2900609ccd0c'::uuid, 'a0ec43e7-5b0e-4ce2-ba83-3ceb2bf0dfd7'::uuid, 590::numeric),
  ('afa569e8-49dd-4bad-bf60-92743ab844a1'::uuid, '39a93289-c368-445b-a042-9662c765f076'::uuid, 115::numeric),
  ('3817d4e1-dc46-48b0-949e-195cba8c697a'::uuid, '28db86c0-7608-4faf-8386-b941989ef702'::uuid, 550::numeric),
  ('1555b759-8c27-499f-9bb3-2965c2ff0a1d'::uuid, 'c4adc5fa-374f-4c61-a0fe-3d93acc52184'::uuid, 149::numeric),
  ('1555b759-8c27-499f-9bb3-2965c2ff0a1d'::uuid, '71fda837-ee2b-4226-9992-9485d8ad2a44'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '5b184bb9-c8ee-439c-8d2c-1f4d0eebd026'::uuid, 149::numeric),
  ('1555b759-8c27-499f-9bb3-2965c2ff0a1d'::uuid, 'd0c8daab-a6dc-4c40-88ee-0297b21f118e'::uuid, 149::numeric),
  ('d322ebd0-2b92-46c6-9f1c-24209339af8a'::uuid, '205f8339-7273-4d18-a221-b9e2fbaa3c4b'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'e23920a4-736b-495a-9187-d6d5a2cceca0'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '38956eff-784e-4160-921d-a5d96217e9db'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '887958ee-07d5-4f24-b272-9a26414c7760'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '7b8467f0-4e0b-45b8-a046-4bd67cf842ca'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'd7b22211-8662-4102-943a-d6ea988b7040'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'e278936c-ccc0-4848-9134-166420417205'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '37d44876-cdf7-45cf-9cee-b0983fe33d93'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'fa53d131-aa14-4577-a5bf-9cf468bc4317'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'f3e0299e-ec94-42a5-a7ea-d6fb5369dcb0'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '8a6076f3-8eec-46c8-8c28-0e97d253cb39'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'b3c484c3-571f-4a0c-abb0-aac1d958f9ec'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '8812af70-47cf-4c55-a676-f203b0efa93e'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '12b34c72-4789-4ea6-bc2c-fd4b3a2ce992'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'f4e33fe0-45b5-438f-9539-214e04ff1fcc'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'ae7c2b53-8798-49c9-bb22-8dd66936391c'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'bf4f602c-2579-41a4-94c7-e8ee9a2271f8'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, '23782781-041a-4967-aaa6-ad13bf7b8ed8'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'acd7a6a2-6cfa-4359-96b4-64d12707e246'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'a07e7876-5db4-4356-ad87-32f083eaf18a'::uuid, 149::numeric),
  ('d5535113-ba1e-4f17-8255-caf87a59babb'::uuid, 'b1dd2f8d-530f-486f-a7f6-6f6aa20dd3ec'::uuid, 149::numeric),
  ('1555b759-8c27-499f-9bb3-2965c2ff0a1d'::uuid, '7e18928a-eeae-4ec5-9f9f-bcb5c8b55eac'::uuid, 149::numeric),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '9ef49c1d-4384-47d6-9c43-5ac47ac72255'::uuid, 687::numeric),
  ('cdc919db-a37f-4d85-bce1-4468345528e6'::uuid, '96a39535-6491-4387-909e-364e880d3bb9'::uuid, 89::numeric),
  ('93dc2fd7-3145-4275-8541-ffb6cb59f349'::uuid, '13b456b7-e137-4e89-838d-58246b4b18a6'::uuid, 21::numeric),
  ('a857a86a-06eb-4090-903b-cc2d174fafbd'::uuid, 'e08b9a53-69d8-4a92-a469-771f19b02ac3'::uuid, 65::numeric),
  ('e416c5a7-8bc7-4b24-b10d-6828d69c4ade'::uuid, 'f6b4b19e-a7a4-44b6-8ab2-c8672d55b537'::uuid, 124::numeric),
  ('05291b04-cbd8-405b-a8d7-0c8ae3af5037'::uuid, '0ba54057-f98e-4d1f-8a25-76240543ade0'::uuid, 51::numeric),
  ('ebdf751c-a7a8-45d6-b9b8-53b0c2ea18e1'::uuid, '73654e84-5dd5-4d13-8d61-a0c71ba6e036'::uuid, 1031::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'a791b020-0830-4c95-9364-0c4d7810553a'::uuid, 257::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '3ba1895e-f250-4bf7-88a9-31e22ecc49d5'::uuid, 1250::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '489688f6-1e94-4242-a505-25e9ee186ccd'::uuid, 900::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '167e8c88-850b-4067-9c89-0c509e4de2b7'::uuid, 1145::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'da90b8e4-3d33-4410-a135-6f673deb2a80'::uuid, 623::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '3e7d861d-a0d8-4403-8161-7e8089b4838c'::uuid, 299::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '3b909ce7-131b-4003-8099-66364f290b1f'::uuid, 8700::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '6ff70f3e-6e5f-4288-a611-d6f3494b904e'::uuid, 645.34::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'e6956dde-daed-4ad0-bb2f-8f7965294c21'::uuid, 450::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '4f7c7ad9-a326-4487-89ad-78884a8eaa7d'::uuid, 399::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, 'e1715fa4-724a-45d3-9914-e7fb88c37b27'::uuid, 350::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '0633bfa7-fca4-4c95-b2ee-bfee0e814e9d'::uuid, 2490::numeric),
  ('f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '918586dd-441c-48a2-942f-f32b8481fd0a'::uuid, 3196::numeric),
  ('f23ee9cd-8ec0-4f68-92fe-6f0416d290ed'::uuid, '01055018-2b55-461d-96d8-5431340ab7c8'::uuid, 161::numeric),
  ('27b78e7d-998d-43a2-9e13-c40255f46ef6'::uuid, '220009d9-c89b-4cb5-af80-5bfb76dde728'::uuid, 36.5::numeric),
  ('13eea369-1694-407e-9254-27d12b6d17d7'::uuid, '7fd51862-a1cc-4843-ad2a-aabfafbc8f58'::uuid, 80::numeric),
  ('c1cc722b-0960-4c1b-91b9-2ec117c43379'::uuid, '4b898e42-9970-4578-a02c-ee5897f88f11'::uuid, 88::numeric),
  ('a1354fbf-7333-4001-9070-c6f10bb21a1a'::uuid, 'dc23e801-6f59-4cf7-ac25-671a9b031259'::uuid, 95::numeric),
  ('2055b585-edd3-4b6d-8b22-2424df969ea0'::uuid, '2a656f96-e69a-4f0a-8f0e-4dd998038875'::uuid, 442::numeric),
  ('ac0a50e7-9df8-41c5-bf0a-bcf5c931cad7'::uuid, 'c0efe7c2-4e45-400a-8446-0aad2ee1f0c1'::uuid, 45::numeric),
  ('a63ece5e-009c-4a03-b323-d84b768d1907'::uuid, 'a0086c0c-d73f-4661-9010-187c26d7cc4c'::uuid, 1113.2::numeric),
  ('4602a329-90f6-446c-968e-c84a71a9237c'::uuid, '82973f2c-641f-4b96-b157-fb46ac402646'::uuid, 120::numeric),
  ('286b487c-d150-4470-b995-ea7e0ee53d30'::uuid, 'fe88ee7f-bad6-4fc9-a78e-dc249c3f5249'::uuid, 340.67::numeric),
  ('4d70e3c2-7bdd-4a63-a407-a3acb7d22eb6'::uuid, '5ad87b61-e9a1-43b3-8090-7ce7df0b241f'::uuid, 37::numeric),
  ('286b487c-d150-4470-b995-ea7e0ee53d30'::uuid, '073e78b6-72d3-4c69-b377-f0ed867f1b79'::uuid, 644.65::numeric),
  ('286b487c-d150-4470-b995-ea7e0ee53d30'::uuid, '9a40b201-135d-43c9-8fde-39e172656728'::uuid, 786.05::numeric),
  ('31bdff98-9a89-4cfe-aa62-e4a93c033d44'::uuid, '5f81ac02-5893-4187-86ff-7281b17bbb11'::uuid, 86::numeric),
  ('e81b6fc5-3cad-41b3-92f1-b12effb695d5'::uuid, '3a43e081-a0ae-449b-bfeb-4167a1a99883'::uuid, 101::numeric),
  ('c4cd8602-ad5a-40f9-ad94-01b954d98769'::uuid, '340df886-bcb0-43e8-ae4a-49f72d2f9716'::uuid, 113::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, 'f8ddce53-d8a8-42df-a2a6-587339f1cb99'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '05037839-e8b6-4d43-9cb5-5d7e55055238'::uuid, 1000::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '63a4db0d-c86a-4726-b620-f2a8b04e8d4e'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, 'e092238a-5778-415e-a738-81fc38566279'::uuid, 195::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '71f9616b-f411-41f9-8125-bc33b55bc9be'::uuid, 700::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '6cdcd7d6-c8ab-4cec-b586-2aa160e6a89f'::uuid, 350::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '12c89864-20c3-4a54-8386-536808ab8b42'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, 'a6517856-f131-4523-8374-095bb11b7c0c'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '56dcb00e-0ee0-4648-a64e-c2388dab2298'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '8a99d132-0676-4ecd-a48f-7bf1889abf10'::uuid, 450::numeric),
  ('86c2c09d-a593-4592-856a-0a603fd9b95e'::uuid, '68af1bc8-ec26-44e5-b604-14f0fa8be68f'::uuid, 275::numeric),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '205abb82-9d6e-40ea-8fc3-0981386cc377'::uuid, 225::numeric),
  ('30cf5b95-c121-493d-aaf6-1bbabecd1316'::uuid, '461d1e46-fb98-49fa-9583-a863ad2b97b5'::uuid, 275::numeric),
  ('d096aa0d-f44e-43df-861e-aa877b805f33'::uuid, 'fe19c033-c692-496c-9612-e54ff0f82acf'::uuid, 3788.53::numeric);

DO $unif$
DECLARE
  diferencas INTEGER;
BEGIN
  WITH atuais AS (
    SELECT f.id, f.fonte_pagadora, f.tabela_associada, f.tuss, f.exame_id,
           f.valor::numeric, f.atendido, f.elegivel_desconto_particular
    FROM public.custo_fontes_pagadoras f
    JOIN _unif_tabelas t ON t.fonte_pagadora = f.fonte_pagadora AND t.nome = f.tabela_associada
  )
  SELECT count(*) INTO diferencas FROM (
    (SELECT * FROM atuais EXCEPT SELECT * FROM _unif_linhas)
    UNION ALL
    (SELECT * FROM _unif_linhas EXCEPT SELECT * FROM atuais)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % linha(s) das tabelas do mapa mudaram desde o levantamento. Gere a migração de novo (supabase/scripts/unificar-tabelas-associadas.ts).', diferencas;
  END IF;

  SELECT count(*) INTO diferencas FROM (
    ((SELECT payor_id, exame_id FROM public.custo_fontes_pagadoras_exclusoes WHERE payor_id IN (SELECT id FROM _unif_linhas))
      EXCEPT SELECT * FROM _unif_exclusoes)
    UNION ALL
    (SELECT * FROM _unif_exclusoes
      EXCEPT SELECT payor_id, exame_id FROM public.custo_fontes_pagadoras_exclusoes)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % exclusão(ões) de exame das linhas do mapa mudaram desde o levantamento. Gere a migração de novo.', diferencas;
  END IF;

  SELECT count(*) INTO diferencas FROM (
    ((SELECT payor_id, exame_id, valor::numeric FROM public.custo_fontes_pagadoras_valores_exame WHERE payor_id IN (SELECT id FROM _unif_linhas))
      EXCEPT SELECT * FROM _unif_valores)
    UNION ALL
    (SELECT * FROM _unif_valores
      EXCEPT SELECT payor_id, exame_id, valor::numeric FROM public.custo_fontes_pagadoras_valores_exame)
  ) d;
  IF diferencas > 0 THEN
    RAISE EXCEPTION 'Unificação: % valor(es) personalizado(s) das linhas do mapa mudaram desde o levantamento. Gere a migração de novo.', diferencas;
  END IF;
END $unif$;

-- 2. Regras do cadastro e sincronia das linhas desligadas durante a junção:
--    a Tabela Particular protegida pode ser uma das juntadas, e o destino pode
--    estar inativo. Id e texto da linha são gravados juntos abaixo.
ALTER TABLE public.custo_tabelas_associadas DISABLE TRIGGER trigger_custo_tabelas_associadas_regras;
ALTER TABLE public.custo_fontes_pagadoras DISABLE TRIGGER trigger_custo_fontes_pagadoras_sincroniza_tabela_associada;

-- 3. Junção
INSERT INTO public.custo_fontes_pagadoras_exclusoes (payor_id, exame_id) VALUES
  ('81873817-22f5-4274-a792-51a0defb3ff2'::uuid, '56dcb00e-0ee0-4648-a64e-c2388dab2298'::uuid)
ON CONFLICT (payor_id, exame_id) DO NOTHING;

DELETE FROM public.custo_fontes_pagadoras WHERE id IN ('c1ba6c9e-45ec-41d6-84c5-d6dc934bd700'::uuid);

UPDATE public.custo_fontes_pagadoras f
SET tabela_associada_id = t.id, tabela_associada = t.nome
FROM public.custo_tabelas_associadas t
WHERE t.fonte_pagadora = 'Particular' AND t.nome = 'Particular'
  AND f.id IN ('43afabd4-aa86-4f28-93b7-11e1ace89409'::uuid, 'f5bb541c-dc95-40f6-b249-3dc02af21e23'::uuid, '0376031c-133d-42fc-a9b2-ad1e6022c1df'::uuid, '760988ca-aed7-42b7-a27a-36438d6ae445'::uuid, 'c5627ef9-0231-4c24-928e-8463aa16cd74'::uuid, 'fc340ee0-8388-49f2-ab63-3c7ee3444194'::uuid);

DELETE FROM public.custo_tabelas_associadas WHERE fonte_pagadora = 'Particular' AND nome = 'PARTICULAR';

DELETE FROM public.custo_tabelas_associadas WHERE fonte_pagadora = 'Particular' AND nome = 'part';

DELETE FROM public.custo_tabelas_associadas WHERE fonte_pagadora = 'Particular' AND nome = 'PART';

DELETE FROM public.custo_tabelas_associadas WHERE fonte_pagadora = 'Particular' AND nome = '';

ALTER TABLE public.custo_fontes_pagadoras ENABLE TRIGGER trigger_custo_fontes_pagadoras_sincroniza_tabela_associada;
ALTER TABLE public.custo_tabelas_associadas ENABLE TRIGGER trigger_custo_tabelas_associadas_regras;

-- 4. Conferência
DO $unif$
DECLARE
  problemas INTEGER;
BEGIN
  SELECT count(*) INTO problemas FROM (
    SELECT f.tabela_associada_id, CASE WHEN f.exame_id IS NULL THEN 'tuss:' || btrim(f.tuss) ELSE 'exame:' || f.exame_id END
    FROM public.custo_fontes_pagadoras f
    JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
    WHERE (t.fonte_pagadora, t.nome) IN (('Particular', 'Particular'))
    GROUP BY 1, 2 HAVING count(*) > 1
  ) d;
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % par(es) (tabela, TUSS) ou (tabela, exame) duplicado(s) nas tabelas de destino.', problemas;
  END IF;

  SELECT count(*) INTO problemas
  FROM public.custo_fontes_pagadoras f
  JOIN public.custo_tabelas_associadas t ON t.id = f.tabela_associada_id
  WHERE t.nome <> f.tabela_associada OR t.fonte_pagadora <> f.fonte_pagadora;
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % linha(s) com texto da tabela diferente do cadastro.', problemas;
  END IF;

  SELECT count(*) INTO problemas
  FROM public.custo_tabelas_associadas t
  JOIN _unif_tabelas u ON u.fonte_pagadora = t.fonte_pagadora AND u.nome = t.nome
  WHERE (u.fonte_pagadora, u.nome) NOT IN (('Particular', 'Particular'));
  IF problemas > 0 THEN
    RAISE EXCEPTION 'Unificação: % cadastro(s) de origem não foram removidos.', problemas;
  END IF;
END $unif$;
