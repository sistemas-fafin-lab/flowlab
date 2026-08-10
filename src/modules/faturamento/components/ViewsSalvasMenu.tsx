import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import { useViewsSalvas } from '../hooks/useViewsSalvas';
import type { ViewSalvaTela } from '../../billing/types';

// Dropdown de views salvas, compartilhado pelas telas do módulo (Dashboard,
// Títulos, Glosas/Recursos) — cada uma passa seu próprio formato de filtro
// como TFiltros. Aplicar é imediato ao clicar; salvar é a única ação que pede
// confirmação (dar um nome). Sem portal: nas três telas o botão já fica fora
// de qualquer ancestral com overflow que o recortaria.

const CAMPO =
  'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-sm text-gray-900 dark:text-gray-100';

interface Props<TFiltros> {
  tela: ViewSalvaTela;
  /** O recorte atual da tela — só os campos que fazem sentido salvar (sem paginação). */
  filtros: TFiltros;
  onAplicar: (filtros: TFiltros) => void;
}

export function ViewsSalvasMenu<TFiltros extends object>({
  tela,
  filtros,
  onAplicar,
}: Props<TFiltros>): React.ReactElement {
  const { views, loading, salvar, excluir } = useViewsSalvas<TFiltros>(tela);
  const [aberto, setAberto] = useState(false);
  const [modoSalvar, setModoSalvar] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setAberto(false);
      setModoSalvar(false);
      setErro(null);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  const aplicar = (filtrosDaView: TFiltros) => {
    onAplicar(filtrosDaView);
    setAberto(false);
  };

  const confirmarSalvar = async () => {
    setSalvando(true);
    setErro(null);
    const erroMsg = await salvar(nome, filtros);
    setSalvando(false);
    if (erroMsg) {
      setErro(erroMsg);
      return;
    }
    setNome('');
    setModoSalvar(false);
  };

  const excluirView = async (id: string) => {
    setErro(null);
    const erroMsg = await excluir(id);
    if (erroMsg) setErro(erroMsg);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
      >
        <Bookmark className="w-4 h-4" />
        Views
        {views.length > 0 && (
          <span className="px-1.5 rounded-md bg-gray-500/10 dark:bg-white/10 text-xs tabular-nums">{views.length}</span>
        )}
      </button>

      {aberto && (
        <div className="absolute left-0 z-[60] mt-2 w-72 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
          <div className="max-h-[220px] overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">Carregando…</p>
            ) : views.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">Nenhuma view salva.</p>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="group flex items-center gap-1 pl-3 pr-1.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  <button
                    type="button"
                    onClick={() => aplicar(view.filtros)}
                    className="flex-1 min-w-0 text-left text-sm text-gray-700 dark:text-gray-200 truncate"
                  >
                    {view.nome}
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluirView(view.id)}
                    className="p-1 rounded text-gray-300 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0"
                    aria-label={`Excluir view ${view.nome}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700 p-2">
            {erro && <p className="px-1 pb-2 text-xs text-rose-600 dark:text-rose-400">{erro}</p>}

            {modoSalvar ? (
              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void confirmarSalvar();
                    }
                  }}
                  placeholder="Nome da view…"
                  className={CAMPO}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModoSalvar(false);
                      setErro(null);
                    }}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmarSalvar()}
                    disabled={salvando || !nome.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setModoSalvar(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Salvar filtros atuais como view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewsSalvasMenu;
