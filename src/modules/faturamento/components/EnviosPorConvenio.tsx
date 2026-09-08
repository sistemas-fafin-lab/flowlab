import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { STATUS_ENVIADOS_PADRAO, STLOT_LABELS } from '../types';
import { useEnviosPorConvenio } from '../hooks/useEnviosPorConvenio';
import { formatCurrency, periodoEsteMes, periodoEsteTrimestre } from '../utils/formato';
import { urlFaturasFiltradasPorConvenio } from '../utils/filtrosUrl';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import DatePicker from '../../../components/DatePicker';

// Aba Contas a Receber → Envios (issue 01): uma linha por convênio (fonte
// pagadora) com o total de lotes enviados a ele no período, sem precisar
// selecionar um convênio antes nem abrir um título — visão macro de todos os
// convênios com movimentação, agregada no MySQL de backup (ver
// useEnviosPorConvenio/api/_lib/faturamento/bdLab.ts, listarEnviosPorConvenio).

const CAMPO = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

type Preset = 'mes' | 'trimestre' | 'personalizado';

// Valor do <Select> de status quando nenhum status específico foi escolhido —
// restringe aos dois códigos STLOT que a issue chama de "enviados".
const STATUS_ENVIADOS = 'enviados';

const OPCOES_STATUS = [
  { value: STATUS_ENVIADOS, label: 'Enviados (Conciliação + Faturado)' },
  ...Object.entries(STLOT_LABELS).map(([codigo, rotulo]) => ({ value: codigo, label: rotulo })),
];

const EnviosPorConvenio: React.FC = () => {
  // "Mês atual" é o padrão ao abrir a aba (issue 01).
  const [periodo, setPeriodo] = useState(periodoEsteMes);
  const [preset, setPreset] = useState<Preset>('mes');
  const [statusSelecionado, setStatusSelecionado] = useState(STATUS_ENVIADOS);

  const statusLotes = useMemo(
    () => (statusSelecionado === STATUS_ENVIADOS ? [...STATUS_ENVIADOS_PADRAO] : [Number(statusSelecionado)]),
    [statusSelecionado],
  );

  const escolherPreset = useCallback((id: Preset, calcular: () => { desde: string; ate: string }) => {
    setPreset(id);
    setPeriodo(calcular());
  }, []);

  const mudarData = useCallback((patch: Partial<typeof periodo>) => {
    setPreset('personalizado');
    setPeriodo((atual) => ({ ...atual, ...patch }));
  }, []);

  const { convenios, loading, error, refetch } = useEnviosPorConvenio({
    periodoIni: periodo.desde,
    periodoFim: periodo.ate,
    status: statusLotes,
  });

  // Drill-down (issue 03): clicar num convênio leva a Faturas já filtrada por ele
  // (id exato, não busca aproximada) e pelo mesmo período selecionado aqui.
  const navigate = useNavigate();
  const irParaFaturasDoConvenio = useCallback(
    (fontePagadoraId: number) => {
      navigate(
        urlFaturasFiltradasPorConvenio(fontePagadoraId, { periodoIni: periodo.desde, periodoFim: periodo.ate }),
      );
    },
    [navigate, periodo.desde, periodo.ate],
  );

  return (
    <div className="space-y-4">
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {([
            { id: 'mes' as const, rotulo: 'Mês atual', calcular: periodoEsteMes },
            { id: 'trimestre' as const, rotulo: 'Trimestre atual', calcular: periodoEsteTrimestre },
          ]).map(({ id, rotulo, calcular }) => (
            <button
              key={id}
              type="button"
              onClick={() => escolherPreset(id, calcular)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${
                preset === id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          De
          <DatePicker
            value={periodo.desde}
            onChange={(v) => mudarData({ desde: v })}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          até
          <DatePicker
            value={periodo.ate}
            onChange={(v) => mudarData({ ate: v })}
            controlClass={CAMPO}
          />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Status
          <Select
            value={statusSelecionado}
            onChange={setStatusSelecionado}
            options={OPCOES_STATUS}
            controlClass={CAMPO}
            wrapperClass="max-w-[260px]"
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

      {error && (
        <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : convenios.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum convênio com lote no período/status selecionado.
        </div>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/40">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Convênio</th>
                  <th className="px-3 py-2 text-right">Lotes</th>
                  <th className="px-3 py-2 text-right">Requisições</th>
                  <th className="px-3 py-2 text-right">Valor total</th>
                  <th className="px-3 py-2 text-right">Valor recebido</th>
                  <th className="px-3 py-2 text-right">Pendente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {convenios.map((convenio) => {
                  const clicavel = convenio.fontePagadoraId !== null;
                  const irParaFaturas = () => irParaFaturasDoConvenio(convenio.fontePagadoraId as number);
                  return (
                    <tr
                      key={convenio.fontePagadoraId ?? `sem-id-${convenio.nome}`}
                      onClick={clicavel ? irParaFaturas : undefined}
                      onKeyDown={
                        clicavel
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                irParaFaturas();
                              }
                            }
                          : undefined
                      }
                      role={clicavel ? 'button' : undefined}
                      tabIndex={clicavel ? 0 : undefined}
                      title={clicavel ? `Ver faturas de ${convenio.nome ?? 'convênio'} no período` : undefined}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                        clicavel ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[320px]">
                        <span title={convenio.razaoSocial ?? undefined}>
                          {convenio.nome ?? 'Não identificado'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {convenio.qtdLotes}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {convenio.qtdRequisicoes}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(convenio.valorTotal)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatCurrency(convenio.valorRecebido)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${
                          convenio.valorPendente > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {formatCurrency(convenio.valorPendente)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            {convenios.length} convênio{convenios.length === 1 ? '' : 's'} com movimentação no período
          </div>
        </div>
      )}
    </div>
  );
};

export default EnviosPorConvenio;
