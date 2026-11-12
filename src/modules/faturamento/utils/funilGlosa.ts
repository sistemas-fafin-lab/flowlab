// Aba Contas a Receber → Comparativos: funil de glosa por competência (mês de emissão do
// título), com glosa, acatada e saldo atribuídos ao lote
// (.scratch/faturamento-comparativos/issues/04-funil-de-glosa-por-competencia.md).
//
// Funções puras sobre linhas já lidas, compartilhadas pela rota e pela tela: não importam
// nada do navegador. Os valores são somados em centavos inteiros.

import type { PeriodoComparativo } from './comparativos';

/** Rótulo da linha das glosas (e do saldo) que não têm lote. */
export const FORA_DE_LOTE = 'Fora de lote';

export interface LoteRef {
  /** `lotes.id_lote`. */
  id: string;
  /** `lotes.codigo_lote`. */
  codigo: string | null;
}

/** Título (nota) emitido, como o Supabase o guarda. Cancelados já ficam de fora da leitura. */
export interface TituloFunil {
  idNota: string;
  /** YYYY-MM-DD; sem data o título não entra em mês nenhum. */
  dataEmissao: string | null;
  valorTotal: number;
  valorRecebido: number;
  lotes: LoteRef[];
}

export type ClasseGlosaFunil = 'recuperada' | 'acatada' | 'em-disputa';

/**
 * Uma requisição da foto de recursos do apLIS já classificada (glosaRecuperada.ts). Cada
 * requisição entra uma vez, em uma classe só.
 */
export interface GlosaFunil {
  /** Lote de faturamento no Supabase; null quando o lote do apLIS não tem título (não cancelado) aqui. */
  lote: LoteRef | null;
  /** YYYY-MM do lote de faturamento no apLIS; só dá o mês quando o lote não tem título. */
  competencia: string;
  classe: ClasseGlosaFunil;
  valor: number;
}

export interface LinhaLoteFunil {
  /** null na linha "Fora de lote". */
  loteId: string | null;
  codigo: string;
  /** recuperada + acatada + em disputa. */
  glosaTotal: number;
  recuperada: number;
  acatada: number;
  emDisputa: number;
  /** Parte do saldo dos títulos atribuída ao lote (dividida entre os lotes do título). */
  saldo: number;
}

export interface FunilGlosaMes {
  mes: string;
  faturado: number;
  /** Inclui a recuperada: ela é detalhe do recebido, não uma etapa a mais. */
  recebido: number;
  recuperada: number;
  acatada: number;
  emDisputa: number;
  /** recuperada + acatada + em disputa. */
  glosaTotal: number;
  /**
   * Acatada + em disputa de "Fora de lote": entram nos totais (para bater com a tela Glosas e
   * Recursos), mas não abatem o saldo, porque o faturado delas não está no mês.
   */
  foraDeLote: number;
  /** faturado − recebido − (acatada + em disputa − fora de lote). */
  saldo: number;
  lotes: LinhaLoteFunil[];
}

const paraCentavos = (valor: number) => Math.round(valor * 100);
const emReais = (centavos: number) => centavos / 100 + 0; // + 0 evita -0

interface Acumulado {
  recuperada: number;
  acatada: number;
  emDisputa: number;
  saldo: number;
}

const vazio = (): Acumulado => ({ recuperada: 0, acatada: 0, emDisputa: 0, saldo: 0 });

/** Divide `centavos` em `partes` pedaços inteiros; a sobra vai um a um para os primeiros. */
function dividir(centavos: number, partes: number): number[] {
  const base = Math.trunc(centavos / partes);
  let resto = centavos - base * partes;
  const passo = resto < 0 ? -1 : 1;
  return Array.from({ length: partes }, () => {
    if (resto === 0) return base;
    resto -= passo;
    return base + passo;
  });
}

/**
 * Funil de cada período (referência, M-1, M-2, na ordem de `periodos`).
 *
 * - Competência: o título entra no mês da sua data de emissão. A glosa segue o lote: vale o
 *   mês do título de emissão mais antiga do lote, em qualquer data (`primeiraEmissaoDoLote`
 *   completa os títulos fora dos 3 meses); sem título, o mês de criação do lote no apLIS.
 * - Acatada, em disputa e recuperada vêm da foto do apLIS (a mesma regra que abate o saldo: acatada
 *   = status 18 e 8). A recuperada é detalhe do recebido: não entra na conta do saldo.
 * - Glosa de lote sem título vai para a linha "Fora de lote" e entra nos totais, mas não abate
 *   o saldo: não há faturado dela no mês.
 * - Saldo da linha = parte do (total − recebido) dos títulos do lote − acatada − em disputa dela
 *   (na linha "Fora de lote", só a parte dos títulos sem lote). A soma das linhas é o saldo do mês.
 */
export function montarFunilGlosa(
  periodos: PeriodoComparativo[],
  titulos: TituloFunil[],
  glosas: GlosaFunil[],
  primeiraEmissaoDoLote: ReadonlyMap<string, string> = new Map(),
): FunilGlosaMes[] {
  // Mês em que cada lote "nasce": o da emissão mais antiga entre os títulos dele.
  const emissaoDoLote = new Map(primeiraEmissaoDoLote);
  for (const t of titulos) {
    if (!t.dataEmissao) continue;
    for (const l of t.lotes) {
      const atual = emissaoDoLote.get(l.id);
      if (atual === undefined || t.dataEmissao < atual) emissaoDoLote.set(l.id, t.dataEmissao);
    }
  }
  const mesDaGlosa = (g: GlosaFunil) => (g.lote ? emissaoDoLote.get(g.lote.id)?.slice(0, 7) : undefined) ?? g.competencia;

  return periodos.map((periodo): FunilGlosaMes => {
    const dosTitulos = titulos.filter((t) => t.dataEmissao?.slice(0, 7) === periodo.mes);

    const porLote = new Map<string, { codigo: string; loteId: string | null; acc: Acumulado }>();
    const linha = (lote: LoteRef | null) => {
      const chave = lote?.id ?? FORA_DE_LOTE;
      let l = porLote.get(chave);
      if (!l) {
        l = { codigo: lote ? (lote.codigo ?? lote.id) : FORA_DE_LOTE, loteId: lote?.id ?? null, acc: vazio() };
        porLote.set(chave, l);
      }
      return l.acc;
    };

    let recuperada = 0;
    let acatada = 0;
    let emDisputa = 0;
    let foraDeLote = 0;
    for (const g of glosas) {
      if (mesDaGlosa(g) !== periodo.mes) continue;
      const valor = paraCentavos(g.valor);
      const alvo = linha(g.lote);
      if (g.classe === 'recuperada') {
        recuperada += valor;
        alvo.recuperada += valor;
        continue;
      }
      if (g.classe === 'acatada') {
        acatada += valor;
        alvo.acatada += valor;
      } else {
        emDisputa += valor;
        alvo.emDisputa += valor;
      }
      if (g.lote) alvo.saldo -= valor;
      else foraDeLote += valor;
    }

    let faturado = 0;
    let recebido = 0;
    for (const t of dosTitulos) {
      const total = paraCentavos(t.valorTotal);
      const recebidoTitulo = paraCentavos(t.valorRecebido);
      faturado += total;
      recebido += recebidoTitulo;
      const aReceber = total - recebidoTitulo;
      if (t.lotes.length === 0) {
        linha(null).saldo += aReceber;
      } else {
        dividir(aReceber, t.lotes.length).forEach((parte, i) => { linha(t.lotes[i]).saldo += parte; });
      }
    }

    const lotes = [...porLote.values()]
      .map(({ codigo, loteId, acc }): LinhaLoteFunil => ({
        loteId,
        codigo,
        glosaTotal: emReais(acc.recuperada + acc.acatada + acc.emDisputa),
        recuperada: emReais(acc.recuperada),
        acatada: emReais(acc.acatada),
        emDisputa: emReais(acc.emDisputa),
        saldo: emReais(acc.saldo),
      }))
      .filter((l) => l.glosaTotal !== 0 || l.saldo !== 0)
      .sort((a, b) => {
        if ((a.loteId === null) !== (b.loteId === null)) return a.loteId === null ? 1 : -1;
        return b.glosaTotal - a.glosaTotal || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
      });

    return {
      mes: periodo.mes,
      faturado: emReais(faturado),
      recebido: emReais(recebido),
      recuperada: emReais(recuperada),
      acatada: emReais(acatada),
      emDisputa: emReais(emDisputa),
      glosaTotal: emReais(recuperada + acatada + emDisputa),
      foraDeLote: emReais(foraDeLote),
      saldo: emReais(faturado - recebido - (acatada + emDisputa - foraDeLote)),
      lotes,
    };
  });
}
