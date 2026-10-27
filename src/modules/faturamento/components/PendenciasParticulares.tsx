import React, { useCallback, useState } from 'react';
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { limparCachePendenciasParticulares, usePendenciasParticulares } from '../hooks/usePendenciasParticulares';
import { formatCurrency, formatData, hojeIso, inicioMesIso } from '../utils/formato';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import DatePicker from '../../../components/DatePicker';
import Switch from '../../../components/Switch';
import ClinicasSemNfModal from './ClinicasSemNfModal';
import { BotaoTarefas, StatusRequisicao, TarefasRequisicaoModal, type RequisicaoDasTarefas } from './TarefasRequisicao';

// Aba Contas a Receber → Pendências → Particulares: requisições da fonte
// pagadora PARTICULAR (IdFontePagadora 1102) sem NF emitida, solicitadas até
// hoje (dados até D-1, pelo atraso da réplica do apLIS). Regra completa em
// api/_lib/faturamento/bdLab.ts (listarParticularesPendentes).
//
// Diferente de PendenciasNaoFaturadas (lote → requisições expansível), aqui a
// requisição já é a unidade da lista: a maioria dos particulares nunca entra
// num lote do apLIS (pagamento é direto no balcão), então não há o que expandir.
//
// As requisições de clínicas sem NF (locais de origem para os quais o laboratório
// não emite nota, tabela clinicas_sem_nf) ficam fora da lista e do total. O
// toggle "Mostrar clínicas sem NF" as traz de volta, marcadas, para conferência.
// A lista é editada no modal "Clínicas sem NF" (ClinicasSemNfModal).

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const TAMANHO_PADRAO = 50;

// O padrão do filtro é o mês corrente (dia 1 até hoje): é quando a NF do
// particular precisa sair. Os campos continuam editáveis para caçar pendências
// de períodos anteriores.
interface Props {
  /** canManageBilling: edita a lista de clínicas sem NF; sem ele, o modal é só leitura. */
  podeEditar: boolean;
}

const PendenciasParticulares: React.FC<Props> = ({ podeEditar }) => {
  const [desde, setDesde] = useState(inicioMesIso);
  const [ate, setAte] = useState(hojeIso);
  const [pagina, setPagina] = useState(1);
  const [incluirSemNf, setIncluirSemNf] = useState(false);
  const [clinicasSemNfAberto, setClinicasSemNfAberto] = useState(false);
  const [tarefasDe, setTarefasDe] = useState<RequisicaoDasTarefas | null>(null);
  const fecharTarefas = useCallback(() => setTarefasDe(null), []);

  const { requisicoes, meta, loading, error, refetch } = usePendenciasParticulares({
    desde: desde || undefined,
    ate: ate || undefined,
    pagina,
    tamanho: TAMANHO_PADRAO,
    incluirSemNf,
  });

  const mudarFiltro = useCallback((aplicar: () => void) => {
    aplicar();
    setPagina(1);
  }, []);

  // A lista mudou: o resultado guardado de qualquer filtro (e o do widget do
  // Dashboard) ficou velho. `refetch(true)` também fura o cache de 60s da lista
  // no servidor (semCache=1).
  const fecharClinicasSemNf = useCallback((alterou: boolean) => {
    setClinicasSemNfAberto(false);
    if (!alterou) return;
    limparCachePendenciasParticulares();
    void refetch(true);
  }, [refetch]);

  const qtdPaginas = meta?.qtdPaginas ?? 1;
  const registros = meta?.registros ?? 0;

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
        <button
          type="button"
          onClick={() => void refetch(true)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
        <label className="flex items-center gap-2 py-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
          <Switch
            size="sm"
            checked={incluirSemNf}
            onChange={(v) => mudarFiltro(() => setIncluirSemNf(v))}
          />
          Mostrar clínicas sem NF
        </label>
        <button
          type="button"
          onClick={() => setClinicasSemNfAberto(true)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <Building2 className="w-4 h-4" /> Clínicas sem NF
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Requisições particulares sem nota fiscal/RPS emitida
        {meta?.limite ? <>, solicitadas até {formatData(meta.limite)}</> : null} — dados até ontem
        (D-1), porque o apLIS chega com cerca de um dia de atraso. Inclui as que nunca chegaram a
        entrar num lote do apLIS e deixa de fora exame cancelado, amostra devolvida e material
        descartado.{' '}
        {incluirSemNf
          ? 'As requisições de clínicas sem NF estão incluídas na lista e no total.'
          : 'As requisições de clínicas sem NF ficam de fora da lista e do total.'}
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
                  <th className="px-3 py-2">Clínica</th>
                  <th className="px-3 py-2">Solicitação</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Status da requisição</th>
                  <th className="px-3 py-2">Laudo liberado</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 w-10"><span className="sr-only">Tarefas</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {requisicoes.map((req) => (
                  <tr
                    key={req.idRequisicao}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${req.clinicaSemNf ? 'opacity-60' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap font-mono">
                      {req.codRequisicao ?? `#${req.idRequisicao}`}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[220px]">
                      {req.paciente ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{req.localOrigem.nome ?? '—'}</span>
                        {req.clinicaSemNf && (
                          <span
                            className="inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            title="Clínica para a qual o laboratório não emite NF: não conta como pendência."
                          >
                            Sem NF
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {formatData(req.dtaSolicitacao)}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      {req.idLote ?? '—'}
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

      <ClinicasSemNfModal
        aberto={clinicasSemNfAberto}
        onFechar={fecharClinicasSemNf}
        podeEditar={podeEditar}
      />
      <TarefasRequisicaoModal requisicao={tarefasDe} onFechar={fecharTarefas} />
    </div>
  );
};

export default PendenciasParticulares;
