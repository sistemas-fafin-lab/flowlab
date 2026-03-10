import { Department, UserRole } from '../../../types';

// ============================================
// QUOTATION WORKFLOW STATUS
// ============================================
export type QuotationStatus =
  | 'draft'
  | 'sent_to_suppliers'
  | 'waiting_responses'
  | 'under_review'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'converted_to_purchase'
  | 'cancelled';

export const QuotationStatusLabels: Record<QuotationStatus, string> = {
  draft: 'Rascunho',
  sent_to_suppliers: 'Enviada aos Fornecedores',
  waiting_responses: 'Aguardando Respostas',
  under_review: 'Em Análise',
  awaiting_approval: 'Aguardando Aprovação',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  converted_to_purchase: 'Convertida em Pedido',
  cancelled: 'Cancelada',
};

export const QuotationStatusColors: Record<QuotationStatus, string> = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  sent_to_suppliers: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  waiting_responses: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200',
  under_review: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200',
  awaiting_approval: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
  approved: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  converted_to_purchase: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

// ============================================
// PROPOSAL STATUS
// ============================================
export type ProposalStatus =
  | 'pending'
  | 'submitted'
  | 'selected'
  | 'rejected'
  | 'expired';

export const ProposalStatusLabels: Record<ProposalStatus, string> = {
  pending: 'Aguardando',
  submitted: 'Enviada',
  selected: 'Selecionada',
  rejected: 'Rejeitada',
  expired: 'Expirada',
};

export const ProposalStatusColors: Record<ProposalStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  submitted: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  selected: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  expired: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
};

// ============================================
// APPROVAL LEVELS
// ============================================
export type ApprovalLevel = 'level_1' | 'level_2' | 'level_3' | 'level_4';

export interface ApprovalThreshold {
  level: ApprovalLevel;
  label: string;
  maxAmount: number;
  roles: UserRole[];
  description: string;
}

export const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    level: 'level_1',
    label: 'Nível 1 - Operacional',
    maxAmount: 5000,
    roles: ['operator'],
    description: 'Cotações até R$ 5.000,00',
  },
  {
    level: 'level_2',
    label: 'Nível 2 - Gerencial',
    maxAmount: 25000,
    roles: ['admin'],
    description: 'Cotações de R$ 5.000,01 até R$ 25.000,00',
  },
  {
    level: 'level_3',
    label: 'Nível 3 - Diretoria',
    maxAmount: 100000,
    roles: ['admin'],
    description: 'Cotações de R$ 25.000,01 até R$ 100.000,00',
  },
  {
    level: 'level_4',
    label: 'Nível 4 - Presidência',
    maxAmount: Infinity,
    roles: ['admin'],
    description: 'Cotações acima de R$ 100.000,00',
  },
];

// ============================================
// AUDIT LOG TYPES
// ============================================
export type QuotationActionType =
  | 'created'
  | 'updated'
  | 'sent_to_suppliers'
  | 'supplier_response'
  | 'proposal_selected'
  | 'proposal_rejected'
  | 'submitted_for_approval'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'converted_to_purchase'
  | 'cancelled'
  | 'comment_added'
  | 'item_added'
  | 'item_removed'
  | 'supplier_added'
  | 'supplier_removed';

export interface QuotationAuditLog {
  id: string;
  quotationId: string;
  action: QuotationActionType;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  details: Record<string, unknown>;
  metadata?: {
    previousStatus?: QuotationStatus;
    newStatus?: QuotationStatus;
    amount?: number;
    supplierId?: string;
    supplierName?: string;
    itemId?: string;
    itemName?: string;
    comment?: string;
  };
}

// ============================================
// QUOTATION ITEM (Product/Service)
// ============================================
export interface QuotationItem {
  id: string;
  quotationId: string;
  productId?: string;
  productName: string;
  productCode?: string;
  description?: string;
  quantity: number;
  unit: string;
  category: string;
  estimatedUnitPrice?: number;
  specifications?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INVITED SUPPLIER
// ============================================
export interface InvitedSupplier {
  id: string;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierPhone?: string;
  invitedAt: string;
  viewedAt?: string;
  status: 'invited' | 'viewed' | 'responded' | 'declined';
}

// ============================================
// SUPPLIER PROPOSAL
// ============================================
export interface SupplierProposal {
  id: string;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  status: ProposalStatus;
  items: ProposalItem[];
  totalAmount: number;
  deliveryTime: string;
  paymentTerms?: string;
  validUntil?: string;
  notes?: string;
  attachments?: ProposalAttachment[];
  submittedAt?: string;
  selectedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalItem {
  id: string;
  proposalId: string;
  quotationItemId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryTime?: string;
  brand?: string;
  notes?: string;
}

export interface ProposalAttachment {
  id: string;
  proposalId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

// ============================================
// APPROVAL RECORD
// ============================================
export interface QuotationApproval {
  id: string;
  quotationId: string;
  level: ApprovalLevel;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  approverName?: string;
  approverRole?: UserRole;
  amount: number;
  comment?: string;
  approvedAt?: string;
  rejectedAt?: string;
  createdAt: string;
}

// ============================================
// MAIN QUOTATION ENTITY
// ============================================
export interface Quotation {
  id: string;
  code: string;
  title: string;
  description?: string;
  status: QuotationStatus;
  
  // Optional link to request
  requestId?: string;
  requestCode?: string;
  
  // Items
  items: QuotationItem[];
  
  // Suppliers
  invitedSuppliers: InvitedSupplier[];
  proposals: SupplierProposal[];
  
  // Selected winner
  selectedProposalId?: string;
  selectedSupplierId?: string;
  selectedSupplierName?: string;
  selectedTotalAmount?: number;
  
  // Financial
  estimatedTotalAmount: number;
  finalTotalAmount?: number;
  
  // Approval
  requiredApprovalLevel: ApprovalLevel;
  currentApprovalLevel?: ApprovalLevel;
  approvals: QuotationApproval[];
  
  // Organizational
  department: Department;
  costCenter?: string;
  justification?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Deadlines
  responseDeadline?: string;
  deliveryDeadline?: string;
  
  // Audit
  auditLog: QuotationAuditLog[];
  
  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  
  // Converted purchase reference
  purchaseOrderId?: string;
  purchaseOrderCode?: string;
  convertedAt?: string;
}

// ============================================
// QUOTATION METRICS
// ============================================
export interface QuotationMetrics {
  totalActive: number;
  totalDraft: number;
  totalAwaitingApproval: number;
  totalApproved: number;
  totalRejected: number;
  totalConverted: number;
  totalValueUnderAnalysis: number;
  averageResponseTime: number; // in hours
  averageSavingsPercentage: number;
  proposalsReceived: number;
  suppliersInvited: number;
}

// ============================================
// COMPARISON DATA
// ============================================
export interface SupplierComparisonData {
  supplierId: string;
  supplierName: string;
  proposalId: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    deliveryTime?: string;
    isLowestPrice: boolean;
    isBestDelivery: boolean;
  }[];
  totalAmount: number;
  deliveryTime: string;
  paymentTerms?: string;
  isLowestTotal: boolean;
  isBestOverall: boolean;
  savingsVsHighest: number;
  savingsPercentage: number;
}

// ============================================
// FORM TYPES
// ============================================
export interface CreateQuotationInput {
  title: string;
  description?: string;
  requestId?: string;
  department: Department;
  costCenter?: string;
  justification?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  responseDeadline?: string;
  deliveryDeadline?: string;
  items: Omit<QuotationItem, 'id' | 'quotationId' | 'createdAt' | 'updatedAt'>[];
  supplierIds: string[];
}

export interface UpdateQuotationInput {
  title?: string;
  description?: string;
  costCenter?: string;
  justification?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  responseDeadline?: string;
  deliveryDeadline?: string;
}

export interface SubmitProposalInput {
  quotationId: string;
  supplierId: string;
  items: {
    quotationItemId: string;
    unitPrice: number;
    deliveryTime?: string;
    brand?: string;
    notes?: string;
  }[];
  deliveryTime: string;
  paymentTerms?: string;
  validUntil?: string;
  notes?: string;
}

// ============================================
// FILTER & SORT
// ============================================
export interface QuotationFilters {
  status?: QuotationStatus[];
  department?: Department[];
  priority?: ('low' | 'medium' | 'high' | 'urgent')[];
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  createdBy?: string;
}

export type QuotationSortField = 
  | 'createdAt'
  | 'updatedAt'
  | 'estimatedTotalAmount'
  | 'code'
  | 'status'
  | 'priority';

export type SortOrder = 'asc' | 'desc';

export interface QuotationSort {
  field: QuotationSortField;
  order: SortOrder;
}

// ============================================
// PERMISSIONS
// ============================================
export interface QuotationPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSendToSuppliers: boolean;
  canSelectWinner: boolean;
  canApprove: boolean;
  canReject: boolean;
  canConvertToPurchase: boolean;
  canCancel: boolean;
  maxApprovalAmount: number;
}
