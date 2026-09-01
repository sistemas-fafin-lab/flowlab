import { describe, expect, it } from 'vitest';
import { agregarHistologiaCitologia } from './histologiaCitologiaIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

describe('agregarHistologiaCitologia', () => {
  it('marca a resposta com a seção histologia_citologia', () => {
    const resultado = agregarHistologiaCitologia(periodo, []);
    expect(resultado.secao).toBe('histologia_citologia');
  });

  it('TAT médio ignora linhas sem coleta, mesmo já liberadas', () => {
    const resultado = agregarHistologiaCitologia(periodo, [
      { dtaColeta: null, dtaPrevista: null, dtaLiberacao: '2026-01-05' },
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-04' },
    ]);
    expect(resultado.laudosLiberados).toBe(2);
    expect(resultado.tatMedioDias).toBe(3);
  });
});
