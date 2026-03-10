/**
 * Messaging Module - Types
 * 
 * Domain types for the messaging infrastructure.
 * Provider-agnostic design allows multiple messaging channels.
 */

export type MessageProviderType = 'whatsapp' | 'email' | 'sms' | 'api';

export type MessageStatus = 
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'read';

export type ProviderHealthStatus = 'online' | 'offline' | 'error' | 'unknown';

// ============================================
// PROVIDER CONFIGURATION
// ============================================

export interface MessagingProvider {
  id: string;
  code: string;
  name: string;
  type: MessageProviderType;
  config: ProviderConfig;
  isActive: boolean;
  healthStatus: ProviderHealthStatus;
  lastHealthCheck?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfig {
  // WA-HA specific
  apiUrl?: string;
  sessionName?: string;
  token?: string;
  
  // Email specific
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromAddress?: string;
  
  // SMS specific
  apiKey?: string;
  senderId?: string;
  
  // General
  timeout?: number;
  retryAttempts?: number;
  [key: string]: unknown;
}

// ============================================
// TEMPLATES
// ============================================

export interface MessageTemplate {
  id: string;
  code: string;
  name: string;
  providerType: MessageProviderType;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariables {
  quotationCode?: string;
  quotationTitle?: string;
  supplierName?: string;
  itemsList?: string;
  responseDeadline?: string;
  contactName?: string;
  contactPhone?: string;
  companyName?: string;
  [key: string]: string | undefined;
}

// ============================================
// MESSAGES
// ============================================

export interface QuotationMessage {
  id: string;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  providerId?: string;
  providerType: MessageProviderType;
  templateId?: string;
  recipient: string;
  subject?: string;
  body: string;
  status: MessageStatus;
  attemptCount: number;
  maxAttempts: number;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  errorMessage?: string;
  providerResponse?: ProviderResponse;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderResponse {
  success: boolean;
  messageId?: string;
  externalId?: string;
  timestamp?: string;
  error?: {
    code: string;
    message: string;
  };
  raw?: unknown;
}

// ============================================
// RETRY QUEUE
// ============================================

export interface MessageRetryQueueItem {
  id: string;
  messageId: string;
  nextRetryAt: string;
  retryReason?: string;
  priority: number;
  createdAt: string;
}

// ============================================
// HEALTH MONITORING
// ============================================

export interface ProviderHealthLog {
  id: string;
  providerId: string;
  status: ProviderHealthStatus;
  responseTimeMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  checkedAt: string;
}

export interface ProviderHealthCheck {
  providerId: string;
  providerName: string;
  type: MessageProviderType;
  status: ProviderHealthStatus;
  isActive: boolean;
  lastCheck?: string;
  responseTime?: number;
  uptime?: string;
}

// ============================================
// SERVICE INTERFACES
// ============================================

export interface SendMessageInput {
  quotationId: string;
  supplierId: string;
  recipient: string;
  templateCode?: string;
  variables?: TemplateVariables;
  priority?: number;
}

export interface SendMessageResult {
  messageId: string;
  status: MessageStatus;
  sentAt?: string;
  error?: string;
}

export interface MessageSendingService {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  resendMessage(messageId: string): Promise<SendMessageResult>;
  getMessageStatus(messageId: string): Promise<QuotationMessage>;
  processPendingMessages(): Promise<void>;
  processRetryQueue(): Promise<void>;
}

// ============================================
// PROVIDER INTERFACE (for implementations)
// ============================================

export interface IMessagingProvider {
  readonly type: MessageProviderType;
  readonly name: string;
  
  /**
   * Initialize provider (establish connections, validate config)
   */
  initialize(config: ProviderConfig): Promise<void>;
  
  /**
   * Send a message through this provider
   */
  sendMessage(recipient: string, body: string, subject?: string): Promise<ProviderResponse>;
  
  /**
   * Check health/connectivity of provider
   */
  checkHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }>;
  
  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

// ============================================
// WA-HA SPECIFIC TYPES
// ============================================

export interface WAHAConfig extends ProviderConfig {
  apiUrl: string;
  sessionName: string;
  token?: string;
}

export interface WAHASessionInfo {
  name: string;
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
  qr?: string;
  me?: {
    id: string;
    pushName: string;
  };
}

export interface WAHASendMessageRequest {
  session: string;
  chatId: string;
  text: string;
}

export interface WAHASendMessageResponse {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  to: string;
  body: string;
  hasMedia: boolean;
}

export interface WAHAWebhookPayload {
  event: 'message' | 'message.ack' | 'state.change' | 'session.status';
  session: string;
  payload: {
    id?: string;
    ack?: number; // 0=sent, 1=delivered, 2=read
    from?: string;
    to?: string;
    body?: string;
    timestamp?: number;
    state?: string;
  };
}

// ============================================
// STATISTICS & MONITORING
// ============================================

export interface MessageStatistics {
  totalMessages: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  deliveredCount: number;
  readCount: number;
  lastSentAt?: string;
  lastDeliveredAt?: string;
}

export interface QuotationMessageStatus {
  quotationId: string;
  quotationCode: string;
  quotationTitle: string;
  quotationStatus: string;
  messageStats: MessageStatistics;
}
