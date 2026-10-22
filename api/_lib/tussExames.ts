// api/_lib/tussExames.ts
// Suporte ao endpoint GET /api/integracoes/tuss-exames — leitura
// server-to-server pro Sistema de Admissão resolver o TUSS de cada
// procedimento enviado ao AEL. Ver o handler em api/_lib/handlers/integracoes-tuss-exames.ts.

import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBearerApiKeyValid } from './bearerAuth.js';
import { buscarTodasPaginado } from './supabasePaginado.js';

/** Exame do catálogo ligado a uma cobrança (e, opcionalmente, a um teste) do apLIS. */
export interface TussExame {
  id: string;
  tuss: string;
  aplis_id_exame_tipo: number;
  aplis_id_teste: number | null;
}

/** Linha de custo_fontes_pagadoras sem valor negociado nem nome da fonte. */
export interface TussFontePagadora {
  id: string;
  /** Cadastro da tabela associada — é por ele que "mesma tabela" se compara. */
  tabela_associada_id: string;
  /** Nome do cadastro (custo_tabelas_associadas), só para exibição. */
  tabela_associada: string;
  tuss: string;
  /** Preenchido = linha só deste exame (tem precedência); null = linha geral do TUSS. */
  exame_id: string | null;
  /** false = não coberto pelo plano. */
  atendido: boolean;
}

export interface TussExclusao {
  payor_id: string;
  exame_id: string;
}

export interface TussExamesPayload {
  /** Só os exames com vínculo ao apLIS. */
  exames: TussExame[];
  fontes_pagadoras: TussFontePagadora[];
  exclusoes: TussExclusao[];
  gerado_em: string;
}

type FontePagadoraRow = Omit<TussFontePagadora, 'tabela_associada'> & { nome_exame_convenio: string | null };

interface TabelaAssociadaRow {
  id: string;
  nome: string;
}

interface ExameRow {
  id: string;
  tuss: string;
  aplis_id_exame_tipo: number | null;
  aplis_id_teste: number | null;
}

/**
 * Valida o header `Authorization: Bearer <token>` contra ADMISSAO_API_KEY.
 * Chave dedicada — pode ser revogada sem afetar a Tabela Particular nem o LAB-HUB.
 */
export function isAdmissaoApiKeyValid(req: VercelRequest): boolean {
  return isBearerApiKeyValid(req, 'ADMISSAO_API_KEY');
}

/**
 * Monta tudo o que a Admissão precisa para escolher o TUSS de um
 * procedimento, num payload só. Os selects pedem só as colunas que vão no
 * payload, então valor e custo nem saem do banco.
 *
 * A regra de cobertura fica com a Admissão (mesma de
 * src/components/CostControl/domain/busca.ts, examesPorFontePagadora): linha
 * de exame tem precedência sobre a linha geral do TUSS, que vale para o exame
 * se não houver exclusão dele.
 */
export async function buildTussExames(supabase: SupabaseClient): Promise<TussExamesPayload> {
  const [exames, fontesPagadoras, tabelas, exclusoes] = await Promise.all([
    buscarTodasPaginado<ExameRow>(supabase, 'custo_exames', 'id, tuss, aplis_id_exame_tipo, aplis_id_teste'),
    buscarTodasPaginado<FontePagadoraRow>(
      supabase,
      'custo_fontes_pagadoras',
      'id, tabela_associada_id, tuss, exame_id, nome_exame_convenio, atendido',
    ),
    buscarTodasPaginado<TabelaAssociadaRow>(supabase, 'custo_tabelas_associadas', 'id, nome'),
    buscarTodasPaginado<TussExclusao>(supabase, 'custo_fontes_pagadoras_exclusoes', 'payor_id, exame_id'),
  ]);

  const nomeDaTabela = new Map(tabelas.map(t => [t.id, t.nome]));

  return {
    exames: exames.filter((e): e is TussExame => e.aplis_id_exame_tipo !== null),
    // Linha não levantada (importação sem exame parecido: exame_id null com
    // nome no convênio) fica fora — do lado da Admissão, exame_id null é
    // linha geral do TUSS e cobriria todos os exames dele.
    fontes_pagadoras: fontesPagadoras
      .filter(f => f.exame_id !== null || !f.nome_exame_convenio)
      .map(f => ({
        id: f.id,
        tabela_associada_id: f.tabela_associada_id,
        tabela_associada: nomeDaTabela.get(f.tabela_associada_id) ?? '',
        tuss: f.tuss,
        exame_id: f.exame_id,
        atendido: f.atendido,
      })),
    exclusoes,
    gerado_em: new Date().toISOString(),
  };
}
