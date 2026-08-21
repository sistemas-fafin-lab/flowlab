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
  // ── Estoque Departamental (Fase 5) ───────────────────────────────────────────
  { key: 'canViewStockDepart', label: 'Visualizar Estoque Departamental', group: 'Estoque Departamental' },
  { key: 'canConsumeStockDepart', label: 'Registrar Consumo do Setor', group: 'Estoque Departamental' },
  { key: 'canManageStockPostos', label: 'Gerenciar Estoque dos Postos', group: 'Estoque Departamental' },
  { key: 'canAddStockDepart', label: 'Registrar Entrada Direta no Setor', group: 'Estoque Departamental' },
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
  { key: 'canManageBilling', label: 'Gerenciar Contas a Receber', group: 'Administração' },
  { key: 'canManageRoles', label: 'Gerenciar Cargos', group: 'Administração' },
  { key: 'canManageIT', label: 'Gerenciar TI', group: 'Tecnologia' },
  { key: 'canManageWhitelist', label: 'Gerenciar Whitelist', group: 'Administração' },
  // ── Análises Clínicas ──────────────────────────────────────────────────────
  { key: 'canViewAnalisesClinicas', label: 'Visualizar Análises Clínicas', group: 'Análises Clínicas' },
  { key: 'canManageAnalisesClinicas', label: 'Gerenciar Postos e Horários', group: 'Análises Clínicas' },
  { key: 'canManageColetas', label: 'Gerenciar Coletas e Análises', group: 'Análises Clínicas' },
  { key: 'canDeleteAgendamentos', label: 'Cancelar Agendamentos', group: 'Análises Clínicas' },
  { key: 'canEditarAgendamentos', label: 'Editar Agendamentos', group: 'Análises Clínicas' },
  { key: 'canCorrigirIdentidade', label: 'Corrigir Identidade de Paciente', group: 'Análises Clínicas' },
  { key: 'canViewTemperatura', label: 'Visualizar Temperaturas (só leitura)', group: 'Análises Clínicas' },
  // ── Cotações (granular) ────────────────────────────────────────────────────
  { key: 'canViewQuotations',      label: 'Visualizar Cotações',              group: 'Cotações' },
  { key: 'canCreateQuotations',    label: 'Criar Cotações',                   group: 'Cotações' },
  { key: 'canAdvanceQuotation',    label: 'Avançar Etapa de Cotação',         group: 'Cotações' },
  { key: 'canRevertQuotation',     label: 'Retornar Etapa de Cotação',        group: 'Cotações' },
  { key: 'canSelectWinnerQuotation', label: 'Selecionar Proposta Vencedora',  group: 'Cotações' },
  { key: 'canSubmitForApproval',   label: 'Submeter Cotação para Aprovação',  group: 'Cotações' },
  { key: 'canConvertQuotation',    label: 'Converter Cotação em Pedido',      group: 'Cotações' },
  { key: 'canCancelQuotation',     label: 'Cancelar Cotação',                 group: 'Cotações' },
  // ── Sistemas Externos (não é um módulo do FlowLab — apenas usa este
  //    ecossistema de autenticação/permissões para controlar acesso) ─────────
  { key: 'canUseWhatsapp', label: 'Usar WhatsApp', group: 'Sistemas Externos' },
  // ── Qualidade ──────────────────────────────────────────────────────────────
  { key: 'canViewQualidade', label: 'Visualizar Qualidade', group: 'Qualidade' },
  { key: 'canManageQualidade', label: 'Gerenciar Qualidade (curadoria e sincronização)', group: 'Qualidade' },
  // ── Board (Kanban multi-departamento) ──────────────────────────────────────
  // Visualizar o próprio board não é uma permission: é implícito a qualquer
  // cargo com custom_roles.board_id preenchido (ver domain/resolveBoardAccess).
  { key: 'canManageBoard', label: 'Gerenciar Board do Próprio Cargo', group: 'Board' },
  { key: 'canManageAllBoards', label: 'Gerenciar Todos os Boards', group: 'Board' },
];

// ─── Cargo padrão de todo cadastro novo ───────────────────────────────────────
// UUID fixo do cargo de sistema "Solicitante" (seed em 20260409120000_dynamic_roles_system).
// Todo perfil precisa nascer com um custom_role_id: o fallback por role legada existe
// só no frontend (getPermissionsForLegacyRole). No banco, current_user_has_permission()
// olha apenas custom_roles.permissions (ou role = 'admin'), então um perfil sem cargo
// fica sem permissão nenhuma no RLS.
export const SOLICITANTE_ROLE_ID = 'a0000000-0000-0000-0000-000000000003';

// ─── Fallback: permissões para roles legadas (usado quando custom_role não existe) ─
// Atenção: no banco, current_user_has_permission() só honra
// custom_roles.permissions ou role = 'admin' — um operator/requester legado
// sem cargo customizado tem ZERO permissões no RLS. Chaves novas (como as do
// módulo Qualidade) ficam de fora do fallback de operator para não mostrar
// botões de escrita que o RLS vai negar com 403 (issue 04).
const LEGACY_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ALL_PERMISSION_KEYS.map(p => p.key),
  operator: ALL_PERMISSION_KEYS.map(p => p.key).filter(
    k => !['canViewDashboard', 'canManageUsers', 'canManageRoles', 'canManageIT', 'canViewQualidade', 'canManageQualidade', 'canManageBoard', 'canManageAllBoards'].includes(k)
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
  'Equipe Médica': 'requester',
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
  'Equipe Médica',
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