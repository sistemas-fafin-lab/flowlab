// Aba Contas a Receber → Comparativos: Glosa da DRE (CONTEXT.md) por mês de solicitação,
// a mesma regra do financeiro sobre a Análise de Faturamento do apLIS (coluna Glosa =
// líquido − recebido, só cobranças com motivo de glosa e saldo positivo, de requisições
// cobráveis). Funções puras, compartilhadas pela rota e pela tela: não importam nada do navegador.

import { anoEMes, periodoDoMes, type PeriodoComparativo } from './comparativos.js';

/** Janeiro até `mesReferencia` (inclusive), do mais antigo ao mais recente. `null` se o mês for inválido. */
export function periodosDoAnoAte(mesReferencia: string): PeriodoComparativo[] | null {
  const ref = anoEMes(mesReferencia);
  if (!ref) return null;
  return Array.from({ length: ref.mes }, (_, i) => periodoDoMes(ref.ano, i + 1));
}

/** Uma soma de glosa: valor e quantas cobranças entraram nela. */
export interface SomaGlosa {
  /** Soma de (líquido − recebido) das cobranças glosadas, em reais. */
  valor: number;
  /** Cobranças (procedimentos) que entraram na soma. */
  qtdCobrancas: number;
}

/** Glosa de um mês de solicitação ('YYYY-MM'), como a consulta devolve (e como a tela mostra). */
export interface GlosaMensal extends SomaGlosa {
  mes: string;
}

export interface GlosaPorMes {
  /** Um item por período, na mesma ordem. */
  meses: GlosaMensal[];
  total: SomaGlosa;
}

const paraCentavos = (valor: number) => Math.round(valor * 100);

/** Um item por período (mês sem glosa vira zero) e o total; linhas de outros meses são ignoradas. Soma em centavos. */
export function montarGlosaPorMes(periodos: PeriodoComparativo[], linhas: GlosaMensal[]): GlosaPorMes {
  const porMes = new Map(linhas.map((l) => [l.mes, l]));
  let totalCentavos = 0;
  let totalCobrancas = 0;

  const meses = periodos.map(({ mes }) => {
    const linha = porMes.get(mes);
    const centavos = linha ? paraCentavos(linha.valor) : 0;
    const qtdCobrancas = linha?.qtdCobrancas ?? 0;
    totalCentavos += centavos;
    totalCobrancas += qtdCobrancas;
    return { mes, valor: centavos / 100, qtdCobrancas };
  });

  return { meses, total: { valor: totalCentavos / 100, qtdCobrancas: totalCobrancas } };
}
