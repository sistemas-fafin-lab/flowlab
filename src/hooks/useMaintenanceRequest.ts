import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MaintenanceRequest, 
  MaintenanceRequestFormValues, 
  MaintenanceStatus,
  MaintenanceInventoryItem
} from '../types';

interface CreateMaintenanceResult {
  success: boolean;
  message?: string;
  codigo?: string;
  error?: string;
}

interface UpdateStatusResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const useMaintenanceRequest = () => {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FETCH: Buscar todas as solicitações
  // ============================================
  const fetchMaintenanceRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedRequests: MaintenanceRequest[] = (data || []).map(request => ({
        id: request.id,
        codigo: request.codigo,
        requesterId: request.requester_id,
        requesterName: request.requester_name,
        requesterEmail: request.requester_email,
        department: request.department,
        localOcorrencia: request.local_ocorrencia,
        descricao: request.descricao,
        impactoOperacional: request.impacto_operacional,
        dataIdentificacao: request.data_identificacao,
        prioridade: request.prioridade,
        status: request.status,
        images: request.images || [],
        assignedTo: request.assigned_to,
        assignedAt: request.assigned_at,
        completedAt: request.completed_at,
        completionNotes: request.completion_notes,
        cancelledAt: request.cancelled_at,
        cancellationReason: request.cancellation_reason,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }));

      setMaintenanceRequests(formattedRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitações de manutenção');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenanceRequests();
  }, [fetchMaintenanceRequests]);

  // ============================================
  // UPLOAD: Fazer upload de imagens
  // ============================================
  const uploadImages = async (files: File[], codigo: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${codigo.replace(/[/\s]/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `maintenance/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('maintenance-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro no upload da imagem:', uploadError.message);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('maintenance-images')
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      } catch (err) {
        console.error('Erro ao fazer upload da imagem:', err);
      }
    }

    return uploadedUrls;
  };

  // ============================================
  // CREATE: Criar nova solicitação de manutenção
  // ============================================
  const createMaintenanceRequest = async (
    formValues: MaintenanceRequestFormValues,
    userId: string,
    userName: string,
    userEmail: string,
    department: string
  ): Promise<CreateMaintenanceResult> => {
    try {
      // 1. Fazer upload das imagens (se houver)
      let imageUrls: string[] = [];
      if (formValues.images && formValues.images.length > 0) {
        const tempCodigo = `MNT-TEMP-${Date.now()}`;
        imageUrls = await uploadImages(formValues.images, tempCodigo);
      }

      // 2. Formatar data de identificação
      const dataIdentificacao = formValues.dataIdentificacao instanceof Date
        ? formValues.dataIdentificacao.toISOString()
        : new Date(formValues.dataIdentificacao).toISOString();

      // 3. Inserir no banco
      const { data, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          requester_id: userId,
          requester_name: userName,
          requester_email: userEmail,
          department: department,
          local_ocorrencia: formValues.localOcorrencia,
          descricao: formValues.descricao,
          impacto_operacional: formValues.impactoOperacional,
          data_identificacao: dataIdentificacao,
          prioridade: formValues.prioridade,
          status: 'pending',
          images: imageUrls
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar solicitação:', insertError);
        return {
          success: false,
          error: 'Erro ao criar solicitação de manutenção.'
        };
      }

      // 4. Atualizar lista local
      await fetchMaintenanceRequests();

      return {
        success: true,
        message: 'Solicitação de manutenção criada com sucesso!',
        codigo: data.codigo
      };
    } catch (err) {
      console.error('Erro ao criar solicitação:', err);
      return {
        success: false,
        error: 'Erro inesperado ao criar solicitação.'
      };
    }
  };

  // ============================================
  // UPDATE STATUS: Atualizar status da solicitação
  // ============================================
  const updateMaintenanceStatus = async (
    id: string,
    newStatus: MaintenanceStatus,
    additionalData?: {
      assignedTo?: string;
      completionNotes?: string;
      cancellationReason?: string;
    }
  ): Promise<UpdateStatusResult> => {
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus
      };

      // Adicionar campos específicos por status
      if (newStatus === 'in_progress' && additionalData?.assignedTo) {
        updateData.assigned_to = additionalData.assignedTo;
        updateData.assigned_at = new Date().toISOString();
      }

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        if (additionalData?.completionNotes) {
          updateData.completion_notes = additionalData.completionNotes;
        }
      }

      if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        if (additionalData?.cancellationReason) {
          updateData.cancellation_reason = additionalData.cancellationReason;
        }
      }

      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Erro ao atualizar status:', updateError);
        return {
          success: false,
          error: 'Erro ao atualizar status da solicitação.'
        };
      }

      await fetchMaintenanceRequests();

      return {
        success: true,
        message: 'Status atualizado com sucesso!'
      };
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      return {
        success: false,
        error: 'Erro inesperado ao atualizar status.'
      };
    }
  };

  // ============================================
  // DELETE: Excluir solicitação
  // ============================================
  const deleteMaintenanceRequest = async (id: string): Promise<UpdateStatusResult> => {
    try {
      const { error: deleteError } = await supabase
        .from('maintenance_requests')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Erro ao excluir solicitação:', deleteError);
        return {
          success: false,
          error: 'Erro ao excluir solicitação.'
        };
      }

      await fetchMaintenanceRequests();

      return {
        success: true,
        message: 'Solicitação excluída com sucesso!'
      };
    } catch (err) {
      console.error('Erro ao excluir solicitação:', err);
      return {
        success: false,
        error: 'Erro inesperado ao excluir solicitação.'
      };
    }
  };

  // ============================================
  // INVENTORY: Criar movimentação de estoque para manutenção
  // ============================================
  const createMaintenanceInventoryMovement = async (
    maintenanceRequestId: string,
    productId: string,
    productName: string,
    quantity: number,
    authorizedBy: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Criar movimentação de estoque
      const { data: movementData, error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          product_name: productName,
          type: 'out',
          reason: 'manutencao',
          quantity: quantity,
          date: new Date().toISOString().split('T')[0],
          authorized_by: authorizedBy,
          notes: `Consumo para manutenção - Solicitação vinculada`,
          unit_price: 0,
          total_value: 0
        })
        .select()
        .single();

      if (movementError) {
        console.error('Erro ao criar movimentação:', movementError);
        return {
          success: false,
          error: 'Erro ao registrar movimentação de estoque.'
        };
      }

      // 2. Criar vínculo na tabela maintenance_inventory_items
      const { error: linkError } = await supabase
        .from('maintenance_inventory_items')
        .insert({
          maintenance_request_id: maintenanceRequestId,
          product_id: productId,
          product_name: productName,
          movement_id: movementData.id,
          quantity: quantity
        });

      if (linkError) {
        console.error('Erro ao vincular item:', linkError);
        return {
          success: false,
          error: 'Erro ao vincular material à manutenção.'
        };
      }

      return {
        success: true
      };
    } catch (err) {
      console.error('Erro ao criar movimentação:', err);
      return {
        success: false,
        error: 'Erro inesperado ao registrar consumo de material.'
      };
    }
  };

  // ============================================
  // GET INVENTORY ITEMS: Buscar itens de inventário de uma manutenção
  // ============================================
  const getMaintenanceInventoryItems = async (
    maintenanceRequestId: string
  ): Promise<MaintenanceInventoryItem[]> => {
    try {
      const { data, error } = await supabase
        .from('maintenance_inventory_items')
        .select('*')
        .eq('maintenance_request_id', maintenanceRequestId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar itens:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        maintenanceRequestId: item.maintenance_request_id,
        productId: item.product_id,
        productName: item.product_name,
        movementId: item.movement_id,
        quantity: item.quantity,
        createdAt: item.created_at
      }));
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
      return [];
    }
  };

  return {
    maintenanceRequests,
    loading,
    error,
    fetchMaintenanceRequests,
    createMaintenanceRequest,
    updateMaintenanceStatus,
    deleteMaintenanceRequest,
    createMaintenanceInventoryMovement,
    getMaintenanceInventoryItems,
    uploadImages
  };
};
