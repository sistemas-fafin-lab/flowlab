import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_KEYS } from './permissions';

// Desde 20261015180000_perm_sem_role_legado, as permissões vêm só do cargo (custom_roles), no
// front, no servidor e no banco. "Administrador" é quem tem o cargo Administrador, e por isso
// esse cargo precisa ter todas as chaves do catálogo: a migration grava a lista abaixo nele.
const MIGRATION = new URL('../../supabase/migrations/20261015180000_perm_sem_role_legado.sql', import.meta.url);

// Chaves criadas depois dela: cada uma é concedida ao cargo Administrador pela própria migration.
const CHAVES_POSTERIORES: Record<string, string> = {
  canEditQuotationInfo: '20261019120000_quotation_info_edit.sql',
  canViewAllPayments: '20261020120000_pagamentos_ver_todos_e_autorizador.sql',
  canAuthorizePayments: '20261020120000_pagamentos_ver_todos_e_autorizador.sql',
};

/** As chaves do ARRAY[...] da seção 1 da migration (o cargo Administrador). */
function chavesDoAdministrador(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const bloco = sql.slice(sql.indexOf('SELECT unnest(ARRAY['), sql.indexOf('])', sql.indexOf('SELECT unnest(ARRAY[')));
  return [...bloco.matchAll(/'(can\w+)'/g)].map((m) => m[1]);
}

describe('catálogo de permissões', () => {
  it('não repete chave', () => {
    const chaves = ALL_PERMISSION_KEYS.map((p) => p.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('o cargo Administrador da migration tem exatamente as chaves do catálogo', () => {
    const catalogo = ALL_PERMISSION_KEYS.map((p) => p.key).sort();
    expect([...chavesDoAdministrador(), ...Object.keys(CHAVES_POSTERIORES)].sort()).toEqual(catalogo);
  });

  it('cada chave posterior é concedida ao cargo Administrador na migration dela', () => {
    for (const [chave, arquivo] of Object.entries(CHAVES_POSTERIORES)) {
      const sql = readFileSync(new URL(`../../supabase/migrations/${arquivo}`, import.meta.url), 'utf8');
      expect(sql).toContain(`'["${chave}"]'`);
      expect(sql).toContain("cr.id = 'a0000000-0000-0000-0000-000000000001'");
    }
  });

  it('as chaves que substituem o role legado estão no catálogo', () => {
    const chaves = ALL_PERMISSION_KEYS.map((p) => p.key);
    for (const k of ['canApprovePayments', 'canManageMaintenance', 'canManageEmailTemplates', 'canViewAllStockDepart', 'canViewAllNotifications', 'canAdministerQuotations']) {
      expect(chaves).toContain(k);
    }
  });
});
