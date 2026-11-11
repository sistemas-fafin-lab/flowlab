import { describe, expect, it } from 'vitest';
import type { ItemGeradorOrcamento } from '../types';
import { conferirCobertura, conveniosDaLista } from './cobertura';

function exame(nome: string, tuss: string, conveniosAceitos: string[] = []): ItemGeradorOrcamento {
  return { tuss, nome, preco: 10, elegivelDescontoParticular: false, conveniosAceitos };
}

const GLICOSE = exame('Glicose', '40302040', ['Unimed', 'Bradesco']);
const HEMOGRAMA = exame('Hemograma Completo', '40304361', ['Unimed']);
const TSH = exame('TSH', '40316521', ['Cassi', 'Bradesco', 'Amil']);
const SODIO = exame('Sódio', '40302423');

describe('conferirCobertura', () => {
  it('separa cobertos e não cobertos e conta quantos o convênio atende', () => {
    const conferencia = conferirCobertura([GLICOSE, TSH, HEMOGRAMA], 'Unimed');

    expect(conferencia.cobertos).toEqual([GLICOSE, HEMOGRAMA]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([TSH]);
    expect(conferencia.resumo).toEqual({ cobertos: 2, total: 3, todosCobertos: false });
  });

  it('exame repetido (mesmo TUSS e nome) conta uma vez', () => {
    const conferencia = conferirCobertura([GLICOSE, TSH, { ...GLICOSE }, TSH], 'Unimed');

    expect(conferencia.cobertos).toEqual([GLICOSE]);
    expect(conferencia.naoCobertos.map((n) => n.exame)).toEqual([TSH]);
    expect(conferencia.resumo).toEqual({ cobertos: 1, total: 2, todosCobertos: false });
  });

  it('não coberto traz os outros convênios que o atendem, sem o escolhido, em ordem alfabética', () => {
    const conferencia = conferirCobertura([TSH], 'Unimed');

    expect(conferencia.naoCobertos).toEqual([{ exame: TSH, outrosConvenios: ['Amil', 'Bradesco', 'Cassi'] }]);
    expect(conferencia.naoCobertos[0].outrosConvenios).not.toContain('Unimed');
  });

  it('todos cobertos', () => {
    const conferencia = conferirCobertura([GLICOSE, HEMOGRAMA], 'Unimed');

    expect(conferencia.naoCobertos).toEqual([]);
    expect(conferencia.resumo).toEqual({ cobertos: 2, total: 2, todosCobertos: true });
  });

  it('nenhum coberto', () => {
    const conferencia = conferirCobertura([TSH, SODIO], 'Unimed');

    expect(conferencia.cobertos).toEqual([]);
    expect(conferencia.resumo).toEqual({ cobertos: 0, total: 2, todosCobertos: false });
  });

  it('lista vazia: total 0 e não conta como todos cobertos', () => {
    expect(conferirCobertura([], 'Unimed')).toEqual({
      cobertos: [],
      naoCobertos: [],
      resumo: { cobertos: 0, total: 0, todosCobertos: false },
    });
  });

  it('convênio que não aparece em nenhum exame deixa tudo não coberto', () => {
    const conferencia = conferirCobertura([GLICOSE, TSH], 'Convênio Inexistente');

    expect(conferencia.naoCobertos).toEqual([
      { exame: GLICOSE, outrosConvenios: ['Bradesco', 'Unimed'] },
      { exame: TSH, outrosConvenios: ['Amil', 'Bradesco', 'Cassi'] },
    ]);
    expect(conferencia.resumo).toEqual({ cobertos: 0, total: 2, todosCobertos: false });
  });

  it('exames do mesmo TUSS com nomes diferentes são exames distintos', () => {
    const plaquetas = exame('Hemograma com Plaquetas', HEMOGRAMA.tuss, ['Cassi']);

    const conferencia = conferirCobertura([HEMOGRAMA, plaquetas], 'Unimed');

    expect(conferencia.cobertos).toEqual([HEMOGRAMA]);
    expect(conferencia.naoCobertos).toEqual([{ exame: plaquetas, outrosConvenios: ['Cassi'] }]);
    expect(conferencia.resumo).toEqual({ cobertos: 1, total: 2, todosCobertos: false });
  });

  it('não coberto por nenhum convênio fica sem outros convênios', () => {
    expect(conferirCobertura([SODIO], 'Unimed').naoCobertos).toEqual([{ exame: SODIO, outrosConvenios: [] }]);
  });
});

describe('conveniosDaLista', () => {
  it('traz cada convênio uma vez só', () => {
    const exames = [
      exame('Glicose', '40302040', ['Unimed', 'Bradesco']),
      exame('Hemograma Completo', '40304361', ['Unimed', 'Cassi']),
    ];

    expect(conveniosDaLista(exames)).toEqual(['Bradesco', 'Cassi', 'Unimed']);
  });

  it('ordena em pt-BR: letra acentuada fica junto da mesma letra sem acento', () => {
    const exames = [exame('Glicose', '40302040', ['Saúde Caixa', 'Sabin', 'Ômega', 'Amil', 'Ótima', 'Árvore'])];

    expect(conveniosDaLista(exames)).toEqual(['Amil', 'Árvore', 'Ômega', 'Ótima', 'Sabin', 'Saúde Caixa']);
  });

  it('lista vazia não tem convênio', () => {
    expect(conveniosDaLista([])).toEqual([]);
  });

  it('exames sem convênio não acrescentam nada', () => {
    const exames = [exame('Glicose', '40302040'), exame('Ureia', '40302580', ['Cassi']), exame('Sódio', '40302423')];

    expect(conveniosDaLista(exames)).toEqual(['Cassi']);
  });
});
