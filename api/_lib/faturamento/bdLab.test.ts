import { describe, expect, it } from 'vitest';
import { protocoloEhData } from './bdLab.js';

// Casos vêm da issue 10 (.scratch/faturamento-feedback-usuario/issues/10-lotes-protocolo-duplicado.md):
// achados reais do banco em 2026-08-18.
describe('protocoloEhData', () => {
  it('reconhece protocolos-data legítimos compartilhados entre operadoras', () => {
    expect(protocoloEhData('07082026')).toBe(true); // AMHP-DF, lotes 6490/6491
    expect(protocoloEhData('03082026')).toBe(true); // Medigest
    expect(protocoloEhData('26062026')).toBe(true); // AMHP-DF + Medigest
    expect(protocoloEhData('11052026')).toBe(true); // ABAC + AMHP-DF
    expect(protocoloEhData('23062026')).toBe(true); // AMHP-DF + INAS GDF
  });

  it('rejeita protocolos de 8 dígitos com dia fora de 01-31', () => {
    expect(protocoloEhData('79957289')).toBe(false); // CASSI, duplicidade real
    expect(protocoloEhData('43421411')).toBe(false); // AMHP-DF, não é data
    expect(protocoloEhData('44579468')).toBe(false); // AMHP-DF, não é data
  });

  it('rejeita formatos que não são 8 dígitos', () => {
    expect(protocoloEhData('760054')).toBe(false); // 6 dígitos, ASSEFAZ/Medigest
    expect(protocoloEhData('')).toBe(false);
    expect(protocoloEhData('123456789')).toBe(false);
    expect(protocoloEhData('ABC12345')).toBe(false);
  });

  it('rejeita mês fora de 01-12', () => {
    expect(protocoloEhData('01132026')).toBe(false);
    expect(protocoloEhData('01002026')).toBe(false);
  });

  it('rejeita dia 00', () => {
    expect(protocoloEhData('00082026')).toBe(false);
  });

  it('aceita dia 31 e mês 12 nos limites', () => {
    expect(protocoloEhData('31122026')).toBe(true);
  });

  it('rejeita dia/mês dentro da faixa mas que não formam uma data real', () => {
    expect(protocoloEhData('31042026')).toBe(false); // abril tem 30 dias
    expect(protocoloEhData('30022026')).toBe(false); // fevereiro não tem 30 dias
    expect(protocoloEhData('29022025')).toBe(false); // 2025 não é bissexto
  });

  it('aceita 29/02 em ano bissexto', () => {
    expect(protocoloEhData('29022024')).toBe(true);
  });
});
