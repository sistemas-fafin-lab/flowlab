import React, { useState } from 'react';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
  };
  onConfirm: (quantity: number) => void;
}

const AddStockModal: React.FC<AddStockModalProps> = ({ isOpen, onClose, product, onConfirm }) => {
  const [quantityToAdd, setQuantityToAdd] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const value = parseInt(quantityToAdd, 10);
    if (!isNaN(value) && value > 0) {
      onConfirm(value);
      setQuantityToAdd('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Adicionar Estoque</h2>
        
        <div className="space-y-2 mb-4">
          <p className="text-gray-700">
            <span className="font-semibold">Produto:</span> {product.name}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold">Quantidade atual:</span> {product.quantity} {product.unit}
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Quantidade a adicionar
          </label>
          <input
            type="number"
            value={quantityToAdd}
            onChange={(e) => setQuantityToAdd(e.target.value)}
            placeholder="Ex: 10"
            min={1}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStockModal;
