/*
  # Permissão `canEditarColeta` — editar um agendamento já coletado

  A RPC editar_coleta (20261124100000) nasceu checando canEditarAgendamentos,
  a mesma permissão que ajusta posto/horário/telefone ANTES da coleta. Depois
  da coleta a edição alcança o nome do paciente (propagado às filas de Culturas
  e Recoletas) e os dados da coleta — por isso ganha uma key própria, para o
  admin decidir quem pode, sem herdar de quem só remarca agendamento.

  Backfill apenas do cargo de sistema "Administrador", como nas demais
  permissões novas. Os outros cargos o admin marca em Usuários → Cargos.

  Idempotente: só concede a quem ainda não tem + CREATE OR REPLACE.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canEditarColeta"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canEditarColeta';

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
