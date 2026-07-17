-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 8 — Laudos (acompanhamento manual por agendamento)
--
-- Cada agendamento pode ter no máximo 1 laudo (1:1). O laudo é criado manualmente
-- e acompanha a liberação dos exames: status (aguarda / parcial / completo) + contagem
-- de exames concluídos vs. total. O total pode ser preenchido automaticamente a partir
-- dos exames marcados no check-in (ac_agendamento_exames), mas a contagem de concluídos
-- é atualizada manualmente pelo operador.
--
-- Molde: ac_culturas / ac_recoletas — tabela única, acompanhamento manual, escrita
-- direta pelo frontend sob RLS permissiva por authenticated (gate = frontend).
-- Sem RPC. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_laudos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_laudos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id    uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'aguarda_liberacao'
                      CHECK (status IN ('aguarda_liberacao','laudo_parcial_liberado','laudo_completo_liberado')),
  exames_concluidos integer NOT NULL DEFAULT 0,
  exames_total      integer NOT NULL DEFAULT 0,
  nota              text,
  criado_por        text NOT NULL,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  liberado_em       timestamptz,
  UNIQUE (agendamento_id)  -- 1 laudo por agendamento
);

CREATE INDEX IF NOT EXISTS idx_ac_laudos_status         ON ac_laudos(status);
CREATE INDEX IF NOT EXISTS idx_ac_laudos_agendamento    ON ac_laudos(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_ac_laudos_criado_em      ON ac_laudos(criado_em DESC);

DROP TRIGGER IF EXISTS trg_ac_laudos_updated_at ON ac_laudos;
CREATE TRIGGER trg_ac_laudos_updated_at
  BEFORE UPDATE ON ac_laudos
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── RLS — permissiva por authenticated (gate real = frontend) ───────────────────
ALTER TABLE ac_laudos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_laudos_select_all"  ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_insert_auth" ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_update_auth" ON ac_laudos;
DROP POLICY IF EXISTS "ac_laudos_delete_auth" ON ac_laudos;
CREATE POLICY "ac_laudos_select_all"  ON ac_laudos FOR SELECT  TO authenticated USING (TRUE);
CREATE POLICY "ac_laudos_insert_auth" ON ac_laudos FOR INSERT  TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_laudos_update_auth" ON ac_laudos FOR UPDATE  TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_laudos_delete_auth" ON ac_laudos FOR DELETE  TO authenticated USING (TRUE);
