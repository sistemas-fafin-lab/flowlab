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
 * `tuss`/`preco`/`elegivelDescontoParticular`/`conveniosAceitos` — só
 * `nome`/`custo` mudam entre eles. Consumidores que indexem/deduplicem a
 * resposta por `tuss` (em vez de por `tuss`+`nome`, ou simplesmente
 * consumindo o array como está) vão perder itens.
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
  fonte_pagadora: string;
  tuss: string;
  valor: number;
  atendido: boolean;
  elegivel_desconto_particular: boolean;
}

interface ExameRow {
  tuss: string;
  nome: string;
  custo_direto: number;
  custo_indireto: number;
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
 * Monta um item por TUSS com preço "Particular" cadastrado: nome/custo vêm de
 * custo_exames (join em memória por tuss), preço e elegibilidade de desconto
 * vêm da própria linha Particular, e conveniosAceitos lista as demais fontes
 * pagadoras que atendem aquele tuss (atendido=true), sem expor valor.
 */
export async function buildOrcamentoParticular(
  supabase: SupabaseClient,
): Promise<OrcamentoParticularItem[]> {
  const [fontes, exames] = await Promise.all([
    buscarTodasPaginado<FonteRow>(
      supabase,
      'custo_fontes_pagadoras',
      'fonte_pagadora, tuss, valor, atendido, elegivel_desconto_particular',
    ),
    buscarTodasPaginado<ExameRow>(supabase, 'custo_exames', 'tuss, nome, custo_direto, custo_indireto'),
  ]);

  // NUMERIC(12,2) do Postgres pode voltar como string via PostgREST — mesmo
  // cuidado já tomado em src/hooks/useCostControl.ts (Number(row.valor) etc.)
  // pras mesmas colunas.
  //
  // Um TUSS pode ser compartilhado por exames com nomes diferentes (sem
  // examId confiável vindo do APLIS — mesma limitação documentada em
  // src/components/CostControl/domain/busca.ts) — agrupa por tuss,
  // deduplicando por nome, pra virar um item por nome distinto em vez de
  // escolher arbitrariamente só um.
  const examesPorTuss = new Map<string, ExameRow[]>();
  for (const exame of exames) {
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

  const conveniosPorTuss = new Map<string, Set<string>>();
  for (const fonte of fontes) {
    if (fonte.fonte_pagadora === FONTE_PARTICULAR || !fonte.atendido) continue;
    if (!conveniosPorTuss.has(fonte.tuss)) conveniosPorTuss.set(fonte.tuss, new Set());
    conveniosPorTuss.get(fonte.tuss)!.add(fonte.fonte_pagadora);
  }

  // Map em vez de array: garante um grupo de itens por tuss (não há
  // UNIQUE(tuss) em custo_fontes_pagadoras) — se houver linhas Particular
  // duplicadas pro mesmo tuss, a primeira encontrada vence. TUSS com nomes
  // diferentes em custo_exames vira múltiplos itens (mesmo tuss/preço/
  // elegibilidade — é a mesma linha de preço), um por nome distinto.
  const itensPorTuss = new Map<string, OrcamentoParticularItem[]>();
  for (const fonte of fontes) {
    if (fonte.fonte_pagadora !== FONTE_PARTICULAR || itensPorTuss.has(fonte.tuss)) continue;
    const grupo = examesPorTuss.get(fonte.tuss);
    const base = {
      tuss: fonte.tuss,
      preco: Number(fonte.valor),
      elegivelDescontoParticular: fonte.elegivel_desconto_particular,
      conveniosAceitos: Array.from(conveniosPorTuss.get(fonte.tuss) ?? []),
    };
    itensPorTuss.set(
      fonte.tuss,
      grupo
        ? grupo.map(exame => ({
            ...base,
            nome: exame.nome,
            custo: Number(exame.custo_direto) + Number(exame.custo_indireto),
          }))
        : [{ ...base, nome: null, custo: null }],
    );
  }
  return Array.from(itensPorTuss.values()).flat();
}
