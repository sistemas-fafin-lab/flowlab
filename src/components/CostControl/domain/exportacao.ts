// Mapeamento de linhas para exportação (xlsx/csv) da aba Fontes Pagadoras —
// extraído pra ser testado sem gerar arquivo nem montar componente React.
// Ver PayorsScreen.tsx (botão Exportar).

import type { Payor } from '../../../hooks/useCostControl';
import type { ExameDaFontePagadora } from './busca';

export interface LinhaExportacao {
  [coluna: string]: string | number;
}

/** Linhas de exportação pra tabela "exames de uma fonte pagadora" — mesmas
 *  colunas exibidas em TabelaExamesDaFonte. */
export function linhasExportacaoExamesDaFonte(
  examesDaFonte: ExameDaFontePagadora[],
): LinhaExportacao[] {
  return examesDaFonte.map(e => ({
    Exame: e.exame,
    TUSS: e.tuss,
    'Tabela Associada': e.tabelaAssociada,
    'Valor Cobrado': e.valorCobrado,
    Custo: e.custo,
    Dif: e.dif,
    '%CSP': Number(e.percentualCsp.toFixed(2)),
    Atendido: e.atendido ? 'Sim' : 'Não',
  }));
}

/** Linhas de exportação pra uma listagem de fontes pagadoras — usada tanto
 *  pras fontes de um exame selecionado (TabelaFontesPagadoras) quanto pra
 *  exportação de todas as linhas de custo_fontes_pagadoras sem filtro. */
export function linhasExportacaoFontesPagadoras(fontes: Payor[]): LinhaExportacao[] {
  return fontes.map(p => ({
    'Fonte Pagadora': p.payor,
    'Tabela Associada': p.table,
    TUSS: p.tus,
    'Valor Cobrado': p.price,
    Atendido: p.atendido ? 'Sim' : 'Não',
  }));
}
