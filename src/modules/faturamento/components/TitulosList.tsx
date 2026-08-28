import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Settings,
} from 'lucide-react';
import type {
  OperadoraResumo,
  TituloGuia,
  TituloReceber,
  TituloStatus,
  TitulosViewFiltros,
} from '../types';
import { formatCompetencia, formatCurrency, formatData, formatDataHora } from '../utils/formato';
import { dataEnvioEfetiva } from '../utils/envioAoVivo';
import { sanitizarFiltrosTitulos } from '../utils/viewsSalvas';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { ViewsSalvasMenu } from './ViewsSalvasMenu';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';

// Lista de títulos a receber, com linha expansível: título → lotes → guias.
// As guias só são buscadas quando o operador abre o lote — são dezenas por lote e
// só interessam na hora de conferir uma glosa.

const STATUS_ROTULOS: Record<TituloStatus, string> = {
  aberta: 'Aberta',
  parcialmente_recebida: 'Parcial',
  recebida: 'Recebida',
  liquidada: 'Liquidada',
  glosada: 'Glosada',
  cancelada: 'Cancelada',
};

// Agrupadas por significado financeiro, como o STATUS_CORES da aba Faturas:
// pendente (azul/amarelo), dinheiro entrou (verde), encerrado (cinza/vermelho).
const STATUS_OPCOES = [
  { value: '', label: 'Todos' },
  ...(Object.keys(STATUS_ROTULOS) as TituloStatus[]).map((status) => ({
    value: status,
    label: STATUS_ROTULOS[status],
  })),
];

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const STATUS_CORES: Record<TituloStatus, string> = {
  aberta: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  parcialmente_recebida: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  recebida: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  liquidada: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  glosada: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  cancelada: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
};

interface Props {
  titulos: TituloReceber[];
  operadoras: OperadoraResumo[];
  total: number;
  loading: boolean;
  error: string | null;
  podeEditar: boolean;
  filtros: {
    desde: string;
    ate: string;
    status: TituloStatus | '';
    operadoraId: string;
    busca: string;
    /** Issue 16: some da lista os títulos de operadoras marcadas como clínica parceira. */
    ocultarParceiras: boolean;
    pagina: number;
    tamanho: number;
  };
  onFiltrar: (patch: Partial<Props['filtros']>) => void;
  onAtualizar: () => void;
  onNovoTitulo: () => void;
  /** Issue 16: abre o modal de gerenciamento das clínicas parceiras. */
  onGerenciarParceiras: () => void;
  /** Issue 31: abre o modal de gerenciamento da regra "NF só após pagamento". */
  onGerenciarRegraNf: () => void;
  onBaixa: (titulo: TituloReceber) => void;
  onGlosa: (titulo: TituloReceber) => void;
  onCancelar: (titulo: TituloReceber) => void;
  buscarGuias: (loteId: string) => Promise<TituloGuia[]>;
  /** `DtaEnvio` ao vivo dos lotes (issue 15) — chave = aplisId. Ver utils/envioAoVivo.ts. */
  buscarEnvioLotes: (idsAplis: string[]) => Promise<Record<string, string | null>>;
}

/** Badge de atraso. Só aparece quando há vencimento e o título ainda tem saldo. */
const Atraso: React.FC<{ titulo: TituloReceber }> = ({ titulo }) => {
  if (titulo.diasAtraso === null || titulo.valorSaldo <= 0) return null;
  if (titulo.status === 'cancelada') return null;

  if (titulo.diasAtraso > 0) {
    return (
      <span className="text-xs text-rose-600 dark:text-rose-400 whitespace-nowrap">
        {titulo.diasAtraso}d em atraso
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-400 whitespace-nowrap">
      vence em {Math.abs(titulo.diasAtraso)}d
    </span>
  );
};

const TitulosList: React.FC<Props> = ({
  titulos,
  operadoras,
  total,
  loading,
  error,
  podeEditar,
  filtros,
  onFiltrar,
  onAtualizar,
  onNovoTitulo,
  onGerenciarParceiras,
  onGerenciarRegraNf,
  onBaixa,
  onGlosa,
  onCancelar,
  buscarGuias,
  buscarEnvioLotes,
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [guias, setGuias] = useState<Record<string, TituloGuia[]>>({});
  // Por lote, não um booleano só: abrir um segundo lote enquanto o primeiro
  // carrega não pode piscar "Carregando guias…" no lote errado.
  const [carregandoGuias, setCarregandoGuias] = useState<Record<string, boolean>>({});
  const [erroGuias, setErroGuias] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState(filtros.busca);
  // Por título: DtaEnvio ao vivo dos seus lotes, chave = aplisId (issue 15).
  // Ausente = ainda não revalidado ou a consulta falhou — dataEnvioEfetiva cai
  // pro snapshot nos dois casos, então não há necessidade de distinguir aqui.
  const [enviosPorTitulo, setEnviosPorTitulo] = useState<Record<string, Record<string, string | null>>>({});

  // Issue 31: pra mostrar a regra de NF na própria linha do título, sem
  // precisar abrir o lote — a operadora do título já é o dado, só falta o mapa.
  const nfAposPagamentoPorOperadora = useMemo(
    () => new Map(operadoras.map((o) => [o.id, o.nfAposPagamento])),
    [operadoras],
  );

  // Revalida o dataEnvio dos lotes do título assim que ele é expandido, direto
  // no apLIS — o snapshot gravado na criação do título fica preso pra sempre
  // quando o envio só aconteceu DEPOIS de o título existir (issue 15).
  useEffect(() => {
    if (!expandido) return;
    const titulo = titulos.find((t) => t.id === expandido);
    if (!titulo) return;
    const idsAplis = [...new Set(
      titulo.lotes.map((lote) => lote.aplisId).filter((id): id is string => Boolean(id)),
    )];
    if (idsAplis.length === 0) return;

    let cancelado = false;
    void buscarEnvioLotes(idsAplis)
      .then((mapa) => {
        if (!cancelado) setEnviosPorTitulo((atual) => ({ ...atual, [expandido]: mapa }));
      })
      .catch(() => {
        // Túnel fora do ar, lote não encontrado etc.: a tela cai pro snapshot
        // via dataEnvioEfetiva (sem entrada em enviosPorTitulo), sem quebrar.
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido]);

  // Debounce: cada tecla dispararia uma consulta paginada ao Supabase.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca.trim() !== filtros.busca) onFiltrar({ busca: busca.trim(), pagina: 1 });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const abrirLote = async (loteId: string) => {
    if (loteAberto === loteId) {
      setLoteAberto(null);
      return;
    }
    setLoteAberto(loteId);
    if (guias[loteId]) return;

    setCarregandoGuias((atual) => ({ ...atual, [loteId]: true }));
    setErroGuias((atual) => ({ ...atual, [loteId]: '' }));
    try {
      const lista = await buscarGuias(loteId);
      setGuias((atual) => ({ ...atual, [loteId]: lista }));
    } catch (err) {
      // Sem isto, uma falha de rede/RLS virava rejeição não tratada e o `else if`
      // de baixo mostrava "nenhuma guia congelada" — a conclusão errada na hora
      // de conferir uma glosa.
      setErroGuias((atual) => ({
        ...atual,
        [loteId]: err instanceof Error ? err.message : 'Não foi possível carregar as guias.',
      }));
    } finally {
      setCarregandoGuias((atual) => ({ ...atual, [loteId]: false }));
    }
  };

  const qtdPaginas = useMemo(
    () => (filtros.tamanho > 0 ? Math.max(1, Math.ceil(total / filtros.tamanho)) : 1),
    [total, filtros.tamanho],
  );

  // Paginação não é um recorte a salvar numa view — só o que define QUAIS
  // títulos aparecem, não EM QUE PÁGINA. Aplicar uma view sempre volta pra 1.
  //
  // `busca` (estado local) e não `filtros.busca`: o segundo só chega depois do
  // debounce, então salvar uma view logo após digitar guardaria o texto de
  // busca anterior.
  const filtrosSalvaveis = useMemo<TitulosViewFiltros>(
    () => ({
      desde: filtros.desde,
      ate: filtros.ate,
      status: filtros.status,
      operadoraId: filtros.operadoraId,
      busca,
      ocultarParceiras: filtros.ocultarParceiras,
    }),
    [filtros.desde, filtros.ate, filtros.status, filtros.operadoraId, busca, filtros.ocultarParceiras],
  );

  // A garantia de formato mora no sanitizador (utils/viewsSalvas.ts): a view
  // chega completa, com `busca` sempre string — sem os fallbacks campo a campo
  // que uma view em formato antigo exigia aqui.
  const aplicarView = (view: TitulosViewFiltros) => {
    setBusca(view.busca);
    onFiltrar({ ...view, pagina: 1 });
  };

  return (
    <div className="space-y-4">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Emissão de
          <DatePicker
            value={filtros.desde}
            onChange={(v) => onFiltrar({ desde: v, pagina: 1 })}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          até
          <DatePicker
            value={filtros.ate}
            onChange={(v) => onFiltrar({ ate: v, pagina: 1 })}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Status
          <Select
            value={filtros.status}
            onChange={(v) => onFiltrar({ status: v as TituloStatus | '', pagina: 1 })}
            options={STATUS_OPCOES}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Operadora
          <Select
            value={filtros.operadoraId}
            onChange={(v) => onFiltrar({ operadoraId: v, pagina: 1 })}
            options={[
              { value: '', label: 'Todas' },
              ...operadoras.map((operadora) => ({ value: operadora.id, label: operadora.nome })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[220px]"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pb-2">
          <input
            type="checkbox"
            checked={filtros.ocultarParceiras}
            onChange={(e) => onFiltrar({ ocultarParceiras: e.target.checked, pagina: 1 })}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Ocultar clínicas parceiras
        </label>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nota, operadora, competência, observações…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
          />
        </div>
        <ViewsSalvasMenu
          tela="titulos"
          filtros={filtrosSalvaveis}
          sanitizar={(cru) => sanitizarFiltrosTitulos(cru, filtrosSalvaveis)}
          onAplicar={aplicarView}
        />
        <button
          type="button"
          onClick={onAtualizar}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
        {podeEditar && (
          <button
            type="button"
            onClick={onGerenciarParceiras}
            title="Gerenciar clínicas parceiras"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> Clínicas parceiras
          </button>
        )}
        {podeEditar && (
          <button
            type="button"
            onClick={onGerenciarRegraNf}
            title="Gerenciar regra de NF por operadora"
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> Regra de NF
          </button>
        )}
        {podeEditar && (
          <button
            type="button"
            onClick={onNovoTitulo}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo título
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : titulos.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum título de {formatData(filtros.desde)} até {formatData(filtros.ate)}
          {filtros.status && ` com status "${STATUS_ROTULOS[filtros.status]}"`}.
          {' '}Amplie o período de emissão acima — trocar o Status não muda a
          lista se o período já não cobrir nenhum título.
          {podeEditar && ' Use "Novo título" para agrupar lotes do apLIS numa cobrança.'}
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2">Operadora</th>
                  <th className="px-3 py-2">Competência</th>
                  <th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">Glosado</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2">Status</th>
                  {podeEditar && <th className="px-3 py-2 w-32" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {titulos.map((titulo) => {
                  const aberto = expandido === titulo.id;
                  const encerrado = titulo.status === 'cancelada' || titulo.valorSaldo <= 0;
                  return (
                    <React.Fragment key={titulo.id}>
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                        onClick={() => setExpandido(aberto ? null : titulo.id)}
                      >
                        <td className="px-3 py-2 text-gray-400">
                          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                          {titulo.numeroNota}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[200px]">
                          {titulo.operadoraNome ?? '—'}
                          {nfAposPagamentoPorOperadora.get(titulo.operadoraId) && (
                            <span
                              title="Esta operadora só permite emitir a NF depois do pagamento"
                              className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            >
                              NF após pagamento
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">
                          {formatCompetencia(titulo.competencia)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                          <div>{formatData(titulo.dataVencimento)}</div>
                          <Atraso titulo={titulo} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">
                          {formatCurrency(titulo.valorTotal)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(titulo.valorRecebido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {formatCurrency(titulo.valorGlosado)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(titulo.valorSaldo)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CORES[titulo.status]}`}>
                            {STATUS_ROTULOS[titulo.status]}
                          </span>
                          {/* Mesmos poucos títulos revisitados em dias diferentes mudam de
                              status (Aberta → Parcial → Recebida) conforme as baixas chegam —
                              sem isto, a mudança parece uma NF "semelhante" duplicada. */}
                          <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            atualizado em {formatDataHora(titulo.statusAtualizadoEm)}
                          </div>
                        </td>
                        {podeEditar && (
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onBaixa(titulo)}
                                disabled={titulo.status === 'cancelada'}
                                title="Registrar baixa"
                                className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onGlosa(titulo)}
                                disabled={titulo.status === 'cancelada'}
                                title="Lançar glosa"
                                className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Scissors className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelar(titulo)}
                                disabled={encerrado}
                                title="Cancelar título"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {aberto && (
                        <tr className="bg-gray-50/70 dark:bg-gray-700/20">
                          <td colSpan={podeEditar ? 11 : 10} className="px-6 py-3">
                            {titulo.observacoes && (
                              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                                {titulo.observacoes}
                              </p>
                            )}
                            <div className="space-y-1">
                              {titulo.lotes.length === 0 ? (
                                <p className="text-xs text-gray-400">Título sem lotes vinculados.</p>
                              ) : (
                                titulo.lotes.map((lote) => (
                                  <div key={lote.id} className="rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                                    <button
                                      type="button"
                                      onClick={() => void abrirLote(lote.id)}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-xs"
                                    >
                                      {loteAberto === lote.id
                                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                      <span className="font-medium text-gray-800 dark:text-gray-100">
                                        Lote {lote.codigoLote}
                                      </span>
                                      {lote.statusLabel && (
                                        <span className="text-gray-400">{lote.statusLabel}</span>
                                      )}
                                      <span className="text-gray-400">
                                        envio {formatData(dataEnvioEfetiva(lote, enviosPorTitulo[titulo.id] ?? null))}
                                      </span>
                                      <span className="ml-auto text-gray-500 dark:text-gray-400 tabular-nums">
                                        {lote.qtdRequisicoes} guias · {formatCurrency(lote.valorTotal)}
                                      </span>
                                    </button>

                                    {loteAberto === lote.id && (
                                      <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
                                        {carregandoGuias[lote.id] && !guias[lote.id] ? (
                                          <p className="text-xs text-gray-400">Carregando guias…</p>
                                        ) : erroGuias[lote.id] ? (
                                          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {erroGuias[lote.id]}
                                          </p>
                                        ) : (guias[lote.id]?.length ?? 0) === 0 ? (
                                          <p className="text-xs text-gray-400">
                                            Nenhuma guia congelada para este lote.
                                          </p>
                                        ) : (
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="text-left text-gray-400">
                                                <th className="py-1">Guia</th>
                                                <th className="py-1">Requisição</th>
                                                <th className="py-1">Paciente</th>
                                                <th className="py-1">Procedimento</th>
                                                <th className="py-1">Execução</th>
                                                <th className="py-1 text-right">Valor</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {guias[lote.id]?.map((guia) => (
                                                <tr key={guia.id} className="text-gray-600 dark:text-gray-300">
                                                  <td className="py-1">{guia.numeroGuia}</td>
                                                  <td className="py-1">
                                                    {guia.codigoRequisicao ?? (
                                                      <span className="text-gray-400 italic">indisponível</span>
                                                    )}
                                                  </td>
                                                  <td className="py-1 truncate max-w-[180px]">{guia.pacienteNome ?? '—'}</td>
                                                  <td className="py-1 truncate max-w-[220px]">{guia.procedimentoDescricao ?? '—'}</td>
                                                  <td className="py-1 tabular-nums">{formatData(guia.dataExecucao)}</td>
                                                  <td className="py-1 text-right tabular-nums">{formatCurrency(guia.valor)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Paginação ────────────────────────────────────────────────────── */}
      {total > filtros.tamanho && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{total} título{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filtros.pagina <= 1}
              onClick={() => onFiltrar({ pagina: filtros.pagina - 1 })}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="tabular-nums">{filtros.pagina} / {qtdPaginas}</span>
            <button
              type="button"
              disabled={filtros.pagina >= qtdPaginas}
              onClick={() => onFiltrar({ pagina: filtros.pagina + 1 })}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TitulosList;
