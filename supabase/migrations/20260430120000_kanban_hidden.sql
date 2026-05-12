-- Add kanban_hidden field to it_requests
-- Allows removing a card from the Kanban board without affecting the original request status
ALTER TABLE it_requests
  ADD COLUMN IF NOT EXISTS kanban_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_it_requests_kanban_hidden ON it_requests(kanban_hidden);
