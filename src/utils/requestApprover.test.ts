import { describe, expect, it } from 'vitest';
import { resolveRequestApprover, type ColaboradorNaResolucao, type DepartamentoDoAprovador } from './requestApprover';

const colab = (c: Partial<ColaboradorNaResolucao> & Pick<ColaboradorNaResolucao, 'id'>): ColaboradorNaResolucao => ({
  userProfileId: `user-${c.id}`,
  departamentoId: null,
  status: 'ativo',
  usuarioAtivo: true,
  ...c,
});

const tecnica: DepartamentoDoAprovador = { id: 'tecnica', aprovadorScId: 'paulo' };

describe('resolveRequestApprover', () => {
  it('departamento com aprovador: o aprovador do departamento de quem pediu', () => {
    const colaboradores = [
      colab({ id: 'marina', departamentoId: 'tecnica' }),
      colab({ id: 'paulo', departamentoId: 'tecnica' }),
    ];

    expect(resolveRequestApprover('user-marina', colaboradores, [tecnica])).toBe('user-paulo');
  });

  it.each([
    ['desligado', { status: 'desligado' as const }],
    ['sem login', { userProfileId: null }],
    ['com usuário removido ou desativado', { usuarioAtivo: false }],
  ])('aprovador %s: null, sem procurar outro', (_caso, indisponivel) => {
    const colaboradores = [
      colab({ id: 'marina', departamentoId: 'tecnica' }),
      colab({ id: 'paulo', departamentoId: 'tecnica', ...indisponivel }),
      colab({ id: 'louise', departamentoId: 'adm' }),
    ];
    const departamentos = [tecnica, { id: 'adm', aprovadorScId: 'louise' }];

    expect(resolveRequestApprover('user-marina', colaboradores, departamentos)).toBeNull();
  });

  it('aprovador do departamento abrindo a própria SC: null', () => {
    const colaboradores = [colab({ id: 'paulo', departamentoId: 'tecnica' })];

    expect(resolveRequestApprover('user-paulo', colaboradores, [tecnica])).toBeNull();
  });

  it('solicitante sem colaborador no RH: null', () => {
    const colaboradores = [colab({ id: 'paulo', departamentoId: 'tecnica' })];

    expect(resolveRequestApprover('user-sem-ficha', colaboradores, [tecnica])).toBeNull();
  });

  it('SC sem quem pediu não casa com colaborador sem login', () => {
    const colaboradores = [
      colab({ id: 'sem-login', userProfileId: null, departamentoId: 'tecnica' }),
      colab({ id: 'paulo', departamentoId: 'tecnica' }),
    ];

    expect(resolveRequestApprover(null, colaboradores, [tecnica])).toBeNull();
  });

  it('solicitante sem departamento: null', () => {
    const colaboradores = [colab({ id: 'marina' }), colab({ id: 'paulo', departamentoId: 'tecnica' })];

    expect(resolveRequestApprover('user-marina', colaboradores, [tecnica])).toBeNull();
  });

  it('departamento sem aprovador: null', () => {
    const colaboradores = [colab({ id: 'raquel', departamentoId: 'recepcao' })];

    expect(resolveRequestApprover('user-raquel', colaboradores, [{ id: 'recepcao', aprovadorScId: null }])).toBeNull();
  });

  it('aprovador lotado em outro departamento: vale (Paulo aprova o departamento da Eduarda)', () => {
    const colaboradores = [
      colab({ id: 'eduarda', departamentoId: 'bioquimica' }),
      colab({ id: 'paulo', departamentoId: 'tecnica' }),
    ];
    const departamentos = [tecnica, { id: 'bioquimica', aprovadorScId: 'paulo' }];

    expect(resolveRequestApprover('user-eduarda', colaboradores, departamentos)).toBe('user-paulo');
  });
});
