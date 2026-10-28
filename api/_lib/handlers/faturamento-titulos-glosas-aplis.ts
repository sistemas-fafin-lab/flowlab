/**
 * API Route: POST /api/faturamento/titulos-glosas-aplis
 *
 * Colunas Glosado, Glosa recebida e Glosa acatada de Contas a Receber → Títulos
 * (.scratch/glosas-recursos-dashboard/spec.md, issue 12), por lote de
 * faturamento. Lê da foto de Glosas e Recursos no Supabase; as somas são de
 * faturamento/recursoGlosa.ts (somarGlosasPorLote), com as edições do lápis
 * valendo acima do apLIS. A tela junta os lotes de cada título
 * (somarGlosasDoTitulo).
 *
 * POST porque o recorte da tela (todas as páginas) pode ter milhares de lotes.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Body: { lotes: number[] }  — `lotes.aplis_id` dos lotes dos títulos
 * Resposta: { porLote: { [idLote]: GlosasTitulo } } — só os lotes com requisição na foto
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { edicoesDaFoto, somarGlosasPorLote } from '../faturamento/recursoGlosa.js';
import type { RequisicaoTitulo } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Linhas por página do PostgREST (o teto padrão é 1000). */
const PAGINA = 1000;
/** Ids por `in.()`: a lista vai na URL do PostgREST. */
const LOTES_POR_CONSULTA = 200;

interface LinhaFoto {
  id_lote_faturamento: number;
  status_aplis: number | null;
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

class ErroLeitura extends Error {}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

/** Requisições da foto dos lotes de faturamento pedidos. */
async function requisicoesDosLotes(supabase: SupabaseClient, lotes: number[]): Promise<RequisicaoTitulo[]> {
  const requisicoes: RequisicaoTitulo[] = [];
  for (let i = 0; i < lotes.length; i += LOTES_POR_CONSULTA) {
    const fatia = lotes.slice(i, i + LOTES_POR_CONSULTA);
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await supabase
        .from('glosa_recurso_requisicoes')
        .select('id_lote_faturamento, status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, glosa_fixada, id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)')
        .in('id_lote_faturamento', fatia)
        .order('id_requisicao')
        .range(de, de + PAGINA - 1);
      if (error) throw new ErroLeitura(error.message);
      const linhas = (data ?? []) as unknown as LinhaFoto[];
      // As edições manuais (lápis) valem acima do apLIS: valor recursado e
      // recebido de glosa em `edicoes`, e a data de envio editada em `loteEnviado`.
      for (const l of linhas) {
        requisicoes.push({
          idLoteFaturamento: l.id_lote_faturamento,
          glosaFixada: numeroOuNulo(l.glosa_fixada),
          foto: {
            status: l.status_aplis,
            liquido: Number(l.liquido),
            recebido: Number(l.recebido),
            recebidoFixacao: numeroOuNulo(l.recebido_fixacao),
            valorRecursado: numeroOuNulo(l.valor_recursado),
            emLoteRecurso: l.id_lote_recurso !== null,
            loteEnviado: Boolean(l.glosa_recurso_lotes?.data_envio_editada ?? l.glosa_recurso_lotes?.data_envio_aplis),
          },
          edicoes: edicoesDaFoto({
            valorRecursado: numeroOuNulo(l.valor_recursado_editado),
            valorRecebidoGlosa: numeroOuNulo(l.valor_recebido_glosa_editado),
          }),
        });
      }
      if (linhas.length < PAGINA) break;
    }
  }
  return requisicoes;
}

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

    const brutos = (req.body ?? {}) as { lotes?: unknown };
    if (!Array.isArray(brutos.lotes) || !brutos.lotes.every((id) => Number.isInteger(id) && (id as number) > 0)) {
      res.status(400).json({ success: false, error: 'Parâmetro inválido: lotes (ids inteiros positivos).' });
      return;
    }
    const lotes = [...new Set(brutos.lotes as number[])];

    let porLote;
    try {
      porLote = somarGlosasPorLote(await requisicoesDosLotes(getSupabaseUserClient(token as string), lotes));
    } catch (err) {
      if (!(err instanceof ErroLeitura)) throw err;
      console.error('[faturamento/titulos-glosas-aplis] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as glosas do apLIS agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, porLote: Object.fromEntries(porLote) });
  } catch (err) {
    console.error('[faturamento/titulos-glosas-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
