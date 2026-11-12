// Meta sugerida (faturamento-meta-sugerida): as três candidatas da meta de um mês a partir
// dos Elegíveis dos meses anteriores. Função pura, compartilhada pela rota (api/) e pela
// tela, como comparativos.ts — por isso não importa nada do navegador.

import { anoEMes, periodoDoMes } from './comparativos.js';

export type OrigemCandidata = '90_10' | 'media_2' | 'media_3';

export interface CandidataMeta {
  origem: OrigemCandidata;
  /** Em reais, arredondado em centavos; `null` se faltar Elegíveis de algum mês usado. */
  valor: number | null;
  /** Meses usados ('YYYY-MM'), do mais recente ao mais antigo. */
  meses: string[];
}

export interface CandidatasDoMes {
  /** Mês da meta, 'YYYY-MM'. */
  mes: string;
  candidatas: CandidataMeta[];
}

/** Elegíveis por mês ('YYYY-MM' → R$). Mês ausente = sem dado. */
export type ElegiveisPorMes = Partial<Record<string, number>>;

/** Os `quantidade` meses anteriores a `mes`, do mais recente ao mais antigo (atravessa a virada de ano). */
export function mesesAnteriores(mes: string, quantidade: number): string[] {
  const ref = anoEMes(mes);
  if (!ref) return [];
  return Array.from({ length: quantidade }, (_, i) => periodoDoMes(ref.ano, ref.mes - 1 - i).mes);
}

/** Peso inteiro de cada mês (do mais recente ao mais antigo) e o divisor da fórmula. */
const FORMULAS: Record<OrigemCandidata, { pesos: number[]; divisor: number }> = {
  '90_10': { pesos: [9, 1], divisor: 10 },
  media_2: { pesos: [1, 1], divisor: 2 },
  media_3: { pesos: [1, 1, 1], divisor: 3 },
};

const ORDEM: OrigemCandidata[] = ['90_10', 'media_2', 'media_3'];

/**
 * 90/10 = 0,9 × E(M-1) + 0,1 × E(M-2); média de 2 = (E(M-1) + E(M-2)) / 2; média de 3 =
 * (E(M-1) + E(M-2) + E(M-3)) / 3. A conta é exata e arredondada em centavos só no fim.
 */
export function calcularCandidatas(mes: string, elegiveis: ElegiveisPorMes): CandidatasDoMes {
  const anteriores = mesesAnteriores(mes, 3);
  return {
    mes,
    candidatas: ORDEM.map((origem) => {
      const { pesos, divisor } = FORMULAS[origem];
      const meses = anteriores.slice(0, pesos.length);
      const valores = meses.map((m) => elegiveis[m]);
      if (valores.some((v) => v === undefined || !Number.isFinite(v))) return { origem, valor: null, meses };
      // Em décimos de milésimo (as 4 casas do DECIMAL do apLIS), para a soma ser exata e o
      // único arredondamento, em centavos, ficar no resultado.
      const soma = valores.reduce<number>((total, v, i) => total + Math.round(v! * 10_000) * pesos[i], 0);
      return { origem, valor: Math.round(soma / divisor / 100) / 100, meses };
    }),
  };
}
