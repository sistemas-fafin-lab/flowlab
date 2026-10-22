// Regras do "Aplicar baixas e glosas do apLIS"
// (.scratch/faturamento-baixas-automaticas-aplis/spec.md e
// .scratch/faturamento-glosas-automaticas-aplis/spec.md): o que a prévia
// oferece para lançar, o total marcado, a execução de um título e o resumo. As
// baixas sugeridas vêm prontas da rota (api/_lib/faturamento/baixasAplis.ts), e
// as glosas também (api/_lib/faturamento/glosasAplis.ts), com as digitadas à
// mão que elas substituem (.scratch/faturamento-glosas-sincronizar-aplis).

import type { BaixaInput, GlosaSugeridaAplis, TituloPreviaBaixasAplis } from '../types';
import { plural } from './formato';

export type MotivoPulado = 'sem data de recebimento no apLIS';

export interface TituloPulado {
  titulo: TituloPreviaBaixasAplis;
  /** Por que a baixa ficou de fora; null quando o título não tem baixa a lançar. */
  motivo: MotivoPulado | null;
  motivoGlosa: string | null;
}

/** Tem baixa que dá para lançar. */
export function temBaixaAplicavel(titulo: TituloPreviaBaixasAplis): boolean {
  return titulo.baixas.length > 0;
}

/** Tem glosa do apLIS a lançar ou glosa digitada a substituir. */
export function temGlosaAplicavel(titulo: TituloPreviaBaixasAplis): boolean {
  return titulo.glosas.length > 0 || titulo.glosasSubstituidas.length > 0;
}

/** Por que a baixa do título ficou de fora. Só o título com recebido a lançar
 *  tem baixa; sem baixa é o lote com valor recebido mas sem `DtaRecebido` no
 *  apLIS: sem data não há como lançar. */
export function motivoPuladoBaixa(titulo: TituloPreviaBaixasAplis): MotivoPulado | null {
  if (titulo.tipo !== 'so-no-aplis' && titulo.tipo !== 'aplis-maior') return null;
  if (titulo.baixas.length === 0) return 'sem data de recebimento no apLIS';
  return null;
}

/** Por que a glosa do título ficou de fora, em texto para o operador. */
export function motivoPuladoGlosa(titulo: TituloPreviaBaixasAplis): string | null {
  switch (titulo.puladoGlosa) {
    case 'sem-motivo': return 'diferença sem motivo no apLIS';
    case 'glosa-manual': return 'título tem glosa digitada e parte da diferença no apLIS não tem motivo';
    case 'passa-do-saldo': return 'glosa passa do saldo do título';
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
    if (temBaixaAplicavel(titulo) || temGlosaAplicavel(titulo)) aplicaveis.push(titulo);
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

/** Títulos com glosa sugerida num lote que também tem glosa sugerida em outro
 *  título (lote vinculado aos dois): lançar nos dois glosaria o lote em dobro —
 *  o desconto das já lançadas é por título. */
export function titulosComGlosaRepetida(titulos: TituloPreviaBaixasAplis[]): Set<string> {
  const porLote = new Map<number, Set<string>>();
  for (const titulo of titulos) {
    for (const glosa of titulo.glosas) {
      const idsNota = porLote.get(glosa.idLote) ?? new Set<string>();
      idsNota.add(titulo.idNota);
      porLote.set(glosa.idLote, idsNota);
    }
  }
  const repetidos = new Set<string>();
  for (const idsNota of porLote.values()) {
    if (idsNota.size > 1) idsNota.forEach((id) => repetidos.add(id));
  }
  return repetidos;
}

/** Títulos marcados em cada checkbox (por `idNota`). */
export interface SelecaoAplicacao {
  baixas: ReadonlySet<string>;
  glosas: ReadonlySet<string>;
}

/** Seleção inicial: as baixas e as glosas a lançar, menos as dos títulos que
 *  repetem baixa ou glosa de lote de outro título (o operador escolhe em qual
 *  dos dois lançar). */
export function selecaoPadrao(titulos: TituloPreviaBaixasAplis[]): SelecaoAplicacao {
  const comBaixa = titulos.filter(temBaixaAplicavel);
  const baixasRepetidas = titulosComBaixaRepetida(comBaixa);
  const glosasRepetidas = titulosComGlosaRepetida(titulos);
  return {
    baixas: new Set(comBaixa.filter((t) => !baixasRepetidas.has(t.idNota)).map((t) => t.idNota)),
    glosas: new Set(titulos.filter((t) => temGlosaAplicavel(t) && !glosasRepetidas.has(t.idNota)).map((t) => t.idNota)),
  };
}

/** Quanto o que está marcado vai lançar, baixas e glosas separadas, e quanto de
 *  glosa digitada sai. Soma em centavos (0,1 + 0,2). `titulos`: com ao menos
 *  um dos dois marcado. */
export function totalALancar(
  titulos: TituloPreviaBaixasAplis[],
  selecao: SelecaoAplicacao,
): {
  titulos: number;
  baixas: { qtd: number; valor: number };
  glosas: { qtd: number; valor: number };
  substituidas: { qtd: number; valor: number };
} {
  let qtdTitulos = 0;
  const baixas = { qtd: 0, centavos: 0 };
  const glosas = { qtd: 0, centavos: 0 };
  const substituidas = { qtd: 0, centavos: 0 };
  for (const titulo of titulos) {
    const comBaixas = selecao.baixas.has(titulo.idNota) && temBaixaAplicavel(titulo);
    const comGlosas = selecao.glosas.has(titulo.idNota) && temGlosaAplicavel(titulo);
    if (!comBaixas && !comGlosas) continue;
    qtdTitulos += 1;
    if (comBaixas) {
      baixas.qtd += titulo.baixas.length;
      for (const baixa of titulo.baixas) baixas.centavos += Math.round(baixa.valor * 100);
    }
    if (comGlosas) {
      glosas.qtd += titulo.glosas.length;
      for (const glosa of titulo.glosas) glosas.centavos += Math.round(glosa.valor * 100);
      substituidas.qtd += titulo.glosasSubstituidas.length;
      for (const glosa of titulo.glosasSubstituidas) substituidas.centavos += Math.round(glosa.valor * 100);
    }
  }
  return {
    titulos: qtdTitulos,
    baixas: { qtd: baixas.qtd, valor: baixas.centavos / 100 },
    glosas: { qtd: glosas.qtd, valor: glosas.centavos / 100 },
    substituidas: { qtd: substituidas.qtd, valor: substituidas.centavos / 100 },
  };
}

/** 'parcial': algo do título entrou e depois algo falhou — o restante dele não
 *  é tentado (fica para a próxima prévia). */
export type EstadoAplicacao = 'aguardando' | 'lancando' | 'lancado' | 'parcial' | 'falhou';

export interface ResultadoTitulo {
  estado: EstadoAplicacao;
  baixasLancadas: number;
  glosasLancadas: number;
  /** Glosas digitadas que saíram no lugar das do apLIS. */
  glosasSubstituidas: number;
  /** Uma baixa falhou e as glosas marcadas do título não foram tentadas. */
  glosasNaoLancadas: boolean;
  mensagem?: string;
}

export interface DependenciasAplicacao {
  registrarBaixa: (baixa: BaixaInput) => Promise<void>;
  /** Todas as glosas do título numa chamada (`fat_lancar_glosas_aplis`), com as
   *  digitadas que saem (ids): todas ou nenhuma. */
  lancarGlosas: (notaId: string, glosas: GlosaSugeridaAplis[], substituir: string[]) => Promise<void>;
  /** false: o modal fechou — não começa o próximo lançamento. */
  continuar: () => boolean;
  /** Depois de cada lançamento que entrou. */
  onProgresso?: (parcial: ResultadoTitulo) => void;
}

/**
 * Lança o que está marcado num título: as baixas em ordem (a primeira que falhar
 * encerra o título — as seguintes dependem do saldo que a RPC recalcula) e
 * depois as glosas numa chamada só, apenas se todas as baixas marcadas entraram.
 */
export async function aplicarTitulo(
  alvo: { titulo: TituloPreviaBaixasAplis; baixas: boolean; glosas: boolean },
  deps: DependenciasAplicacao,
): Promise<ResultadoTitulo> {
  const { titulo } = alvo;
  const comGlosas = alvo.glosas && temGlosaAplicavel(titulo);
  const atual: ResultadoTitulo = {
    estado: 'lancando', baixasLancadas: 0, glosasLancadas: 0, glosasSubstituidas: 0, glosasNaoLancadas: false,
  };
  const falhou = (err: unknown, padrao: string): ResultadoTitulo => ({
    ...atual,
    estado: atual.baixasLancadas + atual.glosasLancadas + atual.glosasSubstituidas > 0 ? 'parcial' : 'falhou',
    mensagem: err instanceof Error ? err.message : padrao,
  });

  for (const baixa of alvo.baixas ? titulo.baixas : []) {
    if (!deps.continuar()) return { ...atual, estado: 'lancado' };
    try {
      await deps.registrarBaixa({
        notaId: titulo.idNota,
        valorRecebido: baixa.valor,
        dataRecebimento: baixa.data,
        observacoes: baixa.observacoes,
        glosas: [],
      });
    } catch (err) {
      atual.glosasNaoLancadas = comGlosas;
      return falhou(err, 'Não foi possível registrar a baixa.');
    }
    atual.baixasLancadas += 1;
    deps.onProgresso?.({ ...atual });
  }

  if (comGlosas && deps.continuar()) {
    try {
      await deps.lancarGlosas(titulo.idNota, titulo.glosas, titulo.glosasSubstituidas.map((g) => g.id));
    } catch (err) {
      return falhou(err, 'Não foi possível lançar as glosas.');
    }
    atual.glosasLancadas = titulo.glosas.length;
    atual.glosasSubstituidas = titulo.glosasSubstituidas.length;
    deps.onProgresso?.({ ...atual });
  }
  return { ...atual, estado: 'lancado' };
}

/** O resultado de um título já executado, em texto para o operador. */
export function descricaoResultado(r: ResultadoTitulo): string {
  const baixas = plural(r.baixasLancadas, 'baixa', 'baixas');
  if (r.estado === 'lancado') {
    const partes = [];
    if (r.baixasLancadas > 0) partes.push(baixas);
    if (r.glosasLancadas > 0) partes.push(plural(r.glosasLancadas, 'glosa', 'glosas'));
    if (r.glosasSubstituidas > 0) {
      partes.push(plural(r.glosasSubstituidas, 'glosa digitada excluída', 'glosas digitadas excluídas'));
    }
    if (partes.length === 0) return 'nada lançado';
    const ultima = partes.pop();
    return `lançado: ${partes.length > 0 ? `${partes.join(', ')} e ${ultima}` : ultima}`;
  }
  const lancadas = r.baixasLancadas > 0
    ? `${plural(r.baixasLancadas, 'baixa lançada', 'baixas lançadas')}, `
    : '';
  if (r.glosasNaoLancadas) {
    return `${lancadas}${lancadas ? 'depois a ' : ''}baixa falhou, glosas não lançadas: ${r.mensagem}`;
  }
  if (r.estado === 'parcial') return `${lancadas}glosas falharam: ${r.mensagem}`;
  return `falhou: ${r.mensagem}`;
}

export function resumoAplicacao(resultados: Iterable<ResultadoTitulo>): {
  lancados: number;
  parciais: number;
  falharam: number;
  glosasNaoLancadas: number;
  texto: string;
} {
  let lancados = 0;
  let parciais = 0;
  let falharam = 0;
  let glosasNaoLancadas = 0;
  for (const { estado, glosasNaoLancadas: naoLancadas } of resultados) {
    if (estado === 'lancado') lancados += 1;
    else if (estado === 'parcial') parciais += 1;
    else if (estado === 'falhou') falharam += 1;
    if (naoLancadas) glosasNaoLancadas += 1;
  }
  const partes = [plural(lancados, 'título lançado', 'títulos lançados')];
  if (parciais > 0) partes.push(plural(parciais, 'lançado em parte', 'lançados em parte'));
  if (falharam > 0) partes.push(`${falharam} ${falharam === 1 ? 'falhou' : 'falharam'}`);
  const texto = partes.join(', ');
  return {
    lancados,
    parciais,
    falharam,
    glosasNaoLancadas,
    texto: glosasNaoLancadas > 0
      ? `${texto} (${glosasNaoLancadas} com as glosas não lançadas porque a baixa falhou)`
      : texto,
  };
}
