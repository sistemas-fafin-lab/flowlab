// API Route: POST /api/ti/agente-teste — "Enviar teste" da aba Membros (RF19, issue 12).
// Body: { membro_id }. Só gestor (canApproveAgenteTI). Põe uma mensagem `teste` na fila;
// a tela acompanha o status até "enviada" ou "falhou".
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { enfileirarTeste } from '../ti-agente/cobranca.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canApproveAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  const membroId = (req.body as { membro_id?: unknown } | undefined)?.membro_id;
  if (typeof membroId !== 'string' || !membroId) {
    res.status(400).json({ success: false, error: 'Informe o membro.' });
    return;
  }
  try {
    const r = await enfileirarTeste(getSupabaseAdminClient(), auth, membroId);
    if ('erro' in r) {
      res.status(r.status).json({ success: false, error: r.erro });
      return;
    }
    res.status(200).json({ success: true, mensagemId: r.id });
  } catch (e) {
    console.error('[ti/agente-teste]', e);
    res.status(500).json({ success: false, error: 'Não consegui pôr o teste na fila. Tente de novo.' });
  }
}
