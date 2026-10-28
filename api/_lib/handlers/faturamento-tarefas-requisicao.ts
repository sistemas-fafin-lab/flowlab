/**
 * API Route: GET /api/faturamento/tarefas-requisicao?idRequisicao=<n>
 *
 * Tarefas do apLIS de uma requisição, de qualquer setor, da mais recente para a
 * mais antiga — ver `listarTarefasRequisicao` em bdLab.ts. Carregado sob demanda
 * pelo modal do ícone de tarefas da aba Contas a Receber → Pendências.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling ou a chave da tela).
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarTarefasRequisicao } from '../faturamento/bdLab.js';

function primeiro(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
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

    const q = req.query as Record<string, string | string[] | undefined>;
    const bruto = primeiro(q.idRequisicao)?.trim();
    const idRequisicao = Number(bruto);
    if (!bruto || !Number.isInteger(idRequisicao) || idRequisicao < 1) {
      res.status(400).json({ success: false, error: 'Informe idRequisicao (inteiro positivo).' });
      return;
    }

    const resultado = await listarTarefasRequisicao(idRequisicao);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, idRequisicao, tarefas: resultado.tarefas });
  } catch (err) {
    console.error('[faturamento/tarefas-requisicao] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
