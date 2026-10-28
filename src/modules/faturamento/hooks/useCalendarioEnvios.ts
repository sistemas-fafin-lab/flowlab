import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgendamentoEnvio,
  CalendarioEnvios,
  DadosFeriadoEnvio,
  DadosRegraEnvio,
  EventoHistoricoAgendamento,
  FeriadoEnvio,
  RegraEnvio,
  ResultadoSugestaoEnvios,
} from '../types';
import { chamarLegadoApi, getTokenLegado } from './legado/api';

// Calendário de envios (Faturamento → Calendário de envios): lê o mês pronto de
// /api/faturamento/calendario-envios (agendamentos, regras, feriados, hoje e o
// próximo dia útil). As ações de escrita pedem canManageCalendarioEnvios; a rota
// grava quem e quando, e o histórico.

type RespostaCalendario = { success?: boolean; error?: string } & Partial<CalendarioEnvios>;

const MENSAGEM_ERRO = 'Não foi possível carregar o calendário de envios.';

/** `mes` nulo: o mês de hoje, decidido pelo servidor. */
export function useCalendarioEnvios(mes: string | null) {
  const [calendario, setCalendario] = useState<CalendarioEnvios | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buscaAtual = useRef(0);

  const refetch = useCallback(async () => {
    const reqId = ++buscaAtual.current;
    setLoading(true);
    setError(null);
    try {
      const body = await chamarLegadoApi<RespostaCalendario>(
        'calendario-envios',
        new URLSearchParams(mes ? { mes } : {}),
        MENSAGEM_ERRO,
      );
      if (reqId !== buscaAtual.current) return;
      setCalendario({
        hoje: body.hoje ?? '',
        amanha: body.amanha ?? '',
        mes: body.mes ?? '',
        regras: body.regras ?? [],
        podeEnviarQualquerDia: body.podeEnviarQualquerDia ?? [],
        feriados: body.feriados ?? [],
        agendamentos: body.agendamentos ?? [],
        atrasados: body.atrasados ?? [],
        sugestao: body.sugestao ?? {
          mesSeguinte: '',
          liberada: false,
          mesSeguintePlanejado: true,
          sugeridosPendentesMesAtual: 0,
        },
      });
    } catch (err) {
      if (reqId !== buscaAtual.current) return;
      setError(err instanceof Error ? err.message : MENSAGEM_ERRO);
    } finally {
      if (reqId === buscaAtual.current) setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { buscaAtual.current++; };
  }, [refetch]);

  return { calendario, loading, error, refetch };
}

/** Avisa o contador do menu de que o calendário mudou (marcou, desmarcou, reagendou…). */
export const EVENTO_CALENDARIO_ALTERADO = 'calendario-envios:alterado';

/**
 * Total do bloco Atrasados, para o contador do menu (GET leve: não lê o backup).
 * `ativo` falso (sem permissão de ver o Calendário) não consulta e devolve 0. Atualiza
 * quando `recarregarEm` muda (a rota, no menu) e quando o Calendário avisa que mudou.
 */
export function useContadorAtrasados(ativo: boolean, recarregarEm: string): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!ativo) {
      setTotal(0);
      return;
    }
    let cancelado = false;
    const buscar = () => {
      chamarLegadoApi<{ success?: boolean; error?: string; atrasados?: number }>(
        'calendario-envios',
        new URLSearchParams({ contador: 'atrasados' }),
        'Não foi possível contar os envios atrasados.',
      )
        .then((body) => { if (!cancelado) setTotal(body.atrasados ?? 0); })
        // O contador é um aviso: se falhar, o menu só fica sem ele.
        .catch((err) => console.warn('[calendario-envios] contador:', err));
    };
    buscar();
    window.addEventListener(EVENTO_CALENDARIO_ALTERADO, buscar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO_CALENDARIO_ALTERADO, buscar);
    };
  }, [ativo, recarregarEm]);

  return total;
}

/** POST de quem gere o Calendário; devolve o que a rota gravou sob `chave`. Lança com a mensagem da rota. */
async function postarCalendario<T>(corpo: Record<string, unknown>, mensagemErro: string, chave = 'agendamento'): Promise<T> {
  const token = await getTokenLegado();
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const res = await fetch('/api/faturamento/calendario-envios', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string } & Record<string, unknown>;
  if (!res.ok || !body.success || !body[chave]) {
    throw new Error(body.error || mensagemErro);
  }
  window.dispatchEvent(new Event(EVENTO_CALENDARIO_ALTERADO));
  return body[chave] as T;
}

/** Marca como enviado na data informada; marcar de novo troca a data (canManageCalendarioEnvios). */
export function marcarEnvio(id: string, dataEnvio: string): Promise<AgendamentoEnvio> {
  return postarCalendario<AgendamentoEnvio>({ acao: 'marcar', id, dataEnvio }, 'Não foi possível marcar o envio.');
}

/** Desfaz a marcação (canManageCalendarioEnvios). */
export function desmarcarEnvio(id: string): Promise<AgendamentoEnvio> {
  return postarCalendario<AgendamentoEnvio>({ acao: 'desmarcar', id }, 'Não foi possível desmarcar o envio.');
}

/** Agendamento avulso da regra no dia, origem "manual" (canManageCalendarioEnvios). */
export function criarAgendamentoAvulso(regraId: string, dataPrevista: string): Promise<AgendamentoEnvio> {
  return postarCalendario<AgendamentoEnvio>({ acao: 'criar', regraId, dataPrevista }, 'Não foi possível criar o agendamento.');
}

/** Move para outro dia útil; fica "editado" (canManageCalendarioEnvios). */
export function reagendarAgendamento(id: string, dataPrevista: string): Promise<AgendamentoEnvio> {
  return postarCalendario<AgendamentoEnvio>({ acao: 'reagendar', id, dataPrevista }, 'Não foi possível reagendar.');
}

/** Remove o agendamento; o histórico fica (canManageCalendarioEnvios). */
export function removerAgendamento(id: string): Promise<AgendamentoEnvio> {
  return postarCalendario<AgendamentoEnvio>({ acao: 'remover', id }, 'Não foi possível remover o agendamento.');
}

/** Cria (id nulo) ou altera a Regra de envio; desativar é ativo: false (canManageCalendarioEnvios). */
export function salvarRegraEnvio({ id, ...dados }: DadosRegraEnvio): Promise<RegraEnvio> {
  return postarCalendario<RegraEnvio>({ acao: 'salvarRegra', id, ...dados }, 'Não foi possível gravar a regra de envio.', 'regra');
}

/** Cria (id nulo) ou altera o feriado (canManageCalendarioEnvios). */
export function salvarFeriado({ id, ...dados }: DadosFeriadoEnvio): Promise<FeriadoEnvio> {
  return postarCalendario<FeriadoEnvio>({ acao: 'salvarFeriado', id, ...dados }, 'Não foi possível gravar o feriado.', 'feriado');
}

/** Remove o feriado (canManageCalendarioEnvios). */
export function removerFeriado(id: string): Promise<FeriadoEnvio> {
  return postarCalendario<FeriadoEnvio>({ acao: 'removerFeriado', id }, 'Não foi possível remover o feriado.', 'feriado');
}

/**
 * Conta o que a sugestão do mês (o seguinte, a partir do dia 15, ou o corrente) criaria
 * e removeria, sem gravar: a confirmação mostra (canManageCalendarioEnvios).
 */
export function simularSugestao(mes: string): Promise<ResultadoSugestaoEnvios> {
  return postarCalendario<ResultadoSugestaoEnvios>(
    { acao: 'gerarSugestao', mes, simular: true },
    'Não foi possível gerar a sugestão.',
    'sugestao',
  );
}

/**
 * Grava a sugestão confirmada: só refaz os sugeridos pendentes e não editados. A rota
 * confere as contagens da simulação; se o calendário mudou, recusa (canManageCalendarioEnvios).
 */
export function gerarSugestao({ mes, criados, removidos }: ResultadoSugestaoEnvios): Promise<ResultadoSugestaoEnvios> {
  return postarCalendario<ResultadoSugestaoEnvios>(
    { acao: 'gerarSugestao', mes, criados, removidos },
    'Não foi possível gerar a sugestão.',
    'sugestao',
  );
}

const MENSAGEM_ERRO_HISTORICO = 'Não foi possível carregar o histórico.';

/** Histórico do agendamento, do mais antigo ao mais recente (detalhe do agendamento). */
export function useHistoricoAgendamento(id: string) {
  const [historico, setHistorico] = useState<EventoHistoricoAgendamento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setHistorico(null);
    setError(null);
    chamarLegadoApi<{ success?: boolean; error?: string; historico?: EventoHistoricoAgendamento[] }>(
      'calendario-envios',
      new URLSearchParams({ historico: id }),
      MENSAGEM_ERRO_HISTORICO,
    )
      .then((body) => { if (!cancelado) setHistorico(body.historico ?? []); })
      .catch((err) => { if (!cancelado) setError(err instanceof Error ? err.message : MENSAGEM_ERRO_HISTORICO); });
    return () => { cancelado = true; };
  }, [id]);

  return { historico, error };
}
