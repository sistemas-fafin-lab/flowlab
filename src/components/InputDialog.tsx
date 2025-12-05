import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  required?: boolean;
}

const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  title,
  message,
  placeholder = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  required = true
}) => {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (required && !inputValue.trim()) return;
    onConfirm(inputValue.trim());
    setInputValue('');
  };

  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-blue-50 mr-3">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-gray-600 mb-4 leading-relaxed">{message}</p>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConfirm();
              }
            }}
            autoFocus
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={required && !inputValue.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg shadow-blue-500/25 hover-lift"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputDialog;