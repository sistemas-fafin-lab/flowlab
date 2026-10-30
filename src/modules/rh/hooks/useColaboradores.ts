import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AtualizarCadastroInput, Colaborador } from '../types';

interface ColaboradorRow {
  id: string;
  user_profile_id: string | null;
  nome: string;
  email: string | null;
  cpf: string;
  departamento_id: string | null;
  cargo: string | null;
  data_admissao: string | null;
  data_desligamento: string | null;
  status: Colaborador['status'];
  gestor_id: string | null;
  matricula: string | null;
  created_at: string;
  updated_at: string;
  user_profiles: { name: string; email: string } | null;
  departamento_ref: { nome: string } | null;
}

const mapColaborador = (row: ColaboradorRow): Colaborador => ({
  id: row.id,
  userProfileId: row.user_profile_id,
  nome: row.nome,
  email: row.email,
  cpf: row.cpf,
  departamentoId: row.departamento_id,
  departamentoNome: row.departamento_ref?.nome ?? null,
  cargo: row.cargo,
  dataAdmissao: row.data_admissao,
  dataDesligamento: row.data_desligamento,
  status: row.status,
  gestorId: row.gestor_id,
  matricula: row.matricula,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  usuarioVinculado: row.user_profiles ? { nome: row.user_profiles.name, email: row.user_profiles.email } : null,
  gestor: null,
});

/**
 * Preenche `gestor` a partir da própria lista (gestor_id aponta para outro
 * colaborador já carregado). O embed `colaboradores!gestor_id` do PostgREST
 * resolvia a auto-referência no sentido inverso (devolvia os subordinados num
 * array), e a ficha mostrava "Sem gestor" para quem tinha gestor.
 */
const resolverGestores = (colaboradores: Colaborador[]): Colaborador[] => {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  return colaboradores.map((c) => {
    const gestor = c.gestorId ? porId.get(c.gestorId) : undefined;
    return { ...c, gestor: gestor ? { id: gestor.id, nome: gestor.nome } : null };
  });
};

interface UseColaboradoresResult {
  colaboradores: Colaborador[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Issue 02 — edita cargo/data_admissao/matricula (e departamento_id, se vier). Retorna mensagem de erro, ou null se ok. */
  atualizarCadastro: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
  /** Issue 03 — vincula um user_profile ainda não vinculado. Bloqueia (mensagem clara) se o user_profile já está vinculado a outro colaborador. */
  vincularUsuario: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  /** Issue 03 — remove o vínculo sem apagar colaborador nem usuário. */
  desvincularUsuario: (colaboradorId: string) => Promise<string | null>;
  /** Coloca o colaborador num departamento (ou tira, com null). Pede canManageDepartamentos (trigger do banco). */
  definirDepartamento: (colaboradorId: string, departamentoId: string | null) => Promise<string | null>;
  /** Issue 04 — define (ou remove, com null) o gestor. Auto-referência e ciclos são bloqueados pelo trigger do banco. */
  definirGestor: (colaboradorId: string, gestorId: string | null) => Promise<string | null>;
}

export function useColaboradores(): UseColaboradoresResult {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchColaboradores = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('colaboradores')
        // Gestor sai de resolverGestores (auto-referência), não de embed.
        .select('*, user_profiles(name, email), departamento_ref:departamentos!departamento_id(nome)')
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setColaboradores(resolverGestores((data as ColaboradorRow[] | null ?? []).map(mapColaborador)));
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar colaboradores:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os colaboradores.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColaboradores();
  }, [fetchColaboradores]);

  const atualizarCadastro = useCallback(async (id: string, dados: AtualizarCadastroInput): Promise<string | null> => {
    if (dados.dataAdmissao) {
      // Data local (não UTC) — mesmo critério de "hoje" usado na validação de
      // EditarCadastroSection, para não divergir perto da virada do dia num
      // fuso atrás de UTC (ex.: America/Sao_Paulo).
      const agora = new Date();
      const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
      if (dados.dataAdmissao > hoje) {
        return 'Data de admissão não pode ser futura.';
      }
    }
    try {
      const { error: erro } = await supabase
        .from('colaboradores')
        .update({
          cargo: dados.cargo ?? null,
          data_admissao: dados.dataAdmissao ?? null,
          matricula: dados.matricula ?? null,
          ...(dados.departamentoId !== undefined ? { departamento_id: dados.departamentoId } : {}),
        })
        .eq('id', id);
      if (erro) throw new Error(erro.message);
      await fetchColaboradores();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível salvar as alterações.';
    }
  }, [fetchColaboradores]);

  const vincularUsuario = useCallback(async (colaboradorId: string, userProfileId: string): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('colaboradores')
        .update({ user_profile_id: userProfileId })
        .eq('id', colaboradorId);
      if (erro) {
        if (erro.code === '23505') {
          return 'Este usuário já está vinculado a outro colaborador.';
        }
        throw new Error(erro.message);
      }
      await fetchColaboradores();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível vincular o usuário.';
    }
  }, [fetchColaboradores]);

  const desvincularUsuario = useCallback(async (colaboradorId: string): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('colaboradores')
        .update({ user_profile_id: null })
        .eq('id', colaboradorId);
      if (erro) throw new Error(erro.message);
      await fetchColaboradores();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível desvincular o usuário.';
    }
  }, [fetchColaboradores]);

  const definirDepartamento = useCallback(async (colaboradorId: string, departamentoId: string | null): Promise<string | null> => {
    try {
      const { data, error: erro } = await supabase
        .from('colaboradores')
        .update({ departamento_id: departamentoId })
        .eq('id', colaboradorId)
        .select('id');
      // Mensagens do trigger colaboradores_validar_departamento já vêm em português.
      if (erro) throw new Error(erro.message);
      // O RLS de colaboradores (canViewColaboradores) filtra o UPDATE sem erro: 0 linhas.
      if (!data?.length) throw new Error('Sem permissão para editar este colaborador (Gerenciar Colaboradores).');
      await fetchColaboradores();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível mudar o departamento.';
    }
  }, [fetchColaboradores]);

  const definirGestor = useCallback(async (colaboradorId: string, gestorId: string | null): Promise<string | null> => {
    try {
      const { error: erro } = await supabase
        .from('colaboradores')
        .update({ gestor_id: gestorId })
        .eq('id', colaboradorId);
      // Mensagens do trigger rh_colaboradores_validar_gestor (auto-referência/ciclo,
      // ver 20260915120000) já nascem em português e prontas para o usuário final.
      if (erro) throw new Error(erro.message);
      await fetchColaboradores();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Não foi possível definir o gestor.';
    }
  }, [fetchColaboradores]);

  return {
    colaboradores,
    loading,
    error,
    refetch: fetchColaboradores,
    atualizarCadastro,
    vincularUsuario,
    desvincularUsuario,
    definirDepartamento,
    definirGestor,
  };
}
