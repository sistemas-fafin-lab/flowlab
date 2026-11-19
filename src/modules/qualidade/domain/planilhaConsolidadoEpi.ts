// Excel do consolidado do mês de EPI (.scratch/epi-relatorio-mensal/spec.md, "Consolidado").
// Segue o padrão da exportação da lista de produtos (xlsx, json_to_sheet, cabeçalhos em
// maiúsculas). Puro: devolve a pasta de trabalho, para testar sem baixar o arquivo.

import * as XLSX from 'xlsx';
import type { ConsolidadoEpi } from './epiRelatorioMensal.js';
import { dataBR } from './pdfRelatorioEpi.js';

/** Abas: as linhas de todas as áreas e os totais por produto e por área, com o total geral. */
export function montarPlanilhaConsolidadoEpi({ linhas, totaisPorProduto, totaisPorArea, totalGeral }: ConsolidadoEpi): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const aba = (nome: string, dados: object[]) =>
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dados), nome);

  aba(
    'Consolidado',
    linhas.map((l) => ({
      'ÁREA': l.area,
      DATA: dataBR(l.data),
      PRODUTO: l.produto,
      'IDENTIFICAÇÃO': l.identificacao,
      QUANTIDADE: l.quantidade,
      SOLICITANTE: l.solicitante,
    })),
  );
  aba('Por produto', [
    ...totaisPorProduto.map((t) => ({ PRODUTO: t.produto, QUANTIDADE: t.quantidade })),
    { PRODUTO: 'Total', QUANTIDADE: totalGeral },
  ]);
  aba('Por área', [
    ...totaisPorArea.map((t) => ({ 'ÁREA': t.area, QUANTIDADE: t.quantidade })),
    { 'ÁREA': 'Total', QUANTIDADE: totalGeral },
  ]);
  return workbook;
}
