-- Criar bucket para anexos de pagamento (caso não exista)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-attachments', 'payment-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remover políticas antigas se existirem (evita conflito)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_attachments_delete" ON storage.objects;

-- Política: usuários autenticados podem fazer upload no bucket de anexos de pagamento
CREATE POLICY "payment_attachments_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-attachments');

-- Política: leitura pública dos arquivos do bucket de anexos de pagamento
CREATE POLICY "payment_attachments_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment-attachments');

-- Política: usuários autenticados podem deletar arquivos do bucket de anexos de pagamento
CREATE POLICY "payment_attachments_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'payment-attachments');
