import { describe, expect, it } from 'vitest';
import { escolherVinculosAssefaz } from './preVinculoAssefaz.js';
import type { ExameCatalogo } from './preVinculoAssefaz.js';

const exame = (id: string, tuss: string, vinculo: Partial<ExameCatalogo> = {}): ExameCatalogo => ({
  id, nome: `Exame ${id}`, tuss, aplis_id_exame_tipo: null, aplis_id_teste: null, ...vinculo,
});

describe('escolherVinculosAssefaz', () => {
  it('liga a cobrança com um TUSS só ao único exame do catálogo com esse TUSS', () => {
    const resultado = escolherVinculosAssefaz(
      [{ IdExameTipo: 7, Codigo: '40601269' }, { IdExameTipo: 7, Codigo: '40601269' }],
      [exame('a', '40601269'), exame('b', '40601323')],
    );

    expect(resultado).toEqual({
      vinculos: [{ idExameTipo: 7, tuss: '40601269', exameId: 'a', exameNome: 'Exame a' }],
      descartes: [],
    });
  });

  it('código fora do catálogo não conta; cobrança sem nenhum código no catálogo fica de fora', () => {
    const resultado = escolherVinculosAssefaz(
      [
        { IdExameTipo: 3, Codigo: '40601129' },
        { IdExameTipo: 3, Codigo: '40601340' },
        { IdExameTipo: 6, Codigo: '40601153' },
      ],
      [exame('a', '40601129')],
    );

    expect(resultado).toEqual({
      vinculos: [{ idExameTipo: 3, tuss: '40601129', exameId: 'a', exameNome: 'Exame a' }],
      descartes: [{ idExameTipo: 6, motivo: 'nenhum TUSS da cobrança está no catálogo (40601153)' }],
    });
  });

  it('cobrança com dois TUSS no catálogo fica de fora: o TUSS depende do caso', () => {
    const resultado = escolherVinculosAssefaz(
      [{ IdExameTipo: 1, Codigo: '40601110' }, { IdExameTipo: 1, Codigo: '40601196' }],
      [exame('a', '40601110'), exame('b', '40601196')],
    );

    expect(resultado).toEqual({
      vinculos: [],
      descartes: [{ idExameTipo: 1, motivo: 'mais de um TUSS no catálogo (40601110, 40601196)' }],
    });
  });

  it('TUSS de vários exames do catálogo fica de fora: o exame se escolhe na tela', () => {
    const resultado = escolherVinculosAssefaz(
      [{ IdExameTipo: 18, Codigo: '40601285' }],
      [exame('a', '40601285'), exame('b', ' 40601285 ')],
    );

    expect(resultado).toEqual({
      vinculos: [],
      descartes: [{ idExameTipo: 18, motivo: '40601285 está em 2 exames do catálogo (Exame a; Exame b)' }],
    });
  });

  it('22 (Biologia Molecular) não liga, mesmo com um TUSS só no catálogo', () => {
    const resultado = escolherVinculosAssefaz(
      [{ IdExameTipo: 22, Codigo: '40310140' }, { IdExameTipo: 22, Codigo: '40314022' }],
      [exame('a', '40310140')],
    );

    expect(resultado.vinculos).toEqual([]);
    expect(resultado.descartes).toHaveLength(1);
    expect(resultado.descartes[0].idExameTipo).toBe(22);
  });

  it('não mexe no que já foi ligado à mão: nem o exame, nem a cobrança', () => {
    const resultado = escolherVinculosAssefaz(
      [{ IdExameTipo: 7, Codigo: '40601269' }, { IdExameTipo: 23, Codigo: '40601323' }],
      [
        exame('a', '40601269', { aplis_id_exame_tipo: 30, aplis_id_teste: 121 }),
        exame('b', '40601323'),
        exame('c', '', { aplis_id_exame_tipo: 23 }),
      ],
    );

    expect(resultado).toEqual({
      vinculos: [],
      descartes: [
        { idExameTipo: 7, motivo: 'Exame a já está ligado à cobrança 30 / teste 121' },
        { idExameTipo: 23, motivo: 'a cobrança já está ligada ao exame Exame c' },
      ],
    });
  });
});
