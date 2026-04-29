/**
 * useNotificationCenter
 *
 * Hook central para a Central de Notificações In-App.
 * Gerencia busca, estado local, Supabase Realtime e disparo de notificações
 * (com envio opcional de email via /api/notifications/email).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NotificationModule = 'IT' | 'PURCHASING' | 'SYSTEM' | string;
export type NotificationType    = 'info' | 'success' | 'warning' | 'error';

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  module: NotificationModule;
  type: NotificationType;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SendNotificationInput {
  /** UUID do usuário destinatário */
  userId: string;
  title: string;
  content: string;
  module: NotificationModule;
  type?: NotificationType;
  /** Rota de redirecionamento ao clicar, ex: /dashboard/it/123 */
  link?: string;
  /** Se true, também envia email via /api/notifications/email */
  sendEmail?: boolean;
  /** Obrigatório quando sendEmail = true */
  emailData?: {
    to: string;
    templateSlug: string;
    variables: Record<string, string>;
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificationCenter(userId?: string) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evita registrar o canal realtime mais de uma vez
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // ID único por instância do hook para evitar conflito de nome de canal
  const instanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // ── Busca inicial ────────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;

      setNotifications((data as UserNotification[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Supabase Realtime ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    // Cancela canal anterior se o userId mudar
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`user_notifications:${userId}:${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as UserNotification;
          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as UserNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // ── Ações ────────────────────────────────────────────────────────────────────

  /**
   * Insere uma notificação no banco (e opcionalmente envia email).
   */
  const sendNotification = useCallback(
    async (input: SendNotificationInput): Promise<void> => {
      const { userId: targetUserId, title, content, module, type = 'info', link, sendEmail, emailData } = input;

      try {
        // 1. Persistir no Supabase
        const { error: insertError } = await supabase
          .from('user_notifications')
          .insert({
            user_id: targetUserId,
            title,
            content,
            module,
            type,
            link: link ?? null,
            is_read: false,
          });

        if (insertError) throw insertError;

        // 2. Envio de email (opcional)
        if (sendEmail && emailData) {
          const response = await fetch('/api/notifications/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: emailData.to,
              templateSlug: emailData.templateSlug,
              variables: emailData.variables,
            }),
          });

          if (!response.ok) {
            const { error: emailErr } = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            // Não lança — notificação in-app já foi salva com sucesso
            console.warn('[sendNotification] Falha no envio de email:', emailErr);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao enviar notificação';
        console.error('[sendNotification]', message);
        throw new Error(message);
      }
    },
    []
  );

  /**
   * Marca uma notificação como lida.
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    try {
      const { error: err } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (err) throw err;

      // O UPDATE realtime atualizará o estado; mas aplica otimisticamente também
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('[markAsRead]', err instanceof Error ? err.message : err);
      throw err;
    }
  }, []);

  /**
   * Marca todas as notificações do usuário como lidas.
   */
  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      const { error: err } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (err) throw err;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('[markAllAsRead]', err instanceof Error ? err.message : err);
      throw err;
    }
  }, [userId]);

  // ── Valores derivados ────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    sendNotification,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
