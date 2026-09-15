import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { AtualizarCadastroInput, Colaborador } from '../types';

interface ColaboradorRow {
  id: string;
  user_profile_id: string | null;
  nome: string;
  email: string | null;
  cpf: string;
  departamento: string | null;
  cargo: string | null;
  data_admissao: string | null;
  data_desligamento: string | null;
  status: Colaborador['status'];
  gestor_id: string | null;
  matricula: string | null;
  created_at: string;
  updated_at: string;
  user_profiles: { name: string; email: string } | null;
  gestor: { id: string; nome: string } | null;
}

const mapColaborador = (row: ColaboradorRow): Colaborador => ({
  id: row.id,
  userProfileId: row.user_profile_id,
  nome: row.nome,
  email: row.email,
  cpf: row.cpf,
  departamento: row.departamento,
  cargo: row.cargo,
  dataAdmissao: row.data_admissao,
  dataDesligamento: row.data_desligamento,
  status: row.status,
  gestorId: row.gestor_id,
  matricula: row.matricula,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  usuarioVinculado: row.user_profiles ? { nome: row.user_profiles.name, email: row.user_profiles.email } : null,
  gestor: row.gestor ? { id: row.gestor.id, nome: row.gestor.nome } : null,
});

interface UseColaboradoresResult {
  colaboradores: Colaborador[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Issue 02 — edita cargo/data_admissao/matricula/departamento. Retorna mensagem de erro, ou null se ok. */
  atualizarCadastro: (id: string, dados: AtualizarCadastroInput) => Promise<string | null>;
  /** Issue 03 — vincula um user_profile ainda não vinculado. Bloqueia (mensagem clara) se o user_profile já está vinculado a outro colaborador. */
  vincularUsuario: (colaboradorId: string, userProfileId: string) => Promise<string | null>;
  /** Issue 03 — remove o vínculo sem apagar colaborador nem usuário. */
  desvincularUsuario: (colaboradorId: string) => Promise<string | null>;
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
        .select('*, user_profiles(name, email), gestor:colaboradores!colaboradores_gestor_id_fkey(id, nome)')
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;
      if (requestIdRef.current !== requestId) return;

      setColaboradores((data as ColaboradorRow[] | null ?? []).map(mapColaborador));
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
          departamento: dados.departamento ?? null,
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
    definirGestor,
  };
}
