import { UserRole, Department } from '../types';

// ─── Catálogo de todas as permissões do sistema ───────────────────────────────
export const ALL_PERMISSION_KEYS: { key: string; label: string; group: string }[] = [
  { key: 'canViewDashboard', label: 'Visualizar Dashboard', group: 'Dashboard' },
  { key: 'canManageProducts', label: 'Gerenciar Produtos', group: 'Produtos' },
  { key: 'canViewProducts', label: 'Visualizar Produtos', group: 'Produtos' },
  { key: 'canAddProducts', label: 'Adicionar Produtos', group: 'Produtos' },
  { key: 'canEditProducts', label: 'Editar Produtos', group: 'Produtos' },
  { key: 'canDeleteProducts', label: 'Excluir Produtos', group: 'Produtos' },
  { key: 'canViewMovements', label: 'Visualizar Movimentações', group: 'Movimentações' },
  { key: 'canAddMovements', label: 'Adicionar Movimentações', group: 'Movimentações' },
  { key: 'canViewRequests', label: 'Visualizar Solicitações', group: 'Solicitações' },
  { key: 'canAddRequests', label: 'Criar Solicitações', group: 'Solicitações' },
  { key: 'canApproveRequests', label: 'Aprovar Solicitações', group: 'Solicitações' },
  { key: 'canViewExpiration', label: 'Monitorar Vencimentos', group: 'Monitoramento' },
  { key: 'canViewChangelog', label: 'Visualizar Changelog', group: 'Monitoramento' },
  { key: 'canManageUsers', label: 'Gerenciar Usuários', group: 'Administração' },
  { key: 'canManageSuppliers', label: 'Gerenciar Fornecedores', group: 'Administração' },
  { key: 'canManageQuotations', label: 'Gerenciar Cotações', group: 'Administração' },
  { key: 'canConfigureRequestPeriods', label: 'Configurar Períodos', group: 'Administração' },
  { key: 'canViewBilling', label: 'Visualizar Faturamento', group: 'Administração' },
  { key: 'canManageRoles', label: 'Gerenciar Cargos', group: 'Administração' },
  { key: 'canManageIT', label: 'Gerenciar TI', group: 'Tecnologia' },
  // ── Cotações (granular) ────────────────────────────────────────────────────
  { key: 'canViewQuotations',      label: 'Visualizar Cotações',              group: 'Cotações' },
  { key: 'canCreateQuotations',    label: 'Criar Cotações',                   group: 'Cotações' },
  { key: 'canAdvanceQuotation',    label: 'Avançar Etapa de Cotação',         group: 'Cotações' },
  { key: 'canRevertQuotation',     label: 'Retornar Etapa de Cotação',        group: 'Cotações' },
  { key: 'canSelectWinnerQuotation', label: 'Selecionar Proposta Vencedora',  group: 'Cotações' },
  { key: 'canSubmitForApproval',   label: 'Submeter Cotação para Aprovação',  group: 'Cotações' },
  { key: 'canConvertQuotation',    label: 'Converter Cotação em Pedido',      group: 'Cotações' },
  { key: 'canCancelQuotation',     label: 'Cancelar Cotação',                 group: 'Cotações' },
];

// ─── Fallback: permissões para roles legadas (usado quando custom_role não existe) ─
const LEGACY_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ALL_PERMISSION_KEYS.map(p => p.key),
  operator: ALL_PERMISSION_KEYS.map(p => p.key).filter(
    k => !['canViewDashboard', 'canManageUsers', 'canManageRoles', 'canManageIT'].includes(k)
  ),
  requester: ['canViewRequests', 'canAddRequests'],
};

export const getPermissionsForLegacyRole = (role: UserRole): string[] => {
  return LEGACY_ROLE_PERMISSIONS[role] || [];
};

// ─── Departamentos ────────────────────────────────────────────────────────────
export const DEPARTMENT_ROLES: Record<string, UserRole> = {
  'Transporte': 'requester',
  'Estoque': 'admin',
  'Financeiro': 'admin',
  'Faturamento': 'requester',
  'Área técnica': 'requester',
  'RH': 'requester',
  'Comercial': 'requester',
  'TI': 'operator',
  'Atendimento': 'requester',
  'Diretoria': 'admin',
  'Copa/Limpeza': 'requester',
  'Qualidade': 'requester',
  'Biologia Molecular': 'requester',
};

export const DEPARTMENTS: Department[] = [
  'Transporte',
  'Estoque',
  'Financeiro',
  'Faturamento',
  'Área técnica',
  'RH',
  'Comercial',
  'Marketing',
  'TI',
  'Atendimento',
  'Diretoria',
  'Copa/Limpeza',
  'Qualidade',
  'Biologia Molecular',
] as any;

export const getDepartmentLabel = (department: Department): string => {
  return department as any;
};

export const getRoleForDepartment = (department: Department): UserRole => {
  return DEPARTMENT_ROLES[department as any] || 'requester';
};

// ─── Autorização dinâmica ─────────────────────────────────────────────────────
export const hasPermission = (permissions: string[], permission: string): boolean => {
  return permissions.includes(permission);
};

// ─── Label legado (fallback quando roleName não está disponível) ──────────────
export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    operator: 'Operador',
    requester: 'Solicitante',
  };
  return labels[role];
};