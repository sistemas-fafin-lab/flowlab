/*
  # Faturamento — permissão de ver por tela (docs/adr/0001-permissoes-faturamento-por-tela.md)

  Até aqui `canViewBilling` abria todas as telas do Faturamento, e a RLS das tabelas que
  elas leem pedia `canViewBilling` ou `canManageBilling`. As faturistas precisam ver só
  Contas a Receber (e, depois, o Calendário de envios).

  Seis chaves novas, registradas em `src/utils/permissions.ts` (grupo "Faturamento"):
  - `canViewFaturas`, `canViewContasReceber`, `canViewGlosas`, `canViewIndicadores`,
    `canViewCalendarioEnvios` — ver a tela;
  - `canManageCalendarioEnvios` — gerir o Calendário, independente de `canManageBilling`.

  `canViewBilling` continua valendo para tudo; ninguém perde acesso. A leitura de cada
  tabela passa a aceitar também a chave das telas que a leem (pelo navegador ou pela rota
  com o cliente do usuário). A escrita não muda: continua com `canManageBilling`.

  Só o cargo "Administrador" recebe as chaves aqui (pelo id fixo e pelo nome).

  Idempotente: o NOT ? impede duplicar a chave, as policies são recriadas e o guard das
  funções só é trocado se ainda estiver na forma antiga.
*/

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewFaturas"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewFaturas';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewContasReceber"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewContasReceber';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewGlosas"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewGlosas';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewIndicadores"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewIndicadores';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canViewCalendarioEnvios"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canViewCalendarioEnvios';

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageCalendarioEnvios"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageCalendarioEnvios';

-- ─── Regra "chave geral ou chave da tela" ─────────────────────────────────────
-- Mesma regra de src/modules/faturamento/utils/permissoesTelas.ts, mais canManageBilling
-- (quem dá baixa evidentemente vê o título, como na RLS de 20260807120000).

CREATE OR REPLACE FUNCTION public.fat_pode_ver_tela(VARIADIC p_chaves text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling')
      OR EXISTS (SELECT 1 FROM unnest(p_chaves) AS c WHERE public.current_user_has_permission(c));
$$;

COMMENT ON FUNCTION public.fat_pode_ver_tela(text[]) IS
  'Quem está logado pode ver dados do Faturamento lidos pelas telas cujas chaves foram passadas: canViewBilling, canManageBilling ou uma das chaves (ADR 0001).';

-- ─── RLS de leitura ───────────────────────────────────────────────────────────
-- Mesmos nomes de policy de antes (sufixo _select_billing), para o DROP das migrations
-- antigas continuar acertando a policy certa se alguma for reaplicada.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Contas a Receber
      ('lotes',                        '''canViewContasReceber'''),
      ('requisicoes',                  '''canViewContasReceber'''),
      ('notas',                        '''canViewContasReceber'''),
      ('nota_lote',                    '''canViewContasReceber'''),
      ('recebimentos',                 '''canViewContasReceber'''),
      ('glosas',                       '''canViewContasReceber'''),
      ('fat_nfs_canceladas',           '''canViewContasReceber'''),
      ('notas_lancamentos_audit_logs', '''canViewContasReceber'''),
      ('operadoras_audit_logs',        '''canViewContasReceber'''),
      ('clinicas_sem_nf',              '''canViewContasReceber'''),
      -- Contas a Receber (filtros, glosas do apLIS do título) e Glosas e Recursos
      ('operadoras',                   '''canViewContasReceber'', ''canViewGlosas'''),
      ('glosa_recurso_requisicoes',    '''canViewContasReceber'', ''canViewGlosas'''),
      -- Contas a Receber (meta mensal) e Indicadores (pontuação do setor)
      ('metas_faturamento',            '''canViewContasReceber'', ''canViewIndicadores'''),
      -- Glosas e Recursos
      ('glosa_recurso_lotes',          '''canViewGlosas'''),
      ('glosa_recurso_sincronizacoes', '''canViewGlosas'''),
      ('glosa_recurso_historico',      '''canViewGlosas'''),
      ('glosa_prazo_regras',           '''canViewGlosas'''),
      ('glosa_prazo_regra_fontes',     '''canViewGlosas'''),
      -- Indicadores
      ('fat_pontuacao_membros',        '''canViewIndicadores'''),
      ('fat_pontuacao_lancamentos',    '''canViewIndicadores'''),
      ('fat_pontuacao_fechamentos',    '''canViewIndicadores'''),
      ('fat_pontuacao_pontos_base',    '''canViewIndicadores''')
    ) AS t(tabela, chaves)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tabela || '_select_billing', r.tabela);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.fat_pode_ver_tela(%s))',
                   r.tabela || '_select_billing', r.tabela, r.chaves);
  END LOOP;
END $$;

-- Views salvas da aba Títulos: só as próprias, para quem vê Contas a Receber.
DROP POLICY IF EXISTS "fat_views_salvas_select_own" ON public.fat_views_salvas;
CREATE POLICY "fat_views_salvas_select_own" ON public.fat_views_salvas
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND public.fat_pode_ver_tela('canViewContasReceber'));

DROP POLICY IF EXISTS "fat_views_salvas_insert_own" ON public.fat_views_salvas;
CREATE POLICY "fat_views_salvas_insert_own" ON public.fat_views_salvas
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND public.fat_pode_ver_tela('canViewContasReceber'));

DROP POLICY IF EXISTS "fat_views_salvas_update_own" ON public.fat_views_salvas;
CREATE POLICY "fat_views_salvas_update_own" ON public.fat_views_salvas
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND public.fat_pode_ver_tela('canViewContasReceber'))
  WITH CHECK (usuario_id = auth.uid() AND public.fat_pode_ver_tela('canViewContasReceber'));

DROP POLICY IF EXISTS "fat_views_salvas_delete_own" ON public.fat_views_salvas;
CREATE POLICY "fat_views_salvas_delete_own" ON public.fat_views_salvas
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() AND public.fat_pode_ver_tela('canViewContasReceber'));

-- ─── Guard das funções de leitura (SECURITY DEFINER) ──────────────────────────
-- Troca só o IF NOT do começo, sem recopiar o corpo: lê a definição em vigor e
-- substitui o trecho exato. Já trocado (migration reaplicada), segue; nem o antigo
-- nem o novo (corpo alterado à mão), a migration falha em vez de deixar a tela sem dados.

DO $$
DECLARE
  r       record;
  v_def   text;
  v_novo  text;
  v_antigo constant text := E'IF NOT (public.current_user_has_permission(''canViewBilling'')\n          OR public.current_user_has_permission(''canManageBilling'')) THEN';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.fat_dashboard_receber(date, date, uuid[], text[], text[])', '''canViewContasReceber'''),
      ('public.fat_meta_mensal_faturado(integer, integer)',                '''canViewContasReceber'', ''canViewIndicadores''')
    ) AS t(funcao, chaves)
  LOOP
    v_def := pg_get_functiondef(r.funcao::regprocedure);
    v_novo := replace(v_def, v_antigo, format('IF NOT public.fat_pode_ver_tela(%s) THEN', r.chaves));
    IF v_novo = v_def THEN
      IF position('fat_pode_ver_tela(' IN v_def) = 0 THEN
        RAISE EXCEPTION '%: guard de permissão não reconhecido', r.funcao;
      END IF;
    ELSE
      EXECUTE v_novo;
    END IF;
  END LOOP;
END $$;
