-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: preencher/corrigir o número da nota depois da criação
-- (issue 33 do feedback do setor de faturamento, 31/08 — follow-up da issue 32,
-- que tornou numero_nota opcional na criação do título).
--
-- Depende de 20260807130000_contas_receber_rpcs.sql (fat_exigir_permissao_gestao)
-- e de 20260831120000_notas_numero_nota_opcional.sql (numero_nota nullable).
--
-- Mesmo padrão SECURITY DEFINER das demais RPCs fat_*: a RLS de `notas` exige
-- canManageBilling para UPDATE, então o guard fica na função em vez de deixar o
-- INVOKER esbarrar na policy.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fat_atualizar_numero_nota(p_id_nota UUID, p_numero_nota TEXT)
RETURNS void
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
  UPDATE notas SET numero_nota = v_numero WHERE id_nota = p_id_nota;
END;
$$;

COMMENT ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT) IS
  'Preenche ou corrige o número da nota de um título já existente. Rejeita valor vazio e título com status cancelada.';

REVOKE ALL ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fat_atualizar_numero_nota(UUID, TEXT) TO authenticated;
