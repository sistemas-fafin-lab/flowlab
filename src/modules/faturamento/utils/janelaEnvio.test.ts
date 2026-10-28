import { describe, expect, it } from 'vitest';
import { descreverJanela } from './janelaEnvio';

describe('descreverJanela', () => {
  it('descreve cada tipo de janela', () => {
    expect(descreverJanela({ tipo: 'dias_corridos', de: 1, ate: 15 })).toBe('Dias 1 ao 15');
    expect(descreverJanela({ tipo: 'dias_uteis', de: 1, ate: 5 })).toBe('1º ao 5º dia útil');
    expect(descreverJanela({ tipo: 'dias_fixos', dias: [3, 16] })).toBe('Dias 3 e 16');
    expect(descreverJanela({ tipo: 'ultimo_dia_util' })).toBe('Último dia útil');
    expect(descreverJanela({ tipo: 'todos_os_dias' })).toBe('Todos os dias');
    expect(descreverJanela({ tipo: 'calendario_convenio' })).toBe('Calendário do convênio');
  });

  it('usa o singular quando a faixa ou os dias fixos têm um dia só', () => {
    expect(descreverJanela({ tipo: 'dias_corridos', de: 10, ate: 10 })).toBe('Dia 10');
    expect(descreverJanela({ tipo: 'dias_uteis', de: 1, ate: 1 })).toBe('1º dia útil');
    expect(descreverJanela({ tipo: 'dias_fixos', dias: [20] })).toBe('Dia 20');
  });

  it('lista três ou mais dias fixos em ordem, com "e" antes do último', () => {
    expect(descreverJanela({ tipo: 'dias_fixos', dias: [16, 3, 25] })).toBe('Dias 3, 16 e 25');
  });
});
