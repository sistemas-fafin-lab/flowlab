/**
 * useMessaging Hook
 * 
 * React hook for interacting with the messaging system
 */

import { useState, useEffect, useCallback } from 'react';
import { messagingService } from '../modules/messaging/services/MessagingService';
import { messageProcessor } from '../modules/messaging/services/MessageProcessor';
import {
  SendMessageInput,
  SendMessageResult,
  QuotationMessage,
  MessagingProvider,
  ProviderHealthStatus,
} from '../modules/messaging/types';
import { supabase } from '../lib/supabase';

export interface MessagingStats {
  totalMessages: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  deliveredCount: number;
  readCount: number;
  lastSentAt?: string;
}

export function useMessaging() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessorRunning, setIsProcessorRunning] = useState(false);
  const [providers, setProviders] = useState<MessagingProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize messaging service
  useEffect(() => {
    const init = async () => {
      try {
        await messagingService.initialize();
        setIsInitialized(true);
        
        // Load providers
        await loadProviders();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    };

    init();
  }, []);

  // Load providers
  const loadProviders = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('messaging_providers')
        .select('*')
        .order('name');

      if (err) throw err;
      
      setProviders(data?.map(p => ({
        id: p.id,
        code: p.code || p.type,
        name: p.name,
        type: p.type,
        config: p.config,
        isActive: p.is_active,
        healthStatus: 'unknown' as ProviderHealthStatus,
        lastHealthCheck: p.last_health_check,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })) || []);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (
    input: SendMessageInput
  ): Promise<SendMessageResult> => {
    if (!isInitialized) {
      throw new Error('Messaging service not initialized');
    }

    try {
      const result = await messagingService.sendMessage(input);
      return result;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [isInitialized]);

  // Resend failed message
  const resendMessage = useCallback(async (messageId: string): Promise<SendMessageResult> => {
    if (!isInitialized) {
      throw new Error('Messaging service not initialized');
    }

    try {
      return await messagingService.resendMessage(messageId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to resend message');
    }
  }, [isInitialized]);

  // Get message status
  const getMessageStatus = useCallback(async (messageId: string): Promise<QuotationMessage> => {
    return await messagingService.getMessageStatus(messageId);
  }, []);

  // Get quotation messages
  const getQuotationMessages = useCallback(async (
    quotationId: string
  ): Promise<QuotationMessage[]> => {
    const { data, error: err } = await supabase
      .from('quotation_messages')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: false });

    if (err) throw err;

    return data?.map(d => ({
      id: d.id,
      quotationId: d.quotation_id,
      supplierId: d.supplier_id,
      supplierName: d.supplier_name,
      providerId: d.provider_id,
      providerType: d.provider_type,
      templateId: d.template_id,
      recipient: d.recipient,
      subject: d.subject,
      body: d.body,
      status: d.status,
      attemptCount: d.attempt_count || 0,
      maxAttempts: d.max_attempts || 3,
      sentAt: d.sent_at,
      deliveredAt: d.delivered_at,
      readAt: d.read_at,
      failedAt: d.failed_at,
      errorMessage: d.error_message,
      providerResponse: d.provider_response,
      metadata: d.metadata,
      createdBy: d.created_by,
      createdByName: d.created_by_name,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })) || [];
  }, []);

  // Get messaging stats for quotation
  const getQuotationStats = useCallback(async (
    quotationId: string
  ): Promise<MessagingStats> => {
    const { data, error: err } = await supabase
      .from('quotation_message_status')
      .select('*')
      .eq('quotation_id', quotationId)
      .single();

    if (err) {
      return {
        totalMessages: 0,
        sentCount: 0,
        failedCount: 0,
        pendingCount: 0,
        deliveredCount: 0,
        readCount: 0,
      };
    }

    return {
      totalMessages: data.total_messages || 0,
      sentCount: data.sent_count || 0,
      failedCount: data.failed_count || 0,
      pendingCount: data.pending_count || 0,
      deliveredCount: data.delivered_count || 0,
      readCount: data.read_count || 0,
      lastSentAt: data.last_sent_at,
    };
  }, []);

  // Start message processor
  const startProcessor = useCallback(async () => {
    try {
      await messageProcessor.start();
      setIsProcessorRunning(true);
    } catch (err) {
      console.error('Failed to start processor:', err);
      throw err;
    }
  }, []);

  // Stop message processor
  const stopProcessor = useCallback(() => {
    messageProcessor.stop();
    setIsProcessorRunning(false);
  }, []);

  // Get processor status
  const getProcessorStatus = useCallback(() => {
    return messageProcessor.getStatus();
  }, []);

  // Check provider health
  const checkProviderHealth = useCallback(async (providerId: string) => {
    const { data, error: err } = await supabase
      .from('provider_health_logs')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (err) return null;
    
    return {
      status: data.status,
      responseTimeMs: data.response_time_ms,
      details: data.details,
      createdAt: data.created_at,
    };
  }, []);

  // Get all provider health statuses
  const getAllProviderHealth = useCallback(async () => {
    const healthStatuses = await Promise.all(
      providers.map(async (provider) => {
        const health = await checkProviderHealth(provider.id);
        return {
          provider,
          health,
        };
      })
    );

    return healthStatuses;
  }, [providers, checkProviderHealth]);

  // Create new provider
  const createProvider = useCallback(async (data: {
    code: string;
    name: string;
    type: 'whatsapp' | 'email' | 'sms' | 'api';
    config: Record<string, unknown>;
    isActive?: boolean;
  }) => {
    const { data: result, error: err } = await supabase
      .from('messaging_providers')
      .insert({
        code: data.code,
        name: data.name,
        type: data.type,
        config: data.config,
        is_active: data.isActive ?? true,
      })
      .select()
      .single();

    if (err) throw err;
    
    await loadProviders();
    return result;
  }, [loadProviders]);

  // Update existing provider
  const updateProvider = useCallback(async (
    id: string,
    data: {
      name?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
    }
  ) => {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: result, error: err } = await supabase
      .from('messaging_providers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (err) throw err;
    
    await loadProviders();
    return result;
  }, [loadProviders]);

  // Delete provider
  const deleteProvider = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('messaging_providers')
      .delete()
      .eq('id', id);

    if (err) throw err;
    
    await loadProviders();
  }, [loadProviders]);

  // Test provider connection (health check on demand)
  const testProviderConnection = useCallback(async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) throw new Error('Provedor não encontrado');

    if (provider.type === 'whatsapp' && provider.config.apiUrl && provider.config.sessionName) {
      try {
        const headers: HeadersInit = {};
        if (provider.config.token) {
          headers['X-Api-Key'] = provider.config.token as string;
        }

        const response = await fetch(
          `${provider.config.apiUrl}/api/sessions/${provider.config.sessionName}`,
          { headers }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return {
          success: true,
          status: data.status,
          sessionName: data.name,
          phone: data.me?.id?.replace('@c.us', ''),
        };
      } catch (error) {
        return {
          success: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Falha na conexão',
        };
      }
    }

    return {
      success: false,
      status: 'unsupported',
      error: 'Tipo de provedor não suportado para teste',
    };
  }, [providers]);

  return {
    // State
    isInitialized,
    isProcessorRunning,
    providers,
    error,

    // Actions
    sendMessage,
    resendMessage,
    getMessageStatus,
    getQuotationMessages,
    getQuotationStats,
    startProcessor,
    stopProcessor,
    getProcessorStatus,
    checkProviderHealth,
    getAllProviderHealth,
    loadProviders,
    
    // CRUD Providers
    createProvider,
    updateProvider,
    deleteProvider,
    testProviderConnection,
  };
}
