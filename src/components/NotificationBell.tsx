/**
 * NotificationBell
 *
 * Componente de sino de notificações In-App para o cabeçalho.
 * Exibe badge de não lidas e dropdown glassmorphism com listagem completa.
 *
 * O painel é renderizado via ReactDOM.createPortal + fixed positioning para
 * escapar do overflow:hidden da sidebar.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  X,
  Check,
  CheckCheck,
  Wrench,
  Code,
  ShoppingCart,
  Server,
  AlertTriangle,
  Info,
  AlertCircle,
  Headphones,
} from 'lucide-react';
import { useNotificationCenter, UserNotification, NotificationModule } from '../hooks/useNotificationCenter';
import { useAuth } from '../hooks/useAuth';



// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);

  if (secs  < 60)   return 'agora mesmo';
  if (mins  < 60)   return `há ${mins}min`;
  if (hours < 24)   return `há ${hours}h`;
  if (days  === 1)  return 'ontem';
  if (days  < 30)   return `há ${days} dias`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getModuleIcon(module: NotificationModule): React.ReactElement {
  const cls = 'w-4 h-4';
  switch (module) {
    case 'IT':          return <Headphones className={cls} />;
    case 'PURCHASING':  return <ShoppingCart className={cls} />;
    case 'SYSTEM':      return <Server className={cls} />;
    case 'MAINTENANCE': return <Wrench className={cls} />;
    case 'DEV':         return <Code className={cls} />;
    default:            return <Bell className={cls} />;
  }
}

const MODULE_COLORS: Record<string, string> = {
  IT:          'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  PURCHASING:  'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  SYSTEM:      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  MAINTENANCE: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  DEV:         'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
};

const TYPE_ICON: Record<string, React.ReactElement> = {
  success: <Check className="w-3 h-3 text-emerald-500" />,
  warning: <AlertTriangle className="w-3 h-3 text-amber-500" />,
  error:   <AlertCircle className="w-3 h-3 text-red-500" />,
  info:    <Info className="w-3 h-3 text-blue-500" />,
};

// ─── Item individual ───────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: UserNotification;
  onRead: (id: string) => Promise<void>;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead, onClose }) => {
  const navigate = useNavigate();
  const { id, title, content, module, type, link, is_read, created_at } = notification;

  const moduleColor = MODULE_COLORS[module] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

  const handleClick = async () => {
    if (!is_read) {
      await onRead(id).catch(() => {/* silencioso */});
    }
    if (link) {
      navigate(link);
      onClose();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150
        ${!is_read
          ? 'bg-violet-50/60 dark:bg-violet-900/20 hover:bg-violet-50 dark:hover:bg-violet-900/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
        ${link ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {/* Ícone do módulo */}
      <span className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${moduleColor}`}>
        {getModuleIcon(module)}
      </span>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {/* Dot não-lido */}
          {!is_read && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-500" />
          )}
          <p className={`text-sm leading-snug truncate ${!is_read ? 'font-semibold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
            {title}
          </p>
          <span className="flex-shrink-0 ml-auto">{TYPE_ICON[type] ?? TYPE_ICON.info}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {content}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {formatRelativeTime(created_at)}
        </p>
      </div>
    </button>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } =
    useNotificationCenter(user?.id);

  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calcula posição do painel de forma inteligente baseada no viewport
  const calcPosition = useCallback((): React.CSSProperties => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const gap = 12;
    const panelWidth = 384; // w-96
    const pos: React.CSSProperties = {};

    // VERTICAL: botão na metade inferior (sidebar desktop) → ancora pela base.
    // Botão na metade superior (header mobile) → ancora pelo topo.
    if (rect.top > window.innerHeight / 2) {
      pos.bottom = window.innerHeight - rect.bottom;
    } else {
      pos.top = rect.bottom + gap;
    }

    // HORIZONTAL: tenta abrir para a direita; se bater na borda, alinha pela direita do botão.
    if (rect.right + gap + panelWidth > window.innerWidth) {
      pos.right = window.innerWidth - rect.right;
    } else {
      pos.left = rect.right + gap;
    }

    return pos;
  }, []);

  // useLayoutEffect: calcula posição de forma síncrona APÓS o DOM pintar,
  // garantindo que getBoundingClientRect() retorna valores finais corretos.
  useLayoutEffect(() => {
    if (isOpen) {
      setPanelPos(calcPosition());
    }
  }, [isOpen, calcPosition]);

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const panel = document.getElementById('notification-panel');
      if (
        buttonRef.current?.contains(target) ||
        panel?.contains(target)
      ) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Reposicionar ao rolar ou redimensionar
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => setPanelPos(calcPosition());
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, calcPosition]);

  // Painel invisível até a primeira posição ser calculada
  const isPosReady = Object.keys(panelPos).length > 0;

  const displayedNotifications = notifications.slice(0, 20);

  const panel = isOpen ? (
    <div
      id="notification-panel"
      className="fixed w-96 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl z-[9999] flex flex-col"
      style={{
        ...panelPos,
        maxHeight: 'min(520px, calc(100vh - 16px))',
        visibility: isPosReady ? 'visible' : 'hidden',
      }}
    >
      {/* Header do painel */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Notificações
          </h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead().catch(() => {})}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
              title="Marcar todas como lidas"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todas</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista ou empty state */}
      <div className="overflow-y-auto custom-scrollbar flex-1">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <BellOff className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
              Tudo em dia!
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Você não tem novas notificações.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
            {displayedNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markAsRead}
                onClose={() => setIsOpen(false)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 20 && (
        <div className="px-4 py-2 border-t border-slate-200/60 dark:border-slate-700/60 text-center flex-shrink-0">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Exibindo as 20 mais recentes
          </p>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
        aria-label="Notificações"
        className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 active:scale-95"
      >
        <Bell className="w-5 h-5" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {ReactDOM.createPortal(panel, document.body)}
    </>
  );
};
