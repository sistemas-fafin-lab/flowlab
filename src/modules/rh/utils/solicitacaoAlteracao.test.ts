import { describe, expect, it } from 'vitest';
import type { DadosPessoais } from '../types';
import { DADOS_PESSOAIS_VAZIOS } from './rotulosDadosPessoais';
import {
  alteracoesDoBanco,
  alteracoesParaRpc,
  calcularAlteracoes,
  descreverAlteracao,
  formatarValorCampo,
} from './solicitacaoAlteracao';

const atuais: DadosPessoais = {
  ...DADOS_PESSOAIS_VAZIOS,
  estadoCivil: 'solteiro',
  cidadeNascimento: 'Goiânia',
  dataNascimento: '1995-08-15',
};

describe('calcularAlteracoes', () => {
  it('sem mudança', () => expect(calcularAlteracoes(atuais, { ...atuais })).toEqual([]));

  it('só o campo alterado', () =>
    expect(calcularAlteracoes(atuais, { ...atuais, estadoCivil: 'casado' })).toEqual([
      { campo: 'estadoCivil', de: 'solteiro', para: 'casado' },
    ]));

  it('ignora espaços nas pontas', () =>
    expect(calcularAlteracoes(atuais, { ...atuais, cidadeNascimento: '  Goiânia ' })).toEqual([]));

  it('texto vazio vale null', () =>
    expect(calcularAlteracoes(atuais, { ...atuais, cidadeNascimento: '' })).toEqual([
      { campo: 'cidadeNascimento', de: 'Goiânia', para: null },
    ]));

  it('mantém a ordem da tela', () =>
    expect(
      calcularAlteracoes(atuais, { ...atuais, nomeMae: 'Maria', nacionalidade: 'brasileira' }).map((a) => a.campo),
    ).toEqual(['nacionalidade', 'nomeMae']));
});

describe('conversão campo/coluna', () => {
  it('envia a coluna e o valor novo', () =>
    expect(alteracoesParaRpc([{ campo: 'estadoCivil', de: 'solteiro', para: 'casado' }])).toEqual([
      { campo: 'estado_civil', para: 'casado' },
    ]));

  it('lê do banco e ignora o desconhecido', () =>
    expect(
      alteracoesDoBanco([
        { campo: 'data_nascimento', de: null, para: '1995-08-15' },
        { campo: 'cpf', de: '1', para: '2' },
      ]),
    ).toEqual([{ campo: 'dataNascimento', de: null, para: '1995-08-15' }]));

  it('não array vira lista vazia', () => expect(alteracoesDoBanco(null)).toEqual([]));
});

describe('formatação', () => {
  it('rótulo do domínio', () => expect(formatarValorCampo('estadoCivil', 'casado')).toBe('Casado(a)'));
  it('data', () => expect(formatarValorCampo('dataNascimento', '1995-08-15')).toBe('15/08/1995'));
  it('vazio', () => expect(formatarValorCampo('nomePai', null)).toBe('Não informado'));
  it('antes → depois', () =>
    expect(descreverAlteracao({ campo: 'estadoCivil', de: 'solteiro', para: 'casado' })).toBe(
      'Estado civil: Solteiro(a) → Casado(a)',
    ));
});
