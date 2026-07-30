-- ============================================================
-- Cooldown anti-spam para emails de mudança de status (por chamado)
-- Guarda o momento do último email de status enviado ao solicitante.
-- O app só envia novo email se passaram >= 5 min do last_status_email_at.
-- ============================================================

ALTER TABLE public.it_requests
  ADD COLUMN IF NOT EXISTS last_status_email_at TIMESTAMPTZ;

COMMENT ON COLUMN public.it_requests.last_status_email_at
  IS 'Momento do último email de mudança de status enviado ao solicitante (cooldown anti-spam de 5 min por chamado).';
