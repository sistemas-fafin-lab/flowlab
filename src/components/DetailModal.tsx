import React, { useEffect } from "react";
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

  const colors = colorClasses[accentColor] || colorClasses.blue;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl flex flex-col animate-scale-in transition-all duration-300 ${
          isExpanded 
            ? 'w-[95vw] h-[95vh]' 
            : 'w-auto max-w-[90vw] max-h-[85vh] min-w-[400px]'
        }`}
      >
        {/* Cabeçalho com Gradiente */}
        <div className={`relative overflow-hidden rounded-t-2xl`}>
          {/* Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-10`}></div>
          
          <div className="relative flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {icon && (
                <div className={`p-2 rounded-xl ${colors.iconBg} shadow-lg`}>
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                <p className="text-xs text-gray-500">Clique fora para fechar</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-700"
                title={isExpanded ? "Minimizar" : "Expandir"}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-red-50 rounded-xl transition-all duration-200 text-gray-500 hover:text-red-600 hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Pressione ESC para fechar
            </p>
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium text-white rounded-xl bg-gradient-to-r ${colors.gradient} hover:shadow-lg transition-all duration-200 hover:scale-105`}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
