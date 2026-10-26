// Regras do "Aplicar baixas do apLIS"
// (.scratch/faturamento-baixas-automaticas-aplis/spec.md): o que a prévia
// oferece para lançar, o total marcado, a execução de um título e o resumo. As
// baixas sugeridas vêm prontas da rota (api/_lib/faturamento/baixasAplis.ts).
// A parte de glosas saiu (.scratch/glosas-recursos-dashboard, issue 13): a
// glosa do título vem da foto de Glosas e Recursos.

import type { BaixaInput, TituloPreviaBaixasAplis } from '../types';
import { plural } from './formato';

export type MotivoPulado = 'sem data de recebimento no apLIS';

export interface TituloPulado {
  titulo: TituloPreviaBaixasAplis;
  motivo: MotivoPulado;
}

/** Tem baixa que dá para lançar. */
export function temBaixaAplicavel(titulo: TituloPreviaBaixasAplis): boolean {
  return titulo.baixas.length > 0;
}

/** Aplicáveis (baixa a lançar) e pulados: o lote tem valor recebido mas sem
 *  `DtaRecebido` no apLIS, e sem data não há como lançar. */
export function separarPrevia(titulos: TituloPreviaBaixasAplis[]): {
  aplicaveis: TituloPreviaBaixasAplis[];
  pulados: TituloPulado[];
} {
  const aplicaveis: TituloPreviaBaixasAplis[] = [];
  const pulados: TituloPulado[] = [];
  for (const titulo of titulos) {
    if (temBaixaAplicavel(titulo)) aplicaveis.push(titulo);
    else pulados.push({ titulo, motivo: 'sem data de recebimento no apLIS' });
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

/** Seleção inicial (`idNota`): as baixas a lançar, menos as dos títulos que
 *  repetem baixa de outro título (o operador escolhe em qual dos dois lançar). */
export function selecaoPadrao(titulos: TituloPreviaBaixasAplis[]): Set<string> {
  const comBaixa = titulos.filter(temBaixaAplicavel);
  const repetidas = titulosComBaixaRepetida(comBaixa);
  return new Set(comBaixa.filter((t) => !repetidas.has(t.idNota)).map((t) => t.idNota));
}

/** Quanto o que está marcado vai lançar. Soma em centavos (0,1 + 0,2). */
export function totalALancar(
  titulos: TituloPreviaBaixasAplis[],
  marcadas: ReadonlySet<string>,
): { titulos: number; baixas: { qtd: number; valor: number } } {
  let qtdTitulos = 0;
  const baixas = { qtd: 0, centavos: 0 };
  for (const titulo of titulos) {
    if (!marcadas.has(titulo.idNota) || !temBaixaAplicavel(titulo)) continue;
    qtdTitulos += 1;
    baixas.qtd += titulo.baixas.length;
    for (const baixa of titulo.baixas) baixas.centavos += Math.round(baixa.valor * 100);
  }
  return { titulos: qtdTitulos, baixas: { qtd: baixas.qtd, valor: baixas.centavos / 100 } };
}

/** 'parcial': alguma baixa do título entrou e depois uma falhou — as seguintes
 *  não são tentadas (ficam para a próxima prévia). */
export type EstadoAplicacao = 'aguardando' | 'lancando' | 'lancado' | 'parcial' | 'falhou';

export interface ResultadoTitulo {
  estado: EstadoAplicacao;
  baixasLancadas: number;
  mensagem?: string;
}

export interface DependenciasAplicacao {
  registrarBaixa: (baixa: BaixaInput) => Promise<void>;
  /** false: o modal fechou — não começa o próximo lançamento. */
  continuar: () => boolean;
  /** Depois de cada baixa que entrou. */
  onProgresso?: (parcial: ResultadoTitulo) => void;
}

/**
 * Lança as baixas de um título em ordem. A primeira que falhar encerra o
 * título: as seguintes dependem do saldo que a RPC recalcula.
 */
export async function aplicarTitulo(
  titulo: TituloPreviaBaixasAplis,
  deps: DependenciasAplicacao,
): Promise<ResultadoTitulo> {
  const atual: ResultadoTitulo = { estado: 'lancando', baixasLancadas: 0 };
  for (const baixa of titulo.baixas) {
    if (!deps.continuar()) break;
    try {
      await deps.registrarBaixa({
        notaId: titulo.idNota,
        valorRecebido: baixa.valor,
        dataRecebimento: baixa.data,
        observacoes: baixa.observacoes,
        glosas: [],
      });
    } catch (err) {
      return {
        ...atual,
        estado: atual.baixasLancadas > 0 ? 'parcial' : 'falhou',
        mensagem: err instanceof Error ? err.message : 'Não foi possível registrar a baixa.',
      };
    }
    atual.baixasLancadas += 1;
    deps.onProgresso?.({ ...atual });
  }
  return { ...atual, estado: 'lancado' };
}

/** O resultado de um título já executado, em texto para o operador. */
export function descricaoResultado(r: ResultadoTitulo): string {
  if (r.estado === 'lancado') {
    return r.baixasLancadas > 0 ? `lançado: ${plural(r.baixasLancadas, 'baixa', 'baixas')}` : 'nada lançado';
  }
  if (r.estado === 'parcial') {
    return `${plural(r.baixasLancadas, 'baixa lançada', 'baixas lançadas')}, depois falhou: ${r.mensagem}`;
  }
  return `falhou: ${r.mensagem}`;
}

export function resumoAplicacao(resultados: Iterable<ResultadoTitulo>): {
  lancados: number;
  parciais: number;
  falharam: number;
  texto: string;
} {
  let lancados = 0;
  let parciais = 0;
  let falharam = 0;
  for (const { estado } of resultados) {
    if (estado === 'lancado') lancados += 1;
    else if (estado === 'parcial') parciais += 1;
    else if (estado === 'falhou') falharam += 1;
  }
  const partes = [plural(lancados, 'título lançado', 'títulos lançados')];
  if (parciais > 0) partes.push(plural(parciais, 'lançado em parte', 'lançados em parte'));
  if (falharam > 0) partes.push(`${falharam} ${falharam === 1 ? 'falhou' : 'falharam'}`);
  return { lancados, parciais, falharam, texto: partes.join(', ') };
}
