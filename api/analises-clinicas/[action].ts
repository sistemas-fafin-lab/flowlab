/**
 * API Route: /api/analises-clinicas/[action]
 *
 * Dispatcher (dynamic route) — colapsa as rotas de analises-clinicas numa única
 * Serverless Function, para caber no limite do plano Vercel (12 functions no Hobby).
 * O segmento `[action]` do path vira `req.query.action` e seleciona o handler; as
 * URLs públicas continuam idênticas (ex.: /api/analises-clinicas/buscar-pacientes),
 * então nada muda para o SPA nem para os webhooks do LAB-HUB.
 *
 * upload-documento NÃO entra aqui: precisa de `bodyParser: false` (corpo cru), então
 * segue como arquivo estático próprio — no Vercel a rota estática vence a dinâmica.
 *
 * Cada handler vive em api/_lib/handlers/ — o prefixo `_` faz o Vercel NÃO contá-los
 * como functions. Autorização, parsing e validação seguem dentro de cada handler.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import apoioProcessImage from '../_lib/handlers/apoio-process-image.js';
import apoioRebuildXml from '../_lib/handlers/apoio-rebuild-xml.js';
import apoioTransferir from '../_lib/handlers/apoio-transferir.js';
import buscarPacientes from '../_lib/handlers/buscar-pacientes.js';
import criarAgendamentoLabhub from '../_lib/handlers/criar-agendamento-labhub.js';
import deliverColeta from '../_lib/handlers/deliver-coleta.js';
import deliverResultado from '../_lib/handlers/deliver-resultado.js';
import disponibilidadeOperador from '../_lib/handlers/disponibilidade-operador.js';
import getDisponibilidade from '../_lib/handlers/get-disponibilidade.js';
import getDocumentos from '../_lib/handlers/get-documentos.js';
import receiveAgendamento from '../_lib/handlers/receive-agendamento.js';
import receiveCancelamento from '../_lib/handlers/receive-cancelamento.js';

// apoio-process-image chama Gemini (OCR) + apLIS e passa fácil dos 10s padrão;
// o teto vale para a function inteira, sem efeito nas actions rápidas.
export const config = { maxDuration: 60 };

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Chave = segmento do path (= nome do antigo arquivo de rota, mantido idêntico).
const ROTAS: Record<string, Handler> = {
  'apoio-process-image': apoioProcessImage,
  'apoio-rebuild-xml': apoioRebuildXml,
  'apoio-transferir': apoioTransferir,
  'buscar-pacientes': buscarPacientes,
  'criar-agendamento-labhub': criarAgendamentoLabhub,
  'deliver-coleta': deliverColeta,
  'deliver-resultado': deliverResultado,
  'disponibilidade-operador': disponibilidadeOperador,
  'get-disponibilidade': getDisponibilidade,
  'get-documentos': getDocumentos,
  'receive-agendamento': receiveAgendamento,
  'receive-cancelamento': receiveCancelamento,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const rota = action ? ROTAS[action] : undefined;

  if (!rota) {
    res.status(404).json({ success: false, error: 'Rota não encontrada.' });
    return;
  }

  await rota(req, res);
}
