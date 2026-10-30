import { describe, expect, it } from 'vitest';
import { dataDeHojeISO, formatDataBR, iniciais, nomeCurto, validarDataNaoFutura } from './colaboradorFormato';

describe('iniciais', () => {
  it('usa primeiro e último nome', () => expect(iniciais('Mariana Costa Ribeiro')).toBe('MR'));
  it('nome único', () => expect(iniciais('Fernanda')).toBe('F'));
  it('vazio', () => expect(iniciais('   ')).toBe('?'));
});

describe('nomeCurto', () => {
  it('reduz a primeiro e último', () => expect(nomeCurto('Mariana Costa Ribeiro')).toBe('Mariana Ribeiro'));
  it('mantém nomes curtos', () => expect(nomeCurto('Bruno Lopes')).toBe('Bruno Lopes'));
});

describe('formatDataBR', () => {
  it('formata ISO', () => expect(formatDataBR('2026-03-05')).toBe('05/03/2026'));
  it('aceita timestamp', () => expect(formatDataBR('2026-03-05T10:00:00Z')).toBe('05/03/2026'));
  it('null para vazio', () => expect(formatDataBR(null)).toBeNull());
});

describe('dataDeHojeISO', () => {
  it('usa a data local', () => expect(dataDeHojeISO(new Date(2026, 0, 9, 23, 30))).toBe('2026-01-09'));
});

describe('validarDataNaoFutura', () => {
  const hoje = '2026-10-30';
  it('aceita hoje', () => expect(validarDataNaoFutura('2026-10-30', 'Data', hoje)).toBeNull());
  it('aceita vazio', () => expect(validarDataNaoFutura(null, 'Data', hoje)).toBeNull());
  it('recusa futura', () => expect(validarDataNaoFutura('2026-10-31', 'Data de nascimento', hoje)).toBe('Data de nascimento não pode ser uma data futura.'));
  it('recusa inválida', () => expect(validarDataNaoFutura('30/10/2026', 'Data', hoje)).toBe('Data inválida.'));
});
