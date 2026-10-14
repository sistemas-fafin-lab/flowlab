// API Route: POST /api/ti/waha-webhook?token=<WAHA_WEBHOOK_SECRET> — eventos do WAHA (issue 15).
// Configurar na sessão `eva` com os eventos `message` e `message.ack` (issue 13).
// - message.ack: acende Entregue/Lida na mensagem de saída (RF26), sem voltar para trás.
// - message: só de membro ativo (RN13). Grava a recebida (idempotente por waha_message_id),
//   responde 200 e trata em segundo plano (waitUntil) pelo roteador de comandos (D29):
//   atualização de card (comentário, sugestão e confirmação, D12), pergunta ou pedido de gestor
//   com SIM. Número desconhecido fica registrado como `ignorada`, sem resposta.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { getSupabaseAdminClient } from '../supabase.js';
import { idCurtoWaha, statusPeloAck } from '../../../src/modules/eva/domain/whatsapp.js';
import { acharMembro, lerEvento, tokenValido, type MembroWebhook } from '../ti-agente/webhook.js';
import { processarRecebida } from '../ti-agente/comandos.js';
import { dependenciasIA } from '../ti-agente/servicos.js';

const DUPLICADA = '23505';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const segredo = process.env.WAHA_WEBHOOK_SECRET;
  if (!segredo) {
    res.status(503).json({ success: false, error: 'Webhook da EVA não configurado (WAHA_WEBHOOK_SECRET).' });
    return;
  }
  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  if (!tokenValido(token, segredo)) {
    res.status(401).json({ success: false, error: 'Não autorizado.' });
    return;
  }

  const evento = lerEvento(req.body, process.env.WAHA_SESSION || 'eva');
  if (evento.tipo === 'ignorar') {
    res.status(200).json({ success: true, ignorado: evento.motivo });
    return;
  }

  const db = getSupabaseAdminClient();
  try {
    if (evento.tipo === 'ack') {
      // O id do ack é o mesmo do envio; o curto cobre engines que serializam diferente.
      const consulta = () => db.from('ti_agente_mensagens').select('id, status').eq('direcao', 'saida');
      const buscar = (filtro: (q: ReturnType<typeof consulta>) => ReturnType<typeof consulta>) => filtro(consulta()).limit(1).maybeSingle();
      let { data } = await buscar((q) => q.eq('waha_message_id', evento.id));
      if (!data) ({ data } = await buscar((q) => q.like('waha_message_id', `%${idCurtoWaha(evento.id)}`)));
      const novo = data ? statusPeloAck(evento.ack, data.status as string) : null;
      if (data && novo) await db.from('ti_agente_mensagens').update({ status: novo }).eq('id', data.id).eq('status', data.status);
      res.status(200).json({ success: true, ack: novo ?? 'sem mudança' });
      return;
    }

    const { data: membros, error: eM } = await db.from('ti_agente_membros').select('id, user_id, whatsapp, whatsapp_chat_id, ativo');
    if (eM) throw new Error(eM.message);
    const membro = acharMembro(evento.remetentes, (membros ?? []) as MembroWebhook[]);
    const texto = evento.texto || (evento.temMidia ? '(mídia sem texto)' : '(mensagem vazia)');

    const { data: gravada, error } = await db
      .from('ti_agente_mensagens')
      .insert({
        membro_id: membro?.id ?? null,
        direcao: 'entrada',
        tipo: 'recebida',
        status: membro ? 'recebida' : 'ignorada',
        texto: texto.slice(0, 4000),
        waha_message_id: evento.id,
        erro: membro ? null : 'Número fora da lista de membros (RN13).',
      })
      .select('id')
      .single();
    if (error?.code === DUPLICADA) {
      // O WAHA reenviou a mesma mensagem: já foi tratada.
      res.status(200).json({ success: true, repetida: true });
      return;
    }
    if (error) throw new Error(error.message);
    if (!membro) {
      res.status(200).json({ success: true, ignorado: 'número desconhecido' });
      return;
    }

    const trabalho = processarRecebida(db, dependenciasIA(db), gravada.id as string).catch((e) => {
      console.error('[ti/waha-webhook] Interpretação falhou:', e);
    });
    try {
      waitUntil(trabalho);
    } catch (e) {
      // Fora da Vercel (dev, Docker), o processo segue vivo e a interpretação termina sozinha.
      console.error('[ti/waha-webhook] waitUntil indisponível:', e);
    }
    res.status(200).json({ success: true, recebida: gravada.id });
  } catch (e) {
    console.error('[ti/waha-webhook]', e);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
