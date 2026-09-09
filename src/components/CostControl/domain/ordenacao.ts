// Ordenação clicável por coluna nas tabelas de resultado de Fontes
// Pagadoras — lógica extraída pra ser testada sem montar componente React.
// Visual (ícones ArrowUp/ArrowDown/ArrowUpDown) reaproveita o padrão de
// src/modules/qualidade/components/ui/TabelaExpansivel.tsx, mas sem os
// recursos de filtro por coluna e modal de expandir daquele componente.

export type Direcao = 'asc' | 'desc' | null;

export interface EstadoOrdenacao {
  coluna: string;
  direcao: Direcao;
}

export const ORDENACAO_PADRAO: EstadoOrdenacao = { coluna: '', direcao: null };

/** Cicla o estado de ordenação de uma coluna: sem ordenação → crescente →
 *  decrescente → sem ordenação (volta pro padrão). Clicar numa coluna
 *  diferente da atual começa direto no crescente. */
export function alternarOrdenacao(atual: EstadoOrdenacao, coluna: string): EstadoOrdenacao {
  if (atual.coluna !== coluna) return { coluna, direcao: 'asc' };
  if (atual.direcao === 'asc') return { coluna, direcao: 'desc' };
  return ORDENACAO_PADRAO;
}

/** Ordena `itens` por `estado`; sem ordenação customizada (estado padrão),
 *  aplica `comparadorPadrao`. `valorDaColuna` extrai o valor bruto de uma
 *  coluna — string ordena alfabeticamente, number ordena numericamente. */
export function ordenar<T>(
  itens: T[],
  estado: EstadoOrdenacao,
  valorDaColuna: (item: T, coluna: string) => string | number,
  comparadorPadrao: (a: T, b: T) => number,
): T[] {
  if (!estado.coluna || !estado.direcao) return [...itens].sort(comparadorPadrao);

  const sinal = estado.direcao === 'asc' ? 1 : -1;
  return [...itens].sort((a, b) => {
    const va = valorDaColuna(a, estado.coluna);
    const vb = valorDaColuna(b, estado.coluna);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
    return String(va).localeCompare(String(vb)) * sinal;
  });
}
