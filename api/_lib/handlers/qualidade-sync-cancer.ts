// api/_lib/handlers/qualidade-sync-cancer.ts
// Ação `sync-cancer` — espelha o universo de diagnósticos positivos
// (`requisicaodiagnostico.Positivo = 1`, ver bdLabQualidade.ts) do MySQL do
// laboratório em `qa_cancer_casos`, via service_role. R2/P1: TODOS os
// positivos entram, nunca filtrados por heurística de candidatura — a
// heurística (cancerRegras.ts) só se aplica na LEITURA (buscar-funil-cancer),
// nunca decide o que sincroniza. NUNCA escreve coluna de curadoria
// (triagem/triagem_justificativa/cido_topografia_codigo/
// cido_morfologia_codigo/observacoes/triado_por/triado_em/classificado_por/
// classificado_em) — só as colunas de espelho entram no upsert. Nenhuma
// coluna de PII (P10) é gravada — nome/sexo/CPF ficam só na resposta de
// buscar-funil-cancer/buscar-detalhe-cancer, lidos do LIS sob demanda.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { ehErroConsulta, listarDiagnosticosPositivosLis } from '../qualidade/bdLabQualidade.js';
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
    const resultado = await listarDiagnosticosPositivosLis(inicio, fim);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const linhas = resultado.casos.map((c) => ({
      cod_requisicao: c.codRequisicao,
      dta_diagnostico: c.dtaDiagnostico,
      dta_coleta: c.dtaColeta,
      // Sem segunda fonte de data para comparar no schema disponível — nunca
      // marca divergência sem poder sustentá-la (ver cabeçalho do handler).
      dta_coleta_divergente: false,
    }));

    if (linhas.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { sincronizadas: 0 } });
      return;
    }

    const { error, count } = await supabase
      .from('qa_cancer_casos')
      .upsert(linhas, { onConflict: 'cod_requisicao', count: 'exact' });

    if (error) {
      console.error('[qualidade/sync-cancer] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar casos de Registro de Câncer sincronizados.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-cancer] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar Registro de Câncer.' });
  }
}
