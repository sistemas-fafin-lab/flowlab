-- EVA — áudio e imagem pelo WhatsApp e o relógio da VPS (D43, D44, issue 32).
--
-- 1. ti_agente_mensagens ganha os dados da mídia recebida. O arquivo fica no WAHA local da VPS; a VPS
--    baixa, sobe para o bucket privado ti-agente-midias e avisa a Vercel, que transcreve o áudio
--    (Gemini) ou anexa a imagem ao card citado. midia_status:
--      pendente (webhook) → baixada | nao_baixou (VPS) → processando (Vercel) → processada | erro,
--      ou aguardando_card (imagem sem o código do card) → processada | expirada (2 h).
-- 2. ti_agente_config.vps_recursos: o que o pacote da VPS sabe fazer ('midia', 'relogio'), gravado
--    junto com o sinal de vida. Sem 'midia', o webhook responde ao áudio como antes.
-- 3. A finalidade 'transcricao_audio' no registro de chamadas de IA.
-- 4. O bucket privado ti-agente-midias. Só o servidor lê e grava (service role): sem policies.
--
-- Idempotente.

-- ── 1. A mídia da mensagem recebida ─────────────────────────────────────────
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_tipo     text;
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_mimetype text;
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_url      text;
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_status   text;
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_path     text;
ALTER TABLE public.ti_agente_mensagens ADD COLUMN IF NOT EXISTS midia_bytes    integer;

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_midia_tipo_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_midia_tipo_check
  CHECK (midia_tipo IS NULL OR midia_tipo IN ('audio', 'imagem'));

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_midia_status_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_midia_status_check
  CHECK (midia_status IS NULL OR midia_status IN (
    'pendente', 'baixada', 'nao_baixou', 'processando', 'processada', 'aguardando_card', 'erro', 'expirada'
  ));

ALTER TABLE public.ti_agente_mensagens DROP CONSTRAINT IF EXISTS ti_agente_mensagens_midia_bytes_check;
ALTER TABLE public.ti_agente_mensagens ADD CONSTRAINT ti_agente_mensagens_midia_bytes_check
  CHECK (midia_bytes IS NULL OR midia_bytes >= 0);

-- A VPS (a cada 5 s) e o relógio procuram só as mídias em andamento: índice parcial, pequeno.
CREATE INDEX IF NOT EXISTS idx_ti_agente_mensagens_midia_andamento
  ON public.ti_agente_mensagens (midia_status, created_at)
  WHERE midia_status IN ('pendente', 'baixada', 'nao_baixou', 'processando', 'aguardando_card');

COMMENT ON COLUMN public.ti_agente_mensagens.midia_tipo IS 'D43: audio ou imagem, quando a mensagem recebida trouxe mídia que a EVA trata.';
COMMENT ON COLUMN public.ti_agente_mensagens.midia_url IS 'D43: a URL do arquivo no WAHA local da VPS (só a VPS alcança).';
COMMENT ON COLUMN public.ti_agente_mensagens.midia_status IS
  'D43: pendente → baixada | nao_baixou → processando → processada | erro; aguardando_card → processada | expirada.';
COMMENT ON COLUMN public.ti_agente_mensagens.midia_path IS 'D43: o arquivo no bucket privado ti-agente-midias, até ser tratado (o áudio sai depois da transcrição).';

-- ── 2. O que a VPS sabe fazer ───────────────────────────────────────────────
ALTER TABLE public.ti_agente_config ADD COLUMN IF NOT EXISTS vps_recursos text[] NOT NULL DEFAULT '{}'::text[];
COMMENT ON COLUMN public.ti_agente_config.vps_recursos IS
  'D43/D44: recursos do pacote da VPS (midia, relogio), gravados com o sinal de vida (waha_verificado_em).';

-- ── 3. A finalidade da transcrição no registro de chamadas de IA ────────────
ALTER TABLE public.ti_agente_chamadas_ia DROP CONSTRAINT IF EXISTS ti_agente_chamadas_ia_finalidade_check;
ALTER TABLE public.ti_agente_chamadas_ia ADD CONSTRAINT ti_agente_chamadas_ia_finalidade_check
  CHECK (finalidade IN ('analise_reuniao', 'resposta_whatsapp', 'chat', 'analise_chamado', 'transcricao_audio'));
COMMENT ON COLUMN public.ti_agente_chamadas_ia.finalidade IS
  'analise_reuniao, resposta_whatsapp, chat, analise_chamado (chamado do LAB-BRAIN) ou transcricao_audio (áudio do WhatsApp, D43).';

-- ── 4. O bucket privado das mídias recebidas ────────────────────────────────
-- Sem lista de tipos: só o servidor grava, e um áudio de celular pode chegar com um tipo menos comum
-- (audio/x-m4a, audio/3gpp). O webhook já só deixa passar áudio e imagem.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ti-agente-midias', 'ti-agente-midias', false, 10485760) -- 10 MB, o limite dos anexos dos chamados
ON CONFLICT (id) DO NOTHING;
