import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Seletor de data do design system.
 *
 * Substitui o `<input type="date">` nativo pelo mesmo motivo do `Select`: o
 * calendário do navegador não acompanha tema nem moldura do app, e varia de
 * aparência entre Chrome/Firefox/Safari. Valor e formato de troca continuam
 * ISO (`YYYY-MM-DD`), só a UI muda.
 */

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface DatePickerProps {
  /** ISO `YYYY-MM-DD`, ou string vazia quando não há data selecionada. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** classes do controle, para casar com os campos de cada formulário */
  controlClass: string;
  /** classes do wrapper, para quando o campo vive num flex (ex.: flex-1) */
  wrapperClass?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** mostra um botão para limpar a data (campos opcionais, ex.: vencimento) */
  allowClear?: boolean;
  /**
   * 'month' esconde os dias e deixa escolher só mês/ano (ex.: competência).
   * O valor de troca continua ISO `YYYY-MM-DD`, sempre com dia 01.
   */
  granularity?: 'day' | 'month';
}

const PANEL_MAX_PX = 320;
const PANEL_WIDTH_PX = 288; // w-72
const MARGEM_PX = 8; // distância mínima da borda da janela
const GAP_PX = 4; // entre o campo e o painel

/** Posição do painel na janela (position: fixed). */
interface PosicaoPainel {
  left: number;
  top?: number;
  bottom?: number;
}

// O painel vai por portal para o <body> com position: fixed. Com `absolute`
// dentro do campo, ele era cortado por qualquer ancestral com overflow — o corpo
// rolável dos modais (ex.: Filtros de Contas a Receber): com o campo no topo do
// modal não havia espaço nem acima nem abaixo, e o calendário sumia atrás da
// borda. Fora da árvore do modal, só a janela limita, então a decisão de abrir
// para cima/baixo e o alinhamento horizontal olham só para ela.
function calcularPosicao(rect: DOMRect): PosicaoPainel {
  const espacoAbaixo = window.innerHeight - rect.bottom;
  const espacoAcima = rect.top;
  const paraCima = espacoAbaixo < PANEL_MAX_PX && espacoAcima > espacoAbaixo;
  const maxLeft = window.innerWidth - PANEL_WIDTH_PX - MARGEM_PX;
  const left = Math.max(MARGEM_PX, Math.min(rect.left, maxLeft));
  return paraCima
    ? { left, bottom: window.innerHeight - rect.top + GAP_PX }
    : { left, top: rect.bottom + GAP_PX };
}

/** `YYYY-MM-DD` → Date local à meia-noite (evita o desvio de fuso do parse UTC). */
function paraDataLocal(iso: string): Date | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

function paraIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** As 42 células do grid (6 semanas), incluindo sobras do mês anterior/seguinte. */
function gerarGrid(mesVisivel: Date): Date[] {
  const primeiroDoMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1);
  const inicio = new Date(primeiroDoMes);
  inicio.setDate(inicio.getDate() - primeiroDoMes.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Selecione…',
  controlClass,
  wrapperClass = '',
  id,
  disabled,
  ariaLabel,
  allowClear = false,
  granularity = 'day',
}) => {
  const modoMes = granularity === 'month';
  const [open, setOpen] = useState(false);
  const [posicao, setPosicao] = useState<PosicaoPainel | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selecionado = useMemo(() => paraDataLocal(value), [value]);
  const hoje = useMemo(() => new Date(), []);
  const [mesVisivel, setMesVisivel] = useState(() => selecionado ?? hoje);

  // Reabrir noutro campo (ou limpar de fora) deve mostrar o mês da data atual,
  // não o último mês navegado na última vez que o painel esteve aberto.
  useEffect(() => {
    if (open) setMesVisivel(selecionado ?? hoje);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    // O painel não é mais filho do wrapper (portal), então conta como "dentro"
    // um clique em qualquer um dos dois.
    const aoClicarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!wrapperRef.current?.contains(alvo) && !panelRef.current?.contains(alvo)) setOpen(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [open]);

  const reposicionar = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosicao(calcularPosicao(rect));
  }, []);

  // Com position: fixed o painel não acompanha a rolagem sozinho: rolar o corpo
  // do modal (ou a página) e redimensionar a janela recalculam a posição.
  // `capture` pega a rolagem de qualquer ancestral, não só da janela.
  useLayoutEffect(() => {
    if (!open) return;
    reposicionar();
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [open, reposicionar]);

  const abrir = () => {
    if (disabled) return;
    setOpen(true);
  };

  const escolher = (dia: Date) => {
    onChange(paraIso(dia));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const escolherMes = (mes: number, ano: number) => {
    onChange(paraIso(new Date(ano, mes, 1)));
    setOpen(false);
    triggerRef.current?.focus();
  };

  const limpar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const grid = useMemo(() => gerarGrid(mesVisivel), [mesVisivel]);

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClass}`}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : abrir())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
            e.preventDefault();
            abrir();
          } else if (open && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`${controlClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`truncate flex items-center gap-2 ${selecionado ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          {selecionado
            ? modoMes
              ? `${MESES[selecionado.getMonth()]} de ${selecionado.getFullYear()}`
              : selecionado.toLocaleDateString('pt-BR')
            : placeholder}
        </span>
        {allowClear && selecionado && !disabled && (
          <X
            className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={limpar}
          />
        )}
      </button>

      {open && posicao && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Selecionar data"
          // z acima de qualquer modal do app (o maior usa z-[9999]).
          style={{ position: 'fixed', left: posicao.left, top: posicao.top, bottom: posicao.bottom }}
          className="z-[10000] w-72 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl shadow-black/10 dark:shadow-black/40"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() =>
                setMesVisivel((m) =>
                  modoMes ? new Date(m.getFullYear() - 1, m.getMonth(), 1) : new Date(m.getFullYear(), m.getMonth() - 1, 1)
                )
              }
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={modoMes ? 'Ano anterior' : 'Mês anterior'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 tabular-nums">
              {modoMes ? mesVisivel.getFullYear() : `${MESES[mesVisivel.getMonth()]} ${mesVisivel.getFullYear()}`}
            </span>
            <button
              type="button"
              onClick={() =>
                setMesVisivel((m) =>
                  modoMes ? new Date(m.getFullYear() + 1, m.getMonth(), 1) : new Date(m.getFullYear(), m.getMonth() + 1, 1)
                )
              }
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={modoMes ? 'Próximo ano' : 'Próximo mês'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {modoMes ? (
            <div className="grid grid-cols-3 gap-1">
              {MESES.map((nomeMes, i) => {
                const ativo = !!selecionado && selecionado.getFullYear() === mesVisivel.getFullYear() && selecionado.getMonth() === i;
                const ehMesAtual = hoje.getFullYear() === mesVisivel.getFullYear() && hoje.getMonth() === i;
                return (
                  <button
                    key={nomeMes}
                    type="button"
                    onClick={() => escolherMes(i, mesVisivel.getFullYear())}
                    className={`rounded-lg py-2 text-xs transition-colors ${
                      ativo
                        ? 'bg-blue-600 text-white font-medium'
                        : ehMesAtual
                          ? 'text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {nomeMes.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DIAS_SEMANA.map((d, i) => (
                  <span key={i} className="text-[11px] text-center text-gray-400 dark:text-gray-500 py-1">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((dia) => {
                  const foraDoMes = dia.getMonth() !== mesVisivel.getMonth();
                  const ativo = !!selecionado && mesmoDia(dia, selecionado);
                  const ehHoje = mesmoDia(dia, hoje);
                  return (
                    <button
                      key={dia.toISOString()}
                      type="button"
                      onClick={() => escolher(dia)}
                      className={`aspect-square rounded-lg text-xs tabular-nums transition-colors ${
                        ativo
                          ? 'bg-blue-600 text-white font-medium'
                          : ehHoje
                            ? 'text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30'
                            : foraDoMes
                              ? 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {dia.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            {allowClear ? (
              <button
                type="button"
                onClick={limpar}
                disabled={!selecionado}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Limpar
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => (modoMes ? escolherMes(hoje.getMonth(), hoje.getFullYear()) : escolher(hoje))}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {modoMes ? 'Este mês' : 'Hoje'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DatePicker;
