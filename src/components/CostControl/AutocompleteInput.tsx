import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ═══════════════════════════════════════════════════════════════════════════════
// Campo de texto livre com dropdown de sugestões — usado nos campos de
// PayorFormModal (Fonte Pagadora, Tabela Associada, TUSS). Diferente do
// CampoBusca da tela (que trava num chip depois de selecionar), aqui o valor
// continua sempre texto livre: selecionar uma sugestão só preenche o campo,
// sem impedir digitar algo que não existe no catálogo.
//
// O dropdown é renderizado via portal em document.body, posicionado a partir
// do input — foge do overflow-y-auto do corpo do modal, que cortava a lista.
// ═══════════════════════════════════════════════════════════════════════════════

interface AutocompleteInputProps<T> {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (item: T) => void;
  suggestions: T[];
  renderSuggestion: (item: T) => React.ReactNode;
  keyOf: (item: T) => string;
  emptyLabel: string;
  placeholder?: string;
  required?: boolean;
  className: string;
}

function AutocompleteInput<T>({
  value,
  onValueChange,
  onSelect,
  suggestions,
  renderSuggestion,
  keyOf,
  emptyLabel,
  placeholder,
  required,
  className,
}: AutocompleteInputProps<T>) {
  const [aberto, setAberto] = useState(false);
  const [indiceDestacado, setIndiceDestacado] = useState(0);
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const fecharAoPerderFocoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIndiceDestacado(0);
  }, [value]);

  // Sai do campo sem clicar em nada (Tab pra outro campo) também precisa
  // fechar o dropdown — o listener de mousedown abaixo só cobre clique fora.
  // Delay curto pra não fechar antes do onClick de uma sugestão processar
  // (clicar nela já dispara blur no input antes do click no botão).
  useEffect(() => {
    return () => {
      if (fecharAoPerderFocoRef.current) clearTimeout(fecharAoPerderFocoRef.current);
    };
  }, []);

  const handleFocus = () => {
    if (fecharAoPerderFocoRef.current) {
      clearTimeout(fecharAoPerderFocoRef.current);
      fecharAoPerderFocoRef.current = null;
    }
    setAberto(true);
  };

  const handleBlur = () => {
    fecharAoPerderFocoRef.current = setTimeout(() => setAberto(false), 150);
  };

  // Recalcula a posição do dropdown ao abrir e acompanha scroll/resize
  // enquanto estiver aberto, já que ele vive fora da árvore normal do form.
  useEffect(() => {
    if (!aberto) return;
    const atualizarPosicao = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosicao({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    atualizarPosicao();
    window.addEventListener('scroll', atualizarPosicao, true);
    window.addEventListener('resize', atualizarPosicao);
    return () => {
      window.removeEventListener('scroll', atualizarPosicao, true);
      window.removeEventListener('resize', atualizarPosicao);
    };
  }, [aberto]);

  // Fecha ao clicar fora — inclui o dropdown em si, que vive num portal fora
  // da árvore do input.
  useEffect(() => {
    if (!aberto) return;
    const handle = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!inputRef.current?.contains(alvo) && !dropdownRef.current?.contains(alvo)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [aberto]);

  const handleSelect = (item: T) => {
    onSelect(item);
    setAberto(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!aberto || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceDestacado(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceDestacado(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(suggestions[indiceDestacado]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        required={required}
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
          setAberto(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {aberto &&
        value.trim().length > 0 &&
        posicao &&
        createPortal(
          <ul
            ref={dropdownRef}
            style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
            className="fixed z-[60] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-56 overflow-y-auto"
          >
            {suggestions.length === 0 ? (
              <li className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</li>
            ) : (
              suggestions.map((item, i) => (
                <li key={keyOf(item)}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setIndiceDestacado(i)}
                    aria-selected={i === indiceDestacado}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      i === indiceDestacado ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-blue-50 dark:hover:bg-blue-500/10'
                    }`}
                  >
                    {renderSuggestion(item)}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body
        )}
    </>
  );
}

export default AutocompleteInput;
