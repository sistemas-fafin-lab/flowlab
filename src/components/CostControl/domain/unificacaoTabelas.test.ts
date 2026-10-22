import { describe, expect, it } from 'vitest';
import { planejarUnificacao, type LinhaUnificacao } from './unificacaoTabelas';

const linha = (
  id: string,
  tabelaAssociada: string,
  tuss: string,
  valor: number,
  extra: Partial<LinhaUnificacao> = {}
): LinhaUnificacao => ({
  id,
  fontePagadora: 'Particular',
  tabelaAssociada,
  tuss,
  exameId: null,
  valor,
  atendido: true,
  elegivelDescontoParticular: false,
  ...extra,
});

const juntarNaParticular = [{ fontePagadora: 'Particular', destino: 'Particular', origens: ['PARTICULAR', 'part'] }];

describe('planejarUnificacao', () => {
  it('sem conflitos: aponta as linhas das origens para a tabela que fica e remove os cadastros vazios', () => {
    const plano = planejarUnificacao({
      linhas: [
        linha('a', 'Particular', '40301010', 10),
        linha('b', 'PARTICULAR', '40306712', 40),
        linha('c', 'part', '4031636', 30),
      ],
      exclusoes: [],
      valoresExame: [],
      mapa: juntarNaParticular,
      escolhas: [],
    });

    expect(plano).toEqual({
      tipo: 'pronto',
      operacoes: {
        criarTabelas: [],
        apontarLinhas: [
          { linhaId: 'b', fontePagadora: 'Particular', destino: 'Particular' },
          { linhaId: 'c', fontePagadora: 'Particular', destino: 'Particular' },
        ],
        removerLinhas: [],
        remapearExclusoes: [],
        remapearValores: [],
        removerTabelas: [
          { fontePagadora: 'Particular', nome: 'PARTICULAR' },
          { fontePagadora: 'Particular', nome: 'part' },
        ],
      },
    });
  });

  it('TUSS com preços diferentes nas tabelas juntadas e sem escolha: bloqueia e lista o conflito', () => {
    const plano = planejarUnificacao({
      linhas: [
        linha('a', 'Particular', '40306712', 35),
        linha('b', 'PARTICULAR', '40306712', 40),
        linha('c', 'part', '4031636', 30),
      ],
      exclusoes: [],
      valoresExame: [],
      mapa: juntarNaParticular,
      escolhas: [],
    });

    expect(plano).toEqual({
      tipo: 'bloqueado',
      conflitos: [
        {
          fontePagadora: 'Particular',
          destino: 'Particular',
          tuss: '40306712',
          exameId: null,
          opcoes: [
            { tabela: 'Particular', linhaId: 'a', valor: 35, atendido: true, elegivelDescontoParticular: false },
            { tabela: 'PARTICULAR', linhaId: 'b', valor: 40, atendido: true, elegivelDescontoParticular: false },
          ],
        },
      ],
    });
  });

  it('com a escolha: a linha escolhida fica, a perdedora sai e os ajustes por exame dela passam para a que fica', () => {
    const plano = planejarUnificacao({
      linhas: [linha('a', 'Particular', '40306712', 35), linha('b', 'PARTICULAR', '40306712', 40)],
      exclusoes: [{ payorId: 'a', exameId: 'ex-1' }],
      valoresExame: [
        { payorId: 'a', exameId: 'ex-2', valor: 50 },
        { payorId: 'a', exameId: 'ex-3', valor: 60 },
        { payorId: 'b', exameId: 'ex-3', valor: 70 },
      ],
      mapa: [{ fontePagadora: 'Particular', destino: 'Particular', origens: ['PARTICULAR'] }],
      escolhas: [
        { fontePagadora: 'Particular', destino: 'Particular', tuss: '40306712', exameId: null, fica: 'PARTICULAR' },
      ],
    });

    expect(plano).toEqual({
      tipo: 'pronto',
      operacoes: {
        criarTabelas: [],
        apontarLinhas: [{ linhaId: 'b', fontePagadora: 'Particular', destino: 'Particular' }],
        removerLinhas: ['a'],
        remapearExclusoes: [{ de: 'a', para: 'b', exameId: 'ex-1' }],
        // ex-3: a linha que fica já tem o próprio valor personalizado — ele prevalece.
        remapearValores: [{ de: 'a', para: 'b', exameId: 'ex-2', valor: 50 }],
        removerTabelas: [{ fontePagadora: 'Particular', nome: 'PARTICULAR' }],
      },
    });
  });

  it('escolha registrada vale mesmo quando os preços são iguais', () => {
    const plano = planejarUnificacao({
      linhas: [linha('a', 'Particular', '40306712', 40), linha('b', 'PARTICULAR', '40306712', 40)],
      exclusoes: [],
      valoresExame: [],
      mapa: [{ fontePagadora: 'Particular', destino: 'Particular', origens: ['PARTICULAR'] }],
      escolhas: [
        { fontePagadora: 'Particular', destino: 'Particular', tuss: '40306712', exameId: null, fica: 'PARTICULAR' },
      ],
    });

    expect(plano).toMatchObject({
      tipo: 'pronto',
      operacoes: {
        apontarLinhas: [{ linhaId: 'b', fontePagadora: 'Particular', destino: 'Particular' }],
        removerLinhas: ['a'],
      },
    });
  });

  it('tabela fora do mapa fica intocada, mesmo com nome igual ao de uma juntada ou em outra fonte', () => {
    const plano = planejarUnificacao({
      linhas: [
        linha('a', 'Particular', '40306712', 35),
        linha('b', 'PARTICULAR', '40306712', 35),
        linha('c', 'PART', '40306712', 99),
        linha('d', 'PARTICULAR', '40306712', 12, { fontePagadora: 'CLINICA GINORTE' }),
      ],
      exclusoes: [],
      valoresExame: [],
      mapa: [{ fontePagadora: 'Particular', destino: 'Particular', origens: ['PARTICULAR'] }],
      escolhas: [],
    });

    expect(plano).toEqual({
      tipo: 'pronto',
      operacoes: {
        criarTabelas: [],
        apontarLinhas: [],
        removerLinhas: ['b'],
        remapearExclusoes: [],
        remapearValores: [],
        removerTabelas: [{ fontePagadora: 'Particular', nome: 'PARTICULAR' }],
      },
    });
  });

  it('destino que ainda não existe na fonte: cria o cadastro', () => {
    const plano = planejarUnificacao({
      linhas: [
        linha('a', 'campanha', '40301010', 10, { fontePagadora: 'AMHP-DF' }),
        linha('b', 'CAMPANHA ', '40306712', 40, { fontePagadora: 'AMHP-DF' }),
      ],
      exclusoes: [],
      valoresExame: [],
      mapa: [{ fontePagadora: 'AMHP-DF', destino: 'Campanha 2026', origens: ['campanha', 'CAMPANHA '] }],
      escolhas: [],
    });

    expect(plano).toMatchObject({
      tipo: 'pronto',
      operacoes: {
        criarTabelas: [{ fontePagadora: 'AMHP-DF', nome: 'Campanha 2026' }],
        apontarLinhas: [
          { linhaId: 'a', fontePagadora: 'AMHP-DF', destino: 'Campanha 2026' },
          { linhaId: 'b', fontePagadora: 'AMHP-DF', destino: 'Campanha 2026' },
        ],
      },
    });
  });
});
