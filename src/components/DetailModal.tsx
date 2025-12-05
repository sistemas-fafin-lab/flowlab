import React from "react";
import { X } from "lucide-react";

interface DetailModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ title, children, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-auto max-w-[90vw] max-h-[80vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default DetailModal;
