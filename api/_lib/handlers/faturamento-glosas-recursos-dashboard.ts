/**
 * API Route: GET /api/faturamento/glosas-recursos-dashboard
 *
 * Aba Dashboard da tela Glosas e Recursos
 * (.scratch/glosas-recursos-dashboard/spec.md, issue 11): evolução dos 6 meses
 * até o período, distribuição por status, procedimentos, convênios e motivos.
 * Os cards de valor (Valor glosado, Valor acatado, Glosa recuperada, Saldo
 * pendente; .scratch/glosas-recursos-calendario-pendencias/issues/05) usam a
 * classificação do funil de faturamento/glosaRecuperada.ts, com o faturado dos
 * lotes de faturamento criados no mês (ver `faturadoDoMes`). O Saldo de glosa
 * por operadora (issue 07) é a mesma classe "em disputa", do mês. Lê da foto do Supabase; a tradução de
 * status e as somas são de faturamento/recursoGlosa.ts, com as edições do
 * lápis valendo acima do apLIS.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório
 *   fontePagadoraId  filtra por convênio (fonte pagadora da requisição)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  MESES_EVOLUCAO,
  competenciaValida,
  edicoesDaFoto,
  resumirDashboard,
  somarMeses,
} from '../faturamento/recursoGlosa.js';
import type { RequisicaoDashboard } from '../faturamento/recursoGlosa.js';
import { cardsValorGlosa, saldoDeGlosaPorOperadora } from '../faturamento/glosaRecuperada.js';
import type { RequisicaoSaldoOperadora } from '../faturamento/glosaRecuperada.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Linhas por página do PostgREST (o teto padrão é 1000). */
const PAGINA = 1000;

interface LinhaFoto {
  competencia: string;
  status_aplis: number | null;
  liquido: number | string;
  recebido: number | string;
  recebido_fixacao: number | string | null;
  valor_recursado: number | string | null;
  valor_recursado_editado: number | string | null;
  valor_recebido_glosa_editado: number | string | null;
  glosa_fixada: number | string | null;
  id_fonte_pagadora: number | null;
  fonte_pagadora_nome: string | null;
  procedimentos: string[] | null;
  motivos: string[] | null;
  id_lote_recurso: number | null;
  glosa_recurso_lotes: { data_envio_aplis: string | null; data_envio_editada: string | null } | null;
}

class ErroLeitura extends Error {}

/** Requisição da foto com o que o dashboard e o saldo por operadora usam. */
type RequisicaoDoMes = RequisicaoDashboard & RequisicaoSaldoOperadora;

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function numeroOuNulo(valor: number | string | null): number | null {
  return valor === null ? null : Number(valor);
}

/** Requisições da foto nos meses pedidos, agrupadas por mês. */
async function requisicoesPorMes(
  supabase: SupabaseClient,
  meses: string[],
  fontePagadoraId: number | undefined,
): Promise<Record<string, RequisicaoDoMes[]>> {
  const porMes: Record<string, RequisicaoDoMes[]> = {};
  for (let de = 0; ; de += PAGINA) {
    let consulta = supabase
      .from('glosa_recurso_requisicoes')
      .select('competencia, status_aplis, liquido, recebido, recebido_fixacao, valor_recursado, valor_recursado_editado, valor_recebido_glosa_editado, glosa_fixada, id_fonte_pagadora, fonte_pagadora_nome, procedimentos, motivos, id_lote_recurso, glosa_recurso_lotes(data_envio_aplis, data_envio_editada)')
      .in('competencia', meses);
    if (fontePagadoraId !== undefined) consulta = consulta.eq('id_fonte_pagadora', fontePagadoraId);
    const { data, error } = await consulta.order('id_requisicao').range(de, de + PAGINA - 1);
    if (error) throw new ErroLeitura(error.message);
    const linhas = (data ?? []) as unknown as LinhaFoto[];
    // As edições manuais (lápis) valem acima do apLIS: valor recursado e
    // recebido de glosa em `edicoes`, e a data de envio editada em `loteEnviado`.
    for (const l of linhas) {
      (porMes[l.competencia] ??= []).push({
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
        glosaFixada: numeroOuNulo(l.glosa_fixada),
        convenio: l.fonte_pagadora_nome,
        fontePagadora: { id: l.id_fonte_pagadora, nome: l.fonte_pagadora_nome },
        procedimentos: l.procedimentos ?? [],
        motivos: l.motivos ?? [],
      });
    }
    if (linhas.length < PAGINA) return porMes;
  }
}

/**
 * Faturado do mês do lote original: Σ `lotes.valor_total` dos lotes com
 * `data_criacao` (DtaCriacao do apLIS, a mesma data da `competencia` da foto)
 * no mês, da fonte pagadora do filtro (`operadoras.aplis_id`).
 *
 * O card do Contas a Receber soma `notas.valor_total` pela emissão do título; um
 * título pode juntar lotes de meses diferentes, então aqui vale o valor do lote.
 * Lote de faturamento sem título no FlowLab não está em `lotes` e fica fora.
 */
async function faturadoDoMes(
  supabase: SupabaseClient,
  competencia: string,
  fontePagadoraId: number | undefined,
): Promise<number> {
  const inicio = `${competencia}-01`;
  const fim = `${somarMeses(competencia, 1)}-01`;
  let centavos = 0;
  for (let de = 0; ; de += PAGINA) {
    // A operadora só entra na consulta com o filtro de convênio.
    let consulta = fontePagadoraId === undefined
      ? supabase.from('lotes').select('id_lote, valor_total')
      : supabase
        .from('lotes')
        .select('id_lote, valor_total, operadoras!inner(aplis_id)')
        .eq('operadoras.aplis_id', String(fontePagadoraId));
    consulta = consulta.gte('data_criacao', inicio).lt('data_criacao', fim);
    const { data, error } = await consulta.order('id_lote').range(de, de + PAGINA - 1);
    if (error) throw new ErroLeitura(error.message);
    const linhas = (data ?? []) as { valor_total: number | string | null }[];
    for (const l of linhas) centavos += Math.round(Number(l.valor_total ?? 0) * 100);
    if (linhas.length < PAGINA) return centavos / 100;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  try {
    const token = tokenDoHeader(req.headers.authorization);
    const erroAuth = await autorizarFaturamento(token, ['glosas']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const brutoFonte = primeiro(q.fontePagadoraId)?.trim() || undefined;
    const fontePagadoraId = brutoFonte === undefined ? undefined : Number(brutoFonte);

    const invalidos = [
      !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      fontePagadoraId !== undefined && !(Number.isInteger(fontePagadoraId) && fontePagadoraId > 0)
        ? 'fontePagadoraId'
        : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    // Os 6 meses da evolução já incluem o anterior, base da variação dos cards de valor.
    const meses = Array.from({ length: MESES_EVOLUCAO }, (_, i) => somarMeses(competencia, -i));
    const supabase = getSupabaseUserClient(token as string);
    let dashboard;
    try {
      const [porMes, faturado] = await Promise.all([
        requisicoesPorMes(supabase, meses, fontePagadoraId),
        faturadoDoMes(supabase, competencia, fontePagadoraId),
      ]);
      dashboard = {
        ...resumirDashboard(competencia, porMes),
        faturado,
        valores: cardsValorGlosa(competencia, porMes, faturado),
        // Do mês, como o card Glosa em disputa: as barras somam o card.
        saldoPorOperadora: saldoDeGlosaPorOperadora(porMes[competencia] ?? []),
      };
    } catch (err) {
      if (!(err instanceof ErroLeitura)) throw err;
      console.error('[faturamento/glosas-recursos-dashboard] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler o dashboard de glosas agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, dashboard });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-dashboard] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
