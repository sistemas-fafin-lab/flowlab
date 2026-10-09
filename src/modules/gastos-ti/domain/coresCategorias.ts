import { ordenarCategorias, type CategoriaOrdenavel } from './categorias';

export type TemaGrafico = 'light' | 'dark';

/**
 * Paleta categórica validada da skill dataviz (references/palette.md), na ordem
 * dos slots — a ordem é o que separa cores vizinhas para daltônicos, não
 * estética. Validada em 01/Out/2026 com scripts/validate_palette.js contra as
 * superfícies do FlowLab (#ffffff no claro, #0f172a no escuro): todos os
 * critérios passam. No claro, aqua/amarelo/magenta ficam abaixo de 3:1 de
 * contraste, então todo gráfico precisa de rótulo visível ou tabela equivalente.
 */
export const PALETA_CATEGORIAS: Record<TemaGrafico, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/** Cinza neutro ("muted" da mesma paleta) do agrupamento "Outros" — nunca um 9º matiz. */
export const COR_OUTROS = '#898781';

export const MAX_CATEGORIAS_COM_COR = PALETA_CATEGORIAS.light.length;

/**
 * Slot de cor (0..7) de cada categoria pela posição na lista; da 9ª em diante,
 * null ("Outros"). Categorias inativas continuam ocupando o seu slot: desativar
 * uma categoria não pode repintar as outras (a cor segue a categoria, nunca o
 * ranking). Para liberar a cor, basta mover a inativa para o fim da lista.
 */
export function slotsDeCor(categorias: readonly CategoriaOrdenavel[]): Map<string, number | null> {
  return new Map(
    ordenarCategorias(categorias).map((c, i) => [c.id, i < MAX_CATEGORIAS_COM_COR ? i : null] as const),
  );
}

export function corDoSlot(slot: number | null | undefined, tema: TemaGrafico): string {
  if (slot === null || slot === undefined) return COR_OUTROS;
  return PALETA_CATEGORIAS[tema][slot] ?? COR_OUTROS;
}

/**
 * Rampa sequencial azul da skill dataviz em 7 faixas (passos 100, 200 … 700),
 * para magnitude (mapa de calor). No claro, a faixa mais clara é "quase zero" e
 * some na superfície; no escuro a âncora inverte: quase zero é a mais escura.
 */
const RAMPA_AZUL = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'] as const;

export const RAMPA_SEQUENCIAL: Record<TemaGrafico, readonly string[]> = {
  light: RAMPA_AZUL,
  dark: [...RAMPA_AZUL].reverse(),
};

/**
 * A faixa pede texto claro por cima? Só de #256abf para baixo (branco ≥ 5,4:1);
 * em #3987e5 o texto escuro contrasta mais (≈ 4,9:1 contra 3,6:1 do branco).
 */
export const faixaPedeTextoClaro = (faixa: number, tema: TemaGrafico): boolean => (tema === 'light' ? faixa >= 4 : faixa <= 2);

/**
 * Polos do par divergente azul ↔ vermelho (quente = acima, frio = abaixo).
 * São os slots azul e vermelho da paleta categórica; o meio é o cinza neutro.
 */
export const POLOS_DIVERGENTES: Record<TemaGrafico, { acima: string; abaixo: string; neutro: string }> = {
  light: { acima: '#e34948', abaixo: '#2a78d6', neutro: '#f0efec' },
  dark: { acima: '#e66767', abaixo: '#3987e5', neutro: '#383835' },
};
