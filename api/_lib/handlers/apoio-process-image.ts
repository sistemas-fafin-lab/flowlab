/**
 * API Route: POST /api/analises-clinicas/apoio-process-image
 *
 * Roda o pipeline de OCR da requisição médica (Envio ao Apoio). O SPA sobe os
 * arquivos direto no bucket privado 'ac-apoio-requisicoes' (policy authenticated)
 * e manda aqui só os paths — evita o limite de corpo da Vercel e mantém os
 * originais para auditoria. O handler baixa via service role, chama Gemini/apLIS
 * e devolve o resultado completo do pipeline (api/_lib/apoio/pipeline.ts).
 *
 * Autorização: JWT de SESSÃO do operador (canManageColetas), como nas demais
 * rotas do módulo. Body: { paths: string[] (1..4), numero_requisicao?: string }.
 *
 * Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GEMINI_API_KEY, GEMINI_MODEL (opcional), APLIS_BASE_URL/USUARIO/SENHA/TOKEN,
 *   AOL_ENTIDADE, AOL_IDAGENTE (entram no XML sugerido).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdminClient } from '../supabase.js';
import { autorizarOperador } from '../recepcaoAgendamento.js';
import { describeError } from '../errors.js';
import { processarRequisicao } from '../apoio/pipeline.js';
import { mimePorNome, type ArquivoRequisicao } from '../apoio/gemini.js';

const BUCKET = 'ac-apoio-requisicoes';
const MAX_ARQUIVOS = 4;

function extrairPaths(body: unknown): string[] | null {
  const paths = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_ARQUIVOS) return null;
  const limpos: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string' || !p.trim() || p.includes('..')) return null;
    limpos.push(p.trim());
  }
  return limpos;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const erroAuth = await autorizarOperador(token);
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const paths = extrairPaths(req.body);
  if (!paths) {
    res.status(400).json({
      success: false,
      error: `Informe 'paths' com 1 a ${MAX_ARQUIVOS} arquivo(s) do bucket ${BUCKET}.`,
    });
    return;
  }
  const numeroRequisicao =
    typeof (req.body as { numero_requisicao?: unknown })?.numero_requisicao === 'string'
      ? ((req.body as { numero_requisicao: string }).numero_requisicao)
      : null;

  try {
    const supabase = getSupabaseAdminClient();

    const arquivos: ArquivoRequisicao[] = [];
    for (const path of paths) {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) {
        res.status(400).json({
          success: false,
          error: `Arquivo não encontrado no bucket: ${path}`,
        });
        return;
      }
      const filename = path.split('/').pop() ?? path;
      arquivos.push({
        data: Buffer.from(await data.arrayBuffer()),
        mimeType: mimePorNome(filename),
        filename,
      });
    }

    const resultado = await processarRequisicao(supabase, arquivos, numeroRequisicao);
    res.status(200).json(resultado);
  } catch (err) {
    console.error('[analises-clinicas/apoio-process-image] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao processar a requisição.' });
  }
}
