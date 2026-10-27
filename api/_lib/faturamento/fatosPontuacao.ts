// api/_lib/faturamento/fatosPontuacao.ts
// Leitura dos fatos da Pontuação do setor (.scratch/faturamento-pontuacao/spec.md).
// Só lê e achata; a regra de pontos é de pontuacaoSetor.ts.

import { getSupabaseUserClient } from '../supabase.js';
import type { FatoMeta } from './pontuacaoSetor.js';

export type FalhaFato = { erro: { status: number; mensagem: string } };

/**
 * Meta do mês e o faturado por emissão: a mesma tabela (`metas_faturamento`) e a
 * mesma RPC (`fat_meta_mensal_faturado`) do widget "Meta mensal" das Faturas
 * (useMetaMensal), para os dois números nunca divergirem.
 *
 * Cliente do usuário, não o admin: a RPC checa `current_user_has_permission`,
 * que com a service role volta sem usuário e recusaria a chamada.
 */
export async function lerFatoMeta(token: string, ano: number, mes: number): Promise<FatoMeta | FalhaFato> {
  const supabase = getSupabaseUserClient(token);
  const [{ data: linhaMeta, error: erroMeta }, { data: bruto, error: erroCalculo }] = await Promise.all([
    supabase.from('metas_faturamento').select('valor_meta').eq('ano', ano).eq('mes', mes).maybeSingle(),
    supabase.rpc('fat_meta_mensal_faturado', { p_ano: ano, p_mes: mes }),
  ]);
  const erro = erroMeta ?? erroCalculo;
  if (erro) {
    console.error('[faturamento/pontuacao] meta mensal:', erro.message);
    return { erro: { status: 502, mensagem: `Não foi possível consultar a meta mensal: ${erro.message}` } };
  }
  return {
    valorMeta: linhaMeta ? Number((linhaMeta as { valor_meta: number | string }).valor_meta) : null,
    faturado: Number((bruto as { faturado: number | string } | null)?.faturado ?? 0),
  };
}
