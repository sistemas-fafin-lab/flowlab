/**
 * API Route: GET /api/faturamento/titulos-conferencia-aplis
 *
 * Conferência das baixas dos títulos com o apLIS
 * (.scratch/faturamento-conferencia-baixas-aplis/spec.md): para cada título não
 * cancelado, compara `notas.valor_recebido` com o recebido no apLIS dos lotes
 * vinculados e devolve só os divergentes (`so-no-aplis`, `aplis-maior`,
 * `sistema-maior`, `lote-ausente` — regra em faturamento/conferenciaAplis.ts).
 * Só aponta: a baixa continua sendo lançada pelo operador no "Editar título".
 *
 * Título com algum lote sem `aplis_id` (criado fora do apLIS) fica de fora: o
 * recebido do apLIS seria só de parte dele.
 *
 * Fonte do apLIS: MySQL de backup (`recebidosDosLotes`), ~1 dia de atraso —
 * `meta.dadoAte` diz até quando. Sem cache. Falha na réplica → erro, nunca
 * lista vazia (seria lida como "tudo certo").
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling). Os
 * títulos são lidos com o cliente do usuário, para respeitar o RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { recebidosDosLotes } from '../faturamento/bdLab.js';
import { conferirTitulo } from '../faturamento/conferenciaAplis.js';
import type { DivergenciaAplis, TipoDivergenciaAplis, TituloConferencia } from '../faturamento/conferenciaAplis.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Página do PostgREST (max-rows padrão do Supabase). */
const PAGINA_NOTAS = 1000;

/** Ordem de exibição: o dinheiro que entrou e não foi lançado primeiro. */
const ORDEM_TIPO: Record<TipoDivergenciaAplis, number> = {
  'so-no-aplis': 0,
  'aplis-maior': 1,
  'sistema-maior': 2,
  'lote-ausente': 3,
};

class ErroSupabase extends Error {}

/** numeric do Postgres pode chegar como string; nulo conta como 0. */
function valor(bruto: unknown): number {
  const n = Number(bruto ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Títulos não cancelados cujos lotes têm todos `aplis_id`. */
async function titulosParaConferir(supabase: SupabaseClient): Promise<TituloConferencia[]> {
  const titulos: TituloConferencia[] = [];
  for (let offset = 0; ; offset += PAGINA_NOTAS) {
    const { data, error } = await supabase
      .from('notas')
      .select(
        'id_nota, numero_nota, status, data_emissao, valor_total, valor_recebido, valor_glosado, '
        + 'operadoras(nome), nota_lote(lotes(aplis_id))',
      )
      .neq('status', 'cancelada')
      .order('id_nota', { ascending: true })
      .range(offset, offset + PAGINA_NOTAS - 1);
    if (error) throw new ErroSupabase(`notas: ${error.message}`);
    const pagina = (data ?? []) as unknown as {
      id_nota: string;
      numero_nota: string | null;
      status: string;
      data_emissao: string | null;
      valor_total: unknown;
      valor_recebido: unknown;
      valor_glosado: unknown;
      operadoras: { nome: string | null } | null;
      nota_lote: { lotes: { aplis_id: string | null } | null }[] | null;
    }[];
    for (const nota of pagina) {
      const vinculos = nota.nota_lote ?? [];
      const idsLote = vinculos
        .map((vinculo) => Number(vinculo.lotes?.aplis_id ?? NaN))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (vinculos.length === 0 || idsLote.length !== vinculos.length) continue;
      titulos.push({
        idNota: nota.id_nota,
        numeroNota: nota.numero_nota || null,
        operadora: nota.operadoras?.nome ?? '—',
        status: nota.status,
        dataEmissao: nota.data_emissao,
        valorTotal: valor(nota.valor_total),
        recebidoSistema: valor(nota.valor_recebido),
        glosadoSistema: valor(nota.valor_glosado),
        idsLote,
      });
    }
    if (pagina.length < PAGINA_NOTAS) break;
  }
  return titulos;
}

function diferenca(d: DivergenciaAplis): number {
  return Math.abs((d.recebidoAplis ?? 0) - d.recebidoSistema);
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

    let titulos: TituloConferencia[];
    try {
      titulos = await titulosParaConferir(getSupabaseUserClient(token as string));
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/titulos-conferencia-aplis] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const recebidos = await recebidosDosLotes(titulos.flatMap((t) => t.idsLote));
    if ('erro' in recebidos) {
      res.status(recebidos.erro.status).json({
        success: false,
        error: 'Não foi possível consultar os recebimentos no apLIS agora — tente novamente em alguns minutos. '
          + `(${recebidos.erro.mensagem})`,
      });
      return;
    }

    const divergentes = titulos
      .map((titulo) => conferirTitulo(titulo, recebidos.porLote))
      .filter((d): d is DivergenciaAplis => d !== null)
      .sort((a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo] || diferenca(b) - diferenca(a));

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { dadoAte: recebidos.dadoAte }, titulos: divergentes });
  } catch (err) {
    console.error('[faturamento/titulos-conferencia-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
