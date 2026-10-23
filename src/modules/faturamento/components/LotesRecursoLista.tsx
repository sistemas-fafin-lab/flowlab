import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, FileText, Search } from 'lucide-react';
import { useLotesRecurso } from '../hooks/useGlosasRecursos';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import type { LoteRecursoFoto, RecorteGlosas, StatusLoteRecurso } from '../types';
import { formatCurrency, formatData, formatDataHora } from '../utils/formato';
import { SELOS_ATRASO, STATUS_LOTE_CORES } from '../utils/recursoGlosaVisual';
import { MarcaEditado } from './CampoEditavelRecurso';
import DetalhesRecursoCard from './DetalhesRecursoCard';

// Acompanhamento dos recursos → "Lotes de recurso": os lotes de recurso da foto
// do apLIS no recorte do cabeçalho (mês do lote de faturamento original +
// convênio), com retorno e pagamento previstos e o selo de atraso calculados
// no servidor pelas regras de prazo do convênio. O olho abre o card
// "Detalhes do recurso" ao lado da lista. Retorno e pagamento mostram a data
// real (registrada pelo lápis) quando há, diferenciada da prevista.

const TAMANHO = 50;

const STATUS_OPCOES = [
  { value: '', label: 'Todos os status' },
  ...(Object.keys(STATUS_LOTE_CORES) as StatusLoteRecurso[]).map((s) => ({ value: s, label: s })),
];

const CAMPO = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white';

/** Data real (lápis) acima da prevista; a prevista fica apagada e rotulada. */
const DataRealOuPrevista: React.FC<{ real: string | null; prevista: string | null }> = ({ real, prevista }) => {
  if (real) {
    return (
      <div>
        <div className="font-medium text-gray-900 dark:text-white">{formatData(real)}</div>
        <div className="text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400">real</div>
      </div>
    );
  }
  if (!prevista) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <div>
      <div className="italic text-gray-500 dark:text-gray-400">{formatData(prevista)}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">prevista</div>
    </div>
  );
};

interface Props {
  recorte: RecorteGlosas;
  /** Muda a cada sincronização ou edição concluída: recarrega a lista. */
  versao: number;
  /** canManageBilling: o card mostra o lápis. */
  podeEditar: boolean;
  /** Uma edição do lápis foi gravada: a página relê lista e cards. */
  onEditado: () => void;
}

const LotesRecursoLista: React.FC<Props> = ({ recorte, versao, podeEditar, onEditado }) => {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [status, setStatus] = useState<StatusLoteRecurso | ''>('');
  const [pagina, setPagina] = useState(1);
  const [loteAberto, setLoteAberto] = useState<LoteRecursoFoto | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagina(1);
  }, [buscaDebounced, status, recorte.competencia, recorte.fontePagadoraId]);

  // Outro recorte: o lote aberto pode nem estar mais na lista.
  useEffect(() => {
    setLoteAberto(null);
  }, [recorte.competencia, recorte.fontePagadoraId]);

  // Em tela estreita o card fica abaixo da lista: rola até ele.
  const idLoteAberto = loteAberto?.idLoteRecurso ?? null;
  useEffect(() => {
    if (idLoteAberto !== null) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [idLoteAberto]);

  const { lotes, meta, loading, error, refetch } = useLotesRecurso({
    ...recorte,
    status: status || undefined,
    busca: buscaDebounced || undefined,
    pagina,
    tamanho: TAMANHO,
  });

  // Lista recarregada (página, "Atualizar"): o bloco do lote mostra a linha nova.
  useEffect(() => {
    setLoteAberto((aberto) => (aberto && lotes.find((l) => l.idLoteRecurso === aberto.idLoteRecurso)) ?? aberto);
  }, [lotes]);

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

      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="flex-1 min-w-0 w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                      <th className="pl-3 pr-0 py-3"><span className="sr-only">Detalhes</span></th>
                      <th className="px-3 py-3">Lote de recurso</th>
                      <th className="px-3 py-3">Protocolo de faturamento</th>
                      <th className="px-3 py-3">Convênio</th>
                      <th className="px-3 py-3 text-right">Valor glosado</th>
                      <th className="px-3 py-3 text-right">Valor recorrido</th>
                      <th className="px-3 py-3">Envio</th>
                      <th className="px-3 py-3">Retorno</th>
                      <th className="px-3 py-3">Pagamento</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-5 py-3">Atraso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {lotes.map((l) => (
                      <tr
                        key={l.idLoteRecurso}
                        className={`transition-colors ${
                          loteAberto?.idLoteRecurso === l.idLoteRecurso
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <td className="pl-3 pr-0 py-4">
                          <button
                            onClick={() => setLoteAberto(loteAberto?.idLoteRecurso === l.idLoteRecurso ? null : l)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`Ver detalhes do lote ${l.idLoteRecurso}`}
                            title="Ver detalhes do recurso"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
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
                          {l.dataEnvioEditada && <MarcaEditado compacta />}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <DataRealOuPrevista real={l.dataRetornoReal} prevista={l.dataRetornoPrevista} />
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <DataRealOuPrevista real={l.dataPagamentoReal} prevista={l.dataPagamentoPrevista} />
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_LOTE_CORES[l.statusLabel]}`}>
                            {l.statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {l.selo === 'sem-regra' ? (
                            <span className="text-gray-400 dark:text-gray-500" title="Convênio sem regra de prazo de análise">—</span>
                          ) : l.selo && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${SELOS_ATRASO[l.selo].cor}`}>
                              {SELOS_ATRASO[l.selo].label}
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

        {loteAberto && (
          <div ref={cardRef} className="w-full xl:w-[420px] shrink-0 xl:sticky xl:top-4 scroll-mt-4">
            <DetalhesRecursoCard
              lote={loteAberto}
              podeEditar={podeEditar}
              versao={versao}
              onEditado={onEditado}
              onClose={() => setLoteAberto(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LotesRecursoLista;
