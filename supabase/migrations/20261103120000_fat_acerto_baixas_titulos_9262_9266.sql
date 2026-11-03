-- ============================================================================
-- Contas a Receber: baixas dos títulos 9262 e 9266 acertadas pelo apLIS (03/11/2026)
--
-- As duas baixas foram lançadas à mão (14/10/2026) com o valor cheio do título,
-- sem descontar a glosa do apLIS — o título ficou "recebida" com saldo zero e a
-- conferência apontou "recebido a mais no sistema". O recebido de fato é o do
-- apLIS (Σ fatrequisicaoprocedimento.ValorRecebido dos lotes, lido em 03/11):
--
--   9262 | lote 6500 | BRADESCO SAUDE - 005711 | 31355,06 → 29990,20 (glosa 1364,86, 4 requisições)
--   9266 | lote 6503 | BRADESCO SAUDE S/A 421715 | 14899,77 → 13859,52 (glosa 1040,25, req. 0200062098001)
--
-- Só o valor_recebido da baixa muda; a data fica a que o operador lançou.
-- O título é recalculado pelo gatilho de recebimentos (fat_recalcular_nota).
-- Ids de produção: a conferência antes aborta se a baixa não estiver como foi
-- lida — no projeto de teste, ou se alguém já corrigiu pela tela.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_errados TEXT;
BEGIN
  SELECT string_agg(e.id::text, ', ')
    INTO v_errados
    FROM (VALUES
      ('08cd4ac1-61ba-43e0-b795-a7b481ef5c3f'::uuid, 31355.06),
      ('a8dee38f-7022-485d-9733-c759dff95f7a'::uuid, 14899.77)
    ) AS e(id, recebido)
    LEFT JOIN recebimentos r ON r.id_receb = e.id
   WHERE r.id_receb IS NULL OR r.valor_recebido <> e.recebido;
  IF v_errados IS NOT NULL THEN
    RAISE EXCEPTION 'Acerto das baixas 9262/9266: baixas fora do esperado: %', v_errados;
  END IF;
END $$;

-- 9262 | BRADESCO SAUDE - 005711 | lote 6500
UPDATE recebimentos
   SET valor_recebido = 29990.20,
       observacoes = 'Valor acertado pelo apLIS em 03/11/2026 (era 31.355,06, sem descontar a glosa de 1.364,86)'
 WHERE id_receb = '08cd4ac1-61ba-43e0-b795-a7b481ef5c3f';

-- 9266 | BRADESCO SAUDE S/A 421715 | lote 6503
UPDATE recebimentos
   SET valor_recebido = 13859.52,
       observacoes = 'Valor acertado pelo apLIS em 03/11/2026 (era 14.899,77, sem descontar a glosa de 1.040,25)'
 WHERE id_receb = 'a8dee38f-7022-485d-9733-c759dff95f7a';

DO $$
DECLARE
  v_errados TEXT;
BEGIN
  SELECT string_agg(e.id::text, ', ')
    INTO v_errados
    FROM (VALUES
      ('7f6ee338-1b8e-4f64-918a-f358d7c05003'::uuid, 29990.20),
      ('fc6f1f70-dcfb-4d0f-baca-19b0cfa2aea1'::uuid, 13859.52)
    ) AS e(id, recebido)
    LEFT JOIN notas n ON n.id_nota = e.id
   WHERE n.id_nota IS NULL OR n.valor_recebido <> e.recebido;
  IF v_errados IS NOT NULL THEN
    RAISE EXCEPTION 'Acerto das baixas 9262/9266: títulos não recalculados: %', v_errados;
  END IF;
END $$;

COMMIT;
