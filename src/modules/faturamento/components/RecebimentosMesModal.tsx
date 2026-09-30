import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { formatCompetencia, formatCurrency, formatData } from '../utils/formato';
import type { RecebidoLote } from '../hooks/useRecebimentosMes';

// Lista por trás do widget "Recebido no mês": o recebido do mês no apLIS,
// agregado por operadora e lote (requisições sem lote, como particular, numa
// linha "sem lote" da operadora). Recebe as linhas já carregadas pelo widget
// (useRecebimentosMes) em vez de consultar de novo — o número do card e a
// lista saem, assim, sempre da mesma leitura.

// Filtros por coluna, todos locais: a lista já veio inteira do widget, então
// filtrar é só recortar em memória — e o total do rodapé acompanha o recorte.
interface Filtros {
  operadora: string;
  lote: string;
  reqMin: string;
  dataDe: string;
  dataAte: string;
  valorMin: string;
}

const FILTROS_VAZIOS: Filtros = { operadora: '', lote: '', reqMin: '', dataDe: '', dataAte: '', valorMin: '' };

const INPUT =
  'w-full px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-normal text-gray-900 dark:text-gray-100';

interface Props {
  competencia: string;
  lotes: RecebidoLote[];
  total: number;
  qtdRequisicoes: number;
  loading: boolean;
  error: string | null;
  /** Troca o mês do widget inteiro (card + modal leem do mesmo hook), então
   *  navegar aqui dentro também atualiza o card de fundo. */
  onMudarCompetencia: (competencia: string) => void;
  onFechar: () => void;
}

/** "2026-09" deslocado em `delta` meses. */
const deslocarMes = (competencia: string, delta: number): string => {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(ano, mes - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const RecebimentosMesModal: React.FC<Props> = ({
  competencia,
  lotes,
  total,
  qtdRequisicoes,
  loading,
  error,
  onMudarCompetencia,
  onFechar,
}) => {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);

  // Ao trocar de mês, as datas (presas ao mês) e a operadora (pode não ter
  // recebido no mês novo) deixam de fazer sentido; lote/mínimos continuam.
  const mudarMes = (nova: string) => {
    if (!nova || nova === competencia) return;
    setFiltros((atual) => ({ ...atual, operadora: '', dataDe: '', dataAte: '' }));
    onMudarCompetencia(nova);
  };
  const alterar = (campo: keyof Filtros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFiltros((atual) => ({ ...atual, [campo]: e.target.value }));
  const temFiltro = Object.values(filtros).some((v) => v !== '');

  const operadorasDisponiveis = useMemo(
    () => [...new Set(lotes.map((l) => l.operadoraNome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lotes],
  );

  const filtrados = useMemo(() => {
    const termoLote = filtros.lote.trim().toLowerCase();
    const reqMin = Number(filtros.reqMin) || 0;
    const valorMin = Number(filtros.valorMin.replace(',', '.')) || 0;
    return lotes.filter((l) => {
      if (filtros.operadora && l.operadoraNome !== filtros.operadora) return false;
      if (termoLote) {
        const rotulo = l.idLote === null ? 'sem lote' : String(l.idLote);
        if (!rotulo.includes(termoLote)) return false;
      }
      if (l.qtdRequisicoes < reqMin) return false;
      // ISO YYYY-MM-DD compara certo como string.
      if (filtros.dataDe && (!l.ultimoRecebimento || l.ultimoRecebimento < filtros.dataDe)) return false;
      if (filtros.dataAte && (!l.ultimoRecebimento || l.ultimoRecebimento > filtros.dataAte)) return false;
      if (l.valorRecebido < valorMin) return false;
      return true;
    });
  }, [lotes, filtros]);

  const totalFiltrado = temFiltro
    ? Math.round(filtrados.reduce((soma, l) => soma + l.valorRecebido, 0) * 100) / 100
    : total;
  const reqFiltradas = temFiltro ? filtrados.reduce((soma, l) => soma + l.qtdRequisicoes, 0) : qtdRequisicoes;
  // Limites dos campos de data: o próprio mês do card.
  const [ano, mes] = competencia.split('-').map(Number);
  const mesIni = `${competencia}-01`;
  const mesFim = `${competencia}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`;
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recebimentos do mês"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recebimentos — {formatCompetencia(competencia)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pelo apLIS: último recebimento de cada requisição neste mês, por lote
            </p>
          </div>
          <div className="flex items-center gap-1 ml-auto mr-2">
            <button
              type="button"
              onClick={() => mudarMes(deslocarMes(competencia, -1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/70 dark:hover:bg-slate-700/70"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={competencia}
              onChange={(e) => mudarMes(e.target.value)}
              aria-label="Mês de recebimento"
              className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => mudarMes(deslocarMes(competencia, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/70 dark:hover:bg-slate-700/70"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/70"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : error ? (
            <p className="py-10 text-sm text-red-600 dark:text-red-400 flex items-start justify-center gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          ) : lotes.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum recebimento neste mês.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                  <th className="py-2 pr-2">Operadora</th>
                  <th className="py-2 px-2">Lote</th>
                  <th className="py-2 px-2 text-right">Requisições</th>
                  <th className="py-2 px-2">Último recebimento</th>
                  <th className="py-2 pl-2 text-right">Valor recebido</th>
                </tr>
                <tr className="border-b border-gray-100 dark:border-slate-700 align-top">
                  <th className="py-2 pr-2">
                    <select value={filtros.operadora} onChange={alterar('operadora')} className={INPUT} aria-label="Filtrar por operadora">
                      <option value="">Todas</option>
                      {operadorasDisponiveis.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                    </select>
                  </th>
                  <th className="py-2 px-2 w-28">
                    <input value={filtros.lote} onChange={alterar('lote')} placeholder="Lote" className={INPUT} aria-label="Filtrar por lote" />
                  </th>
                  <th className="py-2 px-2 w-24">
                    <input type="number" min={0} value={filtros.reqMin} onChange={alterar('reqMin')} placeholder="Mín." className={`${INPUT} text-right`} aria-label="Mínimo de requisições" />
                  </th>
                  <th className="py-2 px-2 w-36">
                    <div className="flex flex-col gap-1">
                      <input type="date" min={mesIni} max={mesFim} value={filtros.dataDe} onChange={alterar('dataDe')} className={INPUT} aria-label="Recebimento a partir de" />
                      <input type="date" min={mesIni} max={mesFim} value={filtros.dataAte} onChange={alterar('dataAte')} className={INPUT} aria-label="Recebimento até" />
                    </div>
                  </th>
                  <th className="py-2 pl-2 w-32">
                    <input inputMode="decimal" value={filtros.valorMin} onChange={alterar('valorMin')} placeholder="Mín. R$" className={`${INPUT} text-right`} aria-label="Valor mínimo" />
                  </th>
                </tr>
                {/* Total no topo, dentro do cabeçalho fixo: fica visível ao rolar a lista. */}
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-semibold text-gray-900 dark:text-gray-100">
                  <td className="py-2 pr-2" colSpan={2}>
                    {temFiltro ? `Total filtrado (${filtrados.length} de ${lotes.length} linhas)` : 'Total'}
                    {temFiltro && (
                      <button
                        type="button"
                        onClick={() => setFiltros(FILTROS_VAZIOS)}
                        className="ml-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{reqFiltradas}</td>
                  <td className="py-2 px-2" />
                  <td className="py-2 pl-2 text-right tabular-nums">{formatCurrency(totalFiltrado)}</td>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum lote com esses filtros.
                    </td>
                  </tr>
                )}
                {filtrados.map((lote) => (
                  <tr
                    key={`${lote.fontePagadoraId}-${lote.idLote ?? 'sem'}`}
                    className="text-gray-700 dark:text-gray-200"
                  >
                    <td className="py-2 pr-2 truncate max-w-[240px]">{lote.operadoraNome}</td>
                    <td className="py-2 px-2 tabular-nums">
                      {lote.idLote ?? <span className="text-gray-400 dark:text-gray-500">sem lote</span>}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{lote.qtdRequisicoes}</td>
                    <td className="py-2 px-2 tabular-nums">{formatData(lote.ultimoRecebimento)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(lote.valorRecebido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-slate-700/50">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white shadow-md hover:bg-blue-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecebimentosMesModal;
