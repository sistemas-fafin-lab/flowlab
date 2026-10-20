import React from 'react';
import { Check, Minus } from 'lucide-react';

// Caixa de seleção no lugar do checkbox nativo (que o sistema operacional desenha e não
// acompanha o tema escuro), no mesmo molde das caixas do MultiSelect. 'misto' = parte marcada.

interface Props {
  marcado: boolean | 'misto';
  onAlternar: () => void;
  rotulo: string;
}

const CaixaSelecao: React.FC<Props> = ({ marcado, onAlternar, rotulo }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={marcado === 'misto' ? 'mixed' : marcado}
    aria-label={rotulo}
    title={rotulo}
    onClick={(e) => {
      e.stopPropagation();
      onAlternar();
    }}
    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
      marcado
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 hover:border-blue-400'
    }`}
  >
    {marcado === 'misto' ? <Minus className="w-3.5 h-3.5" /> : marcado ? <Check className="w-3.5 h-3.5" /> : null}
  </button>
);

export default CaixaSelecao;
