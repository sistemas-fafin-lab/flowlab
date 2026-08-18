import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcLaudo, LaudoStatus, AcAgendamento } from '../types';

// Campos editáveis de um laudo existente.
export interface LaudoPatch {
  status?: LaudoStatus;
  examesConcluidos?: number;
  examesTotal?: number;
  nota?: string | null;
}

// Input para criação de um laudo vinculado a agendamento.
export interface LaudoCreateInput {
  agendamentoId: string;
  examesTotal?: number; // se omitido, tenta contar ac_agendamento_exames
  nota?: string | null;
}

interface UseLaudosResult {
  laudos: AcLaudo[];
  agendamentos: AcAgendamento[]; // snapshots dos agendamentos vinculados
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Aba "Liberados": os registros completos são carregados sob demanda (só
  // quando a aba é aberta pela primeira vez), para não pesar o carregamento
  // inicial da página. `totalLiberados` é uma contagem leve, sempre em dia,
  // usada no badge da aba e no KPI antes (ou sem) a lista completa ser aberta.
  laudosLiberados: AcLaudo[];
  agendamentosLiberados: AcAgendamento[];
  loadingLiberados: boolean;
  errorLiberados: string | null;
  liberadosCarregado: boolean;
  totalLiberados: number;
  fetchLaudosLiberados: () => Promise<void>;
  createLaudo: (input: LaudoCreateInput, criadoPor: string) => Promise<string | null>;
  updateLaudo: (id: string, patch: LaudoPatch) => Promise<string | null>;
  deleteLaudo: (id: string) => Promise<string | null>;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

// Fila: mais recentes no topo (a query principal já exclui liberados
// completos, então não há mais grupo liberado a empurrar para o fim).
const ordenarFila = (rows: AcLaudo[]): AcLaudo[] =>
  [...rows].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

const mapLaudo = (r: Record<string, unknown>): AcLaudo => ({
  id: r.id as string,
  agendamento_id: r.agendamento_id as string,
  status: r.status as LaudoStatus,
  exames_concluidos: num(r.exames_concluidos),
  exames_total: num(r.exames_total),
  nota: (r.nota as string) ?? null,
  criado_por: r.criado_por as string,
  criado_em: r.criado_em as string,
  atualizado_em: r.atualizado_em as string,
  liberado_em: (r.liberado_em as string) ?? null,
});

const mapAgendamento = (r: Record<string, unknown>): AcAgendamento => ({
  id: r.id as string,
  labhub_id: r.labhub_id as string,
  paciente_nome: r.paciente_nome as string,
  paciente_telefone: (r.paciente_telefone as string) ?? null,
  posto_id: (r.posto_id as string) ?? null,
  local_posto: r.local_posto as string,
  data_hora: r.data_hora as string,
  status: r.status as string,
  recebido_em: r.recebido_em as string,
  updated_at: r.updated_at as string,
});

// Carrega os agendamentos vinculados a uma lista de laudos, para exibir
// snapshots (paciente/posto/data) nos cards. Compartilhado entre a query
// principal e a da aba "Liberados" — só muda a lista de laudos de entrada.
const carregarAgendamentosDe = async (
  laudosList: AcLaudo[],
): Promise<{ agendamentos: AcAgendamento[]; erro: string | null }> => {
  if (laudosList.length === 0) return { agendamentos: [], erro: null };
  const agIds = laudosList.map((l) => l.agendamento_id);
  const { data: aRows, error: aErr } = await supabase.from('ac_agendamentos').select('*').in('id', agIds);
  return { agendamentos: (aRows ?? []).map(mapAgendamento), erro: aErr?.message ?? null };
};

// Acompanhamento manual de laudos (ac_laudos, Fase 8).
// RLS permissiva por authenticated; o gate é o frontend + a permissão.
export function useLaudos(): UseLaudosResult {
  const [laudos, setLaudos] = useState<AcLaudo[]>([]);
  const [agendamentos, setAgendamentos] = useState<AcAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [laudosLiberados, setLaudosLiberados] = useState<AcLaudo[]>([]);
  const [agendamentosLiberados, setAgendamentosLiberados] = useState<AcAgendamento[]>([]);
  const [loadingLiberados, setLoadingLiberados] = useState(false);
  const [errorLiberados, setErrorLiberados] = useState<string | null>(null);
  // Se a aba "Liberados" já foi aberta — o refetch de mutações usa isso para
  // também atualizá-la (sem isso, liberar um laudo não some da aba já aberta).
  const [liberadosCarregado, setLiberadosCarregado] = useState(false);
  // Contagem leve (sem baixar as linhas) de liberados — fica em dia desde o
  // primeiro carregamento da página, para o KPI e o badge da aba não
  // dependerem da lista completa (que só é buscada quando a aba abre).
  const [totalLiberados, setTotalLiberados] = useState(0);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [{ data: lRows, error: lErr }, { count: totalLib, error: countErr }] = await Promise.all([
      supabase
        .from('ac_laudos')
        .select('*')
        // Laudos completos liberados vivem na aba "Liberados" — a aba principal
        // ("Em andamento") não mostra nenhum, independente de quando liberado.
        .neq('status', 'laudo_completo_liberado')
        .order('criado_em', { ascending: false }),
      supabase.from('ac_laudos').select('id', { count: 'exact', head: true }).eq('status', 'laudo_completo_liberado'),
    ]);

    if (!countErr) setTotalLiberados(totalLib ?? 0);

    if (lErr) {
      setError(lErr.message);
      setLaudos([]);
      setAgendamentos([]);
      setLoading(false);
      return;
    }

    const parsedLaudos = ordenarFila((lRows ?? []).map(mapLaudo));
    setLaudos(parsedLaudos);

    const { agendamentos: ags, erro: aErro } = await carregarAgendamentosDe(parsedLaudos);
    if (aErro) setError(aErro);
    setAgendamentos(ags);

    setLoading(false);
  }, []);

  const fetchLaudosLiberados = useCallback(async () => {
    setLiberadosCarregado(true);
    setLoadingLiberados(true);
    setErrorLiberados(null);

    const { data: lRows, error: lErr } = await supabase
      .from('ac_laudos')
      .select('*')
      .eq('status', 'laudo_completo_liberado')
      // Sem corte de tempo: a aba "Liberados" mostra o histórico completo.
      .order('liberado_em', { ascending: false });

    if (lErr) {
      setErrorLiberados(lErr.message);
      setLaudosLiberados([]);
      setAgendamentosLiberados([]);
      setLoadingLiberados(false);
      return;
    }

    const parsedLaudos = (lRows ?? []).map(mapLaudo);
    setLaudosLiberados(parsedLaudos);
    setTotalLiberados(parsedLaudos.length);

    const { agendamentos: ags, erro: aErro } = await carregarAgendamentosDe(parsedLaudos);
    if (aErro) setErrorLiberados(aErro);
    setAgendamentosLiberados(ags);

    setLoadingLiberados(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Mutações mudam o status/existência de um laudo, o que pode movê-lo entre
  // as duas abas — mantém a aba "Liberados" em dia se ela já foi aberta.
  const refetchAposMutacao = useCallback(async () => {
    const tarefas = [refetch()];
    if (liberadosCarregado) tarefas.push(fetchLaudosLiberados());
    await Promise.all(tarefas);
  }, [refetch, fetchLaudosLiberados, liberadosCarregado]);

  const createLaudo: UseLaudosResult['createLaudo'] = useCallback(
    async (input, criadoPor) => {
      if (!input.agendamentoId) return 'Informe o agendamento.';

      let total = input.examesTotal;
      if (total === undefined) {
        // Tenta contar exames marcados no check-in.
        const { count } = await supabase
          .from('ac_agendamento_exames')
          .select('*', { count: 'exact', head: true })
          .eq('agendamento_id', input.agendamentoId);
        total = count ?? 0;
      }

      const row: Record<string, unknown> = {
        agendamento_id: input.agendamentoId,
        exames_total: total ?? 0,
        nota: input.nota?.trim() || null,
        criado_por: criadoPor,
      };

      const { error: err } = await supabase.from('ac_laudos').insert(row);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const updateLaudo: UseLaudosResult['updateLaudo'] = useCallback(
    async (id, patch) => {
      const row: Record<string, unknown> = {};
      if (patch.status !== undefined) {
        row.status = patch.status;
        if (patch.status === 'laudo_completo_liberado') {
          row.liberado_em = new Date().toISOString();
        }
      }
      if (patch.examesConcluidos !== undefined) row.exames_concluidos = patch.examesConcluidos;
      if (patch.examesTotal !== undefined) row.exames_total = patch.examesTotal;
      if (patch.nota !== undefined) row.nota = patch.nota || null;

      const { error: err } = await supabase.from('ac_laudos').update(row).eq('id', id);
      if (err) return err.message;
      await refetchAposMutacao();
      return null;
    },
    [refetchAposMutacao],
  );

  const deleteLaudo: UseLaudosResult['deleteLaudo'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_laudos').delete().eq('id', id);
      if (err) return err.message;
      await refetchAposMutacao();
      return null;
    },
    [refetchAposMutacao],
  );

  return {
    laudos,
    agendamentos,
    loading,
    error,
    refetch,
    laudosLiberados,
    agendamentosLiberados,
    loadingLiberados,
    errorLiberados,
    liberadosCarregado,
    totalLiberados,
    fetchLaudosLiberados,
    createLaudo,
    updateLaudo,
    deleteLaudo,
  };
}
