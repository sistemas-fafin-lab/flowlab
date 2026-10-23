// api/_lib/faturamento/recursoGlosa.ts
// Regras de recurso de glosa (.scratch/glosas-recursos-dashboard/spec.md):
// funções puras, sem banco. O handler de sincronização lê o apLIS e o
// Supabase e só aplica o que está aqui.

/** Requisição glosada ou recursada como o apLIS a mostra agora. */
export interface RequisicaoGlosaAplis {
  /** `requisicao.CodEventoFatur` (evento de faturamento). */
  status: number | null;
  /** Σ `ValorLiquido` dos procedimentos. */
  liquido: number;
  /** Σ `ValorRecebido` dos procedimentos (nulo conta 0). */
  recebido: number;
  /** Σ `VlrRecurso` da requisição no lote de recurso; null sem lote. */
  recursado: number | null;
}

/** A glosa fixada na foto. Depois de gravada, a sincronização não a muda. */
export interface GlosaFixada {
  /** null: deferido total sem lote de recurso (a responsável completa pelo lápis). */
  glosaFixada: number | null;
  /** Recebido no momento da fixação: base do ΔRec da classificação. */
  recebidoFixacao: number | null;
  /** A foto foi tirada depois do envio: a glosa original pode ter se perdido. */
  valorInicialEstimado: boolean;
}

/** Eventos de faturamento usados pelas regras (catálogo `eventofatur`). */
export const STATUS_GLOSA = {
  glosadoSemRecurso: 6,
  primeiroRecurso: 7,
  segundoRecurso: 16,
  recursoNaoAcatado: 15,
  recursoPago: 17,
  glosaRecebida: 34,
  emTratativas: 33,
  recebidoAMenorAcatado: 18,
  glosaDefinitivaAcatada: 8,
} as const;

/** Requisições que entram na foto (além das que estão em algum lote de recurso). */
export const STATUS_FOTO: number[] = Object.values(STATUS_GLOSA);

/** Status em que o apLIS já sobrescreveu o recebido com o que voltou do recurso. */
const STATUS_DEFERIDO_TOTAL: number[] = [STATUS_GLOSA.glosaRecebida, STATUS_GLOSA.recursoPago];

/** O laboratório desistiu da glosa: o saldo negativo da requisição é perda. */
const STATUS_ACATADA: number[] = [STATUS_GLOSA.recebidoAMenorAcatado, STATUS_GLOSA.glosaDefinitivaAcatada];

/** Mês do lote de faturamento original, 'YYYY-MM': o período da tela. */
export function competenciaValida(valor: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Glosa fixada da requisição.
 *
 * `anterior` é a fixação já gravada na foto; existindo, volta inalterada.
 * `cargaInicial` diz se é a primeira sincronização que cobre a requisição
 * (mês do lote de faturamento + convênio); `recursoEnviado`, se o lote de
 * recurso da requisição já foi enviado. Em qualquer dos dois a foto pode ter
 * sido tirada depois do envio, e a glosa leva a marca de valor estimado.
 */
export function fixarGlosa(
  aplis: RequisicaoGlosaAplis,
  anterior: GlosaFixada | null,
  opcoes: { cargaInicial: boolean; recursoEnviado?: boolean },
): GlosaFixada {
  if (anterior) return anterior;
  // Deferido total: a glosa original se perdeu no recebido; o que se sabe dela
  // é o que foi recursado. A base fica no recebido de antes do recurso pago,
  // para o ΔRec dar exatamente o recursado.
  if (aplis.status !== null && STATUS_DEFERIDO_TOTAL.includes(aplis.status)) {
    if (aplis.recursado === null) {
      return { glosaFixada: null, recebidoFixacao: null, valorInicialEstimado: true };
    }
    return {
      glosaFixada: centavos(aplis.recursado),
      recebidoFixacao: centavos(aplis.recebido - aplis.recursado),
      valorInicialEstimado: true,
    };
  }
  return {
    glosaFixada: centavos(aplis.liquido - aplis.recebido),
    recebidoFixacao: centavos(aplis.recebido),
    valorInicialEstimado: opcoes.cargaInicial || Boolean(opcoes.recursoEnviado),
  };
}

/** Requisição como a foto a guarda, com o que a classificação precisa. */
export interface RequisicaoFoto {
  status: number | null;
  liquido: number;
  recebido: number;
  /** Base do ΔRec; null no deferido total sem lote de recurso. */
  recebidoFixacao: number | null;
  valorRecursado: number | null;
  emLoteRecurso: boolean;
  /** Lote de recurso com data de envio (do apLIS ou editada). */
  loteEnviado: boolean;
}

/** Valores da requisição corrigidos pelo lápis (ticket 07); ausente = vale o apLIS. */
export interface EdicoesRequisicao {
  valorRecursado?: number;
  /** Substitui o ΔRec. */
  valorRecebidoGlosa?: number;
}

/** R: o recursado editado vale acima do do apLIS. */
function recursadoEfetivo(foto: RequisicaoFoto, edicoes: EdicoesRequisicao): number {
  return edicoes.valorRecursado ?? foto.valorRecursado ?? 0;
}

export type ClasseRecurso = 'em-analise' | 'deferido' | 'deferido-parcial' | 'indeferido' | 'acatada';

export interface ClassificacaoRecurso {
  classe: ClasseRecurso;
  valor: number;
  /** Deferido parcial: o que falta a operadora pagar do recursado. */
  pendente?: number;
}

/**
 * Classificação da requisição no Acompanhamento dos recursos (spec,
 * "Classificação de cada requisição"). R = valor recursado; ΔRec = recebido
 * atual − recebido na fixação; os valores editados à mão valem acima dos
 * dois. Indeferido e acatada vêm do status do apLIS e
 * valem acima do ΔRec. null: ainda sem resultado a mostrar — glosa sem
 * recurso, ou lote de recurso que não foi enviado (fora dos cards de em
 * análise e deferido).
 */
export function classificarRequisicao(
  foto: RequisicaoFoto,
  edicoes: EdicoesRequisicao = {},
): ClassificacaoRecurso | null {
  const recursado = recursadoEfetivo(foto, edicoes);
  if (foto.status === STATUS_GLOSA.recursoNaoAcatado) return { classe: 'indeferido', valor: recursado };
  if (foto.status !== null && STATUS_ACATADA.includes(foto.status)) {
    return { classe: 'acatada', valor: centavos(foto.liquido - foto.recebido) };
  }
  if (foto.emLoteRecurso && !foto.loteEnviado) return null;
  // Deferido total sem lote: a fixação ficou em branco, e o valor também,
  // até a responsável completar pelo lápis.
  let deltaRecebido: number;
  if (edicoes.valorRecebidoGlosa !== undefined) {
    deltaRecebido = edicoes.valorRecebidoGlosa;
  } else if (foto.recebidoFixacao === null) {
    return foto.status !== null && STATUS_DEFERIDO_TOTAL.includes(foto.status)
      ? { classe: 'deferido', valor: 0 }
      : null;
  } else {
    deltaRecebido = centavos(foto.recebido - foto.recebidoFixacao);
  }
  if (deltaRecebido > 0 && deltaRecebido >= recursado) return { classe: 'deferido', valor: deltaRecebido };
  if (deltaRecebido > 0) {
    return { classe: 'deferido-parcial', valor: deltaRecebido, pendente: centavos(recursado - deltaRecebido) };
  }
  return foto.emLoteRecurso ? { classe: 'em-analise', valor: recursado } : null;
}

export interface RequisicaoClassificavel {
  foto: RequisicaoFoto;
  edicoes?: EdicoesRequisicao;
}

export interface CardRecursos {
  quantidade: number;
  valor: number;
  /** Da quantidade, sobre o total de recursos; uma casa decimal. */
  percentual: number;
}

/** Cards do Acompanhamento dos recursos no recorte (mês + convênio). */
export interface ResumoAcompanhamento {
  /** Recursos = requisições em lote de recurso (enviado ou não); valor = Σ recursado. */
  total: {
    quantidade: number;
    valor: number;
    /** % da quantidade sobre o mês de faturamento anterior; null sem recursos nele. */
    variacao: number | null;
  };
  emAnalise: CardRecursos;
  deferidos: CardRecursos;
  indeferidos: CardRecursos;
  deferidoParcial: { quantidade: number; valor: number; pendente: number };
  /** Inclui as glosas acatadas sem recurso: o laboratório decidiu não recorrer. */
  acatada: { quantidade: number; valor: number };
}

function umaCasa(valor: number): number {
  return Math.round(valor * 10) / 10;
}

function totalRecursos(requisicoes: RequisicaoClassificavel[]): { quantidade: number; valor: number } {
  const recursos = requisicoes.filter((r) => r.foto.emLoteRecurso);
  return {
    quantidade: recursos.length,
    valor: centavos(recursos.reduce(
      (soma, r) => soma + recursadoEfetivo(r.foto, r.edicoes ?? {}),
      0,
    )),
  };
}

/**
 * Soma os cards do Acompanhamento. `anterior` são as requisições do mês de
 * faturamento anterior, no mesmo convênio: só a variação do total usa.
 * Em análise, deferidos, indeferidos e deferido parcial contam só os
 * recursos (em lote); a glosa acatada conta todas as requisições.
 */
export function resumirAcompanhamento(
  atual: RequisicaoClassificavel[],
  anterior: RequisicaoClassificavel[],
): ResumoAcompanhamento {
  const total = totalRecursos(atual);
  const totalAnterior = totalRecursos(anterior);
  const somas: Record<ClasseRecurso, { quantidade: number; valor: number; pendente: number }> = {
    'em-analise': { quantidade: 0, valor: 0, pendente: 0 },
    deferido: { quantidade: 0, valor: 0, pendente: 0 },
    'deferido-parcial': { quantidade: 0, valor: 0, pendente: 0 },
    indeferido: { quantidade: 0, valor: 0, pendente: 0 },
    acatada: { quantidade: 0, valor: 0, pendente: 0 },
  };
  for (const r of atual) {
    const c = classificarRequisicao(r.foto, r.edicoes);
    if (!c || (c.classe !== 'acatada' && !r.foto.emLoteRecurso)) continue;
    const soma = somas[c.classe];
    soma.quantidade += 1;
    soma.valor = centavos(soma.valor + c.valor);
    soma.pendente = centavos(soma.pendente + (c.pendente ?? 0));
  }

  const card = (classe: ClasseRecurso): CardRecursos => ({
    quantidade: somas[classe].quantidade,
    valor: somas[classe].valor,
    percentual: total.quantidade === 0 ? 0 : umaCasa((somas[classe].quantidade / total.quantidade) * 100),
  });

  return {
    total: {
      ...total,
      variacao: totalAnterior.quantidade === 0
        ? null
        : umaCasa(((total.quantidade - totalAnterior.quantidade) / totalAnterior.quantidade) * 100),
    },
    emAnalise: card('em-analise'),
    deferidos: card('deferido'),
    indeferidos: card('indeferido'),
    deferidoParcial: somas['deferido-parcial'],
    acatada: { quantidade: somas.acatada.quantidade, valor: somas.acatada.valor },
  };
}
