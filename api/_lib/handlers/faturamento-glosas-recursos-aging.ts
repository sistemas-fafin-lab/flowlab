/**
 * API Route: GET /api/faturamento/glosas-recursos-aging
 *
 * Aging da glosa em recurso do Dashboard de glosa
 * (.scratch/glosas-recursos-calendario-pendencias/issues/07). A regra está em
 * faturamento/recursoGlosa.ts (agingDaGlosaEmRecurso); a leitura, em
 * faturamento/dadosPendenciasGlosa.ts, a mesma dos lotes das Pendências de glosa.
 * O Saldo de glosa por operadora, ao lado, vem com o dashboard (é do período).
 *
 * O período do cabeçalho não filtra: o aging é do que está em aberto, de
 * qualquer mês de faturamento, como o Aging da carteira do Contas a Receber.
 * O convênio filtra pela fonte pagadora da requisição.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  ErroLeituraPendencias,
  hojeEmSaoPaulo,
  lerLotesEnviados,
} from '../faturamento/dadosPendenciasGlosa.js';
import { agingDaGlosaEmRecurso } from '../faturamento/recursoGlosa.js';
import { getSupabaseUserClient } from '../supabase.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function inteiroPositivo(bruto: string | undefined): number | null | undefined {
  if (bruto === undefined || bruto.trim() === '') return undefined;
  const n = Number(bruto);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
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
    const fontePagadoraId = inteiroPositivo(primeiro(q.fontePagadoraId));
    if (fontePagadoraId === null) {
      res.status(400).json({ success: false, error: 'Parâmetro inválido: fontePagadoraId.' });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    const hoje = hojeEmSaoPaulo();
    let aging;
    try {
      // Os não enviados entram para a nota "Fora das faixas".
      const lotes = await lerLotesEnviados(supabase, { fontePagadoraId, incluirNaoEnviados: true });
      // O lote entra se tem alguma requisição do convênio; só essas contam.
      const doConvenio = fontePagadoraId === undefined
        ? lotes
        : lotes.map((l) => ({ ...l, requisicoes: l.requisicoes.filter((r) => r.fontePagadora.id === fontePagadoraId) }));
      aging = agingDaGlosaEmRecurso(doConvenio, hoje);
    } catch (err) {
      if (!(err instanceof ErroLeituraPendencias)) throw err;
      console.error('[faturamento/glosas-recursos-aging] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler o aging da glosa agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, hoje, aging });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-aging] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
