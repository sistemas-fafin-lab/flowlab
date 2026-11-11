import { describe, expect, it } from 'vitest';
import type { CoberturaConvenio, ItemGeradorOrcamento } from '../types';
import { conferirCobertura, conveniosDaFonte, fontesDaLista, nomeDaEscolha } from './cobertura';

/** `pares`: "FONTE/CONVÊNIO", ou só "FONTE" quando o convênio tem o nome da fonte. */
function exame(nome: string, tuss: string, pares: string[] = []): ItemGeradorOrcamento {
  const coberturaConvenios: CoberturaConvenio[] = pares.map((p) => {
    const [fonte, convenio = fonte] = p.split('/');
    return { fonte, convenio };
  });
  return {
    tuss,
    nome,
    preco: 10,
    elegivelDescontoParticular: false,
    conveniosAceitos: [...new Set(coberturaConvenios.map((c) => c.fonte))],
    coberturaConvenios,
  };
}

const so = (fonte: string) => ({ fonte, convenio: null });
const com = (fonte: string, convenio: string) => ({ fonte, convenio });

const GLICOSE = exame('Glicose', '40302040', ['AMHP-DF/BACEN', 'AMHP-DF/AFFEGO', 'Bradesco']);
const HEMOGRAMA = exame('Hemograma Completo', '40304361', ['AMHP-DF/BACEN - MEDICINA LABORATORIAL']);
const TSH = exame('TSH', '40316521', ['Cassi', 'Bradesco', 'Amil']);
const SODIO = exame('Sódio', '40302423');

describe('conferirCobertura — só fonte pagadora', () => {
  it('coberto se algum convênio da fonte atende', () => {
    const conferencia = conferirCobertura([GLICOSE, TSH, HEMOGRAMA], so('AMHP-DF'));

    expect(conferencia.cobertos).toEqual([GLICOSE, HEMOGRAMA]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([TSH]);
    expect(conferencia.resumo).toEqual({ cobertos: 2, total: 3, todosCobertos: false });
  });

  it('exame repetido (mesmo TUSS e nome) conta uma vez', () => {
    const conferencia = conferirCobertura([GLICOSE, TSH, { ...GLICOSE }, TSH], so('AMHP-DF'));

    expect(conferencia.cobertos).toEqual([GLICOSE]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([TSH]);
    expect(conferencia.resumo).toEqual({ cobertos: 1, total: 2, todosCobertos: false });
  });

  it('não coberto traz os convênios que o atendem agrupados por fonte, em ordem alfabética', () => {
    expect(conferirCobertura([TSH], so('AMHP-DF')).naoCobertos).toEqual([
      {
        exame: TSH,
        outrosConvenios: [
          { fonte: 'Amil', convenios: ['Amil'] },
          { fonte: 'Bradesco', convenios: ['Bradesco'] },
          { fonte: 'Cassi', convenios: ['Cassi'] },
        ],
      },
    ]);
  });

  it('todos cobertos', () => {
    const conferencia = conferirCobertura([GLICOSE, HEMOGRAMA], so('AMHP-DF'));

    expect(conferencia.naoCobertos).toEqual([]);
    expect(conferencia.resumo).toEqual({ cobertos: 2, total: 2, todosCobertos: true });
  });

  it('nenhum coberto', () => {
    const conferencia = conferirCobertura([TSH, SODIO], so('AMHP-DF'));

    expect(conferencia.cobertos).toEqual([]);
    expect(conferencia.resumo).toEqual({ cobertos: 0, total: 2, todosCobertos: false });
  });

  it('lista vazia: total 0 e não conta como todos cobertos', () => {
    expect(conferirCobertura([], so('AMHP-DF'))).toEqual({
      cobertos: [],
      naoCobertos: [],
      resumo: { cobertos: 0, total: 0, todosCobertos: false },
    });
  });

  it('fonte que não aparece em nenhum exame deixa tudo não coberto', () => {
    const conferencia = conferirCobertura([GLICOSE], so('Fonte Inexistente'));

    expect(conferencia.naoCobertos).toEqual([
      {
        exame: GLICOSE,
        outrosConvenios: [
          { fonte: 'AMHP-DF', convenios: ['AFFEGO', 'BACEN'] },
          { fonte: 'Bradesco', convenios: ['Bradesco'] },
        ],
      },
    ]);
  });

  it('exames do mesmo TUSS com nomes diferentes são exames distintos', () => {
    const plaquetas = exame('Hemograma com Plaquetas', HEMOGRAMA.tuss, ['Cassi']);

    const conferencia = conferirCobertura([HEMOGRAMA, plaquetas], so('AMHP-DF'));

    expect(conferencia.cobertos).toEqual([HEMOGRAMA]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([plaquetas]);
  });

  it('não coberto por nenhum convênio fica sem outros convênios', () => {
    expect(conferirCobertura([SODIO], so('AMHP-DF')).naoCobertos).toEqual([{ exame: SODIO, outrosConvenios: [] }]);
  });
});

describe('conferirCobertura — fonte pagadora e convênio', () => {
  it('coberto só se aquele convênio da fonte atende', () => {
    const conferencia = conferirCobertura([GLICOSE, HEMOGRAMA], com('AMHP-DF', 'BACEN'));

    expect(conferencia.cobertos).toEqual([GLICOSE]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([HEMOGRAMA]);
    expect(conferencia.resumo).toEqual({ cobertos: 1, total: 2, todosCobertos: false });
  });

  it('"X" e "X - MEDICINA LABORATORIAL" são convênios diferentes', () => {
    const conferencia = conferirCobertura([HEMOGRAMA], com('AMHP-DF', 'BACEN'));

    expect(conferencia.naoCobertos).toEqual([
      { exame: HEMOGRAMA, outrosConvenios: [{ fonte: 'AMHP-DF', convenios: ['BACEN - MEDICINA LABORATORIAL'] }] },
    ]);
  });

  it('convênio de mesmo nome em outra fonte não conta', () => {
    const bradescoBacen = exame('Ureia', '40302580', ['Outra Fonte/BACEN']);

    expect(conferirCobertura([bradescoBacen], com('AMHP-DF', 'BACEN')).resumo.cobertos).toBe(0);
  });
});

describe('fontesDaLista', () => {
  it('traz cada fonte uma vez só', () => {
    expect(fontesDaLista([GLICOSE, HEMOGRAMA, TSH])).toEqual(['AMHP-DF', 'Amil', 'Bradesco', 'Cassi']);
  });

  it('ordena em pt-BR: letra acentuada fica junto da mesma letra sem acento', () => {
    const exames = [exame('Glicose', '40302040', ['Saúde Caixa', 'Sabin', 'Ômega', 'Amil', 'Ótima', 'Árvore'])];

    expect(fontesDaLista(exames)).toEqual(['Amil', 'Árvore', 'Ômega', 'Ótima', 'Sabin', 'Saúde Caixa']);
  });

  it('lista vazia ou exames sem convênio não têm fonte', () => {
    expect(fontesDaLista([])).toEqual([]);
    expect(fontesDaLista([SODIO])).toEqual([]);
  });
});

describe('conveniosDaFonte', () => {
  it('traz os convênios da fonte uma vez só, como cadastrados, em ordem', () => {
    expect(conveniosDaFonte([GLICOSE, HEMOGRAMA, { ...GLICOSE }], 'AMHP-DF')).toEqual([
      'AFFEGO',
      'BACEN',
      'BACEN - MEDICINA LABORATORIAL',
    ]);
  });

  it('não mistura convênios de outra fonte', () => {
    expect(conveniosDaFonte([GLICOSE, TSH], 'Bradesco')).toEqual(['Bradesco']);
  });

  it('fonte sem exame na lista não tem convênio', () => {
    expect(conveniosDaFonte([GLICOSE], 'Cassi')).toEqual([]);
  });
});

describe('nomeDaEscolha', () => {
  it('só a fonte, ou fonte · convênio', () => {
    expect(nomeDaEscolha(so('AMHP-DF'))).toBe('AMHP-DF');
    expect(nomeDaEscolha(com('AMHP-DF', 'BACEN'))).toBe('AMHP-DF · BACEN');
  });
});
