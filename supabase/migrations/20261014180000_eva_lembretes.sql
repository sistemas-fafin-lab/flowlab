-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — lembretes pessoais pelo WhatsApp
-- Migration: 20261014180000_eva_lembretes.sql
-- (.scratch/agente-ti/issues/19-agente-pessoal.md; plano D30)
--
-- "Me lembra amanhã às 9h de ligar para o fornecedor": o lembrete é uma mensagem `lembrete` na
-- fila de sempre, com proxima_tentativa_em = a hora pedida. O script da VPS já só envia o que
-- venceu, então não precisa de cron nem de tabela nova. Quem desiste do lembrete deixa a
-- mensagem `cancelada`, que a VPS não envia.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_agente_mensagens') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261013150000_eva_tabelas.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo', 'lembrete'));

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_status_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_status_check
  CHECK (status IN ('pendente', 'enviada', 'entregue', 'lida', 'falhou', 'recebida', 'ignorada', 'cancelada'));

COMMENT ON COLUMN public.ti_agente_mensagens.proxima_tentativa_em IS 'Agendada (horário de cobrança, lembrete pessoal) ou próxima tentativa depois de uma falha. A VPS só envia quando venceu.';

-- Os lembretes pendentes de cada pessoa ("meus lembretes", cancelar).
CREATE INDEX IF NOT EXISTS ti_agente_mensagens_lembretes_idx
  ON public.ti_agente_mensagens (membro_id, proxima_tentativa_em)
  WHERE tipo = 'lembrete' AND status = 'pendente';

COMMIT;
