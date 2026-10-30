import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import type { Colaborador } from '../types';

interface MeuPerfilRow {
  id: string;
  user_profile_id: string | null;
  nome: string;
  email: string | null;
  cpf: string;
  departamento_id: string | null;
  departamento_nome: string | null;
  cargo: string | null;
  data_admissao: string | null;
  data_desligamento: string | null;
  status: Colaborador['status'];
  gestor_id: string | null;
  gestor_nome: string | null;
  matricula: string | null;
  created_at: string;
  updated_at: string;
}

const mapMeuPerfil = (row: MeuPerfilRow): Colaborador => ({
  id: row.id,
  userProfileId: row.user_profile_id,
  nome: row.nome,
  email: row.email,
  cpf: row.cpf,
  departamentoId: row.departamento_id,
  departamentoNome: row.departamento_nome,
  cargo: row.cargo,
  dataAdmissao: row.data_admissao,
  dataDesligamento: row.data_desligamento,
  status: row.status,
  gestorId: row.gestor_id,
  matricula: row.matricula,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // O próprio usuário é quem está vinculado; o card do Meu perfil não mostra o vínculo.
  usuarioVinculado: null,
  gestor: row.gestor_id && row.gestor_nome ? { id: row.gestor_id, nome: row.gestor_nome } : null,
});

interface UseMeuColaboradorResult {
  colaborador: Colaborador | null;
  loading: boolean;
  error: string | null;
  /** true quando a conta logada não está vinculada a nenhum colaborador — estado vazio, não erro. */
  semVinculo: boolean;
  refetch: () => Promise<void>;
}

/** Colaborador do usuário logado, via RPC rh_meu_perfil (traz gestor e departamento sem ampliar a RLS). */
export function useMeuColaborador(): UseMeuColaboradorResult {
  const { user } = useAuth();
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: erro } = await supabase.rpc('rh_meu_perfil');
      if (erro) throw erro;
      const row = (data as MeuPerfilRow[] | null)?.[0];
      setColaborador(row ? mapMeuPerfil(row) : null);
    } catch (err) {
      console.error('Erro ao carregar meu perfil:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar seu perfil.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { colaborador, loading, error, semVinculo: !loading && !error && !colaborador, refetch: carregar };
}
