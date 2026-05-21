-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo TI - Dashboard Metrics RPC
-- Migration: 20260521000000_it_project_dashboard_rpc.sql
-- 
-- Função agregada que retorna todos os dados do ITProjectDashboard em uma
-- única chamada de rede. Recebe um project_id (UUID) e devolve JSON estruturado.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_it_project_dashboard_metrics(p_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_project_exists BOOLEAN;
BEGIN
  -- Verifica se o projeto existe e o caller tem acesso
  SELECT EXISTS (
    SELECT 1 FROM it_projects WHERE id = p_project_id
  ) INTO v_project_exists;

  IF NOT v_project_exists THEN
    RETURN json_build_object('error', 'Projeto não encontrado');
  END IF;

  SELECT json_build_object(
    'project', (
      SELECT json_build_object(
        'id',             p.id,
        'name',           p.name,
        'description',    p.description,
        'color',          p.color,
        'created_at',     p.created_at,
        'updated_at',     p.updated_at
      )
      FROM it_projects p
      WHERE p.id = p_project_id
    ),

    'metrics', (
      SELECT json_build_object(
        'total_tasks',        COALESCE(t.total_tasks, 0),
        'completed_tasks',    COALESCE(t.completed_tasks, 0),
        'total_sprints',      COALESCE(s.total_sprints, 0),
        'completed_sprints',  COALESCE(s.completed_sprints, 0),
        'active_sprints',     COALESCE(s.active_sprints, 0),
        'planned_sprints',    COALESCE(s.planned_sprints, 0)
      )
      FROM
        (
          SELECT
            COUNT(*)                          AS total_tasks,
            COUNT(*) FILTER (WHERE kanban_status = 'done') AS completed_tasks
          FROM it_requests
          WHERE project_id = p_project_id
        ) t
      CROSS JOIN
        (
          SELECT
            COUNT(*)                              AS total_sprints,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_sprints,
            COUNT(*) FILTER (WHERE status = 'active')   AS active_sprints,
            COUNT(*) FILTER (WHERE status = 'planned')  AS planned_sprints
          FROM it_sprints
          WHERE project_id = p_project_id
        ) s
    ),

    'status_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'kanban_status', sd.kanban_status,
            'count', sd.cnt
          ) ORDER BY sd.kanban_status
        ),
        '[]'::JSON
      )
      FROM (
        SELECT kanban_status, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY kanban_status
      ) sd
    ),

    'sprints_timeline', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',              sp.id,
            'name',            sp.name,
            'goal',            sp.goal,
            'start_date',      sp.start_date,
            'end_date',        sp.end_date,
            'status',          sp.status,
            'total_tasks',     COALESCE(st.task_count, 0),
            'completed_tasks', COALESCE(st.done_count, 0),
            'progress_pct',    CASE
                                 WHEN COALESCE(st.task_count, 0) = 0 THEN 0
                                 ELSE ROUND(
                                   (COALESCE(st.done_count, 0)::NUMERIC / st.task_count::NUMERIC) * 100
                                 )
                               END
          ) ORDER BY sp.start_date ASC, sp.created_at ASC
        ),
        '[]'::JSON
      )
      FROM it_sprints sp
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS task_count,
          COUNT(*) FILTER (WHERE r.kanban_status = 'done') AS done_count
        FROM it_requests r
        WHERE r.sprint_id = sp.id
      ) st ON true
      WHERE sp.project_id = p_project_id
    ),

    'priority_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'priority', pd.priority,
            'count', pd.cnt
          ) ORDER BY
            CASE pd.priority
              WHEN 'critical' THEN 1
              WHEN 'high'     THEN 2
              WHEN 'medium'   THEN 3
              WHEN 'low'      THEN 4
            END
        ),
        '[]'::JSON
      )
      FROM (
        SELECT priority, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY priority
      ) pd
    ),

    'type_distribution', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'request_type', td.request_type,
            'count', td.cnt
          ) ORDER BY td.cnt DESC
        ),
        '[]'::JSON
      )
      FROM (
        SELECT request_type, COUNT(*) AS cnt
        FROM it_requests
        WHERE project_id = p_project_id
        GROUP BY request_type
      ) td
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ─── Permissão de execução para usuários autenticados ────────────────────────
GRANT EXECUTE ON FUNCTION get_it_project_dashboard_metrics(UUID) TO authenticated;

-- ─── Comentário de documentação ───────────────────────────────────────────────
COMMENT ON FUNCTION get_it_project_dashboard_metrics IS
'Retorna métricas agregadas de um projeto de TI: dados do projeto, contagens de tasks/sprints,
distribuição por status kanban, timeline de sprints com progresso, distribuição por prioridade e tipo.';
