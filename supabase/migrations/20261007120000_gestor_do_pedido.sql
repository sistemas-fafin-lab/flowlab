-- ═══════════════════════════════════════════════════════════════════════════════
-- Cotações — gestor do pedido na SC e na cotação
-- Migration: 20261007120000_gestor_do_pedido.sql
--
-- A SC guardava só o nome do solicitante em texto livre (requests.requested_by)
-- e a cotação só quem a montou (o comprador). Para a futura etapa de aprovação
-- do gestor do pedido, o sistema precisa saber QUEM é esse gestor:
--   • requests.requested_by_user_id: usuário que criou a SC, gravado pelo client
--     na criação. Sem backfill — SCs antigas ficam NULL e o comprador escolhe o
--     gestor manualmente ao enviar a cotação para aprovação.
--   • quotations.requester_manager_id: gestor do pedido escolhido pelo comprador
--     no envio para aprovação. NULL no banco (cotações anteriores ao deploy);
--     obrigatório no envio é regra do client.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS requested_by_user_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.requests.requested_by_user_id IS 'Usuário que criou a SC (pré-preenche o gestor do pedido da cotação). NULL em SCs anteriores a 2026-10.';

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS requester_manager_id UUID
    REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quotations.requester_manager_id IS 'Gestor do pedido: quem dá o "de acordo" da cotação antes da aprovação por alçada.';

CREATE INDEX IF NOT EXISTS idx_quotations_requester_manager
  ON public.quotations(requester_manager_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM
-- ═══════════════════════════════════════════════════════════════════════════════
