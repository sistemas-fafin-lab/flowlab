import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import type { OperadoraResumo } from '../types';
import { STATUS_PENDENCIA, STLOT_LABELS } from '../types';
import { usePendenciasNaoFaturadas } from '../hooks/usePendenciasNaoFaturadas';
import { useStatusFaturamento } from '../hooks/useStatusFaturamento';
import StatusFaturamentoChips from './StatusFaturamentoChips';
import { formatCurrency, formatData } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import { TarefasRequisicaoModal, type RequisicaoDasTarefas } from './TarefasRequisicao';
import LotePendentePainelLateral from './LotePendentePainelLateral';

// Aba Contas a Receber → Pendências: lotes do apLIS sem NF/RPS vinculado, fora da
// janela normal de fechamento (2 meses mais recentes). Regra completa e o achado
// sobre "Recebidos sem RPS" em api/_lib/faturamento/bdLab.ts (listarLotesPendentes)
// e docs/plans/faturamento/pendencias-nao-faturadas-design.md.
//
// As requisições de cada lote abrem num painel lateral (LotePendentePainelLateral),
// mesmo padrão dos títulos; filtros/paginação no estilo compacto de TitulosList,
// por viver dentro do mesmo container da aba Contas a Receber.

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const TAMANHO_PADRAO = 50;

interface Props {
  operadoras: OperadoraResumo[];
}

const PendenciasNaoFaturadas: React.FC<Props> = ({ operadoras }) => {
  const [desde, setDesde] = useState('');
  const [ate, setAte] = useState('');
  const [operadoraId, setOperadoraId] = useState('');
  const [status, setStatus] = useState('');
  const [codEventoFatur, setCodEventoFatur] = useState('');
  const [pagina, setPagina] = useState(1);
  const { ativos: statusFaturamento } = useStatusFaturamento();

  const { lotes, meta, loading, error, refetch, buscarRequisicoes } = usePendenciasNaoFaturadas({
    desde: desde || undefined,
    ate: ate || undefined,
    operadoraId: operadoraId ? Number(operadoraId) : undefined,
    status: status ? Number(status) : undefined,
    codEventoFatur: codEventoFatur ? Number(codEventoFatur) : undefined,
    pagina,
    tamanho: TAMANHO_PADRAO,
  });

  const mudarFiltro = useCallback((aplicar: () => void) => {
    aplicar();
    setPagina(1);
  }, []);

  const [idAberto, setIdAberto] = useState<number | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [tarefasDe, setTarefasDe] = useState<RequisicaoDasTarefas | null>(null);
  const fecharTarefas = useCallback(() => setTarefasDe(null), []);
  const fecharPainel = useCallback(() => setIdAberto(null), []);

  const loteAberto = idAberto !== null ? lotes.find((l) => l.idLote === idAberto) ?? null : null;

  // Painel fecha quando o recorte muda (filtro, página)...
  useEffect(() => {
    setIdAberto(null);
  }, [desde, ate, operadoraId, status, codEventoFatur, pagina]);

  // ...ou quando o lote sai da lista depois de um refetch.
  useEffect(() => {
    if (idAberto !== null && !loading && !lotes.some((l) => l.idLote === idAberto)) setIdAberto(null);
  }, [idAberto, loading, lotes]);

  const atualizar = useCallback(async () => {
    await refetch(true);
    setRecarga((n) => n + 1);
  }, [refetch]);

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
                .filter((o) => o.consideradaMeta)
                .map((o) => ({ value: o.aplisId, label: o.nome })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[220px]"
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Status
          <Select
            value={status}
            onChange={(v) => mudarFiltro(() => setStatus(v))}
            options={[
              { value: '', label: 'Todos' },
              ...STATUS_PENDENCIA.map((codigo) => ({
                value: String(codigo),
                label: STLOT_LABELS[codigo] ?? `Status ${codigo}`,
              })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[180px]"
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Status faturamento
          <Select
            value={codEventoFatur}
            onChange={(v) => mudarFiltro(() => setCodEventoFatur(v))}
            options={[
              { value: '', label: 'Todos' },
              ...statusFaturamento.map((s) => ({ value: String(s.codigo), label: s.label })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[260px]"
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
                  {/* Issue: status do LOTE (fatlote.Status/STLOT) acima é bem mais
                      raso que o "Status Faturamento" (autStatusFat/eventofatur) que o
                      apLIS mostra por REQUISIÇÃO — um lote pendente comumente mistura
                      vários. Resumo em badges aqui; o valor de cada guia sai na tabela
                      de requisições ao expandir a linha. */}
                  <th className="px-3 py-2">Status faturamento</th>
                  <th className="px-3 py-2 text-right">Requisições</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lotes.map((lote) => {
                  const aberto = idAberto === lote.idLote;
                  return (
                      <tr
                        key={lote.idLote}
                        className={`transition-colors ${
                          aberto ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="pl-3 pr-0 py-2">
                          <button
                            type="button"
                            onClick={() => setIdAberto(aberto ? null : lote.idLote)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`Ver requisições do lote ${lote.idLote}`}
                            title="Ver requisições do lote"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                        <td className="px-3 py-2">
                          <StatusFaturamentoChips resumo={lote.statusFaturamento} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {lote.qtdRequisicoes}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(lote.valor)}
                        </td>
                      </tr>
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

      {loteAberto && (
        <LotePendentePainelLateral
          key={loteAberto.idLote}
          lote={loteAberto}
          recarga={recarga}
          camadaSobreposta={tarefasDe !== null}
          onFechar={fecharPainel}
          onAbrirTarefas={setTarefasDe}
          buscarRequisicoes={buscarRequisicoes}
        />
      )}

      <TarefasRequisicaoModal requisicao={tarefasDe} onFechar={fecharTarefas} />
    </div>
  );
};

export default PendenciasNaoFaturadas;
