-- ============================================================================
-- Contas a Receber: valor dos títulos do backfill de 11/09 alinhado ao apLIS.
--
-- 20260911100000 copiou o "Valor Enviado" da planilha do setor. Em 128 lotes
-- ele difere da soma de fatrequisicaoprocedimento.ValorLiquido no apLIS
-- (conferido em 28/09), e o apLIS é o certo: nos lotes já pagos, o valor pago
-- fica mais perto do apLIS em 20 de 24 (em 10, centavo a centavo). Nenhuma
-- coluna do apLIS (bruto, unitário, desconto, retenção, NF) reproduz o número
-- da planilha. Padrões: AMHP-DF +4%/+8% acima do apLIS; Bradesco ~70% dele.
-- As guias gravadas em requisicoes já vieram do apLIS; hoje o total do lote e
-- do título não fecha com elas.
--
-- Corrige 123 títulos (+4210.60 no total a receber):
--   BRADESCO SAUDE  - 005711                 5 lote(s)  +21267.67
--   AMHP-DF                                101 lote(s)  -14723.34
--   BRADESCO SAUDE S/A 421715                2 lote(s)  +3211.53
--   SAUDE CAIXA                              2 lote(s)  -2207.98
--   PMDF                                     4 lote(s)  -2108.57
--   LAB PLANASSISTE                          1 lote(s)  -1238.28
--   TJDFT                                    4 lote(s)  +772.20
--   INAS GDF                                 1 lote(s)  -643.40
--   ASSEFAZ                                  1 lote(s)  -119.27
--   SUL AMERICA COMPANHIA DE SEGURO SAÚDE   1 lote(s)  +0.03
--   POSTAL SAÚDE                             1 lote(s)  +0.01
--
-- Só toca título do backfill, ABERTO, com um lote, sem baixa e sem glosa — e
-- só se o valor ainda for o da planilha. Atualiza lotes.valor_total,
-- notas.valor_total e o recebimento previsto; o saldo é coluna gerada.
--
-- Ficam de fora (5), para análise manual:
--   6194 BRB SAÚDE — status recebida (FlowLab 14063.04, apLIS 14006.04)
--   6271 AMIL — status parcialmente_recebida (FlowLab 2552.09, apLIS 2346.09)
--   6297 TRT — status recebida (FlowLab 2775.99, apLIS 2696.07)
--   6316 CASSI — status parcialmente_recebida (FlowLab 23904.62, apLIS 23669.95)
--   6342 STJ — status parcialmente_recebida (FlowLab 32303.63, apLIS 31404.94)
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _valor_aplis (
  aplis_id    TEXT PRIMARY KEY,
  id_lote     UUID NOT NULL,
  id_nota     UUID NOT NULL,
  valor_atual DECIMAL(15, 2) NOT NULL,
  valor_aplis DECIMAL(15, 2) NOT NULL
);

INSERT INTO _valor_aplis (aplis_id, id_lote, id_nota, valor_atual, valor_aplis) VALUES
  ('3930', 'd33ee428-730e-4313-a630-c3c67a7a451e'::uuid, 'd657d96f-845a-4650-b54f-9ca077524da2'::uuid, 12845.66, 12845.06),  -- AMHP-DF | planilha AGOSTO 44
  ('4033', 'b576a5cf-5604-4205-ab5e-3114dd8aaece'::uuid, '231587bd-3f03-46e5-80e8-e31dc1b298e1'::uuid, 4443.79, 3786.44),  -- AMHP-DF | planilha AGOSTO 45
  ('4950', '38eac44d-c837-43c7-97b2-c49e7afece92'::uuid, '0b39e5d4-7a3a-4273-8d46-2509bc7f6e11'::uuid, 16132.00, 23045.71),  -- BRADESCO SAUDE  - 005711 | planilha AGOSTO 104
  ('4951', '81239b86-f660-4136-b727-9a51015ee614'::uuid, '1b64cad6-6c31-406a-8512-ccbecd44e116'::uuid, 7672.38, 10865.94),  -- BRADESCO SAUDE S/A 421715 | planilha AGOSTO 105
  ('4989', '91b05acd-bd38-4fb1-b482-e5aa1ed986da'::uuid, 'b7fb135c-4876-4c3f-8056-b37555fee5b0'::uuid, 10353.17, 9455.91),  -- PMDF | planilha JULHO 150
  ('5179', 'ec53adde-4153-421c-8dea-c66f38ad29a7'::uuid, 'a28840ea-9ae8-4e73-aaef-863f54a3504a'::uuid, 3445.68, 3193.58),  -- AMHP-DF | planilha SETEMBRO 29
  ('5258', 'c0e4a10c-a62a-4409-b9b6-2e05bb62b7b2'::uuid, 'acb3826e-0fc5-44f3-94dd-01fc637a1a49'::uuid, 18106.42, 26906.49),  -- BRADESCO SAUDE  - 005711 | planilha AGOSTO 107
  ('5347', '80b8c476-9863-4a1e-9a88-f30f0435f4ae'::uuid, 'e5d131cb-5f81-4d6c-b9d4-8fbd439d3698'::uuid, 11900.99, 17001.20),  -- BRADESCO SAUDE  - 005711 | planilha AGOSTO 106
  ('6182', 'e7d95455-f5ee-4bf6-8b9a-76afb4a718dc'::uuid, '123e19ce-d281-4733-8703-ece26d7377fd'::uuid, 3018.03, 2898.76),  -- ASSEFAZ | planilha JULHO 79
  ('6231', 'a7390ff0-7307-4bb6-a47f-b8c6a110b05e'::uuid, 'fe46b17f-13ce-442c-a5e4-6ad166a7208f'::uuid, 2146.41, 2055.19),  -- PMDF | planilha JULHO 149
  ('6235', 'c77b2023-6c3e-424c-9a36-11fe9a0691a2'::uuid, '0fffdf83-1f41-4141-9d32-1d31e764eb88'::uuid, 17462.00, 16818.60),  -- INAS GDF | planilha JULHO 133
  ('6243', '9c937d21-045c-4973-8dc2-fa1114152400'::uuid, '72fb35b5-0118-4858-9a7c-64b4cf902c2d'::uuid, 5498.95, 4142.78),  -- PMDF | planilha JULHO 154
  ('6272', '3d1f38c9-d2d4-4742-b9d6-254d8f347423'::uuid, 'dde08209-38f4-4350-8ac8-fa3c62d5e69a'::uuid, 10608.69, 9005.21),  -- AMHP-DF | planilha JULHO 60
  ('6274', '39c2170e-4b5d-4550-8a81-1a2f7751b32d'::uuid, '2e379114-a0f7-495c-a37f-a0cd1c2b13ec'::uuid, 3144.15, 3211.85),  -- AMHP-DF | planilha JULHO 61
  ('6276', 'dbbdafac-ed5d-4e4d-8ea7-b690ae447ea0'::uuid, 'ac3ad2bf-4188-4b2a-9298-f11935ec6786'::uuid, 4181.80, 3854.30),  -- AMHP-DF | planilha JULHO 33
  ('6277', 'e8264f67-4e01-4b04-9065-bf1e6ab8a9d1'::uuid, 'd8fd7f89-1bfa-464c-9e84-15c1f0ae9bfa'::uuid, 4902.86, 4655.04),  -- AMHP-DF | planilha JULHO 45
  ('6280', '183daa2b-826c-4c3a-9b12-91c4642a869f'::uuid, 'a4572e90-0ab8-4581-9215-d03124b4b8b4'::uuid, 7100.39, 6856.22),  -- AMHP-DF | planilha JULHO 30
  ('6284', 'a76a26fd-6a25-4691-8877-bab9f24f936f'::uuid, '567e7a18-47ff-4a4f-9f02-4af76c43b2c2'::uuid, 1047.73, 965.77),  -- AMHP-DF | planilha JULHO 38
  ('6285', '2b5916f9-fbf2-4edc-97b9-c0a4710c1598'::uuid, '7f5848ae-84de-4b19-9bc7-bd9f01722cf0'::uuid, 79.91, 73.66),  -- AMHP-DF | planilha JULHO 39
  ('6286', 'd6c35130-7303-4de2-949a-29f22ebb2509'::uuid, '95d22173-2bd6-4fd1-92bb-67a2b8c63a72'::uuid, 1448.46, 2027.80),  -- AMHP-DF | planilha JULHO 26
  ('6287', '08507286-719f-4775-8973-26af9771854b'::uuid, '8376808a-f17f-485b-93f0-d201028d347c'::uuid, 1470.59, 949.82),  -- AMHP-DF | planilha JULHO 27
  ('6291', 'e9d7db9d-a872-4a95-b721-89e0da20f05e'::uuid, '27de197e-24f0-4c5c-a1c4-34945f9d46e9'::uuid, 57.90, 59.12),  -- AMHP-DF | planilha JULHO 50
  ('6292', 'e49ec9fb-1e4c-4f3d-a104-1968ed294bf1'::uuid, '1672eb37-3aca-49a8-a93a-f55fe017627e'::uuid, 1571.80, 1511.44),  -- AMHP-DF | planilha JULHO 57
  ('6294', '75ebf854-a610-46b7-a271-05780ecae185'::uuid, '05d86674-7a97-4ba1-b355-a9f245502af8'::uuid, 1642.01, 1571.57),  -- AMHP-DF | planilha JULHO 68
  ('6295', '3ab55375-e359-4297-89b3-456e760c5595'::uuid, '7e2653d2-149b-48da-b1e9-1161806fec4f'::uuid, 2560.85, 1788.01),  -- AMHP-DF | planilha JULHO 51
  ('6301', '4df45d2e-dfd4-4aa6-b638-5144883aecdc'::uuid, '0a4e7069-8a8a-4cf9-9c7a-babd84486ede'::uuid, 1359.14, 1306.93),  -- AMHP-DF | planilha JULHO 58
  ('6304', '67e89576-9293-450e-a5be-5eef1448b1d2'::uuid, 'c5ca081e-ed9d-4113-80e0-8c21d1024483'::uuid, 1138.34, 1049.29),  -- AMHP-DF | planilha JULHO 40
  ('6306', 'a51e599b-dfdc-4066-b7df-43f8aa09ba12'::uuid, '8cce6010-a3a2-4b8e-bf3b-b0eee536876e'::uuid, 1582.01, 1502.02),  -- AMHP-DF | planilha JULHO 46
  ('6307', 'ce62ab60-636b-45e8-a7af-b10296a5d82f'::uuid, '7fc2bcf0-52af-4536-ad55-b052600b04d0'::uuid, 676.87, 658.77),  -- AMHP-DF | planilha JULHO 70
  ('6308', '01cd8a90-f05a-4eba-8670-3c22d82b573d'::uuid, 'ac821279-552b-49e3-a558-6f16654a5412'::uuid, 62.28, 59.89),  -- AMHP-DF | planilha JULHO 52
  ('6310', '6717f8eb-484c-478c-97c2-1b3be6ee9e27'::uuid, '33426c66-14aa-4537-a948-c460854e7bd0'::uuid, 239.79, 221.01),  -- AMHP-DF | planilha JULHO 35
  ('6312', 'b82a5c07-e104-4685-bfc5-cc4e7e51b33f'::uuid, '82e598fe-54da-486b-8b91-51b7ed2e0013'::uuid, 256.19, 236.15),  -- AMHP-DF | planilha JULHO 34
  ('6313', 'a40fe104-e362-4ef4-a0bb-ff904b074c70'::uuid, '9becb062-decf-4071-b098-c84e201ddb5c'::uuid, 3811.65, 3666.10),  -- AMHP-DF | planilha JULHO 31
  ('6315', 'd35506bc-347f-4b93-90db-924c9eb96fa8'::uuid, 'ea63012f-4f02-421c-9974-b319879f18b7'::uuid, 7313.28, 7492.99),  -- AMHP-DF | planilha JULHO 62
  ('6332', 'adad28e2-c5a5-40bc-a1d9-6159cfa8ffca'::uuid, 'd7399086-dea9-4cb9-bfcf-d1e761210de8'::uuid, 9628.82, 10089.36),  -- BRADESCO SAUDE  - 005711 | planilha JULHO 93
  ('6353', 'f893ccb9-5b83-4fd2-80d4-41f5cc76b794'::uuid, '370edbf0-c9e6-4a9d-9bb8-ff8c5a1cc814'::uuid, 898.83, 828.42),  -- AMHP-DF | planilha JULHO 36
  ('6354', 'ed99307d-bc4d-44d5-a35b-d777cbdad62c'::uuid, 'f88cc4c7-e494-4ee6-9b55-a3fb4c27aa89'::uuid, 1549.60, 1426.65),  -- AMHP-DF | planilha JULHO 47
  ('6358', 'ee10922c-8414-42e7-80a3-196f4314451c'::uuid, '7a514ee2-3b5d-4e1a-85a0-99baa0e0ea33'::uuid, 1199.28, 1179.06),  -- AMHP-DF | planilha JULHO 63
  ('6359', 'a0214473-ee24-4ff5-bfa9-a4d043fe41cf'::uuid, '87d06573-7af1-4767-87f8-bc8cbe5268c8'::uuid, 933.49, 886.34),  -- AMHP-DF | planilha JULHO 48
  ('6363', '0822ce10-dc87-473f-91e4-01faa9b45d58'::uuid, '4337be2f-4d11-4582-b1f0-f2c00530e1a0'::uuid, 898.61, 828.31),  -- AMHP-DF | planilha JULHO 41
  ('6369', 'ccef76b5-0559-42c6-b143-8d029a402f18'::uuid, '66056ce3-5c48-4484-96db-eac7b85ce98a'::uuid, 76.20, 73.28),  -- AMHP-DF | planilha JULHO 59
  ('6377', '0035becc-3eb5-48e3-8d5f-148f81cc5ea2'::uuid, '596f7d09-f3dc-467a-bc2d-daaebef7a6d8'::uuid, 447.33, 1035.33),  -- AMHP-DF | planilha JULHO 32
  ('6378', '251a7dcb-9c8c-4692-9661-ee72409f2c3e'::uuid, 'f1887e02-9d2a-4616-a358-6890769ff7f9'::uuid, 336.07, 309.79),  -- AMHP-DF | planilha JULHO 42
  ('6380', '5708117c-c037-40b2-8229-b3a87e7fac80'::uuid, '1fc15b45-2a08-4e22-894a-33fe8b440648'::uuid, 2999.66, 2728.04),  -- AMHP-DF | planilha JULHO 64
  ('6382', 'f3c42784-4897-4e25-a128-3e255c0e3127'::uuid, 'eadef290-7c37-4575-b7c4-367a06f236c2'::uuid, 880.75, 836.22),  -- AMHP-DF | planilha JULHO 49
  ('6383', 'f7388f8e-9058-437f-88e8-e0f7e9e88f39'::uuid, '21660afa-51e8-4c80-9498-edf8c9e36c89'::uuid, 1538.95, 1418.39),  -- AMHP-DF | planilha JULHO 37
  ('6384', 'c2daf49d-9769-4c4a-9d3e-3c8e0ae31106'::uuid, '2cbece3f-6a8d-419e-aed2-1103f24111e6'::uuid, 181.72, 128.22),  -- AMHP-DF | planilha JULHO 29
  ('6405', '4e3c5f31-521c-4e12-99ac-4d7055001f5c'::uuid, 'b7b55874-6cac-4ede-bec9-2025704653c2'::uuid, 555.22, 531.34),  -- AMHP-DF | planilha JULHO 69
  ('6413', '2ee1d770-4949-45b6-9b8d-e87a757b2396'::uuid, 'b176d750-4909-4278-901a-432eacf1e864'::uuid, 20084.31, 18693.15),  -- SAUDE CAIXA | planilha AGOSTO 189
  ('6420', 'c71dc717-e980-4726-9f47-71e87cf93095'::uuid, '3bbcd7f6-74ab-4f8f-824b-dc8cce373cb1'::uuid, 826.20, 794.58),  -- AMHP-DF | planilha JULHO 53
  ('6454', '77f4ad60-4693-4ea1-b36c-591d6621b9ab'::uuid, '53bdf362-b357-41e3-a678-4fdc3f99c99a'::uuid, 1097.31, 1097.32),  -- POSTAL SAÚDE | planilha AGOSTO 165
  ('6478', '26460c33-2df7-4ba6-837d-0120072964b3'::uuid, 'c5014868-a147-42f6-8546-ab7b5d138194'::uuid, 1266.27, 822.76),  -- AMHP-DF | planilha AGOSTO 85
  ('6481', '63cf99d0-4aff-40bf-9d86-1a80f578e30c'::uuid, '77c7a02a-c192-42ab-ad80-5cf17ae19f37'::uuid, 2260.92, 2084.04),  -- AMHP-DF | planilha AGOSTO 52
  ('6486', '041a9fd4-ef3a-4b37-bbf0-73dcffcd1066'::uuid, 'b714b2a4-98f7-422d-96e2-018e9c53f7d6'::uuid, 6192.28, 5707.22),  -- AMHP-DF | planilha AGOSTO 37
  ('6488', '466c4757-186e-4ebf-9177-7762593b6e1d'::uuid, '74f7fa14-5be6-481a-b16b-4a21ad69965e'::uuid, 4155.01, 3944.99),  -- AMHP-DF | planilha AGOSTO 61
  ('6490', '1c33439f-6af7-4c8c-8d9c-71f7e823fe1e'::uuid, '636abda7-2bbe-4d9c-91c3-fbe575e06c52'::uuid, 1740.92, 1674.45),  -- AMHP-DF | planilha AGOSTO 31
  ('6491', 'db076381-9e04-4c41-8630-15d4cbe7c2cf'::uuid, '253f3464-48b2-42c2-9a2c-7eb8a5d9b531'::uuid, 1101.18, 1167.23),  -- AMHP-DF | planilha AGOSTO 57
  ('6492', '0ff56ccc-0f22-4293-ac95-38c194e4d0c0'::uuid, '8d258421-1d86-4a1e-9399-1cc7ef927cea'::uuid, 328.02, 213.43),  -- AMHP-DF | planilha AGOSTO 28
  ('6494', '598abe90-f75e-42f7-98c9-517fe4d351f6'::uuid, 'dcef53be-1b67-453b-9a84-3fb58b20ffdd'::uuid, 255.68, 255.72),  -- AMHP-DF | planilha AGOSTO 83
  ('6495', '4aff6fe3-8ba6-4268-a46c-3bbc342b2993'::uuid, 'aa2b6927-6bfd-4814-82d0-f48ee2195e3e'::uuid, 57.89, 59.12),  -- AMHP-DF | planilha AGOSTO 60
  ('6496', 'f60e95ec-80aa-4da1-8d75-9ae58b316c91'::uuid, '530cf841-dd6d-4060-a53c-9be06b004202'::uuid, 9672.76, 8626.49),  -- AMHP-DF | planilha AGOSTO 77
  ('6497', '74f64657-62d5-4491-9719-e386127beb23'::uuid, 'c4a9a6e8-3ee7-46cc-b9a8-1c40a1bb7255'::uuid, 1282.94, 1233.65),  -- AMHP-DF | planilha AGOSTO 73
  ('6511', '02f10f74-1c4c-4ab9-9580-6eca6cfa8da4'::uuid, '8747d8f8-be07-4f7a-9238-8d927f3e7e57'::uuid, 4510.06, 4118.24),  -- AMHP-DF | planilha AGOSTO 26
  ('6513', '3650fe24-af90-4644-b7fd-17e338ba9b1d'::uuid, '3c8024d4-b7cf-4cb9-b1f9-665bad5ab004'::uuid, 555.21, 531.34),  -- AMHP-DF | planilha AGOSTO 87
  ('6514', '13b4445c-2586-454e-8abf-d94c164aaa09'::uuid, 'd29ff565-ba5b-4ab1-8a5a-9b4bbef773d4'::uuid, 2311.69, 2222.88),  -- AMHP-DF | planilha AGOSTO 74
  ('6515', '60a204e2-b41e-4ef1-8306-79363238c2e9'::uuid, 'd0b72d0b-806d-442c-9847-56e54d095c84'::uuid, 1465.56, 1349.60),  -- AMHP-DF | planilha AGOSTO 68
  ('6518', '391e8b98-6c23-41af-9654-0fc00b089866'::uuid, '04a0c673-3d99-46ca-bfe5-5d676c7e8b16'::uuid, 767.04, 737.76),  -- AMHP-DF | planilha AGOSTO 32
  ('6519', 'f6e0447b-37de-4d77-a437-ece886b4b886'::uuid, '1e88f078-cf19-4d00-a0cc-49858fbd8def'::uuid, 90.85, 64.11),  -- AMHP-DF | planilha AGOSTO 29
  ('6520', '8666b7d7-fabc-4bf2-93c9-16a4d1e65cd7'::uuid, '2d99c985-9a95-49ad-95df-c81ffcf76503'::uuid, 676.86, 658.77),  -- AMHP-DF | planilha AGOSTO 65
  ('6521', '04fd2034-c2c2-4e25-8fe0-b31b5af2be50'::uuid, '251526cd-eb20-4685-be5e-56f40208ba24'::uuid, 2948.59, 2717.90),  -- AMHP-DF | planilha AGOSTO 53
  ('6522', '934934f2-fee5-40e2-a332-c0d8afaf1a77'::uuid, 'f6af9b1e-b24c-4789-af54-f921e4f6f340'::uuid, 144.06, 136.78),  -- AMHP-DF | planilha AGOSTO 62
  ('6523', 'be241c36-083b-4faf-a000-526fbdedae6c'::uuid, 'be766e5d-f131-4303-b934-012bdd0e0f71'::uuid, 1797.66, 1656.84),  -- AMHP-DF | planilha AGOSTO 40
  ('6525', '53d27242-45fb-47a3-a24c-facbf225a651'::uuid, 'f259e4a1-8edd-4076-9799-71e367a25096'::uuid, 176.26, 162.48),  -- AMHP-DF | planilha AGOSTO 38
  ('6532', '351631f9-89b6-4c2c-b1f9-9e48566e8a91'::uuid, '76a1ecc7-fc7d-42de-a5cc-bc27af86cb38'::uuid, 2243.59, 1426.77),  -- SAUDE CAIXA | planilha AGOSTO 192
  ('6533', '05f690a4-a28b-4303-ae1b-1715fabb7740'::uuid, '43f976ec-b694-47ce-9ad4-b7a1d8f2d10b'::uuid, 29818.07, 30495.81),  -- TJDFT | planilha AGOSTO 208
  ('6534', '36413656-f910-4dd9-ae75-cc9f445869bd'::uuid, '8f6e0af2-6d4d-4717-bd6b-28220287e9e3'::uuid, 10845.04, 10892.90),  -- TJDFT | planilha AGOSTO 211
  ('6546', 'b70aa63d-fe42-4ee9-bdbc-107411dd7e4b'::uuid, '4a4b71a5-a59d-4206-b005-69521e7c1712'::uuid, 146.62, 153.22),  -- TJDFT | planilha AGOSTO 209
  ('6547', '89356886-e80d-46ae-9b15-98ef9e02e9d6'::uuid, 'ef0ca27c-d6d1-4d4e-8fb9-93711d7adf3a'::uuid, 1797.22, 1656.62),  -- AMHP-DF | planilha AGOSTO 54
  ('6548', '5b15dce8-615b-4f82-bcb1-df76d92183ce'::uuid, '13bf6dce-4743-4a40-b07b-428fd72e7535'::uuid, 3601.99, 3215.96),  -- AMHP-DF | planilha AGOSTO 78
  ('6554', '4368b4c0-2b4a-4a87-af93-226801bf3949'::uuid, '1516ed3b-83dd-43a1-b71c-0e755fa0b736'::uuid, 1155.11, 1195.11),  -- TJDFT | planilha AGOSTO 213
  ('6562', 'dcb3fdf2-203b-4d3e-88c3-936ea0c81c87'::uuid, '3e600e27-7259-4d30-9939-0abbbc5c1257'::uuid, 41.92, 59.89),  -- BRADESCO SAUDE S/A 421715 | planilha AGOSTO 118
  ('6574', '3751b975-213b-4122-adef-ca26b2b816f0'::uuid, 'fabe0a8b-bcf6-4262-839a-8cecd6fa1b0f'::uuid, 17838.40, 18074.48),  -- PMDF | planilha AGOSTO 178
  ('6583', 'a87315c0-6e94-4d7a-9cd3-f29d51d8ab7c'::uuid, '57f5b1c9-f79f-4b70-ad7b-8809a0e5c5dd'::uuid, 3437.58, 3312.35),  -- AMHP-DF | planilha AGOSTO 33
  ('6586', 'afc71e2a-ddff-4ea1-aa67-1a30bd137eb0'::uuid, '99316d73-f3c0-47db-ab29-545ada68dcf9'::uuid, 2321.51, 1498.99),  -- AMHP-DF | planilha AGOSTO 30
  ('6589', '2d7999ae-20de-4ba7-b18e-cbf112021f34'::uuid, '0f5afa8e-2d73-4eb6-a59a-a76fce5bea60'::uuid, 1282.76, 969.14),  -- AMHP-DF | planilha AGOSTO 39
  ('6590', 'c5768843-2591-4af7-a30a-3fa6c52d182f'::uuid, '351bebd9-7039-4f6b-a737-dd7de6df1cd4'::uuid, 676.86, 658.77),  -- AMHP-DF | planilha AGOSTO 66
  ('6591', '64ecb04a-36bb-4996-bdf6-0155f4f20707'::uuid, '79a13e60-a777-4c15-a152-39606332037c'::uuid, 697.70, 670.93),  -- AMHP-DF | planilha AGOSTO 69
  ('6593', 'b181e218-60a1-4a3b-b195-960a07761150'::uuid, '6355f215-ac32-4098-a866-e9281413c1c8'::uuid, 2610.92, 2245.79),  -- AMHP-DF | planilha AGOSTO 79
  ('6594', 'ed2afe0e-597b-42c8-a84b-8ffdca75cecf'::uuid, 'd800d9b7-cdfa-4b40-ba29-ebd1735be689'::uuid, 152.40, 146.56),  -- AMHP-DF | planilha AGOSTO 76
  ('6595', 'd87ea9fb-2409-48e5-b352-d870484b6b9b'::uuid, 'db27e662-a42a-44ba-b8d3-8a01dfb3ed04'::uuid, 1693.19, 423.19),  -- AMHP-DF | planilha AGOSTO 49
  ('6600', '556a7b8f-96ea-4b95-bdac-db554166dbe7'::uuid, '247cbc77-c833-4031-8549-1988f5731feb'::uuid, 898.83, 679.40),  -- AMHP-DF | planilha AGOSTO 41
  ('6607', '6fc2b786-198a-4702-a0a9-c9f34711b987'::uuid, 'c9be3046-72d9-42dc-9c77-6b5a88790527'::uuid, 15771.18, 14532.90),  -- LAB PLANASSISTE | planilha AGOSTO 185
  ('6609', '3c1462f6-5647-4444-a59d-77f1d8004681'::uuid, '21715234-9b7b-47af-a52e-bf9a8649b136'::uuid, 20591.17, 20584.31),  -- BRADESCO SAUDE  - 005711 | planilha AGOSTO 119
  ('6616', '45a591b2-7bd4-4947-a141-5cf58d464e9d'::uuid, '964cd215-7b22-45dd-af87-e662e5a7046f'::uuid, 2319.07, 2138.57),  -- AMHP-DF | planilha AGOSTO 80
  ('6623', '48d8ecfb-0f8f-40e1-b154-ee64a21e8f4e'::uuid, 'e21920b1-de7d-4f10-a1f7-31a75257869a'::uuid, 1327.38, 1174.77),  -- AMHP-DF | planilha AGOSTO 27
  ('6627', '13a5b273-95f2-4d16-9499-9decf4b24e8a'::uuid, 'b767b89e-aa46-461f-8d14-45621f6e8032'::uuid, 645.66, 620.91),  -- AMHP-DF | planilha AGOSTO 34
  ('6629', 'e0de5ca0-0897-471c-9034-eaf117df33c8'::uuid, 'b29fffae-27d0-44c8-b0fc-44e44a00f5a4'::uuid, 2948.59, 2717.90),  -- AMHP-DF | planilha AGOSTO 55
  ('6630', 'c3d52948-972a-4672-ba86-5c9ac3fccb54'::uuid, '390f6162-b06b-4574-9eb6-eea7b15ed826'::uuid, 1707.91, 1676.74),  -- AMHP-DF | planilha AGOSTO 64
  ('6633', '025b2068-3990-4575-b032-2aa2435fad6e'::uuid, 'f5b7b1d1-50c3-4798-b492-5e4120d7240c'::uuid, 63.92, 63.93),  -- AMHP-DF | planilha AGOSTO 84
  ('6634', 'c418b242-3342-465e-88e2-4a857262e81b'::uuid, 'a958c2d8-bde4-46a3-b47f-dc50c4adc994'::uuid, 1186.49, 707.75),  -- AMHP-DF | planilha AGOSTO 35
  ('6635', '82357283-4ebb-406d-8da5-d5b1073057a8'::uuid, 'afd72379-a65e-4cce-b336-276ccf62304c'::uuid, 5543.57, 5543.60),  -- AMHP-DF | planilha AGOSTO 59
  ('6636', '61de89bb-13e8-4043-80a0-57f078234083'::uuid, '44a3bbfd-65ac-4ad2-b621-749415e89395'::uuid, 1850.25, 1775.42),  -- AMHP-DF | planilha AGOSTO 81
  ('6639', '14e4242c-20db-44bf-aeff-483060758137'::uuid, 'cfff3201-ac30-4f26-92c7-56a44ddc3fbd'::uuid, 19990.14, 19990.17),  -- SUL AMERICA COMPANHIA DE SEGURO SAÚDE | planilha AGOSTO 203
  ('6642', 'f3eeef2d-40fc-4f9b-b113-f15d5b42f85e'::uuid, 'b1d0776f-a863-4702-8618-b5d0858ae225'::uuid, 1256.51, 1158.25),  -- AMHP-DF | planilha AGOSTO 56
  ('6643', '9080d66a-8ad5-44d7-9b8d-9d504d5fc76c'::uuid, '709df1d5-f75b-4863-a3d4-34e07eb3f085'::uuid, 1050.84, 723.54),  -- AMHP-DF | planilha AGOSTO 46
  ('6645', '3b3d7f11-b464-439d-94f6-692c89868a0c'::uuid, '33e098fc-d1e8-44df-a1a3-267913dda028'::uuid, 536.04, 515.49),  -- AMHP-DF | planilha AGOSTO 70
  ('6646', '4b866560-42ca-45df-9ea2-595049203433'::uuid, '9be1b6b2-94f5-4a64-974a-1d715fff8652'::uuid, 767.04, 737.76),  -- AMHP-DF | planilha AGOSTO 36
  ('6647', 'e002821b-a6a3-4161-96ab-f04f3a86f7dc'::uuid, '43c7c3f0-50be-41fe-86f7-91a042a9fc38'::uuid, 1244.80, 1200.34),  -- AMHP-DF | planilha AGOSTO 71
  ('6648', 'e1c389c9-795c-4f9c-899d-1216e44bd520'::uuid, '77ceabe4-a3e3-41a7-b99b-cfd928daf43d'::uuid, 484.13, 445.02),  -- AMHP-DF | planilha AGOSTO 88
  ('6649', 'ea6db329-dc7d-42d1-a0a5-ec52a67185d6'::uuid, '670c4aaa-8cb6-435c-bc0f-743255ac63dd'::uuid, 76.20, 73.28),  -- AMHP-DF | planilha AGOSTO 72
  ('6735', '5526c914-529f-4c97-b666-12a35ea440c1'::uuid, '410848c3-9e14-4402-bb00-17ca588952fb'::uuid, 6108.92, 6111.58),  -- AMHP-DF | planilha SETEMBRO 52
  ('6738', '660de29f-bbea-41e7-8458-fe059bda03af'::uuid, '721e79da-d37e-4317-9185-e8bb08feb3cb'::uuid, 5156.16, 5069.67),  -- AMHP-DF | planilha SETEMBRO 32
  ('6745', '5d9a88ac-a551-4f23-b43c-5e2d91ba5588'::uuid, '51af229a-66aa-4b50-be7f-6492e3cb9741'::uuid, 4558.85, 4384.75),  -- AMHP-DF | planilha SETEMBRO 30
  ('6752', '54ff0c02-0ece-4184-b7db-0b51ea9bcc06'::uuid, '0ae44209-8e6b-4cad-8452-fb7249301958'::uuid, 2260.92, 2084.04),  -- AMHP-DF | planilha SETEMBRO 34
  ('6755', '878a8a80-6a23-41a1-876c-745515e20917'::uuid, 'ea1a235d-a27d-4ae1-be90-98ec29ce602d'::uuid, 927.53, 957.45),  -- AMHP-DF | planilha SETEMBRO 38
  ('6756', '1179912f-00e8-46d4-b7c3-2d648df15fc5'::uuid, '656abfad-8cd9-4a22-8ba9-03cf303a11d7'::uuid, 422.17, 387.50),  -- AMHP-DF | planilha SETEMBRO 26
  ('6757', '1d667f6a-4f53-4fe5-bd55-8601be713fda'::uuid, '472dc855-2b1f-4767-a998-ecb93e248ad6'::uuid, 806.64, 753.10),  -- AMHP-DF | planilha SETEMBRO 57
  ('6758', '748de301-02bb-4d9f-b35a-821074bcedd8'::uuid, 'd568b724-7817-4676-ade1-285e23545866'::uuid, 272.55, 219.07),  -- AMHP-DF | planilha SETEMBRO 28
  ('6759', 'ad86a9b7-0e9e-445b-9358-a4b89ca5a748'::uuid, 'a3d0adfb-07ce-408a-a6ab-03393f805ba9'::uuid, 1414.02, 1376.22),  -- AMHP-DF | planilha SETEMBRO 43
  ('6762', '17906e5b-7fb7-49f7-a647-12337e7fd6be'::uuid, 'cb686fd7-b5a1-4911-ac07-a5c2fa93e7bd'::uuid, 1028.75, 989.23),  -- AMHP-DF | planilha SETEMBRO 50
  ('6763', '172c25a3-0322-4f3d-9a4a-4e6c2fc02663'::uuid, '2bcc82db-2475-442b-8e03-fc4fc4854e89'::uuid, 5175.84, 4977.89),  -- AMHP-DF | planilha SETEMBRO 45
  ('6764', '0e56fe4f-8b0d-4973-a57e-e3170d00a246'::uuid, '9b276c7c-23a5-4104-bfae-5249f2faf41a'::uuid, 62.28, 59.89),  -- AMHP-DF | planilha SETEMBRO 46
  ('6767', '4890f359-eaea-4cb8-be74-67fb3faa2f92'::uuid, 'c133e846-35b1-4635-b5c3-c7e52e3145a1'::uuid, 1463.20, 1366.12);  -- AMHP-DF | planilha SETEMBRO 27

-- Se qualquer título deixou de cumprir as condições desde a conferência
-- (baixa, glosa, lote novo, valor editado), para tudo em vez de corrigir
-- parte: rode a conferência de novo e regenere a lista.
DO $$
DECLARE v_problema TEXT;
BEGIN
  SELECT string_agg(t.aplis_id, ', ' ORDER BY t.aplis_id) INTO v_problema
    FROM _valor_aplis t
    JOIN lotes l ON l.id_lote = t.id_lote AND l.aplis_id = t.aplis_id
    JOIN notas n ON n.id_nota = t.id_nota
   WHERE l.valor_total <> t.valor_atual
      OR n.valor_total <> t.valor_atual
      OR n.status <> 'aberta'
      OR COALESCE(n.valor_recebido, 0) <> 0
      OR COALESCE(n.valor_glosado, 0) <> 0
      OR n.criado_por IS NOT NULL
      OR EXISTS (SELECT 1 FROM glosas g WHERE g.nota_id = n.id_nota)
      OR EXISTS (SELECT 1 FROM recebimentos r WHERE r.nota_id = n.id_nota
                  AND (r.status <> 'previsto' OR COALESCE(r.valor_recebido, 0) <> 0))
      OR (SELECT COUNT(*) FROM nota_lote nl WHERE nl.id_nota = n.id_nota) <> 1
      OR NOT EXISTS (SELECT 1 FROM nota_lote nl WHERE nl.id_nota = t.id_nota AND nl.id_lote = t.id_lote);
  IF v_problema IS NOT NULL THEN
    RAISE EXCEPTION 'Título(s) mudaram desde a conferência de 28/09, lote(s): %', v_problema;
  END IF;
  IF (SELECT COUNT(*) FROM _valor_aplis t JOIN lotes l ON l.id_lote = t.id_lote) <> 123 THEN
    RAISE EXCEPTION 'Esperados 123 lotes; algum não foi encontrado.';
  END IF;
END $$;

UPDATE lotes l
   SET valor_total = t.valor_aplis, updated_at = NOW()
  FROM _valor_aplis t
 WHERE l.id_lote = t.id_lote;

UPDATE notas n
   SET valor_total = t.valor_aplis, updated_at = NOW()
  FROM _valor_aplis t
 WHERE n.id_nota = t.id_nota;

UPDATE recebimentos r
   SET valor_previsto = t.valor_aplis, updated_at = NOW()
  FROM _valor_aplis t
 WHERE r.nota_id = t.id_nota
   AND r.status = 'previsto'
   AND r.valor_previsto = t.valor_atual;

-- Status do título a partir dos valores novos (mesma função da tela).
SELECT public.fat_recalcular_nota(t.id_nota) FROM _valor_aplis t;

DROP TABLE _valor_aplis;

COMMIT;
