// api/_lib/faturamento/dadosCalendarioEnvios.ts
// Leitura e escrita do Calendário de envios no Supabase (.scratch/faturamento-calendario-envios/spec.md).
// Só lê, grava e achata; a regra de dia útil e de janela é de calendarioEnvios.ts.
// Com o cliente do usuário: a RLS (20261028160000) decide quem lê e quem grava, e os
// triggers gravam quem e quando, e o histórico, com o usuário da sessão. A exceção é a
// confirmação automática (gravarConfirmacoes), que roda sem usuário.

import { getSupabaseAdminClient, getSupabaseUserClient } from '../supabase.js';
import {
  ehDiaUtil,
  fimDoMes,
  janelaDaData,
  type AgendamentoSugerido,
  type ConfirmacaoAplis,
  type JanelaEnvio,
} from './calendarioEnvios.js';

/** Falha a devolver ao navegador: status HTTP e mensagem. */
export type FalhaCalendario = { erro: { status: number; mensagem: string } };

export interface RegraEnvio {
  id: string;
  convenio: string;
  membros: string | null;
  /** `fatinstituicao.IdInstituicao` das fontes pagadoras do apLIS do convênio. */
  fontesPagadoras: number[];
  /** `fatconvenio.IdConvenio` dos convênios membros (agrupadores AMHPDF), dentro dessas fontes. */
  conveniosAplis: number[];
  janelas: JanelaEnvio[];
  enviosSugeridosMes: number | null;
  observacao: string | null;
  ativo: boolean;
  alteradoPorNome: string | null;
  alteradoEm: string;
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
  id: string;
  data: string;
  descricao: string;
  abrangencia: 'nacional' | 'DF';
  /** Null nos feriados da carga inicial. */
  alteradoPorNome: string | null;
  alteradoEm: string | null;
}

interface LinhaRegra {
  id: string;
  convenio: string;
  membros: string | null;
  fontes_pagadoras: number[];
  convenios_aplis: number[];
  janelas: JanelaEnvio[];
  envios_sugeridos_mes: number | null;
  observacao: string | null;
  ativo: boolean;
  alterado_por_nome: string | null;
  alterado_em: string;
}

interface LinhaFeriado {
  id: string;
  data: string;
  descricao: string;
  abrangencia: 'nacional' | 'DF';
  alterado_por_nome: string | null;
  alterado_em: string | null;
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

const COLUNAS_REGRA =
  'id, convenio, membros, fontes_pagadoras, convenios_aplis, janelas, envios_sugeridos_mes, observacao, ativo, alterado_por_nome, alterado_em';

const COLUNAS_FERIADO = 'id, data, descricao, abrangencia, alterado_por_nome, alterado_em';

const COLUNAS_AGENDAMENTO =
  'id, regra_id, data_prevista, janela_indice, origem, editado, data_envio, marcado_por_nome, marcado_em, lote_aplis_confirmado';

const falha = (status: number, mensagem: string): FalhaCalendario => ({ erro: { status, mensagem } });

function paraRegra(linha: LinhaRegra): RegraEnvio {
  return {
    id: linha.id,
    convenio: linha.convenio,
    membros: linha.membros,
    fontesPagadoras: linha.fontes_pagadoras,
    conveniosAplis: linha.convenios_aplis,
    janelas: linha.janelas,
    enviosSugeridosMes: linha.envios_sugeridos_mes,
    observacao: linha.observacao,
    ativo: linha.ativo,
    alteradoPorNome: linha.alterado_por_nome,
    alteradoEm: linha.alterado_em,
  };
}

function paraFeriado(linha: LinhaFeriado): FeriadoEnvio {
  return {
    id: linha.id,
    data: linha.data,
    descricao: linha.descricao,
    abrangencia: linha.abrangencia,
    alteradoPorNome: linha.alterado_por_nome,
    alteradoEm: linha.alterado_em,
  };
}

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
    .select(COLUNAS_REGRA)
    .order('convenio');
  if (error) {
    console.error('[faturamento/calendario-envios] regras:', error.message);
    return falha(502, `Não foi possível consultar as regras de envio: ${error.message}`);
  }
  return (data as LinhaRegra[]).map(paraRegra);
}

/** Todos os feriados cadastrados: são poucos por ano, e o próximo dia útil pode cair no mês seguinte. */
export async function lerFeriados(token: string): Promise<FeriadoEnvio[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_feriados')
    .select(COLUNAS_FERIADO)
    .order('data');
  if (error) {
    console.error('[faturamento/calendario-envios] feriados:', error.message);
    return falha(502, `Não foi possível consultar os feriados: ${error.message}`);
  }
  return (data as LinhaFeriado[]).map(paraFeriado);
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

/** Os agendamentos do mês `mes` ('YYYY-MM'): a entrada da sugestão. */
export async function lerAgendamentosDoMes(token: string, mes: string): Promise<AgendamentoEnvio[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamentos')
    .select(COLUNAS_AGENDAMENTO)
    .gte('data_prevista', `${mes}-01`)
    .lte('data_prevista', fimDoMes(`${mes}-01`))
    .order('data_prevista')
    .order('criado_em');
  if (error) {
    console.error('[faturamento/calendario-envios] agendamentos do mês:', error.message);
    return falha(502, `Não foi possível consultar os agendamentos do mês: ${error.message}`);
  }
  return (data as LinhaAgendamento[]).map(paraAgendamento);
}

/**
 * Situação da sugestão em cada mês: `planejado` quando o mês já tem algum agendamento
 * vindo da sugestão (mesmo que editado depois), e `sugeridosPendentes`, quantos
 * sugeridos ainda pendentes e não editados ele tem (o que regerar pode refazer).
 */
export async function situacaoDaSugestao(
  token: string,
  meses: string[],
): Promise<Map<string, { planejado: boolean; sugeridosPendentes: number }> | FalhaCalendario> {
  const supabase = getSupabaseUserClient(token);
  const sugeridos = (mes: string) =>
    supabase
      .from('fat_envio_agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('origem', 'sugestao')
      .gte('data_prevista', `${mes}-01`)
      .lte('data_prevista', fimDoMes(`${mes}-01`));
  const respostas = await Promise.all(
    meses.map((mes) => Promise.all([sugeridos(mes), sugeridos(mes).eq('editado', false).is('data_envio', null)])),
  );
  const situacao = new Map<string, { planejado: boolean; sugeridosPendentes: number }>();
  for (const [i, [todos, pendentes]] of respostas.entries()) {
    const error = todos.error ?? pendentes.error;
    if (error) {
      console.error('[faturamento/calendario-envios] situação da sugestão:', error.message);
      return falha(502, `Não foi possível consultar a sugestão do mês: ${error.message}`);
    }
    situacao.set(meses[i], { planejado: (todos.count ?? 0) > 0, sugeridosPendentes: pendentes.count ?? 0 });
  }
  return situacao;
}

/**
 * Grava a sugestão de `mes` numa transação (fat_envio_aplicar_sugestao, 20261028180000):
 * remove os sugeridos refeitos e cria os novos, com origem "sugestão". O histórico
 * ("criou", e "removeu" marcado como da sugestão) vem do trigger. 409 se o mês não tem
 * mais exatamente os agendamentos `existentes` da conta (outra geração, ou alguém mexeu).
 */
export async function aplicarSugestao(
  token: string,
  mes: string,
  existentes: string[],
  criar: AgendamentoSugerido[],
  remover: string[],
): Promise<{ criados: number; removidos: number } | FalhaCalendario> {
  const { error } = await getSupabaseUserClient(token).rpc('fat_envio_aplicar_sugestao', {
    p_mes: mes,
    p_existentes: existentes,
    p_criar: criar.map((c) => ({ regra_id: c.regraId, data_prevista: c.dataPrevista, janela_indice: c.janelaIndice })),
    p_remover: remover,
  });
  if (error) {
    if (error.code === '40001') return falha(409, 'O calendário mudou enquanto a sugestão era gerada. Gere de novo.');
    console.error('[faturamento/calendario-envios] aplicar sugestão:', error.message);
    return falha(502, `Não foi possível gravar a sugestão: ${error.message}`);
  }
  return { criados: criar.length, removidos: remover.length };
}

/**
 * Grava as confirmações do casamento com o backup (fat_envio_confirmar_aplis,
 * 20261028190000) e devolve quantas mudaram. Com o cliente de serviço: a confirmação
 * roda sem usuário, também quando quem abriu o mês só vê o Calendário, e o histórico
 * ("confirmou_aplis" e, se marcou, "marcou") fica sem autor. Idempotente: agendamento
 * que já tem lote, ou lote já gravado em outro, fica como está.
 */
export async function gravarConfirmacoes(confirmacoes: ConfirmacaoAplis[]): Promise<number | FalhaCalendario> {
  if (confirmacoes.length === 0) return 0;
  const { data, error } = await getSupabaseAdminClient().rpc('fat_envio_confirmar_aplis', {
    p_confirmacoes: confirmacoes.map((c) => ({
      agendamento_id: c.agendamentoId,
      id_lote: c.idLote,
      data_envio: c.dataEnvio,
      marcar: c.marcar,
    })),
  });
  if (error) {
    console.error('[faturamento/calendario-envios] confirmar no apLIS:', error.message);
    return falha(502, `Não foi possível gravar as confirmações do apLIS: ${error.message}`);
  }
  return (data as string[] | null)?.length ?? 0;
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

/**
 * Remove o agendamento. O histórico ("removeu", com a data prevista e a de envio)
 * vem do trigger e continua ligado ao id. Devolve o agendamento como estava.
 */
export async function removerAgendamento(token: string, id: string): Promise<AgendamentoEnvio | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamentos')
    .delete()
    .eq('id', id)
    .select(COLUNAS_AGENDAMENTO)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/calendario-envios] remover:', error.message);
    return falha(502, `Não foi possível remover o agendamento: ${error.message}`);
  }
  if (!data) return falha(404, 'Agendamento não encontrado.');
  return paraAgendamento(data as LinhaAgendamento);
}

export type AcaoHistorico = 'criou' | 'moveu' | 'marcou' | 'desmarcou' | 'confirmou_aplis' | 'removeu';

/** Uma linha do histórico de um agendamento: antes e depois só com os campos que mudaram. */
export interface EventoHistoricoAgendamento {
  acao: AcaoHistorico;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  /** Null na confirmação automática, que roda sem usuário. */
  porNome: string | null;
  em: string;
}

interface LinhaHistorico {
  acao: AcaoHistorico;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  por_nome: string | null;
  em: string;
}

/** O histórico do agendamento, do mais antigo ao mais recente. */
export async function lerHistorico(token: string, id: string): Promise<EventoHistoricoAgendamento[] | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_envio_agendamento_historico')
    .select('acao, antes, depois, por_nome, em')
    .eq('agendamento_id', id)
    .order('em');
  if (error) {
    console.error('[faturamento/calendario-envios] histórico:', error.message);
    return falha(502, `Não foi possível consultar o histórico: ${error.message}`);
  }
  return (data as LinhaHistorico[]).map((linha) => ({
    acao: linha.acao,
    antes: linha.antes,
    depois: linha.depois,
    porNome: linha.por_nome,
    em: linha.em,
  }));
}

/** Os campos de uma Regra de envio que o cadastro grava; quem e quando vêm do trigger. */
export interface DadosRegraEnvio {
  convenio: string;
  membros: string | null;
  fontesPagadoras: number[];
  janelas: JanelaEnvio[];
  enviosSugeridosMes: number | null;
  observacao: string | null;
  ativo: boolean;
}

/**
 * Cria a regra (`id` nulo) ou a altera. Desativar é gravar `ativo: false`: a regra
 * nunca é apagada, porque os agendamentos antigos apontam para ela. 409 se já existe
 * regra com o mesmo convênio.
 */
export async function salvarRegra(
  token: string,
  id: string | null,
  dados: DadosRegraEnvio,
): Promise<RegraEnvio | FalhaCalendario> {
  const linha = {
    convenio: dados.convenio,
    membros: dados.membros,
    fontes_pagadoras: dados.fontesPagadoras,
    janelas: dados.janelas,
    envios_sugeridos_mes: dados.enviosSugeridosMes,
    observacao: dados.observacao,
    ativo: dados.ativo,
  };
  const tabela = getSupabaseUserClient(token).from('fat_envio_regras');
  const { data, error } = await (id ? tabela.update(linha).eq('id', id) : tabela.insert(linha))
    .select(COLUNAS_REGRA)
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return falha(409, `Já existe uma regra de envio para ${dados.convenio}.`);
    console.error('[faturamento/calendario-envios] salvar regra:', error.message);
    return falha(502, `Não foi possível gravar a regra de envio: ${error.message}`);
  }
  if (!data) return falha(404, 'Regra de envio não encontrada.');
  return paraRegra(data as LinhaRegra);
}

/** Os campos de um feriado que o cadastro grava; quem e quando vêm do trigger. */
export type DadosFeriado = Pick<FeriadoEnvio, 'data' | 'descricao' | 'abrangencia'>;

/** Cria o feriado (`id` nulo) ou o altera. 409 se já existe feriado na data. */
export async function salvarFeriado(
  token: string,
  id: string | null,
  dados: DadosFeriado,
): Promise<FeriadoEnvio | FalhaCalendario> {
  const tabela = getSupabaseUserClient(token).from('fat_feriados');
  const { data, error } = await (id ? tabela.update(dados).eq('id', id) : tabela.insert(dados))
    .select(COLUNAS_FERIADO)
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return falha(409, 'Já existe um feriado nesta data.');
    console.error('[faturamento/calendario-envios] salvar feriado:', error.message);
    return falha(502, `Não foi possível gravar o feriado: ${error.message}`);
  }
  if (!data) return falha(404, 'Feriado não encontrado.');
  return paraFeriado(data as LinhaFeriado);
}

/** Remove o feriado. Devolve o feriado como estava. */
export async function removerFeriado(token: string, id: string): Promise<FeriadoEnvio | FalhaCalendario> {
  const { data, error } = await getSupabaseUserClient(token)
    .from('fat_feriados')
    .delete()
    .eq('id', id)
    .select(COLUNAS_FERIADO)
    .maybeSingle();
  if (error) {
    console.error('[faturamento/calendario-envios] remover feriado:', error.message);
    return falha(502, `Não foi possível remover o feriado: ${error.message}`);
  }
  if (!data) return falha(404, 'Feriado não encontrado.');
  return paraFeriado(data as LinhaFeriado);
}
