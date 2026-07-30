// Extraído de src/types/index.ts do projeto original.
// Contém apenas os tipos de que o módulo de TI depende (auth/permissões).

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
