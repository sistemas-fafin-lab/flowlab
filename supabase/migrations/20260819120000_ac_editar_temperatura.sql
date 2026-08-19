-- ═══════════════════════════════════════════════════════════════════════════════
-- Temperatura — edição de leitura
--
--   • ac_temperaturas deixa de ser append-only: política de UPDATE para
--     authenticated. A trigger ac_temperatura_set_fora_faixa já dispara em
--     UPDATE OF temperatura/equipamento_id e recalcula o valor derivado.
--   • ac_editar_temperatura — atualiza a leitura e substitui os frascos
--     (DELETE + INSERT) numa transação só, no mesmo espírito de
--     ac_registrar_temperatura: frasco inválido ou leitura inexistente
--     reverte tudo, sem leitura meio-atualizada.
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com o resto do módulo. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. UPDATE liberado em ac_temperaturas ────────────────────────────────────
DROP POLICY IF EXISTS "ac_temperaturas_update_auth" ON ac_temperaturas;
CREATE POLICY "ac_temperaturas_update_auth"
  ON ac_temperaturas FOR UPDATE TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- ─── 2. ac_editar_temperatura — leitura + frascos numa transação só ──────────
-- Atualiza a leitura (a trigger recalcula fora_faixa) e reescreve os frascos:
-- os filhos antigos são removidos e os novos inseridos a partir do jsonb.
DROP FUNCTION IF EXISTS ac_editar_temperatura(uuid, numeric, text, text, timestamptz, jsonb);
CREATE OR REPLACE FUNCTION ac_editar_temperatura(
  p_temperatura_id uuid,
  p_temperatura    numeric,
  p_registrado_por text,
  p_observacao     text,
  p_registrado_em  timestamptz,
  p_frascos        jsonb DEFAULT '[]'  -- [{ tipo_frasco_id, quantidade }, ...]
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
  v_tipo_id uuid;
  v_qtd int;
BEGIN
  UPDATE ac_temperaturas
     SET temperatura    = p_temperatura,
         registrado_por = p_registrado_por,
         observacao     = NULLIF(p_observacao, ''),
         registrado_em  = p_registrado_em
   WHERE id = p_temperatura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leitura % não encontrada', p_temperatura_id;
  END IF;

  DELETE FROM ac_temperatura_frascos WHERE temperatura_id = p_temperatura_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_frascos, '[]'::jsonb))
  LOOP
    v_tipo_id := (item->>'tipo_frasco_id')::uuid;
    -- Exige inteiro positivo explícito: o cast ::int arredondaria '2.5' para 3
    -- silenciosamente, e a leitura inteira deve reverter em frasco inválido.
    IF item->>'quantidade' IS NULL OR item->>'quantidade' !~ '^\d+$' THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    v_qtd := (item->>'quantidade')::int;
    IF v_qtd <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para tipo de frasco %', v_tipo_id;
    END IF;
    INSERT INTO ac_temperatura_frascos (temperatura_id, tipo_frasco_id, quantidade)
    VALUES (p_temperatura_id, v_tipo_id, v_qtd);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION ac_editar_temperatura(uuid, numeric, text, text, timestamptz, jsonb) TO authenticated;
