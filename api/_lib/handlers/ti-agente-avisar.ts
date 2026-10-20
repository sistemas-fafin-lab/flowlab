// API Route: POST /api/ti/agente-avisar — aviso de gestor para uma pessoa pelo WhatsApp (issue 21, D32).
// Body: { user_id, texto }. O cartão "Enviar pelo WhatsApp" do chat do Início chama esta rota,
// depois que o gestor confere o texto. Só gestor da EVA (canManageAgenteTI). A mensagem vai para
// a fila (D9); fora do horário da EVA, agendada (`agendadaPara`). Para quem não tem WhatsApp, vai
// para o grupo da equipe, citando a pessoa (D35): `noGrupo`.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { MAX_AVISO_PESSOAL, enviarAvisoPessoal } from '../ti-agente/aviso.js';
import { lerNomes } from '../ti-agente/dados.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }
  const corpo = (req.body ?? {}) as { user_id?: unknown; texto?: unknown };
  const destino = typeof corpo.user_id === 'string' ? corpo.user_id.trim() : '';
  const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
  if (!destino || !texto) {
    res.status(400).json({ success: false, error: 'Informe a pessoa e o aviso.' });
    return;
  }
  if (texto.length > MAX_AVISO_PESSOAL) {
    res.status(413).json({ success: false, error: `O aviso passa de ${MAX_AVISO_PESSOAL} caracteres.` });
    return;
  }
  try {
    const db = getSupabaseAdminClient();
    const nomes = await lerNomes(db, [auth.userId]);
    const r = await enviarAvisoPessoal(db, auth, destino, { de: nomes[auth.userId] ?? '', aviso: texto });
    if ('erro' in r) {
      res.status(r.status).json({ success: false, error: r.erro });
      return;
    }
    res.status(200).json({ success: true, mensagemId: r.id, para: r.para, noGrupo: r.noGrupo, grupoNome: r.grupoNome, agendadaPara: r.agendadaPara });
  } catch (e) {
    console.error('[ti/agente-avisar]', e);
    res.status(500).json({ success: false, error: 'Não consegui pôr o aviso na fila. Tente de novo.' });
  }
}
