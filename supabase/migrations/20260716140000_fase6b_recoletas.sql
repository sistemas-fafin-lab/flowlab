-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 6 — Etapa B: Recoletas (acompanhamento manual)
--
-- Fluxo real (a análise é EXTERNA — laboratório de apoio): quando o apoio/QC sinaliza
-- que uma amostra está inviável (hemólise, quantidade insuficiente, coagulada…), o
-- laboratório registra uma RECOLETA à mão e acompanha por status até o paciente
-- retornar. A nova coleta em si entra pelo fluxo normal (novo agendamento) — a recoleta
-- NÃO altera o agendamento/coleta original, então não há gatilho automático nem toque
-- em ac_agendamentos (evita conflito com os UNIQUE(agendamento_id) de ac_checkins/
-- ac_coletas e com o trigger de notificação do LAB-HUB).
--
-- Molde: ac_culturas (Fase 7A) — tabela única, acompanhamento manual, escrita direta
-- pelo frontend sob RLS permissiva por authenticated (gate = frontend + canManageColetas).
-- Sem RPC. Idempotente.
--
-- Rastreabilidade opcional (ambos NULL numa avulsa "pura"): coleta_id aponta para a coleta
-- cuja amostra ficou inviável; origem_recoleta_id encadeia a "recoleta da recoleta" (quando a
-- própria amostra recoletada também falha) — auto-referência, permitindo contar a tentativa.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Função de updated_at compartilhada do módulo (idempotente; já existe desde a Fase 3).
CREATE OR REPLACE FUNCTION ac_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── ac_recoletas — uma recoleta acompanhada (avulsa por padrão) ─────────────────
CREATE TABLE IF NOT EXISTS ac_recoletas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES ac_agendamentos(id) ON DELETE RESTRICT, -- NULL = avulsa
  -- Origem opcional da recoleta (ambos NULL numa avulsa "pura"):
  coleta_id          uuid REFERENCES ac_coletas(id) ON DELETE SET NULL,   -- coleta cuja amostra ficou inviável (se conhecida)
  origem_recoleta_id uuid REFERENCES ac_recoletas(id) ON DELETE SET NULL, -- recoleta anterior (a "recoleta da recoleta")
  exame_nome     text,                          -- exame/material a recoletar (snapshot, opcional)
  paciente_nome  text,                          -- snapshot p/ exibir sem join
  posto_id       uuid REFERENCES ac_postos(id), -- snapshot (posto de origem)
  local_posto    text,                          -- snapshot do nome do posto
  motivo         text NOT NULL CHECK (motivo IN (
                   'hemolise','insuficiente','coagulada','extraviada',
                   'contaminada','identificacao','outro')),
  motivo_detalhe text,                          -- texto livre (obrigatório na UI quando motivo='outro')
  status         text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','concluida','cancelada')),
  nota           text,                          -- observação livre
  prazo_dias     integer NOT NULL DEFAULT 7,    -- prazo p/ a nova coleta (editável)
  solicitado_por text NOT NULL,                 -- nome do usuário que registrou
  solicitada_em  timestamptz NOT NULL DEFAULT now(),
  resolvida_em   timestamptz,                   -- carimbo ao concluir/cancelar
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_status     ON ac_recoletas(status);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_solicitada ON ac_recoletas(solicitada_em DESC);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_posto      ON ac_recoletas(posto_id);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_coleta     ON ac_recoletas(coleta_id);
CREATE INDEX IF NOT EXISTS idx_ac_recoletas_origem     ON ac_recoletas(origem_recoleta_id);

DROP TRIGGER IF EXISTS trg_ac_recoletas_updated_at ON ac_recoletas;
CREATE TRIGGER trg_ac_recoletas_updated_at
  BEFORE UPDATE ON ac_recoletas
  FOR EACH ROW EXECUTE FUNCTION ac_set_updated_at();

-- ─── RLS — permissiva por authenticated (gate real = frontend) ───────────────────
ALTER TABLE ac_recoletas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_recoletas_select_all"  ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_insert_auth" ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_update_auth" ON ac_recoletas;
DROP POLICY IF EXISTS "ac_recoletas_delete_auth" ON ac_recoletas;
CREATE POLICY "ac_recoletas_select_all"  ON ac_recoletas FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "ac_recoletas_insert_auth" ON ac_recoletas FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "ac_recoletas_update_auth" ON ac_recoletas FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "ac_recoletas_delete_auth" ON ac_recoletas FOR DELETE TO authenticated USING (TRUE);
