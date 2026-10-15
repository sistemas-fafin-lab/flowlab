// API Route: POST /api/ti/agente-cobrar — botão Cobrar/Lembrar das atrasadas (D22, RN16).
// Body: { card_id }. Lembrar = o próprio card, com canManageIT; Cobrar = card de outra
// pessoa, só o gestor da EVA (canManageAgenteTI, D31). 403 sem permissão, 409 dentro da janela de 4 h, 422 sem
// WhatsApp (ou WhatsApp desligado, ou card em dia). A mensagem vai para a fila (D9).
// Fora do horário de cobrança (dia útil, 7h às 20h), ela vai agendada: `agendadaPara`.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { cobrarCard } from '../ti-agente/cobranca.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageIT', 'canManageAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  const cardId = (req.body as { card_id?: unknown } | undefined)?.card_id;
  if (typeof cardId !== 'string' || !cardId) {
    res.status(400).json({ success: false, error: 'Informe o card.' });
    return;
  }
  try {
    const r = await cobrarCard(getSupabaseAdminClient(), auth, cardId);
    if ('erro' in r) {
      res.status(r.status).json({ success: false, error: r.erro });
      return;
    }
    res.status(200).json({ success: true, modo: r.modo, destinatarios: r.destinatarios, agendadaPara: r.agendadaPara });
  } catch (e) {
    console.error('[ti/agente-cobrar]', e);
    res.status(500).json({ success: false, error: 'Não consegui pôr a cobrança na fila. Tente de novo.' });
  }
}
