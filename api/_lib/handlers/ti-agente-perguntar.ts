// API Route: POST /api/ti/agente-perguntar — chat com a EVA (issue 16).
// Body: { pergunta, visao: 'team' | 'me', historico: [{ de: 'eva' | 'eu', texto }] }
// Exige canManageIT, ou um dos papéis da EVA (aprovar ou gestor). A fila do WhatsApp só entra no
// contexto do gestor (D24, D31), e só ele recebe avisos para confirmar (D32). Limite de 30
// perguntas por pessoa por dia (RN17).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizar, ehFalha, tem, tokenDoHeader } from '../ti-agente/autorizacao.js';
import { lerContexto } from '../ti-agente/dados.js';
import { gerarEstruturado } from '../ti-agente/ia/gerarEstruturado.js';
import { dependenciasIA } from '../ti-agente/servicos.js';
import {
  INSTRUCOES_CHAT, LIMITE_DIARIO, MAX_FILA, MAX_PERGUNTA, SchemaChat, montarContextoChat, montarConteudoChat, recortarParaVisao,
  validarRespostaChat, type MensagemFila, type MensagemHistorico,
} from '../ti-agente/chat.js';

/** Meia-noite de hoje em Brasília (UTC−3), como instante ISO. */
function inicioDoDiaSP(agora = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return new Date(`${dia}T03:00:00Z`).toISOString();
}

const horaSP = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Últimas mensagens da fila; com `soDe`, só as trocadas com essa pessoa (Minha visão). */
async function lerFila(db: SupabaseClient, soDe: string | null): Promise<MensagemFila[]> {
  const { data, error } = await db
    .from('ti_agente_mensagens')
    .select('direcao, status, texto, created_at, chat_id_destino, membro:ti_agente_membros(user_id, perfil:user_profiles!ti_agente_membros_user_id_fkey(name))')
    .neq('tipo', 'teste')
    .order('created_at', { ascending: false })
    .limit(soDe ? 50 : MAX_FILA);
  if (error) throw new Error(error.message);
  type Membro = { user_id: string; perfil: { name: string } | null } | null;
  return (data ?? [])
    .filter((m) => !soDe || (m.membro as unknown as Membro)?.user_id === soDe)
    .slice(0, MAX_FILA)
    .map((m) => ({
      quando: horaSP(m.created_at as string),
      para: m.chat_id_destino ? 'o grupo da equipe' : (m.membro as unknown as Membro)?.perfil?.name ?? 'número desconhecido',
      direcao: m.direcao as MensagemFila['direcao'],
      status: m.status as string,
      texto: m.texto as string,
    }));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Use POST.' });
    return;
  }
  const auth = await autorizar(tokenDoHeader(req.headers.authorization), ['canManageIT', 'canApproveAgenteTI', 'canManageAgenteTI']);
  if (ehFalha(auth)) {
    res.status(auth.status).json(auth.payload);
    return;
  }

  const corpo = (req.body ?? {}) as { pergunta?: string; visao?: string; historico?: MensagemHistorico[] };
  const pergunta = (corpo.pergunta ?? '').trim();
  if (!pergunta) {
    res.status(400).json({ success: false, error: 'Escreva uma pergunta.' });
    return;
  }
  if (pergunta.length > MAX_PERGUNTA) {
    res.status(413).json({ success: false, error: `A pergunta passa de ${MAX_PERGUNTA} caracteres.` });
    return;
  }
  const visao = corpo.visao === 'me' ? 'me' : 'team';
  const historico = (Array.isArray(corpo.historico) ? corpo.historico : [])
    .filter((m) => m && (m.de === 'eva' || m.de === 'eu') && typeof m.texto === 'string');

  const db = getSupabaseAdminClient();
  try {
    // Uma pergunta = uma tentativa do Claude (o Gemini só entra depois dela).
    const { count } = await db
      .from('ti_agente_chamadas_ia')
      .select('id', { count: 'exact', head: true })
      .eq('finalidade', 'chat')
      .eq('provedor', 'claude')
      .eq('user_id', auth.userId)
      .gte('created_at', inicioDoDiaSP());
    if ((count ?? 0) >= LIMITE_DIARIO) {
      res.status(429).json({ success: false, error: 'Você chegou ao limite de perguntas de hoje. O chat volta amanhã.' });
      return;
    }

    const ehGestor = tem(auth, 'canManageAgenteTI');
    const [ctxCompleto, { data: reuniao }, fila] = await Promise.all([
      lerContexto(db),
      db.from('ti_agente_reunioes')
        .select('titulo, realizada_em, observacoes, resumo_markdown')
        .eq('status', 'analisada')
        .order('analisada_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // D24: a fila do WhatsApp só entra no contexto de gestor.
      ehGestor ? lerFila(db, visao === 'me' ? auth.userId : null) : Promise.resolve(null),
    ]);
    const ctx = recortarParaVisao(ctxCompleto, visao, auth.userId);
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

    const r = await gerarEstruturado(
      {
        finalidade: 'chat',
        instrucoes: INSTRUCOES_CHAT,
        contexto: montarContextoChat(
          ctx,
          reuniao ? { titulo: reuniao.titulo, realizadaEm: reuniao.realizada_em, observacoes: reuniao.observacoes, resumo: reuniao.resumo_markdown } : null,
          hoje,
          fila,
          ehGestor,
        ),
        conteudo: montarConteudoChat(pergunta, historico),
        schema: SchemaChat,
        esforco: 'low',
        userId: auth.userId,
      },
      dependenciasIA(db),
    );
    if ('erros' in r) {
      res.status(502).json({ success: false, error: 'Não consegui consultar o board agora. Tente novamente em alguns segundos.', erros: r.erros });
      return;
    }
    const resposta = validarRespostaChat(r.dados, ctx, { hoje, temReuniao: !!reuniao });
    // D32: aviso pelo WhatsApp só para o gestor; a rota agente-avisar confere de novo no envio.
    res.status(200).json({ success: true, provedor: r.provedor, ...resposta, avisos: ehGestor ? resposta.avisos : [] });
  } catch (e) {
    console.error('[ti/agente-perguntar]', e);
    res.status(500).json({ success: false, error: 'Não consegui consultar o board agora. Tente novamente em alguns segundos.' });
  }
}
