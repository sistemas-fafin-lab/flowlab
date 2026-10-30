-- ═══════════════════════════════════════════════════════════════════════════════
-- RH — Ficha do colaborador (openspec/changes/rh-ficha-colaborador)
--
-- 1. colaborador_dados_pessoais: 1:1 com colaboradores. Tabela à parte (não
--    colunas em colaboradores) para ter RLS própria: cor/raça e filiação são
--    dados sensíveis (LGPD) e não podem herdar as policies de leitura de
--    colaboradores (ex.: colaboradores_select_holerites_manage).
-- 2. canManageColaboradores: escrita na ficha. canViewColaboradores passa a ser
--    só leitura — a policy colaboradores_update deixa de aceitá-la.
--    Quem perde a edição: qualquer cargo com canViewColaboradores e sem
--    canManageColaboradores (ex.: cargos de consulta criados pelo RH).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Dados pessoais ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.colaborador_dados_pessoais (
  colaborador_id    uuid PRIMARY KEY REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nacionalidade     text CHECK (nacionalidade IN ('brasileira', 'brasileira_naturalizada', 'estrangeira')),
  uf_nascimento     text CHECK (uf_nascimento IN (
                      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
                      'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  cidade_nascimento text,
  cor_raca          text CHECK (cor_raca IN ('branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_declarar')),
  genero            text CHECK (genero IN ('masculino', 'feminino', 'nao_declarar')),
  estado_civil      text CHECK (estado_civil IN (
                      'solteiro', 'casado', 'uniao_estavel', 'divorciado', 'separado', 'viuvo')),
  data_nascimento   date CHECK (data_nascimento <= current_date),
  nome_mae          text,
  nome_pai          text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.colaborador_dados_pessoais IS
  'Dados pessoais do colaborador (1:1). Leitura: canViewColaboradores ou o próprio colaborador; escrita: canManageColaboradores.';

CREATE OR REPLACE FUNCTION public.colaborador_dados_pessoais_set_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_colaborador_dados_pessoais_auditoria ON public.colaborador_dados_pessoais;
CREATE TRIGGER trigger_colaborador_dados_pessoais_auditoria
  BEFORE INSERT OR UPDATE ON public.colaborador_dados_pessoais
  FOR EACH ROW EXECUTE FUNCTION public.colaborador_dados_pessoais_set_auditoria();

ALTER TABLE public.colaborador_dados_pessoais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colaborador_dados_pessoais_select ON public.colaborador_dados_pessoais;
CREATE POLICY colaborador_dados_pessoais_select ON public.colaborador_dados_pessoais
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canViewColaboradores')
    OR public.current_user_has_permission('canManageColaboradores')
    OR colaborador_id IN (SELECT c.id FROM public.colaboradores c WHERE c.user_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS colaborador_dados_pessoais_insert ON public.colaborador_dados_pessoais;
CREATE POLICY colaborador_dados_pessoais_insert ON public.colaborador_dados_pessoais
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canManageColaboradores'));

DROP POLICY IF EXISTS colaborador_dados_pessoais_update ON public.colaborador_dados_pessoais;
CREATE POLICY colaborador_dados_pessoais_update ON public.colaborador_dados_pessoais
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageColaboradores'))
  WITH CHECK (public.current_user_has_permission('canManageColaboradores'));

-- Sem DELETE: o registro só sai junto com o colaborador (ON DELETE CASCADE).

-- ─── 2. Escrita em colaboradores passa a exigir canManageColaboradores ─────────

DROP POLICY IF EXISTS colaboradores_update ON public.colaboradores;
CREATE POLICY colaboradores_update ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageColaboradores'))
  WITH CHECK (public.current_user_has_permission('canManageColaboradores'));

-- ─── 3. Permissão canManageColaboradores — cargo RH e Administrador ────────────

UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageColaboradores"]'::jsonb,
       updated_at = now()
 WHERE (cr.name = 'RH'
        OR cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageColaboradores';
