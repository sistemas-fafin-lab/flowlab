-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios: Atividades (treinamento, reunião ou qualquer outra).
--
-- Uma atividade é só um lembrete num dia do calendário: título, horário opcional e
-- descrição. Não tem regra, não é marcada como enviada, não fica atrasada e não
-- conta na carga do dia da sugestão. É lançada avulsa, um dia por vez.
--
-- Quem e quando: por trigger com o usuário da sessão, como nos feriados
-- (20261028170000). RLS igual às demais tabelas do Calendário (20261028160000):
-- leitura com fat_pode_ver_tela('canViewCalendarioEnvios'), escrita com
-- canManageCalendarioEnvios.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_envio_nome_usuario()') IS NULL THEN
    RAISE EXCEPTION 'Função public.fat_envio_nome_usuario() não existe. Aplique 20261028160000_fat_calendario_envios.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fat_calendario_atividades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data               DATE NOT NULL,
  titulo             TEXT NOT NULL CHECK (btrim(titulo) <> '' AND char_length(titulo) <= 120),
  -- Nulo: o dia todo.
  horario            TIME,
  descricao          TEXT CHECK (char_length(descricao) <= 2000),
  criado_por         UUID REFERENCES auth.users(id),
  criado_por_nome    TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_por       UUID REFERENCES auth.users(id),
  alterado_por_nome  TEXT,
  alterado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fat_calendario_atividades_data_idx ON public.fat_calendario_atividades (data);

COMMENT ON TABLE public.fat_calendario_atividades IS 'Atividade do Calendário de envios (treinamento, reunião…): lembrete num dia, sem status e fora da sugestão.';

-- Quem criou não muda depois do INSERT; quem alterou é regravado a cada escrita.
CREATE OR REPLACE FUNCTION public.fat_calendario_atividades_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por = auth.uid();
    NEW.criado_por_nome = public.fat_envio_nome_usuario();
    NEW.criado_em = NOW();
  ELSE
    NEW.criado_por = OLD.criado_por;
    NEW.criado_por_nome = OLD.criado_por_nome;
    NEW.criado_em = OLD.criado_em;
  END IF;
  NEW.alterado_por = auth.uid();
  NEW.alterado_por_nome = public.fat_envio_nome_usuario();
  NEW.alterado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_calendario_atividades_autoria ON public.fat_calendario_atividades;
CREATE TRIGGER trigger_fat_calendario_atividades_autoria
  BEFORE INSERT OR UPDATE ON public.fat_calendario_atividades
  FOR EACH ROW EXECUTE FUNCTION public.fat_calendario_atividades_set_autoria();

ALTER TABLE public.fat_calendario_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fat_calendario_atividades_select_calendario ON public.fat_calendario_atividades;
DROP POLICY IF EXISTS fat_calendario_atividades_insert_calendario ON public.fat_calendario_atividades;
DROP POLICY IF EXISTS fat_calendario_atividades_update_calendario ON public.fat_calendario_atividades;
DROP POLICY IF EXISTS fat_calendario_atividades_delete_calendario ON public.fat_calendario_atividades;

CREATE POLICY fat_calendario_atividades_select_calendario ON public.fat_calendario_atividades
  FOR SELECT TO authenticated USING (public.fat_pode_ver_tela('canViewCalendarioEnvios'));
CREATE POLICY fat_calendario_atividades_insert_calendario ON public.fat_calendario_atividades
  FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission('canManageCalendarioEnvios'));
CREATE POLICY fat_calendario_atividades_update_calendario ON public.fat_calendario_atividades
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageCalendarioEnvios'))
  WITH CHECK (public.current_user_has_permission('canManageCalendarioEnvios'));
CREATE POLICY fat_calendario_atividades_delete_calendario ON public.fat_calendario_atividades
  FOR DELETE TO authenticated USING (public.current_user_has_permission('canManageCalendarioEnvios'));
