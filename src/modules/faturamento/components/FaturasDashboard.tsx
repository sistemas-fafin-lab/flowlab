import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  DollarSign,
  Layers,
  ClipboardList,
  AlertCircle,
  RefreshCw,
  Building2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Filter,
  Search
} from 'lucide-react';
import { useFaturamentoLotes } from '../hooks/useFaturamentoLotes';
import { STLOT_LABELS, LoteFaturamento, RequisicaoLote } from '../types';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import Tooltip from '../../../components/Tooltip';
// Cópias locais destas duas viraram utilitário do módulo quando Contas a Receber
// passou a precisar das mesmas regras (inclusive o T00:00:00 do fuso).
import { formatCurrency, formatData } from '../utils/formato';
import { dayKey, janelaDoPreset, janelaEfetiva, PeriodoPreset, statusIgnoraPeriodo } from '../utils/periodo';

// ============================================================================
// COMPONENTE: FaturasDashboard
// Aba Faturamento → Faturas. Lista os lotes de faturamento lidos do MySQL de backup
// do laboratório (/api/faturamento/lotes); expandir um lote mostra as requisições que
// o compõem, cada uma com seus procedimentos cobrados (/api/faturamento/lote-detalhe).
// Nada vem do Supabase.
//
// A fonte era a API do apLIS, que só devolve os procedimentos somados por lote, sem
// nenhuma referência às requisições — daí a troca para o banco.
// ============================================================================

// STLOT 7 — o único status em que o drill-down filtra para mostrar só pendências
// (issue 09 do feedback: ValorRecebido < ValorLiquido). Nos demais status o
// recebido × pendente aparece por procedimento, mas sem esconder requisições.
const STATUS_RECEBIDO_PARCIAL = 7;

const TAMANHOS_PAGINA = [25, 50, 100, 200];
const TAMANHOS_PAGINA_OPCOES = TAMANHOS_PAGINA.map((n) => ({ value: String(n), label: String(n) }));

const STATUS_FILTRO_OPCOES = [
  { value: '0', label: 'Todos os Status' },
  ...Object.entries(STLOT_LABELS).map(([codigo, rotulo]) => ({ value: codigo, label: rotulo })),
];

const CAMPO_FILTRO =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

// Cores por código STLOT (ver STLOT_LABELS). Agrupadas por significado financeiro:
// em andamento (azul/amarelo), dinheiro entrou (verde), encerrado sem receita
// (cinza/vermelho).
const STATUS_CORES: Record<number, string> = {
  1: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  2: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  3: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  4: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  5: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
  6: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  7: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  8: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

/** Em lotes "Recebido - parcial" (STLOT 7), esconde as requisições já totalmente
 *  recebidas do drill-down — só as pendentes (issue 09 do feedback). Nos demais
 *  status mostra tudo, sem filtrar. */
function requisicoesParaExibir(
  lote: LoteFaturamento,
  todas: RequisicaoLote[],
): { exibidas: RequisicaoLote[]; ocultasRecebidas: number } {
  if (lote.status !== STATUS_RECEBIDO_PARCIAL) return { exibidas: todas, ocultasRecebidas: 0 };
  const exibidas = todas.filter((r) => r.pendente);
  return { exibidas, ocultasRecebidas: todas.length - exibidas.length };
}

const StatusBadge: React.FC<{ lote: LoteFaturamento }> = ({ lote }) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
      STATUS_CORES[lote.status] ?? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
    }`}
  >
    {lote.statusLabel}
  </span>
);

const FaturasDashboard: React.FC = () => {
  const [preset, setPreset] = useState<PeriodoPreset>('mes');
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<number | 0>(0);
  const [somenteProtocoloDuplicado, setSomenteProtocoloDuplicado] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(50);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    buscaTimer.current = setTimeout(() => {
      setBuscaDebounced(busca.trim());
    }, 350);
    return () => {
      if (buscaTimer.current) clearTimeout(buscaTimer.current);
    };
  }, [busca]);

  // Intervalo efetivo (preset OU datas personalizadas) → limites ISO p/ o hook.
  // Memoizado: os limites ficam fixos até o preset/datas/status/duplicados mudarem,
  // evitando refetch em loop (o hook depende dessas strings). Ignora o preset padrão
  // quando o status filtrado tem data de referência diferente da criação do lote
  // (ex.: Prejuízo, Recebido - parcial) ou quando "Protocolos duplicados" está ativo
  // — mesmo motivo: duplicidade pode vir de um lote antigo — ver janelaEfetiva.
  const range = useMemo(
    () =>
      janelaEfetiva(preset, filtroStatus, new Date(), { ini: customIni, fim: customFim }, {
        somenteProtocoloDuplicado,
      }),
    [preset, customIni, customFim, filtroStatus, somenteProtocoloDuplicado],
  );

  // Enquanto o período é ignorado, o botão do preset fixo (ex.: "Mês atual") ficaria
  // aceso mentindo sobre o que está em tela — que na prática é "o ano atual inteiro".
  // `presetExibido` só afeta o destaque visual dos botões e a exibição dos campos de
  // data; a consulta continua usando `range` (via `preset`), preservando a garantia
  // da issue 02/09/10 de não esconder lotes fora do preset padrão de período.
  const presetExibido: PeriodoPreset = range.ignorandoPeriodo ? 'custom' : preset;

  // Clicar em "Mês atual"/"30 dias"/"90 dias" nesse estado muda `preset` mas não muda
  // nada em tela (janelaEfetiva continua ignorando o período) — sem desabilitar, o
  // clique fica silenciosamente sem efeito. Ver `statusIgnoraPeriodo`.
  const presetsFixosDesabilitados = statusIgnoraPeriodo(filtroStatus) || somenteProtocoloDuplicado;

  // Texto do porquê o período está sendo ignorado — usado no tooltip dos presets
  // desabilitados e no aviso abaixo dos filtros. Os dois motivos podem coincidir
  // (ex.: Recebido - parcial + Protocolos duplicados ao mesmo tempo).
  const motivoIgnorarPeriodo = [
    statusIgnoraPeriodo(filtroStatus) ? `status "${STLOT_LABELS[filtroStatus] ?? filtroStatus}"` : null,
    somenteProtocoloDuplicado ? '"Protocolos duplicados"' : null,
  ]
    .filter(Boolean)
    .join(' e ');

  const { lotes, meta, loading, error, refetch, buscarRequisicoes } = useFaturamentoLotes({
    periodoIni: range.periodoIni,
    periodoFim: range.periodoFim,
    pagina,
    tamanho,
    statusLote: filtroStatus || undefined,
    busca: buscaDebounced || undefined,
    somenteProtocoloDuplicado: somenteProtocoloDuplicado || undefined,
  });

  // Pré-preenche os campos de data com o intervalo real dos lotes encontrados (não o
  // início do ano atual de `janelaEfetiva`) assim que a consulta do ano inteiro
  // retorna — só um ponto de partida caso o usuário queira restringir via
  // "Personalizado"; a consulta em si só passa a respeitar essas datas depois
  // que ele de fato editar um dos campos (ver `escolherCustomIni`/`escolherCustomFim`).
  // Sobrescreve sempre (não só quando vazio): enquanto `ignorandoPeriodo` for true, o
  // preset ainda não é 'custom' de fato, então esses campos não vêm de uma escolha do
  // usuário — podem ser sobra de um período customizado anterior (outro status/sessão)
  // e precisam refletir os lotes atuais, não o que ficou setado antes.
  useEffect(() => {
    if (!range.ignorandoPeriodo || loading || lotes.length === 0) return;
    const datas = lotes.map((l) => l.dtaCriacao).filter((d): d is string => Boolean(d));
    if (datas.length === 0) return;
    const minData = datas.reduce((a, b) => (a < b ? a : b));
    setCustomIni(minData);
    setCustomFim(dayKey(new Date()));
  }, [range.ignorandoPeriodo, loading, lotes]);

  // Editar a data manualmente enquanto o período está sendo ignorado é a forma do
  // usuário restringir de fato: ativa o preset "custom" (que já vem pré-preenchido
  // pelo efeito acima) em vez de só mexer num campo que a consulta não está usando.
  const escolherCustomIni = (v: string) => {
    setCustomIni(v);
    setPreset('custom');
  };
  const escolherCustomFim = (v: string) => {
    setCustomFim(v);
    setPreset('custom');
  };

  // Trocar período/status/tamanho volta para a primeira página: a página 7 de um
  // filtro raramente existe no outro, e a consulta devolveria lista vazia.
  useEffect(() => {
    setPagina(1);
  }, [range.periodoIni, range.periodoFim, filtroStatus, tamanho, buscaDebounced, somenteProtocoloDuplicado]);

  // Requisições são carregadas sob demanda: um lote pode ter dezenas, cada uma com
  // vários procedimentos.
  const [expandido, setExpandido] = useState<number | null>(null);
  const [requisicoes, setRequisicoes] = useState<Record<number, RequisicaoLote[]>>({});
  const [carregandoDet, setCarregandoDet] = useState<number | null>(null);
  const [erroDet, setErroDet] = useState<Record<number, string>>({});

  const carregarDetalhe = useCallback(async (idLote: number, force = false) => {
    setCarregandoDet(idLote);
    setErroDet((e) => ({ ...e, [idLote]: '' }));
    try {
      const itens = await buscarRequisicoes(idLote, force);
      setRequisicoes((r) => ({ ...r, [idLote]: itens }));
    } catch (err) {
      setErroDet((e) => ({
        ...e,
        [idLote]: err instanceof Error ? err.message : 'Não foi possível carregar as requisições.',
      }));
    } finally {
      setCarregandoDet((atual) => (atual === idLote ? null : atual));
    }
  }, [buscarRequisicoes]);

  const alternarLote = useCallback((idLote: number) => {
    if (expandido === idLote) {
      setExpandido(null);
      return;
    }
    setExpandido(idLote);
    if (!requisicoes[idLote]) void carregarDetalhe(idLote);
  }, [expandido, requisicoes, carregarDetalhe]);

  // O "Atualizar" tem que descartar TUDO que está em tela: sem limpar este mapa, o
  // early-return de alternarLote continuaria servindo as requisições antigas mesmo
  // depois de a listagem ser relida, e o lote aberto nunca recarregaria sozinho.
  const atualizar = useCallback(async () => {
    const aberto = expandido;
    setRequisicoes({});
    setErroDet({});
    await refetch(true);
    if (aberto !== null) void carregarDetalhe(aberto, true);
  }, [expandido, refetch, carregarDetalhe]);

  const ativarCustom = () => {
    if (!customIni || !customFim) {
      // Não usa `range` aqui: com status Prejuízo (ou outro que ignore o período) ele
      // carrega o início do ano atual, que pré-preencheria os campos com esse
      // intervalo largo em vez do período do preset que estava ativo antes.
      const base = janelaDoPreset(preset === 'custom' ? 'mes' : preset, new Date());
      setCustomIni(base.periodoIni);
      setCustomFim(base.periodoFim);
    }
    setPreset('custom');
  };

  // Totais da PÁGINA — somar o período inteiro exigiria agregar milhares de lotes a
  // cada troca de filtro. Rotulado como tal na UI para não virar "total do mês".
  const totaisPagina = useMemo(() => ({
    valor: lotes.reduce((soma, l) => soma + l.valor, 0),
    requisicoes: lotes.reduce((soma, l) => soma + l.qtdRequisicoes, 0),
  }), [lotes]);

  const qtdPaginas = meta?.qtdPaginas ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Gestão de Faturamento
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lotes, requisições e procedimentos lidos do banco do laboratório
            {meta?.dadoAte && ` · dados até ${formatData(meta.dadoAte)}`}
          </p>
        </div>

        <button
          onClick={() => void atualizar()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
          Atualizar
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Resumo da consulta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {range.ignorandoPeriodo ? 'Lotes encontrados' : 'Lotes no período'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {meta?.registros ?? 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {formatData(range.periodoIni)} a {formatData(range.periodoFim)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor desta página</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(totaisPagina.valor)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Soma dos {lotes.length} lotes exibidos
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Requisições</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {totaisPagina.requisicoes}
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <ClipboardList className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            nos {lotes.length} lotes desta página
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {([['mes', 'Mês atual'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias']] as const).map(
              ([valor, rotulo]) => (
                <button
                  key={String(valor)}
                  onClick={() => setPreset(valor)}
                  disabled={presetsFixosDesabilitados}
                  title={
                    presetsFixosDesabilitados
                      ? `${motivoIgnorarPeriodo} ignora o período fixo — use "Personalizado" para restringir`
                      : undefined
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    presetsFixosDesabilitados
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : presetExibido === valor
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {rotulo}
                </button>
              ),
            )}
            <button
              onClick={ativarCustom}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                presetExibido === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Personalizado
            </button>
          </div>

          {presetExibido === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker value={customIni} onChange={escolherCustomIni} controlClass={CAMPO_FILTRO} />
              <span className="text-gray-500 text-sm">até</span>
              <DatePicker value={customFim} onChange={escolherCustomFim} controlClass={CAMPO_FILTRO} />
            </div>
          )}

          <Select
            value={String(filtroStatus)}
            onChange={(v) => setFiltroStatus(Number(v))}
            options={STATUS_FILTRO_OPCOES}
            controlClass={`${CAMPO_FILTRO} min-w-[180px]`}
          />

          <button
            onClick={() => setSomenteProtocoloDuplicado((v) => !v)}
            title="Lotes cujo protocolo de envio se repete em outro lote (exceto protocolo em formato de data)"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              somenteProtocoloDuplicado
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Protocolos duplicados
          </button>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por paciente, fonte, lote, guia..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {range.ignorandoPeriodo && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-gray-400 shrink-0" />
            Filtro de {motivoIgnorarPeriodo} tem data de referência diferente da criação do lote:
            mostrando o ano atual inteiro, ignorando o preset de período. Escolha um período
            personalizado para ver anos anteriores.
          </p>
        )}
      </div>

      {/* Lista de Lotes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lotes de Faturamento
          </h3>
        </div>

        {loading ? (
          <LoadingSpinner message="Consultando o banco do laboratório..." />
        ) : lotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum lote encontrado no período selecionado
            </p>
          </div>
        ) : (
          <>
            {/* Paginação — acima da tabela para ficar visível sem rolar a lista. */}
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Por página:</span>
                <Select
                  value={String(tamanho)}
                  onChange={(v) => setTamanho(Number(v))}
                  options={TAMANHOS_PAGINA_OPCOES}
                  controlClass="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Página {pagina} de {Math.max(qtdPaginas, 1)}
                </span>
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
                <button
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={pagina >= qtdPaginas || loading}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 w-8" />
                    <th className="px-3 py-3">Lote</th>
                    <th className="px-3 py-3">Fonte Pagadora</th>
                    <th className="px-3 py-3">Criação</th>
                    <th className="px-3 py-3">Fechamento</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Requisições</th>
                    <th className="px-3 py-3">NF / RPS</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lotes.map((lote) => {
                    const { exibidas: requisicoesExibidas, ocultasRecebidas } = requisicoesParaExibir(
                      lote,
                      requisicoes[lote.idLote] ?? [],
                    );
                    return (
                    <React.Fragment key={lote.idLote}>
                      <tr
                        onClick={() => alternarLote(lote.idLote)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 text-gray-400">
                          {expandido === lote.idLote
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />}
                        </td>
                        <td className="px-3 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {lote.idLote}
                          {lote.tituloId && (
                            <span
                              title={`Já está no título ${lote.tituloNumero ?? lote.tituloId}`}
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                            >
                              título {lote.tituloNumero ?? lote.tituloId}
                            </span>
                          )}
                          {lote.protocoloDuplicado && (
                            <span
                              title={`Protocolo duplicado em ${lote.protocoloDuplicadoContagem ?? 0} lotes`}
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 whitespace-nowrap"
                            >
                              protocolo duplicado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                          <span className="flex items-center gap-1">
                            <Building2 size={14} className="text-gray-400 shrink-0" />
                            <span title={lote.fontePagadora.razaoSocial ?? undefined}>
                              {lote.fontePagadora.nome ?? 'Não identificada'}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatData(lote.dtaCriacao)}
                        </td>
                        <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatData(lote.dtaFechamento)}
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge lote={lote} />
                        </td>
                        <td className="px-3 py-4 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                          {lote.qtdRequisicoes}
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {lote.nfeNumero
                            ? `${lote.nfeNumero}${lote.numeroRPS ? ` / ${lote.numeroRPS}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(lote.valor)}
                        </td>
                      </tr>

                      {expandido === lote.idLote && (
                        <tr className="bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={9} className="px-5 py-4">
                            {carregandoDet === lote.idLote ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <RefreshCw size={14} className="animate-spin" />
                                Carregando requisições...
                              </p>
                            ) : erroDet[lote.idLote] ? (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {erroDet[lote.idLote]}
                              </p>
                            ) : (requisicoes[lote.idLote]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhuma requisição cobrada neste lote.
                              </p>
                            ) : requisicoesExibidas.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhuma pendência neste lote — todas as requisições foram recebidas.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  {requisicoesExibidas.length} requisiç{requisicoesExibidas.length === 1 ? 'ão' : 'ões'}
                                  {lote.status === STATUS_RECEBIDO_PARCIAL
                                    ? ` pendente${requisicoesExibidas.length === 1 ? '' : 's'}`
                                    : ' neste lote'}
                                  {ocultasRecebidas > 0 &&
                                    ` · ${ocultasRecebidas} recebida${ocultasRecebidas === 1 ? '' : 's'} oculta${ocultasRecebidas === 1 ? '' : 's'}`}
                                </p>

                                {requisicoesExibidas.map((req) => (
                                  <div
                                    key={req.idRequisicao}
                                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                                  >
                                    {/* Cabeçalho da requisição */}
                                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                        {req.codRequisicao ?? `#${req.idRequisicao}`}
                                      </span>
                                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-[12rem]">
                                        {req.paciente ?? 'Paciente não identificado'}
                                      </span>
                                      {req.pendente && (
                                        <Tooltip label={req.eventoFaturLabel}>
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                            Pendente {formatCurrency(req.valorPendente)}
                                          </span>
                                        </Tooltip>
                                      )}
                                      {req.numGuiaConvenio && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          Guia {req.numGuiaConvenio}
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatData(req.dtaSolicitacao)}
                                      </span>
                                      <span className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                        {formatCurrency(req.valor)}
                                      </span>
                                    </div>

                                    {/* Procedimentos cobrados da requisição */}
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                      {req.procedimentos.map((proc, i) => (
                                        <div
                                          key={`${req.idRequisicao}-${proc.codigo ?? 'sem-codigo'}-${i}`}
                                          className="px-3 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                                        >
                                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0 w-20">
                                            {proc.codigo ?? '—'}
                                          </span>
                                          <span className="text-gray-700 dark:text-gray-300 flex-1 min-w-[12rem]">
                                            {proc.descricao ?? 'Procedimento sem descrição na tabela de preço'}
                                          </span>
                                          <span
                                            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                              proc.pendente
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                            }`}
                                          >
                                            {proc.pendente
                                              ? `Recebido ${formatCurrency(proc.valorRecebido)} · Pendente ${formatCurrency(proc.valorPendente)}`
                                              : 'Recebido'}
                                          </span>
                                          {proc.motivoGlosa && (
                                            <Tooltip label={proc.motivoGlosaDescricao}>
                                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 cursor-help">
                                                Glosa: {proc.motivoGlosa}
                                              </span>
                                            </Tooltip>
                                          )}
                                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                                            {proc.quantidade}x {formatCurrency(proc.valorUnitario)}
                                          </span>
                                          <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap tabular-nums w-24 text-right">
                                            {formatCurrency(proc.valor)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {(lote.protocolo || lote.nfeCodigoVerificacao || lote.dtaVencimento) && (
                              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4">
                                {lote.protocolo && (
                                  <span>Protocolo: <span className="font-mono">{lote.protocolo}</span></span>
                                )}
                                {lote.nfeCodigoVerificacao && (
                                  <span>
                                    Verificação da NF: <span className="font-mono">{lote.nfeCodigoVerificacao}</span>
                                  </span>
                                )}
                                {lote.dtaVencimento && <span>Vencimento: {formatData(lote.dtaVencimento)}</span>}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default FaturasDashboard;
