import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  diasDeAtraso,
  faixaAgingParaRange,
  formatCurrency,
  formatData,
  idsOperadorasConsideradasMeta,
} from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import type { AgingSelecao, OperadoraResumo, TituloStatus } from '../types';

// Drill-down do widget "Aging da carteira" (issue 41): clicar numa faixa (ou
// num segmento de operadora dentro dela) abre este modal com a lista de
// títulos por trás do agregado — "não pode ser só gráfico", pedido explícito
// da usuária. Consulta própria, direto ao Supabase: NÃO reaproveita
// useContasReceber, porque aquele hook filtra por `data_vencimento` como um
// range livre (issue 40) e pagina no servidor — aqui o range é derivado da
// faixa clicada (faixaAgingParaRange) e a lista não precisa de paginação de
// UI, só de um teto de linhas.

interface ItemAging {
  id: string;
  numeroNota: string | null;
  operadoraNome: string | null;
  dataVencimento: string | null;
  valorSaldo: number;
  diasAtraso: number | null;
}

// Formato cru devolvido pelo PostgREST.
interface LinhaAging {
  id_nota: string;
  numero_nota: string | null;
  data_vencimento: string | null;
  valor_saldo: number | string;
  operadoras: { nome: string } | null;
}

// Mesmo recorte de "título em aberto" que a RPC fat_dashboard_receber usa
// para montar o aging (20260903120000_aging_por_operadora.sql): fora
// cancelada/recebida/liquidada, com saldo positivo. Tipado em cima de
// TituloStatus (não uma string PostgREST solta) para um nome de status errado
// virar erro de compilação em vez de silenciosamente não excluir nada.
const STATUS_ENCERRADOS: readonly TituloStatus[] = ['cancelada', 'recebida', 'liquidada'];

// Teto de linhas: o widget agrega a carteira inteira, e uma operadora com
// centenas de títulos atrasados não precisa carregar tudo de uma vez só para
// a usuária ver "quais operadoras, quais títulos" por trás do agregado.
const LIMITE_LINHAS = 300;

const rotuloAtraso = (dias: number | null): string => {
  if (dias === null) return '—';
  if (dias > 0) return `${dias}d em atraso`;
  if (dias === 0) return 'vence hoje';
  return `vence em ${Math.abs(dias)}d`;
};

interface Props extends AgingSelecao {
  /** Whitelist de operadoras consideradas na meta — mesmo recorte que o
   *  gráfico já aplica por trás (ver fat_dashboard_receber). */
  operadoras: OperadoraResumo[];
  onFechar: () => void;
}

const AgingDetalheModal: React.FC<Props> = ({
  bucket,
  rotulo,
  operadoraId,
  operadoraNome,
  operadoras,
  onFechar,
}) => {
  const [itens, setItens] = useState<ItemAging[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const { desde, ate, incluirSemVencimento } = faixaAgingParaRange(bucket);

        let query = supabase
          .from('notas')
          .select('id_nota, numero_nota, data_vencimento, valor_saldo, operadoras(nome)', { count: 'exact' })
          .not('status', 'in', `(${STATUS_ENCERRADOS.join(',')})`)
          .gt('valor_saldo', 0)
          .order('data_vencimento', { ascending: true, nullsFirst: true })
          .limit(LIMITE_LINHAS);

        if (operadoraId) {
          // Segmento de uma operadora nomeada: já veio filtrado pelo clique,
          // não precisa repetir a whitelist (a série do gráfico já só mostra
          // operadora considerada na meta).
          query = query.eq('operadora_id', operadoraId);
        } else {
          query = query.in('operadora_id', idsOperadorasConsideradasMeta(operadoras));
        }

        if (incluirSemVencimento && desde) {
          query = query.or(`data_vencimento.is.null,data_vencimento.gte.${desde}`);
        } else {
          if (desde) query = query.gte('data_vencimento', desde);
          if (ate) query = query.lte('data_vencimento', ate);
        }

        const { data, count, error: erroConsulta } = await query;
        if (cancelado) return;
        if (erroConsulta) throw new Error(erroConsulta.message);

        const linhas = (data ?? []) as unknown as LinhaAging[];
        setItens(linhas.map((linha) => ({
          id: linha.id_nota,
          numeroNota: linha.numero_nota,
          operadoraNome: linha.operadoras?.nome ?? null,
          dataVencimento: linha.data_vencimento,
          valorSaldo: Number(linha.valor_saldo ?? 0),
          diasAtraso: diasDeAtraso(linha.data_vencimento),
        })));
        setTotal(count ?? 0);
      } catch (err) {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : 'Não foi possível carregar os títulos desta faixa.');
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [bucket, operadoraId, operadoras]);

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
        aria-label="Detalhe do aging"
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Aging da carteira — {rotulo}
              {operadoraNome ? ` — ${operadoraNome}` : ''}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Títulos em aberto nesta faixa, por vencimento
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
          {erro && (
            <div className="mb-3 p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : itens.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum título em aberto nesta faixa.
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                    <th className="py-2 pr-2">Operadora</th>
                    <th className="py-2 px-2">Nota</th>
                    <th className="py-2 px-2">Vencimento</th>
                    <th className="py-2 px-2 text-right">Saldo</th>
                    <th className="py-2 pl-2 text-right">Atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {itens.map((item) => (
                    <tr key={item.id} className="text-gray-700 dark:text-gray-200">
                      <td className="py-2 pr-2 truncate max-w-[220px]">{item.operadoraNome ?? '—'}</td>
                      <td className="py-2 px-2">
                        {item.numeroNota || <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="py-2 px-2 tabular-nums">{formatData(item.dataVencimento)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.valorSaldo)}
                      </td>
                      <td
                        className={`py-2 pl-2 text-right whitespace-nowrap ${
                          item.diasAtraso !== null && item.diasAtraso > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {rotuloAtraso(item.diasAtraso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {total > itens.length && (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Mostrando os {itens.length} títulos mais urgentes de {total} nesta faixa.
                </p>
              )}
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

export default AgingDetalheModal;
