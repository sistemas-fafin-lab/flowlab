import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type CorFiltro = 'gray' | 'blue' | 'green' | 'amber' | 'purple' | 'red';

export interface OpcaoFiltroAgrupado {
  valor: string;
  rotulo: string;
  /** Sem `grupo`, a opção aparece solta no topo da lista (fora de qualquer seção). */
  grupo?: string;
  cor?: CorFiltro;
}

const PONTO_COR: Record<CorFiltro, string> = {
  gray: 'bg-gray-400 dark:bg-slate-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
};

function PontoCor({ cor }: { cor?: CorFiltro }) {
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cor ? PONTO_COR[cor] : 'bg-gray-300 dark:bg-slate-600'}`} aria-hidden />;
}

interface FiltroSelecaoAgrupadaProps {
  titulo: string;
  opcoes: OpcaoFiltroAgrupado[];
  valor: string;
  onMudar: (valor: string) => void;
  className?: string;
}

/**
 * Dropdown customizado (não `<select>` nativo) para colunas com opções
 * agrupadas — ex.: Status de Ocorrências, onde "Pendente" abre um subgrupo
 * de tipos de pendência ("select dentro do select", cada um com sua cor).
 * Nativo não dá pra colorir opção por opção de forma confiável entre
 * navegadores nem estilizar o botão/painel — daqui pra frente qualquer
 * coluna filtrável com `opcoesFiltro` + `grupo` ganha isso de graça.
 */
export function FiltroSelecaoAgrupada({ titulo, opcoes, valor, onMudar, className }: FiltroSelecaoAgrupadaProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const soltas = opcoes.filter((o) => !o.grupo);
  const grupos = new Map<string, OpcaoFiltroAgrupado[]>();
  for (const opcao of opcoes) {
    if (!opcao.grupo) continue;
    const lista = grupos.get(opcao.grupo) ?? [];
    lista.push(opcao);
    grupos.set(opcao.grupo, lista);
  }

  const selecionada = opcoes.find((o) => o.valor === valor);

  function escolher(novoValor: string) {
    onMudar(novoValor);
    setAberto(false);
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400 ${className ?? ''}`}>
      {titulo}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="glass-field flex w-48 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition-all duration-200 hover:border-blue-300/60 dark:text-slate-200 dark:hover:border-blue-400/40"
      >
        <PontoCor cor={selecionada?.cor} />
        <span className="flex-1 truncate">{selecionada?.rotulo ?? 'Todos'}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 dark:text-slate-500 ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {aberto && (
        <div
          role="listbox"
          className="glass-surface absolute left-0 top-full z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-slate-200/60 bg-white/95 p-1.5 shadow-xl dark:border-white/10 dark:bg-gray-800/95"
        >
          <ItemOpcao rotulo="Todos" selecionado={!valor} onClick={() => escolher('')} />
          {soltas.map((op) => (
            <ItemOpcao key={op.valor} rotulo={op.rotulo} cor={op.cor} selecionado={valor === op.valor} onClick={() => escolher(op.valor)} />
          ))}
          {Array.from(grupos.entries()).map(([grupo, itens]) => (
            <div key={grupo} className="mt-1 border-t border-slate-200/60 pt-1 first:mt-0 first:border-t-0 first:pt-0 dark:border-white/10">
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{grupo}</p>
              {itens.map((op) => (
                <ItemOpcao key={op.valor} rotulo={op.rotulo} cor={op.cor} selecionado={valor === op.valor} onClick={() => escolher(op.valor)} indentado />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemOpcao({
  rotulo,
  cor,
  selecionado,
  onClick,
  indentado,
}: {
  rotulo: string;
  cor?: CorFiltro;
  selecionado: boolean;
  onClick: () => void;
  indentado?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selecionado}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
        indentado ? 'pl-5' : ''
      } ${
        selecionado
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
          : 'text-slate-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/5'
      }`}
    >
      <PontoCor cor={cor} />
      <span className="flex-1 truncate">{rotulo}</span>
      {selecionado && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
    </button>
  );
}
