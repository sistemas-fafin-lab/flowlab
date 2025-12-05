export interface Product {
  id: string;
  name: string;
  code: string;
  category: 'general' | 'technical';
  quantity: number;
  unit: string;
  supplier: string;
  batch: string;
  entryDate: string;
  expirationDate: string;
  location: string;
  minStock: number;
  status: 'active' | 'expired' | 'low-stock';
  unitPrice: number; // Preço unitário obrigatório
  totalValue: number; // Valor total calculado (quantity * unitPrice)
  invoiceNumber: string;
  isWithholding: boolean;
  supplierId: string;
  supplierName: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'out';
  reason: 'sale' | 'internal-transfer' | 'return' | 'internal-consumption' | 'other';
  quantity: number;
  date: string;
  requestId?: string;
  authorizedBy?: string;
  notes?: string;
  unitPrice: number; // Preço unitário na movimentação
  totalValue: number; // Valor total da movimentação
}

export interface RequestItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  category: 'general' | 'technical' | string;
}

export interface Request {
  id: string;
  type: 'SC' | 'SM';
  items: RequestItem[];
  reason: string;
  requestedBy: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  priority: 'standard' | 'priority' | 'urgent';
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  department?: string;
  supplierId?: string | null;
  supplierName?: string;
  receiver_signature?: string;
  received_by?: string;
}

export interface ProductChangeLog {
  id: string;
  productId: string;
  productName: string;
  changedBy: string;
  changeReason: string;
  changeDate: string;
  changeTime: string;
  fieldChanges: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  createdAt: string;
}

export interface DashboardData {
  totalProducts: number;
  lowStockProducts: number;
  expiringProducts: number;
  recentMovements: number;
  categories: {
    general: number;
    technical: number;
  };
  // Indicadores financeiros baseados em dados reais
  totalInventoryValue: number;
  monthlyInventoryChange: number;
  monthlyInventoryChangePercent: number;
  totalMovementsValue: number;
  monthlyMovementsValue: number;
  monthlyMovementsChange: number;
  monthlyMovementsChangePercent: number;
  averageProductValue: number;
  topValueProducts: Product[];
  lowValueProducts: Product[];
  allCategories: Record<string, number>;
  allCategoryValues: Record<string, number>;
  categoryValues: {
    general: number;
    technical: number;
  };
}

export interface FinancialMetrics {
  currentMonth: {
    inventoryValue: number;
    movementsValue: number;
    movementsCount: number;
  };
  previousMonth: {
    inventoryValue: number;
    movementsValue: number;
    movementsCount: number;
  };
  trends: {
    inventoryValueChange: number;
    inventoryValueChangePercent: number;
    movementsValueChange: number;
    movementsValueChangePercent: number;
    movementsCountChange: number;
    movementsCountChangePercent: number;
  };
}

// New types for role-based access control
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
  | 'DIRETORIA';

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
};


export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: Department;
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
}

// Supplier types
export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address?: string;
  contactPerson?: string;
  products?: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// Quotation types
export interface Quotation {
  id: string;
  requestId: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  selectedSupplierId?: string;
  selectedPrice?: number;
  selectedDeliveryTime?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: QuotationItem[];
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  unitPrice?: number;
  totalPrice?: number;
  deliveryTime?: string;
  notes?: string;
  status: 'pending' | 'submitted' | 'selected' | 'rejected';
  submittedAt?: string;
  createdAt: string;
}

// Report types
export interface RequestReport {
  id: string;
  productName: string;
  quantity: number;
  requestedBy: string;
  department: string;
  status: string;
  requestDate: string;
  approvedBy?: string;
  approvalDate?: string;
  supplierName?: string;
}

export interface SupplierReport {
  supplierId: string;
  supplierName: string;
  totalQuotations: number;
  selectedQuotations: number;
  averagePrice: number;
  totalValue: number;
}

export interface DepartmentReport {
  department: string;
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingRequests: number;
  totalValue: number;
}

// Payment Request types
export type PaymentRequestType = 
  | 'PAGAMENTO'
  | 'REEMBOLSO'
  | 'ADIANTAMENTO';

export type PaymentMethod = 
  | 'PIX'
  | 'DINHEIRO'
  | 'BOLETO'
  | 'CAJU'
  | 'SOLIDES';

export type PaymentRequestStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'cancelled';

export interface PaymentRequest {
  id: string;
  codigo: string;
  codigoCompacto: string;
  tipoSolicitacao: PaymentRequestType;
  documentoNumero: string;
  fornecedor: string;
  cpfCnpj: string;
  valorTotal: number;
  formaPagamento: PaymentMethod;
  dadosPagamento: string;
  descricaoDetalhada: string;
  solicitadoPor: string;
  autorizadoPor?: string;
  dataPagamento: string;
  emailUsuario: string;
  department?: string;
  status: PaymentRequestStatus;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
}

export interface PaymentRequestFormValues {
  tipoSolicitacao: PaymentRequestType;
  documentoNumero: string;
  fornecedor: string;
  cpfCnpj: string;
  valorTotal: number;
  formaPagamento: PaymentMethod;
  dadosPagamento: string;
  descricaoDetalhada: string;
  solicitadoPor: string;
  autorizadoPor: string;
  dataPagamento: Date | string;
  emailUsuario: string;
}

export interface PaymentDateValidation {
  valid: boolean;
  date?: Date;
  suggestedDate?: Date;
  message?: string;
}

export interface PaymentRequestPayload {
  codigo: string;
  codigoCompacto: string;
  tipoSolicitacao: PaymentRequestType;
  documentoNumero: string;
  fornecedor: string;
  cpfCnpj: string;
  valorTotal: number;
  formaPagamento: PaymentMethod;
  dadosPagamento: string;
  descricaoDetalhada: string;
  solicitadoPor: string;
  autorizadoPor: string;
  dataPagamento: string;
  emailUsuario: string;
  department: string;
  status: PaymentRequestStatus;
}