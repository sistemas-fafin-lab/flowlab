// api/_lib/handlers/qualidade-sync-ihq.ts
// Ação `sync-ihq` — espelha solicitações de IHQ do MySQL do laboratório em
// `qa_ihq_solicitacoes`, via service_role. NUNCA escreve coluna de curadoria
// nem de vínculo já CONFIRMADO MANUALMENTE (lamina_enviada/observacoes/
// status_curadoria/dta_envio_bloco/dta_envio_proveniencia/material_lis/
// patologista_lis/curado_por/curado_em) — só as colunas de espelho entram no
// upsert.
//
// As colunas de VÍNCULO HEURÍSTICO (cod_requisicao_original/
// vinculo_proveniencia/vinculo_confianca) SÃO recalculadas aqui a cada sync
// — `nivelConfiancaVinculo` (R1, ihqRegras.ts) —, mas só para solicitações
// cujo `vinculo_proveniencia` ainda não seja `'manual'`. Antes desta issue
// (05-nivelconfiancavinculo-nunca-invocada.md) a heurística nunca era
// chamada em lugar nenhum do backend: `vinculo_confianca` ficava sempre no
// default do banco e o filtro "vínculo a confirmar" do frontend nunca batia
// para nada recém-sincronizado.
//
// ⚠️ Identificação de "isto é uma solicitação de IHQ" é heurística
// (`evento.DesEvento LIKE '%IHQ%'`, ver bdLabQualidade.ts) — não há flag
// direta no schema. `material_lis`/`patologista_lis` (LIS-observado, não
// curadoria — ver o watch-list do trigger na migration 20260820140000)
// também ficam de fora deste sync por não terem fonte identificada no
// schema disponível; entram como `null` até uma fonte ser confirmada.
//
// ⚠️ Uma consulta `buscarCandidatasVinculoIhqLis` por solicitação NÃO-manual
// (N+1) — `comConexao` (bdLabQualidade.ts) abre uma conexão MySQL dedicada
// por chamada, não vem de um pool —, por isso roda SEQUENCIAL (não
// `Promise.all`) para não abrir dezenas de conexões simultâneas no banco do
// LIS, compartilhado com outros módulos. Medir se o volume real de IHQ por
// período torna isso aceitável (ver issue 05).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { buscarCandidatasVinculoIhqLis, ehErroConsulta, listarSolicitacoesIhqLis } from '../qualidade/bdLabQualidade.js';
import { nivelConfiancaVinculo, type CandidataVinculoIhqPura, type NivelConfianca } from '../qualidade/ihqRegras.js';
import { getSupabaseAdminClient } from '../supabase.js';

interface CorpoSync {
  inicio?: unknown;
  fim?: unknown;
}

const JANELA_VINCULO_DIAS_PADRAO = 30;

/** `app_parametros` (`ihq.janela_vinculo_dias`) — mesmo parâmetro lido em qualidade-buscar-detalhe-ihq.ts (duplicado aqui: mesmo padrão de carregarParametrosCortesia em qualidade-sync-cortesias.ts, sem helper cross-handler). */
async function carregarJanelaVinculoDias(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<number> {
  const { data } = await supabase
    .from('app_parametros')
    .select('valor')
    .eq('modulo', 'ihq')
    .eq('chave', 'ihq.janela_vinculo_dias')
    .maybeSingle();
  const valor = Number((data as { valor: unknown } | null)?.valor ?? JANELA_VINCULO_DIAS_PADRAO);
  return Number.isFinite(valor) && valor > 0 ? valor : JANELA_VINCULO_DIAS_PADRAO;
}

/**
 * Candidata que a heurística resolve sozinha como `cod_requisicao_original`.
 * R1 só autorresolve confiança `alta` (candidata única) e `media` (única com
 * peça) — `baixa`/`nenhuma` ficam sem vínculo automático, para curadoria
 * manual (ver VinculoDrawer.tsx `precisaConfirmar` no frontend).
 */
function candidataResolvida(confianca: NivelConfianca, candidatas: readonly CandidataVinculoIhqPura[]): string | null {
  if (confianca === 'alta') return candidatas[0]?.codRequisicaoOriginal ?? null;
  if (confianca === 'media') return candidatas.find((c) => c.temPeca)?.codRequisicaoOriginal ?? null;
  return null;
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

    const { data: upsertadas, error, count } = await supabase
      .from('qa_ihq_solicitacoes')
      .upsert(linhas, { onConflict: 'cod_requisicao_ihq', count: 'exact' })
      .select('id, cod_requisicao_ihq, vinculo_proveniencia');

    if (error) {
      console.error('[qualidade/sync-ihq] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar solicitações de IHQ sincronizadas.' });
      return;
    }

    const idPorRequisicao = new Map(
      ((upsertadas ?? []) as { id: string; cod_requisicao_ihq: string; vinculo_proveniencia: string | null }[]).map((l) => [
        l.cod_requisicao_ihq,
        l,
      ]),
    );

    const janelaDias = await carregarJanelaVinculoDias(supabase);

    // Sequencial de propósito — ver aviso de conexões no topo do arquivo.
    for (const solicitacao of resultado.solicitacoes) {
      const linha = idPorRequisicao.get(solicitacao.codRequisicaoIhq);
      if (!linha || linha.vinculo_proveniencia === 'manual' || solicitacao.codPaciente === null) continue;

      const resultadoCandidatas = await buscarCandidatasVinculoIhqLis(
        solicitacao.codPaciente,
        solicitacao.dtaAdmissao,
        solicitacao.codRequisicaoIhq,
        janelaDias,
      );
      if (ehErroConsulta(resultadoCandidatas)) {
        console.error(
          `[qualidade/sync-ihq] falha ao calcular vínculo de ${solicitacao.codRequisicaoIhq}:`,
          resultadoCandidatas.erro.mensagem,
        );
        continue;
      }

      const confianca = nivelConfiancaVinculo(resultadoCandidatas.candidatas);
      const codRequisicaoOriginal = candidataResolvida(confianca, resultadoCandidatas.candidatas);

      const { error: erroVinculo } = await supabase
        .from('qa_ihq_solicitacoes')
        .update({
          vinculo_confianca: confianca,
          vinculo_proveniencia: 'heuristica',
          cod_requisicao_original: codRequisicaoOriginal,
        })
        .eq('id', linha.id);

      if (erroVinculo) {
        console.error(`[qualidade/sync-ihq] falha ao gravar vínculo de ${solicitacao.codRequisicaoIhq}:`, describeError(erroVinculo));
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-ihq] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar IHQ.' });
  }
}
