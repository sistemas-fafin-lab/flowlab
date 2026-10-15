// api/_lib/faturamento/glosasAplis.ts
// Glosas sugeridas a partir do apLIS (.scratch/faturamento-glosas-automaticas-aplis/spec.md):
// o que o apLIS deixou de receber num título, com motivo, agrupado em uma glosa
// por lote + código + status. Puro — o handler busca as diferenças dos lotes na
// réplica (`diferencasDosLotes` em bdLab.ts) e as glosas do sistema.
//
// No apLIS a glosa não é digitada: a importação do demonstrativo preenche, por
// procedimento, o recebido e o motivo. Diferença sem motivo pode ser só
// pagamento atrasado — fica de fora.

import { centavos, somaCentavos } from './conferenciaAplis.js';
import type { TipoDivergenciaAplis } from './conferenciaAplis.js';

/** Quanto a soma das glosas pode passar do saldo do título (arredondamento). */
const TOLERANCIA_SALDO_CENTAVOS = 100;
/** Quanto a glosa do apLIS pode diferir da do demonstrativo e ainda "conferir". */
const TOLERANCIA_DEMONSTRATIVO_CENTAVOS = 1;

/** `requisicao.CodEventoFatur` de recurso de glosa (1º / 2º). */
const EVENTOS_EM_RECURSO = new Set([7, 16]);
/** `requisicao.CodEventoFatur` de glosa decidida: recebido a menor acatado (18),
 *  glosa total (27), glosa mantida (23), glosa definitiva (8), recurso não acatado (15). */
const EVENTOS_DEFINITIVA = new Set([18, 27, 23, 8, 15]);

const SO_DIGITOS = /^\d+$/;

export type StatusGlosaAplis = 'aberta' | 'em_recurso' | 'definitiva';

export type PuladoGlosa = 'sem-motivo' | 'glosa-manual' | 'passa-do-saldo' | 'tipo';

/** Procedimentos de um lote recebidos a menor no apLIS, já somados por motivo e situação. */
export interface DiferencaAplis {
  /** `aplis_id` do lote. */
  idLote: number;
  /** `fatmotivoglosa.Codigo` (via `IdMotivoGlosa`). */
  motivoCodigo: number | null;
  motivoDescricao: string | null;
  /** Texto livre da requisição — às vezes só o código ("3292"). */
  desMotivoGlosa: string | null;
  /** Situação da requisição (`requisicao.CodEventoFatur`). */
  codEventoFatur: number | null;
  /** Procedimento num lote de recurso (`fatloterecursoprocedimento`). */
  emRecurso: boolean;
  /** Σ(ValorLiquido − ValorRecebido). */
  valor: number;
  procedimentos: number;
  /** Σ `VlrGlosa` do demonstrativo mais recente dos procedimentos que têm
   *  demonstrativo; null quando nenhum tem. */
  demonstrativoValor: number | null;
}

/** Glosa já lançada no título. */
export interface GlosaSistema {
  /** 'aplis': lançada pelo "Aplicar baixas e glosas do apLIS"; null: digitada à mão. */
  origem: 'aplis' | null;
  /** `aplis_id` do lote da glosa. */
  idLote: number | null;
  codigo: string | null;
  motivo: string;
  status: StatusGlosaAplis | 'revertida';
  valor: number;
}

export interface GlosaSugerida {
  idLote: number;
  codigo: string | null;
  motivo: string;
  status: StatusGlosaAplis;
  valor: number;
  procedimentos: number;
  /** A glosa do apLIS bate com a do demonstrativo importado (só informação, não
   *  muda a seleção); null quando nenhum procedimento do grupo tem demonstrativo. */
  demonstrativo: ConferenciaDemonstrativo | null;
}

export type ConferenciaDemonstrativo = 'confere' | 'difere';

export interface EntradaGlosasSugeridas {
  /** Tipo da conferência do recebido; null quando o recebido bate. */
  tipo: TipoDivergenciaAplis | null;
  /** Saldo do título depois das baixas sugeridas. */
  saldo: number;
  /** Glosas já lançadas no título (qualquer status). As do apLIS descontam da
   *  sugestão; qualquer outra (digitada à mão) pula o título. */
  glosasSistema: GlosaSistema[];
  diferencas: DiferencaAplis[];
}

export interface ResultadoGlosasSugeridas {
  glosas: GlosaSugerida[];
  /** Por que não há glosa a lançar; null quando há, ou quando o apLIS não tem diferença. */
  puladoGlosa: PuladoGlosa | null;
}

function statusDa(d: DiferencaAplis): StatusGlosaAplis {
  if (d.emRecurso || (d.codEventoFatur !== null && EVENTOS_EM_RECURSO.has(d.codEventoFatur))) return 'em_recurso';
  if (d.codEventoFatur !== null && EVENTOS_DEFINITIVA.has(d.codEventoFatur)) return 'definitiva';
  return 'aberta';
}

/** Código e motivo: catálogo; sem catálogo, o texto livre (que às vezes é só o código). */
function codigoEMotivo(d: DiferencaAplis): { codigo: string | null; motivo: string } | null {
  if (d.motivoCodigo !== null) {
    const codigo = String(d.motivoCodigo);
    return { codigo, motivo: d.motivoDescricao ?? `Código ${codigo} (do apLIS)` };
  }
  const des = d.desMotivoGlosa;
  if (des === null) return null;
  if (SO_DIGITOS.test(des)) return { codigo: des, motivo: `Código ${des} (do apLIS)` };
  return { codigo: null, motivo: des };
}

/** Lote + código (sem código, o motivo em texto livre): a chave do desconto. */
function chaveLoteCodigo(idLote: number | null, codigo: string | null, motivo: string): string {
  return `${idLote}|${codigo ?? `texto:${motivo}`}`;
}

/**
 * Desconta dos grupos, por lote + código, o que já foi lançado do apLIS (fora as
 * revertidas). Primeiro do grupo de mesmo status, depois dos outros: a glosa
 * lançada aberta continua contando quando o apLIS passa a requisição a definitiva
 * (atualizar o status é fora do escopo).
 */
function descontarLancadas(
  grupos: Map<string, { centavos: number; status: StatusGlosaAplis }>,
  glosasSistema: GlosaSistema[],
): void {
  for (const lancada of glosasSistema) {
    if (lancada.origem !== 'aplis' || lancada.status === 'revertida') continue;
    const chave = chaveLoteCodigo(lancada.idLote, lancada.codigo, lancada.motivo);
    const doLote = [...grupos].filter(([k]) => k.startsWith(`${chave}|`)).map(([, g]) => g);
    doLote.sort((a, b) => Number(b.status === lancada.status) - Number(a.status === lancada.status));
    let restante = centavos(lancada.valor);
    for (const grupo of doLote) {
      const desconto = Math.min(restante, grupo.centavos);
      grupo.centavos -= desconto;
      restante -= desconto;
    }
  }
}

type GrupoGlosa = Omit<GlosaSugerida, 'demonstrativo'> & {
  /** O que falta lançar: o glosado no apLIS menos o já lançado (`descontarLancadas`). */
  centavos: number;
  /** O glosado no apLIS, sem desconto — o que se confere com o demonstrativo. */
  brutoCentavos: number;
  demonstrativoCentavos: number | null;
};

/** Compara o glosado do grupo no apLIS com o do demonstrativo. Procedimento do
 *  grupo sem demonstrativo conta como 0 nele. */
function conferirDemonstrativo(
  grupo: Pick<GrupoGlosa, 'brutoCentavos' | 'demonstrativoCentavos'>,
): ConferenciaDemonstrativo | null {
  if (grupo.demonstrativoCentavos === null) return null;
  return Math.abs(grupo.brutoCentavos - grupo.demonstrativoCentavos) <= TOLERANCIA_DEMONSTRATIVO_CENTAVOS ? 'confere' : 'difere';
}

/**
 * Glosas a lançar num título, ou o motivo de não lançar nenhuma. Uma por lote +
 * código + status (sem código, por motivo), com o valor somado em centavos e
 * descontado o que já foi lançado do apLIS; grupo abaixo de R$ 0,01 fica fora.
 * Título `sistema-maior`/`lote-ausente`, com glosa digitada à mão ou
 * cuja glosa passaria do saldo (tolerância R$ 1,00) não recebe nenhuma. Cada
 * glosa leva a conferência com o demonstrativo, que não muda nada disso.
 */
export function glosasSugeridas(entrada: EntradaGlosasSugeridas): ResultadoGlosasSugeridas {
  const grupos = new Map<string, GrupoGlosa>();
  let semMotivo = false;
  for (const d of entrada.diferencas) {
    const identificacao = codigoEMotivo(d);
    if (!identificacao) {
      if (centavos(d.valor) >= 1) semMotivo = true;
      continue;
    }
    const status = statusDa(d);
    const chave = `${chaveLoteCodigo(d.idLote, identificacao.codigo, identificacao.motivo)}|${status}`;
    const grupo = grupos.get(chave) ?? {
      idLote: d.idLote, ...identificacao, status, valor: 0, procedimentos: 0,
      centavos: 0, brutoCentavos: 0, demonstrativoCentavos: null,
    };
    grupo.centavos += centavos(d.valor);
    grupo.brutoCentavos += centavos(d.valor);
    if (d.demonstrativoValor !== null) {
      grupo.demonstrativoCentavos = (grupo.demonstrativoCentavos ?? 0) + centavos(d.demonstrativoValor);
    }
    grupo.procedimentos += d.procedimentos;
    grupos.set(chave, grupo);
  }
  descontarLancadas(grupos, entrada.glosasSistema);

  const glosas = [...grupos.values()]
    .filter((g) => g.centavos >= 1)
    .sort((a, b) => a.idLote - b.idLote
      || (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR', { numeric: true })
      || a.motivo.localeCompare(b.motivo, 'pt-BR')
      || a.status.localeCompare(b.status))
    .map(({ centavos: valorCentavos, brutoCentavos, demonstrativoCentavos, ...g }) => ({
      ...g,
      valor: valorCentavos / 100,
      demonstrativo: conferirDemonstrativo({ brutoCentavos, demonstrativoCentavos }),
    }));

  if (glosas.length === 0 && !semMotivo) return { glosas: [], puladoGlosa: null };

  // Do motivo mais forte para o mais fraco: o tipo e a falta de número valem
  // para o título inteiro, com ou sem motivo no apLIS.
  const pular = (puladoGlosa: PuladoGlosa): ResultadoGlosasSugeridas => ({ glosas: [], puladoGlosa });
  if (entrada.tipo === 'sistema-maior' || entrada.tipo === 'lote-ausente') return pular('tipo');
  if (glosas.length === 0) return pular('sem-motivo');
  if (entrada.glosasSistema.some((g) => g.origem === null)) return pular('glosa-manual');
  if (somaCentavos(glosas) - centavos(entrada.saldo) > TOLERANCIA_SALDO_CENTAVOS) return pular('passa-do-saldo');

  return { glosas, puladoGlosa: null };
}
