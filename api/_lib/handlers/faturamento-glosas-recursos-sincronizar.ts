/**
 * API Route: POST /api/faturamento/glosas-recursos-sincronizar
 *
 * Botão "Atualizar" da tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md): sincroniza a foto do apLIS do
 * mês de faturamento (e do convênio, se pedido). As regras da foto, do
 * histórico e das edições manuais estão em faturamento/sincronizarGlosasRecursos.ts;
 * a rotina diária (faturamento-glosas-recursos-cron) usa a mesma função.
 *
 * Fonte do apLIS: MySQL de backup, ~1 dia de atraso; `meta.dadoAte` diz até
 * quando. Falha na réplica → erro, sem gravar nada.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). A foto
 * é espelho do apLIS, não edição do operador, então quem consulta pode
 * atualizar; grava com service_role.
 *
 * Body:
 *   competencia      'YYYY-MM' do lote de faturamento original, obrigatório
 *   fontePagadoraId  fatinstituicao.IdInstituicao, opcional (sem = todos)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { competenciaValida } from '../faturamento/recursoGlosa.js';
import { sincronizarRecorte } from '../faturamento/sincronizarGlosasRecursos.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoSincronizar {
  competencia?: unknown;
  fontePagadoraId?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const corpo = (req.body ?? {}) as CorpoSincronizar;
    const competencia = typeof corpo.competencia === 'string' ? corpo.competencia.trim() : '';
    if (!competenciaValida(competencia)) {
      res.status(400).json({ success: false, error: 'Informe a competência no formato YYYY-MM.' });
      return;
    }
    const bruto = corpo.fontePagadoraId ?? undefined;
    if (bruto !== undefined && !(typeof bruto === 'number' && Number.isInteger(bruto) && bruto > 0)) {
      res.status(400).json({ success: false, error: 'fontePagadoraId deve ser um inteiro positivo.' });
      return;
    }
    const fontePagadoraId = bruto as number | undefined;

    const supabase = getSupabaseAdminClient();
    const { data: sessao } = await supabase.auth.getUser(token as string);
    const r = await sincronizarRecorte(supabase, {
      competencia,
      fontePagadoraId,
      usuarioId: sessao?.user?.id ?? null,
    });
    if ('erro' in r) {
      res.status(r.erro.status).json({ success: false, error: r.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { dadoAte: r.dadoAte, sincronizadoEm: r.sincronizadoEm },
      requisicoes: r.requisicoes,
      lotes: r.lotes,
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-sincronizar] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
