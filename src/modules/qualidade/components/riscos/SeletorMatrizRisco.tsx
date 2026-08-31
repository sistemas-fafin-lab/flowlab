// Matriz 5×5 de Probabilidade × Severidade — seleção + score e classificação
// calculados em tempo real.

import { classificarScore } from '../../domain/riscosClassificacao.js';
import type { FaixaClassificacaoRisco } from '../../types';
import { BADGE_NIVEL, ROTULO_NIVEL } from './rotulos.js';

const ROTULOS_PROBABILIDADE = ['1 – Raro', '2 – Improvável', '3 – Possível', '4 – Provável', '5 – Muito provável'];
const ROTULOS_SEVERIDADE = ['1 – Insignificante', '2 – Baixo', '3 – Moderado', '4 – Grave', '5 – Crítico'];

interface SeletorMatrizRiscoProps {
  probabilidade: number | null;
  severidade: number | null;
  onMudarProbabilidade: (valor: number) => void;
  onMudarSeveridade: (valor: number) => void;
  faixas: readonly FaixaClassificacaoRisco[];
}

function SeletorEscala({
  titulo,
  rotulos,
  valor,
  onMudar,
}: {
  titulo: string;
  rotulos: string[];
  valor: number | null;
  onMudar: (valor: number) => void;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{titulo}</span>
      <div className="mt-1 grid grid-cols-1 gap-1.5">
        {rotulos.map((rotulo, indice) => {
          const n = indice + 1;
          const ativo = valor === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onMudar(n)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                ativo
                  ? 'bg-blue-600 text-white'
                  : 'glass-field text-slate-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SeletorMatrizRisco({
  probabilidade,
  severidade,
  onMudarProbabilidade,
  onMudarSeveridade,
  faixas,
}: SeletorMatrizRiscoProps) {
  const score = probabilidade != null && severidade != null ? probabilidade * severidade : null;
  const nivel = classificarScore(score, faixas);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SeletorEscala titulo="Probabilidade" rotulos={ROTULOS_PROBABILIDADE} valor={probabilidade} onMudar={onMudarProbabilidade} />
        <SeletorEscala titulo="Impacto / Severidade" rotulos={ROTULOS_SEVERIDADE} valor={severidade} onMudar={onMudarSeveridade} />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 p-3 dark:border-white/10">
        <span className="text-sm text-gray-500 dark:text-slate-400">Score (P × S):</span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">{score ?? '—'}</span>
        {nivel && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_NIVEL[nivel]}`}>{ROTULO_NIVEL[nivel]}</span>
        )}
      </div>
    </div>
  );
}
