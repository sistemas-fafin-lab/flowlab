import { describe, expect, it } from 'vitest';
import {
  SEM_PACIENTE,
  confirmarPaciente,
  editarPaciente,
  nomeValido,
  sugerirPaciente,
} from './paciente';

describe('nomeValido', () => {
  it('exige texto além de espaços', () => {
    expect(nomeValido('Maria')).toBe(true);
    expect(nomeValido('')).toBe(false);
    expect(nomeValido('   ')).toBe(false);
  });
});

describe('editarPaciente', () => {
  it('troca o texto e desfaz a confirmação', () => {
    expect(editarPaciente('Maria da Silva')).toEqual({ nome: 'Maria da Silva', confirmado: false });
  });
});

describe('confirmarPaciente', () => {
  it('confirma o nome, sem espaços nas pontas', () => {
    expect(confirmarPaciente({ nome: '  Maria da Silva ', confirmado: false })).toEqual({
      nome: 'Maria da Silva',
      confirmado: true,
    });
  });

  it('não confirma nome vazio', () => {
    expect(confirmarPaciente(SEM_PACIENTE)).toEqual(SEM_PACIENTE);
    expect(confirmarPaciente({ nome: '   ', confirmado: false })).toEqual({ nome: '   ', confirmado: false });
  });
});

describe('sugerirPaciente', () => {
  it('campo vazio recebe o nome lido, ainda por confirmar', () => {
    expect(sugerirPaciente(SEM_PACIENTE, 'Maria da Silva')).toEqual({ nome: 'Maria da Silva', confirmado: false });
  });

  it('pedido sem nome lido não muda nada, nem a confirmação', () => {
    const confirmado = { nome: 'Maria da Silva', confirmado: true };

    expect(sugerirPaciente(confirmado, null)).toBe(confirmado);
    expect(sugerirPaciente(confirmado, '   ')).toBe(confirmado);
    expect(sugerirPaciente(SEM_PACIENTE, null)).toBe(SEM_PACIENTE);
  });

  it('o mesmo nome (sem diferença de acento, caixa ou espaços) mantém a confirmação', () => {
    const confirmado = { nome: 'Maria da Silva', confirmado: true };

    expect(sugerirPaciente(confirmado, 'MARIA  DA  SILVA')).toBe(confirmado);
    expect(sugerirPaciente({ nome: 'José Souza', confirmado: true }, 'JOSE SOUZA').confirmado).toBe(true);
  });

  it('nome diferente entra no campo e exige confirmar de novo', () => {
    expect(sugerirPaciente({ nome: 'Maria da Silva', confirmado: true }, 'João Pereira')).toEqual({
      nome: 'João Pereira',
      confirmado: false,
    });
  });
});
