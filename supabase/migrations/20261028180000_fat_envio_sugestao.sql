-- ═══════════════════════════════════════════════════════════════════════════════
-- Sugestão do mês no Calendário de envios (.scratch/faturamento-calendario-envios/,
-- issue 06).
--
-- fat_envio_aplicar_sugestao: grava a sugestão calculada por gerarSugestaoDoMes
-- (api/_lib/faturamento/calendarioEnvios.ts) numa transação — remove os sugeridos
-- refeitos e cria os novos com origem "sugestao". SECURITY INVOKER: a RLS de
-- fat_envio_agendamentos (canManageCalendarioEnvios) continua decidindo quem grava.
-- Trava o mês e recebe os ids que ele tinha quando a sugestão foi calculada: se o mês
-- mudou desde então (outra geração, um agendamento novo, movido ou marcado), aborta
-- tudo (40001) e a tela pede para gerar de novo, sem duplicar.
--
-- Histórico: o "removeu" passa a guardar a origem do agendamento e, quando vem da
-- sugestão, depois = {"pela_sugestao": true}. O "criou" já guarda a origem.
--
-- Carga: novembro/2026 gerado pelo módulo com as regras e feriados da carga de
-- 20261028160000 (mês vazio). Só entra se o mês ainda não tem nenhum agendamento
-- sugerido; regras que não existem mais ou estão desativadas ficam de fora.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.fat_envio_agendamentos') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.fat_envio_agendamentos não existe. Aplique 20261028160000_fat_calendario_envios.sql antes desta migration.';
  END IF;
END $$;

-- ─── Histórico: "removeu" com a origem e se veio da sugestão ──────────────────

CREATE OR REPLACE FUNCTION public.fat_envio_agendamentos_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por      UUID := auth.uid();
  v_por_nome TEXT := public.fat_envio_nome_usuario();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'criou',
            jsonb_build_object('data_prevista', NEW.data_prevista, 'origem', NEW.origem), v_por, v_por_nome);
    IF NEW.data_envio IS NOT NULL THEN
      INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, depois, por, por_nome)
      VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'marcou', jsonb_build_object('data_envio', NEW.data_envio), v_por, v_por_nome);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (OLD.id, OLD.regra_id, OLD.data_prevista, 'removeu',
            jsonb_build_object('data_prevista', OLD.data_prevista, 'data_envio', OLD.data_envio, 'origem', OLD.origem),
            CASE WHEN current_setting('fat_envio.pela_sugestao', true) = 'on'
                 THEN jsonb_build_object('pela_sugestao', true) END,
            v_por, v_por_nome);
    RETURN OLD;
  END IF;

  IF NEW.data_prevista IS DISTINCT FROM OLD.data_prevista THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'moveu',
            jsonb_build_object('data_prevista', OLD.data_prevista), jsonb_build_object('data_prevista', NEW.data_prevista), v_por, v_por_nome);
  END IF;

  IF NEW.data_envio IS DISTINCT FROM OLD.data_envio THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista,
            CASE WHEN NEW.data_envio IS NULL THEN 'desmarcou' ELSE 'marcou' END,
            jsonb_build_object('data_envio', OLD.data_envio), jsonb_build_object('data_envio', NEW.data_envio), v_por, v_por_nome);
  END IF;

  IF NEW.lote_aplis_confirmado IS DISTINCT FROM OLD.lote_aplis_confirmado AND NEW.lote_aplis_confirmado IS NOT NULL THEN
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, depois, por, por_nome)
    VALUES (NEW.id, NEW.regra_id, NEW.data_prevista, 'confirmou_aplis',
            jsonb_build_object('lote_aplis_confirmado', OLD.lote_aplis_confirmado),
            jsonb_build_object('lote_aplis_confirmado', NEW.lote_aplis_confirmado), v_por, v_por_nome);
  END IF;
  RETURN NEW;
END;
$$;

-- ─── Gravar a sugestão ────────────────────────────────────────────────────────
-- p_mes: 'YYYY-MM'; p_existentes: ids dos agendamentos do mês na hora da conta;
-- p_criar: [{ "regra_id", "data_prevista", "janela_indice" }]; p_remover: ids dos
-- sugeridos pendentes e não editados que a sugestão refaz.

CREATE OR REPLACE FUNCTION public.fat_envio_aplicar_sugestao(p_mes TEXT, p_existentes UUID[], p_criar JSONB, p_remover UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inicio    DATE := to_date(p_mes || '-01', 'YYYY-MM-DD');
  v_removidos INTEGER;
BEGIN
  -- Uma geração por mês de cada vez; a segunda vê o mês mudado e aborta.
  PERFORM pg_advisory_xact_lock(hashtext('fat_envio_aplicar_sugestao:' || p_mes));
  IF EXISTS (
    SELECT 1 FROM public.fat_envio_agendamentos
    WHERE data_prevista >= v_inicio AND data_prevista < (v_inicio + INTERVAL '1 month')
      AND NOT (id = ANY(COALESCE(p_existentes, '{}')))
  ) OR (
    SELECT count(*) FROM public.fat_envio_agendamentos
    WHERE id = ANY(COALESCE(p_existentes, '{}'))
      AND data_prevista >= v_inicio AND data_prevista < (v_inicio + INTERVAL '1 month')
  ) <> COALESCE(cardinality(p_existentes), 0) THEN
    RAISE EXCEPTION 'O calendário mudou enquanto a sugestão era gerada.' USING ERRCODE = '40001';
  END IF;

  PERFORM set_config('fat_envio.pela_sugestao', 'on', true);

  DELETE FROM public.fat_envio_agendamentos
  WHERE id = ANY(p_remover) AND origem = 'sugestao' AND NOT editado AND data_envio IS NULL;
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  IF v_removidos <> COALESCE(cardinality(p_remover), 0) THEN
    RAISE EXCEPTION 'O calendário mudou enquanto a sugestão era gerada.' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.fat_envio_agendamentos (regra_id, data_prevista, janela_indice, origem)
  SELECT (c->>'regra_id')::uuid, (c->>'data_prevista')::date, (c->>'janela_indice')::smallint, 'sugestao'
  FROM jsonb_array_elements(COALESCE(p_criar, '[]'::jsonb)) AS c;

  PERFORM set_config('fat_envio.pela_sugestao', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fat_envio_aplicar_sugestao(TEXT, UUID[], JSONB, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fat_envio_aplicar_sugestao(TEXT, UUID[], JSONB, UUID[]) TO authenticated;

-- ─── Carga: novembro/2026 ─────────────────────────────────────────────────────
-- Saída de gerarSugestaoDoMes('2026-11', regras e feriados de 20261028160000, []):
-- 30 regras (28 geram; PLAN ASSISTE e TST são "calendário do convênio"), 60
-- agendamentos, feriados 02, 15, 20 e 30/11. Convênio, data prevista e
-- índice da janela.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fat_envio_agendamentos
    WHERE origem = 'sugestao' AND data_prevista BETWEEN '2026-11-01' AND '2026-11-30'
  ) THEN
    RAISE NOTICE 'Novembro/2026 já tem sugestão; carga ignorada.';
    RETURN;
  END IF;

  INSERT INTO public.fat_envio_agendamentos (regra_id, data_prevista, janela_indice, origem)
  SELECT r.id, v.data_prevista::date, v.janela_indice, 'sugestao'
  FROM (VALUES
  ('AMHP', '2026-11-03', 0),
  ('BRADESCO', '2026-11-03', 0),
  ('FUSEX', '2026-11-03', 0),
  ('SAÚDE CAIXA', '2026-11-03', 0),
  ('TRE', '2026-11-03', 0),
  ('AMHP – BACEN', '2026-11-04', 0),
  ('BRB', '2026-11-04', 0),
  ('CÂMARA', '2026-11-04', 0),
  ('SIS', '2026-11-04', 0),
  ('TRT', '2026-11-04', 0),
  ('AMHPDF – Entrega física', '2026-11-05', 0),
  ('GAMA', '2026-11-05', 0),
  ('GDF INAS', '2026-11-05', 0),
  ('PF', '2026-11-05', 0),
  ('AMHPDF – Online', '2026-11-06', 0),
  ('ASSEFAZ', '2026-11-06', 0),
  ('PMDF', '2026-11-06', 0),
  ('POSTAL SAÚDE', '2026-11-06', 0),
  ('BRADESCO', '2026-11-09', 0),
  ('EVIDA/LUMINAR', '2026-11-09', 0),
  ('GEAP', '2026-11-09', 0),
  ('SIS', '2026-11-09', 0),
  ('AMHP', '2026-11-10', 0),
  ('AMPLA', '2026-11-10', 0),
  ('CÂMARA', '2026-11-10', 0),
  ('AMHP – BACEN', '2026-11-11', 0),
  ('AMIL', '2026-11-11', 0),
  ('GDF INAS', '2026-11-11', 0),
  ('AMHPDF – Entrega física', '2026-11-12', 0),
  ('CASSI', '2026-11-12', 0),
  ('PMDF', '2026-11-12', 0),
  ('AMHPDF – Online', '2026-11-13', 0),
  ('SAÚDE CAIXA', '2026-11-13', 0),
  ('STF', '2026-11-13', 0),
  ('AMHPDF – Entrega física', '2026-11-16', 0),
  ('FUSEX', '2026-11-16', 0),
  ('GDF INAS', '2026-11-16', 0),
  ('AMHPDF – Online', '2026-11-17', 0),
  ('PMDF', '2026-11-17', 0),
  ('TJDFT', '2026-11-17', 0),
  ('AMHP', '2026-11-18', 0),
  ('BRADESCO', '2026-11-18', 0),
  ('SAÚDE CAIXA', '2026-11-18', 0),
  ('AMHP – BACEN', '2026-11-19', 0),
  ('CÂMARA', '2026-11-19', 0),
  ('SIS', '2026-11-19', 0),
  ('AMHPDF – Entrega física', '2026-11-23', 0),
  ('GDF INAS', '2026-11-23', 0),
  ('STJ/PRO-SER', '2026-11-23', 0),
  ('AMHPDF – Online', '2026-11-24', 0),
  ('PMDF', '2026-11-24', 0),
  ('TRT', '2026-11-24', 1),
  ('AMHP', '2026-11-25', 0),
  ('BRADESCO', '2026-11-25', 0),
  ('SAÚDE CAIXA', '2026-11-25', 0),
  ('AMHP – BACEN', '2026-11-26', 0),
  ('CÂMARA', '2026-11-26', 0),
  ('SIS', '2026-11-26', 0),
  ('CBMDF', '2026-11-27', 0),
  ('SULAMÉRICA', '2026-11-27', 0)
  ) AS v (convenio, data_prevista, janela_indice)
  JOIN public.fat_envio_regras r ON r.convenio = v.convenio AND r.ativo;
END $$;
