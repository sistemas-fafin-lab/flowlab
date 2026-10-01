// api/_lib/orcamentoParticular.ts
// Suporte ao endpoint GET /api/integracoes/orcamento-particular — leitura
// server-to-server pra Tabela Particular (app externo). Ver o handler em
// api/integracoes/orcamento-particular.ts.

import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBearerApiKeyValid } from './bearerAuth.js';

const PAGE_SIZE = 1000; // espelha max_rows do PostgREST (supabase/config.toml)
const FONTE_PARTICULAR = 'Particular';

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
  /** Nomes de fonte_pagadora (exceto 'Particular') com atendido=true pra esse tuss. Sem valor — não expõe preço negociado. */
  conveniosAceitos: string[];
}

interface FonteRow {
  id: string;
  fonte_pagadora: string;
  tuss: string;
  /** Preenchido = linha só deste exame; null = linha geral do TUSS. */
  exame_id: string | null;
  valor: number;
  atendido: boolean;
  elegivel_desconto_particular: boolean;
}

interface ExameRow {
  id: string;
  tuss: string;
  nome: string;
  custo_direto: number;
  custo_indireto: number;
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

/**
 * Valida o header `Authorization: Bearer <token>` contra TABELA_PARTICULAR_API_KEY.
 * Chave dedicada — deliberadamente não reaproveita FLOWLAB_API_KEY, pra manter o
 * blast radius de uma revogação restrito a essa integração.
 */
export function isTabelaParticularApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'TABELA_PARTICULAR_API_KEY');
}

async function buscarTodasPaginado<T>(
  supabase: SupabaseClient,
  tabela: string,
  colunas: string,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .range(from, from + PAGE_SIZE - 1)
      .returns<T[]>();
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return linhas;
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
 * pros demais exames do TUSS. Aqui a precedência ignora tabela_associada —
 * o endpoint já trata "Particular" como uma tabela só (primeira linha geral
 * por TUSS vence).
 */
export async function buildOrcamentoParticular(
  supabase: SupabaseClient,
): Promise<OrcamentoParticularItem[]> {
  const [fontes, exames, exclusoes, valoresPersonalizados] = await Promise.all([
    buscarTodasPaginado<FonteRow>(
      supabase,
      'custo_fontes_pagadoras',
      'id, fonte_pagadora, tuss, exame_id, valor, atendido, elegivel_desconto_particular',
    ),
    buscarTodasPaginado<ExameRow>(supabase, 'custo_exames', 'id, tuss, nome, custo_direto, custo_indireto'),
    buscarTodasPaginado<ExclusaoRow>(supabase, 'custo_fontes_pagadoras_exclusoes', 'payor_id, exame_id'),
    buscarTodasPaginado<ValorPersonalizadoRow>(
      supabase,
      'custo_fontes_pagadoras_valores_exame',
      'payor_id, exame_id, valor',
    ),
  ]);

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

  // Convênios (fontes não-Particular) por TUSS (linhas gerais) e por exame
  // (linhas de exame) — fonte -> atendido. Linha de exame de um convênio
  // substitui a linha geral dele só praquele exame.
  const conveniosGeraisPorTuss = new Map<string, Map<string, boolean>>();
  const conveniosPorExame = new Map<string, Map<string, boolean>>();
  for (const fonte of fontes) {
    if (fonte.fonte_pagadora === FONTE_PARTICULAR) continue;
    const chave = fonte.exame_id ?? fonte.tuss;
    if (!chave) continue;
    const mapa = fonte.exame_id ? conveniosPorExame : conveniosGeraisPorTuss;
    if (!mapa.has(chave)) mapa.set(chave, new Map());
    const porFonte = mapa.get(chave)!;
    porFonte.set(fonte.fonte_pagadora, (porFonte.get(fonte.fonte_pagadora) ?? false) || fonte.atendido);
  }
  const conveniosAceitos = (tuss: string, exameId: string | null): string[] => {
    const doExame = exameId ? conveniosPorExame.get(exameId) : undefined;
    const aceitos = new Set<string>();
    for (const [nome, atendido] of conveniosGeraisPorTuss.get(tuss) ?? []) {
      if (atendido && !doExame?.has(nome)) aceitos.add(nome);
    }
    for (const [nome, atendido] of doExame ?? []) {
      if (atendido) aceitos.add(nome);
    }
    return Array.from(aceitos);
  };

  const particulares = fontes.filter(fonte => fonte.fonte_pagadora === FONTE_PARTICULAR);
  // Exames com linha Particular própria saem da linha geral do TUSS.
  const examesComLinhaPropria = new Set(particulares.flatMap(fonte => (fonte.exame_id ? [fonte.exame_id] : [])));

  const itemDoExame = (fonte: FonteRow, exame: ExameRow): OrcamentoParticularItem => {
    const tuss = exame.tuss || fonte.tuss;
    return {
      tuss,
      nome: exame.nome,
      // Exame pode ter um valor próprio, diferente do preço padrão da linha
      // (ver custo_fontes_pagadoras_valores_exame).
      preco: valoresPersonalizadosPorChave.get(`${fonte.id}:${exame.id}`) ?? Number(fonte.valor),
      custo: Number(exame.custo_direto) + Number(exame.custo_indireto),
      elegivelDescontoParticular: fonte.elegivel_desconto_particular,
      conveniosAceitos: conveniosAceitos(tuss, exame.id),
    };
  };

  // Linhas Particular duplicadas (mesmo TUSS geral, ou mesmo exame): a
  // primeira encontrada vence, sem duplicar item.
  const tussJaVistos = new Set<string>();
  const examesJaVistos = new Set<string>();
  const itens: OrcamentoParticularItem[] = [];
  for (const fonte of particulares) {
    if (fonte.exame_id) {
      const exame = examesPorId.get(fonte.exame_id);
      if (!exame || examesJaVistos.has(exame.id)) continue;
      examesJaVistos.add(exame.id);
      if (exclusoesPorChave.has(`${fonte.id}:${exame.id}`)) continue;
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
        custo: null,
        elegivelDescontoParticular: fonte.elegivel_desconto_particular,
        conveniosAceitos: conveniosAceitos(fonte.tuss, null),
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
