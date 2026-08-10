/**
 * API Route: POST /api/faturamento/operadoras-sync
 *
 * Espelha as fontes pagadoras ativas do apLIS em `operadoras`, por `aplis_id`.
 *
 * Existe para que o financeiro possa cadastrar o `prazo_pagamento_dias` de cada
 * operadora ANTES do primeiro título — sem isso, o vencimento cairia sempre no
 * default de 30 dias. `fat_criar_titulo` também faz o upsert da operadora do
 * lote, então esta rota é conveniência, não pré-requisito.
 *
 * `prazo_pagamento_dias` fica de fora do UPDATE de propósito: é editado no
 * FlowLab e a sync não pode desfazer o ajuste do financeiro.
 *
 * Autorização: sessão com canManageBilling. Escreve com service_role — é um
 * espelhamento de sistema, não uma ação sobre um título específico.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describeError } from '../errors.js';
import { autorizarFaturamento, tokenDoHeader } from '../faturamento/autorizacao.js';
import { listarFontesPagadoras } from '../faturamento/bdLab.js';
import { getSupabaseAdminClient } from '../supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Método não permitido' });
    return;
  }

  const supabase = getSupabaseAdminClient();
  let logId: string | null = null;

  try {
    const erroAuth = await autorizarFaturamento(
      tokenDoHeader(req.headers.authorization),
      'canManageBilling',
    );
    if (erroAuth) {
      res.status(erroAuth.status).json(erroAuth.payload);
      return;
    }

    const { data: log } = await supabase
      .from('billing_sync_log')
      .insert({ sync_type: 'operadoras', status: 'running' })
      .select('id')
      .single();
    logId = log?.id ?? null;

    const resultado = await listarFontesPagadoras();
    if ('erro' in resultado) {
      if (logId) {
        await supabase.from('billing_sync_log').update({
          status: 'error', finished_at: new Date().toISOString(), error_message: resultado.erro.mensagem,
        }).eq('id', logId);
      }
      res.status(resultado.erro.status).json({ success: false, error: resultado.erro.mensagem });
      return;
    }

    // O upsert é por aplis_id. `operadoras.cnpj` não é UNIQUE (migration
    // 20260810120000): no apLIS o mesmo CNPJ aparece em mais de uma instituição
    // (matriz e filiais, planos distintos da mesma operadora), e gravar o valor
    // real em cada uma é o que faz sentido.
    const linhas = resultado.fontes.map((fonte) => ({
      aplis_id: String(fonte.id),
      nome: fonte.nome ?? fonte.razaoSocial ?? `Operadora ${fonte.id}`,
      cnpj: fonte.cpfCnpj ?? null,
    }));

    const { data: gravadas, error } = await supabase
      .from('operadoras')
      .upsert(linhas, { onConflict: 'aplis_id' })
      .select('id_operadora');

    if (error) {
      if (logId) {
        await supabase.from('billing_sync_log').update({
          status: 'error', finished_at: new Date().toISOString(),
          records_processed: linhas.length, error_message: error.message,
        }).eq('id', logId);
      }
      console.error('[faturamento/operadoras-sync] upsert:', error.message);
      res.status(500).json({ success: false, error: 'Não foi possível gravar as operadoras.' });
      return;
    }

    if (logId) {
      await supabase.from('billing_sync_log').update({
        status: 'success',
        finished_at: new Date().toISOString(),
        records_processed: linhas.length,
        records_updated: gravadas?.length ?? 0,
      }).eq('id', logId);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, sincronizadas: gravadas?.length ?? 0 });
  } catch (err) {
    const descricao = describeError(err);
    if (logId) {
      await supabase.from('billing_sync_log').update({
        status: 'error', finished_at: new Date().toISOString(), error_message: descricao,
      }).eq('id', logId).then(() => undefined, () => undefined);
    }
    console.error('[faturamento/operadoras-sync] erro:', descricao);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
