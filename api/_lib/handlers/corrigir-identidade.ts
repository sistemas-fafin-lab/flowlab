/**
 * API Route: POST /api/analises-clinicas/corrigir-identidade
 *
 * Vercel Serverless Function — corrige o CPF / a data de nascimento de um
 * paciente que já vinculou conta no LAB-HUB. Lá esses dois campos são imutáveis
 * depois do claim (trigger `trg_pacientes_identidade`); a RPC por trás desta
 * rota é a única saída, e ela exige a autorização de quem conferiu o documento.
 *
 * Proxy: a FLOWLAB_API_KEY é server-side, então o SPA não chama o LAB-HUB direto.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do
 * operador (exige canCorrigirIdentidade) — como buscar-pacientes.ts, aqui
 * `Bearer` NÃO é a FLOWLAB_API_KEY. Não use `isFlowlabApiKeyValid` aqui.
 *
 * `autorizadoPor` NÃO é lido do corpo: sai do perfil da sessão, porque é trilha
 * de auditoria permanente do outro lado.
 *
 * Variáveis de ambiente: ver api/_lib/recepcaoAgendamento.ts
 *   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LABHUB_API_URL, FLOWLAB_API_KEY).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corrigirIdentidadePaciente } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const { status, payload } = await corrigirIdentidadePaciente(token, {
      pacienteId: typeof body.pacienteId === 'string' ? body.pacienteId : undefined,
      cpf: typeof body.cpf === 'string' ? body.cpf : undefined,
      dataNascimento: typeof body.dataNascimento === 'string' ? body.dataNascimento : undefined,
      motivo: typeof body.motivo === 'string' ? body.motivo : undefined,
      documentoConferido:
        typeof body.documentoConferido === 'string' ? body.documentoConferido : undefined,
    });
    // A resposta carrega o CPF anterior mascarado: não cachear.
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/corrigir-identidade] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
