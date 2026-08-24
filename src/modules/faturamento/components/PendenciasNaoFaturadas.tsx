import React, { useCallback, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import type { OperadoraResumo, RequisicaoPendencia } from '../types';
import { usePendenciasNaoFaturadas } from '../hooks/usePendenciasNaoFaturadas';
import { formatCurrency, formatData } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';

// Aba Contas a Receber → Pendências: lotes do apLIS sem NF/RPS vinculado, fora da
// janela normal de fechamento (2 meses mais recentes). Regra completa e o achado
// sobre "Recebidos sem RPS" em api/_lib/faturamento/bdLab.ts (listarLotesPendentes)
// e docs/plans/faturamento/pendencias-nao-faturadas-design.md.
//
// Mesmo padrão de expansão de FaturasDashboard (lote → requisições sob demanda),
// mas com filtros/paginação no estilo compacto de TitulosList, por viver dentro do
// mesmo container da aba Contas a Receber.

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const TAMANHO_PADRAO = 50;

interface Props {
  operadoras: OperadoraResumo[];
}

const PendenciasNaoFaturadas: React.FC<Props> = ({ operadoras }) => {
  const [desde, setDesde] = useState('');
  const [ate, setAte] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [pagina, setPagina] = useState(1);

  const { lotes, meta, loading, error, refetch, buscarRequisicoes } = usePendenciasNaoFaturadas({
    desde: desde || undefined,
    ate: ate || undefined,
    operadoraId: operadoraId ? Number(operadoraId) : undefined,
    pagina,
    tamanho: TAMANHO_PADRAO,
  });

  const mudarFiltro = useCallback((aplicar: () => void) => {
    aplicar();
    setPagina(1);
  }, []);

  const [expandido, setExpandido] = useState<number | null>(null);
  const [requisicoes, setRequisicoes] = useState<Record<number, RequisicaoPendencia[]>>({});
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

  const atualizar = useCallback(async () => {
    const aberto = expandido;
    setRequisicoes({});
    setErroDet({});
    await refetch(true);
    if (aberto !== null) void carregarDetalhe(aberto, true);
  }, [expandido, refetch, carregarDetalhe]);

  const qtdPaginas = meta?.qtdPaginas ?? 1;
  const registros = meta?.registros ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Criado de
          <DatePicker
            value={desde}
            onChange={(v) => mudarFiltro(() => setDesde(v))}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          até
          <DatePicker
            value={ate}
            onChange={(v) => mudarFiltro(() => setAte(v))}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Fonte pagadora
          <Select
            value={operadoraId}
            onChange={(v) => mudarFiltro(() => setOperadoraId(v))}
            options={[
              { value: '', label: 'Todas' },
              ...operadoras
                .filter((o): o is OperadoraResumo & { aplisId: string } => o.aplisId !== null)
                .map((o) => ({ value: o.aplisId, label: o.nome })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[220px]"
          />
        </label>
        <button
          type="button"
          onClick={() => void atualizar()}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {meta?.cutoff && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Mostrando lotes sem nota fiscal/RPS criados até {formatData(meta.cutoff)} — o mês mais
          recente ainda está no fluxo normal de fechamento e não entra aqui.
        </p>
      )}

      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : lotes.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhuma pendência encontrada.
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Fonte pagadora</th>
                  <th className="px-3 py-2">Criação</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Requisições</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lotes.map((lote) => {
                  const aberto = expandido === lote.idLote;
                  return (
                    <React.Fragment key={lote.idLote}>
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                        onClick={() => alternarLote(lote.idLote)}
                      >
                        <td className="px-3 py-2 text-gray-400">
                          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {lote.idLote}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                          <span title={lote.fontePagadora.razaoSocial ?? undefined}>
                            {lote.fontePagadora.nome ?? 'Não identificada'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                          {formatData(lote.dtaCriacao)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            {lote.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {lote.qtdRequisicoes}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(lote.valor)}
                        </td>
                      </tr>

                      {aberto && (
                        <tr className="bg-gray-50/70 dark:bg-gray-700/20">
                          <td colSpan={7} className="px-6 py-3">
                            {carregandoDet === lote.idLote ? (
                              <p className="text-xs text-gray-400 flex items-center gap-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Carregando requisições...
                              </p>
                            ) : erroDet[lote.idLote] ? (
                              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {erroDet[lote.idLote]}
                              </p>
                            ) : (requisicoes[lote.idLote]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-gray-400">
                                Nenhuma requisição cobrada neste lote.
                              </p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-gray-400">
                                    <th className="py-1">Requisição</th>
                                    <th className="py-1">Paciente</th>
                                    <th className="py-1">Guia</th>
                                    <th className="py-1">Solicitação</th>
                                    <th className="py-1">NF / RPS</th>
                                    <th className="py-1 text-right">Valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {requisicoes[lote.idLote]?.map((req) => (
                                    <tr key={req.idRequisicao} className="text-gray-600 dark:text-gray-300">
                                      <td className="py-1 font-mono">{req.codRequisicao ?? `#${req.idRequisicao}`}</td>
                                      <td className="py-1 truncate max-w-[200px]">{req.paciente ?? '—'}</td>
                                      <td className="py-1">{req.numGuiaConvenio ?? '—'}</td>
                                      <td className="py-1 tabular-nums">{formatData(req.dtaSolicitacao)}</td>
                                      <td className="py-1">
                                        {req.nfeNumero
                                          ? (
                                            <span
                                              title="Requisição já tem NF/RPS individual, mesmo o lote não tendo — confira antes de cobrar de novo."
                                              className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                            >
                                              {req.nfeNumero}{req.numeroRPS ? ` / ${req.numeroRPS}` : ''}
                                            </span>
                                          )
                                          : '—'}
                                      </td>
                                      <td className="py-1 text-right tabular-nums">{formatCurrency(req.valor)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
        </div>
      )}

      {/* ── Paginação ────────────────────────────────────────────────────── */}
      {registros > TAMANHO_PADRAO && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{registros} lote{registros === 1 ? '' : 's'} pendente{registros === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="tabular-nums">{pagina} / {qtdPaginas}</span>
            <button
              type="button"
              disabled={pagina >= qtdPaginas}
              onClick={() => setPagina((p) => p + 1)}
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

export default PendenciasNaoFaturadas;
