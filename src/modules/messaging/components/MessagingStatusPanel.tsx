/**
 * MessagingStatusPanel
 * 
 * Display panel showing messaging status for a quotation
 */

import React, { useEffect, useState } from 'react';
import { useMessaging, MessagingStats } from '../../../hooks/useMessaging';
import { QuotationMessage } from '../types';

interface MessagingStatusPanelProps {
  quotationId: string;
  onResend?: (messageId: string) => void;
}

export const MessagingStatusPanel: React.FC<MessagingStatusPanelProps> = ({
  quotationId,
  onResend,
}) => {
  const {
    getQuotationMessages,
    getQuotationStats,
    resendMessage,
  } = useMessaging();

  const [messages, setMessages] = useState<QuotationMessage[]>([]);
  const [stats, setStats] = useState<MessagingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [quotationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [messagesData, statsData] = await Promise.all([
        getQuotationMessages(quotationId),
        getQuotationStats(quotationId),
      ]);
      
      setMessages(messagesData);
      setStats(statsData);
    } catch (error) {
      console.error('Falha ao carregar dados de mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (messageId: string) => {
    setResending(messageId);
    try {
      await resendMessage(messageId);
      await loadData();
      onResend?.(messageId);
    } catch (error) {
      console.error('Falha ao reenviar mensagem:', error);
      alert('Falha ao reenviar mensagem');
    } finally {
      setResending(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
      case 'read':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'sending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      sending: 'Enviando',
      sent: 'Enviado',
      delivered: 'Entregue',
      read: 'Lido',
      failed: 'Falhou',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.totalMessages}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.sentCount}</div>
            <div className="text-sm text-gray-600">Enviadas</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
            <div className="text-sm text-gray-600">Pendentes</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats.failedCount}</div>
            <div className="text-sm text-gray-600">Falhas</div>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white border rounded-lg">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Mensagens Enviadas</h3>
        </div>
        
        <div className="divide-y">
          {messages.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma mensagem enviada ainda
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {message.supplierName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(message.status)}`}
                      >
                        {getStatusLabel(message.status)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-1">
                      {message.recipient}
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {message.sentAt ? (
                        <span>Enviado em {new Date(message.sentAt).toLocaleString('pt-BR')}</span>
                      ) : (
                        <span>Criado em {new Date(message.createdAt).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                    
                    {message.errorMessage && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        Erro: {message.errorMessage}
                      </div>
                    )}
                    
                    {message.attemptCount > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        Tentativas: {message.attemptCount}/{message.maxAttempts}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    {message.status === 'failed' && message.attemptCount < message.maxAttempts && (
                      <button
                        onClick={() => handleResend(message.id)}
                        disabled={resending === message.id}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resending === message.id ? 'Reenviando...' : 'Reenviar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
