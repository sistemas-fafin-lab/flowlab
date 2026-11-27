/**
 * API Route: GET /api/faturamento/glosas-recursos-aging
 *
 * Aging da glosa em recurso do Dashboard de glosa
 * (.scratch/glosas-recursos-calendario-pendencias/issues/07). A regra está em
 * faturamento/recursoGlosa.ts (agingDaGlosaEmRecurso); a leitura, em
 * faturamento/dadosPendenciasGlosa.ts, a mesma dos lotes das Pendências de glosa.
 * O Saldo de glosa por operadora, ao lado, vem com o dashboard (é do período).
 *
 * Segue o período do cabeçalho como o resto da aba (decisão de 27/11/2026): só
 * contam as requisições do mês do lote de faturamento original. O convênio
 * filtra pela fonte pagadora da requisição.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   competencia      YYYY-MM do lote de faturamento original, obrigatório
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
import { agingDaGlosaEmRecurso, competenciaValida } from '../faturamento/recursoGlosa.js';
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
    const competencia = primeiro(q.competencia)?.trim() ?? '';
    const fontePagadoraId = inteiroPositivo(primeiro(q.fontePagadoraId));
    const invalidos = [
      !competenciaValida(competencia) ? 'competencia (YYYY-MM)' : null,
      fontePagadoraId === null ? 'fontePagadoraId' : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    const hoje = hojeEmSaoPaulo();
    let aging;
    try {
      // Os não enviados entram para a nota "Fora das faixas".
      const lotes = await lerLotesEnviados(supabase, { fontePagadoraId, incluirNaoEnviados: true });
      // Só contam as requisições do período e do convênio; os prazos continuam
      // os do lote (envio, retorno real e regra).
      const doRecorte = lotes.map((l) => ({
        ...l,
        requisicoes: l.requisicoes.filter(
          (r) => r.competencia === competencia && (fontePagadoraId === undefined || r.fontePagadora.id === fontePagadoraId),
        ),
      }));
      aging = agingDaGlosaEmRecurso(doRecorte, hoje);
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
