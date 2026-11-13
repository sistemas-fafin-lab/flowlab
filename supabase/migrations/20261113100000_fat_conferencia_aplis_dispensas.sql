-- ═══════════════════════════════════════════════════════════════════════════════
-- Contas a Receber: dispensar uma divergência da conferência com o apLIS, com
-- justificativa (.scratch/faturamento-conferencia-baixas-aplis).
--
-- Há divergências sem ação possível no apLIS (13/11/2026: lote 7014 da Medigest
-- não entra no faturamento; lote 6124 da CASSI foi excluído). Sem isto elas
-- voltavam a cada abertura do modal, no selo e no filtro "Divergente do apLIS".
--
-- A dispensa guarda a divergência como estava (tipo, recebido aqui, recebido no
-- apLIS, lotes). A conferência (api/_lib/handlers/faturamento-titulos-conferencia-aplis.ts)
-- só esconde o título enquanto os quatro continuam iguais: mudou qualquer um,
-- a divergência volta sozinha. Uma dispensa ativa por título (encerrada_em nulo).
--
--   fat_dispensar_divergencia_aplis(p) — p = { idNota, tipo, recebidoSistema,
--     recebidoAplis, lotes, justificativa }. Encerra a dispensa ativa anterior
--     do título, se houver, e grava a nova.
--   fat_reativar_divergencia_aplis(p_id_nota) — encerra a dispensa ativa.
--
-- Escrita só pelas RPCs (canManageBilling); leitura de quem vê Contas a Receber.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fat_conferencia_aplis_dispensas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_nota             UUID NOT NULL REFERENCES public.notas(id_nota) ON DELETE CASCADE,
  tipo                TEXT NOT NULL
                      CHECK (tipo IN ('so-no-aplis', 'aplis-maior', 'sistema-maior', 'lote-ausente')),
  recebido_sistema    NUMERIC(15, 2) NOT NULL,
  -- Nulo quando algum lote não existe no apLIS (lote-ausente).
  recebido_aplis      NUMERIC(15, 2),
  -- `lotes.aplis_id` do título, em ordem crescente.
  lotes               INTEGER[] NOT NULL,
  justificativa       TEXT NOT NULL CHECK (length(btrim(justificativa)) >= 3),
  dispensado_por      UUID REFERENCES auth.users(id),
  dispensado_por_nome TEXT,
  dispensado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em        TIMESTAMPTZ,
  encerrada_por       UUID REFERENCES auth.users(id),
  encerrada_por_nome  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS fat_conferencia_aplis_dispensas_ativa
  ON public.fat_conferencia_aplis_dispensas (id_nota)
  WHERE encerrada_em IS NULL;

COMMENT ON TABLE public.fat_conferencia_aplis_dispensas IS
  'Divergências da conferência de baixas com o apLIS dispensadas com justificativa. Só escondem o título enquanto tipo, recebidos e lotes continuam iguais. Escrita pelas RPCs fat_dispensar_divergencia_aplis / fat_reativar_divergencia_aplis.';

ALTER TABLE public.fat_conferencia_aplis_dispensas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fat_conferencia_aplis_dispensas_select_billing ON public.fat_conferencia_aplis_dispensas;
CREATE POLICY fat_conferencia_aplis_dispensas_select_billing ON public.fat_conferencia_aplis_dispensas
  FOR SELECT TO authenticated
  USING (public.fat_pode_ver_tela('canViewContasReceber'));

-- ─── Dispensar ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fat_dispensar_divergencia_aplis(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_nota       UUID;
  v_justificativa TEXT;
  v_nome          TEXT;
  v_id            UUID;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'Informe a divergência a dispensar.';
  END IF;

  v_id_nota := (p->>'idNota')::UUID;
  v_justificativa := btrim(COALESCE(p->>'justificativa', ''));
  IF length(v_justificativa) < 3 THEN
    RAISE EXCEPTION 'Escreva a justificativa da dispensa.';
  END IF;
  IF jsonb_typeof(p->'lotes') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'lotes') = 0 THEN
    RAISE EXCEPTION 'Informe os lotes do título.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM notas WHERE id_nota = v_id_nota AND status <> 'cancelada') THEN
    RAISE EXCEPTION 'Título não encontrado.';
  END IF;

  SELECT name INTO v_nome FROM user_profiles WHERE id = auth.uid();

  UPDATE fat_conferencia_aplis_dispensas
     SET encerrada_em = NOW(), encerrada_por = auth.uid(), encerrada_por_nome = v_nome
   WHERE id_nota = v_id_nota AND encerrada_em IS NULL;

  INSERT INTO fat_conferencia_aplis_dispensas
    (id_nota, tipo, recebido_sistema, recebido_aplis, lotes, justificativa, dispensado_por, dispensado_por_nome)
  VALUES (
    v_id_nota,
    p->>'tipo',
    (p->>'recebidoSistema')::NUMERIC,
    NULLIF(p->>'recebidoAplis', '')::NUMERIC,
    ARRAY(SELECT DISTINCT (x)::INTEGER FROM jsonb_array_elements_text(p->'lotes') AS x ORDER BY 1),
    v_justificativa,
    auth.uid(),
    v_nome
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fat_dispensar_divergencia_aplis(JSONB) IS
  'Dispensa a divergência do título na conferência com o apLIS (p = {idNota, tipo, recebidoSistema, recebidoAplis, lotes, justificativa}). Encerra a dispensa ativa anterior. Exige canManageBilling.';

REVOKE ALL ON FUNCTION public.fat_dispensar_divergencia_aplis(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_dispensar_divergencia_aplis(JSONB) TO authenticated;

-- ─── Reativar ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fat_reativar_divergencia_aplis(p_id_nota UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  PERFORM fat_exigir_permissao_gestao();

  SELECT name INTO v_nome FROM user_profiles WHERE id = auth.uid();

  UPDATE fat_conferencia_aplis_dispensas
     SET encerrada_em = NOW(), encerrada_por = auth.uid(), encerrada_por_nome = v_nome
   WHERE id_nota = p_id_nota AND encerrada_em IS NULL;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.fat_reativar_divergencia_aplis(UUID) IS
  'Encerra a dispensa ativa do título: a divergência volta à conferência com o apLIS. Exige canManageBilling.';

REVOKE ALL ON FUNCTION public.fat_reativar_divergencia_aplis(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fat_reativar_divergencia_aplis(UUID) TO authenticated;
