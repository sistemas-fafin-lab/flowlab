-- ═══════════════════════════════════════════════════════════════════════════════
-- IT Task Comments — Ativação do Supabase Realtime (WebSockets)
-- Migration: 20260424150000_it_task_comments_realtime.sql
--
-- CONTEXTO:
--   A tabela it_task_comments e suas políticas RLS já foram criadas em:
--   20260416130000_it_itsm_upgrade.sql
--
--   Esta migration tem um único objetivo: registar a tabela na publicação
--   nativa do Supabase para habilitar WebSockets em tempo real.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Realtime: it_task_comments ───────────────────────────────────────────────
-- Usa um bloco DO para ser idempotente: não falha se a tabela já estiver
-- registada na publicação (ex: em ambientes de staging/produção divergentes).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname   = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'it_task_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.it_task_comments;
  END IF;
END
$$;
