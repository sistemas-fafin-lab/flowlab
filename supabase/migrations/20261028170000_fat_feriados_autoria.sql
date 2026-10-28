-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios do Faturamento: quem alterou e quando nos feriados
-- (.scratch/faturamento-calendario-envios/issues/05-cadastro-regras-feriados.md).
--
-- O cadastro de feriados passa a ser editado pela tela. Como nas Regras de envio,
-- quem e quando são gravados por trigger com o usuário da sessão, nunca com o que
-- vier no corpo. Os feriados da carga inicial ficam sem autor.
--
-- Remover um feriado muda o dia útil de todo o calendário e apaga a linha; por isso
-- cada criação, alteração e remoção também vai para fat_feriados_historico, escrito
-- só por trigger (como o histórico dos agendamentos).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_envio_nome_usuario()') IS NULL THEN
    RAISE EXCEPTION 'Função public.fat_envio_nome_usuario() não existe. Aplique 20261028160000_fat_calendario_envios.sql antes desta migration.';
  END IF;
END $$;

ALTER TABLE public.fat_feriados
  ADD COLUMN IF NOT EXISTS alterado_por      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS alterado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS alterado_em       TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.fat_feriados_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.alterado_por = auth.uid();
  NEW.alterado_por_nome = public.fat_envio_nome_usuario();
  NEW.alterado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_feriados_autoria ON public.fat_feriados;
CREATE TRIGGER trigger_fat_feriados_autoria
  BEFORE INSERT OR UPDATE ON public.fat_feriados
  FOR EACH ROW EXECUTE FUNCTION public.fat_feriados_set_autoria();

-- ─── Histórico ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fat_feriados_historico (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sem FK: o histórico de um feriado removido continua ligado a ele.
  feriado_id  UUID NOT NULL,
  acao        TEXT NOT NULL CHECK (acao IN ('criou', 'alterou', 'removeu')),
  antes       JSONB,
  depois      JSONB,
  por         UUID REFERENCES auth.users(id),
  por_nome    TEXT,
  em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fat_feriados_historico_feriado_idx ON public.fat_feriados_historico (feriado_id);

COMMENT ON TABLE public.fat_feriados_historico IS 'Histórico dos feriados do Calendário de envios (criou, alterou, removeu), gravado por trigger.';

-- SECURITY DEFINER: o histórico não tem policy de escrita; só este trigger grava.
CREATE OR REPLACE FUNCTION public.fat_feriados_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes  JSONB := CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('data', OLD.data, 'descricao', OLD.descricao, 'abrangencia', OLD.abrangencia) END;
  v_depois JSONB := CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('data', NEW.data, 'descricao', NEW.descricao, 'abrangencia', NEW.abrangencia) END;
BEGIN
  IF TG_OP = 'UPDATE' AND v_antes = v_depois THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.fat_feriados_historico (feriado_id, acao, antes, depois, por, por_nome)
  VALUES (COALESCE(NEW.id, OLD.id),
          CASE TG_OP WHEN 'INSERT' THEN 'criou' WHEN 'UPDATE' THEN 'alterou' ELSE 'removeu' END,
          v_antes, v_depois, auth.uid(), public.fat_envio_nome_usuario());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_feriados_historico ON public.fat_feriados;
CREATE TRIGGER trigger_fat_feriados_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.fat_feriados
  FOR EACH ROW EXECUTE FUNCTION public.fat_feriados_historico();

-- RLS (ADR 0001): leitura como as demais tabelas do Calendário; sem escrita direta.
ALTER TABLE public.fat_feriados_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fat_feriados_historico_select_calendario ON public.fat_feriados_historico;
CREATE POLICY fat_feriados_historico_select_calendario ON public.fat_feriados_historico
  FOR SELECT TO authenticated USING (public.fat_pode_ver_tela('canViewCalendarioEnvios'));
