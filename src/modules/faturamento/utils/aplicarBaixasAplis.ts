// Regras puras do "Aplicar baixas do apLIS"
// (.scratch/faturamento-baixas-automaticas-aplis/spec.md): o que a prévia
// oferece para lançar, o total marcado e o resumo da execução. As baixas
// sugeridas vêm prontas da rota (api/_lib/faturamento/baixasAplis.ts), e as
// glosas também (api/_lib/faturamento/glosasAplis.ts) — por ora só para
// conferência, sem lançar (.scratch/faturamento-glosas-automaticas-aplis, issue 01).

import type { TituloPreviaBaixasAplis } from '../types';
import { plural } from './formato';

export type MotivoPulado = 'sem número da nota' | 'sem data de recebimento no apLIS';

export interface TituloPulado {
  titulo: TituloPreviaBaixasAplis;
  /** Por que a baixa ficou de fora; null quando o título não tem baixa a lançar. */
  motivo: MotivoPulado | null;
  motivoGlosa: string | null;
}

/** Tem baixa que dá para lançar (número da nota e ao menos uma baixa). */
export function temBaixaAplicavel(titulo: TituloPreviaBaixasAplis): boolean {
  return titulo.pulado === null && titulo.baixas.length > 0;
}

/** Por que a baixa do título ficou de fora. Só o título com recebido a lançar
 *  tem baixa; com número e sem baixa é o lote com valor recebido mas sem
 *  `DtaRecebido` no apLIS: sem data não há como lançar. */
export function motivoPuladoBaixa(titulo: TituloPreviaBaixasAplis): MotivoPulado | null {
  if (titulo.tipo !== 'so-no-aplis' && titulo.tipo !== 'aplis-maior') return null;
  if (titulo.pulado === 'sem-nota') return 'sem número da nota';
  if (titulo.baixas.length === 0) return 'sem data de recebimento no apLIS';
  return null;
}

/** Por que a glosa do título ficou de fora, em texto para o operador. */
export function motivoPuladoGlosa(titulo: TituloPreviaBaixasAplis): string | null {
  switch (titulo.puladoGlosa) {
    case 'sem-motivo': return 'diferença sem motivo no apLIS';
    case 'glosa-manual': return 'título já tem glosa lançada';
    case 'passa-do-saldo': return 'glosa passa do saldo do título';
    case 'sem-nota': return 'sem número da nota';
    case 'tipo': return titulo.tipo === 'lote-ausente' ? 'lote não encontrado no apLIS' : 'recebido aqui maior que no apLIS';
    default: return null;
  }
}

/** Aplicáveis (baixa a lançar ou glosa sugerida) e pulados (nada a lançar),
 *  com os motivos. */
export function separarPrevia(titulos: TituloPreviaBaixasAplis[]): {
  aplicaveis: TituloPreviaBaixasAplis[];
  pulados: TituloPulado[];
} {
  const aplicaveis: TituloPreviaBaixasAplis[] = [];
  const pulados: TituloPulado[] = [];
  for (const titulo of titulos) {
    if (temBaixaAplicavel(titulo) || titulo.glosas.length > 0) aplicaveis.push(titulo);
    else pulados.push({ titulo, motivo: motivoPuladoBaixa(titulo), motivoGlosa: motivoPuladoGlosa(titulo) });
  }
  return { aplicaveis, pulados };
}

/** Títulos que sugerem uma baixa idêntica (data, valor e lotes da observação)
 *  à de outro título: lote vinculado aos dois, e lançar nos dois contaria o
 *  mesmo recebimento duas vezes (issue 01, comentários). */
export function titulosComBaixaRepetida(titulos: TituloPreviaBaixasAplis[]): Set<string> {
  const porBaixa = new Map<string, Set<string>>();
  for (const titulo of titulos) {
    for (const baixa of titulo.baixas) {
      const chave = `${baixa.data}|${Math.round(baixa.valor * 100)}|${baixa.observacoes}`;
      const idsNota = porBaixa.get(chave) ?? new Set<string>();
      idsNota.add(titulo.idNota);
      porBaixa.set(chave, idsNota);
    }
  }
  const repetidos = new Set<string>();
  for (const idsNota of porBaixa.values()) {
    if (idsNota.size > 1) idsNota.forEach((id) => repetidos.add(id));
  }
  return repetidos;
}

/** Seleção inicial: os títulos com baixa a lançar, menos os que repetem baixa
 *  de outro título (o operador escolhe em qual dos dois lançar). */
export function selecaoPadraoBaixas(titulos: TituloPreviaBaixasAplis[]): Set<string> {
  const comBaixa = titulos.filter(temBaixaAplicavel);
  const repetidos = titulosComBaixaRepetida(comBaixa);
  return new Set(comBaixa.filter((t) => !repetidos.has(t.idNota)).map((t) => t.idNota));
}

/** Quanto os títulos marcados vão lançar. Soma em centavos (0,1 + 0,2). */
export function totalALancar(
  titulos: TituloPreviaBaixasAplis[],
  marcados: ReadonlySet<string>,
): { titulos: number; baixas: number; valor: number } {
  let qtdTitulos = 0;
  let baixas = 0;
  let centavos = 0;
  for (const titulo of titulos) {
    if (!marcados.has(titulo.idNota)) continue;
    qtdTitulos += 1;
    baixas += titulo.baixas.length;
    for (const baixa of titulo.baixas) centavos += Math.round(baixa.valor * 100);
  }
  return { titulos: qtdTitulos, baixas, valor: centavos / 100 };
}

/** Glosas sugeridas na prévia (ainda só para conferência). Soma em centavos. */
export function totalGlosasSugeridas(
  titulos: TituloPreviaBaixasAplis[],
): { titulos: number; glosas: number; valor: number } {
  let qtdTitulos = 0;
  let glosas = 0;
  let centavos = 0;
  for (const titulo of titulos) {
    if (titulo.glosas.length === 0) continue;
    qtdTitulos += 1;
    glosas += titulo.glosas.length;
    for (const glosa of titulo.glosas) centavos += Math.round(glosa.valor * 100);
  }
  return { titulos: qtdTitulos, glosas, valor: centavos / 100 };
}

/** 'parcial': uma baixa do título falhou depois de outra já lançada — o
 *  restante dele não é tentado (fica para a próxima prévia). */
export type EstadoAplicacao = 'aguardando' | 'lancando' | 'lancado' | 'parcial' | 'falhou';

export function resumoAplicacao(estados: Iterable<EstadoAplicacao>): {
  lancados: number;
  parciais: number;
  falharam: number;
  texto: string;
} {
  let lancados = 0;
  let parciais = 0;
  let falharam = 0;
  for (const estado of estados) {
    if (estado === 'lancado') lancados += 1;
    else if (estado === 'parcial') parciais += 1;
    else if (estado === 'falhou') falharam += 1;
  }
  const partes = [plural(lancados, 'título lançado', 'títulos lançados')];
  if (parciais > 0) partes.push(plural(parciais, 'lançado em parte', 'lançados em parte'));
  if (falharam > 0) partes.push(`${falharam} ${falharam === 1 ? 'falhou' : 'falharam'}`);
  return { lancados, parciais, falharam, texto: partes.join(', ') };
}
