-- EVA — planejamento e pauta da reunião (D47 e D48, issue 35).
--
-- O planejamento ("o que cabe na próxima sprint?") não precisa de banco: a conta sai dos cards, e a
-- redistribuição vira sugestão de sempre (origem whatsapp ou chat). A pauta precisa de:
-- 1. ti_agente_config: a pauta ligada (desligada por padrão), o dia (1 = segunda … 5 = sexta) e a
--    hora ("HH:MM", Brasília) da reunião da equipe. Uma hora antes, o relógio (D44) manda a pauta aos
--    gestores que recebem o relatório de gestão.
-- 2. O tipo 'pauta' na fila do WhatsApp.
--
-- Idempotente. Vem depois de 20261126172900_eva_checkin_diario.sql (a lista de tipos da fila inclui
-- os do check-in).

-- ── 1. A reunião da equipe ──────────────────────────────────────────────────
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS pauta_ativa boolean NOT NULL DEFAULT false;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS reuniao_dia smallint NOT NULL DEFAULT 1;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS reuniao_hora text NOT NULL DEFAULT '10:00';

ALTER TABLE public.ti_agente_config DROP CONSTRAINT IF EXISTS ti_agente_config_reuniao_dia_check;
ALTER TABLE public.ti_agente_config ADD CONSTRAINT ti_agente_config_reuniao_dia_check CHECK (reuniao_dia BETWEEN 1 AND 5);
ALTER TABLE public.ti_agente_config DROP CONSTRAINT IF EXISTS ti_agente_config_reuniao_hora_check;
ALTER TABLE public.ti_agente_config ADD CONSTRAINT ti_agente_config_reuniao_hora_check CHECK (reuniao_hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

COMMENT ON COLUMN public.ti_agente_config.pauta_ativa IS 'D48: a pauta da reunião da equipe, 1 h antes, no WhatsApp dos gestores que recebem o relatório.';
COMMENT ON COLUMN public.ti_agente_config.reuniao_dia IS 'D48: dia da semana da reunião da equipe (1 = segunda … 5 = sexta).';
COMMENT ON COLUMN public.ti_agente_config.reuniao_hora IS 'D48: hora da reunião da equipe, "HH:MM" em Brasília.';

-- ── 2. O tipo novo da fila ──────────────────────────────────────────────────
ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo', 'lembrete', 'aviso', 'relatorio', 'alerta',
                  'checkin', 'checkin_resumo', 'pauta'));
