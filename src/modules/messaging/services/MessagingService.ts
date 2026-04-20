/**
 * Messaging Service
 * 
 * Core service for sending messages through multiple providers.
 * Handles template rendering, retry logic, and status tracking.
 */

import { supabase } from '../../../lib/supabase';
import {
  IMessagingProvider,
  MessagingProvider,
  MessageTemplate,
  QuotationMessage,
  SendMessageInput,
  SendMessageResult,
  TemplateVariables,
  MessageSendingService,
  ProviderResponse,
  MessageStatus,
} from '../types';
import { WAHAProvider } from '../providers/WAHAProvider';

export class MessagingService implements MessageSendingService {
  private providers: Map<string, IMessagingProvider> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize service and load active providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { data: providers, error } = await supabase
        .from('messaging_providers')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const providerConfig of providers || []) {
        await this.loadProvider(providerConfig);
      }

      this.initialized = true;
      console.log(`Messaging service initialized with ${this.providers.size} providers`);
    } catch (error) {
      console.error('Failed to initialize messaging service:', error);
      throw error;
    }
  }

  /**
   * Load and initialize a provider
   */
  private async loadProvider(providerData: MessagingProvider): Promise<void> {
    try {
      let provider: IMessagingProvider | null = null;

      switch (providerData.type) {
        case 'whatsapp':
          provider = await WAHAProvider.create(providerData.config);
          break;
        // Future: Add email, SMS, etc.
        default:
          console.warn(`Unknown provider type: ${providerData.type}`);
          return;
      }

      if (provider) {
        this.providers.set(providerData.id, provider);
        console.log(`Loaded provider: ${providerData.name} (${providerData.type})`);
      }
    } catch (error) {
      console.error(`Failed to load provider ${providerData.name}:`, error);
    }
  }

  /**
   * Send a message to a supplier
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get or create message record
      let messageId: string;
      let message: QuotationMessage;

      const { data: existingMessage } = await supabase
        .from('quotation_messages')
        .select('*')
        .eq('quotation_id', input.quotationId)
        .eq('supplier_id', input.supplierId)
        .eq('status', 'pending')
        .single();

      if (existingMessage) {
        messageId = existingMessage.id;
        message = this.mapDatabaseToMessage(existingMessage);
      } else {
        // Create new message record
        const template = await this.getTemplate(input.templateCode || 'quotation_invitation');
        const body = await this.renderTemplate(template, input.variables || {});

        const { data: newMessage, error } = await supabase
          .from('quotation_messages')
          .insert({
            quotation_id: input.quotationId,
            supplier_id: input.supplierId,
            recipient: input.recipient,
            provider_type: 'whatsapp',
            template_id: template?.id,
            body,
            status: 'pending',
          })
          .select()
          .single();

        if (error || !newMessage) {
          throw new Error('Falha ao criar registro de mensagem');
        }

        messageId = newMessage.id;
        message = this.mapDatabaseToMessage(newMessage);
      }

      // Update status to sending
      await this.updateMessageStatus(messageId, 'sending');

      // Get provider
      const provider = message.providerId 
        ? this.providers.get(message.providerId)
        : Array.from(this.providers.values())[0]; // Use first available provider

      if (!provider) {
        await this.markMessageFailed(messageId, 'No active provider available');
        return {
          messageId,
          status: 'failed',
          error: 'Nenhum provedor ativo disponível',
        };
      }

      // Send message through provider
      const result = await provider.sendMessage(
        message.recipient,
        message.body,
        message.subject
      );

      // Update message with result
      await this.processProviderResponse(messageId, result);

      return {
        messageId,
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? result.timestamp : undefined,
        error: result.error?.message,
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return {
        messageId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Reenviar uma mensagem falhada
   */
  async resendMessage(messageId: string): Promise<SendMessageResult> {
    const { data: messageData } = await supabase
      .from('quotation_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!messageData) {
      throw new Error('Mensagem não encontrada');
    }

    const message = this.mapDatabaseToMessage(messageData);

    if (message.attemptCount >= message.maxAttempts) {
      throw new Error('Número máximo de tentativas atingido');
    }

    return this.sendMessage({
      quotationId: message.quotationId,
      supplierId: message.supplierId,
      recipient: message.recipient,
    });
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<QuotationMessage> {
    const { data, error } = await supabase
      .from('quotation_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error || !data) {
      throw new Error('Mensagem não encontrada');
    }

    return this.mapDatabaseToMessage(data);
  }

  /**
   * Process all pending messages
   */
  async processPendingMessages(): Promise<void> {
    const { data: pendingMessages } = await supabase
      .from('quotation_messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (!pendingMessages || pendingMessages.length === 0) {
      return;
    }

    console.log(`Processando ${pendingMessages.length} mensagens pendentes`);

    for (const messageData of pendingMessages) {
      const message = this.mapDatabaseToMessage(messageData);
      
      try {
        await this.sendMessage({
          quotationId: message.quotationId,
          supplierId: message.supplierId,
          recipient: message.recipient,
        });
        
        // Add delay between messages to avoid rate limiting
        await this.delay(2000);
      } catch (error) {
        console.error(`Falha ${message.id}:`, error);
      }
    }
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<void> {
    const { data: retryMessages } = await supabase
      .rpc('get_messages_for_retry');

    if (!retryMessages || retryMessages.length === 0) {
      return;
    }

    console.log(`Processando ${retryMessages.length} mensagens da fila de retry`);

    for (const message of retryMessages) {
      try {
        await this.resendMessage(message.message_id);
        
        // Remove from retry queue on success
        await supabase
          .from('message_retry_queue')
          .delete()
          .eq('message_id', message.message_id);
        
        await this.delay(2000);
      } catch (error) {
        console.error(`Falha ao tentar reenviar a mensagem ${message.message_id}:`, error);
      }
    }
  }

  /**
   * Get template by code
   */
  private async getTemplate(code: string): Promise<MessageTemplate | null> {
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    return data ? {
      id: data.id,
      code: data.code,
      name: data.name,
      providerType: data.provider_type,
      subject: data.subject,
      body: data.body,
      variables: data.variables || [],
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } : null;
  }

  /**
   * Render template with variables
   */
  private async renderTemplate(
    template: MessageTemplate | null,
    variables: TemplateVariables
  ): Promise<string> {
    if (!template) {
      return JSON.stringify(variables, null, 2);
    }

    // Use database function for rendering
    const { data, error } = await supabase
      .rpc('render_message_template', {
        template_body: template.body,
        variables: variables as any,
      });

    if (error) {
      console.error('Template rendering error:', error);
      return template.body;
    }

    return data;
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    await supabase
      .from('quotation_messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', messageId);
  }

  /**
   * Process provider response and update message
   */
  private async processProviderResponse(
    messageId: string,
    response: ProviderResponse
  ): Promise<void> {
    const updateData: any = {
      provider_response: response,
      updated_at: new Date().toISOString(),
    };

    if (response.success) {
      updateData.status = 'sent';
      updateData.sent_at = response.timestamp || new Date().toISOString();
    } else {
      updateData.status = 'failed';
      updateData.failed_at = new Date().toISOString();
      updateData.error_message = response.error?.message;

      // Schedule retry
      await supabase.rpc('schedule_message_retry', {
        message_id_param: messageId,
        retry_delay_seconds: 300, // 5 minutes
      });
    }

    // Increment attempt count
    await supabase
      .from('quotation_messages')
      .update(updateData)
      .eq('id', messageId);

    await supabase.rpc('execute', {
      query: `UPDATE quotation_messages SET attempt_count = attempt_count + 1 WHERE id = '${messageId}'`
    });
  }

  /**
   * Mark message as failed
   */
  private async markMessageFailed(messageId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('quotation_messages')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);
  }

  /**
   * Map database record to domain object
   */
  private mapDatabaseToMessage(data: any): QuotationMessage {
    return {
      id: data.id,
      quotationId: data.quotation_id,
      supplierId: data.supplier_id,
      supplierName: data.supplier_name,
      providerId: data.provider_id,
      providerType: data.provider_type,
      templateId: data.template_id,
      recipient: data.recipient,
      subject: data.subject,
      body: data.body,
      status: data.status,
      attemptCount: data.attempt_count || 0,
      maxAttempts: data.max_attempts || 3,
      sentAt: data.sent_at,
      deliveredAt: data.delivered_at,
      readAt: data.read_at,
      failedAt: data.failed_at,
      errorMessage: data.error_message,
      providerResponse: data.provider_response,
      metadata: data.metadata,
      createdBy: data.created_by,
      createdByName: data.created_by_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const messagingService = new MessagingService();
