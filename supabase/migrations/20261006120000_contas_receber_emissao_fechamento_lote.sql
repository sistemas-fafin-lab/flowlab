-- ============================================================================
-- Contas a Receber: emissão do título = fechamento do lote no apLIS.
--
-- O "faturado do mês" que o cliente confere é o dos lotes FATURADOS (fechados)
-- no apLIS — a "Data Faturamento" da planilha do setor, já usada no backfill do
-- 1º semestre. Desde 1f363aa (24/09) o padrão do "Novo título" e do "Atualizar
-- do apLIS" era a data de CRIAÇÃO do lote, o que jogava em setembro lotes
-- criados em setembro e fechados em outubro: o dashboard mostrava R$ 92.928,52
-- de faturado em out/2026, contra ~R$ 298 mil na planilha.
--
-- O código passa a usar o fechamento (o mais recente, com vários lotes). Esta
-- migration corrige os 56 títulos criados no sistema cuja emissão ainda é a
-- criação do lote (o padrão antigo) — conferido contra fatlote em 06/10:
--   2026-06 → 2026-09   1 título(s)  439.13
--   2026-08 → 2026-08   2 título(s)  26010.55
--   2026-08 → 2026-09   1 título(s)  2664.98
--   2026-09 → 2026-09  27 título(s)  304483.87
--   2026-09 → 2026-10  19 título(s)  179009.45
--   2026-10 → 2026-10   6 título(s)  37881.77
--
-- Ficam de fora: títulos do backfill (a data veio da planilha) e títulos cuja
-- emissão foi escolhida à mão (não bate com a criação do lote). Só atualiza se
-- a emissão ainda for a de 06/10; a competência acompanha quando era o mês da
-- emissão antiga. Vencimento não muda: sai do RPS ou do envio, não da emissão.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _emissao_fechamento (
  id_nota        UUID PRIMARY KEY,
  emissao_atual  DATE NOT NULL,
  emissao_nova   DATE NOT NULL
);

INSERT INTO _emissao_fechamento (id_nota, emissao_atual, emissao_nova) VALUES
  ('db5fa488-a763-420d-98a9-17ad79a48679'::uuid, '2026-08-12', '2026-08-13'),  -- lote 6526+6537
  ('4b324323-8f90-431f-9e39-10954cd0c09f'::uuid, '2026-08-28', '2026-08-27'),  -- lote 6665
  ('99091038-0122-4c6c-8385-ce2bd77c99d4'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6746
  ('781c5230-0745-4305-afc0-f08257afd7c4'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6747
  ('e5204e61-9461-4b97-accf-3155fc058b6f'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6748
  ('c9a7a326-00ff-4428-a1dd-54c1bab32d3b'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6749
  ('bf6bdf1c-350a-4dde-86c5-3d175328fcf7'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6750
  ('974e8fec-38bf-48d8-8b5c-ddc00260dc8f'::uuid, '2026-09-10', '2026-09-11'),  -- lote 6751
  ('0c811ea2-75b2-419e-a4f0-5ddc4a08d509'::uuid, '2026-09-11', '2026-09-14'),  -- lote 6770
  ('f0bd2fbf-8980-410e-9659-c3416090e9ef'::uuid, '2026-09-11', '2026-09-14'),  -- lote 6772
  ('d3b9e8d7-4415-404b-9014-24914e301e1b'::uuid, '2026-09-14', '2026-09-15'),  -- lote 6780
  ('34318530-ddac-416b-8431-10cc96b4749f'::uuid, '2026-09-14', '2026-09-15'),  -- lote 6782
  ('4f3dcc94-1284-4b6a-b8a0-9336ae75238a'::uuid, '2026-09-14', '2026-09-15'),  -- lote 6783
  ('85748b53-e138-492e-926c-af1520210754'::uuid, '2026-09-09', '2026-09-16'),  -- lote 6741
  ('1c1cae8f-d645-4536-8559-bd025957fa26'::uuid, '2026-09-14', '2026-09-17'),  -- lote 6778
  ('e6897202-296f-490d-997b-2749b9bc2428'::uuid, '2026-09-16', '2026-09-17'),  -- lote 6796
  ('50cc84c8-8995-438f-978d-7d3e162635b4'::uuid, '2026-09-16', '2026-09-17'),  -- lote 6798
  ('a4b5b3ce-57ea-479e-a63e-1d0a37176ce9'::uuid, '2026-09-17', '2026-09-18'),  -- lote 6804
  ('36f8c1e7-05d5-4f5c-90b9-6805e525ff16'::uuid, '2026-09-14', '2026-09-21'),  -- lote 6776
  ('c9d15868-9c1b-4ddc-9fff-00417467aa29'::uuid, '2026-09-18', '2026-09-21'),  -- lote 6812
  ('9652f8d0-75f0-455a-b4ab-006177dd9a82'::uuid, '2026-09-21', '2026-09-22'),  -- lote 6818
  ('a2c63094-7acf-44ea-b8d7-8054e51d2e15'::uuid, '2026-06-22', '2026-09-24'),  -- lote 6130
  ('ddad5bf3-39e3-46fa-9a4d-63ccb5380257'::uuid, '2026-08-14', '2026-09-24'),  -- lote 6549
  ('85ee11e5-d393-42d4-9538-19cfe3d34809'::uuid, '2026-09-23', '2026-09-24'),  -- lote 6850
  ('fb9ec2da-db59-44b9-8f4c-f81200fb955c'::uuid, '2026-09-24', '2026-09-25'),  -- lote 6856
  ('99794820-6f00-4ede-b629-d843c42a1da9'::uuid, '2026-09-22', '2026-09-28'),  -- lote 6841
  ('d7ef911d-2df3-4bf9-9e05-f9c536f6e6b1'::uuid, '2026-09-22', '2026-09-28'),  -- lote 6844
  ('598831c3-ba30-4881-8139-b092b2c93994'::uuid, '2026-09-22', '2026-09-30'),  -- lote 6840
  ('d697a96c-e875-463f-836e-25c128846f54'::uuid, '2026-09-22', '2026-09-30'),  -- lote 6842
  ('ea9277ff-48d5-4f86-8eed-3291a94892a7'::uuid, '2026-09-22', '2026-09-30'),  -- lote 6843
  ('fe8755e9-f3e6-4721-8927-d9bb65c952f6'::uuid, '2026-09-28', '2026-09-30'),  -- lote 6867
  ('6ca5fd99-2ccd-40c4-8fcf-7a51608249a3'::uuid, '2026-09-18', '2026-10-01'),  -- lote 6805
  ('ed5ad02b-982f-488f-8299-bd669664c278'::uuid, '2026-09-22', '2026-10-01'),  -- lote 6823
  ('0ded7308-f596-4abb-ac8e-33631042e186'::uuid, '2026-09-22', '2026-10-01'),  -- lote 6825
  ('bde15068-a201-449d-83a2-368545f5c8ca'::uuid, '2026-09-22', '2026-10-01'),  -- lote 6826
  ('8ac38cb2-5fd5-4ba5-a178-380130387b53'::uuid, '2026-09-23', '2026-10-01'),  -- lote 6849
  ('10d17a53-04cb-495f-b2b3-3c8399baf2dc'::uuid, '2026-09-23', '2026-10-01'),  -- lote 6851
  ('5479bba9-c87b-43c8-9988-f13d6e2e01c6'::uuid, '2026-09-28', '2026-10-01'),  -- lote 6869
  ('3bea76b8-9abf-4959-90bb-60f2735858e1'::uuid, '2026-09-28', '2026-10-01'),  -- lote 6872
  ('0e7ac70f-410f-47de-bf97-3ad207093e3d'::uuid, '2026-09-28', '2026-10-01'),  -- lote 6873
  ('499436a1-ed0f-4478-9600-f15d95c2309a'::uuid, '2026-09-29', '2026-10-01'),  -- lote 6890
  ('da47ec54-93ba-4340-ad2f-14099e49beed'::uuid, '2026-09-29', '2026-10-01'),  -- lote 6896
  ('afa431d7-65e6-4eeb-bc6e-63042d98f914'::uuid, '2026-09-29', '2026-10-01'),  -- lote 6897
  ('81ebfcba-68d3-43a2-8470-acac486ceec9'::uuid, '2026-09-29', '2026-10-01'),  -- lote 6898
  ('c76627ab-e1eb-4c57-9ebf-6eb5dfdd3032'::uuid, '2026-09-30', '2026-10-01'),  -- lote 6907
  ('f88fc0f2-9be1-41cd-94cd-b5b933293535'::uuid, '2026-09-30', '2026-10-01'),  -- lote 6908
  ('963a4537-853d-44e3-8712-aa825d64c173'::uuid, '2026-09-30', '2026-10-01'),  -- lote 6909
  ('ee27e4ff-e3a8-453c-8f53-c3bdc9a68880'::uuid, '2026-09-29', '2026-10-02'),  -- lote 6899
  ('6cf06303-c3b8-4e20-ba40-a1e3512d9e78'::uuid, '2026-09-29', '2026-10-02'),  -- lote 6900
  ('55d6c747-7970-4402-bbc7-c822e6e8805a'::uuid, '2026-09-29', '2026-10-02'),  -- lote 6901
  ('de60531d-1a88-4384-9853-61b67f55d000'::uuid, '2026-10-01', '2026-10-02'),  -- lote 6913
  ('939de916-9d7b-4e71-bdc3-bfa18287ed8e'::uuid, '2026-10-01', '2026-10-02'),  -- lote 6917
  ('5e90f75a-1153-49df-806f-3902a6062ef5'::uuid, '2026-10-01', '2026-10-02'),  -- lote 6919
  ('c3e27f9f-0a03-44c3-93d2-2a0377808734'::uuid, '2026-10-02', '2026-10-05'),  -- lote 6929
  ('227fc027-7030-4687-925b-5e83b8f1da5f'::uuid, '2026-10-02', '2026-10-05'),  -- lote 6930
  ('20520351-b3ec-4360-9227-9102b4e35188'::uuid, '2026-10-02', '2026-10-05');  -- lote 6931

DO $$
DECLARE
  v_pulados TEXT;
BEGIN
  SELECT string_agg(t.id_nota::text, ', ') INTO v_pulados
    FROM _emissao_fechamento t
    LEFT JOIN notas n ON n.id_nota = t.id_nota
   WHERE n.id_nota IS NULL OR n.data_emissao <> t.emissao_atual;
  IF v_pulados IS NOT NULL THEN
    RAISE NOTICE 'Títulos removidos ou com emissão alterada desde 06/10, não mexidos: %', v_pulados;
  END IF;
END $$;

UPDATE notas n
   SET data_emissao = t.emissao_nova,
       competencia  = CASE WHEN n.competencia = to_char(t.emissao_atual, 'YYYY-MM')
                           THEN to_char(t.emissao_nova, 'YYYY-MM')
                           ELSE n.competencia END,
       updated_at   = NOW()
  FROM _emissao_fechamento t
 WHERE n.id_nota = t.id_nota
   AND n.data_emissao = t.emissao_atual;

DROP TABLE _emissao_fechamento;

COMMIT;
