/*
  # Gerador de Orçamento — bucket temporário da leitura do pedido médico por IA

  Spec: .scratch/gerador-orcamento/spec.md (issue 06). Mesmo fluxo do envio ao apoio
  (bucket 'ac-apoio-requisicoes'): o navegador sobe as fotos/PDFs do pedido direto
  aqui e manda só os paths para POST /api/atendimento/gerador-orcamento-pedido-medico,
  que baixa com service role, chama o Gemini e APAGA os arquivos ao terminar.

  PRIVADO e temporário por desenho: é dado de saúde de paciente. Por isso:
  - limites no próprio bucket: 10MB por arquivo, só imagens e PDF;
  - INSERT só para quem tem canUseGeradorOrcamento, e só na própria pasta
    (`<user id>/...`) — o endpoint também só aceita paths da pasta de quem chama;
  - DELETE só do próprio objeto (owner), para a tela limpar o que já subiu quando
    um upload do lote falha (o caminho normal é o servidor apagar);
  - sem SELECT: ninguém lê pelo navegador; quem baixa é o servidor (service role).

  Idempotente: ON CONFLICT no bucket, DROP POLICY IF EXISTS antes de criar.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'atendimento-pedidos-medicos',
  'atendimento-pedidos-medicos',
  false,
  10485760,
  ARRAY['image/*', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "atendimento_pedidos_medicos_storage_insert" ON storage.objects;
CREATE POLICY "atendimento_pedidos_medicos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'atendimento-pedidos-medicos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.current_user_has_permission('canUseGeradorOrcamento')
);

DROP POLICY IF EXISTS "atendimento_pedidos_medicos_storage_delete_own" ON storage.objects;
CREATE POLICY "atendimento_pedidos_medicos_storage_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'atendimento-pedidos-medicos'
  AND owner_id = auth.uid()::text
  AND public.current_user_has_permission('canUseGeradorOrcamento')
);
