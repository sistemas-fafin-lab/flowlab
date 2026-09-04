/**
 * API Route: POST /api/faturamento/titulo-atualizar-numero-nota
 *
 * Preenche ou corrige o número da nota de um título já existente (issue 33,
 * follow-up da issue 32: com nf_apos_pagamento, o título nasce sem número e
 * precisa ser completado depois; digitar errado também precisa de correção).
 *
 * Passa por rota serverless — e não supabase.rpc() direto do cliente, como
 * fat_registrar_baixa — para seguir o padrão dos demais handlers do módulo;
 * a RPC em si não depende de nada que o navegador não alcance.
 *
 * A gravação roda como o USUÁRIO (getSupabaseUserClient), não como
 * service_role: a RPC revalida canManageBilling no banco via
 * fat_exigir_permissao_gestao, e com o cliente admin essa revalidação nunca
 * veria a sessão de quem chamou.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão, exigindo
 * canManageBilling.
 *
 * Body:
 *   idNota      uuid    obrigatório
 *   numeroNota  string  obrigatório — vazio é rejeitado pela RPC
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { texto } from '../faturamento/texto.js';
import { getSupabaseUserClient } from '../supabase.js';

interface CorpoAtualizarNumeroNota {
  idNota?: unknown;
  numeroNota?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const corpo = (req.body ?? {}) as CorpoAtualizarNumeroNota;
    const idNota = texto(corpo.idNota);
    const numeroNota = texto(corpo.numeroNota);

    if (!idNota) {
      res.status(400).json({ success: false, error: 'Informe idNota.' });
      return;
    }
    if (!numeroNota) {
      res.status(400).json({ success: false, error: 'Informe o número da nota.' });
      return;
    }

    const { error } = await getSupabaseUserClient(token as string).rpc('fat_atualizar_numero_nota', {
      p_id_nota: idNota,
      p_numero_nota: numeroNota,
    });

    if (error) {
      // A RPC recusa título cancelado, valor vazio e permissão insuficiente com
      // mensagens prontas para a tela; repassar como 400 evita virar 500.
      console.error('[faturamento/titulo-atualizar-numero-nota] rpc:', error.message);
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[faturamento/titulo-atualizar-numero-nota] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
