import { describe, expect, it } from 'vitest';
import { calcularTAT, nivelConfiancaVinculo } from './ihqRegras.js';

describe('nivelConfiancaVinculo', () => {
  it('sem candidatas é nenhuma', () => {
    expect(nivelConfiancaVinculo([])).toBe('nenhuma');
  });
  it('uma candidata é alta', () => {
    expect(nivelConfiancaVinculo([{ codRequisicaoOriginal: 'R1', dtaSolicitacao: '2026-01-01', temPeca: false }])).toBe(
      'alta',
    );
  });
  it('mais de uma, exatamente uma com peça, é média', () => {
    const candidatas = [
      { codRequisicaoOriginal: 'R1', dtaSolicitacao: '2026-01-01', temPeca: true },
      { codRequisicaoOriginal: 'R2', dtaSolicitacao: '2026-01-02', temPeca: false },
    ];
    expect(nivelConfiancaVinculo(candidatas)).toBe('media');
  });
  it('mais de uma, 0 ou 2+ com peça, é baixa', () => {
    const semPeca = [
      { codRequisicaoOriginal: 'R1', dtaSolicitacao: '2026-01-01', temPeca: false },
      { codRequisicaoOriginal: 'R2', dtaSolicitacao: '2026-01-02', temPeca: false },
    ];
    expect(nivelConfiancaVinculo(semPeca)).toBe('baixa');
  });
});

describe('calcularTAT', () => {
  it('sem envio, diasEmAberto é null, nunca 0', () => {
    expect(calcularTAT(null, null, '2026-01-10', 5)).toEqual({ diasEmAberto: null, atrasado: false });
  });
  it('dentro do prazo', () => {
    expect(calcularTAT('2026-01-01', null, '2026-01-04', 5)).toEqual({ diasEmAberto: 3, atrasado: false });
  });
  it('fora do prazo', () => {
    expect(calcularTAT('2026-01-01', null, '2026-01-10', 5)).toEqual({ diasEmAberto: 9, atrasado: true });
  });
  it('com retorno, usa a data de retorno, não a referência', () => {
    expect(calcularTAT('2026-01-01', '2026-01-03', '2026-02-01', 5)).toEqual({ diasEmAberto: 2, atrasado: false });
  });
});
