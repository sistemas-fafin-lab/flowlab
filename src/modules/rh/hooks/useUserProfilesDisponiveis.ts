import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface UserProfileDisponivel {
  id: string;
  name: string;
  email: string;
}

interface UseUserProfilesDisponiveisResult {
  userProfiles: UserProfileDisponivel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Lista de `user_profiles` que ainda não estão vinculados a nenhum colaborador —
 * candidatos para a ação "Vincular usuário" da tela de RH.
 *
 * A FK mora em `colaboradores.user_profile_id` (não o inverso), então buscamos os
 * dois lados separadamente e filtramos em JS: simples e suficiente para a escala
 * de dados de um laboratório (não milhões de linhas).
 */
export function useUserProfilesDisponiveis(): UseUserProfilesDisponiveisResult {
  const [userProfiles, setUserProfiles] = useState<UserProfileDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: profiles, error: profilesError }, { data: vinculados, error: vinculadosError }] =
        await Promise.all([
          supabase.from('user_profiles').select('id, name, email').order('name', { ascending: true }),
          supabase.from('colaboradores').select('user_profile_id').not('user_profile_id', 'is', null),
        ]);

      if (profilesError) throw profilesError;
      if (vinculadosError) throw vinculadosError;

      const idsVinculados = new Set((vinculados ?? []).map((c) => c.user_profile_id as string));

      setUserProfiles(
        (profiles ?? [])
          .filter((p) => !idsVinculados.has(p.id))
          .map((p) => ({ id: p.id, name: p.name, email: p.email }))
      );
    } catch (err) {
      console.error('Erro ao carregar usuários disponíveis:', err);
      setError('Não foi possível carregar os usuários do sistema.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserProfiles();
  }, [fetchUserProfiles]);

  return { userProfiles, loading, error, refetch: fetchUserProfiles };
}
