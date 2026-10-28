/**
 * API Route: GET /api/faturamento/imagens-legado?idRequisicao=<n>
 *
 * Metadados das imagens/documentos digitalizados anexados a uma requisição no
 * legado (requisicaoimagem), usado pelo botão "Ver imagens" nos históricos de
 * Glosas e Recursos. Só metadados — os bytes de cada imagem vêm sob demanda por
 * /api/faturamento/imagem-legado-arquivo, ao abrir/navegar no visualizador.
 *
 * A réplica só tem o blob das fotos do tipo 10; os demais tipos vêm do S3 do
 * apLIS. Com o S3 configurado toda linha sai `disponivel: true`; sem ele, só as
 * que têm o blob na réplica.
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling ou a chave da tela).
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão
 *   + AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY para saber se o S3 está configurado.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarImagensRequisicaoLegado } from '../faturamento/bdLab.js';
import { s3AplisConfigurado } from '../faturamento/s3Aplis.js';

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
    const erroAuth = await autorizarFaturamento(tokenDoHeader(req.headers.authorization), ['glosas']);
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

    const resultado = await listarImagensRequisicaoLegado(idRequisicao);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    const comS3 = s3AplisConfigurado();
    const imagens = resultado.imagens.map((img) => ({ ...img, disponivel: img.disponivel || comS3 }));
    res.status(200).json({ success: true, imagens });
  } catch (err) {
    console.error('[faturamento/imagens-legado] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
