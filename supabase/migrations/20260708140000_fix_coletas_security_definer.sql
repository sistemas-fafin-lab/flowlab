-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 6 — Coleta: correção das RPCs registrar_checkin / registrar_coleta
--
-- Problema: as funções rodavam como SECURITY INVOKER (padrão). A RLS de
-- ac_agendamentos só tem policy SELECT para authenticated; não há UPDATE.
-- Resultado: o "FOR UPDATE" no SELECT retornava 0 linhas, e a função
-- disparava 'Agendamento % não encontrado' mesmo quando o registro existia.
--
-- Correção:
--   1) SECURITY DEFINER — bypassa a RLS das tabelas internas (as funções
--      já têm validação de negócio própria: status check, constraints).
--   2) SET search_path = public — defesa contra search_path injection.
--   3) Manter a resolução dupla: tenta por `id` local, depois por `labhub_id`.
--
-- Idempotente: DROP IF EXISTS + CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. registrar_checkin (§5.1) ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS registrar_checkin(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION registrar_checkin(
  p_agendamento_id  uuid,
  p_conferido_por   text,
  p_resultado       text,
  p_problema_em     text,
  p_problema_motivo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status         text;
  v_checkin_id     uuid;
  v_agendamento_id uuid;
BEGIN
  -- Resolve por id local; se não achar, tenta por labhub_id.
  SELECT id, status INTO v_agendamento_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, status INTO v_agendamento_id, v_status
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'recebido' THEN
    RAISE EXCEPTION 'Conferência só é possível em agendamento "recebido" (atual: %)', v_status;
  END IF;
  IF p_resultado NOT IN ('liberado', 'problema') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  IF p_resultado = 'problema' AND (p_problema_em IS NULL OR btrim(COALESCE(p_problema_motivo, '')) = '') THEN
    RAISE EXCEPTION 'Problema exige o item (problema_em) e o motivo';
  END IF;

  INSERT INTO ac_checkins (agendamento_id, conferido_por, resultado, problema_em, problema_motivo)
  VALUES (v_agendamento_id, p_conferido_por, p_resultado,
          CASE WHEN p_resultado = 'problema' THEN p_problema_em END,
          CASE WHEN p_resultado = 'problema' THEN NULLIF(p_problema_motivo, '') END)
  RETURNING id INTO v_checkin_id;

  UPDATE ac_agendamentos
     SET status = CASE WHEN p_resultado = 'liberado' THEN 'em_coleta' ELSE 'bloqueado' END,
         updated_at = now()
   WHERE id = v_agendamento_id;

  RETURN v_checkin_id;
END; $$;

-- ─── 2. registrar_coleta (§5.2) ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS registrar_coleta(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION registrar_coleta(
  p_agendamento_id uuid,
  p_coletado_por   text,
  p_observacoes    text,
  p_insumos        jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_posto_id uuid; v_location_id uuid; v_status text;
  v_coleta_id uuid; v_mov_id uuid; v_prod uuid; v_qty int; ins jsonb;
  v_agendamento_id uuid;
BEGIN
  -- Resolve por id local; se não achar, tenta por labhub_id.
  SELECT id, posto_id, status INTO v_agendamento_id, v_posto_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, posto_id, status INTO v_agendamento_id, v_posto_id, v_status
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'em_coleta' THEN
    RAISE EXCEPTION 'Coleta exige agendamento liberado na recepção (status em_coleta; atual: %)', v_status;
  END IF;

  IF v_posto_id IS NULL THEN RAISE EXCEPTION 'Agendamento sem posto: não há estoque de onde baixar'; END IF;
  -- posto_id não tem UNIQUE em stock_locations (hoje é 1:1 pelo usePostos); LIMIT 1
  -- torna a origem determinística mesmo se um posto vier a ter >1 local.
  SELECT id INTO v_location_id FROM stock_locations
    WHERE posto_id = v_posto_id AND rastreavel = true AND ativo = true
    ORDER BY is_principal DESC, created_at
    LIMIT 1;
  IF v_location_id IS NULL THEN RAISE EXCEPTION 'Posto sem estoque rastreável configurado'; END IF;

  INSERT INTO ac_coletas (agendamento_id, posto_id, location_id, coletado_por, observacoes)
  VALUES (v_agendamento_id, v_posto_id, v_location_id, p_coletado_por, NULLIF(p_observacoes, ''))
  RETURNING id INTO v_coleta_id;

  FOR ins IN SELECT * FROM jsonb_array_elements(COALESCE(p_insumos, '[]'::jsonb))
  LOOP
    v_prod := (ins->>'product_id')::uuid;
    v_qty  := (ins->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida para insumo %', v_prod; END IF;

    INSERT INTO stock_movements (product_id, product_name, type, reason, quantity, from_location_id, authorized_by, notes)
    SELECT v_prod, p.name, 'out', 'internal-consumption', v_qty, v_location_id, p_coletado_por, 'Coleta ' || v_coleta_id
      FROM products p WHERE p.id = v_prod
    RETURNING id INTO v_mov_id;
    -- INSERT…SELECT com produto inexistente insere 0 linhas (não é erro): sem este
    -- guard, o FK de ac_coleta_insumos barraria depois, mas com erro cru. Mensagem clara:
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % não encontrado', v_prod; END IF;

    INSERT INTO ac_coleta_insumos (coleta_id, product_id, quantity, stock_movement_id)
    VALUES (v_coleta_id, v_prod, v_qty, v_mov_id);
  END LOOP;

  UPDATE ac_agendamentos SET status = 'coletado', updated_at = now() WHERE id = v_agendamento_id;
  RETURN v_coleta_id;
END; $$;

-- Permissão de execução via PostgREST (supabase.rpc) p/ authenticated.
GRANT EXECUTE ON FUNCTION registrar_checkin(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_coleta(uuid, text, text, jsonb)       TO authenticated;
