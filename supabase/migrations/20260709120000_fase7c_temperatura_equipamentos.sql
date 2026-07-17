-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Etapa C: Temperatura e Equipamentos
--
-- Monitoramento de temperatura de equipamentos do laboratório (geladeiras,
-- freezers, estufas...) com faixa aceitável por equipamento e alerta de leitura
-- fora da faixa. Independente do fluxo coleta→análise (NÃO toca ac_agendamentos).
--
--   • ac_equipamentos — o equipamento + a faixa [temp_min, temp_max] aceitável
--   • ac_temperaturas — o log de leituras (append-only); `fora_faixa` é derivado
--                       por trigger contra a faixa vigente do equipamento no
--                       momento da leitura (snapshot para alerta/histórico).
--
-- RLS permissiva por `authenticated` (o gate real é o frontend — canManageColetas),
-- consistente com ac_coletas/ac_checkins (Fase 6). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Função de updated_at compartilhada do módulo (idempotente; já existe na Fase 6).
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. ac_equipamentos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_equipamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT 'geladeira'
              CHECK (tipo IN ('geladeira','freezer','estufa','incubadora','banho_maria','ambiente','outro')),
  localizacao text,
  temp_min    numeric(5,2) NOT NULL,
  temp_max    numeric(5,2) NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_equip_faixa CHECK (temp_min < temp_max)
);

DROP TRIGGER IF EXISTS trg_ac_equipamentos_updated_at ON ac_equipamentos;
CREATE TRIGGER trg_ac_equipamentos_updated_at
  BEFORE UPDATE ON ac_equipamentos
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── 2. ac_temperaturas (log append-only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_temperaturas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES ac_equipamentos(id) ON DELETE CASCADE,
  temperatura    numeric(5,2) NOT NULL,
  fora_faixa     boolean NOT NULL DEFAULT false,  -- derivado no trigger (§3)
  registrado_por text NOT NULL,
  observacao     text,
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_temperaturas_equip ON ac_temperaturas(equipamento_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ac_temperaturas_fora  ON ac_temperaturas(equipamento_id) WHERE fora_faixa;

-- ─── 3. Trigger: deriva fora_faixa contra a faixa do equipamento ─────────────
--   Snapshot: grava se a leitura estava fora no momento; mudar a faixa depois não
--   reescreve o histórico. Barra leitura para equipamento inexistente.
CREATE OR REPLACE FUNCTION ac_temperatura_set_fora_faixa()
RETURNS TRIGGER AS $$
DECLARE v_min numeric; v_max numeric;
BEGIN
  SELECT temp_min, temp_max INTO v_min, v_max
    FROM ac_equipamentos WHERE id = NEW.equipamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipamento % não encontrado', NEW.equipamento_id;
  END IF;
  NEW.fora_faixa := (NEW.temperatura < v_min OR NEW.temperatura > v_max);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_temperatura_fora_faixa ON ac_temperaturas;
CREATE TRIGGER trg_ac_temperatura_fora_faixa
  BEFORE INSERT OR UPDATE OF temperatura, equipamento_id ON ac_temperaturas
  FOR EACH ROW EXECUTE FUNCTION ac_temperatura_set_fora_faixa();

-- ─── 4. RLS — permissiva por authenticated (gate real = frontend) ────────────
ALTER TABLE ac_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_temperaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_equipamentos_select_all"  ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_insert_auth" ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_update_auth" ON ac_equipamentos;
DROP POLICY IF EXISTS "ac_equipamentos_delete_auth" ON ac_equipamentos;
CREATE POLICY "ac_equipamentos_select_all"  ON ac_equipamentos FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_equipamentos_insert_auth" ON ac_equipamentos FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_equipamentos_update_auth" ON ac_equipamentos FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_equipamentos_delete_auth" ON ac_equipamentos FOR DELETE TO authenticated USING (TRUE);

-- Leituras são um log append-only: só SELECT + INSERT (sem UPDATE/DELETE).
DROP POLICY IF EXISTS "ac_temperaturas_select_all"  ON ac_temperaturas;
DROP POLICY IF EXISTS "ac_temperaturas_insert_auth" ON ac_temperaturas;
CREATE POLICY "ac_temperaturas_select_all"  ON ac_temperaturas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_temperaturas_insert_auth" ON ac_temperaturas FOR INSERT TO authenticated WITH CHECK (TRUE);
