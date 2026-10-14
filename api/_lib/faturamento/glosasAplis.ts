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

/** `requisicao.CodEventoFatur` de recurso de glosa (1º / 2º). */
const EVENTOS_EM_RECURSO = new Set([7, 16]);
/** `requisicao.CodEventoFatur` de glosa decidida: recebido a menor acatado (18),
 *  glosa total (27), glosa mantida (23), glosa definitiva (8), recurso não acatado (15). */
const EVENTOS_DEFINITIVA = new Set([18, 27, 23, 8, 15]);

const SO_DIGITOS = /^\d+$/;

export type StatusGlosaAplis = 'aberta' | 'em_recurso' | 'definitiva';

export type PuladoGlosa = 'sem-motivo' | 'glosa-manual' | 'passa-do-saldo' | 'sem-nota' | 'tipo';

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
}

export interface GlosaSugerida {
  idLote: number;
  codigo: string | null;
  motivo: string;
  status: StatusGlosaAplis;
  valor: number;
  procedimentos: number;
}

export interface EntradaGlosasSugeridas {
  /** Tipo da conferência do recebido; null quando o recebido bate. */
  tipo: TipoDivergenciaAplis | null;
  temNota: boolean;
  /** Saldo do título depois das baixas sugeridas. */
  saldo: number;
  /** Glosas já lançadas no título (qualquer status): por ora todas contam como manuais. */
  glosasSistema: number;
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

/**
 * Glosas a lançar num título, ou o motivo de não lançar nenhuma. Uma por lote +
 * código + status (sem código, por motivo), com o valor somado em centavos;
 * grupo abaixo de R$ 0,01 fica fora. Título `sistema-maior`/`lote-ausente`, sem
 * número, com glosa já lançada ou cuja glosa passaria do saldo (tolerância
 * R$ 1,00) não recebe nenhuma.
 */
export function glosasSugeridas(entrada: EntradaGlosasSugeridas): ResultadoGlosasSugeridas {
  const grupos = new Map<string, GlosaSugerida & { centavos: number }>();
  let semMotivo = false;
  for (const d of entrada.diferencas) {
    const identificacao = codigoEMotivo(d);
    if (!identificacao) {
      if (centavos(d.valor) >= 1) semMotivo = true;
      continue;
    }
    const status = statusDa(d);
    const chave = `${d.idLote}|${identificacao.codigo ?? `texto:${identificacao.motivo}`}|${status}`;
    const grupo = grupos.get(chave)
      ?? { idLote: d.idLote, ...identificacao, status, valor: 0, procedimentos: 0, centavos: 0 };
    grupo.centavos += centavos(d.valor);
    grupo.procedimentos += d.procedimentos;
    grupos.set(chave, grupo);
  }

  const glosas = [...grupos.values()]
    .filter((g) => g.centavos >= 1)
    .sort((a, b) => a.idLote - b.idLote
      || (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR', { numeric: true })
      || a.motivo.localeCompare(b.motivo, 'pt-BR')
      || a.status.localeCompare(b.status))
    .map(({ centavos: valorCentavos, ...g }) => ({ ...g, valor: valorCentavos / 100 }));

  if (glosas.length === 0 && !semMotivo) return { glosas: [], puladoGlosa: null };

  // Do motivo mais forte para o mais fraco: o tipo e a falta de número valem
  // para o título inteiro, com ou sem motivo no apLIS.
  const pular = (puladoGlosa: PuladoGlosa): ResultadoGlosasSugeridas => ({ glosas: [], puladoGlosa });
  if (entrada.tipo === 'sistema-maior' || entrada.tipo === 'lote-ausente') return pular('tipo');
  if (!entrada.temNota) return pular('sem-nota');
  if (glosas.length === 0) return pular('sem-motivo');
  if (entrada.glosasSistema > 0) return pular('glosa-manual');
  if (somaCentavos(glosas) - centavos(entrada.saldo) > TOLERANCIA_SALDO_CENTAVOS) return pular('passa-do-saldo');

  return { glosas, puladoGlosa: null };
}
