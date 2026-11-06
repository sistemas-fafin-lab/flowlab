/**
 * API Route: GET /api/faturamento/comparativos-funil-glosa
 *
 * Aba Contas a Receber → Comparativos, bloco "Funil de glosa": Faturado → Recebido →
 * Glosa total (= recuperada + acatada + em disputa) → Saldo pendente, por competência
 * (mês de emissão do título) para o mês de referência, M-1 e M-2, com glosa, acatada e
 * saldo atribuídos ao lote ("Fora de lote" quando não há) e o "recebido no mês" (caixa)
 * ao lado (faturamento-comparativos, issue 04). Cálculo em utils/funilGlosa.ts.
 *
 * Faturado e recebido vêm dos títulos do Supabase. Acatada (status 18 e 8, a mesma regra que
 * abate o saldo), em disputa e recuperada vêm da foto de recursos do apLIS (mapeamento
 * proposto em faturamento/glosaRecuperada.ts, a confirmar). A tabela `glosas` não é usada:
 * é só histórico desde 20261026120000.
 *
 * Autorização: header `Authorization: Bearer <access_token>` (canViewBilling ou a chave da
 * tela Contas a Receber). Dados lidos com o cliente do usuário (RLS).
 *
 * Query params:
 *   mes  YYYY-MM — obrigatório (mês de referência)
 *
 * Falha do Supabase → 502; falha do apLIS (caixa) → status e mensagem do erro, não 500.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarRecebidosMes } from '../faturamento/bdLab.js';
import { fontesDaMeta, glosasParaFunil, titulosParaFunil } from '../faturamento/dadosFunilGlosa.js';
import { ErroSupabase } from '../faturamento/titulosConferencia.js';
import { getSupabaseUserClient } from '../supabase.js';
import { periodosComparativos } from '../../../src/modules/faturamento/utils/comparativos.js';
import { montarFunilGlosa } from '../../../src/modules/faturamento/utils/funilGlosa.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
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

    const mes = primeiro((req.query as Record<string, string | string[] | undefined>).mes)?.trim() ?? '';
    const periodos = periodosComparativos(mes);
    if (!periodos) {
      res.status(400).json({ success: false, error: 'Informe mes no formato YYYY-MM.' });
      return;
    }

    const supabase = getSupabaseUserClient(token as string);
    let funil;
    let fontesMeta;
    try {
      const { titulos, loteDoAplis } = await titulosParaFunil(
        supabase,
        periodos[periodos.length - 1].desde,
        periodos[0].ate,
      );
      const [glosas, fontes] = await Promise.all([
        glosasParaFunil(supabase, loteDoAplis, periodos.map((p) => p.mes)),
        fontesDaMeta(supabase),
      ]);
      funil = montarFunilGlosa(periodos, titulos, glosas);
      fontesMeta = fontes;
    } catch (err) {
      if (!(err instanceof ErroSupabase)) throw err;
      console.error('[faturamento/comparativos-funil-glosa] Supabase:', err.message);
      res.status(502).json({
        success: false,
        error: 'Não foi possível ler o funil de glosa agora — tente novamente em alguns minutos.',
      });
      return;
    }

    // Caixa: o que entrou no mês, qualquer que seja o mês de emissão (apLIS, ~1 dia de atraso).
    const caixas = await Promise.all(periodos.map((p) => listarRecebidosMes({ desde: p.desde, ate: p.ate })));
    for (const caixa of caixas) {
      if ('erro' in caixa) {
        res.status(caixa.erro.status).json({ success: false, error: caixa.erro.mensagem });
        return;
      }
    }
    const recebidoNoMes = periodos.map((p, i) => {
      const caixa = caixas[i];
      const centavos = 'lotes' in caixa
        ? caixa.lotes
          .filter((l) => l.fontePagadoraId !== null && fontesMeta.has(l.fontePagadoraId))
          .reduce((soma, l) => soma + Math.round(l.valorRecebido * 100), 0)
        : 0;
      return { mes: p.mes, valor: centavos / 100 };
    });

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, mes, periodos, funil, recebidoNoMes });
  } catch (err) {
    console.error('[faturamento/comparativos-funil-glosa] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
