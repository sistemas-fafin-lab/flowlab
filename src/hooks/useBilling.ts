import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Recebimento,
  RecebimentoStatus,
  RecebimentoBaixaInput,
  Glosa,
  GlosaStatus,
  GlosaRecursoInput,
  RecebimentoAgrupado
} from '../modules/billing/types';

// ============================================================================
// HOOK: useBilling
// Gerencia as abas Contas a Receber e Glosas e Recursos (tabelas recebimentos /
// glosas do Supabase).
//
// A aba Faturas NÃO usa este hook: ela lê os lotes ao vivo do apLIS por
// /api/faturamento/lotes — ver src/modules/faturamento/hooks/useFaturamentoLotes.ts.
// As leituras de `notas`/`operadoras` e as métricas que existiam aqui atendiam a
// versão anterior daquela tela, montada sobre o espelho do apLIS que nunca saiu do
// mock; foram removidas com ela.
// ============================================================================

export const useBilling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para dados
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [glosas, setGlosas] = useState<Glosa[]>([]);

  // ============================================================================
  // RECEBIMENTOS (CONTAS A RECEBER)
  // ============================================================================

  /**
   * Busca recebimentos/contas a receber
   */
  const fetchRecebimentos = useCallback(async (filters?: {
    status?: RecebimentoStatus;
    nota_id?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('recebimentos')
        .select(`
          *,
          nota:notas(
            id_nota, numero_nota, valor_total, status,
            operadora:operadoras(id_operadora, nome)
          ),
          lote:lotes(id_lote, codigo_lote),
          glosas(*)
        `)
        .order('data_prevista', { ascending: true });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.nota_id) {
        query = query.eq('nota_id', filters.nota_id);
      }
      if (filters?.dataInicio) {
        query = query.gte('data_prevista', filters.dataInicio);
      }
      if (filters?.dataFim) {
        query = query.lte('data_prevista', filters.dataFim);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setRecebimentos(data || []);
      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar recebimentos';
      setError(message);
      console.error('[useBilling] fetchRecebimentos error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Agrupa recebimentos por período (30/60/90 dias)
   */
  const fetchRecebimentosAgrupados = useCallback(async (): Promise<RecebimentoAgrupado[]> => {
    try {
      const recebimentosData = await fetchRecebimentos({ status: 'previsto' });
      const hoje = new Date();
      
      const grupos: RecebimentoAgrupado[] = [
        { periodo: 'vencido', quantidade: 0, valorTotal: 0, recebimentos: [] },
        { periodo: '30dias', quantidade: 0, valorTotal: 0, recebimentos: [] },
        { periodo: '60dias', quantidade: 0, valorTotal: 0, recebimentos: [] },
        { periodo: '90dias', quantidade: 0, valorTotal: 0, recebimentos: [] }
      ];

      recebimentosData.forEach((rec: Recebimento) => {
        const dataPrevista = new Date(rec.data_prevista);
        const diffDias = Math.ceil((dataPrevista.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        let grupo: RecebimentoAgrupado | undefined;
        
        if (diffDias < 0) {
          grupo = grupos.find(g => g.periodo === 'vencido');
        } else if (diffDias <= 30) {
          grupo = grupos.find(g => g.periodo === '30dias');
        } else if (diffDias <= 60) {
          grupo = grupos.find(g => g.periodo === '60dias');
        } else {
          grupo = grupos.find(g => g.periodo === '90dias');
        }

        if (grupo) {
          grupo.quantidade++;
          grupo.valorTotal += rec.valor_previsto;
          grupo.recebimentos.push(rec);
        }
      });

      return grupos;
    } catch (err) {
      console.error('[useBilling] fetchRecebimentosAgrupados error:', err);
      return [];
    }
  }, [fetchRecebimentos]);

  /**
   * Registra um recebimento (baixa) e identifica glosas automaticamente
   */
  const registerRecebimento = useCallback(async (
    recebimentoId: string,
    baixa: RecebimentoBaixaInput,
    userName: string
  ): Promise<{ success: boolean; glosaGerada?: Glosa; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      // Buscar recebimento atual
      const { data: recebimentoAtual, error: fetchError } = await supabase
        .from('recebimentos')
        .select('*')
        .eq('id_receb', recebimentoId)
        .single();

      if (fetchError) throw fetchError;

      // Determinar status baseado nos valores
      let novoStatus: RecebimentoStatus = 'recebido';
      let glosaGerada: Glosa | undefined;

      if (baixa.valor_recebido < recebimentoAtual.valor_previsto) {
        novoStatus = 'parcial';
        
        // Criar glosa automaticamente
        const valorGlosa = recebimentoAtual.valor_previsto - baixa.valor_recebido;
        
        const { data: glosaData, error: glosaError } = await supabase
          .from('glosas')
          .insert({
            recebimento_id: recebimentoId,
            nota_id: recebimentoAtual.nota_id,
            valor: valorGlosa,
            motivo: 'Glosa identificada automaticamente - valor recebido menor que previsto',
            status: 'aberta',
            recurso: false,
            responsavel: userName
          })
          .select()
          .single();

        if (glosaError) {
          console.warn('[useBilling] Erro ao criar glosa automática:', glosaError);
        } else {
          glosaGerada = glosaData;
        }
      }

      // Atualizar recebimento
      const { error: updateError } = await supabase
        .from('recebimentos')
        .update({
          data_receb: baixa.data_receb,
          valor_recebido: baixa.valor_recebido,
          status: novoStatus,
          banco_nome: baixa.banco_nome,
          banco_conta: baixa.banco_conta,
          comprovante_url: baixa.comprovante_url,
          observacoes: baixa.observacoes,
          registrado_por: userName,
          updated_at: new Date().toISOString()
        })
        .eq('id_receb', recebimentoId);

      if (updateError) throw updateError;

      // Atualizar lista local
      await fetchRecebimentos();

      return { 
        success: true, 
        glosaGerada: glosaGerada 
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar recebimento';
      setError(message);
      console.error('[useBilling] registerRecebimento error:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchRecebimentos]);

  // ============================================================================
  // GLOSAS
  // ============================================================================

  /**
   * Busca glosas
   */
  const fetchGlosas = useCallback(async (filters?: {
    status?: GlosaStatus;
    recurso?: boolean;
    nota_id?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('glosas')
        .select(`
          *,
          recebimento:recebimentos(
            id_receb, data_prevista, valor_previsto,
            nota:notas(
              id_nota, numero_nota,
              operadora:operadoras(id_operadora, nome)
            )
          ),
          nota:notas(id_nota, numero_nota),
          requisicao:requisicoes(id_requisicao, numero_guia, paciente_nome)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.recurso !== undefined) {
        query = query.eq('recurso', filters.recurso);
      }
      if (filters?.nota_id) {
        query = query.eq('nota_id', filters.nota_id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setGlosas(data || []);
      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar glosas';
      setError(message);
      console.error('[useBilling] fetchGlosas error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualiza status de uma glosa (para recurso ou reversão)
   */
  const updateGlosaStatus = useCallback(async (
    glosaId: string,
    update: GlosaRecursoInput
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const updateData: Partial<Glosa> = {
        status: update.status,
        updated_at: new Date().toISOString()
      };

      // Se está entrando em recurso
      if (update.status === 'em_recurso') {
        updateData.recurso = true;
        updateData.data_recurso = update.data_recurso || new Date().toISOString().split('T')[0];
        updateData.responsavel = update.responsavel;
      }

      // Se foi revertida ou tem resultado
      if (update.resultado_recurso) {
        updateData.resultado_recurso = update.resultado_recurso;
      }

      const { error: updateError } = await supabase
        .from('glosas')
        .update(updateData)
        .eq('id_glosa', glosaId);

      if (updateError) throw updateError;

      // A trigger do banco (update_nota_valores) já recalcula o título a partir
      // desta própria linha de glosas quando o status muda: 'revertida' tira o
      // valor do glosado e devolve o saldo a cobrável. Somar aqui em
      // recebimentos.valor_recebido contaria o valor duas vezes, na direção
      // errada — foi removido por isso (achado 1.1 da revisão).
      await fetchGlosas();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar glosa';
      setError(message);
      console.error('[useBilling] updateGlosaStatus error:', err);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [fetchGlosas]);

  // ============================================================================
  // UTILS
  // ============================================================================

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const clearError = () => setError(null);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Estado
    loading,
    error,
    recebimentos,
    glosas,

    // Recebimentos
    fetchRecebimentos,
    fetchRecebimentosAgrupados,
    registerRecebimento,

    // Glosas
    fetchGlosas,
    updateGlosaStatus,

    // Utils
    formatCurrency,
    clearError
  };
};

export default useBilling;
