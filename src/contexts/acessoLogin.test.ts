import { describe, expect, it } from 'vitest';
import { podeEntrar } from './acessoLogin';

describe('podeEntrar', () => {
  it('conta ativa entra, mesmo sem CPF (contas de setor)', () => {
    expect(podeEntrar({ disabled_at: null, deleted_at: null })).toBe(true);
  });

  it('sem perfil não entra', () => {
    expect(podeEntrar(null)).toBe(false);
  });

  it('conta desativada não entra', () => {
    expect(podeEntrar({ disabled_at: '2026-11-12T10:00:00Z', deleted_at: null })).toBe(false);
  });

  it('conta excluída não entra', () => {
    expect(podeEntrar({ disabled_at: null, deleted_at: '2026-11-12T10:00:00Z' })).toBe(false);
  });
});
