// api/_lib/handlers/qualidade-sync-cortesias.ts
// Ação `sync-cortesias` — espelha `requisicaoautorizacao` (+ requisicao,
// fatconvenio, evento, fatrequisicaoprocedimento) do MySQL do laboratório em
// `qa_cortesias`, via service_role. Os campos derivados (dias_ate_autorizacao,
// situacao_prazo, aprovada_fora_do_prazo, divergencia_valores,
// preco_cortesia_nao_cadastrado) usam as MESMAS regras puras do cliente
// (api/_lib/qualidade/cortesiasRegras.ts, cópia de
// src/modules/qualidade/domain/cortesiasRegras.ts) — nunca reinventadas aqui.
//
// NUNCA escreve coluna de curadoria (motivo_id/classificacao_id/
// autorizado_por_corrigido/observacoes_curadas/status_curadoria/
// valor_concedido_corrigido/valor_particular_corrigido/curado_por/curado_em)
// — só colunas de espelho entram no payload de upsert (ver mesmo raciocínio
// do cabeçalho de qualidade-sync-ocorrencias.ts).
//
// ⚠️ `requisicaoautorizacao.Tipo` não tem, no schema, um catálogo que
// confirme qual valor é especificamente "cortesia" — ver o aviso em
// bdLabQualidade.ts. Sem `APLIS_CORTESIA_TIPO_AUTORIZACAO` configurada, este
// sync traz TODAS as autorizações do período; curadoria (status
// "descartada") é quem separa o que não for cortesia de fato.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarQualidade, tokenDoHeader } from '../qualidade/autorizacao.js';
import { ehErroConsulta, listarAutorizacoesCortesiaLis } from '../qualidade/bdLabQualidade.js';
import {
  calcularAprovadaForaDoPrazo,
  calcularDiasAteAutorizacao,
  calcularDiasEmAberto,
  calcularDivergenciaValores,
  calcularPrecoCortesiaNaoCadastrado,
  calcularSituacaoPrazo,
} from '../qualidade/cortesiasRegras.js';
import { getSupabaseAdminClient } from '../supabase.js';

const PRAZO_APROVACAO_DIAS_PADRAO = 2;
const TOLERANCIA_DIVERGENCIA_VALOR_PADRAO = 0.01;
const CONSIDERAR_DIAS_UTEIS_PADRAO = true;

interface ParametrosCortesia {
  prazoAprovacaoDias: number;
  toleranciaDivergenciaValor: number;
  considerarDiasUteis: boolean;
}

/** `qa_parametros` (módulo `cortesias`) com fallback documentado — mesmo padrão de `ihq.tat_alerta_dias` em ihq.ts. */
async function carregarParametrosCortesia(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<ParametrosCortesia> {
  const { data } = await supabase.from('qa_parametros').select('chave, valor').eq('modulo', 'cortesias');
  const porChave = new Map(((data ?? []) as { chave: string; valor: unknown }[]).map((l) => [l.chave, l.valor]));

  const prazoAprovacaoDias = Number(porChave.get('cortesias.prazo_aprovacao_dias') ?? PRAZO_APROVACAO_DIAS_PADRAO);
  const toleranciaDivergenciaValor = Number(
    porChave.get('cortesias.tolerancia_divergencia_valor') ?? TOLERANCIA_DIVERGENCIA_VALOR_PADRAO,
  );
  const bruto = porChave.get('cortesias.considerar_dias_uteis');
  const considerarDiasUteis = bruto === undefined ? CONSIDERAR_DIAS_UTEIS_PADRAO : bruto === true || bruto === 'true';

  return {
    prazoAprovacaoDias: Number.isFinite(prazoAprovacaoDias) ? prazoAprovacaoDias : PRAZO_APROVACAO_DIAS_PADRAO,
    toleranciaDivergenciaValor: Number.isFinite(toleranciaDivergenciaValor)
      ? toleranciaDivergenciaValor
      : TOLERANCIA_DIVERGENCIA_VALOR_PADRAO,
    considerarDiasUteis,
  };
}

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
    const resultado = await listarAutorizacoesCortesiaLis(inicio, fim);
    if (ehErroConsulta(resultado)) {
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const parametros = await carregarParametrosCortesia(supabase);
    const hoje = new Date().toISOString().slice(0, 10);

    const linhas = resultado.cortesias.map((c) => {
      const diasAteAutorizacao = calcularDiasAteAutorizacao(c.dtaSolicitacao, c.dtaAutorizacao, parametros.considerarDiasUteis);
      const diasEmAberto = c.dtaAutorizacao ? null : calcularDiasEmAberto(c.dtaSolicitacao, hoje, parametros.considerarDiasUteis);
      const situacaoPrazo = calcularSituacaoPrazo(diasAteAutorizacao, c.dtaAutorizacao, parametros.prazoAprovacaoDias, diasEmAberto);

      return {
        id_requisicao_lis: c.idRequisicaoLis,
        cod_requisicao: c.codRequisicao,
        dta_solicitacao: c.dtaSolicitacao,
        dta_autorizacao: c.dtaAutorizacao,
        clinica_id_lis: c.clinicaIdLis,
        clinica_nome: c.clinicaNome,
        exame_nome: c.exameNome,
        valor_particular: c.valorParticular,
        valor_cobrado: c.valorCobrado,
        valor_concedido: c.valorConcedido,
        autorizado_por_lis: c.autorizadoPorLis,
        observacoes_lis: c.observacoesLis,
        parsing_falhou: false,
        dias_ate_autorizacao: diasAteAutorizacao,
        situacao_prazo: situacaoPrazo,
        aprovada_fora_do_prazo: calcularAprovadaForaDoPrazo(situacaoPrazo),
        divergencia_valores: calcularDivergenciaValores(c.valorParticular, c.valorCobrado, c.valorConcedido, parametros.toleranciaDivergenciaValor),
        preco_cortesia_nao_cadastrado: calcularPrecoCortesiaNaoCadastrado(c.valorConcedido),
        sincronizado_em: new Date().toISOString(),
      };
    });

    if (linhas.length === 0) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data: { sincronizadas: 0 } });
      return;
    }

    const { error, count } = await supabase
      .from('qa_cortesias')
      .upsert(linhas, { onConflict: 'cod_requisicao', count: 'exact' });

    if (error) {
      console.error('[qualidade/sync-cortesias] erro ao gravar:', describeError(error));
      res.status(500).json({ success: false, error: 'Falha ao gravar cortesias sincronizadas.' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { sincronizadas: count ?? linhas.length } });
  } catch (err) {
    console.error('[qualidade/sync-cortesias] erro:', describeError(err));
    res.status(500).json({ success: false, error: 'Erro interno ao sincronizar Cortesias.' });
  }
}
