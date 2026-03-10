/**
 * Message Processor
 * 
 * Background job to process pending messages and retry queue.
 * Should run as a scheduled task or interval-based worker.
 */

import { messagingService } from './MessagingService';
import { supabase } from '../../../lib/supabase';

export class MessageProcessor {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESS_INTERVAL_MS = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL_MS = 300000; // 5 minutes

  /**
   * Start the message processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('O processador de mensagens já está em execução');
      return;
    }

    console.log('Iniciando o processador de mensagens...');
    this.isRunning = true;

    // Initialize messaging service
    await messagingService.initialize();

    // Start processing loop
    this.intervalId = setInterval(async () => {
      await this.processMessages();
    }, this.PROCESS_INTERVAL_MS);

    // Start health check loop
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL_MS);

    // Run immediately on start
    await this.processMessages();
    await this.performHealthChecks();

    console.log('Processador de mensagens iniciado');
  }

  /**
   * Stop the message processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Processador de mensagens parado');
  }

  /**
   * Process pending messages and retry queue
   */
  private async processMessages(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[MessageProcessor] Ciclo de processamento iniciado');

      // Process pending messages
      await messagingService.processPendingMessages();

      // Process retry queue
      await messagingService.processRetryQueue();

      console.log('[MessageProcessor] Ciclo de processamento concluído');
    } catch (error) {
      console.error('[MessageProcessor] Erro durante o processamento:', error);
    }
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    if (!this.isRunning) return;

    try {
      console.log('[MessageProcessor] Executando verificações de saúde...');

      const { data: providers } = await supabase
        .from('messaging_providers')
        .select('*')
        .eq('is_active', true);

      if (!providers) return;

      for (const provider of providers) {
        try {
          // Import provider dynamically
          let healthStatus: boolean = false;
          let details: any = null;

          if (provider.type === 'whatsapp') {
            const { WAHAProvider } = await import('../providers/WAHAProvider');
            const wahaProvider = await WAHAProvider.create(provider.config);
            const health = await wahaProvider.checkHealth();
            healthStatus = health.healthy;
            details = {
              responseTime: health.responseTime,
              error: health.error,
            };
          }

          // Log health status
          await supabase.from('provider_health_logs').insert({
            provider_id: provider.id,
            status: healthStatus ? 'healthy' : 'degraded',
            response_time_ms: 0, // Can be measured in actual implementation
            details,
          });

          // Update provider last_health_check
          await supabase
            .from('messaging_providers')
            .update({
              last_health_check: new Date().toISOString(),
            })
            .eq('id', provider.id);

          console.log(`[Health] ${provider.name}: ${healthStatus ? '✓' : '✗'}`);
        } catch (error) {
          console.error(`[Health] Falha ao verificar ${provider.name}:`, error);
          
          // Log failed health check
          await supabase.from('provider_health_logs').insert({
            provider_id: provider.id,
            status: 'unhealthy',
            details: { error: error instanceof Error ? error.message : 'Erro desconhecido' },
          });
        }
      }
    } catch (error) {
      console.error('[MessageProcessor] Erro durante as verificações de saúde:', error);
    }
  }

  /**
   * Get processor status
   */
  getStatus(): { running: boolean; intervalMs: number } {
    return {
      running: this.isRunning,
      intervalMs: this.PROCESS_INTERVAL_MS,
    };
  }
}

// Singleton instance
export const messageProcessor = new MessageProcessor();

// Auto-start in browser context (optional)
// Can be enabled/disabled via environment or feature flag
if (typeof window !== 'undefined') {
  // Manual start required - call messageProcessor.start() explicitly
  // Auto-start disabled until proper env setup
}
