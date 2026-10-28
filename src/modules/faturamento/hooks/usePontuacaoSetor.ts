import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FrentePontuacao,
  LancamentoPontuacao,
  MembroPontuacao,
  PontoBasePontuacao,
  PontuacaoSetor,
  PontuacaoSetorMeta,
  UsuarioAplisPontuacao,
} from '../types';
import { chamarLegadoApi, getTokenLegado } from './legado/api';

// Pontuação do setor (Faturamento → Indicadores): lê o resumo pronto de
// /api/faturamento/pontuacao. A pontuação é mensal: com `mes` nulo (modo
// Período) não chama a API. `lancarPontuacao` grava um critério manual;
// `fecharPontuacao` e `reabrirPontuacao` fazem o Fechamento da pontuação. As
// funções de membros servem a tela "Membros" (issue 07), e as de pontos base, a
// tela "Pontos base".

interface RespostaPontuacao {
  success?: boolean;
  error?: string;
  meta?: PontuacaoSetorMeta;
  pontuacao?: PontuacaoSetor;
}

const MENSAGEM_ERRO = 'Não foi possível carregar a pontuação do setor.';

export function usePontuacaoSetor(mes: string | null) {
  const [pontuacao, setPontuacao] = useState<PontuacaoSetor | null>(null);
  const [meta, setMeta] = useState<PontuacaoSetorMeta | null>(null);
  const [loading, setLoading] = useState(mes !== null);
  const [error, setError] = useState<string | null>(null);
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    if (mes === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = await chamarLegadoApi<RespostaPontuacao>('pontuacao', new URLSearchParams({ mes }), MENSAGEM_ERRO);
      if (reqId !== buscaAtual.current) return;
      setPontuacao(body.pontuacao ?? null);
      setMeta(body.meta ?? null);
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO);
      setPontuacao(null);
      setMeta(null);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { pontuacao, meta, loading, error, refetch };
}

/** POST de quem gerencia Faturamento. Lança com a mensagem da rota. */
async function postarPontuacao(corpo: Record<string, unknown>, mensagemErro: string): Promise<void> {
  const token = await getTokenLegado();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch('/api/faturamento/pontuacao', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || !body.success) {
    throw new Error(body.error || mensagemErro);
  }
}

/** Lança ou altera um critério manual (canManageBilling). */
export function lancarPontuacao(lancamento: LancamentoPontuacao): Promise<void> {
  return postarPontuacao({ acao: 'lancar', ...lancamento }, 'Não foi possível gravar o lançamento.');
}

/** Congela o mês com a prévia recalculada no servidor (canManageBilling). */
export function fecharPontuacao(mes: string): Promise<void> {
  return postarPontuacao({ acao: 'fechar', mes }, 'Não foi possível fechar a pontuação.');
}

/** Volta o mês para a prévia ao vivo; os lançamentos continuam (canManageBilling). */
export function reabrirPontuacao(mes: string): Promise<void> {
  return postarPontuacao({ acao: 'reabrir', mes }, 'Não foi possível reabrir a pontuação.');
}

/** Membros das Frentes, com os desativados (canManageBilling). */
export async function listarMembrosPontuacao(): Promise<MembroPontuacao[]> {
  const body = await chamarLegadoApi<{ success?: boolean; error?: string; membros?: MembroPontuacao[] }>(
    'pontuacao',
    new URLSearchParams({ consulta: 'membros' }),
    'Não foi possível carregar os membros das Frentes.',
  );
  return body.membros ?? [];
}

/** Usuários ativos do apLIS pelo nome (canManageBilling). */
export async function buscarUsuariosAplis(busca: string): Promise<UsuarioAplisPontuacao[]> {
  const body = await chamarLegadoApi<{ success?: boolean; error?: string; usuarios?: UsuarioAplisPontuacao[] }>(
    'pontuacao',
    new URLSearchParams({ consulta: 'usuariosAplis', busca }),
    'Não foi possível buscar os usuários do apLIS.',
  );
  return body.usuarios ?? [];
}

/** Inclui, ou reativa, o usuário do apLIS na Frente (canManageBilling). */
export function incluirMembroPontuacao(frente: FrentePontuacao, idUsuarioAplis: number): Promise<void> {
  return postarPontuacao({ acao: 'incluirMembro', frente, idUsuarioAplis }, 'Não foi possível incluir o membro.');
}

/** Desativa o membro da Frente, sem apagar (canManageBilling). */
export function desativarMembroPontuacao(frente: FrentePontuacao, idUsuarioAplis: number): Promise<void> {
  return postarPontuacao({ acao: 'desativarMembro', frente, idUsuarioAplis }, 'Não foi possível desativar o membro.');
}

/** Todos os critérios, com o padrão e o ponto base em vigor (canManageBilling). */
export async function listarPontosBase(): Promise<PontoBasePontuacao[]> {
  const body = await chamarLegadoApi<{ success?: boolean; error?: string; pontosBase?: PontoBasePontuacao[] }>(
    'pontuacao',
    new URLSearchParams({ consulta: 'pontosBase' }),
    'Não foi possível carregar os pontos base.',
  );
  return body.pontosBase ?? [];
}

/** Grava os pontos base dos critérios listados; vale para os meses abertos (canManageBilling). */
export function alterarPontosBase(
  pontosBase: { frente: FrentePontuacao; chave: string; pontosBase: number }[],
): Promise<void> {
  return postarPontuacao({ acao: 'alterarPontosBase', pontosBase }, 'Não foi possível gravar os pontos base.');
}
