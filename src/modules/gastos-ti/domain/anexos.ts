// Regras dos anexos (RF09): tipos, tamanho, nome no storage. O bucket recusa
// o resto também (20261009150000_gastos_ti_anexos.sql); validar aqui só evita
// subir 10 MB para ouvir "não" no fim.

export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
export const TIPOS_ANEXO = ['application/pdf', 'image/png', 'image/jpeg'];
export const ACCEPT_ANEXOS = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

export function validarArquivo(arquivo: { name: string; size: number; type: string }): string | null {
  if (!TIPOS_ANEXO.includes(arquivo.type)) return `"${arquivo.name}": só PDF, PNG ou JPEG.`;
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return `"${arquivo.name}" tem ${formatarTamanho(arquivo.size)}; o limite é 10 MB.`;
  return null;
}

/**
 * Nome aceito por qualquer storage: sem acento, só letras, números, ponto,
 * hífen e sublinhado, até 80 caracteres preservando a extensão. O nome
 * original continua guardado no jsonb para exibir.
 */
export function nomeSeguro(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ponto = semAcento.lastIndexOf('.');
  const extensao = ponto > 0 ? semAcento.slice(ponto).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const base = (ponto > 0 ? semAcento.slice(0, ponto) : semAcento)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return `${(base || 'arquivo').slice(0, 80 - extensao.length)}${extensao}`;
}

/** "despesas/<id>/<único>-<nome>" — o prefixo único evita sobrescrever dois arquivos de mesmo nome. */
export function caminhoAnexo(prefixo: 'despesas' | 'lancamentos', registroId: string, nome: string, unico: string): string {
  return `${prefixo}/${registroId}/${unico}-${nomeSeguro(nome)}`;
}
