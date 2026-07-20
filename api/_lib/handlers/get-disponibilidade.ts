/**
 * API Route: GET /api/analises-clinicas/get-disponibilidade
 *
 * Vercel Serverless Function — devolve postos ativos e seus horários futuros
 * disponíveis (direção LAB-HUB → FlowLab, D3). O SchedulePage do LAB-HUB consome
 * essa lista via proxy GET /api/v1/postos/disponibilidade.
 *
 * A agenda é GERADA a partir da GRADE configurada em cada posto:
 *   • agenda_hora_inicio / agenda_hora_fim / agenda_intervalo_min — a janela e o
 *     passo (ex.: 08:00–11:00 a cada 15 min) que gera os horários do dia;
 *   • agenda_dias_semana — em quais dias (0=dom … 6=sáb) o posto opera;
 *   • ac_dias_excecao   — datas bloqueadas (feriados): não geram agenda.
 * Para os próximos N dias, aplicamos a grade/bloqueios e descontamos os agendamentos
 * já feitos (ocupação derivada de ac_agendamentos; cancelar libera o horário).
 * Cada horário atende 1 paciente.
 *
 * Autorização: header `Authorization: Bearer <FLOWLAB_API_KEY>` (server-to-server).
 *
 * Formato de retorno (espelha PostoDisponivel de @lab-hub/shared):
 *   [{ id, nome, endereco, slots: string[] /* ISO 8601 *\/ }]
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLOWLAB_API_KEY.
 *   DISPONIBILIDADE_DIAS (default 60) — janela de dias gerada.
 *   AGENDA_TZ_OFFSET (default '-03:00') — fuso em que "08:00" é interpretado
 *   (Brasília; o servidor roda em UTC). Brasil não usa horário de verão desde 2019.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { computarDisponibilidade } from '../disponibilidade.js';
import { isFlowlabApiKeyValid } from '../labhubIntegration.js';
import { describeError } from '../errors.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  if (!isFlowlabApiKeyValid(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }

  try {
    const resposta = await computarDisponibilidade();
    res.status(200).json(resposta);
  } catch (err) {
    console.error('[analises-clinicas/get-disponibilidade] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
