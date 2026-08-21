-- Board (Kanban) multi-departamento: infraestrutura genérica de boards por cargo.
-- Ticket: .scratch/board-multidepartamento/issues/02-schema-boards-permissions-rls.md
-- Spec:   .scratch/board-multidepartamento/spec.md
--
-- O board que um cargo enxerga é decidido por custom_roles.board_id, não por
-- um campo de departamento. Vários cargos podem apontar para o mesmo board;
-- cada cargo aponta para no máximo um. Vincular os cargos de Transporte já
-- existentes a este board, e marcar canManageBoard neles, é feito manualmente
-- depois pelo usuário via UI de cargos (UserManagement.tsx) — fora do escopo
-- desta migration.

-- ─── boards: catálogo de boards por departamento ──────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  label      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── custom_roles: vínculo opcional com um board ──────────────────────────────
ALTER TABLE custom_roles
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES boards(id) ON DELETE SET NULL;

-- ─── board_tickets: cards genéricos, isolados por board ───────────────────────
CREATE TABLE IF NOT EXISTS board_tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id       uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  responsible_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  due_date       date,
  priority       varchar(20) NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  kanban_status  varchar(30) NOT NULL DEFAULT 'backlog'
                 CHECK (kanban_status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  created_by     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_tickets_board_id       ON board_tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_board_tickets_kanban_status  ON board_tickets(kanban_status);
CREATE INDEX IF NOT EXISTS idx_board_tickets_responsible_id ON board_tickets(responsible_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_tickets ENABLE ROW LEVEL SECURITY;

-- boards: catálogo não tem dado sensível (só slug/label) — qualquer usuário
-- autenticado pode ler, necessário para resolver o seletor de boards e para a
-- UI de cargos exibir a qual board um cargo está vinculado.
CREATE POLICY "boards_select" ON boards
  FOR SELECT TO authenticated
  USING (true);

-- board_tickets: ver = o cargo do usuário aponta para o mesmo board do card,
-- ou o usuário tem canManageAllBoards. Escrever = a condição de ver E
-- canManageBoard, ou canManageAllBoards sozinho.
CREATE POLICY "board_tickets_select" ON board_tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      JOIN custom_roles cr ON cr.id = p.custom_role_id
      WHERE p.id = auth.uid() AND cr.board_id = board_tickets.board_id
    )
    OR public.current_user_has_permission('canManageAllBoards')
  );

CREATE POLICY "board_tickets_insert" ON board_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_profiles p
        JOIN custom_roles cr ON cr.id = p.custom_role_id
        WHERE p.id = auth.uid() AND cr.board_id = board_tickets.board_id
      )
      AND public.current_user_has_permission('canManageBoard')
    )
    OR public.current_user_has_permission('canManageAllBoards')
  );

CREATE POLICY "board_tickets_update" ON board_tickets
  FOR UPDATE TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_profiles p
        JOIN custom_roles cr ON cr.id = p.custom_role_id
        WHERE p.id = auth.uid() AND cr.board_id = board_tickets.board_id
      )
      AND public.current_user_has_permission('canManageBoard')
    )
    OR public.current_user_has_permission('canManageAllBoards')
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM user_profiles p
        JOIN custom_roles cr ON cr.id = p.custom_role_id
        WHERE p.id = auth.uid() AND cr.board_id = board_tickets.board_id
      )
      AND public.current_user_has_permission('canManageBoard')
    )
    OR public.current_user_has_permission('canManageAllBoards')
  );

CREATE POLICY "board_tickets_delete" ON board_tickets
  FOR DELETE TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM user_profiles p
        JOIN custom_roles cr ON cr.id = p.custom_role_id
        WHERE p.id = auth.uid() AND cr.board_id = board_tickets.board_id
      )
      AND public.current_user_has_permission('canManageBoard')
    )
    OR public.current_user_has_permission('canManageAllBoards')
  );

-- ─── Seed: board "Transporte" ─────────────────────────────────────────────────
INSERT INTO boards (slug, label)
VALUES ('transporte', 'Transporte')
ON CONFLICT (slug) DO NOTHING;
