-- ═══════════════════════════════════════════════════════════════════════════════
-- user_profiles.cpf não diverge do CPF do colaborador ligado
-- Migration: 20261112180000_user_profiles_cpf_igual_ao_do_rh.sql
--
-- A tela de Usuários passou a editar o CPF da conta (quem tem Gerenciar cargos, pela
-- regra de perm_protege_perfil). Para quem ainda não tem colaborador, o CPF novo faz o
-- trigger de sync criar/vincular o colaborador (20261112120000). Para quem já está
-- ligado a um colaborador, o CPF da pessoa é o do RH (20261106130000): trocar só o da
-- conta deixaria os dois diferentes, então a troca é recusada com uma mensagem para a
-- tela. Também é recusado o CPF de um colaborador já ligado a OUTRA conta (seria a mesma
-- pessoa em duas contas, e o sync não vincularia nada em silêncio).
-- Passam: apagar o CPF (soft_delete_user) e restaurar um perfil excluído (restore_user
-- regrava o CPF do snapshot, que não pode ser barrado aqui).
-- Só cobre o lado de user_profiles: o RH não tem tela para trocar CPF nem vínculo com
-- CPF diferente (vincular usa o CPF do colaborador).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.user_profiles_cpf_igual_ao_do_rh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador record;
BEGIN
  IF NEW.cpf IS NULL OR NEW.cpf IS NOT DISTINCT FROM OLD.cpf OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome, cpf INTO v_colaborador
    FROM public.colaboradores
   WHERE user_profile_id = NEW.id;

  IF FOUND AND v_colaborador.cpf IS DISTINCT FROM NEW.cpf THEN
    RAISE EXCEPTION 'Este usuário está ligado ao colaborador "%" do RH, que tem outro CPF (final %). O CPF de quem já tem colaborador não é trocado por aqui.',
      v_colaborador.nome, right(v_colaborador.cpf, 3)
      USING ERRCODE = '23514';
  END IF;

  SELECT c.nome, p.name AS conta INTO v_colaborador
    FROM public.colaboradores c
    JOIN public.user_profiles p ON p.id = c.user_profile_id
   WHERE c.cpf = NEW.cpf
     AND c.user_profile_id <> NEW.id;

  IF FOUND THEN
    RAISE EXCEPTION 'Este CPF é do colaborador "%" do RH, já ligado à conta "%".', v_colaborador.nome, v_colaborador.conta
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_profiles_cpf_igual_ao_do_rh() IS 'BEFORE UPDATE OF cpf em user_profiles: recusa um CPF diferente do do colaborador do RH ligado à conta, ou de um colaborador ligado a outra conta. Apagar o CPF e restaurar perfil excluído passam.';

REVOKE ALL ON FUNCTION public.user_profiles_cpf_igual_ao_do_rh() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_user_profiles_cpf_igual_ao_do_rh ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_cpf_igual_ao_do_rh
  BEFORE UPDATE OF cpf ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_cpf_igual_ao_do_rh();
