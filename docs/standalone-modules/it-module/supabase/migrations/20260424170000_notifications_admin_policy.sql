-- ============================================================
-- Migration: Admin bypass para user_notifications
-- Descrição: Permite que admins e desenvolvedores vejam todas
--            as notificações (necessário para o painel de logs).
-- Data: 2026-04-24
-- ============================================================

-- Política de leitura para admins/desenvolvedores
-- (a política existente user_notifications_select cobre os utilizadores comuns)
DROP POLICY IF EXISTS "user_notifications_admin_select" ON public.user_notifications;

CREATE POLICY "user_notifications_admin_select"
  ON public.user_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.role = 'admin'
          OR EXISTS (
            SELECT 1 FROM public.custom_roles cr
            WHERE cr.id = up.custom_role_id
              AND cr.name = 'Desenvolvedor'
          )
        )
    )
  );
