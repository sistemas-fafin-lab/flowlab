import { describe, expect, it } from 'vitest';
import { papeisDoPerfil, papeisEva } from './papeis';

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
