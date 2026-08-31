import { describe, expect, it } from 'vitest';
import { ordenarTestesPorData, proximaDataPrevistaAtual, testeMaisRecente } from './riscosContingencia.js';
import type { TesteContingenciaDTO } from '../types';

function teste(overrides: Partial<TesteContingenciaDTO> = {}): TesteContingenciaDTO {
  return {
    id: 't1',
    planoId: 'plano-1',
    dataTeste: '2026-01-01',
    resultado: 'aprovado',
    necessidadeMelhoria: false,
    descricaoMelhoria: null,
    proximaDataPrevista: null,
    observacoes: null,
    registradoPor: 'user-1',
    registradoEm: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ordenarTestesPorData', () => {
  it('ordena da data de teste mais recente para a mais antiga', () => {
    const antigo = teste({ id: 'antigo', dataTeste: '2026-01-01' });
    const recente = teste({ id: 'recente', dataTeste: '2026-06-01' });
    expect(ordenarTestesPorData([antigo, recente]).map((t) => t.id)).toEqual(['recente', 'antigo']);
  });

  it('não muta o array original', () => {
    const lista = [teste({ id: 'a' })];
    const resultado = ordenarTestesPorData(lista);
    expect(resultado).not.toBe(lista);
  });
});

describe('testeMaisRecente', () => {
  it('retorna null quando o plano nunca foi testado', () => {
    expect(testeMaisRecente([])).toBeNull();
  });

  it('retorna o teste com a data mais recente', () => {
    const antigo = teste({ id: 'antigo', dataTeste: '2026-01-01' });
    const recente = teste({ id: 'recente', dataTeste: '2026-06-01' });
    expect(testeMaisRecente([antigo, recente])?.id).toBe('recente');
  });
});

describe('proximaDataPrevistaAtual', () => {
  it('retorna null quando não há testes', () => {
    expect(proximaDataPrevistaAtual([])).toBeNull();
  });

  it('retorna a próxima data prevista informada no teste mais recente', () => {
    const antigo = teste({ id: 'antigo', dataTeste: '2026-01-01', proximaDataPrevista: '2026-03-01' });
    const recente = teste({ id: 'recente', dataTeste: '2026-06-01', proximaDataPrevista: '2026-12-01' });
    expect(proximaDataPrevistaAtual([antigo, recente])).toBe('2026-12-01');
  });

  it('retorna null quando o teste mais recente não previu próxima data', () => {
    const recente = teste({ id: 'recente', dataTeste: '2026-06-01', proximaDataPrevista: null });
    expect(proximaDataPrevistaAtual([recente])).toBeNull();
  });
});
