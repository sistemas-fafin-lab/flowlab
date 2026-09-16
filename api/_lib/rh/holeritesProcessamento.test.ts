import { describe, expect, it } from 'vitest';
import { processarHolerites } from './holeritesProcessamento.js';

const COLABORADORES = [
  { id: 'c-fulano', nome: 'Fulano de Tal', cpf: '529.982.247-25' },
  { id: 'c-beltrana', nome: 'Beltrana Souza', cpf: '111.444.777-35' },
];

describe('processarHolerites', () => {
  it('casa blocos por CPF e detecta competência', () => {
    const textos = [
      'CPF: 529.982.247-25\nRef.: Agosto/2026',
      'CPF: 529.982.247-25\nRef.: Agosto/2026',
      'CPF: 111.444.777-35\nRef.: Agosto/2026',
    ];
    const resultado = processarHolerites(textos, COLABORADORES, []);

    expect(resultado.totalPaginas).toBe(3);
    expect(resultado.blocosIdentificados).toEqual([
      {
        colaboradorId: 'c-fulano',
        colaboradorNome: 'Fulano de Tal',
        competencia: '2026-08-01',
        paginaInicio: 1,
        paginaFim: 2,
        jaExiste: false,
      },
      {
        colaboradorId: 'c-beltrana',
        colaboradorNome: 'Beltrana Souza',
        competencia: '2026-08-01',
        paginaInicio: 3,
        paginaFim: 3,
        jaExiste: false,
      },
    ]);
    expect(resultado.cpfsNaoCasados).toEqual([]);
    expect(resultado.blocosSemCompetencia).toEqual([]);
    expect(resultado.paginasSemCpf).toEqual([]);
  });

  it('marca jaExiste quando já há holerite para colaborador+competência', () => {
    const textos = ['CPF: 529.982.247-25\nRef.: Agosto/2026'];
    const resultado = processarHolerites(textos, COLABORADORES, [
      { colaboradorId: 'c-fulano', competencia: '2026-08-01' },
    ]);
    expect(resultado.blocosIdentificados[0].jaExiste).toBe(true);
  });

  it('CPF sem colaborador correspondente vai para cpfsNaoCasados e não bloqueia o restante do lote', () => {
    const textos = [
      'CPF: 123.456.789-09\nRef.: Agosto/2026', // CPF válido, mas de ninguém cadastrado
      'CPF: 529.982.247-25\nRef.: Agosto/2026',
    ];
    const resultado = processarHolerites(textos, COLABORADORES, []);
    expect(resultado.cpfsNaoCasados).toEqual([
      { cpf: '12345678909', paginaInicio: 1, paginaFim: 1 },
    ]);
    expect(resultado.blocosIdentificados).toEqual([
      {
        colaboradorId: 'c-fulano',
        colaboradorNome: 'Fulano de Tal',
        competencia: '2026-08-01',
        paginaInicio: 2,
        paginaFim: 2,
        jaExiste: false,
      },
    ]);
  });

  it('bloco casado sem competência legível vai para blocosSemCompetencia', () => {
    const textos = ['CPF: 529.982.247-25\nsem referência de mês'];
    const resultado = processarHolerites(textos, COLABORADORES, []);
    expect(resultado.blocosIdentificados).toEqual([]);
    expect(resultado.blocosSemCompetencia).toEqual([
      { colaboradorId: 'c-fulano', colaboradorNome: 'Fulano de Tal', paginaInicio: 1, paginaFim: 1 },
    ]);
  });

  it('página sem CPF legível vai para paginasSemCpf', () => {
    const textos = ['CPF: 529.982.247-25\nRef.: Agosto/2026', 'página ilegível, sem CPF'];
    const resultado = processarHolerites(textos, COLABORADORES, []);
    expect(resultado.paginasSemCpf).toEqual([{ numero: 2 }]);
  });
});
