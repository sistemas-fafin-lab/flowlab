import { describe, expect, it } from 'vitest';
import { descreverRegraPrazo, lerRegraPrazo } from './regraPrazo';

describe('descreverRegraPrazo', () => {
  it('descreve cada tipo de regra', () => {
    expect(descreverRegraPrazo({ tipo: 'dias_corridos', n: 60 })).toBe('60 dias corridos');
    expect(descreverRegraPrazo({ tipo: 'dias_uteis', n: 5 })).toBe('5 dias úteis');
    expect(descreverRegraPrazo({ tipo: 'dia_mes_seguinte', n: 20 })).toBe('Dia 20 do mês seguinte');
    expect(descreverRegraPrazo({ tipo: 'dia_util_mes_seguinte', n: 20 })).toBe('20º dia útil do mês seguinte');
    expect(descreverRegraPrazo({ tipo: 'ultimo_dia_mes_seguinte', n: null })).toBe('Último dia do mês seguinte');
    expect(descreverRegraPrazo({ tipo: 'sem_prazo', n: null })).toBe('Sem prazo');
  });

  it('usa o singular para 1 dia', () => {
    expect(descreverRegraPrazo({ tipo: 'dias_corridos', n: 1 })).toBe('1 dia corrido');
    expect(descreverRegraPrazo({ tipo: 'dias_uteis', n: 1 })).toBe('1 dia útil');
  });
});

describe('lerRegraPrazo', () => {
  it('lê o N dos tipos que contam', () => {
    expect(lerRegraPrazo('dias_corridos', '90')).toEqual({ regra: { tipo: 'dias_corridos', n: 90 } });
    expect(lerRegraPrazo('dia_util_mes_seguinte', ' 20 ')).toEqual({ regra: { tipo: 'dia_util_mes_seguinte', n: 20 } });
  });

  it('descarta o N dos tipos que não contam', () => {
    expect(lerRegraPrazo('sem_prazo', '30')).toEqual({ regra: { tipo: 'sem_prazo', n: null } });
    expect(lerRegraPrazo('ultimo_dia_mes_seguinte', '')).toEqual({ regra: { tipo: 'ultimo_dia_mes_seguinte', n: null } });
  });

  it('recusa N vazio, zero, negativo ou fracionado', () => {
    for (const bruto of ['', '0', '-5', '2.5', 'abc']) {
      expect(lerRegraPrazo('dias_uteis', bruto)).toHaveProperty('erro');
    }
  });

  it('recusa dia do mês acima de 31 e dia útil acima de 23', () => {
    expect(lerRegraPrazo('dia_mes_seguinte', '31')).toEqual({ regra: { tipo: 'dia_mes_seguinte', n: 31 } });
    expect(lerRegraPrazo('dia_mes_seguinte', '32')).toHaveProperty('erro');
    expect(lerRegraPrazo('dia_util_mes_seguinte', '23')).toEqual({ regra: { tipo: 'dia_util_mes_seguinte', n: 23 } });
    expect(lerRegraPrazo('dia_util_mes_seguinte', '24')).toHaveProperty('erro');
  });
});
