import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  PaymentRequest, 
  PaymentRequestFormValues, 
  PaymentRequestPayload,
  PaymentRequestStatus 
} from '../types';
import {
  normalizeDate,
  generatePedidoCode,
  validatePaymentDate,
  preparePayload,
  getNextValidDate
} from '../utils/paymentUtils';

interface CreatePedidoResult {
  success: boolean;
  message?: string;
  pdfUrl?: string;
  codigo?: string;
  suggestedDate?: Date;
  error?: string;
}

export const usePaymentRequest = () => {
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all payment requests
  const fetchPaymentRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedRequests: PaymentRequest[] = (data || []).map(request => ({
        id: request.id,
        codigo: request.codigo,
        codigoCompacto: request.codigo_compacto,
        tipoSolicitacao: request.tipo_solicitacao,
        documentoNumero: request.documento_numero,
        fornecedor: request.fornecedor,
        cpfCnpj: request.cpf_cnpj,
        valorTotal: request.valor_total,
        formaPagamento: request.forma_pagamento,
        dadosPagamento: request.dados_pagamento,
        descricaoDetalhada: request.descricao_detalhada,
        solicitadoPor: request.solicitado_por,
        autorizadoPor: request.autorizado_por,
        dataPagamento: request.data_pagamento,
        emailUsuario: request.email_usuario,
        department: request.department,
        status: request.status,
        pdfUrl: request.pdf_url,
        attachmentUrl: request.attachment_url,
        attachmentName: request.attachment_name,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        approvedBy: request.approved_by,
        approvalDate: request.approval_date,
        rejectionReason: request.rejection_reason
      }));

      setPaymentRequests(formattedRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitações de pagamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  // Get count of pedidos for today
  const getPedidosCountToday = async (): Promise<number> => {
    const today = normalizeDate(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count, error } = await supabase
      .from('payment_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (error) {
      console.error('Erro ao contar pedidos:', error);
      return 0;
    }

    return count || 0;
  };

  // Upload attachment to Supabase Storage
  const uploadAttachment = async (file: File, codigo: string): Promise<{ url: string; name: string } | null> => {
    try {
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${codigo.replace(/[/\s]/g, '-')}-${Date.now()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      // Upload para o storage
      const { data, error: uploadError } = await supabase.storage
        .from('payment-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        return null;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('payment-attachments')
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        name: file.name
      };
    } catch (err) {
      console.error('Erro ao fazer upload do anexo:', err);
      return null;
    }
  };

  // Create new payment request
  const createPedido = async (
    formValues: PaymentRequestFormValues,
    department: string
  ): Promise<CreatePedidoResult> => {
    try {
      // 1. Obter data atual
      const today = normalizeDate(new Date());

      // 2. Validar a data de pagamento
      const dateValidation = validatePaymentDate(formValues.dataPagamento);
      if (!dateValidation.valid) {
        return {
          success: false,
          suggestedDate: dateValidation.suggestedDate,
          message: dateValidation.message
        };
      }

      // 3. Consultar quantidade de pedidos do dia
      const existingCount = await getPedidosCountToday();

      // 4. Gerar código do pedido
      const { codigoCompleto, codigoCompacto } = generatePedidoCode(today, existingCount);

      // 5. Preparar payload
      const payload = preparePayload(formValues, codigoCompleto, codigoCompacto, department);

      // 5.1 Upload do anexo se existir
      let attachmentData: { url: string; name: string } | null = null;
      if (formValues.attachment) {
        attachmentData = await uploadAttachment(formValues.attachment, codigoCompleto);
      }

      // 6. Inserir no banco de dados
      const { data, error: insertError } = await supabase
        .from('payment_requests')
        .insert({
          codigo: payload.codigo,
          codigo_compacto: payload.codigoCompacto,
          tipo_solicitacao: payload.tipoSolicitacao,
          documento_numero: payload.documentoNumero,
          fornecedor: payload.fornecedor,
          cpf_cnpj: payload.cpfCnpj,
          valor_total: payload.valorTotal,
          forma_pagamento: payload.formaPagamento,
          dados_pagamento: payload.dadosPagamento,
          descricao_detalhada: payload.descricaoDetalhada,
          solicitado_por: payload.solicitadoPor,
          autorizado_por: payload.autorizadoPor,
          data_pagamento: payload.dataPagamento,
          email_usuario: payload.emailUsuario,
          department: payload.department,
          status: payload.status,
          attachment_url: attachmentData?.url || null,
          attachment_name: attachmentData?.name || null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 7. Atualizar lista local
      await fetchPaymentRequests();

      return {
        success: true,
        message: 'Pedido de pagamento criado com sucesso!',
        codigo: codigoCompleto,
        pdfUrl: data?.pdf_url
      };
    } catch (err) {
      console.error('Erro ao criar pedido:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao criar pedido de pagamento'
      };
    }
  };

  // Update payment request status
  const updatePaymentRequestStatus = async (
    id: string,
    status: PaymentRequestStatus,
    approvedBy?: string,
    rejectionReason?: string
  ) => {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (approvedBy) {
        updateData.approved_by = approvedBy;
        updateData.approval_date = new Date().toISOString();
      }

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error: updateError } = await supabase
        .from('payment_requests')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchPaymentRequests();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  // Delete payment request
  const deletePaymentRequest = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchPaymentRequests();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao excluir pedido');
    }
  };

  // Get next valid payment date
  const getNextPaymentDate = (): Date => {
    return getNextValidDate(new Date());
  };

  return {
    paymentRequests,
    loading,
    error,
    fetchPaymentRequests,
    createPedido,
    updatePaymentRequestStatus,
    deletePaymentRequest,
    getNextPaymentDate,
    getPedidosCountToday
  };
};
