/**
 * API Route: GET /api/faturamento/glosas-recursos-pendencias
 *
 * Bloco "Pendências de glosa" do Dashboard de glosa
 * (.scratch/glosas-recursos-calendario-pendencias/issues/06): glosas sem
 * recurso com prazo vencido, recursos com retorno atrasado e recursos com
 * pagamento atrasado, com valor e quantidade. As regras estão em
 * faturamento/recursoGlosa.ts (pendenciasDeGlosa); a leitura, em
 * faturamento/dadosPendenciasGlosa.ts, a mesma dos filtros de pendência das
 * listas que cada card abre.
 *
 * O período do cabeçalho não filtra: entram todos os meses de faturamento, e o
 * recorte é o mês em que o prazo venceu. Endpoint à parte do dashboard para o
 * seletor de mês não reler o resto da aba.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave da tela). Lido
 * com o cliente do usuário, para respeitar a RLS.
 *
 * Query params:
 *   mes              YYYY-MM em que o prazo venceu; ausente = todo o período
 *   fontePagadoraId  filtra por convênio (fatinstituicao.IdInstituicao)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import {
  ErroLeituraPendencias,
  hojeEmSaoPaulo,
  lerGlosadasForaDeLote,
  lerLotesEnviados,
  lerRegrasDasFontes,
} from '../faturamento/dadosPendenciasGlosa.js';
import { competenciaValida, pendenciasDeGlosa } from '../faturamento/recursoGlosa.js';
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
    const mes = primeiro(q.mes)?.trim() || null;
    const fontePagadoraId = inteiroPositivo(primeiro(q.fontePagadoraId));
    const invalidos = [
      mes !== null && !competenciaValida(mes) ? 'mes (YYYY-MM)' : null,
      fontePagadoraId === null ? 'fontePagadoraId' : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    const hoje = hojeEmSaoPaulo();
    let pendencias;
    try {
      const filtros = { fontePagadoraId: fontePagadoraId ?? undefined };
      const [requisicoes, lotes] = await Promise.all([
        lerGlosadasForaDeLote(supabase, filtros),
        lerLotesEnviados(supabase, filtros),
      ]);
      const fontes = [...new Set(requisicoes.map((r) => r.fontePagadora.id).filter((f): f is number => f !== null))];
      const regras = await lerRegrasDasFontes(supabase, fontes);
      pendencias = pendenciasDeGlosa({ requisicoes, regraRecursoPorFonte: regras.recurso, lotes }, mes, hoje);
    } catch (err) {
      if (!(err instanceof ErroLeituraPendencias)) throw err;
      console.error('[faturamento/glosas-recursos-pendencias] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler as pendências de glosa agora — tente novamente em alguns minutos.',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      mes,
      hoje,
      pendencias: {
        prazoVencido: { valor: pendencias.prazoVencido.valor, quantidade: pendencias.prazoVencido.quantidade },
        retornoAtrasado: { valor: pendencias.retornoAtrasado.valor, quantidade: pendencias.retornoAtrasado.quantidade },
        pagamentoAtrasado: {
          valor: pendencias.pagamentoAtrasado.valor,
          quantidade: pendencias.pagamentoAtrasado.quantidade,
          qtdLotes: pendencias.pagamentoAtrasado.qtdLotes,
        },
      },
    });
  } catch (err) {
    console.error('[faturamento/glosas-recursos-pendencias] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
