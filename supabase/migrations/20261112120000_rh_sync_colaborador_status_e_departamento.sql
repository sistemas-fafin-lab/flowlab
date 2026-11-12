-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — o colaborador acompanha o ciclo de vida do login e nasce no departamento
-- Migration: 20261112120000_rh_sync_colaborador_status_e_departamento.sql
--
-- Duas quebras na relação user_profiles ↔ colaboradores (levantamento de 12/11/2026):
--
--   1. O trigger de sync só rodava AFTER INSERT. Desativar, excluir, reativar ou
--      restaurar um usuário não mexia no colaborador: quem saía ficava "ativo" no RH
--      para sempre (e travava a desativação do departamento, que conta os ativos).
--      Também não criava o colaborador de quem ganhava CPF depois de criado.
--   2. Desde 20261103150000 o departamento que vale é colaboradores.departamento_id,
--      mas o colaborador de um usuário novo nascia só com o texto `departamento`, sem
--      departamento_id: a pessoa não conseguia pedir pagamento nem tinha aprovador de
--      SC até o RH preencher (5 contas de teste de outubro estavam assim).
--
-- O que muda:
--   • departamento_ativo_por_nome(text): o departamento ativo com esse nome (sem
--     diferença de caixa/espaços), regra única usada por usuario_definir_departamento
--     e por rh_sync_colaborador.
--   • rh_sync_colaborador resolve o departamento do RH pelo nome ao criar
--     o colaborador, ao vincular um pré-cadastrado sem perfil (só se ele não tiver
--     departamento) e na readmissão. Sem departamento com esse nome, fica NULL como
--     antes (pendência na aba Departamentos do RH).
--   • O trigger roda também em UPDATE OF cpf, disabled_at, deleted_at:
--       – usuário ATIVO sem colaborador que mudou de CPF ou acabou de ser reativado/
--         restaurado → sync (cria/vincula). Usuário inativo não: soft_delete_user zera o
--         CPF e, sem essa trava, a exclusão de quem nunca foi colaborador criaria um
--         colaborador "desligado" a partir do deleted_snapshot;
--       – usuário com colaborador cuja conta ficou ativa/inativa → status
--         'ativo'/'desligado' (mesma regra do backfill de 20260914150000). Ao voltar a
--         ativo num departamento que foi desativado enquanto ele estava fora, o
--         departamento_id volta a NULL (pendência no RH): colaborador ativo nunca fica
--         em departamento inativo.
--     Para quem já tem colaborador, nome e e-mail não são copiados: nome e CPF do
--     colaborador são do RH (20261106130000). Só a readmissão (perfil sem colaborador
--     que assume o de um desligado com o mesmo CPF) copia nome/e-mail, como já fazia.
--
--   Decisão: o status segue o login nos dois sentidos, a regra do v1 (spec de
--   rh-colaboradores). O RH não tem ação própria de desligar; data_desligamento
--   continua manual.
--
-- Não corrige de uma vez quem já está desencontrado (hoje: nenhum desligado errado;
-- 5 contas de teste sem departamento). Conferir com
-- supabase/scripts/departamento_desencontrado.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.departamento_ativo_por_nome(p_nome text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.departamentos
   WHERE ativo AND lower(btrim(nome)) = lower(btrim(p_nome))
   ORDER BY nome
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.departamento_ativo_por_nome(text) IS 'O departamento ativo com esse nome, sem diferença de caixa/espaços (NULL se não houver). Regra única da tela de Usuários (usuario_definir_departamento) e do sync de colaboradores.';

REVOKE ALL ON FUNCTION public.departamento_ativo_por_nome(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.departamento_ativo_por_nome(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.usuario_definir_departamento(p_user UUID, p_departamento TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador UUID;
  v_departamento UUID;
  v_movidos UUID[];
BEGIN
  IF NOT public.departamento_pode_trocar() THEN
    RAISE EXCEPTION 'Sem permissão para mudar o departamento (Gerenciar Colaboradores, Departamentos ou Cargos).' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_colaborador FROM public.colaboradores WHERE user_profile_id = p_user;
  IF v_colaborador IS NULL THEN
    RETURN jsonb_build_object('situacao', 'sem_colaborador', 'movidos', '[]'::jsonb);
  END IF;
  v_departamento := public.departamento_ativo_por_nome(p_departamento);
  IF v_departamento IS NULL THEN
    RETURN jsonb_build_object('situacao', 'sem_departamento', 'movidos', '[]'::jsonb);
  END IF;
  v_movidos := public.colaborador_definir_departamento(v_colaborador, v_departamento);
  RETURN jsonb_build_object('situacao', 'ok', 'movidos', to_jsonb(v_movidos));
END;
$$;

CREATE OR REPLACE FUNCTION public.rh_sync_colaborador(up public.user_profiles)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r              record;
  v_status       text;
  v_existente    record;
BEGIN
  SELECT * INTO r FROM public.rh_resolver_dados_colaborador(up);

  IF r.cpf IS NULL OR NOT public.cpf_valido(r.cpf) THEN
    RETURN; -- fica pendente, tratamento manual
  END IF;

  v_status := CASE WHEN up.deleted_at IS NOT NULL OR up.disabled_at IS NOT NULL THEN 'desligado' ELSE 'ativo' END;

  SELECT * INTO v_existente FROM public.colaboradores WHERE cpf = r.cpf;

  IF NOT FOUND THEN
    INSERT INTO public.colaboradores (nome, email, cpf, departamento, departamento_id, status, user_profile_id)
    VALUES (r.nome, r.email, r.cpf, r.departamento, public.departamento_ativo_por_nome(r.departamento), v_status, up.id)
    ON CONFLICT (cpf) DO NOTHING;
    RETURN;
  END IF;

  IF v_existente.user_profile_id = up.id THEN
    UPDATE public.colaboradores
       SET nome = r.nome, email = r.email, departamento = r.departamento, status = v_status
     WHERE id = v_existente.id;
    RETURN;
  END IF;

  -- Colaborador pré-cadastrado pelo RH, ainda sem login: o perfil novo assume o vínculo.
  IF v_existente.user_profile_id IS NULL AND v_status = 'ativo' THEN
    UPDATE public.colaboradores
       SET user_profile_id = up.id,
           departamento = COALESCE(departamento, r.departamento),
           departamento_id = COALESCE(departamento_id, public.departamento_ativo_por_nome(r.departamento)),
           status = 'ativo'
     WHERE id = v_existente.id;
    RETURN;
  END IF;

  -- Readmissão: o perfil ativo assume o vínculo de um colaborador desligado. Departamento
  -- do perfil sem correspondente ativo no RH: fica o do RH (texto e id juntos), se ainda
  -- estiver ativo; senão, pendência.
  IF v_status = 'ativo' AND v_existente.status = 'desligado' THEN
    UPDATE public.colaboradores c
       SET user_profile_id = up.id, nome = r.nome, email = r.email,
           departamento = CASE WHEN n.id IS NOT NULL THEN r.departamento ELSE c.departamento END,
           departamento_id = COALESCE(n.id, (SELECT d.id FROM public.departamentos d WHERE d.id = c.departamento_id AND d.ativo)),
           status = v_status
      FROM (SELECT public.departamento_ativo_por_nome(r.departamento) AS id) n
     WHERE c.id = v_existente.id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.rh_sync_colaborador(public.user_profiles) IS 'Cria ou atualiza o colaborador correspondente a um user_profile (CPF válido), já no departamento do RH com o nome de user_profiles.department quando existir um ativo. Nunca troca um vínculo já ativo por outro; resolve readmissão (ativo assume vínculo de desligado com mesmo CPF) e vincula colaborador pré-cadastrado sem perfil.';

CREATE OR REPLACE FUNCTION public.rh_colaboradores_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativo_antes boolean;
  v_ativo_agora boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.rh_sync_colaborador(NEW);
    RETURN NEW;
  END IF;

  v_ativo_antes := OLD.disabled_at IS NULL AND OLD.deleted_at IS NULL;
  v_ativo_agora := NEW.disabled_at IS NULL AND NEW.deleted_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE user_profile_id = NEW.id) THEN
    -- Sem colaborador: só cria/vincula para conta ativa que ganhou (ou corrigiu) o CPF ou
    -- acabou de voltar. Conta inativa nunca: a exclusão zera o CPF (soft_delete_user).
    IF v_ativo_agora AND (NEW.cpf IS DISTINCT FROM OLD.cpf OR NOT v_ativo_antes) THEN
      PERFORM public.rh_sync_colaborador(NEW);
    END IF;
    RETURN NEW;
  END IF;

  IF v_ativo_antes IS DISTINCT FROM v_ativo_agora THEN
    UPDATE public.colaboradores c
       SET status = CASE WHEN v_ativo_agora THEN 'ativo' ELSE 'desligado' END,
           departamento_id = CASE
             WHEN v_ativo_agora AND NOT EXISTS (
               SELECT 1 FROM public.departamentos d WHERE d.id = c.departamento_id AND d.ativo)
             THEN NULL
             ELSE c.departamento_id
           END
     WHERE c.user_profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.rh_colaboradores_sync_trigger() IS 'Mantém colaboradores em sync com user_profiles: na criação do perfil (rh_sync_colaborador), quando um perfil ativo sem colaborador muda de CPF ou volta a ficar ativo (rh_sync_colaborador) e quando a conta de um perfil com colaborador fica ativa/inativa (status ativo/desligado).';

REVOKE ALL ON FUNCTION public.rh_colaboradores_sync_trigger() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_user_profiles_sync_colaborador ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_sync_colaborador
  AFTER INSERT OR UPDATE OF cpf, disabled_at, deleted_at ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.rh_colaboradores_sync_trigger();

COMMIT;
