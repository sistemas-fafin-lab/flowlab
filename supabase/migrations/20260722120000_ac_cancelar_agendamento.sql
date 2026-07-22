-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — cancelamento de agendamento pelo operador do FlowLab
--
-- Até aqui o único cancelamento vinha do LAB-HUB (receive-cancelamento, service
-- role). Esta migration dá ao operador a ação local:
--   1) Colunas de auditoria em ac_agendamentos (anuláveis de propósito: o
--      receive-cancelamento não as preenche — NULL = cancelado pelo LAB-HUB).
--   2) RPC cancelar_agendamento — SECURITY DEFINER porque a RLS de
--      ac_agendamentos é só-SELECT (mesmo racional de 20260708140000).
--
-- Decisões:
--   • Cancelamento é LÓGICO (status='cancelado'): a disponibilidade já ignora
--     cancelados, então o horário volta a ficar livre sozinho.
--   • NÃO notifica o LAB-HUB: o trigger trg_ac_notificar_labhub_status só
--     propaga em_coleta|coletado|bloqueado — 'cancelado' fica local.
--   • 'coletado' não pode ser cancelado: já há coleta/exames/culturas ativos
--     que ficariam "vivos" apontando para um agendamento cancelado.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DROP IF EXISTS + CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Auditoria do cancelamento ────────────────────────────────────────────
ALTER TABLE ac_agendamentos ADD COLUMN IF NOT EXISTS cancelado_em        timestamptz;
ALTER TABLE ac_agendamentos ADD COLUMN IF NOT EXISTS cancelado_por       text;
ALTER TABLE ac_agendamentos ADD COLUMN IF NOT EXISTS cancelamento_motivo text;

-- ─── 2. cancelar_agendamento ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS cancelar_agendamento(uuid, text, text);

CREATE OR REPLACE FUNCTION cancelar_agendamento(
  p_agendamento_id uuid,
  p_cancelado_por  text DEFAULT NULL,
  p_motivo         text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id uuid;
  v_status         text;
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
  IF v_status = 'cancelado' THEN
    RAISE EXCEPTION 'Agendamento já está cancelado';
  END IF;
  IF v_status = 'coletado' THEN
    RAISE EXCEPTION 'Agendamento já coletado não pode ser cancelado';
  END IF;

  UPDATE ac_agendamentos
     SET status              = 'cancelado',
         cancelado_em        = now(),
         cancelado_por       = NULLIF(btrim(COALESCE(p_cancelado_por, '')), ''),
         cancelamento_motivo = NULLIF(btrim(COALESCE(p_motivo, '')), ''),
         updated_at          = now()
   WHERE id = v_agendamento_id;
  -- trg_ac_notificar_labhub_status dispara mas retorna cedo ('cancelado' está
  -- fora do conjunto propagável) — nada é enviado ao LAB-HUB.

  RETURN v_agendamento_id;
END; $$;

-- Permissão de execução via PostgREST (supabase.rpc) p/ authenticated.
GRANT EXECUTE ON FUNCTION cancelar_agendamento(uuid, text, text) TO authenticated;
