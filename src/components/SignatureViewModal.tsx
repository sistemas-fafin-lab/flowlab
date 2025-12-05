import { X } from "lucide-react";

interface SignatureViewModalProps {
  receiverName: string;
  signature: string;
  onClose: () => void;
}

const SignatureViewModal: React.FC<SignatureViewModalProps> = ({
  receiverName,
  signature,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">
            Assinatura do Recebedor
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Recebido por: <span className="font-medium">{receiverName}</span>
        </p>

        <div className="border border-gray-300 rounded-lg p-2">
          <img
            src={signature}
            alt="Assinatura"
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
    </div>
  );
};

export default SignatureViewModal;
