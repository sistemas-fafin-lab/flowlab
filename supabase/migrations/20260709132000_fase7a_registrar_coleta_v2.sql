-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A (frente 3): registrar_coleta v2 — exames + validade + etiqueta
--
-- O passo pós-conferência deixa de ser "coleta com baixa de insumos" e passa a ser
-- o que o laboratório realmente faz ao receber o material (o médico é quem coleta):
--   • registra os EXAMES selecionados no pedido  → ac_agendamento_exames
--   • marca validade da amostra + etiqueta        → ac_coletas.validade_ok/etiquetado
--   • para cada exame de CULTURA, abre uma linha de acompanhamento → ac_culturas
--   • em_coleta → coletado (nomes de status mantidos, decisão do usuário)
--
-- A baixa de INSUMOS continua suportada (p_insumos) — a capacidade é preservada
-- para onde o consumo realmente ocorrer — mas agora é OPCIONAL: o posto/estoque só
-- é exigido quando há insumos a baixar (antes falhava sempre sem estoque rastreável).
--
-- SECURITY DEFINER porque toca ac_agendamentos (RLS só-SELECT; FOR UPDATE precisa
-- de DEFINER — ver 20260708140000). Idempotente (DROP IF EXISTS + CREATE).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS registrar_coleta(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS registrar_coleta(uuid, text, text, uuid[], boolean, boolean, jsonb);

CREATE OR REPLACE FUNCTION registrar_coleta(
  p_agendamento_id uuid,
  p_coletado_por   text,
  p_observacoes    text,
  p_exame_ids      uuid[]  DEFAULT '{}',   -- exames marcados no pedido
  p_validade_ok    boolean DEFAULT NULL,   -- validade da amostra conferida
  p_etiquetado     boolean DEFAULT NULL,   -- etiqueta colocada
  p_insumos        jsonb   DEFAULT '[]'    -- baixa opcional (capacidade preservada)
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid; v_posto_id uuid; v_status text;
  v_paciente_nome text; v_local_posto text;
  v_location_id uuid; v_coleta_id uuid;
  v_mov_id uuid; v_prod uuid; v_qty int; ins jsonb;
  v_exame_id uuid; v_ex_nome text; v_ex_cult boolean;
  v_has_insumos boolean := jsonb_array_length(COALESCE(p_insumos, '[]'::jsonb)) > 0;
BEGIN
  -- Resolve por id local; se não achar, tenta por labhub_id.
  SELECT id, posto_id, status, paciente_nome, local_posto
    INTO v_agendamento_id, v_posto_id, v_status, v_paciente_nome, v_local_posto
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, posto_id, status, paciente_nome, local_posto
      INTO v_agendamento_id, v_posto_id, v_status, v_paciente_nome, v_local_posto
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'em_coleta' THEN
    RAISE EXCEPTION 'Registro exige agendamento liberado na recepção (status em_coleta; atual: %)', v_status;
  END IF;

  -- Estoque só é necessário quando há insumos a baixar.
  IF v_has_insumos THEN
    IF v_posto_id IS NULL THEN RAISE EXCEPTION 'Agendamento sem posto: não há estoque de onde baixar'; END IF;
    SELECT id INTO v_location_id FROM stock_locations
      WHERE posto_id = v_posto_id AND rastreavel = true AND ativo = true
      ORDER BY is_principal DESC, created_at
      LIMIT 1;
    IF v_location_id IS NULL THEN RAISE EXCEPTION 'Posto sem estoque rastreável configurado'; END IF;
  END IF;

  INSERT INTO ac_coletas (agendamento_id, posto_id, location_id, coletado_por,
                          observacoes, validade_ok, etiquetado)
  VALUES (v_agendamento_id, v_posto_id, v_location_id, p_coletado_por,
          NULLIF(p_observacoes, ''), p_validade_ok, p_etiquetado)
  RETURNING id INTO v_coleta_id;

  -- Exames marcados: registra e, se for cultura, abre o acompanhamento.
  FOREACH v_exame_id IN ARRAY COALESCE(p_exame_ids, ARRAY[]::uuid[])
  LOOP
    SELECT nome, is_cultura INTO v_ex_nome, v_ex_cult FROM ac_exames WHERE id = v_exame_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Exame % não encontrado', v_exame_id; END IF;

    INSERT INTO ac_agendamento_exames (agendamento_id, exame_id, exame_nome, is_cultura)
    VALUES (v_agendamento_id, v_exame_id, v_ex_nome, v_ex_cult)
    ON CONFLICT (agendamento_id, exame_id) DO NOTHING;

    IF v_ex_cult THEN
      INSERT INTO ac_culturas (agendamento_id, exame_id, exame_nome, paciente_nome, posto_id, local_posto)
      VALUES (v_agendamento_id, v_exame_id, v_ex_nome, v_paciente_nome, v_posto_id, v_local_posto)
      ON CONFLICT (agendamento_id, exame_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Baixa de insumos (opcional; capacidade preservada).
  FOR ins IN SELECT * FROM jsonb_array_elements(COALESCE(p_insumos, '[]'::jsonb))
  LOOP
    v_prod := (ins->>'product_id')::uuid;
    v_qty  := (ins->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para insumo %', v_prod; END IF;

    INSERT INTO stock_movements (product_id, product_name, type, reason, quantity, from_location_id, authorized_by, notes)
    SELECT v_prod, p.name, 'out', 'internal-consumption', v_qty, v_location_id, p_coletado_por, 'Coleta ' || v_coleta_id
      FROM products p WHERE p.id = v_prod
    RETURNING id INTO v_mov_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % não encontrado', v_prod; END IF;

    INSERT INTO ac_coleta_insumos (coleta_id, product_id, quantity, stock_movement_id)
    VALUES (v_coleta_id, v_prod, v_qty, v_mov_id);
  END LOOP;

  UPDATE ac_agendamentos SET status = 'coletado', updated_at = now() WHERE id = v_agendamento_id;
  RETURN v_coleta_id;
END; $$;

GRANT EXECUTE ON FUNCTION registrar_coleta(uuid, text, text, uuid[], boolean, boolean, jsonb) TO authenticated;
