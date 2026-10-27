import React from 'react';
import { Check, Minus } from 'lucide-react';

// Caixa de seleção no lugar do checkbox nativo (que o sistema operacional desenha e não
// acompanha o tema escuro), no mesmo molde das caixas do MultiSelect. 'misto' = parte marcada.
// O botão é a área de toque (44px, transparente) e a caixa de 20px é desenhada dentro dele;
// a margem negativa devolve o espaço, então no layout ela ocupa só os 20px.

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
    className="group/caixa -m-3 w-11 h-11 flex flex-shrink-0 items-center justify-center rounded-xl focus:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-blue-400 [&:focus-visible>span]:ring-offset-1"
  >
    <span
      aria-hidden
      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-150 group-active/caixa:scale-90 ${
        marcado
          ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30'
          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 group-hover/caixa:border-blue-400'
      }`}
    >
      {marcado === 'misto' ? <Minus className="w-3.5 h-3.5" /> : marcado ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
    </span>
  </button>
);

export default CaixaSelecao;
