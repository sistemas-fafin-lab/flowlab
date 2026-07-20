import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AcAgendamento, TipoDocumento } from '../types';

export interface AgendamentosFiltros {
  postoId?: string; // ac_postos.id
  data?: string; // YYYY-MM-DD (filtra pelo dia local)
}

// Paciente devolvido pelo typeahead da recepção (espelha PacienteBuscaItem do
// LAB-HUB). O CPF vem MASCARADO — só o suficiente p/ o operador confirmar a pessoa.
export interface PacienteBuscaItem {
  id: string;
  nome: string;
  cpfMascarado: string;
  dataNascimento: string; // YYYY-MM-DD
}

// Disponibilidade de um posto (mesma grade que o paciente vê). `slots` são
// horários ISO 8601 livres, gerados a partir da agenda do posto.
export interface PostoDisponivel {
  id: string;
  nome: string;
  endereco: string;
  slots: string[];
}

// Criação manual (walk-in / encaixe). Ao contrário do fluxo antigo (só local), o
// agendamento nasce no LAB-HUB vinculado a um paciente e é sincronizado de volta.
// Dois modos: paciente EXISTENTE (pacienteId, escolhido no typeahead) ou NOVO
// (nome + cpf + dataNascimento → find-or-create por CPF, criando um "fantasma").
export interface AgendamentoManualInput {
  pacienteId?: string;
  nome?: string;
  cpf?: string;
  dataNascimento?: string; // YYYY-MM-DD
  telefone?: string | null;
  postoId: string; // ac_postos.id (= posto_flowlab_id no LAB-HUB)
  dataHora: string; // ISO 8601
}

// Ids do agendamento recém-criado. `flowlabId` (ac_agendamentos.id) é o que o
// upload de documentos usa para resolver o labhub_id no servidor; vem null se a
// sincronização com o FlowLab não confirmou a tempo (raro — a chamada parte daqui).
export interface AgendamentoCriado {
  flowlabId: string | null;
  labhubId: string;
}

interface UseAgendamentosResult {
  agendamentos: AcAgendamento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Typeahead: busca pacientes já cadastrados no LAB-HUB por nome.
  buscarPacientes: (q: string) => Promise<PacienteBuscaItem[]>;
  // Disponibilidade dos postos (grade real) para escolher o horário.
  buscarDisponibilidade: () => Promise<PostoDisponivel[]>;
  // Cria o agendamento. Retorna { erro } em falha ou { criado } com os ids em sucesso.
  criarAgendamentoManual: (
    input: AgendamentoManualInput,
  ) => Promise<{ erro: string } | { criado: AgendamentoCriado }>;
  // Anexa um documento do paciente ao agendamento (via LAB-HUB). Retorna a mensagem
  // de erro (string) ou null em sucesso.
  uploadDocumento: (
    agendamentoFlowlabId: string,
    file: File,
    tipo: TipoDocumento,
  ) => Promise<string | null>;
}

// Token da sessão do operador para as chamadas às funções serverless (proxy do
// LAB-HUB). As rotas /api validam este JWT + canManageColetas.
async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Lista os agendamentos recebidos do LAB-HUB (tabela ac_agendamentos).
// Leitura direta via supabase-js: a RLS já libera SELECT p/ usuários autenticados.
export function useAgendamentos(filtros: AgendamentosFiltros): UseAgendamentosResult {
  const [agendamentos, setAgendamentos] = useState<AcAgendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { postoId, data } = filtros;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('ac_agendamentos')
      .select('*')
      .order('data_hora', { ascending: true });

    if (postoId) query = query.eq('posto_id', postoId);
    if (data) {
      // Janela do dia escolhido (horário local do navegador → ISO p/ comparar timestamptz).
      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59.999`);
      query = query.gte('data_hora', inicio.toISOString()).lte('data_hora', fim.toISOString());
    }

    const { data: rows, error: err } = await query;
    if (err) {
      setError(err.message);
      setAgendamentos([]);
    } else {
      setAgendamentos((rows ?? []) as AcAgendamento[]);
    }
    setLoading(false);
  }, [postoId, data]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Busca pacientes no LAB-HUB (typeahead). Silenciosa: em erro/sessão expirada
  // devolve lista vazia — o operador ainda pode cadastrar um paciente novo.
  const buscarPacientes: UseAgendamentosResult['buscarPacientes'] = useCallback(async (q) => {
    const termo = q.trim();
    if (termo.length < 2) return [];
    const token = await getToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `/api/analises-clinicas/buscar-pacientes?q=${encodeURIComponent(termo)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body: { success?: boolean; pacientes?: PacienteBuscaItem[] } =
        await res.json().catch(() => ({}));
      if (!res.ok || !body.success) return [];
      return body.pacientes ?? [];
    } catch {
      return [];
    }
  }, []);

  // Disponibilidade dos postos (grade real) para o seletor de horário do modal.
  const buscarDisponibilidade: UseAgendamentosResult['buscarDisponibilidade'] = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    try {
      const res = await fetch('/api/analises-clinicas/disponibilidade-operador', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: { success?: boolean; postos?: PostoDisponivel[] } =
        await res.json().catch(() => ({}));
      if (!res.ok || !body.success) return [];
      return body.postos ?? [];
    } catch {
      return [];
    }
  }, []);

  // Cria o agendamento manual via proxy /api/analises-clinicas/criar-agendamento-labhub,
  // que fala com o LAB-HUB (find-or-create paciente + cria agendamento + sincroniza).
  const criarAgendamentoManual: UseAgendamentosResult['criarAgendamentoManual'] = useCallback(
    async (input) => {
      if (!input.postoId) return { erro: 'Selecione o posto.' };
      if (!input.dataHora) return { erro: 'Informe a data e a hora.' };
      const temExistente = Boolean(input.pacienteId);
      const temNovo = Boolean(input.nome?.trim() && input.cpf?.trim() && input.dataNascimento);
      if (!temExistente && !temNovo) {
        return { erro: 'Selecione um paciente ou informe nome, CPF e data de nascimento.' };
      }

      const token = await getToken();
      if (!token) return { erro: 'Sessão expirada. Faça login novamente.' };

      let res: Response;
      try {
        res = await fetch('/api/analises-clinicas/criar-agendamento-labhub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...(input.pacienteId ? { pacienteId: input.pacienteId } : {}),
            ...(input.nome ? { nome: input.nome.trim() } : {}),
            ...(input.cpf ? { cpf: input.cpf.trim() } : {}),
            ...(input.dataNascimento ? { dataNascimento: input.dataNascimento } : {}),
            ...(input.telefone?.trim() ? { telefone: input.telefone.trim() } : {}),
            postoFlowlabId: input.postoId,
            dataHora: input.dataHora,
          }),
        });
      } catch {
        return { erro: 'Não foi possível criar o agendamento. Verifique a conexão.' };
      }

      const body: {
        success?: boolean;
        error?: string;
        flowlabId?: string;
        agendamentoLabhubId?: string;
      } = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { erro: body.error || 'Não foi possível criar o agendamento.' };
      }

      await refetch();
      return {
        criado: { flowlabId: body.flowlabId ?? null, labhubId: body.agendamentoLabhubId ?? '' },
      };
    },
    [refetch],
  );

  // Anexa um documento ao agendamento: manda os bytes crus ao proxy, que resolve o
  // labhub_id e repassa ao LAB-HUB. O Content-Type é octet-stream de propósito (o
  // proxy e o LAB-HUB tratam o corpo como binário, não como o tipo do arquivo).
  const uploadDocumento: UseAgendamentosResult['uploadDocumento'] = useCallback(
    async (agendamentoFlowlabId, file, tipo) => {
      const token = await getToken();
      if (!token) return 'Sessão expirada. Faça login novamente.';
      try {
        const res = await fetch(
          `/api/analises-clinicas/upload-documento?agendamentoId=${encodeURIComponent(
            agendamentoFlowlabId,
          )}&tipo=${encodeURIComponent(tipo)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              Authorization: `Bearer ${token}`,
              'x-nome-arquivo': encodeURIComponent(file.name),
            },
            body: file,
          },
        );
        const body: { success?: boolean; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) return body.error || 'Falha ao enviar o documento.';
        return null;
      } catch {
        return 'Falha ao enviar o documento. Verifique a conexão.';
      }
    },
    [],
  );

  return {
    agendamentos,
    loading,
    error,
    refetch,
    buscarPacientes,
    buscarDisponibilidade,
    criarAgendamentoManual,
    uploadDocumento,
  };
}
