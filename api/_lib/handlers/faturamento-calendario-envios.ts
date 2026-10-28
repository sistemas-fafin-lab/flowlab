/**
 * API Route: GET | POST /api/faturamento/calendario-envios
 *
 * Calendário de envios do Faturamento (.scratch/faturamento-calendario-envios/spec.md):
 * os Agendamentos de envio do mês e de Hoje e Amanhã (o próximo dia útil), as Regras
 * de envio e os feriados. Os dados são do Supabase (dadosCalendarioEnvios.ts); a regra
 * de dia útil e de janela é de faturamento/calendarioEnvios.ts.
 *
 * GET — Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou
 * canViewCalendarioEnvios). Query params:
 *   mes       YYYY-MM, opcional — o mês da grade; sem ele, o mês de hoje
 *   contador  'atrasados' — só `{ atrasados: n }`, para o contador do menu (leve:
 *             não lê o mês nem o backup)
 *   historico <id do agendamento> — só `{ historico: [...] }`, do mais antigo ao mais
 *             recente (o detalhe do agendamento)
 * Devolve `hoje` (America/Sao_Paulo), `amanha`, `mes`, `regras`, `feriados`, os
 * `agendamentos` do mês mais os de hoje e amanhã, e os `atrasados` de qualquer mês
 * (fora do prazo primeiro), e `podeEnviarQualquerDia` (ids das regras ativas de "todos
 * os dias", a lista lateral), e `sugestao`: o mês seguinte, se gerar a sugestão dele já
 * está liberado (a partir do dia 15), se ele já foi planejado, e quantos sugeridos
 * pendentes e não editados o mês corrente ainda tem (o que regerar pode refazer). Cada agendamento vem com `status` e `foraDaJanela` de
 * classificarAgendamento; as telas não recalculam.
 *
 * Confirmação automática (D+1): antes de ler, o GET do mês (até o corrente) lê no
 * backup do apLIS os lotes enviados nele e os casa com os agendamentos (casarLotes):
 * o que ninguém marcou passa a enviado com a data do lote; o marcado à mão só ganha o
 * lote (selo "confirmado no apLIS"). Grava de forma idempotente. Devolve
 * `confirmacaoAplis: { naoPlanejados, aviso }`: os lotes que não casaram (calculados na
 * hora, não gravados) e, se o backup ou a gravação falhou, o aviso; o calendário vem
 * do mesmo jeito, só sem as confirmações novas.
 *
 * POST — canManageCalendarioEnvios. Body com `acao`:
 *   'marcar':    { id, dataEnvio: 'YYYY-MM-DD' } — marca como enviado; marcar de novo
 *                troca a data. Data de envio no futuro dá 400.
 *   'desmarcar': { id } — desfaz a marcação; 409 se não estava marcado.
 *   'criar':     { regraId, dataPrevista: 'YYYY-MM-DD' } — agendamento avulso (origem
 *                "manual"). Fora da janela da regra é permitido; dia não útil dá 400.
 *   'reagendar': { id, dataPrevista: 'YYYY-MM-DD' } — move para um dia útil de hoje em
 *                diante e marca como editado. Fora da janela é permitido; dia não útil
 *                ou no passado dá 400.
 *   'remover':   { id } — apaga o agendamento; o histórico ("removeu") fica.
 *   'salvarRegra': { id?, convenio, membros, fontesPagadoras: number[], janelas,
 *                enviosSugeridosMes, observacao, ativo } — cria (sem id) ou altera a
 *                Regra de envio. Janelas validadas por validarJanelas; "envios
 *                sugeridos no mês" só vale com janela de "todos os dias". Desativar é
 *                ativo: false (a regra nunca é apagada). Convênio repetido dá 409.
 *   'salvarFeriado': { id?, data, descricao, abrangencia: 'nacional' | 'DF' } — cria
 *                ou altera o feriado; data repetida dá 409.
 *   'removerFeriado': { id } — apaga o feriado.
 *   'gerarSugestao': { mes: 'YYYY-MM', simular?: boolean } — a sugestão do mês pelas
 *                Regras de envio (gerarSugestaoDoMes): o mês seguinte a partir do dia 15,
 *                ou o mês corrente (regerar depois de mudar uma regra); outro mês dá 400.
 *                Só refaz os sugeridos pendentes e não editados. Devolve `sugestao:
 *                { mes, criados, removidos }`; com `simular`, só conta, sem gravar.
 *                Ao gravar, `criados` e `removidos` (os da simulação que a tela
 *                confirmou) são conferidos: se a conta mudou, ou o mês mudou durante a
 *                gravação, 409.
 * Quem e quando, e o histórico, são gravados por trigger (20261028160000 e, nos
 * feriados, 20261028170000).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarLotesEnviadosDoMes } from '../faturamento/bdLab.js';
import {
  casarLotes,
  classificarAgendamento,
  fimDoMes,
  gerarSugestaoDoMes,
  proximoDiaUtil,
  somarDias,
  MAXIMO_DIA_UTIL,
  regrasDeQualquerDia,
  validarJanelas,
  type ClassificacaoAgendamento,
} from '../faturamento/calendarioEnvios.js';
import {
  aplicarSugestao,
  criarAvulso,
  desmarcarEnviado,
  gravarConfirmacoes,
  lerAgendamentosDoMes,
  lerCalendario,
  lerFeriados,
  lerHistorico,
  lerRegras,
  lerVencidos,
  marcarEnviado,
  reagendar as reagendarAgendamento,
  removerAgendamento,
  removerFeriado as removerFeriadoCadastrado,
  salvarFeriado as salvarFeriadoCadastrado,
  salvarRegra as salvarRegraCadastrada,
  situacaoDaSugestao,
} from '../faturamento/dadosCalendarioEnvios.js';
import type {
  AgendamentoEnvio,
  DadosFeriado,
  DadosRegraEnvio,
  FalhaCalendario,
  RegraEnvio,
} from '../faturamento/dadosCalendarioEnvios.js';
import { mesValido } from '../faturamento/indicadoresFaturamento.js';

const FORMATO_DATA_LOCAL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "Hoje" em America/Sao_Paulo, não no fuso do processo (UTC na Vercel). */
function hojeIsoLocal(): string {
  return FORMATO_DATA_LOCAL.format(new Date());
}

/** 'YYYY-MM-DD' de um dia que existe (rejeita 2026-02-30). */
function dataValida(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    && new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) === valor;
}

/** O mês seguinte a 'YYYY-MM'. */
const mesSeguinte = (mes: string): string => somarDias(fimDoMes(`${mes}-01`), 1).slice(0, 7);

/** A partir deste dia do mês corrente, a sugestão do mês seguinte fica liberada. */
const DIA_LIBERA_SUGESTAO = 15;

const sugestaoLiberada = (hoje: string): boolean => Number(hoje.slice(8, 10)) >= DIA_LIBERA_SUGESTAO;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idValido = (valor: unknown): valor is string => typeof valor === 'string' && UUID_RE.test(valor);

const responderFalha = (res: VercelResponse, { erro }: FalhaCalendario): void => {
  res.status(erro.status).json({ success: false, error: erro.mensagem });
};

type AgendamentoClassificado = AgendamentoEnvio & ClassificacaoAgendamento;

/** Status e selo de cada agendamento, em `hoje`. A FK garante a regra; sem ela, só a data prevista conta. */
function classificar(
  agendamentos: AgendamentoEnvio[],
  regras: RegraEnvio[],
  feriados: string[],
  hoje: string,
): AgendamentoClassificado[] {
  const porId = new Map(regras.map((regra) => [regra.id, regra]));
  return agendamentos.map((agendamento) => ({
    ...agendamento,
    ...classificarAgendamento(agendamento, porId.get(agendamento.regraId) ?? { janelas: [] }, feriados, hoje),
  }));
}

/** O bloco Atrasados: atrasados e fora do prazo de qualquer mês, fora do prazo primeiro, depois por data. */
function atrasadosEmOrdem(classificados: AgendamentoClassificado[]): AgendamentoClassificado[] {
  const atrasados = classificados.filter((a) => a.status === 'atrasado' || a.status === 'fora_do_prazo');
  const peso = (a: AgendamentoClassificado) => (a.status === 'fora_do_prazo' ? 0 : 1);
  // sort é estável: dentro do mesmo status fica a ordem de data prevista da consulta.
  return atrasados.sort((a, b) => peso(a) - peso(b));
}

/** Um lote do backup que não casou com nenhum agendamento: a lista "Envios não planejados". */
interface EnvioNaoPlanejado {
  idLote: number;
  nomeFontePagadora: string | null;
  nomesConvenios: string | null;
  dataEnvio: string;
}

const AVISO_CONFIRMACAO = 'A confirmação automática pelo backup do apLIS falhou: o calendário aparece sem as confirmações novas.';

/**
 * A confirmação automática do mês `mes`: casa os lotes enviados do backup com os
 * agendamentos e grava as confirmações. Nunca derruba o GET: qualquer falha vira o
 * aviso. Mês futuro não tem lote, nem consulta o backup.
 */
async function confirmarNoAplis(
  token: string,
  mes: string,
  hoje: string,
  feriados: string[],
): Promise<{ naoPlanejados: EnvioNaoPlanejado[]; aviso: string | null }> {
  if (mes > hoje.slice(0, 7)) return { naoPlanejados: [], aviso: null };
  try {
    const [lotes, regras, agendamentos] = await Promise.all([
      listarLotesEnviadosDoMes(mes),
      lerRegras(token),
      lerAgendamentosDoMes(token, mes),
    ]);
    if ('erro' in lotes || 'erro' in regras || 'erro' in agendamentos) return { naoPlanejados: [], aviso: AVISO_CONFIRMACAO };

    const { confirmacoes, naoPlanejados } = casarLotes(lotes.lotes, agendamentos, regras, feriados);
    const gravadas = await gravarConfirmacoes(confirmacoes);
    return {
      naoPlanejados: naoPlanejados.map(({ idLote, nomeFontePagadora, nomesConvenios, dataEnvio }) => ({
        idLote,
        nomeFontePagadora,
        nomesConvenios,
        dataEnvio,
      })),
      aviso: typeof gravadas === 'number' ? null : AVISO_CONFIRMACAO,
    };
  } catch (err) {
    console.error('[faturamento/calendario-envios] confirmação no apLIS:', describeError(err));
    return { naoPlanejados: [], aviso: AVISO_CONFIRMACAO };
  }
}

/** GET ?contador=atrasados: só o total do bloco Atrasados, para o menu. */
async function contarAtrasados(token: string, res: VercelResponse): Promise<void> {
  const hoje = hojeIsoLocal();
  const [regras, feriados, vencidos] = await Promise.all([lerRegras(token), lerFeriados(token), lerVencidos(token, hoje)]);
  if ('erro' in regras) {
    responderFalha(res, regras);
    return;
  }
  if ('erro' in feriados) {
    responderFalha(res, feriados);
    return;
  }
  if ('erro' in vencidos) {
    responderFalha(res, vencidos);
    return;
  }
  const classificados = classificar(vencidos, regras, feriados.map((f) => f.data), hoje);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ success: true, atrasados: atrasadosEmOrdem(classificados).length });
}

/** GET ?historico=<id>: o histórico do agendamento, para o detalhe. */
async function consultarHistorico(token: string, bruto: string | string[], res: VercelResponse): Promise<void> {
  const id = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!idValido(id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: historico (id do agendamento).' });
    return;
  }
  const historico = await lerHistorico(token, id);
  if ('erro' in historico) {
    responderFalha(res, historico);
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ success: true, historico });
}

async function consultarMes(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarFaturamento(token, ['calendarioEnvios']);
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  if (req.query.contador === 'atrasados') {
    await contarAtrasados(token as string, res);
    return;
  }

  if (req.query.historico !== undefined) {
    await consultarHistorico(token as string, req.query.historico, res);
    return;
  }

  const hoje = hojeIsoLocal();
  const bruto = req.query.mes;
  const mes = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() || hoje.slice(0, 7);
  if (!mesValido(mes)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: mes (YYYY-MM).' });
    return;
  }

  // Os feriados primeiro: o próximo dia útil depende deles e pode cair fora do mês da grade.
  const feriados = await lerFeriados(token as string);
  if ('erro' in feriados) {
    responderFalha(res, feriados);
    return;
  }
  const datasFeriados = feriados.map((f) => f.data);
  const amanha = proximoDiaUtil(hoje, datasFeriados);
  const mesAtual = hoje.slice(0, 7);
  const seguinte = mesSeguinte(mesAtual);
  // Antes de ler o mês, para ele já vir com as confirmações gravadas.
  const confirmacaoAplis = await confirmarNoAplis(token as string, mes, hoje, datasFeriados);
  const [calendario, vencidos, situacao] = await Promise.all([
    lerCalendario(token as string, { inicio: `${mes}-01`, fim: fimDoMes(`${mes}-01`), dias: [hoje, amanha] }),
    lerVencidos(token as string, hoje),
    situacaoDaSugestao(token as string, [mesAtual, seguinte]),
  ]);
  if ('erro' in calendario) {
    responderFalha(res, calendario);
    return;
  }
  if ('erro' in vencidos) {
    responderFalha(res, vencidos);
    return;
  }
  if ('erro' in situacao) {
    responderFalha(res, situacao);
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    success: true,
    hoje,
    amanha,
    mes,
    feriados,
    regras: calendario.regras,
    podeEnviarQualquerDia: regrasDeQualquerDia(calendario.regras).map((regra) => regra.id),
    agendamentos: classificar(calendario.agendamentos, calendario.regras, datasFeriados, hoje),
    atrasados: atrasadosEmOrdem(classificar(vencidos, calendario.regras, datasFeriados, hoje)),
    sugestao: {
      mesSeguinte: seguinte,
      liberada: sugestaoLiberada(hoje),
      mesSeguintePlanejado: situacao.get(seguinte)?.planejado ?? false,
      sugeridosPendentesMesAtual: situacao.get(mesAtual)?.sugeridosPendentes ?? 0,
    },
    confirmacaoAplis,
  });
}

/** Responde o que foi gravado sob `chave`, ou a falha. */
function responderGravado<T extends object>(res: VercelResponse, chave: string, resultado: T | FalhaCalendario): void {
  if ('erro' in resultado) {
    responderFalha(res, resultado);
    return;
  }
  res.status(200).json({ success: true, [chave]: resultado });
}


/** POST marcar: data de envio de hoje para trás; marcar de novo troca a data. */
async function marcar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id) || !dataValida(corpo.dataEnvio)) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos: id e dataEnvio (YYYY-MM-DD).' });
    return;
  }
  if (corpo.dataEnvio > hojeIsoLocal()) {
    res.status(400).json({ success: false, error: 'A data do envio não pode ser no futuro.' });
    return;
  }
  responderGravado(res, 'agendamento', await marcarEnviado(token, corpo.id, corpo.dataEnvio));
}

/** POST desmarcar: volta a pendente; a marcação fica no histórico. */
async function desmarcar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  responderGravado(res, 'agendamento', await desmarcarEnviado(token, corpo.id));
}

/** POST criar: agendamento avulso da regra no dia. */
async function criar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.regraId) || !dataValida(corpo.dataPrevista)) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos: regraId e dataPrevista (YYYY-MM-DD).' });
    return;
  }
  responderGravado(res, 'agendamento', await criarAvulso(token, corpo.regraId, corpo.dataPrevista));
}

/** POST reagendar: move para um dia útil de hoje em diante (fora da janela é permitido). */
async function reagendar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id) || !dataValida(corpo.dataPrevista)) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos: id e dataPrevista (YYYY-MM-DD).' });
    return;
  }
  if (corpo.dataPrevista < hojeIsoLocal()) {
    res.status(400).json({ success: false, error: 'A nova data não pode ser no passado.' });
    return;
  }
  responderGravado(res, 'agendamento', await reagendarAgendamento(token, corpo.id, corpo.dataPrevista));
}

/** POST remover: apaga o agendamento; o histórico fica. */
async function remover(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  responderGravado(res, 'agendamento', await removerAgendamento(token, corpo.id));
}

/** Texto aparado, ou null quando vazio ou ausente. */
const textoOpcional = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : null;

/** `id` ausente ou nulo: criar; um uuid: alterar. undefined quando inválido. */
function idOpcional(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null) return null;
  return idValido(valor) ? valor : undefined;
}

/** A Regra de envio vinda do cadastro, ou a mensagem do que está errado. */
function lerRegra(corpo: Record<string, unknown>): { dados: DadosRegraEnvio } | { erro: string } {
  const convenio = textoOpcional(corpo.convenio);
  if (!convenio) return { erro: 'Informe o convênio.' };

  const lidas = validarJanelas(corpo.janelas);
  if ('erro' in lidas) return lidas;

  const fontes = corpo.fontesPagadoras ?? [];
  if (!Array.isArray(fontes) || !fontes.every((f) => Number.isInteger(f) && f > 0)) {
    return { erro: 'Fontes pagadoras inválidas: use os códigos do apLIS.' };
  }

  // "Envios sugeridos no mês" só vale com janela de "todos os dias"; nas outras, some.
  const todosOsDias = lidas.janelas.some((janela) => janela.tipo === 'todos_os_dias');
  const envios = corpo.enviosSugeridosMes ?? null;
  if (todosOsDias && envios !== null && !(Number.isInteger(envios) && (envios as number) >= 1 && (envios as number) <= MAXIMO_DIA_UTIL)) {
    return { erro: `Envios sugeridos no mês: um número de 1 a ${MAXIMO_DIA_UTIL}, ou vazio.` };
  }

  if (corpo.ativo !== undefined && typeof corpo.ativo !== 'boolean') return { erro: 'Parâmetro inválido: ativo.' };

  return {
    dados: {
      convenio,
      membros: textoOpcional(corpo.membros),
      fontesPagadoras: [...new Set(fontes as number[])],
      janelas: lidas.janelas,
      enviosSugeridosMes: todosOsDias ? (envios as number | null) : null,
      observacao: textoOpcional(corpo.observacao),
      ativo: corpo.ativo !== false,
    },
  };
}

/** POST salvarRegra: cria ou altera a Regra de envio; desativar é ativo: false. */
async function salvarRegra(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const id = idOpcional(corpo.id);
  if (id === undefined) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  const lida = lerRegra(corpo);
  if ('erro' in lida) {
    res.status(400).json({ success: false, error: lida.erro });
    return;
  }
  responderGravado(res, 'regra', await salvarRegraCadastrada(token, id, lida.dados));
}

const ABRANGENCIAS: readonly DadosFeriado['abrangencia'][] = ['nacional', 'DF'];

/** POST salvarFeriado: cria ou altera o feriado. */
async function salvarFeriado(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const id = idOpcional(corpo.id);
  const descricao = textoOpcional(corpo.descricao);
  const abrangencia = corpo.abrangencia as DadosFeriado['abrangencia'];
  if (id === undefined || !dataValida(corpo.data) || !descricao || !ABRANGENCIAS.includes(abrangencia)) {
    res.status(400).json({
      success: false,
      error: 'Parâmetros inválidos: data (YYYY-MM-DD), descrição e abrangência (nacional ou DF).',
    });
    return;
  }
  responderGravado(res, 'feriado', await salvarFeriadoCadastrado(token, id, { data: corpo.data, descricao, abrangencia }));
}

/** POST removerFeriado: apaga o feriado. */
async function removerFeriado(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  responderGravado(res, 'feriado', await removerFeriadoCadastrado(token, corpo.id));
}

/**
 * POST gerarSugestao: a sugestão do mês seguinte (a partir do dia 15) ou do corrente.
 * Com `simular`, só conta o que seria criado e removido, para a confirmação.
 */
async function gerarSugestao(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  const mes = typeof corpo.mes === 'string' ? corpo.mes : '';
  const contagem = (valor: unknown) => Number.isInteger(valor) && (valor as number) >= 0;
  if (!mesValido(mes) || (corpo.simular !== undefined && typeof corpo.simular !== 'boolean')
    || (!corpo.simular && (!contagem(corpo.criados) || !contagem(corpo.removidos)))) {
    res.status(400).json({
      success: false,
      error: 'Parâmetros inválidos: mes (YYYY-MM), e simular ou as contagens confirmadas (criados e removidos).',
    });
    return;
  }
  const hoje = hojeIsoLocal();
  const mesAtual = hoje.slice(0, 7);
  if (mes !== mesAtual && !(mes === mesSeguinte(mesAtual) && sugestaoLiberada(hoje))) {
    res.status(400).json({
      success: false,
      error: `A sugestão só pode ser gerada para o mês corrente ou, a partir do dia ${DIA_LIBERA_SUGESTAO}, para o mês seguinte.`,
    });
    return;
  }

  const [regras, feriados, existentes] = await Promise.all([lerRegras(token), lerFeriados(token), lerAgendamentosDoMes(token, mes)]);
  if ('erro' in regras) {
    responderFalha(res, regras);
    return;
  }
  if ('erro' in feriados) {
    responderFalha(res, feriados);
    return;
  }
  if ('erro' in existentes) {
    responderFalha(res, existentes);
    return;
  }
  const { criar, remover } = gerarSugestaoDoMes(mes, regras, feriados.map((f) => f.data), existentes);
  if (corpo.simular) {
    res.status(200).json({ success: true, sugestao: { mes, criados: criar.length, removidos: remover.length } });
    return;
  }
  if (criar.length !== corpo.criados || remover.length !== corpo.removidos) {
    res.status(409).json({ success: false, error: 'O calendário mudou desde a confirmação. Gere a sugestão de novo.' });
    return;
  }
  const gravada = await aplicarSugestao(token, mes, existentes.map((a) => a.id), criar, remover);
  responderGravado(res, 'sugestao', 'erro' in gravada ? gravada : { mes, ...gravada });
}

const ACOES: Record<string, (token: string, corpo: Record<string, unknown>, res: VercelResponse) => Promise<void>> = {
  marcar,
  desmarcar,
  criar,
  reagendar,
  remover,
  salvarRegra,
  salvarFeriado,
  removerFeriado,
  gerarSugestao,
};

async function acaoDeGestao(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = tokenDoHeader(req.headers.authorization);
  const erroAuth = await autorizarFaturamento(token, 'canManageCalendarioEnvios');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const corpo = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const acao = typeof corpo.acao === 'string' && Object.hasOwn(ACOES, corpo.acao) ? ACOES[corpo.acao] : undefined;
  if (!acao) {
    res.status(400).json({ success: false, error: 'Ação inválida: use marcar, desmarcar, criar, reagendar, remover, salvarRegra, salvarFeriado, removerFeriado ou gerarSugestao.' });
    return;
  }
  await acao(token as string, corpo, res);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    if (req.method === 'POST') {
      await acaoDeGestao(req, res);
    } else {
      await consultarMes(req, res);
    }
  } catch (err) {
    console.error('[faturamento/calendario-envios] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
