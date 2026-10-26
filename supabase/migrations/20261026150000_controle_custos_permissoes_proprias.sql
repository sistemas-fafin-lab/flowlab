/*
  # Controle de Custos — permissões próprias, fora do Faturamento

  Até aqui o Controle de Custos (/cost-control) e as tabelas custo_* usavam as chaves do
  Faturamento: leitura com `canViewBilling` ou `canManageBilling`, escrita com
  `canManageBilling`. Quem entrava no Faturamento via também custo e margem dos exames.
  A coordenação pediu que só poucas pessoas vejam essa parte.

  Duas chaves novas, registradas em `src/utils/permissions.ts` (grupo "Controle de Custos"):
  - `canViewControleCustos`   — ver a tela e ler as tabelas custo_*;
  - `canManageControleCustos` — também criar, editar e excluir (implica ver).

  Só o cargo "Administrador" recebe as chaves aqui (pelo id fixo e pelo nome). Quem mais
  precisar recebe por cargo customizado, na tela de Cargos. As chaves do Faturamento
  deixam de dar acesso aos custos a partir desta migration.

  Idempotente: o NOT ? impede duplicar a chave, e as policies são recriadas.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewControleCustos"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewControleCustos';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageControleCustos"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageControleCustos';

-- ─── RLS das tabelas custo_* ──────────────────────────────────────────────────
-- Mesmos nomes de policy de antes (sufixo _billing), para o DROP das migrations antigas
-- continuar acertando a policy certa se alguma for reaplicada.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'custo_exames',
    'custo_fontes_pagadoras',
    'custo_fontes_pagadoras_exclusoes',
    'custo_fontes_pagadoras_valores_exame',
    'custo_tabelas_associadas'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_billing', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.current_user_has_permission(''canViewControleCustos'')
             OR public.current_user_has_permission(''canManageControleCustos''))',
      t || '_select_billing', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_billing', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.current_user_has_permission(''canManageControleCustos''))
         WITH CHECK (public.current_user_has_permission(''canManageControleCustos''))',
      t || '_write_billing', t);
  END LOOP;
END $$;
