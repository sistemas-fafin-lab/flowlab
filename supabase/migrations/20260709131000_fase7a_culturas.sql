-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa A (frente 2): Seleção de exames no check-in + acompanhamento de culturas
--
-- Fluxo real (o médico coleta; o laboratório recebe/tria/etiqueta/envia e acompanha):
--   • No check-in o funcionário lê o pedido e SELECIONA os exames  → ac_agendamento_exames
--   • Confere validade da amostra e etiqueta                        → ac_coletas (2 colunas)
--   • Cada exame de cultura selecionado vira uma linha de acompanhamento → ac_culturas
--   • A cultura é acompanhada MANUALMENTE (etapa + status), no molde da Temperatura.
--
-- Escrita direta pelo frontend sob RLS permissiva por authenticated (gate = frontend),
-- consistente com Fase 6/7C. A criação a partir do check-in acontece na RPC
-- registrar_coleta (SECURITY DEFINER; migration seguinte), de forma transacional.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. ac_agendamento_exames — exames marcados no check-in (N por agendamento) ──
CREATE TABLE IF NOT EXISTS ac_agendamento_exames (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE CASCADE,
  exame_id       uuid NOT NULL REFERENCES ac_exames(id) ON DELETE RESTRICT,
  exame_nome     text NOT NULL,                    -- snapshot do nome no momento
  is_cultura     boolean NOT NULL DEFAULT false,   -- snapshot (para saber se gerou cultura)
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agendamento_exame UNIQUE (agendamento_id, exame_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_agendamento_exames_ag ON ac_agendamento_exames(agendamento_id);

-- ─── 2. ac_coletas: validade da amostra + etiqueta (checks do check-in) ──────────
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS validade_ok boolean;
ALTER TABLE ac_coletas ADD COLUMN IF NOT EXISTS etiquetado  boolean;

-- ─── 3. ac_cultura_etapas — trilha ordenada (começa mínima, extensível) ──────────
--   O stepper da página desenha a partir daqui; adicionar etapa = inserir uma linha
--   (sem migration de schema). O usuário refina quando conhecer a trilha real.
CREATE TABLE IF NOT EXISTS ac_cultura_etapas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem      integer NOT NULL UNIQUE,
  nome       text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ac_cultura_etapas_updated_at ON ac_cultura_etapas;
CREATE TRIGGER trg_ac_cultura_etapas_updated_at
  BEFORE UPDATE ON ac_cultura_etapas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- Seed genérico mínimo (idempotente por ordem).
INSERT INTO ac_cultura_etapas (ordem, nome) VALUES
  (1, 'Recebida'),
  (2, 'Em análise'),
  (3, 'Pronta p/ laudo')
ON CONFLICT (ordem) DO NOTHING;

-- ─── 4. ac_culturas — uma cultura acompanhada (1 por exame de cultura/agendamento)─
CREATE TABLE IF NOT EXISTS ac_culturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES ac_agendamentos(id) ON DELETE RESTRICT,
  exame_id       uuid REFERENCES ac_exames(id),
  exame_nome     text NOT NULL,                 -- tipo do exame (snapshot): Urocultura…
  paciente_nome  text,                          -- snapshot p/ exibir sem join
  posto_id       uuid,                          -- snapshot (posto do agendamento)
  local_posto    text,                          -- snapshot do nome do posto
  etapa_ordem    integer NOT NULL DEFAULT 1,    -- etapa atual (→ ac_cultura_etapas.ordem)
  status         text NOT NULL DEFAULT 'em_andamento', -- em_andamento|positiva|sem_crescimento|pronta_laudo
  nota           text,                          -- nota livre da etapa atual
  resultado      text,                          -- desfecho/laudo textual (opcional)
  iniciada_em    timestamptz NOT NULL DEFAULT now(),
  prazo_dias     integer NOT NULL DEFAULT 5,    -- prazo padrão (editável)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cultura_agendamento_exame UNIQUE (agendamento_id, exame_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_status ON ac_culturas(status);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_posto  ON ac_culturas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_culturas_inic   ON ac_culturas(iniciada_em DESC);

DROP TRIGGER IF EXISTS trg_ac_culturas_updated_at ON ac_culturas;
CREATE TRIGGER trg_ac_culturas_updated_at
  BEFORE UPDATE ON ac_culturas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── 5. RLS — permissiva por authenticated (gate real = frontend) ────────────────
ALTER TABLE ac_agendamento_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_cultura_etapas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_culturas           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_agendamento_exames_select_all"  ON ac_agendamento_exames;
DROP POLICY IF EXISTS "ac_agendamento_exames_insert_auth" ON ac_agendamento_exames;
DROP POLICY IF EXISTS "ac_agendamento_exames_delete_auth" ON ac_agendamento_exames;
CREATE POLICY "ac_agendamento_exames_select_all"  ON ac_agendamento_exames FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_agendamento_exames_insert_auth" ON ac_agendamento_exames FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_agendamento_exames_delete_auth" ON ac_agendamento_exames FOR DELETE TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_cultura_etapas_select_all"  ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_insert_auth" ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_update_auth" ON ac_cultura_etapas;
DROP POLICY IF EXISTS "ac_cultura_etapas_delete_auth" ON ac_cultura_etapas;
CREATE POLICY "ac_cultura_etapas_select_all"  ON ac_cultura_etapas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_cultura_etapas_insert_auth" ON ac_cultura_etapas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_cultura_etapas_update_auth" ON ac_cultura_etapas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_cultura_etapas_delete_auth" ON ac_cultura_etapas FOR DELETE TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_culturas_select_all"  ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_insert_auth" ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_update_auth" ON ac_culturas;
DROP POLICY IF EXISTS "ac_culturas_delete_auth" ON ac_culturas;
CREATE POLICY "ac_culturas_select_all"  ON ac_culturas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_culturas_insert_auth" ON ac_culturas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_culturas_update_auth" ON ac_culturas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_culturas_delete_auth" ON ac_culturas FOR DELETE TO authenticated USING (TRUE);
