import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, X, XCircle } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useHistoricoMetas } from '../hooks/useHistoricoMetas';
import { anoMesAtual, formatCompetencia, formatCurrency } from '../utils/formato';

// Histórico da meta mensal: um mês por linha, meta × faturado e se foi batida.
// O mês corrente ainda não fechou — só vira "Batida" quando já passou da meta;
// antes disso fica "Em andamento", para não contar como meta perdida.

type Situacao = 'batida' | 'nao_batida' | 'em_andamento';

const SITUACAO: Record<Situacao, { rotulo: string; classe: string; icone: React.ReactNode }> = {
  batida: {
    rotulo: 'Batida',
    classe: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    icone: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  nao_batida: {
    rotulo: 'Não batida',
    classe: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    icone: <XCircle className="w-3.5 h-3.5" />,
  },
  em_andamento: {
    rotulo: 'Em andamento',
    classe: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    icone: <Clock className="w-3.5 h-3.5" />,
  },
};

interface Props {
  onFechar: () => void;
}

const HistoricoMetasModal: React.FC<Props> = ({ onFechar }) => {
  const { historico, loading, error } = useHistoricoMetas(true);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const linhas = useMemo(() => {
    const { ano, mes } = anoMesAtual();
    const atual = `${ano}-${String(mes).padStart(2, '0')}`;
    return historico.map((m) => {
      const percentual = m.valorMeta ? Math.round((m.faturado / m.valorMeta) * 100) : 0;
      let situacao: Situacao;
      if (m.metaBatida) situacao = 'batida';
      else if (m.competencia >= atual) situacao = 'em_andamento';
      else situacao = 'nao_batida';
      return { ...m, percentual, situacao };
    });
  }, [historico]);

  const fechados = linhas.filter((l) => l.situacao !== 'em_andamento');
  const batidas = fechados.filter((l) => l.situacao === 'batida').length;

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
        aria-label="Histórico de metas"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Histórico de metas</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Faturado de cada mês (títulos por vencimento, fontes da meta) contra a meta cadastrada
            </p>
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
          ) : linhas.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma meta cadastrada ainda.
            </p>
          ) : (
            <>
              {fechados.length > 0 && (
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                  Meta batida em <strong>{batidas}</strong> de {fechados.length} mês
                  {fechados.length === 1 ? '' : 'es'} fechado{fechados.length === 1 ? '' : 's'}.
                </p>
              )}
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                    <th className="py-2 pr-2">Mês</th>
                    <th className="py-2 px-2 text-right">Meta</th>
                    <th className="py-2 px-2 text-right">Faturado</th>
                    <th className="py-2 px-2">Atingido</th>
                    <th className="py-2 pl-2">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {linhas.map((l) => {
                    const s = SITUACAO[l.situacao];
                    return (
                      <tr key={l.competencia} className="text-gray-700 dark:text-gray-200">
                        <td className="py-2 pr-2 font-medium tabular-nums">{formatCompetencia(l.competencia)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(l.valorMeta ?? 0)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatCurrency(l.faturado)}
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            {l.qtdTitulos} título{l.qtdTitulos === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-2 px-2 w-40">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${l.metaBatida ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                style={{ width: `${Math.min(l.percentual, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums w-11 text-right">{l.percentual}%</span>
                          </div>
                        </td>
                        <td className="py-2 pl-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.classe}`}>
                            {s.icone} {s.rotulo}
                          </span>
                          {!l.metaBatida && (
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                              {l.situacao === 'em_andamento' ? 'faltam' : 'faltou'} {formatCurrency(l.quantoFalta)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
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

export default HistoricoMetasModal;
