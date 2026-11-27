-- ═══════════════════════════════════════════════════════════════════════════════
-- Controle de Custos — parâmetros da Tabela Colaborador
-- Migration: 20261127140000_custo_tabela_colaborador_parametros.sql
--
-- Regra do Valor colaborador (.scratch/tabela-colaborador/spec.md →
-- "Parâmetros da regra"): valor = custo ÷ fator, com
-- fator = (100 − parcela A − parcela B) / 100, e o exame vai para "consultar a
-- gestão" quando valor ÷ preço Particular ≥ limite de pouca vantagem.
--
-- Linha única (id = true), já com os valores da planilha aprovada: 48%, 2,5%
-- (fator 0,495) e 90%. "Parcela A" e "Parcela B" são nomes provisórios até a
-- Gerência confirmar o que são; trocar é só editar os rótulos.
--
-- Editada na aba "Tabela Colaborador" do Controle de Custos. Leitura e escrita
-- no padrão das tabelas custo_*: ver com canViewControleCustos ou
-- canManageControleCustos, gravar só com canManageControleCustos. Sem INSERT nem
-- DELETE pelo cliente: a linha nasce aqui e nunca sai. O servidor (lista do modo
-- colaborador) lê com a service role.
--
-- Mesmas regras de validação de validarParametrosTabelaColaborador
-- (src/modules/gerador-orcamento/domain/tabelaColaborador.ts).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.custo_tabela_colaborador_parametros (
  id                     BOOLEAN PRIMARY KEY DEFAULT TRUE
    CONSTRAINT custo_tabela_colaborador_parametros_linha_unica CHECK (id),
  parcela_a              NUMERIC NOT NULL
    CONSTRAINT custo_tabela_colaborador_parametros_parcela_a_check CHECK (parcela_a >= 0),
  parcela_b              NUMERIC NOT NULL
    CONSTRAINT custo_tabela_colaborador_parametros_parcela_b_check CHECK (parcela_b >= 0),
  limite_pouca_vantagem  NUMERIC NOT NULL
    CONSTRAINT custo_tabela_colaborador_parametros_limite_check
      CHECK (limite_pouca_vantagem > 0 AND limite_pouca_vantagem <= 1),
  rotulo_parcela_a       TEXT NOT NULL
    CONSTRAINT custo_tabela_colaborador_parametros_rotulo_a_check CHECK (btrim(rotulo_parcela_a) <> ''),
  rotulo_parcela_b       TEXT NOT NULL
    CONSTRAINT custo_tabela_colaborador_parametros_rotulo_b_check CHECK (btrim(rotulo_parcela_b) <> ''),
  updated_by             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- fator > 0
  CONSTRAINT custo_tabela_colaborador_parametros_fator_check CHECK (parcela_a + parcela_b < 100)
);

COMMENT ON TABLE public.custo_tabela_colaborador_parametros IS 'Parâmetros da regra do Valor colaborador (Tabela Colaborador). Linha única, id = true. Valor colaborador = custo ÷ fator, fator = (100 − parcela_a − parcela_b) / 100.';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.parcela_a IS 'Primeira parcela do fator, em % (planilha aprovada: 48).';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.parcela_b IS 'Segunda parcela do fator, em % (planilha aprovada: 2,5).';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.limite_pouca_vantagem IS 'Fração do preço Particular (planilha aprovada: 0,9). Valor colaborador ÷ Particular ≥ limite = "consultar a gestão" (pouca vantagem).';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.rotulo_parcela_a IS 'Nome exibido da parcela A. Provisório: "Parcela A", até a Gerência confirmar.';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.rotulo_parcela_b IS 'Nome exibido da parcela B. Provisório: "Parcela B", até a Gerência confirmar.';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.updated_by IS 'Quem alterou por último (NULL na linha criada pela migration).';
COMMENT ON COLUMN public.custo_tabela_colaborador_parametros.updated_at IS 'Quando foi a última alteração.';

CREATE OR REPLACE FUNCTION public.custo_tabela_colaborador_parametros_set_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custo_tabela_colaborador_parametros_updated ON public.custo_tabela_colaborador_parametros;
CREATE TRIGGER trg_custo_tabela_colaborador_parametros_updated
  BEFORE UPDATE ON public.custo_tabela_colaborador_parametros
  FOR EACH ROW EXECUTE FUNCTION public.custo_tabela_colaborador_parametros_set_updated();

INSERT INTO public.custo_tabela_colaborador_parametros
  (id, parcela_a, parcela_b, limite_pouca_vantagem, rotulo_parcela_a, rotulo_parcela_b)
VALUES (TRUE, 48, 2.5, 0.9, 'Parcela A', 'Parcela B')
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.custo_tabela_colaborador_parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custo_tabela_colaborador_parametros_select ON public.custo_tabela_colaborador_parametros;
CREATE POLICY custo_tabela_colaborador_parametros_select ON public.custo_tabela_colaborador_parametros
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canViewControleCustos')
      OR public.current_user_has_permission('canManageControleCustos'));

DROP POLICY IF EXISTS custo_tabela_colaborador_parametros_update ON public.custo_tabela_colaborador_parametros;
CREATE POLICY custo_tabela_colaborador_parametros_update ON public.custo_tabela_colaborador_parametros
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canManageControleCustos'))
  WITH CHECK (public.current_user_has_permission('canManageControleCustos'));
