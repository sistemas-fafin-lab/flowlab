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

/** As edições como a foto as guarda (null = sem edição). */
export function edicoesDaFoto(editados: {
  valorRecursado: number | null;
  valorRecebidoGlosa: number | null;
}): EdicoesRequisicao {
  const edicoes: EdicoesRequisicao = {};
  if (editados.valorRecursado !== null) edicoes.valorRecursado = editados.valorRecursado;
  if (editados.valorRecebidoGlosa !== null) edicoes.valorRecebidoGlosa = editados.valorRecebidoGlosa;
  return edicoes;
}

/** R: o recursado editado vale acima do do apLIS. */
function recursadoEfetivo(foto: RequisicaoFoto, edicoes: EdicoesRequisicao): number {
  return edicoes.valorRecursado ?? foto.valorRecursado ?? 0;
}

/**
 * Valor recebido de glosa (ΔRec): o que entrou de recebido desde a fixação, ou
 * o valor corrigido pelo lápis. null quando não há base (deferido total sem
 * lote de recurso, até a responsável completar).
 */
export function valorRecebidoGlosa(foto: RequisicaoFoto, edicoes: EdicoesRequisicao = {}): number | null {
  if (edicoes.valorRecebidoGlosa !== undefined) return edicoes.valorRecebidoGlosa;
  if (foto.recebidoFixacao === null) return null;
  return centavos(foto.recebido - foto.recebidoFixacao);
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
  const deltaRecebido = valorRecebidoGlosa(foto, edicoes);
  if (deltaRecebido === null) {
    return foto.status !== null && STATUS_DEFERIDO_TOTAL.includes(foto.status)
      ? { classe: 'deferido', valor: 0 }
      : null;
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

/** Status da glosa no Dashboard e em Glosas recentes (spec, "Status do Dashboard"). */
export type StatusDashboard = 'aberta' | 'em-recurso' | 'revertida' | 'definitiva';

/**
 * Abertas = status 6; Revertidas = deferido + deferido parcial; Definitivas =
 * acatada + indeferido; Em recurso = 7 ou 16 sem classificação final. A
 * classificação vale acima do status 7/16 do apLIS (o recebido já voltou);
 * 34 e 17 são deferido total pelo próprio apLIS.
 * null: fora dos quatro (por exemplo, em tratativas sem nada recebido).
 */
export function statusDashboard(foto: RequisicaoFoto, edicoes: EdicoesRequisicao = {}): StatusDashboard | null {
  if (foto.status === STATUS_GLOSA.glosadoSemRecurso) return 'aberta';
  // Deferido total pelo apLIS, mesmo sem envio registrado ou sem recursado.
  if (foto.status !== null && STATUS_DEFERIDO_TOTAL.includes(foto.status)) return 'revertida';
  const classe = classificarRequisicao(foto, edicoes)?.classe;
  if (classe === 'deferido' || classe === 'deferido-parcial') return 'revertida';
  if (classe === 'acatada' || classe === 'indeferido') return 'definitiva';
  if (foto.status === STATUS_GLOSA.primeiroRecurso || foto.status === STATUS_GLOSA.segundoRecurso) return 'em-recurso';
  return null;
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

/** Selo de uma data limite; null (sem prazo) é o "—". */
function seloDoPrazo(prazo: string | null, hoje: string): SeloAtraso {
  if (prazo === null) return 'sem-regra';
  if (hoje < prazo) return 'no-prazo';
  if (hoje === prazo) return 'vence-hoje';
  return 'atrasado';
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
  else selo = seloDoPrazo(retornoPrevisto, hoje);

  return { dataRetornoPrevista: retornoPrevisto, dataPagamentoPrevista: pagamentoPrevisto, selo };
}

export interface PrazoParaRecorrer {
  /** Data limite para recorrer; null: sem regra, regra sem prazo ou sem data de recebimento. */
  prazo: string | null;
  /** 'sem-regra' é o "—": não há prazo para comparar. */
  selo: SeloAtraso;
}

/**
 * Prazo para recorrer da requisição fora de lote (sub-aba "Recursos fora de
 * lote"): regra GLOSA – RECURSO do convênio contada da data de recebimento da
 * requisição. `regra` null: convênio sem regra ligada. `hoje` é 'YYYY-MM-DD'.
 */
export function prazoParaRecorrer(
  dataRecebimento: string | null,
  regra: RegraPrazo | null,
  hoje: string,
): PrazoParaRecorrer {
  const prazo = regra && dataRecebimento ? aplicarRegraPrazo(regra, dataRecebimento) : null;
  return { prazo, selo: seloDoPrazo(prazo, hoje) };
}

/** Rótulo do evento de faturamento no histórico; espelha rotuloStatusAplis da tela (src/…/recursoGlosaVisual.ts). */
const ROTULO_STATUS: Record<number, string> = {
  5: 'Recebido',
  [STATUS_GLOSA.glosadoSemRecurso]: 'Glosado sem recurso',
  [STATUS_GLOSA.primeiroRecurso]: '1º recurso',
  [STATUS_GLOSA.glosaDefinitivaAcatada]: 'Glosa definitiva – acatada diretoria',
  [STATUS_GLOSA.recursoNaoAcatado]: 'Recurso não acatado',
  [STATUS_GLOSA.segundoRecurso]: '2º recurso',
  [STATUS_GLOSA.recursoPago]: 'Recurso de glosa pago',
  [STATUS_GLOSA.recebidoAMenorAcatado]: 'Recebido a menor – acatado',
  [STATUS_GLOSA.emTratativas]: 'Em tratativas com convênio',
  [STATUS_GLOSA.glosaRecebida]: 'Glosa recebida',
};

function rotuloStatus(status: number | null): string {
  if (status === null) return 'sem status';
  return ROTULO_STATUS[status] ?? `evento ${status}`;
}

export type TipoEventoHistorico =
  | 'inicio_acompanhamento'
  | 'entrada_lote_recurso'
  | 'mudanca_status'
  | 'mudanca_recebido'
  | 'envio_lote'
  | 'edicao_manual';

/** Evento do histórico (tabela glosa_recurso_historico), sem data nem dono. */
export interface EventoHistorico {
  tipo: TipoEventoHistorico;
  valorAnterior: string | null;
  valorNovo: string | null;
  descricao: string;
}

/** O que a mudança para cada status quer dizer, no texto do histórico. */
const TEXTO_PARA_STATUS: Record<number, string> = {
  [STATUS_GLOSA.glosadoSemRecurso]: 'Voltou para glosado sem recurso',
  [STATUS_GLOSA.primeiroRecurso]: 'Entrou em 1º recurso',
  [STATUS_GLOSA.segundoRecurso]: 'Foi para 2º recurso',
  [STATUS_GLOSA.recursoNaoAcatado]: 'Recurso não acatado',
  [STATUS_GLOSA.recursoPago]: 'Recurso pago',
  [STATUS_GLOSA.glosaRecebida]: 'Glosa recebida',
  [STATUS_GLOSA.emTratativas]: 'Em tratativas com o convênio',
  [STATUS_GLOSA.recebidoAMenorAcatado]: 'Glosa acatada (recebido a menor)',
  [STATUS_GLOSA.glosaDefinitivaAcatada]: 'Glosa definitiva – acatada pela diretoria',
};

function reais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function codigoOuNulo(status: number | null): string | null {
  return status === null ? null : String(status);
}

/** O que a foto da requisição guarda e o histórico compara. */
export interface FotoHistoricoRequisicao {
  status: number | null;
  recebido: number;
  idLoteRecurso: number | null;
}

/**
 * Eventos da requisição entre a foto anterior e a nova (spec, "Histórico").
 * `anterior` null: primeira sincronização — um só evento de início do
 * acompanhamento, sem reconstruir o passado. `recebidoGlosaEditado`: o valor
 * recebido de glosa foi corrigido pelo lápis e vale acima do recebido do
 * apLIS, então a mudança do recebido não é evento.
 */
export function eventosDaRequisicao(
  anterior: FotoHistoricoRequisicao | null,
  nova: FotoHistoricoRequisicao,
  opcoes: { recebidoGlosaEditado?: boolean } = {},
): EventoHistorico[] {
  if (anterior === null) {
    return [{
      tipo: 'inicio_acompanhamento',
      valorAnterior: null,
      valorNovo: codigoOuNulo(nova.status),
      descricao: `Início do acompanhamento (${rotuloStatus(nova.status)})`,
    }];
  }

  const eventos: EventoHistorico[] = [];
  if (nova.idLoteRecurso !== null && anterior.idLoteRecurso !== nova.idLoteRecurso) {
    eventos.push({
      tipo: 'entrada_lote_recurso',
      valorAnterior: anterior.idLoteRecurso === null ? null : String(anterior.idLoteRecurso),
      valorNovo: String(nova.idLoteRecurso),
      descricao: `Entrou no lote de recurso ${nova.idLoteRecurso}`,
    });
  }
  if (anterior.status !== nova.status) {
    eventos.push({
      tipo: 'mudanca_status',
      valorAnterior: codigoOuNulo(anterior.status),
      valorNovo: codigoOuNulo(nova.status),
      descricao: (nova.status !== null ? TEXTO_PARA_STATUS[nova.status] : undefined)
        ?? `Status mudou de ${rotuloStatus(anterior.status)} para ${rotuloStatus(nova.status)}`,
    });
  }
  const recebidoAnterior = centavos(anterior.recebido);
  const recebidoNovo = centavos(nova.recebido);
  if (!opcoes.recebidoGlosaEditado && recebidoAnterior !== recebidoNovo) {
    eventos.push({
      tipo: 'mudanca_recebido',
      valorAnterior: recebidoAnterior.toFixed(2),
      valorNovo: recebidoNovo.toFixed(2),
      descricao: `Recebido mudou de ${reais(recebidoAnterior)} para ${reais(recebidoNovo)}`,
    });
  }
  return eventos;
}

/** O que a foto do lote de recurso guarda e o histórico compara. */
export interface FotoHistoricoLote {
  idLoteRecurso: number;
  /** 'YYYY-MM-DD' do apLIS; null: não enviado. */
  dataEnvio: string | null;
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Eventos do lote de recurso entre a foto anterior e a nova. Lote novo na
 * foto: o envio só conta se o lote junta requisições já acompanhadas
 * (`acompanhado`) — foi criado e enviado entre duas sincronizações; senão é
 * carga inicial e o passado não é reconstruído. `envioEditado`: a data de
 * envio foi corrigida pelo lápis e vale acima da do apLIS — sem evento.
 */
export function eventosDoLote(
  anterior: FotoHistoricoLote | null,
  novo: FotoHistoricoLote,
  opcoes: { acompanhado: boolean; envioEditado?: boolean },
): EventoHistorico[] {
  if (novo.dataEnvio === null || opcoes.envioEditado) return [];
  if (anterior === null && !opcoes.acompanhado) return [];
  const envioAnterior = anterior?.dataEnvio ?? null;
  if (envioAnterior === novo.dataEnvio) return [];
  return [{
    tipo: 'envio_lote',
    valorAnterior: envioAnterior,
    valorNovo: novo.dataEnvio,
    descricao: envioAnterior === null
      ? `Lote de recurso ${novo.idLoteRecurso} enviado em ${dataBr(novo.dataEnvio)}`
      : `Data de envio do lote de recurso ${novo.idLoteRecurso} mudou de ${dataBr(envioAnterior)} para ${dataBr(novo.dataEnvio)}`,
  }];
}

/** Campos que o lápis corrige: os três do lote e os dois da requisição. */
export type CampoEdicaoLote = 'dataEnvio' | 'dataRetornoReal' | 'dataPagamentoReal';
export type CampoEdicaoRequisicao = 'valorRecursado' | 'valorRecebidoGlosa';
export type CampoEdicao = CampoEdicaoLote | CampoEdicaoRequisicao;

const CAMPOS_EDICAO: Record<CampoEdicao, { nome: string; feminino: boolean; data: boolean }> = {
  dataEnvio: { nome: 'data de envio', feminino: true, data: true },
  dataRetornoReal: { nome: 'data real de retorno', feminino: true, data: true },
  dataPagamentoReal: { nome: 'data real de pagamento', feminino: true, data: true },
  valorRecursado: { nome: 'valor recursado', feminino: false, data: false },
  valorRecebidoGlosa: { nome: 'valor recebido de glosa', feminino: false, data: false },
};

/** Data 'YYYY-MM-DD' ou valor em reais, como o histórico guarda. */
type ValorEdicao = string | number | null;

function valorGuardado(campo: CampoEdicao, valor: ValorEdicao): string | null {
  if (valor === null) return null;
  return CAMPOS_EDICAO[campo].data ? String(valor) : centavos(Number(valor)).toFixed(2);
}

function valorLegivel(campo: CampoEdicao, valor: ValorEdicao): string {
  if (valor === null) return '—';
  return CAMPOS_EDICAO[campo].data ? dataBr(String(valor)) : reais(centavos(Number(valor)));
}

/**
 * Evento de uma edição manual (lápis). `anterior` e `novo` são o valor que
 * valia antes e depois — o editado ou, sem edição, o do apLIS. `removida`:
 * a edição foi apagada e `novo` é o do apLIS de novo (null se o apLIS não tem).
 */
export function eventoEdicaoManual(
  campo: CampoEdicao,
  anterior: ValorEdicao,
  novo: ValorEdicao,
  opcoes: { removida?: boolean } = {},
): EventoHistorico {
  const { nome, feminino } = CAMPOS_EDICAO[campo];
  let descricao: string;
  if (opcoes.removida) {
    descricao = `Edição manual ${feminino ? 'da' : 'do'} ${nome} removida`;
    if (novo !== null) descricao += `: volta a valer ${valorLegivel(campo, novo)} (apLIS)`;
  } else {
    const rotulo = nome.charAt(0).toUpperCase() + nome.slice(1);
    descricao = `${rotulo} ${feminino ? 'editada' : 'editado'} manualmente: de ${valorLegivel(campo, anterior)} para ${valorLegivel(campo, novo)}`;
  }
  return {
    tipo: 'edicao_manual',
    valorAnterior: valorGuardado(campo, anterior),
    valorNovo: valorGuardado(campo, novo),
    descricao,
  };
}
