// Regras puras do "Aplicar baixas do apLIS"
// (.scratch/faturamento-baixas-automaticas-aplis/spec.md): o que a prévia
// oferece para lançar, o total marcado e o resumo da execução. As baixas
// sugeridas vêm prontas da rota (api/_lib/faturamento/baixasAplis.ts).

import type { TituloPreviaBaixasAplis } from '../types';
import { plural } from './formato';

export type MotivoPulado = 'sem número da nota' | 'sem data de recebimento no apLIS';

export interface TituloPulado {
  titulo: TituloPreviaBaixasAplis;
  motivo: MotivoPulado;
}

/** Aplicáveis (têm número e ao menos uma baixa) e pulados, com o motivo. O
 *  título com número e sem baixa é o lote com valor recebido mas sem
 *  `DtaRecebido` no apLIS: sem data não há como lançar. */
export function separarPrevia(titulos: TituloPreviaBaixasAplis[]): {
  aplicaveis: TituloPreviaBaixasAplis[];
  pulados: TituloPulado[];
} {
  const aplicaveis: TituloPreviaBaixasAplis[] = [];
  const pulados: TituloPulado[] = [];
  for (const titulo of titulos) {
    if (titulo.pulado === 'sem-nota') pulados.push({ titulo, motivo: 'sem número da nota' });
    else if (titulo.baixas.length === 0) pulados.push({ titulo, motivo: 'sem data de recebimento no apLIS' });
    else aplicaveis.push(titulo);
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

/** Seleção inicial: os aplicáveis, menos os que repetem baixa de outro título
 *  (o operador escolhe em qual dos dois lançar). */
export function selecaoPadraoBaixas(titulos: TituloPreviaBaixasAplis[]): Set<string> {
  const { aplicaveis } = separarPrevia(titulos);
  const repetidos = titulosComBaixaRepetida(aplicaveis);
  return new Set(aplicaveis.filter((t) => !repetidos.has(t.idNota)).map((t) => t.idNota));
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
