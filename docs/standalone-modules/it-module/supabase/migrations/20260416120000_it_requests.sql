-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo de Tecnologia (TI) - Tabela de Chamados
-- Migration: 20260416120000_it_requests.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Sequence para geração do código legível ─────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS it_request_seq START WITH 1 INCREMENT BY 1;

-- ─── Tabela principal ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS it_requests (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        VARCHAR(20)   NOT NULL UNIQUE DEFAULT 'IT-' || LPAD(nextval('it_request_seq')::TEXT, 3, '0'),
  title         VARCHAR(255)  NOT NULL,
  description   TEXT,

  request_type  VARCHAR(30)   NOT NULL DEFAULT 'suporte'
                CHECK (request_type IN ('suporte', 'desenvolvimento')),

  priority      VARCHAR(20)   NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  status        VARCHAR(30)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),

  kanban_status VARCHAR(30)   NOT NULL DEFAULT 'backlog'
                CHECK (kanban_status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),

  requested_by  UUID          NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  assigned_to   UUID          REFERENCES user_profiles(id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_it_requests_status        ON it_requests(status);
CREATE INDEX IF NOT EXISTS idx_it_requests_kanban_status ON it_requests(kanban_status);
CREATE INDEX IF NOT EXISTS idx_it_requests_requested_by  ON it_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_it_requests_assigned_to   ON it_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_it_requests_priority      ON it_requests(priority);
CREATE INDEX IF NOT EXISTS idx_it_requests_created_at    ON it_requests(created_at DESC);

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────
CREATE OR REPLACE FUNCTION update_it_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_it_requests_updated_at
  BEFORE UPDATE ON it_requests
  FOR EACH ROW EXECUTE FUNCTION update_it_requests_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE it_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler
CREATE POLICY "it_requests_select_all"
  ON it_requests FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: qualquer usuário autenticado pode abrir um chamado
CREATE POLICY "it_requests_insert_all"
  ON it_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

-- UPDATE: apenas admin ou usuários do departamento de TI podem atualizar
CREATE POLICY "it_requests_update_it_team"
  ON it_requests FOR UPDATE
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

-- DELETE: somente admin pode deletar
CREATE POLICY "it_requests_delete_admin"
  ON it_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
