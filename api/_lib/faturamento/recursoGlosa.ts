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

/** Tipos de regra de prazo (tabela glosa_prazo_regras). */
export type TipoRegraPrazo =
  | 'dias_corridos'
  | 'dias_uteis'
  | 'dia_mes_seguinte'
  | 'dia_util_mes_seguinte'
  | 'ultimo_dia_mes_seguinte'
  | 'sem_prazo';

export interface RegraPrazo {
  tipo: TipoRegraPrazo;
  /** Dias, dia do mês ou N-ésimo dia útil; null nos tipos sem N. */
  n: number | null;
}

/** 'YYYY-MM-DD' ↔ Date em UTC: a conta é de calendário, sem fuso. */
function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: Date, dias: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + dias));
}

/** Dia útil: segunda a sexta, sem feriados. */
function diaUtil(data: Date): boolean {
  const semana = data.getUTCDay();
  return semana !== 0 && semana !== 6;
}

function somarDiasUteis(data: Date, dias: number): Date {
  let atual = data;
  for (let contados = 0; contados < dias;) {
    atual = somarDias(atual, 1);
    if (diaUtil(atual)) contados += 1;
  }
  return atual;
}

/** Último dia do mês seguinte ao da data. */
function fimDoMesSeguinte(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 2, 0));
}

/** N-ésimo dia útil do mês seguinte; além dos dias úteis do mês, o último deles. */
function diaUtilDoMesSeguinte(data: Date, n: number): Date {
  const fim = fimDoMesSeguinte(data);
  let atual = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 1));
  let ultimoUtil = atual;
  for (let contados = 0; atual <= fim; atual = somarDias(atual, 1)) {
    if (!diaUtil(atual)) continue;
    ultimoUtil = atual;
    contados += 1;
    if (contados === n) return atual;
  }
  return ultimoUtil;
}

/**
 * Data limite da regra a partir da data base ('YYYY-MM-DD'). null: sem prazo.
 */
export function aplicarRegraPrazo(regra: RegraPrazo, base: string): string | null {
  const data = paraData(base);
  const n = regra.n ?? 0;
  switch (regra.tipo) {
    case 'dias_corridos':
      return paraIso(somarDias(data, n));
    case 'dias_uteis':
      return paraIso(somarDiasUteis(data, n));
    case 'dia_mes_seguinte': {
      const fim = fimDoMesSeguinte(data);
      return paraIso(new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), Math.min(n, fim.getUTCDate()))));
    }
    case 'dia_util_mes_seguinte':
      return paraIso(diaUtilDoMesSeguinte(data, n));
    case 'ultimo_dia_mes_seguinte':
      return paraIso(fimDoMesSeguinte(data));
    case 'sem_prazo':
      return null;
  }
}

/** As regras do convênio que a lista de lotes usa. */
export interface RegrasPrazoLote {
  /** Data de retorno prevista, contada do envio. */
  glosaAnalise: RegraPrazo;
  /** Data de pagamento prevista, contada do retorno (real ou previsto). */
  glosaPagamento: RegraPrazo;
}

export interface LoteParaPrazo {
  /** Envio editado (ticket 07) ou do apLIS; null: lote não enviado. */
  dataEnvio: string | null;
  /** Retorno real da operadora, registrado pelo lápis (ticket 07). */
  dataRetornoReal: string | null;
  requisicoes: RequisicaoClassificavel[];
}

/** 'sem-regra' é o "—": o convênio não tem regra de análise. */
export type SeloAtraso = 'no-prazo' | 'vence-hoje' | 'atrasado' | 'sem-regra';

export interface PrazosLote {
  dataRetornoPrevista: string | null;
  dataPagamentoPrevista: string | null;
  /** null: o selo não conta (lote não enviado, com retorno real ou classificação final). */
  selo: SeloAtraso | null;
}

/** A operadora já deu resultado a todas as requisições do lote (nenhuma em análise). */
function loteComClassificacaoFinal(requisicoes: RequisicaoClassificavel[]): boolean {
  return requisicoes.length > 0 && requisicoes.every((r) => {
    const c = classificarRequisicao(r.foto, r.edicoes);
    return c !== null && c.classe !== 'em-analise';
  });
}

/**
 * Datas previstas e selo de atraso de um lote de recurso (spec, "Prazos").
 * `regras` null: convênio sem regra ligada. `hoje` é 'YYYY-MM-DD'.
 */
export function prazosDoLote(lote: LoteParaPrazo, regras: RegrasPrazoLote | null, hoje: string): PrazosLote {
  if (lote.dataEnvio === null) return { dataRetornoPrevista: null, dataPagamentoPrevista: null, selo: null };
  const retornoPrevisto = regras ? aplicarRegraPrazo(regras.glosaAnalise, lote.dataEnvio) : null;
  const basePagamento = lote.dataRetornoReal ?? retornoPrevisto;
  const pagamentoPrevisto = regras && basePagamento ? aplicarRegraPrazo(regras.glosaPagamento, basePagamento) : null;

  let selo: SeloAtraso | null;
  if (lote.dataRetornoReal !== null || loteComClassificacaoFinal(lote.requisicoes)) selo = null;
  else if (retornoPrevisto === null) selo = 'sem-regra';
  else if (hoje < retornoPrevisto) selo = 'no-prazo';
  else if (hoje === retornoPrevisto) selo = 'vence-hoje';
  else selo = 'atrasado';

  return { dataRetornoPrevista: retornoPrevisto, dataPagamentoPrevista: pagamentoPrevisto, selo };
}
