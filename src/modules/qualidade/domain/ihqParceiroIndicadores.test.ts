import { describe, expect, it } from 'vitest';
import { agregarIhqParceiro } from './ihqParceiroIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

describe('agregarIhqParceiro', () => {
  it('marca a resposta com a seção ihq_parceiro', () => {
    const resultado = agregarIhqParceiro(periodo, []);
    expect(resultado.secao).toBe('ihq_parceiro');
  });

  it('conta total de requisições da seção independente de liberação', () => {
    const resultado = agregarIhqParceiro(periodo, [
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-08' },
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-10', dtaLiberacao: null },
    ]);
    expect(resultado.totalRequisicoes).toBe(2);
    expect(resultado.laudosLiberados).toBe(1);
  });
});
