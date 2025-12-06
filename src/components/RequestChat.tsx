import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send, Check, CheckCheck, MessageSquare } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';

interface RequestChatProps {
  requestId: string;
  currentUser: { id: string; name: string };
  onClose: () => void;
}

interface Message {
  id: string;
  request_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
  read_by?: string[];
}

const RequestChat: React.FC<RequestChatProps> = ({ requestId, currentUser, onClose }) => {
  const { showError } = useNotification();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Marcar todas as mensagens como lidas ao abrir o chat
  const markAllAsRead = useCallback(async () => {
    try {
      // Atualiza mensagens não lidas pelo usuário atual
      const { data: unreadMessages } = await supabase
        .from('request_messages')
        .select('id, read_by')
        .eq('request_id', requestId)
        .neq('author_id', currentUser.id);

      if (unreadMessages) {
        for (const msg of unreadMessages) {
          const readBy = msg.read_by || [];
          if (!readBy.includes(currentUser.id)) {
            await supabase
              .from('request_messages')
              .update({ read_by: [...readBy, currentUser.id] })
              .eq('id', msg.id);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  }, [requestId, currentUser.id]);

  // Carrega mensagens ao abrir
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('request_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        showError('Erro ao carregar mensagens.');
        return;
      }
      setMessages((data as Message[]) || []);
      
      // Marcar como lidas após carregar
      setTimeout(() => markAllAsRead(), 500);
    };

    fetchMessages();

    // Real-time listener
    const channel = supabase
      .channel(`request-chat-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new as Message]);
            // Marcar nova mensagem como lida se não for do próprio usuário
            if ((payload.new as Message).author_id !== currentUser.id) {
              setTimeout(() => markAllAsRead(), 300);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => 
              prev.map(msg => msg.id === payload.new.id ? payload.new as Message : msg)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, currentUser.id, markAllAsRead, showError]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Foco no input ao abrir
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('request_messages').insert({
      request_id: requestId,
      author_id: currentUser.id,
      author_name: currentUser.name,
      content: messageContent,
      read_by: [currentUser.id]
    });

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Não foi possível enviar a mensagem.');
      setNewMessage(messageContent);
    }
    
    setIsSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Agrupar mensagens por data
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  // Verificar se a mensagem foi lida por outros
  const isMessageRead = (message: Message) => {
    return message.read_by && message.read_by.some(id => id !== message.author_id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[95vh] sm:max-h-[90vh] h-auto sm:h-[600px] animate-scale-in overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-indigo-500 flex-shrink-0">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white truncate">Chat da Solicitação</h3>
              <p className="text-xs text-blue-100">#{requestId.slice(0, 8)}...</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-200 flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Lista de mensagens */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50 to-white">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
              </div>
              <h4 className="text-gray-700 font-medium mb-1 text-sm sm:text-base">Nenhuma mensagem ainda</h4>
              <p className="text-xs sm:text-sm text-gray-500">Inicie a conversa enviando uma mensagem</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Separador de data */}
                <div className="flex items-center justify-center my-3 sm:my-4">
                  <div className="bg-gray-200 text-gray-600 text-xs font-medium px-2.5 sm:px-3 py-1 rounded-full">
                    {date}
                  </div>
                </div>
                
                {/* Mensagens do dia */}
                <div className="space-y-2 sm:space-y-3">
                  {dateMessages.map((msg, index) => {
                    const isOwn = msg.author_id === currentUser.id;
                    const showAuthor = !isOwn && (index === 0 || dateMessages[index - 1]?.author_id !== msg.author_id);
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-fade-in-up`}
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        {showAuthor && (
                          <span className="text-xs text-gray-500 mb-1 ml-2 font-medium">
                            {msg.author_name}
                          </span>
                        )}
                        <div
                          className={`relative max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm ${
                            isOwn
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-md'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={`flex items-center justify-end mt-1 space-x-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                            {isOwn && (
                              isMessageRead(msg) ? (
                                <CheckCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-200" />
                              ) : (
                                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-200/60" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Campo de digitação */}
        <div className="border-t border-gray-100 p-3 sm:p-4 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestChat;

// Hook para verificar mensagens não lidas de uma solicitação
export const useUnreadMessages = (requestId: string, userId: string) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!requestId || !userId) return;

    const fetchUnreadCount = async () => {
      const { data, error } = await supabase
        .from('request_messages')
        .select('id, read_by, author_id')
        .eq('request_id', requestId)
        .neq('author_id', userId);

      if (!error && data) {
        const unread = data.filter(msg => !msg.read_by?.includes(userId)).length;
        setUnreadCount(unread);
      }
    };

    fetchUnreadCount();

    // Real-time para atualizar contagem
    const channel = supabase
      .channel(`unread-${requestId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${requestId}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, userId]);

  return unreadCount;
};

// Componente de botão de chat com indicador de mensagens não lidas
export const ChatButton: React.FC<{
  requestId: string;
  userId: string;
  onClick: () => void;
  className?: string;
}> = ({ requestId, userId, onClick, className = '' }) => {
  const unreadCount = useUnreadMessages(requestId, userId);
  
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 transition-all duration-200 flex items-center font-medium group ${className}`}
    >
      <div className="relative mr-2">
        <MessageSquare className={`w-4 h-4 transition-all duration-200 ${unreadCount > 0 ? 'text-blue-600 animate-pulse' : 'group-hover:text-blue-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] bg-gradient-to-r from-red-500 to-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
      <span>Chat</span>
      {unreadCount > 0 && (
        <span className="ml-2 px-1.5 py-0.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full animate-pulse">
          {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
        </span>
      )}
    </button>
  );
};