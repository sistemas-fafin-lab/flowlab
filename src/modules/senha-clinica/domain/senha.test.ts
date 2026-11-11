import { describe, expect, it } from 'vitest';
import { gerarSenha, mensagemAcesso, validarSenha } from './senha';

describe('validarSenha', () => {
  it.each([
    ['abc12345', null],
    ['abc1234', /8 caracteres/],
    ['12345678', /letra/],
    ['abcdefgh', /número/],
    ['abcd 1234', /espaços/],
  ])('%s', (senha, esperado) => {
    const r = validarSenha(senha);
    if (esperado === null) expect(r).toBeNull();
    else expect(r).toMatch(esperado);
  });
});

describe('gerarSenha', () => {
  it('sempre passa na regra do apLIS', () => {
    for (let i = 0; i < 200; i++) {
      const s = gerarSenha();
      expect(s).toHaveLength(10);
      expect(validarSenha(s)).toBeNull();
      expect(s).not.toMatch(/[01lIoO]/);
    }
  });
});

describe('mensagemAcesso', () => {
  it('traz clínica, usuário e senha em linhas separadas', () => {
    expect(mensagemAcesso('Clínica A', 'TESTE.TI', 'abc12345')).toBe(
      'Acesso ao Laudo Web — Clínica A\nUsuário: TESTE.TI\nSenha: abc12345',
    );
  });
});
