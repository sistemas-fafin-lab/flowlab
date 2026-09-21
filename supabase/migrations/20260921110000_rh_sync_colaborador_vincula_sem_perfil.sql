-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — rh_sync_colaborador: vincula colaborador pré-cadastrado ao criar a conta
-- Migration: 20260921110000_rh_sync_colaborador_vincula_sem_perfil.sql
--
-- Colaboradores cadastrados pelo RH antes de a pessoa ter conta (user_profile_id
-- NULL, status 'ativo') nunca eram vinculados: rh_sync_colaborador só tratava
-- "CPF inexistente", "mesmo perfil" e "readmissão de desligado". Novo caso: CPF
-- já existe, sem vínculo (user_profile_id IS NULL) e o perfil está ativo -> liga
-- o perfil ao colaborador, preservando nome/email/cargo/gestor cadastrados pelo
-- RH (só preenche departamento se estiver vazio).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_sync_colaborador(up public.user_profiles)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r           record;
  v_status    text;
  v_existente record;
BEGIN
  SELECT * INTO r FROM public.rh_resolver_dados_colaborador(up);

  IF r.cpf IS NULL OR NOT public.cpf_valido(r.cpf) THEN
    RETURN; -- fica pendente (PARTE 6), tratamento manual
  END IF;

  v_status := CASE WHEN up.deleted_at IS NOT NULL OR up.disabled_at IS NOT NULL THEN 'desligado' ELSE 'ativo' END;

  SELECT * INTO v_existente FROM public.colaboradores WHERE cpf = r.cpf;

  IF NOT FOUND THEN
    INSERT INTO public.colaboradores (nome, email, cpf, departamento, status, user_profile_id)
    VALUES (r.nome, r.email, r.cpf, r.departamento, v_status, up.id)
    ON CONFLICT (cpf) DO NOTHING;
    RETURN;
  END IF;

  IF v_existente.user_profile_id = up.id THEN
    UPDATE public.colaboradores
       SET nome = r.nome, email = r.email, departamento = r.departamento, status = v_status
     WHERE id = v_existente.id;
    RETURN;
  END IF;

  IF v_existente.user_profile_id IS NULL AND v_status = 'ativo' THEN
    UPDATE public.colaboradores
       SET user_profile_id = up.id,
           departamento = COALESCE(departamento, r.departamento),
           status = 'ativo'
     WHERE id = v_existente.id;
    RETURN;
  END IF;

  IF v_status = 'ativo' AND v_existente.status = 'desligado' THEN
    UPDATE public.colaboradores
       SET user_profile_id = up.id, nome = r.nome, email = r.email,
           departamento = r.departamento, status = v_status
     WHERE id = v_existente.id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rh_sync_colaborador(public.user_profiles) IS 'Cria ou atualiza o colaborador correspondente a um user_profile (CPF válido). Compartilhada pelo trigger de sync e pelo backfill — nunca troca um vínculo já ativo por outro; resolve readmissão (ativo assume vínculo de desligado com mesmo CPF) e vincula colaborador pré-cadastrado sem perfil (user_profile_id NULL).';
