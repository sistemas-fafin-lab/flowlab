import { useState } from 'react';
import { classificarScore } from '../../../domain/riscosClassificacao.js';
import type { FaixaClassificacaoRisco, NivelClassificacaoRisco, TratamentoRisco } from '../../../types';
import { COR_NIVEL_HEX, ROTULO_NIVEL, ROTULO_TRATAMENTO } from '../../riscos/rotulos.js';

export interface PontoRiscoHeatmap {
  riscoId: string;
  setorNome: string;
  processo: string;
  riscoIdentificado: string;
  probabilidade: number;
  severidade: number;
  nivel: NivelClassificacaoRisco | null;
  status: TratamentoRisco | null;
}

interface HeatmapMatrizRiscoProps {
  pontos: readonly PontoRiscoHeatmap[];
  faixas: readonly FaixaClassificacaoRisco[];
  tema: 'light' | 'dark';
  onClicarPonto: (riscoId: string) => void;
}

const LARGURA = 520;
const ALTURA = 440;
const MARGEM = { topo: 12, base: 44, esquerda: 56, direita: 12 };
const CELULAS = 5;

function chaveCelula(p: number, s: number): string {
  return `${p}-${s}`;
}

/**
 * Dispersa os pontos de um grupo (mesmo P×S) em espiral dourada, determinística
 * pela ordem do grupo (já ordenado por `riscoId` por quem monta os grupos) —
 * não pelo índice bruto do array de entrada, então a posição de cada risco não
 * pula de lugar entre renders só porque a ordem de chegada do fetch mudou.
 */
function deslocamentoEspiral(indice: number, total: number, raioMax: number): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 };
  const anguloAureo = 137.508 * (Math.PI / 180);
  const raio = raioMax * Math.sqrt((indice + 0.5) / total);
  const angulo = indice * anguloAureo;
  return { dx: raio * Math.cos(angulo), dy: raio * Math.sin(angulo) };
}

/**
 * Grade fixa 5×5 (Probabilidade × Severidade), fundo em degradê por faixa de
 * classificação, riscos plotados como pontos individuais dispersos dentro da
 * célula (nunca agregados numa célula só) — hover com detalhe, clique abre o
 * drawer de gerenciamento do risco correspondente.
 */
export function HeatmapMatrizRisco({ pontos, faixas, tema, onClicarPonto }: HeatmapMatrizRiscoProps) {
  const [focoId, setFocoId] = useState<string | null>(null);

  const areaLargura = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const areaAltura = ALTURA - MARGEM.topo - MARGEM.base;
  const larguraCelula = areaLargura / CELULAS;
  const alturaCelula = areaAltura / CELULAS;

  function coordXCelula(probabilidade: number): number {
    return MARGEM.esquerda + (probabilidade - 1) * larguraCelula;
  }
  // Severidade 1 embaixo, 5 em cima — leitura clássica de matriz de risco.
  function coordYCelula(severidade: number): number {
    return MARGEM.topo + (CELULAS - severidade) * alturaCelula;
  }

  const grupos = new Map<string, PontoRiscoHeatmap[]>();
  for (const ponto of [...pontos].sort((a, b) => a.riscoId.localeCompare(b.riscoId))) {
    const chave = chaveCelula(ponto.probabilidade, ponto.severidade);
    const lista = grupos.get(chave) ?? [];
    lista.push(ponto);
    grupos.set(chave, lista);
  }

  const raioMaxJitter = Math.min(larguraCelula, alturaCelula) / 2 - 10;
  const pontoEmFoco = focoId ? pontos.find((p) => p.riscoId === focoId) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Heatmap de riscos por Probabilidade e Severidade">
        {Array.from({ length: CELULAS }, (_, pIndice) =>
          Array.from({ length: CELULAS }, (_, sIndice) => {
            const p = pIndice + 1;
            const s = sIndice + 1;
            const nivelCelula = classificarScore(p * s, faixas);
            const cor = nivelCelula ? COR_NIVEL_HEX[nivelCelula] : undefined;
            return (
              <rect
                key={chaveCelula(p, s)}
                x={coordXCelula(p)}
                y={coordYCelula(s)}
                width={larguraCelula}
                height={alturaCelula}
                fill={cor ?? 'transparent'}
                fillOpacity={tema === 'dark' ? 0.22 : 0.16}
                stroke={tema === 'dark' ? '#ffffff1a' : '#0000000f'}
                strokeWidth={1}
              />
            );
          }),
        )}

        {Array.from({ length: CELULAS }, (_, i) => (
          <text
            key={`x-${i}`}
            x={coordXCelula(i + 1) + larguraCelula / 2}
            y={ALTURA - MARGEM.base + 16}
            textAnchor="middle"
            className="fill-gray-500 text-[10px] dark:fill-slate-400"
          >
            {i + 1}
          </text>
        ))}
        <text x={MARGEM.esquerda + areaLargura / 2} y={ALTURA - 6} textAnchor="middle" className="fill-gray-500 text-[10px] font-medium dark:fill-slate-400">
          Probabilidade
        </text>

        {Array.from({ length: CELULAS }, (_, i) => (
          <text
            key={`y-${i}`}
            x={MARGEM.esquerda - 12}
            y={coordYCelula(i + 1) + alturaCelula / 2 + 3}
            textAnchor="end"
            className="fill-gray-500 text-[10px] dark:fill-slate-400"
          >
            {i + 1}
          </text>
        ))}
        <text
          x={14}
          y={MARGEM.topo + areaAltura / 2}
          textAnchor="middle"
          transform={`rotate(-90, 14, ${MARGEM.topo + areaAltura / 2})`}
          className="fill-gray-500 text-[10px] font-medium dark:fill-slate-400"
        >
          Severidade
        </text>

        {[...grupos.entries()].flatMap(([chave, grupo]) => {
          const [pTxt, sTxt] = chave.split('-');
          const centroX = coordXCelula(Number(pTxt)) + larguraCelula / 2;
          const centroY = coordYCelula(Number(sTxt)) + alturaCelula / 2;
          return grupo.map((ponto, indice) => {
            const { dx, dy } = deslocamentoEspiral(indice, grupo.length, raioMaxJitter);
            const cx = centroX + dx;
            const cy = centroY + dy;
            const cor = ponto.nivel ? COR_NIVEL_HEX[ponto.nivel] : '#94a3b8';
            return (
              <circle
                key={ponto.riscoId}
                cx={cx}
                cy={cy}
                r={focoId === ponto.riscoId ? 6 : 4.5}
                fill={cor}
                className="cursor-pointer stroke-white dark:stroke-gray-800"
                strokeWidth={1.5}
                onMouseEnter={() => setFocoId(ponto.riscoId)}
                onMouseLeave={() => setFocoId((atual) => (atual === ponto.riscoId ? null : atual))}
                onClick={() => onClicarPonto(ponto.riscoId)}
              />
            );
          });
        })}
      </svg>

      {pontoEmFoco && (
        <div
          role="tooltip"
          className="glass-surface pointer-events-none absolute top-2 left-2 max-w-[16rem] rounded-lg px-3 py-2 text-xs shadow-lg"
        >
          <p className="mb-1 font-semibold text-slate-800 dark:text-slate-100">{pontoEmFoco.riscoIdentificado}</p>
          <p className="text-slate-600 dark:text-slate-300">Setor: {pontoEmFoco.setorNome}</p>
          <p className="text-slate-600 dark:text-slate-300">Processo: {pontoEmFoco.processo}</p>
          <p className="text-slate-600 dark:text-slate-300">
            P: {pontoEmFoco.probabilidade} · S: {pontoEmFoco.severidade}
          </p>
          <p className="text-slate-600 dark:text-slate-300">Nível: {pontoEmFoco.nivel ? ROTULO_NIVEL[pontoEmFoco.nivel] : '—'}</p>
          <p className="text-slate-600 dark:text-slate-300">Status: {pontoEmFoco.status ? ROTULO_TRATAMENTO[pontoEmFoco.status] : '—'}</p>
        </div>
      )}
    </div>
  );
}
