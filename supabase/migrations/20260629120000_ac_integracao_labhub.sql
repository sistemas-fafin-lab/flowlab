-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Análises Clínicas — Fatia de integração com o LAB-HUB
-- Migration: 20260629120000_ac_integracao_labhub.sql
--
-- Cria o conjunto mínimo de tabelas ac_* que as funções de integração do FlowLab
-- precisam para fechar o loop com o LAB-HUB:
--   get-disponibilidade  → lê ac_postos + ac_slots_disponiveis
--   receive-agendamento  → insere em ac_agendamentos (idempotente por labhub_id)
--   deliver-resultado    → lê ac_resultados (+ labhub_id do agendamento)
--
-- O módulo completo (coletas, culturas, temperatura, estoque, dashboard) virá em
-- migrations posteriores — ver docs/PLANO_FLOWLAB_ANALISES_CLINICAS.md.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_postos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_postos (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(120) NOT NULL,
  endereco    TEXT         NOT NULL DEFAULT '',
  ativo       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_ac_postos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_postos_updated_at ON ac_postos;
CREATE TRIGGER trg_ac_postos_updated_at
  BEFORE UPDATE ON ac_postos
  FOR EACH ROW EXECUTE FUNCTION update_ac_postos_updated_at();

-- ─── ac_slots_disponiveis ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_slots_disponiveis (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id    UUID        NOT NULL REFERENCES ac_postos(id) ON DELETE CASCADE,
  data_hora   TIMESTAMPTZ NOT NULL,
  capacidade  INTEGER     NOT NULL DEFAULT 1,
  reservado   INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Um horário por posto: garante idempotência do seed e evita slots duplicados.
  CONSTRAINT uq_ac_slots_posto_data UNIQUE (posto_id, data_hora)
);

CREATE INDEX IF NOT EXISTS idx_ac_slots_posto_data
  ON ac_slots_disponiveis(posto_id, data_hora);

-- ─── ac_agendamentos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_agendamentos (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- id do agendamento no LAB-HUB; único = receive-agendamento é idempotente.
  labhub_id          UUID         NOT NULL UNIQUE,
  paciente_nome      TEXT         NOT NULL,
  paciente_telefone  TEXT,
  posto_id           UUID         REFERENCES ac_postos(id) ON DELETE SET NULL,
  local_posto        TEXT         NOT NULL DEFAULT '',  -- snapshot do nome do posto
  data_hora          TIMESTAMPTZ  NOT NULL,
  status             TEXT         NOT NULL DEFAULT 'recebido',
  recebido_em        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ac_agendamentos_data_posto
  ON ac_agendamentos(data_hora, local_posto);

CREATE OR REPLACE FUNCTION update_ac_agendamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_agendamentos_updated_at ON ac_agendamentos;
CREATE TRIGGER trg_ac_agendamentos_updated_at
  BEFORE UPDATE ON ac_agendamentos
  FOR EACH ROW EXECUTE FUNCTION update_ac_agendamentos_updated_at();

-- ─── ac_resultados ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ac_resultados (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id      UUID        NOT NULL REFERENCES ac_agendamentos(id) ON DELETE CASCADE,
  exame_nome          TEXT        NOT NULL,
  categoria           TEXT,
  resumo              TEXT,
  paineis             JSONB       NOT NULL DEFAULT '[]',  -- [{nome,valor,unidade,ref,ok,trend[]}] (D1)
  laudo_url           TEXT,
  declaracao_url      TEXT,
  liberado_por        TEXT,
  liberado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entregue_ao_labhub  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ac_resultados_agendamento
  ON ac_resultados(agendamento_id);

CREATE OR REPLACE FUNCTION update_ac_resultados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ac_resultados_updated_at ON ac_resultados;
CREATE TRIGGER trg_ac_resultados_updated_at
  BEFORE UPDATE ON ac_resultados
  FOR EACH ROW EXECUTE FUNCTION update_ac_resultados_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- As funções Vercel de integração usam a service role (bypassa RLS). As policies
-- abaixo permitem leitura por usuários autenticados do app FlowLab; mutações
-- ficam restritas à service role até o módulo completo trazer suas permissões.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE ac_postos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_slots_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_agendamentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_resultados        ENABLE ROW LEVEL SECURITY;

-- DROP antes de CREATE: Postgres não tem CREATE POLICY IF NOT EXISTS, então
-- isto torna a migration re-executável sem erro de "policy já existe".
DROP POLICY IF EXISTS "ac_postos_select_all" ON ac_postos;
CREATE POLICY "ac_postos_select_all"
  ON ac_postos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_slots_select_all" ON ac_slots_disponiveis;
CREATE POLICY "ac_slots_select_all"
  ON ac_slots_disponiveis FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_agendamentos_select_all" ON ac_agendamentos;
CREATE POLICY "ac_agendamentos_select_all"
  ON ac_agendamentos FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ac_resultados_select_all" ON ac_resultados;
CREATE POLICY "ac_resultados_select_all"
  ON ac_resultados FOR SELECT TO authenticated USING (TRUE);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed — postos + slots futuros, para o SchedulePage do LAB-HUB ter o que listar.
-- UUIDs fixos nos postos tornam o seed idempotente e os ids estáveis em testes.
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO ac_postos (id, nome, endereco) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Unidade Centro',  'Rua Central, 100 - Centro'),
  ('22222222-2222-4222-8222-222222222222', 'Unidade Asa Sul', 'SGAS 910, Bloco C - Asa Sul')
ON CONFLICT (id) DO NOTHING;

-- 3 dias × 3 horários (08h/09h/10h) por posto, a partir de amanhã.
-- generate_series(1,3) gera os dias; unnest(array[8,9,10]) as horas; make_interval
-- monta o deslocamento (generate_series não aceita argumentos do tipo interval).
INSERT INTO ac_slots_disponiveis (posto_id, data_hora, capacidade)
SELECT p.id,
       date_trunc('day', NOW()) + make_interval(days => dia, hours => hora) AS data_hora,
       3
FROM ac_postos p
CROSS JOIN generate_series(1, 3) AS dia
CROSS JOIN unnest(ARRAY[8, 9, 10]) AS hora
WHERE p.id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
)
ON CONFLICT (posto_id, data_hora) DO NOTHING;
