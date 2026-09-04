/**
 * API Route: POST /api/faturamento/titulo-desvincular-lote
 *
 * Remove o vínculo de um lote a um título já criado (issue 46, triagem
 * 04/09): escopo restrito a corrigir um lote incluído por engano — não existe
 * "vincular" (adicionar lote depois), sem caso de uso confirmado na triagem.
 *
 * A gravação roda como o USUÁRIO (getSupabaseUserClient), não como
 * service_role, no mesmo padrão de titulo-atualizar-numero-nota: a RPC
 * revalida canManageBilling no banco via fat_exigir_permissao_gestao.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão, exigindo
 * canManageBilling.
 *
 * Body:
 *   idNota  uuid    obrigatório
 *   idLote  uuid    obrigatório
 *   motivo  string  obrigatório — vazio é rejeitado pela RPC
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { getSupabaseUserClient } from '../supabase.js';

interface CorpoDesvincularLote {
  idNota?: unknown;
  idLote?: unknown;
  motivo?: unknown;
}

function texto(bruto: unknown): string | undefined {
  return typeof bruto === 'string' && bruto.trim() !== '' ? bruto.trim() : undefined;
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

    const corpo = (req.body ?? {}) as CorpoDesvincularLote;
    const idNota = texto(corpo.idNota);
    const idLote = texto(corpo.idLote);
    const motivo = texto(corpo.motivo);

    if (!idNota) {
      res.status(400).json({ success: false, error: 'Informe idNota.' });
      return;
    }
    if (!idLote) {
      res.status(400).json({ success: false, error: 'Informe idLote.' });
      return;
    }
    if (!motivo) {
      res.status(400).json({ success: false, error: 'Informe o motivo da alteração.' });
      return;
    }

    const { error } = await getSupabaseUserClient(token as string).rpc('fat_desvincular_lote', {
      p_id_nota: idNota,
      p_id_lote: idLote,
      p_motivo: motivo,
    });

    if (error) {
      // A RPC recusa título cancelado, título com baixa registrada, último
      // lote e permissão insuficiente com mensagens prontas para a tela.
      console.error('[faturamento/titulo-desvincular-lote] rpc:', error.message);
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[faturamento/titulo-desvincular-lote] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
