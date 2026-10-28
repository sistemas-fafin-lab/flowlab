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
 * os dias", a lista lateral). Cada agendamento vem com `status` e `foraDaJanela` de
 * classificarAgendamento; as telas não recalculam.
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
 * Quem e quando, e o histórico, são gravados por trigger (20261028160000).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  classificarAgendamento,
  fimDoMes,
  proximoDiaUtil,
  regrasDeQualquerDia,
  type ClassificacaoAgendamento,
} from '../faturamento/calendarioEnvios.js';
import {
  criarAvulso,
  desmarcarEnviado,
  lerCalendario,
  lerFeriados,
  lerHistorico,
  lerRegras,
  lerVencidos,
  marcarEnviado,
  reagendar as reagendarAgendamento,
  removerAgendamento,
} from '../faturamento/dadosCalendarioEnvios.js';
import type { AgendamentoEnvio, FalhaCalendario, RegraEnvio } from '../faturamento/dadosCalendarioEnvios.js';
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
  const [calendario, vencidos] = await Promise.all([
    lerCalendario(token as string, { inicio: `${mes}-01`, fim: fimDoMes(`${mes}-01`), dias: [hoje, amanha] }),
    lerVencidos(token as string, hoje),
  ]);
  if ('erro' in calendario) {
    responderFalha(res, calendario);
    return;
  }
  if ('erro' in vencidos) {
    responderFalha(res, vencidos);
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
  });
}

/** Responde o agendamento gravado, ou a falha. */
function responderAgendamento(res: VercelResponse, resultado: AgendamentoEnvio | FalhaCalendario): void {
  if ('erro' in resultado) {
    responderFalha(res, resultado);
    return;
  }
  res.status(200).json({ success: true, agendamento: resultado });
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
  responderAgendamento(res, await marcarEnviado(token, corpo.id, corpo.dataEnvio));
}

/** POST desmarcar: volta a pendente; a marcação fica no histórico. */
async function desmarcar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  responderAgendamento(res, await desmarcarEnviado(token, corpo.id));
}

/** POST criar: agendamento avulso da regra no dia. */
async function criar(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.regraId) || !dataValida(corpo.dataPrevista)) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos: regraId e dataPrevista (YYYY-MM-DD).' });
    return;
  }
  responderAgendamento(res, await criarAvulso(token, corpo.regraId, corpo.dataPrevista));
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
  responderAgendamento(res, await reagendarAgendamento(token, corpo.id, corpo.dataPrevista));
}

/** POST remover: apaga o agendamento; o histórico fica. */
async function remover(token: string, corpo: Record<string, unknown>, res: VercelResponse): Promise<void> {
  if (!idValido(corpo.id)) {
    res.status(400).json({ success: false, error: 'Parâmetro inválido: id.' });
    return;
  }
  responderAgendamento(res, await removerAgendamento(token, corpo.id));
}

const ACOES: Record<string, (token: string, corpo: Record<string, unknown>, res: VercelResponse) => Promise<void>> = {
  marcar,
  desmarcar,
  criar,
  reagendar,
  remover,
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
    res.status(400).json({ success: false, error: 'Ação inválida: use marcar, desmarcar, criar, reagendar ou remover.' });
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
