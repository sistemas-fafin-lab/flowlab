import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export interface ResponsavelOpcao {
  id: string;
  nome: string;
}

/** Usuários ativos (não removidos nem desativados) para o campo "responsável técnico". */
export function useResponsaveisTI(): { responsaveis: ResponsavelOpcao[]; loading: boolean } {
  const [responsaveis, setResponsaveis] = useState<ResponsavelOpcao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('active_user_profiles')
        .select('id, name')
        .is('disabled_at', null)
        .order('name', { ascending: true });
      if (cancelado) return;
      if (error) console.error('Erro ao carregar usuários para responsável técnico:', error);
      setResponsaveis((data ?? []).map((u: { id: string; name: string }) => ({ id: u.id, nome: u.name })));
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return { responsaveis, loading };
}
