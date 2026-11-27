// Modo Tabela Colaborador do Gerador de Orçamento (.scratch/tabela-colaborador/spec.md →
// "Tela e PDF"): busca e carrinho do Gerador com o Valor colaborador, calculado no
// servidor. Exame sem valor aparece como "consultar a gestão", com o motivo, e não entra
// no carrinho. Sem desconto automático por volume: o total é a soma dos valores × quantidade.
// O pedido médico lido por IA só marca no carrinho os exames com valor; os "consultar a
// gestão" aparecem à parte, com o motivo.
// O PDF "Orçamento – Tabela Colaborador" exige o nome do colaborador e não é guardado; o
// PDF interno (custo × venda × margem) não existe neste modo.

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, FileDown, Info, Loader2, Plus, RotateCcw, Search, ShoppingCart, Sparkles, Trash2, X } from 'lucide-react';
import { useTabelaColaborador } from '../hooks/useTabelaColaborador';
import { useGerarPdf } from '../hooks/useGerarPdf';
import { adicionarAoCarrinho, alterarQuantidade, chaveExame, removerDoCarrinho } from '../domain/carrinho';
import { exameDisponivel, filtrarExamesColaborador, motivoSemValor, totalColaborador } from '../domain/carrinhoColaborador';
import { MAX_CARACTERES_PACIENTE, nomeValido } from '../domain/paciente';
import { montarPdfOrcamentoColaborador } from '../domain/pdfCliente';
import ControleQuantidade from './ControleQuantidade';
import LeituraPedidoColaboradorModal from './LeituraPedidoColaboradorModal';
import type { PrecoColaborador } from '../domain/tabelaColaborador';
import type { ItemCarrinho, ItemColaboradorDisponivel, ItemTabelaColaborador } from '../types';

// Mesmo limite do modo particular: renderizar milhares de linhas a cada tecla trava a busca.
const MAX_RESULTADOS = 200;

const brl = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Carrinho = ItemCarrinho<ItemColaboradorDisponivel>[];

const motivoDe = (preco: PrecoColaborador) => ('motivo' in preco ? motivoSemValor(preco.motivo) : null);

const LinhaExame: React.FC<{
  exame: ItemTabelaColaborador;
  noCarrinho: boolean;
  onAdicionar: (exame: ItemColaboradorDisponivel) => void;
}> = React.memo(({ exame, noCarrinho, onAdicionar }) => (
  <li className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
    <div className="min-w-0 flex-1">
      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{exame.nome}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>TUSS {exame.tuss || '—'}</span>
        <span>· Particular {exame.precoParticular === null ? '—' : brl(exame.precoParticular)}</span>
        {exame.custo !== undefined && <span>· Custo {brl(exame.custo)}</span>}
      </p>
    </div>
    {exameDisponivel(exame) ? (
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Valor colaborador</p>
          <p className="text-base font-bold text-gray-800 dark:text-gray-100 tabular-nums">
            {brl(exame.precoColaborador.valor)}
          </p>
        </div>
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
    ) : (
      <div className="shrink-0 text-right max-w-[14rem]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/60">
          <Info className="w-3.5 h-3.5" /> Consultar a gestão
        </span>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{motivoDe(exame.precoColaborador)}</p>
      </div>
    )}
  </li>
));
LinhaExame.displayName = 'LinhaExameColaborador';

const LinhaCarrinho: React.FC<{
  linha: ItemCarrinho<ItemColaboradorDisponivel>;
  onQuantidade: (chave: string, quantidade: number) => void;
  onRemover: (chave: string) => void;
}> = ({ linha, onQuantidade, onRemover }) => {
  const chave = chaveExame(linha.item);
  const valor = linha.item.precoColaborador.valor;
  return (
    <li className="py-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={linha.item.nome}>
          {linha.item.nome}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {brl(valor)} · TUSS {linha.item.tuss || '—'}
        </p>
      </div>
      <ControleQuantidade
        nome={linha.item.nome}
        quantidade={linha.quantidade}
        onQuantidade={(quantidade) => onQuantidade(chave, quantidade)}
      />
      <span className="w-24 text-right text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
        {brl(totalColaborador([linha]))}
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

const ModoColaborador: React.FC = () => {
  const { exames, loading, error, recarregar } = useTabelaColaborador();
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);
  const [carrinho, setCarrinho] = useState<Carrinho>([]);

  const resultados = useMemo(() => filtrarExamesColaborador(exames, buscaAdiada), [exames, buscaAdiada]);
  const chavesNoCarrinho = useMemo(() => new Set(carrinho.map((c) => chaveExame(c.item))), [carrinho]);
  const total = useMemo(() => totalColaborador(carrinho), [carrinho]);

  const adicionar = React.useCallback((exame: ItemColaboradorDisponivel) => {
    setCarrinho((atual) => adicionarAoCarrinho(atual, exame));
  }, []);
  const mudarQuantidade = (chave: string, quantidade: number) =>
    setCarrinho((atual) => alterarQuantidade(atual, chave, quantidade));
  const remover = (chave: string) => setCarrinho((atual) => removerDoCarrinho(atual, chave));

  // Nome de quem leva o orçamento. Não persiste; carrinho vazio limpa o campo, para o nome
  // de um colaborador não passar para o próximo.
  const [colaborador, setColaborador] = useState('');
  useEffect(() => {
    if (carrinho.length === 0) setColaborador('');
  }, [carrinho.length]);

  const [lendoPedido, setLendoPedido] = useState(false);
  const adicionarDoPedido = (doPedido: ItemColaboradorDisponivel[]) =>
    setCarrinho((atual) => doPedido.reduce<Carrinho>(adicionarAoCarrinho, atual));

  const { gerando: gerandoPdf, erro: erroPdf, gerar } = useGerarPdf<'colaborador'>();
  const podeGerarPdf = carrinho.length > 0 && nomeValido(colaborador) && gerandoPdf === null;
  const gerarPdf = () => {
    if (!podeGerarPdf) return;
    void gerar('colaborador', 'Orcamento_Colaborador', (emitidoEm, logo) =>
      montarPdfOrcamentoColaborador({ carrinho, emitidoEm, colaborador: colaborador.trim() }, logo),
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 animate-fade-in">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando a Tabela Colaborador…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800/60 p-8 flex flex-col items-center gap-3 text-center animate-fade-in">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">A Tabela Colaborador não carregou</p>
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
    );
  }

  return (
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
      <section className="lg:col-span-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 sm:p-6 flex flex-col min-h-0 lg:h-full">
        <div className="shrink-0 pb-4 mb-2 border-b border-gray-200 dark:border-gray-700">
          <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-500" /> Carrinho
            {carrinho.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {carrinho.length}
              </span>
            )}
          </h2>
          {carrinho.length > 0 && (
            <dl className="mt-2 space-y-2">
              <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Valores da Tabela Colaborador, sem desconto por volume
              </p>
              <div className="flex items-center justify-between">
                <dt className="text-base font-semibold text-gray-900 dark:text-gray-100">Valor Total</dt>
                <dd className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{brl(total)}</dd>
              </div>
            </dl>
          )}
          {carrinho.length > 0 && (
            <div className="mt-4">
              <label
                htmlFor="colaborador-orcamento"
                className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
              >
                Nome do colaborador <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                id="colaborador-orcamento"
                type="text"
                required
                value={colaborador}
                maxLength={MAX_CARACTERES_PACIENTE}
                onChange={(e) => setColaborador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') gerarPdf();
                }}
                placeholder="Nome do colaborador"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-slate-300 bg-white/70 text-slate-800 placeholder:text-slate-400 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              {!nomeValido(colaborador) && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Informe o nome do colaborador para gerar o PDF.
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={gerarPdf}
            disabled={!podeGerarPdf}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {gerandoPdf !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Gerar PDF
          </button>
          {erroPdf && <p className="mt-2 text-xs text-center text-red-600 dark:text-red-400">{erroPdf}</p>}
          {carrinho.length > 0 && (
            <button
              type="button"
              onClick={() => setCarrinho([])}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl text-gray-600 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4" /> Limpar tudo
            </button>
          )}
        </div>
        {carrinho.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhum exame no carrinho. Busque e clique em “Adicionar”.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto min-h-0 flex-1 max-h-[50vh] lg:max-h-none -mx-1 px-1">
            {carrinho.map((linha) => (
              <LinhaCarrinho key={chaveExame(linha.item)} linha={linha} onQuantidade={mudarQuantidade} onRemover={remover} />
            ))}
          </ul>
        )}
      </section>

      {lendoPedido && (
        <LeituraPedidoColaboradorModal
          exames={exames}
          onFechar={() => setLendoPedido(false)}
          onAdicionar={adicionarDoPedido}
        />
      )}
    </div>
  );
};

export default ModoColaborador;
