import React, { useState } from 'react';
import { CORES_MESES } from '../utils/comparativos';
import { formatPercentual, rotuloMesComparativo } from '../utils/formato';
import type { LinhaBarrasPorConvenio } from './BarrasHorizontaisPorConvenio';

// Gráfico de pontos ligados (dumbbell) da aba Comparativos: uma linha por convênio, um ponto
// por mês e um traço do menor ao maior valor. Feito para percentuais (conversão): com quase
// todos os convênios perto de 100%, barras a partir de 0% ficavam todas iguais; aqui o eixo
// começa perto do menor valor e a queda de um mês aparece como distância entre os pontos.
// HTML puro (sem recharts): cada ponto é posicionado em % da largura da faixa.

interface Props {
  linhas: LinhaBarrasPorConvenio[];
  /** 'YYYY-MM', na ordem referência, M-1, M-2. */
  meses: string[];
  /** O que o ponto mede, para a legenda e o tooltip (ex.: "% de conversão"). */
  descricao: string;
}

/** Eixo de `inicio` a 100%, com `inicio` em dezena abaixo do menor valor (folga de 5 pontos). */
function escala(linhas: LinhaBarrasPorConvenio[]) {
  const valores = linhas.flatMap((l) => Object.values(l.valores)).filter((v): v is number => v !== null && v !== undefined);
  const menor = valores.length > 0 ? Math.min(...valores) : 0;
  const inicio = Math.max(0, Math.floor((menor - 5) / 10) * 10);
  const fim = 100;
  const amplitude = fim - inicio;
  const passo = amplitude <= 30 ? 5 : amplitude <= 60 ? 10 : 25;
  const marcas: number[] = [];
  for (let v = inicio; v <= fim; v += passo) marcas.push(v);
  const posicao = (v: number) => `${((Math.min(Math.max(v, inicio), fim) - inicio) / amplitude) * 100}%`;
  return { marcas, posicao };
}

/** Marcador de cada mês: o selecionado cheio e forte; M-1 cheio claro; M-2 vazado (o azul mais
 *  claro some no fundo branco, então a forma também diferencia, não só a cor). */
const Marcador: React.FC<{ indice: number; tamanho?: number }> = ({ indice, tamanho = 12 }) => {
  const cor = CORES_MESES[indice] ?? CORES_MESES[CORES_MESES.length - 1];
  const vazado = indice >= 2;
  return (
    <span
      className="block rounded-full ring-2 ring-white dark:ring-gray-900"
      style={{
        width: tamanho,
        height: tamanho,
        background: vazado ? 'transparent' : cor,
        border: vazado ? `2px solid ${CORES_MESES[1]}` : undefined,
      }}
    />
  );
};

const PontosPercentualPorConvenio: React.FC<Props> = ({ linhas, meses, descricao }) => {
  const [ativa, setAtiva] = useState<string | null>(null);
  const { marcas, posicao } = escala(linhas);
  const grade = 'grid grid-cols-[minmax(0,140px)_1fr] sm:grid-cols-[minmax(0,250px)_1fr] gap-x-3';

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-2xl p-3 space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        {meses.map((m, i) => (
          <li key={m} className="flex items-center gap-1.5">
            <Marcador indice={i} tamanho={10} />
            {rotuloMesComparativo(descricao, m, i)}
          </li>
        ))}
      </ul>

      <div role="list">
        {linhas.map((l) => {
          const pontos = meses
            .map((m, i) => ({ mes: m, indice: i, valor: l.valores[m] ?? null }))
            .filter((p): p is { mes: string; indice: number; valor: number } => p.valor !== null);
          const valores = pontos.map((p) => p.valor);
          const aberta = ativa === l.convenio;
          return (
            <div
              key={l.convenio}
              role="listitem"
              tabIndex={0}
              onMouseEnter={() => setAtiva(l.convenio)}
              onMouseLeave={() => setAtiva(null)}
              onFocus={() => setAtiva(l.convenio)}
              onBlur={() => setAtiva(null)}
              className={`${grade} items-center h-8 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${aberta ? 'bg-gray-50 dark:bg-gray-700/30' : ''}`}
            >
              <span className="truncate text-right text-[11px] text-gray-500 dark:text-gray-400" title={l.convenio}>
                {l.convenio}
              </span>
              <div className="relative h-full mr-4">
                {marcas.map((v) => (
                  <span key={v} className="absolute inset-y-0 border-l border-dashed border-gray-200 dark:border-gray-700/60" style={{ left: posicao(v) }} />
                ))}
                {valores.length > 1 && (
                  <span
                    className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-gray-300 dark:bg-gray-600"
                    style={{ left: posicao(Math.min(...valores)), width: `calc(${posicao(Math.max(...valores))} - ${posicao(Math.min(...valores))})` }}
                  />
                )}
                {/* Do mais antigo ao selecionado: o do mês selecionado fica por cima quando coincidem. */}
                {[...pontos].reverse().map((p) => (
                  <span key={p.mes} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: posicao(p.valor) }}>
                    <Marcador indice={p.indice} />
                  </span>
                ))}
                {aberta && (
                  <div
                    role="tooltip"
                    className="absolute z-10 bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs shadow-lg"
                    style={{ left: `clamp(80px, ${posicao(valores[0] ?? 100)}, calc(100% - 80px))` }}
                  >
                    <p className="font-semibold text-gray-500 dark:text-gray-400">{l.convenio}</p>
                    {meses.map((m, i) => (
                      <p key={m} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 tabular-nums">
                        <Marcador indice={i} tamanho={8} />
                        {rotuloMesComparativo(descricao, m, i)}: {l.valores[m] == null ? '—' : formatPercentual(l.valores[m] as number)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={grade}>
        <span />
        <div className="relative h-4 mr-4 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
          {marcas.map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: posicao(v) }}>
              {v}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PontosPercentualPorConvenio;
