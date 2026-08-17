import React from 'react';
import ReactDOM from 'react-dom';
import { QuotationType } from '../types';

interface QuotationTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: QuotationType) => void;
}

export const QuotationTypeSelectionModal: React.FC<QuotationTypeSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
      />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl animate-scale-in"
        style={{
          position: 'relative',
          width: 'calc(100% - 32px)',
          maxWidth: '28rem',
          maxHeight: 'calc(100vh - 32px)',
          margin: '16px',
          overflow: 'auto',
        }}
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Tipo de Cotação</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecione o tipo de cotação que deseja criar</p>
        </div>

        <div className="p-6 space-y-4">
          <button
            onClick={() => onSelect('compras')}
            className="w-full p-4 border-2 border-purple-200 dark:border-purple-800 rounded-xl hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Compras</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Para produtos e materiais, a partir de uma SC/SM</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect('contratacao')}
            className="w-full p-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mr-3 group-hover:scale-110 transition-transform"></div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Contratação</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Para serviços de manutenção, a partir de uma solicitação de MNT</p>
              </div>
            </div>
          </button>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
