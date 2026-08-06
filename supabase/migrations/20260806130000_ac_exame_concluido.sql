-- ═══════════════════════════════════════════════════════════════════════════════
-- Conclusão POR EXAME — ac_agendamento_exames.concluido
--
-- Até aqui o laudo guardava só QUANTOS exames estavam prontos (ac_laudos.
-- exames_concluidos, um inteiro digitado à mão). A tela de Laudos passou a listar
-- os exames um a um, e listar sem poder marcar deixa o operador com uma marcação
-- posicional que não diz nada — "os 3 primeiros da lista" não é a informação que
-- ele tem na bancada. Marcar qual exame ficou pronto exige guardar isso.
--
-- O que entra:
--   • ac_agendamento_exames.concluido / concluido_em — o estado real, por exame.
--   • policy de UPDATE na tabela (só havia SELECT/INSERT/DELETE — ver 20260709131000;
--     sem ela o update do frontend não falha: afeta ZERO linhas em silêncio).
--   • trigger que mantém ac_laudos.exames_concluidos como CACHE da contagem.
--
-- ac_laudos.exames_concluidos NÃO é removida de propósito: o card, os KPIs, a
-- barra de progresso e o LAB-HUB já leem dali, e laudos sem exame registrado no
-- check-in continuam dependendo do número digitado à mão. A partir daqui, quando
-- há exames, quem manda é a linha do exame e a coluna vira consequência.
--
-- Idempotente. Depende da Fase 7A (ac_agendamento_exames) e da Fase 8 (ac_laudos).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.ac_agendamento_exames') IS NULL THEN
    RAISE EXCEPTION 'ac_agendamento_exames não existe: aplique a Fase 7A (20260709131000_fase7a_culturas.sql) antes desta migration';
  END IF;
  IF to_regclass('public.ac_laudos') IS NULL THEN
    RAISE EXCEPTION 'ac_laudos não existe: aplique a Fase 8 (20260716150000_fase8_laudos.sql) antes desta migration';
  END IF;
END $$;

-- ─── 0. Pré-requisito: o trigger de timestamp de ac_laudos ──────────────────────
-- A Fase 8 pendurou em ac_laudos o ac_set_updated_at() genérico, que faz
-- `NEW.updated_at = NOW()` — mas a coluna de ac_laudos chama-se `atualizado_em`
-- (é a única do módulo assim). Resultado: TODO update em ac_laudos morre com
-- "record new has no field updated_at". Ninguém tinha notado porque nada
-- atualizava a tabela.
--
-- Daqui pra frente o trigger da seção 3 e o backfill da seção 4 atualizam
-- ac_laudos, então sem consertar isto a PRÓPRIA MIGRATION falha num banco que
-- tenha laudos com exames_concluidos > 0 — e o "Editar laudo" da tela, que
-- também faz UPDATE, seguiria quebrado.
--
-- Não mexer em ac_set_updated_at(): ela está correta e é usada pelas outras onze
-- tabelas do módulo, todas com a coluna chamada mesmo `updated_at`.
CREATE OR REPLACE FUNCTION ac_laudos_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_ac_laudos_updated_at ON ac_laudos;
CREATE TRIGGER trg_ac_laudos_updated_at
  BEFORE UPDATE ON ac_laudos
  FOR EACH ROW EXECUTE FUNCTION ac_laudos_set_atualizado_em();

-- ─── 1. Estado por exame ────────────────────────────────────────────────────────
ALTER TABLE ac_agendamento_exames
  ADD COLUMN IF NOT EXISTS concluido    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

-- ─── 2. UPDATE liberado para authenticated ──────────────────────────────────────
-- Mesmo desenho permissivo das demais policies do módulo (o gate é o frontend +
-- a permissão canManageColetas), consistente com Fase 6/7C.
DROP POLICY IF EXISTS "ac_agendamento_exames_update_auth" ON ac_agendamento_exames;
CREATE POLICY "ac_agendamento_exames_update_auth" ON ac_agendamento_exames
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ─── 3. ac_laudos.exames_concluidos vira cache mantido pelo banco ───────────────
-- Recontar no trigger (em vez de +1/-1 no cliente) mantém a coluna correta
-- independentemente de quem escreveu — inclusive registrar_coleta, que insere os
-- exames antes do laudo existir: nesse instante o UPDATE não acha laudo e não faz
-- nada, e o INSERT do laudo logo depois já nasce com o default 0. Correto nos dois
-- caminhos, sem ordem imposta.
CREATE OR REPLACE FUNCTION ac_sync_laudo_exames_concluidos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag uuid := COALESCE(NEW.agendamento_id, OLD.agendamento_id);
BEGIN
  UPDATE ac_laudos l
     SET exames_concluidos = (
           SELECT count(*) FROM ac_agendamento_exames e
            WHERE e.agendamento_id = v_ag AND e.concluido
         )
   WHERE l.agendamento_id = v_ag;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_ac_exame_concluido_sync ON ac_agendamento_exames;
CREATE TRIGGER trg_ac_exame_concluido_sync
  AFTER INSERT OR UPDATE OF concluido OR DELETE ON ac_agendamento_exames
  FOR EACH ROW EXECUTE FUNCTION ac_sync_laudo_exames_concluidos();

-- ─── 4. Backfill do que a tela já mostrava ──────────────────────────────────────
-- Os laudos existentes têm exames_concluidos digitado à mão. Sem backfill, abrir o
-- modal de um laudo "3 de 5" mostraria os 5 exames pendentes — contradizendo o
-- próprio card. Marca os N primeiros na ordem do check-in, que é exatamente o que
-- a tela exibia até agora. É um chute posicional, mas é o MESMO chute de antes.
--
-- Só roda num banco onde ninguém marcou nada ainda, para uma reexecução não
-- desfazer marcações reais feitas depois.
--
-- Efeito colateral aceito: se algum laudo tiver exames_concluidos MAIOR que o
-- número de exames do check-in (número digitado à mão, impossível de ser verdade),
-- o trigger recontará e a coluna cai para o total real. É correção, não perda.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ac_agendamento_exames WHERE concluido OR concluido_em IS NOT NULL) THEN
    RAISE NOTICE 'backfill ignorado: já existem exames marcados';
    RETURN;
  END IF;

  UPDATE ac_agendamento_exames e
     SET concluido = true, concluido_em = now()
    FROM (
      SELECT x.id,
             row_number() OVER (PARTITION BY x.agendamento_id
                                ORDER BY x.created_at, x.exame_nome) AS pos,
             l.exames_concluidos
        FROM ac_agendamento_exames x
        JOIN ac_laudos l ON l.agendamento_id = x.agendamento_id
       WHERE l.exames_concluidos > 0
    ) ranked
   WHERE ranked.id = e.id AND ranked.pos <= ranked.exames_concluidos;
END $$;
