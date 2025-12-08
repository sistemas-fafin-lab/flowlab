-- Adiciona coluna para armazenar URL do anexo na solicitação de pagamento
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS attachment_url text NULL;

-- Adiciona coluna para armazenar o nome original do arquivo
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS attachment_name text NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.payment_requests.attachment_url IS 'URL do anexo (PDF ou imagem) da solicitação de pagamento';
COMMENT ON COLUMN public.payment_requests.attachment_name IS 'Nome original do arquivo anexado';

-- Criar bucket no storage para os anexos (executar manualmente no Supabase Dashboard ou via API)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('payment-attachments', 'payment-attachments', true);

-- Política para permitir upload de arquivos autenticados
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'payment-attachments');

-- Política para permitir leitura pública dos arquivos
-- CREATE POLICY "Allow public read" ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'payment-attachments');
