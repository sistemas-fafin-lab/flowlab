import { Department } from '../types';

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
  { key: 'canViewAllStockDepart', label: 'Ver Estoque de Todos os Setores', group: 'Estoque Departamental' },
  { key: 'canViewRequests', label: 'Visualizar Solicitações', group: 'Solicitações' },
  { key: 'canAddRequests', label: 'Criar Solicitações', group: 'Solicitações' },
  // Aprovar, iniciar cotação, finalizar e ver todos os setores em Solicitações.
  { key: 'canApproveRequests', label: 'Aprovar Solicitações', group: 'Solicitações' },
  // Aprovar, marcar como pago, excluir e ver todos os setores em Pagamentos.
  { key: 'canApprovePayments', label: 'Aprovar Pagamentos', group: 'Solicitações' },
  // Só leitura: ver os pagamentos de todos os setores, sem aprovar, pagar nem excluir.
  { key: 'canViewAllPayments', label: 'Ver Pagamentos de Todos os Setores', group: 'Solicitações' },
  // Aparecer em "Autorizado por" no pedido de pagamento; sem ela, ninguém é o autorizador,
  // nem o próprio solicitante (trigger payment_request_guard).
  { key: 'canAuthorizePayments', label: 'Ser Autorizador de Pagamentos', group: 'Solicitações' },
  // Iniciar, concluir, excluir e ver todos os setores em Manutenção (e os itens de estoque dela).
  { key: 'canManageMaintenance', label: 'Gerenciar Manutenção', group: 'Solicitações' },
  { key: 'canViewExpiration', label: 'Monitorar Vencimentos', group: 'Monitoramento' },
  { key: 'canViewChangelog', label: 'Visualizar Changelog', group: 'Monitoramento' },
  { key: 'canManageUsers', label: 'Gerenciar Usuários', group: 'Administração' },
  { key: 'canDeleteUsers', label: 'Excluir Usuários', group: 'Administração' },
  { key: 'canManageSuppliers', label: 'Gerenciar Fornecedores', group: 'Administração' },
  { key: 'canManageQuotations', label: 'Gerenciar Cotações', group: 'Administração' },
  { key: 'canConfigureRequestPeriods', label: 'Configurar Períodos', group: 'Administração' },
  { key: 'canViewBilling', label: 'Visualizar Faturamento', group: 'Administração' },
  { key: 'canManageBilling', label: 'Gerenciar Contas a Receber', group: 'Administração' },
  { key: 'canManageRoles', label: 'Gerenciar Cargos', group: 'Administração' },
  { key: 'canManageEmailTemplates', label: 'Gerenciar Templates de E-mail', group: 'Administração' },
  { key: 'canViewAllNotifications', label: 'Ver Notificações de Todos', group: 'Administração' },
  { key: 'canManageIT', label: 'Gerenciar TI', group: 'Tecnologia' },
  // Gastos de TI (docs/plans/gastos-ti) tem chaves próprias de propósito: canManageIT
  // libera Hub/Board/Mind Map para o time técnico, que não precisa ver contratos e
  // valores — e quem vê os gastos (ex.: Financeiro) não precisa do resto da TI.
  { key: 'canViewGastosTI', label: 'Visualizar Gastos de TI', group: 'Tecnologia' },
  { key: 'canManageGastosTI', label: 'Gerenciar Gastos de TI', group: 'Tecnologia' },
  // EVA, o agente de TI (docs/plans/agente-ti): três chaves separadas (D31). O Início e a
  // leitura da fila de sugestões ficam com canManageIT.
  // - Configurar: abas Membros e Configurações (telefones, liga/desliga, Granola, grupo).
  // - Gestor: cobrar a equipe, avisar o grupo e ver a fila do WhatsApp.
  // - Aprovar: aprovar e rejeitar o que a EVA propõe (D28), na tela e pelo WhatsApp.
  { key: 'canConfigureAgenteTI', label: 'Configurar a EVA (membros, WhatsApp, Granola)', group: 'Tecnologia' },
  { key: 'canManageAgenteTI', label: 'Gestor da EVA (cobrar a equipe, avisar o grupo, ver a fila do WhatsApp)', group: 'Tecnologia' },
  { key: 'canApproveAgenteTI', label: 'Aprovar sugestões da EVA', group: 'Tecnologia' },
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
  // Título, descrição, justificativa, prioridade, centro de custo e prazos, em qualquer status
  // fora cancelada/rejeitada. Separada de canCreateQuotations para decidir por cargo quem corrige
  // cotação já aprovada; o trigger quotation_guard_info_edit confere a mesma chave.
  { key: 'canEditQuotationInfo',   label: 'Editar informações da cotação',    group: 'Cotações' },
  // Excluir, decidir no lugar do gestor do pedido e aprovar sem limite de alçada.
  { key: 'canAdministerQuotations', label: 'Administrar Cotações',            group: 'Cotações' },
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
  // ── RH ──────────────────────────────────────────────────────────────────────
  { key: 'canViewColaboradores', label: 'Visualizar Colaboradores', group: 'RH' },
  // canManageHolerites é separada de canViewColaboradores de propósito (issue 05):
  // RH pode querer restringir quem sobe/gerencia holerite independente de quem só
  // visualiza/edita o cadastro de colaboradores.
  { key: 'canManageHolerites', label: 'Gerenciar Holerites', group: 'RH' },
  // canViewAllHolerites é somente-leitura: vê a lista completa e baixa qualquer
  // holerite, mas não envia nem remove. Quem tem canManageHolerites já enxerga
  // tudo isso (é um superset), então essa chave só importa pra quem NÃO gerencia.
  { key: 'canViewAllHolerites', label: 'Visualizar Todos os Holerites', group: 'RH' },
  // canViewHoleritesEquipe é escopada: só vê/baixa holerites de colaboradores cujo
  // gestor_id aponta pro colaborador vinculado ao usuário logado (RLS por
  // hierarquia, não por texto livre de departamento). Não é superset nem
  // subconjunto de canViewAllHolerites — são dois escopos independentes.
  { key: 'canViewHoleritesEquipe', label: 'Visualizar Holerites da Equipe (Gestor)', group: 'RH' },
  // ── Atendimento ─────────────────────────────────────────────────────────────
  // Gerador de Orçamento (.scratch/gerador-orcamento/spec.md): tela, busca, carrinho e
  // Orçamento do cliente. Custo e margem ficam numa chave à parte.
  { key: 'canUseGeradorOrcamento', label: 'Usar Gerador de Orçamento', group: 'Atendimento' },
];

// ─── Cargo padrão de todo cadastro novo ───────────────────────────────────────
// UUID fixo do cargo de sistema "Solicitante" (seed em 20260409120000_dynamic_roles_system).
// Todo perfil precisa nascer com um custom_role_id: as permissões vêm só do cargo, no front,
// no servidor e no banco (current_user_has_permission). A coluna legada user_profiles.role não
// conta desde 20261015180000_perm_sem_role_legado; um perfil sem cargo não tem permissão nenhuma.
export const SOLICITANTE_ROLE_ID = 'a0000000-0000-0000-0000-000000000003';

// ─── Departamentos ────────────────────────────────────────────────────────────
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

// ─── Autorização dinâmica ─────────────────────────────────────────────────────
export const hasPermission = (permissions: string[], permission: string): boolean => {
  return permissions.includes(permission);
};

