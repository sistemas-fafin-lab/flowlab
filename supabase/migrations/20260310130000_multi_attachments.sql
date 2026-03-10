-- ============================================================
-- MÚLTIPLOS ANEXOS - Payment Requests e Requests (Compras/Material)
-- ============================================================

-- 1. Adicionar coluna attachments (JSONB array) em payment_requests
ALTER TABLE public.payment_requests
ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.payment_requests.attachments IS 'Array de anexos [{url, name}] - suporta múltiplos arquivos';

-- 2. Migrar registros legados de payment_requests para o novo formato
UPDATE public.payment_requests
SET attachments = jsonb_build_array(
  jsonb_build_object('url', attachment_url, 'name', attachment_name)
)
WHERE attachment_url IS NOT NULL
  AND (attachments = '[]'::jsonb OR attachments IS NULL);

-- 3. Adicionar coluna attachments (JSONB array) em requests (Compras/Material)
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.requests.attachments IS 'Array de anexos [{url, name}] - suporta múltiplos arquivos';

-- 4. Migrar registros legados de requests para o novo formato
UPDATE public.requests
SET attachments = jsonb_build_array(
  jsonb_build_object('url', attachment_url, 'name', attachment_name)
)
WHERE attachment_url IS NOT NULL
  AND (attachments = '[]'::jsonb OR attachments IS NULL);

-- ============================================================
-- Garantir bucket e políticas para request-attachments
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "request_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "request_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "request_attachments_delete" ON storage.objects;

CREATE POLICY "request_attachments_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'request-attachments');

CREATE POLICY "request_attachments_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'request-attachments');

CREATE POLICY "request_attachments_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'request-attachments');
