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
  const [exames, fontesPagadoras, exclusoes] = await Promise.all([
    buscarTodasPaginado<ExameRow>(supabase, 'custo_exames', 'id, tuss, aplis_id_exame_tipo, aplis_id_teste'),
    buscarTodasPaginado<TussFontePagadora>(
      supabase,
      'custo_fontes_pagadoras',
      'id, tabela_associada, tuss, exame_id, atendido',
    ),
    buscarTodasPaginado<TussExclusao>(supabase, 'custo_fontes_pagadoras_exclusoes', 'payor_id, exame_id'),
  ]);

  return {
    exames: exames.filter((e): e is TussExame => e.aplis_id_exame_tipo !== null),
    fontes_pagadoras: fontesPagadoras,
    exclusoes,
    gerado_em: new Date().toISOString(),
  };
}
