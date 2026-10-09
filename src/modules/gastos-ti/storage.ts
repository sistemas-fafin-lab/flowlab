// Ponto único do bucket privado de anexos do módulo (padrão de rh/holeritesStorage.ts).

import { supabase } from '../../lib/supabase';
import { caminhoAnexo, validarArquivo } from './domain/anexos';
import type { Anexo } from './types';

export const BUCKET_ANEXOS_TI = 'ti-gastos-anexos';

/**
 * Envia os arquivos válidos para "<prefixo>/<registroId>/...". Devolve o que
 * subiu (para gravar no jsonb `anexos`) e as mensagens do que não subiu — um
 * arquivo ruim não impede os outros.
 */
export async function enviarArquivos(
  prefixo: 'despesas' | 'lancamentos',
  registroId: string,
  arquivos: File[],
): Promise<{ enviados: Anexo[]; erros: string[] }> {
  const enviados: Anexo[] = [];
  const erros: string[] = [];
  for (const arquivo of arquivos) {
    const invalido = validarArquivo(arquivo);
    if (invalido) {
      erros.push(invalido);
      continue;
    }
    const path = caminhoAnexo(prefixo, registroId, arquivo.name, crypto.randomUUID());
    const { error } = await supabase.storage
      .from(BUCKET_ANEXOS_TI)
      .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) {
      console.error('Erro ao enviar anexo:', error);
      erros.push(`"${arquivo.name}" não foi enviado (${error.message}).`);
      continue;
    }
    enviados.push({ path, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type, enviadoEm: new Date().toISOString() });
  }
  return { enviados, erros };
}

/** Remove arquivos do bucket. Falha só vai para o console: o registro já não aponta para eles. */
export async function removerArquivos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET_ANEXOS_TI).remove(paths);
  if (error) console.error('Erro ao remover anexos do storage (ficaram órfãos):', error, paths);
}

/** Signed URL de 60 s — o path nunca vai direto para o HTML. */
export async function urlAssinadaAnexo(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS_TI).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar signed URL do anexo:', error);
    return null;
  }
  return data.signedUrl;
}
