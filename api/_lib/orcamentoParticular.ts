// api/_lib/orcamentoParticular.ts
// Suporte ao endpoint GET /api/integracoes/orcamento-particular — leitura
// server-to-server pra Tabela Particular (app externo). Ver o handler em
// api/_lib/handlers/integracoes-orcamento-particular.ts.

import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBearerApiKeyValid } from './bearerAuth.js';
import { buscarTodasPaginado } from './supabasePaginado.js';

const FONTE_PARTICULAR = 'Particular';
// Só a tabela associada cadastrada como "Particular" da fonte Particular
// (custo_tabelas_associadas) vai pra Tabela Particular — linhas da fonte
// Particular em outras tabelas (ex.: "PART") são de outro uso e não entram.
// Nome sem diferenciar maiúsculas ("PARTICULAR" entra), o mesmo critério da
// proteção da tabela no banco (migration 20261021190000). Enquanto
// "Particular" e "PARTICULAR" forem dois cadastros (até a unificação, ticket
// 06), as duas entram juntas aqui, como antes do cadastro — na tela elas são
// tabelas diferentes. Depois da contração (20261026140000) o banco só aceita
// um cadastro com esse nome na fonte.
const TABELA_PARTICULAR = 'particular';

/**
 * `tuss` NÃO é mais garantidamente único no array de resposta (desde a
 * issue 12): um TUSS coberto por exames com nomes diferentes em
 * custo_exames vira um item por nome distinto, todos com o mesmo
 * `tuss`/`elegivelDescontoParticular`/`conveniosAceitos` — `nome`/`custo`
 * mudam entre eles, e `preco` também pode mudar quando um exame tem valor
 * personalizado (ver custo_fontes_pagadoras_valores_exame). Consumidores que
 * indexem/dedupliquem a resposta por `tuss` (em vez de por `tuss`+`nome`, ou
 * simplesmente consumindo o array como está) vão perder itens.
 */
export interface OrcamentoParticularItem {
  tuss: string;
  /** null quando o tuss não tem correspondência em custo_exames. */
  nome: string | null;
  preco: number;
  /** custo_direto + custo_indireto; null quando o tuss não tem correspondência em custo_exames. */
  custo: number | null;
  elegivelDescontoParticular: boolean;
  /** Fontes pagadoras distintas de `coberturaConvenios`. Sem valor — não expõe preço negociado. */
  conveniosAceitos: string[];
  /**
   * Convênios (tabela associada de uma fonte não-Particular) que atendem o exame, sem valor.
   * Só para o Gerador de Orçamento: a integração da Tabela Particular não recebe o campo.
   */
  coberturaConvenios: CoberturaConvenio[];
}

/** Um convênio que atende o exame: a fonte pagadora e a tabela associada dela (o convênio). */
export interface CoberturaConvenio {
  fonte: string;
  convenio: string;
}

/** Item com custo opcional: com `incluirCusto: false` a chave `custo` não existe. */
export type OrcamentoParticularItemCustoOpcional = Omit<OrcamentoParticularItem, 'custo'> &
  Partial<Pick<OrcamentoParticularItem, 'custo'>>;

export interface OpcoesOrcamentoParticular {
  /**
   * false = custo_exames é lido sem as colunas de custo e os itens saem sem a
   * chave `custo` (quem não pode ver custo nem chega a buscá-lo).
   */
  incluirCusto: boolean;
}

interface FonteRow {
  id: string;
  fonte_pagadora: string;
  tabela_associada_id: string;
  tuss: string;
  /** Preenchido = linha só deste exame; null = linha geral do TUSS. */
  exame_id: string | null;
  /** Nome no convênio (importação). Com exame_id null = linha não levantada:
   *  não cobre exame nenhum, então nem entra aqui. */
  nome_exame_convenio: string | null;
  valor: number;
  atendido: boolean;
  elegivel_desconto_particular: boolean;
}

interface ExameRow {
  id: string;
  tuss: string;
  nome: string;
  /** Ausentes quando a montagem é sem custo (não entram no select). */
  custo_direto?: number;
  custo_indireto?: number;
}

interface ExclusaoRow {
  payor_id: string;
  exame_id: string;
}

interface ValorPersonalizadoRow {
  payor_id: string;
  exame_id: string;
  valor: number;
}

interface TabelaAssociadaRow {
  id: string;
  fonte_pagadora: string;
  nome: string;
}

/**
 * Valida o header `Authorization: Bearer <token>` contra TABELA_PARTICULAR_API_KEY.
 * Chave dedicada — deliberadamente não reaproveita FLOWLAB_API_KEY, pra manter o
 * blast radius de uma revogação restrito a essa integração.
 */
export function isTabelaParticularApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'TABELA_PARTICULAR_API_KEY');
}

/**
 * Monta um item por exame com preço "Particular" cadastrado: nome/custo vêm de
 * custo_exames, preço e elegibilidade de desconto vêm da linha Particular, e
 * conveniosAceitos lista as demais fontes pagadoras que atendem aquele exame
 * (atendido=true), sem expor valor.
 *
 * Mesma regra de src/components/CostControl/domain/busca.ts
 * (examesPorFontePagadora): linha com `exame_id` vale só pra aquele exame e
 * tem precedência sobre a linha geral do TUSS (`exame_id` null), que vale
 * pros demais exames do TUSS. Só entram linhas da tabela associada
 * "Particular" da fonte "Particular", pelo cadastro (ver TABELA_PARTICULAR).
 */
export async function buildOrcamentoParticular(
  supabase: SupabaseClient,
  opcoes: { incluirCusto: true },
): Promise<OrcamentoParticularItem[]>;
export async function buildOrcamentoParticular(
  supabase: SupabaseClient,
  opcoes: OpcoesOrcamentoParticular,
): Promise<OrcamentoParticularItemCustoOpcional[]>;
export async function buildOrcamentoParticular(
  supabase: SupabaseClient,
  { incluirCusto }: OpcoesOrcamentoParticular,
): Promise<OrcamentoParticularItemCustoOpcional[]> {
  const [todasFontes, exames, exclusoes, valoresPersonalizados, tabelas] = await Promise.all([
    buscarTodasPaginado<FonteRow>(
      supabase,
      'custo_fontes_pagadoras',
      'id, fonte_pagadora, tabela_associada_id, tuss, exame_id, nome_exame_convenio, valor, atendido, elegivel_desconto_particular',
    ),
    buscarTodasPaginado<ExameRow>(
      supabase,
      'custo_exames',
      incluirCusto ? 'id, tuss, nome, custo_direto, custo_indireto' : 'id, tuss, nome',
    ),
    buscarTodasPaginado<ExclusaoRow>(supabase, 'custo_fontes_pagadoras_exclusoes', 'payor_id, exame_id'),
    buscarTodasPaginado<ValorPersonalizadoRow>(
      supabase,
      'custo_fontes_pagadoras_valores_exame',
      'payor_id, exame_id, valor',
    ),
    buscarTodasPaginado<TabelaAssociadaRow>(supabase, 'custo_tabelas_associadas', 'id, fonte_pagadora, nome'),
  ]);

  // Linha não levantada (importação sem exame parecido) não é linha geral do
  // TUSS — ver ehLinhaNaoLevantada em src/components/CostControl/domain/busca.ts.
  const fontes = todasFontes.filter(fonte => fonte.exame_id !== null || !fonte.nome_exame_convenio);

  // Exame explicitamente excluído desta linha de preço (ver PayorsScreen —
  // "excluir" numa linha de TUSS compartilhado) não deve aparecer aqui,
  // mesmo que o TUSS continue tendo preço Particular via os exames irmãos.
  const exclusoesPorChave = new Set(exclusoes.map(e => `${e.payor_id}:${e.exame_id}`));

  // Valor de venda que sobrescreve, só pra um exame específico, o preço
  // padrão da linha Particular do TUSS compartilhado (ver PayorsScreen —
  // "valor deste exame"). Mesma chave payorId:exameId usada em exclusoesPorChave.
  const valoresPersonalizadosPorChave = new Map(
    valoresPersonalizados.map(v => [`${v.payor_id}:${v.exame_id}`, Number(v.valor)]),
  );

  // NUMERIC(12,2) do Postgres pode voltar como string via PostgREST — mesmo
  // cuidado já tomado em src/hooks/useCostControl.ts (Number(row.valor) etc.)
  // pras mesmas colunas.
  //
  // Um TUSS pode ser compartilhado por exames com nomes diferentes (sem
  // examId confiável vindo do APLIS — mesma limitação documentada em
  // src/components/CostControl/domain/busca.ts) — agrupa por tuss,
  // deduplicando por nome, pra virar um item por nome distinto em vez de
  // escolher arbitrariamente só um. Exame sem TUSS não entra em grupo
  // nenhum: TUSS vazio não é um código compartilhado, e esses exames só
  // aparecem via linha de exame (exame_id).
  const examesPorTuss = new Map<string, ExameRow[]>();
  const examesPorId = new Map<string, ExameRow>();
  for (const exame of exames) {
    examesPorId.set(exame.id, exame);
    if (!exame.tuss) continue;
    const grupo = examesPorTuss.get(exame.tuss);
    if (!grupo) {
      examesPorTuss.set(exame.tuss, [exame]);
      continue;
    }
    // Duplicata literal (mesmo tuss E mesmo nome): a entrada mais recente
    // vence, mesma semântica de "último vence" já usada antes desta função
    // passar a agrupar por tuss em vez de escolher só um exame.
    const indice = grupo.findIndex(e => e.nome === exame.nome);
    if (indice === -1) grupo.push(exame);
    else grupo[indice] = exame;
  }

  // Cobertura por convênio (tabela associada de uma fonte não-Particular), a
  // regra de examesPorFontePagadora: linha de exame tem precedência sobre a
  // linha geral do TUSS da MESMA tabela, e exclusão tira o exame da linha
  // geral. Mapas: chave (exame_id ou tuss) -> tabela -> linhas.
  const nomeDaTabela = new Map(tabelas.map(t => [t.id, t.nome]));
  const linhasGeraisPorTuss = new Map<string, Map<string, FonteRow[]>>();
  const linhasPorExame = new Map<string, Map<string, FonteRow[]>>();
  for (const fonte of fontes) {
    if (fonte.fonte_pagadora === FONTE_PARTICULAR) continue;
    const chave = fonte.exame_id ?? fonte.tuss;
    if (!chave) continue;
    const mapa = fonte.exame_id ? linhasPorExame : linhasGeraisPorTuss;
    if (!mapa.has(chave)) mapa.set(chave, new Map());
    const porTabela = mapa.get(chave)!;
    porTabela.set(fonte.tabela_associada_id, [...(porTabela.get(fonte.tabela_associada_id) ?? []), fonte]);
  }
  const coberturaConvenios = (tuss: string, exameId: string | null): CoberturaConvenio[] => {
    const doExame = exameId ? linhasPorExame.get(exameId) : undefined;
    const pares = new Map<string, CoberturaConvenio>();
    const cobre = (linha: FonteRow) => {
      // Sem cadastro da tabela (não acontece com a FK), o convênio leva o nome da fonte.
      const convenio = nomeDaTabela.get(linha.tabela_associada_id) ?? linha.fonte_pagadora;
      pares.set(`${linha.fonte_pagadora}\u0000${convenio}`, { fonte: linha.fonte_pagadora, convenio });
    };
    for (const [tabelaId, linhas] of linhasGeraisPorTuss.get(tuss) ?? []) {
      if (doExame?.has(tabelaId)) continue;
      for (const linha of linhas) {
        if (linha.atendido && !(exameId && exclusoesPorChave.has(`${linha.id}:${exameId}`))) cobre(linha);
      }
    }
    for (const linhas of doExame?.values() ?? []) {
      for (const linha of linhas) if (linha.atendido) cobre(linha);
    }
    return Array.from(pares.values());
  };
  const coberturaDoItem = (tuss: string, exameId: string | null) => {
    const cobertura = coberturaConvenios(tuss, exameId);
    return {
      conveniosAceitos: Array.from(new Set(cobertura.map(c => c.fonte))),
      coberturaConvenios: cobertura,
    };
  };

  const tabelasParticular = new Set(
    tabelas
      .filter(t => t.fonte_pagadora === FONTE_PARTICULAR && t.nome.trim().toLowerCase() === TABELA_PARTICULAR)
      .map(t => t.id),
  );
  const particulares = fontes.filter(fonte => tabelasParticular.has(fonte.tabela_associada_id));
  // Exames com linha Particular própria saem da linha geral do TUSS — só
  // quando a linha própria de fato os mostra: uma linha de exame que exclui
  // o próprio exame não conta (senão o exame sumiria das duas).
  const examesComLinhaPropria = new Set(
    particulares.flatMap(fonte =>
      fonte.exame_id && !exclusoesPorChave.has(`${fonte.id}:${fonte.exame_id}`) ? [fonte.exame_id] : [],
    ),
  );

  // Sem custo, a chave nem existe no item (não é `undefined` nem `null`).
  const comCusto = (custo: () => number | null) => (incluirCusto ? { custo: custo() } : {});

  const itemDoExame = (fonte: FonteRow, exame: ExameRow): OrcamentoParticularItemCustoOpcional => {
    const tuss = exame.tuss || fonte.tuss;
    return {
      tuss,
      nome: exame.nome,
      // Exame pode ter um valor próprio, diferente do preço padrão da linha
      // (ver custo_fontes_pagadoras_valores_exame).
      preco: valoresPersonalizadosPorChave.get(`${fonte.id}:${exame.id}`) ?? Number(fonte.valor),
      ...comCusto(() => Number(exame.custo_direto) + Number(exame.custo_indireto)),
      elegivelDescontoParticular: fonte.elegivel_desconto_particular,
      ...coberturaDoItem(tuss, exame.id),
    };
  };

  // Linhas Particular duplicadas (mesmo TUSS geral, ou mesmo exame): a
  // primeira encontrada vence, sem duplicar item.
  const tussJaVistos = new Set<string>();
  const examesJaVistos = new Set<string>();
  const itens: OrcamentoParticularItemCustoOpcional[] = [];
  for (const fonte of particulares) {
    if (fonte.exame_id) {
      const exame = examesPorId.get(fonte.exame_id);
      if (!exame || examesJaVistos.has(exame.id) || exclusoesPorChave.has(`${fonte.id}:${exame.id}`)) continue;
      examesJaVistos.add(exame.id);
      itens.push(itemDoExame(fonte, exame));
      continue;
    }
    if (!fonte.tuss || tussJaVistos.has(fonte.tuss)) continue;
    tussJaVistos.add(fonte.tuss);
    const grupo = examesPorTuss.get(fonte.tuss);
    // Sem correspondência em custo_exames: mantém o item avulso (nome/custo
    // null). Com correspondência, exames excluídos desta linha de preço ou
    // com linha Particular própria saem — se todos saírem, esse tuss não
    // gera item nenhum aqui.
    if (!grupo) {
      itens.push({
        tuss: fonte.tuss,
        nome: null,
        preco: Number(fonte.valor),
        ...comCusto(() => null), // sem exame correspondente
        elegivelDescontoParticular: fonte.elegivel_desconto_particular,
        ...coberturaDoItem(fonte.tuss, null),
      });
      continue;
    }
    for (const exame of grupo) {
      if (examesComLinhaPropria.has(exame.id) || exclusoesPorChave.has(`${fonte.id}:${exame.id}`)) continue;
      itens.push(itemDoExame(fonte, exame));
    }
  }
  return itens;
}
