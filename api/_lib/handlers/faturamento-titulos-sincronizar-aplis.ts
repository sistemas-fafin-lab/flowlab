/**
 * API Route: POST /api/faturamento/titulos-sincronizar-aplis
 *
 * Chamada ao abrir o "Atualizar do apLIS" do Contas a Receber: roda a mesma sincronização
 * dos títulos com o apLIS que a rotina diária e o "Atualizar" de Glosas e
 * Recursos rodam (faturamento/sincronizarTitulosAplis.ts) — status, envio,
 * protocolo, NF-e, RPS e responsável dos lotes, número da nota dos títulos sem
 * número e refechamento — e devolve o resumo do que mudou.
 *
 * Fonte do apLIS: MySQL de backup, ~1 dia de atraso; `meta.dadoAte` diz até
 * quando. Falha na réplica → erro, sem gravar nada.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave
 * da tela Contas a Receber). Como a foto de glosas, é espelho do apLIS e não
 * edição do operador, então quem consulta pode atualizar; grava com service_role.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { sincronizarTitulosAplis } from '../faturamento/sincronizarTitulosAplis.js';
import { getSupabaseAdminClient } from '../supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['contasReceber']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const r = await sincronizarTitulosAplis(getSupabaseAdminClient());
    if ('erro' in r) {
      res.status(r.erro.status).json({
        success: false,
        error: 'Não foi possível consultar os lotes no apLIS agora — tente novamente em alguns minutos. '
          + `(${r.erro.mensagem})`,
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { dadoAte: r.dadoAte },
      lotes: r.lotes,
      lotesAtualizados: r.lotesAtualizados,
      statusMudaram: r.statusMudaram,
      numerosPreenchidos: r.numerosPreenchidos,
      refechamentos: r.refechamentos,
    });
  } catch (err) {
    console.error('[faturamento/titulos-sincronizar-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
