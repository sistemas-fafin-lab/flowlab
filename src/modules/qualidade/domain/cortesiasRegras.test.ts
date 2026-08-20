import { describe, expect, it } from 'vitest';
import {
  calcularAprovadaForaDoPrazo,
  calcularDiasAteAutorizacao,
  calcularDivergenciaValores,
  calcularEstadoCota,
  calcularPrecoCortesiaNaoCadastrado,
  calcularSituacaoPrazo,
} from './cortesiasRegras.js';

describe('calcularDiasAteAutorizacao', () => {
  it('null sem autorização', () => {
    expect(calcularDiasAteAutorizacao('2026-01-01', null, false)).toBeNull();
  });
  it('dias corridos', () => {
    expect(calcularDiasAteAutorizacao('2026-01-01', '2026-01-04', false)).toBe(3);
  });
});

describe('calcularSituacaoPrazo', () => {
  it('sem autorização, ainda dentro do prazo em aberto', () => {
    expect(calcularSituacaoPrazo(null, null, 3, 2)).toBe('sem_autorizacao');
  });
  it('dentro e fora do prazo (já autorizada)', () => {
    expect(calcularSituacaoPrazo(2, '2026-01-03', 3, null)).toBe('dentro_prazo');
    expect(calcularSituacaoPrazo(5, '2026-01-06', 3, null)).toBe('fora_prazo');
  });
  it('sem autorização e o prazo em aberto já venceu vira não autorizada', () => {
    expect(calcularSituacaoPrazo(null, null, 3, 4)).toBe('nao_autorizada');
  });
  it('diasEmAberto null (sem dataSolicitacao utilizável) nunca vira não autorizada', () => {
    expect(calcularSituacaoPrazo(null, null, 3, null)).toBe('sem_autorizacao');
  });
});

describe('calcularAprovadaForaDoPrazo', () => {
  it('só fora_prazo conta como erro (R2)', () => {
    expect(calcularAprovadaForaDoPrazo('fora_prazo')).toBe(true);
    expect(calcularAprovadaForaDoPrazo('sem_autorizacao')).toBe(false);
    expect(calcularAprovadaForaDoPrazo('nao_autorizada')).toBe(false);
    expect(calcularAprovadaForaDoPrazo('dentro_prazo')).toBe(false);
  });
});

describe('calcularDivergenciaValores', () => {
  it('sem valorParticular nunca diverge (R3)', () => {
    expect(calcularDivergenciaValores(null, 10, 10, 1)).toBe(false);
  });
  it('acima da tolerância diverge', () => {
    expect(calcularDivergenciaValores(100, 50, 40, 1)).toBe(true);
  });
});

describe('calcularPrecoCortesiaNaoCadastrado', () => {
  it('null é alerta, nunca vira 0 (R4)', () => {
    expect(calcularPrecoCortesiaNaoCadastrado(null)).toBe(true);
    expect(calcularPrecoCortesiaNaoCadastrado(0)).toBe(false);
  });
});

describe('calcularEstadoCota', () => {
  it('normal, atenção, excedido (R5)', () => {
    expect(calcularEstadoCota(10, 5)).toBe('normal');
    expect(calcularEstadoCota(10, 10)).toBe('atencao');
    expect(calcularEstadoCota(10, 11)).toBe('excedido');
  });
});
