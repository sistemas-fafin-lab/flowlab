import { describe, expect, it } from 'vitest';
import { agregarPatologiaAp } from './patologiaIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

describe('agregarPatologiaAp', () => {
  it('marca a resposta com a seção patologia_ap', () => {
    const resultado = agregarPatologiaAp(periodo, []);
    expect(resultado.secao).toBe('patologia_ap');
  });

  it('só conta fora do prazo quando há data prevista e liberação depois dela', () => {
    const resultado = agregarPatologiaAp(periodo, [
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-05' },
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-20' },
    ]);
    expect(resultado.laudosLiberados).toBe(2);
    expect(resultado.laudosForaDoPrazo).toBe(0);
  });
});
