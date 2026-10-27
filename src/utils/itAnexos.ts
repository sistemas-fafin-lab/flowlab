// ─── Anexos da conversa e da resolução dos chamados de TI ─────────────────────
// Os arquivos vão para o bucket it-attachments, que só aceita os tipos abaixo
// (20260416130000_it_itsm_upgrade). O tipo sai da extensão e vai explícito no
// upload: o navegador às vezes manda vazio ou trocado (um .csv no Windows chega
// como application/vnd.ms-excel), e o bucket recusaria.

export interface AnexoIT {
  url: string;
  name: string;
  size: number;
  type?: string;
}

export const ANEXO_MAX_BYTES = 10 * 1024 * 1024;
export const ANEXOS_MAX_POR_MENSAGEM = 5;

const TIPOS_POR_EXTENSAO: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
};

/** Valor do `accept` do <input type="file">. */
export const ANEXO_ACCEPT = Object.keys(TIPOS_POR_EXTENSAO).map((ext) => `.${ext}`).join(',');

export function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto >= 0 ? nome.slice(ponto + 1).toLowerCase() : '';
}

/** MIME aceito pelo bucket para este nome de arquivo, ou null se a extensão não é aceita. */
export function tipoDoAnexo(nome: string): string | null {
  return TIPOS_POR_EXTENSAO[extensaoDe(nome)] ?? null;
}

export function ehImagem(nome: string): boolean {
  return (tipoDoAnexo(nome) ?? '').startsWith('image/');
}

/** Mensagem do problema com o arquivo, ou null quando ele pode ser enviado. */
export function validarAnexo(arquivo: { name: string; size: number }): string | null {
  if (!tipoDoAnexo(arquivo.name)) {
    return `"${arquivo.name}": tipo não aceito. Envie imagem, PDF, Word, Excel, TXT, CSV ou ZIP.`;
  }
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > ANEXO_MAX_BYTES) return `"${arquivo.name}" passa de 10 MB.`;
  return null;
}

/**
 * Junta os arquivos novos aos já escolhidos: descarta os inválidos, os repetidos
 * (mesmo nome e tamanho) e o que passar do limite por mensagem.
 */
export function juntarAnexos<T extends { name: string; size: number }>(
  atuais: T[],
  novos: T[],
): { arquivos: T[]; erros: string[] } {
  const arquivos = [...atuais];
  const erros: string[] = [];
  for (const arquivo of novos) {
    const erro = validarAnexo(arquivo);
    if (erro) {
      erros.push(erro);
      continue;
    }
    if (arquivos.some((a) => a.name === arquivo.name && a.size === arquivo.size)) continue;
    if (arquivos.length >= ANEXOS_MAX_POR_MENSAGEM) {
      erros.push(`No máximo ${ANEXOS_MAX_POR_MENSAGEM} anexos por mensagem.`);
      break;
    }
    arquivos.push(arquivo);
  }
  return { arquivos, erros };
}

export function formatarTamanho(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Captura de tela colada (Ctrl+V) chega sempre como "image.png" — duas seguidas
 * pareceriam o mesmo arquivo. Ganha um nome único.
 */
export function nomearCapturasColadas(arquivos: File[], agora = Date.now()): File[] {
  return arquivos.map((f, i) =>
    f.name === 'image.png' ? new File([f], `captura-${agora}-${i + 1}.png`, { type: f.type }) : f,
  );
}

/** Caminho no bucket: a 1ª pasta é o usuário (a policy de DELETE confere isso). */
export function caminhoDoAnexo(userId: string, chamadoId: string, nome: string, agora = Date.now()): string {
  const seguro = nome.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${chamadoId}/${agora}_${seguro}`;
}

/** Lê o jsonb de anexos sem confiar no formato (linhas antigas ou editadas à mão). */
export function lerAnexos(valor: unknown): AnexoIT[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { url, name, size, type } = item as Record<string, unknown>;
    if (typeof url !== 'string' || typeof name !== 'string') return [];
    return [{ url, name, size: typeof size === 'number' ? size : 0, ...(typeof type === 'string' ? { type } : {}) }];
  });
}
