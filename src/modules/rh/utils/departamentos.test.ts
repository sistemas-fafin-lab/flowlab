import { describe, expect, it } from 'vitest';
import { bloqueioDesativarDepartamento, colaboradoresSemDepartamento, validarNomeDepartamento } from './departamentos';

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
