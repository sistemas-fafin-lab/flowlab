import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { validateCpfCnpj } from '../../../utils/paymentUtils';

export interface FornecedorOpcao {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
}

export type ResultadoCriarFornecedor = { ok: true; fornecedor: FornecedorOpcao } | { ok: false; erro: string };

interface UseFornecedoresTIResult {
  fornecedores: FornecedorOpcao[];
  loading: boolean;
  error: string | null;
  /** Cadastro rápido (nome + CNPJ/CPF) direto do formulário da despesa (D4, RF08). */
  criarFornecedorRapido: (nome: string, documento: string) => Promise<ResultadoCriarFornecedor>;
}

/** Fornecedores do cadastro geral (`suppliers`) — o módulo reaproveita, não duplica (D4). */
export function useFornecedoresTI(): UseFornecedoresTIResult {
  const [fornecedores, setFornecedores] = useState<FornecedorOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFornecedores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('suppliers')
        .select('id, name, cnpj, status')
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      setFornecedores(
        (data ?? []).map((s: { id: string; name: string; cnpj: string | null; status: string }) => ({
          id: s.id,
          nome: s.name,
          cnpj: s.cnpj || null,
          ativo: s.status !== 'inactive',
        })),
      );
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      setError('Não foi possível carregar os fornecedores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const criarFornecedorRapido = useCallback(
    async (nome: string, documento: string): Promise<ResultadoCriarFornecedor> => {
      const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
      const digitos = documento.replace(/\D/g, '');
      if (!nomeLimpo) return { ok: false, erro: 'Informe o nome do fornecedor.' };
      if (!validateCpfCnpj(digitos)) return { ok: false, erro: 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).' };

      // Mesmos campos que SupplierFormModal manda vazios quando não preenchidos:
      // o resto do cadastro continua sendo feito na tela de Fornecedores.
      const { data, error: erro } = await supabase
        .from('suppliers')
        .insert({
          name: nomeLimpo,
          cnpj: digitos,
          email: '',
          phone: '',
          address: '',
          contact_person: '',
          products: [],
          status: 'active',
        })
        .select('id, name, cnpj')
        .single();
      if (erro) return { ok: false, erro: erro.message || 'Não foi possível cadastrar o fornecedor.' };

      const fornecedor: FornecedorOpcao = { id: data.id, nome: data.name, cnpj: data.cnpj || null, ativo: true };
      setFornecedores((atuais) =>
        [...atuais, fornecedor].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
      );
      return { ok: true, fornecedor };
    },
    [],
  );

  return { fornecedores, loading, error, criarFornecedorRapido };
}
