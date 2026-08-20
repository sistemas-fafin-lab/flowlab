import { describe, expect, it } from 'vitest';
import { getPermissionsForLegacyRole } from './permissions';

// O RLS do banco (current_user_has_permission) só reconhece
// custom_roles.permissions ou role = 'admin' — um operator/requester legado
// sem cargo customizado tem ZERO permissões no banco. Se o fallback do
// frontend sintetizar chaves que o RLS não concede, o usuário vê botões
// habilitados e leva 403 ao clicar (issue 04: frontend de Qualidade não
// checava canManageQualidade).
describe('getPermissionsForLegacyRole — chaves do módulo Qualidade', () => {
  it('não concede canViewQualidade nem canManageQualidade a operator legado', () => {
    const permissoes = getPermissionsForLegacyRole('operator');
    expect(permissoes).not.toContain('canViewQualidade');
    expect(permissoes).not.toContain('canManageQualidade');
  });

  it('não concede chaves de Qualidade a requester legado', () => {
    const permissoes = getPermissionsForLegacyRole('requester');
    expect(permissoes).not.toContain('canViewQualidade');
    expect(permissoes).not.toContain('canManageQualidade');
  });

  it('mantém as chaves de Qualidade para admin legado (role=admin é reconhecida pelo RLS)', () => {
    const permissoes = getPermissionsForLegacyRole('admin');
    expect(permissoes).toContain('canViewQualidade');
    expect(permissoes).toContain('canManageQualidade');
  });
});
