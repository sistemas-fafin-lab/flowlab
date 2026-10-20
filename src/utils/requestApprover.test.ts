import { describe, expect, it } from 'vitest';
import { resolveRequestApprover, type ColaboradorNaCadeia } from './requestApprover';

const colab = (c: Partial<ColaboradorNaCadeia> & Pick<ColaboradorNaCadeia, 'id'>): ColaboradorNaCadeia => ({
  gestorId: null,
  userProfileId: `user-${c.id}`,
  status: 'ativo',
  aprovaSolicitacaoCompra: false,
  usuarioAtivo: true,
  ...c,
});

describe('resolveRequestApprover', () => {
  it('cadeia simples: o gestor direto aprovador é o aprovador', () => {
    const colaboradores = [
      colab({ id: 'ana', gestorId: 'louise' }),
      colab({ id: 'louise', aprovaSolicitacaoCompra: true }),
    ];

    expect(resolveRequestApprover('user-ana', colaboradores)).toBe('user-louise');
  });

  it('pula gestor não aprovador: Marina → Eduarda → Paulo', () => {
    const colaboradores = [
      colab({ id: 'marina', gestorId: 'eduarda' }),
      colab({ id: 'eduarda', gestorId: 'paulo' }),
      colab({ id: 'paulo', aprovaSolicitacaoCompra: true }),
    ];

    expect(resolveRequestApprover('user-marina', colaboradores)).toBe('user-paulo');
  });

  it.each([
    ['desligado', { status: 'desligado' as const }],
    ['sem login', { userProfileId: null }],
    ['com usuário removido ou desativado', { usuarioAtivo: false }],
  ])('pula aprovador %s e continua subindo', (_caso, indisponivel) => {
    const colaboradores = [
      colab({ id: 'marina', gestorId: 'eduarda' }),
      colab({ id: 'eduarda', gestorId: 'paulo', aprovaSolicitacaoCompra: true, ...indisponivel }),
      colab({ id: 'paulo', aprovaSolicitacaoCompra: true }),
    ];

    expect(resolveRequestApprover('user-marina', colaboradores)).toBe('user-paulo');
  });

  it('cadeia sem aprovador: null', () => {
    const colaboradores = [
      colab({ id: 'marina', gestorId: 'eduarda' }),
      colab({ id: 'eduarda' }),
    ];

    expect(resolveRequestApprover('user-marina', colaboradores)).toBeNull();
  });

  it('topo sem gestor abrindo a própria SC: null, mesmo sendo aprovador (nunca começa no solicitante)', () => {
    const colaboradores = [colab({ id: 'paulo', aprovaSolicitacaoCompra: true })];

    expect(resolveRequestApprover('user-paulo', colaboradores)).toBeNull();
  });

  it('solicitante sem colaborador no RH: null', () => {
    const colaboradores = [colab({ id: 'paulo', aprovaSolicitacaoCompra: true })];

    expect(resolveRequestApprover('user-sem-ficha', colaboradores)).toBeNull();
    expect(resolveRequestApprover(null, colaboradores)).toBeNull();
  });

  it('SC sem quem pediu não casa com colaborador sem login', () => {
    const colaboradores = [
      colab({ id: 'sem-login', userProfileId: null, gestorId: 'paulo' }),
      colab({ id: 'paulo', aprovaSolicitacaoCompra: true }),
    ];

    expect(resolveRequestApprover(null, colaboradores)).toBeNull();
  });

  it('ciclo na cadeia (barrado no banco) não trava: null', () => {
    const colaboradores = [
      colab({ id: 'marina', gestorId: 'eduarda' }),
      colab({ id: 'eduarda', gestorId: 'luanna' }),
      colab({ id: 'luanna', gestorId: 'eduarda' }),
    ];

    expect(resolveRequestApprover('user-marina', colaboradores)).toBeNull();
  });
});
