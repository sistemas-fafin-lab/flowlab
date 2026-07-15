-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — Agenda por grade (início/fim/intervalo + dias da semana)
-- Migration: 20260714120000_ac_agenda_grade_horarios.sql
--
-- Substitui o modelo de horários avulsos (ac_horarios_padrao, um HH:MM por linha,
-- válido seg–sáb fixo) por uma GRADE configurada no próprio posto:
--   • agenda_hora_inicio / agenda_hora_fim / agenda_intervalo_min  — a janela e o
--     passo (ex.: 08:00–11:00 a cada 15 min) que GERA os horários automaticamente;
--   • agenda_dias_semana  — em quais dias (0=dom … 6=sáb) o posto opera.
-- Capacidade some do modelo: cada horário atende 1 paciente.
--
-- ac_dias_excecao deixa de ter "horário especial por dia" e vira lista pura de
-- DATAS BLOQUEADAS (feriados): cada linha bloqueia os agendamentos daquela data.
--
-- O get-disponibilidade passa a gerar a agenda a partir dessa grade (aplicando as
-- datas bloqueadas e descontando os agendamentos já feitos). Contrato com o LAB-HUB
-- (slots: string[]) não muda.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Grade de agenda no próprio posto (1:1) ───────────────────────────────────
-- Colunas nullable = agenda ainda não configurada. A RLS de UPDATE de ac_postos
-- (20260630120000) já cobre admin/operator; nenhuma policy nova é necessária.
ALTER TABLE ac_postos
  ADD COLUMN IF NOT EXISTS agenda_hora_inicio   TIME,
  ADD COLUMN IF NOT EXISTS agenda_hora_fim      TIME,
  ADD COLUMN IF NOT EXISTS agenda_intervalo_min INTEGER,
  ADD COLUMN IF NOT EXISTS agenda_dias_semana   SMALLINT[] NOT NULL DEFAULT '{}';

-- Intervalo, quando definido, precisa ser positivo.
ALTER TABLE ac_postos
  DROP CONSTRAINT IF EXISTS ck_ac_postos_agenda_intervalo;
ALTER TABLE ac_postos
  ADD CONSTRAINT ck_ac_postos_agenda_intervalo
  CHECK (agenda_intervalo_min IS NULL OR agenda_intervalo_min > 0);

-- ─── Remove o modelo de horários avulsos ──────────────────────────────────────
DROP TABLE IF EXISTS ac_horarios_padrao CASCADE;

-- ─── ac_dias_excecao vira lista de DATAS BLOQUEADAS ───────────────────────────
-- Linhas de "horário especial" (fechado = false) não descrevem um bloqueio — some,
-- para não virarem bloqueio indevido ao dropar a coluna. (Dados são só de demo/dev.)
DELETE FROM ac_dias_excecao WHERE fechado = FALSE;

ALTER TABLE ac_dias_excecao
  DROP COLUMN IF EXISTS fechado,
  DROP COLUMN IF EXISTS horarios;
-- Sobra (id, posto_id, data, created_at) com UNIQUE(posto_id, data): cada linha
-- bloqueia uma data do posto.

-- ─── Seed — grade padrão para os postos demo ──────────────────────────────────
-- 08:00–11:00 a cada 15 min, seg–sex ({1,2,3,4,5}). UUIDs fixos vêm do seed de
-- ac_postos (20260629120000_ac_integracao_labhub.sql); se o posto não existir,
-- o UPDATE simplesmente não afeta linhas.
UPDATE ac_postos
SET agenda_hora_inicio   = '08:00',
    agenda_hora_fim      = '11:00',
    agenda_intervalo_min = 15,
    agenda_dias_semana   = '{1,2,3,4,5}'
WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
