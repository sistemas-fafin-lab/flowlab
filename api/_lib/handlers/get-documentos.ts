/**
 * API Route: GET /api/analises-clinicas/get-documentos?agendamentoId=<uuid>
 *
 * Vercel Serverless Function — devolve ao painel de coletas os documentos que o
 * paciente enviou pelo app do LAB-HUB (identidade, carteirinha, pedido médico), para
 * o operador conferir na recepção. Proxy: a FLOWLAB_API_KEY é server-side, então o
 * SPA não pode chamar o LAB-HUB direto.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canManageColetas) — este é o único arquivo deste diretório em que `Bearer`
 * NÃO é a FLOWLAB_API_KEY. Não use `isFlowlabApiKeyValid` aqui: os vizinhos
 * (deliver-*, receive-*, get-disponibilidade) são canais server-to-server e validam
 * o Bearer contra a chave compartilhada. Fazer isso aqui trocaria a sessão do
 * operador pela chave e deixaria qualquer portador dela ler documentos de qualquer
 * paciente.
 *
 * Variáveis de ambiente: ver api/_lib/documentosCheckin.ts
 *   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LABHUB_API_URL, FLOWLAB_API_KEY).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listarDocumentosCheckin } from '../documentosCheckin.js';
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

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const { agendamentoId } = req.query;

  try {
    const { status, payload } = await listarDocumentosCheckin(
      token,
      typeof agendamentoId === 'string' ? agendamentoId : undefined,
    );
    // A resposta carrega signed URLs de documento de identidade: não deixe ficar em
    // cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/get-documentos] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
