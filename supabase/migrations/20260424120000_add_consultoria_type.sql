-- Adicionar tipo 'consultoria' às solicitações de TI
-- Migration para adicionar terceira opção de tipo de solicitação

-- Remover constraint existente
ALTER TABLE it_requests
DROP CONSTRAINT IF EXISTS it_requests_request_type_check;

-- Adicionar nova constraint com 'consultoria'
ALTER TABLE it_requests
ADD CONSTRAINT it_requests_request_type_check
CHECK (request_type IN ('suporte', 'desenvolvimento', 'consultoria'));
