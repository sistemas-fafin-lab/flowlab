import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import Select from '../../../components/Select';
import { useComparativosVolumeEnvio } from '../hooks/useComparativosVolumeEnvio';
import {
  conveniosDoGraficoDeVolume,
  mesDeReferenciaPadrao,
  mesesFechados,
  periodosComparativos,
  type MedidaVolumeEnvio,
} from '../utils/comparativos';
import { formatCompetencia, formatCurrency, formatInteiro, formatMoedaCompacta } from '../utils/formato';
import BarrasHorizontaisPorConvenio from './BarrasHorizontaisPorConvenio';
import ConversaoRequisicoesComparativo from './ConversaoRequisicoesComparativo';
import FunilGlosaComparativo from './FunilGlosaComparativo';
import GlosaPorMesComparativo from './GlosaPorMesComparativo';
import RankingCodigosGlosaComparativo from './RankingCodigosGlosaComparativo';
import SlaConvenioComparativo from './SlaConvenioComparativo';

// Aba Contas a Receber → Comparativos. Casca da aba: seletor de mês de referência
// (referência, M-1 e M-2; padrão: último mês fechado), o funil de glosa, o ranking de códigos de
// glosa, a Glosa da DRE
// por mês de solicitação (jan até a referência), o SLA por convênio, o volume de envio
// por convênio e a conversão de requisições. Os blocos seguintes entram sob o mesmo seletor. A permissão é a da tela Contas a Receber (ADR 0001): a rota da aba já a exige.

const MESES_NO_SELETOR = 24;
const MAX_CONVENIOS_NO_GRAFICO = 15;

const ROTULO_MEDIDA: Record<MedidaVolumeEnvio, string> = { qtdGuias: 'Guias', qtdLotes: 'Lotes', valor: 'Valor' };

/** Eixo e tooltip do gráfico de volume, conforme a medida: R$ compacto no eixo, completo no tooltip. */
const FORMATO_MEDIDA: Record<MedidaVolumeEnvio, { eixo: (n: number) => string; tooltip: (n: number) => string }> = {
  qtdGuias: { eixo: formatInteiro, tooltip: formatInteiro },
  qtdLotes: { eixo: formatInteiro, tooltip: formatInteiro },
  valor: { eixo: formatMoedaCompacta, tooltip: formatCurrency },
};

const opcoesDeMes = () => mesesFechados(MESES_NO_SELETOR).map((value) => ({ value, label: formatCompetencia(value) }));

const CAMPO_SELECT = 'mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100';

const ComparativosPage: React.FC = () => {
  const [mes, setMes] = useState(() => mesDeReferenciaPadrao());
  const [medida, setMedida] = useState<MedidaVolumeEnvio>('qtdGuias');
  const opcoes = useMemo(opcoesDeMes, []);

  const { periodos, volume, loading, erro, recarregar } = useComparativosVolumeEnvio(mes);
  // Enquanto a resposta não chega, os cabeçalhos já mostram os 3 meses escolhidos.
  const meses = useMemo(() => (periodos.length > 0 ? periodos : periodosComparativos(mes) ?? []), [periodos, mes]);

  // Os MAX_CONVENIOS_NO_GRAFICO de maior volume no mês de referência, na medida escolhida; a tabela segue com todos.
  const linhasGrafico = useMemo(
    () =>
      conveniosDoGraficoDeVolume(volume, medida, MAX_CONVENIOS_NO_GRAFICO).map((convenio) => ({
        convenio: convenio.nome ?? 'Não identificado',
        valores: Object.fromEntries(convenio.meses.map((m) => [m.mes, m[medida]])),
      })),
    [volume, medida],
  );

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

      <RankingCodigosGlosaComparativo mes={mes} />

      <GlosaPorMesComparativo mes={mes} />

      <SlaConvenioComparativo mes={mes} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Volume de envio por convênio</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lotes enviados (Conciliação + Faturado), pela data de criação do lote. Guia = número de guia distinto no lote. Valor = líquido das requisições do lote.
            </p>
          </div>
          <div className="flex gap-1">
            {(Object.keys(ROTULO_MEDIDA) as MedidaVolumeEnvio[]).map((m) => (
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
            <BarrasHorizontaisPorConvenio
              linhas={linhasGrafico}
              meses={meses.map((p) => p.mes)}
              formatarEixo={FORMATO_MEDIDA[medida].eixo}
              formatarTooltip={FORMATO_MEDIDA[medida].tooltip}
            />
            {volume.length > MAX_CONVENIOS_NO_GRAFICO && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                O gráfico mostra os {MAX_CONVENIOS_NO_GRAFICO} convênios de maior volume em {formatCompetencia(meses[0]?.mes)}; a tabela lista todos.
              </p>
            )}

            <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/40">
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th rowSpan={2} className="px-3 py-2 text-left align-bottom">Convênio</th>
                      {meses.map((p) => (
                        <th key={p.mes} colSpan={3} className="px-3 py-2 text-center">{formatCompetencia(p.mes)}</th>
                      ))}
                    </tr>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      {meses.flatMap((p) => [
                        <th key={`${p.mes}-l`} className="px-3 py-1 text-right font-normal">Lotes</th>,
                        <th key={`${p.mes}-g`} className="px-3 py-1 text-right font-normal">Guias</th>,
                        <th key={`${p.mes}-v`} className="px-3 py-1 text-right font-normal">Valor</th>,
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
                          <td key={`${m.mes}-v`} className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-gray-700 dark:text-gray-300">{formatCurrency(m.valor)}</td>,
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

      <ConversaoRequisicoesComparativo mes={mes} />
    </div>
  );
};

export default ComparativosPage;
