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

describe('getPermissionsForLegacyRole — canViewColaboradores (módulo RH)', () => {
  it('não concede canViewColaboradores a operator legado', () => {
    const permissoes = getPermissionsForLegacyRole('operator');
    expect(permissoes).not.toContain('canViewColaboradores');
  });

  it('não concede canViewColaboradores a requester legado', () => {
    const permissoes = getPermissionsForLegacyRole('requester');
    expect(permissoes).not.toContain('canViewColaboradores');
  });

  it('mantém canViewColaboradores para admin legado (role=admin é reconhecida pelo RLS)', () => {
    const permissoes = getPermissionsForLegacyRole('admin');
    expect(permissoes).toContain('canViewColaboradores');
  });
});

describe('getPermissionsForLegacyRole — canManageHolerites (issue 05)', () => {
  it('não concede canManageHolerites a operator legado', () => {
    const permissoes = getPermissionsForLegacyRole('operator');
    expect(permissoes).not.toContain('canManageHolerites');
  });

  it('não concede canManageHolerites a requester legado', () => {
    const permissoes = getPermissionsForLegacyRole('requester');
    expect(permissoes).not.toContain('canManageHolerites');
  });

  it('mantém canManageHolerites para admin legado (role=admin é reconhecida pelo RLS)', () => {
    const permissoes = getPermissionsForLegacyRole('admin');
    expect(permissoes).toContain('canManageHolerites');
  });
});

describe('getPermissionsForLegacyRole — chaves do módulo Gastos de TI', () => {
  it('não concede canViewGastosTI nem canManageGastosTI a operator legado', () => {
    const permissoes = getPermissionsForLegacyRole('operator');
    expect(permissoes).not.toContain('canViewGastosTI');
    expect(permissoes).not.toContain('canManageGastosTI');
  });

  it('não concede chaves de Gastos de TI a requester legado', () => {
    const permissoes = getPermissionsForLegacyRole('requester');
    expect(permissoes).not.toContain('canViewGastosTI');
    expect(permissoes).not.toContain('canManageGastosTI');
  });

  it('mantém as chaves de Gastos de TI para admin legado (role=admin é reconhecida pelo RLS)', () => {
    const permissoes = getPermissionsForLegacyRole('admin');
    expect(permissoes).toContain('canViewGastosTI');
    expect(permissoes).toContain('canManageGastosTI');
  });
});

describe('getPermissionsForLegacyRole — canApproveAgenteTI (EVA)', () => {
  it('não concede canApproveAgenteTI a operator legado', () => {
    expect(getPermissionsForLegacyRole('operator')).not.toContain('canApproveAgenteTI');
  });

  it('não concede canApproveAgenteTI a requester legado', () => {
    expect(getPermissionsForLegacyRole('requester')).not.toContain('canApproveAgenteTI');
  });

  it('mantém canApproveAgenteTI para admin legado (role=admin é reconhecida pelo RLS)', () => {
    expect(getPermissionsForLegacyRole('admin')).toContain('canApproveAgenteTI');
  });
});
