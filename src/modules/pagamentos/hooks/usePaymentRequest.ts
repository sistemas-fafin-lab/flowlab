import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  PaymentRequest, 
  PaymentRequestFormValues, 
  PaymentRequestStatus 
} from '../../../types';
import {
  normalizeDate,
  generatePedidoCode,
  validatePaymentDate,
  preparePayload,
  getNextValidDate
} from '../../../utils/paymentUtils';
import { useDataCache, DEFAULT_STALE_TIME } from '../../../hooks/useDataCache';

const CACHE_KEY = 'payment:requests';

// Avisa por e-mail (e no sininho) quem precisa agir: o autorizador quando o pedido é
// criado; o solicitante e o Financeiro quando o autorizador decide. O servidor lê o pedido
// pelo id e escolhe os destinatários (api/_lib/handlers/notifications-payment-request.ts).
// Nunca lança: falha no aviso não pode desfazer a ação.
async function notificarPagamento(id: string | undefined, evento: 'criado' | 'decidido'): Promise<void> {
  if (!id) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch('/api/notifications/payment-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, evento }),
    });
    if (!res.ok) console.warn('[notificarPagamento] falha ao avisar:', evento, res.status);
  } catch (err) {
    console.warn('[notificarPagamento] falha ao avisar:', evento, err);
  }
}

interface CreatePedidoResult {
  success: boolean;
  message?: string;
  pdfUrl?: string;
  codigo?: string;
  suggestedDate?: Date;
  error?: string;
}

export const usePaymentRequest = () => {
  const { getCache, setCache } = useDataCache();
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
        solicitanteId: request.solicitante_id ?? undefined,
        autorizadoPor: request.autorizado_por,
        autorizadoPorId: request.autorizado_por_id ?? undefined,
        autorizadoEm: request.autorizado_em ?? undefined,
        rejeitadoPor: request.rejeitado_por ?? undefined,
        dataPagamento: request.data_pagamento,
        emailUsuario: request.email_usuario,
        department: request.department,
        status: request.status,
        pdfUrl: request.pdf_url,
        attachmentUrl: request.attachment_url,
        attachmentName: request.attachment_name,
        attachments: Array.isArray(request.attachments) && request.attachments.length > 0
          ? request.attachments
          : request.attachment_url
            ? [{ url: request.attachment_url, name: request.attachment_name || '' }]
            : [],
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        approvedBy: request.approved_by,
        approvalDate: request.approval_date,
        rejectionReason: request.rejection_reason
      }));

      setPaymentRequests(formattedRequests);
      setCache(CACHE_KEY, formattedRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitações de pagamento');
    } finally {
      setLoading(false);
    }
  }, [setCache]);

  useEffect(() => {
    const cached = getCache<PaymentRequest[]>(CACHE_KEY);
    if (cached) {
      setPaymentRequests(cached.data);
    }
    if (cached && Date.now() - cached.timestamp < DEFAULT_STALE_TIME) {
      setLoading(false);
      return;
    }
    fetchPaymentRequests();
  }, [fetchPaymentRequests, getCache]);

  // Get count of pedidos for today
  // Pela função do banco: a leitura de payment_requests é recortada por setor, e o código do
  // pedido numera os pedidos do dia de todos os setores.
  const getPedidosCountToday = async (): Promise<number> => {
    const today = normalizeDate(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase.rpc('payment_requests_criados_entre', {
      p_inicio: today.toISOString(),
      p_fim: tomorrow.toISOString()
    });

    if (error) {
      console.error('Erro ao contar pedidos:', error);
      return 0;
    }

    return data || 0;
  };

  // Upload múltiplos anexos para o Supabase Storage
  const uploadAttachments = async (files: File[], codigo: string): Promise<{ url: string; name: string }[]> => {
    const results: { url: string; name: string }[] = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${codigo.replace(/[/\s]/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${fileExt}`;
        const filePath = `attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-attachments')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('payment-attachments')
          .getPublicUrl(filePath);

        results.push({ url: urlData.publicUrl, name: file.name });
      } catch (err) {
        console.error('Erro ao fazer upload do anexo:', err);
      }
    }

    return results;
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

      // 5.1 Upload dos anexos se existirem
      let attachmentsData: { url: string; name: string }[] = [];
      if (formValues.attachments && formValues.attachments.length > 0) {
        attachmentsData = await uploadAttachments(formValues.attachments, codigoCompleto);
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
          // O trigger payment_request_guard confere a permissão e grava o nome do perfil.
          autorizado_por: payload.autorizadoPor,
          autorizado_por_id: payload.autorizadoPorId,
          data_pagamento: payload.dataPagamento,
          email_usuario: payload.emailUsuario,
          department: payload.department,
          status: payload.status,
          attachments: attachmentsData
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 7. Avisar o autorizador (ou, se quem pede é o autorizador, o Financeiro)
      void notificarPagamento(data?.id, 'criado');

      // 8. Atualizar lista local
      await fetchPaymentRequests();

      return {
        success: true,
        message: data?.status === 'awaiting_authorization'
          ? `Pedido criado. ${data?.autorizado_por ?? 'O autorizador'} foi avisado por e-mail para autorizar.`
          : 'Pedido criado e já autorizado: ele segue para a aprovação do Financeiro.',
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
    rejectionReason?: string,
    rejeitadoPor?: string
  ) => {
    try {
      const updateData: Record<string, unknown> = {
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

      if (rejeitadoPor) {
        updateData.rejeitado_por = rejeitadoPor;
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

  // Decisão do autorizador escolhido no pedido: autoriza (vai para o Financeiro) ou rejeita
  // com motivo. Pela função do banco, que confere quem decide (20261020150000).
  const decidirAutorizacao = async (id: string, autorizar: boolean, motivo?: string) => {
    const { error: rpcError } = await supabase.rpc('payment_request_decidir_autorizacao', {
      p_id: id,
      p_autorizar: autorizar,
      p_motivo: motivo ?? null
    });
    if (rpcError) throw new Error(rpcError.message);
    void notificarPagamento(id, 'decidido');
    await fetchPaymentRequests();
  };

  // Vários pedidos de uma vez (ações em lote). Só muda os que ainda estão em `de`: se outra
  // pessoa decidiu no meio-tempo, a decisão dela fica. Devolve quantos mudaram.
  const updatePaymentRequestsStatus = async (
    ids: string[],
    de: PaymentRequestStatus,
    para: PaymentRequestStatus,
    approvedBy?: string
  ): Promise<number> => {
    const agora = new Date().toISOString();
    const { data, error: updateError } = await supabase
      .from('payment_requests')
      .update({
        status: para,
        updated_at: agora,
        ...(approvedBy ? { approved_by: approvedBy, approval_date: agora } : {})
      })
      .in('id', ids)
      .eq('status', de)
      .select('id');

    if (updateError) throw new Error(updateError.message);
    await fetchPaymentRequests();
    return data?.length ?? 0;
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
    updatePaymentRequestsStatus,
    decidirAutorizacao,
    deletePaymentRequest,
    getNextPaymentDate,
    getPedidosCountToday
  };
};
