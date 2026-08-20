// api/_lib/handlers/qualidade-sync-ihq.ts
// Ação `sync-ihq` — espelha solicitações de IHQ do MySQL do laboratório em
// `qa_ihq_solicitacoes`, via service_role. NUNCA escreve coluna de curadoria
// nem de vínculo já confirmado (lamina_enviada/observacoes/status_curadoria/
// dta_envio_bloco/dta_envio_proveniencia/cod_requisicao_original/
// vinculo_proveniencia/material_lis/patologista_lis/curado_por/curado_em) —
// só as colunas de espelho entram no upsert.
//
// ⚠️ Identificação de "isto é uma solicitação de IHQ" é heurística
// (`evento.DesEvento LIKE '%IHQ%'`, ver bdLabQualidade.ts) — não há flag
// direta no schema. `material_lis`/`patologista_lis` (LIS-observado, não
// curadoria — ver o watch-list do trigger na migration 20260820140000)
// também ficam de fora deste sync por não terem fonte identificada no
// schema disponível; entram como `null` até uma fonte ser confirmada.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { ehErroConsulta, listarSolicitacoesIhqLis } from '../qualidade/bdLabQualidade.js';
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
    const resultado = await listarSolicitacoesIhqLis(inicio, fim);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const linhas = resultado.solicitacoes.map((s) => ({
      cod_requisicao_ihq: s.codRequisicaoIhq,
      dta_admissao: s.dtaAdmissao,
      dta_solicitacao_bloco: s.dtaSolicitacaoBloco,
      medico_solicitante: s.medicoSolicitante,
      status_lis: s.statusLis,
    }));

    if (linhas.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { sincronizadas: 0 } });
      return;
    }

    const { error, count } = await supabase
      .from('qa_ihq_solicitacoes')
      .upsert(linhas, { onConflict: 'cod_requisicao_ihq', count: 'exact' });

    if (error) {
      console.error('[qualidade/sync-ihq] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar solicitações de IHQ sincronizadas.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-ihq] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar IHQ.' });
  }
}
