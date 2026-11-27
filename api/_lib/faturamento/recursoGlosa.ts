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

/**
 * Perda definitiva da glosa: acatada pelo laboratório (18, 8) ou recurso não
 * acatado pela operadora (15). O líquido − recebido dessas requisições sai do
 * saldo do título e entra na coluna Acatado. Mesma lista de
 * fat_glosa_acatada_nota (supabase/migrations/20261123100000_fat_perda_recurso_nao_acatado.sql).
 * O Dashboard de Glosas e Recursos continua separando acatada de indeferido.
 */
export const STATUS_PERDA_DEFINITIVA: number[] = [...STATUS_ACATADA, STATUS_GLOSA.recursoNaoAcatado];

/** Líquido − recebido da requisição em perda definitiva; null fora desses status. */
export function valorPerdaDefinitiva(foto: Pick<RequisicaoFoto, 'status' | 'liquido' | 'recebido'>): number | null {
  if (foto.status === null || !STATUS_PERDA_DEFINITIVA.includes(foto.status)) return null;
  return centavos(foto.liquido - foto.recebido);
}

/**
 * Glosa ainda em disputa: glosado sem recurso, 1º e 2º recurso. O saldo dessas
 * requisições não é atraso da operadora — está em glosa/recurso. Mesma lista
 * de fat_glosa_em_recurso_nota (supabase/migrations/20261119160000_fat_saldo_em_recurso.sql).
 */
export const STATUS_EM_DISPUTA: number[] = [
  STATUS_GLOSA.glosadoSemRecurso,
  STATUS_GLOSA.primeiroRecurso,
  STATUS_GLOSA.segundoRecurso,
];

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

/** Arredonda para uma casa decimal (percentuais). */
export function umaCasa(valor: number): number {
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

/** Requisição da foto com o que o Dashboard agrupa. */
export interface RequisicaoDashboard extends RequisicaoClassificavel {
  /** null: deferido total sem lote de recurso (conta 0). */
  glosaFixada: number | null;
  /** Nome da fonte pagadora; null sem cadastro. */
  convenio: string | null;
  /** Procedimentos glosados ('código descrição'). */
  procedimentos: string[];
  /** Motivos do catálogo `fatmotivoglosa` ('código descrição'). */
  motivos: string[];
}

export interface MesEvolucao {
  competencia: string;
  aberta: number;
  emRecurso: number;
  revertida: number;
}

export interface ResumoDashboard {
  /** Os 6 meses até o período, do mais antigo ao filtrado; valor por status. */
  evolucao: MesEvolucao[];
  /** Total = requisições nos quatro status; percentual da quantidade, uma casa. */
  distribuicao: {
    total: number;
    status: { status: StatusDashboard; quantidade: number; valor: number; percentual: number }[];
  };
  procedimentos: { porValor: ItemRankingGlosa[]; porOcorrencias: ItemRankingGlosa[] };
  /** Por glosa fixada; percentual sobre o total glosado do mês. */
  convenios: ItemRankingGlosa[];
  /** Por ocorrências; os menores somados em "Outros". Percentual sobre as ocorrências. */
  motivos: ItemRankingGlosa[];
}

/** Linha de ranking (procedimento, convênio, motivo). */
export interface ItemRankingGlosa {
  nome: string;
  /** Glosa fixada; a de uma requisição se divide entre os itens dela. */
  valor: number;
  /** Requisições em que o item aparece. */
  quantidade: number;
  /** Uma casa decimal, sobre a base do ranking. */
  percentual: number;
}

/** Linhas dos rankings de procedimentos e de convênios. */
const TOPO_RANKING = 10;

/** Fatias do resumo por motivo: além disso, os menores viram "Outros". */
const MAX_MOTIVOS = 6;

/** Meses da evolução, contando o filtrado. */
export const MESES_EVOLUCAO = 6;

const STATUS_DO_DASHBOARD: StatusDashboard[] = ['aberta', 'em-recurso', 'revertida', 'definitiva'];

/** 'YYYY-MM' deslocado `meses` meses (negativo volta). */
export function somarMeses(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Valor da requisição no status: nas Revertidas, o deferido (ΔRec); nos outros, a glosa fixada. */
function valorNoStatus(status: StatusDashboard, r: RequisicaoDashboard): number {
  if (status === 'revertida') return valorRecebidoGlosa(r.foto, r.edicoes) ?? 0;
  return r.glosaFixada ?? 0;
}

function somarCards(requisicoes: RequisicaoDashboard[]): Record<StatusDashboard, { quantidade: number; valor: number }> {
  const somas = Object.fromEntries(STATUS_DO_DASHBOARD.map((s) => [s, { quantidade: 0, valor: 0 }])) as Record<
    StatusDashboard,
    { quantidade: number; valor: number }
  >;
  for (const r of requisicoes) {
    const status = statusDashboard(r.foto, r.edicoes);
    if (!status) continue;
    somas[status].quantidade += 1;
    somas[status].valor = centavos(somas[status].valor + valorNoStatus(status, r));
  }
  return somas;
}

/**
 * Soma a glosa fixada e as ocorrências por item. A foto não guarda o valor de
 * cada procedimento (nem de cada motivo): a glosa da requisição se divide
 * igualmente entre os itens dela.
 */
function agruparPorItem(
  requisicoes: RequisicaoDashboard[],
  itens: (r: RequisicaoDashboard) => string[],
): { nome: string; valor: number; quantidade: number }[] {
  const grupos = new Map<string, { nome: string; valor: number; quantidade: number }>();
  for (const r of requisicoes) {
    const daRequisicao = [...new Set(itens(r))];
    for (const nome of daRequisicao) {
      const grupo = grupos.get(nome) ?? { nome, valor: 0, quantidade: 0 };
      grupo.valor += (r.glosaFixada ?? 0) / daRequisicao.length;
      grupo.quantidade += 1;
      grupos.set(nome, grupo);
    }
  }
  return [...grupos.values()].map((g) => ({ ...g, valor: centavos(g.valor) }));
}

function comPercentual(
  grupos: { nome: string; valor: number; quantidade: number }[],
  base: (g: { valor: number; quantidade: number }) => number,
  total: number,
): ItemRankingGlosa[] {
  return grupos.map((g) => ({ ...g, percentual: total === 0 ? 0 : umaCasa((base(g) / total) * 100) }));
}

/** Os `MAX_MOTIVOS − 1` maiores e o resto somado em "Outros". */
function agruparMenores(itens: ItemRankingGlosa[], ocorrencias: number): ItemRankingGlosa[] {
  if (itens.length <= MAX_MOTIVOS) return itens;
  const resto = itens.slice(MAX_MOTIVOS - 1);
  const quantidade = resto.reduce((soma, i) => soma + i.quantidade, 0);
  return [
    ...itens.slice(0, MAX_MOTIVOS - 1),
    {
      nome: 'Outros',
      valor: centavos(resto.reduce((soma, i) => soma + i.valor, 0)),
      quantidade,
      percentual: umaCasa((quantidade / ocorrencias) * 100),
    },
  ];
}

const porValorDesc = (a: ItemRankingGlosa, b: ItemRankingGlosa) =>
  b.valor - a.valor || b.quantidade - a.quantidade || a.nome.localeCompare(b.nome);
const porQuantidadeDesc = (a: ItemRankingGlosa, b: ItemRankingGlosa) =>
  b.quantidade - a.quantidade || b.valor - a.valor || a.nome.localeCompare(b.nome);

/**
 * Dashboard de Glosas e Recursos (spec, "Status do Dashboard"). `porMes` são
 * as requisições da foto por mês do lote de faturamento original, já no
 * convênio do recorte; `competencia` é o mês filtrado.
 */
export function resumirDashboard(
  competencia: string,
  porMes: Record<string, RequisicaoDashboard[]>,
): ResumoDashboard {
  const doMes = (c: string) => porMes[c] ?? [];
  const atual = somarCards(doMes(competencia));

  const evolucao = Array.from({ length: MESES_EVOLUCAO }, (_, i) => {
    const mes = somarMeses(competencia, i - (MESES_EVOLUCAO - 1));
    const somas = somarCards(doMes(mes));
    return {
      competencia: mes,
      aberta: somas.aberta.valor,
      emRecurso: somas['em-recurso'].valor,
      revertida: somas.revertida.valor,
    };
  });

  const totalGlosas = STATUS_DO_DASHBOARD.reduce((soma, s) => soma + atual[s].quantidade, 0);
  const distribuicao = {
    total: totalGlosas,
    status: STATUS_DO_DASHBOARD.map((s) => ({
      status: s,
      ...atual[s],
      percentual: totalGlosas === 0 ? 0 : umaCasa((atual[s].quantidade / totalGlosas) * 100),
    })),
  };

  // Os rankings contam as mesmas glosas da distribuição (os quatro status),
  // todas pela glosa fixada: é o que foi glosado, seja qual for o desfecho.
  const glosasDoMes = doMes(competencia).filter((r) => statusDashboard(r.foto, r.edicoes) !== null);
  const totalGlosado = glosasDoMes.reduce((soma, r) => soma + (r.glosaFixada ?? 0), 0);
  const procedimentos = agruparPorItem(glosasDoMes, (r) => r.procedimentos);
  const ocorrencias = procedimentos.reduce((soma, p) => soma + p.quantidade, 0);
  const motivos = agruparPorItem(glosasDoMes, (r) => r.motivos);
  const ocorrenciasMotivo = motivos.reduce((soma, m) => soma + m.quantidade, 0);
  return {
    evolucao,
    distribuicao,
    procedimentos: {
      porValor: comPercentual(procedimentos, (p) => p.valor, totalGlosado).sort(porValorDesc).slice(0, TOPO_RANKING),
      porOcorrencias: comPercentual(procedimentos, (p) => p.quantidade, ocorrencias)
        .sort(porQuantidadeDesc)
        .slice(0, TOPO_RANKING),
    },
    convenios: comPercentual(
      agruparPorItem(glosasDoMes, (r) => [r.convenio ?? 'Sem convênio']),
      (c) => c.valor,
      totalGlosado,
    ).sort(porValorDesc).slice(0, TOPO_RANKING),
    motivos: agruparMenores(
      comPercentual(motivos, (m) => m.quantidade, ocorrenciasMotivo).sort(porQuantidadeDesc),
      ocorrenciasMotivo,
    ),
  };
}

/** Requisição da foto com o lote de faturamento original: a ponte com o título. */
export interface RequisicaoTitulo extends RequisicaoClassificavel {
  /** `fatlote.IdLote` do faturamento original (`lotes.aplis_id` do título). */
  idLoteFaturamento: number;
  /** null: deferido total sem lote de recurso (conta 0). */
  glosaFixada: number | null;
}

/** As colunas de glosa de Contas a Receber → Títulos e o recurso não acatado (card de totais). */
export interface GlosasTitulo {
  /** Σ líquido − recebido das requisições em glosa ainda em disputa: sem recurso (6), 1º (7) e 2º recurso (16). */
  glosado: number;
  /** Σ valor deferido (total ou parcial): o mesmo das Revertidas do Dashboard. */
  glosaRecebida: number;
  /** Σ líquido − recebido das requisições em 18, 8 e 15: o que foi dado como perdido. */
  glosaAcatada: number;
  /** Parte da glosaAcatada que é recurso não acatado pela operadora (15). */
  recursoNaoAcatado: number;
}

/** Título ou lote sem glosa na foto. */
export const GLOSAS_ZERADAS: Readonly<GlosasTitulo> = { glosado: 0, glosaRecebida: 0, glosaAcatada: 0, recursoNaoAcatado: 0 };

/** Glosado, Glosa recebida e Glosa acatada de cada lote de faturamento. */
export function somarGlosasPorLote(requisicoes: RequisicaoTitulo[]): Map<number, GlosasTitulo> {
  const porLote = new Map<number, GlosasTitulo>();
  for (const r of requisicoes) {
    const soma = porLote.get(r.idLoteFaturamento) ?? { ...GLOSAS_ZERADAS };
    if (r.foto.status !== null && STATUS_EM_DISPUTA.includes(r.foto.status)) {
      soma.glosado = centavos(soma.glosado + Math.max(r.foto.liquido - r.foto.recebido, 0));
    }
    if (statusDashboard(r.foto, r.edicoes) === 'revertida') {
      soma.glosaRecebida = centavos(soma.glosaRecebida + (valorRecebidoGlosa(r.foto, r.edicoes) ?? 0));
    }
    const perda = valorPerdaDefinitiva(r.foto);
    if (perda !== null) soma.glosaAcatada = centavos(soma.glosaAcatada + perda);
    if (perda !== null && r.foto.status === STATUS_GLOSA.recursoNaoAcatado) {
      soma.recursoNaoAcatado = centavos(soma.recursoNaoAcatado + perda);
    }
    porLote.set(r.idLoteFaturamento, soma);
  }
  return porLote;
}

/** As três colunas de um título: a soma dos lotes de faturamento dele (lote fora da foto conta 0). */
export function somarGlosasDoTitulo(idsLote: number[], porLote: Map<number, GlosasTitulo>): GlosasTitulo {
  const soma: GlosasTitulo = { ...GLOSAS_ZERADAS };
  for (const id of idsLote) {
    const doLote = porLote.get(id);
    if (!doLote) continue;
    soma.glosado = centavos(soma.glosado + doLote.glosado);
    soma.glosaRecebida = centavos(soma.glosaRecebida + doLote.glosaRecebida);
    soma.glosaAcatada = centavos(soma.glosaAcatada + doLote.glosaAcatada);
    soma.recursoNaoAcatado = centavos(soma.recursoNaoAcatado + (doLote.recursoNaoAcatado ?? 0));
  }
  return soma;
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

export interface LoteParaPrazo<R extends RequisicaoClassificavel = RequisicaoClassificavel> {
  /** Envio editado (ticket 07) ou do apLIS; null: lote não enviado. */
  dataEnvio: string | null;
  /** Retorno real da operadora, registrado pelo lápis (ticket 07). */
  dataRetornoReal: string | null;
  requisicoes: R[];
}

/** 'sem-regra' é o "—": o convênio não tem regra de análise. */
export type SeloAtraso = 'no-prazo' | 'vence-hoje' | 'atrasado' | 'sem-regra';

/** Retorno e pagamento previstos de um lote de recurso. */
export interface DatasPrevistas {
  dataRetornoPrevista: string | null;
  /** Contada da data real de retorno, quando existe; senão da prevista. */
  dataPagamentoPrevista: string | null;
}

export interface PrazosLote extends DatasPrevistas {
  /** null: o selo não conta (lote não enviado, com retorno real ou toda requisição já respondida). */
  selo: SeloAtraso | null;
}

/** Selo de uma data limite; null (sem prazo) é o "—". */
function seloDoPrazo(prazo: string | null, hoje: string): SeloAtraso {
  if (prazo === null) return 'sem-regra';
  if (hoje < prazo) return 'no-prazo';
  if (hoje === prazo) return 'vence-hoje';
  return 'atrasado';
}

export type MotivoSemData = 'lote-nao-enviado' | 'sem-regra-analise' | 'sem-regra-pagamento';

/** Prazos e situação de uma requisição de lote de recurso. */
export interface PrazosRequisicao<R extends RequisicaoClassificavel = RequisicaoClassificavel> extends DatasPrevistas {
  requisicao: R;
  /** A de classificarRequisicao; null: lote não enviado ou ainda sem resultado. */
  classe: ClasseRecurso | null;
  /** Deferido total, indeferido ou acatada: a operadora não deve mais nada. */
  resultadoFinal: boolean;
  /** Recursado − recebido de glosa (os dois com as edições do lápis); nunca negativo, 0 no deferido total. */
  valorEmAberto: number;
  /** Por que não há data de pagamento prevista; null quando há. */
  motivoSemData: MotivoSemData | null;
}

/** A operadora já respondeu de vez; o deferido parcial ainda tem o que pagar. */
const CLASSES_RESULTADO_FINAL: ClasseRecurso[] = ['deferido', 'indeferido', 'acatada'];

/**
 * Retorno previsto (envio + Análise) e pagamento previsto (retorno real ou
 * previsto + Pagamento) do lote, com o motivo de faltar a data de pagamento.
 */
function datasPrevistasDoLote(
  lote: Pick<LoteParaPrazo, 'dataEnvio' | 'dataRetornoReal'>,
  regras: RegrasPrazoLote | null,
): DatasPrevistas & { motivoSemData: MotivoSemData | null } {
  if (lote.dataEnvio === null) {
    return { dataRetornoPrevista: null, dataPagamentoPrevista: null, motivoSemData: 'lote-nao-enviado' };
  }
  const dataRetornoPrevista = regras ? aplicarRegraPrazo(regras.glosaAnalise, lote.dataEnvio) : null;
  const basePagamento = lote.dataRetornoReal ?? dataRetornoPrevista;
  // Sem regra ligada, faltam as duas; o motivo aponta a primeira da conta.
  if (regras === null || basePagamento === null) {
    return { dataRetornoPrevista, dataPagamentoPrevista: null, motivoSemData: 'sem-regra-analise' };
  }
  const dataPagamentoPrevista = aplicarRegraPrazo(regras.glosaPagamento, basePagamento);
  return {
    dataRetornoPrevista,
    dataPagamentoPrevista,
    motivoSemData: dataPagamentoPrevista === null ? 'sem-regra-pagamento' : null,
  };
}

/**
 * Datas previstas e situação de cada requisição de um lote de recurso
 * (spec "Calendário de recursos", base das Pendências de glosa e do Aging).
 * `regras` null: convênio sem regra ligada.
 */
export function prazosDasRequisicoes<R extends RequisicaoClassificavel>(
  lote: LoteParaPrazo<R>,
  regras: RegrasPrazoLote | null,
): PrazosRequisicao<R>[] {
  const { dataRetornoPrevista, dataPagamentoPrevista, motivoSemData } = datasPrevistasDoLote(lote, regras);

  return lote.requisicoes.map((requisicao) => {
    const classe = classificarRequisicao(requisicao.foto, requisicao.edicoes)?.classe ?? null;
    const recursado = recursadoEfetivo(requisicao.foto, requisicao.edicoes ?? {});
    const recebidoGlosa = valorRecebidoGlosa(requisicao.foto, requisicao.edicoes) ?? 0;
    return {
      requisicao,
      dataRetornoPrevista,
      dataPagamentoPrevista,
      classe,
      resultadoFinal: classe !== null && CLASSES_RESULTADO_FINAL.includes(classe),
      // Deferido total sem base fixada não tem ΔRec, mas a operadora pagou.
      valorEmAberto: classe === 'deferido' ? 0 : Math.max(0, centavos(recursado - recebidoGlosa)),
      motivoSemData,
    };
  });
}

/**
 * Datas previstas e selo de atraso de um lote de recurso (spec, "Prazos").
 * `regras` null: convênio sem regra ligada. `hoje` é 'YYYY-MM-DD'.
 */
export function prazosDoLote(lote: LoteParaPrazo, regras: RegrasPrazoLote | null, hoje: string): PrazosLote {
  const { dataRetornoPrevista, dataPagamentoPrevista } = datasPrevistasDoLote(lote, regras);
  if (lote.dataEnvio === null) return { dataRetornoPrevista, dataPagamentoPrevista, selo: null };

  // O selo para quando a operadora já respondeu a todas (nenhuma em análise, deferido parcial incluso).
  const requisicoes = prazosDasRequisicoes(lote, regras);
  const todasRespondidas = requisicoes.length > 0
    && requisicoes.every((r) => r.classe !== null && r.classe !== 'em-analise');

  const selo = lote.dataRetornoReal !== null || todasRespondidas ? null : seloDoPrazo(dataRetornoPrevista, hoje);
  return { dataRetornoPrevista, dataPagamentoPrevista, selo };
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

/** Requisição da foto como as Pendências de glosa a leem para o prazo para recorrer. */
export interface RequisicaoPendenciaPrazo {
  fontePagadora: { id: number | null };
  status: number | null;
  /** Último `DtaRecebido` dos procedimentos: base do prazo para recorrer. */
  dataRecebimento: string | null;
  glosaFixada: number | null;
  /** Está em algum lote de recurso, enviado ou não (fora da sub-aba "Recursos fora de lote"). */
  emLoteRecurso: boolean;
}

/** Lote de recurso com as regras do convênio já escolhidas (null: sem regra ligada). */
export interface LoteRecursoParaPendencia<R extends RequisicaoClassificavel = RequisicaoClassificavel> extends LoteParaPrazo<R> {
  regras: RegrasPrazoLote | null;
}

export interface EntradaPendencias<P extends RequisicaoPendenciaPrazo, L extends LoteRecursoParaPendencia> {
  /** Requisições da foto; só as glosadas sem recurso fora de lote de recurso contam. */
  requisicoes: P[];
  /** A regra GLOSA – RECURSO de cada convênio com vínculo. */
  regraRecursoPorFonte: Map<number, RegraPrazo>;
  lotes: L[];
}

export interface PendenciasDeGlosa<P extends RequisicaoPendenciaPrazo, L extends LoteRecursoParaPendencia> {
  /** Valor: Σ glosa fixada; quantidade: requisições. Do prazo mais antigo ao mais recente. */
  prazoVencido: { valor: number; quantidade: number; requisicoes: { requisicao: P; prazo: string }[] };
  /** Valor: Σ recursado do lote; quantidade: lotes. */
  retornoAtrasado: { valor: number; quantidade: number; lotes: { lote: L; dataRetornoPrevista: string }[] };
  /** Valor: Σ recursado − recebido de glosa; quantidade: requisições, em `qtdLotes` lotes. */
  pagamentoAtrasado: {
    valor: number;
    quantidade: number;
    qtdLotes: number;
    lotes: { lote: L; dataPagamentoPrevista: string; requisicoes: PrazosRequisicao<L['requisicoes'][number]>[] }[];
  };
}

/** O prazo venceu (antes de hoje) e, com mês, dentro dele. */
function vencidoNoRecorte(prazo: string | null, mes: string | null, hoje: string): prazo is string {
  return prazo !== null && prazo < hoje && (mes === null || prazo.startsWith(mes));
}

/**
 * Pendências de glosa (spec "Pendências de glosa"): glosas sem recurso com
 * prazo para recorrer vencido, lotes de recurso com retorno atrasado (o selo
 * "Atrasado" da lista de lotes) e requisições com pagamento atrasado (sem
 * resultado final). Recurso sem data de envio não entra nos atrasos. `mes`
 * 'YYYY-MM' conta o que venceu nele até hoje; null, tudo o que está vencido.
 */
export function pendenciasDeGlosa<P extends RequisicaoPendenciaPrazo, L extends LoteRecursoParaPendencia>(
  entrada: EntradaPendencias<P, L>,
  mes: string | null,
  hoje: string,
): PendenciasDeGlosa<P, L> {
  const vencidas: PendenciasDeGlosa<P, L>['prazoVencido']['requisicoes'] = [];
  for (const r of entrada.requisicoes) {
    if (r.status !== STATUS_GLOSA.glosadoSemRecurso || r.emLoteRecurso) continue;
    const regra = r.fontePagadora.id === null ? null : entrada.regraRecursoPorFonte.get(r.fontePagadora.id) ?? null;
    const { prazo } = prazoParaRecorrer(r.dataRecebimento, regra, hoje);
    if (vencidoNoRecorte(prazo, mes, hoje)) vencidas.push({ requisicao: r, prazo });
  }
  vencidas.sort((a, b) => a.prazo.localeCompare(b.prazo));

  const retorno: PendenciasDeGlosa<P, L>['retornoAtrasado']['lotes'] = [];
  const pagamento: PendenciasDeGlosa<P, L>['pagamentoAtrasado']['lotes'] = [];
  let valorRetorno = 0;
  for (const lote of entrada.lotes) {
    if (lote.dataEnvio === null) continue;
    const { dataRetornoPrevista, dataPagamentoPrevista, selo } = prazosDoLote(lote, lote.regras, hoje);
    if (selo === 'atrasado' && vencidoNoRecorte(dataRetornoPrevista, mes, hoje)) {
      retorno.push({ lote, dataRetornoPrevista });
      for (const r of lote.requisicoes) valorRetorno = centavos(valorRetorno + recursadoEfetivo(r.foto, r.edicoes ?? {}));
    }
    if (!vencidoNoRecorte(dataPagamentoPrevista, mes, hoje)) continue;
    const abertas = prazosDasRequisicoes(lote, lote.regras).filter((p) => !p.resultadoFinal);
    if (abertas.length > 0) pagamento.push({ lote, dataPagamentoPrevista, requisicoes: abertas });
  }
  retorno.sort((a, b) => a.dataRetornoPrevista.localeCompare(b.dataRetornoPrevista));
  pagamento.sort((a, b) => a.dataPagamentoPrevista.localeCompare(b.dataPagamentoPrevista));

  const requisicoesPagamento = pagamento.flatMap((l) => l.requisicoes);
  return {
    prazoVencido: {
      valor: vencidas.reduce((soma, v) => centavos(soma + (v.requisicao.glosaFixada ?? 0)), 0),
      quantidade: vencidas.length,
      requisicoes: vencidas,
    },
    retornoAtrasado: { valor: valorRetorno, quantidade: retorno.length, lotes: retorno },
    pagamentoAtrasado: {
      valor: requisicoesPagamento.reduce((soma, p) => centavos(soma + p.valorEmAberto), 0),
      quantidade: requisicoesPagamento.length,
      qtdLotes: pagamento.length,
      lotes: pagamento,
    },
  };
}

/** Faixas do Aging da glosa em recurso: dias de hoje − data de pagamento prevista. */
export type FaixaAging = 'a-vencer' | 'd1-30' | 'd31-60' | 'd61-90' | 'd90-mais';

export const FAIXAS_AGING: FaixaAging[] = ['a-vencer', 'd1-30', 'd31-60', 'd61-90', 'd90-mais'];

/** Operadoras com cor própria no aging; a cauda vira "Outras" (o padrão do Aging da carteira). */
const TOPO_AGING = 7;

/** Fonte pagadora da requisição na foto; os dois null: sem cadastro. */
export interface FontePagadoraFoto {
  id: number | null;
  nome: string | null;
}

/** Requisição de lote de recurso com a fonte pagadora que o aging empilha. */
export interface RequisicaoAging extends RequisicaoClassificavel {
  fontePagadora: FontePagadoraFoto;
}

export type LoteParaAging = LoteRecursoParaPendencia<RequisicaoAging>;

export interface AgingOperadora {
  /** null: sem fonte pagadora, ou a linha "Outras". */
  fonteId: number | null;
  nome: string;
  /** A cauda além das 7 maiores, somada. */
  outras: boolean;
  faixas: Record<FaixaAging, number>;
  total: number;
}

export interface AgingGlosaRecurso {
  faixas: Record<FaixaAging, number>;
  /** As maiores pelo total nas faixas, a cauda somada em "Outras" (fonteId null). */
  operadoras: AgingOperadora[];
  /** Sem data de envio, ou convênio sem regra de Análise ou de Pagamento: a nota acima do gráfico. */
  foraDasFaixas: { valor: number; quantidade: number; semEnvio: number; semRegra: number };
}

function faixasZeradas(): Record<FaixaAging, number> {
  return Object.fromEntries(FAIXAS_AGING.map((f) => [f, 0])) as Record<FaixaAging, number>;
}

/** Dias corridos de `de` até `ate` ('YYYY-MM-DD'). */
function diasEntre(de: string, ate: string): number {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000);
}

/** Dia 0 (vence hoje) ainda é "A vencer", como no aging do Contas a Receber. */
function faixaDoAtraso(dias: number): FaixaAging {
  if (dias <= 0) return 'a-vencer';
  if (dias <= 30) return 'd1-30';
  if (dias <= 60) return 'd31-60';
  if (dias <= 90) return 'd61-90';
  return 'd90-mais';
}

/**
 * Aging da glosa em recurso (spec "Aging da glosa em recurso"): o valor em
 * aberto (recursado − recebido de glosa) das requisições de lote de recurso sem
 * resultado final, por faixa de dias desde a data de pagamento prevista e por
 * operadora. `hoje` é 'YYYY-MM-DD'.
 */
export function agingDaGlosaEmRecurso(lotes: LoteParaAging[], hoje: string): AgingGlosaRecurso {
  const faixas = faixasZeradas();
  const porFonte = new Map<number | null, AgingOperadora>();
  const fora = { valor: 0, quantidade: 0, semEnvio: 0, semRegra: 0 };
  for (const lote of lotes) {
    // Decisão de 26/11/2026: sem regra de Análise o lote fica fora mesmo com
    // data real de retorno, que daria a base do pagamento.
    const semAnalise = lote.regras === null || lote.regras.glosaAnalise.tipo === 'sem_prazo';
    for (const p of prazosDasRequisicoes(lote, lote.regras)) {
      if (p.resultadoFinal || p.valorEmAberto <= 0) continue;
      if (lote.dataEnvio === null || semAnalise || p.dataPagamentoPrevista === null) {
        const motivo = lote.dataEnvio === null ? 'semEnvio' : 'semRegra';
        fora[motivo] = centavos(fora[motivo] + p.valorEmAberto);
        fora.valor = centavos(fora.valor + p.valorEmAberto);
        fora.quantidade += 1;
        continue;
      }
      const faixa = faixaDoAtraso(diasEntre(p.dataPagamentoPrevista, hoje));
      const { id, nome } = p.requisicao.fontePagadora;
      const operadora = porFonte.get(id) ?? { fonteId: id, nome: nome ?? 'Sem fonte pagadora', outras: false, faixas: faixasZeradas(), total: 0 };
      operadora.faixas[faixa] = centavos(operadora.faixas[faixa] + p.valorEmAberto);
      operadora.total = centavos(operadora.total + p.valorEmAberto);
      porFonte.set(id, operadora);
      faixas[faixa] = centavos(faixas[faixa] + p.valorEmAberto);
    }
  }
  const ordenadas = [...porFonte.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  const resto = ordenadas.slice(TOPO_AGING);
  const operadoras = ordenadas.slice(0, TOPO_AGING);
  if (resto.length > 0) {
    const outras: AgingOperadora = { fonteId: null, nome: 'Outras', outras: true, faixas: faixasZeradas(), total: 0 };
    for (const o of resto) {
      for (const f of FAIXAS_AGING) outras.faixas[f] = centavos(outras.faixas[f] + o.faixas[f]);
      outras.total = centavos(outras.total + o.total);
    }
    operadoras.push(outras);
  }
  return { faixas, operadoras, foraDasFaixas: fora };
}

/** Requisição da foto como o Calendário de recursos a lê. */
export interface RequisicaoCalendario {
  /** Lote de faturamento original (`requisicao.Lote`). */
  idLoteFaturamento: number;
  /** `fatlote.Protocolo` do lote de faturamento original. */
  protocoloLoteFaturamento: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  status: number | null;
  /** Último `DtaRecebido` dos procedimentos: base do prazo para recorrer. */
  dataRecebimento: string | null;
  glosaFixada: number | null;
  /** 'código descrição' dos motivos de glosa. */
  motivos: string[];
  /** Está num lote de recurso com data de envio (editada ou do apLIS). */
  loteRecursoEnviado: boolean;
}

/** Hoje, Amanhã (próximo dia útil), Atrasado (prazo real já passou) ou Futuro. */
export type SeloCalendarioRecursos = 'hoje' | 'amanha' | 'atrasado' | 'futuro';

/** O que todo item do calendário mostra: um lote de faturamento de um convênio. */
export interface LoteCalendarioRecursos<R extends RequisicaoCalendario = RequisicaoCalendario> {
  idLoteFaturamento: number;
  protocolo: string | null;
  fontePagadora: { id: number | null; nome: string | null };
  quantidade: number;
  /** Σ glosa fixada das requisições ainda não recorridas. */
  valor: number;
  /** Os motivos mais frequentes entre as requisições (até três). */
  motivos: { motivo: string; quantidade: number }[];
  /** Quantos motivos diferentes ficaram de fora de `motivos`. */
  qtdOutrosMotivos: number;
  requisicoes: R[];
}

/** Item do calendário: um lote de faturamento × um prazo para recorrer. */
export interface ItemCalendarioRecursos<R extends RequisicaoCalendario = RequisicaoCalendario>
  extends LoteCalendarioRecursos<R> {
  /** Data real do prazo: é a que define o atraso. */
  prazo: string;
  /** Onde o item aparece: o prazo, ou a sexta anterior se ele cai no fim de semana. */
  dataExibicao: string;
  /** O prazo real cai no sábado ou no domingo: selo "vence sáb" / "vence dom". */
  venceEm: 'sab' | 'dom' | null;
  selo: SeloCalendarioRecursos;
}

/** Convênio sem vínculo com regra, regra GLOSA – RECURSO "sem prazo" ou requisição sem data de recebimento. */
export type MotivoSemPrazo = 'sem-regra' | 'regra-sem-prazo' | 'sem-recebimento';

export interface ItemSemPrazo<R extends RequisicaoCalendario = RequisicaoCalendario> extends LoteCalendarioRecursos<R> {
  motivoSemPrazo: MotivoSemPrazo;
}

export interface CalendarioRecursos<R extends RequisicaoCalendario = RequisicaoCalendario> {
  /** Amanhã é o próximo dia útil depois de hoje. */
  datas: { hoje: string; amanha: string };
  /** Itens com data de exibição no mês pedido, por data. */
  mes: ItemCalendarioRecursos<R>[];
  /** De qualquer mês. Atrasados do prazo mais antigo ao mais recente. */
  paineis: {
    hoje: ItemCalendarioRecursos<R>[];
    amanha: ItemCalendarioRecursos<R>[];
    atrasados: ItemCalendarioRecursos<R>[];
  };
  /** Lista "Sem prazo cadastrado", do maior valor ao menor. */
  semPrazo: ItemSemPrazo<R>[];
}

const MAX_MOTIVOS_CALENDARIO = 3;

/** Ainda falta recorrer: glosado sem recurso, com glosa e motivo, fora de lote de recurso enviado. */
function entraNoCalendario(r: RequisicaoCalendario): boolean {
  return r.status === STATUS_GLOSA.glosadoSemRecurso
    && (r.glosaFixada ?? 0) > 0
    && r.motivos.length > 0
    && !r.loteRecursoEnviado;
}

/** Quantidade, valor e principais motivos das requisições de um item. */
function resumoDoLote<R extends RequisicaoCalendario>(requisicoes: R[]): LoteCalendarioRecursos<R> {
  const [primeira] = requisicoes;
  const contagem = new Map<string, number>();
  let valor = 0;
  for (const r of requisicoes) {
    valor = centavos(valor + (r.glosaFixada ?? 0));
    for (const motivo of new Set(r.motivos)) contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  }
  const motivos = [...contagem]
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.motivo.localeCompare(b.motivo));
  return {
    idLoteFaturamento: primeira.idLoteFaturamento,
    protocolo: primeira.protocoloLoteFaturamento,
    fontePagadora: primeira.fontePagadora,
    quantidade: requisicoes.length,
    valor,
    motivos: motivos.slice(0, MAX_MOTIVOS_CALENDARIO),
    qtdOutrosMotivos: Math.max(0, motivos.length - MAX_MOTIVOS_CALENDARIO),
    requisicoes,
  };
}

/** Junta `r` ao grupo da chave; o primeiro da chave guarda `dados`. */
function agrupar<R, D>(mapa: Map<string, { dados: D; requisicoes: R[] }>, chave: string, dados: D, r: R): void {
  const grupo = mapa.get(chave);
  if (grupo) grupo.requisicoes.push(r);
  else mapa.set(chave, { dados, requisicoes: [r] });
}

/** Prazo no fim de semana vai para a sexta anterior: a grade e os painéis são de segunda a sexta. */
function exibicaoDoPrazo(prazo: string): { dataExibicao: string; venceEm: 'sab' | 'dom' | null } {
  const semana = paraData(prazo).getUTCDay();
  if (semana === 6) return { dataExibicao: paraIso(somarDias(paraData(prazo), -1)), venceEm: 'sab' };
  if (semana === 0) return { dataExibicao: paraIso(somarDias(paraData(prazo), -2)), venceEm: 'dom' };
  return { dataExibicao: prazo, venceEm: null };
}

/**
 * Atrasado pelo prazo real; Hoje e Amanhã pela data de exibição. No fim de
 * semana, o prazo exibido na sexta que ainda não passou continua de hoje.
 */
function seloDoCalendario(
  prazo: string,
  dataExibicao: string,
  datas: { hoje: string; amanha: string },
): SeloCalendarioRecursos {
  if (prazo < datas.hoje) return 'atrasado';
  if (dataExibicao <= datas.hoje) return 'hoje';
  if (dataExibicao === datas.amanha) return 'amanha';
  return 'futuro';
}

/** Por data de exibição, depois pelo prazo real e pelo maior valor. */
function porExibicao(a: ItemCalendarioRecursos, b: ItemCalendarioRecursos): number {
  return a.dataExibicao.localeCompare(b.dataExibicao) || a.prazo.localeCompare(b.prazo) || b.valor - a.valor;
}

/**
 * Calendário de recursos (spec "Calendário de recursos"): as requisições
 * glosadas sem recurso agrupadas por lote de faturamento × prazo para
 * recorrer. `regraRecursoPorFonte`: a regra GLOSA – RECURSO de cada convênio
 * com vínculo. `mes` é 'YYYY-MM' e `hoje` 'YYYY-MM-DD'.
 */
export function calendarioDeRecursos<R extends RequisicaoCalendario>(
  requisicoes: R[],
  regraRecursoPorFonte: Map<number, RegraPrazo>,
  mes: string,
  hoje: string,
): CalendarioRecursos<R> {
  const datas = { hoje, amanha: paraIso(somarDiasUteis(paraData(hoje), 1)) };
  const comPrazo = new Map<string, { dados: string; requisicoes: R[] }>();
  const semPrazo = new Map<string, { dados: MotivoSemPrazo; requisicoes: R[] }>();

  for (const r of requisicoes.filter(entraNoCalendario)) {
    const regra = r.fontePagadora.id === null ? null : regraRecursoPorFonte.get(r.fontePagadora.id) ?? null;
    const { prazo } = prazoParaRecorrer(r.dataRecebimento, regra, hoje);
    const lote = `${r.idLoteFaturamento}|${r.fontePagadora.id}`;
    if (prazo !== null) {
      agrupar(comPrazo, `${lote}|${prazo}`, prazo, r);
      continue;
    }
    const motivo: MotivoSemPrazo = regra === null ? 'sem-regra' : regra.tipo === 'sem_prazo' ? 'regra-sem-prazo' : 'sem-recebimento';
    agrupar(semPrazo, `${lote}|${motivo}`, motivo, r);
  }

  const itens = [...comPrazo.values()].map(({ dados: prazo, requisicoes: grupo }): ItemCalendarioRecursos<R> => {
    const exibicao = exibicaoDoPrazo(prazo);
    return {
      ...resumoDoLote(grupo),
      prazo,
      ...exibicao,
      selo: seloDoCalendario(prazo, exibicao.dataExibicao, datas),
    };
  }).sort(porExibicao);

  return {
    datas,
    mes: itens.filter((i) => i.dataExibicao.startsWith(mes)),
    paineis: {
      hoje: itens.filter((i) => i.selo === 'hoje'),
      amanha: itens.filter((i) => i.selo === 'amanha'),
      atrasados: itens.filter((i) => i.selo === 'atrasado'),
    },
    semPrazo: [...semPrazo.values()]
      .map(({ dados: motivoSemPrazo, requisicoes: grupo }): ItemSemPrazo<R> => ({ ...resumoDoLote(grupo), motivoSemPrazo }))
      .sort((a, b) => b.valor - a.valor),
  };
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
