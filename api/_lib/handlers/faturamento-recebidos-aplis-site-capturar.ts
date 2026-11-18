/**
 * API Route: POST /api/faturamento/recebidos-aplis-site-capturar
 *
 * Botão "Buscar no apLIS agora" da conferência e do "Atualizar → Baixas"
 * (.scratch/faturamento-recebidos-aplis-site/spec.md): lê no site do apLIS o
 * recebido dos lotes com saldo em aberto e grava o retrato — a mesma função da
 * rotina (faturamento-recebidos-aplis-site-cron). Leva de 1 a 3 minutos; o que
 * não couber em 270 s fica para a próxima (`pendentes`).
 *
 * Autorização: `Authorization: Bearer <access_token>` (canManageBilling). O retrato é
 * espelho do apLIS; grava com service_role.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { capturarRecebidosSite } from '../faturamento/recebidosAplisSite.js';
import { getSupabaseAdminClient } from '../supabase.js';

const ORCAMENTO_MS = 270_000;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, 'canManageBilling');
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }
    const admin = getSupabaseAdminClient();
    const { data: usuario } = await admin.auth.getUser(token as string);

    const resumo = await capturarRecebidosSite(admin, {
      origem: 'botao',
      usuarioId: usuario?.user?.id ?? null,
      orcamentoMs: ORCAMENTO_MS,
    });
    if (resumo.erro && resumo.lidos === 0) {
      console.error('[faturamento/recebidos-aplis-site-capturar]', resumo.erro);
      res.status(502).json({
        success: false,
        error: `Não foi possível ler o site do apLIS agora — a tela segue com o banco de backup. (${resumo.erro})`,
      });
      return;
    }
    res.status(200).json({ success: true, ...resumo });
  } catch (err) {
    console.error('[faturamento/recebidos-aplis-site-capturar] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
