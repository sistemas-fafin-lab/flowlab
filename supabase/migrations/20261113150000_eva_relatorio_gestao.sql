-- EVA — relatório e alertas de gestão pelo WhatsApp (D38, issue 27).
--
-- 1. ti_agente_membros: duas adesões, marcadas na aba Membros, só para quem é gestor da EVA:
--    o relatório (todo dia útil por volta das 8h; na segunda, o da semana anterior) e os
--    alertas na hora (chamado fora do prazo para iniciar, card crítico que atrasou, projeto em
--    risco). O servidor confere o papel de gestor no envio: quem perde o papel deixa de receber.
-- 2. ti_agente_mensagens: os tipos 'relatorio' e 'alerta'. Seguem o horário da EVA (dia útil,
--    das 7h às 20h) como as cobranças, e uma chave_dia por pessoa e por dia (relatório) ou por
--    acontecimento (alerta) evita repetir.
--
-- Sem RLS nova: as colunas seguem as policies de ti_agente_membros (quem configura edita).
-- Idempotente.

ALTER TABLE public.ti_agente_membros
  ADD COLUMN IF NOT EXISTS recebe_relatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recebe_alertas   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ti_agente_membros.recebe_relatorio IS
  'Adesão ao relatório de gestão pelo WhatsApp (D38): todo dia útil por volta das 8h, e na segunda o da semana anterior. Só vale para gestor da EVA (canManageAgenteTI), conferido no envio.';
COMMENT ON COLUMN public.ti_agente_membros.recebe_alertas IS
  'Adesão aos alertas de gestão na hora pelo WhatsApp (D38): chamado fora do prazo para iniciar, card crítico que atrasou, projeto em risco. Só vale para gestor da EVA, conferido no envio.';

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_tipo_check
  CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida', 'grupo', 'lembrete', 'aviso', 'relatorio', 'alerta'));
