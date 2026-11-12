import { describe, expect, it } from 'vitest';
import { cpfDaEdicao } from './cpf';

describe('cpfDaEdicao', () => {
  it('grava o CPF digitado com máscara, só com os dígitos', () => {
    expect(cpfDaEdicao('529.982.247-25', null)).toEqual({ cpf: '52998224725', mudou: true });
  });

  it('mesmo CPF de antes não é mudança', () => {
    expect(cpfDaEdicao('529.982.247-25', '52998224725')).toEqual({ cpf: '52998224725', mudou: false });
  });

  it('troca de um CPF por outro é mudança', () => {
    expect(cpfDaEdicao('111.444.777-35', '52998224725')).toEqual({ cpf: '11144477735', mudou: true });
  });

  it('campo vazio em quem não tem CPF não muda nada', () => {
    expect(cpfDaEdicao('  ', null)).toEqual({ cpf: null, mudou: false });
  });

  it('não deixa apagar um CPF já cadastrado', () => {
    expect(cpfDaEdicao('', '52998224725')).toEqual({ erro: 'O CPF não pode ficar em branco depois de cadastrado.' });
  });

  it('recusa CPF com dígito verificador errado', () => {
    expect(cpfDaEdicao('529.982.247-24', null)).toEqual({ erro: 'CPF inválido.' });
  });
});
