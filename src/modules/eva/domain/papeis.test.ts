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

  it('pelo perfil: só o cargo conta (o role legado saiu)', () => {
    expect(papeisDoPerfil({ permissoes: ['canManageIT', 'canApproveAgenteTI'] })).toEqual({ configura: false, gestor: false, aprova: true });
    expect(papeisDoPerfil({ permissoes: null })).toEqual(SEM_PAPEIS);
    // Um perfil que ainda traga role = 'admin' não ganha nada por isso.
    expect(papeisDoPerfil({ role: 'admin', permissoes: ['canManageIT'] } as never)).toEqual(SEM_PAPEIS);
  });

  it('removido ou desativado não tem papel nenhum', () => {
    expect(papeisDoPerfil({ permissoes: ['canApproveAgenteTI'], disabled_at: '2026-10-01T00:00:00Z' })).toEqual(SEM_PAPEIS);
    expect(papeisDoPerfil({ permissoes: ['canApproveAgenteTI'], deleted_at: '2026-10-01T00:00:00Z' }).aprova).toBe(false);
    expect(papeisDoPerfil(null).gestor).toBe(false);
  });
});

describe('papéis por pessoa (D33)', () => {
  const linha = { configura: false, gestor: true, aprova: false };

  it('com linha, vale a linha no lugar do cargo, inclusive para tirar', () => {
    const cargo = { permissoes: ['canManageIT', 'canApproveAgenteTI'] };
    expect(papeisDoPerfil(cargo, linha)).toEqual(linha);
    expect(origemDosPapeis(cargo, linha)).toBe('definido');
    expect(papeisDoPerfil(cargo, null)).toEqual({ configura: false, gestor: false, aprova: true });
    expect(origemDosPapeis(cargo, null)).toBe('cargo');
  });

  it('desativado: nenhum, mesmo com linha', () => {
    expect(papeisDoPerfil({ disabled_at: '2026-10-01T00:00:00Z' }, linha)).toEqual(SEM_PAPEIS);
    expect(origemDosPapeis({ disabled_at: '2026-10-01T00:00:00Z' }, linha)).toBe('inativo');
  });

  it('sobre as permissões da sessão: troca só as três chaves da EVA', () => {
    const cargo = ['canManageIT', 'canApproveAgenteTI', 'canViewRequests'];
    expect(comPapeisDaPessoa(cargo, null).sort()).toEqual([...cargo].sort());
    expect(comPapeisDaPessoa(cargo, linha).sort()).toEqual(['canManageAgenteTI', 'canManageIT', 'canViewRequests']);
    expect(comPapeisDaPessoa(null, { configura: true, gestor: false, aprova: true })).toEqual(['canConfigureAgenteTI', 'canApproveAgenteTI']);
    expect(comPapeisDaPessoa(['canManageIT'], SEM_PAPEIS)).toEqual(['canManageIT']);
  });

  it('chavesDosPapeis devolve as chaves marcadas', () => {
    expect(chavesDosPapeis({ configura: true, gestor: true, aprova: false })).toEqual(['canConfigureAgenteTI', 'canManageAgenteTI']);
    expect(papeisEva(chavesDosPapeis(linha))).toEqual(linha);
  });
});
