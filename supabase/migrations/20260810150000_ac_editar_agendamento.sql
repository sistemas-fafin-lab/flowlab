-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — edição de agendamento pelo operador do FlowLab
--
-- Dá ao operador uma ação local para corrigir posto/data-hora/telefone de um
-- agendamento já recebido, sem precisar cancelar e recriar. Mesmo racional de
-- 20260722120000 (cancelar_agendamento):
--   1) Colunas de auditoria em ac_agendamentos (quem editou e quando).
--   2) RPC editar_agendamento — SECURITY DEFINER porque a RLS de
--      ac_agendamentos é só-SELECT.
--
-- Decisões:
--   • Edição é LOCAL: NÃO notifica o LAB-HUB. trg_ac_notificar_labhub_status só
--     dispara em UPDATE OF status — como esta RPC não toca `status`, o gatilho
--     nem roda. O LAB-HUB (e o paciente no portal) continuam vendo os dados
--     antigos até um cancelamento/recriação ou uma integração futura.
--   • Só agendamento 'recebido' pode ser editado — mesma cautela do
--     cancelamento: em coleta/laudo/cultura já há dado vinculado que assume o
--     horário/posto originais.
--   • Permissão canEditarAgendamentos é checada AQUI (current_user_has_permission),
--     não só no frontend — GRANT EXECUTE é para todo `authenticated`, e o
--     SECURITY DEFINER bypassa a RLS, então sem esse guard qualquer usuário
--     autenticado poderia chamar a RPC direto e editar qualquer agendamento
--     'recebido'. Mesmo padrão de assert_can_manage_users() (20260721120000).
--   • Reaproveitar o horário original é permitido (edição de só o telefone, por
--     exemplo): o guard de conflito exclui a própria linha.
--   • Guard de conflito (1 paciente por horário) espelha a ocupação calculada em
--     api/_lib/disponibilidade.ts — evita que a edição sobreponha outro
--     agendamento ativo no mesmo posto+horário.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DROP IF EXISTS + CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Auditoria da edição ──────────────────────────────────────────────────
ALTER TABLE ac_agendamentos ADD COLUMN IF NOT EXISTS editado_em  timestamptz;
ALTER TABLE ac_agendamentos ADD COLUMN IF NOT EXISTS editado_por text;

-- ─── 2. editar_agendamento ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS editar_agendamento(uuid, timestamptz, uuid, text, text);

CREATE OR REPLACE FUNCTION editar_agendamento(
  p_agendamento_id uuid,
  p_data_hora      timestamptz,
  p_posto_id       uuid,
  p_telefone       text DEFAULT NULL,
  p_editado_por    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid;
  v_status         text;
  v_posto_nome     text;
  v_conflito       uuid;
BEGIN
  IF NOT public.current_user_has_permission('canEditarAgendamentos') THEN
    RAISE EXCEPTION 'Permissão negada: requer canEditarAgendamentos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_data_hora IS NULL THEN
    RAISE EXCEPTION 'Informe a data e a hora';
  END IF;
  IF p_posto_id IS NULL THEN
    RAISE EXCEPTION 'Informe o posto';
  END IF;

  -- Resolve por id local; se não achar, tenta por labhub_id (mesmo padrão de
  -- cancelar_agendamento).
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
    RAISE EXCEPTION 'Só agendamentos com status ''recebido'' podem ser editados';
  END IF;

  SELECT nome INTO v_posto_nome FROM ac_postos WHERE id = p_posto_id;
  IF v_posto_nome IS NULL THEN
    RAISE EXCEPTION 'Posto não encontrado';
  END IF;

  -- 1 paciente por horário: recusa se outro agendamento ativo já ocupa o
  -- destino (a própria linha, no seu horário atual, não conta como conflito).
  SELECT id INTO v_conflito
    FROM ac_agendamentos
   WHERE posto_id = p_posto_id
     AND data_hora = p_data_hora
     AND status <> 'cancelado'
     AND id <> v_agendamento_id
   LIMIT 1;
  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'Horário já ocupado';
  END IF;

  UPDATE ac_agendamentos
     SET data_hora         = p_data_hora,
         posto_id          = p_posto_id,
         local_posto       = v_posto_nome,
         paciente_telefone = NULLIF(btrim(COALESCE(p_telefone, '')), ''),
         editado_em        = now(),
         editado_por       = NULLIF(btrim(COALESCE(p_editado_por, '')), ''),
         updated_at        = now()
   WHERE id = v_agendamento_id;

  RETURN v_agendamento_id;
END; $$;

-- Permissão de execução via PostgREST (supabase.rpc) p/ authenticated.
GRANT EXECUTE ON FUNCTION editar_agendamento(uuid, timestamptz, uuid, text, text) TO authenticated;
