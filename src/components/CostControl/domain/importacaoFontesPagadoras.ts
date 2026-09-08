// Validação e casamento (upsert) da importação de custos de Fontes Pagadoras —
// ver .scratch/controle-custos-fontes-pagadoras-export-import/issues/02-importar-custos-fontes-pagadoras.md.
// Extraído pra ser testado sem montar componente React nem chamar o Supabase
// (mesmo padrão de busca.ts/exportacao.ts).

export interface LinhaImportacaoFontePagadora {
  tuss: string;
  valor: number;
  atendido: boolean;
}

export interface LinhaBrutaImportacao {
  tuss: unknown;
  nomeExame: unknown;
  valor: unknown;
  atendido: unknown;
}

export interface LinhaValidada {
  row: number;
  data: LinhaImportacaoFontePagadora | null;
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

/** "Sim"/"Não" — célula vazia conta como atendido (mesmo default da coluna
 *  `atendido` no banco, que é TRUE). */
export function parseAtendidoImportacao(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return true;
  return s === 'sim' || s === 's' || s === 'true' || s === '1';
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
        atendido: parseAtendidoImportacao(raw.atendido),
      },
    };
  });
}

export interface AtualizacaoFontePagadora {
  id: string;
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
      toUpdate.push({ id, valor: linha.valor, atendido: linha.atendido });
    } else {
      toInsert.push(linha);
    }
  });

  return { toInsert, toUpdate };
}
