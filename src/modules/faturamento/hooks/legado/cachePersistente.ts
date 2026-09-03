// Cache em localStorage das listagens "legado" (MySQL de backup do laboratório).
// O dado só muda no dia seguinte (o backup atrasa ~1 dia e roda uma vez por dia —
// ver nota em api/_lib/faturamento/bdLab.ts), mas o cache em memória (`cacheSessao`
// de cada hook) é um Map de módulo e se perde a cada F5. Persistir aqui evita
// reconsultar o túnel MySQL só porque a página foi recarregada — a consulta só
// roda de novo quando o dia (local do navegador) muda ou o operador força
// "Atualizar".

const PREFIXO = 'flowlab:faturamento:legado:';

interface Envelope<T> { dia: string; valor: T; }

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Apaga entradas de outros dias antes de gravar, pra não acumular chave velha
 *  de filtro que não é mais usado (cada combinação de filtros é uma chave). */
function limparEntradasVelhas(diaAtual: string): void {
  const paraRemover: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const chave = localStorage.key(i);
    if (!chave?.startsWith(PREFIXO)) continue;
    try {
      const env = JSON.parse(localStorage.getItem(chave) ?? '') as Envelope<unknown>;
      if (env.dia !== diaAtual) paraRemover.push(chave);
    } catch {
      paraRemover.push(chave);
    }
  }
  for (const chave of paraRemover) localStorage.removeItem(chave);
}

export function lerCachePersistente<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const env = JSON.parse(bruto) as Envelope<T>;
    if (env.dia !== hoje()) {
      localStorage.removeItem(PREFIXO + chave);
      return null;
    }
    return env.valor;
  } catch {
    return null;
  }
}

export function gravarCachePersistente<T>(chave: string, valor: T): void {
  try {
    const dia = hoje();
    limparEntradasVelhas(dia);
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ dia, valor }));
  } catch {
    // localStorage indisponível (modo privado, quota cheia) — o cache em
    // memória (Map do hook) ainda cobre a sessão atual, só não sobrevive a um F5.
  }
}
