-- ═══════════════════════════════════════════════════════════════════════════════
-- Glosas e Recursos — Instância do recurso (1º, 2º ou 3º)
-- Migration: 20261127100000_glosa_recurso_instancia.sql
--
-- Issue 08 de .scratch/glosas-recursos-calendario-pendencias/. O apLIS só tem
-- eventos de 1º recurso (7) e 2º recurso (16); o 3º só existe marcado à mão.
--
--   instancia_observada  a maior instância já vista no apLIS (7 → 1, 16 → 2),
--                        gravada pela sincronização e que nunca diminui
--                        (recursoGlosa.instanciaObservada): continua valendo
--                        depois que a requisição vai para 34, 15, 18 etc.
--   instancia_editada    marcada pelo lápis do card "Detalhes do recurso"
--                        (1, 2 ou 3), com quem e quando; prevalece sobre a
--                        observada (recursoGlosa.instanciaDoRecurso). Como as
--                        outras edições, a sincronização não a manda no
--                        upsert, e a edição vira evento 'edicao_manual' no
--                        histórico pela RPC glosa_recurso_gravar_edicao.
--
-- Carga: quem está hoje em 7 ganha 1, quem está em 16 ganha 2, os demais
-- ficam vazios — o passado não é reconstruído.
--
-- RLS: as mesmas das edições atuais — as políticas de UPDATE da foto
-- (20261023150000) exigem canManageBilling, e a RPC checa a mesma permissão.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.glosa_recurso_gravar_edicao(text, integer, text, text, integer, integer, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.glosa_recurso_gravar_edicao não existe. Aplique 20261023180000_glosa_recurso_edicoes.sql antes desta migration.';
  END IF;
END $$;

ALTER TABLE public.glosa_recurso_requisicoes
  ADD COLUMN IF NOT EXISTS instancia_observada     SMALLINT CHECK (instancia_observada BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS instancia_editada       SMALLINT CHECK (instancia_editada BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS instancia_editada_por   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instancia_editada_em    TIMESTAMPTZ;

COMMENT ON COLUMN public.glosa_recurso_requisicoes.instancia_observada IS 'Maior instância do recurso já vista no apLIS (7 → 1, 16 → 2); a sincronização nunca a diminui.';
COMMENT ON COLUMN public.glosa_recurso_requisicoes.instancia_editada IS 'Instância do recurso marcada pelo lápis (1, 2 ou 3); vale acima da observada.';

UPDATE public.glosa_recurso_requisicoes
SET instancia_observada = CASE status_aplis WHEN 7 THEN 1 WHEN 16 THEN 2 END
WHERE instancia_observada IS NULL AND status_aplis IN (7, 16);

-- ─── RPC: aceita a instância editada ─────────────────────────────────────────
-- Igual à de 20261023180000, com a coluna nova na lista do lápis.
CREATE OR REPLACE FUNCTION public.glosa_recurso_gravar_edicao(
  p_tabela          TEXT,
  p_id              INTEGER,
  p_coluna          TEXT,
  p_valor           TEXT,
  p_id_requisicao   INTEGER,
  p_id_lote_recurso INTEGER,
  p_valor_anterior  TEXT,
  p_valor_novo      TEXT,
  p_descricao       TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario UUID := auth.uid();
  v_tipo    TEXT;
  v_chave   TEXT;
  v_linhas  INTEGER;
  v_agora   TIMESTAMPTZ := NOW();
BEGIN
  IF v_usuario IS NULL OR NOT public.current_user_has_permission('canManageBilling') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar contas a receber.' USING ERRCODE = '42501';
  END IF;

  -- Só as colunas do lápis: o nome vira SQL dinâmico.
  CASE p_tabela || '.' || p_coluna
    WHEN 'glosa_recurso_lotes.data_envio_editada'                  THEN v_tipo := 'date';
    WHEN 'glosa_recurso_lotes.data_retorno_real'                   THEN v_tipo := 'date';
    WHEN 'glosa_recurso_lotes.data_pagamento_real'                 THEN v_tipo := 'date';
    WHEN 'glosa_recurso_requisicoes.valor_recursado_editado'       THEN v_tipo := 'numeric';
    WHEN 'glosa_recurso_requisicoes.valor_recebido_glosa_editado'  THEN v_tipo := 'numeric';
    WHEN 'glosa_recurso_requisicoes.instancia_editada'             THEN v_tipo := 'smallint';
    ELSE RAISE EXCEPTION 'Campo não editável: %.%', p_tabela, p_coluna USING ERRCODE = '22023';
  END CASE;
  v_chave := CASE p_tabela WHEN 'glosa_recurso_lotes' THEN 'id_lote_recurso' ELSE 'id_requisicao' END;

  EXECUTE format(
    'UPDATE public.%I SET %I = $1::%s, %I = $2, %I = $3 WHERE %I = $4',
    p_tabela, p_coluna, v_tipo, p_coluna || '_por', p_coluna || '_em', v_chave
  ) USING p_valor,
          CASE WHEN p_valor IS NULL THEN NULL ELSE v_usuario END,
          CASE WHEN p_valor IS NULL THEN NULL ELSE v_agora END,
          p_id;
  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  IF v_linhas = 0 THEN
    RAISE EXCEPTION 'Registro não encontrado na foto de glosas e recursos.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.glosa_recurso_historico
    (id_requisicao, id_lote_recurso, ocorrido_em, tipo, valor_anterior, valor_novo, descricao, usuario_id)
  VALUES
    (p_id_requisicao, p_id_lote_recurso, v_agora, 'edicao_manual', p_valor_anterior, p_valor_novo, p_descricao, v_usuario);
END;
$$;

REVOKE ALL ON FUNCTION public.glosa_recurso_gravar_edicao(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glosa_recurso_gravar_edicao(TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
