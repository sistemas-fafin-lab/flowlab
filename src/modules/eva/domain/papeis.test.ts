import { describe, expect, it } from 'vitest';
import { chavesDosPapeis, comPapeisDaPessoa, origemDosPapeis, papeisDoPerfil, papeisEva, SEM_PAPEIS } from './papeis';

describe('papéis da EVA (D31)', () => {
  it('cada chave libera um papel, sem arrastar os outros', () => {
    expect(papeisEva(['canConfigureAgenteTI'])).toEqual({ configura: true, gestor: false, aprova: false });
    expect(papeisEva(['canManageAgenteTI'])).toEqual({ configura: false, gestor: true, aprova: false });
    expect(papeisEva(['canApproveAgenteTI'])).toEqual({ configura: false, gestor: false, aprova: true });
    expect(papeisEva(['canManageIT'])).toEqual({ configura: false, gestor: false, aprova: false });
    expect(papeisEva(null)).toEqual({ configura: false, gestor: false, aprova: false });
  });

  it('pelo perfil (a regra do banco): admin tem os três; o operator legado, nenhum', () => {
    expect(papeisDoPerfil({ role: 'admin', permissoes: ['canManageIT'] })).toEqual({ configura: true, gestor: true, aprova: true });
    expect(papeisDoPerfil({ role: 'operator', permissoes: null })).toEqual({ configura: false, gestor: false, aprova: false });
    expect(papeisDoPerfil({ role: 'requester', permissoes: ['canManageIT', 'canApproveAgenteTI'] })).toEqual({ configura: false, gestor: false, aprova: true });
  });

  it('removido ou desativado não tem papel nenhum', () => {
    expect(papeisDoPerfil({ role: 'admin', disabled_at: '2026-10-01T00:00:00Z' })).toEqual({ configura: false, gestor: false, aprova: false });
    expect(papeisDoPerfil({ role: 'user', permissoes: ['canApproveAgenteTI'], deleted_at: '2026-10-01T00:00:00Z' }).aprova).toBe(false);
    expect(papeisDoPerfil(null).gestor).toBe(false);
  });
});

describe('papéis por pessoa (D33)', () => {
  const linha = { configura: false, gestor: true, aprova: false };

  it('com linha, vale a linha no lugar do cargo, inclusive para tirar', () => {
    const cargo = { role: 'requester', permissoes: ['canManageIT', 'canApproveAgenteTI'] };
    expect(papeisDoPerfil(cargo, linha)).toEqual(linha);
    expect(origemDosPapeis(cargo, linha)).toBe('definido');
    expect(papeisDoPerfil(cargo, null)).toEqual({ configura: false, gestor: false, aprova: true });
    expect(origemDosPapeis(cargo, null)).toBe('cargo');
  });

  it('admin tem os três mesmo com linha; desativado, nenhum mesmo com linha', () => {
    expect(papeisDoPerfil({ role: 'admin' }, SEM_PAPEIS)).toEqual({ configura: true, gestor: true, aprova: true });
    expect(origemDosPapeis({ role: 'admin' }, SEM_PAPEIS)).toBe('admin');
    expect(papeisDoPerfil({ role: 'user', disabled_at: '2026-10-01T00:00:00Z' }, linha)).toEqual(SEM_PAPEIS);
  });

  it('sobre as permissões da sessão: troca só as três chaves da EVA', () => {
    const cargo = ['canManageIT', 'canApproveAgenteTI', 'canViewRequests'];
    expect(comPapeisDaPessoa(cargo, null).sort()).toEqual([...cargo].sort());
    expect(comPapeisDaPessoa(cargo, linha).sort()).toEqual(['canManageAgenteTI', 'canManageIT', 'canViewRequests']);
    expect(comPapeisDaPessoa(['canManageIT'], SEM_PAPEIS, true).sort()).toEqual(['canApproveAgenteTI', 'canConfigureAgenteTI', 'canManageAgenteTI', 'canManageIT']);
    expect(comPapeisDaPessoa(null, { configura: true, gestor: false, aprova: true })).toEqual(['canConfigureAgenteTI', 'canApproveAgenteTI']);
  });

  it('chavesDosPapeis devolve as chaves marcadas', () => {
    expect(chavesDosPapeis({ configura: true, gestor: true, aprova: false })).toEqual(['canConfigureAgenteTI', 'canManageAgenteTI']);
    expect(papeisEva(chavesDosPapeis(linha))).toEqual(linha);
  });
});
