import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { chamarApi } from './useContasReceber';
import type { ConferenciaAplis, DivergenciaAplis, RefechamentoAplicado, RefechamentoAplis } from '../types';

// Conferência das baixas com o apLIS (.scratch/faturamento-conferencia-baixas-aplis)
// para a aba Títulos: selo na linha e filtro "Divergente do apLIS". A rota não
// tem cache — cada leitura é o estado do apLIS (até ontem) contra as baixas de agora.

const MENSAGEM_PADRAO = 'Não foi possível conferir as baixas com o apLIS.';

/** GET /api/faturamento/titulos-conferencia-aplis. Também usado pelo modal. */
export async function buscarConferenciaAplis(): Promise<ConferenciaAplis> {
  const body = await chamarApi<{
    meta?: { dadoAte?: string | null };
    titulos?: DivergenciaAplis[];
    refechamentos?: RefechamentoAplis[];
  }>('/api/faturamento/titulos-conferencia-aplis', MENSAGEM_PADRAO);
  return {
    dadoAte: body.meta?.dadoAte ?? null,
    titulos: body.titulos ?? [],
    refechamentos: body.refechamentos ?? [],
  };
}

/**
 * Aplica a emissão nova dos refechamentos apontados (RPC
 * fat_aplicar_refechamentos, que exige canManageBilling e reconfere no
 * servidor que a data é de um mês posterior). Devolve só os que mudaram.
 */
export async function rpcAplicarRefechamentos(refechamentos: RefechamentoAplis[]): Promise<RefechamentoAplicado[]> {
  if (refechamentos.length === 0) return [];
  const { data, error } = await supabase.rpc('fat_aplicar_refechamentos', {
    p: refechamentos.map((r) => ({ idNota: r.idNota, emissaoNova: r.emissaoNova })),
  });
  if (error) throw new Error(error.message);
  const apontados = new Map(refechamentos.map((r) => [r.idNota, r]));
  return ((data ?? []) as { idNota: string; emissaoAntiga: string; emissaoNova: string }[]).map((linha) => {
    const apontado = apontados.get(linha.idNota);
    return {
      idNota: linha.idNota,
      operadora: apontado?.operadora ?? '',
      lotes: apontado?.lotes ?? [],
      emissaoAntiga: linha.emissaoAntiga,
      emissaoNova: linha.emissaoNova,
    };
  });
}

interface UseConferenciaAplisResult {
  /** Divergentes por `idNota`; null enquanto não chegou ou se falhou. */
  porTitulo: Map<string, DivergenciaAplis> | null;
  titulos: DivergenciaAplis[] | null;
  /** Títulos com lote refechado no apLIS depois da emissão; null como `titulos`. */
  refechamentos: RefechamentoAplis[] | null;
  carregando: boolean;
  erro: string | null;
  /**
   * Relê a conferência ("Atualizar" da aba Títulos) e, com `aplicar`, aplica os
   * refechamentos apontados. Devolve os títulos que mudaram de mês. Falha ao ler
   * fica em `erro`, como numa leitura normal; falha ao aplicar vira exceção, e
   * a conferência lida continua valendo.
   */
  atualizar: (aplicar: boolean) => Promise<RefechamentoAplicado[]>;
}

/**
 * Lê a conferência quando `ativo` liga (cada entrada na aba Títulos) e de novo
 * a cada troca de `versao` (baixa salva ou excluída, "Atualizar"). Não bloqueia
 * nada: a lista carrega por conta própria e os selos entram quando isto chegar.
 */
export function useConferenciaAplis(ativo: boolean, versao: number): UseConferenciaAplisResult {
  const [titulos, setTitulos] = useState<DivergenciaAplis[] | null>(null);
  const [refechamentos, setRefechamentos] = useState<RefechamentoAplis[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta a resposta de uma leitura já substituída por outra.
  const leituraRef = useRef(0);

  /** A conferência lida, ou null se falhou ou foi substituída por outra leitura. */
  const carregar = useCallback(async (): Promise<ConferenciaAplis | null> => {
    const leitura = ++leituraRef.current;
    setCarregando(true);
    setErro(null);
    try {
      const conferencia = await buscarConferenciaAplis();
      if (leitura !== leituraRef.current) return null;
      setTitulos(conferencia.titulos);
      setRefechamentos(conferencia.refechamentos);
      return conferencia;
    } catch (err) {
      if (leitura !== leituraRef.current) return null;
      // Sem selos em vez dos da leitura anterior: o operador pode ter acabado
      // de acertar justamente aquele título. (Durante a releitura os anteriores
      // ficam, para a lista não piscar.)
      setTitulos(null);
      setRefechamentos(null);
      setErro(err instanceof Error ? err.message : MENSAGEM_PADRAO);
      return null;
    } finally {
      if (leitura === leituraRef.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (ativo) void carregar();
  }, [ativo, versao, carregar]);

  // Sair da aba no meio da leitura não deixa `carregando` preso.
  useEffect(() => {
    if (ativo) return;
    leituraRef.current += 1;
    setCarregando(false);
  }, [ativo]);

  const atualizar = useCallback(async (aplicar: boolean): Promise<RefechamentoAplicado[]> => {
    const conferencia = await carregar();
    if (!aplicar || !conferencia) return [];
    const aplicados = await rpcAplicarRefechamentos(conferencia.refechamentos);
    // Os aplicados saem do aviso de apontados sem reler a conferência.
    const ids = new Set(aplicados.map((a) => a.idNota));
    setRefechamentos((atual) => atual?.filter((r) => !ids.has(r.idNota)) ?? atual);
    return aplicados;
  }, [carregar]);

  const porTitulo = useMemo(
    () => (titulos ? new Map(titulos.map((t) => [t.idNota, t])) : null),
    [titulos],
  );

  return { porTitulo, titulos, refechamentos, carregando, erro, atualizar };
}
