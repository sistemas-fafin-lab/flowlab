import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Eye, FileText, Search } from 'lucide-react';
import { useGlosasRecentes } from '../hooks/useGlosasRecursos';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import type { RecorteGlosas } from '../types';
import { formatCurrency, formatData } from '../utils/formato';
import { rotuloStatusAplis, STATUS_GLOSA_DASHBOARD } from '../utils/recursoGlosaVisual';
import DetalhesRecursoCard from './DetalhesRecursoCard';
import ListaResumida from './ListaResumida';
import PaginacaoGlosas from './PaginacaoGlosas';

// Aba "Glosas recentes" (issue 10): as glosas do recorte, da mais recente para
// a mais antiga (data de recebimento da requisição). O status vem do servidor
// traduzido como no Dashboard. Sem caixas de seleção nem ações em lote. O olho
// abre "Detalhes do recurso" direto na requisição, num modal na lateral direita.

const TAMANHO = 50;

const CHIP = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap';

interface Props {
  recorte: RecorteGlosas;
  /** Muda a cada sincronização ou edição concluída: recarrega a lista. */
  versao: number;
  /** canManageBilling: o card mostra o lápis. */
  podeEditar: boolean;
  /** Uma edição do lápis foi gravada: a página relê a lista. */
  onEditado: () => void;
}

const GlosasRecentesLista: React.FC<Props> = ({ recorte, versao, podeEditar, onEditado }) => {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const [idAberto, setIdAberto] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPagina(1);
  }, [buscaDebounced, recorte.competencia, recorte.fontePagadoraId]);

  useEffect(() => {
    setIdAberto(null);
  }, [recorte.competencia, recorte.fontePagadoraId]);

  // Modal aberto: Esc fecha e a página atrás não rola.
  useEffect(() => {
    if (idAberto === null) return;
    const fecharNoEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdAberto(null);
    };
    document.addEventListener('keydown', fecharNoEsc);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fecharNoEsc);
      document.body.style.overflow = overflowAnterior;
    };
  }, [idAberto]);

  const { glosas, meta, loading, error, refetch } = useGlosasRecentes({
    ...recorte,
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

  const paginacao = (
    <PaginacaoGlosas pagina={pagina} qtdPaginas={qtdPaginas} loading={loading} onPagina={setPagina} />
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

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por guia, paciente, convênio ou procedimento..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <div>
        <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Glosas recentes ({meta?.registros ?? 0})
            </h3>
            {glosas.length > 0 && paginacao}
          </div>

          {loading ? (
            <LoadingSpinner message="Carregando glosas recentes..." />
          ) : glosas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Nenhuma glosa neste recorte</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="pl-3 pr-0 py-3"><span className="sr-only">Detalhes</span></th>
                      <th className="px-3 py-3">Data da glosa</th>
                      <th className="px-3 py-3">Guia</th>
                      <th className="px-3 py-3">Paciente</th>
                      <th className="px-3 py-3">Convênio</th>
                      <th className="px-3 py-3">Procedimento</th>
                      <th className="px-3 py-3">Motivo</th>
                      <th className="px-3 py-3 text-right">Valor glosado</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {glosas.map((g) => (
                      <tr
                        key={g.idRequisicao}
                        className={`align-top transition-colors ${
                          idAberto === g.idRequisicao
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <td className="pl-3 pr-0 py-4">
                          <button
                            onClick={() => setIdAberto(idAberto === g.idRequisicao ? null : g.idRequisicao)}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`Ver detalhes da requisição ${g.codRequisicao ?? g.idRequisicao}`}
                            title="Ver detalhes do recurso"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatData(g.dataGlosa)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white">{g.numGuia ?? '—'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Req. {g.codRequisicao ?? g.idRequisicao}</div>
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">{g.paciente ?? '—'}</td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                          {g.fontePagadora.nome ?? 'Não identificado'}
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                          <ListaResumida itens={g.procedimentos} />
                        </td>
                        <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                          <ListaResumida itens={g.motivos} />
                        </td>
                        <td className="px-3 py-4 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {g.valorGlosado === null ? '—' : formatCurrency(g.valorGlosado)}
                          {g.valorInicialEstimado && (
                            <div className="text-[10px] font-normal uppercase tracking-wide text-amber-600 dark:text-amber-400" title="A foto foi tirada depois do envio do recurso: a glosa fixada pode não ser a original">
                              estimado
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {g.status === null ? (
                            <span className="text-gray-400 dark:text-gray-500" title={rotuloStatusAplis(g.statusAplis)}>—</span>
                          ) : (
                            <span
                              className={`${CHIP} ${STATUS_GLOSA_DASHBOARD[g.status].cor}`}
                              title={rotuloStatusAplis(g.statusAplis)}
                            >
                              {STATUS_GLOSA_DASHBOARD[g.status].label}
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

      {idAberto !== null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 dark:bg-black/45 backdrop-blur-sm animate-fade-in"
            onClick={() => setIdAberto(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do recurso"
            className="fixed inset-y-2 right-2 z-50 w-[480px] max-w-[calc(100vw-1rem)] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl animate-slide-in-right"
          >
            <DetalhesRecursoCard
              idRequisicao={idAberto}
              podeEditar={podeEditar}
              versao={versao}
              onEditado={onEditado}
              onClose={() => setIdAberto(null)}
              emModal
            />
          </div>
        </>
      )}
    </div>
  );
};

export default GlosasRecentesLista;
