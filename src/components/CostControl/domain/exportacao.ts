// Mapeamento de linhas para exportação (xlsx/csv) da aba Fontes Pagadoras —
// extraído pra ser testado sem gerar arquivo nem montar componente React.
// Ver PayorsScreen.tsx (botão Exportar).

import type { Payor, TabelaAssociada } from '../../../hooks/useCostControl';
import type { ExameDaFontePagadora } from './busca';
import { formatarVencimento } from './vencimento';

// Mesmo texto da tela pra linha que a importação não vinculou a um exame.
export const CUSTO_NAO_LEVANTADO = 'Custo não levantado';

export interface LinhaExportacao {
  [coluna: string]: string | number;
}

// Vencimento (dd/mm/aaaa) do contrato da tabela associada de cada linha,
// pelo id do cadastro — vazio sem vencimento ou com tabela fora do cadastro.
function vencimentoPorTabela(tabelas: TabelaAssociada[]): (tabelaId: string) => string {
  const porId = new Map(tabelas.map(t => [t.id, formatarVencimento(t.vencimento)]));
  return tabelaId => porId.get(tabelaId) ?? '';
}

/** Linhas de exportação pra tabela "exames de uma fonte pagadora" — mesmas
 *  colunas exibidas em TabelaExamesDaFonte. Linha não levantada sai com
 *  "Custo não levantado" no Custo e Dif/%CSP vazios. */
export function linhasExportacaoExamesDaFonte(
  examesDaFonte: ExameDaFontePagadora[],
  tabelas: TabelaAssociada[],
): LinhaExportacao[] {
  const vencimento = vencimentoPorTabela(tabelas);
  return examesDaFonte.map(e => ({
    Exame: e.exameId ? e.exame : '',
    'Nome no convênio': e.nomeConvenio ?? '',
    TUSS: e.tuss,
    'Tabela Associada': e.tabelaAssociada,
    Vencimento: vencimento(e.tabelaId),
    'Valor Cobrado': e.valorCobrado,
    Custo: e.custoLevantado ? e.custo : CUSTO_NAO_LEVANTADO,
    Dif: e.custoLevantado ? e.dif : '',
    '%CSP': e.custoLevantado ? Number(e.percentualCsp.toFixed(2)) : '',
    Atendido: e.atendido ? 'Sim' : 'Não',
  }));
}

/** Linhas de exportação de todas as linhas de custo_fontes_pagadoras, sem
 *  filtro. */
export function linhasExportacaoFontesPagadoras(fontes: Payor[], tabelas: TabelaAssociada[]): LinhaExportacao[] {
  const vencimento = vencimentoPorTabela(tabelas);
  return fontes.map(p => ({
    'Fonte Pagadora': p.payor,
    'Tabela Associada': p.table,
    Vencimento: vencimento(p.tabelaId),
    TUSS: p.tus,
    'Nome no convênio': p.nomeConvenio ?? '',
    'Valor Cobrado': p.price,
    Atendido: p.atendido ? 'Sim' : 'Não',
  }));
}

/** Linhas de exportação pras fontes pagadoras de um exame selecionado
 *  (TabelaFontesPagadoras) — já com o valor efetivo daquele exame. */
export function linhasExportacaoFontesDoExame(
  fontes: ExameDaFontePagadora[],
  tabelas: TabelaAssociada[],
): LinhaExportacao[] {
  const vencimento = vencimentoPorTabela(tabelas);
  return fontes.map(f => ({
    'Fonte Pagadora': f.fontePagadora,
    'Tabela Associada': f.tabelaAssociada,
    Vencimento: vencimento(f.tabelaId),
    TUSS: f.tuss,
    'Valor Cobrado': f.valorCobrado,
    Atendido: f.atendido ? 'Sim' : 'Não',
  }));
}
