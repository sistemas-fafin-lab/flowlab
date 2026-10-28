/**
 * API Route: GET /api/faturamento/imagem-legado-arquivo?id=<n>
 *
 * Bytes de UMA imagem/documento digitalizado de requisicaoimagem (Img, longblob),
 * servidos sob demanda pelo visualizador aberto em /api/faturamento/imagens-legado.
 * Rota separada da de metadados de propósito: o blob pode pesar alguns MB (PDF/PNG
 * escaneado) e só o item que o operador está olhando precisa descer.
 *
 * A réplica só tem o blob das fotos do tipo 10; sem ele, o arquivo vem do S3 do
 * apLIS (../faturamento/s3Aplis.ts).
 *
 * Autorização: `Authorization: Bearer <access_token>` da sessão do operador
 * (exige canViewBilling ou a chave da tela) — igual às demais rotas de faturamento, então o browser não
 * pode usar isto direto num <img src>; o cliente busca via fetch() com o header e
 * monta um object URL.
 *
 * Variáveis de ambiente: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *   + SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para validar a sessão
 *   + AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET_NAME para o S3.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { buscarImagemRequisicaoLegado } from '../faturamento/bdLab.js';
import { lerArquivoAplisS3, s3AplisConfigurado } from '../faturamento/s3Aplis.js';

// Extensões vistas na tabela (levantamento: PNG/JPG/PDF cobrem >99,9% das linhas).
const MIME_POR_EXTENSAO: Record<string, string> = {
  JPG: 'image/jpeg',
  JPE: 'image/jpeg',
  JFI: 'image/jpeg',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  TIF: 'image/tiff',
  TIFF: 'image/tiff',
  PDF: 'application/pdf',
};

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
    const bruto = primeiro(q.id)?.trim();
    const id = Number(bruto);
    if (!bruto || !Number.isInteger(id) || id < 1) {
      res.status(400).json({ success: false, error: 'Informe id (inteiro positivo).' });
      return;
    }

    const resultado = await buscarImagemRequisicaoLegado(id);
    if ('erro' in resultado) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }
    const arquivo = resultado.arquivo;
    if (!arquivo) {
      res.status(404).json({ success: false, error: 'Imagem não encontrada.' });
      return;
    }

    let bytes = arquivo.bytes;
    if (!bytes && s3AplisConfigurado()) {
      bytes = await lerArquivoAplisS3(arquivo.nomeArquivo, arquivo.extensao);
    }
    if (!bytes) {
      res.status(404).json({ success: false, error: 'Arquivo ainda não sincronizado do apLIS. Tente novamente amanhã.' });
      return;
    }

    const extensao = (arquivo.extensao ?? '').toUpperCase();
    const mime = MIME_POR_EXTENSAO[extensao] ?? 'application/octet-stream';

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${arquivo.nomeArquivo.replace(/"/g, '')}.${arquivo.extensao ?? 'bin'}"`,
    );
    res.status(200).send(bytes);
  } catch (err) {
    console.error('[faturamento/imagem-legado-arquivo] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
