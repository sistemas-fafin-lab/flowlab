import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { OperadoraResumo } from '../types';
import { useRequisicoesSemLote } from '../hooks/useRequisicoesSemLote';
import { formatCurrency, formatData, hojeIso, inicioMesIso } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';
import { BotaoTarefas, StatusRequisicao, TarefasRequisicaoModal, type RequisicaoDasTarefas } from './TarefasRequisicao';

// Aba Contas a Receber → Pendências → Sem lote: requisições de convênio
// (excluindo Particular/Cortesia) com `requisicao.Lote IS NULL` — nunca
// entraram em nenhum lote do apLIS, portanto invisíveis para "Sem NF (Lotes)".
// Issue 21 do feedback. Regra completa em
// api/_lib/faturamento/bdLab.ts (listarRequisicoesSemLote).
//
// Mesmo esqueleto de PendenciasParticulares (requisição já é a unidade da
// lista, sem expansão), mas com filtro de fonte pagadora — diferente do
// particular, esta lista cobre várias operadoras de convênio.
//
// Filtro "Clínica" (Local de Origem): para o setor cobrar a unidade onde a guia
// está parada. As opções vêm do próprio servidor (`meta.clinicas`): só clínicas
// com guia no recorte, com quantas guias cada uma tem.

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const TAMANHO_PADRAO = 50;

// A consulta (listarRequisicoesSemLote em bdLab.ts) exclui sempre estas duas
// fontes pagadoras — Particular tem lista própria e Cortesia não é cobrável —
// então oferecê-las no filtro só resultaria numa lista vazia sem explicação.
const ID_FONTE_PAGADORA_PARTICULAR = '1102';
const ID_FONTE_PAGADORA_CORTESIA = '100';

interface Props {
  operadoras: OperadoraResumo[];
}

const PendenciasSemLote: React.FC<Props> = ({ operadoras }) => {
  // Mesmo padrão de PendenciasParticulares: mês corrente, dia 1 até hoje.
  const [desde, setDesde] = useState(inicioMesIso);
  const [ate, setAte] = useState(hojeIso);
  const [operadoraId, setOperadoraId] = useState('');
  const [localOrigemId, setLocalOrigemId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tarefasDe, setTarefasDe] = useState<RequisicaoDasTarefas | null>(null);
  const fecharTarefas = useCallback(() => setTarefasDe(null), []);

  const { requisicoes, meta, loading, error, refetch } = useRequisicoesSemLote({
    desde: desde || undefined,
    ate: ate || undefined,
    operadoraId: operadoraId ? Number(operadoraId) : undefined,
    localOrigemId: localOrigemId ? Number(localOrigemId) : undefined,
    pagina,
    tamanho: TAMANHO_PADRAO,
  });

  const mudarFiltro = useCallback((aplicar: () => void) => {
    aplicar();
    setPagina(1);
  }, []);

  const qtdPaginas = meta?.qtdPaginas ?? 1;
  const registros = meta?.registros ?? 0;

  // Guarda as opções da última resposta: durante o carregamento `meta` some, e
  // o Select ficaria sem o rótulo da clínica escolhida.
  const [clinicas, setClinicas] = useState(meta?.clinicas ?? []);
  useEffect(() => {
    if (meta?.clinicas) setClinicas(meta.clinicas);
  }, [meta]);

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
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Fonte pagadora
          <Select
            value={operadoraId}
            onChange={(v) => mudarFiltro(() => setOperadoraId(v))}
            options={[
              { value: '', label: 'Todas' },
              ...operadoras
                .filter((o): o is OperadoraResumo & { aplisId: string } => o.aplisId !== null)
                .filter((o) => o.aplisId !== ID_FONTE_PAGADORA_PARTICULAR && o.aplisId !== ID_FONTE_PAGADORA_CORTESIA)
                .filter((o) => o.consideradaMeta)
                .map((o) => ({ value: o.aplisId, label: o.nome })),
            ]}
            controlClass={CAMPO}
            wrapperClass="max-w-[220px]"
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Clínica
          <Select
            value={localOrigemId}
            onChange={(v) => mudarFiltro(() => setLocalOrigemId(v))}
            searchable
            searchPlaceholder="Buscar clínica"
            options={[
              { value: '', label: 'Todas' },
              ...clinicas.map((c) => ({
                value: String(c.id ?? 0),
                label: c.nome ?? (c.id === null ? 'Sem local de origem' : `Local ${c.id}`),
                description: `${c.qtd} guia${c.qtd === 1 ? '' : 's'} · ${formatCurrency(c.valor)}`,
              })),
            ]}
            controlClass={CAMPO}
            wrapperClass="w-[260px]"
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
        Requisições de convênio que nunca entraram em nenhum lote do apLIS
        {meta?.limite ? <>, solicitadas até {formatData(meta.limite)}</> : null} — dados até ontem
        (D-1), porque o apLIS chega com cerca de um dia de atraso. Não aparecem em "Sem NF
        (lotes)", que só olha requisições já ligadas a um lote; exame cancelado, amostra
        devolvida e material descartado ficam de fora.
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
                  <th className="px-3 py-2">Fonte pagadora</th>
                  <th className="px-3 py-2">Clínica</th>
                  <th className="px-3 py-2">Solicitação</th>
                  <th className="px-3 py-2">Status da requisição</th>
                  <th className="px-3 py-2">Laudo liberado</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 w-10"><span className="sr-only">Tarefas</span></th>
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
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                      <span title={req.fontePagadora.razaoSocial ?? undefined}>
                        {req.fontePagadora.nome ?? 'Não identificada'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                      <span title={req.localOrigem.nome ?? undefined}>{req.localOrigem.nome ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {formatData(req.dtaSolicitacao)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusRequisicao codEvento={req.codEvento} label={req.eventoLabel} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {formatData(req.dtaFinalizacao)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(req.valor)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <BotaoTarefas
                        qtdTotal={req.qtdTarefas}
                        qtdAbertas={req.qtdTarefasAbertas}
                        onClick={() => setTarefasDe({ idRequisicao: req.idRequisicao, codRequisicao: req.codRequisicao })}
                      />
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

      <TarefasRequisicaoModal requisicao={tarefasDe} onFechar={fecharTarefas} />
    </div>
  );
};

export default PendenciasSemLote;
