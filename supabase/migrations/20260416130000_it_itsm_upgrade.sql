-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo de TI (ITSM) — Fase 1: Comentários, Anexos, Prazos
-- Migration: 20260416130000_it_itsm_upgrade.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Expand it_requests ───────────────────────────────────────────────────

ALTER TABLE it_requests
  ADD COLUMN IF NOT EXISTS is_internal      BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_hours  DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS due_date         TIMESTAMPTZ;

-- ─── 2. Tabela de Comentários (it_task_comments) ─────────────────────────────

CREATE TABLE IF NOT EXISTS it_task_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES it_requests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_task_comments_task_id ON it_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_it_task_comments_user_id ON it_task_comments(user_id);

-- ─── 3. Tabela de Anexos (it_task_attachments) ───────────────────────────────

CREATE TABLE IF NOT EXISTS it_task_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES it_requests(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  file_url    TEXT        NOT NULL,
  file_name   TEXT        NOT NULL,
  file_size   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_task_attachments_task_id ON it_task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_it_task_attachments_user_id ON it_task_attachments(user_id);

-- ─── 4. Row Level Security ───────────────────────────────────────────────────

ALTER TABLE it_task_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_task_attachments ENABLE ROW LEVEL SECURITY;

-- Comments — authenticated users can read all and insert their own
DROP POLICY IF EXISTS "it_task_comments_select"     ON it_task_comments;
DROP POLICY IF EXISTS "it_task_comments_insert"     ON it_task_comments;
DROP POLICY IF EXISTS "it_task_comments_delete_own" ON it_task_comments;

CREATE POLICY "it_task_comments_select"
  ON it_task_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "it_task_comments_insert"
  ON it_task_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "it_task_comments_delete_own"
  ON it_task_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Attachments — authenticated users can read all and insert their own
DROP POLICY IF EXISTS "it_task_attachments_select"     ON it_task_attachments;
DROP POLICY IF EXISTS "it_task_attachments_insert"     ON it_task_attachments;
DROP POLICY IF EXISTS "it_task_attachments_delete_own" ON it_task_attachments;

CREATE POLICY "it_task_attachments_select"
  ON it_task_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "it_task_attachments_insert"
  ON it_task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "it_task_attachments_delete_own"
  ON it_task_attachments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─── 5. Storage bucket: it-attachments ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'it-attachments',
  'it-attachments',
  true,
  52428800,   -- 50 MB limit per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for the it-attachments bucket
DROP POLICY IF EXISTS "it_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "it_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "it_attachments_storage_delete" ON storage.objects;

CREATE POLICY "it_attachments_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'it-attachments');

CREATE POLICY "it_attachments_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'it-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "it_attachments_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'it-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
