import React, { useEffect, useState } from 'react';
import { escreverMoeda, lerMoeda } from './domain/moeda';

// Campo de valor em reais digitado direto (sem as setinhas de type="number").
// Enquanto o usuário digita, o texto fica como ele escreveu; ao sair do campo,
// volta formatado ("1.234,50"). Ao entrar, seleciona tudo para substituir.

interface CampoMoedaProps {
  value: number;
  onChange: (valor: number) => void;
  className?: string;
  autoFocus?: boolean;
}

const CampoMoeda: React.FC<CampoMoedaProps> = ({ value, onChange, className = '', autoFocus }) => {
  const [texto, setTexto] = useState(() => escreverMoeda(value));
  const [editando, setEditando] = useState(false);

  // Valor trocado de fora (abrir outro exame, limpar o formulário) enquanto não se digita.
  useEffect(() => {
    if (!editando) setTexto(escreverMoeda(value));
  }, [value, editando]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 font-medium pointer-events-none">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={texto}
        onFocus={e => {
          setEditando(true);
          e.target.select();
        }}
        onChange={e => {
          const digitado = e.target.value.replace(/[^\d.,]/g, '');
          setTexto(digitado);
          onChange(lerMoeda(digitado));
        }}
        onBlur={() => {
          setEditando(false);
          setTexto(escreverMoeda(lerMoeda(texto)));
        }}
        className={`${className} pl-8 tabular-nums`}
      />
    </div>
  );
};

export default CampoMoeda;
