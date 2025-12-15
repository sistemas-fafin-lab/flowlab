-- Adiciona coluna para armazenar URL do anexo na solicitação de compra/material
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS attachment_url text NULL;

-- Adiciona coluna para armazenar o nome original do arquivo
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS attachment_name text NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.requests.attachment_url IS 'URL do anexo (PDF ou imagem) da solicitação de compra/material';
COMMENT ON COLUMN public.requests.attachment_name IS 'Nome original do arquivo anexado';

-- IMPORTANTE: Execute os comandos abaixo no Dashboard do Supabase em Storage > Policies
-- ou através da API SQL do Supabase para criar o bucket e as políticas

-- Passo 1: Criar bucket no storage (execute no SQL Editor do Supabase)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('request-attachments', 'request-attachments', true)
-- ON CONFLICT (id) DO NOTHING;

-- Passo 2: Criar políticas (execute cada uma separadamente no SQL Editor)
-- DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'request-attachments');

-- DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
-- CREATE POLICY "Allow public read" ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'request-attachments');

-- DROP POLICY IF EXISTS "Allow delete own files" ON storage.objects;
-- CREATE POLICY "Allow delete own files" ON storage.objects
-- FOR DELETE TO authenticated
-- USING (bucket_id = 'request-attachments');
