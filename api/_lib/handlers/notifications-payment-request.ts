/**
 * API Route: POST /api/notifications/payment-request
 *
 * Avisos do fluxo de autorização dos pedidos de pagamento, por e-mail e no sininho
 * (user_notifications). Disparado pelo SPA (src/modules/pagamentos/hooks/usePaymentRequest.ts)
 * em melhor esforço, logo depois de:
 *   - criado   → o pedido foi criado: avisa o autorizador (ou, se quem pediu é o próprio
 *                autorizador, o Financeiro);
 *   - decidido → o autorizador decidiu: avisa o solicitante e, se autorizou, o Financeiro.
 *
 * O cliente só manda `{ id, evento }`. Destinatários e conteúdo ficam no servidor, que
 * confere quem chama e se o pedido está no estado que o evento diz, logo depois da ação
 * (api/_lib/paymentRequestEmail.ts): a rota não serve para mandar e-mail arbitrário.
 *
 * Autorização: `Authorization: Bearer <access_token>` da SESSÃO do usuário.
 *
 * Variáveis de ambiente: APP_URL (base do link, ver api/_lib/appUrl.ts) e as SMTP_* e
 * SUPABASE_* de api/_lib/email.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTemplatedEmail } from '../email.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { describeError } from '../errors.js';
import { APP_BASE_URL } from '../appUrl.js';
import {
  caminhoDoPedido,
  EVENTOS,
  planejarEnvios,
  variaveisDoPedido,
  type Destinatario,
  type EventoPagamento,
  type PedidoPagamentoRow,
} from '../paymentRequestEmail.js';

interface Pessoa {
  id: string | null;
  email: string;
}

type Supabase = ReturnType<typeof getSupabaseAdminClient>;

const COLUNAS =
  'id, codigo, codigo_compacto, fornecedor, valor_total, tipo_solicitacao, forma_pagamento, data_pagamento, department, solicitado_por, solicitante_id, email_usuario, autorizado_por, autorizado_por_id, descricao_detalhada, status, rejection_reason, rejeitado_por, created_at, updated_at, autorizado_em';

async function pessoasAtivas(supabase: Supabase, ids: string[]): Promise<Pessoa[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email')
    .in('id', ids)
    .is('deleted_at', null)
    .is('disabled_at', null);
  if (error) throw error;
  return (data ?? []).filter((p) => !!p.email).map((p) => ({ id: p.id as string, email: p.email as string }));
}

/** Quem aprova pagamentos: cargos com canApprovePayments, pessoas ativas. */
async function financeiro(supabase: Supabase): Promise<Pessoa[]> {
  const { data: cargos, error } = await supabase
    .from('custom_roles')
    .select('id')
    .contains('permissions', ['canApprovePayments']);
  if (error) throw error;
  const idsCargos = (cargos ?? []).map((c) => c.id as string);
  if (idsCargos.length === 0) return [];
  const { data, error: erroPessoas } = await supabase
    .from('user_profiles')
    .select('id, email')
    .in('custom_role_id', idsCargos)
    .is('deleted_at', null)
    .is('disabled_at', null);
  if (erroPessoas) throw erroPessoas;
  return (data ?? []).filter((p) => !!p.email).map((p) => ({ id: p.id as string, email: p.email as string }));
}

async function destinatarios(supabase: Supabase, para: Destinatario, pedido: PedidoPagamentoRow): Promise<Pessoa[]> {
  if (para === 'autorizador') return pessoasAtivas(supabase, pedido.autorizado_por_id ? [pedido.autorizado_por_id] : []);
  if (para === 'financeiro') return financeiro(supabase);
  // Solicitante: o perfil dele; em pedido sem solicitante_id, o e-mail gravado na criação.
  const perfil = await pessoasAtivas(supabase, pedido.solicitante_id ? [pedido.solicitante_id] : []);
  if (perfil.length > 0) return perfil;
  return pedido.email_usuario ? [{ id: null, email: pedido.email_usuario }] : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ success: false, error: 'Token de autenticação ausente.' });
    return;
  }

  const { id, evento } = (req.body ?? {}) as { id?: unknown; evento?: unknown };
  if (typeof id !== 'string' || !id || typeof evento !== 'string' || !EVENTOS.includes(evento as EventoPagamento)) {
    res.status(400).json({ success: false, error: 'Campos obrigatórios: id e evento (criado ou decidido).' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: caller, error: callerErr } = await supabase.auth.getUser(token);
    if (callerErr || !caller?.user) {
      res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      return;
    }

    const { data: linha, error: pedidoErr } = await supabase.from('payment_requests').select(COLUNAS).eq('id', id).maybeSingle();
    if (pedidoErr) throw pedidoErr;
    if (!linha) {
      res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
      return;
    }
    const pedido = linha as unknown as PedidoPagamentoRow;

    const plano = planejarEnvios(pedido, evento as EventoPagamento, caller.user.id, new Date());
    if (plano.erro) {
      res.status(plano.status ?? 400).json({ success: false, error: plano.erro });
      return;
    }

    let enviados = 0;
    let falhas = 0;
    const avisos: Record<string, unknown>[] = [];

    for (const envio of plano.envios) {
      const caminho = caminhoDoPedido(pedido.id, envio.aba);
      const variables = variaveisDoPedido(pedido, `${APP_BASE_URL}${caminho}`);
      // O mesmo e-mail uma vez só por envio (alguém com dois perfis, por exemplo).
      const pessoas = [...new Map((await destinatarios(supabase, envio.para, pedido)).map((p) => [p.email.toLowerCase(), p])).values()];
      if (pessoas.length === 0) {
        console.warn(`[notifications/payment-request] ninguém para avisar (${envio.para}) no pedido ${pedido.id}`);
      }

      const resultados = await Promise.all(
        pessoas.map((p) => sendTemplatedEmail({ to: p.email, templateSlug: envio.modelo, variables })),
      );
      for (const r of resultados) {
        if (r.success) enviados += 1;
        else {
          falhas += 1;
          console.error('[notifications/payment-request] falha no envio:', envio.modelo, r.error);
        }
      }

      for (const p of pessoas) {
        if (!p.id) continue;
        avisos.push({
          user_id: p.id,
          title: envio.titulo,
          content: envio.conteudo,
          module: 'PAYMENTS',
          type: envio.tipo,
          link: caminho,
        });
      }
    }

    if (avisos.length > 0) {
      const { error: avisoErr } = await supabase.from('user_notifications').insert(avisos);
      if (avisoErr) console.error('[notifications/payment-request] falha no sininho:', describeError(avisoErr));
    }

    if (falhas > 0) {
      res.status(500).json({ success: false, error: 'Falha ao enviar parte dos e-mails.', sent: enviados, failed: falhas });
      return;
    }
    res.status(200).json({ success: true, sent: enviados });
  } catch (err) {
    console.error('[notifications/payment-request] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno.' });
  }
}
