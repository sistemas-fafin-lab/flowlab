import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { useLotesRecurso } from '../hooks/useGlosasRecursos';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import type { RecorteGlosas, SeloAtrasoLote, StatusLoteRecurso } from '../types';
import { formatCurrency, formatData, formatDataHora } from '../utils/formato';

// Acompanhamento dos recursos → "Lotes de recurso": os lotes de recurso da foto
// do apLIS no recorte do cabeçalho (mês do lote de faturamento original +
// convênio), com retorno e pagamento previstos e o selo de atraso calculados
// no servidor pelas regras de prazo do convênio. O card de detalhes vem nas
// próximas issues de .scratch/glosas-recursos-dashboard/.

const TAMANHO = 50;

const STATUS_CORES: Record<StatusLoteRecurso, string> = {
  Criado: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Enviado: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Finalizado: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Cancelado: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const SELOS: Record<Exclude<SeloAtrasoLote, 'sem-regra'>, { label: string; cor: string }> = {
  'no-prazo': { label: 'No prazo', cor: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  'vence-hoje': { label: 'Vence hoje', cor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  atrasado: { label: 'Atrasado', cor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

const STATUS_OPCOES = [
  { value: '', label: 'Todos os status' },
  ...(Object.keys(STATUS_CORES) as StatusLoteRecurso[]).map((s) => ({ value: s, label: s })),
];

const CAMPO = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

interface Props {
  recorte: RecorteGlosas;
  /** Muda a cada sincronização concluída: recarrega a lista. */
  versao: number;
}

const LotesRecursoLista: React.FC<Props> = ({ recorte, versao }) => {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [status, setStatus] = useState<StatusLoteRecurso | ''>('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagina(1);
  }, [buscaDebounced, status, recorte.competencia, recorte.fontePagadoraId]);

  const { lotes, meta, loading, error, refetch } = useLotesRecurso({
    ...recorte,
    status: status || undefined,
    busca: buscaDebounced || undefined,
    pagina,
    tamanho: TAMANHO,
  });

  const versaoVista = useRef(versao);
  useEffect(() => {
    if (versaoVista.current === versao) return;
    versaoVista.current = versao;
    void refetch();
  }, [versao, refetch]);

  const qtdPaginas = meta?.qtdPaginas ?? 0;
  const ultima = meta?.ultimaSincronizacao ?? null;

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por lote, guia, paciente, convênio ou protocolo..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <Select
          value={status}
          onChange={(v) => setStatus(v as StatusLoteRecurso | '')}
          options={STATUS_OPCOES}
          controlClass={CAMPO}
          wrapperClass="w-48"
          ariaLabel="Status do lote"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Lotes de recurso ({meta?.registros ?? 0})
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {ultima
                ? <>Sincronizado em {formatDataHora(ultima.sincronizadoEm)}
                    {ultima.dadoAte && <> · apLIS até {formatData(ultima.dadoAte)}</>}</>
                : 'Período ainda não sincronizado — use "Atualizar"'}
            </span>
            {lotes.length > 0 && paginacao}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Carregando lotes de recurso..." />
        ) : lotes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum lote de recurso neste recorte</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Lote de recurso</th>
                    <th className="px-3 py-3">Protocolo de faturamento</th>
                    <th className="px-3 py-3">Convênio</th>
                    <th className="px-3 py-3 text-right">Valor glosado</th>
                    <th className="px-3 py-3 text-right">Valor recorrido</th>
                    <th className="px-3 py-3">Envio</th>
                    <th className="px-3 py-3">Retorno previsto</th>
                    <th className="px-3 py-3">Pagamento previsto</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3">Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {lotes.map((l) => (
                    <tr key={l.idLoteRecurso} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900 dark:text-white">{l.idLoteRecurso}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {l.qtdRequisicoes} {l.qtdRequisicoes === 1 ? 'requisição' : 'requisições'}
                          {l.protocolo && <> · protocolo {l.protocolo}</>}
                        </div>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {l.protocoloFaturamento ?? '—'}
                      </td>
                      <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                        {l.fontePagadora.nome ?? 'Não identificado'}
                      </td>
                      <td className="px-3 py-4 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(l.valorGlosado)}
                      </td>
                      <td className="px-3 py-4 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatCurrency(l.valorRecorrido)}
                      </td>
                      <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatData(l.dataEnvio)}
                      </td>
                      <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatData(l.dataRetornoPrevista)}
                      </td>
                      <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatData(l.dataPagamentoPrevista)}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CORES[l.statusLabel]}`}>
                          {l.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {l.selo === 'sem-regra' ? (
                          <span className="text-gray-400 dark:text-gray-500" title="Convênio sem regra de prazo de análise">—</span>
                        ) : l.selo && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${SELOS[l.selo].cor}`}>
                            {SELOS[l.selo].label}
                          </span>
                        )}
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
    </div>
  );
};

export default LotesRecursoLista;
