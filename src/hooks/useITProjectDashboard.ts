import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Espelham exatamente o payload JSON da RPC get_it_project_dashboard_metrics
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardProject {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total_tasks: number;
  completed_tasks: number;
  total_sprints: number;
  completed_sprints: number;
  active_sprints: number;
  planned_sprints: number;
}

export interface StatusDistributionItem {
  kanban_status: string;
  count: number;
}

export interface SprintTimelineItem {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'planned' | 'active' | 'completed';
  total_tasks: number;
  completed_tasks: number;
  progress_pct: number;
}

export interface PriorityDistributionItem {
  priority: string;
  count: number;
}

export interface TypeDistributionItem {
  request_type: string;
  count: number;
}

export interface ITProjectDashboardData {
  project: DashboardProject;
  metrics: DashboardMetrics;
  status_distribution: StatusDistributionItem[];
  sprints_timeline: SprintTimelineItem[];
  priority_distribution: PriorityDistributionItem[];
  type_distribution: TypeDistributionItem[];
}

export interface DashboardRPCError {
  error: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useITProjectDashboard(projectId: string | null) {
  const [data, setData] = useState<ITProjectDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'get_it_project_dashboard_metrics',
        { p_project_id: projectId }
      );

      if (abortRef.current) return;

      if (rpcError) {
        console.error('[useITProjectDashboard] RPC error:', rpcError);
        setError(rpcError.message);
        setData(null);
        return;
      }

      if (!rpcResult) {
        setError('Nenhum dado retornado pela função.');
        setData(null);
        return;
      }

      const result = rpcResult as ITProjectDashboardData | DashboardRPCError;

      if ('error' in result) {
        setError(result.error);
        setData(null);
        return;
      }

      setData(result as ITProjectDashboardData);
    } catch (err) {
      if (abortRef.current) return;
      const message = err instanceof Error ? err.message : 'Erro inesperado ao carregar métricas.';
      console.error('[useITProjectDashboard] Unexpected error:', err);
      setError(message);
      setData(null);
    } finally {
      if (!abortRef.current) {
        setIsLoading(false);
      }
    }
  }, [projectId]);

  const refetch = useCallback(() => {
    abortRef.current = true;
    fetchData();
  }, [fetchData]);

  // Auto-fetch on projectId change
  useEffect(() => {
    fetchData();

    return () => {
      abortRef.current = true;
    };
  }, [fetchData]);

  // Realtime subscription — ouve mudanças em it_requests e it_sprints vinculadas ao projeto
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`it-dashboard-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'it_requests', filter: `project_id=eq.${projectId}` },
        () => { refetch(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'it_sprints', filter: `project_id=eq.${projectId}` },
        () => { refetch(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, refetch]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
