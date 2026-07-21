-- ============================================================
-- Remover um cadastro de usuário do FlowLab
-- Local: supabase/scripts/remover_usuario.sql
-- ============================================================
--
-- PRÉ-REQUISITO: aplicar a migration 20260721120000_user_soft_delete.sql.
-- Ela cria as colunas deleted_at/deleted_snapshot em user_profiles e as funções
-- soft_delete_user(), soft_delete_user_by_cpf(), restore_user() e
-- list_deleted_users(), que rodam direto no banco.
--
-- Este arquivo tem apenas a função de diagnóstico + o passo a passo de uso.
--
-- POR QUE NÃO EXISTE "DELETE" DE VERDADE:
--   it_requests.requested_by, it_projects.created_by e quotation_approvals.approver_id
--   apontam para user_profiles com ON DELETE RESTRICT. Quem já abriu um chamado,
--   criou projeto ou aprovou cotação não pode ser apagado sem destruir esse histórico.
--   A remoção lógica bloqueia o login, anonimiza os dados pessoais e mantém os
--   registros operacionais.
-- ============================================================


-- ============================================================
-- 1. FUNÇÃO: diagnóstico de dependências (rode antes de remover)
-- ============================================================
CREATE OR REPLACE FUNCTION check_user_dependencies(p_user_id UUID)
RETURNS TABLE (
  tabela TEXT,
  coluna TEXT,
  registros BIGINT,
  acao_recomendada TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_manage_users();

  RETURN QUERY
  SELECT
    'it_requests'::TEXT,
    'requested_by'::TEXT,
    COUNT(*)::BIGINT,
    'RESTRICT — preservado pela remoção lógica'::TEXT
  FROM it_requests WHERE requested_by = p_user_id
  UNION ALL
  SELECT
    'it_projects'::TEXT,
    'created_by'::TEXT,
    COUNT(*)::BIGINT,
    'RESTRICT — preservado pela remoção lógica'::TEXT
  FROM it_projects WHERE created_by = p_user_id
  UNION ALL
  SELECT
    'quotation_approvals'::TEXT,
    'approver_id'::TEXT,
    COUNT(*)::BIGINT,
    'NO ACTION — preservado pela remoção lógica'::TEXT
  FROM quotation_approvals WHERE approver_id = p_user_id
  UNION ALL
  SELECT
    'it_task_comments'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Preservado — autor passa a exibir "Usuário Removido"'::TEXT
  FROM it_task_comments WHERE user_id = p_user_id
  UNION ALL
  SELECT
    'it_task_attachments'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'Preservado — autor passa a exibir "Usuário Removido"'::TEXT
  FROM it_task_attachments WHERE user_id = p_user_id
  UNION ALL
  SELECT
    'user_notifications'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'APAGADO na remoção (dado transitório)'::TEXT
  FROM user_notifications WHERE user_id = p_user_id
  UNION ALL
  SELECT
    'user_approval_limits'::TEXT,
    'user_id'::TEXT,
    COUNT(*)::BIGINT,
    'APAGADO na remoção (alçada não faz sentido sem o usuário)'::TEXT
  FROM user_approval_limits WHERE user_id = p_user_id
  UNION ALL
  SELECT
    'maintenance_requests'::TEXT,
    'requester_id'::TEXT,
    COUNT(*)::BIGINT,
    'CASCADE em auth.users — preservado (não há DELETE)'::TEXT
  FROM maintenance_requests WHERE requester_id = p_user_id
  UNION ALL
  SELECT
    'quotation_messages'::TEXT,
    'created_by'::TEXT,
    COUNT(*)::BIGINT,
    'Sem FK — preservado'::TEXT
  FROM quotation_messages WHERE created_by = p_user_id
  UNION ALL
  SELECT
    'payment_requests'::TEXT,
    'solicitado_por (texto)'::TEXT,
    COUNT(*)::BIGINT,
    'Nome gravado como texto — não é anonimizado automaticamente'::TEXT
  FROM payment_requests WHERE solicitado_por = (
    SELECT name FROM user_profiles WHERE id = p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION check_user_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_user_dependencies(UUID) TO authenticated;


-- ============================================================
-- 2. PASSO A PASSO (SQL Editor do Supabase)
-- ============================================================

-- PASSO 1 — Achar a pessoa:
--   SELECT id, name, email, cpf, role, deleted_at
--     FROM user_profiles
--    WHERE cpf = '03707582183' OR email ILIKE '%fulano%';

-- PASSO 2 — Conferir o que ela tem no sistema (opcional):
--   SELECT * FROM check_user_dependencies('UUID-AQUI');

-- PASSO 3 — Remover:
--   SELECT soft_delete_user_by_cpf('03707582183');   -- pelo CPF (mais prático)
--   SELECT soft_delete_user('UUID-AQUI');            -- pelo UUID
--
--   O que acontece:
--     • login bloqueado (banned_until = infinity, senha zerada, sessões revogadas)
--     • e-mail em auth.users vira deleted_<uuid>@deleted.flowlab.local
--       (o e-mail original fica livre para ser reutilizado por outra conta)
--     • perfil anonimizado: nome "Usuário Removido", CPF/departamento/cargo
--       customizado zerados
--     • CPF desativado na user_whitelist → não consegue se recadastrar pela tela
--     • notificações e limites de alçada apagados
--     • chamados, projetos, aprovações, comentários e anexos PRESERVADOS
--     • snapshot dos dados originais guardado em user_profiles.deleted_snapshot
--
--   Recusa a operação se: for você mesmo, já estiver removido, ou for o último admin ativo.

-- PASSO 4 — Conferir os removidos:
--   SELECT * FROM list_deleted_users();

-- PASSO 5 — Restaurar (se foi engano):
--   SELECT restore_user('UUID-AQUI');
--
--   Devolve nome, e-mail, CPF, departamento e cargo a partir do snapshot,
--   e reativa o CPF na whitelist. A SENHA NÃO VOLTA: a pessoa precisa usar
--   "Esqueci minha senha" para definir uma nova.

-- PASSO 6 — (Raro) Apagar fisicamente:
--   Só é possível se check_user_dependencies retornar 0 em it_requests,
--   it_projects e quotation_approvals. Nesse caso:
--     DELETE FROM auth.users WHERE id = 'UUID-AQUI';   -- CASCADE em user_profiles
--   Com qualquer registro RESTRICT, o comando falha — use a remoção lógica.

-- ============================================================
-- FIM
-- ============================================================
