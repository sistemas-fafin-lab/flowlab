-- ═══════════════════════════════════════════════════════════════════════════════
-- EVA, o agente de TI — tabelas e RLS
-- Migration: 20261013150000_eva_tabelas.sql
-- (.scratch/agente-ti/issues/05-migration-tabelas-rls.md)
--
-- Plano e decisões em docs/plans/agente-ti/PLANO_AGENTE_TI.md (§6). Seis tabelas:
--   ti_agente_config      — uma linha só: liga/desliga, pasta do Granola, situação do WAHA
--   ti_agente_membros     — quem a EVA conhece: apelidos nas reuniões e WhatsApp (D10)
--   ti_agente_reunioes    — resumos lidos (Granola ou colados) e o resultado da análise
--   ti_agente_mensagens   — fila de saída do WhatsApp + histórico (D9)
--   ti_agente_sugestoes   — tudo o que a EVA propõe; só a RPC de aprovação aplica (D6, D28)
--   ti_agente_chamadas_ia — uma linha por chamada ao Claude/Gemini, só metadados (RN14)
--
-- Quem grava reuniões, mensagens, sugestões e chamadas é o servidor (service role) ou
-- as RPCs da próxima migration — o cliente só lê, conforme a permissão (§6.2).
-- "Gestor" = canApproveAgenteTI. A equipe de TI (canManageIT) lê reuniões,
-- sugestões e o registro de IA, mas não telefones nem mensagens (D24).
--
-- Nenhuma chave é gravada em custom_roles (D15).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_permission(text)') IS NULL THEN
    RAISE EXCEPTION 'Função public.current_user_has_permission(text) não existe. Aplique 20260618010000_ensure_admin_update_policy.sql antes desta migration.';
  END IF;
  IF to_regclass('public.it_requests') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.it_requests não existe. Aplique as migrations de TI antes desta.';
  END IF;
END $$;

BEGIN;

-- Carimbo genérico de updated_at/updated_by das tabelas editáveis do módulo.
CREATE OR REPLACE FUNCTION public.ti_agente_set_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ti_agente_set_updated() IS 'BEFORE UPDATE das tabelas editáveis da EVA (config, membros): carimba updated_at e updated_by (NULL quando vem sem sessão, ex.: script da VPS).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CONFIGURAÇÃO (uma linha só)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_config (
  id                      boolean PRIMARY KEY DEFAULT true
    CONSTRAINT ti_agente_config_linha_unica CHECK (id),
  granola_folder_id       text,
  granola_ultima_sync_em  timestamptz,
  granola_verificado_em   timestamptz,
  granola_ultimo_erro     text,
  whatsapp_ativo          boolean NOT NULL DEFAULT false,
  cobranca_ativa          boolean NOT NULL DEFAULT false,
  dias_parado             smallint NOT NULL DEFAULT 5
    CONSTRAINT ti_agente_config_dias_parado_check CHECK (dias_parado BETWEEN 1 AND 60),
  waha_status             text,
  waha_verificado_em      timestamptz,
  updated_by              uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Quem já tiver criado a tabela antes destas duas colunas recebe as duas aqui.
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS granola_verificado_em timestamptz;
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS granola_ultimo_erro text;

COMMENT ON TABLE public.ti_agente_config IS 'Configuração da EVA (linha única, id = true). Liga/desliga do WhatsApp e da cobrança, pasta do Granola e situação da sessão do WAHA.';
COMMENT ON COLUMN public.ti_agente_config.granola_folder_id IS 'Pasta do Granola que a sincronização lê (fol_…). Hoje: "Team meetings" do espaço "TI Lab team".';
COMMENT ON COLUMN public.ti_agente_config.granola_ultima_sync_em IS 'Cursor da sincronização (updated_after): o maior updated_at de nota já visto. Só avança quando a execução termina sem erro.';
COMMENT ON COLUMN public.ti_agente_config.granola_verificado_em IS 'Fim da última sincronização sem erro, com ou sem nota nova. É o que o chip "Granola" do Início mostra (D25).';
COMMENT ON COLUMN public.ti_agente_config.granola_ultimo_erro IS 'Erro da última sincronização; NULL quando a última terminou bem. Acende o chip "Granola" em vermelho.';
COMMENT ON COLUMN public.ti_agente_config.whatsapp_ativo IS 'Liga/desliga geral do envio de WhatsApp (RF20). O script da VPS confere antes de cada envio.';
COMMENT ON COLUMN public.ti_agente_config.cobranca_ativa IS 'Liga/desliga só da cobrança diária automática.';
COMMENT ON COLUMN public.ti_agente_config.dias_parado IS 'Dias sem mudança para um card em andamento/revisão contar como parado (RN04).';
COMMENT ON COLUMN public.ti_agente_config.waha_status IS 'Situação da sessão ti_agente no WAHA (WORKING, SCAN_QR_CODE, FAILED…), gravada pelo script da VPS (D25).';
COMMENT ON COLUMN public.ti_agente_config.waha_verificado_em IS 'Último aviso do script da VPS. Mais de 5 min sem aviso = "Wa-ha sem sinal" no Início.';

DROP TRIGGER IF EXISTS trg_ti_agente_config_updated ON public.ti_agente_config;
CREATE TRIGGER trg_ti_agente_config_updated
  BEFORE UPDATE ON public.ti_agente_config
  FOR EACH ROW EXECUTE FUNCTION public.ti_agente_set_updated();

INSERT INTO public.ti_agente_config (id, granola_folder_id)
VALUES (true, 'fol_WEROcYgPA0ti68')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ti_agente_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_config_select ON public.ti_agente_config;
CREATE POLICY ti_agente_config_select ON public.ti_agente_config
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
  );

DROP POLICY IF EXISTS ti_agente_config_update ON public.ti_agente_config;
CREATE POLICY ti_agente_config_update ON public.ti_agente_config
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canApproveAgenteTI'))
  WITH CHECK (public.current_user_has_permission('canApproveAgenteTI'));

-- Sem INSERT/DELETE pelo cliente: a linha única nasce aqui e nunca sai.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MEMBROS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_membros (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  apelidos          text[] NOT NULL DEFAULT '{}',
  whatsapp          text
    CONSTRAINT ti_agente_membros_whatsapp_check CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{12,13}$'),
  whatsapp_chat_id  text,
  recebe_cobranca   boolean NOT NULL DEFAULT false,
  ativo             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.ti_agente_membros IS 'Pessoas que a EVA acompanha: os nomes com que aparecem nas reuniões (apelidos, RN08), o WhatsApp e a adesão à cobrança (D10). Só gestores (canApproveAgenteTI) leem e editam — tem telefone.';
COMMENT ON COLUMN public.ti_agente_membros.apelidos IS 'Como a pessoa aparece nos resumos ("Gabriel Carneiro", "Gabriel"). O casamento ignora acento e maiúsculas.';
COMMENT ON COLUMN public.ti_agente_membros.whatsapp IS 'Só dígitos, com DDI e DDD (ex.: 5561999924986).';
COMMENT ON COLUMN public.ti_agente_membros.whatsapp_chat_id IS 'Identificador do WhatsApp resolvido pelo WAHA (check-exists) no primeiro envio — pode vir sem o 9º dígito.';
COMMENT ON COLUMN public.ti_agente_membros.recebe_cobranca IS 'Adesão explícita à cobrança diária e às cobranças sob demanda.';

CREATE INDEX IF NOT EXISTS ti_agente_membros_ativo_idx ON public.ti_agente_membros (ativo);

DROP TRIGGER IF EXISTS trg_ti_agente_membros_updated ON public.ti_agente_membros;
CREATE TRIGGER trg_ti_agente_membros_updated
  BEFORE UPDATE ON public.ti_agente_membros
  FOR EACH ROW EXECUTE FUNCTION public.ti_agente_set_updated();

ALTER TABLE public.ti_agente_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_membros_select ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_select ON public.ti_agente_membros
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canApproveAgenteTI'));

DROP POLICY IF EXISTS ti_agente_membros_insert ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_insert ON public.ti_agente_membros
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission('canApproveAgenteTI'));

DROP POLICY IF EXISTS ti_agente_membros_update ON public.ti_agente_membros;
CREATE POLICY ti_agente_membros_update ON public.ti_agente_membros
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('canApproveAgenteTI'))
  WITH CHECK (public.current_user_has_permission('canApproveAgenteTI'));

-- Sem DELETE: membro é desativado (ativo = false), para o histórico de mensagens ficar.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. REUNIÕES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_reunioes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem               text NOT NULL
    CONSTRAINT ti_agente_reunioes_origem_check CHECK (origem IN ('granola', 'manual')),
  granola_note_id      text UNIQUE,
  titulo               text NOT NULL
    CONSTRAINT ti_agente_reunioes_titulo_check CHECK (length(btrim(titulo)) > 0),
  realizada_em         timestamptz,
  resumo_markdown      text NOT NULL,
  web_url              text,
  fonte_atualizada_em  timestamptz,
  status               text NOT NULL DEFAULT 'pendente'
    CONSTRAINT ti_agente_reunioes_status_check CHECK (status IN ('pendente', 'analisando', 'analisada', 'erro')),
  erro                 text,
  analisada_em         timestamptz,
  provedor             text
    CONSTRAINT ti_agente_reunioes_provedor_check CHECK (provedor IS NULL OR provedor IN ('claude', 'gemini')),
  motivo_reserva       text,
  observacoes          text,
  created_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_agente_reunioes IS 'Resumos de reunião que a EVA leu (Granola ou colados à mão) e o resultado da análise. Escrita só pelo servidor (service role).';
COMMENT ON COLUMN public.ti_agente_reunioes.realizada_em IS 'Início do evento ou criação da nota: base dos prazos relativos ("próxima sexta", RN10).';
COMMENT ON COLUMN public.ti_agente_reunioes.fonte_atualizada_em IS 'updated_at da nota no Granola. Maior que analisada_em acende o selo "atualizada desde a análise" (D14).';
COMMENT ON COLUMN public.ti_agente_reunioes.provedor IS 'Quem respondeu a análise: claude ou gemini (reserva, D17).';
COMMENT ON COLUMN public.ti_agente_reunioes.motivo_reserva IS 'Por que o Claude não respondeu, quando o Gemini assumiu.';
COMMENT ON COLUMN public.ti_agente_reunioes.observacoes IS 'O que a reunião decidiu de mais importante para os projetos, em uma ou duas frases (da análise). Alimenta o comentário da EVA no bloco Projetos do Início.';
COMMENT ON COLUMN public.ti_agente_reunioes.created_by IS 'Quem colou ou reanalisou. NULL quando veio do cron.';

CREATE INDEX IF NOT EXISTS ti_agente_reunioes_created_at_idx ON public.ti_agente_reunioes (created_at DESC);
CREATE INDEX IF NOT EXISTS ti_agente_reunioes_status_idx ON public.ti_agente_reunioes (status);

ALTER TABLE public.ti_agente_reunioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_reunioes_select ON public.ti_agente_reunioes;
CREATE POLICY ti_agente_reunioes_select ON public.ti_agente_reunioes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. MENSAGENS (fila de saída do WhatsApp + histórico)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_mensagens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id             uuid REFERENCES public.ti_agente_membros(id) ON DELETE SET NULL,
  direcao               text NOT NULL
    CONSTRAINT ti_agente_mensagens_direcao_check CHECK (direcao IN ('saida', 'entrada')),
  tipo                  text NOT NULL
    CONSTRAINT ti_agente_mensagens_tipo_check CHECK (tipo IN ('cobranca', 'cobranca_manual', 'teste', 'confirmacao', 'recebida')),
  texto                 text NOT NULL,
  card_ids              uuid[] NOT NULL DEFAULT '{}',
  status                text NOT NULL
    CONSTRAINT ti_agente_mensagens_status_check CHECK (status IN ('pendente', 'enviada', 'entregue', 'lida', 'falhou', 'recebida', 'ignorada')),
  tentativas            smallint NOT NULL DEFAULT 0,
  proxima_tentativa_em  timestamptz,
  chave_dia             text UNIQUE,
  waha_message_id       text UNIQUE,
  erro                  text,
  enviada_por           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  enviada_em            timestamptz
);

COMMENT ON TABLE public.ti_agente_mensagens IS 'Fila de saída do WhatsApp da EVA e histórico (D9). A Vercel grava pendentes; o script da VPS envia pelo WAHA local e atualiza o status. Só gestores leem (D24).';
COMMENT ON COLUMN public.ti_agente_mensagens.membro_id IS 'NULL em mensagem recebida de número desconhecido (RN13, status ignorada).';
COMMENT ON COLUMN public.ti_agente_mensagens.chave_dia IS 'cobranca:<membro>:<YYYY-MM-DD> — garante uma cobrança diária por pessoa, mesmo se o cron rodar duas vezes (RN12).';
COMMENT ON COLUMN public.ti_agente_mensagens.waha_message_id IS 'Id da mensagem no WAHA: evita gravar a mesma recebida duas vezes e liga os eventos message.ack (entregue/lida).';
COMMENT ON COLUMN public.ti_agente_mensagens.enviada_por IS 'Quem clicou em Cobrar/Lembrar (RN16). NULL nas automáticas.';

CREATE INDEX IF NOT EXISTS ti_agente_mensagens_fila_idx
  ON public.ti_agente_mensagens (status, proxima_tentativa_em)
  WHERE direcao = 'saida' AND status = 'pendente';
CREATE INDEX IF NOT EXISTS ti_agente_mensagens_membro_idx ON public.ti_agente_mensagens (membro_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ti_agente_mensagens_card_ids_idx ON public.ti_agente_mensagens USING GIN (card_ids);

ALTER TABLE public.ti_agente_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_mensagens_select ON public.ti_agente_mensagens;
CREATE POLICY ti_agente_mensagens_select ON public.ti_agente_mensagens
  FOR SELECT TO authenticated
  USING (public.current_user_has_permission('canApproveAgenteTI'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SUGESTÕES (tudo o que a EVA propõe)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_sugestoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id          uuid REFERENCES public.ti_agente_reunioes(id) ON DELETE CASCADE,
  mensagem_id         uuid REFERENCES public.ti_agente_mensagens(id) ON DELETE SET NULL,
  origem              text NOT NULL
    CONSTRAINT ti_agente_sugestoes_origem_check CHECK (origem IN ('reuniao', 'whatsapp', 'comentario', 'chat')),
  proposta_por        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  tipo                text NOT NULL
    CONSTRAINT ti_agente_sugestoes_tipo_check CHECK (tipo IN ('criar_card', 'atualizar_card', 'comentar_card')),
  card_id             uuid REFERENCES public.it_requests(id) ON DELETE SET NULL,
  proposta            jsonb NOT NULL,
  trecho              text NOT NULL,
  confianca           text NOT NULL DEFAULT 'media'
    CONSTRAINT ti_agente_sugestoes_confianca_check CHECK (confianca IN ('alta', 'media', 'baixa')),
  avisos              text[] NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'pendente'
    CONSTRAINT ti_agente_sugestoes_status_check CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'substituida')),
  decidido_por        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  decidido_em         timestamptz,
  motivo_rejeicao     text,
  card_resultante_id  uuid REFERENCES public.it_requests(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
-- Sem CHECK exigindo card_id em atualizar/comentar: apagar o card no Board põe NULL aqui
-- (ON DELETE SET NULL) e um CHECK faria a exclusão do card falhar. A RPC de aprovação
-- recusa sugestão de mudança cujo card não existe mais.

COMMENT ON TABLE public.ti_agente_sugestoes IS 'Tudo o que a EVA propõe (reunião, chat, comentário, WhatsApp). Nada muda no Kanban sem aprovação: só ti_agente_aprovar_sugestao aplica (D6, D28). O cliente não escreve direto.';
COMMENT ON COLUMN public.ti_agente_sugestoes.origem IS 'De onde veio a proposta (RN18).';
COMMENT ON COLUMN public.ti_agente_sugestoes.proposta_por IS 'Quem clicou na ação do comentário ou do chat. NULL quando veio de reunião ou WhatsApp.';
COMMENT ON COLUMN public.ti_agente_sugestoes.proposta IS 'Campos propostos (titulo, descricao, responsaveis[], prazo YYYY-MM-DD, prioridade, kanban_status, projeto_id, sprint_id, comentario).';
COMMENT ON COLUMN public.ti_agente_sugestoes.trecho IS 'Trecho da reunião ou da mensagem que justifica a sugestão.';
COMMENT ON COLUMN public.ti_agente_sugestoes.card_resultante_id IS 'O card criado ou mudado na aprovação.';

CREATE INDEX IF NOT EXISTS ti_agente_sugestoes_status_idx ON public.ti_agente_sugestoes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ti_agente_sugestoes_reuniao_idx ON public.ti_agente_sugestoes (reuniao_id);
CREATE INDEX IF NOT EXISTS ti_agente_sugestoes_card_idx ON public.ti_agente_sugestoes (card_id);

ALTER TABLE public.ti_agente_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_sugestoes_select ON public.ti_agente_sugestoes;
CREATE POLICY ti_agente_sugestoes_select ON public.ti_agente_sugestoes
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CHAMADAS DE IA (registro de uso, RN14)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ti_agente_chamadas_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finalidade      text NOT NULL
    CONSTRAINT ti_agente_chamadas_ia_finalidade_check CHECK (finalidade IN ('analise_reuniao', 'resposta_whatsapp', 'chat')),
  reuniao_id      uuid REFERENCES public.ti_agente_reunioes(id) ON DELETE SET NULL,
  mensagem_id     uuid REFERENCES public.ti_agente_mensagens(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  provedor        text NOT NULL
    CONSTRAINT ti_agente_chamadas_ia_provedor_check CHECK (provedor IN ('claude', 'gemini')),
  modelo          text NOT NULL,
  resultado       text NOT NULL
    CONSTRAINT ti_agente_chamadas_ia_resultado_check CHECK (resultado IN ('ok', 'erro', 'configuracao', 'recusa', 'cortada', 'schema_invalido')),
  erro            text,
  tokens_entrada  integer,
  tokens_saida    integer,
  duracao_ms      integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ti_agente_chamadas_ia IS 'Uma linha por chamada de IA da EVA, inclusive a do Claude que falhou e levou ao Gemini (RN14). Só metadados: nunca texto de reunião, mensagem ou pergunta.';
COMMENT ON COLUMN public.ti_agente_chamadas_ia.user_id IS 'Quem perguntou, no chat — base do limite de 30 perguntas por dia (RN17).';
COMMENT ON COLUMN public.ti_agente_chamadas_ia.resultado IS 'configuracao = 400/401/403 do provedor (chave ou workspace errado), que precisa de gente para resolver.';

CREATE INDEX IF NOT EXISTS ti_agente_chamadas_ia_created_at_idx ON public.ti_agente_chamadas_ia (created_at DESC);
CREATE INDEX IF NOT EXISTS ti_agente_chamadas_ia_provedor_idx ON public.ti_agente_chamadas_ia (provedor, resultado);
CREATE INDEX IF NOT EXISTS ti_agente_chamadas_ia_chat_idx ON public.ti_agente_chamadas_ia (user_id, created_at DESC) WHERE finalidade = 'chat';

ALTER TABLE public.ti_agente_chamadas_ia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia;
CREATE POLICY ti_agente_chamadas_ia_select ON public.ti_agente_chamadas_ia
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_permission('canManageIT')
    OR public.current_user_has_permission('canApproveAgenteTI')
  );

COMMIT;
