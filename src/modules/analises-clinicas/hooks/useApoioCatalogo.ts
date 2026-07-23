import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ApoioExameCatalogo } from '../types';

// Campos editáveis de uma entrada do catálogo (upsert por cod_exame).
export interface CatalogoInput {
  cod_exame: string;
  descricao_exame: string;
  descricao_material?: string | null;
  cod_material?: string | null;
  preco?: number | null;
}

interface UseApoioCatalogoResult {
  catalogo: ApoioExameCatalogo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertExame: (input: CatalogoInput) => Promise<string | null>;
  deleteExame: (id: number) => Promise<string | null>;
}

// Catálogo de exames do apoio (ac_apoio_exames) — mesma tabela que alimenta o
// prompt do OCR e o enriquecimento de códigos no backend. RLS permissiva por
// authenticated; o gate é o frontend + canManageColetas (padrão do módulo).
export function useApoioCatalogo(): UseApoioCatalogoResult {
  const [catalogo, setCatalogo] = useState<ApoioExameCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ac_apoio_exames')
      .select('*')
      .order('cod_exame', { ascending: true });
    if (err) {
      setError(err.message);
      setCatalogo([]);
    } else {
      setCatalogo((data ?? []) as ApoioExameCatalogo[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const upsertExame: UseApoioCatalogoResult['upsertExame'] = useCallback(
    async (input) => {
      const codExame = input.cod_exame.trim().toUpperCase();
      const descricao = input.descricao_exame.trim();
      if (!codExame || !descricao) return 'Código e descrição do exame são obrigatórios.';

      const row = {
        cod_exame: codExame,
        descricao_exame: descricao,
        descricao_material: input.descricao_material?.trim() || null,
        cod_material: input.cod_material?.trim() || null,
        preco: input.preco ?? null,
      };
      const { error: err } = await supabase
        .from('ac_apoio_exames')
        .upsert(row, { onConflict: 'cod_exame' });
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  const deleteExame: UseApoioCatalogoResult['deleteExame'] = useCallback(
    async (id) => {
      const { error: err } = await supabase.from('ac_apoio_exames').delete().eq('id', id);
      if (err) return err.message;
      await refetch();
      return null;
    },
    [refetch],
  );

  return { catalogo, loading, error, refetch, upsertExame, deleteExame };
}
