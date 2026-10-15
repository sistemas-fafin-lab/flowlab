-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA — aviso de gestor para uma pessoa pelo WhatsApp
-- Migration: 20261015140000_eva_aviso_pessoal.sql
-- (.scratch/agente-ti/issues/21-aviso-pessoal.md; plano D32)
--
-- O gestor pede pelo chat do Início ("Enviar pelo WhatsApp") ou pelo WhatsApp ("avisa o Gabriel
-- que…", com SIM). A mensagem é do tipo `aviso` na fila de sempre; o pedido pelo WhatsApp que
-- espera o SIM é um comando `avisar_pessoa`.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ti_agente_comandos') IS NULL THEN
    RAISE EXCEPTION 'Aplique 20261014160000_eva_comandos_whatsapp.sql antes desta migration.';
  END IF;
END $$;

BEGIN;

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo', 'lembrete', 'aviso'));

ALTER TABLE public.ti_agente_comandos DROP CONSTRAINT IF EXISTS ti_agente_comandos_tipo_check;
ALTER TABLE public.ti_agente_comandos ADD CONSTRAINT ti_agente_comandos_tipo_check
  CHECK (tipo IN ('cobrar', 'aprovar', 'rejeitar', 'avisar_grupo', 'lista_sugestoes', 'avisar_pessoa'));

COMMIT;
