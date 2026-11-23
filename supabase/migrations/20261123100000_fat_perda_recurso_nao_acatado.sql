-- Faturamento: "Recurso não acatado" (status 15 do apLIS) é perda definitiva da glosa.
--
-- Até aqui só 18 ("Recebido a menor – acatado") e 8 ("Glosa definitiva – acatada
-- diretoria") saíam do saldo. O 15 não estava nem na perda nem na glosa em disputa
-- (6, 7, 16): o líquido − recebido dessas requisições ficava no saldo cobrável e o
-- título aparecia em atraso (ex.: CASSI, lote 4863, R$ 227,89 com 278 dias). Decisão
-- do faturamento (23/11/2026): recurso negado pela operadora é perda definitiva —
-- sai do saldo e entra na Glosa acatada (notas.valor_glosa_acatada). O Dashboard de
-- Glosas e Recursos continua mostrando o 15 como "indeferido", separado da acatada.
--
-- Lista: STATUS_PERDA_DEFINITIVA em api/_lib/faturamento/recursoGlosa.ts.

CREATE OR REPLACE FUNCTION public.fat_glosa_acatada_nota(p_nota_id UUID)
RETURNS DECIMAL(15, 2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(r.liquido - r.recebido), 0)::DECIMAL(15, 2)
    FROM glosa_recurso_requisicoes r
   WHERE r.status_aplis IN (18, 8, 15)
     AND r.id_lote_faturamento IN (
       -- IN já ignora duplicata: o mesmo lote do apLIS vinculado duas vezes ao
       -- título (dois snapshots em `lotes`) não conta em dobro.
       SELECT l.aplis_id::INTEGER
         FROM nota_lote nl
         JOIN lotes l ON l.id_lote = nl.id_lote
        WHERE nl.id_nota = p_nota_id
          AND l.aplis_id ~ '^[0-9]{1,9}$'
     );
$$;

COMMENT ON FUNCTION public.fat_glosa_acatada_nota(UUID) IS
  'Perda definitiva da glosa nos lotes do título: status 18, 8 e 15 da foto do apLIS, líquido − recebido.';

COMMENT ON COLUMN public.notas.valor_glosa_acatada IS
  'Perda definitiva da glosa no apLIS nos lotes do título: Σ líquido − recebido das requisições da foto em 18, 8 ou 15. Mantida por fat_recalcular_nota; é o que sai do saldo.';

REVOKE ALL ON FUNCTION public.fat_glosa_acatada_nota(UUID) FROM PUBLIC, anon, authenticated;

-- ─── Carga: só os títulos com requisição em 15 ───────────────────────────────
DO $$
DECLARE
  v_nota UUID;
BEGIN
  FOR v_nota IN
    SELECT DISTINCT nl.id_nota
      FROM glosa_recurso_requisicoes r
      JOIN lotes l ON l.aplis_id = r.id_lote_faturamento::TEXT
      JOIN nota_lote nl ON nl.id_lote = l.id_lote
     WHERE r.status_aplis = 15
  LOOP
    PERFORM fat_recalcular_nota(v_nota);
  END LOOP;
END $$;
