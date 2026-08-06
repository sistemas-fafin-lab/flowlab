/**
 * API Route: GET /api/faturamento/lote-detalhe?idLote=<n>
 *
 * Requisições de um lote de faturamento, cada uma com os procedimentos cobrados.
 * Carregado sob demanda ao expandir a linha do lote na aba Faturas — um lote pode ter
 * ~50 procedimentos, cara demais para vir junto da listagem.
 *
 * Este é o dado que fez a tela sair da API do apLIS para o banco: `faturamentoLoteListar`
 * devolve os procedimentos somados por lote, sem nenhuma referência às requisições, e
 * `requisicaoListar` ignora filtro por lote. O elo é `requisicao.Lote` no MySQL.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling).
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { detalharLote } from '../faturamento/bdLab.js';

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization));
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const q = req.query as Record<string, string | string[] | undefined>;
    const bruto = primeiro(q.idLote)?.trim();
    const idLote = Number(bruto);
    if (!bruto || !Number.isInteger(idLote) || idLote < 1) {
      res.status(400).json({ success: false, error: 'Informe idLote (inteiro positivo).' });
      return;
    }

    // semCache=1: releitura forçada pelo botão "Atualizar" da tela, que precisa furar
    // o cache em memória do servidor (TTL 3 min) além do cache de sessão do SPA.
    const resultado = await detalharLote(idLote, primeiro(q.semCache) === '1');
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // Dado financeiro: não deixa ficar em cache de navegador nem de proxy.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      idLote,
      requisicoes: resultado.requisicoes,
    });
  } catch (err) {
    console.error('[faturamento/lote-detalhe] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
