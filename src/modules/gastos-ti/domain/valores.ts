// Valores em reais digitados (formulário) ou lidos de planilha (importador, issue 09).

const RE_MILHAR_SEM_DECIMAL = /^-?\d{1,3}(\.\d{3})+$/;
const RE_NUMERO = /^-?\d+(\.\d+)?$/;

/**
 * Arredonda a centavos sem o erro de ponto flutuante de `Math.round(n * 100)`:
 * 10.005 * 100 = 1000.4999… e viraria 10,00. Deslocar a vírgula pela notação
 * exponencial ("10.005e2" = 1000.5) arredonda certo.
 */
const arredondarCentavos = (valor: number): number => Number(`${Math.round(Number(`${valor}e2`))}e-2`);

/**
 * Converte "2.480,00", "2480,5", "2480", "2480.50" ou um número em reais com 2
 * casas. Ponto sem vírgula só vira separador de milhar no formato inequívoco
 * "2.480" / "1.234.567" (grupos de 3) — "2480.5" continua sendo decimal.
 * Devolve null quando não é um valor.
 */
export function parseValorBR(entrada: string | number | null | undefined): number | null {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? arredondarCentavos(entrada) : null;

  let texto = entrada.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!texto) return null;
  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (RE_MILHAR_SEM_DECIMAL.test(texto)) {
    texto = texto.replace(/\./g, '');
  }
  if (!RE_NUMERO.test(texto)) return null;
  return arredondarCentavos(Number(texto));
}

/** Número → texto de campo de edição ("2.480,00"). */
export function formatarValorCampo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
