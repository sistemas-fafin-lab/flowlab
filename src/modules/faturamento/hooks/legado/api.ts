import { supabase } from '../../../../lib/supabase';

// Esqueleto comum de todo hook que lê o MySQL de backup do laboratório via
// /api/faturamento/*: token da sessão do operador (a rota valida o JWT +
// canViewBilling) e o fetch JSON com o contrato de erro do backend
// (`!success` → mensagem de erro). Era copiado em cada hook "legado"
// (useFaturamentoLotes, useGlosasLegado, useRecursosLegado,
// useImagensRequisicaoLegado); agora mora num lugar só.

export async function getTokenLegado(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function chamarLegadoApi<T extends { success?: boolean; error?: string }>(
  rota: string,
  params: URLSearchParams,
  mensagemErroPadrao: string,
): Promise<T> {
  const token = await getTokenLegado();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch(`/api/faturamento/${rota}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T;

  if (!res.ok || !body.success) {
    throw new Error(body.error || mensagemErroPadrao);
  }
  return body;
}

// Padrão "detalhe sob demanda": buscarRequisicoes (useFaturamentoLotes) e
// buscarProcedimentos (useRecursosLegado) são a mesma coisa — cache por id,
// `force` fura o cache e a resposta some no cache do servidor.
export async function buscarDetalheLegadoComCache<
  TDetail,
  TBody extends { success?: boolean; error?: string } = { success?: boolean; error?: string },
>(opts: {
  rota: string;
  paramId: string;
  id: number;
  force: boolean;
  cache: Map<number, TDetail[]>;
  extrairItens: (body: TBody) => TDetail[];
  mensagemErroPadrao: string;
}): Promise<TDetail[]> {
  const { rota, paramId, id, force, cache, extrairItens, mensagemErroPadrao } = opts;
  if (!force && cache.has(id)) return cache.get(id)!;

  const params = new URLSearchParams({ [paramId]: String(id) });
  if (force) params.set('semCache', '1');

  const body = await chamarLegadoApi<TBody>(rota, params, mensagemErroPadrao);
  const itens = extrairItens(body);
  cache.set(id, itens);
  return itens;
}
