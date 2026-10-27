// api/_lib/faturamento/fatosPontuacao.ts
// Leitura dos fatos da Pontuação do setor (.scratch/faturamento-pontuacao/spec.md).
// Só lê e achata; a regra de pontos é de pontuacaoSetor.ts.

import { getSupabaseUserClient } from '../supabase.js';
import { tarefasPendentesNoFimDoMes } from './bdLab.js';
import type { FatoMeta, FatoTarefas, FrentePontuacao, MembroFrente } from './pontuacaoSetor.js';

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

/** Membros ativos das Frentes (`fat_pontuacao_membros`), por nome. */
export async function lerMembros(token: string): Promise<MembroFrente[] | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_membros')
    .select('frente, id_usuario_aplis, nome')
    .eq('ativo', true)
    .order('nome');
  if (error) {
    console.error('[faturamento/pontuacao] membros:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível consultar os membros das Frentes: ${error.message}` } };
  }
  return (data as { frente: FrentePontuacao; id_usuario_aplis: number; nome: string }[]).map((linha) => ({
    frente: linha.frente,
    idUsuarioAplis: linha.id_usuario_aplis,
    nome: linha.nome,
  }));
}

/** Tarefas do apLIS abertas às 23h59 do último dia do mês, só dos membros. */
export async function lerFatoTarefas(
  membros: MembroFrente[],
  ano: number,
  mes: number,
): Promise<{ tarefas: FatoTarefas; dadoAte: string | null } | FalhaFato> {
  const seguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const resultado = await tarefasPendentesNoFimDoMes({
    idsUsuarios: membros.map((m) => m.idUsuarioAplis),
    ateExclusivo: `${seguinte.ano}-${String(seguinte.mes).padStart(2, '0')}-01`,
  });
  if ('erro' in resultado) return resultado;
  const { porUsuario, doSetor, dadoAte } = resultado;
  return { tarefas: { porUsuario, doSetor }, dadoAte };
}
