// Validação e casamento (upsert) da importação de custos de Fontes Pagadoras —
// ver .scratch/controle-custos-fontes-pagadoras-export-import/issues/02-importar-custos-fontes-pagadoras.md.
// Extraído pra ser testado sem montar componente React nem chamar o Supabase
// (mesmo padrão de busca.ts/exportacao.ts).

import type { Exam, Payor } from '../../../hooks/useCostControl';
import { ehLinhaGeral, examesDoTuss } from './busca';
import { chaveNomeConvenio, examesMaisParecidos } from './semelhancaNomes';

/** Linha válida da planilha: só TUSS e valor — o Atendido não vem mais da
 *  planilha, é calculado pelo % máx CSP (ver planejarImportacao). */
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

/** Linhas de custo_fontes_pagadoras da tabela associada escolhida no modal
 *  (pelo id do cadastro) — as mesmas que o upsert de importPayors casa. */
export function linhasDaTabela(payors: Payor[], tabelaId: string): Payor[] {
  return payors.filter(p => p.tabelaId === tabelaId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Importação por exame — ver .scratch/controle-custos-importacao-por-exame/spec.md.
//
// Cada linha da planilha do convênio vira uma linha de preço própria, com o
// nome do exame no convênio. A linha é vinculada por semelhança a um exame do
// mesmo TUSS; sem exame parecido, fica "não levantada" (Atendido Não, sem
// custo). validarLinhasImportacaoFontePagadora/separarUpsertFontePagadora
// acima são da importação por TUSS, que só os scripts de migração antigos
// ainda usam.
// ═══════════════════════════════════════════════════════════════════════════════

/** Linha válida da planilha do convênio. */
export interface LinhaPlanilhaConvenio {
  tuss: string;
  nomeConvenio: string;
  valor: number;
}

export interface LinhaValidadaConvenio {
  row: number;
  data: LinhaPlanilhaConvenio | null;
  error?: string;
}

const normalizarCabecalho = (h: unknown): string =>
  String(h ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

// Quantas linhas do topo procurar o cabeçalho — a planilha do convênio
// costuma vir com título ou linhas em branco antes dele.
const LINHAS_PROCURA_CABECALHO = 20;

// `linha` = número da linha na planilha (1 = primeira), pra apontar a linha
// certa nos erros.
export type LinhaBrutaNumerada = LinhaBrutaImportacao & { linha: number };

/** Acha o cabeçalho nas primeiras linhas da planilha (`linhas` = células por
 *  linha, como sheet_to_json com header: 1) e devolve as linhas de dados.
 *  Aceita o modelo ("TUSS", "Nome do Exame", "Valor") e a planilha do
 *  convênio ("Codigo TUSS", "Nome do Exame", "Valor convênio"), em qualquer
 *  coluna. Linhas em branco são puladas; colunas a mais são ignoradas.
 *  null = não achou as três colunas. */
export function lerPlanilhaConvenio(linhas: unknown[][]): LinhaBrutaNumerada[] | null {
  for (let i = 0; i < Math.min(linhas.length, LINHAS_PROCURA_CABECALHO); i++) {
    const cabecalho = (linhas[i] ?? []).map(normalizarCabecalho);
    const tuss = cabecalho.findIndex(h => h.includes('TUSS'));
    const nome = cabecalho.findIndex(h => h.includes('NOME'));
    const valor = cabecalho.findIndex(h => h.startsWith('VALOR'));
    if (tuss === -1 || nome === -1 || valor === -1) continue;

    const vazia = (c: unknown) => String(c ?? '').trim() === '';
    return linhas.slice(i + 1).flatMap((linha, j) => {
      const l = linha ?? [];
      if (vazia(l[tuss]) && vazia(l[nome]) && vazia(l[valor])) return [];
      return [{ tuss: l[tuss], nomeExame: l[nome], valor: l[valor], linha: i + j + 2 }];
    });
  }
  return null;
}

/** TUSS e Nome do Exame obrigatórios. TUSS sem exame na aba Exames é válido:
 *  a linha sobe como não levantada. */
export function validarLinhasPlanilhaConvenio(linhas: LinhaBrutaNumerada[]): LinhaValidadaConvenio[] {
  return linhas.map(raw => {
    const row = raw.linha;
    const tuss = String(raw.tuss ?? '').trim();
    const nomeConvenio = String(raw.nomeExame ?? '').trim();
    if (!tuss) return { row, data: null, error: 'TUSS vazio' };
    if (!nomeConvenio) return { row, data: null, error: `TUSS ${tuss}: Nome do Exame vazio` };
    return { row, data: { tuss, nomeConvenio, valor: parseValorImportacao(raw.valor) } };
  });
}

// Mesma linha do convênio numa reimportação: mesmo TUSS e mesmo nome,
// ignorando acentos, maiúsculas e pontuação.
const chaveLinhaConvenio = (tuss: string, nomeConvenio: string): string =>
  `${tuss.trim()}|${chaveNomeConvenio(nomeConvenio)}`;

export type MotivoNaoLevantado =
  // Nenhum exame com esse TUSS na aba Exames.
  | 'tuss_sem_exame'
  // Nenhum exame do TUSS com nome parecido o bastante.
  | 'nome_diferente'
  // Os exames parecidos já têm linha nesta tabela (outra linha da planilha,
  // ou uma linha importada antes que não está nesta planilha).
  | 'exame_ja_vinculado';

/** Uma linha a gravar: um exame vinculado de uma linha da planilha, ou a
 *  linha não levantada. Uma linha da planilha vira várias quando vale para
 *  mais de um exame do TUSS (ver examesMaisParecidos). */
export interface LinhaPlanoImportacao extends LinhaPlanilhaConvenio {
  // Linha de custo_fontes_pagadoras que a gravação atualiza; null = insere.
  existenteId: string | null;
  exame: Exam | null;
  // 'mantido' = reimportação de uma linha já vinculada (à mão ou não): o
  // exame não muda. 'semelhanca' = vinculada agora pelo nome.
  origemVinculo: 'semelhanca' | 'mantido' | null;
  motivoNaoLevantado: MotivoNaoLevantado | null;
  // O exame já tinha linha própria nesta tabela, cadastrada pelo modal de
  // linha: a importação passa a ser dona dela (valor e Atendido mudam).
  adotaLinhaPropria: boolean;
  // Custo total do exame vinculado; null = não levantado.
  custo: number | null;
  // custo * 100 / valor, sem arredondar; null sem custo ou com valor ≤ 0.
  csp: number | null;
  atendido: boolean;
}

export interface PlanoImportacao {
  linhas: LinhaPlanoImportacao[];
  // Linhas gerais do TUSS (formato antigo) dos TUSS da planilha: a gravação
  // as remove, com as exclusões e os valores personalizados delas.
  linhasGeraisSubstituidas: Payor[];
  // Linhas não levantadas de uma importação anterior que agora foram
  // vinculadas a linhas próprias já existentes: sobrariam duplicadas.
  naoLevantadasRemovidas: Payor[];
}

export interface EntradaPlanoImportacao {
  linhas: LinhaPlanilhaConvenio[];
  exams: Exam[];
  payors: Payor[];
  // Id do cadastro da tabela associada escolhida no modal.
  tabelaId: string;
  // % máx CSP informado no modal, em porcentagem (30 = 30%).
  limiteCsp: number;
}

type Vinculo = Pick<LinhaPlanoImportacao, 'existenteId' | 'exame' | 'origemVinculo' | 'motivoNaoLevantado' | 'adotaLinhaPropria'>;

export function planejarImportacao({ linhas, exams, payors, tabelaId, limiteCsp }: EntradaPlanoImportacao): PlanoImportacao {
  // Linha repetida na planilha (mesmo TUSS e nome): a última vence.
  const daPlanilha = new Map<string, LinhaPlanilhaConvenio>();
  linhas.forEach(l => daPlanilha.set(chaveLinhaConvenio(l.tuss, l.nomeConvenio), l));

  const examesPorId = new Map(exams.map(e => [e.id, e]));
  const daTabela = linhasDaTabela(payors, tabelaId);
  // Linhas de importações anteriores por (TUSS, nome): as vinculadas (uma
  // por exame) e a não levantada, se houver.
  const vinculadasAntes = new Map<string, Payor[]>();
  const naoLevantadaAntes = new Map<string, Payor>();
  const linhaPropriaManual = new Map<string, Payor>();
  // Exames com linha nesta tabela que a planilha não toca — (tabela, exame)
  // é único, então não podem ser vinculados de novo.
  const reservados = new Set<string>();
  daTabela.forEach(p => {
    if (p.nomeConvenio === null) {
      if (p.exameId) linhaPropriaManual.set(p.exameId, p);
      return;
    }
    const chave = chaveLinhaConvenio(p.tus, p.nomeConvenio);
    // Vinculada a um exame que saiu da aba Exames conta como não levantada.
    if (p.exameId && examesPorId.has(p.exameId)) {
      vinculadasAntes.set(chave, [...(vinculadasAntes.get(chave) ?? []), p]);
      if (!daPlanilha.has(chave)) reservados.add(p.exameId);
    } else if (!naoLevantadaAntes.has(chave)) {
      naoLevantadaAntes.set(chave, p);
    }
  });

  const vinculos = new Map<string, Vinculo[]>();
  const naoLevantadasRemovidas: Payor[] = [];

  // Primeiro as que já estavam vinculadas, pra que os exames delas não sejam
  // pegos por outra linha da planilha. Com vínculo anterior, a reimportação
  // não procura exame de novo: respeita o que foi trocado à mão.
  daPlanilha.forEach((_, chave) => {
    const antes = vinculadasAntes.get(chave);
    if (!antes) return;
    antes.forEach(p => reservados.add(p.exameId!));
    vinculos.set(
      chave,
      antes.map(p => ({
        existenteId: p.id,
        exame: examesPorId.get(p.exameId!)!,
        origemVinculo: 'mantido',
        motivoNaoLevantado: null,
        adotaLinhaPropria: false,
      })),
    );
    // Sobrou de quando era não levantada (não deveria): sai.
    const sobra = naoLevantadaAntes.get(chave);
    if (sobra) naoLevantadasRemovidas.push(sobra);
  });

  daPlanilha.forEach((linha, chave) => {
    if (vinculos.has(chave)) return;
    const naoLevantada = naoLevantadaAntes.get(chave) ?? null;
    const semVinculo = (motivoNaoLevantado: MotivoNaoLevantado) =>
      vinculos.set(chave, [
        { existenteId: naoLevantada?.id ?? null, exame: null, origemVinculo: null, motivoNaoLevantado, adotaLinhaPropria: false },
      ]);

    const candidatos = examesDoTuss(exams, linha.tuss);
    if (candidatos.length === 0) return semVinculo('tuss_sem_exame');
    const parecidos = examesMaisParecidos(linha.nomeConvenio, candidatos);
    if (parecidos.length === 0) return semVinculo('nome_diferente');
    const livres = parecidos.filter(e => !reservados.has(e.id));
    if (livres.length === 0) return semVinculo('exame_ja_vinculado');

    // A não levantada de antes vira a linha do primeiro exame sem linha
    // própria; a linha própria cadastrada à mão é adotada.
    let reaproveitar: Payor | null = naoLevantada;
    const novos: Vinculo[] = [];
    for (const exame of livres) {
      reservados.add(exame.id);
      const propria = linhaPropriaManual.get(exame.id);
      let existenteId = propria?.id ?? null;
      if (!propria && reaproveitar) {
        existenteId = reaproveitar.id;
        reaproveitar = null;
      }
      novos.push({ existenteId, exame, origemVinculo: 'semelhanca', motivoNaoLevantado: null, adotaLinhaPropria: !!propria });
    }
    if (reaproveitar) naoLevantadasRemovidas.push(reaproveitar);
    vinculos.set(chave, novos);
  });

  const planejadas = Array.from(daPlanilha, ([chave, linha]) =>
    vinculos.get(chave)!.map((vinculo): LinhaPlanoImportacao => {
      const custo = vinculo.exame ? vinculo.exame.direct + vinculo.exame.indirect : null;
      // custo * 100 / valor (e não custo / valor * 100): 7 / 100 * 100 dá
      // 7.000000000000001 e derrubaria um CSP exatamente no limite.
      const csp = custo !== null && linha.valor > 0 ? (custo * 100) / linha.valor : null;
      // Custo 0 é custo levantado (CSP 0%). Sem custo ou sem preço, nunca Sim.
      return { ...linha, ...vinculo, custo, csp, atendido: csp !== null && csp <= limiteCsp };
    }),
  ).flat();

  const tussDaPlanilha = new Set(planejadas.map(l => l.tuss));
  return {
    linhas: planejadas,
    linhasGeraisSubstituidas: daTabela.filter(p => ehLinhaGeral(p) && tussDaPlanilha.has(p.tus.trim())),
    naoLevantadasRemovidas,
  };
}
