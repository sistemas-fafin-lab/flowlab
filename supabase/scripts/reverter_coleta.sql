-- ============================================================
-- Reverter uma coleta (status "coletado" → "em_coleta")
-- Local: supabase/scripts/reverter_coleta.sql
-- ============================================================
--
-- Hoje não existe, na tela de Agendamentos/Painel de Coletas, nenhuma ação
-- para desfazer uma coleta registrada por engano. "coletado" é tratado como
-- estado terminal de propósito: registrar_coleta() já baixa insumos do
-- estoque, abre o laudo (ac_laudos) e a(s) cultura(s) (ac_culturas); e
-- cancelar_agendamento() recusa explicitamente cancelar algo já coletado
-- (ver 20260722120000_ac_cancelar_agendamento.sql).
--
-- Este script cria a função reverter_coleta(), para rodar manualmente no SQL
-- Editor do Supabase quando alguém clicar "Confirmar coleta" no agendamento
-- errado. Ela só reverte quando NADA do que a coleta abriu foi tocado ainda:
-- laudo intacto (sem exame concluído, sem liberação), cultura(s) ainda na
-- etapa inicial. Se algo já avançou, a função recusa — a partir daí desfazer
-- deixa de ser uma reversão simples e vira uma decisão de negócio (o que fazer
-- com o laudo/cultura já em andamento), que este script não tenta adivinhar.
--
-- O que a reversão desfaz:
--   • estorna os insumos baixados — cria um NOVO stock_movement 'in'/'return'
--     para cada insumo (não apaga o original: mantém o rastreio, que é
--     exatamente o propósito do stock_movement_id em ac_coleta_insumos);
--   • apaga ac_coletas (cascade em ac_coleta_insumos);
--   • apaga o laudo e a(s) cultura(s) abertos por essa coleta;
--   • apaga os exames marcados nessa coleta (ac_agendamento_exames);
--   • volta ac_agendamentos.status para 'em_coleta'.
--
-- EFEITO COLATERAL — LAB-HUB: se o agendamento tiver labhub_id, o trigger
-- trg_ac_notificar_labhub_status dispara de novo (best-effort) e avisa o
-- LAB-HUB do novo status 'em_coleta', pelo mesmo caminho que uma conferência
-- normal. Isso é o esperado (desfaz o "coletado" que já tinha sido avisado),
-- mas é bom conferir do lado do LAB-HUB se a reversão importa lá.
--
-- Sem GRANT para "authenticated"/PUBLIC de propósito: não é uma ação exposta
-- no frontend, só roda por quem tem acesso direto ao SQL Editor/banco.
-- ============================================================


-- ============================================================
-- 1. FUNÇÃO: diagnóstico (rode antes de reverter)
-- ============================================================
CREATE OR REPLACE FUNCTION checar_reversao_coleta(p_agendamento_id uuid)
RETURNS TABLE (item text, detalhe text, bloqueia_reversao boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_status text;
BEGIN
  SELECT id, status INTO v_id, v_status FROM ac_agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    SELECT id, status INTO v_id, v_status FROM ac_agendamentos WHERE labhub_id = p_agendamento_id;
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;

  RETURN QUERY SELECT 'status atual'::text, v_status, (v_status <> 'coletado');
  IF v_status <> 'coletado' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'insumos baixados'::text,
         COALESCE(string_agg(p.name || ' x' || ci.quantity, ', '), '(nenhum)'),
         false
    FROM ac_coletas c
    LEFT JOIN ac_coleta_insumos ci ON ci.coleta_id = c.id
    LEFT JOIN products p ON p.id = ci.product_id
   WHERE c.agendamento_id = v_id;

  RETURN QUERY
  SELECT 'laudo'::text,
         format('status=%s, concluidos=%s/%s, liberado_em=%s, nota=%s',
                l.status, l.exames_concluidos, l.exames_total, l.liberado_em, l.nota),
         (l.status <> 'aguarda_liberacao' OR l.exames_concluidos > 0
            OR l.liberado_em IS NOT NULL OR l.nota IS NOT NULL)
    FROM ac_laudos l WHERE l.agendamento_id = v_id
  UNION ALL
  SELECT 'laudo'::text, '(nenhum)', false
   WHERE NOT EXISTS (SELECT 1 FROM ac_laudos WHERE agendamento_id = v_id);

  RETURN QUERY
  SELECT 'exame concluído'::text, e.exame_nome, true
    FROM ac_agendamento_exames e
   WHERE e.agendamento_id = v_id AND e.concluido;

  RETURN QUERY
  SELECT 'cultura'::text,
         format('%s — etapa %s, status=%s, resultado=%s', cu.exame_nome, cu.etapa_ordem, cu.status, cu.resultado),
         (cu.etapa_ordem <> 1 OR cu.status <> 'em_andamento'
            OR cu.resultado IS NOT NULL OR cu.nota IS NOT NULL)
    FROM ac_culturas cu WHERE cu.agendamento_id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION checar_reversao_coleta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION checar_reversao_coleta(uuid) TO authenticated;


-- ============================================================
-- 2. FUNÇÃO: a reversão em si
-- ============================================================
CREATE OR REPLACE FUNCTION reverter_coleta(
  p_agendamento_id uuid,
  p_revertido_por  text DEFAULT NULL,
  p_motivo         text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agendamento_id       uuid;
  v_status               text;
  v_coleta_id            uuid;
  v_laudo                record;
  v_exame_concluido_qtd  integer;
  v_cultura_avancada_qtd integer;
  ins                    record;
BEGIN
  SELECT id, status INTO v_agendamento_id, v_status
    FROM ac_agendamentos WHERE id = p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT id, status INTO v_agendamento_id, v_status
      FROM ac_agendamentos WHERE labhub_id = p_agendamento_id FOR UPDATE;
  END IF;
  IF v_agendamento_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % não encontrado', p_agendamento_id;
  END IF;
  IF v_status <> 'coletado' THEN
    RAISE EXCEPTION 'Reversão só é possível em agendamento "coletado" (atual: %)', v_status;
  END IF;

  SELECT id INTO v_coleta_id FROM ac_coletas WHERE agendamento_id = v_agendamento_id FOR UPDATE;
  IF v_coleta_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento % está "coletado" mas não tem linha em ac_coletas — inconsistência, corrija manualmente', v_agendamento_id;
  END IF;

  -- Trava: laudo já tem progresso?
  SELECT * INTO v_laudo FROM ac_laudos WHERE agendamento_id = v_agendamento_id FOR UPDATE;
  IF FOUND AND (v_laudo.status <> 'aguarda_liberacao' OR v_laudo.exames_concluidos > 0
                OR v_laudo.liberado_em IS NOT NULL OR v_laudo.nota IS NOT NULL) THEN
    RAISE EXCEPTION 'Laudo já tem progresso (status=%, concluidos=%, liberado_em=%) — reversão automática recusada',
      v_laudo.status, v_laudo.exames_concluidos, v_laudo.liberado_em;
  END IF;

  -- Trava: algum exame já marcado como concluído?
  SELECT count(*) INTO v_exame_concluido_qtd
    FROM ac_agendamento_exames WHERE agendamento_id = v_agendamento_id AND concluido;
  IF v_exame_concluido_qtd > 0 THEN
    RAISE EXCEPTION '% exame(s) já marcado(s) como concluído — reversão automática recusada', v_exame_concluido_qtd;
  END IF;

  -- Trava: alguma cultura já avançou da etapa inicial?
  SELECT count(*) INTO v_cultura_avancada_qtd
    FROM ac_culturas
   WHERE agendamento_id = v_agendamento_id
     AND (etapa_ordem <> 1 OR status <> 'em_andamento' OR resultado IS NOT NULL OR nota IS NOT NULL);
  IF v_cultura_avancada_qtd > 0 THEN
    RAISE EXCEPTION '% cultura(s) já avançou(aram) além da etapa inicial — reversão automática recusada', v_cultura_avancada_qtd;
  END IF;

  -- Estorna cada insumo baixado (novo movimento — não apaga o original).
  FOR ins IN
    SELECT ci.product_id, ci.quantity, sm.from_location_id, p.name AS product_name
      FROM ac_coleta_insumos ci
      JOIN stock_movements sm ON sm.id = ci.stock_movement_id
      JOIN products p ON p.id = ci.product_id
     WHERE ci.coleta_id = v_coleta_id
  LOOP
    IF ins.from_location_id IS NOT NULL THEN
      INSERT INTO stock_movements
        (product_id, product_name, type, reason, quantity, to_location_id, authorized_by, notes)
      VALUES (
        ins.product_id, ins.product_name, 'in', 'return', ins.quantity, ins.from_location_id,
        COALESCE(NULLIF(p_revertido_por, ''), 'Sistema'),
        'Estorno da coleta ' || v_coleta_id || ' (reversão coletado → em_coleta)'
          || COALESCE(' — ' || NULLIF(p_motivo, ''), '')
      );
    END IF;
  END LOOP;

  -- Apaga o que a coleta abriu (só chega aqui se estava tudo intacto).
  DELETE FROM ac_culturas WHERE agendamento_id = v_agendamento_id;
  DELETE FROM ac_laudos WHERE agendamento_id = v_agendamento_id;
  DELETE FROM ac_agendamento_exames WHERE agendamento_id = v_agendamento_id;
  DELETE FROM ac_coletas WHERE id = v_coleta_id;  -- cascade em ac_coleta_insumos

  UPDATE ac_agendamentos
     SET status = 'em_coleta', updated_at = now()
   WHERE id = v_agendamento_id;
  -- trg_ac_notificar_labhub_status dispara e avisa o LAB-HUB (best-effort) se labhub_id IS NOT NULL.

  RETURN v_agendamento_id;
END;
$$;

-- Não expõe para o frontend: só quem conecta direto no banco (SQL Editor,
-- psql com a service role/postgres) consegue chamar.
REVOKE ALL ON FUNCTION reverter_coleta(uuid, text, text) FROM PUBLIC, authenticated, anon;


-- ============================================================
-- 3. PASSO A PASSO (SQL Editor do Supabase)
-- ============================================================

-- PASSO 1 — Achar o agendamento:
--   SELECT id, paciente_nome, status, labhub_id
--     FROM ac_agendamentos
--    WHERE paciente_nome ILIKE '%fulano%' OR labhub_id = 'ID-DO-LABHUB-AQUI';

-- PASSO 2 — Conferir se é seguro reverter:
--   SELECT * FROM checar_reversao_coleta('UUID-DO-AGENDAMENTO-AQUI');
--
--   Se alguma linha tiver bloqueia_reversao = true, a reversão automática
--   vai recusar (RAISE EXCEPTION) — precisa decidir manualmente o que fazer
--   com o laudo/exame/cultura já em andamento antes de seguir.

-- PASSO 3 — Reverter:
--   SELECT reverter_coleta('UUID-DO-AGENDAMENTO-AQUI', 'Seu Nome', 'clique errado no Painel de Coletas');
--
--   O agendamento volta para "em_coleta", pronto para "Registrar coleta" de
--   novo no Painel de Coletas.

-- PASSO 4 — Conferir:
--   SELECT status FROM ac_agendamentos WHERE id = 'UUID-DO-AGENDAMENTO-AQUI';
--   SELECT * FROM stock_movements WHERE notes ILIKE '%Estorno da coleta%' ORDER BY created_at DESC LIMIT 5;

-- ============================================================
-- FIM
-- ============================================================
