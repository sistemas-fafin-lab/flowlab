import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ApprovalSignatureViewModalProps {
  approverName: string;
  approvedAt?: string;
  signature: string;
  onClose: () => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
};

export const ApprovalSignatureViewModal: React.FC<ApprovalSignatureViewModalProps> = ({
  approverName,
  approvedAt,
  signature,
  onClose,
}) => {
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Assinatura do Aprovador
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Aprovado por: <span className="font-medium">{approverName}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(approvedAt)}</p>

        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white">
          <img
            src={signature}
            alt="Assinatura do aprovador"
            className="w-full max-h-48 object-contain"
          />
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body
  );
};

export default ApprovalSignatureViewModal;
