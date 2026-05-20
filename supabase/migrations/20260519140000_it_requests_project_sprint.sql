-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Adiciona project_id e sprint_id à tabela it_requests
-- Migration: 20260519140000_it_requests_project_sprint.sql
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE it_requests
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES it_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_id  UUID REFERENCES it_sprints(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_it_requests_project_id ON it_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_it_requests_sprint_id  ON it_requests(sprint_id);
