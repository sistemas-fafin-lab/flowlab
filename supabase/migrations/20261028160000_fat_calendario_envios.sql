-- ═══════════════════════════════════════════════════════════════════════════════
-- Calendário de envios do Faturamento (.scratch/faturamento-calendario-envios/).
-- Regras de envio por convênio, Agendamentos de envio, o histórico de cada
-- agendamento e os feriados (nacionais e do DF) usados no cálculo de dia útil.
--
-- Quem e quando: gravados por trigger com o usuário da sessão, nunca com o que vier
-- no corpo. O histórico também é escrito por trigger, na mesma transação da
-- alteração do agendamento: toda escrita (pela tela, pela sugestão ou pela
-- confirmação automática) deixa rastro sem depender de cada rota lembrar disso.
--
-- RLS (ADR 0001): leitura com fat_pode_ver_tela('canViewCalendarioEnvios')
-- (canViewBilling continua abrindo); escrita com canManageCalendarioEnvios, que é
-- independente de canManageBilling. O perfil das faturistas tem as duas chaves.
--
-- Carga: as regras da planilha "convênio × data de faturamento" e os feriados de
-- 2026 e 2027. As fontes pagadoras do apLIS ficam vazias aqui; a issue 07 levanta os
-- ids no banco do lab. Novembro/2026 é gerado pela sugestão (issue 06).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.fat_pode_ver_tela(text[])') IS NULL THEN
    RAISE EXCEPTION 'Função public.fat_pode_ver_tela(text[]) não existe. Aplique 20261028150100_fat_permissoes_por_tela.sql antes desta migration.';
  END IF;
END $$;

-- ─── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fat_envio_regras (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio              TEXT NOT NULL UNIQUE CHECK (btrim(convenio) <> ''),
  membros               TEXT,
  fontes_pagadoras      INTEGER[] NOT NULL DEFAULT '{}',
  -- JanelaEnvio[] de api/_lib/faturamento/calendarioEnvios.ts; a forma de cada janela é validada na API.
  janelas               JSONB NOT NULL CHECK (jsonb_typeof(janelas) = 'array' AND jsonb_array_length(janelas) > 0),
  envios_sugeridos_mes  SMALLINT CHECK (envios_sugeridos_mes BETWEEN 1 AND 23),
  observacao            TEXT,
  ativo                 BOOLEAN NOT NULL DEFAULT true,
  alterado_por          UUID REFERENCES auth.users(id),
  alterado_por_nome     TEXT,
  alterado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fat_envio_regras IS 'Regra de envio: as janelas em que cada convênio aceita o envio dos lotes (Calendário de envios do Faturamento). Não confundir com glosa_prazo_regras.';

CREATE TABLE IF NOT EXISTS public.fat_envio_agendamentos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id               UUID NOT NULL REFERENCES public.fat_envio_regras(id),
  data_prevista          DATE NOT NULL,
  -- Índice em fat_envio_regras.janelas; nulo quando a data cai fora de todas as janelas.
  janela_indice          SMALLINT,
  origem                 TEXT NOT NULL CHECK (origem IN ('sugestao', 'manual')),
  editado                BOOLEAN NOT NULL DEFAULT false,
  data_envio             DATE,
  marcado_por            UUID REFERENCES auth.users(id),
  marcado_por_nome       TEXT,
  marcado_em             TIMESTAMPTZ,
  lote_aplis_confirmado  INTEGER,
  confirmado_em          TIMESTAMPTZ,
  criado_por             UUID REFERENCES auth.users(id),
  criado_por_nome        TEXT,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fat_envio_agendamentos_data_prevista_idx ON public.fat_envio_agendamentos (data_prevista);
CREATE INDEX IF NOT EXISTS fat_envio_agendamentos_regra_idx ON public.fat_envio_agendamentos (regra_id);

COMMENT ON TABLE public.fat_envio_agendamentos IS 'Agendamento de envio: um convênio (Regra de envio) numa data prevista do Calendário de envios; enviado quando tem data_envio.';

-- agendamento_id sem FK: o histórico de um agendamento removido continua ligado a
-- ele (inclusive a linha "removeu"); regra_id e data_prevista o mantêm legível.
CREATE TABLE IF NOT EXISTS public.fat_envio_agendamento_historico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id   UUID NOT NULL,
  regra_id         UUID NOT NULL REFERENCES public.fat_envio_regras(id),
  data_prevista    DATE NOT NULL,
  acao             TEXT NOT NULL CHECK (acao IN ('criou', 'moveu', 'marcou', 'desmarcou', 'confirmou_aplis', 'removeu')),
  antes            JSONB,
  depois           JSONB,
  por              UUID REFERENCES auth.users(id),
  por_nome         TEXT,
  em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fat_envio_agendamento_historico_agendamento_idx ON public.fat_envio_agendamento_historico (agendamento_id);

COMMENT ON TABLE public.fat_envio_agendamento_historico IS 'Histórico dos Agendamentos de envio (criou, moveu, marcou, desmarcou, confirmou_aplis, removeu), gravado por trigger.';

CREATE TABLE IF NOT EXISTS public.fat_feriados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data         DATE NOT NULL UNIQUE,
  descricao    TEXT NOT NULL CHECK (btrim(descricao) <> ''),
  abrangencia  TEXT NOT NULL CHECK (abrangencia IN ('nacional', 'DF'))
);

COMMENT ON TABLE public.fat_feriados IS 'Feriados nacionais e do DF usados no dia útil do Calendário de envios do Faturamento.';

-- ─── Autoria ──────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: o nome vem de user_profiles, que a RLS pode esconder de quem grava.

CREATE OR REPLACE FUNCTION public.fat_envio_nome_usuario()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(up.name), ''), up.email) FROM public.user_profiles up WHERE up.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.fat_envio_regras_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.alterado_por = auth.uid();
  NEW.alterado_por_nome = public.fat_envio_nome_usuario();
  NEW.alterado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_envio_regras_autoria ON public.fat_envio_regras;
CREATE TRIGGER trigger_fat_envio_regras_autoria
  BEFORE INSERT OR UPDATE ON public.fat_envio_regras
  FOR EACH ROW EXECUTE FUNCTION public.fat_envio_regras_set_autoria();

-- Quem criou e quem marcou. Quem criou não muda depois do INSERT. Marcar (ou trocar a
-- data de envio) regrava quem marcou; desmarcar limpa. A confirmação automática roda
-- sem usuário (auth.uid() nulo).
CREATE OR REPLACE FUNCTION public.fat_envio_agendamentos_set_autoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.criado_por = auth.uid();
    NEW.criado_por_nome = public.fat_envio_nome_usuario();
    NEW.criado_em = NOW();
  ELSE
    NEW.criado_por = OLD.criado_por;
    NEW.criado_por_nome = OLD.criado_por_nome;
    NEW.criado_em = OLD.criado_em;
  END IF;

  IF NEW.data_envio IS NULL THEN
    NEW.marcado_por = NULL;
    NEW.marcado_por_nome = NULL;
    NEW.marcado_em = NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.data_envio IS DISTINCT FROM OLD.data_envio THEN
    NEW.marcado_por = auth.uid();
    NEW.marcado_por_nome = public.fat_envio_nome_usuario();
    NEW.marcado_em = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fat_envio_agendamentos_autoria ON public.fat_envio_agendamentos;
CREATE TRIGGER trigger_fat_envio_agendamentos_autoria
  BEFORE INSERT OR UPDATE ON public.fat_envio_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fat_envio_agendamentos_set_autoria();

-- ─── Histórico ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: o histórico não tem policy de escrita; só este trigger grava.
-- Uma alteração pode gerar mais de uma linha (ex.: mover e marcar no mesmo UPDATE).

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
    INSERT INTO public.fat_envio_agendamento_historico (agendamento_id, regra_id, data_prevista, acao, antes, por, por_nome)
    VALUES (OLD.id, OLD.regra_id, OLD.data_prevista, 'removeu',
            jsonb_build_object('data_prevista', OLD.data_prevista, 'data_envio', OLD.data_envio), v_por, v_por_nome);
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

DROP TRIGGER IF EXISTS trigger_fat_envio_agendamentos_historico ON public.fat_envio_agendamentos;
CREATE TRIGGER trigger_fat_envio_agendamentos_historico
  AFTER INSERT OR UPDATE OR DELETE ON public.fat_envio_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fat_envio_agendamentos_historico();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.fat_envio_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_envio_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_envio_agendamento_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_feriados ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['fat_envio_regras', 'fat_envio_agendamentos', 'fat_envio_agendamento_historico', 'fat_feriados']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    -- Mesma regra da rota, do menu e do GET (chavesQueAbremTela('calendarioEnvios')).
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.fat_pode_ver_tela(''canViewCalendarioEnvios''))',
                   t || '_select_calendario', t);

    -- O histórico só é escrito pelo trigger (SECURITY DEFINER).
    CONTINUE WHEN t = 'fat_envio_agendamento_historico';

    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.current_user_has_permission(''canManageCalendarioEnvios''))',
                   t || '_insert_calendario', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.current_user_has_permission(''canManageCalendarioEnvios'')) WITH CHECK (public.current_user_has_permission(''canManageCalendarioEnvios''))',
                   t || '_update_calendario', t);
    -- Regras não são apagadas (desativar mantém o histórico).
    CONTINUE WHEN t = 'fat_envio_regras';
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.current_user_has_permission(''canManageCalendarioEnvios''))',
                   t || '_delete_calendario', t);
  END LOOP;
END $$;

-- ─── Carga: Regras de envio da planilha ───────────────────────────────────────
-- "Todos os dias" começa com 4 envios sugeridos no mês (≈ um por semana). FASCAL é
-- enviada pela CASSI e não tem regra própria.

INSERT INTO public.fat_envio_regras (convenio, membros, janelas, envios_sugeridos_mes, observacao)
VALUES
  ('AMIL',                    NULL, '[{"tipo":"dias_corridos","de":1,"ate":15}]', NULL, NULL),
  ('AMHP',                    NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('AMHP – BACEN',            NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('AMPLA',                   NULL, '[{"tipo":"dias_corridos","de":1,"ate":10}]', NULL, NULL),
  ('ASSEFAZ',                 NULL, '[{"tipo":"dias_uteis","de":1,"ate":5}]', NULL, NULL),
  ('BRADESCO',                NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('BRB',                     NULL, '[{"tipo":"dias_uteis","de":1,"ate":2}]', NULL, NULL),
  ('CÂMARA',                  NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('CASSI',                   NULL, '[{"tipo":"dias_corridos","de":1,"ate":19}]', NULL, 'Inclui FASCAL'),
  ('CBMDF',                   NULL, '[{"tipo":"ultimo_dia_util"}]', NULL, NULL),
  ('EVIDA/LUMINAR',           NULL, '[{"tipo":"dias_uteis","de":1,"ate":5}]', NULL, NULL),
  ('FUSEX',                   NULL, '[{"tipo":"dias_fixos","dias":[3,16]}]', NULL, 'XML junto'),
  ('GAMA',                    NULL, '[{"tipo":"dias_uteis","de":1,"ate":5}]', NULL, NULL),
  ('GDF INAS',                NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('GEAP',                    NULL, '[{"tipo":"dias_corridos","de":1,"ate":10}]', NULL, NULL),
  ('PF',                      NULL, '[{"tipo":"dias_corridos","de":1,"ate":7}]', NULL, NULL),
  ('PLAN ASSISTE',            NULL, '[{"tipo":"calendario_convenio"}]', NULL, NULL),
  ('PMDF',                    NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('POSTAL SAÚDE',            NULL, '[{"tipo":"dias_uteis","de":1,"ate":5}]', NULL, 'Confirmar no calendário do convênio'),
  ('SAÚDE CAIXA',             NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('SIS',                     NULL, '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('STF',                     NULL, '[{"tipo":"dias_corridos","de":1,"ate":21}]', NULL, NULL),
  ('STJ/PRO-SER',             NULL, '[{"tipo":"dias_corridos","de":21,"ate":23}]', NULL, NULL),
  ('SULAMÉRICA',              NULL, '[{"tipo":"ultimo_dia_util"}]', NULL, NULL),
  ('TJDFT',                   NULL, '[{"tipo":"dias_corridos","de":15,"ate":20}]', NULL, 'Física e online'),
  ('TRE',                     NULL, '[{"tipo":"dias_uteis","de":1,"ate":2}]', NULL, 'Física e online'),
  ('TRT',                     NULL, '[{"tipo":"dias_uteis","de":1,"ate":2},{"tipo":"dias_uteis","de":15,"ate":16}]', NULL, NULL),
  ('TST',                     NULL, '[{"tipo":"calendario_convenio"}]', NULL, 'Geralmente até o dia 20'),
  ('AMHPDF – Online',
   'AFEGO, SERPRO, BACEN, STM, CASEMBRAPA, TRF – PRO SOCIAL, CASEC, UNAFISCO, CONAB',
   '[{"tipo":"todos_os_dias"}]', 4, NULL),
  ('AMHPDF – Entrega física',
   'AFEB, LIFE EMPRESARIAL, ASETE, NOTRE DAME, CAEME, OMINT, FAPES, PROASA, CNTI, PETROBRAS, EMBRATEL – TELOS, CARE PLUS, GRAVIA',
   '[{"tipo":"todos_os_dias"}]', 4, NULL)
ON CONFLICT (convenio) DO NOTHING;

-- ─── Carga: feriados nacionais e do DF de 2026 e 2027 ─────────────────────────
-- Carnaval e Corpus Christi são ponto facultativo, mas o laboratório não envia
-- nesses dias; a lista é editável na tela.

INSERT INTO public.fat_feriados (data, descricao, abrangencia)
VALUES
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval', 'nacional'),
  ('2026-02-17', 'Carnaval', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes e Fundação de Brasília', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2026-11-30', 'Dia do Evangélico', 'DF'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-02-08', 'Carnaval', 'nacional'),
  ('2027-02-09', 'Carnaval', 'nacional'),
  ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes e Fundação de Brasília', 'nacional'),
  ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-05-27', 'Corpus Christi', 'nacional'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2027-11-30', 'Dia do Evangélico', 'DF'),
  ('2027-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;
