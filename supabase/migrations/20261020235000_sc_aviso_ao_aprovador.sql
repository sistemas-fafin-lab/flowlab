-- ═══════════════════════════════════════════════════════════════════════════════
-- Solicitações de Compra — aviso por e-mail ao aprovador
-- Migration: 20261020235000_sc_aviso_ao_aprovador.sql
-- (.scratch/solicitacoes-aprovacao-gestor/issues/04-email-e-card-home.md)
--
-- Depende de 20261020220000 (approver_id) e 20261020234000 (recálculo).
--
-- Sinal: requests.approver_notified_at. SC pending com approver_id e
-- approver_notified_at NULL = aprovador ainda não avisado (fila). Cobre os dois
-- caminhos em que a SC ganha aprovador sem mexer neles: o trigger de criação
-- (requests_definir_aprovador) e os triggers de recálculo da issue 03. O backfill
-- da issue 01 NÃO avisa: as SCs que já têm aprovador entram marcadas.
--
-- Disparo: depois de cada INSERT ou UPDATE de approver_id em requests (por
-- statement, então um recálculo de N SCs gera uma chamada só), se houver fila,
-- pg_net chama (fire-and-forget, só após o COMMIT) a rota
-- POST /api/notifications/sc-awaiting-approval, que esvazia a fila: marca cada
-- SC antes de enviar (duas chamadas simultâneas não duplicam) e desmarca se o
-- envio falhar (a próxima chamada tenta de novo). Aprovador sem e-mail fica
-- marcado, sem envio.
--
-- ─── Provisionamento dos segredos (fora do VCS — rodar uma vez por ambiente) ───
--   select vault.create_secret(
--     'https://<seu-flowlab>/api/notifications/sc-awaiting-approval',
--     'flowlab_sc_aviso_aprovador_url');
--   select vault.create_secret('<CRON_SECRET da Vercel>', 'flowlab_cron_secret');
-- Sem os segredos o aviso não sai (WARNING no log) e a SC fica na fila até a
-- próxima chamada.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.requests_recalcular_aprovador_colaborador()') IS NULL THEN
    RAISE EXCEPTION 'Aplique antes 20261020234000_sc_recalculo_aprovador.sql.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS approver_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.requests.approver_notified_at IS 'Quando o aprovador (approver_id) foi avisado por e-mail de que a SC aguarda a aprovação dele. NULL com approver_id preenchido em SC pending = aviso na fila (api/_lib/handlers/notifications-sc-awaiting-approval.ts).';

-- Backfill não avisa.
UPDATE public.requests
   SET approver_notified_at = now()
 WHERE approver_id IS NOT NULL
   AND approver_notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_aviso_aprovador_pendente
  ON public.requests(created_at)
  WHERE type = 'SC' AND status = 'pending' AND approver_id IS NOT NULL AND approver_notified_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- O client não marca o aviso (calaria o e-mail ao aprovador). Mesmo padrão de
-- requests_proteger_aprovador: sem DEFINER, para ler o current_user.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_proteger_aviso_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approver_notified_at := NULL;
  ELSIF NEW.approver_notified_at IS DISTINCT FROM OLD.approver_notified_at THEN
    RAISE EXCEPTION 'O aviso ao aprovador é registrado pelo sistema e não pode ser alterado.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_proteger_aviso_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_proteger_aviso_aprovador
  BEFORE INSERT OR UPDATE OF approver_notified_at ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_proteger_aviso_aprovador();

COMMENT ON FUNCTION public.requests_proteger_aviso_aprovador() IS 'Vindo do client (authenticated/anon): SC nasce com approver_notified_at NULL e o client não altera a coluna. service_role (rota do aviso), SECURITY DEFINER e migrations passam.';

-- Aprovador trocado (p.ex. approver_id voltou a NULL pelo ON DELETE SET NULL e
-- o recálculo atribuiu outro): o aviso é por aprovador, então volta para a fila.
CREATE OR REPLACE FUNCTION public.requests_reabrir_aviso_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_id IS DISTINCT FROM OLD.approver_id THEN
    NEW.approver_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_requests_reabrir_aviso_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_reabrir_aviso_aprovador
  BEFORE UPDATE OF approver_id ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_reabrir_aviso_aprovador();

COMMENT ON FUNCTION public.requests_reabrir_aviso_aprovador() IS 'Quando approver_id muda, zera approver_notified_at: o novo aprovador (se houver) entra na fila do aviso.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Fila não vazia → chama a rota do aviso.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.requests_avisar_aprovador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.requests
     WHERE type = 'SC' AND status = 'pending'
       AND approver_id IS NOT NULL AND approver_notified_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  -- Best-effort: falha aqui nunca quebra a criação da SC nem o save do RH.
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'flowlab_sc_aviso_aprovador_url' LIMIT 1;
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'flowlab_cron_secret' LIMIT 1;

    IF v_url IS NULL OR v_secret IS NULL THEN
      RAISE WARNING 'requests_avisar_aprovador: segredos do Vault ausentes; aviso ao aprovador fica na fila';
      RETURN NULL;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      body := '{}'::jsonb,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'requests_avisar_aprovador: falha ao enfileirar o aviso (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.requests_avisar_aprovador() IS 'Depois de INSERT/UPDATE de approver_id em requests: havendo SC pending com aprovador ainda não avisado, chama (pg_net) a rota que envia o e-mail ao aprovador.';

REVOKE ALL ON FUNCTION public.requests_avisar_aprovador() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_requests_avisar_aprovador ON public.requests;
CREATE TRIGGER trigger_requests_avisar_aprovador
  AFTER INSERT OR UPDATE OF approver_id ON public.requests
  FOR EACH STATEMENT EXECUTE FUNCTION public.requests_avisar_aprovador();

COMMIT;
