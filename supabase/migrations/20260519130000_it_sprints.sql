-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Tabela de Sprints
-- Migration: 20260519130000_it_sprints.sql
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS it_sprints (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID         NOT NULL REFERENCES it_projects(id) ON DELETE CASCADE, -- vai deletar sprints se o projeto for deletado
  name        VARCHAR(100) NOT NULL,
  goal        TEXT,
  start_date  DATE,
  end_date    DATE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned', 'active', 'completed')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_it_sprints_project_id ON it_sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_it_sprints_status     ON it_sprints(status);

-- Garante máximo 1 sprint ativa por projeto no banco
CREATE UNIQUE INDEX IF NOT EXISTS idx_it_sprints_one_active_per_project
  ON it_sprints(project_id)
  WHERE status = 'active';

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────
CREATE OR REPLACE FUNCTION update_it_sprints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_it_sprints_updated_at
  BEFORE UPDATE ON it_sprints
  FOR EACH ROW EXECUTE FUNCTION update_it_sprints_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE it_sprints ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler
CREATE POLICY "it_sprints_select_all"
  ON it_sprints FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: apenas admin ou TI
CREATE POLICY "it_sprints_insert_it_team"
  ON it_sprints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR department = 'TI')
    )
  );

-- UPDATE: apenas admin ou TI
CREATE POLICY "it_sprints_update_it_team"
  ON it_sprints FOR UPDATE
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
CREATE POLICY "it_sprints_delete_admin"
  ON it_sprints FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
