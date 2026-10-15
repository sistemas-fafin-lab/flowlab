import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { CampoBusca, type SelectOption } from './Select';
import { ehTeclaDeTexto, filtrarOpcoes } from './selectBusca';
import { deveAbrirParaCima, PANEL_MAX_PX, SEARCH_PX, TONS } from './selectPainel';

/**
 * Dropdown de várias escolhas do design system, com busca (ex.: responsáveis de um card).
 *
 * O controle mostra as escolhas como chips (cada um com ×); o painel tem o campo de busca
 * no topo e marca/desmarca sem fechar. Mesmo visual e mesmos tons do `Select`.
 *
 * Teclado: setas navegam, Enter marca/desmarca, Esc fecha, Backspace com a busca vazia
 * tira a última escolha. Digitar com o controle fechado já abre a busca.
 */

interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  /** classes do controle, para casar com os campos de cada formulário */
  controlClass: string;
  wrapperClass?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
  tone?: 'padrao' | 'vidro';
  searchPlaceholder?: string;
  emptyText?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
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
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
}) => {
  const t = TONS[tone];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const [busca, setBusca] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const listId = `${id ?? autoId}-listbox`;

  const marcados = useMemo(() => new Set(value), [value]);
  const visiveis = useMemo(() => filtrarOpcoes(options, busca), [options, busca]);
  // Escolhas na ordem em que foram feitas; uma que saiu das opções aparece com o próprio valor.
  const chips = value.map(v => options.find(o => o.value === v) ?? { value: v, label: v });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const abrir = (inicio = '') => {
    if (disabled) return;
    setDropUp(deveAbrirParaCima(triggerRef.current, PANEL_MAX_PX + SEARCH_PX));
    setBusca(inicio);
    setActiveIndex(filtrarOpcoes(options, inicio).length ? 0 : -1);
    setOpen(true);
  };

  const fechar = (devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  };

  const alternar = (valor: string) =>
    onChange(marcados.has(valor) ? value.filter(v => v !== valor) : [...value, valor]);

  const mudarBusca = (texto: string) => {
    setBusca(texto);
    setActiveIndex(filtrarOpcoes(options, texto).length ? 0 : -1);
  };

  const teclaNoCampo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        fechar(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(visiveis.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && visiveis[activeIndex]) alternar(visiveis[activeIndex].value);
        break;
      case 'Backspace':
        if (busca === '' && value.length) {
          e.preventDefault();
          onChange(value.slice(0, -1));
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const teclaNoControle = (e: React.KeyboardEvent) => {
    if (disabled || open) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrir();
    } else if (ehTeclaDeTexto(e)) {
      e.preventDefault();
      abrir(e.key);
    } else if (e.key === 'Backspace' && value.length) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const activeId = open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClass}`}>
      {/* div com role de botão: os chips têm o próprio botão de remover, e botão dentro de botão não vale. */}
      <div
        ref={triggerRef}
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={teclaNoControle}
        className={`${controlClass} flex items-center justify-between gap-2 text-left cursor-pointer ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className="flex flex-wrap items-center gap-1 min-w-0">
          {chips.length === 0 && <span className={`truncate ${t.vazio}`}>{placeholder}</span>}
          {chips.map(c => (
            <span key={c.value} className={`inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-0.5 rounded-md text-xs font-medium ${t.chip}`}>
              <span className="truncate">{c.label}</span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Tirar ${c.label}`}
                  onClick={e => { e.stopPropagation(); alternar(c.value); }}
                  className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 ${t.seta} transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div
          className={`absolute left-0 z-50 min-w-[max(100%,18rem)] w-max max-w-[min(24rem,90vw)] flex flex-col ${t.painel} ${
            dropUp ? `bottom-full mb-1${tone === 'vidro' ? ' origin-bottom' : ''}` : `top-full mt-1${tone === 'vidro' ? ' origin-top' : ''}`
          }`}
        >
          <CampoBusca
            ref={searchRef}
            tone={tone}
            value={busca}
            onChange={e => mudarBusca(e.target.value)}
            onKeyDown={teclaNoCampo}
            placeholder={searchPlaceholder}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label={ariaLabel ? `Buscar: ${ariaLabel}` : 'Buscar'}
          />
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label={ariaLabel}
            className="min-h-0 max-h-[260px] overflow-y-auto [scrollbar-width:thin]"
          >
            {visiveis.length === 0 && <p className={`px-3 py-2 text-sm ${t.vazio}`}>{emptyText}</p>}
            {visiveis.map((opcao, index) => {
              const ativo = index === activeIndex;
              const marcado = marcados.has(opcao.value);
              return (
                <button
                  key={opcao.value}
                  type="button"
                  tabIndex={-1}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={marcado}
                  onMouseEnter={() => setActiveIndex(index)}
                  // Mantém o foco na busca: dá para marcar várias seguidas e continuar digitando.
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => alternar(opcao.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${t.opcao} ${ativo ? t.ativo : ''} ${
                    marcado ? t.escolhido : t.normal
                  }`}
                >
                  <span
                    aria-hidden
                    className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border transition-colors ${marcado ? t.marcaLigada : t.marca}`}
                  >
                    {marcado && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{opcao.label}</span>
                    {opcao.description && <span className={`block truncate ${t.descricao}`}>{opcao.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
