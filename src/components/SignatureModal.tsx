import React, { useRef, useState } from 'react';
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

        <div className="border border-gray-300 rounded-lg">
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor="black"
            canvasProps={{ className: 'w-full h-40 rounded-lg' }}
          />
          <button
            onClick={() => sigCanvasRef.current?.clear()}
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
