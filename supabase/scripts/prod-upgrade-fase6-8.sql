-- ═══════════════════════════════════════════════════════════════════════════════
-- FlowLab — UPGRADE DE PRODUÇÃO (jqxeqmeikqclmmongclj) — Fase 5 cutover + Fases 6–8
-- Gerado em 2026-07-17; validado por DIFF COMPLETO de pg_dump prod × test
-- (schema public inteiro: tabelas, funções, triggers, policies, constraints).
--
-- COMO APLICAR: Dashboard de PRODUÇÃO → SQL Editor → colar este arquivo INTEIRO
-- → Run. Transação única: se qualquer trecho falhar, NADA é aplicado.
-- ⚠️ Aplicar JUNTO com o deploy do frontend novo na Vercel (o cutover §1 troca o
-- fluxo de estoque; o frontend legado escreveria products.quantity direto).
--
-- Estado de prod confirmado pelo diff de dumps (2026-07-17):
--   • Fase 5: SÓ a parte aditiva foi aplicada. O CUTOVER (20260701130000) NÃO —
--     update_stock_on_movement na prod ainda é o corpo legado (debita
--     products.quantity) e sync_product_quantity_cache não existe. Consequência
--     medida: 98 movimentações desde 01/07 não tocaram product_stock → 72
--     produtos divergentes (products.quantity ≠ SUM(product_stock)).
--     A reconciliação do próprio cutover (§1.2) CURA os 72: verificado que
--     nenhum produto de prod tem saldo em >1 local, então a guarda não pula
--     ninguém e o saldo é igualado ao products.quantity atual (a verdade).
--   • Fases 6–8: faltam as 11 tabelas ac_*, RPCs, triggers e policies — tudo
--     coberto pelas 14 migrations abaixo + 1 fix de RLS (diff não achou NADA fora delas; o
--     resto era ruído: CRLF nos corpos de função de prod, formatação de CHECK,
--     START de sequence).
--   • Prod ainda tem ac_horarios_padrao (a 20260714 dropa). Postos de prod usam
--     os UUIDs fixos do seed (111…/222…): a grade 08:00–11:00/15min seg–sex
--     cobre os dois. O horário avulso 14:00 da Asa Sul NÃO migra (reconfigurar
--     na UI se ainda for desejado).
--
-- Migrations incluídas, na ordem (idênticas a supabase/migrations/):
--   [ 1] 20260701130000_fase5_estoque_cutover   ← faltava! (ver acima)
--   [ 2] 20260708130000_fase6_coletas
--   [ 3] 20260708140000_fix_coletas_security_definer
--   [ 4] 20260709120000_fase7c_temperatura_equipamentos
--   [ 5] 20260709130000_fase7a_exames
--   [ 6] 20260709131000_fase7a_culturas
--   [ 7] 20260709132000_fase7a_registrar_coleta_v2
--   [ 8] 20260710120000_fase7a_etapa_laudo_concluido
--   [ 9] 20260713120000_fase7_notificar_labhub_coleta
--   [10] 20260714120000_ac_agenda_grade_horarios
--   [11] 20260716120000_ac_culturas_avulsa
--   [12] 20260716130000_product_stock_min_local
--   [13] 20260716140000_fase6b_recoletas
--   [14] 20260716150000_fase8_laudos
--
-- EXCLUÍDA de propósito: 20260708120000_fix_module_categories_seed — o UPDATE
-- dela SOBRESCREVERIA o menu personalizado de prod (que tem "Consumo do Setor"
-- e a categoria "TI & AI", inexistentes no test). Substituída pelo merge
-- ADITIVO do §15, que só acrescenta "Estoque Departamental" sem remover nada.
--
-- PÓS-APLICAÇÃO (fora deste script): provisionar os segredos do Vault usados
-- pelo gatilho de notificação do LAB-HUB (§9) — ver prod-upgrade-fase6-8.md.
-- Sem eles o gatilho só emite WARNING e segue; nada quebra.
--
-- Reexecução: NÃO re-rode após sucesso — o §10 (20260714) referencia a coluna
-- fechado que ele próprio dropa, então a 2ª execução erra (e o rollback da
-- transação única impede qualquer efeito parcial).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ╔══ [ 1/14] 20260701130000_fase5_estoque_cutover.sql ══╗

/*
  # Fase 5 — Estoque Departamental — Parte 2: CUTOVER

  Plano: docs/PLANO_FASE5_ESTOQUE_DEPARTAMENTAL.md (§6)

  ⚠️ Esta migration VIRA A CHAVE do multi-local. Ela DEVE ser aplicada JUNTO com o
  deploy do frontend da Parte B (§6.1 corrigido: "Adicionar Estoque" e cadastro de
  produto passam a usar receiveStock). Aplicá-la com o frontend antigo quebraria:
    • o botão "Adicionar Estoque" (escreve products.quantity direto → o cache zera);
    • baixa em produto recém-criado pelo form antigo (sem linha em product_stock);
    • baixa acima do saldo passa a falhar (antes ia a negativo).

  O que faz:
    1. Reconcilia product_stock com o products.quantity ATUAL (cura o drift ocorrido
       entre a migration aditiva e este cutover — enquanto o trigger antigo ainda
       mexia só em products.quantity). Assume snapshot de local único (verdadeiro
       até o frontend permitir distribuir), e é GUARDADA para não achatar produtos
       que já tenham sido distribuídos em vários locais (reaplicável com segurança).
    2. Liga o trigger de cache: products.quantity = SUM(product_stock).
    3. Troca update_stock_on_movement para operar em product_stock.

  Após este cutover, products.quantity vira CACHE derivado; product_stock é a verdade.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reconciliar product_stock com o estoque atual (cura o drift da janela)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 — produtos criados na janela (via form antigo) ainda não têm linha: cria.
INSERT INTO product_stock (product_id, location_id, quantity)
SELECT
  p.id,
  CASE
    WHEN lower(btrim(p.location)) IN ('depósito', 'deposito')
      THEN (SELECT id FROM stock_locations WHERE nome = 'Depósito')
    WHEN p.location ILIKE '%biologia%molecular%'
      THEN (SELECT id FROM stock_locations WHERE nome = 'Biologia Molecular')
    WHEN p.location ILIKE '%faturamento%' OR p.location ILIKE '%financeiro%'
      THEN (SELECT id FROM stock_locations WHERE nome = 'Faturamento/Financeiro')
    ELSE (SELECT id FROM stock_locations WHERE is_principal LIMIT 1)
  END,
  p.quantity
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_stock ps WHERE ps.product_id = p.id)
ON CONFLICT (product_id, location_id) DO NOTHING;

-- 1.2 — ressincroniza o saldo do ÚNICO local de cada produto com o quantity atual.
--       Guarda: só toca produtos com exatamente 1 local (snapshot pré-distribuição).
--       Produtos já distribuídos (>1 local) NÃO são achatados → reaplicável.
UPDATE product_stock ps
   SET quantity = p.quantity, updated_at = now()
  FROM products p
 WHERE ps.product_id = p.id
   AND (SELECT count(*) FROM product_stock ps2 WHERE ps2.product_id = p.id) = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger de cache: products.quantity = SUM(product_stock) (§3.4)
--    A UPDATE em products dispara o trigger existente update_product_status
--    (BEFORE UPDATE), que recalcula status/updated_at a partir do novo quantity.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_product_quantity_cache()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products
     SET quantity = COALESCE((
           SELECT SUM(quantity) FROM product_stock WHERE product_id = v_product_id
         ), 0)
   WHERE id = v_product_id;
  RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_product_quantity_cache ON product_stock;
CREATE TRIGGER trigger_sync_product_quantity_cache
  AFTER INSERT OR UPDATE OR DELETE ON product_stock
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_quantity_cache();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Substitui update_stock_on_movement: deltas em product_stock (§6)
--    products.quantity nunca é escrito aqui — só pelo trigger de cache acima
--    (regra anti-duplicidade).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_to_rastreavel boolean;
  v_legacy_loc    uuid;
BEGIN
  -- DÉBITO na origem ------------------------------------------------------------
  IF NEW.from_location_id IS NOT NULL THEN
    UPDATE product_stock
       SET quantity = quantity - NEW.quantity, updated_at = now()
     WHERE product_id = NEW.product_id AND location_id = NEW.from_location_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não possui saldo no local de origem %',
        NEW.product_id, NEW.from_location_id;
    END IF;

  ELSIF NEW.type = 'out' THEN
    -- LEGADO: out sem from_location_id (fluxo antigo). Debita do local que hoje
    -- detém o saldo; fallback = principal. (A Parte B passa a enviar o local.)
    SELECT location_id INTO v_legacy_loc
      FROM product_stock
     WHERE product_id = NEW.product_id AND quantity > 0
     ORDER BY quantity DESC
     LIMIT 1;
    IF v_legacy_loc IS NULL THEN
      SELECT id INTO v_legacy_loc FROM stock_locations WHERE is_principal LIMIT 1;
    END IF;
    UPDATE product_stock
       SET quantity = quantity - NEW.quantity, updated_at = now()
     WHERE product_id = NEW.product_id AND location_id = v_legacy_loc;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % sem saldo em product_stock para baixa legada',
        NEW.product_id;
    END IF;
  END IF;

  -- CRÉDITO no destino (só se rastreável — §4.1) --------------------------------
  IF NEW.to_location_id IS NOT NULL THEN
    SELECT rastreavel INTO v_to_rastreavel
      FROM stock_locations WHERE id = NEW.to_location_id;
    IF v_to_rastreavel THEN
      INSERT INTO product_stock (product_id, location_id, quantity)
      VALUES (NEW.product_id, NEW.to_location_id, NEW.quantity)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = product_stock.quantity + EXCLUDED.quantity,
                    updated_at = now();
    END IF;
    -- destino não-rastreável: nada em product_stock; a movimentação em si já foi
    -- gravada pelo INSERT que disparou este trigger (log de auditoria).
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- o trigger já existe (AFTER INSERT em stock_movements) e passa a usar o novo
-- corpo; recriado por idempotência/clareza.
DROP TRIGGER IF EXISTS trigger_update_stock_on_movement ON stock_movements;
CREATE TRIGGER trigger_update_stock_on_movement
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_movement();

-- ╔══ [ 2/14] 20260708130000_fase6_coletas.sql ══╗

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

-- ╔══ [ 3/14] 20260708140000_fix_coletas_security_definer.sql ══╗

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

-- ╔══ [ 4/14] 20260709120000_fase7c_temperatura_equipamentos.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa C: Temperatura e Equipamentos
--
-- Monitoramento de temperatura de equipamentos do laboratório (geladeiras,
-- freezers, estufas...) com faixa aceitável por equipamento e alerta de leitura
-- fora da faixa. Independente do fluxo coleta→análise (NÃO toca ac_agendamentos).
--
--   • ac_equipamentos — o equipamento + a faixa [temp_min, temp_max] aceitável
--   • ac_temperaturas — o log de leituras (append-only); `fora_faixa` é derivado
--                       por trigger contra a faixa vigente do equipamento no
--                       momento da leitura (snapshot para alerta/histórico).
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com ac_coletas/ac_checkins (Fase 6). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Função de updated_at compartilhada do módulo (idempotente; já existe na Fase 6).
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. ac_equipamentos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_equipamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT 'geladeira'
              CHECK (tipo IN ('geladeira','freezer','estufa','incubadora','banho_maria','ambiente','outro')),
  localizacao text,
  temp_min    numeric(5,2) NOT NULL,
  temp_max    numeric(5,2) NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_equip_faixa CHECK (temp_min < temp_max)
);

DROP TRIGGER IF EXISTS trg_ac_equipamentos_updated_at ON ac_equipamentos;
CREATE TRIGGER trg_ac_equipamentos_updated_at
  BEFORE UPDATE ON ac_equipamentos
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── 2. ac_temperaturas (log append-only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_temperaturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES ac_equipamentos(id) ON DELETE CASCADE,
  temperatura    numeric(5,2) NOT NULL,
  fora_faixa     boolean NOT NULL DEFAULT false,  -- derivado no trigger (§3)
  registrado_por text NOT NULL,
  observacao     text,
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_temperaturas_equip ON ac_temperaturas(equipamento_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ac_temperaturas_fora  ON ac_temperaturas(equipamento_id) WHERE fora_faixa;

-- ─── 3. Trigger: deriva fora_faixa contra a faixa do equipamento ─────────────
--   Snapshot: grava se a leitura estava fora no momento; mudar a faixa depois não
--   reescreve o histórico. Barra leitura para equipamento inexistente.
CREATE OR REPLACE FUNCTION ac_temperatura_set_fora_faixa()
RETURNS TRIGGER AS $$
DECLARE v_min numeric; v_max numeric;
BEGIN
  SELECT temp_min, temp_max INTO v_min, v_max
    FROM ac_equipamentos WHERE id = NEW.equipamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento % não encontrado', NEW.equipamento_id;
  END IF;
  NEW.fora_faixa := (NEW.temperatura < v_min OR NEW.temperatura > v_max);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_temperatura_fora_faixa ON ac_temperaturas;
CREATE TRIGGER trg_ac_temperatura_fora_faixa
  BEFORE INSERT OR UPDATE OF temperatura, equipamento_id ON ac_temperaturas
  FOR EACH ROW EXECUTE FUNCTION ac_temperatura_set_fora_faixa();

-- ─── 4. RLS — permissiva por authenticated (gate real = frontend) ────────────
ALTER TABLE ac_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_temperaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_equipamentos_select_all"  ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_insert_auth" ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_update_auth" ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_delete_auth" ON ac_equipamentos;
CREATE POLICY "ac_equipamentos_select_all"  ON ac_equipamentos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_equipamentos_insert_auth" ON ac_equipamentos FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_equipamentos_update_auth" ON ac_equipamentos FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_equipamentos_delete_auth" ON ac_equipamentos FOR DELETE TO authenticated USING (TRUE);

-- Leituras são um log append-only: só SELECT + INSERT (sem UPDATE/DELETE).
DROP POLICY IF EXISTS "ac_temperaturas_select_all"  ON ac_temperaturas;
DROP POLICY IF EXISTS "ac_temperaturas_insert_auth" ON ac_temperaturas;
CREATE POLICY "ac_temperaturas_select_all"  ON ac_temperaturas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_temperaturas_insert_auth" ON ac_temperaturas FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ╔══ [ 5/14] 20260709130000_fase7a_exames.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A (frente 1): Catálogo de exames (ac_exames)
--
-- Catálogo dos exames que o funcionário seleciona no check-in (lê o pedido e marca
-- os exames do paciente). Importado da planilha "Comparativo de Valores A C"
-- (Google Sheets, aba Orçamento Particular). Só os campos operacionais: nome,
-- mnemônico, código TUSS e material; preço/convênio ficam fora.
--
-- `is_cultura` marca os exames microbiológicos de cultura (detecção pelo nome:
-- contém "cultura") — são eles que geram uma linha de acompanhamento em ac_culturas.
-- Editável à mão depois (marcar/desmarcar exceções).
--
-- Seed idempotente: só popula se a tabela estiver vazia (preserva edições). 529 exames, 8 culturas.
-- RLS permissiva por authenticated (gate real = frontend), consistente com Fase 6/7C.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. ac_exames ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_exames (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  mnemonico   text,
  codigo_tuss text,
  material    text,          -- tipo de amostra: S (soro), U (urina), F (fezes)…
  is_cultura  boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_exames_cultura ON ac_exames(is_cultura) WHERE is_cultura;
CREATE INDEX IF NOT EXISTS idx_ac_exames_ativo   ON ac_exames(ativo) WHERE ativo;

DROP TRIGGER IF EXISTS trg_ac_exames_updated_at ON ac_exames;
CREATE TRIGGER trg_ac_exames_updated_at
  BEFORE UPDATE ON ac_exames
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE ac_exames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ac_exames_select_all"  ON ac_exames;
DROP POLICY IF EXISTS "ac_exames_insert_auth" ON ac_exames;
DROP POLICY IF EXISTS "ac_exames_update_auth" ON ac_exames;
DROP POLICY IF EXISTS "ac_exames_delete_auth" ON ac_exames;
CREATE POLICY "ac_exames_select_all"  ON ac_exames FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_exames_insert_auth" ON ac_exames FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_exames_update_auth" ON ac_exames FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_exames_delete_auth" ON ac_exames FOR DELETE TO authenticated USING (TRUE);

-- ─── 3. Seed (idempotente: só se vazia) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ac_exames) THEN
    INSERT INTO ac_exames (nome, mnemonico, codigo_tuss, material, is_cultura) VALUES
      ('Alfa-fetoproteína (pesquisa e/ou dosagem)', 'A.FETO', '40316068', 'S', false),
      ('1,25-DIHIDROXIVITAMINA D', 'VIT-D3', '40305015', 'S', false),
      ('17 ALFA HIDROXIPROGESTERONA', '17-PG', '40316017', 'S', false),
      ('17-HIDROXIPREGNENOLONA - PESQUISA E/OU DOSAGEM', NULL, '40305090', 'S', false),
      ('25-HIDROXIVITAMINA D - S', '25-VD3', '40302830', 'S', false),
      ('5 NUCLEOTIDASE', 'NUC', '40301028', 'S', false),
      ('ÁCIDO 5 HIDRÓXI INDOL ACÉTICO, DOSAGEM NA URINA', NULL, '40305112', NULL, false),
      ('ÁCIDO CÍTRICO - PESQUISA E/OU DOSAGEM NA URINA', NULL, '40311015', 'UR', false),
      ('ÁCIDO CÍTRICO- PESQUISA/DOSAGEM NO SANGUE', NULL, '40322270', 'S', false),
      ('ÁCIDO FÓLICO', 'FOLICO', '40301087', 'S', false),
      ('ÁCIDO HIPÚRICO', 'A-HIP', '40313042', 'U', false),
      ('ÁCIDO LÁTICO - LACTATO - S', 'AL', '40301109', 'S', false),
      ('ÁCIDO METIL MALÔNICO - PESQUISA E/OU DOSAGEM', NULL, '40313301', NULL, false),
      ('ÁCIDO METIL-HIPÚRICO', 'A-MH', '40313069', 'U', false),
      ('ÁCIDO OXÁLICO - OXALATO - U', 'AC-OXA', '40301125', 'U', false),
      ('ÁCIDO TRANS, TRANS-MUCÔNICO', 'ATTM', NULL, 'U', false),
      ('ÁCIDO ÚRICO', 'ACU', '40301150', 'S', false),
      ('ÁCIDO ÚRICO - U', 'ACU', '40301180', 'U', false),
      ('ÁCIDO ÚRICO - U-24', 'ACU-24', '40301180', 'U-24', false),
      ('ÁCIDO VALPROICO - VALPROATO DE SÓDIO', 'VAL', '40301168', 'S', false),
      ('ACTH', 'ACTH', '40316041', 'S', false),
      ('ALBUMINA - PESQUISA E/OU DOSAGEM', NULL, '40301222', NULL, false),
      ('ALDOSTERONA - S', 'ALDO-S', '40316050', 'S', false),
      ('ALFA 1 ANTI TRIPSINA', 'A1A', '40301249', 'S', false),
      ('ALFA 1 GLICOPROTEÍNA ÁCIDA', 'A.GLIC', '40301257', 'S', false),
      ('ALUMÍNIO - S', 'ALUM', '40301273', 'S', false),
      ('ALUMÍNIO - U', 'ALUM', '40313190', 'U', false),
      ('AMILASE - S', 'AMI', '40301281', 'S', false),
      ('ANDROSTENEDIONA', 'AND', '40316076', 'S', false),
      ('ANTI - CITOPLASMA DE NEUTRÓFILOS', NULL, '40306402', NULL, false),
      ('ANTI - LKM 1', NULL, '40306097', NULL, false),
      ('Anti HBS - Hepatite B', 'HBS', '40306992', 'S', false),
      ('ANTI-DNA - PESQUISA E/OU DOSAGEM', 'AADNA', '40306062', 'S', false),
      ('ANTI-GAD', NULL, '40305341', 'S', false),
      ('ANTI-ILHOTA', NULL, '40306208', 'S', false),
      ('ANTI-INSULINA', NULL, '40316092', 'S', false),
      ('ANTIBIOGRAMA AUTOMATIZADO', NULL, '40310426', NULL, false),
      ('ANTICOAGULANTE LÚPICO - S', 'LUP-VV', '40304019', 'S', false),
      ('ANTICORPOS ANTI CHIKUNGUNYA IGG E IGM', 'CHIKU', '40324176', 'S', false),
      ('ANTICORPOS ANTI DNA - CADEIA SIMPLES', 'DNA-SS', NULL, 'S', false),
      ('ANTICORPOS ANTI ENDOMÍSIO IGM', 'END-M', '40306259', 'S', false),
      ('ANTICORPOS ANTI HERPES VÍRUS 8 IGG', 'HV8', NULL, 'S', false),
      ('ANTICORPOS ANTI HERPES VÍRUS 8 IGM', 'HV8-M', NULL, 'S', false),
      ('ANTICORPOS ANTI TRANSGLUTAMINASE TECIDUAL IGG', 'TRAN-G', '40308553', 'S', false),
      ('ANTICORPOS ANTI TRANSGLUTAMINASE TECIDUAL IGG', NULL, '40308561', 'S', false),
      ('Antígeno do Fator de Von Willebrand', NULL, '40304191', NULL, false),
      ('ANTÍGENO HLA-B-27, PESQUISA - PCR', 'HLAPCR', '40306887', 'S', false),
      ('ANTIGLIADINA (GLÚTEN) - IGA - PESQUISA E/OU DOSAGEM', NULL, '40306305', 'S', false),
      ('ANTIGLIADINA (GLÚTEN) - IGG - PESQUISA E/OU DOSAGEM', NULL, '40306313', 'S', false),
      ('ANTITROMBINA III', NULL, '40304060', NULL, false),
      ('APOLIPOPROTEÍNA A-1', 'APOA', '40301354', 'S', false),
      ('APOLIPOPROTEÍNA B', 'APOB', '40301362', 'S', false),
      ('AQUAPORINA 4- ANTICORPOS IgG', NULL, '40316661', 'S', false),
      ('ASLO - PESQUISA E/OU DOSAGEM, ANTIESTREPTOLISINA', NULL, '40306445', NULL, false),
      ('ATIVIDADE PLASMÁTICA DA RENINA', 'RENI', '40316432', 'S', false),
      ('AVALIÇÃO DO RISCO FETAL - TESTE TRIPLO', NULL, '40502155', 'S', false),
      ('BAAR - BACILOSCOPIA', 'BAAR', NULL, 'DIV', false),
      ('Bacterioscopia - Coloração de Gram - CONVENCIONAL', NULL, NULL, NULL, false),
      ('BCR::ABL1 quantitativo P190', NULL, '40503542', NULL, false),
      ('BETA HCG QUANTITATIVO', 'HCGDIL', '40305767', 'S', false),
      ('BETA-2-GLICOPROTEÍNA I, ANTICORPOS IgG E IgM', NULL, '40308898', NULL, false),
      ('BETA-2-MICROGLOBULINA - PESQUISA E/OU DOSAGEM', NULL, '40306470', 'S', false),
      ('BILIRRUBINAS', 'BIL', '40301397', 'S', false),
      ('BIÓPSIA COM COLORAÇÃO ESPECIAL', 'BCE', NULL, 'DIV', false),
      ('BIOPSIA DE COLO UTERINO', NULL, NULL, NULL, false),
      ('BIOPSIA DE ENDOMETRIO', NULL, NULL, NULL, false),
      ('BIOPSIA DE POLIPO', NULL, NULL, NULL, false),
      ('BIOPSIA DE VESICULA BILIAR', NULL, '40316170', NULL, false),
      ('BIOPSIA MULTIFRAGMENTOS (Ex: Restos Ovulares, RTU, diversos fragmentos de prostata, entre outros)', NULL, NULL, NULL, false),
      ('BIOPSIA SEXTANTE - PROSTATA (Seis Frascos)', NULL, NULL, NULL, false),
      ('BIOPSIA SIMPLES (1º frasco - 250, R$ 2º em diante R$ 175)', NULL, '40601200', NULL, false),
      ('C-TELOPEPTÍDEO - CTX-I', NULL, '40305449', 'S', false),
      ('CA 125', NULL, '40316378', NULL, false),
      ('CA 15-3', 'CA15', '40316378', 'S', false),
      ('CA 19.9', NULL, '40316378', NULL, false),
      ('CA 72-4', 'CA72', '40316378', 'S', false),
      ('CADEIAS LEVES LIVRES KAPPA/LAMBDA (FREELITE)', 'KLFREE', NULL, 'U-24', false),
      ('CÁLCIO - S', 'CA', '40301400', 'S', false),
      ('CÁLCIO - U-24', 'CA-U', '40301400', 'U-24', false),
      ('CÁLCIO IÔNICO', 'CA-IO', '40301419', 'S', false),
      ('CÁLCIO IÔNICO - CALCULADO', 'CAIOCL', '40301474', 'S', false),
      ('CALCITONINA', 'CAL-C', '40316165', 'S', false),
      ('CALPROTECTINA, DETECÇÃO NAS FEZES', NULL, '40303330', 'F', false),
      ('CAPACIDADE LIVRE DE COMBINAÇÃO DO FERRO', 'CL-CF', '40301427', 'S', false),
      ('CAPACIDADE TOTAL DE COMBINAÇÃO DO FERRO', 'CT-CF', '40301555', 'S', false),
      ('CAPSULA MAMARIA >> MAMOPLASTIA', NULL, NULL, NULL, false),
      ('CAPTURA HÍBRIDA PARA HPV - DIV', 'CHHPV', '40601293', 'DIV', false),
      ('CARDIOLIPINA IgA, AUTO ANTICORPOS', 'CARDIA', '40306135', 'S', false),
      ('CARDIOLIPINA IgG, AUTO ANTICORPOS', 'CARDIG', '40306143', 'S', false),
      ('CARDIOLIPINA IgM, AUTO ANTICORPOS', 'CARDIM', '40306151', 'S', false),
      ('CARIÓTIPO COM BANDA G - S', 'CARIB', '40501051', 'S', false),
      ('CARIÓTIPO COM BANDA G PARA 100 CÉLULAS', 'CAR100', NULL, 'S', false),
      ('CARIÓTIPO COM BANDA G PARA 50 CÉLULAS', 'CAR50', NULL, 'S', false),
      ('CATECOLAMINAS - FRAÇÕES - S', 'CATEC', NULL, 'S', false),
      ('CCP, ANTICORPOS ANTI', 'CCP', '49901010', 'S', false),
      ('CD4 - SUBPOPULAÇÃO LINFOCITÁRIA', 'CD4', '40307433', 'S', false),
      ('CEA', 'CEA', '40316122', 'S', false),
      ('CÉLULA PARIETAL, ANTICORPOS ANTI', 'A.CP', '40306429', 'S', false),
      ('CERULOPLASMINA - PESQUISA E/OU DOSAGEM', NULL, '40301478', NULL, false),
      ('CHAGAS IGG - PESQUISA E/OU DOSAGEM', NULL, '40306615', NULL, false),
      ('CHLAMYDIA TRACHOMATIS IgG, ANTICORPOS ANTI', 'CHLA-G', '40306631', 'S', false),
      ('CHLAMYDIA TRACHOMATIS IgM, ANTICORPOS ANTI', 'CHLA-M', '40306640', 'S', false),
      ('CHLAMYDIA TRACHOMATIS-NEISSERIA GONORRHOEAE (PCR)', 'PCRC', '40314278', 'UR', false),
      ('CHLAMYDIA TRACHOMATIS-NEISSERIA GONORRHOEAE (PCR) - DIV', 'PCRC', NULL, 'DIV', false),
      ('CHLAMYDIA TRACHOMATIS-NEISSERIA GONORRHOEAE (PCR) - U', 'PCRC', NULL, 'U', false),
      ('CHUMBO - S', 'PB-S', '40313107', 'S', false),
      ('CICLOSPORINA', 'CICLO', '40301486', 'S', false),
      ('CISTATINA C- DOSAGEM NO SANGUE', NULL, '40322424', 'S', false),
      ('CITOLOGIA CONVENCIONAL', NULL, NULL, NULL, false),
      ('CITOLOGIA DE LIQUIDOS', NULL, NULL, NULL, false),
      ('CITOLOGIA DE PUNÇÃO ASPIRATIVA DE AGULHA FINA', 'PAAF', NULL, 'DIV', false),
      ('CITOLOGIA EM MEIO LÍQUIDO', 'CML', NULL, 'DIV', false),
      ('CITOLOGIA ONCÓTICA', 'CO', NULL, 'DIV', false),
      ('CITOLOGIA ONCÓTICA GERAL', 'COG', NULL, 'DIV', false),
      ('CITOMEGALOVÍRUS IgG, ANTICORPOS', 'CMG-ES', '40306666', 'S', false),
      ('CITOMEGALOVÍRUS IgG, ANTICORPOS (ELFA)', 'CMV', '40306666', 'S', false),
      ('CITOMEGALOVÍRUS IGM - PESQUISA E/OU DOSAGEM', NULL, '40306674', NULL, false),
      ('CITOMEGALOVÍRUS IgM, ANTICORPOS', 'CMM-ES', '40306674', 'S', false),
      ('CITOMEGALOVIRUS IgM, ANTICORPOS (ELFA)', 'CMV-GM', '40306674', 'S', false),
      ('CLORETOS - S', 'CL', '90094654', 'S', false),
      ('CLORO - PESQUISA E/OU DOSAGEM', NULL, '40301559', 'S', false),
      ('COAGULOGRAMA + ATIVIDADES', 'COAG', '40304922', 'S', false),
      ('COBRE - S', 'COBRE', '40301567', 'S', false),
      ('COBRE - U', 'COBRE', '40301567', 'U', false),
      ('COBRE - U-24', 'COBRE', '40301567', 'U-24', false),
      ('Cocaína, pesquisa e/ou Dosagem', NULL, '40301575', NULL, false),
      ('COENZIMA Q10', NULL, '40319067', NULL, false),
      ('COFATOR RISTOCETINA - FATOR V. WILLEBRAND', NULL, '40304574', NULL, false),
      ('COLESTEROL HDL', 'HDL', '40301583', 'S', false),
      ('COLESTEROL LDL', 'LDL', '40301591', 'S', false),
      ('COLESTEROL TOTAL - S', 'C', '40301605', 'S', false),
      ('COLESTEROL VLDL', 'VLDL', '40302695', 'S', false),
      ('COMPLEMENTO C4 - PESQUISA E/OU DOSAGEM', NULL, '40306712', NULL, false),
      ('COMPLEMENTO DO CH-50', 'CCH', '40306747', 'S', false),
      ('COMPLEMENTO SÉRICO C3', 'C3', '40306704', 'S', false),
      ('COMPLEMENTO SÉRICO C4', 'C4', '40306712', 'S', false),
      ('COMPOSTO S 11 DESOXI-CORTISOL', 'CS11', '40316181', 'S', false),
      ('COOMBS DIRETO', 'CBD', '40304108', 'S', false),
      ('COOMBS INDIRETO - ANTICORPOS IRREGULARES PESQUISA', 'CBI', '40304884', 'S', false),
      ('COPROCULTURA', 'CTF', '40310175', 'F', true),
      ('COPROCULTURA-FEZES', NULL, '40310183', NULL, true),
      ('COPROLÓGICO FUNCIONAL (CARACTERES, PH, DIGESTIBILIDADE, AMÔNIA, ÁCIDOS ORGÂNICOS E INTERPRETAÇÃO)', NULL, '40303039', 'F', false),
      ('CORE BIOPSY / Frasco', NULL, NULL, NULL, false),
      ('CORTISOL BASAL - SORO', 'CORT-B', '40316190', 'S', false),
      ('CORTISOL LIVRE', NULL, '40305210', NULL, false),
      ('CORTISOL SALIVAR BASAL', 'CORSBASAL', '40316190', NULL, false),
      ('CORTISOL SALIVAR MANHA', 'CORSMAN', '40316190', NULL, false),
      ('CORTISOL SALIVAR TARDE', 'CORSTARDE', '40316190', NULL, false),
      ('CORTISOL SALIVAR NOITE', 'CORSNOITE', '40316190', 'SAL', false),
      ('CREATININA - S', 'CRE', '40301630', 'S', false),
      ('CREATININA - U', 'CRE-U', '40301630', 'U', false),
      ('CREATININA - U-24', 'CRE-U', '40301630', 'U-24', false),
      ('CREATININA, CLEARANCE', 'C-CRE', '40301508', 'S+U', false),
      ('CREATINOFOSFOQUINASE', 'CPK', '40301648', 'S', false),
      ('CREATINOFOSFOQUINASE FRAÇÃO MB - MASSA', 'CMB-M', NULL, 'S', false),
      ('CRIOGLOBULINAS - Pesquisa', NULL, '40308014', NULL, false),
      ('CROMO - S', 'CROMO', '40313310', 'S', false),
      ('CULTURA + ANTIBIOGRAMA', 'CT+ABD', NULL, 'DIV', true),
      ('CULTURA BACTERIANA (EM DIVERSOS MATERIAIS BIOLÓGICOS)', NULL, '40310124', NULL, true),
      ('CULTURA PARA FUNGOS + ANTIFUNGIGRAMA', NULL, NULL, NULL, true),
      ('CULTURA SELETIVA PARA STREPTOCOCCUS GRUPO B', 'CSSB', NULL, 'DIV', true),
      ('CULTURA, URINA COM CONTAGEM DE COLÔNIAS', NULL, '40310213', NULL, true),
      ('DAOPLUS Análise da Atividade da Enzima Diamina Oxidase (DAO)', NULL, '40316000', NULL, false),
      ('DEHIDROEPIANDROSTERONA', 'DHE', '40316211', 'S', false),
      ('DEHIDROGENASE LÁCTICA - S', 'LDH', '40301729', 'S', false),
      ('DENGUE, ANTICORPOS IgG', 'DENGUE', '40306798', 'S', false),
      ('DENGUE, ANTICORPOS IgM', 'DENGM', '40306798', 'S', false),
      ('DENGUE NS1', 'NS1', '40324192', 'S', false),
      ('DESIDROGENASE ALFA-HIDROXIBUTIRATO - PESQUISA E/OU DOSAGEM', NULL, '40301699', 'S', false),
      ('DETECÇÃO DE EPSTEIN BARR', NULL, '40314359', NULL, false),
      ('DIALDEÍDO MALÔNICO', NULL, '40313140', 'S', false),
      ('DIHIDROTESTOSTERONA', 'DHT-RE', '40316220', 'S', false),
      ('DÍMERO D', 'DIME-D', '40304906', 'S', false),
      ('ELASTASE PANCREÁTICA FECAL', 'ELASPF', '40303284', 'F', false),
      ('ELETROFORESE DE HEMOGLOBINA', 'ELFHB', '40304353', 'S', false),
      ('ELETROFORESE DE LIPOPROTEÍNAS', 'ELFLIP', '40301788', 'S', false),
      ('ELETROFORESE DE PROTEÍNAS - S', 'ELFPRO', '40301761', 'S', false),
      ('ELETROFORESE DE PROTEÍNAS DE ALTA RESOLUÇÃO', NULL, '40302717', 'S', false),
      ('ENDOMÍSIO IgA, ANTICORPOS ANTI', 'AAEIGA', '40306259', 'S', false),
      ('ENDOMÍSIO IgG - ANTICORPOS ANTI', 'AT-END', NULL, 'S', false),
      ('EPSTEIN BARR IgG - ANTICORPOS', 'EP-BRG', '40307565', 'S', false),
      ('EPSTEIN BARR IgM - ANTICORPOS', 'EP-BR', '40307581', 'S', false),
      ('ERITROPOIETINA', 'ERITRO', '40305295', 'S', false),
      ('ESQUISTOSSOMOSE, ANTICORPO IgG', 'SCH-IF', '40307719', 'S', false),
      ('ESTRADIOL, 17 BETA', 'E2', '40316246', 'S', false),
      ('ESTRIOL LIVRE', 'FE3-S', '40316254', 'S', false),
      ('ESTRONA', 'ESTRON', '40316262', 'S', false),
      ('ESTUDO GENÉTICO DA APOLIPOPROTEÍNA E - S', 'APOE-G', NULL, 'S', false),
      ('ESTUDO GENÉTICO DA HEMOCROMATOSE PLUS - DIV', 'HEMOPL', NULL, 'DIV', false),
      ('ESTUDO GENÉTICO DA MUTAÇÃO S65C PARA HEMOCROMATOSE', NULL, '40302060', 'S', false),
      ('ESTUDO GENÉTICO DAS MUTAÇÕES C282Y E H63D PARA HEMOCROMATOSE', NULL, '40712046', 'S', false),
      ('ESTUDO MOLECULAR DA MUTAÇÃO R337H NO GENE TP53', 'TP53SQ', '40503402', 'S', false),
      ('EVEROLIMUS, DOSAGEM', NULL, '40322319', NULL, false),
      ('EXAME DIRETO A FRESCO - URINA, FEZES, SECREÇÃO E ESPERMA', NULL, '41301188', NULL, false),
      ('EXAME MICOLÓGICO DIRETO', NULL, '41301226', NULL, false),
      ('FAN - PESQUISA DE ANTICORPOS ANTICÉLULA - S', 'HEP2', '40306852', 'S', false),
      ('FATOR ANTINÚCLEO, (FAN) - PESQUISA E/OU DOSAGEM', NULL, '40306852', NULL, false),
      ('FATOR DE CRESCIMENTO VASCULAR ENDOTELIAL (VEGF)', 'VEGF', '40316807', 'S', false),
      ('FATOR INTRÍNSECO, AUTO ANTICORPOS', NULL, '40308650', NULL, false),
      ('FATOR NATRIURÉTICO ATRIAL', 'FNA', '40302776', 'S', false),
      ('FATOR REUMATÓIDE - S', 'FR', '40306860', 'S', false),
      ('FATOR V DE LEIDEN POR PCR - PESQUISA', NULL, '40314057', 'S', false),
      ('FATOR V, DOSAGEM', NULL, '40304183', NULL, false),
      ('FENOBARBITAL', 'FENO', '40301834', 'S', false),
      ('FERRITINA SÉRICA', 'FERRI', '40316270', 'S', false),
      ('FERRO SÉRICO', 'FE', '40301842', 'S', false),
      ('FIBRINOGENIO - S', 'FIB-A', '40304264', 'S', false),
      ('FILÁRIA, PESQUISA - Sangue total ou esfregaço', NULL, '40304272', NULL, false),
      ('FOSFATASE ALCALINA', 'PAL', '40301885', 'S', false),
      ('FOSFATIDILSERINA, ANTICORPOS IgM, IgG e IgA', NULL, '40308685', 'S', false),
      ('FÓSFORO - S', 'P', '40301931', 'S', false),
      ('FÓSFORO - U', 'P', '40301931', 'U', false),
      ('FRUTOSAMINA', 'P-GLI', '40301958', 'S', false),
      ('FUNGOS - PESQUISA', 'FUNGOS', NULL, 'DIV', false),
      ('GAMA GT', 'YGT', '40301990', 'S', false),
      ('PAINEL GENETICO - GENERA BASIC', NULL, NULL, NULL, false),
      ('PAINEL GENETICO - GENERA PREMIUM', NULL, NULL, NULL, false),
      ('GH - HORMÔNIO DE CRESCIMENTO', 'HGH', '40316203', 'S', false),
      ('GLIADINA IgA, ANTICORPOS ANTI', 'AAG', '40306305', 'S', false),
      ('GLIADINA IgG, ANTICORPOS ANTI', 'AAGG', '40306313', 'S', false),
      ('GLIADINA IgM, ANTICORPOS ANTI', 'GLIA-M', NULL, 'S', false),
      ('GLICOSE - 2 HORAS PÓS-PRANDIAL', 'G-PP', '40302040', 'S', false),
      ('GLICOSE - JEJUM - S', 'G', '40302040', 'S', false),
      ('GLOBULINA LIGADORA DE HORMÔNIOS SEXUAIS - SHBG', 'SHBG', '40316300', 'S', false),
      ('GLUTATIONA PEROXIDASE', NULL, '40304116', 'S', false),
      ('GORDURA FECAL, DOSAGEM', NULL, '40303055', 'F', false),
      ('GRUPO SANGUÍNEO + FATOR RH/DU', 'GS-RH', '40304299', 'S', false),
      ('HAV IgG, ANTI', 'HAV-G', '40306933', 'S', false),
      ('HAV IgM, ANTI', 'HAV-M', '40306941', 'S', false),
      ('HBC IgG, ANTI', 'HBC-G', NULL, 'S', false),
      ('HBC IgM, ANTI', 'HBC-M', '40306968', 'S', false),
      ('HBC TOTAL, ANTI', 'HBCT', NULL, 'S', false),
      ('HBE-AG', 'HBE-G', '40306984', 'S', false),
      ('HBE, ANTI', 'HBE', '40306976', 'S', false),
      ('HBsAg', 'AU', '40307018', 'S', false),
      ('HCV PCR QUANTITATIVO EM TEMPO REAL - S', 'PTRHCV', '40314103', 'S', false),
      ('HCV, ANTI', 'HCV', '40307026', 'S', false),
      ('HELICOBACTER PYLORI (ANTÍGENO) - fezes', NULL, '40303209', NULL, false),
      ('HEMATOCRITO', NULL, '40304337', NULL, false),
      ('HEMOGLOBINA GLICADA (HBA1C)', 'GLIHB', '40302075', 'S', false),
      ('HEMOGRAMA COM CONTAGEM DE PLAQUETAS OU FRAÇÕES', 'HG', '40304361', 'S', false),
      ('HEMOSSEDIMENTAÇÃO, (VHS) - PESQUISA E/OU DOSAGEM', 'HS', '40304370', 'S', false),
      ('HEPATITE A - HAV - IGG - PESQUISA E/OU DOSAGEM', NULL, '40306933', NULL, false),
      ('HEPATITE A - HAV - IGM - PESQUISA E/OU DOSAGEM', NULL, '40306941', NULL, false),
      ('HEPATITE B - HBCAC - IGG (ANTI-CORE IGG OU ACOREG) - PESQUISA E/OU DOSAGEM', NULL, '40306950', NULL, false),
      ('HEPATITE E - ANTICORPOS IGG', NULL, '40324362', 'S', false),
      ('HEPATITE E - ANTICORPOS, IGM', NULL, '40324370', 'S', false),
      ('HEPATOGRAMA', NULL, '40312151', NULL, false),
      ('HERPESVÍRUS SIMPLES I E II IgG', 'HVI-IG', '40307085', 'S', false),
      ('HERPESVÍRUS SIMPLES I E II IgM', 'HVI-IM', '40307093', 'S', false),
      ('HERPESVÍRUS SIMPLES II, ANTICORPOS IgG', 'HV-IIG', '40307085', 'S', false),
      ('HISTAMINA', NULL, '40307131', NULL, false),
      ('HISTERECTOMIA (UTERO + 1 ANEXO BILATERAIS)', NULL, NULL, NULL, false),
      ('HISTERECTOMIA (UTERO + 2 ANEXOS BILATERAIS)', NULL, NULL, NULL, false),
      ('HISTOPATOLÓGICO DE PELE', 'HPELE', NULL, 'DIV', false),
      ('HIV - CARGA VIRAL PCR - PESQUISA', NULL, '40314120', NULL, false),
      ('HIV 1 E 2 PESQUISA DE ANTÍGENO E ANTICORPOS - S', 'HIV-ME', '40307182', 'S', false),
      ('HOMOCISTEÍNA', 'HOMOCI', '40302113', 'S', false),
      ('HORMÔNIO ANTI-MULLERIANO', NULL, '40316890', NULL, false),
      ('HORMÔNIO FOLÍCULO ESTIMULANTE - FSH', 'FSH', '40316289', 'S', false),
      ('HORMÔNIO LUTEINIZANTE - LH', 'LH', '40316335', 'S', false),
      ('HPV DETECÇÃO E GENOTIPAGEM DE ALTO RISCO', 'HPV-AR', NULL, 'DIV', false),
      ('HTLV I / II POR PCR (CADA) - PESQUISA', NULL, '40314162', NULL, false),
      ('HTLV I E II, ANTICORPOS ANTI - PESQUISA - S', 'HTLV1', '40307212', 'S', false),
      ('IA2, ANTI', 'IA2', '40306208', 'S', false),
      ('IGA - PESQUISA E/OU DOSAGEM', NULL, '40307220', NULL, false),
      ('IgE Componente Pelo de Gato – Fel d2 (e220)', NULL, '40307263', NULL, false),
      ('IgE Específico – Tartrazina (c717)', NULL, '40002213', NULL, false),
      ('IgE Específico – Vermelho Carmim (F340)', NULL, '40307255', NULL, false),
      ('IGE ESPECÍFICO DERMATOPHAGOIDES PTERONYSSINUS (D1)', 'IGE-DP', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA ÁCIDO BENZOICO C703', 'C703', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA ALFA LACTOALBUMINA (F76)', 'F76', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA AMENDOIM (F13)', 'F13', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA BERINJELA F262', 'F262', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA BETA LACTOGLOBULINA (F77)', 'F77', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA CAMARÃO (F24)', 'F24', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA CASEÍNA (F78)', 'F78', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA CASPA DE CÃO (E5)', 'E5', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA CLARA DE OVO (F1)', 'F1', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA EXTRATO DE COCHONILHA (F340)', 'F340', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA GEMA DE OVO (F75)', 'F75', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA GLÚTEN (F79)', 'F79', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA GLYCYPHAGUS DOMESTICUS D73', 'D73', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA GRÃO DE SOJA (F14)', 'F14', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA LEITE (F2)', 'F2', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA OVO (F245)', 'F245', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA PEIXE-BACALHAU (F3)', 'F3', '40307263', 'S', false),
      ('IGE ESPECÍFICO PARA TRIGO (F4)', 'F4', '40307263', 'S', false),
      ('IgE Insetos – Barata (I6)', NULL, '40307263', NULL, false),
      ('IGE MÚLTIPLO (FX2)', 'FX2', '40307344', 'S', false),
      ('IGE MÚLTIPLO (FX5)', 'FX5', '40307344', 'S', false),
      ('IGE MÚLTIPLO (HX2)', 'HX2', '40307344', 'S', false),
      ('IGE MÚLTIPLO (MX1)', 'MX1', '40307344', 'S', false),
      ('IGE MÚLTIPLO PARA FX74', 'FX74', '40307344', 'S', false),
      ('IgE Painel Alimentos (FX5E)', NULL, '40307271', NULL, false),
      ('IgE Painel Epitélios (EX2)', NULL, '40307255', NULL, false),
      ('IgE Poeira Doméstica – rDer p23 (d209)', NULL, '40307263', NULL, false),
      ('IgE Poeira e Ácaro (HX2)', NULL, '40307255', NULL, false),
      ('IGE TOTAL', 'IGE', '40307271', 'S', false),
      ('IGE, GRUPO ESPECÍFICO, - PESQUISA E/OU DOSAGEM', NULL, '40307255', NULL, false),
      ('IGE, POR ALÉRGENO (CADA) - PESQUISA E/OU DOSAGEM', NULL, '40307263', NULL, false),
      ('IGF-1 - SOMATOMEDINA C', 'SMC', '40316440', 'S', false),
      ('IGFBP-3 - PROTEÍNA LIGADORA-3 DO IGF', 'IGFBP3', '40305406', 'S', false),
      ('IGRA - Interferon Gama (Tuberculose)', NULL, '40324648', NULL, false),
      ('IMUNO-HISTOQUIMICA', NULL, NULL, NULL, false),
      ('IMUNO-HISTOQUIMICA - SEGUNDO BLOCO', NULL, NULL, NULL, false),
      ('IMUNOFENOTIPAGEM - PAINEL PROLIFERATIVO - S', 'IFPP', '40302725', 'S', false),
      ('IMUNOFIXAÇÃO - S', 'IMUFIX', NULL, 'S', false),
      ('IMUNOFIXAÇÃO - U-24', 'IMUFIX', NULL, 'U-24', false),
      ('IMUNOGLOBULINAS', 'IG', '40316343', 'S', false),
      ('IMUNOGLOBULINAS IgA', 'I-IA', '40324478', 'S', false),
      ('IMUNOGLOBULINAS IgG PESQUISA E/OU DOSAGEM', 'I-IG', '40307280', 'S', false),
      ('IMUNOGLOBULINAS IgM', 'I-IM', '40324087', 'S', false),
      ('IMUNOHISTOQUÍMICA GERAL', 'IH', NULL, 'DIV', false),
      ('IMUNOHISTOQUÍMICA GERAL COM ANTICORPO ISOLADO', 'IH-ISO', NULL, 'DIV', false),
      ('INDICAN- PESQUISA URINA', NULL, '40502082', 'U', false),
      ('ÍNDICE DE IMUNOPRODUÇÃO (ELETROF. E IGG EM SORO E LÍQUOR) - PESQUISA E/OU DOSAGEM', NULL, '40309096', 'D', false),
      ('INDICE DE SATURAÇÃO DE FERRO', NULL, '40321231', NULL, false),
      ('ÍNDICE DE TIROXINA LIVRE', 'T3+T4', '40316351', 'S', false),
      ('INDICE HOMA', 'HOMA-A', '40302041', 'S', false),
      ('INFECÇÕES SEXUALMENTE TRANSMISSÍVEIS, PCR - DIV', 'DSTPCR', NULL, 'DIV', false),
      ('INFECÇÕES SEXUALMENTE TRANSMISSÍVEIS, PCR - U', 'DSTPCR', NULL, 'U', false),
      ('INIBINA A - INA', NULL, '40321240', NULL, false),
      ('INIBINA B - INB', NULL, '40321258', NULL, false),
      ('INSULINA', 'INSU', '40316360', 'S', false),
      ('INSULINA BASAL', 'INSU-B', '40316360', 'S', false),
      ('INSULINA, AUTO ANTICORPOS ANTI', 'A.INS', '40316092', 'S', false),
      ('INTERLEUCINA 6- IL 6', NULL, '40321282', 'S', false),
      ('INVESTIGAÇÃOO HISTOPATOLÓGICA FETO-PLACENTÁRIA', NULL, NULL, NULL, false),
      ('IODO EM URINA', NULL, '40321878', 'U', false),
      ('LACTATO DESIDROGENASE - LDH', NULL, '40301729', NULL, false),
      ('LACTOSE, TESTE DE TOLERÂNCIA PADRÃO', 'LAC-T', '40302164', 'S', false),
      ('LAMOTRIGINA - PESQUISA E/OU DOSAGEM', NULL, '40302741', NULL, false),
      ('LEPTINA', 'LEPTI', '40305422', 'S', false),
      ('LIPASE - S', 'LIPASE', '40302199', 'S', false),
      ('LIPOPROTEÍNA - a', 'LIPOPA', '40302210', 'S', false),
      ('LÍTIO', 'LI', '40302229', 'S', false),
      ('MACRO PROLACTINA', 'BPRL', '40305775', 'S', false),
      ('MAGNÉSIO - S', 'MAG', '40302237', 'S', false),
      ('MAMOPLASTIA (BILATERAL)', NULL, NULL, NULL, false),
      ('MAMOPLASTIA UNILATERAL', NULL, NULL, NULL, false),
      ('MANGANÊS', 'MN', '40321967', 'S', false),
      ('METANEFRINAS PLASMÁTICAS', NULL, '81032200', 'S', false),
      ('Micologico Direto', NULL, NULL, NULL, false),
      ('MICOPLASMA PNEUMONIAE - IGG - PESQUISA E/OU DOSAGEM', NULL, '40307522', NULL, false),
      ('MICOPLASMA PNEUMONIAE - IGM - PESQUISA E/OU DOSAGEM', NULL, '40307530', NULL, false),
      ('MICROALBUMINÚRIA - U', 'M-ALB', '40311171', 'U', false),
      ('MICROALBUMINÚRIA - U-24', 'M-ALB', '40311171', 'U-24', false),
      ('MICROBIOMA VAGINAL', NULL, NULL, NULL, false),
      ('MIOGLOBINA, PESQUISA - NA URINA', NULL, '40311341', 'U', false),
      ('MIOGLOBINA, PESQUISA E/OU DOSAGEM', NULL, '40302245', 'S', false),
      ('MIOGLOBINA, SORO', 'MIOGL', '40302245', 'S', false),
      ('Mutação de MTHFR', NULL, NULL, NULL, false),
      ('Mutação do gene PAI', NULL, NULL, NULL, false),
      ('Mutação fator V de Leiden', NULL, NULL, NULL, false),
      ('MUTAÇÂO MPL (W515L e W515K)', NULL, '40503666', 'S', false),
      ('MUTAÇÕES A1298C E C677T DA MTHFR', NULL, '40314286', 'S', false),
      ('MUTAÇÕES NO EXON 9 DO GENE DA CALRETICULINA (CALR)', NULL, '40323986', 'S', false),
      ('MYCOPLASMA HOMINIS/UREAPLASMA UREALYTICUM - PCR', NULL, NULL, NULL, false),
      ('Nicotina qualitativa urina (amostra isolada)', NULL, '40321436', NULL, false),
      ('NT-proBNP - PEPTÍDEO NATRIURÉTICO CEREBRAL', 'BNP', '40302776', 'S', false),
      ('PAINEL CANDIDA', NULL, NULL, NULL, false),
      ('Painel de Trombofilias', NULL, NULL, NULL, false),
      ('PAINEL IST I (7 Patógenos)', NULL, NULL, NULL, false),
      ('PAINEL IST IV', NULL, NULL, NULL, false),
      ('PAINEL IST VIII ( IST I + Strep )', NULL, NULL, NULL, false),
      ('Painel Lactobacillus', NULL, NULL, NULL, false),
      ('PAINEL MOLECULAR PARA DOENÇA DE ALZHEIMER', 'P-ALZH', NULL, 'DIV', false),
      ('PAINEL PARA CÂNCER DE MAMA E OVÁRIO HEREDITÁRIOS', 'MAOV', '40304326', 'S', false),
      ('PAINEL PARA CÂNCER HEREDITÁRIO', 'PC-HER', NULL, 'S', false),
      ('PAINEL PARA CÂNCER HEREDITÁRIO EXPANDIDO', 'PCHA', '40503801', 'S', false),
      ('PAINEL SARS-COV-2, RSV, FLU A E FLU B, PCR REAL TIME', 'T4RV', NULL, 'DIV', false),
      ('PAINEL SOMÁTICO PARA GENES DA VIA DE REPARO HOMÓLOGA DO DNA', 'CP-HRR', NULL, 'DIV', false),
      ('PAINEL ULCERA GENITAL', NULL, NULL, NULL, false),
      ('PAINEL VAGINOSE', NULL, NULL, NULL, false),
      ('Painel X (4 Patógenos)', NULL, NULL, NULL, false),
      ('PARASITOLÓGICO', 'FP', '40303110', 'F', false),
      ('PARASITOLÓGICO - MIF', 'FPM', '40303128', 'F', false),
      ('PARATORMÔNIO - PTH OU FRAÇÃO (CADA) - PESQUISA E/OU DOSAGEM', NULL, '40305465', NULL, false),
      ('PARATORMÔNIO PTH INTACTO (MOLÉCULA INTEIRA)', 'PTH', '40316424', 'S', false),
      ('PARVOVÍRUS B19 IgG, ANTICORPOS ANTI', 'PARVOG', NULL, 'S', false),
      ('PARVOVÍRUS B19 IgM, ANTICORPOS ANTI', 'PARVOM', NULL, 'S', false),
      ('PCR - Herpes I e II', NULL, NULL, NULL, false),
      ('PCR - PROTEÍNA C REATIVA QUANTITATIVA', 'PCRNUS', '40308383', 'S', false),
      ('PCR - PROTEÍNA C REATIVA QUANTITATIVA ALTA SENSIBILIDADE', 'PC-RQ', '40308391', 'S', false),
      ('PCR CLAMÃDIA/ GONOCOCOS', NULL, NULL, NULL, false),
      ('PCR HPV ALTO RISCO', NULL, NULL, NULL, false),
      ('PCR HPV GENOTIPAGEM 28 TIPOS', NULL, NULL, NULL, false),
      ('PCR HPV GENOTIPAGEM 35 TIPOS', NULL, NULL, NULL, false),
      ('PCR HPV Quant 21', NULL, NULL, NULL, false),
      ('PCR PARA HPV A/B', NULL, NULL, NULL, false),
      ('PEÇA CIRÚRGICA', 'PCRS', '40601218', 'DIV', false),
      ('PECA CIRURGICA COMPLEXA', NULL, NULL, NULL, false),
      ('PEÇA CIRÚRGICA POR ÓRGÃO ADICIONAL', 'PCRSN', '40601226', 'DIV', false),
      ('PECA CIRURGICA SIMPLES (Ex: Mama)', NULL, NULL, NULL, false),
      ('PECA DE COLO UTERINO - CONIZACAO, CAF, LEEP ou a frio', NULL, NULL, NULL, false),
      ('Pele - Por frasco', NULL, NULL, NULL, false),
      ('PEPTÍDEO C', 'PEP', '40316394', 'S', false),
      ('PERFIL COMPLETO ÁCIDOS GRAXOS', NULL, '40302890', NULL, false),
      ('Perfil de Trombose (04 mutaÃ§Ãµes)', NULL, NULL, NULL, false),
      ('Perfil de Trombose (06 mutaÃ§Ãµes)', NULL, NULL, NULL, false),
      ('PERFIL DOS ÁCIDOS GRAXOS', NULL, '40302903', NULL, false),
      ('PERFIL LIPÍDICO', 'LIPIDG', '40302750', 'S', false),
      ('Pesquisa da Mutação V600E no Gene BRAF - Tumor', NULL, '40503780', NULL, false),
      ('PESQUISA DE BANDAS OLIGOCLONAIS POR ISOFOCALIZAÇÃO - PESQUISA E/OU DOSAGEM EM LÍQUIDOS ORGÂNICOS', NULL, '40309134', 'L', false),
      ('Pesquisa de Mutação no Gene Jak2 V617F - Sangue', NULL, '40503372', NULL, false),
      ('Pesquisa de Mutações nos Genes KRAS e NRAS - Tumor', NULL, '40503771', NULL, false),
      ('PLACENTA, CORDAO E MEMBRANAS', NULL, '40316170', NULL, false),
      ('POTÁSSIO - S', 'K', '40302318', 'S', false),
      ('PRECIVITY AD2 (ALZHEIMER) - FLEURY', 'BIOL-F', NULL, 'S', false),
      ('PREGNENOLONA', NULL, '40317030', 'S', false),
      ('PROGESTERONA', 'PG', '40316408', 'S', false),
      ('PROLACTINA', 'PRL', '40316416', 'S', false),
      ('PROSTAGLANDINA E2 - urina 24h', NULL, '90010158', 'UR24', false),
      ('PROSTATECTOMIA RADICAL', NULL, NULL, NULL, false),
      ('Proteína Beta Trace (Prostaglandina D2 Sintetase)', NULL, '40306470', 'S', false),
      ('PROTEÍNA C ANTIGÊNICA', 'PC-ANT', '40323706', 'S', false),
      ('Proteína C Funcional', NULL, '40304507', NULL, false),
      ('PROTEINA C REATIVA', NULL, '40308383', NULL, false),
      ('PROTEÍNA S LIVRE, DOSAGEM', NULL, '40304787', 'S', false),
      ('PROTEÍNA S TOTAL, DOSAGEM', 'PS-ATT', '40314197', 'S', false),
      ('PROTEÍNAS - DOSAGEM - U-12', 'PROTE', NULL, 'U-12', false),
      ('PROTEÍNAS - DOSAGEM - U-24', 'PROTE', NULL, 'U-24', false),
      ('PROTEÍNAS TOTAIS - PESQUISA E/OU DOSAGEM', NULL, '40302377', NULL, false),
      ('PROTEÍNAS TOTAIS ALBUMINA E GLOBULINA - PESQUISA E/OU DOSAGEM', 'PROTF', '40302385', 'S', false),
      ('PROTROMBINA, PESQUISA DE MUTAÇÃO', NULL, '40319326', 'S', false),
      ('PROVAS DE FUNÇÃO TIREOIDEANA (T3, T4, ÍNDICES E TSH)', 'PERFIT', '40305627', 'S', false),
      ('PSA LIVRE / TOTAL', 'PSALT', '40316130', 'S', false),
      ('PSA ULTRA SENSÍVEL', 'PSA', '40316149', 'S', false),
      ('PTF - PROTEÍNAS TOTAIS e FRAÇÕES', NULL, '40304312', NULL, false),
      ('PUNCAO ASPIRATIVA PAAF (Tireoide, Mama, PulmÃ£o)', NULL, NULL, NULL, false),
      ('RECEPTOR SOLÚVEL DE TRANSFERRINA - TRANSFERRINA', NULL, '40322246', NULL, false),
      ('RENINA DIRETA', 'RENDI', '40316432', 'S', false),
      ('RESERVA ALCALINA (BICARBONATO) - PESQUISA E/OU DOSAGEM', NULL, '40302407', NULL, false),
      ('Resseccao Transuretral - RTU de Bexiga ou Prostata', NULL, NULL, NULL, false),
      ('RETICULINA, ANTICORPOS ANTI', NULL, '40308820', 'S', false),
      ('RETICULÓCITOS', 'RET', '40304558', 'S', false),
      ('RNP, AUTO ANTICORPOS ANTI', 'RNP', '40306100', 'S', false),
      ('RT-PCR EXPRESS CORONAVÍRUS SARS-CoV-2', 'TRMCOV', NULL, 'DIV', false),
      ('RUBÉOLA - IGG - PESQUISA E/OU DOSAGEM', NULL, '40307697', NULL, false),
      ('RUBÉOLA - IGM - PESQUISA E/OU DOSAGEM', NULL, '40307700', NULL, false),
      ('RUBÉOLA IgG, ANTICORPOS ANTI - S', 'RUB-G', '40307697', 'S', false),
      ('RUBÉOLA IgG, ANTICORPOS ANTI (ELFA)', 'RUBE-G', '40307697', 'S', false),
      ('RUBÉOLA IgM, ANTICORPOS ANTI - S', 'RUB-M', '40307700', 'S', false),
      ('RUBÉOLA IgM, ANTICORPOS ANTI (ELFA)', 'RUBE-M', '40307700', 'S', false),
      ('SACCHAROMYCES CEREVISIAE, ANTICORPOS IgG E IgA', 'ASCA', '40324419', 'S', false),
      ('SANGUE OCULTO ANTICORPOS MONOCLONAIS', 'S.OC.', '40303136', 'F', false),
      ('SARS COV-2, ANTICORPOS IgG', 'COVIGG', NULL, 'S', false),
      ('SCHISTOSOMOSE - IGM - PESQUISA E/OU DOSAGEM', NULL, '40307727', NULL, false),
      ('SELÊNIO SÉRICO', 'SELE', '40313255', 'S', false),
      ('SEROTONINA', NULL, '40321550', NULL, false),
      ('SEROTONINA TOTAL', 'SERO', '49901028', 'S', false),
      ('SEXAGEM FETAL', NULL, '40312330', 'S', false),
      ('SÍFILIS - FTA-ABS-IGG - PESQUISA', NULL, '40307735', NULL, false),
      ('SÍFILIS - FTA-ABS-IGM - PESQUISA', NULL, '40307743', NULL, false),
      ('SÍFILIS - TPHA - PESQUISA', NULL, '40307751', NULL, false),
      ('SÍFILIS - VDRL', NULL, '40307760', NULL, false),
      ('SÍFILIS ANTICORPO TOTAL - PESQUISA E/OU DOSAGEM', NULL, '40308286', 'S', false),
      ('SM, AUTO ANTICORPOS ANTI', 'SM', '40306127', 'S', false),
      ('SÓDIO - S', 'NA', '40302423', 'S', false),
      ('SÓDIO - U', 'NA-U', '40302423', 'U', false),
      ('SOROLOGIA  SALMONELLA TYPHI', NULL, '40307891', NULL, false),
      ('SOROLOGIA COVID-19 (Anticorpos totais anti SARS-CoV-2)', 'COV-LC', NULL, 'S', false),
      ('SSA/RO, AUTO ANTICORPOS ANTI', 'SSA', '40306119', 'S', false),
      ('SSB/LA, AUTO ANTICORPOS ANTI', 'SSB', '40306089', 'S', false),
      ('STREPTOCOCCUS AGALACTIAE - PCR - MEIO LI[QUIDO', NULL, NULL, NULL, false),
      ('SULFATO DE DEHIDROEPIANDROSTERONA', 'SDHEA', '40316459', 'S', false),
      ('SUPEROXIDO DISMUTASE', NULL, '40322254', 'S', false),
      ('T3 LIVRE - S', 'T3 L', '40316467', 'S', false),
      ('T3 RETENCAO', NULL, '40316475', NULL, false),
      ('T3 REVERSO', 'RT3', '40316483', 'S', false),
      ('T3 TOTAL - S', 'T3-RIE', '40316556', 'S', false),
      ('T4 LIVRE - S', 'T4 L', '40316491', 'S', false),
      ('T4 TOTAL - S', 'T4-RIE', '40316548', 'S', false),
      ('TEMPO ATIVIDADE PROTROMBINA (R.N.I.) - S', 'RNI', '40304590', 'S', false),
      ('TEMPO DE TROMBOPLASTINA PARCIAL ATIVADO - S', 'TTP', '40304639', 'S', false),
      ('TESTE DO PEZINHO AMPLIADO', 'PEZAMP', '40312178', 'S', false),
      ('TESTE DO PEZINHO BÁSICO', 'PEZBAS', '40312160', 'S', false),
      ('TESTOSTERONA TOTAL', 'T1', '40316513', 'S', false),
      ('TESTOSTERONA BIODISPONÍVEL', 'T1BIOD', '40316505', 'S', false),
      ('TESTOSTERONA LIVRE CALCULADA', 'TLIVC', '40316505', 'S', false),
      ('TESTOSTERONA LIVRE SALIVAR', NULL, '40317390', 'SL', false),
      ('TIREOESTIMULANTE, HORMÔNIO (TSH) - PESQUISA E/OU DOSAGEM', NULL, '40316521', NULL, false),
      ('TIREOGLOBULINA - S', 'TIR-G', '40316530', 'S', false),
      ('TIREOGLOBULINA, ANTICORPOS ANTI', 'TIREO', '40316106', 'S', false),
      ('TIREOPEROXIDASE, ANTICORPOS ANTI - TPO', 'MICRO', '40306348', 'S', false),
      ('TOXOPLASMOSE IgG, ANTICORPOS', 'ELISAG', '40307824', 'S', false),
      ('TOXOPLASMOSE IgG, ANTICORPOS (ELFA)', 'ELFAG', '40307824', 'S', false),
      ('TOXOPLASMOSE IgM, ANTICORPOS', 'ELISAM', '40307832', 'S', false),
      ('TRAB- ANTICORPO ANTI- RECEPTOR TSH', 'AIT', '40316084', 'S', false),
      ('TRANSAMINASE OXALACÉTICA - TGO', 'TGO', '40302504', 'S', false),
      ('TRANSAMINASE PIRÚVICA - TGP', 'TGP', '40302512', 'S', false),
      ('TRANSFERRINA', 'TRA', '40302520', 'S', false),
      ('transferrina fixação', NULL, '40301427', NULL, false),
      ('TREPONEMA IgM', 'FTAM', '40307743', 'S', false),
      ('TREPONEMA PALLIDUM, PESQUISA DE ANTICORPOS IgG', 'FTA', '40307735', 'S', false),
      ('TRIGLICÉRIDES - S', 'TRI', '40302547', 'S', false),
      ('Triptase - Dosagem', NULL, '40321665', 'S', false),
      ('TROPONINA I', 'TROPOT', '40302571', 'S', false),
      ('TRYPANOSOMA CRUZI IgG (IMUNOFLUORESCÊNCIA)', 'IF-TC', '40306615', 'S', false),
      ('TRYPANOSOMA CRUZI IgM (IMUNOFLUORESCÊNCIA)', 'TC-IM', '40306623', 'S', false),
      ('TSH ULTRA SENSÍVEL - S', 'TSH-B', '40316521', 'S', false),
      ('TTG, ANTICORPOS ANTI-TRANSGLUTAMINASE TECIDUAL-IgA', 'TTG', '40308553', 'S', false),
      ('UREIA - S', 'U', '40302580', 'S', false),
      ('EAS - URINA ROTINA', 'EAS', '40311210', 'DIV', false),
      ('UROCULTURA COM ANTIBIOGRAMA', 'CT+ABU', '40310213', 'U', true),
      ('V.D.R.L. QUANTITATIVO - LIQ', 'VD', '40307760', 'LIQ', false),
      ('V.D.R.L. QUANTITATIVO - S', 'VD', '40307760', 'S', false),
      ('VARICELLA ZOSTER IgG, ANTI - S', 'VARIG', '40308162', 'S', false),
      ('VARICELLA ZOSTER IgM, ANTI - S', 'VARIM', '40308170', 'S', false),
      ('VARICELLA ZOSTER VÍRUS, PCR', NULL, '40314405', 'S', false),
      ('VASOPRESSINA - HORMÔNIO ANTIDIURÉTICO', 'VASO', '40316564', 'S', false),
      ('VITAMINA A', 'VITA', '40302601', 'S', false),
      ('VITAMINA B1 - PESQUISA E/OU DOSAGEM', 'B1', '40302784', 'S', false),
      ('VITAMINA B12', 'B12', '40316572', 'S', false),
      ('VITAMINA B2 - PESQUISA E/OU DOSAGEM', 'B2', '40302792', 'S', false),
      ('VITAMINA B3- PESQUISA E/OU DOSAGEM', 'B3', '40302806', 'S', false),
      ('VITAMINA B5', NULL, '40322262', 'S', false),
      ('VITAMINA B6 - PESQUISA E/OU DOSAGEM', 'B6', '40302814', 'S', false),
      ('VITAMINA B7 (BIOTINA)', NULL, '40322122', 'S', false),
      ('VITAMINA C', 'VITC', '40301060', 'S', false),
      ('VITAMINA E', 'VITE', '40302610', 'S', false),
      ('VITAMINA K', NULL, '40302849', 'S', false),
      ('ZIKA VÍRUS ANTICORPOS IGG', 'ZIKA-G', NULL, 'S', false),
      ('ZIKA VÍRUS ANTICORPOS IGM', 'ZIKA-M', NULL, 'S', false),
      ('ZINCO (SORO)', 'ZN-SO', '40313328', 'S', false),
      ('CADMIO - SORO', NULL, NULL, NULL, false),
      ('CADMIO - URINARIO POS JORNADA', NULL, NULL, NULL, false),
      ('CADMIO - URINARIO PRE JORNADA', NULL, NULL, NULL, false);
  END IF;
END $$;


-- ╔══ [ 6/14] 20260709131000_fase7a_culturas.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A (frente 2): Seleção de exames no check-in + acompanhamento de culturas
--
-- Fluxo real (o médico coleta; o laboratório recebe/tria/etiqueta/envia e acompanha):
--   • No check-in o funcionário lê o pedido e SELECIONA os exames  → ac_agendamento_exames
--   • Confere validade da amostra e etiqueta                        → ac_coletas (2 colunas)
--   • Cada exame de cultura selecionado vira uma linha de acompanhamento → ac_culturas
--   • A cultura é acompanhada MANUALMENTE (etapa + status), no molde da Temperatura.
--
-- Escrita direta pelo frontend sob RLS permissiva por authenticated (gate = frontend),
-- consistente com Fase 6/7C. A criação a partir do check-in acontece na RPC
-- registrar_coleta (SECURITY DEFINER; migration seguinte), de forma transacional.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. ac_agendamento_exames — exames marcados no check-in (N por agendamento) ──
CREATE TABLE IF NOT EXISTS ac_agendamento_exames (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE CASCADE,
  exame_id       uuid NOT NULL REFERENCES ac_exames(id) ON DELETE RESTRICT,
  exame_nome     text NOT NULL,                    -- snapshot do nome no momento
  is_cultura     boolean NOT NULL DEFAULT false,   -- snapshot (para saber se gerou cultura)
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agendamento_exame UNIQUE (agendamento_id, exame_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_agendamento_exames_ag ON ac_agendamento_exames(agendamento_id);

-- ─── 2. ac_coletas: validade da amostra + etiqueta (checks do check-in) ──────────
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS validade_ok boolean;
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS etiquetado  boolean;

-- ─── 3. ac_cultura_etapas — trilha ordenada (começa mínima, extensível) ──────────
--   O stepper da página desenha a partir daqui; adicionar etapa = inserir uma linha
--   (sem migration de schema). O usuário refina quando conhecer a trilha real.
CREATE TABLE IF NOT EXISTS ac_cultura_etapas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem      integer NOT NULL UNIQUE,
  nome       text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ac_cultura_etapas_updated_at ON ac_cultura_etapas;
CREATE TRIGGER trg_ac_cultura_etapas_updated_at
  BEFORE UPDATE ON ac_cultura_etapas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- Seed genérico mínimo (idempotente por ordem).
INSERT INTO ac_cultura_etapas (ordem, nome) VALUES
  (1, 'Recebida'),
  (2, 'Em análise'),
  (3, 'Pronta p/ laudo')
ON CONFLICT (ordem) DO NOTHING;

-- ─── 4. ac_culturas — uma cultura acompanhada (1 por exame de cultura/agendamento)─
CREATE TABLE IF NOT EXISTS ac_culturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  exame_id       uuid REFERENCES ac_exames(id),
  exame_nome     text NOT NULL,                 -- tipo do exame (snapshot): Urocultura…
  paciente_nome  text,                          -- snapshot p/ exibir sem join
  posto_id       uuid,                          -- snapshot (posto do agendamento)
  local_posto    text,                          -- snapshot do nome do posto
  etapa_ordem    integer NOT NULL DEFAULT 1,    -- etapa atual (→ ac_cultura_etapas.ordem)
  status         text NOT NULL DEFAULT 'em_andamento', -- em_andamento|positiva|sem_crescimento|pronta_laudo
  nota           text,                          -- nota livre da etapa atual
  resultado      text,                          -- desfecho/laudo textual (opcional)
  iniciada_em    timestamptz NOT NULL DEFAULT now(),
  prazo_dias     integer NOT NULL DEFAULT 5,    -- prazo padrão (editável)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cultura_agendamento_exame UNIQUE (agendamento_id, exame_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_status ON ac_culturas(status);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_posto  ON ac_culturas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_inic   ON ac_culturas(iniciada_em DESC);

DROP TRIGGER IF EXISTS trg_ac_culturas_updated_at ON ac_culturas;
CREATE TRIGGER trg_ac_culturas_updated_at
  BEFORE UPDATE ON ac_culturas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── 5. RLS — permissiva por authenticated (gate real = frontend) ────────────────
ALTER TABLE ac_agendamento_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_cultura_etapas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_culturas           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_agendamento_exames_select_all"  ON ac_agendamento_exames;
DROP POLICY IF EXISTS "ac_agendamento_exames_insert_auth" ON ac_agendamento_exames;
DROP POLICY IF EXISTS "ac_agendamento_exames_delete_auth" ON ac_agendamento_exames;
CREATE POLICY "ac_agendamento_exames_select_all"  ON ac_agendamento_exames FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_agendamento_exames_insert_auth" ON ac_agendamento_exames FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_agendamento_exames_delete_auth" ON ac_agendamento_exames FOR DELETE TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_cultura_etapas_select_all"  ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_insert_auth" ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_update_auth" ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_delete_auth" ON ac_cultura_etapas;
CREATE POLICY "ac_cultura_etapas_select_all"  ON ac_cultura_etapas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_cultura_etapas_insert_auth" ON ac_cultura_etapas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_cultura_etapas_update_auth" ON ac_cultura_etapas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_cultura_etapas_delete_auth" ON ac_cultura_etapas FOR DELETE TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_culturas_select_all"  ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_insert_auth" ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_update_auth" ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_delete_auth" ON ac_culturas;
CREATE POLICY "ac_culturas_select_all"  ON ac_culturas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_culturas_insert_auth" ON ac_culturas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_culturas_update_auth" ON ac_culturas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_culturas_delete_auth" ON ac_culturas FOR DELETE TO authenticated USING (TRUE);

-- ╔══ [ 7/14] 20260709132000_fase7a_registrar_coleta_v2.sql ══╗

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

-- ╔══ [ 8/14] 20260710120000_fase7a_etapa_laudo_concluido.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A: renomeia a etapa final da trilha de cultura.
--   "Pronta p/ laudo" → "Laudo concluído".
-- O seed original (20260709131000) usa ON CONFLICT (ordem) DO NOTHING, então ele NÃO
-- atualiza linhas já semeadas — este UPDATE corrige os bancos existentes. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE ac_cultura_etapas
   SET nome = 'Laudo concluído'
 WHERE ordem = 3
   AND nome = 'Pronta p/ laudo';

-- ╔══ [ 9/14] 20260713120000_fase7_notificar_labhub_coleta.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Notificar o LAB-HUB sobre o status da coleta (FlowLab → LAB-HUB)
--
-- Fecha o loop da integração: quando o operador registra check-in / coleta /
-- bloqueio, as RPCs registrar_checkin / registrar_coleta fazem
--   UPDATE ac_agendamentos SET status = 'em_coleta' | 'coletado' | 'bloqueado'.
-- Este gatilho dispara (via pg_net, fire-and-forget) a função serverless
-- api/analises-clinicas/deliver-coleta, que assina o payload com HMAC e POSTa em
-- POST /api/v1/webhooks/coletas do LAB-HUB — que reflete o status no agendamento
-- do paciente (coletado → realizado).
--
-- Por que passar pelo deliver-coleta (Node) em vez de postar direto ao LAB-HUB
-- daqui: o HMAC é validado sobre o CORPO CRU exato; assinar o jsonb do pg_net em
-- SQL é frágil (serialização diverge → 401). O Node reusa signHmacHex +
-- JSON.stringify, exatamente como o deliver-resultado (comprovado em produção).
--
-- ─── Provisionamento dos segredos (fora do VCS — rodar uma vez por ambiente) ───
-- O gatilho lê a URL do deliver-coleta e a FLOWLAB_API_KEY do Supabase Vault.
-- Provisione (NÃO commite os valores reais):
--   select vault.create_secret(
--     'https://<seu-flowlab>/api/analises-clinicas/deliver-coleta',
--     'flowlab_deliver_coleta_url');
--   select vault.create_secret('<FLOWLAB_API_KEY>', 'flowlab_api_key');
-- A FLOWLAB_API_KEY deve ser idêntica à do LAB-HUB (par compartilhado já existente).
--
-- Migration idempotente (CREATE OR REPLACE / DROP…IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════════

-- pg_net: HTTP assíncrono no Postgres. Enfileira e envia em background — não
-- bloqueia nem falha a transação da RPC de coleta.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função do gatilho: notifica o LAB-HUB quando o status entra no conjunto
-- propagável e o agendamento tem origem no LAB-HUB (labhub_id preenchido).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ac_notificar_labhub_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Só os estados que o LAB-HUB reflete (o mapeamento coletado→realizado é lá).
  IF NEW.status NOT IN ('em_coleta', 'coletado', 'bloqueado') THEN
    RETURN NEW;
  END IF;
  -- Sem labhub_id o agendamento é nativo do FlowLab: não há para quem notificar.
  IF NEW.labhub_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Best-effort: qualquer falha (Vault indisponível, config ausente, pg_net) é
  -- engolida para NUNCA quebrar a transação da coleta/check-in. A entrega em si é
  -- assíncrona; a reconciliação é um re-POST manual do deliver-coleta (idempotente).
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'flowlab_deliver_coleta_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'flowlab_api_key' LIMIT 1;

    IF v_url IS NULL OR v_key IS NULL THEN
      RAISE WARNING 'ac_notificar_labhub_status: segredos do Vault ausentes; notificação ignorada (agendamento %)', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('agendamentoId', NEW.id),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ac_notificar_labhub_status: falha ao enfileirar notificação (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Gatilho: dispara apenas quando o status realmente muda.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ac_notificar_labhub_status ON ac_agendamentos;
CREATE TRIGGER trg_ac_notificar_labhub_status
  AFTER UPDATE OF status ON ac_agendamentos
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION ac_notificar_labhub_status();

-- ╔══ [10/14] 20260714120000_ac_agenda_grade_horarios.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — Agenda por grade (início/fim/intervalo + dias da semana)
-- Migration: 20260714120000_ac_agenda_grade_horarios.sql
--
-- Substitui o modelo de horários avulsos (ac_horarios_padrao, um HH:MM por linha,
-- válido seg–sáb fixo) por uma GRADE configurada no próprio posto:
--   • agenda_hora_inicio / agenda_hora_fim / agenda_intervalo_min  — a janela e o
--     passo (ex.: 08:00–11:00 a cada 15 min) que GERA os horários automaticamente;
--   • agenda_dias_semana  — em quais dias (0=dom … 6=sáb) o posto opera.
-- Capacidade some do modelo: cada horário atende 1 paciente.
--
-- ac_dias_excecao deixa de ter "horário especial por dia" e vira lista pura de
-- DATAS BLOQUEADAS (feriados): cada linha bloqueia os agendamentos daquela data.
--
-- O get-disponibilidade passa a gerar a agenda a partir dessa grade (aplicando as
-- datas bloqueadas e descontando os agendamentos já feitos). Contrato com o LAB-HUB
-- (slots: string[]) não muda.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Grade de agenda no próprio posto (1:1) ───────────────────────────────────
-- Colunas nullable = agenda ainda não configurada. A RLS de UPDATE de ac_postos
-- (20260630120000) já cobre admin/operator; nenhuma policy nova é necessária.
ALTER TABLE ac_postos
  ADD COLUMN IF NOT EXISTS agenda_hora_inicio   TIME,
  ADD COLUMN IF NOT EXISTS agenda_hora_fim      TIME,
  ADD COLUMN IF NOT EXISTS agenda_intervalo_min INTEGER,
  ADD COLUMN IF NOT EXISTS agenda_dias_semana   SMALLINT[] NOT NULL DEFAULT '{}';

-- Intervalo, quando definido, precisa ser positivo.
ALTER TABLE ac_postos
  DROP CONSTRAINT IF EXISTS ck_ac_postos_agenda_intervalo;
ALTER TABLE ac_postos
  ADD CONSTRAINT ck_ac_postos_agenda_intervalo
  CHECK (agenda_intervalo_min IS NULL OR agenda_intervalo_min > 0);

-- ─── Remove o modelo de horários avulsos ──────────────────────────────────────
DROP TABLE IF EXISTS ac_horarios_padrao CASCADE;

-- ─── ac_dias_excecao vira lista de DATAS BLOQUEADAS ───────────────────────────
-- Linhas de "horário especial" (fechado = false) não descrevem um bloqueio — some,
-- para não virarem bloqueio indevido ao dropar a coluna. (Dados são só de demo/dev.)
DELETE FROM ac_dias_excecao WHERE fechado = FALSE;

ALTER TABLE ac_dias_excecao
  DROP COLUMN IF EXISTS fechado,
  DROP COLUMN IF EXISTS horarios;
-- Sobra (id, posto_id, data, created_at) com UNIQUE(posto_id, data): cada linha
-- bloqueia uma data do posto.

-- ─── Seed — grade padrão para os postos demo ──────────────────────────────────
-- 08:00–11:00 a cada 15 min, seg–sex ({1,2,3,4,5}). UUIDs fixos vêm do seed de
-- ac_postos (20260629120000_ac_integracao_labhub.sql); se o posto não existir,
-- o UPDATE simplesmente não afeta linhas.
UPDATE ac_postos
SET agenda_hora_inicio   = '08:00',
    agenda_hora_fim      = '11:00',
    agenda_intervalo_min = 15,
    agenda_dias_semana   = '{1,2,3,4,5}'
WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

-- ╔══ [11/14] 20260716120000_ac_culturas_avulsa.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Cultura avulsa — permitir acompanhamento sem vínculo com agendamento/coleta
--
-- Culturas (coprocultura, suabe, etc.) nem sempre passam pelo processo de coleta do
-- laboratório: algumas chegam já coletadas fora. Até aqui toda cultura nascia no
-- check-in (registrar_coleta) e exigia um agendamento (agendamento_id NOT NULL). Este
-- ALTER libera o cadastro AVULSO pela própria página de Culturas (botão "Nova cultura").
--
-- Efeitos colaterais: nenhum.
--   • RLS de INSERT já libera authenticated (ac_culturas_insert_auth WITH CHECK TRUE).
--   • UNIQUE(agendamento_id, exame_id): com agendamento_id NULL o Postgres trata cada
--     linha como distinta → várias culturas avulsas do mesmo exame são permitidas.
--   • FK ON DELETE RESTRICT com NULL é inócuo.
-- Idempotente: DROP NOT NULL em coluna já nullable é no-op.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE ac_culturas ALTER COLUMN agendamento_id DROP NOT NULL;

COMMENT ON COLUMN ac_culturas.agendamento_id IS
  'Agendamento de origem (check-in). NULL = cultura avulsa cadastrada manualmente.';

-- ╔══ [12/14] 20260716130000_product_stock_min_local.sql ══╗

-- Mínimo de estoque POR LOCAL (par level) — coluna em product_stock.
--
-- Até aqui o piso de estoque era só products.min_stock (GLOBAL por produto). As telas de
-- estoque departamental e o dashboard de Análises Clínicas comparavam o saldo de UM local
-- contra esse mínimo global — o que dispara falso (um posto segura só uma fração) e não
-- deixa definir um piso próprio por posto/setor. Como o insumo já está no local (existe a
-- linha em product_stock), o mínimo por local mora nessa mesma linha.
--
-- Aditiva e idempotente. Independe de products.min_stock, que segue valendo no inventário
-- central. Os triggers de baixa (update_stock_on_movement) e de cache
-- (products.quantity = SUM(product_stock)) só mexem em quantity; o ON CONFLICT DO UPDATE do
-- recebimento preserva min_stock entre reposições. RLS de UPDATE em product_stock já libera
-- authenticated (20260701120000_fase5_estoque_aditiva.sql).

ALTER TABLE product_stock
  ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0 CHECK (min_stock >= 0);

COMMENT ON COLUMN product_stock.min_stock IS
  'Mínimo por local (par level) do produto neste estoque. 0 = sem mínimo. Independe de products.min_stock (piso global do inventário central).';

-- ╔══ [13/14] 20260716140000_fase6b_recoletas.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 6 — Etapa B: Recoletas (acompanhamento manual)
--
-- Fluxo real (a análise é EXTERNA — laboratório de apoio): quando o apoio/QC sinaliza
-- que uma amostra está inviável (hemólise, quantidade insuficiente, coagulada…), o
-- laboratório registra uma RECOLETA à mão e acompanha por status até o paciente
-- retornar. A nova coleta em si entra pelo fluxo normal (novo agendamento) — a recoleta
-- NÃO altera o agendamento/coleta original, então não há gatilho automático nem toque
-- em ac_agendamentos (evita conflito com os UNIQUE(agendamento_id) de ac_checkins/
-- ac_coletas e com o trigger de notificação do LAB-HUB).
--
-- Molde: ac_culturas (Fase 7A) — tabela única, acompanhamento manual, escrita direta
-- pelo frontend sob RLS permissiva por authenticated (gate = frontend + canManageColetas).
-- Sem RPC. Idempotente.
--
-- Rastreabilidade opcional (ambos NULL numa avulsa "pura"): coleta_id aponta para a coleta
-- cuja amostra ficou inviável; origem_recoleta_id encadeia a "recoleta da recoleta" (quando a
-- própria amostra recoletada também falha) — auto-referência, permitindo contar a tentativa.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Função de updated_at compartilhada do módulo (idempotente; já existe desde a Fase 3).
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── ac_recoletas — uma recoleta acompanhada (avulsa por padrão) ─────────────────
CREATE TABLE IF NOT EXISTS ac_recoletas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES ac_agendamentos(id) ON DELETE RESTRICT, -- NULL = avulsa
  -- Origem opcional da recoleta (ambos NULL numa avulsa "pura"):
  coleta_id          uuid REFERENCES ac_coletas(id) ON DELETE SET NULL,   -- coleta cuja amostra ficou inviável (se conhecida)
  origem_recoleta_id uuid REFERENCES ac_recoletas(id) ON DELETE SET NULL, -- recoleta anterior (a "recoleta da recoleta")
  exame_nome     text,                          -- exame/material a recoletar (snapshot, opcional)
  paciente_nome  text,                          -- snapshot p/ exibir sem join
  posto_id       uuid REFERENCES ac_postos(id), -- snapshot (posto de origem)
  local_posto    text,                          -- snapshot do nome do posto
  motivo         text NOT NULL CHECK (motivo IN (
                   'hemolise','insuficiente','coagulada','extraviada',
                   'contaminada','identificacao','outro')),
  motivo_detalhe text,                          -- texto livre (obrigatório na UI quando motivo='outro')
  status         text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','concluida','cancelada')),
  nota           text,                          -- observação livre
  prazo_dias     integer NOT NULL DEFAULT 7,    -- prazo p/ a nova coleta (editável)
  solicitado_por text NOT NULL,                 -- nome do usuário que registrou
  solicitada_em  timestamptz NOT NULL DEFAULT now(),
  resolvida_em   timestamptz,                   -- carimbo ao concluir/cancelar
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_status     ON ac_recoletas(status);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_solicitada ON ac_recoletas(solicitada_em DESC);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_posto      ON ac_recoletas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_coleta     ON ac_recoletas(coleta_id);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_origem     ON ac_recoletas(origem_recoleta_id);

DROP TRIGGER IF EXISTS trg_ac_recoletas_updated_at ON ac_recoletas;
CREATE TRIGGER trg_ac_recoletas_updated_at
  BEFORE UPDATE ON ac_recoletas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── RLS — permissiva por authenticated (gate real = frontend) ───────────────────
ALTER TABLE ac_recoletas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_recoletas_select_all"  ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_insert_auth" ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_update_auth" ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_delete_auth" ON ac_recoletas;
CREATE POLICY "ac_recoletas_select_all"  ON ac_recoletas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_recoletas_insert_auth" ON ac_recoletas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_recoletas_update_auth" ON ac_recoletas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_recoletas_delete_auth" ON ac_recoletas FOR DELETE TO authenticated USING (TRUE);

-- ╔══ [14/14] 20260716150000_fase8_laudos.sql ══╗

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 8 — Laudos (acompanhamento manual por agendamento)
--
-- Cada agendamento pode ter no máximo 1 laudo (1:1). O laudo é criado manualmente
-- e acompanha a liberação dos exames: status (aguarda / parcial / completo) + contagem
-- de exames concluídos vs. total. O total pode ser preenchido automaticamente a partir
-- dos exames marcados no check-in (ac_agendamento_exames), mas a contagem de concluídos
-- é atualizada manualmente pelo operador.
--
-- Molde: ac_culturas / ac_recoletas — tabela única, acompanhamento manual, escrita
-- direta pelo frontend sob RLS permissiva por authenticated (gate = frontend).
-- Sem RPC. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_laudos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_laudos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id    uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'aguarda_liberacao'
                      CHECK (status IN ('aguarda_liberacao','laudo_parcial_liberado','laudo_completo_liberado')),
  exames_concluidos integer NOT NULL DEFAULT 0,
  exames_total      integer NOT NULL DEFAULT 0,
  nota              text,
  criado_por        text NOT NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  liberado_em       timestamptz,
  UNIQUE (agendamento_id)  -- 1 laudo por agendamento
);

CREATE INDEX IF NOT EXISTS idx_ac_laudos_status         ON ac_laudos(status);
CREATE INDEX IF NOT EXISTS idx_ac_laudos_agendamento    ON ac_laudos(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_ac_laudos_criado_em      ON ac_laudos(criado_em DESC);

DROP TRIGGER IF EXISTS trg_ac_laudos_updated_at ON ac_laudos;
CREATE TRIGGER trg_ac_laudos_updated_at
  BEFORE UPDATE ON ac_laudos
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── RLS — permissiva por authenticated (gate real = frontend) ───────────────────
ALTER TABLE ac_laudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_laudos_select_all"  ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_insert_auth" ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_update_auth" ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_delete_auth" ON ac_laudos;
CREATE POLICY "ac_laudos_select_all"  ON ac_laudos FOR SELECT  TO authenticated USING (TRUE);
CREATE POLICY "ac_laudos_insert_auth" ON ac_laudos FOR INSERT  TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_laudos_update_auth" ON ac_laudos FOR UPDATE  TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_laudos_delete_auth" ON ac_laudos FOR DELETE  TO authenticated USING (TRUE);

-- ╔══ [§15] Menu — merge ADITIVO (substitui 20260708120000, sem sobrescrever) ══╗
-- Acrescenta "Estoque Departamental" em OPERAÇÕES apenas se faltar; preserva
-- "Consumo do Setor", a ordem atual e a categoria "TI & AI" de prod.
UPDATE module_categories
   SET items = items || '["Estoque Departamental"]'::jsonb,
       updated_at = now()
 WHERE id = 'operacoes'
   AND NOT items @> '["Estoque Departamental"]'::jsonb;

-- ╔══ [15] 20260717120000_fix_ac_postos_rls_custom_roles.sql ══╗
-- Fix: policies de ac_postos usando custom_roles (canManageAnalisesClinicas)
--
-- As policies de mutação de ac_postos (20260630120000) checavam
-- user_profiles.role IN ('admin', 'operator'), mas o sistema usa
-- custom_roles.permissions. Sem a role legada, o UPDATE afetava 0 linhas
-- sem erro — a UI mostrava "Agenda salva" mas nada persistia.
--
-- Esta migration substitui as policies por versões que usam
-- current_user_has_permission('canManageAnalisesClinicas'), com fallback
-- automático para admin legado (role = 'admin').
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_postos — INSERT ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_insert_staff" ON ac_postos;
CREATE POLICY "ac_postos_insert_staff"
  ON ac_postos FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageAnalisesClinicas'));

-- ─── ac_postos — UPDATE ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_update_staff" ON ac_postos;
CREATE POLICY "ac_postos_update_staff"
  ON ac_postos FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('canManageAnalisesClinicas'))
  WITH CHECK (public.current_user_has_permission('canManageAnalisesClinicas'));

-- ─── ac_postos — DELETE ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_delete_staff" ON ac_postos;
CREATE POLICY "ac_postos_delete_staff"
  ON ac_postos FOR DELETE
  TO authenticated
  USING (public.current_user_has_permission('canManageAnalisesClinicas'));

-- ╔══ [§16] Registro das versões aplicadas (bookkeeping, opcional e seguro) ══╗
-- Se o schema de tracking da CLI existir em prod, registra as 15 versões para
-- futuras comparações. Se não existir, não faz nada.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20260701130000'), ('20260708130000'), ('20260708140000'),
           ('20260709120000'), ('20260709130000'), ('20260709131000'),
           ('20260709132000'), ('20260710120000'), ('20260713120000'),
           ('20260714120000'), ('20260716120000'), ('20260716130000'),
           ('20260716140000'), ('20260716150000'), ('20260717120000')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ═══ Fim do upgrade — ver prod-upgrade-fase6-8.md para Vault + conferências ═══
