-- ═══════════════════════════════════════════════════════════════════════════════
-- IT Requests — Suporte a Anexos
-- Migration: 20260424130000_it_requests_attachments.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Coluna de anexos na tabela it_requests ────────────────────────────────
ALTER TABLE public.it_requests
ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.it_requests.attachments IS
  'Array de anexos [{url, name, size}] - suporta múltiplos arquivos (PDF, PNG, JPEG)';

-- ─── 2. Bucket de storage ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('it-attachments', 'it-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ─── 3. Políticas RLS para o bucket ──────────────────────────────────────────

-- Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "it_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "it_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "it_attachments_delete" ON storage.objects;

-- Upload: apenas usuários autenticados
CREATE POLICY "it_attachments_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'it-attachments');

-- Leitura: pública (URLs diretas nos cards de chamado)
CREATE POLICY "it_attachments_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'it-attachments');

-- Deleção: apenas usuários autenticados (quem criou o chamado ou a equipe de TI)
CREATE POLICY "it_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'it-attachments');
