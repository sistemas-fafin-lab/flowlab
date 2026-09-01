import { describe, expect, it } from 'vitest';
import { agregarBiologiaMolecular, calcularTatPorTipoExame } from './biologiaMolecularIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

describe('agregarBiologiaMolecular', () => {
  it('marca a resposta com a seção biologia_molecular', () => {
    const resultado = agregarBiologiaMolecular(periodo, []);
    expect(resultado.secao).toBe('biologia_molecular');
    expect(resultado.totalRequisicoes).toBe(0);
    expect(resultado.tatMedioDias).toBeNull();
    expect(resultado.tatPorTipoExame).toEqual([]);
  });

  it('calcula liberados, TAT médio e fora do prazo a partir das linhas da seção', () => {
    const resultado = agregarBiologiaMolecular(periodo, [
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-05', dtaLiberacao: '2026-01-04', exameTipoNomeLis: 'PCR' }, // 3 dias, dentro do prazo
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-02', dtaLiberacao: '2026-01-08', exameTipoNomeLis: 'PCR' }, // 7 dias, fora do prazo
      { dtaColeta: null, dtaPrevista: null, dtaLiberacao: null, exameTipoNomeLis: 'PCR' }, // ainda não liberado
    ]);
    expect(resultado.totalRequisicoes).toBe(3);
    expect(resultado.laudosLiberados).toBe(2);
    expect(resultado.tatMedioDias).toBe(5);
    expect(resultado.laudosForaDoPrazo).toBe(1);
  });

  it('inclui o TAT por tipo de exame na resposta', () => {
    const resultado = agregarBiologiaMolecular(periodo, [
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-05', dtaLiberacao: '2026-01-04', exameTipoNomeLis: 'PCR' },
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-11', exameTipoNomeLis: 'CAPTURA HÍBRIDA' },
    ]);
    expect(resultado.tatPorTipoExame).toEqual([
      { exameTipoNomeLis: 'PCR', tatMedioDias: 3, laudosLiberados: 1 },
      { exameTipoNomeLis: 'CAPTURA HÍBRIDA', tatMedioDias: 10, laudosLiberados: 1 },
    ]);
  });
});

describe('calcularTatPorTipoExame', () => {
  it('agrupa por exameTipoNomeLis e calcula o TAT médio de cada grupo', () => {
    const resultado = calcularTatPorTipoExame([
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-05', dtaLiberacao: '2026-01-04', exameTipoNomeLis: 'PCR' }, // 3 dias
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-05', dtaLiberacao: '2026-01-06', exameTipoNomeLis: 'PCR' }, // 5 dias
      { dtaColeta: '2026-01-01', dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-11', exameTipoNomeLis: 'CAPTURA HÍBRIDA' }, // 10 dias
    ]);

    expect(resultado).toEqual([
      { exameTipoNomeLis: 'PCR', tatMedioDias: 4, laudosLiberados: 2 },
      { exameTipoNomeLis: 'CAPTURA HÍBRIDA', tatMedioDias: 10, laudosLiberados: 1 },
    ]);
  });

  it('ordena por volume de laudos liberados, maior primeiro', () => {
    const resultado = calcularTatPorTipoExame([
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: 'CAPTURA HÍBRIDA' },
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: 'PCR' },
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: 'PCR' },
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: 'PCR' },
    ]);

    expect(resultado.map((r) => r.exameTipoNomeLis)).toEqual(['PCR', 'CAPTURA HÍBRIDA']);
  });

  it('não inclui tipo de exame sem nenhum laudo liberado no período', () => {
    const resultado = calcularTatPorTipoExame([
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: 'PCR' },
      { dtaColeta: null, dtaPrevista: null, dtaLiberacao: null, exameTipoNomeLis: 'CAPTURA HÍBRIDA' }, // ainda não liberado
    ]);

    expect(resultado.map((r) => r.exameTipoNomeLis)).toEqual(['PCR']);
  });

  it('ignora linhas sem exameTipoNomeLis', () => {
    const resultado = calcularTatPorTipoExame([
      { dtaColeta: '2026-01-01', dtaPrevista: null, dtaLiberacao: '2026-01-02', exameTipoNomeLis: null },
    ]);

    expect(resultado).toEqual([]);
  });
});
