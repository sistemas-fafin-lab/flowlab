-- ═══════════════════════════════════════════════════════════════════════════════
-- Aposenta a user_whitelist: fecha a exposição dos CPFs e deixa de usá-la no login
-- Migration: 20261112150000_aposentar_user_whitelist.sql
--
-- A user_whitelist (20250525130000) era a lista de quem podia se auto-cadastrar e o
-- portão do login (perfil com CPF + whitelist.activity). Com o fim do auto-cadastro
-- (20261005130000) ela ficou redundante e perigosa:
--   • Exposição: a policy whitelist_read_anon (20260603000000) deixava QUALQUER
--     pessoa com a chave pública do site ler CPF + nome de todos (80 linhas em
--     12/11/2026), e whitelist_read_authenticated deixava qualquer logado listar
--     todos os CPFs.
--   • Redundância: todo colaborador do RH já está nela com o mesmo CPF, e o "ativo"
--     dela (activity) divergia do login (disabled_at/deleted_at) e do RH (status).
--
-- O que muda:
--   1. Sem nenhuma policy em user_whitelist: só a service role lê/grava. A tabela
--      fica como arquivo (soft_delete_user/restore_user ainda atualizam activity,
--      sem efeito no acesso).
--   2. Sai a FK user_profiles.cpf → user_whitelist.cpf. O CPF do perfil continua
--      UNIQUE e é o que liga a conta ao colaborador do RH (rh_sync_colaborador).
--   3. O login (src/contexts/acessoLogin.ts) passa a exigir só perfil não
--      desativado nem excluído; não exige CPF (contas de setor não têm).
--   4. Dados, para ninguém ganhar nem perder acesso sem querer:
--      a) Gustavo Henrique Silva Fernandes (TI): o CPF dele já estava na whitelist
--         ("GUSTAVO HENRIQUE") mas não no perfil — passa para o perfil, e o trigger
--         cria o colaborador.
--      b) As contas ativas que a regra antiga barrava em 12/11/2026 (levantamento em
--         produção) são desativadas como deactivate_user faz (disabled_at + bloqueio
--         no Auth + sessões revogadas), para continuarem barradas: Lucas Moreira
--         (transporte.lab.00421, sem CPF, whitelist dele inativa), Cristiane Macedo
--         Gama (conta duplicada de junho, e-mail "bdr.labratorio") e Kauã Larsson
--         (whitelist inativa). Lista fechada por id, e só se a conta ainda estiver
--         ativa e barrada pela regra antiga: em outro banco (teste, local) não faz
--         nada, e conta de setor ou criada depois nunca é tocada. Fora o Kauã, o status do
--         colaborador no RH NÃO muda (o trigger de sync fica desligado nesse
--         UPDATE): a desativação só preserva o bloqueio que já existia. Para liberar
--         alguém, reative pela tela de Usuários.
--      c) Kauã Larsson saiu do laboratório (confirmado em 12/11/2026): o colaborador
--         dele passa a desligado (data_desligamento fica para o RH preencher).
--   5. cpf_ja_cadastrado deixa de ser chamável sem login: só se justificava pelo
--      auto-cadastro e pela whitelist já ser pública (20260728130000).
--
-- Ordem de deploy: aplicar esta migration ANTES do deploy do app que tira a escrita
-- na whitelist do createUser.ts (com a FK ainda presente, o perfil novo falharia).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Fecha a whitelist.
DROP POLICY IF EXISTS "whitelist_read_anon" ON public.user_whitelist;
DROP POLICY IF EXISTS "whitelist_read_authenticated" ON public.user_whitelist;
DROP POLICY IF EXISTS "whitelist_write_custom_role" ON public.user_whitelist;
ALTER TABLE public.user_whitelist ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_whitelist IS 'Aposentada em 20261112150000: não controla mais o login nem o cadastro. Arquivo da antiga lista de CPFs autorizados, legível só pela service role. O CPF da pessoa fica no perfil (user_profiles.cpf) e no colaborador do RH.';

-- 2. Sai a FK.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_cpf;

-- 4a. Gustavo: CPF da whitelist para o perfil (dispara o trigger que cria o colaborador).
DO $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.user_profiles p
     SET cpf = w.cpf, updated_at = now()
    FROM public.user_whitelist w
   WHERE p.id = '9152d1d7-9f4d-484d-acdf-06bf87ffc62c'
     AND p.cpf IS NULL
     AND w.cpf = (SELECT cpf FROM public.user_whitelist WHERE name = 'GUSTAVO HENRIQUE' AND activity)
     AND public.cpf_valido(w.cpf)
     AND NOT EXISTS (SELECT 1 FROM public.user_profiles o WHERE o.cpf = w.cpf);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = '9152d1d7-9f4d-484d-acdf-06bf87ffc62c' AND cpf IS NULL) THEN
    RAISE NOTICE 'Gustavo continua sem CPF: o da whitelist não foi achado ou já está em outro perfil. Cadastre à mão.';
  END IF;
END $$;

-- 4b. Quem a regra antiga barrava continua barrado (lista fechada, ver cabeçalho).
CREATE TEMP TABLE barrados_pela_whitelist ON COMMIT DROP AS
SELECT p.id
  FROM public.user_profiles p
  LEFT JOIN public.user_whitelist w ON w.cpf = p.cpf
 WHERE p.id IN ('7dda5483-b642-4cb2-a9e4-7f337d786aeb',  -- Lucas Moreira (transporte)
                'b6dfed33-1046-40bc-8ec3-557c75cf9654',  -- Cristiane Macedo Gama (duplicada)
                '41f7c6bb-f58a-4a14-8526-b93599e750aa')  -- Kauã Larsson
   AND p.disabled_at IS NULL
   AND p.deleted_at IS NULL
   AND (p.cpf IS NULL OR w.cpf IS NULL OR NOT w.activity);

ALTER TABLE public.user_profiles DISABLE TRIGGER trigger_user_profiles_sync_colaborador;

UPDATE public.user_profiles
   SET disabled_at = now(), updated_at = now()
 WHERE id IN (SELECT id FROM barrados_pela_whitelist);

ALTER TABLE public.user_profiles ENABLE TRIGGER trigger_user_profiles_sync_colaborador;

UPDATE auth.users
   SET banned_until = 'infinity'::timestamptz, updated_at = now()
 WHERE id IN (SELECT id FROM barrados_pela_whitelist);
DELETE FROM auth.sessions       WHERE user_id IN (SELECT id FROM barrados_pela_whitelist);
DELETE FROM auth.refresh_tokens WHERE user_id IN (SELECT id::text FROM barrados_pela_whitelist);

-- 4c. Kauã saiu: desligado também no RH.
UPDATE public.colaboradores
   SET status = 'desligado'
 WHERE user_profile_id = '41f7c6bb-f58a-4a14-8526-b93599e750aa'
   AND status = 'ativo';

-- 5. CPF de funcionário não é consultável sem login.
REVOKE EXECUTE ON FUNCTION public.cpf_ja_cadastrado(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cpf_ja_cadastrado(text) TO authenticated;

COMMIT;
