import React, { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Check, FileDown, FileLock2, Loader2, Minus, Plus, RotateCcw, Search, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import { useListaPrecos } from '../hooks/useListaPrecos';
import { filtrarExames } from '../domain/busca';
import { adicionarAoCarrinho, alterarQuantidade, chaveExame, removerDoCarrinho } from '../domain/carrinho';
import { orcamentoDoCarrinho } from '../domain/orcamento';
import { montarPdfOrcamentoCliente } from '../domain/pdfCliente';
import { montarPdfOrcamentoInterno } from '../domain/pdfInterno';
import type { DadosPdfOrcamento } from '../domain/pdfComum';
import { carregarLogoPdf } from '../logoPdf';
import LeituraPedidoMedicoModal from './LeituraPedidoMedicoModal';
import type { ItemCarrinho, ItemGeradorOrcamento } from '../types';

// Renderizar milhares de linhas a cada tecla trava a busca; acima disso, a tela pede
// para refinar o termo.
const MAX_RESULTADOS = 200;

// O PDF interno só aparece para quem pode ver custos (a lista de preços traz o custo).
const PDFS = {
  cliente: { montar: montarPdfOrcamentoCliente, arquivo: 'Orcamento' },
  interno: { montar: montarPdfOrcamentoInterno, arquivo: 'Orcamento_Interno' },
} satisfies Record<string, { montar: (dados: DadosPdfOrcamento, logo: string | null) => unknown; arquivo: string }>;
type TipoPdf = keyof typeof PDFS;

const brl = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LinhaExame: React.FC<{
  exame: ItemGeradorOrcamento;
  noCarrinho: boolean;
  onAdicionar: (exame: ItemGeradorOrcamento) => void;
}> = React.memo(({ exame, noCarrinho, onAdicionar }) => (
  <li className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
    <div className="min-w-0 flex-1">
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{exame.nome}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">TUSS {exame.tuss || '—'}</p>
      {exame.conveniosAceitos.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {exame.conveniosAceitos.map((convenio) => (
            <span
              key={convenio}
              className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {convenio}
            </span>
          ))}
        </div>
      )}
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-base font-bold text-gray-800 dark:text-gray-100 tabular-nums">{brl(exame.preco)}</span>
      {noCarrinho ? (
        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
          <Check className="w-4 h-4" /> No carrinho
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onAdicionar(exame)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      )}
    </div>
  </li>
));
LinhaExame.displayName = 'LinhaExame';

const LinhaCarrinho: React.FC<{
  linha: ItemCarrinho;
  onQuantidade: (chave: string, quantidade: number) => void;
  onRemover: (chave: string) => void;
}> = ({ linha, onQuantidade, onRemover }) => {
  const chave = chaveExame(linha.item);
  // Rascunho do campo: deixa apagar e redigitar a quantidade; ao sair do campo, volta
  // para a quantidade válida do carrinho.
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <li className="py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={linha.item.nome}>
          {linha.item.nome}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {brl(linha.item.preco)} · TUSS {linha.item.tuss || '—'}
        </p>
      </div>
      <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          aria-label="Diminuir quantidade"
          onClick={() => onQuantidade(chave, linha.quantidade - 1)}
          disabled={linha.quantidade <= 1}
          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={1}
          aria-label={`Quantidade de ${linha.item.nome}`}
          value={rascunho ?? linha.quantidade}
          onChange={(e) => {
            setRascunho(e.target.value);
            onQuantidade(chave, e.target.valueAsNumber);
          }}
          onBlur={() => setRascunho(null)}
          className="w-10 text-center text-sm font-semibold bg-transparent text-gray-800 dark:text-gray-100 border-0 focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() => onQuantidade(chave, linha.quantidade + 1)}
          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="w-24 text-right text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
        {brl(linha.item.preco * linha.quantidade)}
      </span>
      <button
        type="button"
        aria-label={`Remover ${linha.item.nome}`}
        onClick={() => onRemover(chave)}
        className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  );
};

const GeradorOrcamentoPage: React.FC = () => {
  const { exames, podeVerCustos, loading, error, recarregar } = useListaPrecos();
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const buscaAdiada = useDeferredValue(busca);

  const resultados = useMemo(() => filtrarExames(exames, buscaAdiada), [exames, buscaAdiada]);
  const chavesNoCarrinho = useMemo(() => new Set(carrinho.map((c) => chaveExame(c.item))), [carrinho]);
  const orcamento = useMemo(() => orcamentoDoCarrinho(carrinho), [carrinho]);

  // Busca dentro do carrinho: só filtra as linhas mostradas; os totais e os PDFs
  // continuam valendo para o carrinho inteiro.
  const [buscaCarrinho, setBuscaCarrinho] = useState('');
  const linhasVisiveis = useMemo(() => {
    const chaves = new Set(filtrarExames(carrinho.map((c) => c.item), buscaCarrinho).map(chaveExame));
    return carrinho.filter((linha) => chaves.has(chaveExame(linha.item)));
  }, [carrinho, buscaCarrinho]);

  const adicionar = React.useCallback((exame: ItemGeradorOrcamento) => {
    setCarrinho((atual) => adicionarAoCarrinho(atual, exame));
  }, []);
  const mudarQuantidade = (chave: string, quantidade: number) =>
    setCarrinho((atual) => alterarQuantidade(atual, chave, quantidade));
  const remover = (chave: string) => setCarrinho((atual) => removerDoCarrinho(atual, chave));

  const [lendoPedido, setLendoPedido] = useState(false);
  const adicionarDoPedido = (doPedido: ItemGeradorOrcamento[]) =>
    setCarrinho((atual) => doPedido.reduce<ItemCarrinho[]>(adicionarAoCarrinho, atual));

  const [gerandoPdf, setGerandoPdf] = useState<TipoPdf | null>(null);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const gerarPdf = async (tipo: TipoPdf) => {
    setGerandoPdf(tipo);
    setErroPdf(null);
    try {
      const emitidoEm = new Date();
      const { montar, arquivo } = PDFS[tipo];
      const doc = montar({ carrinho, orcamento, emitidoEm }, await carregarLogoPdf());
      doc.save(`${arquivo}_${emitidoEm.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Falha ao gerar o PDF do Orçamento:', error);
      setErroPdf('Não foi possível gerar o PDF. Tente de novo.');
    } finally {
      setGerandoPdf(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pt-4 sm:pt-6 pb-10 lg:pb-0 lg:h-[calc(100vh-1.5rem)] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gerador de Orçamento</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Exames particulares para o cliente</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 animate-fade-in">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando a lista de exames…</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800/60 p-8 flex flex-col items-center gap-3 text-center animate-fade-in">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200">A lista de exames não carregou</p>
            <p className="text-sm text-red-700/90 dark:text-red-300/90 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={recarregar}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700"
          >
            <RotateCcw className="w-4 h-4" /> Tentar de novo
          </button>
        </div>
      ) : (
        // lg: os dois cards ocupam o resto da altura da janela; só as listas rolam.
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0 gap-6 animate-fade-in">
          {/* ── Busca ───────────────────────────────────────────────────────── */}
          <section className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col min-h-0 lg:h-full">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  Buscar exames
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {exames.length} exames
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => setLendoPedido(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/60 dark:hover:bg-blue-900/50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Ler pedido médico
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome do exame ou código TUSS…"
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 backdrop-blur-sm text-slate-800 placeholder:text-slate-400 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
            {resultados.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum exame encontrado para “{buscaAdiada.trim()}”.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto max-h-[65vh] lg:max-h-none lg:flex-1 lg:min-h-0">
                  {resultados.slice(0, MAX_RESULTADOS).map((exame) => {
                    const chave = chaveExame(exame);
                    return (
                      <LinhaExame key={chave} exame={exame} noCarrinho={chavesNoCarrinho.has(chave)} onAdicionar={adicionar} />
                    );
                  })}
                </ul>
                {resultados.length > MAX_RESULTADOS && (
                  <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    Mostrando {MAX_RESULTADOS} de {resultados.length} exames. Refine a busca para ver os demais.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── Carrinho ────────────────────────────────────────────────────── */}
          {/* Totais e botões logo abaixo do cabeçalho, sempre visíveis; só a lista rola. */}
          <section className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 sm:p-6 flex flex-col min-h-0 lg:h-full">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-500" /> Carrinho
                {carrinho.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {carrinho.length}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => { setCarrinho([]); setBuscaCarrinho(''); }}
                disabled={carrinho.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-gray-600 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar tudo
              </button>
            </div>
            <div className="shrink-0 pb-4 mb-2 border-b border-gray-200 dark:border-gray-700">
              {carrinho.length > 0 && (
                // Sempre os dois valores, iguais quando não há desconto; sem percentual nem selo.
                <dl className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                    <dt>Valor Total</dt>
                    <dd className="font-semibold tabular-nums">{brl(orcamento.valorTotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-base font-semibold text-gray-900 dark:text-gray-100">Valor com Desconto</dt>
                    <dd className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {brl(orcamento.valorComDesconto)}
                    </dd>
                  </div>
                </dl>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => gerarPdf('cliente')}
                  disabled={carrinho.length === 0 || gerandoPdf !== null}
                  className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {gerandoPdf === 'cliente' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Gerar PDF
                </button>
                {podeVerCustos && (
                  <button
                    type="button"
                    onClick={() => gerarPdf('interno')}
                    disabled={carrinho.length === 0 || gerandoPdf !== null}
                    className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {gerandoPdf === 'interno' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileLock2 className="w-4 h-4" />} Gerar PDF Interno
                  </button>
                )}
              </div>
              {erroPdf && <p className="mt-2 text-xs text-center text-red-600 dark:text-red-400">{erroPdf}</p>}
              {carrinho.length > 0 && (
                <div className="relative mt-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="search"
                    value={buscaCarrinho}
                    onChange={(e) => setBuscaCarrinho(e.target.value)}
                    placeholder="Buscar nos exames selecionados…"
                    aria-label="Buscar nos exames selecionados"
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 text-slate-800 placeholder:text-slate-400 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
              )}
            </div>
            {carrinho.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum exame no carrinho. Busque e clique em “Adicionar”.
              </p>
            ) : linhasVisiveis.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Nenhum exame do carrinho encontrado para “{buscaCarrinho.trim()}”.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto min-h-0 flex-1 max-h-[50vh] lg:max-h-none -mx-1 px-1">
                {linhasVisiveis.map((linha) => (
                  <LinhaCarrinho
                    key={chaveExame(linha.item)}
                    linha={linha}
                    onQuantidade={mudarQuantidade}
                    onRemover={remover}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {lendoPedido && (
        <LeituraPedidoMedicoModal exames={exames} onFechar={() => setLendoPedido(false)} onAdicionar={adicionarDoPedido} />
      )}
    </div>
  );
};

export default GeradorOrcamentoPage;
