import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { ehTeclaDeTexto, filtrarOpcoes } from './selectBusca';
import { deveAbrirParaCima, PANEL_MAX_PX, SEARCH_PX, TONS, type TomSelect } from './selectPainel';

/**
 * Dropdown do design system.
 *
 * Substitui o `<select>` nativo porque a lista de opções dele é desenhada pelo
 * sistema operacional: não acompanha o tema escuro do app nem a moldura dos
 * outros campos. Aqui a lista é um painel próprio — mesmas cores, cantos e
 * estados de hover do resto da interface.
 *
 * Com `searchable`, o painel abre com um campo de busca no topo (listas longas,
 * como a de pessoas): a busca ignora acentos e maiúsculas e olha o rótulo, a
 * descrição e os `keywords` de cada opção. Digitar com o controle fechado já
 * abre a busca com a letra digitada.
 *
 * Teclado: setas navegam, Enter/Espaço escolhem, Esc fecha, Home/End vão para as
 * pontas. Fecha ao clicar fora.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** desenha um divisor acima desta opção (ex.: separar uma ação da lista) */
  separatorBefore?: boolean;
  /** segunda linha, menor (ex.: o cargo de uma pessoa); a busca também olha aqui */
  description?: string;
  /** termos que a busca encontra sem mostrar (ex.: e-mail, apelidos) */
  keywords?: string;
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
  /** campo de busca no topo da lista */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** texto quando a busca não acha nada */
  emptyText?: string;
}

/** Campo de busca do topo do painel (Select e MultiSelect). */
export const CampoBusca = React.forwardRef<
  HTMLInputElement,
  { tone: TomSelect } & React.InputHTMLAttributes<HTMLInputElement>
>(({ tone, className = '', ...props }, ref) => {
  const t = TONS[tone];
  return (
    <div className={t.busca}>
      <div className="relative">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${t.seta}`} aria-hidden />
        <input ref={ref} type="text" autoComplete="off" spellCheck={false} className={`${t.campoBusca} ${className}`} {...props} />
      </div>
    </div>
  );
});
CampoBusca.displayName = 'CampoBusca';

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
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nada encontrado.',
}) => {
  const t = TONS[tone];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const [busca, setBusca] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const listId = `${id ?? autoId}-listbox`;

  const selected = options.find(o => o.value === value);
  const visiveis = useMemo(() => (searchable ? filtrarOpcoes(options, busca) : options), [searchable, options, busca]);
  const filtrando = searchable && busca.trim() !== '';

  // Fecha ao clicar fora do componente.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Com busca, o foco vai para o campo assim que o painel abre.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  // Mantém o item ativo visível ao navegar pelo teclado.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const abrir = (inicio = '') => {
    if (disabled) return;
    setDropUp(deveAbrirParaCima(triggerRef.current, PANEL_MAX_PX + (searchable ? SEARCH_PX : 0)));
    setBusca(inicio);
    const lista = searchable ? filtrarOpcoes(options, inicio) : options;
    const indiceEscolhido = lista.findIndex(o => o.value === value);
    setActiveIndex(indiceEscolhido >= 0 ? indiceEscolhido : lista.length ? 0 : -1);
    setOpen(true);
  };

  const fechar = (devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  };

  const escolher = (index: number) => {
    const opcao = visiveis[index];
    if (!opcao) return;
    onChange(opcao.value);
    fechar(true);
  };

  const mudarBusca = (texto: string) => {
    setBusca(texto);
    setActiveIndex(filtrarOpcoes(options, texto).length ? 0 : -1);
  };

  // Setas, Enter e Esc: os mesmos no botão (sem busca) e no campo de busca.
  const navegar = (e: React.KeyboardEvent, noCampo: boolean): boolean => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        fechar(true);
        return true;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(visiveis.length - 1, i + 1));
        return true;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
        return true;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) escolher(activeIndex);
        return true;
      case 'Tab':
        setOpen(false);
        return true;
    }
    if (noCampo) return false;
    switch (e.key) {
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        return true;
      case 'End':
        e.preventDefault();
        setActiveIndex(visiveis.length - 1);
        return true;
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) escolher(activeIndex);
        return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      } else if (searchable && ehTeclaDeTexto(e)) {
        e.preventDefault();
        abrir(e.key);
      }
      return;
    }
    navegar(e, false);
  };

  const activeId = open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

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
          className={`absolute left-0 z-50 ${searchable ? 'min-w-[max(100%,18rem)]' : 'min-w-full'} w-max max-w-[min(24rem,90vw)] flex flex-col ${t.painel} ${
            dropUp ? `bottom-full mb-1${tone === 'vidro' ? ' origin-bottom' : ''}` : `top-full mt-1${tone === 'vidro' ? ' origin-top' : ''}`
          }`}
        >
          {searchable && (
            <CampoBusca
              ref={searchRef}
              tone={tone}
              value={busca}
              onChange={e => mudarBusca(e.target.value)}
              onKeyDown={e => navegar(e, true)}
              placeholder={searchPlaceholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label={ariaLabel ? `Buscar: ${ariaLabel}` : 'Buscar'}
            />
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={searchable ? undefined : activeId}
            className="min-h-0 max-h-[260px] overflow-y-auto [scrollbar-width:thin]"
          >
            {visiveis.length === 0 && (
              <p className={`px-3 py-2 text-sm ${t.vazio}`}>{emptyText}</p>
            )}
            {visiveis.map((opcao, index) => {
              const ativo = index === activeIndex;
              const escolhido = opcao.value === value;
              return (
                <React.Fragment key={opcao.value}>
                  {opcao.separatorBefore && !filtrando && (
                    <div className={t.separador} />
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
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
                    <span className="min-w-0">
                      <span className="block truncate">{opcao.label}</span>
                      {opcao.description && <span className={`block truncate ${t.descricao}`}>{opcao.description}</span>}
                    </span>
                    {escolhido && <Check className="w-4 h-4 flex-shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
