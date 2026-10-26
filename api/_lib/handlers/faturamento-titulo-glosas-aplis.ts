/**
 * API Route: GET /api/faturamento/titulo-glosas-aplis
 *
 * Linha expandida de Contas a Receber → Títulos
 * (.scratch/glosas-recursos-dashboard/spec.md, issue 13): as glosas do apLIS
 * dos lotes de faturamento de um título, uma por requisição, lidas da foto de
 * Glosas e Recursos. O status (o mesmo do Dashboard e de Glosas recentes) vem
 * de faturamento/recursoGlosa.ts, com as edições do lápis valendo acima do apLIS —
 * as mesmas regras das colunas Glosado, Glosa recebida e Glosa acatada.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   lotes  `lotes.aplis_id` dos lotes do título, separados por vírgula (até 200)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { classificarRequisicao, edicoesDaFoto, statusDashboard } from '../faturamento/recursoGlosa.js';
import type { RequisicaoFoto } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Um título tem poucos lotes; o teto só protege a URL do PostgREST. */
const MAX_LOTES = 200;

interface LinhaFoto {
  id_requisicao: number;
  cod_requisicao: string | null;
  num_guia: string | null;
  paciente: string | null;
  id_lote_faturamento: number;
  status_aplis: number | null;
  motivos: string[] | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
  glosa_fixada: number | string | null;
  id_lote_recurso: number | null;
  glosa_recurso_lotes: { data_envio_aplis: string | null; data_envio_editada: string | null } | null;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

    const brutos = (primeiro((req.query as Record<string, string | string[] | undefined>).lotes) ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const lotes = [...new Set(brutos.map(Number))];
    if (lotes.length === 0 || lotes.length > MAX_LOTES || !lotes.every((id) => Number.isInteger(id) && id > 0)) {
      res.status(400).json({
        success: false,
        error: `Parâmetro inválido: lotes (1..${MAX_LOTES} ids inteiros positivos, separados por vírgula).`,
      });
      return;
    }

    const { data, error } = await getSupabaseUserClient(token as string)
      .from('glosa_recurso_requisicoes')
      .select('id_requisicao, cod_requisicao, num_guia, paciente, id_lote_faturamento, status_aplis, motivos, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, glosa_fixada, id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)')
      .in('id_lote_faturamento', lotes)
      .order('id_lote_faturamento')
      .order('id_requisicao');
    if (error) {
      console.error('[faturamento/titulo-glosas-aplis] Supabase:', error.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as glosas do apLIS agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const linhas = (data ?? []) as unknown as LinhaFoto[];
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      glosas: linhas.map((l) => {
        const foto: RequisicaoFoto = {
          status: l.status_aplis,
          liquido: Number(l.liquido),
          recebido: Number(l.recebido),
          recebidoFixacao: numeroOuNulo(l.recebido_fixacao),
          valorRecursado: numeroOuNulo(l.valor_recursado),
          emLoteRecurso: l.id_lote_recurso !== null,
          loteEnviado: Boolean(l.glosa_recurso_lotes?.data_envio_editada ?? l.glosa_recurso_lotes?.data_envio_aplis),
        };
        // As edições manuais (lápis) valem acima do apLIS.
        const edicoes = edicoesDaFoto({
          valorRecursado: numeroOuNulo(l.valor_recursado_editado),
          valorRecebidoGlosa: numeroOuNulo(l.valor_recebido_glosa_editado),
        });
        const classificacao = classificarRequisicao(foto, edicoes);
        return {
          idRequisicao: l.id_requisicao,
          codRequisicao: l.cod_requisicao,
          numGuia: l.num_guia,
          paciente: l.paciente,
          idLoteFaturamento: l.id_lote_faturamento,
          idLoteRecurso: l.id_lote_recurso,
          statusAplis: l.status_aplis,
          motivos: l.motivos ?? [],
          valorGlosado: numeroOuNulo(l.glosa_fixada),
          // O que sai do saldo do título (líquido − recebido nos status 18 e 8).
          glosaAcatada: classificacao?.classe === 'acatada' ? classificacao.valor : null,
          status: statusDashboard(foto, edicoes),
        };
      }),
    });
  } catch (err) {
    console.error('[faturamento/titulo-glosas-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
