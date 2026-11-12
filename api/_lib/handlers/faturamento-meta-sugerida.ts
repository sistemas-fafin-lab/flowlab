/**
 * API Route: GET /api/faturamento/meta-sugerida
 *
 * Card "Meta" do Contas a Receber, modal "Definir meta" (faturamento-meta-sugerida, issue
 * 02): as três candidatas da meta do mês — 90/10, média de 2 meses e média de 3 meses —
 * calculadas dos Elegíveis de M-1 a M-3 lidos do apLIS. Nada é gravado aqui: a coordenação
 * escolhe uma opção (ou digita outro valor) e o front salva em `metas_faturamento`.
 *
 * Autorização: header `Authorization: Bearer <access_token>` (canViewBilling ou
 * canViewContasReceber), a mesma das Pendências. Quem só vê consulta as opções; salvar
 * continua restrito pela RLS de `metas_faturamento`.
 *
 * Query params:
 *   mes  YYYY-MM — obrigatório (mês da meta)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarElegiveisPorMes } from '../faturamento/bdLab.js';
import { listarFontesConsideradasMeta } from '../faturamento/fontesConsideradas.js';
import { getSupabaseAdminClient } from '../supabase.js';
import { anoEMes, periodoDoMes } from '../../../src/modules/faturamento/utils/comparativos.js';
import { calcularCandidatas } from '../../../src/modules/faturamento/utils/metaSugerida.js';

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization), ['contasReceber']);
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const mes = primeiro((req.query as Record<string, string | string[] | undefined>).mes)?.trim() ?? '';
    const ref = anoEMes(mes);
    if (!ref) {
      res.status(400).json({ success: false, error: 'Informe mes no formato YYYY-MM.' });
      return;
    }

    // M-3 a M-1 numa ida só (periodoDoMes atravessa a virada de ano).
    const resultado = await listarElegiveisPorMes({
      periodoIni: periodoDoMes(ref.ano, ref.mes - 3).desde,
      periodoFim: periodoDoMes(ref.ano, ref.mes - 1).ate,
      fontesConsideradas: await listarFontesConsideradasMeta(getSupabaseAdminClient()),
    });
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const porMes = Object.fromEntries(resultado.elegiveis.map((e) => [e.mes, e.valor]));

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      ...calcularCandidatas(mes, porMes),
      elegiveis: resultado.elegiveis,
      dadoAte: resultado.dadoAte,
    });
  } catch (err) {
    console.error('[faturamento/meta-sugerida] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
