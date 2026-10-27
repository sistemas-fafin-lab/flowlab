// api/_lib/faturamento/fatosPontuacao.ts
// Leitura dos fatos da Pontuação do setor (.scratch/faturamento-pontuacao/spec.md).
// Só lê e achata; a regra de pontos é de pontuacaoSetor.ts.

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import { guiasSemLotePorConvenio, recebidosComGlosaPorConvenio, tarefasPendentesNoFimDoMes } from './bdLab.js';
import { listarFontesConsideradasMeta } from './fontesConsideradas.js';
import type {
  ChaveCriterio,
  EntradaPontuacao,
  FatoGuiasSemLote,
  FatoMeta,
  FatoTarefas,
  FatoZeroGlosa,
  FrentePontuacao,
  LancamentoManual,
  MembroFrente,
  ResumoPontuacao,
} from './pontuacaoSetor.js';

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

/** Membro na lista da tela "Membros", com os desativados. */
export interface MembroCadastrado extends MembroFrente {
  ativo: boolean;
}

/** Todos os membros das Frentes, ativos e desativados, por nome. */
export async function lerTodosMembros(token: string): Promise<MembroCadastrado[] | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_membros')
    .select('frente, id_usuario_aplis, nome, ativo')
    .order('nome');
  if (error) {
    console.error('[faturamento/pontuacao] membros (todos):', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível consultar os membros das Frentes: ${error.message}` } };
  }
  return (data as { frente: FrentePontuacao; id_usuario_aplis: number; nome: string; ativo: boolean }[]).map((linha) => ({
    frente: linha.frente,
    idUsuarioAplis: linha.id_usuario_aplis,
    nome: linha.nome,
    ativo: linha.ativo,
  }));
}

/**
 * Inclui o usuário do apLIS na Frente. Quem já foi membro e está desativado é
 * reativado na mesma linha (o UNIQUE de Frente e usuário não deixa duplicar), com
 * o nome atual do apLIS. Já ativo na Frente dá 409.
 */
export async function incluirMembro(token: string, { frente, idUsuarioAplis, nome }: MembroFrente): Promise<null | FalhaFato> {
  const supabase = getSupabaseUserClient(token);
  const { data: existente, error: erroLeitura } = await supabase
    .from('fat_pontuacao_membros')
    .select('id, ativo')
    .eq('frente', frente)
    .eq('id_usuario_aplis', idUsuarioAplis)
    .maybeSingle();
  if (erroLeitura) {
    console.error('[faturamento/pontuacao] incluir membro:', erroLeitura.message);
    return { erro: { status: 502, mensagem: `Não foi possível incluir o membro: ${erroLeitura.message}` } };
  }
  const jaMembro = { erro: { status: 409, mensagem: `${nome} já é membro desta Frente.` } };
  const linha = existente as { id: string; ativo: boolean } | null;
  if (linha?.ativo) return jaMembro;

  const { error } = linha
    ? await supabase.from('fat_pontuacao_membros').update({ ativo: true, nome }).eq('id', linha.id)
    : await supabase.from('fat_pontuacao_membros').insert({ frente, id_usuario_aplis: idUsuarioAplis, nome });
  if (error) {
    // 23505: o UNIQUE de Frente e usuário; alguém incluiu a pessoa ao mesmo tempo.
    if (error.code === '23505') return jaMembro;
    console.error('[faturamento/pontuacao] incluir membro:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível incluir o membro: ${error.message}` } };
  }
  return null;
}

/** Desativa o membro da Frente, sem apagar a linha. 409 se ele não está ativo nela. */
export async function desativarMembro(
  token: string,
  { frente, idUsuarioAplis }: Pick<MembroFrente, 'frente' | 'idUsuarioAplis'>,
): Promise<null | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_membros')
    .update({ ativo: false })
    .eq('frente', frente)
    .eq('id_usuario_aplis', idUsuarioAplis)
    .eq('ativo', true)
    .select('id');
  if (error) {
    console.error('[faturamento/pontuacao] desativar membro:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível desativar o membro: ${error.message}` } };
  }
  if (!data || data.length === 0) return { erro: { status: 409, mensagem: 'Este usuário não é membro ativo desta Frente.' } };
  return null;
}

interface LinhaLancamento {
  frente: FrentePontuacao;
  chave: ChaveCriterio;
  pontos: number | string;
  observacao: string;
  lancado_por_nome: string | null;
  lancado_em: string;
}

/** Lançamentos manuais do mês (`fat_pontuacao_lancamentos`), com quem lançou. */
export async function lerLancamentos(token: string, ano: number, mes: number): Promise<LancamentoManual[] | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_lancamentos')
    .select('frente, chave, pontos, observacao, lancado_por_nome, lancado_em')
    .eq('ano', ano)
    .eq('mes', mes);
  if (error) {
    console.error('[faturamento/pontuacao] lançamentos:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível consultar os lançamentos manuais: ${error.message}` } };
  }
  return (data as LinhaLancamento[]).map((linha) => ({
    frente: linha.frente,
    chave: linha.chave,
    pontos: Number(linha.pontos),
    observacao: linha.observacao,
    autoria: { por: linha.lancado_por_nome, em: linha.lancado_em },
  }));
}

/**
 * Lança ou substitui o lançamento do mês, Frente e critério. Cliente do usuário:
 * a RLS exige canManageBilling e o trigger grava quem lançou a partir da sessão.
 */
export async function gravarLancamento(
  token: string,
  ano: number,
  mes: number,
  { frente, chave, pontos, observacao }: LancamentoManual,
): Promise<null | FalhaFato> {
  const { error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_lancamentos')
    .upsert({ ano, mes, frente, chave, pontos, observacao }, { onConflict: 'ano,mes,frente,chave' });
  if (error) {
    // PT409: o trigger recusou porque o mês está fechado; a mensagem já é para a tela.
    if (error.code === 'PT409') return { erro: { status: 409, mensagem: error.message } };
    console.error('[faturamento/pontuacao] gravar lançamento:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível gravar o lançamento: ${error.message}` } };
  }
  return null;
}

/** O que fica congelado no Fechamento: os pontos e tudo que entrou na conta. */
export interface ResumoCongelado {
  pontuacao: ResumoPontuacao;
  fatos: EntradaPontuacao['fatos'];
  membros: MembroFrente[];
  lancamentos: LancamentoManual[];
}

export interface FechamentoEmVigor {
  resumo: ResumoCongelado;
  /** 'YYYY-MM-DD HH:MM', como o "dados até" da prévia. */
  dadoAte: string;
  fechadoPor: string | null;
  fechadoEm: string;
}

/** Fechamento em vigor do mês (`fat_pontuacao_fechamentos`), ou null quando o mês está aberto. */
export async function lerFechamento(token: string, ano: number, mes: number): Promise<FechamentoEmVigor | null | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_fechamentos')
    .select('resumo, dado_ate, fechado_por_nome, fechado_em')
    .eq('ano', ano)
    .eq('mes', mes)
    .is('reaberto_em', null)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/pontuacao] fechamento:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível consultar o fechamento do mês: ${error.message}` } };
  }
  if (!data) return null;
  const linha = data as { resumo: ResumoCongelado; dado_ate: string; fechado_por_nome: string | null; fechado_em: string };
  return {
    resumo: linha.resumo,
    // TIMESTAMP volta como 'YYYY-MM-DDTHH:MM:SS'.
    dadoAte: linha.dado_ate.replace('T', ' ').slice(0, 16),
    fechadoPor: linha.fechado_por_nome,
    fechadoEm: linha.fechado_em,
  };
}

/** Grava o Fechamento do mês. O trigger grava quem fechou a partir da sessão. */
export async function gravarFechamento(
  token: string,
  ano: number,
  mes: number,
  resumo: ResumoCongelado,
  dadoAte: string,
): Promise<null | FalhaFato> {
  const { error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_fechamentos')
    .insert({ ano, mes, resumo, dado_ate: dadoAte });
  if (error) {
    // 23505: o índice parcial de fechamentos em vigor; alguém fechou o mês antes.
    if (error.code === '23505') return { erro: { status: 409, mensagem: 'A pontuação deste mês já está fechada.' } };
    console.error('[faturamento/pontuacao] fechar:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível fechar a pontuação: ${error.message}` } };
  }
  return null;
}

/** Tira o fechamento de vigor. O trigger grava quem reabriu e quando; os lançamentos ficam. */
export async function reabrirFechamento(token: string, ano: number, mes: number): Promise<null | FalhaFato> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_pontuacao_fechamentos')
    .update({ reaberto_em: new Date().toISOString() })
    .eq('ano', ano)
    .eq('mes', mes)
    .is('reaberto_em', null)
    .select('id');
  if (error) {
    if (error.code === 'PT409') return { erro: { status: 409, mensagem: error.message } };
    console.error('[faturamento/pontuacao] reabrir:', error.message);
    return { erro: { status: 502, mensagem: `Não foi possível reabrir a pontuação: ${error.message}` } };
  }
  if (!data || data.length === 0) return { erro: { status: 409, mensagem: 'A pontuação deste mês não está fechada.' } };
  return null;
}

const primeiroDia = (ano: number, mes: number): string => `${ano}-${String(mes).padStart(2, '0')}-01`;

/** Guias sem lote: convênios com requisição solicitada no mês anterior (M-1),
 *  com as mesmas fontes consideradas da aba Pendências → Sem lote. */
export async function lerFatoGuiasSemLote(ano: number, mes: number): Promise<FatoGuiasSemLote | FalhaFato> {
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  // Cliente admin, como o handler da aba: a lista de operadoras não depende de quem pede.
  const fontesConsideradas = await listarFontesConsideradasMeta(getSupabaseAdminClient());
  return guiasSemLotePorConvenio({
    desde: primeiroDia(anterior.ano, anterior.mes),
    ateExclusivo: primeiroDia(ano, mes),
    fontesConsideradas,
  });
}

/** Zero glosa: convênios com recebimento registrado no apLIS no mês M, com as
 *  mesmas fontes consideradas das guias sem lote. */
export async function lerFatoZeroGlosa(ano: number, mes: number): Promise<FatoZeroGlosa | FalhaFato> {
  const seguinte = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  // Cliente admin, como nas guias sem lote: a lista de operadoras não depende de quem pede.
  const fontesConsideradas = await listarFontesConsideradasMeta(getSupabaseAdminClient());
  return recebidosComGlosaPorConvenio({
    desde: primeiroDia(ano, mes),
    ateExclusivo: primeiroDia(seguinte.ano, seguinte.mes),
    fontesConsideradas,
  });
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
    ateExclusivo: primeiroDia(seguinte.ano, seguinte.mes),
  });
  if ('erro' in resultado) return resultado;
  const { porUsuario, doSetor, dadoAte } = resultado;
  return { tarefas: { porUsuario, doSetor }, dadoAte };
}
