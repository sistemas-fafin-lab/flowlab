import React from 'react';
import { MessageCircle } from 'lucide-react';
import { GlassCard, SectionHeader, StatusBadge } from './ui';
import { WA_STATUS_CONFIG } from '../constants';
import type { WaMessage } from '../types';

export const WhatsAppQueueCard: React.FC<{ messages: WaMessage[]; footer?: React.ReactNode }> = ({ messages, footer }) => (
  <GlassCard>
    <SectionHeader
      icon={MessageCircle}
      tone="from-emerald-500 to-green-600 shadow-emerald-500/25"
      title="Fila do WhatsApp"
      subtitle="Notificações automáticas via Wa-ha"
      right={
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ao vivo</span>
        </div>
      }
    />
    <div className="flex flex-col gap-1.5 flex-1">
      {messages.map((m) => {
        const st = WA_STATUS_CONFIG[m.status];
        return (
          <div key={m.id} className="flex gap-3 px-3.5 py-3 rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 animate-fade-in-up">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums w-[38px] flex-shrink-0 pt-px">{m.time}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{m.to}</p>
                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              </div>
              <p className="mt-[3px] text-xs leading-[1.45] text-slate-500 dark:text-slate-400 line-clamp-2">{m.text}</p>
              {m.note && <p className="mt-[3px] text-[11px] text-red-600 dark:text-red-400">{m.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
    {footer}
  </GlassCard>
);
