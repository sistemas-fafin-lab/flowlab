import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, X } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useComparativosRankingGlosa } from '../hooks/useComparativosRankingGlosa';
import { formatCompetencia, formatCurrency, formatData } from '../utils/formato';
import {
  csvRequisicoesDoCodigo,
  linhasDoModo,
  ROTULO_CLASSE,
  SEM_CODIGO,
  type ModoRanking,
} from '../utils/rankingCodigosGlosa';

// Aba Comparativos → Ranking de códigos de glosa (issue 05). Modo Total | Acatada (padrão Acatada),
// um mês por vez entre referência, M-1 e M-2. Clicar num código abre as requisições dele, com CSV.
// As glosas são as do funil, então o total de cada modo bate com o funil do mesmo mês.
// Sem nome de paciente.

interface Props {
  mes: string;
}

const ROTULO_MODO: Record<ModoRanking, string> = { acatada: 'Acatada', total: 'Total' };

const TH = 'px-3 py-2 font-normal text-xs text-gray-500 dark:text-gray-400';
const TD = 'px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300';

const botao = (ativo: boolean) => `px-3 py-1.5 rounded-lg text-xs font-medium ${
  ativo
    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    : 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
}`;

/** Chave do código selecionado: `null` (Sem código) precisa ser distinto de "nada selecionado". */
type Selecao = { codigo: string | null } | null;

function baixarCsv(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  // Revogar na hora cancela o download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const RankingCodigosGlosaComparativo: React.FC<Props> = ({ mes }) => {
  const { meses, loading, erro, recarregar } = useComparativosRankingGlosa(mes);
  const [modo, setModo] = useState<ModoRanking>('acatada');
  const [mesAtivo, setMesAtivo] = useState(mes);
  const [selecao, setSelecao] = useState<Selecao>(null);

  // Trocar o mês de referência volta para ele e fecha a tabela.
  useEffect(() => {
    setMesAtivo(mes);
    setSelecao(null);
  }, [mes]);

  const doMes = meses.find((m) => m.mes === mesAtivo) ?? meses[0];
  const ranking = doMes?.ranking[modo];

  const requisicoes = useMemo(() => {
    if (!doMes || !selecao) return [];
    return linhasDoModo(doMes.requisicoes, modo)
      .filter((l) => l.codigo === selecao.codigo)
      .sort((a, b) => b.valor - a.valor);
  }, [doMes, modo, selecao]);

  const rotuloCodigo = (codigo: string | null) => codigo ?? SEM_CODIGO;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking de códigos de glosa</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            As mesmas glosas do funil (Total = glosa total; Acatada = acatada). O código vem do apLIS por
            procedimento; o valor da requisição é dividido entre os códigos dela. Clique num código para ver as requisições.
          </p>
        </div>
        <div className="flex gap-1">
          {(['total', 'acatada'] as ModoRanking[]).map((m) => (
            <button key={m} type="button" onClick={() => { setModo(m); setSelecao(null); }} className={botao(modo === m)}>
              {ROTULO_MODO[m]}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <div role="alert" className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start justify-between gap-3">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {erro}
          </span>
          <button
            type="button"
            onClick={recarregar}
            className="shrink-0 px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : !doMes || !ranking ? null : (
        <>
          <div className="flex flex-wrap gap-1">
            {meses.map((m) => (
              <button
                key={m.mes}
                type="button"
                onClick={() => { setMesAtivo(m.mes); setSelecao(null); }}
                className={botao(m.mes === doMes.mes)}
              >
                {formatCompetencia(m.mes)} · {formatCurrency(m.ranking[modo].total)}
              </button>
            ))}
          </div>

          {ranking.linhas.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma glosa {modo === 'acatada' ? 'acatada ' : ''}em {formatCompetencia(doMes.mes)}.
            </div>
          ) : (
            <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/40">
                  <tr>
                    <th className={`${TH} text-left`}>Código</th>
                    <th className={`${TH} text-left`}>Descrição</th>
                    <th className={`${TH} text-right`}>Valor</th>
                    <th className={`${TH} text-right`}>Requisições</th>
                    <th className={`${TH} text-right`}>% do total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {ranking.linhas.map((l) => {
                    const ativo = selecao !== null && selecao.codigo === l.codigo;
                    return (
                      <tr
                        key={l.codigo ?? SEM_CODIGO}
                        onClick={() => setSelecao(ativo ? null : { codigo: l.codigo })}
                        className={`cursor-pointer ${ativo ? 'bg-blue-50/70 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {rotuloCodigo(l.codigo)}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[420px] truncate" title={l.descricao ?? undefined}>
                          {l.descricao ?? ''}
                        </td>
                        <td className={`${TD} text-right font-medium`}>{formatCurrency(l.valor)}</td>
                        <td className={`${TD} text-right`}>{l.quantidade}</td>
                        <td className={`${TD} text-right`}>{l.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50/60 dark:bg-gray-700/20">
                    <td colSpan={2} className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      Total {ROTULO_MODO[modo].toLowerCase()} de {formatCompetencia(doMes.mes)}
                    </td>
                    <td className={`${TD} text-right font-medium`}>{formatCurrency(ranking.total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {selecao && (
            <div className="border border-gray-100 dark:border-gray-700 rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Requisições do código {rotuloCodigo(selecao.codigo)} · {ROTULO_MODO[modo]} · {formatCompetencia(doMes.mes)}
                </h3>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={requisicoes.length === 0}
                    onClick={() => baixarCsv(
                      csvRequisicoesDoCodigo(requisicoes),
                      `glosa-${selecao.codigo ?? 'sem-codigo'}-${modo}-${doMes.mes}.csv`,
                    )}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelecao(null)}
                    aria-label="Fechar requisições"
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40">
                    <tr>
                      <th className={`${TH} text-left`}>Requisição</th>
                      <th className={`${TH} text-left`}>Guia</th>
                      <th className={`${TH} text-left`}>Lote</th>
                      <th className={`${TH} text-left`}>Convênio</th>
                      <th className={`${TH} text-left`}>Procedimento</th>
                      <th className={`${TH} text-right`}>Valor glosado</th>
                      <th className={`${TH} text-left`}>Status</th>
                      <th className={`${TH} text-left`} title="Retorno da operadora">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {requisicoes.map((r) => (
                      <tr key={`${r.idRequisicao}-${r.codigo ?? ''}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.codRequisicao ?? r.idRequisicao}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.numGuia ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.lote}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={r.convenio ?? undefined}>{r.convenio ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[280px] truncate" title={r.procedimento || undefined}>{r.procedimento || '—'}</td>
                        <td className={`${TD} text-right font-medium`}>{formatCurrency(r.valor)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap" title={ROTULO_CLASSE[r.classe]}>
                          {r.status}
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatData(r.data)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default RankingCodigosGlosaComparativo;
