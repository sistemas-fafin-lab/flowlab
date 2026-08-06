-- ═══════════════════════════════════════════════════════════════════════════════
-- Laudo automático no recebimento — registrar_coleta passa a abrir o ac_laudos
--
-- Até aqui o laudo nascia à mão: alguém tinha que abrir a página de Laudos, clicar
-- em "Novo laudo" e achar o agendamento numa lista. Nada obrigava esse passo, então
-- um agendamento podia ficar coletado por dias sem laudo aberto e sem ninguém notar.
--
-- A CULTURA já resolveu isso: cada exame de cultura marcado no recebimento vira uma
-- linha de acompanhamento em ac_culturas, criada pela própria registrar_coleta, na
-- mesma transação que faz em_coleta → coletado. O laudo segue o mesmo caminho — o
-- bloco novo fica logo abaixo do laço que cria as culturas.
--
-- Regras (decididas com o usuário em 06/08/2026):
--   • Todo agendamento que chega em 'coletado' ganha laudo, INCLUSIVE sem exame
--     marcado (exames_total = 0, ajustável na tela). O que foi coletado tem que
--     aparecer na lista de qualquer jeito.
--   • Sem backfill: os agendamentos já coletados seguem sem laudo e só ganham um
--     pelo botão manual, que continua existindo justamente para esses.
--
-- Isto torna obsoleto o cabeçalho de 20260716150000_fase8_laudos.sql ("o laudo é
-- criado manualmente") — migration aplicada não se reescreve, então o registro é aqui.
--
-- registrar_coleta é reescrita INTEIRA (Postgres não faz patch de corpo de função).
-- Mesma assinatura de 7 argumentos, mesma semântica de tudo o que já existia.
-- SECURITY DEFINER porque toca ac_agendamentos (RLS só-SELECT; FOR UPDATE precisa
-- de DEFINER — ver 20260708140000). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Pré-condição: a Fase 8 (ac_laudos) precisa estar aplicada ──────────────────
-- O corpo de uma função plpgsql não é validado na criação, então sem esta guarda a
-- migration passaria num banco sem ac_laudos e só quebraria na PRIMEIRA COLETA REAL
-- — o pior momento possível. Falhar aqui é barulhento e reversível. Há drift
-- conhecido entre test (eqz) e prod (jqx), então isto não é hipotético.
DO $$
BEGIN
  IF to_regclass('public.ac_laudos') IS NULL THEN
    RAISE EXCEPTION 'ac_laudos não existe: aplique a Fase 8 (20260716150000_fase8_laudos.sql) antes desta migration';
  END IF;
END $$;

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
  v_exames_total integer;
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

  -- Abre o laudo do agendamento, no mesmo molde das culturas acima: deixa de
  -- depender de alguém lembrar de criá-lo na página de Laudos.
  --
  -- O total sai de ac_agendamento_exames — a mesma contagem que a criação manual
  -- faz, e a tabela acabou de ser preenchida pelo laço. Contar dali (e não de
  -- p_exame_ids) também absorve o ON CONFLICT acima e exames já registrados antes.
  --
  -- ON CONFLICT porque agendamento_id é UNIQUE: se o laudo já tiver sido aberto à
  -- mão, o recebimento NÃO pode falhar por causa disso — e o laudo existente fica
  -- como está, com a nota e o criado_por de quem o abriu.
  SELECT count(*) INTO v_exames_total
    FROM ac_agendamento_exames WHERE agendamento_id = v_agendamento_id;

  INSERT INTO ac_laudos (agendamento_id, exames_total, criado_por)
  VALUES (v_agendamento_id, v_exames_total,
          COALESCE(NULLIF(p_coletado_por, ''), 'Sistema'))
  ON CONFLICT (agendamento_id) DO NOTHING;

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
