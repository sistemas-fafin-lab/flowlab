// Estado das telas de administração da EVA. Cada hook carrega uma lista, com guarda
// contra resposta atrasada, e expõe as ações que recarregam a lista ao terminar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { papeisEva, type PapeisEva } from '../domain/papeis';
import { agenteAdmin, type ConfigEva, type Membro, type Pessoa, type PessoaPermissoes, type Reuniao, type StatusSugestao, type Sugestao } from '../services/agenteAdmin';

/**
 * Os papéis da EVA de quem está logado (D31): configurar, gestor, aprovar. As permissões da
 * sessão já vêm com a aba Permissões aplicada (AuthContext, D33).
 */
export function usePapeisEva(): PapeisEva {
  const { userProfile } = useAuth();
  const permissoes = userProfile?.permissions;
  return useMemo(() => papeisEva(permissoes), [permissoes]);
}

function useLista<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const pedidoRef = useRef(0);

  const recarregar = useCallback(async () => {
    const pedido = ++pedidoRef.current;
    setCarregando(true);
    try {
      const r = await carregar();
      if (pedido === pedidoRef.current) { setDados(r); setErro(null); }
    } catch (e) {
      if (pedido === pedidoRef.current) setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      if (pedido === pedidoRef.current) setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { void recarregar(); }, [recarregar]);
  return { dados, erro, carregando, recarregar };
}

/** Pessoas ativas (para nomes de responsáveis e o cadastro de membros). */
export function usePessoas() {
  const { dados } = useLista(() => agenteAdmin.pessoasAtivas(), []);
  return useMemo(() => {
    const lista: Pessoa[] = dados ?? [];
    return { lista, nome: (id: string) => lista.find((p) => p.id === id)?.name ?? 'Pessoa removida' };
  }, [dados]);
}

export function useSugestoes(status: StatusSugestao | 'todas') {
  const lista = useLista<Sugestao[]>(() => agenteAdmin.listarSugestoes({ status }), [status]);
  return lista;
}

export function useReunioes() {
  return useLista<Reuniao[]>(() => agenteAdmin.listarReunioes(), []);
}

export function useMembros() {
  return useLista<Membro[]>(() => agenteAdmin.listarMembros(), []);
}

/** Aba Permissões (D33): todas as pessoas ativas com os papéis da EVA e de onde vêm. */
export function usePermissoesEva() {
  return useLista<PessoaPermissoes[]>(() => agenteAdmin.listarPermissoes(), []);
}

export function useConfigEva() {
  return useLista<ConfigEva | null>(() => agenteAdmin.lerConfig(), []);
}

export function useUsoIA() {
  return useLista(() => agenteAdmin.usoIA(), []);
}

export function useSituacaoEva() {
  return useLista(() => agenteAdmin.situacao(), []);
}

export function useProjetosESprints() {
  return useLista(() => agenteAdmin.projetosESprints(), []);
}

/**
 * Quem pode ser responsável numa sugestão: os membros ativos da EVA. Com a aba Membros
 * vazia, todas as pessoas ativas (o servidor faz o mesmo com o departamento TI).
 */
export function useResponsaveis() {
  const pessoas = usePessoas();
  const membros = useMembros();
  return useMemo(() => {
    const ativos = new Set((membros.dados ?? []).filter((m) => m.ativo).map((m) => m.user_id));
    return ativos.size > 0 ? pessoas.lista.filter((p) => ativos.has(p.id)) : pessoas.lista;
  }, [pessoas.lista, membros.dados]);
}

/**
 * O que o Início precisa da EVA: config (chips), pendentes (só para quem aprova) e a última
 * reunião analisada (chat e comentário de Projetos). Cada leitura falha sozinha: sem as tabelas
 * da EVA, o Início continua de pé e os chips dizem "ainda não configurado".
 */
export function useEvaNoInicio(podeAprovar: boolean) {
  return useLista(async () => {
    const [config, pendentes, ultimaReuniao] = await Promise.all([
      agenteAdmin.lerConfig().catch(() => null),
      podeAprovar ? agenteAdmin.contarPendentes().catch(() => null) : Promise.resolve(null),
      agenteAdmin.ultimaReuniaoAnalisada().catch(() => null),
    ]);
    const pendentesDaReuniao = ultimaReuniao ? await agenteAdmin.contarPendentes(ultimaReuniao.id).catch(() => null) : null;
    return { config, pendentes, ultimaReuniao, pendentesDaReuniao };
  }, [podeAprovar]);
}
