// api/_lib/handlers/qualidade-sync-ocorrencias.ts
// Ação `sync-ocorrencias` — espelha `ocorrencia` (+ `requisicao`) do MySQL do
// laboratório em `qa_ocorrencias`, via service_role (bypassa RLS). NUNCA
// escreve coluna de curadoria (colaborador_id/setor_erro_id/motivo_id/
// resumo_curado/acao_curada/curado_por/curado_em/status_curadoria) — só as
// colunas de espelho entram no payload de upsert, então um conflito só
// atualiza essas colunas (semântica padrão do upsert do PostgREST); o
// trigger `qa_ocorrencias_auditoria_trigger` (20260820120000) confirma isso
// do lado do banco: só audita quando uma coluna de curadoria muda E
// `auth.uid()` não é nulo — uma conexão service_role nunca dispara auditoria.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { ehErroConsulta, listarOcorrenciasLis } from '../qualidade/bdLabQualidade.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoSync {
  inicio?: unknown;
  fim?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido.' });
    return;
  }

  const erroAuth = await autorizarQualidade(tokenDoHeader(req.headers.authorization), 'canManageQualidade');
  if (erroAuth) {
    res.status(erroAuth.status).json(erroAuth.payload);
    return;
  }

  const corpo = req.body as CorpoSync;
  const inicio = typeof corpo?.inicio === 'string' ? corpo.inicio : null;
  const fim = typeof corpo?.fim === 'string' ? corpo.fim : null;
  if (!inicio || !fim) {
    res.status(400).json({ success: false, error: 'Informe "inicio" e "fim" (YYYY-MM-DD).' });
    return;
  }

  try {
    const resultado = await listarOcorrenciasLis(inicio, fim);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const linhas = resultado.ocorrencias.map((o) => ({
      id_ocorrencia_lis: o.idOcorrenciaLis,
      num_cod: o.numCod,
      dta_ocorrencia: o.dtaOcorrencia,
      cod_requisicao: o.codRequisicao,
      descricao_lis: o.descricaoLis,
      acao_imediata_lis: o.acaoImediataLis,
      cau_descricao_lis: o.cauDescricaoLis,
      // Sem catálogo de códigos de Origem localizado no schema — ver
      // cabeçalho de bdLabQualidade.ts. Nunca inventa uma categoria.
      categoria_origem_lis: null,
      categoria_origem_generica: true,
    }));

    if (linhas.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { sincronizadas: 0 } });
      return;
    }

    const { error, count } = await supabase
      .from('qa_ocorrencias')
      .upsert(linhas, { onConflict: 'id_ocorrencia_lis', count: 'exact' });

    if (error) {
      console.error('[qualidade/sync-ocorrencias] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar ocorrências sincronizadas.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-ocorrencias] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar Ocorrências.' });
  }
}
