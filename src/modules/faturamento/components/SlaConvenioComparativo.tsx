import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../../components/PageLoadingSkeleton';
import { useComparativosSla, type FontesMarcos } from '../hooks/useComparativosSla';
import { formatCompetencia, formatPercentual, plural } from '../utils/formato';
import type { EtapaSla, SlaGrupo, SlaMes } from '../utils/slaFaturamento';

// Aba Comparativos → SLA por convênio (issue 06). Dias médios entre os marcos de cada
// requisição (cadastro → envio ao faturamento → recebido no faturamento → faturado) e o
// tempo de liquidação (faturado → recebido) com o % já recebido. A requisição entra no mês
// em que foi faturada. Total dos 3 meses lado a lado; por convênio, um mês por vez.

interface Props {
  mes: string;
}

type ChaveEtapa = 'cadastroEnvio' | 'envioRecebido' | 'recebidoFaturado' | 'liquidacao';

const ETAPAS: { chave: ChaveEtapa; rotulo: string }[] = [
  { chave: 'cadastroEnvio', rotulo: 'Cadastro → envio' },
  { chave: 'envioRecebido', rotulo: 'Envio → recebido no fat.' },
  { chave: 'recebidoFaturado', rotulo: 'Recebido no fat. → faturado' },
  { chave: 'liquidacao', rotulo: 'Liquidação' },
];

const ROTULO_FONTE: { chave: keyof FontesMarcos; rotulo: string }[] = [
  { chave: 'cadastro', rotulo: 'Cadastro' },
  { chave: 'envio', rotulo: 'Envio ao faturamento' },
  { chave: 'recebido', rotulo: 'Recebido no faturamento' },
  { chave: 'faturado', rotulo: 'Faturado' },
  { chave: 'liquidado', rotulo: 'Recebido (liquidação)' },
];

const TH = 'px-3 py-2 font-normal text-xs text-gray-500 dark:text-gray-400';
const TD = 'px-3 py-2 tabular-nums text-right text-gray-700 dark:text-gray-300';

const botao = (ativo: boolean) => `px-3 py-1.5 rounded-lg text-xs font-medium ${
  ativo
    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    : 'border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
}`;

/** 3.8 → "3,8 d". */
const formatDias = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} d`;

/** "3,8 d" (média); a mediana e as contagens vão na dica. Sem dado: "—". */
const CelulaEtapa: React.FC<{ etapa: EtapaSla; destaque?: boolean }> = ({ etapa, destaque }) => {
  if (etapa.mediaDias === null) {
    return (
      <td className={`${TD} text-gray-400 dark:text-gray-500`} title={etapa.descartados > 0 ? `${plural(etapa.descartados, 'descartada', 'descartadas')} (fora de ordem)` : 'Sem dados'}>
        —
      </td>
    );
  }
  const dica = [
    `Mediana ${formatDias(etapa.medianaDias ?? 0)}`,
    plural(etapa.qtd, 'requisição', 'requisições'),
    etapa.descartados > 0 ? `${plural(etapa.descartados, 'descartada', 'descartadas')} (fora de ordem)` : null,
  ].filter(Boolean).join(' · ');
  return (
    <td className={`${TD} ${destaque ? 'font-medium text-gray-900 dark:text-gray-100' : ''}`} title={dica}>
      {formatDias(etapa.mediaDias)}
    </td>
  );
};

const CelulaRecebido: React.FC<{ grupo: SlaGrupo }> = ({ grupo }) => {
  const { percentualRecebido, qtdRecebidas } = grupo.liquidacao;
  return (
    <td className={TD} title={`${qtdRecebidas} de ${plural(grupo.qtdRequisicoes, 'requisição', 'requisições')}`}>
      {percentualRecebido === null ? '—' : formatPercentual(percentualRecebido)}
    </td>
  );
};

/** Descartes e fallbacks do mês, para a média não parecer mais limpa do que é. */
function notasDoMes(total: SlaGrupo): string[] {
  const descartados = ETAPAS.reduce((s, e) => s + total[e.chave].descartados, 0);
  const notas: string[] = [];
  if (descartados > 0) notas.push(`${plural(descartados, 'intervalo fora de ordem descartado', 'intervalos fora de ordem descartados')} das médias`);
  if (total.fallbacks.cadastroPelaSolicitacao > 0) {
    notas.push(`${plural(total.fallbacks.cadastroPelaSolicitacao, 'requisição', 'requisições')} sem "Admissão" no histórico (cadastro = data de solicitação)`);
  }
  if (total.fallbacks.faturadoPelaCriacao > 0) {
    notas.push(`${plural(total.fallbacks.faturadoPelaCriacao, 'requisição', 'requisições')} em lote sem fechamento (faturado = criação do lote)`);
  }
  return notas;
}

const TotaisDosMeses: React.FC<{ sla: SlaMes[] }> = ({ sla }) => (
  <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-700/40">
        <tr>
          <th className={`${TH} text-left`}>Total (todos os convênios)</th>
          {sla.map((m) => <th key={m.mes} className={`${TH} text-right`}>{formatCompetencia(m.mes)}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        <tr>
          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">Requisições faturadas</td>
          {sla.map((m) => <td key={m.mes} className={TD}>{m.total.qtdRequisicoes.toLocaleString('pt-BR')}</td>)}
        </tr>
        {ETAPAS.map((e) => (
          <tr key={e.chave}>
            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{e.rotulo}</td>
            {sla.map((m) => <CelulaEtapa key={m.mes} etapa={m.total[e.chave]} destaque />)}
          </tr>
        ))}
        <tr>
          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">% já recebido</td>
          {sla.map((m) => <CelulaRecebido key={m.mes} grupo={m.total} />)}
        </tr>
      </tbody>
    </table>
  </div>
);

const SlaConvenioComparativo: React.FC<Props> = ({ mes }) => {
  const { sla, fontes, loading, erro, recarregar } = useComparativosSla(mes);
  const [mesAtivo, setMesAtivo] = useState(mes);

  // Trocar o mês de referência volta para ele.
  useEffect(() => setMesAtivo(mes), [mes]);

  const doMes = sla.find((m) => m.mes === mesAtivo) ?? sla[0];
  const notas = doMes ? notasDoMes(doMes.total) : [];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">SLA por convênio e tempo de liquidação</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dias médios entre os marcos de cada requisição, no mês em que ela foi faturada (passe o mouse para ver a mediana).
          A liquidação conta só as requisições já recebidas; o % já recebido mostra quantas são.
        </p>
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
      ) : !doMes ? null : (
        <>
          <TotaisDosMeses sla={sla} />

          <div className="flex flex-wrap gap-1">
            {sla.map((m) => (
              <button key={m.mes} type="button" onClick={() => setMesAtivo(m.mes)} className={botao(m.mes === doMes.mes)}>
                {formatCompetencia(m.mes)} · {plural(m.total.qtdRequisicoes, 'requisição', 'requisições')}
              </button>
            ))}
          </div>

          {doMes.convenios.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhuma requisição faturada em {formatCompetencia(doMes.mes)}.
            </div>
          ) : (
            <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/40">
                  <tr>
                    <th className={`${TH} text-left`}>Convênio</th>
                    <th className={`${TH} text-right`}>Requisições</th>
                    {ETAPAS.map((e) => <th key={e.chave} className={`${TH} text-right`}>{e.rotulo}</th>)}
                    <th className={`${TH} text-right`}>% já recebido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {doMes.convenios.map((c) => (
                    <tr key={c.fontePagadoraId ?? `sem-id-${c.nome}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100 truncate max-w-[280px]">{c.nome ?? 'Não identificado'}</td>
                      <td className={TD}>{c.qtdRequisicoes.toLocaleString('pt-BR')}</td>
                      {ETAPAS.map((e) => <CelulaEtapa key={e.chave} etapa={c[e.chave]} />)}
                      <CelulaRecebido grupo={c} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notas.length > 0 && (
            <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc pl-5 space-y-0.5">
              {notas.map((n) => <li key={n}>{formatCompetencia(doMes.mes)}: {n}.</li>)}
            </ul>
          )}

          {fontes && (
            <dl className="text-xs text-gray-500 dark:text-gray-400 grid gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]">
              {ROTULO_FONTE.map((f) => (
                <React.Fragment key={f.chave}>
                  <dt className="font-medium text-gray-600 dark:text-gray-300">{f.rotulo}</dt>
                  <dd>{fontes[f.chave]}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
};

export default SlaConvenioComparativo;
