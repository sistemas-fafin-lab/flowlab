-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — edição de um agendamento já COLETADO
--
-- editar_agendamento (20260810150000) só aceita status 'recebido'. Depois da
-- coleta o operador ficava sem saída para corrigir um erro de digitação — o caso
-- que motivou esta migration foi o NOME do paciente errado.
--
-- O que pode ser corrigido aqui:
--   • ac_agendamentos: paciente_nome, paciente_telefone
--   • ac_coletas:      coletado_por, coletado_em, observacoes, validade_ok, etiquetado
--
-- O que fica de fora, de propósito:
--   • Posto e data/hora AGENDADA: depois da coleta o que vale é quando ela foi
--     feita (coletado_em, editável acima).
--   • Exames do pedido: já geraram ac_agendamento_exames, culturas e o laudo
--     (exames_total). Mexer neles pede regra própria para cultura iniciada /
--     laudo liberado.
--
-- Decisões:
--   • Edição é LOCAL, como editar_agendamento: o status não muda, então
--     trg_ac_notificar_labhub_status não dispara e o LAB-HUB segue com os dados
--     antigos.
--   • paciente_nome é snapshot em ac_culturas e ac_recoletas — a correção é
--     propagada para as linhas deste agendamento/coleta, senão as filas de
--     Culturas e Recoletas continuariam mostrando o nome errado.
--   • Permissão canEditarAgendamentos checada AQUI (SECURITY DEFINER + GRANT a
--     authenticated), mesmo racional de editar_agendamento.
--   • Auditoria: editado_em/editado_por em ac_agendamentos (já existiam) e em
--     ac_coletas (novas).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DROP IF EXISTS + CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Auditoria da edição da coleta ────────────────────────────────────────
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS editado_em  timestamptz;
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS editado_por text;

-- ─── 2. editar_coleta ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS editar_coleta(uuid, text, text, text, timestamptz, text, boolean, boolean, text);

CREATE OR REPLACE FUNCTION editar_coleta(
  p_agendamento_id uuid,
  p_paciente_nome  text,
  p_telefone       text,
  p_coletado_por   text,
  p_coletado_em    timestamptz,
  p_observacoes    text,
  p_validade_ok    boolean,
  p_etiquetado     boolean,
  p_editado_por    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid;
  v_status         text;
  v_coleta_id      uuid;
  v_nome           text := NULLIF(regexp_replace(btrim(COALESCE(p_paciente_nome, '')), '\s+', ' ', 'g'), '');
  v_coletado_por   text := NULLIF(btrim(COALESCE(p_coletado_por, '')), '');
  v_editado_por    text := NULLIF(btrim(COALESCE(p_editado_por, '')), '');
BEGIN
  IF NOT public.current_user_has_permission('canEditarAgendamentos') THEN
    RAISE EXCEPTION 'Permissão negada: requer canEditarAgendamentos.'
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
  SELECT id, status INTO v_agendamento_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, status INTO v_agendamento_id, v_status
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'coletado' THEN
    RAISE EXCEPTION 'Só agendamentos com status ''coletado'' podem ter a coleta editada';
  END IF;

  SELECT id INTO v_coleta_id FROM ac_coletas WHERE agendamento_id = v_agendamento_id FOR UPDATE;
  IF v_coleta_id IS NULL THEN
    RAISE EXCEPTION 'Coleta do agendamento não encontrada';
  END IF;

  UPDATE ac_agendamentos
     SET paciente_nome     = v_nome,
         paciente_telefone = NULLIF(btrim(COALESCE(p_telefone, '')), ''),
         editado_em        = now(),
         editado_por       = v_editado_por,
         updated_at        = now()
   WHERE id = v_agendamento_id;

  UPDATE ac_coletas
     SET coletado_por = v_coletado_por,
         coletado_em  = p_coletado_em,
         observacoes  = NULLIF(btrim(COALESCE(p_observacoes, '')), ''),
         validade_ok  = p_validade_ok,
         etiquetado   = p_etiquetado,
         editado_em   = now(),
         editado_por  = v_editado_por
   WHERE id = v_coleta_id;

  -- Snapshots do nome nas filas derivadas.
  UPDATE ac_culturas
     SET paciente_nome = v_nome
   WHERE agendamento_id = v_agendamento_id
     AND paciente_nome IS DISTINCT FROM v_nome;

  UPDATE ac_recoletas
     SET paciente_nome = v_nome
   WHERE (agendamento_id = v_agendamento_id OR coleta_id = v_coleta_id)
     AND paciente_nome IS DISTINCT FROM v_nome;

  RETURN v_agendamento_id;
END; $$;

GRANT EXECUTE ON FUNCTION editar_coleta(uuid, text, text, text, timestamptz, text, boolean, boolean, text) TO authenticated;
