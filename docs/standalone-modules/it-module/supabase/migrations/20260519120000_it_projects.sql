-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Tabela de Projetos
-- Migration: 20260519120000_it_projects.sql
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS it_projects (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  color        VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  created_by   UUID         NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_it_projects_created_by ON it_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_it_projects_created_at ON it_projects(created_at DESC);

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────
CREATE OR REPLACE FUNCTION update_it_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_it_projects_updated_at
  BEFORE UPDATE ON it_projects
  FOR EACH ROW EXECUTE FUNCTION update_it_projects_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE it_projects ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler
CREATE POLICY "it_projects_select_all"
  ON it_projects FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: usuário autenticado pode criar, deve ser o criador
CREATE POLICY "it_projects_insert_own"
  ON it_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- UPDATE: apenas admin ou TI
CREATE POLICY "it_projects_update_it_team"
  ON it_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR department = 'TI')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR department = 'TI')
    )
  );

-- DELETE: somente admin
CREATE POLICY "it_projects_delete_admin"
  ON it_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
