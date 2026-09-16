// api/_lib/handlers/rh-holerites-preview.ts
// Ação `holerites-preview` — parseia o PDF consolidado já enviado ao path
// temporário (RH sobe direto pro Storage via supabase-js, protegido pela RLS
// de storage.objects/canManageHolerites — ver EnviarHoleritesSection) e
// devolve a tela de conferência: blocos casados, sem competência legível,
// CPFs não casados e páginas sem CPF legível. NÃO grava nada — é só leitura,
// para o RH revisar antes de confirmar (rh-holerites-confirmar reprocessa o
// mesmo PDF do zero, não usa nada do corpo desta resposta como fonte de
// verdade).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarRhERetornarUsuario, tokenDoHeader } from '../rh/autorizacao.js';
import { extrairTextoPorPagina } from '../rh/holeritesPdf.js';
import { processarHolerites } from '../rh/holeritesProcessamento.js';
import { BUCKET_HOLERITES, tempPathValido } from '../rh/holeritesStorage.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoPreview {
  tempPath?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const token = tokenDoHeader(req.headers.authorization);
  const autorizacao = await autorizarRhERetornarUsuario(token);
  if (!('userId' in autorizacao)) {
    res.status(autorizacao.status).json(autorizacao.payload);
    return;
  }

  const corpo = req.body as CorpoPreview;
  if (!tempPathValido(corpo?.tempPath)) {
    res.status(400).json({ success: false, error: 'Parâmetro "tempPath" ausente ou inválido.' });
    return;
  }
  const tempPath = corpo.tempPath;

  const supabase = getSupabaseAdminClient();

  try {
    const { data: arquivo, error: erroDownload } = await supabase.storage.from(BUCKET_HOLERITES).download(tempPath);
    if (erroDownload || !arquivo) {
      res.status(404).json({ success: false, error: 'Arquivo temporário não encontrado. Envie o PDF novamente.' });
      return;
    }
    const bytes = Buffer.from(await arquivo.arrayBuffer());

    let textosPorPagina: string[];
    try {
      textosPorPagina = await extrairTextoPorPagina(bytes);
    } catch (err) {
      console.error('[rh/holerites-preview] falha ao ler PDF:', describeError(err));
      res.status(400).json({ success: false, error: 'Não foi possível ler o PDF. Confira se o arquivo não está corrompido ou protegido por senha.' });
      return;
    }

    const [{ data: colaboradores, error: erroColaboradores }, { data: existentes, error: erroExistentes }] =
      await Promise.all([
        supabase.from('colaboradores').select('id, nome, cpf'),
        supabase.from('colaborador_holerites').select('colaborador_id, competencia'),
      ]);
    if (erroColaboradores || erroExistentes) {
      console.error('[rh/holerites-preview] erro ao ler colaboradores/holerites existentes:', describeError(erroColaboradores ?? erroExistentes));
      res.status(500).json({ success: false, error: 'Falha ao ler cadastro de colaboradores.' });
      return;
    }

    const resultado = processarHolerites(
      textosPorPagina,
      (colaboradores ?? []) as { id: string; nome: string; cpf: string }[],
      (existentes ?? []).map((h) => ({ colaboradorId: h.colaborador_id as string, competencia: h.competencia as string })),
    );

    res.status(200).json({ success: true, data: resultado });
  } catch (err) {
    console.error('[rh/holerites-preview] erro inesperado:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao processar o PDF.' });
  }
}
