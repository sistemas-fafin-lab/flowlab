/**
 * API Route: GET /api/faturamento/saldo-operadoras-aplis
 *
 * Saldo por operadora do Dashboard do Contas a Receber, com o saldo do apLIS ao
 * lado do saldo do sistema (.scratch/faturamento-comparativos/issues/02-saldo-por-operadora.md).
 * Por operadora: `saldoSistema` (`notas.valor_saldo` dos títulos comparáveis),
 * `saldoAplis` (valor líquido − recebido dos mesmos lotes no apLIS) e a
 * `diferenca`. Só aponta: não corrige o saldo nem dá baixa.
 *
 * Parâmetros: `desde` e `ate` (YYYY-MM-DD, obrigatórios), `somentePeriodo`
 * (`true` = só títulos emitidos no período; padrão carteira total) e os filtros
 * do Dashboard `operadoraId`, `lote` e `nota` (repetíveis; mesma regra da RPC
 * fat_dashboard_receber — ver `filtrarUniverso`).
 *
 * Fonte do apLIS: MySQL de backup (`saldosAplisDosLotes`), ~1 dia de atraso —
 * `meta.dadoAte` diz até quando. Falha na réplica → resposta com `success:false`
 * e o status do erro (502), nunca lista vazia: o Dashboard mantém o gráfico do
 * sistema e mostra o aviso na comparação.
 *
 * Autorização: `Authorization: Bearer <access_token>` (canViewBilling ou a chave
 * da tela Contas a Receber). Títulos lidos com o cliente do usuário (RLS).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { saldosAplisDosLotes } from '../faturamento/bdLab.js';
import { compararSaldos, filtrarUniverso } from '../faturamento/saldoOperadoras.js';
import { ErroSupabase, titulosParaSaldo } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function lista(valor: string | string[] | undefined): string[] {
  const itens = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor];
  return itens.map((v) => v.trim()).filter((v) => v !== '');
}

function primeiro(valor: string | string[] | undefined): string | undefined {
  return lista(valor)[0];
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

    const q = req.query as Record<string, string | string[] | undefined>;
    const desde = primeiro(q.desde);
    const ate = primeiro(q.ate);
    const somentePeriodoBruto = primeiro(q.somentePeriodo);
    const invalidos = [
      desde === undefined || !DATA_ISO_RE.test(desde) ? 'desde' : null,
      ate === undefined || !DATA_ISO_RE.test(ate) ? 'ate' : null,
      somentePeriodoBruto !== undefined && somentePeriodoBruto !== 'true' && somentePeriodoBruto !== 'false'
        ? 'somentePeriodo'
        : null,
    ].filter((c): c is string => c !== null);
    if (invalidos.length > 0) {
      res.status(400).json({ success: false, error: `Parâmetro inválido: ${invalidos.join(', ')}.` });
      return;
    }

    let titulos;
    try {
      titulos = await titulosParaSaldo(getSupabaseUserClient(token as string));
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/saldo-operadoras-aplis] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler os títulos agora — tente novamente em alguns minutos.',
      });
      return;
    }

    const universo = filtrarUniverso(titulos, {
      desde: desde as string,
      ate: ate as string,
      somentePeriodo: somentePeriodoBruto === 'true',
      operadoraIds: lista(q.operadoraId),
      lotes: lista(q.lote),
      notas: lista(q.nota),
    });

    const idsLote = universo.flatMap((t) => t.lotes.flatMap((l) => (l.aplisId === null ? [] : [l.aplisId])));
    const aplis = await saldosAplisDosLotes(idsLote);
    if ('erro' in aplis) {
      res.status(aplis.erro.status).json({
        success: false,
        error: 'Não foi possível consultar os saldos no apLIS agora — tente novamente em alguns minutos. '
          + `(${aplis.erro.mensagem})`,
      });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      meta: { dadoAte: aplis.dadoAte },
      operadoras: compararSaldos(universo, aplis.porLote),
    });
  } catch (err) {
    console.error('[faturamento/saldo-operadoras-aplis] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
