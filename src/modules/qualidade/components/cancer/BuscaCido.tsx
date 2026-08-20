import { useQuery } from '@tanstack/react-query';
import type { CidoEntradaDTO, TipoCido } from '../../types';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buscarCidoCatalogo } from '../../cancer.js';

interface BuscaCidoProps {
  tipo: TipoCido;
  /** Código atualmente selecionado (vazio quando nenhum). */
  valorAtual: string;
  descricaoAtual: string | null;
  onEscolher: (entrada: CidoEntradaDTO) => void;
  desabilitado?: boolean;
  placeholder?: string;
  className?: string;
  /** `valorAtual`/`descricaoAtual` vêm de uma sugestão automática, ainda não confirmada pelo humano (R2/R3) — estilo esmaecido + amarelado. */
  sugerido?: boolean;
}

const campoBase = 'glass-field w-full rounded-xl px-3 py-2 text-left text-sm text-slate-800 dark:text-slate-200';

/**
 * Select box com busca para o catálogo CID-O (R3) — busca no servidor
 * (`GET /api/cancer/cido`, 1136 códigos, grande demais para carregar por
 * inteiro) em vez do padrão `ComboboxBusca` (lista pré-carregada). Usado no
 * drawer de 1 caso e, de forma compacta, direto nas colunas da tabela.
 */
export function BuscaCido({
  tipo,
  valorAtual,
  descricaoAtual,
  onEscolher,
  desabilitado,
  placeholder,
  className,
  sugerido,
}: BuscaCidoProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ['cido', tipo, busca],
    queryFn: () => buscarCidoCatalogo(busca, tipo),
    enabled: aberto && busca.length >= 2,
  });

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

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={desabilitado}
        onClick={(e) => {
          e.stopPropagation();
          setAberto((atual) => !atual);
        }}
        title={
          sugerido
            ? 'Sugestão automática do LIS — não é decisão do sistema. Confira contra o laudo antes de confirmar, ou busque outro código.'
            : undefined
        }
        className={`${campoBase} flex items-center justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          sugerido ? 'bg-amber-50 dark:bg-amber-900/20' : ''
        }`}
      >
        <span
          className={`truncate ${
            !valorAtual
              ? 'text-slate-400 dark:text-slate-500'
              : sugerido
                ? 'italic text-amber-700/80 dark:text-amber-400/80'
                : ''
          }`}
        >
          {valorAtual ? (descricaoAtual ?? valorAtual) : (placeholder ?? `Selecionar ${tipo}`)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {aberto && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="glass-surface absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-hidden rounded-xl"
        >
          <div className="border-b border-slate-200/60 p-2 dark:border-white/10">
            <input
              ref={buscaRef}
              className={campoBase}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar ${tipo} por código ou descrição`}
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {busca.length < 2 && (
              <li className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">Digite ao menos 2 caracteres…</li>
            )}
            {busca.length >= 2 && (data ?? []).length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Nenhum resultado.</li>
            )}
            {(data ?? []).map((entrada) => (
              <li key={entrada.codigo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={entrada.codigo === valorAtual}
                  onClick={() => {
                    onEscolher(entrada);
                    setAberto(false);
                    setBusca('');
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-white/10 ${
                    entrada.codigo === valorAtual ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <strong>{entrada.codigo}</strong> — {entrada.descricao}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
