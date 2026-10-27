// Pessoas: avatar (iniciais + cor estável) e o casamento de "@Nome" das reuniões com
// os membros da EVA (RN08). Puro — também usado pela api/ na análise de reunião.

/** Mesmos gradientes dos avatares do protótipo. */
const GRADIENTES = [
  'linear-gradient(135deg,#3b82f6,#6366f1)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#f97316)',
  'linear-gradient(135deg,#8b5cf6,#7c3aed)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
];

export const GRADIENTE_SEM_RESPONSAVEL = 'linear-gradient(135deg,#94a3b8,#64748b)';

/** "Gabriel Carneiro" → "GC"; "Ana" → "AN"; vazio → "?". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** A mesma pessoa sempre recebe a mesma cor, em qualquer tela. */
export function gradientePara(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTES[h % GRADIENTES.length];
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export function juntarNomes(nomes: string[]): string {
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Como citar alguém no grupo da equipe (D35): o primeiro nome, ou o nome inteiro quando outra
 * pessoa da equipe tem o mesmo primeiro nome (no grupo, "Gabriel" sozinho seria ambíguo).
 */
export function nomeParaCitar(nome: string, equipe: string[]): string {
  const primeiro = primeiroNome(nome);
  const chave = normalizarNome(primeiro);
  const xaras = new Set(equipe.filter((n) => normalizarNome(primeiroNome(n)) === chave).map(normalizarNome));
  xaras.add(normalizarNome(nome));
  return xaras.size > 1 || !primeiro ? nome.trim().replace(/\s+/g, ' ') : primeiro;
}

/** "@Gabriel  Carneiro" → "gabriel carneiro" (sem @, sem acento, minúsculas, espaços simples). */
export function normalizarNome(nome: string): string {
  return nome
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MembroComApelidos {
  id: string;
  apelidos: string[];
}

/**
 * RN08 — devolve o id do membro cujo apelido bate com o nome citado, ou null.
 * "Equipe" e nomes sem correspondência voltam null (a sugestão vai sem responsável).
 */
export function casarMembro(nomeCitado: string, membros: MembroComApelidos[]): string | null {
  const alvo = normalizarNome(nomeCitado);
  if (!alvo || alvo === 'equipe') return null;
  const achado = membros.find((m) => m.apelidos.some((a) => normalizarNome(a) === alvo));
  return achado?.id ?? null;
}

/** 5561999924986 → +55 61 99992-4986 (só exibição); sem número, "—". */
export function formatarWhatsapp(digitos: string | null): string {
  if (!digitos) return '—';
  const m = digitos.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]}-${m[4]}` : digitos;
}
