import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Colaborador } from '../types';

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
});

interface UseColaboradoresResult {
  colaboradores: Colaborador[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useColaboradores(): UseColaboradoresResult {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchColaboradores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('colaboradores')
        .select('*, user_profiles(name, email)')
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;

      setColaboradores((data as ColaboradorRow[] | null ?? []).map(mapColaborador));
    } catch (err) {
      console.error('Erro ao carregar colaboradores:', err);
      setError('Não foi possível carregar os colaboradores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColaboradores();
  }, [fetchColaboradores]);

  return { colaboradores, loading, error, refetch: fetchColaboradores };
}
