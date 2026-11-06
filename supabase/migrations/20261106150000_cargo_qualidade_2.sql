/*
  # Cargo "Qualidade 2" — Qualidade somente leitura

  O cargo "Qualidade" foi criado pela tela de Cargos e Permissões (não há seed em
  migration). "Qualidade 2" nasce como cópia dele, sem as permissões de gerenciar
  ou alterar: remove toda key que comece com canManage, canGerir, canEdit ou
  canAlterar (inclui canManageQualidade).

  Se "Qualidade" não existir neste banco, o cargo nasce só com canViewQualidade.

  A cópia é feita uma vez, na aplicação da migration: mudanças posteriores no
  cargo "Qualidade" não se propagam. Idempotente (ON CONFLICT DO NOTHING).
*/

INSERT INTO public.custom_roles (name, description, permissions, is_system)
SELECT
  'Qualidade 2',
  'Mesmas permissões do cargo Qualidade, sem gerenciar nem alterar.',
  COALESCE(
    (
      SELECT jsonb_agg(p.key ORDER BY p.key)
        FROM public.custom_roles q,
             LATERAL jsonb_array_elements_text(q.permissions) AS p(key)
       WHERE lower(q.name) = 'qualidade'
         AND p.key !~ '^can(Manage|Gerir|Edit|Alterar)'
    ),
    '["canViewQualidade"]'::jsonb
  ),
  false
ON CONFLICT (name) DO NOTHING;
