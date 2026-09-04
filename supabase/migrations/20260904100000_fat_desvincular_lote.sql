-- ═══════════════════════════════════════════════════════════════════════════════
-- Título: desvincular lote depois de criado (issue 46 do feedback do setor de
-- faturamento, 03/09 — triagem em 04/09).
--
-- Escopo decidido na triagem: só correção de erro (remover um lote incluído
-- por engano), nunca adicionar — "vincular" fica de fora até haver caso de uso
-- real. Bloqueia completamente se o título já tem baixa registrada (mudaria um
-- valor já recebido) e exige motivo, como a issue 44 fez para as exceções de
-- operadora.
--
-- Depende de 20260807120000_contas_receber.sql (fat_recalcular_nota,
-- nota_lote) e 20260807130000_contas_receber_rpcs.sql (fat_exigir_permissao_gestao).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Auditoria ──────────────────────────────────────────────────────────────
-- Mesmo shape de operadoras_audit_logs (20260904090000): tabela append-only,
-- sem policy de UPDATE/DELETE. `lote_id` como SET NULL porque o lote em si não
-- é apagado (só o vínculo nota_lote); o registro de auditoria sobrevive mesmo
-- se o lote for removido por outro caminho no futuro.
CREATE TABLE IF NOT EXISTS notas_lote_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES notas(id_nota) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes(id_lote) ON DELETE SET NULL,
  valor_total_anterior DECIMAL(15, 2) NOT NULL,
  valor_total_novo DECIMAL(15, 2) NOT NULL,
  motivo TEXT NOT NULL,
  performed_by UUID NOT NULL,
  performed_by_name TEXT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_lote_audit_logs_nota ON notas_lote_audit_logs(nota_id);
CREATE INDEX IF NOT EXISTS idx_notas_lote_audit_logs_performed_at ON notas_lote_audit_logs(performed_at DESC);

ALTER TABLE notas_lote_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_lote_audit_logs_select_billing" ON notas_lote_audit_logs;

CREATE POLICY "notas_lote_audit_logs_select_billing" ON notas_lote_audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

-- Sem policy de INSERT: a única escrita é fat_desvincular_lote (SECURITY
-- DEFINER), que já valida canManageBilling na primeira linha.

COMMENT ON TABLE notas_lote_audit_logs IS 'Auditoria (motivo, data, responsável) de lotes desvinculados de um título já criado (issue 46).';

-- ─── RPC ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_desvincular_lote(p_id_nota UUID, p_id_lote UUID, p_motivo TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status               TEXT;
  v_valor_total_anterior  DECIMAL(15, 2);
  v_valor_lote            DECIMAL(15, 2);
  v_qtd_lotes             INTEGER;
  v_motivo                TEXT;
  v_user_id               UUID;
  v_user_name             TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  v_motivo := NULLIF(TRIM(p_motivo), '');
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da alteração.';
  END IF;

  -- Trava a linha do título: duas remoções concorrentes no mesmo título não
  -- podem ler o mesmo valor_total de partida.
  SELECT status, valor_total
    INTO v_status, v_valor_total_anterior
    FROM notas
   WHERE id_nota = p_id_nota
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita edição de lotes.';
  END IF;
  -- Decisão da triagem: baixa já registrada bloqueia por completo (mudar o
  -- total invalidaria um recebimento já confirmado). Checa a EXISTÊNCIA de
  -- uma linha em `recebimentos`, não `notas.valor_recebido > 0` — uma baixa
  -- de glosa integral (fat_registrar_baixa aceita valorRecebido=0 desde que
  -- tenha ao menos uma glosa) insere a linha em `recebimentos` sem nunca
  -- fazer valor_recebido sair de 0, e passaria batida pela checagem antiga.
  IF EXISTS (SELECT 1 FROM recebimentos WHERE nota_id = p_id_nota) THEN
    RAISE EXCEPTION 'Título já tem baixa registrada — não é possível alterar os lotes.';
  END IF;

  SELECT valor_total INTO v_valor_lote FROM lotes WHERE id_lote = p_id_lote;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado.';
  END IF;
  -- `lotes.valor_total` é NULLABLE (DEFAULT 0, sem NOT NULL). Sem esta
  -- checagem, um valor NULL faria a subtração abaixo (COALESCE(..., 0))
  -- remover o lote sem descontar nada do título e gravar uma auditoria
  -- mentindo "sem mudança de valor" — melhor recusar e forçar correção do
  -- dado do que desvincular às cegas.
  IF v_valor_lote IS NULL THEN
    RAISE EXCEPTION 'Lote sem valor total definido — não é possível desvincular.';
  END IF;

  -- Verifica o vínculo com este título antes de checar "é o único lote?" —
  -- na ordem inversa, um p_id_lote que existe em `lotes` mas não pertence a
  -- este título acabava caindo no erro de "único lote" sempre que o título
  -- só tivesse um lote de verdade vinculado, escondendo o problema real.
  IF NOT EXISTS (
    SELECT 1 FROM nota_lote WHERE id_nota = p_id_nota AND id_lote = p_id_lote
  ) THEN
    RAISE EXCEPTION 'Lote não pertence a este título.';
  END IF;

  SELECT COUNT(*) INTO v_qtd_lotes FROM nota_lote WHERE id_nota = p_id_nota;
  IF v_qtd_lotes <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o único lote do título — cancele o título em vez disso.';
  END IF;

  DELETE FROM nota_lote WHERE id_nota = p_id_nota AND id_lote = p_id_lote;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não pertence a este título.';
  END IF;

  UPDATE notas
     SET valor_total = valor_total - COALESCE(v_valor_lote, 0),
         updated_at  = NOW()
   WHERE id_nota = p_id_nota;

  -- fat_recalcular_nota reavalia status a partir do valor_total já atualizado
  -- acima (ela não mexe em valor_total, só em recebido/glosado/status).
  PERFORM fat_recalcular_nota(p_id_nota);

  v_user_id := auth.uid();
  SELECT name INTO v_user_name FROM user_profiles WHERE id = v_user_id;

  INSERT INTO notas_lote_audit_logs
    (nota_id, lote_id, valor_total_anterior, valor_total_novo, motivo, performed_by, performed_by_name)
  VALUES
    (p_id_nota, p_id_lote, v_valor_total_anterior,
     v_valor_total_anterior - COALESCE(v_valor_lote, 0), v_motivo,
     v_user_id, COALESCE(v_user_name, 'Desconhecido'));
END;
$$;

COMMENT ON FUNCTION public.fat_desvincular_lote(UUID, UUID, TEXT) IS
  'Remove o vínculo de um lote a um título já criado, recalcula o valor total e registra auditoria. Rejeita título cancelado, título com baixa registrada, lote inexistente no título e remoção do último lote (issue 46).';

REVOKE ALL ON FUNCTION public.fat_desvincular_lote(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_desvincular_lote(UUID, UUID, TEXT) TO authenticated;
