import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardsGlosaSaldo } from '../utils/cardsGlosaSaldo';
import type { DashboardReceberFiltros } from '../types';
import { chamarLegadoApi } from './legado/api';

// Cards "Glosa recuperada" e "Saldo pendente" do Dashboard
// (/api/faturamento/dashboard-glosa-saldo). Hook à parte da RPC do Dashboard: a
// Recuperada vem da foto de recursos do apLIS, e uma falha aqui não pode derrubar
// os outros cards. Só período e operadora: lote e nota não se aplicam (ver a rota).

const MENSAGEM_PADRAO = 'Não foi possível calcular a glosa recuperada e o saldo pendente.';

/** Separador das operadoras nas deps do efeito (mesmo de useContasReceberDashboard). */
const SEP = '\u0001';

interface RespostaCards {
  success?: boolean;
  error?: string;
  cards?: CardsGlosaSaldo;
}

export interface EstadoCardsGlosaSaldo {
  cards: CardsGlosaSaldo | null;
  loading: boolean;
  erro: string | null;
  recarregar: () => void;
}

export function useCardsGlosaSaldo(filtros: DashboardReceberFiltros): EstadoCardsGlosaSaldo {
  const [cards, setCards] = useState<CardsGlosaSaldo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const { desde, ate } = filtros;
  const operadoraIds = filtros.operadoraIds.join(SEP);
  // Descarta resposta de um filtro já trocado.
  const buscaAtual = useRef(0);

  const carregar = useCallback(async () => {
    const busca = ++buscaAtual.current;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ desde, ate });
      if (operadoraIds !== '') for (const id of operadoraIds.split(SEP)) params.append('operadoraId', id);
      const body = await chamarLegadoApi<RespostaCards>('dashboard-glosa-saldo', params, MENSAGEM_PADRAO);
      if (busca !== buscaAtual.current) return;
      setCards(body.cards ?? null);
    } catch (e) {
      if (busca !== buscaAtual.current) return;
      setCards(null);
      setErro(e instanceof Error ? e.message : MENSAGEM_PADRAO);
    } finally {
      if (busca === buscaAtual.current) setLoading(false);
    }
  }, [desde, ate, operadoraIds]);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [carregar]);

  return { cards, loading, erro, recarregar: carregar };
}
