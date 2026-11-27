import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/** − / campo / + da quantidade de um exame no carrinho (os dois modos do Gerador). */
const ControleQuantidade: React.FC<{
  nome: string;
  quantidade: number;
  onQuantidade: (quantidade: number) => void;
}> = ({ nome, quantidade, onQuantidade }) => {
  // Rascunho do campo: deixa apagar e redigitar a quantidade; ao sair do campo, volta
  // para a quantidade válida do carrinho.
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={() => onQuantidade(quantidade - 1)}
        disabled={quantidade <= 1}
        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        min={1}
        aria-label={`Quantidade de ${nome}`}
        value={rascunho ?? quantidade}
        onChange={(e) => {
          setRascunho(e.target.value);
          onQuantidade(e.target.valueAsNumber);
        }}
        onBlur={() => setRascunho(null)}
        className="w-10 text-center text-sm font-semibold bg-transparent text-gray-800 dark:text-gray-100 border-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => onQuantidade(quantidade + 1)}
        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default ControleQuantidade;
