import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { useNotification } from '../../../hooks/useNotification';
import SignatureCanvasField, { SignatureCanvasFieldHandle } from '../../../components/SignatureCanvasField';

interface QuotationApprovalSignatureModalProps {
  quotationCode: string;
  quotationTitle: string;
  approverName: string;
  comment?: string;
  onConfirm: (signature: string) => Promise<void>;
  onClose: () => void;
}

const SUBMIT_COOLDOWN_MS = 3000;

export const QuotationApprovalSignatureModal: React.FC<QuotationApprovalSignatureModalProps> = ({
  quotationCode,
  quotationTitle,
  approverName,
  comment,
  onConfirm,
  onClose,
}) => {
  const { showError } = useNotification();
  const sigCanvasRef = useRef<SignatureCanvasFieldHandle>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(false);

  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
    };
  }, []);

  const handleConfirm = async () => {
    if (sigCanvasRef.current?.isEmpty()) {
      showError('A assinatura é obrigatória para aprovar.');
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < SUBMIT_COOLDOWN_MS) {
      showError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }

    if (isSubmittingRef.current || isProcessing) {
      return;
    }

    try {
      isSubmittingRef.current = true;
      lastSubmitTimeRef.current = now;
      setIsProcessing(true);

      const signatureData = sigCanvasRef.current?.toDataURL() || '';
      await onConfirm(signatureData);

      setProcessingComplete(true);
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Erro ao confirmar aprovação assinada:', error);
      isSubmittingRef.current = false;
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Assinar Aprovação</h3>
                <p className="text-sm text-white/80">{quotationCode}</p>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400">Cotação</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{quotationTitle}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Aprovando como</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{approverName}</p>
            {comment && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Comentário</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{comment}"</p>
              </>
            )}
          </div>

          {processingComplete ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
              <div className="flex items-center">
                <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">Cotação aprovada com sucesso!</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Fechando em instantes...</p>
                </div>
              </div>
            </div>
          ) : (
            <SignatureCanvasField
              ref={sigCanvasRef}
              label="Assinatura do aprovador *"
              disabled={isProcessing}
            />
          )}
        </div>

        {!processingComplete && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-500 flex items-center font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-600 flex items-center font-medium transition-all shadow-md shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Aprovação
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuotationApprovalSignatureModal;
