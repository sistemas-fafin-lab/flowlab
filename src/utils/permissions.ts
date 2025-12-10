import { UserRole, RolePermissions, Department } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewDashboard: true,
    canManageProducts: true,
    canViewProducts: true,
    canAddProducts: true,
    canEditProducts: true,
    canDeleteProducts: true,
    canViewMovements: true,
    canAddMovements: true,
    canViewRequests: true,
    canAddRequests: true,
    canApproveRequests: true,
    canViewExpiration: true,
    canViewChangelog: true,
    canManageUsers: true,
    canManageSuppliers: true,
    canManageQuotations: true,
    canConfigureRequestPeriods: true,
  },
  operator: {
    canViewDashboard: false,
    canManageProducts: true,
    canViewProducts: true,
    canAddProducts: true,
    canEditProducts: true,
    canDeleteProducts: true,
    canViewMovements: true,
    canAddMovements: true,
    canViewRequests: true,
    canAddRequests: true,
    canApproveRequests: true,
    canViewExpiration: true,
    canViewChangelog: true,
    canManageUsers: false,
    canManageSuppliers: true,
    canManageQuotations: true,
    canConfigureRequestPeriods: true,
  },
  requester: {
    canViewDashboard: false,
    canManageProducts: false,
    canViewProducts: false,
    canAddProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewMovements: false,
    canAddMovements: false,
    canViewRequests: true,
    canAddRequests: true,
    canApproveRequests: false,
    canViewExpiration: false,
    canViewChangelog: false,
    canManageUsers: false,
    canManageSuppliers: false,
    canManageQuotations: false,
    canConfigureRequestPeriods: false,
  },
};

export const DEPARTMENT_ROLES: Record<Department, UserRole> = {
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
];

export const getRolePermissions = (role: UserRole): RolePermissions => {
  return ROLE_PERMISSIONS[role];
};

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    operator: 'Operador',
    requester: 'Solicitante',
  };
  return labels[role];
};

export const getDepartmentLabel = (department: Department): string => {
  return department;
};

export const getRoleForDepartment = (department: Department): UserRole => {
  return DEPARTMENT_ROLES[department];
};

export const hasPermission = (userRole: UserRole, permission: keyof RolePermissions): boolean => {
  return ROLE_PERMISSIONS[userRole][permission];
};