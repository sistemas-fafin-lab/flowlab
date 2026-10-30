-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Meu perfil (openspec/changes/rh-meu-perfil)
--
-- rh_meu_perfil(): o colaborador vinculado ao usuário logado, já com o nome do
-- gestor e do departamento. A policy colaboradores_select_own só deixa ler a
-- própria linha, então um join com o gestor voltaria vazio; ampliar a RLS para
-- ler a linha do gestor exporia CPF/e-mail dele ao subordinado. SECURITY
-- DEFINER, sem parâmetro: só devolve o registro de auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rh_meu_perfil()
RETURNS TABLE (
  id                uuid,
  user_profile_id   uuid,
  nome              text,
  email             text,
  cpf               text,
  departamento_id   uuid,
  departamento_nome text,
  cargo             text,
  data_admissao     date,
  data_desligamento date,
  status            text,
  gestor_id         uuid,
  gestor_nome       text,
  matricula         text,
  created_at        timestamptz,
  updated_at        timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_profile_id, c.nome, c.email, c.cpf,
         c.departamento_id, d.nome AS departamento_nome,
         c.cargo, c.data_admissao, c.data_desligamento, c.status,
         c.gestor_id, g.nome AS gestor_nome,
         c.matricula, c.created_at, c.updated_at
    FROM public.colaboradores c
    LEFT JOIN public.colaboradores g ON g.id = c.gestor_id
    LEFT JOIN public.departamentos d ON d.id = c.departamento_id
   WHERE auth.uid() IS NOT NULL
     AND c.user_profile_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.rh_meu_perfil() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_meu_perfil() TO authenticated;

COMMENT ON FUNCTION public.rh_meu_perfil() IS
  'Colaborador do usuário logado com gestor_nome e departamento_nome (Meu perfil). Só o próprio registro.';
