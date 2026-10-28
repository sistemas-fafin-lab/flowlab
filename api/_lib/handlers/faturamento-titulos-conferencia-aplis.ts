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
 * Na mesma leitura devolve `refechamentos`: títulos cujo lote foi refechado no
 * apLIS depois da emissão (.scratch/faturamento-pendencias-e-refechamento/spec.md,
 * regra em `refechamentoDoTitulo`). Também só aponta, não muda dado.
 *
 * Título com algum lote sem `aplis_id` (criado fora do apLIS) fica de fora: o
 * recebido do apLIS seria só de parte dele.
 *
 * Fonte do apLIS: MySQL de backup (`recebidosDosLotes`), ~1 dia de atraso —
 * `meta.dadoAte` diz até quando. Sem cache. Falha na réplica → erro, nunca
 * lista vazia (seria lida como "tudo certo").
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Os
 * títulos são lidos com o cliente do usuário, para respeitar o RLS.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { recebidosDosLotes } from '../faturamento/bdLab.js';
import { conferirTitulo, refechamentoDoTitulo } from '../faturamento/conferenciaAplis.js';
import type {
  DivergenciaAplis,
  RefechamentoAplis,
  TipoDivergenciaAplis,
  TituloConferencia,
} from '../faturamento/conferenciaAplis.js';
import { ErroSupabase, titulosParaConferir } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';

/** Ordem de exibição: o dinheiro que entrou e não foi lançado primeiro. */
const ORDEM_TIPO: Record<TipoDivergenciaAplis, number> = {
  'so-no-aplis': 0,
  'aplis-maior': 1,
  'sistema-maior': 2,
  'lote-ausente': 3,
};

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
    const erroAuth = await autorizarFaturamento(token, ['contasReceber']);
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

    const refechamentos = titulos
      .map((titulo) => refechamentoDoTitulo(titulo, recebidos.porLote))
      .filter((r): r is RefechamentoAplis => r !== null)
      .sort((a, b) => a.emissaoAtual.localeCompare(b.emissaoAtual) || a.lotes[0] - b.lotes[0]);

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, meta: { dadoAte: recebidos.dadoAte }, titulos: divergentes, refechamentos });
  } catch (err) {
    console.error('[faturamento/titulos-conferencia-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
