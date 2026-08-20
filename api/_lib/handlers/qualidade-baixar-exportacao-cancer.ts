// api/_lib/handlers/qualidade-baixar-exportacao-cancer.ts
// Ação `baixar-exportacao-cancer` — devolve uma signed URL de curta duração
// para o CSV gravado por gerar-exportacao-cancer.ts, no bucket PRIVADO
// `qualidade-exportacoes-rhc`. Nunca expõe o bucket como público (PII
// completa no arquivo).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { getSupabaseAdminClient } from '../supabase.js';

const BUCKET_EXPORTACOES = 'qualidade-exportacoes-rhc';
const EXPIRACAO_SEGUNDOS = 300;

interface CorpoBaixar {
  id?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const erroAuth = await autorizarQualidade(tokenDoHeader(req.headers.authorization), 'canViewQualidade');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const corpo = req.body as CorpoBaixar;
  const id = typeof corpo?.id === 'string' ? corpo.id : null;
  if (!id) {
    res.status(400).json({ success: false, error: 'Informe "id".' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('qa_exportacoes_rhc').select('ano, trimestre').eq('id', id).maybeSingle();
    if (error) {
      console.error('[qualidade/baixar-exportacao-cancer] erro ao ler qa_exportacoes_rhc:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao buscar exportação.' });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, error: 'Exportação não encontrada.' });
      return;
    }

    const { ano, trimestre } = data as { ano: number; trimestre: number };
    const caminhoArquivo = `${ano}/${trimestre}/${id}.csv`;

    const { data: assinado, error: erroAssinatura } = await supabase.storage
      .from(BUCKET_EXPORTACOES)
      .createSignedUrl(caminhoArquivo, EXPIRACAO_SEGUNDOS);
    if (erroAssinatura || !assinado?.signedUrl) {
      console.error('[qualidade/baixar-exportacao-cancer] erro ao assinar URL:', describeError(erroAssinatura ?? 'signedUrl ausente'));
      res.status(500).json({ success: false, error: 'Falha ao gerar link de download.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { url: assinado.signedUrl } });
  } catch (err) {
    console.error('[qualidade/baixar-exportacao-cancer] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao gerar link de download.' });
  }
}
