// Upload dos anexos da conversa e da resolução dos chamados de TI (bucket it-attachments).
import { supabase } from './supabase';
import { caminhoDoAnexo, tipoDoAnexo, type AnexoIT } from '../utils/itAnexos';

const BUCKET = 'it-attachments';

/** Envia os arquivos um a um; se algum falhar, apaga os que já subiram e repassa o erro. */
export async function enviarAnexosIT(arquivos: File[], userId: string, chamadoId: string): Promise<AnexoIT[]> {
  const enviados: { caminho: string; anexo: AnexoIT }[] = [];
  try {
    for (const arquivo of arquivos) {
      const caminho = caminhoDoAnexo(userId, chamadoId, arquivo.name, Date.now() + enviados.length);
      const type = tipoDoAnexo(arquivo.name) ?? arquivo.type;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, { cacheControl: '3600', upsert: false, contentType: type });
      if (error) throw new Error(`Não foi possível enviar "${arquivo.name}": ${error.message}`);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho);
      enviados.push({ caminho, anexo: { url: data.publicUrl, name: arquivo.name, size: arquivo.size, type } });
    }
    return enviados.map((e) => e.anexo);
  } catch (erro) {
    await removerDoStorage(enviados.map((e) => e.caminho));
    throw erro;
  }
}

/** Apaga anexos que subiram mas não chegaram a ser gravados (a mensagem falhou). */
export async function descartarAnexosIT(anexos: AnexoIT[]): Promise<void> {
  const caminhos = anexos
    .map((a) => a.url.split(`/${BUCKET}/`)[1])
    .filter((c): c is string => !!c)
    .map((c) => decodeURIComponent(c));
  await removerDoStorage(caminhos);
}

async function removerDoStorage(caminhos: string[]): Promise<void> {
  if (!caminhos.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(caminhos);
  } catch {
    // Melhor esforço: sobra um arquivo órfão, mas o erro original é o que importa.
  }
}
