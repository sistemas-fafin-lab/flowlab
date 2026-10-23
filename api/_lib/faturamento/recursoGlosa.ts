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
