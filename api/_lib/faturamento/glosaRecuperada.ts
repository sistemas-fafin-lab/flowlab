// api/_lib/faturamento/glosaRecuperada.ts
// "Glosa recuperada" do funil da aba Comparativos
// (.scratch/faturamento-comparativos/issues/04-funil-de-glosa-por-competencia.md).
//
// MAPEAMENTO PROPOSTO — a usuária confirma antes de ir para produção:
//   Recuperada = glosa que entrou em recurso e depois teve valor recebido, calculada
//   a partir da foto de recursos do apLIS (a tabela `glosas` do Supabase não serve:
//   não tem registros `revertida` vindos do apLIS).
//
//   status do apLIS (requisicao.CodEventoFatur)     entra como recuperada?
//   34 Glosa recebida                                sim — deferido total (STATUS_APLIS_RECUPERADA)
//   17 Recurso pago                                  sim — deferido total (STATUS_APLIS_RECUPERADA)
//   7 / 16 1º e 2º recurso, 33 Em tratativas         sim, só o que já voltou: ΔRec > 0 e a
//                                                    requisição está em lote de recurso enviado
//   15 Recurso não acatado                           não (indeferido)
//   18 / 8 Acatada (recebido a menor / definitiva)   não (é a Acatada do funil)
//   6 Glosado sem recurso                            não
//
//   Valor = ΔRec (recebido atual − recebido na fixação), ou o corrigido pelo lápis.
//
// Reaproveita a classificação de recursoGlosa.ts (a mesma do Acompanhamento dos recursos);
// aqui fica só o recorte "revertida" e a constante revisável.

import {
  instanciaDoRecurso,
  MESES_EVOLUCAO,
  recursadoEfetivo,
  valorPerdaDefinitiva,
  STATUS_GLOSA,
  somarMeses,
  statusDashboard,
  umaCasa,
  valorRecebidoGlosa,
  type FontePagadoraFoto,
  type InstanciaRecurso,
  type RequisicaoClassificavel,
  type RequisicaoDashboard,
} from './recursoGlosa.js';
import type { ClasseGlosaFunil } from '../../../src/modules/faturamento/utils/funilGlosa.js';

/** Status que o apLIS já marca como recurso ganho (deferido total). Revisável pela usuária. */
export const STATUS_APLIS_RECUPERADA: number[] = [STATUS_GLOSA.glosaRecebida, STATUS_GLOSA.recursoPago];

/** Valor recuperado da requisição; 0 quando ela não é uma glosa recuperada. */
export function valorRecuperado(requisicao: RequisicaoClassificavel): number {
  const { foto, edicoes = {} } = requisicao;
  if (statusDashboard(foto, edicoes) !== 'revertida') return 0;
  // "Entrou em recurso": lote de recurso, ou um dos status que o apLIS já dá como recurso ganho.
  const emRecurso = foto.emLoteRecurso || (foto.status !== null && STATUS_APLIS_RECUPERADA.includes(foto.status));
  if (!emRecurso) return 0;
  return Math.max(valorRecebidoGlosa(foto, edicoes) ?? 0, 0);
}

/**
 * Classe e valor da requisição no funil, ou null quando ela não entra (indeferida, em
 * tratativas sem retorno, lote de recurso ainda não enviado...). Cada requisição cai em
 * uma classe só:
 *  - acatada: perda definitiva (18, 8 e recurso não acatado 15), valor líquido − recebido
 *    (a mesma regra que abate o saldo);
 *  - em disputa: glosa aberta (6) ou em recurso (7, 16), valor = glosa fixada;
 *  - recuperada: ver `valorRecuperado`.
 */
export function classificarParaFunil(
  requisicao: RequisicaoClassificavel,
  glosaFixada: number | null,
): { classe: ClasseGlosaFunil; valor: number } | null {
  const { foto, edicoes = {} } = requisicao;
  const perda = valorPerdaDefinitiva(foto);
  if (perda !== null) return { classe: 'acatada', valor: perda };

  const status = statusDashboard(foto, edicoes);
  if (status === 'aberta' || status === 'em-recurso') return { classe: 'em-disputa', valor: glosaFixada ?? 0 };
  if (status === 'revertida') {
    const valor = valorRecuperado(requisicao);
    return valor > 0 ? { classe: 'recuperada', valor } : null;
  }
  return null;
}

/** Card de valor do Dashboard de glosa. */
export interface CardValorGlosa {
  valor: number;
  /** Requisições na classe do card. */
  quantidade: number;
  /**
   * Uma casa decimal: o glosado sobre o faturado; acatado e recuperado sobre o glosado.
   * null sem base (faturado ou glosado zero) e no saldo pendente, que não tem percentual.
   */
  percentual: number | null;
  /** % do valor sobre o mês anterior, uma casa; null sem valor nele. */
  variacao: number | null;
}

export type CardsValorGlosa = Record<'glosado' | 'acatado' | 'recuperado' | 'saldoPendente', CardValorGlosa>;

/** O que a classificação do funil precisa de uma requisição da foto. */
export type RequisicaoFunil = Pick<RequisicaoDashboard, 'foto' | 'edicoes' | 'glosaFixada'>;

interface Soma {
  centavos: number;
  quantidade: number;
}

/** Soma em centavos de cada card, pela classe do funil de cada requisição. */
function somarCardsValor(requisicoes: RequisicaoFunil[]): Record<keyof CardsValorGlosa, Soma> {
  const porClasse: Record<ClasseGlosaFunil, Soma> = {
    recuperada: { centavos: 0, quantidade: 0 },
    acatada: { centavos: 0, quantidade: 0 },
    'em-disputa': { centavos: 0, quantidade: 0 },
  };
  for (const r of requisicoes) {
    const funil = classificarParaFunil(r, r.glosaFixada);
    if (!funil) continue;
    porClasse[funil.classe].centavos += Math.round(funil.valor * 100);
    porClasse[funil.classe].quantidade += 1;
  }
  const classes = Object.values(porClasse);
  return {
    glosado: {
      centavos: classes.reduce((t, c) => t + c.centavos, 0),
      quantidade: classes.reduce((t, c) => t + c.quantidade, 0),
    },
    acatado: porClasse.acatada,
    recuperado: porClasse.recuperada,
    saldoPendente: porClasse['em-disputa'],
  };
}

/**
 * Cards de valor do Dashboard de glosa
 * (.scratch/glosas-recursos-calendario-pendencias/issues/05-cards-de-valor-dashboard.md):
 * a classificação do funil (`classificarParaFunil`), a mesma dos cards de glosa do Contas a
 * Receber, das requisições do mês do lote original (`porMes`, por YYYY-MM).
 * Glosado = recuperada + acatada + em disputa; Saldo pendente = em disputa.
 * `faturado` é o do mês `competencia`, base do "% do faturado".
 */
export function cardsValorGlosa(
  competencia: string,
  porMes: Record<string, RequisicaoFunil[]>,
  faturado: number,
): CardsValorGlosa {
  const atual = somarCardsValor(porMes[competencia] ?? []);
  const anterior = somarCardsValor(porMes[somarMeses(competencia, -1)] ?? []);
  // Base do percentual em centavos; o saldo pendente não tem percentual.
  const base: Record<keyof CardsValorGlosa, number | null> = {
    glosado: Math.round(faturado * 100),
    acatado: atual.glosado.centavos,
    recuperado: atual.glosado.centavos,
    saldoPendente: null,
  };
  const card = (chave: keyof CardsValorGlosa): CardValorGlosa => {
    const { centavos, quantidade } = atual[chave];
    const antes = anterior[chave].centavos;
    return {
      valor: centavos / 100,
      quantidade,
      percentual: !base[chave] ? null : umaCasa((centavos / base[chave]) * 100),
      variacao: antes === 0 ? null : umaCasa(((centavos - antes) / antes) * 100),
    };
  };
  return { glosado: card('glosado'), acatado: card('acatado'), recuperado: card('recuperado'), saldoPendente: card('saldoPendente') };
}

/** Requisição da foto com a fonte pagadora que o saldo por operadora agrupa. */
export interface RequisicaoSaldoOperadora extends RequisicaoFunil {
  fontePagadora: FontePagadoraFoto;
}

export interface SaldoGlosaOperadora {
  /** null: requisição sem fonte pagadora. */
  fonteId: number | null;
  nome: string;
  /** Σ glosa fixada das requisições em disputa. */
  valor: number;
  quantidade: number;
}

/** Barras do gráfico (o padrão do Saldo por operadora do Contas a Receber). */
const TOPO_SALDO = 10;

/**
 * Saldo de glosa por operadora
 * (.scratch/glosas-recursos-calendario-pendencias/issues/07): a classe "em
 * disputa" do funil, a mesma do card Glosa em disputa, por fonte pagadora; as
 * 10 maiores. O Dashboard passa as requisições do mês do card, para as barras
 * somarem o card.
 */
export function saldoDeGlosaPorOperadora(requisicoes: RequisicaoSaldoOperadora[]): SaldoGlosaOperadora[] {
  const porFonte = new Map<number | null, { nome: string; centavos: number; quantidade: number }>();
  for (const r of requisicoes) {
    const funil = classificarParaFunil(r, r.glosaFixada);
    if (funil?.classe !== 'em-disputa' || funil.valor <= 0) continue;
    const { id, nome } = r.fontePagadora;
    const soma = porFonte.get(id) ?? { nome: nome ?? 'Sem fonte pagadora', centavos: 0, quantidade: 0 };
    soma.centavos += Math.round(funil.valor * 100);
    soma.quantidade += 1;
    porFonte.set(id, soma);
  }
  return [...porFonte.entries()]
    .map(([fonteId, s]) => ({ fonteId, nome: s.nome, valor: s.centavos / 100, quantidade: s.quantidade }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome))
    .slice(0, TOPO_SALDO);
}

/** Requisição da foto com a instância do recurso (observada no apLIS e editada à mão). */
export interface RequisicaoInstancia extends RequisicaoFunil {
  instancia: { observada: InstanciaRecurso | null; editada: InstanciaRecurso | null };
}

export interface CardInstancia {
  instancia: InstanciaRecurso;
  quantidade: number;
  /** Σ valor recursado (o editado pelo lápis, ou o do apLIS). */
  valorRecorrido: number;
  /** Σ das requisições na classe "recuperada" do funil (`classificarParaFunil`), a do card Glosa recuperada. */
  valorRecuperado: number;
}

export interface MesInstancia {
  competencia: string;
  /** Valor recorrido em cada instância. */
  primeiro: number;
  segundo: number;
  terceiro: number;
}

export interface RecursosPorInstancia {
  /** 1º, 2º e 3º recurso, sempre os três. */
  cards: CardInstancia[];
  /** Os 6 meses até o período, do mais antigo ao filtrado. */
  evolucao: MesInstancia[];
}

const INSTANCIAS: InstanciaRecurso[] = [1, 2, 3];

/** Soma de uma instância: requisições, e recorrido e recuperado em centavos. */
interface SomaInstancia {
  quantidade: number;
  recorrido: number;
  recuperado: number;
}

function somarPorInstancia(requisicoes: RequisicaoInstancia[]): Record<InstanciaRecurso, SomaInstancia> {
  const somas = Object.fromEntries(
    INSTANCIAS.map((i) => [i, { quantidade: 0, recorrido: 0, recuperado: 0 }]),
  ) as Record<InstanciaRecurso, SomaInstancia>;
  for (const r of requisicoes) {
    const { vigente } = instanciaDoRecurso(r.instancia);
    if (vigente === null) continue;
    somas[vigente].quantidade += 1;
    somas[vigente].recorrido += Math.round(recursadoEfetivo(r.foto, r.edicoes ?? {}) * 100);
    const funil = classificarParaFunil(r, r.glosaFixada);
    if (funil?.classe === 'recuperada') somas[vigente].recuperado += Math.round(funil.valor * 100);
  }
  return somas;
}

/**
 * Recursos por instância do Dashboard de glosa
 * (.scratch/glosas-recursos-calendario-pendencias/issues/09): as requisições com
 * instância vigente (a editada vence a observada; sem nenhuma, fica fora), pelo
 * mês do lote de faturamento original (`porMes`, por YYYY-MM). Todo o recurso da
 * requisição vai para a instância vigente: o recorrido no 1º de uma requisição
 * que chegou ao 2º não se separa.
 */
export function recursosPorInstancia(
  competencia: string,
  porMes: Record<string, RequisicaoInstancia[]>,
): RecursosPorInstancia {
  const atual = somarPorInstancia(porMes[competencia] ?? []);
  const cards = INSTANCIAS.map((instancia) => ({
    instancia,
    quantidade: atual[instancia].quantidade,
    valorRecorrido: atual[instancia].recorrido / 100,
    valorRecuperado: atual[instancia].recuperado / 100,
  }));
  const evolucao = Array.from({ length: MESES_EVOLUCAO }, (_, i) => {
    const mes = somarMeses(competencia, i - (MESES_EVOLUCAO - 1));
    const somas = somarPorInstancia(porMes[mes] ?? []);
    return {
      competencia: mes,
      primeiro: somas[1].recorrido / 100,
      segundo: somas[2].recorrido / 100,
      terceiro: somas[3].recorrido / 100,
    };
  });
  return { cards, evolucao };
}
