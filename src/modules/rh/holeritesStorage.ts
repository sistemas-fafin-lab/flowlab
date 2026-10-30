// src/modules/rh/holeritesStorage.ts
// Ponto único do nome do bucket privado de holerites e do helper de signed URL
// — usado tanto pela listagem RH (useHoleritesEnviados) quanto pelos
// recibos da ficha e do Meu perfil (useRecibosColaborador) e pelo upload (EnviarHoleritesSection),
// pra não espalhar a mesma string mágica em três arquivos.

import { supabase } from '../../lib/supabase';

export const BUCKET_HOLERITES = 'colaborador-holerites';

/**
 * Signed URL de curta duração (60s) — nunca expõe o path direto no HTML.
 * `download: true` força o download (Content-Disposition); sem ele o PDF abre no navegador.
 */
export async function gerarSignedUrlHolerite(arquivoPath: string, download = false): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_HOLERITES)
    .createSignedUrl(arquivoPath, 60, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) {
    console.error('Erro ao gerar signed URL do holerite:', error);
    return null;
  }
  return data.signedUrl;
}
