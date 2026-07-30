# Configuração do Storage para Anexos de Solicitações

## Problema
Se você está recebendo o erro "Falha ao fazer upload do anexo", é porque o bucket `request-attachments` ainda não foi criado no Supabase Storage.

## Solução - Configurar Manualmente no Dashboard do Supabase

### Passo 1: Criar o Bucket

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **Storage**
4. Clique no botão **"New bucket"** ou **"Create a new bucket"**
5. Configure o bucket:
   - **Name**: `request-attachments`
   - **Public bucket**: ✅ Marque esta opção (permite acesso público aos arquivos)
   - **Allowed MIME types**: Deixe vazio ou adicione: `application/pdf, image/png, image/jpeg`
   - **File size limit**: `10485760` (10MB em bytes)
6. Clique em **"Create bucket"**

### Passo 2: Configurar Políticas de Acesso

Ainda na página de Storage:

1. Clique no bucket `request-attachments` que você criou
2. Clique na aba **"Policies"**
3. Clique em **"New Policy"** e crie as seguintes políticas:

#### Política 1: Permitir Upload (Autenticados)
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'request-attachments');
```

#### Política 2: Permitir Leitura Pública
```sql
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'request-attachments');
```

#### Política 3: Permitir Deletar Próprios Arquivos
```sql
CREATE POLICY "Allow delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'request-attachments');
```

### Alternativa: Usar SQL Editor

Se preferir, você pode executar tudo de uma vez no **SQL Editor**:

1. No menu lateral do Supabase, clique em **SQL Editor**
2. Clique em **"New Query"**
3. Cole e execute o seguinte SQL:

```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('request-attachments', 'request-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Política 1: Upload autenticado
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'request-attachments');

-- Política 2: Leitura pública
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'request-attachments');

-- Política 3: Deletar próprios arquivos
CREATE POLICY "Allow delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'request-attachments');
```

4. Clique em **"Run"**

## Verificação

Após configurar:

1. Volte para **Storage** no menu lateral
2. Você deve ver o bucket `request-attachments` listado
3. Tente criar uma nova solicitação com anexo no sistema
4. O upload deve funcionar normalmente

## Observações

- O bucket precisa ser **público** (`public: true`) para que as imagens possam ser visualizadas diretamente no navegador
- As políticas garantem que:
  - ✅ Usuários autenticados podem fazer upload
  - ✅ Qualquer pessoa pode visualizar os arquivos (necessário para o modal de visualização)
  - ✅ Usuários autenticados podem deletar seus próprios arquivos
- Arquivos aceitos: PDF, PNG, JPEG (máximo 10MB)

## Problemas Comuns

### "Bucket not found"
- Verifique se o nome do bucket está correto: `request-attachments` (sem espaços, tudo minúsculo)
- Certifique-se de que criou o bucket no projeto correto

### "Access denied" ou "Unauthorized"
- Verifique se as políticas foram criadas corretamente
- Certifique-se de que o usuário está autenticado no sistema

### Arquivos não aparecem
- Verifique se o bucket está marcado como **público**
- Verifique se a política de leitura pública está ativa
