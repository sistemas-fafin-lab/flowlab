import { describe, expect, it } from 'vitest';
import { agregarBiologiaMolecular } from './biologiaMolecularIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

describe('agregarBiologiaMolecular', () => {
  it('marca a resposta com a seção biologia_molecular', () => {
    const resultado = agregarBiologiaMolecular(periodo, []);
    expect(resultado.secao).toBe('biologia_molecular');
    expect(resultado.totalRequisicoes).toBe(0);
    expect(resultado.tatMedioDias).toBeNull();
  });

  it('calcula liberados, TAT médio e fora do prazo a partir das linhas da seção', () => {
    const resultado = agregarBiologiaMolecular(periodo, [
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-05', dtaLiberacao: '2026-01-04' }, // 3 dias, dentro do prazo
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-02', dtaLiberacao: '2026-01-08' }, // 7 dias, fora do prazo
      { dtaColeta: null, dtaPrevista: null, dtaLiberacao: null }, // ainda não liberado
    ]);
    expect(resultado.totalRequisicoes).toBe(3);
    expect(resultado.laudosLiberados).toBe(2);
    expect(resultado.tatMedioDias).toBe(5);
    expect(resultado.laudosForaDoPrazo).toBe(1);
  });
});
