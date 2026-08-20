import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Maximize2, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiltroSelecaoAgrupada, type CorFiltro } from './FiltroSelecaoAgrupada.js';

export type CorTabela = 'blue' | 'amber' | 'emerald' | 'purple' | 'rose' | 'sky';

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  /** Valor bruto usado para ordenação e busca. */
  valor: (item: T) => string | number | null | undefined;
  /** Como renderizar a célula; usa `valor` como texto simples se omitido. */
  render?: (item: T) => ReactNode;
  ordenavel?: boolean;
  /** Só colunas marcadas aparecem na barra de filtros do modal expandido. */
  filtravel?: boolean;
  tipoFiltro?: 'texto' | 'select';
  /**
   * Só para `tipoFiltro: 'select'`: substitui a lista de opções auto-gerada
   * (valores únicos de `valor(item)`) por uma lista fixa com rótulo próprio —
   * usado para filtros aninhados (ex.: "Pendente" com subtipos agrupados por
   * `grupo` num `<optgroup>`, "filtro dentro de outro filtro"). O `valor` de
   * cada opção precisa continuar batendo com `coluna.valor(item)` (o motor de
   * filtro compara por `includes`, então um valor composto tipo
   * `"pendente:motivo"` também casa com o filtro pai `"pendente"`).
   */
  opcoesFiltro?: { valor: string; rotulo: string; grupo?: string; cor?: CorFiltro }[];
  larguraMin?: string;
  className?: string;
  /** Quebra o texto em várias linhas em vez de truncar/cortar — para textos livres longos (nome de clínica, descrição, observações). */
  quebrarLinha?: boolean;
}

interface TabelaExpansivelProps<T> {
  titulo: string;
  colunas: ColunaTabela<T>[];
  dados: T[];
  chaveLinha: (item: T) => string;
  onClickLinha?: (item: T) => void;
  classeLinha?: (item: T) => string;
  cor?: CorTabela;
  caption?: string;
  alturaCompacta?: string;
}

type Direcao = 'asc' | 'desc' | null;

export const ACCENT_TABELA: Record<
  CorTabela,
  {
    borda: string;
    texto: string;
    textoAtivo: string;
    chip: string;
    anel: string;
    gradiente: string;
    sombra: string;
    /** Fundo do cabeçalho da tabela — tinta lisa e sutil, não gradiente saturado. */
    headerBg: string;
    headerTexto: string;
    headerBorda: string;
    /** Trilho/thumb da scrollbar (webkit) na cor de destaque da tabela. */
    scrollbar: string;
    /** Anel de foco dos campos de filtro — só aparece ao focar, não em repouso. */
    focoAnel: string;
  }
> = {
  blue: {
    borda: 'border-blue-500',
    texto: 'text-blue-600 dark:text-blue-400',
    textoAtivo: 'text-blue-700 dark:text-blue-300',
    chip: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    anel: 'focus:ring-blue-500/40',
    gradiente: 'bg-gradient-to-r from-blue-500 to-blue-600',
    sombra: 'shadow-blue-500/25',
    headerBg: 'bg-blue-50/70 dark:bg-blue-500/10',
    headerTexto: 'text-blue-700 dark:text-blue-300',
    headerBorda: 'border-blue-200 dark:border-blue-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-blue-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-blue-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-blue-400/70',
    focoAnel: 'focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 dark:focus:border-blue-500/60',
  },
  amber: {
    borda: 'border-amber-500',
    texto: 'text-amber-600 dark:text-amber-400',
    textoAtivo: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    anel: 'focus:ring-amber-500/40',
    gradiente: 'bg-gradient-to-r from-amber-500 to-orange-500',
    sombra: 'shadow-amber-500/25',
    headerBg: 'bg-amber-50/70 dark:bg-amber-500/10',
    headerTexto: 'text-amber-700 dark:text-amber-300',
    headerBorda: 'border-amber-200 dark:border-amber-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-amber-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-amber-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-amber-400/70',
    focoAnel: 'focus:border-amber-400 focus:ring-2 focus:ring-amber-500/25 dark:focus:border-amber-500/60',
  },
  emerald: {
    borda: 'border-emerald-500',
    texto: 'text-emerald-600 dark:text-emerald-400',
    textoAtivo: 'text-emerald-700 dark:text-emerald-300',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    anel: 'focus:ring-emerald-500/40',
    gradiente: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    sombra: 'shadow-emerald-500/25',
    headerBg: 'bg-emerald-50/70 dark:bg-emerald-500/10',
    headerTexto: 'text-emerald-700 dark:text-emerald-300',
    headerBorda: 'border-emerald-200 dark:border-emerald-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-emerald-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-emerald-400/70',
    focoAnel: 'focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 dark:focus:border-emerald-500/60',
  },
  purple: {
    borda: 'border-purple-500',
    texto: 'text-purple-600 dark:text-purple-400',
    textoAtivo: 'text-purple-700 dark:text-purple-300',
    chip: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    anel: 'focus:ring-purple-500/40',
    gradiente: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
    sombra: 'shadow-purple-500/25',
    headerBg: 'bg-purple-50/70 dark:bg-purple-500/10',
    headerTexto: 'text-purple-700 dark:text-purple-300',
    headerBorda: 'border-purple-200 dark:border-purple-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-purple-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-purple-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-purple-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-purple-400/70',
    focoAnel: 'focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 dark:focus:border-purple-500/60',
  },
  rose: {
    borda: 'border-rose-500',
    texto: 'text-rose-600 dark:text-rose-400',
    textoAtivo: 'text-rose-700 dark:text-rose-300',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    anel: 'focus:ring-rose-500/40',
    gradiente: 'bg-gradient-to-r from-rose-500 to-pink-500',
    sombra: 'shadow-rose-500/25',
    headerBg: 'bg-rose-50/70 dark:bg-rose-500/10',
    headerTexto: 'text-rose-700 dark:text-rose-300',
    headerBorda: 'border-rose-200 dark:border-rose-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-rose-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-rose-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-rose-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-rose-400/70',
    focoAnel: 'focus:border-rose-400 focus:ring-2 focus:ring-rose-500/25 dark:focus:border-rose-500/60',
  },
  sky: {
    borda: 'border-sky-500',
    texto: 'text-sky-600 dark:text-sky-400',
    textoAtivo: 'text-sky-700 dark:text-sky-300',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    anel: 'focus:ring-sky-500/40',
    gradiente: 'bg-gradient-to-r from-sky-500 to-blue-500',
    sombra: 'shadow-sky-500/25',
    headerBg: 'bg-sky-50/70 dark:bg-sky-500/10',
    headerTexto: 'text-sky-700 dark:text-sky-300',
    headerBorda: 'border-sky-200 dark:border-sky-500/20',
    scrollbar:
      '[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sky-400/40 dark:[&::-webkit-scrollbar-thumb]:bg-sky-500/40 [&::-webkit-scrollbar-thumb:hover]:bg-sky-400/70 dark:[&::-webkit-scrollbar-thumb:hover]:bg-sky-400/70',
    focoAnel: 'focus:border-sky-400 focus:ring-2 focus:ring-sky-500/25 dark:focus:border-sky-500/60',
  },
};

const ACCENT = ACCENT_TABELA;

function campoFiltroClasses(accent: (typeof ACCENT_TABELA)[CorTabela]): string {
  return `glass-field flex h-10 w-full items-center rounded-xl px-3 text-sm text-slate-800 outline-none transition-shadow duration-200 dark:text-slate-200 ${accent.focoAnel}`;
}

function normalizar(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).toLowerCase();
}

function useOrdenacaoEFiltro<T>(colunas: ColunaTabela<T>[], dados: T[]) {
  const [ordenacao, setOrdenacao] = useState<{ chave: string; direcao: Direcao }>({ chave: '', direcao: null });
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState('');

  function alternarOrdenacao(chave: string) {
    setOrdenacao((atual) => {
      if (atual.chave !== chave) return { chave, direcao: 'asc' };
      if (atual.direcao === 'asc') return { chave, direcao: 'desc' };
      return { chave: '', direcao: null };
    });
  }

  const dadosFiltrados = useMemo(() => {
    let resultado = dados;

    const buscaNormalizada = normalizar(busca);
    if (buscaNormalizada) {
      resultado = resultado.filter((item) =>
        colunas.some((coluna) => normalizar(coluna.valor(item)).includes(buscaNormalizada)),
      );
    }

    for (const [chave, valorFiltro] of Object.entries(filtros)) {
      if (!valorFiltro) continue;
      const coluna = colunas.find((c) => c.chave === chave);
      if (!coluna) continue;
      const filtroNormalizado = normalizar(valorFiltro);
      resultado = resultado.filter((item) => normalizar(coluna.valor(item)).includes(filtroNormalizado));
    }

    return resultado;
  }, [dados, colunas, busca, filtros]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenacao.chave || !ordenacao.direcao) return dadosFiltrados;
    const coluna = colunas.find((c) => c.chave === ordenacao.chave);
    if (!coluna) return dadosFiltrados;
    const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
    return [...dadosFiltrados].sort((a, b) => {
      const va = coluna.valor(a);
      const vb = coluna.valor(b);
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
      return normalizar(va).localeCompare(normalizar(vb)) * sinal;
    });
  }, [dadosFiltrados, ordenacao, colunas]);

  return { ordenacao, alternarOrdenacao, filtros, setFiltros, busca, setBusca, dadosOrdenados };
}

function IconeOrdenacao({ ativo, direcao }: { ativo: boolean; direcao: Direcao }) {
  if (!ativo || !direcao) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  return direcao === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
  );
}

function Corpo<T>({
  colunas,
  dados,
  chaveLinha,
  onClickLinha,
  classeLinha,
  cor,
  caption,
  ordenacao,
  alternarOrdenacao,
}: {
  colunas: ColunaTabela<T>[];
  dados: T[];
  chaveLinha: (item: T) => string;
  onClickLinha?: (item: T) => void;
  classeLinha?: (item: T) => string;
  cor: CorTabela;
  caption?: string;
  ordenacao: { chave: string; direcao: Direcao };
  alternarOrdenacao: (chave: string) => void;
}) {
  const accent = ACCENT[cor];

  return (
    <table className="min-w-full border-separate border-spacing-0">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {colunas.map((coluna) => {
            const ativo = ordenacao.chave === coluna.chave;
            return (
              <th
                key={coluna.chave}
                className={`sticky top-0 z-10 whitespace-nowrap border-b px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide ${accent.headerBg} ${
                  ativo ? accent.borda : accent.headerBorda
                } ${coluna.larguraMin ?? ''} ${coluna.className ?? ''}`}
              >
                {coluna.ordenavel === false ? (
                  <span className={accent.headerTexto}>{coluna.titulo}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => alternarOrdenacao(coluna.chave)}
                    className={`flex items-center gap-1 transition-colors ${accent.headerTexto} ${ativo ? '' : 'opacity-80 hover:opacity-100'}`}
                  >
                    {coluna.titulo}
                    <IconeOrdenacao ativo={ativo} direcao={ativo ? ordenacao.direcao : null} />
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-white/5">
        {dados.map((item) => (
          <tr
            key={chaveLinha(item)}
            onClick={onClickLinha ? () => onClickLinha(item) : undefined}
            className={`group transition-colors ${onClickLinha ? 'cursor-pointer' : ''} hover:bg-gray-50 dark:hover:bg-white/5 ${classeLinha ? classeLinha(item) : ''}`}
          >
            {colunas.map((coluna) => (
              <td
                key={coluna.chave}
                className={`px-4 py-3 align-top text-sm text-gray-700 dark:text-slate-300 ${
                  coluna.quebrarLinha ? 'max-w-xs whitespace-normal break-words' : 'whitespace-nowrap'
                } ${coluna.larguraMin ?? ''} ${coluna.className ?? ''}`}
              >
                {coluna.render ? coluna.render(item) : (coluna.valor(item) ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TabelaExpansivel<T>({
  titulo,
  colunas,
  dados,
  chaveLinha,
  onClickLinha,
  classeLinha,
  cor = 'blue',
  caption,
  alturaCompacta = 'max-h-[26rem]',
}: TabelaExpansivelProps<T>) {
  const [expandido, setExpandido] = useState(false);
  const estado = useOrdenacaoEFiltro(colunas, dados);
  const accent = ACCENT[cor];
  const campoFiltro = campoFiltroClasses(accent);
  const colunasFiltraveis = colunas.filter((c) => c.filtravel);

  return (
    <>
      <div className="w-[95%] max-w-[95%] min-w-0">
        <div className="glass-surface relative overflow-hidden rounded-2xl">
          <div className={`flex items-center justify-between gap-3 border-b ${accent.headerBorda} px-4 py-3`}>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              {titulo} <span className="font-normal text-gray-400 dark:text-slate-500">({dados.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${accent.texto} hover:bg-gray-100 dark:hover:bg-white/10`}
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              Expandir
            </button>
          </div>
          <div className={`overflow-auto rounded-b-2xl ${alturaCompacta} ${accent.scrollbar}`}>
            <Corpo
              colunas={colunas}
              dados={estado.dadosOrdenados}
              chaveLinha={chaveLinha}
              onClickLinha={onClickLinha}
              classeLinha={classeLinha}
              cor={cor}
              caption={caption}
              ordenacao={estado.ordenacao}
              alternarOrdenacao={estado.alternarOrdenacao}
            />
          </div>
        </div>
      </div>

      {expandido && createPortal(
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-black/70"
          onClick={() => setExpandido(false)}
        >
          <div className="relative h-[90vh] w-[90vw]">
            <div
              className="relative flex h-full w-full animate-scale-in flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/95"
              onClick={(e) => e.stopPropagation()}
            >
            <div className={`flex items-center justify-between gap-3 border-b ${accent.headerBorda} px-6 py-4`}>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                {titulo}{' '}
                <span className="text-sm font-normal text-gray-400 dark:text-slate-500">
                  ({estado.dadosOrdenados.length} de {dados.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setExpandido(false)}
                className="rounded-full p-1.5 text-gray-400 transition-all duration-200 hover:rotate-90 hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200/60 px-6 py-3 dark:border-white/5">
              <label className="flex flex-col text-xs font-medium text-gray-500 dark:text-slate-400">
                Buscar (todas as colunas)
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden />
                  <input
                    className={`${campoFiltro} w-56 pl-9`}
                    value={estado.busca}
                    onChange={(e) => estado.setBusca(e.target.value)}
                    placeholder="Digite para buscar…"
                  />
                </div>
              </label>
              {colunasFiltraveis.map((coluna) => {
                if (coluna.tipoFiltro === 'select') {
                  if (coluna.opcoesFiltro) {
                    return (
                      <FiltroSelecaoAgrupada
                        key={coluna.chave}
                        titulo={coluna.titulo}
                        opcoes={coluna.opcoesFiltro}
                        valor={estado.filtros[coluna.chave] ?? ''}
                        onMudar={(novoValor) => estado.setFiltros((f) => ({ ...f, [coluna.chave]: novoValor }))}
                      />
                    );
                  }
                  const opcoes = Array.from(new Set(dados.map((item) => coluna.valor(item)).filter((v) => v !== null && v !== undefined && v !== '')))
                    .map(String)
                    .sort((a, b) => a.localeCompare(b));
                  return (
                    <label key={coluna.chave} className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                      {coluna.titulo}
                      <div className="relative">
                        <select
                          className={`${campoFiltro} w-40 appearance-none pr-8`}
                          value={estado.filtros[coluna.chave] ?? ''}
                          onChange={(e) => estado.setFiltros((f) => ({ ...f, [coluna.chave]: e.target.value }))}
                        >
                          <option value="">Todos</option>
                          {opcoes.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500"
                          aria-hidden
                        />
                      </div>
                    </label>
                  );
                }
                return (
                  <label key={coluna.chave} className="flex flex-col gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                    {coluna.titulo}
                    <input
                      className={`${campoFiltro} w-40`}
                      value={estado.filtros[coluna.chave] ?? ''}
                      onChange={(e) => estado.setFiltros((f) => ({ ...f, [coluna.chave]: e.target.value }))}
                      placeholder="filtrar…"
                    />
                  </label>
                );
              })}
              {(estado.busca || Object.values(estado.filtros).some(Boolean)) && (
                <button
                  type="button"
                  onClick={() => {
                    estado.setBusca('');
                    estado.setFiltros({});
                  }}
                  className="pb-2 text-xs font-medium text-gray-500 underline hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className={`flex-1 overflow-auto ${accent.scrollbar}`}>
              <Corpo
                colunas={colunas}
                dados={estado.dadosOrdenados}
                chaveLinha={chaveLinha}
                onClickLinha={onClickLinha}
                classeLinha={classeLinha}
                cor={cor}
                ordenacao={estado.ordenacao}
                alternarOrdenacao={estado.alternarOrdenacao}
              />
            </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
