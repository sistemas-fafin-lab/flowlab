-- Adiciona campo para rastrear quem leu as mensagens
-- Array de IDs de usuários que visualizaram a mensagem

ALTER TABLE request_messages 
ADD COLUMN IF NOT EXISTS read_by text[] DEFAULT '{}';

-- Índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_request_messages_read_by ON request_messages USING GIN (read_by);

-- Função para marcar mensagem como lida
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id uuid, user_id text)
RETURNS void AS $$
BEGIN
  UPDATE request_messages
  SET read_by = array_append(read_by, user_id)
  WHERE id = message_id 
    AND NOT (user_id = ANY(read_by));
END;
$$ LANGUAGE plpgsql;

-- Função para marcar todas as mensagens de uma solicitação como lidas
CREATE OR REPLACE FUNCTION mark_all_messages_as_read(p_request_id uuid, p_user_id text)
RETURNS void AS $$
BEGIN
  UPDATE request_messages
  SET read_by = array_append(read_by, p_user_id)
  WHERE request_id = p_request_id 
    AND NOT (p_user_id = ANY(read_by))
    AND author_id != p_user_id;
END;
$$ LANGUAGE plpgsql;
