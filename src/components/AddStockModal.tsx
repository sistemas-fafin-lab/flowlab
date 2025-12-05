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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-scale-in">
        <h2 className="text-xl font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">Adicionar Estoque</h2>
        
        <div className="space-y-3 mb-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <p className="text-gray-700">
            <span className="font-semibold text-gray-800">Produto:</span> {product.name}
          </p>
          <p className="text-gray-700">
            <span className="font-semibold text-gray-800">Quantidade atual:</span> 
            <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              {product.quantity} {product.unit}
            </span>
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantidade a adicionar
          </label>
          <input
            type="number"
            value={quantityToAdd}
            onChange={(e) => setQuantityToAdd(e.target.value)}
            placeholder="Ex: 10"
            min={1}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-gray-50/50"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all duration-200 font-medium text-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 font-medium shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStockModal;
