// Validação e casamento (upsert) da importação de custos de Fontes Pagadoras —
// ver .scratch/controle-custos-fontes-pagadoras-export-import/issues/02-importar-custos-fontes-pagadoras.md.
// Extraído pra ser testado sem montar componente React nem chamar o Supabase
// (mesmo padrão de busca.ts/exportacao.ts).

import type { Exam, Payor } from '../../../hooks/useCostControl';
import { chaveExclusaoExame, examesDoTuss, normalizar } from './busca';

/** Linha válida da planilha: só TUSS e valor — o Atendido não vem mais da
 *  planilha, é calculado pelo % máx CSP (ver calcularAtendidoImportacao). */
export interface LinhaPlanilhaFontePagadora {
  tuss: string;
  valor: number;
}

/** O que a importação grava em custo_fontes_pagadoras. */
export interface LinhaImportacaoFontePagadora extends LinhaPlanilhaFontePagadora {
  atendido: boolean;
}

/** Colunas lidas da planilha. Uma coluna Atendido de planilha antiga não é
 *  lida — o Atendido é calculado. */
export interface LinhaBrutaImportacao {
  tuss: unknown;
  nomeExame: unknown;
  valor: unknown;
}

export interface LinhaValidada {
  row: number;
  data: LinhaPlanilhaFontePagadora | null;
  error?: string;
}

/** Planilhas em pt-BR costumam vir com "1.234,56"; aceita também o formato
 *  já numérico que o próprio xlsx entrega para células de número puro. */
export function parseValorImportacao(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/R\$\s?/i, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Campo % máx CSP do modal (em %, "32,5" ou "32.5"). Vazio/inválido/negativo
 *  vira null — não há limite padrão, e o Importar fica desabilitado. */
export function parseLimiteCsp(v: string): number | null {
  const s = v.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s);
}

/** Valida as linhas brutas da planilha: TUSS precisa existir em
 *  `custo_exames` (tussValidos) — quem não existe é marcado inválido e não é
 *  gravado. `Nome do Exame` é só informativo, não entra no resultado (o
 *  casamento é sempre por TUSS). */
export function validarLinhasImportacaoFontePagadora(
  linhas: LinhaBrutaImportacao[],
  tussValidos: Set<string>,
): LinhaValidada[] {
  return linhas.map((raw, idx) => {
    const tuss = String(raw.tuss ?? '').trim();
    if (!tuss) {
      return { row: idx + 2, data: null, error: 'TUSS vazio' };
    }
    if (!tussValidos.has(tuss)) {
      return { row: idx + 2, data: null, error: `TUSS ${tuss} não cadastrado em Exames` };
    }
    return {
      row: idx + 2,
      data: {
        tuss,
        valor: parseValorImportacao(raw.valor),
      },
    };
  });
}

export interface AtualizacaoFontePagadora {
  id: string;
  tuss: string;
  valor: number;
  atendido: boolean;
}

export interface SeparacaoUpsertFontePagadora {
  toInsert: LinhaImportacaoFontePagadora[];
  toUpdate: AtualizacaoFontePagadora[];
}

/** Separa as linhas válidas em inserção (TUSS novo para a fonte pagadora) vs
 *  atualização (TUSS já cadastrado para ela). Se a planilha repetir o mesmo
 *  TUSS mais de uma vez, "último vence" — sem isso duas linhas novas com o
 *  mesmo TUSS iriam as duas para inserção (não há constraint de unicidade em
 *  custo_fontes_pagadoras que pegue isso no banco). `existentesPorTuss`
 *  mapeia tuss -> id da linha já cadastrada em `custo_fontes_pagadoras` para
 *  a fonte pagadora + tabela associada escolhidas no modal. */
export function separarUpsertFontePagadora(
  linhas: LinhaImportacaoFontePagadora[],
  existentesPorTuss: Map<string, string>,
): SeparacaoUpsertFontePagadora {
  const porTuss = new Map<string, LinhaImportacaoFontePagadora>();
  linhas.forEach(linha => porTuss.set(linha.tuss, linha));

  const toInsert: LinhaImportacaoFontePagadora[] = [];
  const toUpdate: AtualizacaoFontePagadora[] = [];

  porTuss.forEach(linha => {
    const id = existentesPorTuss.get(linha.tuss);
    if (id) {
      toUpdate.push({ id, tuss: linha.tuss, valor: linha.valor, atendido: linha.atendido });
    } else {
      toInsert.push(linha);
    }
  });

  return { toInsert, toUpdate };
}

/** Linhas de custo_fontes_pagadoras da fonte + tabela associada escolhidas no
 *  modal — comparação exata, a mesma do upsert de importPayors. */
export function linhasDaFonteETabela(payors: Payor[], fontePagadora: string, tabelaAssociada: string): Payor[] {
  return payors.filter(p => p.payor === fontePagadora && p.table === tabelaAssociada);
}

export interface EntradaCalculoAtendido {
  linhas: LinhaPlanilhaFontePagadora[];
  exams: Exam[];
  payors: Payor[];
  // Fonte pagadora + tabela associada escolhidas no modal.
  fontePagadora: string;
  tabelaAssociada: string;
  // Chaves chaveExclusaoExame(payorId, exameId) — ver custo_fontes_pagadoras_exclusoes.
  excluidos: Set<string>;
  // % máx CSP informado no modal, em porcentagem (30 = 30%).
  limiteCsp: number;
}

export interface LinhaComAtendidoCalculado extends LinhaImportacaoFontePagadora {
  custoUsado: number;
  // custoUsado / valor * 100, sem arredondar; null quando valor ≤ 0.
  csp: number | null;
}

/** Atendido de cada linha da planilha pelo % máx CSP — ver
 *  .scratch/controle-custos-importacao-csp/spec.md. */
export function calcularAtendidoImportacao({
  linhas,
  exams,
  payors,
  fontePagadora,
  tabelaAssociada,
  excluidos,
  limiteCsp,
}: EntradaCalculoAtendido): LinhaComAtendidoCalculado[] {
  // Linha geral já cadastrada por TUSS — a que a importação vai atualizar
  // (comparação exata e "último vence", como o existentesPorTuss de
  // importPayors). TUSS novo pra fonte não tem linha geral, logo não tem
  // exclusões.
  const linhaGeralPorTuss = new Map<string, Payor>();
  linhasDaFonteETabela(payors, fontePagadora, tabelaAssociada).forEach(p => {
    if (!p.exameId) linhaGeralPorTuss.set(p.tus, p);
  });

  // Exames com linha própria: a linha geral não vale pra eles, então o preço
  // importado também não. Fonte + tabela comparadas normalizadas, como a
  // precedência de examesPorFontePagadora na tela ("PARTICULAR" = "Particular").
  const fonte = normalizar(fontePagadora);
  const tabela = normalizar(tabelaAssociada);
  const comLinhaPropria = new Set(
    payors
      .filter(p => p.exameId && normalizar(p.payor) === fonte && normalizar(p.table) === tabela)
      .map(p => p.exameId!),
  );

  return linhas.map(linha => {
    const linhaGeral = linhaGeralPorTuss.get(linha.tuss);
    const cobertos = examesDoTuss(exams, linha.tuss).filter(
      e => !comLinhaPropria.has(e.id) && !(linhaGeral && excluidos.has(chaveExclusaoExame(linhaGeral.id, e.id))),
    );
    const custoUsado = Math.max(0, ...cobertos.map(e => e.direct + e.indirect));
    // custo * 100 / valor (e não custo / valor * 100): 7 / 100 * 100 dá
    // 7.000000000000001 e derrubaria um CSP exatamente no limite.
    const csp = linha.valor > 0 ? (custoUsado * 100) / linha.valor : null;
    // Preço ausente ou custo não cadastrado nunca viram convênio aceito.
    const atendido = csp !== null && custoUsado > 0 && csp <= limiteCsp;
    return { ...linha, custoUsado, csp, atendido };
  });
}
