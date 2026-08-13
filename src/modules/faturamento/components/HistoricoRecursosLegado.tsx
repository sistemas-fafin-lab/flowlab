import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useRecursosLegado } from '../hooks/useRecursosLegado';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { ProcedimentoRecursoLegado } from '../types';
import ImagensRequisicaoLegadoModal from './ImagensRequisicaoLegadoModal';
import { formatCurrency, formatData } from '../utils/formato';

// Aba "Histórico (apLIS)" → sub-aba Recursos: lotes de recurso (fatloterecurso) já
// protocolados no legado, lidos ao vivo — sem persistência no Supabase, sem ação de
// escrita. Só 425 lotes no total (levantamento do design doc), então sem período
// obrigatório como a aba de glosas.
// Ver docs/plans/faturamento/glosas-recursos-legado-design.md.

// `status` é o código cru — sem tabela de label conhecida (risco documentado), por
// isso a UI não oferece filtro por ele: só o `statusLabel` derivado das datas, por
// linha.
const STATUS_CORES: Record<string, string> = {
  Criado: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Enviado: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Finalizado: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Cancelado: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const HistoricoRecursosLegado: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const tamanho = 50;

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagina(1);
  }, [buscaDebounced]);

  const { recursos, meta, loading, error, refetch, buscarProcedimentos } = useRecursosLegado({
    pagina,
    tamanho,
    busca: buscaDebounced || undefined,
  });

  const [expandido, setExpandido] = useState<number | null>(null);
  const [procedimentos, setProcedimentos] = useState<Record<number, ProcedimentoRecursoLegado[]>>({});
  const [carregandoDet, setCarregandoDet] = useState<number | null>(null);
  const [erroDet, setErroDet] = useState<Record<number, string>>({});
  const [imagensDe, setImagensDe] = useState<number | null>(null);

  const carregarDetalhe = useCallback(async (idLoteRecurso: number) => {
    setCarregandoDet(idLoteRecurso);
    setErroDet((e) => ({ ...e, [idLoteRecurso]: '' }));
    try {
      const itens = await buscarProcedimentos(idLoteRecurso);
      setProcedimentos((p) => ({ ...p, [idLoteRecurso]: itens }));
    } catch (err) {
      setErroDet((e) => ({
        ...e,
        [idLoteRecurso]: err instanceof Error ? err.message : 'Não foi possível carregar os procedimentos.',
      }));
    } finally {
      setCarregandoDet((atual) => (atual === idLoteRecurso ? null : atual));
    }
  }, [buscarProcedimentos]);

  const alternarLinha = useCallback((idLoteRecurso: number) => {
    if (expandido === idLoteRecurso) {
      setExpandido(null);
      return;
    }
    setExpandido(idLoteRecurso);
    if (!procedimentos[idLoteRecurso]) void carregarDetalhe(idLoteRecurso);
  }, [expandido, procedimentos, carregarDetalhe]);

  const qtdPaginas = meta?.qtdPaginas ?? 0;

  const paginacao = (
    <div className="flex items-center gap-2">
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
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por lote, protocolo, guia, fonte pagadora..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <button
            onClick={() => void refetch(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lotes de recurso ({meta?.registros ?? 0})
          </h3>
          <div className="flex items-center gap-3">
            {meta?.dadoAte && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                dados até {formatData(meta.dadoAte)}
              </span>
            )}
            {recursos.length > 0 && paginacao}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Consultando o banco do laboratório..." />
        ) : recursos.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum lote de recurso encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 w-8" />
                    <th className="px-3 py-3">Lote</th>
                    <th className="px-3 py-3">Protocolo</th>
                    <th className="px-3 py-3">Fonte Pagadora</th>
                    <th className="px-3 py-3">Criação</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Procedimentos</th>
                    <th className="px-5 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recursos.map((r) => (
                    <React.Fragment key={r.idLoteRecurso}>
                      <tr
                        onClick={() => alternarLinha(r.idLoteRecurso)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 text-gray-400">
                          {expandido === r.idLoteRecurso
                            ? <ChevronDown size={16} />
                            : <ChevronRight size={16} />}
                        </td>
                        <td className="px-3 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {r.idLoteRecurso}
                        </td>
                        <td className="px-3 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                          {r.protocolo ?? '—'}
                          {r.protocoloRecursado && (
                            <div className="text-gray-400 dark:text-gray-500">
                              Recursado: {r.protocoloRecursado}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                          {r.fontePagadora.nome ?? 'Não identificada'}
                        </td>
                        <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatData(r.dtaCriacao)}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                              STATUS_CORES[r.statusLabel] ?? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {r.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                          {r.qtdProcedimentos}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(r.valorTotal)}
                        </td>
                      </tr>

                      {expandido === r.idLoteRecurso && (
                        <tr className="bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={8} className="px-5 py-4">
                            {carregandoDet === r.idLoteRecurso ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <RefreshCw size={14} className="animate-spin" />
                                Carregando procedimentos...
                              </p>
                            ) : erroDet[r.idLoteRecurso] ? (
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {erroDet[r.idLoteRecurso]}
                              </p>
                            ) : (procedimentos[r.idLoteRecurso]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nenhum procedimento neste lote de recurso.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  {procedimentos[r.idLoteRecurso].length} procedimento
                                  {procedimentos[r.idLoteRecurso].length === 1 ? '' : 's'} neste lote
                                </p>
                                {procedimentos[r.idLoteRecurso].map((proc) => (
                                  <div
                                    key={proc.idProcedimento}
                                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                                        Requisição #{proc.idRequisicao}
                                        <button
                                          onClick={() => setImagensDe(proc.idRequisicao)}
                                          title="Ver imagens da requisição"
                                          className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                          <ImageIcon size={14} />
                                        </button>
                                      </span>
                                      {proc.numGuia && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          Guia {proc.numGuia}
                                        </span>
                                      )}
                                      {proc.motivoDescricao && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                          {proc.motivoDescricao}
                                        </span>
                                      )}
                                      <span className="ml-auto text-sm font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(proc.valorRecurso)}
                                      </span>
                                    </div>
                                    {proc.justificativa && (
                                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                                        {proc.justificativa}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              {paginacao}
            </div>
          </>
        )}
      </div>

      {imagensDe != null && (
        <ImagensRequisicaoLegadoModal idRequisicao={imagensDe} onClose={() => setImagensDe(null)} />
      )}
    </div>
  );
};

export default HistoricoRecursosLegado;
