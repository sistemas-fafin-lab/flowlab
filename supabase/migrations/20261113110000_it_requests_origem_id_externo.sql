-- ═══════════════════════════════════════════════════════════════════════════════
-- TI — Origem e identificador externo dos chamados
-- Migration: 20261113110000_it_requests_origem_id_externo.sql
--
-- O LAB-BRAIN abre chamados pela integração server-to-server
-- (POST /api/integracoes/lab-brain-chamado-criar). Para o TI saber de onde veio
-- o chamado e para um reenvio não duplicar:
--   origem     — NULL = aberto pela tela; 'lab-brain' = aberto pelo agente.
--   id_externo — identificador do pedido no sistema de origem; único por origem
--                quando preenchido.
-- Spec: .scratch/lab-brain-chamados/spec.md (D6). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.it_requests
  ADD COLUMN IF NOT EXISTS origem     text,
  ADD COLUMN IF NOT EXISTS id_externo text;

COMMENT ON COLUMN public.it_requests.origem IS
  'De onde o chamado veio: NULL = tela do FlowLab; lab-brain = integração do LAB-BRAIN.';
COMMENT ON COLUMN public.it_requests.id_externo IS
  'Identificador do pedido no sistema de origem. Único por origem quando preenchido; o reenvio devolve o chamado existente.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_it_requests_origem_id_externo
  ON public.it_requests (origem, id_externo)
  WHERE id_externo IS NOT NULL;

-- Sem origem, o índice acima não barra repetição (NULL é sempre distinto):
-- id_externo só existe junto com a origem.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'it_requests_id_externo_exige_origem'
  ) THEN
    ALTER TABLE public.it_requests
      ADD CONSTRAINT it_requests_id_externo_exige_origem CHECK (id_externo IS NULL OR origem IS NOT NULL);
  END IF;
END
$$;
