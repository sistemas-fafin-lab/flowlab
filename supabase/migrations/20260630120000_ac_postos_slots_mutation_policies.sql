-- ═══════════════════════════════════════════════════════════════════════════════
-- Análises Clínicas — Policies de mutação de ac_postos (Frente 3 do agendamento)
-- Migration: 20260630120000_ac_postos_slots_mutation_policies.sql
--
-- A migration de integração (20260629120000_ac_integracao_labhub.sql) deixou
-- ac_postos com apenas SELECT para `authenticated` — mutações eram exclusivas da
-- service role. Agora o gerente mantém postos pela UI do FlowLab (PostosPage),
-- então liberamos INSERT/UPDATE/DELETE para admin/operator.
--
-- A agenda de horários deixou de ser slots avulsos (ac_slots_disponiveis) e passou
-- a ser recorrente — ver 20260630130000_ac_agenda_recorrente.sql, que dropa
-- ac_slots_disponiveis e cria as tabelas/policies da nova agenda.
--
-- Espelha o padrão de RLS de it_sprints (20260519130000): checagem em
-- user_profiles pela role do usuário autenticado. SELECT permanece como está.
-- DROP antes de CREATE torna a migration re-executável (sem CREATE POLICY IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_postos ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_insert_staff" ON ac_postos;
CREATE POLICY "ac_postos_insert_staff"
  ON ac_postos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

DROP POLICY IF EXISTS "ac_postos_update_staff" ON ac_postos;
CREATE POLICY "ac_postos_update_staff"
  ON ac_postos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );

DROP POLICY IF EXISTS "ac_postos_delete_admin" ON ac_postos;
DROP POLICY IF EXISTS "ac_postos_delete_staff" ON ac_postos;
CREATE POLICY "ac_postos_delete_staff"
  ON ac_postos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'operator')
    )
  );
