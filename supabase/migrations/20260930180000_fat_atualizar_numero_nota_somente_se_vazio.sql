-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: modo "só se estiver vazio" no preenchimento do número da nota
-- (faturamento-titulos-automaticos, issue 03 — base do preenchimento de NF pelo
-- "Atualizar do apLIS", que não pode sobrescrever um número digitado entre a
-- prévia e a confirmação).
--
-- Substitui 20260831140000_fat_atualizar_numero_nota.sql. DROP + CREATE em vez
-- de CREATE OR REPLACE: a assinatura nova (3 argumentos) criaria um overload e o
-- PostgREST recusaria a chamada de 2 argumentos por ambiguidade; trocar o
-- retorno de void para TEXT também exige o DROP.
--
-- Retorno: 'atualizado' quando gravou; 'ja-preenchido' quando p_somente_se_vazio
-- está ligado e o título já tinha número (nada muda). Sem o modo, o
-- comportamento é o da edição manual: substitui o número existente.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.fat_atualizar_numero_nota(UUID, TEXT);

CREATE FUNCTION public.fat_atualizar_numero_nota(
  p_id_nota UUID,
  p_numero_nota TEXT,
  p_somente_se_vazio BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_numero TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  -- Nunca apaga um número já salvo: só substitui por outro valor não vazio.
  v_numero := NULLIF(TRIM(p_numero_nota), '');
  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Informe o número da nota.';
  END IF;

  SELECT status INTO v_status FROM notas WHERE id_nota = p_id_nota;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita edição do número da nota.';
  END IF;

  -- updated_at fica a cargo do trigger_notas_updated_at (20260320_billing_module.sql).
  IF COALESCE(p_somente_se_vazio, FALSE) THEN
    -- Atômico: a condição de vazio fica no próprio UPDATE, sem ler-e-depois-
    -- gravar, para não sobrescrever um número digitado em paralelo na tela de
    -- edição. Número só com espaços conta como vazio.
    UPDATE notas
       SET numero_nota = v_numero
     WHERE id_nota = p_id_nota
       AND NULLIF(TRIM(numero_nota), '') IS NULL;
    IF NOT FOUND THEN
      RETURN 'ja-preenchido';
    END IF;
  ELSE
    UPDATE notas SET numero_nota = v_numero WHERE id_nota = p_id_nota;
  END IF;
  RETURN 'atualizado';
END;
$$;

COMMENT ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN) IS
  'Preenche ou corrige o número da nota de um título já existente. Rejeita valor vazio e título com status cancelada. '
  'Com p_somente_se_vazio, só grava se o título não tem número e retorna ''ja-preenchido'' caso contrário; senão retorna ''atualizado''.';

REVOKE ALL ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT, BOOLEAN) TO authenticated;
