import { describe, expect, it } from 'vitest';
import { agregarIndicadoresGerais, type LinhaIndicadorRequisicao } from './requisicoesIndicadores.js';

const periodo = { inicio: '2026-01-01', fim: '2026-03-31' };

function linha(sobras: Partial<LinhaIndicadorRequisicao>): LinhaIndicadorRequisicao {
  return {
    dtaColeta: '2026-01-10',
    dtaAmostraRecebida: '2026-01-10',
    dtaAdmissao: '2026-01-11',
    dtaPrevista: '2026-01-20',
    dtaLiberacao: '2026-01-15',
    patologistaNomeLis: 'Dra. Ana',
    retificado: false,
    ...sobras,
  };
}

describe('agregarIndicadoresGerais', () => {
  it('conta amostras recebidas e admitidas por presença da data (dimensões independentes)', () => {
    const resultado = agregarIndicadoresGerais(periodo, [
      linha({ dtaAmostraRecebida: '2026-01-10', dtaAdmissao: null }),
      linha({ dtaAmostraRecebida: null, dtaAdmissao: '2026-01-11' }),
    ]);
    expect(resultado.amostrasRecebidas).toBe(1);
    expect(resultado.amostrasAdmitidas).toBe(1);
  });

  it('só conta laudo liberado quando dtaLiberacao está preenchida', () => {
    const resultado = agregarIndicadoresGerais(periodo, [linha({ dtaLiberacao: '2026-01-15' }), linha({ dtaLiberacao: null })]);
    expect(resultado.laudosLiberados).toBe(1);
  });

  it('agrupa laudos liberados por patologista, ordenado por total desc', () => {
    const resultado = agregarIndicadoresGerais(periodo, [
      linha({ patologistaNomeLis: 'Dra. Ana' }),
      linha({ patologistaNomeLis: 'Dra. Ana' }),
      linha({ patologistaNomeLis: 'Dr. Bruno' }),
      linha({ dtaLiberacao: null, patologistaNomeLis: 'Dr. Carlos' }),
    ]);
    expect(resultado.laudosLiberadosPorMedico).toEqual([
      { medicoNome: 'Dra. Ana', total: 2 },
      { medicoNome: 'Dr. Bruno', total: 1 },
    ]);
  });

  it('TAT médio usa dtaColeta → dtaLiberacao e nunca vira 0 sem dado (R4)', () => {
    const semDados = agregarIndicadoresGerais(periodo, [linha({ dtaColeta: null, dtaLiberacao: null })]);
    expect(semDados.tatMedioDias).toBeNull();

    const comDados = agregarIndicadoresGerais(periodo, [
      linha({ dtaColeta: '2026-01-01', dtaLiberacao: '2026-01-06' }), // 5 dias
      linha({ dtaColeta: '2026-01-01', dtaLiberacao: '2026-01-11' }), // 10 dias
    ]);
    expect(comDados.tatMedioDias).toBe(7.5);
  });

  it('marca fora do prazo só quando liberação é depois da data prevista', () => {
    const resultado = agregarIndicadoresGerais(periodo, [
      linha({ dtaPrevista: '2026-01-20', dtaLiberacao: '2026-01-15' }), // dentro do prazo
      linha({ dtaPrevista: '2026-01-10', dtaLiberacao: '2026-01-15' }), // fora do prazo
      linha({ dtaPrevista: null, dtaLiberacao: '2026-01-15' }), // sem previsão, não conta
    ]);
    expect(resultado.laudosForaDoPrazo).toBe(1);
  });

  it('conta laudos retificados independente de liberação', () => {
    const resultado = agregarIndicadoresGerais(periodo, [linha({ retificado: true }), linha({ retificado: false })]);
    expect(resultado.laudosRetificados).toBe(1);
  });
});
