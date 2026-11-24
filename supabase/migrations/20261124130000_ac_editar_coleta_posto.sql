-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — editar_coleta passa a corrigir também o POSTO (local)
--
-- Pedido da recepção depois de 20261124100000: além do nome e dos dados da
-- coleta, o local onde a coleta foi feita pode ter sido registrado errado.
--
-- O posto é snapshot em vários lugares, e todos acompanham a correção:
--   • ac_agendamentos.posto_id / local_posto
--   • ac_coletas.posto_id            (indicadores por posto)
--   • ac_culturas.posto_id / local_posto
--   • ac_recoletas.posto_id / local_posto
-- ac_coletas.location_id (estoque de onde saiu a baixa de insumo) NÃO muda: é o
-- registro do movimento de estoque que já aconteceu.
--
-- Sem checagem de horário ocupado: a coleta já aconteceu; a grade de horários só
-- importa para agendamentos ativos.
--
-- p_posto_id DEFAULT NULL = manter o posto atual — o front publicado antes desta
-- migration chama sem o parâmetro e continua funcionando.
--
-- Fica LOCAL, como antes: o LAB-HUB segue com o posto original (só o nome do
-- paciente é sincronizado, por rota própria).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS editar_coleta(uuid, text, text, text, timestamptz, text, boolean, boolean, text);
DROP FUNCTION IF EXISTS editar_coleta(uuid, text, text, text, timestamptz, text, boolean, boolean, text, uuid);

CREATE OR REPLACE FUNCTION editar_coleta(
  p_agendamento_id uuid,
  p_paciente_nome  text,
  p_telefone       text,
  p_coletado_por   text,
  p_coletado_em    timestamptz,
  p_observacoes    text,
  p_validade_ok    boolean,
  p_etiquetado     boolean,
  p_editado_por    text DEFAULT NULL,
  p_posto_id       uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid;
  v_status         text;
  v_coleta_id      uuid;
  v_posto_id       uuid;
  v_posto_nome     text;
  v_nome           text := NULLIF(regexp_replace(btrim(COALESCE(p_paciente_nome, '')), '\s+', ' ', 'g'), '');
  v_coletado_por   text := NULLIF(btrim(COALESCE(p_coletado_por, '')), '');
  v_editado_por    text := NULLIF(btrim(COALESCE(p_editado_por, '')), '');
BEGIN
  IF NOT public.current_user_has_permission('canEditarColeta') THEN
    RAISE EXCEPTION 'Permissão negada: requer canEditarColeta.'
      USING ERRCODE = '42501';
  END IF;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do paciente';
  END IF;
  IF v_coletado_por IS NULL THEN
    RAISE EXCEPTION 'Informe quem coletou';
  END IF;
  IF p_coletado_em IS NULL THEN
    RAISE EXCEPTION 'Informe a data e a hora da coleta';
  END IF;
  IF p_coletado_em > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'A data da coleta não pode estar no futuro';
  END IF;

  -- Resolve por id local; se não achar, tenta por labhub_id (mesmo padrão das
  -- demais RPCs do módulo).
  SELECT id, status, posto_id, local_posto
    INTO v_agendamento_id, v_status, v_posto_id, v_posto_nome
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, status, posto_id, local_posto
      INTO v_agendamento_id, v_status, v_posto_id, v_posto_nome
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'coletado' THEN
    RAISE EXCEPTION 'Só agendamentos com status ''coletado'' podem ter a coleta editada';
  END IF;

  -- Posto: NULL = mantém o atual. Aceita posto inativo (a coleta pode ter sido
  -- feita num posto desativado depois).
  IF p_posto_id IS NOT NULL AND p_posto_id IS DISTINCT FROM v_posto_id THEN
    SELECT nome INTO v_posto_nome FROM ac_postos WHERE id = p_posto_id;
    IF v_posto_nome IS NULL THEN
      RAISE EXCEPTION 'Posto não encontrado';
    END IF;
    v_posto_id := p_posto_id;
  END IF;

  SELECT id INTO v_coleta_id FROM ac_coletas WHERE agendamento_id = v_agendamento_id FOR UPDATE;
  IF v_coleta_id IS NULL THEN
    RAISE EXCEPTION 'Coleta do agendamento não encontrada';
  END IF;

  UPDATE ac_agendamentos
     SET paciente_nome     = v_nome,
         posto_id          = v_posto_id,
         local_posto       = v_posto_nome,
         paciente_telefone = NULLIF(btrim(COALESCE(p_telefone, '')), ''),
         editado_em        = now(),
         editado_por       = v_editado_por,
         updated_at        = now()
   WHERE id = v_agendamento_id;

  UPDATE ac_coletas
     SET coletado_por = v_coletado_por,
         posto_id     = v_posto_id,
         coletado_em  = p_coletado_em,
         observacoes  = NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
         validade_ok  = p_validade_ok,
         etiquetado   = p_etiquetado,
         editado_em   = now(),
         editado_por  = v_editado_por
   WHERE id = v_coleta_id;

  -- Snapshots do nome e do posto nas filas derivadas.
  UPDATE ac_culturas
     SET paciente_nome = v_nome,
         posto_id      = v_posto_id,
         local_posto   = v_posto_nome
   WHERE agendamento_id = v_agendamento_id
     AND (paciente_nome IS DISTINCT FROM v_nome
          OR posto_id IS DISTINCT FROM v_posto_id
          OR local_posto IS DISTINCT FROM v_posto_nome);

  UPDATE ac_recoletas
     SET paciente_nome = v_nome,
         posto_id      = v_posto_id,
         local_posto   = v_posto_nome
   WHERE (agendamento_id = v_agendamento_id OR coleta_id = v_coleta_id)
     AND (paciente_nome IS DISTINCT FROM v_nome
          OR posto_id IS DISTINCT FROM v_posto_id
          OR local_posto IS DISTINCT FROM v_posto_nome);

  RETURN v_agendamento_id;
END; $$;

GRANT EXECUTE ON FUNCTION editar_coleta(uuid, text, text, text, timestamptz, text, boolean, boolean, text, uuid) TO authenticated;
