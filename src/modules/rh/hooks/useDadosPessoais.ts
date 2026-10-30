import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { DadosPessoais } from '../types';
import { DADOS_PESSOAIS_VAZIOS } from '../utils/rotulosDadosPessoais';

interface DadosPessoaisRow {
  nacionalidade: DadosPessoais['nacionalidade'];
  uf_nascimento: DadosPessoais['ufNascimento'];
  cidade_nascimento: string | null;
  cor_raca: DadosPessoais['corRaca'];
  genero: DadosPessoais['genero'];
  estado_civil: DadosPessoais['estadoCivil'];
  data_nascimento: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
}

const mapDadosPessoais = (row: DadosPessoaisRow): DadosPessoais => ({
  nacionalidade: row.nacionalidade,
  ufNascimento: row.uf_nascimento,
  cidadeNascimento: row.cidade_nascimento,
  corRaca: row.cor_raca,
  genero: row.genero,
  estadoCivil: row.estado_civil,
  dataNascimento: row.data_nascimento,
  nomeMae: row.nome_mae,
  nomePai: row.nome_pai,
});

const textoOuNull = (valor: string | null): string | null => valor?.trim() || null;

interface UseDadosPessoaisResult {
  /** Sem registro no banco vira DADOS_PESSOAIS_VAZIOS (o primeiro salvar cria a linha). */
  dados: DadosPessoais;
  loading: boolean;
  error: string | null;
  /** Upsert em colaborador_dados_pessoais (RLS: canManageColaboradores). Retorna mensagem de erro, ou null se ok. */
  salvar: (dados: DadosPessoais) => Promise<string | null>;
}

export function useDadosPessoais(colaboradorId: string): UseDadosPessoaisResult {
  const [dados, setDados] = useState<DadosPessoais>(DADOS_PESSOAIS_VAZIOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const carregar = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: erro } = await supabase
        .from('colaborador_dados_pessoais')
        .select('nacionalidade, uf_nascimento, cidade_nascimento, cor_raca, genero, estado_civil, data_nascimento, nome_mae, nome_pai')
        .eq('colaborador_id', colaboradorId)
        .maybeSingle();
      if (erro) throw erro;
      if (requestIdRef.current !== requestId) return;
      setDados(data ? mapDadosPessoais(data as DadosPessoaisRow) : DADOS_PESSOAIS_VAZIOS);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('Erro ao carregar dados pessoais:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados pessoais.');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [colaboradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = useCallback(async (novos: DadosPessoais): Promise<string | null> => {
    try {
      const { data, error: erro } = await supabase
        .from('colaborador_dados_pessoais')
        .upsert(
          {
            colaborador_id: colaboradorId,
            nacionalidade: novos.nacionalidade,
            uf_nascimento: novos.ufNascimento,
            cidade_nascimento: textoOuNull(novos.cidadeNascimento),
            cor_raca: novos.corRaca,
            genero: novos.genero,
            estado_civil: novos.estadoCivil,
            data_nascimento: novos.dataNascimento || null,
            nome_mae: textoOuNull(novos.nomeMae),
            nome_pai: textoOuNull(novos.nomePai),
          },
          { onConflict: 'colaborador_id' },
        )
        .select('nacionalidade, uf_nascimento, cidade_nascimento, cor_raca, genero, estado_civil, data_nascimento, nome_mae, nome_pai')
        .single();
      if (erro) throw new Error(erro.message);
      setDados(mapDadosPessoais(data as DadosPessoaisRow));
      return null;
    } catch (err) {
      console.error('Erro ao salvar dados pessoais:', err);
      return 'Não foi possível salvar as alterações. Tente novamente.';
    }
  }, [colaboradorId]);

  return { dados, loading, error, salvar };
}
