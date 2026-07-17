-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix: policies de ac_postos usando custom_roles (canManageAnalisesClinicas)
-- Migration: 20260717120000_fix_ac_postos_rls_custom_roles.sql
--
-- As policies de mutação de ac_postos (20260630120000) checavam
-- user_profiles.role IN ('admin', 'operator'), mas o sistema usa
-- custom_roles.permissions. Sem a role legada, o UPDATE afetava 0 linhas
-- sem erro — a UI mostrava "Agenda salva" mas nada persistia.
--
-- Esta migration substitui as policies por versões que usam
-- current_user_has_permission('canManageAnalisesClinicas'), com fallback
-- automático para admin legado (role = 'admin').
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── ac_postos — INSERT ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_insert_staff" ON ac_postos;
CREATE POLICY "ac_postos_insert_staff"
  ON ac_postos FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageAnalisesClinicas'));

-- ─── ac_postos — UPDATE ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_update_staff" ON ac_postos;
CREATE POLICY "ac_postos_update_staff"
  ON ac_postos FOR UPDATE
  TO authenticated
  USING (public.current_user_has_permission('canManageAnalisesClinicas'))
  WITH CHECK (public.current_user_has_permission('canManageAnalisesClinicas'));

-- ─── ac_postos — DELETE ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ac_postos_delete_staff" ON ac_postos;
CREATE POLICY "ac_postos_delete_staff"
  ON ac_postos FOR DELETE
  TO authenticated
  USING (public.current_user_has_permission('canManageAnalisesClinicas'));
