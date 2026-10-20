// Tipos do Gerador de Orçamento (área Atendimento). Ver .scratch/gerador-orcamento/spec.md.

/**
 * Um exame da lista de preços, como vem de GET /api/atendimento/gerador-orcamento-precos
 * (montagem em api/_lib/orcamentoParticular.ts). `tuss` não é único: o mesmo TUSS pode
 * vir em mais de um item, com nomes diferentes — a identidade do exame é tuss + nome.
 */
export interface ItemGeradorOrcamento {
  tuss: string;
  nome: string;
  preco: number;
  elegivelDescontoParticular: boolean;
  /** Convênios que atendem o exame (só nomes, sem valor negociado). */
  conveniosAceitos: string[];
}

/** Exame no carrinho do Orçamento, com a quantidade pedida (sempre ≥ 1). */
export interface ItemCarrinho {
  item: ItemGeradorOrcamento;
  quantidade: number;
}
