import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../../hooks/useTheme';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import { useComparativosVolumeEnvio } from '../hooks/useComparativosVolumeEnvio';
import { mesDeReferenciaPadrao, mesesFechados, periodosComparativos } from '../utils/comparativos';
import { formatCompetencia } from '../utils/formato';
import FunilGlosaComparativo from './FunilGlosaComparativo';

// Aba Contas a Receber → Comparativos. Casca da aba: seletor de mês de referência
// (referência, M-1 e M-2; padrão: último mês fechado) e o primeiro bloco, o volume de
// envio por convênio. Os blocos seguintes (funil, SLA, matriz…) entram sob o mesmo
// seletor. A permissão é a da tela Contas a Receber (ADR 0001): a rota da aba já a exige.

const MESES_NO_SELETOR = 24;
const MAX_CONVENIOS_NO_GRAFICO = 12;
// Referência na cor de destaque; os meses anteriores mais claros, para ler a tendência.
const CORES_MESES = ['#2563eb', '#60a5fa', '#bfdbfe'];

type Medida = 'qtdGuias' | 'qtdLotes';
const ROTULO_MEDIDA: Record<Medida, string> = { qtdGuias: 'Guias', qtdLotes: 'Lotes' };

const opcoesDeMes = () => mesesFechados(MESES_NO_SELETOR).map((value) => ({ value, label: formatCompetencia(value) }));

const CAMPO_SELECT = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const ComparativosPage: React.FC = () => {
  const { isDark } = useTheme();
  const [mes, setMes] = useState(() => mesDeReferenciaPadrao());
  const [medida, setMedida] = useState<Medida>('qtdGuias');
  const opcoes = useMemo(opcoesDeMes, []);

  const { periodos, volume, loading, erro, recarregar } = useComparativosVolumeEnvio(mes);
  // Enquanto a resposta não chega, os cabeçalhos já mostram os 3 meses escolhidos.
  const meses = useMemo(() => (periodos.length > 0 ? periodos : periodosComparativos(mes) ?? []), [periodos, mes]);

  const dadosGrafico = useMemo(
    () =>
      volume.slice(0, MAX_CONVENIOS_NO_GRAFICO).map((convenio) => ({
        convenio: convenio.nome ?? 'Não identificado',
        ...Object.fromEntries(convenio.meses.map((m) => [m.mes, m[medida]])),
      })),
    [volume, medida],
  );

  const axisTick = { fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' };
  const tooltipStyle: React.CSSProperties = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Mês de referência
          <Select value={mes} onChange={setMes} options={opcoes} controlClass={CAMPO_SELECT} wrapperClass="w-40" />
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 pb-2.5">
          Comparando {meses.map((p) => formatCompetencia(p.mes)).join(' · ')}
        </p>
      </div>

      <FunilGlosaComparativo mes={mes} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Volume de envio por convênio</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lotes enviados (Conciliação + Faturado), pela data de criação do lote. Guia = número de guia distinto no lote.
            </p>
          </div>
          <div className="flex gap-1">
            {(Object.keys(ROTULO_MEDIDA) as Medida[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMedida(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  medida === m
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {ROTULO_MEDIDA[m]}
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
        ) : volume.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhum lote enviado nos 3 meses comparados.
          </div>
        ) : (
          <>
            <div className="h-80 border border-gray-100 dark:border-gray-700 rounded-2xl p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.8)'} vertical={false} />
                  <XAxis dataKey="convenio" tick={axisTick} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: isDark ? '#e2e8f0' : '#334155' }}
                    labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                    formatter={(valor: number, nome: string) => [valor, `${ROTULO_MEDIDA[medida]} ${nome}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {meses.map((p, i) => (
                    <Bar key={p.mes} dataKey={p.mes} name={formatCompetencia(p.mes)} fill={CORES_MESES[i]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {volume.length > MAX_CONVENIOS_NO_GRAFICO && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                O gráfico mostra os {MAX_CONVENIOS_NO_GRAFICO} convênios de maior volume; a tabela lista todos.
              </p>
            )}

            <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40">
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Convênio</th>
                      {meses.map((p) => (
                        <th key={p.mes} colSpan={2} className="px-3 py-2 text-center">{formatCompetencia(p.mes)}</th>
                      ))}
                    </tr>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      {meses.flatMap((p) => [
                        <th key={`${p.mes}-l`} className="px-3 py-1 text-right font-normal">Lotes</th>,
                        <th key={`${p.mes}-g`} className="px-3 py-1 text-right font-normal">Guias</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {volume.map((convenio) => (
                      <tr key={convenio.fontePagadoraId ?? `sem-id-${convenio.nome}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[320px]">
                          {convenio.nome ?? 'Não identificado'}
                        </td>
                        {convenio.meses.flatMap((m) => [
                          <td key={`${m.mes}-l`} className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.qtdLotes}</td>,
                          <td key={`${m.mes}-g`} className="px-3 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">{m.qtdGuias}</td>,
                        ])}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ComparativosPage;
