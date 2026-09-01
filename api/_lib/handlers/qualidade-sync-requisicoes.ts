// api/_lib/handlers/qualidade-sync-requisicoes.ts
// Ação `sync-requisicoes` — espelha `requisicao` (+ eventos de
// `requisicaohistorico`) do MySQL do laboratório em `qa_requisicoes`, via
// service_role (bypassa RLS). NUNCA escreve coluna de curadoria
// (motivo_retificacao_id/resumo_retificacao_curado/status_curadoria/
// curado_por/curado_em) — só as colunas de espelho entram no payload de
// upsert, então um conflito só atualiza essas colunas (semântica padrão do
// upsert do PostgREST); o trigger `qa_requisicoes_auditoria_trigger`
// (20260901120000) confirma isso do lado do banco: só audita quando uma
// coluna de curadoria muda E `auth.uid()` não é nulo — uma conexão
// service_role nunca dispara auditoria. Mesmo padrão de
// qualidade-sync-ocorrencias.ts.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { ehErroConsulta, listarRequisicoesLis } from '../qualidade/bdLabQualidade.js';
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
    const resultado = await listarRequisicoesLis(inicio, fim);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const linhas = resultado.requisicoes.map((r) => ({
      id_requisicao_lis: r.idRequisicaoLis,
      cod_requisicao: r.codRequisicao,
      cod_exame_tipo_lis: r.codExameTipoLis,
      exame_tipo_nome_lis: r.exameTipoNomeLis,
      secao_lis: r.secaoLis,
      dta_solicitacao: r.dtaSolicitacao,
      dta_coleta: r.dtaColeta,
      dta_amostra_recebida: r.dtaAmostraRecebida,
      dta_admissao: r.dtaAdmissao,
      dta_prevista: r.dtaPrevista,
      dta_liberacao: r.dtaLiberacao,
      patologista_nome_lis: r.patologistaNomeLis,
      retificado: r.retificado,
      dta_retificacao: r.dtaRetificacao,
      dta_prevista_setor: r.dtaPrevistaSetor,
      recorte_coloracao: r.recorteColoracao,
      dta_recorte_coloracao: r.dtaRecorteColoracao,
      consenso_pendente: r.consensoPendente,
      dta_consenso_criado: r.dtaConsensoCriado,
      bloco_danificado: r.blocoDanificado,
      dta_bloco_danificado: r.dtaBlocoDanificado,
      num_blocos: r.numBlocos,
      num_laminas: r.numLaminas,
      dta_primeira_lamina_pronta: r.dtaPrimeiraLaminaPronta,
      dta_microscopia_aguardando: r.dtaMicroscopiaAguardando,
      amostra_nao_recebida: r.amostraNaoRecebida,
      dta_amostra_nao_recebida: r.dtaAmostraNaoRecebida,
      material_devolvido_nao_conforme: r.materialDevolvidoNaoConforme,
      dta_material_devolvido: r.dtaMaterialDevolvido,
    }));

    if (linhas.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { sincronizadas: 0 } });
      return;
    }

    const { error, count } = await supabase
      .from('qa_requisicoes')
      .upsert(linhas, { onConflict: 'id_requisicao_lis', count: 'exact' });

    if (error) {
      console.error('[qualidade/sync-requisicoes] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar requisições sincronizadas.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-requisicoes] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar Requisições.' });
  }
}
