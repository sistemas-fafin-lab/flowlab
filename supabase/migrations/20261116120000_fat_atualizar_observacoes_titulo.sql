-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: editar a observação do título depois da criação.
--
-- `notas.observacoes` só era preenchida no "Novo título" manual; os títulos que
-- nascem dos lotes do apLIS ficavam sem ela, e o "Editar título" não tinha onde
-- escrever. Sem isso, a faturista lançava uma baixa de R$ 0,01 só para guardar
-- o número do chamado aberto no site do convênio — dinheiro falso no título.
--
-- A troca entra no histórico do título (notas_lancamentos_audit_logs) com
-- entidade 'titulo', campo 'observacoes', antes e depois.
--
-- Depende de 20260807130000_contas_receber_rpcs.sql (fat_exigir_permissao_gestao)
-- e de 20261014120000_fat_corrigir_lancamentos.sql (auditoria).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE notas_lancamentos_audit_logs
  DROP CONSTRAINT IF EXISTS notas_lancamentos_audit_logs_entidade_check;
ALTER TABLE notas_lancamentos_audit_logs
  ADD CONSTRAINT notas_lancamentos_audit_logs_entidade_check
  CHECK (entidade IN ('baixa', 'glosa', 'titulo'));

CREATE OR REPLACE FUNCTION public.fat_atualizar_observacoes_titulo(p_id_nota UUID, p_observacoes TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_anterior TEXT;
  v_nova TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  -- Vazio limpa a observação.
  v_nova := NULLIF(TRIM(p_observacoes), '');

  SELECT status, observacoes INTO v_status, v_anterior
    FROM notas
   WHERE id_nota = p_id_nota
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita edição da observação.';
  END IF;

  IF v_anterior IS NOT DISTINCT FROM v_nova THEN
    RETURN;
  END IF;

  -- O trigger_notas_updated_at também mexe em updated_at, como já acontece na
  -- troca do número da nota.
  UPDATE notas SET observacoes = v_nova WHERE id_nota = p_id_nota;

  PERFORM fat_auditar_lancamento(p_id_nota, NULL, NULL, 'titulo', 'alteracao', 'observacoes',
                                 v_anterior, v_nova, NULL, 'Observação do título editada');
END;
$$;

COMMENT ON FUNCTION public.fat_atualizar_observacoes_titulo(UUID, TEXT) IS
  'Grava (ou limpa, com vazio) a observação de um título e registra a troca no histórico. Rejeita título cancelado.';

REVOKE ALL ON FUNCTION public.fat_atualizar_observacoes_titulo(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_atualizar_observacoes_titulo(UUID, TEXT) TO authenticated;
