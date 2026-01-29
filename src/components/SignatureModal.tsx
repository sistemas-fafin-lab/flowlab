import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Check } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';

interface SignatureModalProps {
  requestId: string;
  items: { productName: string; quantity: number }[];
  onConfirm: (signature: string, receiverName: string) => void;
  onClose: () => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({ requestId, items, onConfirm, onClose }) => {
  const { showError } = useNotification();
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [receiverName, setReceiverName] = useState('');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 160 });
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Salvar assinatura no state
  const saveSignatureData = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      const data = sigCanvasRef.current.toDataURL();
      setSavedSignature(data);
    }
  };

  // Restaurar assinatura do state
  const restoreSignatureData = () => {
    if (savedSignature && sigCanvasRef.current) {
      // Aguardar o canvas estar totalmente renderizado com as novas dimensões
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (sigCanvasRef.current) {
            sigCanvasRef.current.fromDataURL(savedSignature);
          }
        });
      });
    }
  };

  // Calcular tamanho do canvas baseado no container
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const updateCanvasSize = () => {
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.offsetWidth - 16; // Subtrair padding
        setCanvasSize({ width: containerWidth, height: 160 });
      }
    };

    // Atualizar tamanho inicial
    updateCanvasSize();

    // Observar mudanças no tamanho do container
    const resizeObserver = new ResizeObserver(() => {
      // Salvar antes de redimensionar
      saveSignatureData();

      // Limpar timeout anterior
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Aguardar redimensionamento finalizar
      resizeTimeoutRef.current = setTimeout(() => {
        updateCanvasSize();
        // Restaurar após atualizar o tamanho
        setTimeout(restoreSignatureData, 100);
      }, 100);
    });

    resizeObserver.observe(canvasContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [savedSignature]);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setSavedSignature(null);
  };

  const handleConfirm = () => {
    if (!receiverName.trim()) {
      showError('Informe o nome de quem está recebendo.');
      return;
    }
    if (sigCanvasRef.current?.isEmpty()) {
      showError('A assinatura é obrigatória.');
      return;
    }

    const signatureData = sigCanvasRef.current?.toDataURL();
    onConfirm(signatureData!, receiverName.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-800">Confirmação de Retirada</h3>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <p key={idx} className="text-sm text-gray-700">
              {item.productName} - {item.quantity} un.
            </p>
          ))}
        </div>

        <input
          type="text"
          placeholder="Nome de quem está recebendo"
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <div ref={canvasContainerRef} className="border border-gray-300 rounded-lg p-2">
          {canvasSize.width > 0 && (
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="black"
              canvasProps={{ 
                width: canvasSize.width,
                height: canvasSize.height,
                className: 'rounded-lg',
                style: { touchAction: 'none', width: '100%', height: '160px' }
              }}
              onEnd={saveSignatureData}
            />
          )}
          <button
            type="button"
            onClick={handleClear}
            className="mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Limpar
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center"
          >
            <X className="w-4 h-4 mr-2" /> Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Check className="w-4 h-4 mr-2" /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
