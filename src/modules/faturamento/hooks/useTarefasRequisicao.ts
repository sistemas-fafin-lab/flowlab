import { useEffect, useState } from 'react';
import type { TarefaRequisicao } from '../types';
import { chamarLegadoApi } from './legado/api';

// Tarefas do apLIS de uma requisição (rota /api/faturamento/tarefas-requisicao),
// lidas ao abrir o modal do ícone de tarefas da aba Pendências. Sem cache: a
// lista é curta e o operador abre o modal justamente para ver o estado atual.

interface RespostaTarefasRequisicao {
  success?: boolean;
  error?: string;
  tarefas?: TarefaRequisicao[];
}

interface UseTarefasRequisicaoResult {
  tarefas: TarefaRequisicao[];
  loading: boolean;
  error: string | null;
}

/** Resultado guardado junto com a requisição a que pertence. */
interface Carregado {
  idRequisicao: number;
  tarefas: TarefaRequisicao[];
  error: string | null;
}

const MENSAGEM_ERRO_PADRAO = 'Não foi possível consultar as tarefas da requisição.';

/** `idRequisicao` nulo = modal fechado, nada é buscado. */
export function useTarefasRequisicao(idRequisicao: number | null): UseTarefasRequisicaoResult {
  const [carregado, setCarregado] = useState<Carregado | null>(null);

  useEffect(() => {
    if (idRequisicao === null) return;
    let cancelado = false;
    chamarLegadoApi<RespostaTarefasRequisicao>(
      'tarefas-requisicao',
      new URLSearchParams({ idRequisicao: String(idRequisicao) }),
      MENSAGEM_ERRO_PADRAO,
    )
      .then((body) => {
        if (!cancelado) setCarregado({ idRequisicao, tarefas: body.tarefas ?? [], error: null });
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setCarregado({ idRequisicao, tarefas: [], error: err instanceof Error ? err.message : MENSAGEM_ERRO_PADRAO });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [idRequisicao]);

  // Derivado do id, não de um reset no efeito: ao trocar de requisição, a
  // primeira pintura já sai "carregando", sem mostrar a lista da anterior.
  const atual = carregado !== null && carregado.idRequisicao === idRequisicao ? carregado : null;
  return {
    tarefas: atual?.tarefas ?? [],
    loading: idRequisicao !== null && atual === null,
    error: atual?.error ?? null,
  };
}
