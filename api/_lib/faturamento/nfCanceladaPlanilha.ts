// api/_lib/faturamento/nfCanceladaPlanilha.ts
// Regras da importação da aba "NF CANCELADAS FORA APLIS" da planilha "CONTROLE
// DE EMISSÃO DE NOTAS" — issue 04 de .scratch/faturamento-nf-cancelada. Quem lê
// a planilha e os bancos e escreve a migration é
// supabase/scripts/importar-nfs-canceladas-planilha.ts.

import { centavos } from './conferenciaAplis.js';

/** A NF cancelada como a planilha (e o apLIS, para os lotes) a descrevem. */
export interface NfCanceladaPlanilha {
  operadoraId: string;
  /** YYYY-MM-DD */
  emissao: string;
  valor: number;
  /** Ids dos lotes do apLIS que a NF citava. */
  lotes: number[];
}

/** Título do Contas a Receber que pode ter substituído a NF cancelada. */
export interface TituloCandidato {
  id: string;
  operadoraId: string;
  /** YYYY-MM-DD; título sem emissão nunca é candidato. */
  emissao: string | null;
  valor: number;
  /** Ids dos lotes do apLIS ligados ao título. */
  lotes: number[];
}

export type Substituto =
  | { tipo: 'unico'; tituloId: string }
  | { tipo: 'nenhum' }
  | { tipo: 'varios'; tituloIds: string[] };

/** Prazo, em dias depois da emissão da NF cancelada, para a substituta ser emitida. */
export const JANELA_SUBSTITUTO_DIAS = 30;

const dias = (de: string, ate: string) => (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000;

/**
 * O título que substituiu a NF cancelada: da mesma operadora, emitido no mesmo
 * dia ou até JANELA_SUBSTITUTO_DIAS dias depois dela e com um lote em comum ou o mesmo valor. Só
 * liga quando há um candidato só; com nenhum ou mais de um, a NF fica sem título.
 */
export function tituloSubstituto(nf: NfCanceladaPlanilha, titulos: TituloCandidato[]): Substituto {
  const lotes = new Set(nf.lotes);
  const candidatos = titulos.filter((t) => {
    if (t.operadoraId !== nf.operadoraId || !t.emissao) return false;
    const depois = dias(nf.emissao, t.emissao);
    if (depois < 0 || depois > JANELA_SUBSTITUTO_DIAS) return false;
    return t.lotes.some((l) => lotes.has(l)) || centavos(t.valor) === centavos(nf.valor);
  });
  if (candidatos.length === 1) return { tipo: 'unico', tituloId: candidatos[0].id };
  if (candidatos.length === 0) return { tipo: 'nenhum' };
  return { tipo: 'varios', tituloIds: candidatos.map((t) => t.id) };
}

/**
 * Ids dos lotes citados no texto da NF no apLIS (`fatrps.DadosAdicionais`):
 * "REFERENTE AO LOTE 4967", "LT 4964", "LOTES: 4941,5023 E 4939". Na NF
 * cancelada o apLIS já não liga o lote (`fatlote.IdRPS` aponta para a nova),
 * então o texto é o único rastro.
 */
export function lotesDoTexto(texto: string | null): number[] {
  const lotes = new Set<number>();
  for (const [, lista] of (texto ?? '').matchAll(/\b(?:LOTES?|LT)\b\s*:?\s*((?:\d+\s*(?:,|\bE\b)?\s*)+)/gi)) {
    for (const [n] of lista.matchAll(/\d+/g)) lotes.add(Number(n));
  }
  return [...lotes];
}

/** Operadora do flowlab, com o que serve para achá-la a partir do apLIS. */
export interface OperadoraFlowlab {
  id: string;
  nome: string;
  cnpj: string | null;
  aplisId: string | null;
}

/** A NF no apLIS (`fatrps`), quando ela está lá. */
export interface NfNoAplis {
  idInstituicao: number | null;
  cnpjTomador: string | null;
}

/** Como a operadora foi achada, na ordem em que as fontes valem. */
export type ViaOperadora = 'apLIS' | 'CNPJ do tomador' | 'nome';

export type OperadoraResolvida =
  | { tipo: 'resolvida'; operadoraId: string; via: ViaOperadora; nomeDiverge: boolean }
  | { tipo: 'ambigua'; candidatas: string[] };

const palavras = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .split(/[^A-Z0-9]+/).filter(Boolean);
const digitos = (v: string | null) => (v ?? '').replace(/\D/g, '');

/**
 * A operadora do flowlab para o nome que a planilha usa ("SIS", "STF MED",
 * "BRADESCO"). Vale primeiro o convênio da NF no apLIS (`IdInstituicao` =
 * `operadoras.aplis_id`), depois o CNPJ do tomador (desempatado pelo nome) e,
 * para a NF que não está no apLIS, o nome: a operadora cujo nome tem todas as
 * palavras do da planilha. `nomeDiverge` marca quando o apLIS ou o CNPJ apontam
 * para uma operadora que o nome não apontaria, para o relatório.
 */
export function resolverOperadora(
  nomePlanilha: string,
  operadoras: OperadoraFlowlab[],
  aplis: NfNoAplis | null,
): OperadoraResolvida {
  const doNome = palavras(nomePlanilha);
  const exatas = operadoras.filter((o) => palavras(o.nome).join(' ') === doNome.join(' '));
  const peloNome = exatas.length > 0 ? exatas
    : operadoras.filter((o) => doNome.every((p) => palavras(o.nome).includes(p)));
  const resolvida = (o: OperadoraFlowlab, via: ViaOperadora): OperadoraResolvida => ({
    tipo: 'resolvida', operadoraId: o.id, via, nomeDiverge: peloNome.length > 0 && !peloNome.includes(o),
  });

  const pelaInstituicao = aplis?.idInstituicao == null ? []
    : operadoras.filter((o) => o.aplisId === String(aplis.idInstituicao));
  if (pelaInstituicao.length === 1) return resolvida(pelaInstituicao[0], 'apLIS');

  const cnpj = digitos(aplis?.cnpjTomador ?? null);
  const peloCnpj = cnpj ? operadoras.filter((o) => digitos(o.cnpj) === cnpj) : [];
  const cnpjENome = peloCnpj.filter((o) => peloNome.includes(o));
  if (peloCnpj.length === 1) return resolvida(peloCnpj[0], 'CNPJ do tomador');
  if (cnpjENome.length === 1) return resolvida(cnpjENome[0], 'CNPJ do tomador');
  if (peloCnpj.length === 0 && peloNome.length === 1) return resolvida(peloNome[0], 'nome');

  const candidatas = [...new Set([...pelaInstituicao, ...peloCnpj, ...peloNome])];
  return { tipo: 'ambigua', candidatas: candidatas.map((o) => o.nome) };
}
