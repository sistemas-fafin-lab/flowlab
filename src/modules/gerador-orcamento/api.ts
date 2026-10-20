// Adapter da lista de preços do Gerador de Orçamento: GET /api/atendimento/gerador-orcamento-precos
// com o token da sessão (a rota valida o JWT + canUseGeradorOrcamento). O custo não vem
// nesta resposta: o servidor nem o consulta.

import { supabase } from '../../lib/supabase';
import type { ItemGeradorOrcamento } from './types';

/** Item como sai do servidor: `nome` é null quando o TUSS não tem exame cadastrado. */
type ItemResposta = Omit<ItemGeradorOrcamento, 'nome'> & { nome: string | null };

interface RespostaPrecos {
  success?: boolean;
  error?: string;
  itens?: ItemResposta[];
}

const FALHA_PADRAO = 'Não foi possível carregar a lista de exames.';

/** Busca a lista de preços. Lança com uma mensagem pronta para a tela. */
export async function buscarListaPrecos(): Promise<ItemGeradorOrcamento[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  let res: Response;
  try {
    res = await fetch('/api/atendimento/gerador-orcamento-precos', {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(`${FALHA_PADRAO} Verifique a conexão.`);
  }
  const body = (await res.json().catch(() => ({}))) as RespostaPrecos;
  if (!res.ok || !body.success || !Array.isArray(body.itens)) {
    throw new Error(body.error || FALHA_PADRAO);
  }

  // Item sem nome (TUSS com preço Particular mas sem exame em custo_exames) não é
  // orçável: a Tabela-Particular já o descartava, e o Gerador faz o mesmo.
  return body.itens.filter((i): i is ItemGeradorOrcamento => !!i.nome);
}
