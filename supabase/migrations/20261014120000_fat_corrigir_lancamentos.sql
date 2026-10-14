-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: corrigir lançamentos (baixas e glosas) de um título
-- (.scratch/titulos-edicao-lancamentos — grilling de 14/10/2026).
--
-- Baixas e glosas são digitadas à mão; até aqui um valor errado não tinha
-- conserto pela tela. O total do título fica de fora (snapshot do apLIS, nunca
-- digitado) e o glosado do título continua DERIVADO: corrige-se a glosa, e
-- fat_recalcular_nota (gatilhos de recebimentos/glosas) refaz recebido,
-- glosado e status.
--
--   fat_corrigir_lancamento(p) — uma baixa (ou o grupo das glosas sem baixa)
--     com suas glosas: altera campos, inclui e exclui glosas. Um motivo por
--     salvamento; uma linha de auditoria por campo alterado.
--   fat_excluir_baixa(id, motivo) — apaga a baixa e as glosas dela, guardando
--     cópia completa na auditoria. As glosas são apagadas explicitamente:
--     glosas.recebimento_id é ON DELETE SET NULL, e sem isso virariam glosas
--     sem baixa em vez de sumirem com o lançamento.
--
-- Depende de 20260807120000_contas_receber.sql (fat_recalcular_nota e
-- gatilhos), 20260807130000_contas_receber_rpcs.sql (fat_exigir_permissao_gestao).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Auditoria ──────────────────────────────────────────────────────────────
-- Append-only, como notas_lote_audit_logs. recebimento_id/glosa_id sem FK de
-- propósito: o registro de uma exclusão tem que sobreviver ao que foi excluído.
CREATE TABLE IF NOT EXISTS notas_lancamentos_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES notas(id_nota) ON DELETE CASCADE,
  recebimento_id UUID,
  glosa_id UUID,
  entidade TEXT NOT NULL CHECK (entidade IN ('baixa', 'glosa')),
  acao TEXT NOT NULL CHECK (acao IN ('alteracao', 'inclusao', 'exclusao')),
  -- Nome da coluna alterada (valor_recebido, data_receb, valor, motivo…);
  -- null na inclusão/exclusão, que guardam o registro inteiro em `registro`.
  campo TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  registro JSONB,
  motivo TEXT NOT NULL,
  performed_by UUID NOT NULL,
  performed_by_name TEXT NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_lancamentos_audit_logs_nota
  ON notas_lancamentos_audit_logs(nota_id, performed_at DESC);

ALTER TABLE notas_lancamentos_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_lancamentos_audit_logs_select_billing" ON notas_lancamentos_audit_logs;

CREATE POLICY "notas_lancamentos_audit_logs_select_billing" ON notas_lancamentos_audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

-- Sem policy de INSERT/UPDATE/DELETE: as únicas escritas são as RPCs abaixo
-- (SECURITY DEFINER), que validam canManageBilling na primeira linha.

COMMENT ON TABLE notas_lancamentos_audit_logs IS
  'Auditoria das correções de baixas e glosas de um título (campo, antes, depois, motivo, responsável). Exclusões guardam o registro inteiro em `registro`.';

-- ─── Helpers internos ───────────────────────────────────────────────────────

-- Grava uma linha de auditoria. Interno: só as RPCs abaixo chamam.
CREATE OR REPLACE FUNCTION public.fat_auditar_lancamento(
  p_nota_id UUID,
  p_recebimento_id UUID,
  p_glosa_id UUID,
  p_entidade TEXT,
  p_acao TEXT,
  p_campo TEXT,
  p_anterior TEXT,
  p_novo TEXT,
  p_registro JSONB,
  p_motivo TEXT
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_user_name TEXT;
BEGIN
  SELECT name INTO v_user_name FROM user_profiles WHERE id = v_user_id;
  INSERT INTO notas_lancamentos_audit_logs
    (nota_id, recebimento_id, glosa_id, entidade, acao, campo, valor_anterior,
     valor_novo, registro, motivo, performed_by, performed_by_name)
  VALUES
    (p_nota_id, p_recebimento_id, p_glosa_id, p_entidade, p_acao, p_campo, p_anterior,
     p_novo, p_registro, p_motivo, v_user_id, COALESCE(v_user_name, 'Desconhecido'));
END;
$$;

REVOKE ALL ON FUNCTION public.fat_auditar_lancamento(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;

-- Valida os campos de uma glosa do payload (motivo, valor, guia/lote do
-- título) — as mesmas regras de fat_registrar_baixa, mais valor > 0, que a
-- tela de baixa já exigia.
CREATE OR REPLACE FUNCTION public.fat_validar_glosa_lancamento(p_nota_id UUID, p_glosa JSONB)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req_id  UUID := NULLIF(p_glosa->>'requisicaoId', '')::UUID;
  v_lote_id UUID := NULLIF(p_glosa->>'loteId', '')::UUID;
BEGIN
  IF COALESCE(NULLIF(TRIM(p_glosa->>'motivo'), ''), '') = '' THEN
    RAISE EXCEPTION 'Toda glosa precisa de motivo.';
  END IF;
  IF COALESCE((p_glosa->>'valor')::DECIMAL(15, 2), 0) <= 0 THEN
    RAISE EXCEPTION 'Toda glosa precisa de um valor maior que zero.';
  END IF;
  IF v_req_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM requisicoes r
      JOIN nota_lote nl ON nl.id_lote = r.lote_id
     WHERE r.id_requisicao = v_req_id AND nl.id_nota = p_nota_id
  ) THEN
    RAISE EXCEPTION 'Requisição informada na glosa não pertence a este título.';
  END IF;
  IF v_lote_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM nota_lote nl WHERE nl.id_lote = v_lote_id AND nl.id_nota = p_nota_id
  ) THEN
    RAISE EXCEPTION 'Lote informado na glosa não pertence a este título.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fat_validar_glosa_lancamento(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Trava o título e recusa cancelado. Devolve o total e o glosado de partida
-- (para o teto de glosas comparar antes/depois).
CREATE OR REPLACE FUNCTION public.fat_travar_titulo_lancamento(p_nota_id UUID, OUT v_valor_total DECIMAL, OUT v_glosado DECIMAL)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status, COALESCE(valor_total, 0)
    INTO v_status, v_valor_total
    FROM notas
   WHERE id_nota = p_nota_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;
  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Título cancelado não aceita correção de lançamentos.';
  END IF;
  -- Mesmo filtro de fat_recalcular_nota: 'revertida' não conta como glosado.
  SELECT COALESCE(SUM(valor) FILTER (WHERE status IN ('aberta', 'em_recurso', 'definitiva')), 0)
    INTO v_glosado
    FROM glosas
   WHERE nota_id = p_nota_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fat_travar_titulo_lancamento(UUID) FROM PUBLIC, anon, authenticated;

-- ─── fat_corrigir_lancamento ────────────────────────────────────────────────
-- p: {
--   notaId, recebimentoId (null = glosas sem baixa), motivo,
--   baixa?: { valorRecebido, dataReceb, formaRecebimento, bancoNome, bancoConta, observacoes },
--   glosasAlteradas: [{ id, valor, motivo, requisicaoId, loteId }],
--   glosasNovas:     [{ valor, motivo, requisicaoId, loteId, status }],
--   glosasExcluidas: [id]
-- }
CREATE OR REPLACE FUNCTION public.fat_corrigir_lancamento(p JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_id     UUID := NULLIF(p->>'notaId', '')::UUID;
  v_receb_id    UUID := NULLIF(p->>'recebimentoId', '')::UUID;
  v_motivo      TEXT := NULLIF(TRIM(p->>'motivo'), '');
  v_total       DECIMAL(15, 2);
  v_glosado_ini DECIMAL(15, 2);
  v_glosado_fim DECIMAL(15, 2);
  v_receb       recebimentos%ROWTYPE;
  v_glosa_atual glosas%ROWTYPE;
  v_b           JSONB;
  v_g           JSONB;
  v_id          UUID;
  v_novo_id     UUID;
  v_status_nova TEXT;
  v_qtd         INTEGER := 0;
  -- Valores novos da baixa
  v_valor       DECIMAL(15, 2);
  v_data        DATE;
  v_forma       TEXT;
  v_banco       TEXT;
  v_conta       TEXT;
  v_obs         TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da correção.';
  END IF;

  SELECT t.v_valor_total, t.v_glosado INTO v_total, v_glosado_ini
    FROM fat_travar_titulo_lancamento(v_nota_id) t;

  IF v_receb_id IS NOT NULL THEN
    SELECT * INTO v_receb FROM recebimentos WHERE id_receb = v_receb_id FOR UPDATE;
    IF NOT FOUND OR v_receb.nota_id IS DISTINCT FROM v_nota_id THEN
      RAISE EXCEPTION 'Baixa não pertence a este título.';
    END IF;
    -- Só as baixas que entram no recebido do título (o filtro de
    -- fat_recalcular_nota). As 'previsto' do legado não são pagamento: corrigi-
    -- las gravaria auditoria sem mudar nada no título.
    IF v_receb.status NOT IN ('recebido', 'parcial') THEN
      RAISE EXCEPTION 'Só baixas registradas (recebido/parcial) podem ser corrigidas.';
    END IF;
  ELSIF p ? 'baixa' AND jsonb_typeof(p->'baixa') = 'object' THEN
    RAISE EXCEPTION 'Glosas sem baixa não têm campos de baixa para corrigir.';
  END IF;

  -- ── Campos da baixa ──────────────────────────────────────────────────────
  v_b := p->'baixa';
  IF v_receb_id IS NOT NULL AND jsonb_typeof(v_b) = 'object' THEN
    v_valor := COALESCE((v_b->>'valorRecebido')::DECIMAL(15, 2), 0);
    v_data  := NULLIF(v_b->>'dataReceb', '')::DATE;
    v_forma := NULLIF(TRIM(v_b->>'formaRecebimento'), '');
    v_banco := NULLIF(TRIM(v_b->>'bancoNome'), '');
    v_conta := NULLIF(TRIM(v_b->>'bancoConta'), '');
    v_obs   := NULLIF(TRIM(v_b->>'observacoes'), '');

    IF v_valor < 0 THEN
      RAISE EXCEPTION 'Valor recebido não pode ser negativo.';
    END IF;
    IF v_data IS NULL THEN
      RAISE EXCEPTION 'Informe a data do recebimento.';
    END IF;

    IF v_valor IS DISTINCT FROM v_receb.valor_recebido THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'valor_recebido',
        v_receb.valor_recebido::TEXT, v_valor::TEXT, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF v_data IS DISTINCT FROM v_receb.data_receb THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'data_receb',
        v_receb.data_receb::TEXT, v_data::TEXT, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF v_forma IS DISTINCT FROM NULLIF(TRIM(v_receb.forma_recebimento), '') THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'forma_recebimento',
        v_receb.forma_recebimento, v_forma, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF v_banco IS DISTINCT FROM NULLIF(TRIM(v_receb.banco_nome), '') THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'banco_nome',
        v_receb.banco_nome, v_banco, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF v_conta IS DISTINCT FROM NULLIF(TRIM(v_receb.banco_conta), '') THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'banco_conta',
        v_receb.banco_conta, v_conta, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF v_obs IS DISTINCT FROM NULLIF(TRIM(v_receb.observacoes), '') THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, NULL, 'baixa', 'alteracao', 'observacoes',
        v_receb.observacoes, v_obs, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;

    -- Os textos são comparados já aparados dos dois lados (a tela também
    -- apara): um espaço sobrando no valor gravado por fat_registrar_baixa não
    -- pode virar uma "alteração" que o operador não fez.
    -- valor_previsto acompanha o recebido: é o invariante com que
    -- fat_registrar_baixa grava a linha.
    UPDATE recebimentos
       SET valor_recebido    = v_valor,
           valor_previsto    = v_valor,
           data_receb        = v_data,
           forma_recebimento = v_forma,
           banco_nome        = v_banco,
           banco_conta       = v_conta,
           observacoes       = v_obs,
           updated_at        = NOW()
     WHERE id_receb = v_receb_id;
  END IF;

  -- ── Glosas alteradas ─────────────────────────────────────────────────────
  FOR v_g IN SELECT * FROM jsonb_array_elements(COALESCE(p->'glosasAlteradas', '[]'::jsonb))
  LOOP
    v_id := NULLIF(v_g->>'id', '')::UUID;
    SELECT * INTO v_glosa_atual FROM glosas
     WHERE id_glosa = v_id
       AND nota_id = v_nota_id
       AND recebimento_id IS NOT DISTINCT FROM v_receb_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Glosa não pertence a este lançamento.';
    END IF;
    PERFORM fat_validar_glosa_lancamento(v_nota_id, v_g);

    IF (v_g->>'valor')::DECIMAL(15, 2) IS DISTINCT FROM v_glosa_atual.valor THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'alteracao', 'valor',
        v_glosa_atual.valor::TEXT, ((v_g->>'valor')::DECIMAL(15, 2))::TEXT, NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF TRIM(v_g->>'motivo') IS DISTINCT FROM TRIM(v_glosa_atual.motivo) THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'alteracao', 'motivo',
        v_glosa_atual.motivo, TRIM(v_g->>'motivo'), NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    -- Guia e lote auditados pelo número legível (o id não diz nada a quem lê).
    IF NULLIF(v_g->>'requisicaoId', '')::UUID IS DISTINCT FROM v_glosa_atual.requisicao_id THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'alteracao', 'requisicao_id',
        (SELECT numero_guia FROM requisicoes WHERE id_requisicao = v_glosa_atual.requisicao_id),
        (SELECT numero_guia FROM requisicoes WHERE id_requisicao = NULLIF(v_g->>'requisicaoId', '')::UUID),
        NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;
    IF NULLIF(v_g->>'loteId', '')::UUID IS DISTINCT FROM v_glosa_atual.lote_id THEN
      PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'alteracao', 'lote_id',
        (SELECT codigo_lote FROM lotes WHERE id_lote = v_glosa_atual.lote_id),
        (SELECT codigo_lote FROM lotes WHERE id_lote = NULLIF(v_g->>'loteId', '')::UUID),
        NULL, v_motivo);
      v_qtd := v_qtd + 1;
    END IF;

    UPDATE glosas
       SET valor         = (v_g->>'valor')::DECIMAL(15, 2),
           motivo        = TRIM(v_g->>'motivo'),
           requisicao_id = NULLIF(v_g->>'requisicaoId', '')::UUID,
           lote_id       = NULLIF(v_g->>'loteId', '')::UUID
     WHERE id_glosa = v_id;
  END LOOP;

  -- ── Glosas novas ─────────────────────────────────────────────────────────
  FOR v_g IN SELECT * FROM jsonb_array_elements(COALESCE(p->'glosasNovas', '[]'::jsonb))
  LOOP
    PERFORM fat_validar_glosa_lancamento(v_nota_id, v_g);
    v_status_nova := COALESCE(NULLIF(v_g->>'status', ''), 'aberta');
    IF v_status_nova NOT IN ('aberta', 'em_recurso', 'definitiva') THEN
      RAISE EXCEPTION 'Status de glosa inválido: %.', v_status_nova;
    END IF;

    INSERT INTO glosas (recebimento_id, nota_id, requisicao_id, lote_id, valor, motivo, status)
    VALUES (v_receb_id,
            v_nota_id,
            NULLIF(v_g->>'requisicaoId', '')::UUID,
            NULLIF(v_g->>'loteId', '')::UUID,
            (v_g->>'valor')::DECIMAL(15, 2),
            TRIM(v_g->>'motivo'),
            v_status_nova)
    RETURNING id_glosa INTO v_novo_id;

    PERFORM fat_auditar_lancamento(v_nota_id, v_receb_id, v_novo_id, 'glosa', 'inclusao', NULL,
      NULL, ((v_g->>'valor')::DECIMAL(15, 2))::TEXT,
      (SELECT to_jsonb(g) FROM glosas g WHERE g.id_glosa = v_novo_id), v_motivo);
    v_qtd := v_qtd + 1;
  END LOOP;

  -- ── Glosas excluídas ─────────────────────────────────────────────────────
  FOR v_g IN SELECT * FROM jsonb_array_elements(COALESCE(p->'glosasExcluidas', '[]'::jsonb))
  LOOP
    v_id := NULLIF(v_g #>> '{}', '')::UUID;
    SELECT * INTO v_glosa_atual FROM glosas
     WHERE id_glosa = v_id
       AND nota_id = v_nota_id
       AND recebimento_id IS NOT DISTINCT FROM v_receb_id
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Glosa não pertence a este lançamento.';
    END IF;

    PERFORM fat_auditar_lancamento(v_nota_id, v_glosa_atual.recebimento_id, v_id, 'glosa', 'exclusao', NULL,
      v_glosa_atual.valor::TEXT, NULL, to_jsonb(v_glosa_atual), v_motivo);
    DELETE FROM glosas WHERE id_glosa = v_id;
    v_qtd := v_qtd + 1;
  END LOOP;

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Nenhuma alteração para salvar.';
  END IF;

  -- ── Checagens sobre o estado final (o RAISE desfaz tudo acima) ───────────
  IF v_receb_id IS NOT NULL
     AND (SELECT valor_recebido FROM recebimentos WHERE id_receb = v_receb_id) <= 0
     AND NOT EXISTS (SELECT 1 FROM glosas WHERE recebimento_id = v_receb_id) THEN
    RAISE EXCEPTION 'A baixa ficaria sem valor e sem glosas — use "Excluir baixa" em vez disso.';
  END IF;

  -- Teto do lançamento (fat_registrar_baixa): glosado não passa do total. Só
  -- recusa quando a correção AUMENTA o glosado — um título que já estava acima
  -- (dado legado) ainda pode ser corrigido para baixo.
  SELECT COALESCE(SUM(valor) FILTER (WHERE status IN ('aberta', 'em_recurso', 'definitiva')), 0)
    INTO v_glosado_fim
    FROM glosas
   WHERE nota_id = v_nota_id;
  IF v_glosado_fim > v_total AND v_glosado_fim > v_glosado_ini THEN
    RAISE EXCEPTION 'Glosa(s) somam mais que o valor do título (% de um total de %).',
      to_char(v_glosado_fim, 'FM999999999.00'), to_char(v_total, 'FM999999999.00');
  END IF;

  -- Os gatilhos de recebimentos/glosas já recalcularam o título a cada linha.
END;
$$;

COMMENT ON FUNCTION public.fat_corrigir_lancamento(JSONB) IS
  'Corrige uma baixa (ou as glosas sem baixa) de um título: campos da baixa, glosas alteradas, incluídas e excluídas, com motivo obrigatório e auditoria por campo em notas_lancamentos_audit_logs. Recusa título cancelado, lançamento de outro título, salvamento sem alteração, baixa sem valor e sem glosa, e glosado acima do total.';

REVOKE ALL ON FUNCTION public.fat_corrigir_lancamento(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_corrigir_lancamento(JSONB) TO authenticated;

-- ─── fat_excluir_baixa ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fat_excluir_baixa(p_recebimento_id UUID, p_motivo TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivo  TEXT := NULLIF(TRIM(p_motivo), '');
  v_nota_id UUID;
  v_receb   recebimentos%ROWTYPE;
  v_glosa   glosas%ROWTYPE;
  v_glosas  JSONB;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão.';
  END IF;

  SELECT nota_id INTO v_nota_id FROM recebimentos WHERE id_receb = p_recebimento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa não encontrada.';
  END IF;

  -- Título primeiro, depois a baixa — mesma ordem de trava de fat_corrigir_lancamento.
  PERFORM fat_travar_titulo_lancamento(v_nota_id);
  -- Relido sob trava: outra exclusão da mesma baixa pode ter terminado
  -- enquanto esta esperava o título.
  SELECT * INTO v_receb FROM recebimentos WHERE id_receb = p_recebimento_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Baixa não encontrada.';
  END IF;
  IF v_receb.status NOT IN ('recebido', 'parcial') THEN
    RAISE EXCEPTION 'Só baixas registradas (recebido/parcial) podem ser excluídas.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
    INTO v_glosas
    FROM glosas g
   WHERE g.recebimento_id = p_recebimento_id;

  PERFORM fat_auditar_lancamento(v_nota_id, p_recebimento_id, NULL, 'baixa', 'exclusao', NULL,
    v_receb.valor_recebido::TEXT, NULL,
    to_jsonb(v_receb) || jsonb_build_object('glosas', v_glosas), v_motivo);

  FOR v_glosa IN SELECT * FROM glosas WHERE recebimento_id = p_recebimento_id FOR UPDATE
  LOOP
    PERFORM fat_auditar_lancamento(v_nota_id, p_recebimento_id, v_glosa.id_glosa, 'glosa', 'exclusao', NULL,
      v_glosa.valor::TEXT, NULL, to_jsonb(v_glosa), v_motivo);
  END LOOP;

  DELETE FROM glosas WHERE recebimento_id = p_recebimento_id;
  DELETE FROM recebimentos WHERE id_receb = p_recebimento_id;
  -- Os gatilhos de DELETE recalculam o título.
END;
$$;

COMMENT ON FUNCTION public.fat_excluir_baixa(UUID, TEXT) IS
  'Exclui uma baixa e as glosas lançadas com ela, com motivo obrigatório e cópia completa na auditoria (notas_lancamentos_audit_logs). Recusa título cancelado.';

REVOKE ALL ON FUNCTION public.fat_excluir_baixa(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_excluir_baixa(UUID, TEXT) TO authenticated;
