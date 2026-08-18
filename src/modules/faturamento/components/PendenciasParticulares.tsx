import React, { useCallback, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { usePendenciasParticulares } from '../hooks/usePendenciasParticulares';
import { formatCurrency, formatData } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import DatePicker from '../../../components/DatePicker';

// Aba Contas a Receber → Pendências → Particulares: requisições da fonte
// pagadora PARTICULAR (IdFontePagadora 1102) com laudo já liberado ao cliente e
// sem NF emitida. Regra completa em api/_lib/faturamento/bdLab.ts
// (listarParticularesPendentes).
//
// Diferente de PendenciasNaoFaturadas (lote → requisições expansível), aqui a
// requisição já é a unidade da lista: a maioria dos particulares nunca entra
// num lote do apLIS (pagamento é direto no balcão), então não há o que expandir.

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const TAMANHO_PADRAO = 50;

const PendenciasParticulares: React.FC = () => {
  const [desde, setDesde] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(1);

  const { requisicoes, meta, loading, error, refetch } = usePendenciasParticulares({
    desde: desde || undefined,
    ate: ate || undefined,
    pagina,
    tamanho: TAMANHO_PADRAO,
  });

  const mudarFiltro = useCallback((aplicar: () => void) => {
    aplicar();
    setPagina(1);
  }, []);

  const qtdPaginas = meta?.qtdPaginas ?? 1;
  const registros = meta?.registros ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Solicitação de
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
        <button
          type="button"
          onClick={() => void refetch(true)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Requisições particulares com laudo já liberado ao cliente e sem nota fiscal/RPS
        emitida — inclui as que nunca chegaram a entrar num lote do apLIS.
      </p>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : requisicoes.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhuma pendência encontrada.
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Requisição</th>
                  <th className="px-3 py-2">Paciente</th>
                  <th className="px-3 py-2">Solicitação</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {requisicoes.map((req) => (
                  <tr key={req.idRequisicao} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap font-mono">
                      {req.codRequisicao ?? `#${req.idRequisicao}`}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                      {req.paciente ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {formatData(req.dtaSolicitacao)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        {req.eventoLabel ?? `Evento ${req.codEvento}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {req.idLote ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(req.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Paginação ────────────────────────────────────────────────────── */}
      {registros > TAMANHO_PADRAO && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{registros} requisiç{registros === 1 ? 'ão' : 'ões'} pendente{registros === 1 ? '' : 's'}</span>
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

export default PendenciasParticulares;
