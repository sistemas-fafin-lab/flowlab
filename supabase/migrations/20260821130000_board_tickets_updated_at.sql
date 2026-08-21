-- Board (Kanban) multi-departamento: trigger de updated_at para board_tickets.
-- Ticket: .scratch/board-multidepartamento/issues/05-acoes-gerenciamento-cards.md
--
-- A migration anterior (board_multidepartamento) criou a coluna updated_at
-- com default now(), mas sem trigger de manutenção — editar um card (ticket 05)
-- deixaria updated_at parado na criação. Segue o padrão já usado em outras
-- tabelas do projeto (ex: ac_set_updated_at).

CREATE OR REPLACE FUNCTION board_tickets_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_board_tickets_updated_at ON board_tickets;
CREATE TRIGGER trg_board_tickets_updated_at
  BEFORE UPDATE ON board_tickets
  FOR EACH ROW EXECUTE FUNCTION board_tickets_set_updated_at();
