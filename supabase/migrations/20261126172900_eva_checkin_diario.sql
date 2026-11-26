-- EVA — check-in diário (D46, issue 34).
--
-- Às 9h de dia útil, a EVA pergunta a cada membro com WhatsApp o que entra no dia e se há bloqueio;
-- às 10h, os gestores que recebem o relatório de gestão ganham o resumo. Quem dispara é o relógio
-- da VPS (D44). Desligado por padrão: liga em EVA → Configurações.
--
-- 1. ti_agente_config.checkin_ativo.
-- 2. ti_agente_checkins: uma linha por pessoa por dia (a trava contra perguntar duas vezes), com a
--    resposta, os cards planejados e os bloqueios. Só o servidor grava; quem vê o Início lê.
-- 3. Os tipos 'checkin' (a pergunta) e 'checkin_resumo' (o resumo do gestor) na fila do WhatsApp.
--
-- Idempotente.

-- ── 1. Liga/desliga ─────────────────────────────────────────────────────────
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS checkin_ativo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.ti_agente_config.checkin_ativo IS 'D46: a pergunta do check-in às 9h e o resumo para os gestores às 10h.';

-- ── 2. As respostas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_agente_checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id      uuid NOT NULL REFERENCES public.ti_agente_membros(id) ON DELETE CASCADE,
  dia            date NOT NULL,
  status         text NOT NULL DEFAULT 'perguntado' CHECK (status IN ('perguntado', 'respondido')),
  resposta       text,
  planejados     text[] NOT NULL DEFAULT '{}'::text[],
  bloqueios      jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo         text,
  perguntado_em  timestamptz NOT NULL DEFAULT now(),
  respondido_em  timestamptz,
  UNIQUE (membro_id, dia)
);

COMMENT ON TABLE public.ti_agente_checkins IS
  'D46: o check-in diário de cada membro. bloqueios = [{codigo, motivo}]; planejados = códigos dos cards do dia.';

CREATE INDEX IF NOT EXISTS idx_ti_agente_checkins_dia ON public.ti_agente_checkins (dia);

ALTER TABLE public.ti_agente_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_checkins_select ON public.ti_agente_checkins;
CREATE POLICY ti_agente_checkins_select ON public.ti_agente_checkins
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_has_permission('canManageIT'))
    OR (SELECT public.ti_agente_pode('canManageAgenteTI'))
    OR (SELECT public.ti_agente_pode('canApproveAgenteTI'))
  );

-- ── 3. Os tipos novos da fila ───────────────────────────────────────────────
ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo', 'lembrete', 'aviso', 'relatorio', 'alerta',
                  'checkin', 'checkin_resumo'));
