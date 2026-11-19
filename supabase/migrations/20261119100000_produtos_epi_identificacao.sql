/*
  # Estoque — Produto EPI e Identificação do EPI

  Spec: .scratch/epi-relatorio-mensal/spec.md (issue 02). Termos no CONTEXT.md, seção
  Estoque e Qualidade.

  1. Colunas novas em `products` (idempotente):
     - `is_epi` boolean NOT NULL DEFAULT false: nenhum produto existente vira EPI sozinho;
     - `epi_identificacao_tipo` text, 'CA' ou 'ANVISA';
     - `epi_identificacao_numero` text;
     - `epi_identificacao_validade` date.
     Todos os campos da identificação são opcionais: um EPI pode ser salvo sem eles.

  2. Permissão `canManageEpi` ("Gerir EPI", grupo Produtos em src/utils/permissions.ts):
     só ela altera a marcação e a identificação. Só o cargo Administrador recebe por padrão;
     os demais (Compras) recebem na tela de Cargos e Permissões.

  3. Trigger `products_guard_epi`: com usuário logado e sem `canManageEpi`, recusa o
     cadastro de um produto já marcado como EPI ou com identificação, e a edição que mude
     qualquer um desses quatro campos. Sem usuário logado (SQL Editor, chave de serviço)
     passa direto. O resto da edição do produto não é afetado.
*/

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_epi boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS epi_identificacao_tipo text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS epi_identificacao_numero text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS epi_identificacao_validade date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'products_epi_identificacao_tipo_check'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_epi_identificacao_tipo_check
      CHECK (epi_identificacao_tipo IS NULL OR epi_identificacao_tipo IN ('CA', 'ANVISA'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_is_epi ON public.products (is_epi) WHERE is_epi;

-- ─── Permissão ───────────────────────────────────────────────────────────────
UPDATE public.custom_roles cr
   SET permissions = cr.permissions || '["canManageEpi"]'::jsonb,
       updated_at = now()
 WHERE (cr.id = 'a0000000-0000-0000-0000-000000000001'
        OR (cr.is_system AND cr.name = 'Administrador'))
   AND NOT cr.permissions ? 'canManageEpi';

-- ─── Trigger ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.products_guard_epi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mexeu boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_mexeu := NEW.is_epi
            OR NEW.epi_identificacao_tipo IS NOT NULL
            OR NEW.epi_identificacao_numero IS NOT NULL
            OR NEW.epi_identificacao_validade IS NOT NULL;
  ELSE
    v_mexeu := NEW.is_epi IS DISTINCT FROM OLD.is_epi
            OR NEW.epi_identificacao_tipo IS DISTINCT FROM OLD.epi_identificacao_tipo
            OR NEW.epi_identificacao_numero IS DISTINCT FROM OLD.epi_identificacao_numero
            OR NEW.epi_identificacao_validade IS DISTINCT FROM OLD.epi_identificacao_validade;
  END IF;

  IF v_mexeu AND NOT public.current_user_has_permission('canManageEpi') THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar a marcação de EPI nem a Identificação do EPI.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_guard_epi ON public.products;
CREATE TRIGGER products_guard_epi
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_guard_epi();
