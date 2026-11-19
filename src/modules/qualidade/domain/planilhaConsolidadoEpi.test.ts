import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ConsolidadoEpi } from './epiRelatorioMensal.js';
import { montarPlanilhaConsolidadoEpi } from './planilhaConsolidadoEpi.js';

const consolidado: ConsolidadoEpi = {
  linhas: [
    {
      area: 'Laboratório',
      solicitacaoId: 'sm-1',
      itemId: 'i1',
      data: '2026-10-05',
      produto: 'Luva nitrílica',
      identificacao: 'CA 12345',
      quantidade: 2,
      solicitante: 'Ana Souza',
    },
    {
      area: 'Recepção',
      solicitacaoId: 'sm-2',
      itemId: 'i1',
      data: '2026-10-12',
      produto: 'Máscara PFF2',
      identificacao: '',
      quantidade: 10,
      solicitante: 'Bruno Lima',
    },
  ],
  totaisPorProduto: [
    { produto: 'Luva nitrílica', quantidade: 2 },
    { produto: 'Máscara PFF2', quantidade: 10 },
  ],
  totaisPorArea: [
    { area: 'Laboratório', quantidade: 2 },
    { area: 'Recepção', quantidade: 10 },
  ],
  totalGeral: 12,
};

const planilha = montarPlanilhaConsolidadoEpi(consolidado);
const aba = (nome: string) => XLSX.utils.sheet_to_json(planilha.Sheets[nome]);

describe('montarPlanilhaConsolidadoEpi', () => {
  it('tem as abas das linhas e dos totais por produto e por área', () => {
    expect(planilha.SheetNames).toEqual(['Consolidado', 'Por produto', 'Por área']);
  });

  it('uma linha por item, com a área e a data no formato brasileiro', () => {
    expect(aba('Consolidado')).toEqual([
      {
        'ÁREA': 'Laboratório',
        DATA: '05/10/2026',
        PRODUTO: 'Luva nitrílica',
        'IDENTIFICAÇÃO': 'CA 12345',
        QUANTIDADE: 2,
        SOLICITANTE: 'Ana Souza',
      },
      {
        'ÁREA': 'Recepção',
        DATA: '12/10/2026',
        PRODUTO: 'Máscara PFF2',
        'IDENTIFICAÇÃO': '',
        QUANTIDADE: 10,
        SOLICITANTE: 'Bruno Lima',
      },
    ]);
  });

  it('os totais por produto e por área, com a linha do total geral', () => {
    expect(aba('Por produto')).toEqual([
      { PRODUTO: 'Luva nitrílica', QUANTIDADE: 2 },
      { PRODUTO: 'Máscara PFF2', QUANTIDADE: 10 },
      { PRODUTO: 'Total', QUANTIDADE: 12 },
    ]);
    expect(aba('Por área')).toEqual([
      { 'ÁREA': 'Laboratório', QUANTIDADE: 2 },
      { 'ÁREA': 'Recepção', QUANTIDADE: 10 },
      { 'ÁREA': 'Total', QUANTIDADE: 12 },
    ]);
  });
});
