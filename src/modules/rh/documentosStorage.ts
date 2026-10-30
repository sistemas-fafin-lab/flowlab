// src/modules/rh/documentosStorage.ts
// Bucket privado dos documentos assinados (rh-documentos-assinados). Mesmo
// padrão de holeritesStorage.ts: path "<colaborador_id>/<uuid>.pdf", acesso
// só por signed URL de curta duração.

import { supabase } from '../../lib/supabase';

export const BUCKET_DOCUMENTOS = 'colaborador-documentos';

export async function enviarArquivoDocumento(colaboradorId: string, arquivo: File): Promise<{ path: string | null; erro: string | null }> {
  const path = `${colaboradorId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(path, arquivo, { contentType: 'application/pdf', upsert: false });
  if (error) {
    console.error('Erro ao enviar documento para o storage:', error);
    return { path: null, erro: error.message };
  }
  return { path, erro: null };
}

export async function removerArquivoDocumento(path: string): Promise<string | null> {
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([path]);
  if (error) {
    console.error('Erro ao remover documento do storage:', error);
    return error.message;
  }
  return null;
}

/** Signed URL de 60s; `download: true` força o download. */
export async function gerarSignedUrlDocumento(arquivoPath: string, download = false): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(arquivoPath, 60, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar signed URL do documento:', error);
    return null;
  }
  return data.signedUrl;
}
