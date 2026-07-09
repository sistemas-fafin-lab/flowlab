-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 6 — Coleta (Etapa A): conferência de recepção + coleta + baixa de insumos
-- Plano: docs/PLANO_FASE6_COLETAS.md (§3 modelo de dados, §5 RPCs, §7 RLS)
--
-- Depende da Fase 5 (multi-local): stock_locations, product_stock, o trigger novo
-- update_stock_on_movement e o vínculo posto → stock_locations (usePostos).
--
-- Entrega:
--   • status 'bloqueado' em ac_agendamentos (state machine da coleta);
--   • ac_checkins  — conferência de recepção (gate, 1:1 agendamento);
--   • ac_coletas + ac_coleta_insumos — coleta + insumos consumidos;
--   • RPCs transacionais registrar_checkin e registrar_coleta (§5);
--   • RLS permissiva (authenticated) — o gate real é o frontend (canManageColetas)
--     + a lógica das RPCs. As tabelas só são escritas via essas RPCs.
--
-- Migration idempotente (IF NOT EXISTS / DROP…IF EXISTS) e defensiva.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Função de updated_at compartilhada do módulo (idempotente/defensivo).
--    Já existe desde 20260630130000; recriada aqui p/ a migration ser self-contained.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Status 'bloqueado' em ac_agendamentos (§3.4)
--    Hoje status é TEXT sem CHECK; adicionamos um CHECK que documenta a state
--    machine e já inclui 'bloqueado'. DROP…IF EXISTS antes = re-executável e
--    "relaxa" defensivamente um CHECK anterior, se houver.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ac_agendamentos DROP CONSTRAINT IF EXISTS ac_agendamentos_status_check;
ALTER TABLE ac_agendamentos
  ADD CONSTRAINT ac_agendamentos_status_check
  CHECK (status IN ('recebido', 'em_coleta', 'coletado', 'bloqueado', 'cancelado'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ac_checkins — conferência de recepção (1:1 agendamento) (§3.1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id  uuid NOT NULL UNIQUE REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  conferido_por   text NOT NULL,
  conferido_em    timestamptz NOT NULL DEFAULT now(),
  resultado       text NOT NULL CHECK (resultado IN ('liberado', 'problema')),
  problema_em     text CHECK (problema_em IN ('identidade', 'guia', 'pedido_medico', 'jejum', 'termo')),
  problema_motivo text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- 'problema' exige item + motivo; 'liberado' não tem nenhum dos dois.
  CONSTRAINT ck_checkin_problema CHECK (
       (resultado = 'problema' AND problema_em IS NOT NULL AND problema_motivo IS NOT NULL)
    OR (resultado = 'liberado' AND problema_em IS NULL AND problema_motivo IS NULL)
  )
);

DROP TRIGGER IF EXISTS trg_ac_checkins_updated_at ON ac_checkins;
CREATE TRIGGER trg_ac_checkins_updated_at
  BEFORE UPDATE ON ac_checkins
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ac_coletas — uma coleta por agendamento (§3.2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_coletas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL UNIQUE REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  posto_id       uuid REFERENCES ac_postos(id),
  location_id    uuid REFERENCES stock_locations(id),  -- estoque do posto de onde saiu a baixa (snapshot)
  coletado_por   text NOT NULL,
  coletado_em    timestamptz NOT NULL DEFAULT now(),
  observacoes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_coletas_posto ON ac_coletas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_coletas_coletado_em ON ac_coletas(coletado_em DESC);

DROP TRIGGER IF EXISTS trg_ac_coletas_updated_at ON ac_coletas;
CREATE TRIGGER trg_ac_coletas_updated_at
  BEFORE UPDATE ON ac_coletas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ac_coleta_insumos — insumos consumidos (linha por produto) (§3.3)
--    Imutável: sem trigger de updated_at.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_coleta_insumos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coleta_id         uuid NOT NULL REFERENCES ac_coletas(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          integer NOT NULL CHECK (quantity > 0),
  stock_movement_id uuid REFERENCES stock_movements(id),  -- a baixa gerada (rastreio/estorno futuro)
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_coleta_insumos_coleta ON ac_coleta_insumos(coleta_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS (§7) — SELECT + INSERT p/ authenticated (as tabelas só são escritas
--    pelas RPCs SECURITY INVOKER; o gate real é o frontend + a lógica da RPC).
--    Consistente com stock_movements/product_stock (permissivas por authenticated).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE ac_checkins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_coletas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_coleta_insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_checkins_select_all"   ON ac_checkins;
DROP POLICY IF EXISTS "ac_checkins_insert_auth"  ON ac_checkins;
CREATE POLICY "ac_checkins_select_all"
  ON ac_checkins FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_checkins_insert_auth"
  ON ac_checkins FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "ac_coletas_select_all"  ON ac_coletas;
DROP POLICY IF EXISTS "ac_coletas_insert_auth" ON ac_coletas;
CREATE POLICY "ac_coletas_select_all"
  ON ac_coletas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_coletas_insert_auth"
  ON ac_coletas FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "ac_coleta_insumos_select_all"  ON ac_coleta_insumos;
DROP POLICY IF EXISTS "ac_coleta_insumos_insert_auth" ON ac_coleta_insumos;
CREATE POLICY "ac_coleta_insumos_select_all"
  ON ac_coleta_insumos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_coleta_insumos_insert_auth"
  ON ac_coleta_insumos FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. registrar_checkin — a conferência (gate) (§5.1)
--    recebido → em_coleta (liberado) | bloqueado (problema).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registrar_checkin(
  p_agendamento_id  uuid,
  p_conferido_por   text,
  p_resultado       text,   -- 'liberado' | 'problema'
  p_problema_em     text,   -- chave do item que falhou (só quando 'problema')
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. registrar_coleta — a coleta + baixa (exige em_coleta) (§5.2)
--    p_insumos: jsonb array de { "product_id": uuid, "quantity": int }.
--    A baixa é a 2ª etapa (consumo) do local controla_consumo do posto — um
--    'out'/'internal-consumption' que o trigger da Fase 5 debita em product_stock.
-- ─────────────────────────────────────────────────────────────────────────────
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
    RETURNING id INTO v_mov_id;   -- trigger da Fase 5 debita product_stock (CHECK>=0 barra saldo insuficiente)
    -- INSERT…SELECT com produto inexistente insere 0 linhas (não é erro): sem este
    -- guard, o FK de ac_coleta_insumos barraria depois, mas com erro cru. Mensagem clara:
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % não encontrado', v_prod; END IF;

    INSERT INTO ac_coleta_insumos (coleta_id, product_id, quantity, stock_movement_id)
    VALUES (v_coleta_id, v_prod, v_qty, v_mov_id);
  END LOOP;

  UPDATE ac_agendamentos SET status = 'coletado', updated_at = now() WHERE id = v_agendamento_id;
  RETURN v_coleta_id;
END; $$;

-- Execução via PostgREST (supabase.rpc) exige acesso ao papel authenticated.
GRANT EXECUTE ON FUNCTION registrar_checkin(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_coleta(uuid, text, text, jsonb)       TO authenticated;
