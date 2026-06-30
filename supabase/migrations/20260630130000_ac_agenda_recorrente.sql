-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — Agenda recorrente (substitui os slots avulsos)
-- Migration: 20260630130000_ac_agenda_recorrente.sql
--
-- Modelo novo do agendamento:
--   • ac_horarios_padrao  — horários fixos por posto, válidos de SEG a SÁB
--     (domingo nunca tem agenda, salvo exceção que abra o dia).
--   • ac_dias_excecao     — sobreposição por DATA: fecha o dia (feriado) ou define
--     uma lista de horários só para aquele dia.
--
-- O get-disponibilidade passa a GERAR a agenda dos próximos N dias a partir dessa
-- base (aplicando exceções e descontando os agendamentos já feitos), então a tabela
-- de slots avulsos não é mais necessária.
--
-- Capacidade: cada horário tem capacidade (default 1 = um paciente por horário);
-- pode ser elevada quando o posto atende mais de um em paralelo.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Remove o modelo antigo de slots avulsos ──────────────────────────────────
DROP TABLE IF EXISTS ac_slots_disponiveis CASCADE;

-- ─── Função de updated_at compartilhada do módulo ─────────────────────────────
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── ac_horarios_padrao (base recorrente seg–sáb) ─────────────────────────────
CREATE TABLE IF NOT EXISTS ac_horarios_padrao (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id    UUID        NOT NULL REFERENCES ac_postos(id) ON DELETE CASCADE,
  hora        TIME        NOT NULL,
  capacidade  INTEGER     NOT NULL DEFAULT 1 CHECK (capacidade >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Um horário por posto: evita duplicatas e dá idempotência ao seed.
  CONSTRAINT uq_ac_horarios_padrao UNIQUE (posto_id, hora)
);

CREATE INDEX IF NOT EXISTS idx_ac_horarios_padrao_posto
  ON ac_horarios_padrao(posto_id);

-- ─── ac_dias_excecao (sobreposição por data) ──────────────────────────────────
-- fechado = TRUE  → posto fechado nesse dia (ignora a base).
-- fechado = FALSE → usa `horarios` (jsonb [{ "hora": "HH:MM", "capacidade": n }])
--                   no lugar da base; lista vazia também fecha o dia na prática.
CREATE TABLE IF NOT EXISTS ac_dias_excecao (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id    UUID        NOT NULL REFERENCES ac_postos(id) ON DELETE CASCADE,
  data        DATE        NOT NULL,
  fechado     BOOLEAN     NOT NULL DEFAULT FALSE,
  horarios    JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ac_dias_excecao UNIQUE (posto_id, data)
);

CREATE INDEX IF NOT EXISTS idx_ac_dias_excecao_posto_data
  ON ac_dias_excecao(posto_id, data);

DROP TRIGGER IF EXISTS trg_ac_dias_excecao_updated_at ON ac_dias_excecao;
CREATE TRIGGER trg_ac_dias_excecao_updated_at
  BEFORE UPDATE ON ac_dias_excecao
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row Level Security — SELECT p/ autenticados; mutação p/ admin/operator.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE ac_horarios_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_dias_excecao    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_horarios_padrao_select_all" ON ac_horarios_padrao;
CREATE POLICY "ac_horarios_padrao_select_all"
  ON ac_horarios_padrao FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_horarios_padrao_mutate_staff" ON ac_horarios_padrao;
CREATE POLICY "ac_horarios_padrao_mutate_staff"
  ON ac_horarios_padrao FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
  );

DROP POLICY IF EXISTS "ac_dias_excecao_select_all" ON ac_dias_excecao;
CREATE POLICY "ac_dias_excecao_select_all"
  ON ac_dias_excecao FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_dias_excecao_mutate_staff" ON ac_dias_excecao;
CREATE POLICY "ac_dias_excecao_mutate_staff"
  ON ac_dias_excecao FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed — horários base para os postos demo (08:00 / 09:00 / 10:00, capacidade 1).
-- UUIDs fixos vêm do seed de ac_postos (20260629120000_ac_integracao_labhub.sql).
-- ═══════════════════════════════════════════════════════════════════════════════
-- Seleciona de ac_postos (não de VALUES) para não violar a FK caso o posto demo
-- não exista (integração não aplicada ou posto removido) — aí simplesmente não insere.
INSERT INTO ac_horarios_padrao (posto_id, hora, capacidade)
SELECT p.id, h.hora::time, 1
FROM ac_postos p
CROSS JOIN (VALUES ('08:00'), ('09:00'), ('10:00')) AS h(hora)
WHERE p.id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
)
ON CONFLICT (posto_id, hora) DO NOTHING;
