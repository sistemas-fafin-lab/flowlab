import React from "react";
import { X } from "lucide-react";

interface DetailModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-auto max-w-[90vw] max-h-[80vh] flex flex-col animate-scale-in">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 text-gray-500 hover:text-gray-700 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default DetailModal;
