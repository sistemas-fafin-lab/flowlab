import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useGlosasLegado } from '../hooks/useGlosasLegado';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import DatePicker from '../../../components/DatePicker';
import ImagensRequisicaoLegadoModal from './ImagensRequisicaoLegadoModal';
import { formatCurrency, formatData } from '../utils/formato';
import { janelaDoPreset, PeriodoPreset } from '../utils/periodo';

// Aba "Histórico (apLIS)" → sub-aba Glosas: leitura ao vivo do MySQL de backup do
// laboratório (fatrequisicaoprocedimento.IdMotivoGlosa), sem persistência no
// Supabase e sem ação de escrita — só consulta/histórico nesta entrega.
// Ver docs/plans/faturamento/glosas-recursos-legado-design.md.

const CAMPO_FILTRO =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

const HistoricoGlosasLegado: React.FC = () => {
  const [preset, setPreset] = useState<PeriodoPreset>('mes');
  const [customIni, setCustomIni] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const [imagensDe, setImagensDe] = useState<number | null>(null);
  const tamanho = 50;

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  const range = useMemo(
    () => janelaDoPreset(preset, new Date(), { ini: customIni, fim: customFim }),
    [preset, customIni, customFim],
  );

  const { glosas, meta, loading, error, refetch } = useGlosasLegado({
    periodoIni: range.periodoIni,
    periodoFim: range.periodoFim,
    pagina,
    tamanho,
    busca: buscaDebounced || undefined,
  });

  useEffect(() => {
    setPagina(1);
  }, [range.periodoIni, range.periodoFim, buscaDebounced]);

  const ativarCustom = () => {
    if (!customIni || !customFim) {
      setCustomIni(range.periodoIni);
      setCustomFim(range.periodoFim);
    }
    setPreset('custom');
  };

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
          <div className="flex flex-wrap gap-1">
            {([['mes', 'Mês atual'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias']] as const).map(
              ([valor, rotulo]) => (
                <button
                  key={String(valor)}
                  onClick={() => setPreset(valor)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    preset === valor
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
                preset === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Personalizado
            </button>
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker value={customIni} onChange={setCustomIni} controlClass={CAMPO_FILTRO} />
              <span className="text-gray-500 text-sm">até</span>
              <DatePicker value={customFim} onChange={setCustomFim} controlClass={CAMPO_FILTRO} />
            </div>
          )}

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por paciente, requisição, guia, procedimento, motivo, fonte pagadora..."
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
            Glosas do legado ({meta?.registros ?? 0})
          </h3>
          <div className="flex items-center gap-3">
            {meta?.dadoAte && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                dados até {formatData(meta.dadoAte)}
              </span>
            )}
            {glosas.length > 0 && paginacao}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Consultando o banco do laboratório..." />
        ) : glosas.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma glosa encontrada no período selecionado
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Requisição</th>
                    <th className="px-3 py-3">Paciente</th>
                    <th className="px-3 py-3">Fonte Pagadora</th>
                    <th className="px-3 py-3">Data</th>
                    <th className="px-3 py-3">Procedimento</th>
                    <th className="px-3 py-3">Motivo</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {glosas.map((g) => (
                    <tr
                      key={g.idRequisicaoProcedimento}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {g.codRequisicao ?? `#${g.idRequisicao}`}
                          <button
                            onClick={() => setImagensDe(g.idRequisicao)}
                            title="Ver imagens da requisição"
                            className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <ImageIcon size={14} />
                          </button>
                        </div>
                        {g.numGuiaConvenio && (
                          <div className="text-gray-400 dark:text-gray-500">Guia {g.numGuiaConvenio}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {g.paciente ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        {g.fontePagadora.nome ?? 'Não identificada'}
                      </td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatData(g.dtaSolicitacao)}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {g.procedimentoCodigo ?? '—'}
                        </span>{' '}
                        {g.procedimentoDescricao ?? 'Sem descrição'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300 max-w-xs">
                        <div>{g.desMotivoGlosa ?? '—'}</div>
                        {g.motivoDescricao && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            {g.motivoCodigo != null ? `${g.motivoCodigo} · ` : ''}
                            {g.motivoDescricao}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(g.valor)}
                      </td>
                    </tr>
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

export default HistoricoGlosasLegado;
