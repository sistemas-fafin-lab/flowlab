-- =====================================================
-- REMOÇÃO DO SISTEMA DE NOTIFICAÇÕES POR E-MAIL
-- Esta migração remove todas as estruturas criadas para
-- notificação por e-mail do chat
-- =====================================================

-- Remover trigger
DROP TRIGGER IF EXISTS trigger_chat_email_notification ON request_messages;

-- Remover funções
DROP FUNCTION IF EXISTS queue_chat_email_notification();
DROP FUNCTION IF EXISTS get_chat_participants(text, uuid);

-- Remover tabelas (isso também remove as políticas RLS associadas)
DROP TABLE IF EXISTS public.email_notification_queue;
DROP TABLE IF EXISTS public.notification_preferences;
