import { describe, expect, it } from 'vitest';
import {
  autorizadoresAptos,
  bloqueioDesativarDepartamento,
  chaveGestor,
  colaboradoresSemDepartamento,
  departamentosSemAutorizador,
  gestoresComDepartamentos,
  validarNomeDepartamento,
} from './departamentos';
import type { SituacaoGestor } from '../types';

const departamentos = [
  { id: 'd1', nome: 'Área técnica' },
  { id: 'd2', nome: 'Faturamento' },
];

describe('validarNomeDepartamento', () => {
  it('aceita um nome novo', () => {
    expect(validarNomeDepartamento('Qualidade', departamentos)).toBeNull();
  });

  it('recusa nome vazio ou só com espaços', () => {
    expect(validarNomeDepartamento('   ', departamentos)).toBe('Informe o nome do departamento.');
  });

  it('recusa nome repetido sem diferenciar maiúsculas nem espaços nas pontas', () => {
    expect(validarNomeDepartamento('  faturamento ', departamentos)).toBe('Já existe um departamento com esse nome.');
  });

  it('aceita o próprio nome ao renomear o mesmo departamento', () => {
    expect(validarNomeDepartamento('FATURAMENTO', departamentos, 'd2')).toBeNull();
  });
});

describe('bloqueioDesativarDepartamento', () => {
  it('bloqueia com colaborador ativo no departamento, dizendo quantos', () => {
    const colaboradores = [
      { departamentoId: 'd1', status: 'ativo' as const },
      { departamentoId: 'd1', status: 'ativo' as const },
      { departamentoId: 'd2', status: 'ativo' as const },
    ];
    expect(bloqueioDesativarDepartamento('d1', colaboradores)).toBe(
      'Não é possível desativar: 2 colaboradores ativos ainda estão neste departamento.',
    );
  });

  it('libera quando só sobram desligados', () => {
    const colaboradores = [{ departamentoId: 'd1', status: 'desligado' as const }];
    expect(bloqueioDesativarDepartamento('d1', colaboradores)).toBeNull();
  });
});

describe('colaboradoresSemDepartamento', () => {
  it('só os ativos sem departamento, em ordem de nome', () => {
    const colaboradores = [
      { id: '1', nome: 'Vinicius', departamentoId: null, status: 'ativo' as const },
      { id: '2', nome: 'Ana Claudia', departamentoId: null, status: 'ativo' as const },
      { id: '3', nome: 'Bruno', departamentoId: null, status: 'desligado' as const },
      { id: '4', nome: 'Carla', departamentoId: 'd1', status: 'ativo' as const },
    ];
    expect(colaboradoresSemDepartamento(colaboradores).map((c) => c.nome)).toEqual(['Ana Claudia', 'Vinicius']);
  });
});

describe('gestores que autorizam pagamentos', () => {
  const estoque = { id: 'd1', nome: 'Estoque', ativo: true, responsavelIds: ['ana', 'bruno', 'carla'], autorizaPagamentosIds: ['ana', 'bruno'] };
  const ti = { id: 'd2', nome: 'TI', ativo: true, responsavelIds: ['ana'], autorizaPagamentosIds: [] };
  const antigo = { id: 'd3', nome: 'Antigo', ativo: false, responsavelIds: [], autorizaPagamentosIds: [] };
  const situacoes: Record<string, SituacaoGestor> = {
    [chaveGestor('d1', 'ana')]: 'apto',
    [chaveGestor('d1', 'bruno')]: 'sem_permissao',
    [chaveGestor('d1', 'carla')]: 'apto',
    [chaveGestor('d2', 'ana')]: 'apto',
  };

  it('só conta quem está marcado e apto', () => {
    expect(autorizadoresAptos(estoque, situacoes)).toEqual(['ana']);
    expect(autorizadoresAptos(ti, situacoes)).toEqual([]);
  });

  it('aponta os departamentos ativos sem gestor apto, ignorando os inativos', () => {
    expect(departamentosSemAutorizador([estoque, ti, antigo], situacoes).map((d) => d.nome)).toEqual(['TI']);
    expect(departamentosSemAutorizador([estoque], { ...situacoes, [chaveGestor('d1', 'ana')]: 'usuario_inativo' }).map((d) => d.nome)).toEqual([
      'Estoque',
    ]);
  });

  it('visão por gestor: cada responsável com os departamentos dele, por nome', () => {
    const colaboradores = [
      { id: 'carla', nome: 'Carla' },
      { id: 'ana', nome: 'Ana' },
      { id: 'bruno', nome: 'Bruno' },
    ];
    const visao = gestoresComDepartamentos([ti, estoque], colaboradores);
    expect(visao.map((g) => g.colaborador.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(visao[0].departamentos).toEqual([
      { id: 'd1', nome: 'Estoque', ativo: true, autorizaPagamentos: true },
      { id: 'd2', nome: 'TI', ativo: true, autorizaPagamentos: false },
    ]);
  });
});
