import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Search, Table2, X } from 'lucide-react';
import type { TabelaAssociada } from '../../hooks/useCostControl';
import { casaTermo } from './domain/busca';
import type { GrupoTabelasDaFonte } from './domain/tabelasAssociadas';

// Filtro de tabela associada da aba Fontes Pagadoras — dropdown no mesmo
// visual do CampoBusca da tela (caixa, chip azul ao escolher, lista de
// sugestões), com as tabelas agrupadas por fonte e um campo pra filtrar a
// lista (sem fonte escolhida são todas as tabelas).
export default function FiltroTabelaAssociada({
  grupos,
  selecionada,
  onSelecionar,
}: {
  grupos: GrupoTabelasDaFonte[];
  selecionada: TabelaAssociada | null;
  // null = "Todas as tabelas".
  onSelecionar: (tabela: TabelaAssociada | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false);
    };
    const fecharEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) setTermo('');
  }, [aberto]);

  const gruposFiltrados = useMemo(
    () =>
      termo.trim()
        ? grupos
            .map(g => ({ ...g, tabelas: g.tabelas.filter(t => casaTermo(t.nome, termo) || casaTermo(g.fontePagadora, termo)) }))
            .filter(g => g.tabelas.length > 0)
        : grupos,
    [grupos, termo]
  );

  const escolher = (tabela: TabelaAssociada | null) => {
    onSelecionar(tabela);
    setAberto(false);
  };

  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Tabela Associada</label>
      <div ref={wrapperRef} className="relative">
        {selecionada ? (
          <div className="flex items-center gap-2 pl-9 pr-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
            <Table2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
            <button
              type="button"
              onClick={() => setAberto(a => !a)}
              className="flex-1 min-w-0 text-left text-sm font-medium text-blue-700 dark:text-blue-300 truncate"
            >
              {selecionada.nome || '(sem nome)'}
              <span className="ml-1.5 text-xs font-normal text-blue-500/80 dark:text-blue-300/70">{selecionada.fontePagadora}</span>
            </button>
            <button
              type="button"
              onClick={() => escolher(null)}
              aria-label="Limpar Tabela Associada"
              className="shrink-0 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAberto(a => !a)}
            aria-haspopup="listbox"
            aria-expanded={aberto}
            className="group relative w-full flex items-center gap-2 pl-9 pr-3 py-2.5 text-sm text-left rounded-xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          >
            <Table2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <span className="flex-1 min-w-0 truncate text-gray-500 dark:text-gray-400">Todas as tabelas</span>
            <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            </motion.span>
          </button>
        )}

        <AnimatePresence>
          {aberto && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13, ease: 'easeOut' }}
              className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden"
            >
              <div className="relative border-b border-gray-100 dark:border-gray-700">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  value={termo}
                  onChange={e => setTermo(e.target.value)}
                  placeholder="Filtrar tabela ou fonte…"
                  autoComplete="off"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
                {!termo.trim() && (
                  <li>
                    <OpcaoTabela ativa={!selecionada} onClick={() => escolher(null)}>
                      Todas as tabelas
                    </OpcaoTabela>
                  </li>
                )}
                {gruposFiltrados.length === 0 ? (
                  <li className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">Nenhuma tabela encontrada.</li>
                ) : (
                  gruposFiltrados.map(grupo => (
                    <li key={grupo.fontePagadora}>
                      <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {grupo.fontePagadora}
                      </div>
                      <ul>
                        {grupo.tabelas.map(t => (
                          <li key={t.id}>
                            <OpcaoTabela ativa={selecionada?.id === t.id} onClick={() => escolher(t)}>
                              {t.nome || '(sem nome)'}
                              {!t.ativa && <span className="ml-1.5 text-xs font-normal text-gray-400">(inativa)</span>}
                            </OpcaoTabela>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OpcaoTabela({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={ativa}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
        ativa
          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium'
          : 'text-gray-800 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-500/10'
      }`}
    >
      <span className="truncate">{children}</span>
      {ativa && <Check className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
    </button>
  );
}
