-- ═══════════════════════════════════════════════════════════════════════════════
-- Fase 7 — Notificar o LAB-HUB sobre o status da coleta (FlowLab → LAB-HUB)
--
-- Fecha o loop da integração: quando o operador registra check-in / coleta /
-- bloqueio, as RPCs registrar_checkin / registrar_coleta fazem
--   UPDATE ac_agendamentos SET status = 'em_coleta' | 'coletado' | 'bloqueado'.
-- Este gatilho dispara (via pg_net, fire-and-forget) a função serverless
-- api/analises-clinicas/deliver-coleta, que assina o payload com HMAC e POSTa em
-- POST /api/v1/webhooks/coletas do LAB-HUB — que reflete o status no agendamento
-- do paciente (coletado → realizado).
--
-- Por que passar pelo deliver-coleta (Node) em vez de postar direto ao LAB-HUB
-- daqui: o HMAC é validado sobre o CORPO CRU exato; assinar o jsonb do pg_net em
-- SQL é frágil (serialização diverge → 401). O Node reusa signHmacHex +
-- JSON.stringify, exatamente como o deliver-resultado (comprovado em produção).
--
-- ─── Provisionamento dos segredos (fora do VCS — rodar uma vez por ambiente) ───
-- O gatilho lê a URL do deliver-coleta e a FLOWLAB_API_KEY do Supabase Vault.
-- Provisione (NÃO commite os valores reais):
--   select vault.create_secret(
--     'https://<seu-flowlab>/api/analises-clinicas/deliver-coleta',
--     'flowlab_deliver_coleta_url');
--   select vault.create_secret('<FLOWLAB_API_KEY>', 'flowlab_api_key');
-- A FLOWLAB_API_KEY deve ser idêntica à do LAB-HUB (par compartilhado já existente).
--
-- Migration idempotente (CREATE OR REPLACE / DROP…IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════════

-- pg_net: HTTP assíncrono no Postgres. Enfileira e envia em background — não
-- bloqueia nem falha a transação da RPC de coleta.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─────────────────────────────────────────────────────────────────────────────
-- Função do gatilho: notifica o LAB-HUB quando o status entra no conjunto
-- propagável e o agendamento tem origem no LAB-HUB (labhub_id preenchido).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ac_notificar_labhub_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Só os estados que o LAB-HUB reflete (o mapeamento coletado→realizado é lá).
  IF NEW.status NOT IN ('em_coleta', 'coletado', 'bloqueado') THEN
    RETURN NEW;
  END IF;
  -- Sem labhub_id o agendamento é nativo do FlowLab: não há para quem notificar.
  IF NEW.labhub_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Best-effort: qualquer falha (Vault indisponível, config ausente, pg_net) é
  -- engolida para NUNCA quebrar a transação da coleta/check-in. A entrega em si é
  -- assíncrona; a reconciliação é um re-POST manual do deliver-coleta (idempotente).
  BEGIN
    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets WHERE name = 'flowlab_deliver_coleta_url' LIMIT 1;
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'flowlab_api_key' LIMIT 1;

    IF v_url IS NULL OR v_key IS NULL THEN
      RAISE WARNING 'ac_notificar_labhub_status: segredos do Vault ausentes; notificação ignorada (agendamento %)', NEW.id;
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('agendamentoId', NEW.id),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ac_notificar_labhub_status: falha ao enfileirar notificação (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Gatilho: dispara apenas quando o status realmente muda.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_ac_notificar_labhub_status ON ac_agendamentos;
CREATE TRIGGER trg_ac_notificar_labhub_status
  AFTER UPDATE OF status ON ac_agendamentos
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION ac_notificar_labhub_status();
