import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import {
  Quotation,
  QuotationStatus,
  QuotationItem,
  InvitedSupplier,
  SupplierProposal,
  ProposalItem,
  QuotationApproval,
  QuotationAuditLog,
  QuotationMetrics,
  QuotationFilters,
  QuotationSort,
  CreateQuotationInput,
  UpdateQuotationInput,
  SubmitProposalInput,
  QuotationPermissions,
  ApprovalLevel,
  APPROVAL_THRESHOLDS,
  QuotationActionType,
} from '../types';
import {
  canTransition,
  validateTransition,
  canEditQuotation,
  canModifyItems,
  canModifySuppliers,
  canSelectWinner,
  canSubmitForApproval,
  canApproveOrReject,
  canConvertToPurchase,
  canCancel,
} from '../workflow/stateMachine';

// Generate unique quotation code
const generateQuotationCode = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `COT-${year}${month}-${random}`;
};

// Get required approval level based on amount
const getRequiredApprovalLevel = (amount: number): ApprovalLevel => {
  for (const threshold of APPROVAL_THRESHOLDS) {
    if (amount <= threshold.maxAmount) {
      return threshold.level;
    }
  }
  return 'level_4';
};

export const useQuotation = () => {
  const { user, userProfile } = useAuth();
  
  // State
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; email: string; phone?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  
  // User approval limits from database
  const [userApprovalConfig, setUserApprovalConfig] = useState<{
    approvalLevel: string;
    maxAmount: number;
    canApprove: boolean;
  } | null>(null);
  
  // Filters and sorting
  const [filters, setFilters] = useState<QuotationFilters>({});
  const [sort, setSort] = useState<QuotationSort>({ field: 'createdAt', order: 'desc' });

  // ============================================
  // DATA FETCHING
  // ============================================
  
  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      
      // For now, fetch from the existing quotations table
      // In production, this would be a new quotations_v2 table with the full schema
      const { data, error: fetchError } = await supabase
        .from('quotations')
        .select(`
          *,
          quotation_items (*),
          quotation_invited_suppliers (*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to new model (backward compatible)
      const transformedQuotations: Quotation[] = (data || []).map((q: any) => ({
        id: q.id,
        code: q.code || `COT-${q.id.slice(0, 8).toUpperCase()}`,
        title: q.title || q.product_name || 'Cotação sem título',
        description: q.description,
        status: mapLegacyStatus(q.status),
        requestId: q.request_id,
        requestCode: q.request_code,
        items: (q.quotation_items || []).map((item: any) => ({
          id: item.id,
          quotationId: q.id,
          productId: item.product_id,
          productName: item.product_name || q.product_name,
          productCode: item.product_code,
          description: item.description,
          quantity: item.quantity || q.requested_quantity,
          unit: item.unit || 'un',
          category: item.category || 'general',
          estimatedUnitPrice: item.estimated_unit_price,
          specifications: item.specifications,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        invitedSuppliers: (q.quotation_invited_suppliers || []).map((supplier: any) => ({
          id: supplier.id,
          quotationId: q.id,
          supplierId: supplier.supplier_id,
          supplierName: supplier.supplier_name,
          supplierEmail: supplier.supplier_email,
          supplierPhone: supplier.supplier_phone,
          invitedAt: supplier.invited_at,
          respondedAt: supplier.responded_at,
          status: supplier.status === 'responded' ? 'responded' : supplier.status === 'declined' ? 'declined' : 'invited',
        })),
        proposals: [],
        selectedProposalId: q.selected_proposal_id,
        selectedSupplierId: q.selected_supplier_id,
        selectedSupplierName: q.selected_supplier_name,
        selectedTotalAmount: q.selected_price,
        estimatedTotalAmount: q.estimated_total || 0,
        finalTotalAmount: q.selected_price,
        requiredApprovalLevel: getRequiredApprovalLevel(q.estimated_total || q.selected_price || 0),
        currentApprovalLevel: undefined,
        approvals: [],
        department: q.department || 'ESTOQUE',
        costCenter: q.cost_center,
        justification: q.justification,
        priority: q.priority || 'medium',
        responseDeadline: q.response_deadline,
        deliveryDeadline: q.delivery_deadline,
        auditLog: [],
        createdBy: q.created_by,
        createdByName: q.created_by_name || 'Sistema',
        createdAt: q.created_at,
        updatedAt: q.updated_at,
        purchaseOrderId: q.purchase_order_id,
        purchaseOrderCode: q.purchase_order_code,
        convertedAt: q.converted_at,
      }));

      setQuotations(transformedQuotations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cotações');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, name, email, phone')
        .eq('status', 'active')
        .order('name');

      if (fetchError) throw fetchError;
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  }, []);

  // Fetch user's approval limits from database
  const fetchUserApprovalLimit = useCallback(async () => {
    if (!user?.id) {
      setUserApprovalConfig(null);
      return;
    }

    try {
      // Try the view first (includes effective amount calculation)
      let effectiveAmount: number | null = null;
      let approvalLevel: string | null = null;
      let canApprove: boolean | null = null;

      const viewResult = await supabase
        .from('user_approval_limits_with_details')
        .select('approval_level, effective_max_amount, can_approve')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!viewResult.error && viewResult.data) {
        approvalLevel = viewResult.data.approval_level;
        effectiveAmount = viewResult.data.effective_max_amount;
        canApprove = viewResult.data.can_approve;
      } else {
        // Fallback: query user_approval_limits and approval_level_config separately
        const limitsResult = await supabase
          .from('user_approval_limits')
          .select('approval_level, custom_max_amount, can_approve')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!limitsResult.error && limitsResult.data) {
          approvalLevel = limitsResult.data.approval_level;
          canApprove = limitsResult.data.can_approve;

          if (limitsResult.data.custom_max_amount) {
            effectiveAmount = limitsResult.data.custom_max_amount;
          } else {
            // Get level's default amount
            const configResult = await supabase
              .from('approval_level_config')
              .select('max_amount')
              .eq('level', approvalLevel)
              .maybeSingle();

            if (!configResult.error && configResult.data) {
              effectiveAmount = configResult.data.max_amount;
            }
          }
        }
      }

      if (approvalLevel !== null && effectiveAmount !== null && canApprove !== null) {
        setUserApprovalConfig({
          approvalLevel,
          maxAmount: effectiveAmount >= 999999999 ? Infinity : effectiveAmount,
          canApprove,
        });
      } else {
        // No record found, use role-based defaults
        const role = userProfile?.role || 'requester';
        setUserApprovalConfig({
          approvalLevel: role === 'admin' ? 'level_4' : role === 'operator' ? 'level_1' : 'none',
          maxAmount: role === 'admin' ? Infinity : role === 'operator' ? 5000 : 0,
          canApprove: role === 'admin' || role === 'operator',
        });
      }
    } catch (err) {
      console.error('Error fetching approval limits:', err);
      // Fallback to role-based defaults
      const role = userProfile?.role || 'requester';
      setUserApprovalConfig({
        approvalLevel: role === 'admin' ? 'level_4' : role === 'operator' ? 'level_1' : 'none',
        maxAmount: role === 'admin' ? Infinity : role === 'operator' ? 5000 : 0,
        canApprove: role === 'admin' || role === 'operator',
      });
    }
  }, [user?.id, userProfile?.role]);

  // Map legacy status to new status
  const mapLegacyStatus = (status: string): QuotationStatus => {
    const mapping: Record<string, QuotationStatus> = {
      draft: 'draft',
      open: 'draft',
      pending: 'draft',
      in_progress: 'waiting_responses',
      completed: 'approved',
      cancelled: 'cancelled',
    };
    return mapping[status] || 'draft';
  };

  // Initial fetch
  useEffect(() => {
    fetchQuotations();
    fetchSuppliers();
  }, [fetchQuotations, fetchSuppliers]);

  // Fetch user approval limits when user changes
  useEffect(() => {
    fetchUserApprovalLimit();
  }, [fetchUserApprovalLimit]);

  // ============================================
  // FILTERED AND SORTED DATA
  // ============================================
  
  const filteredQuotations = useMemo(() => {
    let result = [...quotations];

    // Apply filters
    if (filters.status?.length) {
      result = result.filter(q => filters.status!.includes(q.status));
    }
    if (filters.department?.length) {
      result = result.filter(q => filters.department!.includes(q.department));
    }
    if (filters.priority?.length) {
      result = result.filter(q => filters.priority!.includes(q.priority));
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(q =>
        q.code.toLowerCase().includes(search) ||
        q.title.toLowerCase().includes(search) ||
        q.items.some(i => i.productName.toLowerCase().includes(search))
      );
    }
    if (filters.minAmount !== undefined) {
      result = result.filter(q => q.estimatedTotalAmount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      result = result.filter(q => q.estimatedTotalAmount <= filters.maxAmount!);
    }
    if (filters.dateFrom) {
      result = result.filter(q => new Date(q.createdAt) >= new Date(filters.dateFrom!));
    }
    if (filters.dateTo) {
      result = result.filter(q => new Date(q.createdAt) <= new Date(filters.dateTo!));
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.field) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'estimatedTotalAmount':
          comparison = a.estimatedTotalAmount - b.estimatedTotalAmount;
          break;
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }
      return sort.order === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [quotations, filters, sort]);

  // ============================================
  // METRICS
  // ============================================
  
  const metrics = useMemo((): QuotationMetrics => {
    const active = quotations.filter(q => 
      !['approved', 'rejected', 'cancelled', 'converted_to_purchase'].includes(q.status)
    );
    
    return {
      totalActive: active.length,
      totalDraft: quotations.filter(q => q.status === 'draft').length,
      totalAwaitingApproval: quotations.filter(q => q.status === 'awaiting_approval').length,
      totalApproved: quotations.filter(q => q.status === 'approved').length,
      totalRejected: quotations.filter(q => q.status === 'rejected').length,
      totalConverted: quotations.filter(q => q.status === 'converted_to_purchase').length,
      totalValueUnderAnalysis: active.reduce((sum, q) => sum + q.estimatedTotalAmount, 0),
      averageResponseTime: 48, // TODO: Calculate from actual data
      averageSavingsPercentage: 15, // TODO: Calculate from actual data
      proposalsReceived: quotations.reduce((sum, q) => sum + q.proposals.length, 0),
      suppliersInvited: quotations.reduce((sum, q) => sum + q.invitedSuppliers.length, 0),
    };
  }, [quotations]);

  // ============================================
  // PERMISSIONS
  // ============================================
  
  const getPermissions = useCallback((quotation?: Quotation): QuotationPermissions => {
    const role = userProfile?.role || 'requester';
    const isAdmin = role === 'admin';
    const isOperator = role === 'operator';
    
    // Get user's max approval amount from database config or fallback to role-based defaults
    const userApprovalLimit = userApprovalConfig?.maxAmount ?? (isAdmin ? Infinity : isOperator ? 5000 : 0);
    const userCanApprove = userApprovalConfig?.canApprove ?? (isAdmin || isOperator);
    
    // Base permissions
    const canView = isAdmin || isOperator;
    const canCreate = isAdmin || isOperator;
    
    // Admin has full permissions without restrictions
    if (isAdmin) {
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canSendToSuppliers: true,
        canSelectWinner: true,
        canApprove: true,
        canReject: true,
        canConvertToPurchase: true,
        canCancel: true,
        maxApprovalAmount: Infinity,
      };
    }
    
    // Quotation-specific permissions for non-admin users
    if (!quotation) {
      return {
        canView,
        canCreate,
        canEdit: false,
        canDelete: false,
        canSendToSuppliers: false,
        canSelectWinner: false,
        canApprove: false,
        canReject: false,
        canConvertToPurchase: false,
        canCancel: false,
        maxApprovalAmount: userApprovalLimit,
      };
    }

    const status = quotation.status;
    const quotationAmount = quotation.finalTotalAmount || quotation.estimatedTotalAmount || 0;
    
    return {
      canView,
      canCreate,
      canEdit: canView && canEditQuotation(status),
      canDelete: false, // Only admin can delete
      canSendToSuppliers: canView && status === 'draft',
      canSelectWinner: canView && canSelectWinner(status),
      canApprove: userCanApprove && canApproveOrReject(status) && quotationAmount <= userApprovalLimit,
      canReject: userCanApprove && canApproveOrReject(status),
      canConvertToPurchase: false, // Only admin can convert
      canCancel: canView && canCancel(status),
      maxApprovalAmount: userApprovalLimit,
    };
  }, [userProfile, userApprovalConfig]);

  // ============================================
  // AUDIT LOG
  // ============================================
  
  const addAuditLog = useCallback(async (
    quotationId: string,
    action: QuotationActionType,
    details: Record<string, unknown> = {},
    metadata?: QuotationAuditLog['metadata']
  ) => {
    if (!user || !userProfile) return;

    const logEntry: Omit<QuotationAuditLog, 'id'> = {
      quotationId,
      action,
      performedBy: user.id,
      performedByName: userProfile.name,
      performedAt: new Date().toISOString(),
      details,
      metadata,
    };

    // In production, save to database
    // For now, update local state
    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          auditLog: [...q.auditLog, { ...logEntry, id: crypto.randomUUID() }],
        };
      }
      return q;
    }));
  }, [user, userProfile]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================
  
  const createQuotation = useCallback(async (input: CreateQuotationInput): Promise<Quotation> => {
    console.log('createQuotation called with input:', input);
    
    if (!user || !userProfile) {
      console.error('createQuotation: User not authenticated', { user, userProfile });
      throw new Error('Usuário não autenticado');
    }

    const code = generateQuotationCode();
    console.log('Generated quotation code:', code);
    
    const estimatedTotal = input.items.reduce(
      (sum, item) => sum + (item.estimatedUnitPrice || 0) * item.quantity,
      0
    );

    const newQuotation: Quotation = {
      id: crypto.randomUUID(),
      code,
      title: input.title,
      description: input.description,
      status: 'draft',
      requestId: input.requestId,
      items: input.items.map((item, index) => ({
        ...item,
        id: crypto.randomUUID(),
        quotationId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      invitedSuppliers: input.supplierIds.map(supplierId => {
        const supplier = suppliers.find(s => s.id === supplierId);
        return {
          id: crypto.randomUUID(),
          quotationId: '',
          supplierId,
          supplierName: supplier?.name || '',
          supplierEmail: supplier?.email || '',
          supplierPhone: supplier?.phone,
          invitedAt: new Date().toISOString(),
          status: 'invited',
        };
      }),
      proposals: [],
      estimatedTotalAmount: estimatedTotal,
      requiredApprovalLevel: getRequiredApprovalLevel(estimatedTotal),
      approvals: [],
      department: input.department,
      costCenter: input.costCenter,
      justification: input.justification,
      priority: input.priority,
      responseDeadline: input.responseDeadline,
      deliveryDeadline: input.deliveryDeadline,
      auditLog: [],
      createdBy: user.id,
      createdByName: userProfile.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update IDs
    newQuotation.items = newQuotation.items.map(item => ({ ...item, quotationId: newQuotation.id }));
    newQuotation.invitedSuppliers = newQuotation.invitedSuppliers.map(s => ({ ...s, quotationId: newQuotation.id }));

    console.log('newQuotation object created:', newQuotation);
    console.log('Items:', newQuotation.items);
    console.log('Invited suppliers:', newQuotation.invitedSuppliers);

    // Save to database
    try {
      // Insert main quotation
      // Use only columns that exist in the database schema
      const insertData = {
        id: newQuotation.id,
        code: newQuotation.code,
        title: newQuotation.title,
        description: newQuotation.description,
        status: 'draft',
        request_id: newQuotation.requestId || null,
        product_id: newQuotation.items[0]?.productId || null,
        product_name: newQuotation.items[0]?.productName || newQuotation.title,
        requested_quantity: newQuotation.items[0]?.quantity || 1,
        department: newQuotation.department,
        cost_center: newQuotation.costCenter,
        justification: newQuotation.justification,
        priority: newQuotation.priority,
        response_deadline: newQuotation.responseDeadline || null,
        deadline: newQuotation.deliveryDeadline || null,
        created_by: newQuotation.createdBy,
        created_by_name: newQuotation.createdByName,
      };
      console.log('Attempting to insert quotation with data:', insertData);
      
      const { error: quotationError } = await supabase
        .from('quotations')
        .insert(insertData);

      if (quotationError) {
        console.error('Error inserting quotation:', quotationError);
        throw quotationError;
      }
      
      console.log('Quotation inserted successfully');

      // Note: quotation_items are for supplier proposals, not products
      // Products are stored directly in the quotations table (product_id, product_name, requested_quantity)
      // Supplier proposals (quotation_items) are created when suppliers submit their prices

      // Insert invited suppliers
      if (newQuotation.invitedSuppliers.length > 0) {
        console.log('Inserting invited suppliers...');
        const { error: suppliersError } = await supabase
          .from('quotation_invited_suppliers')
          .insert(
            newQuotation.invitedSuppliers.map(supplier => ({
              quotation_id: newQuotation.id,
              supplier_id: supplier.supplierId,
              supplier_name: supplier.supplierName,
              supplier_email: supplier.supplierEmail || null,
              supplier_phone: supplier.supplierPhone || null,
              status: 'pending',
            }))
          );

        if (suppliersError) {
          console.error('Error inserting invited suppliers:', suppliersError);
          // Don't throw, just log - suppliers can be added later
        } else {
          console.log('Invited suppliers inserted successfully');
        }
      }
    } catch (error) {
      console.error('Error saving quotation to database:', error);
      throw error;
    }
    
    console.log('Updating local state and adding audit log...');
    setQuotations(prev => [newQuotation, ...prev]);
    
    await addAuditLog(newQuotation.id, 'created', { title: input.title });
    
    console.log('createQuotation completed successfully, returning:', newQuotation);
    return newQuotation;
  }, [user, userProfile, suppliers, addAuditLog]);

  const updateQuotation = useCallback(async (
    id: string,
    input: UpdateQuotationInput
  ): Promise<Quotation> => {
    const quotation = quotations.find(q => q.id === id);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (!canEditQuotation(quotation.status)) {
      throw new Error('Cotação não pode ser editada neste status');
    }

    const updated: Quotation = {
      ...quotation,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    setQuotations(prev => prev.map(q => q.id === id ? updated : q));
    
    await addAuditLog(id, 'updated', input as unknown as Record<string, unknown>);
    
    return updated;
  }, [quotations, addAuditLog]);

  const deleteQuotation = useCallback(async (id: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === id);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (quotation.status !== 'draft') {
      throw new Error('Apenas cotações em rascunho podem ser excluídas');
    }

    setQuotations(prev => prev.filter(q => q.id !== id));
  }, [quotations]);

  // ============================================
  // ITEM OPERATIONS
  // ============================================
  
  const addItem = useCallback(async (
    quotationId: string,
    item: Omit<QuotationItem, 'id' | 'quotationId' | 'createdAt' | 'updatedAt'>
  ): Promise<QuotationItem> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (!canModifyItems(quotation.status)) {
      throw new Error('Não é possível adicionar itens neste status');
    }

    const newItem: QuotationItem = {
      ...item,
      id: crypto.randomUUID(),
      quotationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const estimatedTotal = [...quotation.items, newItem].reduce(
      (sum, i) => sum + (i.estimatedUnitPrice || 0) * i.quantity,
      0
    );

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          items: [...q.items, newItem],
          estimatedTotalAmount: estimatedTotal,
          requiredApprovalLevel: getRequiredApprovalLevel(estimatedTotal),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'item_added', {}, { itemId: newItem.id, itemName: item.productName });
    
    return newItem;
  }, [quotations, addAuditLog]);

  const removeItem = useCallback(async (quotationId: string, itemId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (!canModifyItems(quotation.status)) {
      throw new Error('Não é possível remover itens neste status');
    }

    const item = quotation.items.find(i => i.id === itemId);
    const newItems = quotation.items.filter(i => i.id !== itemId);
    const estimatedTotal = newItems.reduce(
      (sum, i) => sum + (i.estimatedUnitPrice || 0) * i.quantity,
      0
    );

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          items: newItems,
          estimatedTotalAmount: estimatedTotal,
          requiredApprovalLevel: getRequiredApprovalLevel(estimatedTotal),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'item_removed', {}, { itemId, itemName: item?.productName });
  }, [quotations, addAuditLog]);

  // ============================================
  // SUPPLIER OPERATIONS
  // ============================================
  
  const addSupplier = useCallback(async (quotationId: string, supplierId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (!canModifySuppliers(quotation.status)) {
      throw new Error('Não é possível adicionar fornecedores neste status');
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado');

    if (quotation.invitedSuppliers.some(s => s.supplierId === supplierId)) {
      throw new Error('Fornecedor já está na cotação');
    }

    const newInvite: InvitedSupplier = {
      id: crypto.randomUUID(),
      quotationId,
      supplierId,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      supplierPhone: supplier.phone,
      invitedAt: new Date().toISOString(),
      status: 'invited',
    };

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          invitedSuppliers: [...q.invitedSuppliers, newInvite],
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'supplier_added', {}, { supplierId, supplierName: supplier.name });
  }, [quotations, suppliers, addAuditLog]);

  const removeSupplier = useCallback(async (quotationId: string, supplierId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');
    
    if (!canModifySuppliers(quotation.status)) {
      throw new Error('Não é possível remover fornecedores neste status');
    }

    const supplier = quotation.invitedSuppliers.find(s => s.supplierId === supplierId);

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          invitedSuppliers: q.invitedSuppliers.filter(s => s.supplierId !== supplierId),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'supplier_removed', {}, { supplierId, supplierName: supplier?.supplierName });
  }, [quotations, addAuditLog]);

  // ============================================
  // WORKFLOW OPERATIONS
  // ============================================
  
  const sendToSuppliers = useCallback(async (quotationId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    const validation = validateTransition(quotation.status, 'sent_to_suppliers', {
      hasItems: quotation.items.length > 0,
      hasSuppliers: quotation.invitedSuppliers.length > 0,
      hasProposals: false,
      hasSelectedWinner: false,
      hasPendingApprovals: false,
      userCanApprove: false,
      userApprovalLimit: 0,
      quotationAmount: quotation.estimatedTotalAmount,
    });

    if (!validation.valid) {
      throw new Error(validation.messages.join('. '));
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'sent_to_suppliers',
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'sent_to_suppliers', {
      supplierCount: quotation.invitedSuppliers.length,
    }, {
      previousStatus: quotation.status,
      newStatus: 'sent_to_suppliers',
    });

    // In production, send notifications to suppliers here
  }, [quotations, addAuditLog]);

  const submitProposal = useCallback(async (input: SubmitProposalInput): Promise<SupplierProposal> => {
    const quotation = quotations.find(q => q.id === input.quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    // Allow proposals in manual flow (draft) and API flow
    let supplier = quotation.invitedSuppliers.find(s => s.supplierId === input.supplierId);
    
    // If supplier is not yet invited, auto-add them (manual flow)
    if (!supplier) {
      const supplierData = suppliers.find(s => s.id === input.supplierId);
      if (!supplierData) throw new Error('Fornecedor não encontrado');
      
      const newInvite: InvitedSupplier = {
        id: crypto.randomUUID(),
        quotationId: input.quotationId,
        supplierId: input.supplierId,
        supplierName: supplierData.name,
        supplierEmail: supplierData.email,
        supplierPhone: supplierData.phone,
        invitedAt: new Date().toISOString(),
        status: 'responded',
      };
      
      // Add supplier to quotation
      setQuotations(prev => prev.map(q => {
        if (q.id === input.quotationId) {
          return {
            ...q,
            invitedSuppliers: [...q.invitedSuppliers, newInvite],
          };
        }
        return q;
      }));
      
      supplier = newInvite;
    }

    const proposalItems: ProposalItem[] = input.items.map(item => {
      const quotationItem = quotation.items.find(qi => qi.id === item.quotationItemId);
      return {
        id: crypto.randomUUID(),
        proposalId: '',
        quotationItemId: item.quotationItemId,
        productName: quotationItem?.productName || '',
        quantity: quotationItem?.quantity || 0,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * (quotationItem?.quantity || 0),
        deliveryTime: item.deliveryTime,
        brand: item.brand,
        notes: item.notes,
      };
    });

    const totalAmount = proposalItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const proposal: SupplierProposal = {
      id: crypto.randomUUID(),
      quotationId: input.quotationId,
      supplierId: input.supplierId,
      supplierName: supplier.supplierName,
      status: 'submitted',
      items: proposalItems,
      totalAmount,
      deliveryTime: input.deliveryTime,
      paymentTerms: input.paymentTerms,
      validUntil: input.validUntil,
      notes: input.notes,
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update proposal IDs
    proposal.items = proposal.items.map(item => ({ ...item, proposalId: proposal.id }));

    // Determine new status
    let newStatus = quotation.status;
    if (quotation.status === 'sent_to_suppliers') {
      newStatus = 'waiting_responses';
    }

    // Check if all suppliers responded
    const respondedCount = quotation.proposals.length + 1;
    if (respondedCount >= quotation.invitedSuppliers.length) {
      newStatus = 'under_review';
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === input.quotationId) {
        return {
          ...q,
          status: newStatus,
          proposals: [...q.proposals, proposal],
          invitedSuppliers: q.invitedSuppliers.map(s => 
            s.supplierId === input.supplierId 
              ? { ...s, status: 'responded' as const }
              : s
          ),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(input.quotationId, 'supplier_response', {
      totalAmount,
    }, {
      supplierId: input.supplierId,
      supplierName: supplier.supplierName,
      amount: totalAmount,
    });

    return proposal;
  }, [quotations, suppliers, addAuditLog]);

  // Advance directly to under_review (manual flow - skip API sending)
  const advanceToReview = useCallback(async (quotationId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (quotation.proposals.length < 3) {
      throw new Error('São necessárias no mínimo 3 propostas para avançar para análise');
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'under_review',
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'updated', {
      note: 'Cotação avançada manualmente para análise',
      proposalCount: quotation.proposals.length,
    }, {
      previousStatus: quotation.status,
      newStatus: 'under_review',
    });
  }, [quotations, addAuditLog]);

  const selectWinner = useCallback(async (quotationId: string, proposalId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (!canSelectWinner(quotation.status)) {
      throw new Error('Não é possível selecionar vencedor neste status');
    }

    const proposal = quotation.proposals.find(p => p.id === proposalId);
    if (!proposal) throw new Error('Proposta não encontrada');

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          selectedProposalId: proposalId,
          selectedSupplierId: proposal.supplierId,
          selectedSupplierName: proposal.supplierName,
          selectedTotalAmount: proposal.totalAmount,
          finalTotalAmount: proposal.totalAmount,
          proposals: q.proposals.map(p => ({
            ...p,
            status: p.id === proposalId ? 'selected' : 'rejected',
            selectedAt: p.id === proposalId ? new Date().toISOString() : undefined,
            rejectedAt: p.id !== proposalId ? new Date().toISOString() : undefined,
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'proposal_selected', {}, {
      supplierId: proposal.supplierId,
      supplierName: proposal.supplierName,
      amount: proposal.totalAmount,
    });
  }, [quotations, addAuditLog]);

  const submitForApproval = useCallback(async (quotationId: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (!canSubmitForApproval(quotation.status)) {
      throw new Error('Cotação não pode ser submetida para aprovação neste status');
    }

    if (!quotation.selectedProposalId) {
      throw new Error('É necessário selecionar uma proposta vencedora');
    }

    const approval: QuotationApproval = {
      id: crypto.randomUUID(),
      quotationId,
      level: quotation.requiredApprovalLevel,
      status: 'pending',
      amount: quotation.finalTotalAmount || quotation.estimatedTotalAmount,
      createdAt: new Date().toISOString(),
    };

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'awaiting_approval',
          currentApprovalLevel: quotation.requiredApprovalLevel,
          approvals: [approval],
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'submitted_for_approval', {
      level: quotation.requiredApprovalLevel,
      amount: quotation.finalTotalAmount || quotation.estimatedTotalAmount,
    }, {
      previousStatus: quotation.status,
      newStatus: 'awaiting_approval',
    });
  }, [quotations, addAuditLog]);

  const approveQuotation = useCallback(async (quotationId: string, comment?: string): Promise<void> => {
    if (!user || !userProfile) throw new Error('Usuário não autenticado');

    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    const permissions = getPermissions(quotation);
    if (!permissions.canApprove) {
      throw new Error('Você não tem permissão para aprovar esta cotação');
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'approved',
          approvals: q.approvals.map(a => ({
            ...a,
            status: 'approved',
            approverId: user.id,
            approverName: userProfile.name,
            approverRole: userProfile.role,
            comment,
            approvedAt: new Date().toISOString(),
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'approved', { comment }, {
      previousStatus: 'awaiting_approval',
      newStatus: 'approved',
      amount: quotation.finalTotalAmount,
    });
  }, [quotations, user, userProfile, getPermissions, addAuditLog]);

  const rejectQuotation = useCallback(async (quotationId: string, comment: string): Promise<void> => {
    if (!user || !userProfile) throw new Error('Usuário não autenticado');

    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (!canApproveOrReject(quotation.status)) {
      throw new Error('Cotação não pode ser rejeitada neste status');
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'rejected',
          approvals: q.approvals.map(a => ({
            ...a,
            status: 'rejected',
            approverId: user.id,
            approverName: userProfile.name,
            approverRole: userProfile.role,
            comment,
            rejectedAt: new Date().toISOString(),
          })),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'rejected', { comment }, {
      previousStatus: quotation.status,
      newStatus: 'rejected',
      comment,
    });
  }, [quotations, user, userProfile, addAuditLog]);

  const cancelQuotation = useCallback(async (quotationId: string, reason: string): Promise<void> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (!canCancel(quotation.status)) {
      throw new Error('Cotação não pode ser cancelada neste status');
    }

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'cancelled', { reason }, {
      previousStatus: quotation.status,
      newStatus: 'cancelled',
      comment: reason,
    });
  }, [quotations, addAuditLog]);

  const convertToPurchase = useCallback(async (quotationId: string): Promise<string> => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (!quotation) throw new Error('Cotação não encontrada');

    if (!canConvertToPurchase(quotation.status)) {
      throw new Error('Cotação não pode ser convertida em pedido neste status');
    }

    const purchaseOrderId = crypto.randomUUID();
    const purchaseOrderCode = `PED-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    setQuotations(prev => prev.map(q => {
      if (q.id === quotationId) {
        return {
          ...q,
          status: 'converted_to_purchase',
          purchaseOrderId,
          purchaseOrderCode,
          convertedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return q;
    }));

    await addAuditLog(quotationId, 'converted_to_purchase', {
      purchaseOrderId,
      purchaseOrderCode,
    }, {
      previousStatus: 'approved',
      newStatus: 'converted_to_purchase',
    });

    return purchaseOrderCode;
  }, [quotations, addAuditLog]);

  // ============================================
  // RETURN
  // ============================================
  
  return {
    // Data
    quotations,
    filteredQuotations,
    suppliers,
    selectedQuotation,
    metrics,
    loading,
    error,
    
    // Filters & Sort
    filters,
    setFilters,
    sort,
    setSort,
    
    // Selection
    setSelectedQuotation,
    
    // CRUD
    createQuotation,
    updateQuotation,
    deleteQuotation,
    
    // Items
    addItem,
    removeItem,
    
    // Suppliers
    addSupplier,
    removeSupplier,
    
    // Workflow
    sendToSuppliers,
    submitProposal,
    selectWinner,
    advanceToReview,
    submitForApproval,
    approveQuotation,
    rejectQuotation,
    cancelQuotation,
    convertToPurchase,
    
    // Permissions & Approval Config
    getPermissions,
    userApprovalConfig,
    refreshApprovalConfig: fetchUserApprovalLimit,
    
    // Refresh
    refresh: fetchQuotations,
  };
};
