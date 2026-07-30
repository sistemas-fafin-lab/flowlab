-- ============================================================
-- Migration: Central de Notificações In-App
-- Descrição: Cria a tabela user_notifications com RLS e Realtime
-- Data: 2026-04-24
-- ============================================================


-- ============================================================
-- STEP 1: Criar tabela user_notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID                     NOT NULL
                REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title       VARCHAR(255)             NOT NULL,
  content     TEXT                     NOT NULL,
  module      VARCHAR(50)              NOT NULL,            -- 'IT' | 'PURCHASING' | 'SYSTEM' etc.
  type        VARCHAR(50)              NOT NULL DEFAULT 'info', -- 'info' | 'success' | 'warning' | 'error'
  link        VARCHAR(255),                                 -- rota de redirecionamento, ex: /dashboard/it/123
  is_read     BOOLEAN                  NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id
  ON public.user_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications(user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at
  ON public.user_notifications(user_id, created_at DESC);

COMMENT ON TABLE  public.user_notifications              IS 'Central de notificações in-app por usuário';
COMMENT ON COLUMN public.user_notifications.user_id      IS 'Destinatário da notificação';
COMMENT ON COLUMN public.user_notifications.module       IS 'Módulo de origem: IT, PURCHASING, SYSTEM, etc.';
COMMENT ON COLUMN public.user_notifications.type         IS 'Nível visual: info | success | warning | error';
COMMENT ON COLUMN public.user_notifications.link         IS 'Rota opcional para redirecionar ao clicar';
COMMENT ON COLUMN public.user_notifications.is_read      IS 'false = não lida (exibe badge no sino)';


-- ============================================================
-- STEP 2: Habilitar Row Level Security
-- ============================================================

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 3: Políticas de segurança (RLS)
-- ============================================================

-- SELECT: cada usuário lê apenas as suas próprias notificações
CREATE POLICY "user_notifications_select_own"
  ON public.user_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- UPDATE: cada usuário atualiza apenas as suas próprias notificações
-- (necessário para "marcar como lida")
CREATE POLICY "user_notifications_update_own"
  ON public.user_notifications
  FOR UPDATE
  TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: qualquer usuário autenticado pode inserir
-- (permite que ações de um usuário notifiquem outro)
CREATE POLICY "user_notifications_insert_authenticated"
  ON public.user_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: cada usuário remove apenas as suas próprias notificações
CREATE POLICY "user_notifications_delete_own"
  ON public.user_notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- STEP 4: Ativar Supabase Realtime (WebSockets)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;
