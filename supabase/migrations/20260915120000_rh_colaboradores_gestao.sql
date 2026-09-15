-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Colaboradores: escrita (issues 02, 03, 04)
-- Migration: 20260915120000_rh_colaboradores_gestao.sql
--
-- 20260914150000 (issue 01) deixou colaboradores só-leitura de propósito
-- ("Escrita fica para o ticket de edição de cadastro"). Esta migration abre a
-- escrita para: editar cadastro (cargo/data_admissao/matricula/departamento —
-- issue 02), vincular/desvincular user_profile_id (issue 03) e definir
-- gestor_id (issue 04).
--
-- Issue 02 pede explicitamente "a mesma permissão de RH usada na listagem" —
-- não uma permission nova de gerenciamento. Por isso a policy de UPDATE usa
-- canViewColaboradores, igual à de SELECT (20260914150000): quem acessa a
-- tela de RH já pode editar a ficha, sem uma segunda permission granular
-- neste v1 (spec.md também não previa RBAC granular nesta leva de tickets).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS colaboradores_update ON public.colaboradores;
CREATE POLICY colaboradores_update ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canViewColaboradores'))
  WITH CHECK (public.current_user_has_permission('canViewColaboradores'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- Gestor (issue 04): bloqueia auto-referência e ciclos na cadeia de gestores
-- diretamente no banco — defesa em profundidade além da checagem client-side,
-- já que qualquer UPDATE de gestor_id (inclusive futuro, fora da tela atual)
-- passa por aqui. Sobe a cadeia a partir do novo gestor: se em algum ponto
-- encontrar o próprio colaborador, é ciclo.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_colaboradores_validar_gestor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_atual uuid;
BEGIN
  IF NEW.gestor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.gestor_id = NEW.id THEN
    RAISE EXCEPTION 'Um colaborador não pode ser gestor de si mesmo.';
  END IF;

  v_atual := NEW.gestor_id;
  LOOP
    SELECT gestor_id INTO v_atual FROM public.colaboradores WHERE id = v_atual;
    EXIT WHEN v_atual IS NULL;
    IF v_atual = NEW.id THEN
      RAISE EXCEPTION 'Ciclo de hierarquia: este colaborador já está, direta ou indiretamente, na cadeia de gestores do colaborador escolhido.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.rh_colaboradores_validar_gestor() IS 'Bloqueia auto-referência e ciclos em colaboradores.gestor_id (issue 04) — sobe a cadeia a partir do novo gestor até achar NULL (ok) ou voltar ao próprio colaborador (ciclo).';

DROP TRIGGER IF EXISTS trigger_colaboradores_validar_gestor ON public.colaboradores;
CREATE TRIGGER trigger_colaboradores_validar_gestor
  BEFORE INSERT OR UPDATE OF gestor_id ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.rh_colaboradores_validar_gestor();
