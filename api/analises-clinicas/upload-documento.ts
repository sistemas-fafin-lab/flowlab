/**
 * API Route: POST /api/analises-clinicas/upload-documento?agendamentoId=<uuid>&tipo=<tipo>
 *
 * Vercel Serverless Function — a recepção anexa um documento do paciente
 * (identidade, carteirinha, pedido médico) ao criar o agendamento. O arquivo chega
 * como CORPO BINÁRIO cru (Content-Type application/octet-stream); o nome exibível
 * vem no header `x-nome-arquivo` (URL-encoded). Proxy: a FLOWLAB_API_KEY é
 * server-side, então o SPA não pode chamar o LAB-HUB direto.
 *
 * Autorização: header `Authorization: Bearer <access_token>` da SESSÃO do operador
 * (exige canManageColetas) — como em get-documentos.ts, aqui `Bearer` NÃO é a
 * FLOWLAB_API_KEY.
 *
 * bodyParser desligado: precisamos dos bytes crus — o parser JSON padrão da Vercel
 * corromperia o binário. Lemos o stream manualmente, com teto de tamanho.
 *
 * Variáveis de ambiente: ver api/_lib/uploadDocumentoRecepcao.ts
 *   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LABHUB_API_URL, FLOWLAB_API_KEY).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { uploadDocumentoRecepcao } from '../_lib/uploadDocumentoRecepcao.js';
import { describeError } from '../_lib/errors.js';

export const config = { api: { bodyParser: false } };

const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;

// Lê o corpo cru em Buffer, abortando ao passar do teto — evita bufferizar um
// upload gigante na memória da função. Retorna null se estourou o limite.
async function lerCorpoCru(req: VercelRequest, limite: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const b = chunk as Buffer;
    total += b.length;
    if (total > limite) return null;
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const agendamentoId =
    typeof req.query.agendamentoId === 'string' ? req.query.agendamentoId : undefined;
  const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;

  const nomeHeader = req.headers['x-nome-arquivo'];
  let nomeArquivo: string | undefined;
  try {
    nomeArquivo = typeof nomeHeader === 'string' ? decodeURIComponent(nomeHeader) : undefined;
  } catch {
    nomeArquivo = undefined; // header malformado → cai no nome-padrão do LAB-HUB
  }

  let buffer: Buffer | null;
  try {
    buffer = await lerCorpoCru(req, TAMANHO_MAX_BYTES);
  } catch (err) {
    console.error('[analises-clinicas/upload-documento] falha ao ler corpo:', describeError(err));
    res.status(400).json({ success: false, error: 'Falha ao ler o arquivo.' });
    return;
  }
  if (buffer === null) {
    res.status(413).json({ success: false, error: 'Arquivo maior que 10 MB.' });
    return;
  }

  try {
    const { status, payload } = await uploadDocumentoRecepcao(
      token,
      agendamentoId,
      tipo,
      nomeArquivo,
      buffer,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(payload);
  } catch (err) {
    console.error('[analises-clinicas/upload-documento] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
