// Dados do Relatório mensal de EPI (aba EPIs da Qualidade). Lê direto do Supabase as
// solicitações de materiais do mês, os produtos EPI e as movimentações dessas solicitações;
// as regras de inclusão ficam no domínio (domain/epiRelatorioMensal.ts). Calculado na hora:
// nesta fatia não há fechamento nem conteúdo congelado.

import { supabase } from '../../lib/supabase.js';
import { camposEpiDaLinha, COLUNAS_EPI_PRODUTO, type CopiaIdentificacaoEpi } from '../../utils/epi.js';
import type { DadosRelatorioEpi, SolicitacaoParaEpi } from './domain/epiRelatorioMensal.js';

/** Ids por consulta de movimentações: mantém a URL do `in(...)` curta. */
const LOTE_IDS = 100;

/** Primeiro e último dia de um mês YYYY-MM, sem `new Date` local (sem fuso). */
function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

interface ItemGravado {
  id?: string;
  productId?: string | null;
  productName?: string;
  quantity?: number;
  identificacaoEpi?: CopiaIdentificacaoEpi;
}

/** Solicitações de materiais do mês (YYYY-MM), produtos EPI e as movimentações delas. */
export async function buscarDadosRelatorioEpi(mes: string): Promise<DadosRelatorioEpi> {
  const { inicio, fim } = limitesDoMes(mes);

  const [solicitacoesRes, produtosRes] = await Promise.all([
    supabase
      .from('requests')
      .select('id, type, status, request_date, department, requested_by, items')
      .eq('type', 'SM')
      .gte('request_date', inicio)
      .lte('request_date', fim),
    supabase.from('products').select(`id, ${COLUNAS_EPI_PRODUTO}`).eq('is_epi', true),
  ]);
  if (solicitacoesRes.error) throw solicitacoesRes.error;
  if (produtosRes.error) throw produtosRes.error;

  const solicitacoes: SolicitacaoParaEpi[] = (solicitacoesRes.data ?? []).map((r) => ({
    id: r.id,
    type: r.type as SolicitacaoParaEpi['type'],
    status: r.status,
    requestDate: r.request_date,
    department: r.department,
    requestedBy: r.requested_by ?? '',
    items: ((Array.isArray(r.items) ? r.items : []) as ItemGravado[]).map((item, i) => ({
      id: item.id ?? `${r.id}-${i}`,
      productId: item.productId ?? null,
      productName: item.productName ?? '',
      quantity: Number(item.quantity) || 0,
      identificacaoEpi: item.identificacaoEpi,
    })),
  }));

  const produtos = (produtosRes.data ?? []).map((p) => ({ id: p.id as string, ...camposEpiDaLinha(p) }));

  // Só as concluídas podem ter sido baixadas.
  const concluidas = solicitacoes.filter((s) => s.status === 'completed').map((s) => s.id);
  const movimentacoes: DadosRelatorioEpi['movimentacoes'] = [];
  for (let i = 0; i < concluidas.length; i += LOTE_IDS) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('request_id, product_id')
      .in('request_id', concluidas.slice(i, i + LOTE_IDS));
    if (error) throw error;
    for (const m of data ?? []) movimentacoes.push({ requestId: m.request_id, productId: m.product_id });
  }

  return { solicitacoes, produtos, movimentacoes };
}
