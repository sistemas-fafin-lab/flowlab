// Valor em reais digitado à mão: aceita o jeito brasileiro ("1.234,56") e o
// jeito de máquina ("1234.56"), já que o usuário costuma colar de planilha.

// Texto do campo → número. Vazio ou inválido vira 0 (custo/valor não é opcional).
export function lerMoeda(texto: string): number {
  const limpo = texto.replace(/[^\d.,-]/g, '');
  if (!limpo) return 0;
  // Com vírgula, ela é o decimal e os pontos são milhar. Sem vírgula, um único
  // ponto seguido de 1–2 dígitos é decimal; qualquer outro ponto é milhar.
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : /^-?\d*\.\d{1,2}$/.test(limpo)
      ? limpo
      : limpo.replace(/\./g, '');
  const valor = parseFloat(normalizado);
  return Number.isFinite(valor) ? valor : 0;
}

// Número → texto do campo, sem "R$" (o prefixo já fica fixo ao lado): 1234.5 → "1.234,50".
export function escreverMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor || 0);
}
