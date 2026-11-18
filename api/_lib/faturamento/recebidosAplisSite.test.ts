import { describe, expect, it } from 'vitest';
import { dataBr, numeroBr, requisicaoDaLinha } from './recebidosAplisSite.js';

describe('numeroBr', () => {
  it('lê o formato do site', () => {
    expect(numeroBr('79,92')).toBe(79.92);
    expect(numeroBr('14.487,18')).toBe(14487.18);
    expect(numeroBr('0,00')).toBe(0);
    expect(numeroBr('-10,50')).toBe(-10.5);
  });

  it('vazio ou inválido vira 0', () => {
    expect(numeroBr('')).toBe(0);
    expect(numeroBr(null)).toBe(0);
    expect(numeroBr('abc')).toBe(0);
  });
});

describe('dataBr', () => {
  it('dd/mm/aaaa → ISO', () => {
    expect(dataBr('13/11/2026')).toBe('2026-11-13');
    expect(dataBr('13/11/2026 10:03')).toBe('2026-11-13');
  });

  it('vazio → null', () => {
    expect(dataBr(null)).toBeNull();
    expect(dataBr('')).toBeNull();
  });
});

describe('requisicaoDaLinha', () => {
  it('linha da tela de Baixa (lote 6912, 18/11/2026)', () => {
    expect(requisicaoDaLinha({
      IdRequisicao: 205243,
      CodRequisicao: '0085093030004',
      StatusFat: 'RECEBIDO',
      VlrLiquido: '79,92',
      DtaRecebido: '13/11/2026',
      VlrRecebido: '79,92',
      VlrSaldo: '0,00',
    })).toEqual({ idRequisicao: 205243, liquido: 79.92, recebido: 79.92, data: '2026-11-13' });
  });

  it('sem IdRequisicao fica fora', () => {
    expect(requisicaoDaLinha({ VlrRecebido: '1,00' })).toBeNull();
  });
});
