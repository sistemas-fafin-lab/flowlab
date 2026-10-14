import React from 'react';
import { EvaOrb } from './EvaOrb';
import { GlowFrame } from './EvaGlow';
import { useEvaUI } from './EvaUIContext';
import type { EvaInsightData } from '../types';

interface EvaInsightProps {
  /** Sem comentário (a regra não tem nada a dizer), o rodapé não aparece. */
  insight?: EvaInsightData;
  accepted: boolean;
  onAccept: () => void;
  onAsk: (prompt: string) => void;
  className?: string;
}

/** Comentário inline da EVA no rodapé de cada bloco. */
export const EvaInsight: React.FC<EvaInsightProps> = ({ insight, accepted, onAccept, onAsk, className = 'mt-4' }) => {
  const { showInsights } = useEvaUI();
  if (!showInsights || !insight) return null;

  return (
    <GlowFrame className={className} innerClassName="flex gap-3 items-start px-4 py-3.5 bg-white/[.94] dark:bg-slate-900/[.94]">
      <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
        <EvaOrb size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold tracking-[.08em] uppercase bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">EVA</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{insight.source}</span>
        </div>
        <p className="text-[13px] leading-[1.55] text-slate-700 dark:text-slate-300 [text-wrap:pretty]">{insight.text}</p>
        {accepted ? (
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{insight.doneText}</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button
              type="button"
              onClick={onAccept}
              className="px-3 py-1.5 rounded-[10px] bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 active:scale-[.98] transition-all"
            >
              {insight.ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => onAsk(insight.askPrompt)}
              className="px-3 py-1.5 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-medium hover:border-slate-300 transition-colors"
            >
              Perguntar à EVA
            </button>
          </div>
        )}
      </div>
    </GlowFrame>
  );
};
