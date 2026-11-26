// API Route: POST /api/ti/agente-midia — a VPS avisa que subiu o áudio ou a imagem de uma mensagem
// recebida pelo WhatsApp (D43, issue 32). Corpo: { "id": "<ti_agente_mensagens.id>" }.
// Segurança: Authorization: Bearer <CRON_SECRET> (o mesmo dos crons; fica no env da VPS).
// Responde 202 na hora e trata em segundo plano (waitUntil): a transcrição leva alguns segundos,
// e a VPS não pode ficar parada esperando, porque é ela que envia as respostas.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdminClient } from '../supabase.js';
import { cronAutorizado } from '../ti-agente/autorizacao.js';
import { processarMidia } from '../ti-agente/midia.js';
import { dependenciasIA } from '../ti-agente/servicos.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  if (!cronAutorizado(req)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }
  const id = (req.body as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    res.status(400).json({ success: false, error: 'Informe o id da mensagem.' });
    return;
  }

  const db = getSupabaseAdminClient();
  const trabalho = processarMidia(db, dependenciasIA(db), id).catch((e) => {
    console.error('[ti/agente-midia]', e);
  });
  try {
    waitUntil(trabalho);
  } catch (e) {
    // Fora da Vercel (dev, Docker), o processo segue vivo e o tratamento termina sozinho.
    console.error('[ti/agente-midia] waitUntil indisponível:', e);
  }
  res.status(202).json({ success: true, aceita: id });
}
