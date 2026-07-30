// Extraído de src/types/index.ts do projeto original.
// Contém apenas os tipos de que o módulo de usuários/permissões depende.

export type UserRole = 'admin' | 'operator' | 'requester';

export type Department =
  | 'TRANSPORTE'
  | 'ESTOQUE'
  | 'FINANCEIRO'
  | 'FATURAMENTO'
  | 'AREA_TECNICA'
  | 'RH'
  | 'COMERCIAL'
  | 'TI'
  | 'MARKETING'
  | 'QUALIDADE'
  | 'COPA_LIMPEZA'
  | 'ATENDIMENTO'
  | 'DIRETORIA'
  | 'BIOLOGIA_MOLECULAR'
  | 'EQUIPE_MEDICA';

export const DepartmentLabels: Record<Department, string> = {
  TRANSPORTE: 'Transporte',
  ESTOQUE: 'Estoque',
  FINANCEIRO: 'Financeiro',
  FATURAMENTO: 'Faturamento',
  AREA_TECNICA: 'Área técnica',
  RH: 'RH',
  COMERCIAL: 'Comercial',
  TI: 'TI',
  MARKETING: 'Marketing',
  QUALIDADE: 'Qualidade',
  COPA_LIMPEZA: 'Copa/Limpeza',
  ATENDIMENTO: 'Atendimento',
  DIRETORIA: 'Diretoria',
  BIOLOGIA_MOLECULAR: 'Biologia Molecular',
  EQUIPE_MEDICA: 'Equipe Médica',
};

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: Department;
  createdAt: string;
  updatedAt: string;
  customRoleId?: string;
  permissions: string[];
  roleName?: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissions {
  canViewDashboard: boolean;
  canManageProducts: boolean;
  canViewProducts: boolean;
  canAddProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canViewMovements: boolean;
  canAddMovements: boolean;
  canViewRequests: boolean;
  canAddRequests: boolean;
  canApproveRequests: boolean;
  canViewExpiration: boolean;
  canViewChangelog: boolean;
  canManageUsers: boolean;
  canManageSuppliers: boolean;
  canManageQuotations: boolean;
  canConfigureRequestPeriods: boolean;
  canViewBilling: boolean;
  canManageRoles: boolean;
}
