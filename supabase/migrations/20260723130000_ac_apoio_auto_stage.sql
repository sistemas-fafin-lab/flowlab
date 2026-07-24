-- ═══════════════════════════════════════════════════════════════════════════════
-- Envio ao Álvaro — enfileiramento automático a partir do agendamento
--
-- Quando um agendamento chega do LAB-HUB já com o pedido médico anexado, o
-- backend roda o pipeline (OCR/apLIS/BD Lab/XML) e deixa o item pronto na fila
-- (status 'aguardando'), sem ação do operador. O envio real ao Álvaro segue
-- manual e conferido. Esta migration dá o vínculo e o rastreio para isso:
--
--   ac_apoio_fila.agendamento_id  → de qual agendamento veio (NULL = item manual)
--   ac_apoio_fila.origem          → 'manual' | 'automatico' (badge na UI)
--   ac_agendamentos.apoio_status  → estágio do enfileiramento automático, para a
--                                    varredura de recuperação achar pendentes e
--                                    não re-OCR-ar em loop
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + índice IF NOT EXISTS + CHECK via DO.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Vínculo fila → agendamento + origem ──────────────────────────────────────
-- ON DELETE SET NULL: apagar o agendamento não deve derrubar o histórico de envio.
ALTER TABLE ac_apoio_fila
  ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES ac_agendamentos(id) ON DELETE SET NULL;

ALTER TABLE ac_apoio_fila
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

-- CHECK nomeado e idempotente (Postgres não tem ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ac_apoio_fila_origem_check'
  ) THEN
    ALTER TABLE ac_apoio_fila
      ADD CONSTRAINT ac_apoio_fila_origem_check CHECK (origem IN ('manual', 'automatico'));
  END IF;
END $$;

-- Dedup e busca por agendamento (só itens vindos de agendamento).
CREATE INDEX IF NOT EXISTS idx_ac_apoio_fila_agendamento
  ON ac_apoio_fila(agendamento_id) WHERE agendamento_id IS NOT NULL;

-- ─── 2. Estágio do enfileiramento automático no agendamento ──────────────────────
-- NULL      = ainda não avaliado (agendamentos anteriores a esta feature)
-- pendente  = recebido, aguardando o pipeline rodar
-- enfileirado = item criado na fila com sucesso
-- sem_documento = não havia pedido médico (a varredura tenta de novo depois)
-- erro      = o pipeline falhou (visível para reprocessar)
-- ignorado  = agendamento cancelado/bloqueado, fora do fluxo
ALTER TABLE ac_agendamentos
  ADD COLUMN IF NOT EXISTS apoio_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ac_agendamentos_apoio_status_check'
  ) THEN
    ALTER TABLE ac_agendamentos
      ADD CONSTRAINT ac_agendamentos_apoio_status_check
      CHECK (apoio_status IN ('pendente', 'enfileirado', 'sem_documento', 'erro', 'ignorado'));
  END IF;
END $$;

-- Varredura de pendentes filtra por este campo.
CREATE INDEX IF NOT EXISTS idx_ac_agendamentos_apoio_status
  ON ac_agendamentos(apoio_status) WHERE apoio_status IS NOT NULL;
