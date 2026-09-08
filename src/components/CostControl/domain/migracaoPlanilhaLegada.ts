// Resolução de fonte pagadora/tabela associada e extração de linhas da
// planilha legada "VALORES ANÁLISES CLÍNICAS" — ver
// .scratch/controle-custos-fontes-pagadoras-export-import/issues/03-migrar-planilha-legada-fontes-pagadoras.md.
// Extraído do script (supabase/scripts/migrar-planilha-legada-fontes-pagadoras.ts)
// pra ser testado sem xlsx/Supabase, mesmo padrão de importacaoFontesPagadoras.ts.

import type { LinhaBrutaImportacao } from './importacaoFontesPagadoras';

/** Chave de comparação tolerante a acento/caixa/espaço nas bordas — os nomes de
 *  aba e de convênio da planilha não são consistentes nisso (ex.: "GDF ", "ASSEFAZ "). */
export const normalizarChave = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();

const ABAS_EXCLUIDAS = new Set(['CONVENIOS ACEITOS', 'CUSTO ALVARO', 'TABELA REF', 'PESQUISAR CUSTOS']);

export type TipoAba = 'migrar' | 'excluida' | 'gama' | 'assefaz-antiga';

/** Classifica a aba antes de decidir se ela vira fonte pagadora:
 *  - excluida: referência/rascunho, nunca é fonte pagadora (Convenios aceitos, Custo Alvaro, TABELA REF, PESQUISAR CUSTOS)
 *  - gama: usa códigos AMB/92/CBHPM em vez de TUSS, cadastro manual posterior
 *  - assefaz-antiga: versão velha da ASSEFAZ, descartada em favor de "ASSEFAZ REAJUSTE"
 *  - migrar: qualquer outra aba de convênio */
export function identificarTipoAba(nomeAba: string): TipoAba {
  const chave = normalizarChave(nomeAba);
  if (ABAS_EXCLUIDAS.has(chave)) return 'excluida';
  if (chave === 'GAMA') return 'gama';
  if (chave === 'ASSEFAZ') return 'assefaz-antiga';
  return 'migrar';
}

/** Constrói o mapa convênio → Parceiro a partir da aba "Convenios aceitos"
 *  (lida com XLSX.utils.sheet_to_json(sheet, {header: 1}) — cada linha é um
 *  array [número, Convênio, Parceiro]). Convênio sem Parceiro cadastrado
 *  entra no mapa com valor null (não com a chave ausente), pra deixar
 *  explícito que ele foi conferido e não tem parceiro, não que a aba não
 *  tinha aquele convênio listado. */
export function construirMapaParceiros(linhas: unknown[][]): Map<string, string | null> {
  const mapa = new Map<string, string | null>();
  for (const row of linhas) {
    const convenio = row?.[1];
    if (typeof convenio !== 'string' || !convenio.trim()) continue;
    const parceiro = row?.[2];
    mapa.set(normalizarChave(convenio), typeof parceiro === 'string' && parceiro.trim() ? parceiro.trim() : null);
  }
  return mapa;
}

export interface FonteTabela {
  fontePagadora: string;
  tabelaAssociada: string;
}

/** Resolve fonte pagadora + tabela associada pro nome de uma aba de convênio:
 *  - "ASSEFAZ REAJUSTE" é caso especial: migra como fonte pagadora "ASSEFAZ"
 *    (a aba antiga "ASSEFAZ" já foi descartada em identificarTipoAba).
 *  - Nome de aba no formato "<Parceiro>-<Convênio>" (ex: "AMH-AFFEGO"): o
 *    prefixo antes do hífen é a Tabela Associada, o resto é a fonte
 *    pagadora — sem consultar Convenios aceitos (o prefixo já é a fonte da
 *    verdade nesse caso, mesmo quando diverge do que Convenios aceitos diz
 *    pro mesmo convênio, ex: "AMHP-BACEN" vs. BACEN→AMH na lista).
 *  - Nome de aba sem hífen: fonte pagadora é o próprio nome da aba; Tabela
 *    Associada é o Parceiro achado em Convenios aceitos, ou — quando não há
 *    Parceiro cadastrado pra aquele convênio — o próprio nome da fonte
 *    pagadora (mesma convenção do registro seed 'ABAC'/'ABAC': sem uma
 *    entidade administradora distinta, a tabela associada repete a fonte). */
export function resolverFonteTabela(nomeAba: string, parceiroPorConvenio: Map<string, string | null>): FonteTabela {
  const nome = nomeAba.trim();

  if (normalizarChave(nome) === 'ASSEFAZ REAJUSTE') {
    const fontePagadora = 'ASSEFAZ';
    const parceiro = parceiroPorConvenio.get(normalizarChave(fontePagadora));
    return { fontePagadora, tabelaAssociada: parceiro ?? fontePagadora };
  }

  const hifenIdx = nome.indexOf('-');
  if (hifenIdx > 0) {
    const tabelaAssociada = nome.slice(0, hifenIdx).trim();
    const fontePagadora = nome.slice(hifenIdx + 1).trim();
    return { fontePagadora, tabelaAssociada };
  }

  const parceiro = parceiroPorConvenio.get(normalizarChave(nome));
  return { fontePagadora: nome, tabelaAssociada: parceiro ?? nome };
}

export interface ColunasCabecalho {
  headerIdx: number;
  tussCol: number;
  nomeCol: number;
  valorCol: number;
  atendidoCol: number;
}

/** Acha a linha de cabeçalho de uma aba de convênio e o índice de cada
 *  coluna de interesse. As abas não têm um layout fixo: a maioria tem uma
 *  linha em branco antes do cabeçalho ("Codigo TUSS"/"Nome do Exame"/"Valor
 *  convênio"/"OBS"), algumas não têm ("AMHP-BACEN"), e outras usam um
 *  layout totalmente diferente ("CÓDIGO"/"DESCRIÇÃO"/"VALOR FINAL" na
 *  FASCAL). Procura nas primeiras linhas por uma que tenha, ao mesmo
 *  tempo, uma célula de código/TUSS e uma de valor — as outras duas colunas
 *  (nome, atendido) são opcionais, nem toda aba tem as quatro. Retorna null
 *  quando não acha (ex.: GAMA, cujo cabeçalho é AMB/92 · CBHPM · descrição
 *  · valor — não tem nem "tuss" nem "código"). */
export function localizarCabecalho(linhas: unknown[][]): ColunasCabecalho | null {
  const limite = Math.min(linhas.length, 5);
  for (let i = 0; i < limite; i++) {
    const row = linhas[i] ?? [];
    let tussCol = -1;
    let nomeCol = -1;
    let valorCol = -1;
    let atendidoCol = -1;

    row.forEach((cell, idx) => {
      if (typeof cell !== 'string') return;
      const chave = normalizarChave(cell);
      if (tussCol === -1 && (chave.includes('TUSS') || chave.includes('CODIGO'))) {
        tussCol = idx;
      } else if (nomeCol === -1 && (chave.includes('NOME') || chave.includes('DESCRI'))) {
        nomeCol = idx;
      } else if (valorCol === -1 && chave.includes('VALOR')) {
        valorCol = idx;
      } else if (atendidoCol === -1 && (chave.includes('OBS') || chave.includes('ATENDE'))) {
        atendidoCol = idx;
      }
    });

    if (tussCol !== -1 && valorCol !== -1) {
      return { headerIdx: i, tussCol, nomeCol, valorCol, atendidoCol };
    }
  }
  return null;
}

/** Extrai as linhas de dados de uma aba já com o cabeçalho localizado,
 *  ignorando linhas em branco (TUSS vazio) — ex.: as ~49.600 linhas de
 *  sobra de fórmula arrastada em "ASSEFAZ REAJUSTE". Colunas ausentes
 *  (nome/atendido, quando a aba não tem essa coluna) viram null — o mesmo
 *  valor que parseAtendidoImportacao já trata como "Sim" (atendido). */
export function extrairLinhasBrutas(linhas: unknown[][], colunas: ColunasCabecalho): LinhaBrutaImportacao[] {
  const dados = linhas.slice(colunas.headerIdx + 1);
  const resultado: LinhaBrutaImportacao[] = [];

  for (const row of dados) {
    const tussRaw = row?.[colunas.tussCol];
    if (tussRaw === null || tussRaw === undefined || String(tussRaw).trim() === '') continue;

    resultado.push({
      tuss: tussRaw,
      nomeExame: colunas.nomeCol !== -1 ? row?.[colunas.nomeCol] : null,
      valor: colunas.valorCol !== -1 ? row?.[colunas.valorCol] : null,
      atendido: colunas.atendidoCol !== -1 ? row?.[colunas.atendidoCol] : null,
    });
  }

  return resultado;
}
