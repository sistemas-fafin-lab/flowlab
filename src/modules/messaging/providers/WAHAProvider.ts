/**
 * WA-HA Provider Implementation
 * 
 * WhatsApp HTTP API (WA-HA) integration for sending messages to suppliers.
 * This is a standalone Docker container that provides WhatsApp Web API.
 * 
 * @see https://github.com/devlikeapro/waha
 */

import {
  IMessagingProvider,
  MessageProviderType,
  ProviderConfig,
  ProviderResponse,
  WAHAConfig,
  WAHASessionInfo,
  WAHASendMessageRequest,
  WAHASendMessageResponse,
} from '../types';

export class WAHAProvider implements IMessagingProvider {
  public readonly type: MessageProviderType = 'whatsapp';
  public readonly name: string = 'WA-HA (WhatsApp HTTP API)';
  
  private config: WAHAConfig | null = null;
  private initialized: boolean = false;

  /**
   * Initialize WA-HA provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    if (!config.apiUrl || !config.sessionName) {
      throw new Error('WA-HA requer apiUrl e sessionName na configuração');
    }

    this.config = config as WAHAConfig;
    
    // Validate session exists and is active
    try {
      const sessionInfo = await this.getSessionInfo();
      if (sessionInfo.status !== 'WORKING') {
        console.warn(`WA-HA session ${this.config.sessionName} não está funcionando (status: ${sessionInfo.status})`);
      }
      this.initialized = true;
    } catch (error) {
      throw new Error(`Falha ao inicializar WA-HA: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Send WhatsApp message to recipient
   */
  async sendMessage(
    recipient: string,
    body: string,
    subject?: string
  ): Promise<ProviderResponse> {
    if (!this.initialized || !this.config) {
      throw new Error('Provedor WA-HA não inicializado');
    }

    try {
      // Format phone number (WA-HA expects: 5511999999999@c.us)
      const chatId = this.formatPhoneNumber(recipient);

      const requestData: WAHASendMessageRequest = {
        session: this.config.sessionName,
        chatId,
        text: body,
      };

      const url = `${this.config.apiUrl}/api/sendText`;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this.config.token) {
        headers['X-Api-Key'] = this.config.token;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          timestamp: new Date().toISOString(),
          error: {
            code: response.status.toString(),
            message: `WA-HA API error: ${errorText}`,
          },
          raw: errorText,
        };
      }

      const result: WAHASendMessageResponse = await response.json();

      return {
        success: true,
        messageId: result.id,
        externalId: result.id,
        timestamp: new Date(result.timestamp * 1000).toISOString(),
        raw: result,
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: {
          code: 'SEND_ERROR',
          message: error instanceof Error ? error.message : 'Falha ao enviar mensagem',
        },
        raw: error,
      };
    }
  }

  /**
   * Check if WA-HA session is healthy
   */
  async checkHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    if (!this.config) {
      return {
        healthy: false,
        responseTime: 0,
        error: 'Provedor não configurado',
      };
    }

    const startTime = Date.now();

    try {
      const sessionInfo = await this.getSessionInfo();
      const responseTime = Date.now() - startTime;

      return {
        healthy: sessionInfo.status === 'WORKING',
        responseTime,
        error: sessionInfo.status !== 'WORKING' ? `Session status: ${sessionInfo.status}` : undefined,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Falha na verificação de saúde',
      };
    }
  }

  /**
   * Get session information from WA-HA
   */
  private async getSessionInfo(): Promise<WAHASessionInfo> {
    if (!this.config) {
      throw new Error('Provedor não configurado');
    }

    const url = `${this.config.apiUrl}/api/sessions/${this.config.sessionName}`;
    const headers: HeadersInit = {};

    if (this.config.token) {
      headers['X-Api-Key'] = this.config.token;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Falha ao obter informações da sessão: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Format phone number to WA-HA chatId format
   * Input: +5511999999999
   * Output: 5511999999999@c.us
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Add @c.us suffix for WhatsApp
    return `${cleaned}@c.us`;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.config = null;
    this.initialized = false;
  }

  /**
   * Static method to create and initialize provider
   */
  static async create(config: ProviderConfig): Promise<WAHAProvider> {
    const provider = new WAHAProvider();
    await provider.initialize(config);
    return provider;
  }
}
