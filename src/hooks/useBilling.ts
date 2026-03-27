import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Nota,
  NotaStatus,
  Operadora,
  Lote,
  Recebimento,
  RecebimentoStatus,
  RecebimentoBaixaInput,
  Glosa,
  GlosaStatus,
  GlosaRecursoInput,
  BillingMetrics,
  RecebimentoAgrupado,
  BillingSyncLog
} from '../modules/billing/types';

// ============================================================================
// HOOK: useBilling
// Gerencia operações do módulo de faturamento e recebíveis
// ============================================================================

export const useBilling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para dados
  const [notas, setNotas] = useState<Nota[]>([]);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [glosas, setGlosas] = useState<Glosa[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);

  // ============================================================================
  // OPERADORAS
  // ============================================================================

  const fetchOperadoras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('operadoras')
        .select('*')
        .order('nome', { ascending: true });

      if (fetchError) throw fetchError;
      setOperadoras(data || []);
      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar operadoras';
      setError(message);
      console.error('[useBilling] fetchOperadoras error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // NOTAS (FATURAS)
  // ============================================================================

  /**
   * Busca notas com relacionamentos (operadora e lotes)
   */
  const fetchNotas = useCallback(async (filters?: {
    status?: NotaStatus;
    operadora_id?: string;
    competencia?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('notas')
        .select(`
          *,
          operadora:operadoras(id_operadora, nome, cnpj, prazo_pagamento_dias),
          nota_lote(
            lote:lotes(id_lote, codigo_lote, data_criacao, status, valor_total)
          )
        `)
        .order('data_emissao', { ascending: false });

      // Aplicar filtros
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.operadora_id) {
        query = query.eq('operadora_id', filters.operadora_id);
      }
      if (filters?.competencia) {
        query = query.eq('competencia', filters.competencia);
      }
      if (filters?.dataInicio) {
        query = query.gte('data_emissao', filters.dataInicio);
      }
      if (filters?.dataFim) {
        query = query.lte('data_emissao', filters.dataFim);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Formatar dados para incluir lotes na estrutura esperada
      const formattedNotas: Nota[] = (data || []).map((nota: any) => ({
        ...nota,
        lotes: nota.nota_lote?.map((nl: any) => nl.lote).filter(Boolean) || []
      }));

      setNotas(formattedNotas);
      return formattedNotas;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar notas';
      setError(message);
      console.error('[useBilling] fetchNotas error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Busca uma nota específica por ID
   */
  const fetchNotaById = useCallback(async (id: string): Promise<Nota | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notas')
        .select(`
          *,
          operadora:operadoras(*),
          nota_lote(
            lote:lotes(*)
          ),
          recebimentos(*),
          glosas(*)
        `)
        .eq('id_nota', id)
        .single();

      if (fetchError) throw fetchError;

      const formattedNota: Nota = {
        ...data,
        lotes: data.nota_lote?.map((nl: any) => nl.lote).filter(Boolean) || [],
        recebimentos: data.recebimentos || [],
        glosas: data.glosas || []
      };

      return formattedNota;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar nota';
      setError(message);
      console.error('[useBilling] fetchNotaById error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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

  /**
   * Cria um novo recebimento (conta a receber) para uma nota
   */
  const createRecebimento = useCallback(async (
    notaId: string,
    dataPrevista: string,
    valorPrevisto: number
  ): Promise<{ success: boolean; data?: Recebimento; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from('recebimentos')
        .insert({
          nota_id: notaId,
          data_prevista: dataPrevista,
          valor_previsto: valorPrevisto,
          status: 'previsto'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchRecebimentos();
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar recebimento';
      setError(message);
      console.error('[useBilling] createRecebimento error:', err);
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

      // Se glosa foi revertida, atualizar recebimento
      if (update.status === 'revertida') {
        const { data: glosaData } = await supabase
          .from('glosas')
          .select('recebimento_id, valor')
          .eq('id_glosa', glosaId)
          .single();

        if (glosaData?.recebimento_id) {
          // Buscar recebimento e atualizar valor recebido
          const { data: recebData } = await supabase
            .from('recebimentos')
            .select('valor_recebido')
            .eq('id_receb', glosaData.recebimento_id)
            .single();

          if (recebData) {
            await supabase
              .from('recebimentos')
              .update({
                valor_recebido: (recebData.valor_recebido || 0) + glosaData.valor,
                status: 'recebido'
              })
              .eq('id_receb', glosaData.recebimento_id);
          }
        }
      }

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
  // MÉTRICAS E DASHBOARD
  // ============================================================================

  /**
   * Calcula métricas do dashboard de faturamento
   */
  const fetchMetrics = useCallback(async (): Promise<BillingMetrics> => {
    try {
      setLoading(true);
      setError(null);

      const hoje = new Date();
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];

      // Buscar notas
      const { data: notasData } = await supabase
        .from('notas')
        .select('id_nota, valor_total, valor_recebido, valor_glosado, status');

      // Buscar recebimentos do mês
      const { data: recebMes } = await supabase
        .from('recebimentos')
        .select('valor_recebido')
        .gte('data_receb', primeiroDiaMes)
        .in('status', ['recebido', 'parcial']);

      // Buscar glosas
      const { data: glosasData } = await supabase
        .from('glosas')
        .select('id_glosa, valor, status');

      // Buscar contas a receber
      const { data: aReceber } = await supabase
        .from('recebimentos')
        .select('valor_previsto, data_prevista')
        .eq('status', 'previsto');

      // Calcular métricas
      const notasPorStatus = {
        abertas: notasData?.filter(n => n.status === 'aberta').length || 0,
        parcialmente_recebidas: notasData?.filter(n => n.status === 'parcialmente_recebida').length || 0,
        recebidas: notasData?.filter(n => n.status === 'recebida').length || 0,
        glosadas: notasData?.filter(n => n.status === 'glosada').length || 0
      };

      const totalAReceber = aReceber?.reduce((sum, r) => sum + (r.valor_previsto || 0), 0) || 0;
      const valorRecebidoMes = recebMes?.reduce((sum, r) => sum + (r.valor_recebido || 0), 0) || 0;
      const valorGlosadoMes = notasData?.reduce((sum, n) => sum + (n.valor_glosado || 0), 0) || 0;

      // Previsão por período
      const previsao = { proximo30dias: 0, proximo60dias: 0, proximo90dias: 0 };
      aReceber?.forEach(r => {
        const dataPrev = new Date(r.data_prevista);
        const diffDias = Math.ceil((dataPrev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDias <= 30) {
          previsao.proximo30dias += r.valor_previsto || 0;
        } else if (diffDias <= 60) {
          previsao.proximo60dias += r.valor_previsto || 0;
        } else if (diffDias <= 90) {
          previsao.proximo90dias += r.valor_previsto || 0;
        }
      });

      const totalFaturado = notasData?.reduce((sum, n) => sum + (n.valor_total || 0), 0) || 0;
      const taxaGlosa = totalFaturado > 0 ? (valorGlosadoMes / totalFaturado) * 100 : 0;

      const calculatedMetrics: BillingMetrics = {
        totalNotasAbertas: notasPorStatus.abertas,
        valorTotalAReceber: totalAReceber,
        valorRecebidoMes,
        valorGlosadoMes,
        taxaGlosa,
        notasPorStatus,
        previsaoRecebimento: previsao,
        glosasPendentes: glosasData?.filter(g => g.status === 'aberta').length || 0,
        glosasEmRecurso: glosasData?.filter(g => g.status === 'em_recurso').length || 0
      };

      setMetrics(calculatedMetrics);
      return calculatedMetrics;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao calcular métricas';
      setError(message);
      console.error('[useBilling] fetchMetrics error:', err);
      return {
        totalNotasAbertas: 0,
        valorTotalAReceber: 0,
        valorRecebidoMes: 0,
        valorGlosadoMes: 0,
        taxaGlosa: 0,
        notasPorStatus: { abertas: 0, parcialmente_recebidas: 0, recebidas: 0, glosadas: 0 },
        previsaoRecebimento: { proximo30dias: 0, proximo60dias: 0, proximo90dias: 0 },
        glosasPendentes: 0,
        glosasEmRecurso: 0
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // SYNC LOG
  // ============================================================================

  /**
   * Busca histórico de sincronizações
   */
  const fetchSyncLogs = useCallback(async (limit = 10): Promise<BillingSyncLog[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('billing_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      console.error('[useBilling] fetchSyncLogs error:', err);
      return [];
    }
  }, []);

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
    notas,
    operadoras,
    recebimentos,
    glosas,
    metrics,
    
    // Operadoras
    fetchOperadoras,
    
    // Notas
    fetchNotas,
    fetchNotaById,
    
    // Recebimentos
    fetchRecebimentos,
    fetchRecebimentosAgrupados,
    registerRecebimento,
    createRecebimento,
    
    // Glosas
    fetchGlosas,
    updateGlosaStatus,
    
    // Métricas
    fetchMetrics,
    
    // Sync
    fetchSyncLogs,
    
    // Utils
    formatCurrency,
    clearError
  };
};

export default useBilling;
