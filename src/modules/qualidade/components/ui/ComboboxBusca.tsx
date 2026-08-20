import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface ItemCombobox {
  id: string;
  nome: string;
}

interface ComboboxBuscaProps {
  itens: ItemCombobox[] | undefined;
  valor: string;
  onMudar: (id: string) => void;
  placeholder?: string;
  className?: string;
  desabilitado?: boolean;
  /** Acima deste número de itens, vira um combobox com busca; até esse número, um `<select>` nativo simples. */
  limiteParaBusca?: number;
  /** Nome acessível — necessário porque o `<label>` ao redor deste componente normalmente não usa `htmlFor`. */
  ariaLabel?: string;
}

const campoBase = 'glass-field w-full rounded-xl px-3 py-2 text-left text-sm text-slate-800 dark:text-slate-200';

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Select com busca — só ativa a UI de busca quando `itens` passa de
 * `limiteParaBusca` (padrão 8); com poucos itens, um `<select>` nativo já é
 * mais rápido de usar do que abrir um dropdown de busca.
 */
export function ComboboxBusca({
  itens,
  valor,
  onMudar,
  placeholder = '— selecione —',
  className = '',
  desabilitado = false,
  limiteParaBusca = 8,
  ariaLabel,
}: ComboboxBuscaProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const itemSelecionado = itens?.find((item) => item.id === valor) ?? null;

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    }
    function aoPressionarTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAberto(false);
        setBusca('');
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoPressionarTecla);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoPressionarTecla);
    };
  }, [aberto]);

  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
  }, [aberto]);

  if (!itens || itens.length <= limiteParaBusca) {
    return (
      <select
        aria-label={ariaLabel}
        className={`${campoBase} ${className}`}
        value={valor}
        disabled={desabilitado}
        onChange={(e) => onMudar(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {itens?.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    );
  }

  const buscaNormalizada = normalizar(busca);
  const itensFiltrados = buscaNormalizada
    ? itens.filter((item) => normalizar(item.nome).includes(buscaNormalizada))
    : itens;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={desabilitado}
        onClick={() => setAberto((atual) => !atual)}
        className={`${campoBase} flex items-center justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`truncate ${itemSelecionado ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {itemSelecionado?.nome ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {itemSelecionado && (
            <X
              className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              aria-label="Limpar seleção"
              onClick={(e) => {
                e.stopPropagation();
                onMudar('');
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden />
        </span>
      </button>

      {aberto && (
        <div className="glass-surface absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-hidden rounded-xl">
          <div className="relative border-b border-slate-200/60 p-2 dark:border-white/10">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden />
            <input
              ref={buscaRef}
              className={`${campoBase} pl-8`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {itensFiltrados.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Nenhum resultado.</li>
            )}
            {itensFiltrados.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === valor}
                  onClick={() => {
                    onMudar(item.id);
                    setAberto(false);
                    setBusca('');
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10 ${
                    item.id === valor ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate">{item.nome}</span>
                  {item.id === valor && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
