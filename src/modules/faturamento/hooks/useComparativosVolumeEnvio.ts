import { useCallback, useEffect, useRef, useState } from 'react';
import type { PeriodoComparativo, VolumeEnvioConvenio } from '../utils/comparativos';
import { chamarLegadoApi } from './legado/api';

// Volume de envio da aba Comparativos (/api/faturamento/comparativos-volume-envio).
// Sem cache: o mês padrão já está fechado e a falha do apLIS precisa poder ser
// repetida com "Tentar novamente" (`recarregar`).

interface RespostaVolumeEnvio {
  success?: boolean;
  error?: string;
  periodos?: PeriodoComparativo[];
  volume?: VolumeEnvioConvenio[];
}

export interface EstadoVolumeEnvio {
  periodos: PeriodoComparativo[];
  volume: VolumeEnvioConvenio[];
  loading: boolean;
  /** Mensagem da API (ex.: apLIS indisponível); `null` quando a leitura deu certo. */
  erro: string | null;
  recarregar: () => void;
}

export function useComparativosVolumeEnvio(mes: string): EstadoVolumeEnvio {
  const [periodos, setPeriodos] = useState<PeriodoComparativo[]>([]);
  const [volume, setVolume] = useState<VolumeEnvioConvenio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Descarta resposta de um mês já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const body = await chamarLegadoApi<RespostaVolumeEnvio>(
        'comparativos-volume-envio',
        new URLSearchParams({ mes }),
        'Não foi possível consultar o volume de envio.',
      );
      if (busca !== buscaAtual.current) return;
      setPeriodos(body.periodos ?? []);
      setVolume(body.volume ?? []);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setErro(e instanceof Error ? e.message : 'Não foi possível consultar o volume de envio.');
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { periodos, volume, loading, erro, recarregar: carregar };
}
