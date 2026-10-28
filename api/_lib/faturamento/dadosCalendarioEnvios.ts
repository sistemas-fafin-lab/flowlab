// api/_lib/faturamento/dadosCalendarioEnvios.ts
// Leitura e escrita do Calendário de envios no Supabase (.scratch/faturamento-calendario-envios/spec.md).
// Só lê, grava e achata; a regra de dia útil e de janela é de calendarioEnvios.ts.
// Sempre com o cliente do usuário: a RLS (20261028160000) decide quem lê e quem grava,
// e os triggers gravam quem e quando, e o histórico, com o usuário da sessão.

import { getSupabaseUserClient } from '../supabase.js';
import { ehDiaUtil, janelaDaData, type JanelaEnvio } from './calendarioEnvios.js';

/** Falha a devolver ao navegador: status HTTP e mensagem. */
export type FalhaCalendario = { erro: { status: number; mensagem: string } };

export interface RegraEnvio {
  id: string;
  convenio: string;
  membros: string | null;
  janelas: JanelaEnvio[];
  enviosSugeridosMes: number | null;
  observacao: string | null;
  ativo: boolean;
}

export interface AgendamentoEnvio {
  id: string;
  regraId: string;
  dataPrevista: string;
  janelaIndice: number | null;
  origem: 'sugestao' | 'manual';
  editado: boolean;
  dataEnvio: string | null;
  marcadoPorNome: string | null;
  marcadoEm: string | null;
  loteAplisConfirmado: number | null;
}

export interface FeriadoEnvio {
  data: string;
  descricao: string;
  abrangencia: 'nacional' | 'DF';
}

interface LinhaRegra {
  id: string;
  convenio: string;
  membros: string | null;
  janelas: JanelaEnvio[];
  envios_sugeridos_mes: number | null;
  observacao: string | null;
  ativo: boolean;
}

interface LinhaAgendamento {
  id: string;
  regra_id: string;
  data_prevista: string;
  janela_indice: number | null;
  origem: 'sugestao' | 'manual';
  editado: boolean;
  data_envio: string | null;
  marcado_por_nome: string | null;
  marcado_em: string | null;
  lote_aplis_confirmado: number | null;
}

const COLUNAS_AGENDAMENTO =
  'id, regra_id, data_prevista, janela_indice, origem, editado, data_envio, marcado_por_nome, marcado_em, lote_aplis_confirmado';

const falha = (status: number, mensagem: string): FalhaCalendario => ({ erro: { status, mensagem } });

function paraAgendamento(linha: LinhaAgendamento): AgendamentoEnvio {
  return {
    id: linha.id,
    regraId: linha.regra_id,
    dataPrevista: linha.data_prevista,
    janelaIndice: linha.janela_indice,
    origem: linha.origem,
    editado: linha.editado,
    dataEnvio: linha.data_envio,
    marcadoPorNome: linha.marcado_por_nome,
    marcadoEm: linha.marcado_em,
    loteAplisConfirmado: linha.lote_aplis_confirmado,
  };
}

/** Todas as regras, ativas e desativadas: agendamentos antigos ainda apontam para as desativadas. */
export async function lerRegras(token: string): Promise<RegraEnvio[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_regras')
    .select('id, convenio, membros, janelas, envios_sugeridos_mes, observacao, ativo')
    .order('convenio');
  if (error) {
    console.error('[faturamento/calendario-envios] regras:', error.message);
    return falha(502, `Não foi possível consultar as regras de envio: ${error.message}`);
  }
  return (data as LinhaRegra[]).map((linha) => ({
    id: linha.id,
    convenio: linha.convenio,
    membros: linha.membros,
    janelas: linha.janelas,
    enviosSugeridosMes: linha.envios_sugeridos_mes,
    observacao: linha.observacao,
    ativo: linha.ativo,
  }));
}

/** Todos os feriados cadastrados: são poucos por ano, e o próximo dia útil pode cair no mês seguinte. */
export async function lerFeriados(token: string): Promise<FeriadoEnvio[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_feriados')
    .select('data, descricao, abrangencia')
    .order('data');
  if (error) {
    console.error('[faturamento/calendario-envios] feriados:', error.message);
    return falha(502, `Não foi possível consultar os feriados: ${error.message}`);
  }
  return data as FeriadoEnvio[];
}

/**
 * Os agendamentos não enviados com data prevista antes de `hoje`, de qualquer mês: os
 * candidatos ao bloco Atrasados e ao contador do menu (a classificação decide).
 */
export async function lerVencidos(token: string, hoje: string): Promise<AgendamentoEnvio[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamentos')
    .select(COLUNAS_AGENDAMENTO)
    .is('data_envio', null)
    .lt('data_prevista', hoje)
    .order('data_prevista')
    .order('criado_em');
  if (error) {
    console.error('[faturamento/calendario-envios] vencidos:', error.message);
    return falha(502, `Não foi possível consultar os agendamentos atrasados: ${error.message}`);
  }
  return (data as LinhaAgendamento[]).map(paraAgendamento);
}

/**
 * Regras e os agendamentos do mês (`inicio` a `fim`) mais os dos dias avulsos pedidos
 * (hoje e o próximo dia útil, que podem cair em outro mês).
 */
export async function lerCalendario(
  token: string,
  { inicio, fim, dias }: { inicio: string; fim: string; dias: string[] },
): Promise<{ regras: RegraEnvio[]; agendamentos: AgendamentoEnvio[] } | FalhaCalendario> {
  const [regras, agendamentos] = await Promise.all([
    lerRegras(token),
    getSupabaseUserClient(token)
      .from('fat_envio_agendamentos')
      .select(COLUNAS_AGENDAMENTO)
      .or(`and(data_prevista.gte.${inicio},data_prevista.lte.${fim}),data_prevista.in.(${dias.join(',')})`)
      .order('data_prevista')
      .order('criado_em'),
  ]);
  if ('erro' in regras) return regras;
  if (agendamentos.error) {
    console.error('[faturamento/calendario-envios] agendamentos:', agendamentos.error.message);
    return falha(502, `Não foi possível consultar os agendamentos: ${agendamentos.error.message}`);
  }
  return { regras, agendamentos: (agendamentos.data as LinhaAgendamento[]).map(paraAgendamento) };
}

/**
 * Marca o agendamento como enviado em `dataEnvio`. Marcar de novo troca a data. Quem
 * marcou e o histórico ("marcou") vêm dos triggers.
 */
export async function marcarEnviado(token: string, id: string, dataEnvio: string): Promise<AgendamentoEnvio | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamentos')
    .update({ data_envio: dataEnvio })
    .eq('id', id)
    .select(COLUNAS_AGENDAMENTO)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/calendario-envios] marcar:', error.message);
    return falha(502, `Não foi possível marcar o envio: ${error.message}`);
  }
  if (!data) return falha(404, 'Agendamento não encontrado.');
  return paraAgendamento(data as LinhaAgendamento);
}

/** Desfaz a marcação. 409 se o agendamento não estava marcado. */
export async function desmarcarEnviado(token: string, id: string): Promise<AgendamentoEnvio | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamentos')
    .update({ data_envio: null })
    .eq('id', id)
    .not('data_envio', 'is', null)
    .select(COLUNAS_AGENDAMENTO)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/calendario-envios] desmarcar:', error.message);
    return falha(502, `Não foi possível desmarcar o envio: ${error.message}`);
  }
  if (!data) return falha(409, 'Este agendamento não está marcado como enviado.');
  return paraAgendamento(data as LinhaAgendamento);
}

/**
 * Reagenda (move) o agendamento para `dataPrevista`, recalculando a janela; fora da
 * janela é permitido, dia que não é útil, não. Fica "editado", para a sugestão não
 * desfazer o ajuste. O histórico ("moveu") vem do trigger.
 */
export async function reagendar(token: string, id: string, dataPrevista: string): Promise<AgendamentoEnvio | FalhaCalendario> {
  const supabase = getSupabaseUserClient(token);
  const [{ data: atual, error: erroAtual }, feriados] = await Promise.all([
    supabase.from('fat_envio_agendamentos').select('fat_envio_regras(janelas)').eq('id', id).maybeSingle(),
    lerFeriados(token),
  ]);
  if (erroAtual) {
    console.error('[faturamento/calendario-envios] reagendar:', erroAtual.message);
    return falha(502, `Não foi possível consultar o agendamento: ${erroAtual.message}`);
  }
  if ('erro' in feriados) return feriados;
  const linhaAtual = atual as unknown as { fat_envio_regras: Pick<LinhaRegra, 'janelas'> } | null;
  if (!linhaAtual) return falha(404, 'Agendamento não encontrado.');

  const datasFeriados = feriados.map((f) => f.data);
  if (!ehDiaUtil(dataPrevista, datasFeriados)) return falha(400, 'A data escolhida não é dia útil.');

  const { data, error } = await supabase
    .from('fat_envio_agendamentos')
    .update({
      data_prevista: dataPrevista,
      janela_indice: janelaDaData(dataPrevista, linhaAtual.fat_envio_regras.janelas, datasFeriados),
      editado: true,
    })
    .eq('id', id)
    .select(COLUNAS_AGENDAMENTO)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/calendario-envios] reagendar:', error.message);
    return falha(502, `Não foi possível reagendar: ${error.message}`);
  }
  if (!data) return falha(404, 'Agendamento não encontrado.');
  return paraAgendamento(data as LinhaAgendamento);
}

/**
 * Cria um agendamento avulso (origem "manual") da regra no dia. Fora da janela da regra
 * é permitido (janela nula); dia que não é útil, não. A regra precisa estar ativa.
 */
export async function criarAvulso(
  token: string,
  regraId: string,
  dataPrevista: string,
): Promise<AgendamentoEnvio | FalhaCalendario> {
  const supabase = getSupabaseUserClient(token);
  const [{ data: regra, error: erroRegra }, feriados] = await Promise.all([
    supabase.from('fat_envio_regras').select('janelas, ativo').eq('id', regraId).maybeSingle(),
    lerFeriados(token),
  ]);
  if (erroRegra) {
    console.error('[faturamento/calendario-envios] criar avulso:', erroRegra.message);
    return falha(502, `Não foi possível consultar a regra de envio: ${erroRegra.message}`);
  }
  if ('erro' in feriados) return feriados;
  const linhaRegra = regra as Pick<LinhaRegra, 'janelas' | 'ativo'> | null;
  if (!linhaRegra) return falha(404, 'Regra de envio não encontrada.');
  if (!linhaRegra.ativo) return falha(409, 'Esta regra de envio está desativada.');

  const datasFeriados = feriados.map((f) => f.data);
  if (!ehDiaUtil(dataPrevista, datasFeriados)) return falha(400, 'A data escolhida não é dia útil.');

  const { data, error } = await supabase
    .from('fat_envio_agendamentos')
    .insert({
      regra_id: regraId,
      data_prevista: dataPrevista,
      janela_indice: janelaDaData(dataPrevista, linhaRegra.janelas, datasFeriados),
      origem: 'manual',
    })
    .select(COLUNAS_AGENDAMENTO)
    .single();
  if (error) {
    console.error('[faturamento/calendario-envios] criar avulso:', error.message);
    return falha(502, `Não foi possível criar o agendamento: ${error.message}`);
  }
  return paraAgendamento(data as LinhaAgendamento);
}
