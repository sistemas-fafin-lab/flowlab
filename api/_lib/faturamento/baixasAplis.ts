// api/_lib/faturamento/baixasAplis.ts
// Baixas sugeridas a partir do apLIS (.scratch/faturamento-baixas-automaticas-aplis/spec.md,
// "Regra das baixas sugeridas"): quanto lançar, e em que data, num título que a
// conferência apontou como `so-no-aplis` ou `aplis-maior`. Puro — o handler busca
// o recebido por data no apLIS e as baixas do sistema.
//
// Uma baixa por data de recebimento no apLIS: no sistema cada baixa é um depósito
// com data própria, e o apLIS registra o pagamento principal e os complementos
// (recurso) em datas diferentes.

import { centavos } from './conferenciaAplis.js';
import type { TipoDivergenciaAplis } from './conferenciaAplis.js';

/** Diferença máxima, em centavos, para as datas do apLIS "baterem" com a diferença. */
const TOLERANCIA_BATIDA_CENTAVOS = 100;

/** Os únicos tipos da conferência que geram baixa (spec, decisão 5). */
export type TipoComBaixa = Extract<TipoDivergenciaAplis, 'so-no-aplis' | 'aplis-maior'>;

export interface RecebidoAplisNaData {
  /** YYYY-MM-DD (`DATE(DtaRecebido)`). */
  data: string;
  valor: number;
  /** `aplis_id` dos lotes do título que receberam nessa data. */
  lotes: number[];
}

export interface BaixaSistema {
  /** YYYY-MM-DD (`recebimentos.data_receb`). */
  data: string;
  valor: number;
}

export interface BaixaSugerida {
  data: string;
  valor: number;
  observacoes: string;
}

export interface EntradaBaixasSugeridas {
  tipo: TipoComBaixa;
  recebidoSistema: number;
  recebidoAplis: number;
  recebidoAplisPorData: RecebidoAplisNaData[];
  baixasSistema: BaixaSistema[];
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function observacao(lotes: number[], data: string): string {
  const ids = [...new Set(lotes)].sort((a, b) => a - b);
  return `Baixa do apLIS — lote(s) ${ids.join(', ')} (recebido em ${dataBr(data)})`;
}

/**
 * Baixas a lançar num título divergente, em ordem de data:
 * - `so-no-aplis`: uma por data do apLIS, com o valor daquela data;
 * - `aplis-maior`: descarta as datas que já têm baixa no sistema; uma por data
 *   restante.
 * Nos dois, se as datas não batem com a diferença (tolerância R$ 1,00), vira uma
 * baixa só, com a diferença, na data do último recebimento no apLIS — no
 * `aplis-maior` o operador lançou em outras datas; no `so-no-aplis` o total do
 * apLIS tem estorno (valor negativo) ou recebimento sem data, e lançar as datas
 * passaria do recebido.
 * Data com valor abaixo de R$ 0,01 fica fora. Comparação em centavos.
 */
export function baixasSugeridas(entrada: EntradaBaixasSugeridas): BaixaSugerida[] {
  const datas = entrada.recebidoAplisPorData
    .filter((d) => centavos(d.valor) >= 1)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (datas.length === 0) return [];

  const porData = (lista: RecebidoAplisNaData[]): BaixaSugerida[] =>
    lista.map((d) => ({ data: d.data, valor: centavos(d.valor) / 100, observacoes: observacao(d.lotes, d.data) }));

  const datasNoSistema = new Set(entrada.baixasSistema.map((b) => b.data));
  const restantes = datas.filter((d) => !datasNoSistema.has(d.data));
  const diferenca = centavos(entrada.recebidoAplis) - centavos(entrada.recebidoSistema);
  const somaRestantes = restantes.reduce((soma, d) => soma + centavos(d.valor), 0);

  if (restantes.length > 0 && Math.abs(somaRestantes - diferenca) < TOLERANCIA_BATIDA_CENTAVOS) {
    return porData(restantes);
  }

  const ultima = datas[datas.length - 1].data;
  return [{
    data: ultima,
    valor: diferenca / 100,
    observacoes: observacao(datas.flatMap((d) => d.lotes), ultima),
  }];
}
