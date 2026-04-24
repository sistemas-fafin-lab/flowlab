import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface DetailModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  icon?: React.ReactNode;
  accentColor?: string;
}

const DetailModal: React.FC<DetailModalProps> = ({ 
  title, 
  children, 
  onClose,
  icon,
  accentColor = "blue"
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Suporte para tecla ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const colorClasses: Record<string, { gradient: string; border: string; iconBg: string }> = {
    blue: {
      gradient: "from-blue-500 to-indigo-500",
      border: "border-blue-200",
      iconBg: "bg-blue-500"
    },
    green: {
      gradient: "from-green-500 to-emerald-500",
      border: "border-green-200",
      iconBg: "bg-green-500"
    },
    orange: {
      gradient: "from-orange-500 to-amber-500",
      border: "border-orange-200",
      iconBg: "bg-orange-500"
    },
    red: {
      gradient: "from-red-500 to-rose-500",
      border: "border-red-200",
      iconBg: "bg-red-500"
    },
    purple: {
      gradient: "from-purple-500 to-violet-500",
      border: "border-purple-200",
      iconBg: "bg-purple-500"
    }
  };

  // Map accentColor key → real CSS color for the glow element
  const glowColorMap: Record<string, string> = {
    blue:   '#3b82f6',
    green:  '#22c55e',
    orange: '#f97316',
    red:    '#ef4444',
    purple: '#a855f7',
  };
  const glowColor = glowColorMap[accentColor] ?? glowColorMap.blue;

  const colors = colorClasses[accentColor] || colorClasses.blue;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className={`relative bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-white dark:border-slate-700/50 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 w-full ${
          isExpanded
            ? 'sm:w-[95vw] h-[95vh]'
            : 'max-w-[95vw] sm:max-w-[90vw] max-h-[90vh] sm:max-h-[85vh] sm:min-w-[400px]'
        }`}
      >
        {/* ── Glow interno ──────────────────────────────────── */}
        <div
          className="absolute -left-10 -top-10 w-48 h-48 rounded-full blur-3xl opacity-5 dark:opacity-20 bg-current pointer-events-none"
          style={{ color: glowColor }}
        />
        {/* ── Cabeçalho ─────────────────────────────────────── */}
        <div className="relative flex-shrink-0">
          {/* Background Gradient sutil */}
          <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-[0.03] dark:opacity-[0.15]`} />

          <div className="relative flex items-center justify-between px-4 py-3 sm:px-6 sm:py-5 border-b border-white/30 dark:border-slate-700/50">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {icon && (
                <div className={`p-2 sm:p-2.5 rounded-xl ${colors.iconBg} shadow-lg flex-shrink-0`}>
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 leading-snug truncate">{title}</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight hidden sm:block">Clique fora para fechar</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 sm:p-2 hover:bg-white/30 dark:hover:bg-slate-700/50 rounded-xl transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hidden sm:block"
                title={isExpanded ? "Minimizar" : "Expandir"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-red-50/60 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 sm:hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Conteúdo Rolável ──────────────────────────────── */}
        <div className="flex-1 px-3 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-6 overflow-y-auto scrollbar-thin">
          {children}
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="px-3 py-3 sm:px-6 sm:py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
              Pressione ESC para fechar
            </p>
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium text-white rounded-xl bg-gradient-to-r ${colors.gradient} hover:shadow-lg transition-all duration-200 hover:scale-105 w-full sm:w-auto`}
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DetailModal;
