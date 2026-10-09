import { describe, expect, it } from 'vitest';
import { validarReajuste, variacao, vigenciaSugerida } from './reajustes';
import { quantidadeVigente } from './recorrencia';
import type { ReajusteInput } from '../types';

const despesa = {
  competenciaInicio: '2026-10-01',
  competenciaFim: '2027-12-01' as string | null,
  reajustes: [{ id: 'r1', vigenteDesde: '2027-01-01' }],
};

const input = (campos: Partial<ReajusteInput> = {}): ReajusteInput => ({
  vigenteDesde: '2027-03-01',
  valor: 2600,
  motivo: 'reajuste_contratual',
  quantidade: null,
  observacao: null,
  ...campos,
});

describe('validarReajuste', () => {
  it('aceita um reajuste válido', () => {
    expect(validarReajuste(input(), despesa)).toEqual({});
  });

  it('vigência precisa ser depois do mês inicial', () => {
    expect(validarReajuste(input({ vigenteDesde: '2026-10-01' }), despesa).vigenteDesde).toMatch(/depois do mês inicial \(out\/2026\)/);
    expect(validarReajuste(input({ vigenteDesde: '2026-09-01' }), despesa).vigenteDesde).toBeDefined();
  });

  it('não pode passar da última cobrança', () => {
    expect(validarReajuste(input({ vigenteDesde: '2028-01-01' }), despesa).vigenteDesde).toMatch(/termina em dez\/2027/);
    expect(validarReajuste(input({ vigenteDesde: '2027-12-01' }), despesa).vigenteDesde).toBeUndefined();
  });

  it('um reajuste por mês, mas editar o próprio não conflita', () => {
    expect(validarReajuste(input({ vigenteDesde: '2027-01-01' }), despesa).vigenteDesde).toMatch(/Já existe/);
    expect(validarReajuste(input({ vigenteDesde: '2027-01-01' }), despesa, 'r1').vigenteDesde).toBeUndefined();
  });

  it('exige vigência e valor positivo', () => {
    const erros = validarReajuste(input({ vigenteDesde: null, valor: null }), despesa);
    expect(erros.vigenteDesde).toBeDefined();
    expect(erros.valor).toBeDefined();
    expect(validarReajuste(input({ valor: 0 }), despesa).valor).toBeDefined();
  });

  it('quantidade inteira e positiva quando informada', () => {
    expect(validarReajuste(input({ quantidade: 0 }), despesa).quantidade).toBeDefined();
    expect(validarReajuste(input({ quantidade: 45 }), despesa).quantidade).toBeUndefined();
  });

  it('despesa sem prazo aceita qualquer mês depois do início', () => {
    expect(validarReajuste(input({ vigenteDesde: '2030-01-01' }), { ...despesa, competenciaFim: null })).toEqual({});
  });
});

describe('vigenciaSugerida', () => {
  it('é o mês seguinte ao atual', () => {
    expect(vigenciaSugerida('2026-01-01', '2026-10-15')).toBe('2026-11-01');
  });

  it('para despesa que ainda não começou, o mês seguinte ao inicial', () => {
    expect(vigenciaSugerida('2027-03-01', '2026-10-15')).toBe('2027-04-01');
  });
});

describe('variacao', () => {
  it('calcula a diferença absoluta e percentual', () => {
    expect(variacao(2000, 2500)).toEqual({ absoluta: 500, percentual: 25 });
    expect(variacao(2000, 1500)).toEqual({ absoluta: -500, percentual: -25 });
    expect(variacao(0, 100).percentual).toBeNull();
  });
});

describe('quantidadeVigente', () => {
  const reajustes = [
    { vigenteDesde: '2027-01-01', valor: 2600, quantidade: 45 },
    { vigenteDesde: '2027-06-01', valor: 2700, quantidade: null },
  ];

  it('sem reajuste de quantidade, vale a do cadastro', () => {
    expect(quantidadeVigente(40, reajustes, '2026-12-01')).toBe(40);
  });

  it('vale a do reajuste mais recente que mudou a quantidade', () => {
    expect(quantidadeVigente(40, reajustes, '2027-01-01')).toBe(45);
    // o de junho mudou só o valor: a quantidade continua 45
    expect(quantidadeVigente(40, reajustes, '2027-08-01')).toBe(45);
  });
});
