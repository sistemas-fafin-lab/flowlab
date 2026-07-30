-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Visão Estratégica e Mapa Mental de Projetos
-- Migration: 20260521010000_it_project_visions.sql
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS it_project_visions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id      UUID         NOT NULL UNIQUE
                 REFERENCES it_projects(id) ON DELETE CASCADE,

  mission         TEXT         NOT NULL,
  vision          TEXT         NOT NULL,

  in_scope        TEXT[]       NOT NULL DEFAULT '{}',
  out_of_scope    TEXT[]       NOT NULL DEFAULT '{}',

  infra_details   JSONB        NOT NULL DEFAULT '{"vps": "", "os": "", "automation": ""}'::JSONB,
  team_details    JSONB        NOT NULL DEFAULT '{"licenses_allocated": 0, "collaborators": []}'::JSONB,

  nodes           JSONB,
  edges           JSONB,

  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_it_project_visions_project_id ON it_project_visions(project_id);

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────
CREATE OR REPLACE FUNCTION update_it_project_visions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_it_project_visions_updated_at
  BEFORE UPDATE ON it_project_visions
  FOR EACH ROW EXECUTE FUNCTION update_it_project_visions_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE it_project_visions ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler
CREATE POLICY "it_project_visions_select_all"
  ON it_project_visions FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: admin ou TI (canManageIT)
CREATE POLICY "it_project_visions_insert_authorized"
  ON it_project_visions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR department = 'TI')
    )
  );

-- UPDATE: admin ou TI (canManageIT)
CREATE POLICY "it_project_visions_update_authorized"
  ON it_project_visions FOR UPDATE
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
CREATE POLICY "it_project_visions_delete_admin"
  ON it_project_visions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
