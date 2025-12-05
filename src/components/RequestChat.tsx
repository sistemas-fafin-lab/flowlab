import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send } from 'lucide-react';
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
}

const RequestChat: React.FC<RequestChatProps> = ({ requestId, currentUser, onClose }) => {
  const { showError } = useNotification();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    };

    fetchMessages();

    // Real-time listener
    const channel = supabase
      .channel(`request-chat-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe((status) => {
        console.log('Status do canal realtime:', status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const { error } = await supabase.from('request_messages').insert({
      request_id: requestId,
      author_id: currentUser.id,
      author_name: currentUser.name,
      content: newMessage.trim(),
    });

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Não foi possível enviar a mensagem.');
      return;
    }

    setNewMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full flex flex-col max-h-screen h-full">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Chat da Solicitação #{requestId}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[80%] ${
                msg.author_id === currentUser.id ? 'ml-auto items-end' : 'items-start'
              }`}
            >
              <div
                className={`px-3 py-2 rounded-2xl text-sm shadow ${
                  msg.author_id === currentUser.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <span className="block">{msg.content}</span>
              </div>
              <span className="text-xs text-gray-500 mt-1">
                {msg.author_name} • {new Date(msg.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Campo de digitação */}
        <div className="flex items-center border-t border-gray-200 p-3">
          <input
            type="text"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="ml-3 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestChat;