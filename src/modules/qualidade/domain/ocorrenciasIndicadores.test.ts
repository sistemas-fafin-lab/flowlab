import { describe, expect, it } from 'vitest';
import { agregarOcorrencias, type LinhaIndicadorOcorrencia } from './ocorrenciasIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

function linha(sobras: Partial<LinhaIndicadorOcorrencia>): LinhaIndicadorOcorrencia {
  return {
    dtaOcorrencia: '2026-01-15',
    statusCuradoria: 'concluida',
    motivoId: null,
    motivoNome: null,
    setorErroId: null,
    setorErroNome: null,
    colaboradorId: null,
    colaboradorNome: null,
    ...sobras,
  };
}

describe('agregarOcorrencias', () => {
  it('pendentes vão para aClassificar, nunca somadas às agregações por motivo (R5/R6)', () => {
    const resultado = agregarOcorrencias(periodo, [
      linha({ statusCuradoria: 'pendente', motivoId: 'm1', motivoNome: 'Erro de coleta' }),
      linha({ statusCuradoria: 'concluida', motivoId: 'm1', motivoNome: 'Erro de coleta' }),
    ]);

    expect(resultado.aClassificar).toBe(1);
    expect(resultado.porMotivo).toEqual([{ motivoId: 'm1', motivoNome: 'Erro de coleta', total: 1 }]);
  });

  it('agrupa por mês e trimestre a partir da data, sem persistir nada (P4)', () => {
    const resultado = agregarOcorrencias(periodo, [
      linha({ dtaOcorrencia: '2026-01-15' }),
      linha({ dtaOcorrencia: '2026-01-20' }),
      linha({ dtaOcorrencia: '2026-03-01' }),
    ]);

    expect(resultado.serieMensal).toEqual([
      { mes: '2026-01', total: 2 },
      { mes: '2026-03', total: 1 },
    ]);
    expect(resultado.serieTrimestral).toEqual([{ trimestre: '2026-Q1', total: 3 }]);
  });

  it('sem motivo/setor/colaborador não incrementa essas agregações', () => {
    const resultado = agregarOcorrencias(periodo, [linha({})]);
    expect(resultado.porMotivo).toEqual([]);
    expect(resultado.porSetor).toEqual([]);
    expect(resultado.porColaborador).toEqual([]);
  });
});
