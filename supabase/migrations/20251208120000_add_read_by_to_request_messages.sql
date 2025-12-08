-- Adiciona coluna read_by para rastrear quais usuários leram cada mensagem
ALTER TABLE public.request_messages 
ADD COLUMN IF NOT EXISTS read_by uuid[] DEFAULT '{}';

-- Comentário descritivo
COMMENT ON COLUMN public.request_messages.read_by IS 'Array de IDs de usuários que leram a mensagem';

-- Índice para melhorar performance em queries que filtram por read_by
CREATE INDEX IF NOT EXISTS request_messages_read_by_idx 
ON public.request_messages USING gin (read_by);
