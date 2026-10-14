// API Route: POST /api/ti/agente-teste — "Enviar teste" (RF19, issues 12 e 18).
// Body: { membro_id } (aba Membros) ou { grupo: true } (Configurações → Grupo da equipe).
// Só gestor (canApproveAgenteTI). Põe uma mensagem `teste` na fila; a tela acompanha o status
// até "enviada" ou "falhou".
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { enfileirarTeste } from '../ti-agente/cobranca.js';
import { enfileirarTesteGrupo } from '../ti-agente/grupo.js';

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
  const corpo = (req.body ?? {}) as { membro_id?: unknown; grupo?: unknown };
  const paraGrupo = corpo.grupo === true;
  const membroId = corpo.membro_id;
  if (!paraGrupo && (typeof membroId !== 'string' || !membroId)) {
    res.status(400).json({ success: false, error: 'Informe o membro.' });
    return;
  }
  try {
    const db = getSupabaseAdminClient();
    const r = paraGrupo ? await enfileirarTesteGrupo(db, auth) : await enfileirarTeste(db, auth, membroId as string);
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
