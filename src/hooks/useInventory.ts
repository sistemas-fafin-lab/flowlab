import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product, StockMovement, Request, DashboardData, FinancialMetrics, Supplier, Quotation, QuotationItem, ProductChangeLog } from '../types';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [changeLogs, setChangeLogs] = useState<ProductChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchMovements(),
        fetchRequests(),
        fetchSuppliers(),
        fetchQuotations(),
        fetchChangeLogs()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const formattedProducts: Product[] = data.map(product => ({
      id: product.id,
      name: product.name,
      code: product.code,
      category: product.category,
      quantity: product.quantity,
      unit: product.unit,
      supplier: product.supplier,
      batch: product.batch,
      entryDate: product.entry_date,
      expirationDate: product.expiration_date,
      location: product.location,
      minStock: product.min_stock,
      status: product.status,
      unitPrice: product.unit_price || 0,
      totalValue: product.quantity * (product.unit_price || 0),
      invoiceNumber: product.invoicenumber || '',
      isWithholding: product.iswithholding || false,
      supplierId: product.supplier_id || '',
      supplierName: product.supplier_name || '',
    }));

    setProducts(formattedProducts);
  };

  const fetchChangeLogs = async () => {
    const { data, error } = await supabase
      .from('product_change_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedLogs: ProductChangeLog[] = data.map(log => ({
      id: log.id,
      productId: log.product_id,
      productName: log.product_name,
      changedBy: log.changed_by,
      changeReason: log.change_reason,
      changeDate: log.change_date,
      changeTime: log.change_time,
      fieldChanges: log.field_changes,
      createdAt: log.created_at
    }));

    setChangeLogs(formattedLogs);
  };

  const addProductChangeLog = async (changeLog: Omit<ProductChangeLog, 'id' | 'createdAt'>) => {
    try {
      const { error } = await supabase
        .from('product_change_logs')
        .insert({
          product_id: changeLog.productId,
          product_name: changeLog.productName,
          changed_by: changeLog.changedBy,
          change_reason: changeLog.changeReason,
          field_changes: changeLog.fieldChanges,
          change_date: changeLog.changeDate,
          change_time: changeLog.changeTime
        });

      if (error) throw error;

      await fetchChangeLogs(); // Refresh logs
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add change log');
    }
  };

  const deleteProduct = async (id: string) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir produto:', error);
    throw error;
  }
};

  const fetchMovements = async () => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedMovements: StockMovement[] = data.map(movement => ({
      id: movement.id,
      productId: movement.product_id,
      productName: movement.product_name,
      type: movement.type,
      reason: movement.reason,
      quantity: movement.quantity,
      date: movement.date,
      requestId: movement.request_id,
      authorizedBy: movement.authorized_by,
      notes: movement.notes,
      unitPrice: movement.unit_price || 0,
      totalValue: movement.quantity * (movement.unit_price || 0)
    }));

    setMovements(formattedMovements);
  };

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedRequests: Request[] = data.map(request => ({
      id: request.id,
      type: request.type,
      items: request.items || [],
      reason: request.reason,
      requestedBy: request.requested_by,
      requestDate: request.request_date,
      status: request.status,
      priority: request.priority || 'standard',
      approvedBy: request.approved_by,
      approvalDate: request.approval_date,
      notes: request.notes,
      department: request.department,
      supplierId: request.supplier_id,
      supplierName: request.supplier_name,
      receiver_signature: request.receiver_signature,
      received_by: request.received_by
    }));

    setRequests(formattedRequests);
  };

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedSuppliers: Supplier[] = data.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      cnpj: supplier.cnpj,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      contactPerson: supplier.contactperson || supplier.contact_person,
      products: supplier.products,
      status: supplier.status,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at
    }));

    setSuppliers(formattedSuppliers);
  };

  const fetchQuotations = async () => {
    const { data: quotationsData, error: quotationsError } = await supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false });

    if (quotationsError) throw quotationsError;

    const { data: itemsData, error: itemsError } = await supabase
      .from('quotation_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (itemsError) throw itemsError;

    const formattedQuotations: Quotation[] = quotationsData.map(quotation => ({
      id: quotation.id,
      requestId: quotation.request_id,
      productId: quotation.product_id,
      productName: quotation.product_name,
      requestedQuantity: quotation.requested_quantity,
      status: quotation.status,
      selectedSupplierId: quotation.selected_supplier_id,
      selectedPrice: quotation.selected_price,
      selectedDeliveryTime: quotation.selected_delivery_time,
      createdBy: quotation.created_by,
      createdAt: quotation.created_at,
      updatedAt: quotation.updated_at,
      items: itemsData
        .filter(item => item.quotation_id === quotation.id)
        .map(item => ({
          id: item.id,
          quotationId: item.quotation_id,
          supplierId: item.supplier_id,
          supplierName: item.supplier_name,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          deliveryTime: item.delivery_time,
          notes: item.notes,
          status: item.status,
          submittedAt: item.submitted_at,
          createdAt: item.created_at
        }))
    }));

    setQuotations(formattedQuotations);
  };

  const getFinancialMetrics = (): FinancialMetrics => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Calcular valor atual do inventário baseado nos dados reais
    const currentInventoryValue = products.reduce((sum, product) => sum + product.totalValue, 0);

    // Movimentações do mês atual
    const currentMonthMovements = movements.filter(movement => {
      const moveDate = new Date(movement.date);
      return moveDate.getMonth() === currentMonth && moveDate.getFullYear() === currentYear;
    });

    // Movimentações do mês anterior
    const previousMonthMovements = movements.filter(movement => {
      const moveDate = new Date(movement.date);
      return moveDate.getMonth() === previousMonth && moveDate.getFullYear() === previousYear;
    });

    const currentMovementsValue = currentMonthMovements.reduce((sum, movement) => sum + movement.totalValue, 0);
    const previousMovementsValue = previousMonthMovements.reduce((sum, movement) => sum + movement.totalValue, 0);

    // Simular valor do inventário do mês anterior (baseado em histórico de movimentações)
    const previousInventoryValue = currentInventoryValue + currentMovementsValue - previousMovementsValue;

    return {
      currentMonth: {
        inventoryValue: currentInventoryValue,
        movementsValue: currentMovementsValue,
        movementsCount: currentMonthMovements.length
      },
      previousMonth: {
        inventoryValue: previousInventoryValue,
        movementsValue: previousMovementsValue,
        movementsCount: previousMonthMovements.length
      },
      trends: {
        inventoryValueChange: currentInventoryValue - previousInventoryValue,
        inventoryValueChangePercent: previousInventoryValue > 0 ? 
          ((currentInventoryValue - previousInventoryValue) / previousInventoryValue) * 100 : 0,
        movementsValueChange: currentMovementsValue - previousMovementsValue,
        movementsValueChangePercent: previousMovementsValue > 0 ? 
          ((currentMovementsValue - previousMovementsValue) / previousMovementsValue) * 100 : 0,
        movementsCountChange: currentMonthMovements.length - previousMonthMovements.length,
        movementsCountChangePercent: previousMonthMovements.length > 0 ? 
          ((currentMonthMovements.length - previousMonthMovements.length) / previousMonthMovements.length) * 100 : 0
      }
    };
  };

  const getDashboardData = (): DashboardData => {
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.status === 'low-stock').length;
    const expiringProducts = products.filter(p => {
      const expirationDate = new Date(p.expirationDate);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expirationDate <= thirtyDaysFromNow;
    }).length;
    const recentMovements = movements.filter(m => {
      const moveDate = new Date(m.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return moveDate >= sevenDaysAgo;
    }).length;

    // Agrupar produtos por categoria real do banco de dados
    const categoryCount: Record<string, number> = {};
    const categoryValue: Record<string, number> = {};

    products.forEach(p => {
      const cat = p.category || 'sem categoria';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      categoryValue[cat] = (categoryValue[cat] || 0) + p.totalValue;
    });

    const categories = {
      general: products.filter(p => p.category === 'general').length,
      technical: products.filter(p => p.category === 'technical').length
    };

    const financialMetrics = getFinancialMetrics();

    // Calcular valores por categoria baseado nos dados reais
    const categoryValues = {
      general: products
        .filter(p => p.category === 'general')
        .reduce((sum, p) => sum + p.totalValue, 0),
      technical: products
        .filter(p => p.category === 'technical')
        .reduce((sum, p) => sum + p.totalValue, 0)
    };

    // Produtos com maior e menor valor baseado nos dados reais
    const sortedByValue = [...products].sort((a, b) => b.totalValue - a.totalValue);
    const topValueProducts = sortedByValue.slice(0, 5);
    const lowValueProducts = sortedByValue.slice(-5).reverse();

    const totalInventoryValue = financialMetrics.currentMonth.inventoryValue;
    const averageProductValue = totalProducts > 0 ? totalInventoryValue / totalProducts : 0;

    return {
      totalProducts,
      lowStockProducts,
      expiringProducts,
      recentMovements,
      categories,
      totalInventoryValue,
      monthlyInventoryChange: financialMetrics.trends.inventoryValueChange,
      monthlyInventoryChangePercent: financialMetrics.trends.inventoryValueChangePercent,
      totalMovementsValue: financialMetrics.currentMonth.movementsValue,
      monthlyMovementsValue: financialMetrics.currentMonth.movementsValue,
      monthlyMovementsChange: financialMetrics.trends.movementsValueChange,
      monthlyMovementsChangePercent: financialMetrics.trends.movementsValueChangePercent,
      averageProductValue,
      topValueProducts,
      lowValueProducts,
      categoryValues,
      allCategories: categoryCount,
      allCategoryValues: categoryValue
    };
  };

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          code: product.code,
          category: product.category,
          quantity: product.quantity,
          unit: product.unit,
          supplier: product.supplier,
          batch: product.batch,
          entry_date: product.entryDate,
          expiration_date: product.expirationDate,
          location: product.location,
          min_stock: product.minStock,
          unit_price: product.unitPrice,
          invoicenumber: product.invoiceNumber,
          iswithholding: product.isWithholding
        })
        .select()
        .single();

      if (error) throw error;

      await fetchProducts(); // Refresh products list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add product');
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.code !== undefined) updateData.code = updates.code;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
      if (updates.unit !== undefined) updateData.unit = updates.unit;
      if (updates.supplier !== undefined) updateData.supplier = updates.supplier;
      if (updates.supplierName !== undefined) updateData.supplier_name = updates.supplierName;
      if (updates.batch !== undefined) updateData.batch = updates.batch;
      if (updates.entryDate !== undefined) updateData.entry_date = updates.entryDate;
      if (updates.expirationDate !== undefined) updateData.expiration_date = updates.expirationDate;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.minStock !== undefined) updateData.min_stock = updates.minStock;
      if (updates.unitPrice !== undefined) updateData.unit_price = updates.unitPrice;
      if (updates.invoiceNumber !== undefined) updateData.invoicenumber = updates.invoiceNumber;
      if (updates.isWithholding !== undefined) updateData.iswithholding = updates.isWithholding;

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchProducts(); // Refresh products list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update product');
    }
  };

  const addMovement = async (movement: Omit<StockMovement, 'id'>) => {
    try {
      const { error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: movement.productId,
          product_name: movement.productName,
          type: movement.type,
          reason: movement.reason,
          quantity: movement.quantity,
          date: movement.date,
          request_id: movement.requestId,
          authorized_by: movement.authorizedBy,
          notes: movement.notes,
          unit_price: movement.unitPrice,
        });

      if (error) throw error;

      // Refresh data
      await Promise.all([fetchMovements(), fetchProducts()]);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add movement');
    }
  };

  const addRequest = async (request: Omit<Request, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .insert({
          type: request.type,
          items: request.items,
          reason: request.reason,
          priority: request.priority,
          requested_by: request.requestedBy,
          request_date: request.requestDate,
          department: request.department,
          supplier_id: request.supplierId,
          supplier_name: request.supplierName
        })
        .select()
        .single();

      if (error) throw error;

      await fetchRequests(); // Refresh requests list
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add request');
    }
  };

  const updateRequestStatus = async (id: string, status: Request['status'], approvedBy?: string) => {
    try {
      const updateData: any = { status };
      
      if (status === 'approved' && approvedBy) {
        updateData.approved_by = approvedBy;
        updateData.approval_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchRequests(); // Refresh requests list
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update request status');
    }
  };

  // Supplier functions
  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          name: supplier.name,
          cnpj: supplier.cnpj,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          contactperson: supplier.contactPerson,
          products: supplier.products,
          status: supplier.status
        });

      if (error) throw error;

      await fetchSuppliers();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add supplier');
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.cnpj !== undefined) updateData.cnpj = updates.cnpj;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.contactPerson !== undefined) updateData.contactperson = updates.contactPerson;
      if (updates.products !== undefined) updateData.products = updates.products;
      if (updates.status !== undefined) updateData.status = updates.status;

      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchSuppliers();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update supplier');
    }
  };

  // Quotation functions
  const createQuotation = async (quotationData: {
    requestId: string;
    productId: string;
    productName: string;
    requestedQuantity: number;
    suppliers: { id: string; name: string; quotePrice?: number | null }[];
  }) => {
    try {
      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .insert({
          request_id: quotationData.requestId,
          product_id: quotationData.productId,
          product_name: quotationData.productName,
          requested_quantity: quotationData.requestedQuantity,
          created_by: 'Sistema' // You might want to pass the actual user
        })
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Create quotation items for each supplier
      const quotationItems = quotationData.suppliers.map(supplier => ({
        quotation_id: quotation.id,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        unit_price: supplier.quotePrice,
        total_price: supplier.quotePrice ? supplier.quotePrice * quotationData.requestedQuantity : null
      }));

      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(quotationItems);

      if (itemsError) throw itemsError;

      await fetchQuotations();
      return quotation;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create quotation');
    }
  };

  const updateQuotationItem = async (itemId: string, updates: Partial<QuotationItem>) => {
    try {
      const updateData: any = {};
      
      if (updates.unitPrice !== undefined) {
        updateData.unit_price = updates.unitPrice;
        // Calculate total price if quantity is available
        const quotationItem = quotations
          .flatMap(q => q.items)
          .find(item => item.id === itemId);
        if (quotationItem) {
          const quotation = quotations.find(q => q.id === quotationItem.quotationId);
          if (quotation) {
            updateData.total_price = updates.unitPrice * quotation.requestedQuantity;
          }
        }
      }
      if (updates.deliveryTime !== undefined) updateData.delivery_time = updates.deliveryTime;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === 'submitted') {
          updateData.submitted_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('quotation_items')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      await fetchQuotations();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update quotation item');
    }
  };

  const selectQuotationWinner = async (quotationId: string, selectedItemId: string) => {
    try {
      const quotation = quotations.find(q => q.id === quotationId);
      const selectedItem = quotation?.items.find(item => item.id === selectedItemId);
      
      if (!quotation || !selectedItem) {
        throw new Error('Quotation or item not found');
      }

      // Update quotation with selected supplier
      const { error: quotationError } = await supabase
        .from('quotations')
        .update({
          status: 'completed',
          selected_supplier_id: selectedItem.supplierId,
          selected_price: selectedItem.unitPrice,
          selected_delivery_time: selectedItem.deliveryTime
        })
        .eq('id', quotationId);

      if (quotationError) throw quotationError;

      // Update all items status
      const { error: itemsError } = await supabase
        .from('quotation_items')
        .update({ status: 'rejected' })
        .eq('quotation_id', quotationId);

      if (itemsError) throw itemsError;

      // Update selected item status
      const { error: selectedError } = await supabase
        .from('quotation_items')
        .update({ status: 'selected' })
        .eq('id', selectedItemId);

      if (selectedError) throw selectedError;

      await fetchQuotations();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to select quotation winner');
    }
  };

  // Função para dar baixa em produto (zerar estoque)
  const writeOffProduct = async (productId: string, reason: string, authorizedBy: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Produto não encontrado');

      // Registrar movimentação de saída
      await addMovement({
        productId: product.id,
        productName: product.name,
        type: 'out',
        reason: 'other',
        quantity: product.quantity,
        date: new Date().toISOString().split('T')[0],
        authorizedBy,
        notes: `Baixa por ${reason}`,
        unitPrice: product.unitPrice,
        totalValue: product.quantity * product.unitPrice
      });

      // Atualizar produto para quantidade zero
      await updateProduct(productId, { quantity: 0 });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to write off product');
    }
  };

  // Função para solicitar reposição automaticamente
  const requestReplenishment = async (productId: string, requestedBy: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) throw new Error('Produto não encontrado');

      // Calcular quantidade sugerida (dobro do estoque mínimo)
      const suggestedQuantity = Math.max(product.minStock * 2, 10);

      await addRequest({
        items: [{
          id: Date.now().toString(),
          productId: product.id,
          productName: product.name,
          quantity: suggestedQuantity,
          category: product.category
        }],
        reason: `Solicitação automática de reposição - Produto próximo ao vencimento. Estoque atual: ${product.quantity} ${product.unit}`,
        priority: 'priority',
        requestedBy,
        requestDate: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to request replenishment');
    }
  };
  const deleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir fornecedor:', error);
        throw error;
      }

      await fetchSuppliers();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete supplier');
    }
  };

  return {
    products,
    movements,
    requests,
    suppliers,
    quotations,
    changeLogs,
    loading,
    error,
    getDashboardData,
    getFinancialMetrics,
    addProduct,
    updateProduct,
    addMovement,
    addRequest,
    updateRequestStatus,
    addSupplier,
    updateSupplier,
    createQuotation,
    updateQuotationItem,
    selectQuotationWinner,
    writeOffProduct,
    requestReplenishment,
    addProductChangeLog,
    refreshData: fetchAllData,
    deleteSupplier,
    deleteProduct,
    setProducts,
    fetchProducts
  };
};