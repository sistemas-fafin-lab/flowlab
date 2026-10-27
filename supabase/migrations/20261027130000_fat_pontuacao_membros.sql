-- ═══════════════════════════════════════════════════════════════════════════════
-- Membros das Frentes da Pontuação do setor (.scratch/faturamento-pontuacao/,
-- issue 02): quem conta no critério "Tarefas pendentes" de cada Frente. A
-- pessoa é o usuário do apLIS (autusuario.IdUsuario), porque as tarefas são
-- contadas por ele; o nome fica gravado para a tela não depender do backup.
--
-- Desativar em vez de apagar (issue 07): sem policy de DELETE.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_pontuacao_membros (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frente            TEXT NOT NULL CHECK (frente IN ('faturamento', 'recursoGlosa')),
  id_usuario_aplis  INTEGER NOT NULL CHECK (id_usuario_aplis > 0),
  nome              TEXT NOT NULL CHECK (btrim(nome) <> ''),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  updated_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (frente, id_usuario_aplis)
);

COMMENT ON TABLE public.fat_pontuacao_membros IS 'Membros de cada Frente da Pontuação do setor (Faturamento → Indicadores), pelo usuário do apLIS. As tarefas pendentes do critério "Tarefas pendentes" são contadas para os membros ativos.';

CREATE OR REPLACE FUNCTION public.fat_pontuacao_membros_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fat_pontuacao_membros_updated_at ON public.fat_pontuacao_membros;
CREATE TRIGGER trigger_fat_pontuacao_membros_updated_at
  BEFORE INSERT OR UPDATE ON public.fat_pontuacao_membros
  FOR EACH ROW EXECUTE FUNCTION public.fat_pontuacao_membros_set_updated_at();

-- ─── RLS — mesmo padrão de metas_faturamento: canViewBilling lê,
-- canManageBilling grava.
ALTER TABLE public.fat_pontuacao_membros ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fat_pontuacao_membros'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.fat_pontuacao_membros', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "fat_pontuacao_membros_select_billing" ON public.fat_pontuacao_membros
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewBilling')
      OR public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_membros_insert_billing" ON public.fat_pontuacao_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

CREATE POLICY "fat_pontuacao_membros_update_billing" ON public.fat_pontuacao_membros
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageBilling'))
  WITH CHECK (public.current_user_has_permission('canManageBilling'));

-- ─── Membros de set/2026 (grilling de 27/10/2026). A Raquel é a gerente e
-- conta na Recurso de Glosa como qualquer membro.
INSERT INTO public.fat_pontuacao_membros (frente, id_usuario_aplis, nome) VALUES
  ('faturamento',  235, 'Renata Queiroz Bento'),
  ('faturamento',  202, 'Rívia Freire Araujo Barretos Borba'),
  ('faturamento',  256, 'Cleber Kendel de Andrade'),
  ('recursoGlosa', 224, 'Raquel dos Santos Avelino'),
  ('recursoGlosa', 173, 'Maria Eduarda Fonseca Bomfim')
ON CONFLICT (frente, id_usuario_aplis) DO NOTHING;
