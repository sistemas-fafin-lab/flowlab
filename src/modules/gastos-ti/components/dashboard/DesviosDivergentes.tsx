import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../../utils/paymentUtils';
import { POLOS_DIVERGENTES, type TemaGrafico } from '../../domain/coresCategorias';
import type { DesvioDespesa } from '../../domain/detalhamento';
import BarraAnimada from '../ui/BarraAnimada';
import { BalaoFlutuante } from '../ui/Flutuante';
import Vazio from '../ui/Vazio';
import { ANEL_FOCO_INTERNO, TABELA, TABELA_CAIXA, TABELA_TD, TABELA_TH, TABELA_THEAD, TABELA_TR } from '../ui/estilos';

const sinal = (v: number) => (v > 0 ? '+' : '−');
const pct = (p: number | null) => (p === null ? '' : ` (${sinal(p)}${Math.abs(p).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)`);

/** O ajuste do mês já previa o valor pago: o desvio foi antecipado, não surpresa. */
const antecipado = (d: DesvioDespesa) => Math.abs(d.previstoAjustado - d.pago) < 0.01 && Math.abs(d.previstoAjustado - d.previstoOriginal) >= 0.01;

/**
 * Maiores desvios contra o previsto original (RN11) em barras divergentes
 * (dataviz: polaridade em torno de zero): pagou mais → tom quente à direita,
 * pagou menos → tom frio à esquerda, linha do zero neutra. O valor com sinal fica
 * sempre visível; o detalhe (previsto ajustado) aparece num balão ao passar o
 * mouse ou focar a linha pelo teclado.
 */
const DesviosDivergentes: React.FC<{ desvios: DesvioDespesa[]; tema: TemaGrafico }> = ({ desvios, tema }) => {
  const [ativo, setAtivo] = useState<{ id: string; el: HTMLElement } | null>(null);
  if (desvios.length === 0) return <Vazio icone={CheckCircle2} tom="bom">Tudo pago exatamente como previsto no período.</Vazio>;

  const polos = POLOS_DIVERGENTES[tema];
  const escala = Math.max(...desvios.map((d) => Math.abs(d.desvio)));
  const selecionado = desvios.find((d) => d.despesaId === ativo?.id);

  return (
    <div onMouseLeave={() => setAtivo(null)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-600 dark:text-slate-300" aria-label="Legenda">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: polos.abaixo }} /> pagou menos
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: polos.acima }} /> pagou mais
        </li>
      </ul>
      <ol className="space-y-0.5">
        {desvios.map((d, i) => {
          const largura = (Math.abs(d.desvio) / escala) * 50;
          const acima = d.desvio > 0;
          return (
            <li
              key={d.despesaId}
              tabIndex={0}
              onMouseEnter={(e) => setAtivo({ id: d.despesaId, el: e.currentTarget })}
              onFocus={(e) => setAtivo({ id: d.despesaId, el: e.currentTarget })}
              onBlur={() => setAtivo(null)}
              aria-label={`${d.descricao}, ${d.fornecedorNome}: ${acima ? 'pagou a mais' : 'pagou a menos'} ${formatCurrency(Math.abs(d.desvio))}${pct(d.percentual)} contra o previsto original de ${formatCurrency(d.previstoOriginal)}; ajustado no mês ${formatCurrency(d.previstoAjustado)}`}
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${ANEL_FOCO_INTERNO} ${
                ativo?.id === d.despesaId ? 'bg-slate-100/80 dark:bg-slate-800/60' : ''
              }`}
            >
              <span className="min-w-0 text-xs">
                <span className="block truncate text-slate-700 dark:text-slate-200">{d.descricao}</span>
                <span className="block truncate text-slate-400">
                  {d.fornecedorNome}
                  {d.variavel && ' · variável'}
                </span>
              </span>
              <span aria-hidden="true" className="relative h-3">
                <span className="absolute inset-y-[-3px] left-1/2 w-px" style={{ backgroundColor: tema === 'dark' ? '#64748b' : '#94a3b8' }} />
                <span className={`absolute inset-y-0 ${acima ? 'left-1/2' : 'right-1/2'} w-1/2 flex ${acima ? 'justify-start' : 'justify-end'}`}>
                  <BarraAnimada
                    largura={largura * 2}
                    cor={acima ? polos.acima : polos.abaixo}
                    origem={acima ? 'esquerda' : 'direita'}
                    indice={i}
                    className={acima ? 'rounded-r-md' : 'rounded-l-md'}
                  />
                </span>
              </span>
              <span className="text-right text-xs tabular-nums whitespace-nowrap">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {sinal(d.desvio)}
                  {formatCurrency(Math.abs(d.desvio))}
                </span>
                <span className="text-slate-400">{pct(d.percentual)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-2 text-[11px] text-slate-400">Passe o mouse ou foque numa linha para ver o previsto ajustado no mês.</p>

      <BalaoFlutuante ancora={ativo?.el ?? null} largura={300}>
        {selecionado && (
          <>
            <p className="font-semibold text-white">{selecionado.descricao}</p>
            <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
              <dt className="text-slate-400">Previsto original</dt>
              <dd className="text-right">{formatCurrency(selecionado.previstoOriginal)}</dd>
              <dt className="text-slate-400">Ajustado no mês</dt>
              <dd className="text-right">{formatCurrency(selecionado.previstoAjustado)}</dd>
              <dt className="text-slate-400">Pago</dt>
              <dd className="text-right font-semibold text-white">{formatCurrency(selecionado.pago)}</dd>
            </dl>
            <p className="mt-1 text-slate-400">
              {selecionado.cobrancas} {selecionado.cobrancas === 1 ? 'cobrança' : 'cobranças'}
              {antecipado(selecionado) && ' · o ajuste do mês já previa esse valor'}
              {selecionado.variavel && ' · variável: o previsto é estimativa'}
            </p>
          </>
        )}
      </BalaoFlutuante>
    </div>
  );
};

/** Tabela equivalente. */
export const TabelaDesvios: React.FC<{ desvios: DesvioDespesa[] }> = ({ desvios }) => (
  <div className={TABELA_CAIXA}>
    <table className={TABELA}>
      <thead className={TABELA_THEAD}>
        <tr>
          <th scope="col" className={`${TABELA_TH} text-left`}>Despesa</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Previsto original</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Ajustado</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Pago</th>
          <th scope="col" className={`${TABELA_TH} text-right`}>Desvio</th>
        </tr>
      </thead>
      <tbody>
        {desvios.map((d) => (
          <tr key={d.despesaId} className={TABELA_TR}>
            <td className={TABELA_TD}>
              {d.descricao}
              <span className="text-slate-400"> · {d.fornecedorNome}</span>
            </td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(d.previstoOriginal)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(d.previstoAjustado)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums whitespace-nowrap`}>{formatCurrency(d.pago)}</td>
            <td className={`${TABELA_TD} text-right tabular-nums font-semibold whitespace-nowrap`}>
              {sinal(d.desvio)}
              {formatCurrency(Math.abs(d.desvio))}
              {pct(d.percentual)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DesviosDivergentes;
