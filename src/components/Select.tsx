import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Dropdown do design system.
 *
 * Substitui o `<select>` nativo porque a lista de opções dele é desenhada pelo
 * sistema operacional: não acompanha o tema escuro do app nem a moldura dos
 * outros campos. Aqui a lista é um painel próprio — mesmas cores, cantos e
 * estados de hover do resto da interface.
 *
 * Teclado: setas navegam, Enter/Espaço escolhem, Esc fecha, Home/End vão para as
 * pontas. Fecha ao clicar fora.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** desenha um divisor acima desta opção (ex.: separar uma ação da lista) */
  separatorBefore?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** classes do controle, para casar com os campos de cada formulário */
  controlClass: string;
  /** classes do wrapper, para quando o select vive num flex (ex.: flex-1) */
  wrapperClass?: string;
  id?: string;
  disabled?: boolean;
  /** usado quando não há <label for> apontando para o controle */
  ariaLabel?: string;
  /**
   * Visual do painel. 'padrao' (default) é o de sempre; 'vidro' é o painel em
   * vidro slate/violeta dos dashboards de TI, com entrada animada.
   */
  tone?: 'padrao' | 'vidro';
}

// Altura máxima do painel; também serve de folga para decidir se abre para cima.
const PANEL_MAX_PX = 260;

// Classes que mudam por tom. As de 'padrao' são exatamente as de antes do `tone`.
const TONS = {
  padrao: {
    painel: 'py-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl shadow-black/10 dark:shadow-black/40',
    separador: 'my-1 border-t border-gray-100 dark:border-gray-700',
    opcao: '',
    ativo: 'bg-blue-50 dark:bg-blue-900/30',
    escolhido: 'font-medium text-blue-600 dark:text-blue-300',
    normal: 'text-gray-700 dark:text-gray-200',
    vazio: 'text-gray-400 dark:text-gray-500',
    seta: 'text-gray-400',
  },
  vidro: {
    painel:
      'p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] [scrollbar-width:thin] animate-scale-in',
    separador: 'my-1 mx-2 border-t border-slate-100 dark:border-slate-800',
    opcao: 'rounded-lg',
    ativo: 'bg-violet-50 dark:bg-violet-500/15',
    escolhido: 'font-semibold text-violet-700 dark:text-violet-300',
    normal: 'text-slate-700 dark:text-slate-200',
    vazio: 'text-slate-400 dark:text-slate-500',
    seta: 'text-slate-400',
  },
} as const;

// Limites verticais de quem realmente corta o painel: o ancestral que rola
// (o corpo do modal, por exemplo) ou, na falta dele, a viewport.
const limitesDoContainer = (el: HTMLElement | null): { top: number; bottom: number } => {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'hidden') {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }
    node = node.parentElement;
  }
  return { top: 0, bottom: window.innerHeight };
};

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  controlClass,
  wrapperClass = '',
  id,
  disabled,
  ariaLabel,
  tone = 'padrao',
}) => {
  const t = TONS[tone];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const listId = `${id ?? autoId}-listbox`;

  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Fecha ao clicar fora do componente.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Mantém o item ativo visível ao navegar pelo teclado.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const abrir = () => {
    if (disabled) return;
    // Abre para cima quando não cabe embaixo (dentro do modal o espaço é curto).
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const limites = limitesDoContainer(triggerRef.current);
      const espacoAbaixo = Math.min(window.innerHeight, limites.bottom) - rect.bottom;
      const espacoAcima = rect.top - Math.max(0, limites.top);
      setDropUp(espacoAbaixo < PANEL_MAX_PX && espacoAcima > espacoAbaixo);
    }
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const escolher = (index: number) => {
    const opcao = options[index];
    if (!opcao) return;
    onChange(opcao.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) escolher(activeIndex);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClass}`}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`${controlClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`truncate ${selected ? '' : t.vazio}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 ${t.seta} transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className={`absolute left-0 z-50 min-w-full w-max max-w-[min(24rem,90vw)] max-h-[260px] overflow-y-auto ${t.painel} ${
            dropUp ? `bottom-full mb-1${tone === 'vidro' ? ' origin-bottom' : ''}` : `top-full mt-1${tone === 'vidro' ? ' origin-top' : ''}`
          }`}
        >
          {options.map((opcao, index) => {
            const ativo = index === activeIndex;
            const escolhido = opcao.value === value;
            return (
              <React.Fragment key={opcao.value}>
                {opcao.separatorBefore && (
                  <div className={t.separador} />
                )}
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={escolhido}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => escolher(index)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${t.opcao} ${
                    ativo ? t.ativo : ''
                  } ${
                    escolhido
                      ? t.escolhido
                      : t.normal
                  }`}
                >
                  <span className="truncate">{opcao.label}</span>
                  {escolhido && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Select;
